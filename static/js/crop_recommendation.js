// Form validation and submission handling
document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('crop-form');
    const inputs = form.querySelectorAll('.form-input:not([type="hidden"])');
    const cityInput = document.getElementById('city');
    const temperatureInput = document.getElementById('temperature');
    const humidityInput = document.getElementById('humidity');
    const rainfallInput = document.getElementById('rainfall');
    
    // Add focus/blur effects
    inputs.forEach(input => {
        input.addEventListener('focus', function() {
            this.parentElement.classList.add('focused');
        });
        
        input.addEventListener('blur', function() {
            this.parentElement.classList.remove('focused');
            validateInput(this);
        });
        
        input.addEventListener('input', function() {
            validateInput(this);
        });
    });

    // City input: Enter key handling
    cityInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            // Just validate, don't fetch (backend will handle it)
            validateInput(this);
        }
    });

    // Optional preview function (not required for your backend)
    async function previewWeatherData(city) {
        try {
            cityInput.classList.add('loading');
            showNotification('Validating city...', 'info');

            // Simple city validation - just check if not empty
            await new Promise(resolve => setTimeout(resolve, 500));

            cityInput.classList.add('valid');
            cityInput.classList.remove('invalid', 'loading');
            
            showNotification('City validated! Weather will be fetched on submit.', 'success');

        } catch (error) {
            cityInput.classList.add('invalid');
            cityInput.classList.remove('valid', 'loading');
            showNotification('Please enter a valid city name.', 'error');
        }
    }

    // Show notification
    function showNotification(message, type = 'info') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(n => n.remove());

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            font-weight: 600;
            z-index: 10000;
            animation: slideInRight 0.3s ease-out;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            max-width: 400px;
        `;

        if (type === 'success') {
            notification.style.background = '#10B981';
            notification.style.color = 'white';
        } else if (type === 'error') {
            notification.style.background = '#ef4444';
            notification.style.color = 'white';
        } else if (type === 'info') {
            notification.style.background = '#3b82f6';
            notification.style.color = 'white';
        }

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
    
    // Form submission
    form.addEventListener('submit', function(e) {
        // Don't prevent default - let form submit normally to Flask
        // e.preventDefault(); // REMOVED
        
        // Validate all inputs before submission
        let isValid = true;
        inputs.forEach(input => {
            if (!validateInput(input)) {
                isValid = false;
            }
        });

        // Check if city is filled
        if (!cityInput.value.trim()) {
            showNotification('Please enter a city name', 'error');
            cityInput.focus();
            cityInput.classList.add('invalid');
            isValid = false;
            e.preventDefault(); // Prevent submission if invalid
            return false;
        }
        
        if (!isValid) {
            showNotification('Please fill all required fields correctly', 'error');
            e.preventDefault(); // Prevent submission if invalid
            return false;
        }

        // Show loading state
        const submitBtn = form.querySelector('.submit-btn');
        submitBtn.classList.add('loading');
        submitBtn.disabled = true;
        
        showNotification('Analyzing your data and fetching weather...', 'info');
        
        // Let form submit naturally to Flask backend
        // Backend will handle weather API call and ML prediction
        return true;
    });
    
    // Input validation function
    function validateInput(input) {
        const value = input.value;
        const min = parseFloat(input.min);
        const max = parseFloat(input.max);
        
        // Clear previous validation states
        input.classList.remove('valid', 'invalid');
        
        // Check if empty
        if (!value) {
            input.classList.add('invalid');
            return false;
        }
        
        // Check if within range (for number inputs)
        if (input.type === 'number') {
            const numValue = parseFloat(value);
            if (isNaN(numValue) || numValue < min || numValue > max) {
                input.classList.add('invalid');
                return false;
            }
        }
        
        // Valid input
        input.classList.add('valid');
        return true;
    }
    
    // Add animations on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = 1;
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe process cards for animation
    document.querySelectorAll('.process-card').forEach(card => {
        card.style.opacity = 0;
        card.style.transform = 'translateY(30px)';
        card.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(card);
    });

    // Add animation styles
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }

        .form-input.loading {
            opacity: 0.6;
            cursor: wait;
        }
    `;
    document.head.appendChild(style);
});