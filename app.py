# ---------------- IMPORTS ----------------
import os
import requests
import uuid
from collections import Counter
from datetime import datetime, timedelta

# -------- AUTH IMPORTS --------
from flask_login import (
    LoginManager, UserMixin,
    login_user, login_required,
    logout_user, current_user
)

from flask_jwt_extended import (
    JWTManager,
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity
)

from flask import Flask, render_template, request, redirect, url_for, flash, send_from_directory, jsonify
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash
import pandas as pd
import numpy as np
import joblib
import xgboost as xgb
import cv2
from ultralytics import YOLO

from PIL import Image
from deep_translator import GoogleTranslator
import google.generativeai as genai
from dotenv import load_dotenv
from supabase import create_client


# ---------------- ENV SETUP ----------------
load_dotenv()
app = Flask(__name__)


# Secret Key
app.secret_key = os.getenv("SECRET_KEY") or "fallback-secret"

# ---------------- JWT CONFIG ----------------
app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=2)
app.config["JWT_REFRESH_TOKEN_EXPIRES"] = timedelta(days=7)

jwt = JWTManager(app)


# Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("❌ Supabase credentials not loaded. Check your .env file!")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ------------------- Google Gemini -------------------
os.environ["GOOGLE_API_KEY"] = GOOGLE_API_KEY 
chat_model = genai.GenerativeModel("models/gemini-2.5-flash")

# ---------------- FLASK CONFIG ----------------
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 10 * 1024 * 1024
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# ---------------- LOGIN MANAGER ----------------
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "login"


# -------------------------- Language Setup --------------------------
lang_map = {"english": "en", "urdu": "ur", "sindhi": "sd"}
conversation_history = []
MAX_TURNS = 6  # Real-time multi-turn conversation

# -------------------------- Translation Functions --------------------------
def translate_to_english(text, lang_code):
    if lang_code == "en":
        return text
    return GoogleTranslator(source=lang_code, target="en").translate(text)

def translate_from_english(text, lang_code):
    if lang_code == "en":
        return text
    # Split into safe chunks
    chunks = [text[i:i+4000] for i in range(0, len(text), 4000)]
    translated_chunks = [GoogleTranslator(source="en", target=lang_code).translate(c) for c in chunks]
    return " ".join(translated_chunks)

# -------------------------- Format Conversation --------------------------
def format_conversation(history, prompt, limit=MAX_TURNS):
    history_text = ""
    for turn in history[-limit:]:
        history_text += f"User: {turn['user']}\nBot: {turn['bot']}\n"
    history_text += f"User: {prompt}\nBot:"
    
    # Real-time practical advice prompt
    return (
        "You are AgriBot, an AI agriculture assistant. "
        "Give practical, actionable advice for crops, fertilizers, pest control, "
        "and irrigation. Provide approximate ranges and step-by-step instructions, "
        "do NOT just say 'consult an expert'.\n\n"
        f"{history_text}"
    )

# ---------------- USER CLASS ----------------
class User(UserMixin):
    def __init__(self, id, name, email, password=None, role='farmer'):
        self.id = id
        self.name = name
        self.email = email
        self.password = password
        self.role = role


@login_manager.user_loader
def load_user(user_id):
    resp = supabase.table("users").select("*").eq("id", user_id).execute()
    data = getattr(resp, "data", None) or []
    if data:
        u = data[0]
        return User(
            id=u['id'],
            name=u['name'],
            email=u['email'],
            password=u.get('password'),  # store hashed password for check_password_hash
            role=u.get('role','farmer')
        )
    return None


# ---------------- ML MODELS ----------------
# Disease Detection
MODEL_PATH = "Plant_disease_detection/best.pt" 
try:
    disease_model = YOLO(MODEL_PATH)
    print(f"✅ YOLO Model loaded from {MODEL_PATH}")
    class_names = disease_model.names
except Exception as e:
    print(f"❌ Error loading YOLO model: {e}")
    disease_model = None

