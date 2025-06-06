// Dashboard module
const Dashboard = {
    charts: {},
    
    // Load dashboard data
    async loadDashboard() {
        try {
            App.showLoading('dashboardContent');
            
            const response = await axios.get('/api/dashboard/stats');
            const stats = response.data;
            
            this.renderStats(stats);
            this.renderCharts(stats);
            
        } catch (error) {
            console.error('Error loading dashboard:', error);
            App.showError('dashboardContent', 'Erro ao carregar dashboard');
        }
    },
    
    // Render statistics cards
    renderStats(stats) {
        const statsContainer = document.getElementById('statsCards');
        
        const statsCards = [
            {
                title: 'Total de Chamados',
                value: stats.total_tickets,
                icon: '📋',
                color: 'bg-blue-500'
            },
            {
                title: 'Chamados Abertos',
                value: stats.open_tickets,
                icon: '🔓',
                color: 'bg-yellow-500'
            },
            {
                title: 'Chamados Resolvidos',
                value: stats.resolved_tickets,
                icon: '✅',
                color: 'bg-green-500'
            },
            {
                title: 'SLA Violado',
                value: stats.sla_violated,
                icon: '⚠️',
                color: 'bg-red-500'
            },
            {
                title: 'SLA em Atenção',
                value: stats.sla_warning,
                icon: '⏰',
                color: 'bg-orange-500'
            },
            {
                title: 'Chamados Fechados',
                value: stats.closed_tickets,
                icon: '🔒',
                color: 'bg-gray-500'
            }
        ];
        
        statsContainer.innerHTML = statsCards.map(card => `
            <div class="helpdesk-card">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-sm font-medium text-gray-600">${card.title}</p>
                        <p class="text-3xl font-bold text-gray-900">${card.value}</p>
                    </div>
                    <div class="w-12 h-12 ${card.color} rounded-lg flex items-center justify-center text-white text-2xl">
                        ${card.icon}
                    </div>
                </div>
            </div>
        `).join('');
    },
    
    // Render charts
    renderCharts(stats) {
        this.renderPriorityChart(stats.priority_breakdown);
        this.renderStatusChart(stats.status_breakdown);
        this.renderDepartmentChart(stats.department_breakdown);
        this.renderActivityChart(stats.recent_activity);
    },
    
    // Render priority breakdown chart
    renderPriorityChart(data) {
        const ctx = document.getElementById('priorityChart').getContext('2d');
        
        if (this.charts.priority) {
            this.charts.priority.destroy();
        }
        
        this.charts.priority = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: data.map(item => item.priority),
                datasets: [{
                    data: data.map(item => item.count),
                    backgroundColor: [
                        '#EF4444', // Alta - Red
                        '#F59E0B', // Média - Yellow
                        '#10B981'  // Baixa - Green
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
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
                    },
                    title: {
                        display: true,
                        text: 'Chamados por Prioridade',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    }
                }
            }
        });
    },
    
    // Render status breakdown chart
    renderStatusChart(data) {
        const ctx = document.getElementById('statusChart').getContext('2d');
        
        if (this.charts.status) {
            this.charts.status.destroy();
        }
        
        this.charts.status = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.map(item => item.status),
                datasets: [{
                    label: 'Quantidade',
                    data: data.map(item => item.count),
                    backgroundColor: [
                        '#3B82F6', // Aberto - Blue
                        '#F59E0B', // Em Andamento - Yellow
                        '#10B981', // Resolvido - Green
                        '#6B7280'  // Fechado - Gray
                    ],
                    borderWidth: 1,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Chamados por Status',
                        font: {
                            size: 16,
                            weight: 'bold'
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
    },
    
    // Render department breakdown chart
    renderDepartmentChart(data) {
        const ctx = document.getElementById('departmentChart').getContext('2d');
        
        if (this.charts.department) {
            this.charts.department.destroy();
        }
        
        // Generate colors for departments
        const colors = [
            '#3B82F6', '#EF4444', '#10B981', '#F59E0B', 
            '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
        ];
        
        this.charts.department = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: data.map(item => item.department),
                datasets: [{
                    data: data.map(item => item.count),
                    backgroundColor: colors.slice(0, data.length),
                    borderWidth: 2,
                    borderColor: '#fff'
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
                    },
                    title: {
                        display: true,
                        text: 'Chamados por Departamento',
                        font: {
                            size: 16,
                            weight: 'bold'
                        }
                    }
                }
            }
        });
    },
    
    // Render activity chart
    renderActivityChart(data) {
        const ctx = document.getElementById('activityChart').getContext('2d');
        
        if (this.charts.activity) {
            this.charts.activity.destroy();
        }
        
        // Sort data by date
        const sortedData = data.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        this.charts.activity = new Chart(ctx, {
            type: 'line',
            data: {
                labels: sortedData.map(item => {
                    const date = new Date(item.date);
                    return date.toLocaleDateString('pt-BR', { 
                        month: 'short', 
                        day: 'numeric' 
                    });
                }),
                datasets: [{
                    label: 'Chamados Criados',
                    data: sortedData.map(item => item.count),
                    borderColor: '#3B82F6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Atividade dos Últimos 7 Dias',
                        font: {
                            size: 16,
                            weight: 'bold'
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
    },
    
    // Refresh dashboard data
    refresh() {
        this.loadDashboard();
    }
};
