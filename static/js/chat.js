// Chat functionality for ticket details
class TicketChat {
    constructor(ticketId, socket) {
        this.ticketId = ticketId;
        this.socket = socket;
        this.messages = [];
        this.init();
    }

    init() {
        this.setupChatUI();
        this.joinTicketRoom();
        this.loadMessages();
        this.setupEventListeners();
    }

    setupChatUI() {
        const chatContainer = document.getElementById('chat-container');
        if (!chatContainer) return;

        chatContainer.innerHTML = `
            <div class="chat-messages custom-scrollbar" id="chat-messages" style="height: 300px; overflow-y: auto;">
                <div class="loading-spinner mx-auto my-8"></div>
            </div>
            <div class="chat-input mt-4">
                <form id="chat-form" class="flex space-x-2">
                    <input 
                        type="text" 
                        id="chat-message-input" 
                        placeholder="Digite sua mensagem..." 
                        class="form-input flex-1"
                        required
                    >
                    <button type="submit" class="btn-primary">Enviar</button>
                </form>
            </div>
        `;
    }

    setupEventListeners() {
        // Chat form submission
        const chatForm = document.getElementById('chat-form');
        if (chatForm) {
            chatForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.sendMessage();
            });
        }

        // Socket event listeners
        if (this.socket) {
            this.socket.on('new_message', (message) => {
                this.addMessageToUI(message);
                this.scrollToBottom();
            });

            this.socket.on('user_joined', (data) => {
                this.addSystemMessage(`${data.username} entrou no chat`);
            });

            this.socket.on('user_left', (data) => {
                this.addSystemMessage(`${data.username} saiu do chat`);
            });
        }
    }

    joinTicketRoom() {
        if (this.socket && window.helpDeskApp.token) {
            this.socket.emit('join_ticket', {
                token: window.helpDeskApp.token,
                ticket_id: this.ticketId
            });
        }
    }

    async loadMessages() {
        try {
            const response = await axios.get(`/api/tickets/${this.ticketId}/messages`);
            this.messages = response.data;
            this.renderMessages();
        } catch (error) {
            console.error('Failed to load messages:', error);
            this.showChatError('Erro ao carregar mensagens');
        }
    }

    renderMessages() {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;

        if (this.messages.length === 0) {
            messagesContainer.innerHTML = `
                <div class="text-center text-gray-500 py-8">
                    <svg class="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.959 8.959 0 01-4.906-1.436L3 21l2.436-5.094A8.959 8.959 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z"></path>
                    </svg>
                    <p>Nenhuma mensagem ainda</p>
                </div>
            `;
            return;
        }

        messagesContainer.innerHTML = this.messages.map(message => 
            this.renderMessage(message)
        ).join('');

        this.scrollToBottom();
    }

    renderMessage(message) {
        const isCurrentUser = message.author === window.helpDeskApp.user?.username;
        const messageClass = message.message_type === 'system' ? 'system' : 
                           isCurrentUser ? 'own' : 'other';

        if (message.message_type === 'system') {
            return `
                <div class="chat-message system">
                    <div class="flex items-center justify-center space-x-2 text-xs">
                        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
                        </svg>
                        <span>${message.content}</span>
                        <span class="text-gray-400">${this.formatMessageTime(message.created_at)}</span>
                    </div>
                </div>
            `;
        }

        const roleColors = {
            'administrador': 'text-red-600',
            'tecnico': 'text-blue-600',
            'colaborador': 'text-green-600',
            'diretoria': 'text-purple-600'
        };

        const roleColor = roleColors[message.author_role] || 'text-gray-600';

        return `
            <div class="chat-message ${messageClass}">
                <div class="message-header mb-1">
                    <span class="font-medium text-sm ${roleColor}">${message.author}</span>
                    <span class="text-xs text-gray-500 ml-2">${this.formatMessageTime(message.created_at)}</span>
                </div>
                <div class="message-content text-sm">
                    ${this.formatMessageContent(message.content)}
                </div>
            </div>
        `;
    }

    formatMessageContent(content) {
        // Basic URL detection and linking
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return content.replace(urlRegex, '<a href="$1" target="_blank" class="text-blue-600 underline">$1</a>');
    }

    formatMessageTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleTimeString('pt-BR', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
    }

    addMessageToUI(message) {
        const messagesContainer = document.getElementById('chat-messages');
        if (!messagesContainer) return;

        // If this is the first message, clear the empty state
        if (this.messages.length === 0) {
            messagesContainer.innerHTML = '';
        }

        this.messages.push(message);
        messagesContainer.insertAdjacentHTML('beforeend', this.renderMessage(message));
    }

    addSystemMessage(content) {
        const systemMessage = {
            content,
            message_type: 'system',
            author: 'Sistema',
            created_at: new Date().toISOString(),
            ticket_id: this.ticketId
        };
        this.addMessageToUI(systemMessage);
    }

    async sendMessage() {
        const input = document.getElementById('chat-message-input');
        const content = input.value.trim();
        
        if (!content) return;

        const submitBtn = document.querySelector('#chat-form button[type="submit"]');
        
        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<div class="loading-spinner"></div>';

            // Send via API (socket will handle real-time broadcast)
            await axios.post(`/api/tickets/${this.ticketId}/messages`, {
                content
            });

            input.value = '';
            this.scrollToBottom();

        } catch (error) {
            console.error('Failed to send message:', error);
            window.helpDeskApp.showAlert('Erro ao enviar mensagem', 'error');
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Enviar';
            input.focus();
        }
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('chat-messages');
        if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    showChatError(message) {
        const messagesContainer = document.getElementById('chat-messages');
        if (messagesContainer) {
            messagesContainer.innerHTML = `
                <div class="text-center text-red-500 py-8">
                    <svg class="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                    </svg>
                    <p>${message}</p>
                </div>
            `;
        }
    }

    destroy() {
        if (this.socket) {
            this.socket.emit('leave_ticket', {
                token: window.helpDeskApp.token,
                ticket_id: this.ticketId
            });
        }
    }
}