# Disease & Supplement info
disease_info = pd.read_csv('plant_disease_detection/utils/disease_info.csv', encoding='cp1252')
supplement_info = pd.read_csv('plant_disease_detection/utils/supplement_info.csv', encoding='cp1252')

# Crop Recommendation
crop_model = xgb.Booster()
crop_model.load_model("crop_recommendation/crop_model.json")
scaler = joblib.load("crop_recommendation/scaler.pkl")
crop_mapping = {
    0: 'apple', 1: 'banana', 2: 'blackgram', 3: 'chickpea', 4: 'coconut', 5: 'coffee',
    6: 'cotton', 7: 'grapes', 8: 'jute', 9: 'kidneybeans', 10: 'lentil', 11: 'maize',
    12: 'mango', 13: 'mothbeans', 14: 'mungbean', 15: 'muskmelon', 16: 'orange',
    17: 'papaya', 18: 'pigeonpeas', 19: 'pomegranate', 20: 'rice', 21: 'watermelon'
} 

# ---------------- HELPERS ----------------
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'png','jpg','jpeg','webp'}


def contains_leaf(image_path, green_threshold=0.10): # Lowered threshold slightly
    img = Image.open(image_path).convert('RGB')
    img_array = np.array(img)
    r, g, b = img_array[:,:,0], img_array[:,:,1], img_array[:,:,2]
    green_pixels = np.sum((g > r) & (g > b))
    total_pixels = img_array.shape[0] * img_array.shape[1]
    green_ratio = green_pixels / total_pixels
    return green_ratio > green_threshold

import logging

def predict_image(image_path):
    """
    Runs YOLO prediction on the image.
    Annotates the image with bounding boxes (green).
    Returns the class with the highest confidence.
    """
    try:
        # 1. Run YOLO inference
        if disease_model is None:
            raise ValueError("Model not loaded")

        results = disease_model(image_path)[0]

        # 2. Process Detections
        highest_conf = 0.0
        best_class = "Healthy"
        detections_found = False

        # Load image for annotation with OpenCV
        image = cv2.imread(image_path)
        if image is None:
             raise ValueError("Could not read image with OpenCV")

        for box in results.boxes:
            detections_found = True
            cls_id = int(box.cls)
            conf = float(box.conf)
            current_class = class_names[cls_id]

            # Track best prediction (highest confidence)
            if conf > highest_conf:
                highest_conf = conf
                best_class = current_class

            # Draw Box (Green) - No Text as requested
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            color = (0, 255, 0) 
            cv2.rectangle(image, (x1, y1), (x2, y2), color, 2)

        # 3. Save Annotated Image (Overwrite original to show boxes in frontend)
        cv2.imwrite(image_path, image)

        # 4. Handle "No Detection" case
        if not detections_found:
            # If YOLO finds nothing, we assume it's Healthy or Unknown
            best_class = "Healthy"
            highest_conf = 100.0

        # 5. Map YOLO class to Readable Label
        readable_label = best_class.replace("_", " ").title()
        
        return {
            'class': best_class,
            'readable_class': readable_label,
            'confidence': round(highest_conf * 100, 2),
            'success': True
        }

    except Exception as e:
        logging.error(f"Prediction failed for {image_path}: {e}")
        return {
            'class': 'Error',
            'readable_class': 'Prediction failed',
            'confidence': 0.0,
            'success': False
        }



# ---------------- ROUTES ----------------
@app.route('/')
def index():
    return render_template('index.html')

