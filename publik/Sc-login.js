class NeumorphismAuthForm {
    constructor() {
        this.API_BASE_URL = window.location.origin;
        this.isProcessing = false;
        this.authCheckInterval = null;
        
        this.loginCard = document.getElementById('login-card');
        this.registerCard = document.getElementById('register-card');
        this.loginForm = document.getElementById('loginForm');
        this.registerForm = document.getElementById('registerForm');
        
        this.init();
    }
    
    init() {
        this.checkExistingAuth();
        this.bindEvents();
        this.setupPasswordToggles();
        this.setupFormSwitching();
        this.setupNeumorphicEffects();
        this.startAuthChecker();
    }
    
    // Cek apakah user sudah login
    async checkExistingAuth() {
        try {
            const response = await fetch(`${this.API_BASE_URL}/api/auth/me`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                credentials: 'include' // Kirim cookie/session
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.status && data.data.user) {
                    // User sudah login, redirect ke dashboard
                    this.redirectToDashboard();
                }
            }
        } catch (error) {
            console.log('No existing session found');
        }
    }
    
    // Redirect ke dashboard
    redirectToDashboard() {
        window.location.href = '/admin/dashboard';
    }
    
    bindEvents() {
        this.loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        this.registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        
        this.setupInputValidation();
    }
    
    setupPasswordToggles() {
        const toggles = [
            { toggle: 'loginPasswordToggle', input: 'login-password' },
            { toggle: 'registerPasswordToggle', input: 'register-password' },
            { toggle: 'registerConfirmToggle', input: 'register-confirm' }
        ];
        
        toggles.forEach(({ toggle, input }) => {
            const toggleBtn = document.getElementById(toggle);
            const inputField = document.getElementById(input);
            
            if (toggleBtn && inputField) {
                toggleBtn.addEventListener('click', () => {
                    const type = inputField.type === 'password' ? 'text' : 'password';
                    inputField.type = type;
                    
                    const icon = toggleBtn.querySelector('i');
                    icon.className = type === 'text' ? 'fas fa-eye-slash' : 'fas fa-eye';
                    
                    this.animateSoftPress(toggleBtn);
                });
            }
        });
    }
    
    setupFormSwitching() {
        document.getElementById('show-register-link').addEventListener('click', (e) => {
            e.preventDefault();
            this.switchToRegister();
        });
        
        document.getElementById('show-login-link').addEventListener('click', (e) => {
            e.preventDefault();
            this.switchToLogin();
        });
    }
    
    switchToRegister() {
        this.loginCard.classList.add('slide-out');
        
        setTimeout(() => {
            this.loginCard.style.display = 'none';
            this.loginCard.classList.remove('slide-out');
            
            this.registerCard.style.display = 'block';
            this.registerCard.classList.add('slide-in');
            
            setTimeout(() => {
                this.registerCard.classList.remove('slide-in');
            }, 500);
        }, 300);
    }
    
    switchToLogin() {
        this.registerCard.classList.add('slide-out');
        
        setTimeout(() => {
            this.registerCard.style.display = 'none';
            this.registerCard.classList.remove('slide-out');
            
            this.loginCard.style.display = 'block';
            this.loginCard.classList.add('slide-in');
            
            setTimeout(() => {
                this.loginCard.classList.remove('slide-in');
            }, 500);
        }, 300);
    }
    
    setupInputValidation() {
        const loginInputs = ['login-identifier', 'login-password'];
        const registerInputs = ['register-username', 'register-name', 'register-phone', 'register-password', 'register-confirm'];
        
        [...loginInputs, ...registerInputs].forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', () => this.clearError(id));
            }
        });
    }
    
    setupNeumorphicEffects() {
        const neuElements = document.querySelectorAll('.neu-icon, .neu-checkbox, .neu-social');
        neuElements.forEach(element => {
            element.addEventListener('mouseenter', () => {
                element.style.transform = 'scale(1.05)';
            });
            
            element.addEventListener('mouseleave', () => {
                element.style.transform = 'scale(1)';
            });
        });
        
        document.addEventListener('mousemove', (e) => {
            this.updateAmbientLight(e);
        });
    }
    
    updateAmbientLight(e) {
        const cards = document.querySelectorAll('.login-card');
        cards.forEach(card => {
            if (card.style.display !== 'none') {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const angleX = (x - centerX) / centerX;
                const angleY = (y - centerY) / centerY;
                const shadowX = angleX * 30;
                const shadowY = angleY * 30;
                
                card.style.boxShadow = `
                    ${shadowX}px ${shadowY}px 60px #bec3cf,
                    ${-shadowX}px ${-shadowY}px 60px #ffffff
                `;
            }
        });
    }
    
    animateSoftPress(element) {
        element.style.transform = 'scale(0.95)';
        setTimeout(() => {
            element.style.transform = 'scale(1)';
        }, 150);
    }
    
    showError(field, message) {
        const input = document.getElementById(field);
        if (!input) return;
        
        const formGroup = input.closest('.form-group');
        const errorId = field + 'Error';
        const errorElement = document.getElementById(errorId);
        
        if (formGroup && errorElement) {
            formGroup.classList.add('error');
            errorElement.textContent = message;
            errorElement.classList.add('show');
            
            input.style.animation = 'gentleShake 0.5s ease-in-out';
            setTimeout(() => {
                input.style.animation = '';
            }, 500);
        }
    }
    
    clearError(field) {
        const input = document.getElementById(field);
        if (!input) return;
        
        const formGroup = input.closest('.form-group');
        const errorId = field + 'Error';
        const errorElement = document.getElementById(errorId);
        
        if (formGroup && errorElement) {
            formGroup.classList.remove('error');
            errorElement.classList.remove('show');
            setTimeout(() => {
                errorElement.textContent = '';
            }, 300);
        }
    }
    
    setLoading(button, loading) {
        this.isProcessing = loading;
        const btn = document.getElementById(button);
        if (btn) {
            btn.classList.toggle('loading', loading);
            btn.disabled = loading;
        }
    }
    
    validateLoginForm() {
        const identifier = document.getElementById('login-identifier').value.trim();
        const password = document.getElementById('login-password').value;
        
        let isValid = true;
        
        if (!identifier) {
            this.showError('login-identifier', 'Email or username is required');
            isValid = false;
        }
        
        if (!password) {
            this.showError('login-password', 'Password is required');
            isValid = false;
        } else if (password.length < 6) {
            this.showError('login-password', 'Password must be at least 6 characters');
            isValid = false;
        }
        
        return isValid;
    }
    
    validateRegisterForm() {
        const username = document.getElementById('register-username').value.trim();
        const name = document.getElementById('register-name').value.trim();
        const phone = document.getElementById('register-phone').value.trim();
        const password = document.getElementById('register-password').value;
        const confirm = document.getElementById('register-confirm').value;
        
        let isValid = true;
        
        if (!username) {
            this.showError('register-username', 'Username is required');
            isValid = false;
        } else if (username.length < 3) {
            this.showError('register-username', 'Username must be at least 3 characters');
            isValid = false;
        }
        
        if (!name) {
            this.showError('register-name', 'Full name is required');
            isValid = false;
        }
        
        if (!phone) {
            this.showError('register-phone', 'Phone number is required');
            isValid = false;
        } else if (!/^[0-9+\-\s]+$/.test(phone)) {
            this.showError('register-phone', 'Please enter a valid phone number');
            isValid = false;
        }
        
        if (!password) {
            this.showError('register-password', 'Password is required');
            isValid = false;
        } else if (password.length < 6) {
            this.showError('register-password', 'Password must be at least 6 characters');
            isValid = false;
        }
        
        if (!confirm) {
            this.showError('register-confirm', 'Please confirm your password');
            isValid = false;
        } else if (password !== confirm) {
            this.showError('register-confirm', 'Passwords do not match');
            isValid = false;
        }
        
        return isValid;
    }
    
    async handleLogin(e) {
        e.preventDefault();
        
        if (this.isProcessing) return;
        
        if (!this.validateLoginForm()) {
            this.animateSoftPress(document.querySelector('.login-btn'));
            return;
        }
        
        this.setLoading('login-btn', true);
        
        try {
            const identifier = document.getElementById('login-identifier').value.trim();
            const password = document.getElementById('login-password').value;
            
            const response = await fetch(`${this.API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ 
                    username: identifier.includes('@') ? identifier.split('@')[0] : identifier,
                    password: password 
                }),
                credentials: 'include' // Penting untuk cookie session
            });
            
            const data = await response.json();
            
            if (data.status) {
                // Simpan token di localStorage (optional)
                if (data.data.token) {
                    localStorage.setItem('auth_token', data.data.token);
                    localStorage.setItem('user_data', JSON.stringify(data.data.user));
                }
                
                this.showSuccess('loginSuccessMessage');
                
                // Redirect setelah delay
                setTimeout(() => {
                    window.location.href = data.data.redirect || '/admin/dashboard';
                }, 1500);
            } else {
                this.showError('login-password', data.error || 'Login failed. Please check your credentials.');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showError('login-password', 'Network error. Please check your connection.');
        } finally {
            this.setLoading('login-btn', false);
        }
    }
    
    async handleRegister(e) {
        e.preventDefault();
        
        if (this.isProcessing) return;
        
        if (!this.validateRegisterForm()) {
            this.animateSoftPress(document.querySelector('.register-btn'));
            return;
        }
        
        this.setLoading('register-btn', true);
        
        try {
            const username = document.getElementById('register-username').value.trim();
            const name = document.getElementById('register-name').value.trim();
            const phone = document.getElementById('register-phone').value.trim();
            const password = document.getElementById('register-password').value;
            
            const response = await fetch(`${this.API_BASE_URL}/api/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ 
                    username: username,
                    email: `${username}@asuma.my.id`, // Auto generate email
                    phone: phone,
                    password: password 
                }),
                credentials: 'include'
            });
            
            const data = await response.json();
            
            if (data.status) {
                this.showSuccess('registerSuccessMessage');
                
                setTimeout(() => {
                    this.switchToLogin();
                    document.getElementById('login-identifier').value = username;
                }, 2000);
            } else {
                this.showError('register-username', data.error || 'Registration failed. Username might be taken.');
            }
        } catch (error) {
            console.error('Register error:', error);
            this.showError('register-username', 'Network error. Please try again.');
        } finally {
            this.setLoading('register-btn', false);
        }
    }
    
    showSuccess(messageId) {
        const successMessage = document.getElementById(messageId);
        if (successMessage) {
            successMessage.classList.add('show');
            
            const form = successMessage.closest('.login-card').querySelector('.auth-form');
            const socialLogin = successMessage.closest('.login-card').querySelector('.social-login');
            const signupLink = successMessage.closest('.login-card').querySelector('.signup-link');
            
            if (form) form.style.display = 'none';
            if (socialLogin) socialLogin.style.display = 'none';
            if (signupLink) signupLink.style.display = 'none';
        }
    }
    
    startAuthChecker() {
        // Cek session setiap 30 detik
        this.authCheckInterval = setInterval(() => {
            this.checkExistingAuth();
        }, 30000);
    }
    
    stopAuthChecker() {
        if (this.authCheckInterval) {
            clearInterval(this.authCheckInterval);
        }
    }
}

// Utility untuk check auth di halaman lain
window.authUtils = {
    async checkAuth() {
        try {
            const response = await fetch('/api/auth/me', {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.status && data.data.user) {
                    return data.data.user;
                }
            }
            return null;
        } catch (error) {
            return null;
        }
    },
    
    async logout() {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                credentials: 'include'
            });
            
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user_data');
            
            window.location.href = '/login';
        } catch (error) {
            console.error('Logout error:', error);
            window.location.href = '/login';
        }
    },
    
    getToken() {
        return localStorage.getItem('auth_token');
    },
    
    getUser() {
        const userData = localStorage.getItem('user_data');
        return userData ? JSON.parse(userData) : null;
    },
    
    isLoggedIn() {
        return !!this.getUser();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    new NeumorphismAuthForm();
});
