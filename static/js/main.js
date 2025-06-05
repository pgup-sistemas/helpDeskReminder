// Global application state and utilities
class HelpDeskApp {
    constructor() {
        this.token = localStorage.getItem('token');
        this.user = null;
        this.socket = null;
        this.init();
    }

    async init() {
        // Set up axios defaults
        axios.defaults.baseURL = window.location.origin;

        // Add token to all requests
        if (this.token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;
            await this.loadCurrentUser();
        }

        // Initialize Socket.IO if user is authenticated
        if (this.user) {
            this.initSocket();
        }

        // Initialize page-specific functionality
        this.initPage();
        this.setupEventListeners();
    }

    async loadCurrentUser() {
        try {
            const response = await axios.get('/api/me');
            this.user = response.data;
            this.updateUI();
        } catch (error) {
            console.error('Failed to load user:', error);
            this.logout();
        }
    }

    initSocket() {
        this.socket = io({
            auth: {
                token: this.token
            }
        });

        this.socket.on('connected', (data) => {
            console.log('Socket connected:', data);
        });

        this.socket.on('error', (data) => {
            console.error('Socket error:', data);
        });
    }

    initPage() {
        const path = window.location.pathname;

        if (path === '/' || path === '/login') {
            this.initLoginPage();
        } else if (path === '/dashboard') {
            this.initDashboard();
        } else if (path === '/tickets') {
            this.initTicketsPage();
        } else if (path.startsWith('/ticket/')) {
            this.initTicketDetailPage();
        } else if (path === '/users') {
            this.initUsersPage();
        } else if (path === '/reports') {
            this.initReportsPage();
        }
    }