// File upload functionality for tickets
class TicketAttachments {
    constructor(ticketId) {
        this.ticketId = ticketId;
        this.init();
    }

    init() {
        this.setupAttachmentUI();
        this.loadAttachments();
        this.setupEventListeners();
    }

    setupAttachmentUI() {
        const attachmentContainer = document.getElementById('attachment-container');
        if (!attachmentContainer) return;

        attachmentContainer.innerHTML = `
            <div class="mb-4">
                <h4 class="font-medium text-sm mb-2">Anexos</h4>
                <div class="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                    <input type="file" id="file-input" class="hidden" multiple>
                    <button type="button" id="upload-btn" class="text-blue-600 hover:text-blue-700">
                        <svg class="w-6 h-6 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
                        </svg>
                        Clique para enviar arquivos
                    </button>
                    <p class="text-xs text-gray-500 mt-1">
                        Máximo 16MB por arquivo. Tipos permitidos: PDF, DOC, XLS, imagens
                    </p>
                </div>
            </div>
            <div id="attachments-list" class="space-y-2">
                <div class="loading-spinner mx-auto"></div>
            </div>
        `;
    }

    setupEventListeners() {
        const uploadBtn = document.getElementById('upload-btn');
        const fileInput = document.getElementById('file-input');

        if (uploadBtn && fileInput) {
            uploadBtn.addEventListener('click', () => {
                fileInput.click();
            });

            fileInput.addEventListener('change', (e) => {
                this.handleFileUpload(e.target.files);
            });
        }
    }

    async handleFileUpload(files) {
        if (!files || files.length === 0) return;

        for (const file of files) {
            await this.uploadFile(file);
        }

        // Clear file input
        document.getElementById('file-input').value = '';
    }

    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await axios.post(`/api/tickets/${this.ticketId}/attachments`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });

            window.helpDeskApp.showAlert('Arquivo enviado com sucesso', 'success');
            this.loadAttachments(); // Refresh attachments list

        } catch (error) {
            console.error('Failed to upload file:', error);
            window.helpDeskApp.showAlert(
                error.response?.data?.message || 'Erro ao enviar arquivo', 
                'error'
            );
        }
    }

    async loadAttachments() {
        try {
            const response = await axios.get(`/api/tickets/${this.ticketId}/attachments`);
            this.renderAttachments(response.data);
        } catch (error) {
            console.error('Failed to load attachments:', error);
            this.showAttachmentsError();
        }
    }

    renderAttachments(attachments) {
        const listContainer = document.getElementById('attachments-list');
        if (!listContainer) return;

        if (attachments.length === 0) {
            listContainer.innerHTML = `
                <div class="text-center text-gray-500 py-4">
                    <svg class="w-6 h-6 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path>
                    </svg>
                    <p class="text-sm">Nenhum anexo</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = attachments.map(attachment => `
            <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div class="flex items-center space-x-3">
                    <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path>
                    </svg>
                    <div>
                        <p class="text-sm font-medium">${attachment.original_filename}</p>
                        <p class="text-xs text-gray-500">
                            ${this.formatFileSize(attachment.file_size)} • 
                            ${attachment.uploaded_by} • 
                            ${window.helpDeskApp.formatRelativeTime(attachment.uploaded_at)}
                        </p>
                    </div>
                </div>
                <a href="/api/attachments/${attachment.id}/download" 
                   class="text-blue-600 hover:text-blue-700 text-sm font-medium">
                    Download
                </a>
            </div>
        `).join('');
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showAttachmentsError() {
        const listContainer = document.getElementById('attachments-list');
        if (listContainer) {
            listContainer.innerHTML = `
                <div class="text-center text-red-500 py-4">
                    <svg class="w-6 h-6 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.314 16.5c-.77.833.192 2.5 1.732 2.5z"></path>
                    </svg>
                    <p class="text-sm">Erro ao carregar anexos</p>
                </div>
            `;
        }
    }
}

// Export for use in ticket detail page
window.TicketChat = TicketChat;
window.TicketAttachments = TicketAttachments;
