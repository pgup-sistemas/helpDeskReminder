// Chat module for real-time messaging
const Chat = {
    currentTicketId: null,
    typingTimer: null,
    isTyping: false,
    
    // Initialize ticket chat
    initializeTicketChat(ticketId) {
        this.currentTicketId = ticketId;
        this.loadChatMessages(ticketId);
        this.renderChatInterface(ticketId);
        
        // Join the ticket room
        if (App.socket) {
            App.socket.emit('join_ticket', { ticket_id: ticketId });
        }
    },
    
    // Setup socket event listeners
    setupSocketListeners(socket) {
        socket.on('connected', (data) => {
            console.log('Chat connected:', data.message);
        });
        
        socket.on('joined_ticket', (data) => {
            console.log('Joined ticket chat:', data.ticket_id);
        });
        
        socket.on('new_message', (data) => {
            this.addMessageToChat(data);
        });
        
        socket.on('user_joined', (data) => {
            this.addSystemMessage(`${data.user.name} (${data.user.role}) entrou no chat`);
        });
        
        socket.on('user_left', (data) => {
            this.addSystemMessage(`${data.user.name} (${data.user.role}) saiu do chat`);
        });
        
        socket.on('user_typing', (data) => {
            this.showTypingIndicator(data.user.name, data.is_typing);
        });
        
        socket.on('error', (data) => {
            console.error('Chat error:', data.message);
            App.showNotification(data.message, 'error');
        });
    },
    
    // Load chat messages
    async loadChatMessages(ticketId) {
        try {
            const response = await axios.get(`/api/tickets/${ticketId}/messages`);
            const messages = response.data;
            
            this.renderMessages(messages);
            
        } catch (error) {
            console.error('Error loading messages:', error);
            document.getElementById('ticketChat').innerHTML = `
                <h4 class="font-semibold mb-2">Chat Interno</h4>
                <p class="text-red-500 text-sm">Erro ao carregar mensagens</p>
            `;
        }
    },
    
    // Render chat interface
    renderChatInterface(ticketId) {
        const chatContainer = document.getElementById('ticketChat');
        
        chatContainer.innerHTML = `
            <h4 class="font-semibold mb-2">Chat Interno</h4>
            <div class="border border-gray-200 rounded-lg">
                <div id="chatMessages" class="chat-container custom-scrollbar overflow-y-auto p-4 bg-gray-50">
                    <div class="flex items-center justify-center py-4">
                        <div class="spinner"></div>
                        <span class="ml-2 text-gray-600">Carregando mensagens...</span>
                    </div>
                </div>
                <div id="typingIndicator" class="px-4 py-2 text-sm text-gray-500 italic" style="display: none;"></div>
                <div class="border-t p-4">
                    <div class="flex space-x-2">
                        <input type="text" 
                               id="messageInput" 
                               placeholder="Digite sua mensagem..."
                               class="flex-1 helpdesk-input"
                               onkeypress="Chat.handleKeyPress(event)"
                               oninput="Chat.handleTyping()">
                        <button onclick="Chat.sendMessage()" 
                                class="helpdesk-button-primary">
                            Enviar
                        </button>
                    </div>
                </div>
            </div>
        `;
    },
    
    // Render messages
    renderMessages(messages) {
        const container = document.getElementById('chatMessages');
        
        if (messages.length === 0) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <p>Nenhuma mensagem ainda.</p>
                    <p class="text-sm">Seja o primeiro a comentar!</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = messages.map(message => this.renderMessage(message)).join('');
        this.scrollToBottom();
    },
    
    // Render individual message
    renderMessage(message) {
        const isOwnMessage = message.author.id === App.currentUser.id;
        const isSystemMessage = message.message_type === 'system';
        
        if (isSystemMessage) {
            return `
                <div class="chat-message chat-message-system">
                    <div class="text-xs">${message.content}</div>
                    <div class="text-xs mt-1">${App.formatRelativeTime(message.timestamp)}</div>
                </div>
            `;
        }
        
        const messageClass = isOwnMessage ? 'chat-message-own' : 'chat-message-other';
        
        return `
            <div class="chat-message ${messageClass}">
                ${!isOwnMessage ? `
                    <div class="text-xs font-medium mb-1">
                        ${message.author.name} (${message.author.role})
                    </div>
                ` : ''}
                <div class="text-sm">${this.formatMessageContent(message.content)}</div>
                <div class="text-xs mt-1 opacity-75">
                    ${App.formatRelativeTime(message.timestamp)}
                </div>
            </div>
        `;
    },
    
    // Format message content (handle links, etc.)
    formatMessageContent(content) {
        // Basic URL detection and linking
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        return content.replace(urlRegex, '<a href="$1" target="_blank" class="underline">$1</a>');
    },
    
    // Add new message to chat
    addMessageToChat(message) {
        const container = document.getElementById('chatMessages');
        const messageHTML = this.renderMessage(message);
        
        container.insertAdjacentHTML('beforeend', messageHTML);
        this.scrollToBottom();
    },
    
    // Add system message
    addSystemMessage(content) {
        const systemMessage = {
            content: content,
            timestamp: new Date().toISOString(),
            message_type: 'system',
            author: { id: 0, name: 'Sistema', role: 'System' }
        };
        
        this.addMessageToChat(systemMessage);
    },
    
    // Send message
    async sendMessage() {
        const input = document.getElementById('messageInput');
        const content = input.value.trim();
        
        if (!content || !this.currentTicketId) return;
        
        // Clear input
        input.value = '';
        
        // Stop typing indicator
        this.stopTyping();
        
        try {
            // Send via socket for real-time delivery
            if (App.socket) {
                App.socket.emit('send_message', {
                    ticket_id: this.currentTicketId,
                    content: content
                });
            } else {
                // Fallback to HTTP if socket not available
                await axios.post(`/api/tickets/${this.currentTicketId}/messages`, {
                    content: content
                });
                
                // Reload messages
                this.loadChatMessages(this.currentTicketId);
            }
            
        } catch (error) {
            console.error('Error sending message:', error);
            App.showNotification('Erro ao enviar mensagem', 'error');
            
            // Restore message in input
            input.value = content;
        }
    },
    
    // Handle key press in message input
    handleKeyPress(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendMessage();
        }
    },
    
    // Handle typing indicator
    handleTyping() {
        if (!this.isTyping) {
            this.isTyping = true;
            
            if (App.socket && this.currentTicketId) {
                App.socket.emit('typing', {
                    ticket_id: this.currentTicketId,
                    is_typing: true
                });
            }
        }
        
        // Clear existing timer
        clearTimeout(this.typingTimer);
        
        // Set new timer
        this.typingTimer = setTimeout(() => {
            this.stopTyping();
        }, 1000);
    },
    
    // Stop typing indicator
    stopTyping() {
        if (this.isTyping) {
            this.isTyping = false;
            
            if (App.socket && this.currentTicketId) {
                App.socket.emit('typing', {
                    ticket_id: this.currentTicketId,
                    is_typing: false
                });
            }
        }
        
        clearTimeout(this.typingTimer);
    },
    
    // Show typing indicator
    showTypingIndicator(userName, isTyping) {
        const indicator = document.getElementById('typingIndicator');
        
        if (isTyping) {
            indicator.textContent = `${userName} está digitando...`;
            indicator.style.display = 'block';
        } else {
            indicator.style.display = 'none';
        }
    },
    
    // Scroll to bottom of chat
    scrollToBottom() {
        const container = document.getElementById('chatMessages');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }
};