    setupEventListeners() {
        // Global event listeners
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-action="logout"]')) {
                e.preventDefault();
                this.logout();
            }
        });

        // Modal handling
        document.addEventListener('click', (e) => {
            if (e.target.matches('.modal-overlay')) {
                this.closeModal();
            }
            if (e.target.matches('[data-dismiss="modal"]')) {
                this.closeModal();
            }
        });
    }

    // Authentication methods
    async login(username, password) {
        try {
            const response = await axios.post('/api/login', {
                username,
                password
            });

            this.token = response.data.access_token;
            this.user = response.data.user;

            localStorage.setItem('token', this.token);
            axios.defaults.headers.common['Authorization'] = `Bearer ${this.token}`;

            this.initSocket();
            window.location.href = '/dashboard';

        } catch (error) {
            throw new Error(error.response?.data?.message || 'Login failed');
        }
    }

    logout() {
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];

        if (this.socket) {
            this.socket.disconnect();
        }

        window.location.href = '/';
    }

    // UI utilities
    updateUI() {
        if (!this.user) return;

        // Update user info in navigation
        const userElement = document.querySelector('[data-user-info]');
        if (userElement) {
            userElement.textContent = this.user.username;
        }

        const roleElement = document.querySelector('[data-user-role]');
        if (roleElement) {
            roleElement.textContent = this.getRoleDisplayName(this.user.role);
        }

        // Show/hide elements based on role
        this.updateRoleBasedUI();
    }

    updateRoleBasedUI() {
        const userRole = this.user?.role;

        // Hide admin-only elements
        document.querySelectorAll('[data-role-required]').forEach(el => {
            const requiredRoles = el.dataset.roleRequired.split(',');
            if (!requiredRoles.includes(userRole)) {
                el.style.display = 'none';
            }
        });
    }

    getRoleDisplayName(role) {
        const roleNames = {
            'colaborador': 'Colaborador',
            'tecnico': 'Técnico',
            'administrador': 'Administrador',
            'diretoria': 'Diretoria'
        };
        return roleNames[role] || role;
    }

    // Modal utilities
    showModal(content, title = '') {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content">
                ${title ? `<div class="modal-header"><h3 class="text-lg font-semibold">${title}</h3></div>` : ''}
                <div class="modal-body">${content}</div>
                <div class="modal-footer">
                    <button type="button" class="btn-secondary" data-dismiss="modal">Fechar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.classList.add('fade-in');
    }

    closeModal() {
        const modal = document.querySelector('.modal-overlay');
        if (modal) {
            modal.remove();
        }
    }

    // Alert utilities
    showAlert(message, type = 'info') {
        const alert = document.createElement('div');
        alert.className = `alert alert-${type} fixed top-4 right-4 z-50 p-4 rounded-lg shadow-lg`;

        const bgColors = {
            success: 'bg-green-100 text-green-800 border border-green-200',
            error: 'bg-red-100 text-red-800 border border-red-200',
            warning: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
            info: 'bg-blue-100 text-blue-800 border border-blue-200'
        };

        alert.className += ' ' + bgColors[type];
        alert.innerHTML = `
            <div class="flex items-center">
                <span>${message}</span>
                <button type="button" class="ml-4 text-current opacity-70 hover:opacity-100" onclick="this.parentElement.parentElement.remove()">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
                    </svg>
                </button>
            </div>
        `;

        document.body.appendChild(alert);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (alert.parentElement) {
                alert.remove();
            }
        }, 5000);
    }

    // Loading utilities
    showLoading(element) {
        const loading = document.createElement('div');
        loading.className = 'loading-overlay absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center';
        loading.innerHTML = '<div class="loading-spinner"></div>';
        element.style.position = 'relative';
        element.appendChild(loading);
    }

    hideLoading(element) {
        const loading = element.querySelector('.loading-overlay');
        if (loading) {
            loading.remove();
        }
    }

    // Utility methods
    formatDate(dateString) {
        return new Date(dateString).toLocaleString('pt-BR');
    }

    formatRelativeTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);

        if (diffHours < 1) {
            return 'Agora há pouco';
        } else if (diffHours < 24) {
            return `${diffHours}h atrás`;
        } else {
            return `${diffDays}d atrás`;
        }
    }

    formatSLATime(seconds) {
        if (seconds <= 0) return 'Vencido';

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);

        if (hours > 0) {
            return `${hours}h ${minutes}m restantes`;
        } else {
            return `${minutes}m restantes`;
        }
    }

    getSLAAlertClass(timeRemaining) {
        if (timeRemaining <= 0) return 'sla-critical';
        if (timeRemaining <= 3600) return 'sla-warning'; // 1 hour
        return 'sla-normal';
    }

    // Page-specific initialization methods
    initLoginPage() {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();

                const username = document.getElementById('username').value;
                const password = document.getElementById('password').value;
                const submitBtn = loginForm.querySelector('button[type="submit"]');

                try {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = '<div class="loading-spinner mr-2"></div>Entrando...';

                    await this.login(username, password);
                } catch (error) {
                    this.showAlert(error.message, 'error');
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = 'Entrar';
                }
            });
        }
    }

    initDashboard() {
        this.loadDashboardStats();
        this.loadRecentTickets();

        // Auto refresh every 30 seconds
        setInterval(() => {
            this.loadDashboardStats();
        }, 30000);
    }

    async loadDashboardStats() {
        try {
            const response = await axios.get('/api/dashboard/stats');
            const stats = response.data;

            // Update stat cards
            this.updateStatCard('total-tickets', stats.total_tickets);
            this.updateStatCard('open-tickets', stats.open_tickets);
            this.updateStatCard('in-progress-tickets', stats.in_progress_tickets);
            this.updateStatCard('resolved-tickets', stats.resolved_tickets);
            this.updateStatCard('sla-violations', stats.sla_violated);

            // Update charts if they exist
            if (window.dashboardCharts) {
                window.dashboardCharts.updateCharts(stats);
            }

        } catch (error) {
            console.error('Failed to load dashboard stats:', error);
        }
    }

    updateStatCard(cardId, value) {
        const element = document.querySelector(`[data-stat="${cardId}"]`);
        if (element) {
            element.textContent = value;
        }
    }

    async loadRecentTickets() {
        try {
            const response = await axios.get('/api/tickets?limit=5');
            const tickets = response.data.slice(0, 5);

            const container = document.getElementById('recent-tickets');
            if (container) {
                container.innerHTML = tickets.map(ticket => `
                    <div class="flex items-center justify-between p-3 border-b border-gray-200 last:border-b-0">
                        <div class="flex-1">
                            <h4 class="font-medium text-sm">${ticket.title}</h4>
                            <p class="text-xs text-gray-500">${this.formatRelativeTime(ticket.created_at)}</p>
                        </div>
                        <div class="flex items-center space-x-2">
                            <span class="priority-${ticket.priority}">${ticket.priority}</span>
                            <span class="status-${ticket.status}">${ticket.status.replace('_', ' ')}</span>
                        </div>
                    </div>
                `).join('');
            }
        } catch (error) {
            console.error('Failed to load recent tickets:', error);
        }
    }

    initTicketsPage() {
        this.loadTickets();
        this.setupTicketFilters();
        this.setupNewTicketForm();
    }

    initTicketDetailPage() {
        const ticketId = window.location.pathname.split('/').pop();
        this.loadTicketDetail(ticketId);
        this.initChat(ticketId);
    }

    initUsersPage() {
        if (this.user && this.user.role === 'administrador') {
            this.loadUsers();
            this.setupUserManagement();
        }
    }

    initReportsPage() {
        if (this.user && ['administrador', 'diretoria'].includes(this.user.role)) {
            this.setupReportsPage();
        }
    }

    // Additional methods will be implemented in separate files for modularity
    async loadTickets() {
        // Implementation in tickets-specific code
    }

    setupTicketFilters() {
        // Implementation in tickets-specific code
    }

    // ... other methods
}

// Global axios configuration
axios.defaults.headers.common['Content-Type'] = 'application/json';

// Set authorization header when token is available
function setAuthToken(token) {
    if (token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
        delete axios.defaults.headers.common['Authorization'];
    }
}

// Initialize auth token from localStorage
const token = localStorage.getItem('access_token');
if (token) {
    setAuthToken(token);
}

async function login(username, password) {
    try {
        const response = await axios.post('/api/login', {
            username,
            password
        });

        if (response.data.access_token) {
            localStorage.setItem('access_token', response.data.access_token);
            localStorage.setItem('user', JSON.stringify(response.data.user));
            setAuthToken(response.data.access_token);
            return true;
        }
        return false;
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
}

function logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setAuthToken(null);
    window.location.href = '/';
}

// Initialize the application
const app = new HelpDeskApp();
window.helpDeskApp = app;