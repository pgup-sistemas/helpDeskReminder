// Tickets module
const Tickets = {
    currentTickets: [],
    filters: {
        status: '',
        priority: '',
        department: '',
        assigned_to: ''
    },
    
    // Load tickets
    async loadTickets() {
        try {
            App.showLoading('ticketsContent');
            
            // Build query string with filters
            const queryParams = new URLSearchParams();
            Object.keys(this.filters).forEach(key => {
                if (this.filters[key]) {
                    queryParams.append(key, this.filters[key]);
                }
            });
            
            const response = await axios.get(`/api/tickets?${queryParams}`);
            this.currentTickets = response.data;
            
            this.renderTickets();
            this.renderFilters();
            
        } catch (error) {
            console.error('Error loading tickets:', error);
            App.showError('ticketsContent', 'Erro ao carregar chamados');
        }
    },
    
    // Render tickets table
    renderTickets() {
        const container = document.getElementById('ticketsTable');
        
        if (this.currentTickets.length === 0) {
            App.showEmpty('ticketsContent', 'Nenhum chamado encontrado');
            return;
        }
        
        const tableHTML = `
            <div class="table-responsive">
                <table class="min-w-full bg-white border border-gray-200 rounded-lg">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Título</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Departamento</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prioridade</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SLA</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Criado</th>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                        </tr>
                    </thead>
                    <tbody class="bg-white divide-y divide-gray-200">
                        ${this.currentTickets.map(ticket => this.renderTicketRow(ticket)).join('')}
                    </tbody>
                </table>
            </div>
        `;
        
        container.innerHTML = tableHTML;
    },
    
    // Render individual ticket row
    renderTicketRow(ticket) {
        const slaTime = ticket.sla_due ? this.calculateSLATime(ticket.sla_due) : '';
        
        return `
            <tr class="hover:bg-gray-50 cursor-pointer" onclick="Tickets.viewTicket(${ticket.id})">
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#${ticket.id}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">${ticket.title}</div>
                    <div class="text-sm text-gray-500">${ticket.creator.name}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${ticket.department}</td>
                <td class="px-6 py-4 whitespace-nowrap">${App.getPriorityBadge(ticket.priority)}</td>
                <td class="px-6 py-4 whitespace-nowrap">${App.getStatusBadge(ticket.status)}</td>
                <td class="px-6 py-4 whitespace-nowrap">${App.getSLABadge(ticket.sla_status, slaTime)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${App.formatRelativeTime(ticket.created_at)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div class="flex space-x-2">
                        <button onclick="event.stopPropagation(); Tickets.viewTicket(${ticket.id})" 
                                class="text-blue-600 hover:text-blue-900">Ver</button>
                        ${this.canEditTicket(ticket) ? `
                            <button onclick="event.stopPropagation(); Tickets.editTicket(${ticket.id})" 
                                    class="text-green-600 hover:text-green-900">Editar</button>
                        ` : ''}
                    </div>
                </td>
            </tr>
        `;
    },
    
    // Calculate SLA time remaining
    calculateSLATime(slaDate) {
        const now = new Date();
        const sla = new Date(slaDate);
        const diff = sla - now;
        
        if (diff < 0) {
            const absDiff = Math.abs(diff);
            const hours = Math.floor(absDiff / (1000 * 60 * 60));
            const minutes = Math.floor((absDiff % (1000 * 60 * 60)) / (1000 * 60));
            return `Vencido há ${hours}h ${minutes}m`;
        } else {
            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            return `${hours}h ${minutes}m restantes`;
        }
    },
    
    // Check if user can edit ticket
    canEditTicket(ticket) {
        const user = App.currentUser;
        if (user.role === 'Administrador') return true;
        if (user.role === 'Técnico') return true;
        if (user.role === 'Colaborador' && ticket.creator.id === user.id) return true;
        return false;
    },
    
    // Render filters
    renderFilters() {
        const filtersContainer = document.getElementById('ticketsFilters');
        
        // Get unique values for filters
        const departments = [...new Set(this.currentTickets.map(t => t.department))];
        const statuses = ['Aberto', 'Em Andamento', 'Resolvido', 'Fechado'];
        const priorities = ['Alta', 'Média', 'Baixa'];
        
        filtersContainer.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select id="statusFilter" class="helpdesk-select">
                        <option value="">Todos</option>
                        ${statuses.map(status => `
                            <option value="${status}" ${this.filters.status === status ? 'selected' : ''}>${status}</option>
                        `).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Prioridade</label>
                    <select id="priorityFilter" class="helpdesk-select">
                        <option value="">Todas</option>
                        ${priorities.map(priority => `
                            <option value="${priority}" ${this.filters.priority === priority ? 'selected' : ''}>${priority}</option>
                        `).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
                    <select id="departmentFilter" class="helpdesk-select">
                        <option value="">Todos</option>
                        ${departments.map(dept => `
                            <option value="${dept}" ${this.filters.department === dept ? 'selected' : ''}>${dept}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="flex items-end">
                    <button onclick="Tickets.clearFilters()" class="helpdesk-button-secondary">
                        Limpar Filtros
                    </button>
                </div>
            </div>
        `;
        
        // Add event listeners to filters
        document.getElementById('statusFilter').addEventListener('change', (e) => {
            this.filters.status = e.target.value;
            this.loadTickets();
        });
        
        document.getElementById('priorityFilter').addEventListener('change', (e) => {
            this.filters.priority = e.target.value;
            this.loadTickets();
        });
        
        document.getElementById('departmentFilter').addEventListener('change', (e) => {
            this.filters.department = e.target.value;
            this.loadTickets();
        });
    },
    
    // Clear all filters
    clearFilters() {
        this.filters = {
            status: '',
            priority: '',
            department: '',
            assigned_to: ''
        };
        this.loadTickets();
    },
    
    // View ticket details
    async viewTicket(ticketId) {
        try {
            const response = await axios.get(`/api/tickets/${ticketId}`);
            const ticket = response.data;
            
            this.showTicketModal(ticket);
            
        } catch (error) {
            console.error('Error loading ticket:', error);
            App.showNotification('Erro ao carregar detalhes do chamado', 'error');
        }
    },
    
    // Show ticket modal
    showTicketModal(ticket) {
        const slaTime = ticket.sla_due ? this.calculateSLATime(ticket.sla_due) : '';
        
        const modalHTML = `
            <div class="modal-overlay" id="ticketModal">
                <div class="modal-content">
                    <div class="flex justify-between items-center p-6 border-b">
                        <h2 class="text-xl font-bold text-gray-900">Chamado #${ticket.id}</h2>
                        <button onclick="Tickets.closeTicketModal()" class="text-gray-400 hover:text-gray-600">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                    
                    <div class="p-6">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div>
                                <h3 class="text-lg font-semibold mb-2">${ticket.title}</h3>
                                <p class="text-gray-600 mb-4">${ticket.description}</p>
                                
                                <div class="space-y-2">
                                    <div><strong>Departamento:</strong> ${ticket.department}</div>
                                    <div><strong>Prioridade:</strong> ${App.getPriorityBadge(ticket.priority)}</div>
                                    <div><strong>Status:</strong> ${App.getStatusBadge(ticket.status)}</div>
                                    <div><strong>SLA:</strong> ${App.getSLABadge(ticket.sla_status, slaTime)}</div>
                                    <div><strong>Criado por:</strong> ${ticket.creator.name}</div>
                                    <div><strong>Atribuído para:</strong> ${ticket.assignee ? ticket.assignee.name : 'Não atribuído'}</div>
                                    <div><strong>Criado em:</strong> ${App.formatDate(ticket.created_at)}</div>
                                </div>
                                
                                ${ticket.observations ? `
                                    <div class="mt-4">
                                        <strong>Observações:</strong>
                                        <p class="text-gray-600 mt-1">${ticket.observations}</p>
                                    </div>
                                ` : ''}
                            </div>
                            
                            <div>
                                <div class="mb-4">
                                    <h4 class="font-semibold mb-2">Ações</h4>
                                    <div class="space-y-2">
                                        ${this.renderTicketActions(ticket)}
                                    </div>
                                </div>
                                
                                <div id="ticketAttachments">
                                    <h4 class="font-semibold mb-2">Anexos</h4>
                                    <div class="spinner"></div>
                                </div>
                            </div>
                        </div>
                        
                        <div id="ticketChat">
                            <h4 class="font-semibold mb-2">Chat Interno</h4>
                            <div class="spinner"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Load chat and attachments
        Chat.initializeTicketChat(ticket.id);
        this.loadTicketAttachments(ticket.id);
    },
    
    // Render ticket actions based on user role
    renderTicketActions(ticket) {
        const user = App.currentUser;
        let actions = [];
        
        if (user.role === 'Administrador' || user.role === 'Técnico') {
            if (ticket.status === 'Aberto') {
                actions.push(`
                    <button onclick="Tickets.updateTicketStatus(${ticket.id}, 'Em Andamento')" 
                            class="helpdesk-button-warning w-full">
                        Assumir Chamado
                    </button>
                `);
            }
            
            if (ticket.status === 'Em Andamento') {
                actions.push(`
                    <button onclick="Tickets.updateTicketStatus(${ticket.id}, 'Resolvido')" 
                            class="helpdesk-button-success w-full">
                        Marcar como Resolvido
                    </button>
                `);
            }
            
            if (ticket.status === 'Resolvido') {
                actions.push(`
                    <button onclick="Tickets.updateTicketStatus(${ticket.id}, 'Fechado')" 
                            class="helpdesk-button-secondary w-full">
                        Fechar Chamado
                    </button>
                `);
            }
        }
        
        if (this.canEditTicket(ticket)) {
            actions.push(`
                <button onclick="Tickets.showEditForm(${ticket.id})" 
                        class="helpdesk-button-primary w-full">
                    Editar Chamado
                </button>
            `);
        }
        
        // File upload
        actions.push(`
            <div class="border-t pt-2 mt-2">
                <input type="file" id="fileUpload" class="hidden" onchange="Tickets.uploadFile(${ticket.id})">
                <button onclick="document.getElementById('fileUpload').click()" 
                        class="helpdesk-button-secondary w-full">
                    Adicionar Anexo
                </button>
            </div>
        `);
        
        return actions.join('');
    },
    
    // Update ticket status
    async updateTicketStatus(ticketId, newStatus) {
        try {
            await axios.put(`/api/tickets/${ticketId}`, {
                status: newStatus,
                assigned_to: App.currentUser.id
            });
            
            App.showNotification('Status do chamado atualizado com sucesso', 'success');
            this.closeTicketModal();
            this.loadTickets();
            
        } catch (error) {
            console.error('Error updating ticket status:', error);
            App.showNotification('Erro ao atualizar status do chamado', 'error');
        }
    },
    
    // Load ticket attachments
    async loadTicketAttachments(ticketId) {
        try {
            const response = await axios.get(`/api/tickets/${ticketId}/attachments`);
            const attachments = response.data;
            
            const container = document.getElementById('ticketAttachments');
            
            if (attachments.length === 0) {
                container.innerHTML = `
                    <h4 class="font-semibold mb-2">Anexos</h4>
                    <p class="text-gray-500 text-sm">Nenhum anexo encontrado</p>
                `;
                return;
            }
            
            container.innerHTML = `
                <h4 class="font-semibold mb-2">Anexos</h4>
                <div class="space-y-2">
                    ${attachments.map(attachment => `
                        <div class="flex items-center justify-between p-2 bg-gray-50 rounded">
                            <div>
                                <div class="text-sm font-medium">${attachment.filename}</div>
                                <div class="text-xs text-gray-500">
                                    ${this.formatFileSize(attachment.file_size)} • 
                                    ${App.formatDate(attachment.uploaded_at)}
                                </div>
                            </div>
                            <a href="/api/attachments/${attachment.id}/download" 
                               class="text-blue-600 hover:text-blue-800 text-sm">
                                Download
                            </a>
                        </div>
                    `).join('')}
                </div>
            `;
            
        } catch (error) {
            console.error('Error loading attachments:', error);
            document.getElementById('ticketAttachments').innerHTML = `
                <h4 class="font-semibold mb-2">Anexos</h4>
                <p class="text-red-500 text-sm">Erro ao carregar anexos</p>
            `;
        }
    },
    
    // Format file size
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    // Upload file
    async uploadFile(ticketId) {
        const fileInput = document.getElementById('fileUpload');
        const file = fileInput.files[0];
        
        if (!file) return;
        
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            await axios.post(`/api/tickets/${ticketId}/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            
            App.showNotification('Arquivo enviado com sucesso', 'success');
            this.loadTicketAttachments(ticketId);
            fileInput.value = '';
            
        } catch (error) {
            console.error('Error uploading file:', error);
            App.showNotification('Erro ao enviar arquivo', 'error');
        }
    },
    
    // Close ticket modal
    closeTicketModal() {
        const modal = document.getElementById('ticketModal');
        if (modal) {
            modal.remove();
        }
        
        // Leave chat room
        if (App.socket) {
            App.socket.emit('leave_ticket', { ticket_id: Chat.currentTicketId });
        }
        Chat.currentTicketId = null;
    },
    
    // Create new ticket
    async createTicket(ticketData) {
        try {
            const response = await axios.post('/api/tickets', ticketData);
            
            App.showNotification('Chamado criado com sucesso', 'success');
            this.loadTickets();
            
            return response.data;
        } catch (error) {
            console.error('Error creating ticket:', error);
            App.showNotification('Erro ao criar chamado', 'error');
            throw error;
        }
    }
};

// Create ticket form handling
document.addEventListener('DOMContentLoaded', () => {
    const createTicketForm = document.getElementById('createTicketForm');
    if (createTicketForm) {
        createTicketForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(createTicketForm);
            const ticketData = {
                title: formData.get('title'),
                description: formData.get('description'),
                department: formData.get('department'),
                priority: formData.get('priority'),
                observations: formData.get('observations') || ''
            };
            
            try {
                await Tickets.createTicket(ticketData);
                createTicketForm.reset();
                App.loadView('tickets');
            } catch (error) {
                // Error already handled in createTicket method
            }
        });
    }
});
