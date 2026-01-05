// Mobile Menu Toggle
const mobileMenuButton = document.querySelector('.mobile-menu-button');
const mobileMenu = document.querySelector('.mobile-menu');

if (mobileMenuButton) {
    mobileMenuButton.addEventListener('click', (e) => {
        e.stopPropagation();
        mobileMenu.classList.toggle('hidden');
        document.body.style.overflow = mobileMenu.classList.contains('hidden') ? 'auto' : 'hidden';
    });

    // Close menu when link is clicked
    document.querySelectorAll('.mobile-menu a').forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.classList.add('hidden');
            document.body.style.overflow = 'auto';
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!mobileMenu.contains(e.target) && !mobileMenuButton.contains(e.target)) {
            mobileMenu.classList.add('hidden');
            document.body.style.overflow = 'auto';
        }
    });
}

// Hero Slider - FIXED VERSION
let currentSlide = 0;
const slides = document.querySelectorAll('.slide');
const dots = document.querySelectorAll('.slider-dot');
let sliderTimer;
let touchStartX = 0;
let touchEndX = 0;
let isTouchDevice = false;

function showSlide(n) {
    // Remove active class from all slides and dots
    slides.forEach(slide => slide.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));
    
    // Add active class to current slide and dot
    if (slides[n]) {
        slides[n].classList.add('active');
    }
    if (dots[n]) {
        dots[n].classList.add('active');
    }
}

// Dot navigation
dots.forEach((dot, index) => {
    dot.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        currentSlide = index;
        showSlide(currentSlide);
        resetSliderTimer();
    });
});

// Auto-advance slides
function startSliderTimer() {
    clearInterval(sliderTimer);
    sliderTimer = setInterval(() => {
        currentSlide = (currentSlide + 1) % slides.length;
        showSlide(currentSlide);
    }, 5000);
}

function resetSliderTimer() {
    clearInterval(sliderTimer);
    startSliderTimer();
}

// Initialize slider
if (slides.length > 0) {
    showSlide(currentSlide);
    startSliderTimer();
}

// Detect touch device
function detectTouchDevice() {
    return ('ontouchstart' in window) || 
           (navigator.maxTouchPoints > 0) || 
           (navigator.msMaxTouchPoints > 0);
}

isTouchDevice = detectTouchDevice();

// Handle slider controls based on device type
const heroSlider = document.querySelector('.hero-slider');
if (heroSlider) {
    if (isTouchDevice) {
        // Touch device - use touch events only
        heroSlider.addEventListener('touchstart', handleTouchStart, { passive: true });
        heroSlider.addEventListener('touchend', handleTouchEnd, { passive: true });
        heroSlider.addEventListener('touchmove', handleTouchMove, { passive: true });
    } else {
        // Non-touch device - use mouse events only
        heroSlider.addEventListener('mouseenter', () => {
            clearInterval(sliderTimer);
        });
        
        heroSlider.addEventListener('mouseleave', () => {
            startSliderTimer();
        });
        
        // Also add click navigation for non-touch devices
        heroSlider.addEventListener('click', handleClickNavigation);
    }
}

// Touch event handlers
function handleTouchStart(e) {
    touchStartX = e.touches[0].clientX;
    clearInterval(sliderTimer);
}

function handleTouchMove(e) {
    // Prevent default to stop scrolling while swiping
    if (Math.abs(e.touches[0].clientX - touchStartX) > 10) {
        e.preventDefault();
    }
}

function handleTouchEnd(e) {
    touchEndX = e.changedTouches[0].clientX;
    handleSwipe();
    startSliderTimer();
}

function handleSwipe() {
    const swipeThreshold = 30; // Reduced threshold for better sensitivity
    const diff = touchStartX - touchEndX;
    
    if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
            // Swipe left - next slide
            currentSlide = (currentSlide + 1) % slides.length;
        } else {
            // Swipe right - previous slide
            currentSlide = (currentSlide - 1 + slides.length) % slides.length;
        }
        showSlide(currentSlide);
        resetSliderTimer();
    }
}

