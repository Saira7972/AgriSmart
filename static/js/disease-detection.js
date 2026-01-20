document.addEventListener('DOMContentLoaded', function () {

    const fileInput = document.getElementById('image');
    const uploadZone = document.getElementById('upload-zone');
    const uploadContent = document.getElementById('upload-content');
    const imagePreview = document.getElementById('image-preview');
    const form = document.getElementById('disease-form');
    const analyzeBtn = document.getElementById('analyze-btn');

    // Mode switching elements
    const uploadModeBtn = document.getElementById('uploadModeBtn');
    const cameraModeBtn = document.getElementById('cameraModeBtn');
    const uploadMode = document.getElementById('uploadMode');
    const cameraMode = document.getElementById('cameraMode');

    // Camera elements
    const cameraBox = document.getElementById('cameraBox');
    const video = document.getElementById('video');
    const canvas = document.getElementById('canvas');
    const captureBtn = document.getElementById('captureBtn');
    const closeCameraBtn = document.getElementById('closeCamera');

    let stream = null;
    let currentMode = 'upload';

    /* ================= CAMERA SUPPORT DETECTION ================= */
    function checkCameraSupport() {
        // Check if browser supports media devices
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.log('navigator.mediaDevices not available');
            return false;
        }
        
        // Check for mobile devices (they definitely have cameras)
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
            return true; // Mobile devices always have camera
        }
        
        // Check for legacy browser support
        const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
        const hasWebkitGetUserMedia = !!(navigator.webkitGetUserMedia);
        const hasMozGetUserMedia = !!(navigator.mozGetUserMedia);
        const hasMsGetUserMedia = !!(navigator.msGetUserMedia);
        
        return hasGetUserMedia || hasWebkitGetUserMedia || hasMozGetUserMedia || hasMsGetUserMedia;
    }

    /* ================= MODE SWITCHING ================= */
    uploadModeBtn.addEventListener('click', () => switchMode('upload'));
    cameraModeBtn.addEventListener('click', () => switchMode('camera'));

    function switchMode(mode) {
        currentMode = mode;
        
        // Update button states
        uploadModeBtn.classList.toggle('mode-active', mode === 'upload');
        cameraModeBtn.classList.toggle('mode-active', mode === 'camera');
        
        // Show/hide mode content
        uploadMode.classList.toggle('hidden', mode !== 'upload');
        cameraMode.classList.toggle('hidden', mode !== 'camera');
        
        // Stop camera if switching away from camera mode
        if (mode !== 'camera' && stream) {
            stopCamera();
        }
        
        // Start camera if switching to camera mode
        if (mode === 'camera') {
            startCamera();
        }
    }

    /* ================= CAMERA FUNCTIONS ================= */
    async function startCamera() {
        // First check if we're on mobile
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (!checkCameraSupport()) {
            let errorMessage = 'Camera not available. ';
            if (isMobile) {
                errorMessage += 'Please check browser permissions or try Chrome/Safari.';
            } else {
                errorMessage += 'Your browser may not support camera access.';
            }
            alert(errorMessage);
            switchMode('upload');
            return;
        }

        try {
            cameraBox.classList.remove('hidden');
            
            // Mobile devices ke liye different constraints
            const constraints = {
                video: {
                    facingMode: { ideal: "environment" }, // Rear camera
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            };

            // iOS ke liye additional permissions check
            if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
                // iOS needs specific handling
                constraints.video.facingMode = { exact: "environment" };
            }

            stream = await navigator.mediaDevices.getUserMedia(constraints);
            video.srcObject = stream;
            video.play();
            
            console.log('Camera started successfully');
        } catch (err) {
            console.error('Camera error:', err);
            
            // User-friendly error messages
            let userMessage = 'Unable to access camera. ';
            
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                userMessage += 'Please allow camera permissions in your browser settings.';
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                userMessage += 'No camera found on this device.';
            } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
                userMessage += 'Camera is being used by another application.';
            } else {
                userMessage += 'Please try again or use upload mode.';
            }
            
            alert(userMessage);
            switchMode('upload');
        }
    }

    captureBtn.addEventListener('click', () => {
        if (!stream) return;
        
        // Pause video temporarily
        video.pause();
        
        // Set canvas dimensions
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw video frame to canvas
        const context = canvas.getContext('2d');
        
        // Flip image for front camera
        if (video.style.transform === 'scaleX(-1)') {
            context.translate(canvas.width, 0);
            context.scale(-1, 1);
        }
        
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Reset transform
        context.setTransform(1, 0, 0, 1, 0, 0);
        
        // Convert canvas to blob
        canvas.toBlob(blob => {
            const file = new File([blob], 'leaf_capture.jpg', { 
                type: 'image/jpeg',
                lastModified: Date.now()
            });
            
            // Update file input
            const dt = new DataTransfer();
            dt.items.add(file);
            fileInput.files = dt.files;
            
            // Show preview
            showPreview(file);
            
            // Switch to upload mode with preview
            switchMode('upload');
            video.play();
        }, 'image/jpeg', 0.9);
    });

    closeCameraBtn.addEventListener('click', () => {
        stopCamera();
        switchMode('upload');
    });

    function stopCamera() {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        cameraBox.classList.add('hidden');
    }

    /* ================= FILE UPLOAD ================= */
    fileInput.addEventListener('change', function () {
        showPreview(fileInput.files[0]);
    });

    uploadZone.addEventListener('dragover', e => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });

    uploadZone.addEventListener('dragleave', e => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
    });

    uploadZone.addEventListener('drop', e => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');

        const file = e.dataTransfer.files[0];
        fileInput.files = e.dataTransfer.files;
        showPreview(file);
    });

    function showPreview(file) {
        if (!file || !file.type.startsWith('image/')) {
            alert('Please select a valid image');
            return;
        }

        const reader = new FileReader();
        reader.onload = function (e) {
            uploadContent.style.display = 'none';
            imagePreview.style.display = 'flex';
            imagePreview.innerHTML = `
                <div class="preview-content">
                    <img src="${e.target.result}" class="preview-image"/>
                    <div class="preview-overlay">
                        <div class="preview-info">
                            <i class="fas fa-check-circle text-green-500 text-2xl"></i>
                            <p class="mt-2 text-sm font-medium text-gray-700">Image Ready for Analysis</p>
                            <p class="text-xs text-gray-500 mt-1">Click to change image</p>
                        </div>
                    </div>
                </div>
            `;
            
            // Add click listener to change image
            imagePreview.querySelector('.preview-content').addEventListener('click', () => {
                fileInput.click();
            });
        };
        reader.readAsDataURL(file);
    }

    /* ================= FORM SUBMISSION ================= */
    form.addEventListener('submit', function (e) {
        if (!fileInput.files[0]) {
            e.preventDefault();
            alert('Please upload or capture an image first');
            return;
        }

        // Show loading state
        const buttonText = analyzeBtn.querySelector('.button-content');
        const originalHTML = buttonText.innerHTML;
        buttonText.innerHTML = `
            <i class="fas fa-spinner fa-spin mr-3"></i>
            Analyzing Disease...
        `;
        analyzeBtn.disabled = true;
        
        // Re-enable button if submission fails (for demo)
        setTimeout(() => {
            analyzeBtn.disabled = false;
            buttonText.innerHTML = originalHTML;
        }, 10000); // 10 second timeout
    });

    /* ================= INITIALIZE ================= */
    // Initialize camera button
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (!checkCameraSupport()) {
        cameraModeBtn.disabled = true;
        if (isMobile) {
            cameraModeBtn.innerHTML = '<i class="fas fa-camera mr-2"></i>Check Permissions';
            cameraModeBtn.title = 'Camera blocked. Allow in browser settings.';
        } else {
            cameraModeBtn.innerHTML = '<i class="fas fa-camera-slash mr-2"></i>No Camera';
            cameraModeBtn.title = 'Camera not supported on this browser';
        }
    } else if (isMobile) {
        // Mobile device with camera support
        cameraModeBtn.innerHTML = '<i class="fas fa-mobile-alt mr-2"></i>Use Camera';
        cameraModeBtn.title = 'Use your phone camera';
    }

    // Clean up camera on page unload
    window.addEventListener('beforeunload', () => {
        if (stream) {
            stopCamera();
        }
    });
});