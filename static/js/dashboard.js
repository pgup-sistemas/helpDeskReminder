// Dashboard-specific functionality
class DashboardCharts {
    constructor() {
        this.charts = {};
        this.init();
    }

    init() {
        this.initStatusChart();
        this.initPriorityChart();
        this.initTrendChart();
    }

    initStatusChart() {
        const ctx = document.getElementById('statusChart');
        if (!ctx) return;

        this.charts.status = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Aberto', 'Em Andamento', 'Resolvido', 'Fechado'],
                datasets: [{
                    data: [0, 0, 0, 0],
                    backgroundColor: [
                        'hsl(219, 58%, 51%)', // Blue
                        'hsl(262, 83%, 58%)', // Purple
                        'hsl(142, 71%, 45%)', // Green
                        'hsl(220, 14%, 37%)'  // Gray
                    ],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                },
                cutout: '60%'
            }
        });
    }

    initPriorityChart() {
        const ctx = document.getElementById('priorityChart');
        if (!ctx) return;

        this.charts.priority = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Alta', 'Média', 'Baixa'],
                datasets: [{
                    label: 'Chamados por Prioridade',
                    data: [0, 0, 0],
                    backgroundColor: [
                        'hsl(0, 84%, 60%)',   // Red
                        'hsl(45, 93%, 58%)',  // Yellow
                        'hsl(142, 71%, 45%)'  // Green
                    ],
                    borderRadius: 4,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    initTrendChart() {
        const ctx = document.getElementById('trendChart');
        if (!ctx) return;

        // Generate last 7 days labels
        const labels = [];
        const now = new Date();
        for (let i = 6; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            labels.push(date.toLocaleDateString('pt-BR', { 
                month: 'short', 
                day: 'numeric' 
            }));
        }

        this.charts.trend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Chamados Abertos',
                    data: new Array(7).fill(0),
                    borderColor: 'hsl(219, 58%, 51%)',
                    backgroundColor: 'hsla(219, 58%, 51%, 0.1)',
                    tension: 0.4,
                    fill: true
                }, {
                    label: 'Chamados Resolvidos',
                    data: new Array(7).fill(0),
                    borderColor: 'hsl(142, 71%, 45%)',
                    backgroundColor: 'hsla(142, 71%, 45%, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            usePointStyle: true,
                            padding: 20
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                }
            }
        });
    }

    updateCharts(stats) {
        // Update status chart
        if (this.charts.status) {
            this.charts.status.data.datasets[0].data = [
                stats.open_tickets,
                stats.in_progress_tickets,
                stats.resolved_tickets,
                stats.closed_tickets
            ];
            this.charts.status.update();
        }

        // Update priority chart
        if (this.charts.priority) {
            this.charts.priority.data.datasets[0].data = [
                stats.high_priority,
                stats.medium_priority,
                stats.low_priority
            ];
            this.charts.priority.update();
        }

        // Note: Trend chart would need additional API endpoint for historical data
    }

    async loadTrendData() {
        try {
            // This would require a new API endpoint for historical data
            const response = await axios.get('/api/dashboard/trend');
            const trendData = response.data;

            if (this.charts.trend) {
                this.charts.trend.data.datasets[0].data = trendData.opened;
                this.charts.trend.data.datasets[1].data = trendData.resolved;
                this.charts.trend.update();
            }
        } catch (error) {
            console.error('Failed to load trend data:', error);
        }
    }
}

// Performance metrics widget
class PerformanceMetrics {
    constructor() {
        this.init();
    }

    init() {
        this.loadMetrics();
        // Refresh every 60 seconds
        setInterval(() => {
            this.loadMetrics();
        }, 60000);
    }

    async loadMetrics() {
        try {
            const token = localStorage.getItem('access_token');
            if (!token) {
                logout();
                return;
            }

            const response = await axios.get('/api/dashboard/stats', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const stats = response.data;

            this.updateMetrics(stats);
        } catch (error) {
            console.error('Failed to load performance metrics:', error);
            if (error.response && (error.response.status === 401 || error.response.status === 422)) {
                logout();
            }
        }
    }

    updateMetrics(stats) {
        // Calculate SLA compliance rate
        const totalActiveTickets = stats.open_tickets + stats.in_progress_tickets;
        const slaCompliance = totalActiveTickets > 0 ? 
            ((totalActiveTickets - stats.sla_violated) / totalActiveTickets * 100).toFixed(1) : 100;

        // Calculate resolution rate
        const totalTickets = stats.total_tickets;
        const resolutionRate = totalTickets > 0 ? 
            ((stats.resolved_tickets + stats.closed_tickets) / totalTickets * 100).toFixed(1) : 0;

        // Update UI elements
        this.updateMetricCard('sla-compliance', slaCompliance + '%', this.getSLAAlertLevel(slaCompliance));
        this.updateMetricCard('resolution-rate', resolutionRate + '%', this.getResolutionAlertLevel(resolutionRate));
        this.updateMetricCard('avg-response-time', 'N/A', 'normal'); // Would need additional tracking
        this.updateMetricCard('customer-satisfaction', 'N/A', 'normal'); // Would need survey system
    }

    updateMetricCard(metricId, value, alertLevel) {
        const element = document.querySelector(`[data-metric="${metricId}"]`);
        if (element) {
            element.textContent = value;

            // Update alert level styling
            const card = element.closest('.stat-card');
            if (card) {
                card.classList.remove('border-green-200', 'border-yellow-200', 'border-red-200');

                switch (alertLevel) {
                    case 'good':
                        card.classList.add('border-green-200');
                        break;
                    case 'warning':
                        card.classList.add('border-yellow-200');
                        break;
                    case 'critical':
                        card.classList.add('border-red-200');
                        break;
                }
            }
        }
    }

    getSLAAlertLevel(percentage) {
        if (percentage >= 95) return 'good';
        if (percentage >= 85) return 'warning';
        return 'critical';
    }

    getResolutionAlertLevel(percentage) {
        if (percentage >= 80) return 'good';
        if (percentage >= 60) return 'warning';
        return 'critical';
    }
}

// SLA monitoring widget
class SLAMonitor {
    constructor() {
        this.init();
    }

