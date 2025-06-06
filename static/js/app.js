// Global application state and utilities
const App = {
    currentUser: null,
    currentView: 'dashboard',
    socket: null,
    
    // Initialize the application
    init() {
        this.checkAuth();
        this.setupEventListeners();
        this.initializeSocket();
        this.setupNavigation();
    },
    
    // Check if user is authenticated
    checkAuth() {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');
        
        if (token && user) {
            this.currentUser = JSON.parse(user);
            this.setAuthHeader(token);
            this.showMainApp();
        } else {
            this.showLogin();
        }
    },
    
    // Set authentication header for axios
    setAuthHeader(token) {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    },
    
    // Show login page
    showLogin() {
        window.location.href = '/login';
    },
    
    // Show main application
    showMainApp() {
        document.getElementById('app').style.display = 'block';
        this.updateUserInfo();
        this.loadView('dashboard');
    },
    
    // Update user information in the UI
    updateUserInfo() {
        if (this.currentUser) {
            document.getElementById('userName').textContent = this.currentUser.name;
            document.getElementById('userRole').textContent = this.currentUser.role;
            
            // Show/hide menu items based on role
            this.updateMenuVisibility();
        }
    },
    
    // Update menu visibility based on user role
    updateMenuVisibility() {
        const role = this.currentUser.role;
        
        // Hide admin-only items for non-admin users
        const adminItems = document.querySelectorAll('.admin-only');
        adminItems.forEach(item => {
            if (role !== 'Administrador') {
                item.style.display = 'none';
            }
        });
        
        // Hide manager-only items for non-manager users
        const managerItems = document.querySelectorAll('.manager-only');
        managerItems.forEach(item => {
            if (!['Administrador', 'Diretoria'].includes(role)) {
                item.style.display = 'none';
            }
        });
        
        // Hide tech-only items for non-tech users
        const techItems = document.querySelectorAll('.tech-only');
        techItems.forEach(item => {
            if (!['Técnico', 'Administrador'].includes(role)) {
                item.style.display = 'none';
            }
        });
    },
    
    // Setup event listeners
    setupEventListeners() {
        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', this.logout.bind(this));
        
        // Mobile menu toggle
        const menuToggle = document.getElementById('menuToggle');
        if (menuToggle) {
            menuToggle.addEventListener('click', this.toggleMobileMenu.bind(this));
        }
        
        // Close mobile menu when clicking outside
        document.addEventListener('click', (e) => {
            const sidebar = document.getElementById('sidebar');
            const menuToggle = document.getElementById('menuToggle');
            
            if (sidebar && !sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                this.closeMobileMenu();
            }
        });
    },
    
    // Setup navigation
    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = item.getAttribute('data-view');
                if (view) {
                    this.loadView(view);
                }
            });
        });
    },
    
    // Load a specific view
    loadView(viewName) {
        // Update active navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        const activeItem = document.querySelector(`[data-view="${viewName}"]`);
        if (activeItem) {
            activeItem.classList.add('active');
        }
        
        // Hide all content sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.style.display = 'none';
        });
        
        // Show the selected view
        const viewElement = document.getElementById(`${viewName}View`);
        if (viewElement) {
            viewElement.style.display = 'block';
            this.currentView = viewName;
            
            // Load view-specific data
            this.loadViewData(viewName);
        }
        
        // Close mobile menu
        this.closeMobileMenu();
    },
    
    // Load data for specific view
    loadViewData(viewName) {
        switch (viewName) {
            case 'dashboard':
                Dashboard.loadDashboard();
                break;
            case 'tickets':
                Tickets.loadTickets();
                break;
            case 'create-ticket':
                // No data loading needed for create ticket form
                break;
            case 'users':
                if (['Administrador', 'Diretoria'].includes(this.currentUser.role)) {
                    Users.loadUsers();
                }
                break;
            case 'reports':
                if (['Administrador', 'Diretoria'].includes(this.currentUser.role)) {
                    Reports.loadReports();
                }
                break;
        }
    },
    
    // Initialize WebSocket connection
    initializeSocket() {
        const token = localStorage.getItem('token');
        if (token) {
            this.socket = io({
                auth: {
                    token: token
                }
            });
            
            this.socket.on('connect', () => {
                console.log('Connected to WebSocket server');
            });
            
            this.socket.on('disconnect', () => {
                console.log('Disconnected from WebSocket server');
            });
            
            this.socket.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.showNotification('Erro de conexão em tempo real', 'error');
            });
            
            // Setup chat event listeners
            Chat.setupSocketListeners(this.socket);
        }
    },
    
    // Toggle mobile menu
    toggleMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        
        if (sidebar.classList.contains('sidebar-hidden')) {
            sidebar.classList.remove('sidebar-hidden');
            overlay.style.display = 'block';
        } else {
            sidebar.classList.add('sidebar-hidden');
            overlay.style.display = 'none';
        }
    },
    
    // Close mobile menu
    closeMobileMenu() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        
        if (window.innerWidth < 1024) {
            sidebar.classList.add('sidebar-hidden');
            overlay.style.display = 'none';
        }
    },
    
    // Logout
    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        if (this.socket) {
            this.socket.disconnect();
        }
        
        window.location.href = '/login';
    },
    
    // Show notification
    showNotification(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        const iconMap = {
            success: '✓',
            error: '✗',
            warning: '⚠',
            info: 'ℹ'
        };
        
        notification.innerHTML = `
            <div class="flex items-center">
                <span class="mr-2 text-lg">${iconMap[type]}</span>
                <span class="flex-1">${message}</span>
                <button class="ml-2 text-gray-400 hover:text-gray-600" onclick="this.parentElement.parentElement.remove()">
                    ×
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after duration
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, duration);
    },
    
    // Format date for display
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('pt-BR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    },
    
    // Format relative time
    formatRelativeTime(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffMins < 1) {
            return 'Agora';
        } else if (diffMins < 60) {
            return `${diffMins} min atrás`;
        } else if (diffHours < 24) {
            return `${diffHours}h atrás`;
        } else {
            return `${diffDays}d atrás`;
        }
    },
    
    // Get priority badge HTML
    getPriorityBadge(priority) {
        const classMap = {
            'Alta': 'priority-alta',
            'Média': 'priority-media',
            'Baixa': 'priority-baixa'
        };
        
        return `<span class="${classMap[priority] || 'priority-baixa'}">${priority}</span>`;
    },
    
    // Get status badge HTML
    getStatusBadge(status) {
        const classMap = {
            'Aberto': 'status-aberto',
            'Em Andamento': 'status-em-andamento',
            'Resolvido': 'status-resolvido',
            'Fechado': 'status-fechado'
        };
        
        return `<span class="${classMap[status] || 'status-aberto'}">${status}</span>`;
    },
    
    // Get SLA badge HTML
    getSLABadge(slaStatus, slaTime) {
        const classMap = {
            'ok': 'sla-ok',
            'warning': 'sla-warning',
            'violated': 'sla-violated',
            'completed': 'sla-completed'
        };
        
        const textMap = {
            'ok': 'No prazo',
            'warning': 'Atenção',
            'violated': 'Vencido',
            'completed': 'Concluído'
        };
        
        return `<span class="${classMap[slaStatus] || 'sla-ok'}" title="${slaTime || ''}">${textMap[slaStatus] || 'No prazo'}</span>`;
    },
    
    // Show loading state
    showLoading(elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `
                <div class="flex items-center justify-center py-8">
                    <div class="spinner"></div>
                    <span class="ml-2 text-gray-600">Carregando...</span>
                </div>
            `;
        }
    },
    
    // Show error state
    showError(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-red-600 text-lg mb-2">⚠</div>
                    <p class="text-gray-600">${message}</p>
                </div>
            `;
        }
    },
    
    // Show empty state
    showEmpty(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-gray-400 text-lg mb-2">📭</div>
                    <p class="text-gray-600">${message}</p>
                </div>
            `;
        }
    }
};

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Handle window resize for mobile menu
window.addEventListener('resize', () => {
    if (window.innerWidth >= 1024) {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        
        if (sidebar) {
            sidebar.classList.remove('sidebar-hidden');
        }
        if (overlay) {
            overlay.style.display = 'none';
        }
    }
});