# --------- AUTH ---------
@app.route('/register', methods=['GET','POST'])
def register():
    if request.method=='POST':
        name = request.form['name']
        email = request.form['email']
        password = request.form['password']
        terms = request.form.get('terms')

        if not terms:
            flash("You must agree to terms & policy.", "error")
            return redirect(url_for("index"))

        # Check if user already exists
        resp = supabase.table("users").select("*").eq("email", email).execute()
        existing = getattr(resp,"data",[]) or []
        if existing:
            flash("Email already registered. Please login.", "error")
            return redirect(url_for("index"))

        # Create user
        hashed = generate_password_hash(password, method='pbkdf2:sha256')

        resp = supabase.table("users").insert({
            "name": name, "email": email, "password": hashed, "role": "farmer"
        }).execute()

        data = getattr(resp,"data",None)
        if data:
            user = User(data[0]['id'], name, email, hashed)
            login_user(user)
            flash("Account created successfully!", "success")
            return redirect(url_for('login'))

        flash("Registration failed", "error")
        return redirect(url_for('index'))

    return render_template('register.html')


# --------- LOGIN ---------

@app.route('/login', methods=['GET','POST'])
def login():
    if request.method=='POST':
        email = request.form['email']
        password = request.form['password']

        resp = supabase.table("users").select("*").eq("email", email).execute()
        data = getattr(resp,"data",[]) or []

        if data and check_password_hash(data[0]['password'], password):

            user = User(
                id=data[0]['id'],
                name=data[0]['name'],
                email=email,
                password=data[0]['password'],
                role=data[0].get('role','farmer')
            )
            login_user(user)
            flash("Logged in successfully!", "success")

            # 👉 Role based redirect
            if user.role == "admin":
                return redirect(url_for('admin_dashboard'))
            else:
                return redirect(url_for('dashboard'))

        else:
            flash("Invalid email or password.", "error")
            return redirect(url_for('index'))

    return render_template('login.html')

# ===================== JWT API =====================
@app.route("/api/login", methods=["POST"])
def api_login():
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    resp = supabase.table("users").select("*").eq("email", email).execute()
    users = resp.data or []

    if not users or not check_password_hash(users[0]["password"], password):
        return jsonify({"error": "Invalid credentials"}), 401

    user = users[0]

    access_token = create_access_token(
        identity=str(user["id"]),   # ✅ STRING ONLY
        additional_claims={
            "email": user["email"],
            "role": user["role"]
        }
    )

    refresh_token = create_refresh_token(identity=str(user["id"]))

    return jsonify({
        "access_token": access_token,
        "refresh_token": refresh_token
    })


from flask_jwt_extended import get_jwt, get_jwt_identity

@app.route("/api/dashboard")
@jwt_required()
def api_dashboard():
    user_id = get_jwt_identity()   # user_id is STRING
    claims = get_jwt()

    print("ROLE:", claims["role"])

    crops = (
        supabase
        .table("crop_recommendations")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )

    diseases = (
        supabase
        .table("disease_detections")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )

    chats = (
        supabase
        .table("chat_logs")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
        .data
    )

    return jsonify({
        "user": {
            "id": user_id,
            "role": claims["role"],
            "email": claims["email"]
        },
        "crops": crops,
        "diseases": diseases,
        "chats": chats
    })


@app.route("/api/admin/users")
@jwt_required()
def api_admin_users():
    claims = get_jwt()

    if claims["role"] != "admin":
        return jsonify({"error": "Admin only"}), 403

    users = supabase.table("users").select("*").execute().data
    return jsonify(users)


