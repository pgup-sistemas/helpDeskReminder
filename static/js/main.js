// Global state
let currentUser = null;
let authToken = localStorage.getItem('authToken');

// Configure axios defaults
if (authToken) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
}

// Add axios interceptor to handle 401 errors
axios.interceptors.response.use(
    response => response,
    error => {
        if (error.response && error.response.status === 401) {
            // Token expired or invalid, redirect to login
            localStorage.removeItem('authToken');
            delete axios.defaults.headers.common['Authorization'];
            if (window.location.pathname !== '/') {
                window.location.href = '/';
            }
        }
        return Promise.reject(error);
    }
);

// Authentication functions
function setAuthToken(token) {
    authToken = token;
    localStorage.setItem('authToken', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

function clearAuthToken() {
    authToken = null;
    localStorage.removeItem('authToken');
    delete axios.defaults.headers.common['Authorization'];
}

function isAuthenticated() {
    return !!authToken;
}

// Login function
async function login(username, password) {
    try {
        const response = await axios.post('/api/login', {
            username: username,
            password: password
        });

        if (response.data.access_token) {
            setAuthToken(response.data.access_token);
            currentUser = response.data.user;
            return { success: true, user: response.data.user };
        }
    } catch (error) {
        console.error('Login error:', error);
        return { success: false, message: error.response?.data?.message || 'Login failed' };
    }
}

// Get current user info
async function getCurrentUser() {
    if (!isAuthenticated()) {
        return null;
    }

    try {
        const response = await axios.get('/api/me');
        currentUser = response.data;
        return response.data;
    } catch (error) {
        console.error('Failed to get current user:', error);
        return null;
    }
}

// Logout function
function logout() {
    clearAuthToken();
    currentUser = null;
    window.location.href = '/';
}

// Check if user is authenticated and redirect if needed
async function checkAuth() {
    if (!isAuthenticated()) {
        if (window.location.pathname !== '/') {
            window.location.href = '/';
        }
        return false;
    }

    // Verify token is still valid
    const user = await getCurrentUser();
    if (!user) {
        if (window.location.pathname !== '/') {
            window.location.href = '/';
        }
        return false;
    }

    return true;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async function() {
    // If on login page and already authenticated, redirect to dashboard
    if (window.location.pathname === '/' && isAuthenticated()) {
        const user = await getCurrentUser();
        if (user) {
            window.location.href = '/dashboard';
            return;
        }
    }

    // If not on login page, check authentication
    if (window.location.pathname !== '/') {
        const authenticated = await checkAuth();
        if (!authenticated) {
            return;
        }
    }

    // Initialize page-specific functionality
    const path = window.location.pathname;

    if (path === '/') {
        initLoginPage();
    } else if (path === '/dashboard') {
        initDashboard();
    } else if (path === '/tickets') {
        initTicketsPage();
    } else if (path.startsWith('/ticket/')) {
        const ticketId = path.split('/')[2];
        initTicketDetailPage(ticketId);
    } else if (path === '/users') {
        initUsersPage();
    } else if (path === '/reports') {
        initReportsPage();
    }
});

// Login page initialization
function initLoginPage() {
    const loginForm = document.getElementById('loginForm');
    const errorDiv = document.getElementById('error-message');

    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            if (!username || !password) {
                showError('Please enter both username and password');
                return;
            }

            const submitButton = document.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Logging in...';

            const result = await login(username, password);

            if (result.success) {
                window.location.href = '/dashboard';
            } else {
                showError(result.message || 'Login failed');
                submitButton.disabled = false;
                submitButton.textContent = 'Login';
            }
        });
    }

    function showError(message) {
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }
    }
}

// Utility functions
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

function formatPriority(priority) {
    const priorities = {
        'baixa': 'Low',
        'media': 'Medium',
        'alta': 'High',
        'critica': 'Critical'
    };
    return priorities[priority] || priority;
}

function formatStatus(status) {
    const statuses = {
        'aberto': 'Open',
        'em_andamento': 'In Progress',
        'aguardando': 'Waiting',
        'resolvido': 'Resolved',
        'fechado': 'Closed'
    };
    return statuses[status] || status;
}

