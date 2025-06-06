// Authentication module
const Auth = {
    // Login function
    async login(username, password) {
        try {
            const response = await axios.post('/api/login', {
                username,
                password
            });
            
            const { access_token, user } = response.data;
            
            // Store token and user info
            localStorage.setItem('token', access_token);
            localStorage.setItem('user', JSON.stringify(user));
            
            // Set axios default header
            axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
            
            return { success: true, user };
        } catch (error) {
            console.error('Login error:', error);
            return { 
                success: false, 
                error: error.response?.data?.error || 'Erro de login' 
            };
        }
    },
    
    // Check if user is authenticated
    isAuthenticated() {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');
        return !!(token && user);
    },
    
    // Get current user
    getCurrentUser() {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    },
    
    // Get current token
    getToken() {
        return localStorage.getItem('token');
    },
    
    // Logout
    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        delete axios.defaults.headers.common['Authorization'];
        window.location.href = '/login';
    }
};

// Login page functionality
if (window.location.pathname === '/login') {
    document.addEventListener('DOMContentLoaded', () => {
        const loginForm = document.getElementById('loginForm');
        const usernameInput = document.getElementById('username');
        const passwordInput = document.getElementById('password');
        const loginButton = document.getElementById('loginButton');
        const errorMessage = document.getElementById('errorMessage');
        
        // Check if already authenticated
        if (Auth.isAuthenticated()) {
            window.location.href = '/';
            return;
        }
        
        // Handle form submission
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = usernameInput.value.trim();
            const password = passwordInput.value.trim();
            
            if (!username || !password) {
                showError('Por favor, preencha todos os campos.');
                return;
            }
            
            // Show loading state
            loginButton.disabled = true;
            loginButton.innerHTML = `
                <div class="spinner"></div>
                <span class="ml-2">Entrando...</span>
            `;
            
            // Attempt login
            const result = await Auth.login(username, password);
            
            if (result.success) {
                // Redirect to main app
                window.location.href = '/';
            } else {
                // Show error
                showError(result.error);
                
                // Reset button
                loginButton.disabled = false;
                loginButton.innerHTML = 'Entrar';
            }
        });
        
        // Show error message
        function showError(message) {
            errorMessage.textContent = message;
            errorMessage.style.display = 'block';
            
            // Hide error after 5 seconds
            setTimeout(() => {
                errorMessage.style.display = 'none';
            }, 5000);
        }
        
        // Demo user buttons
        const demoButtons = document.querySelectorAll('.demo-login');
        demoButtons.forEach(button => {
            button.addEventListener('click', () => {
                const username = button.getAttribute('data-username');
                const password = button.getAttribute('data-password');
                
                usernameInput.value = username;
                passwordInput.value = password;
                
                // Auto-submit form
                loginForm.dispatchEvent(new Event('submit'));
            });
        });
        
        // Enter key handling
        [usernameInput, passwordInput].forEach(input => {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    loginForm.dispatchEvent(new Event('submit'));
                }
            });
        });
    });
}
