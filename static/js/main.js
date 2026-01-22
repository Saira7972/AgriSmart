// Mobile Menu Toggle - IMPROVED VERSION
const mobileMenuButton = document.querySelector('.mobile-menu-button');
const mobileMenu = document.querySelector('.mobile-menu');
let isMenuOpen = false;

if (mobileMenuButton) {
    mobileMenuButton.addEventListener('click', (e) => {
        e.stopPropagation();
        isMenuOpen = !isMenuOpen;
        
        if (isMenuOpen) {
            mobileMenu.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        } else {
            mobileMenu.classList.add('hidden');
            document.body.style.overflow = 'auto';
        }
    });

    // Close menu when link is clicked
    mobileMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', (e) => {
            const href = link.getAttribute('href');
            
            // Handle anchor links
            if (href.startsWith('#')) {
                e.preventDefault();
                isMenuOpen = false;
                mobileMenu.classList.add('hidden');
                document.body.style.overflow = 'auto';
                
                // Smooth scroll to section
                const target = document.querySelector(href);
                if (target) {
                    setTimeout(() => {
                        target.scrollIntoView({ behavior: 'smooth' });
                    }, 100);
                }
            } else {
                // For non-anchor links, just close the menu
                isMenuOpen = false;
                mobileMenu.classList.add('hidden');
                document.body.style.overflow = 'auto';
            }
        });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!mobileMenu.contains(e.target) && !mobileMenuButton.contains(e.target) && isMenuOpen) {
            isMenuOpen = false;
            mobileMenu.classList.add('hidden');
            document.body.style.overflow = 'auto';
        }
    });
}

// Hero Slider
let currentSlide = 0;
const slides = document.querySelectorAll('.slide');
const dots = document.querySelectorAll('.slider-dot');
let sliderTimer;
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let isTouchDevice = false;

function showSlide(n) {
    slides.forEach(slide => slide.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));
    
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

// Handle slider controls
const heroSlider = document.querySelector('.hero-slider');
if (heroSlider) {
    if (isTouchDevice) {
        heroSlider.addEventListener('touchstart', handleTouchStart, { passive: true });
        heroSlider.addEventListener('touchend', handleTouchEnd, { passive: true });
        heroSlider.addEventListener('touchmove', handleTouchMove, { passive: true });
    } else {
        heroSlider.addEventListener('mouseenter', () => {
            clearInterval(sliderTimer);
        });
        
        heroSlider.addEventListener('mouseleave', () => {
            startSliderTimer();
        });
        
        heroSlider.addEventListener('click', handleClickNavigation);
    }
}

// Improved Touch event handlers
function handleTouchStart(e) {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    clearInterval(sliderTimer);
}

function handleTouchMove(e) {
    if (!e.touches[0]) return;
    
    const touchMoveX = e.touches[0].clientX;
    const touchMoveY = e.touches[0].clientY;
    
    const diffX = Math.abs(touchMoveX - touchStartX);
    const diffY = Math.abs(touchMoveY - touchStartY);
    
    // Only prevent default for clear horizontal swipes (more than vertical movement)
    if (diffX > 50 && diffX > diffY * 1.5) {
        e.preventDefault();
    }
}

function handleTouchEnd(e) {
    if (!e.changedTouches[0]) return;
    touchEndX = e.changedTouches[0].clientX;
    handleSwipe();
    startSliderTimer();
}

function handleSwipe() {
    const swipeThreshold = 50;
    const diff = touchStartX - touchEndX;
    
    if (Math.abs(diff) > swipeThreshold) {
        if (diff > 0) {
            currentSlide = (currentSlide + 1) % slides.length;
        } else {
            currentSlide = (currentSlide - 1 + slides.length) % slides.length;
        }
        showSlide(currentSlide);
        resetSliderTimer();
    }
}

function handleClickNavigation(e) {
    const sliderWidth = heroSlider.offsetWidth;
    const clickX = e.clientX - heroSlider.getBoundingClientRect().left;
    
    if (clickX < sliderWidth / 3) {
        currentSlide = (currentSlide - 1 + slides.length) % slides.length;
        showSlide(currentSlide);
        resetSliderTimer();
    }
    else if (clickX > (sliderWidth / 3) * 2) {
        currentSlide = (currentSlide + 1) % slides.length;
        showSlide(currentSlide);
        resetSliderTimer();
    }
}

// Image loading handler
document.querySelectorAll('.slide-image img').forEach(img => {
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
        
        document.querySelectorAll('.faq-item-modern').forEach(item => {
            if (item !== faqItem) {
                item.classList.remove('active');
            }
        });
        
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
                
                if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
                    isMenuOpen = false;
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
    }, { passive: true });
}

// Close mobile menu on resize
window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) {
        if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
            isMenuOpen = false;
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

document.querySelectorAll('.stat-card, .service-card-modern, .feature-card-modern, .process-card-modern').forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    observer.observe(card);
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.slide-image img').forEach(img => {
        if (img.complete && img.naturalHeight !== 0) {
            img.classList.add('loaded');
        }
    });
    
    if (navbar) {
        if (window.scrollY > 50) {
            navbar.style.boxShadow = '0 10px 30px rgba(0, 0, 0, 0.15)';
            navbar.style.background = 'rgba(255, 255, 255, 0.95)';
            navbar.style.backdropFilter = 'blur(10px)';
        }
    }
});