function getPriorityColor(priority) {
    const colors = {
        'baixa': 'bg-green-100 text-green-800',
        'media': 'bg-yellow-100 text-yellow-800',
        'alta': 'bg-orange-100 text-orange-800',
        'critica': 'bg-red-100 text-red-800'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
}

function getStatusColor(status) {
    const colors = {
        'aberto': 'bg-blue-100 text-blue-800',
        'em_andamento': 'bg-yellow-100 text-yellow-800',
        'aguardando': 'bg-purple-100 text-purple-800',
        'resolvido': 'bg-green-100 text-green-800',
        'fechado': 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
}

// Navigation
function navigateTo(path) {
    window.location.href = path;
}

// Error handling
function handleError(error, context = '') {
    console.error(`Error ${context}:`, error);

    let message = 'An error occurred';
    if (error.response) {
        message = error.response.data?.message || `HTTP ${error.response.status}`;
    } else if (error.message) {
        message = error.message;
    }

    // Show error to user (you can customize this)
    alert(`Error: ${message}`);
}
```

// Dashboard page initialization
function initDashboard() {
    // Load dashboard stats
    loadDashboardStats();

    // Load recent tickets
    loadRecentTickets();
}

// Load dashboard stats
async function loadDashboardStats() {
    try {
        const response = await axios.get('/api/dashboard/stats');
        const stats = response.data;

        // Update stat cards
        updateStatCard('total-tickets', stats.total_tickets);
        updateStatCard('open-tickets', stats.open_tickets);
        updateStatCard('in-progress-tickets', stats.in_progress_tickets);
        updateStatCard('resolved-tickets', stats.resolved_tickets);
        updateStatCard('sla-violations', stats.sla_violated);

    } catch (error) {
        handleError(error, 'loading dashboard stats');
    }
}

// Update stat card
function updateStatCard(cardId, value) {
    const element = document.querySelector(`[data-stat="${cardId}"]`);
    if (element) {
        element.textContent = value;
    }
}

// Load recent tickets
async function loadRecentTickets() {
    try {
        const response = await axios.get('/api/tickets?limit=5');
        const tickets = response.data;

        const container = document.getElementById('recent-tickets');
        if (container) {
            container.innerHTML = tickets.map(ticket => `
                <div class="flex items-center justify-between p-3 border-b border-gray-200 last:border-b-0">
                    <div class="flex-1">
                        <h4 class="font-medium text-sm">${ticket.title}</h4>
                        <p class="text-xs text-gray-500">${formatDate(ticket.created_at)}</p>
                    </div>
                    <div class="flex items-center space-x-2">
                        <span class="${getPriorityColor(ticket.priority)} px-2 py-1 rounded text-xs font-medium">${formatPriority(ticket.priority)}</span>
                        <span class="${getStatusColor(ticket.status)} px-2 py-1 rounded text-xs font-medium">${formatStatus(ticket.status)}</span>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        handleError(error, 'loading recent tickets');
    }
}

// Tickets page initialization
function initTicketsPage() {
    // Load tickets
    loadTickets();
}

// Load tickets
async function loadTickets() {
    try {
        const response = await axios.get('/api/tickets');
        const tickets = response.data;

        const container = document.getElementById('tickets-container');
        if (container) {
            container.innerHTML = tickets.map(ticket => `
                <div class="flex items-center justify-between p-3 border-b border-gray-200 last:border-b-0">
                    <div class="flex-1">
                        <h4 class="font-medium text-sm">${ticket.title}</h4>
                        <p class="text-xs text-gray-500">${formatDate(ticket.created_at)}</p>
                    </div>
                    <div class="flex items-center space-x-2">
                        <span class="${getPriorityColor(ticket.priority)} px-2 py-1 rounded text-xs font-medium">${formatPriority(ticket.priority)}</span>
                        <span class="${getStatusColor(ticket.status)} px-2 py-1 rounded text-xs font-medium">${formatStatus(ticket.status)}</span>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        handleError(error, 'loading tickets');
    }
}

// Ticket detail page initialization
async function initTicketDetailPage(ticketId) {
    // Load ticket details
    loadTicketDetails(ticketId);
}

// Load ticket details
async function loadTicketDetails(ticketId) {
    try {
        const response = await axios.get(`/api/ticket/${ticketId}`);
        const ticket = response.data;

        const container = document.getElementById('ticket-details');
        if (container) {
            container.innerHTML = `
                <h2 class="text-2xl font-semibold mb-4">${ticket.title}</h2>
                <p class="text-gray-600 mb-2"><strong>Priority:</strong> <span class="${getPriorityColor(ticket.priority)} px-2 py-1 rounded text-xs font-medium">${formatPriority(ticket.priority)}</span></p>
                <p class="text-gray-600 mb-2"><strong>Status:</strong> <span class="${getStatusColor(ticket.status)} px-2 py-1 rounded text-xs font-medium">${formatStatus(ticket.status)}</span></p>
                <p class="text-gray-600 mb-2"><strong>Created At:</strong> ${formatDate(ticket.created_at)}</p>
                <p class="text-gray-700">${ticket.description}</p>
            `;
        }
    } catch (error) {
        handleError(error, 'loading ticket details');
    }
}

// Users page initialization
function initUsersPage() {
    // Load users
    loadUsers();
}

// Load users
async function loadUsers() {
    try {
        const response = await axios.get('/api/users');
        const users = response.data;

        const container = document.getElementById('users-container');
        if (container) {
            container.innerHTML = users.map(user => `
                <div class="flex items-center justify-between p-3 border-b border-gray-200 last:border-b-0">
                    <div class="flex-1">
                        <h4 class="font-medium text-sm">${user.username}</h4>
                        <p class="text-xs text-gray-500">${user.email}</p>
                    </div>
                    <div>
                        <span class="px-2 py-1 rounded text-xs font-medium">${user.role}</span>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        handleError(error, 'loading users');
    }
}

// Reports page initialization
function initReportsPage() {
    // Load reports
    loadReports();
}

// Load reports
async function loadReports() {
    try {
        const response = await axios.get('/api/reports');
        const reports = response.data;

        const container = document.getElementById('reports-container');
        if (container) {
            container.innerHTML = `
                <pre>${JSON.stringify(reports, null, 2)}</pre>
            `;
        }
    } catch (error) {
        handleError(error, 'loading reports');
    }
}