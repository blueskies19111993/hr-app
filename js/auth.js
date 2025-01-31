// Language and theme preferences
let currentLanguage = localStorage.getItem('language') || 'ar';
let isDarkMode = localStorage.getItem('darkMode') === 'true';

document.addEventListener('DOMContentLoaded', () => {
    // Initialize language and theme
    setLanguage(currentLanguage);
    setTheme(isDarkMode);
    
    // Check if user is already logged in
    checkExistingSession();
    
    // UI Elements
    const loginForm = document.getElementById('loginForm');
    const toggleBtns = document.querySelectorAll('.toggle-btn');
    let currentRole = 'employee';

    // Toggle between employee and admin login
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            toggleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentRole = btn.dataset.role;
        });
    });

    // Handle login form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        // Basic validation
        if (!email || !password) {
            showNotification('الرجاء إدخال البريد الإلكتروني وكلمة المرور', 'error');
            return;
        }

        try {
            showLoader();
            
            // Get Supabase client from config
            const supabase = getSupabaseClient();
            
            // Attempt login
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            // Check user role in custom claims or user metadata
            const { data: roleData, error: roleError } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', data.user.id)
                .single();

            if (roleError) throw roleError;

            // Verify if user has correct role
            if (roleData.role !== currentRole) {
                throw new Error('غير مصرح لك بالدخول بهذا الدور');
            }

            // Store session data
            localStorage.setItem('userRole', roleData.role);
            
            // Redirect based on role
            window.location.href = roleData.role === 'admin' 
                ? 'admin-dashboard.html' 
                : 'employee-dashboard.html';

        } catch (error) {
            console.error('Login error:', error);
            showNotification(error.message || 'حدث خطأ أثناء تسجيل الدخول', 'error');
        } finally {
            hideLoader();
        }
    });
});

// Check for existing session on page load
async function checkExistingSession() {
    try {
        const supabase = getSupabaseClient();
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        if (session) {
            const { data: roleData } = await supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', session.user.id)
                .single();
                
            if (roleData) {
                window.location.href = roleData.role === 'admin' 
                    ? 'admin-dashboard.html' 
                    : 'employee-dashboard.html';
            }
        }
    } catch (error) {
        console.error('Session check error:', error);
    }
}

// Language toggle
function toggleLanguage() {
    currentLanguage = currentLanguage === 'ar' ? 'en' : 'ar';
    setLanguage(currentLanguage);
}

function setLanguage(lang) {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    updateUIText();
    localStorage.setItem('language', lang);
}

// Theme toggle
function toggleTheme() {
    isDarkMode = !isDarkMode;
    setTheme(isDarkMode);
}

function setTheme(darkMode) {
    document.body.classList.toggle('dark-mode', darkMode);
    localStorage.setItem('darkMode', darkMode);
    updateThemeText();
}

// Update UI text based on current language
function updateUIText() {
    const elements = document.querySelectorAll('[data-translate]');
    elements.forEach(element => {
        const key = element.dataset.translate;
        element.textContent = getTranslation(key);
    });
    
    // Update specific elements
    document.getElementById('langText').textContent = currentLanguage === 'ar' ? 'English' : 'عربي';
    updateThemeText();
}

function updateThemeText() {
    const themeText = document.getElementById('themeText');
    if (themeText) {
        themeText.textContent = getTranslation(isDarkMode ? 'lightMode' : 'darkMode');
    }
}

// Get translation
function getTranslation(key) {
    return translations[currentLanguage][key] || key;
}

// Loading indicator
function showLoader() {
    const loader = document.createElement('div');
    loader.className = 'loader';
    document.body.appendChild(loader);
}

function hideLoader() {
    const loader = document.querySelector('.loader');
    if (loader) {
        loader.remove();
    }
}

// Show notification
function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Offline support
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

function updateOnlineStatus() {
    const isOnline = navigator.onLine;
    if (!isOnline) {
        showNotification(getTranslation('offlineMessage'), 'warning');
    }
}