    init() {
        this.loadCriticalTickets();
        // Refresh every 30 seconds for critical SLA monitoring
        setInterval(() => {
            this.loadCriticalTickets();
        }, 30000);
    }

    async loadCriticalTickets() {
        try {
            const token = localStorage.getItem('access_token');
            if (!token) {
                logout();
                return;
            }

            const response = await axios.get('/api/tickets?sla_critical=true&limit=5', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            this.renderCriticalTickets(response.data);
        } catch (error) {
            console.error('Failed to load critical tickets:', error);
            if (error.response && (error.response.status === 401 || error.response.status === 422)) {
                logout();
            }
        }
    }

    renderCriticalTickets(tickets) {
        const container = document.getElementById('sla-critical-tickets');
        if (!container) return;

        if (tickets.length === 0) {
            container.innerHTML = `
                <div class="text-center text-green-600 py-4">
                    <svg class="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <p class="text-sm font-medium">Todos os SLAs em dia!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = tickets.map(ticket => {
            const timeRemaining = ticket.time_until_sla;
            const alertClass = window.helpDeskApp.getSLAAlertClass(timeRemaining);

            return `
                <div class="sla-alert ${alertClass} mb-3">
                    <div class="flex items-start justify-between">
                        <div class="flex-1">
                            <h4 class="font-medium text-sm">${ticket.title}</h4>
                            <p class="text-xs opacity-75">
                                ${ticket.requester} • ${ticket.department}
                            </p>
                        </div>
                        <div class="text-right">
                            <span class="priority-${ticket.priority} text-xs">${ticket.priority}</span>
                            <p class="text-xs font-medium mt-1">
                                ${window.helpDeskApp.formatSLATime(timeRemaining)}
                            </p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// Initialize dashboard components when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if we're on the dashboard page
    if (window.location.pathname === '/dashboard') {
        window.dashboardCharts = new DashboardCharts();
        window.performanceMetrics = new PerformanceMetrics();
        window.slaMonitor = new SLAMonitor();
    }
});

// Load user info
async function loadUserInfo() {
    try {
        const token = localStorage.getItem('access_token');
        if (!token) {
            logout();
            return;
        }

        const response = await axios.get('/api/me', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const user = response.data;

        document.getElementById('user-name').textContent = user.username;
        document.getElementById('user-role').textContent = user.role;
        document.getElementById('user-department').textContent = user.department || 'N/A';
    } catch (error) {
        console.error('Failed to load user:', error);
        if (error.response && (error.response.status === 401 || error.response.status === 422)) {
            logout();
        }
    }
}

// Load dashboard stats
async function loadDashboardStats() {
    try {
        const token = localStorage.getItem('access_token');
        if (!token) {
            logout();
            return;
        }

        const response = await axios.get('/api/dashboard/stats', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        const stats = response.data;

        updateStatsCards(stats);
    } catch (error) {
        console.error('Failed to load performance metrics:', error);
        if (error.response && (error.response.status === 401 || error.response.status === 422)) {
            logout();
        }
    }
}

// Load critical tickets
async function loadCriticalTickets() {
    try {
        const token = localStorage.getItem('access_token');
        if (!token) {
            logout();
            return;
        }

        const response = await axios.get('/api/tickets?sla_critical=true&limit=5', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
         const tickets = response.data;
        const container = document.getElementById('sla-critical-tickets');
        if (!container) return;

        if (tickets.length === 0) {
            container.innerHTML = `
                <div class="text-center text-green-600 py-4">
                    <svg class="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <p class="text-sm font-medium">Todos os SLAs em dia!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = tickets.map(ticket => {
            const timeRemaining = ticket.time_until_sla;
            const alertClass = window.helpDeskApp.getSLAAlertClass(timeRemaining);

            return `
                <div class="sla-alert ${alertClass} mb-3">
                    <div class="flex items-start justify-between">
                        <div class="flex-1">
                            <h4 class="font-medium text-sm">${ticket.title}</h4>
                            <p class="text-xs opacity-75">
                                ${ticket.requester} • ${ticket.department}
                            </p>
                        </div>
                        <div class="text-right">
                            <span class="priority-${ticket.priority} text-xs">${ticket.priority}</span>
                            <p class="text-xs font-medium mt-1">
                                ${window.helpDeskApp.formatSLATime(timeRemaining)}
                            </p>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Failed to load critical tickets:', error);
        if (error.response && (error.response.status === 401 || error.response.status === 422)) {
            logout();
        }
    }
}

// Dashboard initialization
async function initDashboard() {
    // Ensure user is authenticated
    if (!isAuthenticated()) {
        window.location.href = '/';
        return;
    }

    // Load current user info
    await loadCurrentUser();

    // Load dashboard data
    await loadDashboardStats();
    await loadRecentTickets();

    // Set up event listeners
    setupDashboardEventListeners();
}

// Load current user information
async function loadCurrentUser() {
    try {
        const user = await getCurrentUser();
        if (user) {
            updateUserInfo(user);
        }
    } catch (error) {
        console.error('Failed to load user:', error);
    }
}

// Update user info in the UI
function updateUserInfo(user) {
    const userNameElement = document.getElementById('userName');
    const userRoleElement = document.getElementById('userRole');

    if (userNameElement) {
        userNameElement.textContent = user.username;
    }

    if (userRoleElement) {
        userRoleElement.textContent = user.role;
    }
}

// Load dashboard statistics
async function loadDashboardStats() {
    try {
        const response = await axios.get('/api/dashboard/stats');
        const stats = response.data;

        updateDashboardStats(stats);
    } catch (error) {
        console.error('Failed to load dashboard stats:', error);
        // Don't show error for stats, just log it
    }
}

// Update dashboard statistics in the UI
function updateDashboardStats(stats) {
    const elements = {
        'totalTickets': stats.total_tickets || 0,
        'openTickets': stats.open_tickets || 0,
        'inProgressTickets': stats.in_progress_tickets || 0,
        'resolvedTickets': stats.resolved_tickets || 0,
        'criticalTickets': stats.critical_tickets || 0,
        'avgResolutionTime': stats.avg_resolution_time || 'N/A'
    };

    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    });
}

// Load recent tickets
async function loadRecentTickets() {
    try {
        const response = await axios.get('/api/tickets?limit=5');
        const tickets = response.data;

        updateRecentTickets(tickets.slice(0, 5));
    } catch (error) {
        console.error('Failed to load recent tickets:', error);
    }
}

// Update recent tickets in the UI
function updateRecentTickets(tickets) {
    const container = document.getElementById('recentTickets');
    if (!container) return;

    if (tickets.length === 0) {
        container.innerHTML = '<p class="text-gray-500">No recent tickets found.</p>';
        return;
    }

    container.innerHTML = tickets.map(ticket => `
        <div class="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer" onclick="navigateTo('/ticket/${ticket.id}')">
            <div class="flex justify-between items-start mb-2">
                <h4 class="font-medium text-gray-900">#${ticket.id} - ${ticket.title}</h4>
                <span class="px-2 py-1 text-xs rounded-full ${getPriorityColor(ticket.priority)}">
                    ${formatPriority(ticket.priority)}
                </span>
            </div>
            <p class="text-sm text-gray-600 mb-2">${ticket.description.substring(0, 100)}${ticket.description.length > 100 ? '...' : ''}</p>
            <div class="flex justify-between items-center text-xs text-gray-500">
                <span>Status: <span class="px-2 py-1 rounded-full ${getStatusColor(ticket.status)}">${formatStatus(ticket.status)}</span></span>
                <span>${formatDate(ticket.created_at)}</span>
            </div>
        </div>
    `).join('');
}

// Set up event listeners for dashboard
function setupDashboardEventListeners() {
    // Quick action buttons
    const newTicketBtn = document.getElementById('newTicketBtn');
    if (newTicketBtn) {
        newTicketBtn.addEventListener('click', () => {
            navigateTo('/tickets?action=new');
        });
    }

    const viewAllTicketsBtn = document.getElementById('viewAllTicketsBtn');
    if (viewAllTicketsBtn) {
        viewAllTicketsBtn.addEventListener('click', () => {
            navigateTo('/tickets');
        });
    }

    const reportsBtn = document.getElementById('reportsBtn');
    if (reportsBtn) {
        reportsBtn.addEventListener('click', () => {
            navigateTo('/reports');
        });
    }

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logout();
        });
    }

    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            location.reload();
        });
    }
}

// Auto-refresh dashboard data every 30 seconds
setInterval(() => {
    if (window.location.pathname === '/dashboard' && isAuthenticated()) {
        loadDashboardStats();
        loadRecentTickets();
    }
}, 30000);