@app.route("/api/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    uid = get_jwt_identity()
    claims = get_jwt()
    return jsonify({
    "access_token": create_access_token(
        identity=uid,
        additional_claims={
            "email": claims["email"],
            "role": claims["role"]
        }
    )
})


# --------- ADMIN DASHBOARD ---------
@app.route('/admin_dashboard')
@login_required
def admin_dashboard():
    if current_user.role != "admin":
        flash("Access denied!", "danger")
        return redirect(url_for('dashboard'))

    # --- Users ---
    users = []
    try:
        resp = supabase.table("users").select("*").execute()
        users = getattr(resp, "data", []) or []
    except Exception as e:
        print(f"Error fetching users: {e}")

    # Mapping: user_id -> user_name
    user_map = {u["id"]: u["name"] for u in users if "id" in u and "name" in u}

    # --- Crops ---
    crops = []
    unique_crops = set()
    crop_chart_labels, crop_chart_values = [], []
    try:
        resp = supabase.table("crop_recommendations").select("*").execute()
        crops = getattr(resp, "data", []) or []

        for c in crops:
            if c.get("recommended_crop"):
                unique_crops.add(c["recommended_crop"])
            if "user_id" in c:
                c["user_name"] = user_map.get(c["user_id"], "Unknown")

        # Chart data
        crop_counts = Counter([c["recommended_crop"] for c in crops if c.get("recommended_crop")])
        crop_chart_labels = list(crop_counts.keys())
        crop_chart_values = list(crop_counts.values())

    except Exception as e:
        print(f"Error fetching crops: {e}")

    # --- Diseases ---
    diseases = []
    unique_diseases = set()
    disease_chart_labels, disease_chart_values = [], []
    try:
        resp = supabase.table("disease_detections").select("*").execute()
        diseases = getattr(resp, "data", []) or []

        for d in diseases:
            if d.get("disease_name"):
                unique_diseases.add(d["disease_name"])
            if "user_id" in d:
                d["user_name"] = user_map.get(d["user_id"], "Unknown")

        # Chart data
        disease_counts = Counter([d["disease_name"] for d in diseases if d.get("disease_name")])
        disease_chart_labels = list(disease_counts.keys())
        disease_chart_values = list(disease_counts.values())

    except Exception as e:
        print(f"Error fetching diseases: {e}")

    # --- Chat Logs ---
    chats = []
    try:
        resp = supabase.table("chat_logs").select("*").order("created_at", desc=True).limit(50).execute()
        chats = getattr(resp, "data", []) or []

        for ch in chats:
            if "user_id" in ch:
                ch["user_name"] = user_map.get(ch["user_id"], "Unknown")
    except Exception as e:
        print(f"Error fetching chats: {e}")

    # --- Render template with charts & filtered tables ---
    return render_template(
        "admin_dashboard.html",
        users=users,
        crops=crops,
        diseases=diseases,
        chats=chats,
        unique_crop_count=len(unique_crops),
        unique_disease_count=len(unique_diseases),
        crop_chart_labels=crop_chart_labels,
        crop_chart_values=crop_chart_values,
        disease_chart_labels=disease_chart_labels,
        disease_chart_values=disease_chart_values
    )
@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash("You have been logged out.")
    return redirect(url_for('index'))

# --------- DASHBOARD ---------
@app.route('/dashboard')
@login_required
def dashboard():
    uid = current_user.id
    crops = supabase.table("crop_recommendations").select("*").eq("user_id", uid).order("created_at", desc=True).execute().data or []
    diseases = supabase.table("disease_detections").select("*").eq("user_id", uid).order("created_at", desc=True).execute().data or []
    chats = supabase.table("chat_logs").select("*").eq("user_id", uid).order("created_at", desc=True).execute().data or []
    return render_template('dashboard.html', crops=crops, diseases=diseases, chats=chats)

# --------- CROP RECOMMENDATION ---------
import os, json, requests
from datetime import datetime, timedelta

CACHE_FILE = "weather_cache.json"

# Load existing cache
if os.path.exists(CACHE_FILE):
    with open(CACHE_FILE, "r") as f:
        weather_cache = json.load(f)
else:
    weather_cache = {}

def get_weather_data(city, api_key):
    """
    Fetch 3-month average weather (temp, humidity, rainfall) for a city using Visual Crossing API.
    Uses cache to save API calls (valid for 24 hours).
    """
    now = datetime.now()

    # ✅ Check if city data is in cache and still valid (less than 1 day old)
    if city in weather_cache:
        cached = weather_cache[city]
        if (now - datetime.fromisoformat(cached["timestamp"])).total_seconds() < 86400:
            print(f"🌤️ Using cached weather data for {city}")
            return cached["avg_temp"], cached["avg_humidity"], cached["total_rainfall"]

    # --- Otherwise, fetch fresh data ---
    start_date = now - timedelta(days=90)  # 3 months
    start_date_str = start_date.strftime("%Y-%m-%d")
    end_date_str = now.strftime("%Y-%m-%d")

    url = (
        f"https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/"
        f"{city}/{start_date_str}/{end_date_str}"
        f"?unitGroup=metric&include=days&key={api_key}&contentType=json"
    )

    print(f"🌦️ Fetching 3-month weather data for {city}...")
    response = requests.get(url)
    print("Status Code:", response.status_code)

    if response.status_code != 200:
        print(f"⚠️ Weather API Error for {city}: {response.text[:200]}")
        return 0, 0, 0

    try:
        data = response.json()
        days = data.get("days", [])
        if not days:
            print(f"⚠️ No 'days' field found for {city}")
            return 0, 0, 0

        total_temp, total_humidity, total_rainfall = 0, 0, 0
        for day in days:
            total_temp += day.get("temp", 0)
            total_humidity += day.get("humidity", 0)
            total_rainfall += day.get("precip", 0)

        count = len(days)
        avg_temp = total_temp / count if count else 0
        avg_humidity = total_humidity / count if count else 0
        total_rainfall = total_rainfall if count else 0

        # ✅ Save to cache for reuse
        weather_cache[city] = {
            "avg_temp": avg_temp,
            "avg_humidity": avg_humidity,
            "total_rainfall": total_rainfall,
            "timestamp": now.isoformat()
        }
        with open(CACHE_FILE, "w") as f:
            json.dump(weather_cache, f, indent=4)

        print(f"✅ Fetched {count} days for {city}: Temp={avg_temp:.2f}, Humidity={avg_humidity:.2f}, Rain={total_rainfall:.2f}")
        return avg_temp, avg_humidity, total_rainfall

    except Exception as e:
        print("❌ Error parsing weather data:", e)
        return 0, 0, 0



# --------- ROUTE ---------
@app.route('/crop_recommendation', methods=['GET', 'POST'])
@login_required
def crop_recommendation():
    if request.method == 'POST':
        try:
            # 1️⃣ Get form inputs
            city = request.form.get('city')
            soil_ph = float(request.form.get('ph'))
            nutrients = [
                float(request.form.get('nitrogen')),
                float(request.form.get('phosphorous')),
                float(request.form.get('potassium'))
            ]

            # 2️⃣ Fetch weather data (3 months average)
            VC_API_KEY = "LYVZADWDBCY56GLU8R2LCL848" 
            avg_temp, avg_humidity, total_rainfall = get_weather_data(city, VC_API_KEY)

            # 3️⃣ Prepare model features
            features = pd.DataFrame([[
                nutrients[0], nutrients[1], nutrients[2],
                avg_temp, avg_humidity, soil_ph, total_rainfall
            ]],
            columns=['N', 'P', 'K', 'temperature', 'humidity', 'ph', 'rainfall'])

            # Scale and Predict
            scaled = scaler.transform(features)
            preds = crop_model.predict(xgb.DMatrix(scaled))
            pred_class = int(np.argmax(preds[0]))
            recommended = crop_mapping.get(pred_class, "Unknown Crop")

            # 4️⃣ Save record to database
            supabase.table("crop_recommendations").insert({
                "user_id": current_user.id,
                "soil_data": {"ph": soil_ph, "nutrients": nutrients},
                "weather_data": {
                    "temperature": avg_temp,
                    "humidity": avg_humidity,
                    "rainfall": total_rainfall
                },
                "recommended_crop": recommended
            }).execute()

            # 5️⃣ Build result for frontend
            result = {
                "status": "success",
                "crop": recommended,
                "crop_image": f"image/{recommended.lower()}.jpg",
                "input_values": {
                    "N": nutrients[0],
                    "P": nutrients[1],
                    "K": nutrients[2],
                    "temperature": round(avg_temp, 2),
                    "humidity": round(avg_humidity, 2),
                    "ph": soil_ph,
                    "rainfall": round(total_rainfall, 2),
                    "city": city
                }
            }

            return render_template("crop_result.html", result=result)

        except Exception as e:
            print("❌ Exception in crop_recommendation:", e)
            result = {"status": "error", "message": str(e)}
            return render_template("crop_result.html", result=result)

    return render_template('crop_recommendation.html')



# --------- DISEASE DETECTION ---------
@app.route('/disease_detection', methods=['GET', 'POST'])
@login_required
def disease_detection():
    if request.method == 'POST':
        file = request.files.get('image')
        if not file or not allowed_file(file.filename):
            flash("Please upload a valid image", "danger")
            return redirect(url_for('disease_detection'))

        filename = secure_filename(file.filename)
        unique_name = f"{uuid.uuid4().hex}_{filename}"
        path = os.path.join(app.config['UPLOAD_FOLDER'], unique_name)
        file.save(path)

        result = predict_image(path)
        
        if not result['success']:
             flash("Prediction failed.", "danger")
             return redirect(url_for('disease_detection'))

        # Clean label for CSV lookup
        norm_label = result['readable_class'].strip().lower()

        # Fetch info from CSVs
        d_info = disease_info[disease_info['disease_name'].str.lower() == norm_label]
        s_info = supplement_info[supplement_info['disease_name'].str.lower() == norm_label]

        record = {
            "user_id": current_user.id,
            "disease_name": result['readable_class'],   # disease_name
            "disease_description": d_info.iloc[0]['description'] if not d_info.empty else None,
            "possible_steps": d_info.iloc[0]['Possible Steps'] if not d_info.empty else None,
            "disease_image_url": url_for('uploaded_file', filename=unique_name, _external=True),
            "supplement_name": s_info.iloc[0]['supplement name'] if not s_info.empty else None,
            "supplement_image_url": s_info.iloc[0]['supplement image'] if not s_info.empty else None,
            "supplement_buy_url": s_info.iloc[0]['buy link'] if not s_info.empty else None
}

        supabase.table("disease_detections").insert(record).execute()

        data = {
            "image_path": url_for('uploaded_file', filename=unique_name),
            "is_healthy": "healthy" in result['readable_class'].lower(),
            "readable_prediction": result['readable_class'],
            "confidence": result['confidence'],
        "disease_info": {
            "description": record["disease_description"],
            "precaution": record["possible_steps"]
    },
        "supplement_info": {
            "name": record["supplement_name"],         
            "image": record["supplement_image_url"],  
            "buy_link": record["supplement_buy_url"]
    }
}


        return render_template("disease_result.html", data=data)

    return render_template('disease_detection.html')

# --------- CHATBOT ---------
@app.route('/chat', methods=['GET', 'POST'])
@login_required
def chat():
    if request.method == 'GET':
        return render_template("chatbot.html")
    
    if request.method == 'POST':
        data = request.get_json()
        user_input = data.get('message', '')
        lang = data.get('language', 'en')

        # 🔹 Translate user input to English
        translated_input = translate_to_english(user_input, lang)

        # 🔹 Format conversation for Gemini
        prompt = format_conversation(conversation_history, translated_input)

        # 🔹 Generate response
        response_obj = chat_model.generate_content(prompt)
        response = response_obj.text.strip()

        # 🔹 Translate back to original language
        final_response = translate_from_english(response, lang)

        # 🔹 Save conversation history
        conversation_history.append({"user": user_input, "bot": final_response})
        if len(conversation_history) > MAX_TURNS:
            conversation_history.pop(0)

        # 🔹 Save logs in Supabase
        supabase.table("chat_logs").insert({
            "user_id": current_user.id,
            "question": user_input,
            "answer": final_response
        }).execute()

        return jsonify({"answer": final_response})

# -------------------------- File Serve --------------------------
@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

# -------------------------- Run App --------------------------
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)