// Click navigation for non-touch devices
function handleClickNavigation(e) {
    const sliderWidth = heroSlider.offsetWidth;
    const clickX = e.clientX - heroSlider.getBoundingClientRect().left;
    
    // If clicked on left third, go to previous slide
    if (clickX < sliderWidth / 3) {
        currentSlide = (currentSlide - 1 + slides.length) % slides.length;
        showSlide(currentSlide);
        resetSliderTimer();
    }
    // If clicked on right third, go to next slide
    else if (clickX > (sliderWidth / 3) * 2) {
        currentSlide = (currentSlide + 1) % slides.length;
        showSlide(currentSlide);
        resetSliderTimer();
    }
}
// Image loading handler
document.querySelectorAll('.slide-image img').forEach(img => {
    // Check if image is already loaded
    if (img.complete && img.naturalHeight !== 0) {
        img.classList.add('loaded');
        const placeholder = img.nextElementSibling;
        if (placeholder && placeholder.classList.contains('image-placeholder')) {
            placeholder.style.display = 'none';
        }
    } else {
        img.addEventListener('load', function() {
            this.classList.add('loaded');
            const placeholder = this.nextElementSibling;
            if (placeholder && placeholder.classList.contains('image-placeholder')) {
                placeholder.style.display = 'none';
            }
        });
        
        img.addEventListener('error', function() {
            this.style.display = 'none';
        });
    }
});

// FAQ Toggle
document.querySelectorAll('.faq-button-modern').forEach(button => {
    button.addEventListener('click', function() {
        const faqItem = this.parentElement;
        
        // Close other FAQ items (only one open at a time)
        document.querySelectorAll('.faq-item-modern').forEach(item => {
            if (item !== faqItem) {
                item.classList.remove('active');
            }
        });
        
        // Toggle current item
        faqItem.classList.toggle('active');
    });
});

// Smooth scroll for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (href !== '#' && href !== '') {
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                window.scrollTo({
                    top: target.offsetTop - 80,
                    behavior: 'smooth'
                });
                
                // Close mobile menu if open
                if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
                    mobileMenu.classList.add('hidden');
                    document.body.style.overflow = 'auto';
                }
            }
        }
    });
});

// Navbar styling on scroll
const navbar = document.getElementById('main-nav');
if (navbar) {
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.15)';
            navbar.style.background = 'rgba(255, 255, 255, 0.95)';
            navbar.style.backdropFilter = 'blur(10px)';
        } else {
            navbar.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
            navbar.style.background = 'var(--color-header-bg)';
            navbar.style.backdropFilter = 'none';
        }
    });
}

// Close mobile menu on resize
window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) {
        if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
            mobileMenu.classList.add('hidden');
            document.body.style.overflow = 'auto';
        }
    }
});

// Pause slider when page is not visible
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        clearInterval(sliderTimer);
    } else {
        resetSliderTimer();
    }
});

// Add animation to elements on scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            entry.target.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        }
    });
}, observerOptions);

// Observe elements for animation
document.querySelectorAll('.stat-card, .service-card-modern, .feature-card-modern, .process-card-modern').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    observer.observe(card);
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Initialize image loading
    document.querySelectorAll('.slide-image img').forEach(img => {
        if (img.complete && img.naturalHeight !== 0) {
            img.classList.add('loaded');
        }
    });
    
    // Set initial navbar state
    if (navbar) {
        if (window.scrollY > 50) {
            navbar.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.15)';
            navbar.style.background = 'rgba(255, 255, 255, 0.95)';
            navbar.style.backdropFilter = 'blur(10px)';
        }
    }
    
    // Add touch event listeners for mobile
    if ('ontouchstart' in window) {
        // Add touch-specific improvements
        document.querySelectorAll('.btn-primary, .btn-secondary').forEach(button => {
            button.addEventListener('touchstart', function() {
                this.style.transform = 'scale(0.98)';
            });
            
            button.addEventListener('touchend', function() {
                this.style.transform = '';
            });
        });
    }
});

// Prevent default behavior on mobile for better UX
document.addEventListener('touchmove', function(e) {
    if (e.scale !== 1) {
        e.preventDefault();
    }
}, { passive: false });

// Improve mobile performance
let lastScrollTop = 0;
window.addEventListener('scroll', function() {
    const st = window.pageYOffset || document.documentElement.scrollTop;
    if (Math.abs(lastScrollTop - st) <= 5) return;
    lastScrollTop = st;
    
    // Pause animations when scrolling for performance
    if (sliderTimer) {
        clearInterval(sliderTimer);
        setTimeout(() => {
            startSliderTimer();
        }, 1000);
    }
}, { passive: true });