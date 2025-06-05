// Socket.IO client management for real-time features

class SocketManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 3000;
        this.currentTicketRoom = null;
        this.eventHandlers = new Map();
        
        this.initialize();
    }
    
    initialize() {
        const token = localStorage.getItem('token');
        if (!token) {
            console.warn('No token found, cannot initialize socket connection');
            return;
        }
        
        this.connect();
    }
    
    connect() {
        const token = localStorage.getItem('token');
        if (!token) {
            console.error('Cannot connect socket without authentication token');
            return;
        }
        
        try {
            this.socket = io({
                auth: {
                    token: token
                },
                transports: ['websocket', 'polling'],
                timeout: 10000,
                forceNew: true
            });
            
            this.setupEventListeners();
            
        } catch (error) {
            console.error('Failed to initialize socket connection:', error);
            this.handleConnectionError();
        }
    }
    
    setupEventListeners() {
        if (!this.socket) return;
        
        // Connection events
        this.socket.on('connect', () => {
            console.log('Socket connected successfully');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.updateConnectionStatus(true);
            
            // Rejoin ticket room if we were in one
            if (this.currentTicketRoom) {
                this.joinTicketRoom(this.currentTicketRoom);
            }
        });
        
        this.socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
            this.isConnected = false;
            this.updateConnectionStatus(false);
            
            // Attempt reconnection for certain disconnect reasons
            if (reason === 'io server disconnect') {
                // Server initiated disconnect, don't reconnect automatically
                console.log('Server disconnected client, not attempting reconnection');
            } else {
                // Client or network issue, attempt reconnection
                this.handleReconnection();
            }
        });
        
        this.socket.on('connect_error', (error) => {
            console.error('Socket connection error:', error);
            this.handleConnectionError();
        });
        
        // Application events
        this.socket.on('connected', (data) => {
            console.log('Socket authentication successful:', data.message);
        });
        
        this.socket.on('error', (data) => {
            console.error('Socket error:', data.message);
            showToast('Erro de conexão em tempo real', 'error');
        });
        
        // Ticket events
        this.socket.on('new_ticket', (ticket) => {
            this.handleNewTicket(ticket);
        });
        
        this.socket.on('ticket_updated', (ticket) => {
            this.handleTicketUpdate(ticket);
        });
        
        this.socket.on('new_message', (message) => {
            this.handleNewMessage(message);
        });
        
        this.socket.on('message_notification', (data) => {
            this.handleMessageNotification(data);
        });
        
        // Chat events
        this.socket.on('user_typing', (data) => {
            this.handleUserTyping(data);
        });
        
        this.socket.on('joined_ticket', (data) => {
            console.log(`Joined ticket room: ${data.room}`);
        });
        
        this.socket.on('left_ticket', (data) => {
            console.log(`Left ticket room: ${data.room}`);
        });
    }
    
    handleConnectionError() {
        this.isConnected = false;
        this.updateConnectionStatus(false);
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            setTimeout(() => {
                this.handleReconnection();
            }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts)); // Exponential backoff
        } else {
            console.error('Max reconnection attempts reached');
            showToast('Conexão em tempo real perdida. Recarregue a página.', 'error');
        }
    }
    
    handleReconnection() {
        if (this.isConnected) return;
        
        this.reconnectAttempts++;
        console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        
        // Check if we still have a valid token
        const token = localStorage.getItem('token');
        if (!token) {
            console.log('No token available for reconnection');
            return;
        }
        
        try {
            this.socket.disconnect();
            this.connect();
        } catch (error) {
            console.error('Reconnection failed:', error);
            this.handleConnectionError();
        }
    }
    
    updateConnectionStatus(connected) {
        const statusIndicator = document.getElementById('connection-status');
        if (statusIndicator) {
            if (connected) {
                statusIndicator.className = 'w-2 h-2 bg-green-400 rounded-full';
                statusIndicator.title = 'Conectado em tempo real';
            } else {
                statusIndicator.className = 'w-2 h-2 bg-red-400 rounded-full animate-pulse';
                statusIndicator.title = 'Desconectado - tentando reconectar...';
            }
        }
    }
    
    // Event handlers
    handleNewTicket(ticket) {
        const currentUser = getCurrentUser();
        
        // Only show notification to technicians and admins
        if (currentUser && ['Técnico', 'Administrador'].includes(currentUser.role)) {
            showToast(`Novo chamado #${ticket.id}: ${ticket.title}`, 'info');
            
            // Play notification sound if available
            this.playNotificationSound();
            
            // Update tickets list if we're on the tickets page
            if (window.location.pathname === '/tickets' && typeof loadTickets === 'function') {
                loadTickets();
            }
            
            // Update dashboard if we're on the dashboard
            if (window.location.pathname === '/dashboard' && typeof loadDashboardData === 'function') {
                loadDashboardData();
            }
        }
        
        // Trigger custom event handlers
        this.triggerCustomEvent('newTicket', ticket);
    }
    
    handleTicketUpdate(ticket) {
        // Update ticket detail view if we're viewing this ticket
        const currentTicketId = this.getCurrentTicketId();
        if (currentTicketId && currentTicketId == ticket.id) {
            if (typeof renderTicketDetails === 'function') {
                renderTicketDetails(ticket);
            }
        }
        
        // Update tickets list
        if (window.location.pathname === '/tickets' && typeof loadTickets === 'function') {
            loadTickets();
        }
        
        // Update dashboard
        if (window.location.pathname === '/dashboard' && typeof loadDashboardData === 'function') {
            loadDashboardData();
        }
        
        // Trigger custom event handlers
        this.triggerCustomEvent('ticketUpdate', ticket);
    }
    
    handleNewMessage(message) {
        // Update messages in ticket detail view
        const currentTicketId = this.getCurrentTicketId();
        if (currentTicketId && currentTicketId == message.ticket_id) {
            if (typeof loadMessages === 'function') {
                loadMessages();
            }
            
            // Play notification sound for new messages
            this.playNotificationSound();
        }
        
        // Trigger custom event handlers
        this.triggerCustomEvent('newMessage', message);
    }
    
    handleMessageNotification(data) {
        // Show toast notification for message in other tickets
        const currentTicketId = this.getCurrentTicketId();
        if (!currentTicketId || currentTicketId != data.ticket_id) {
            const messageType = data.is_internal ? 'Mensagem interna' : 'Nova mensagem';
            showToast(`${messageType} no chamado #${data.ticket_id}`, 'info');
        }
        
        // Trigger custom event handlers
        this.triggerCustomEvent('messageNotification', data);
    }
    
    handleUserTyping(data) {
        const currentTicketId = this.getCurrentTicketId();
        if (currentTicketId && currentTicketId == data.ticket_id) {
            const indicator = document.getElementById('typing-indicator');
            if (indicator) {
                const span = indicator.querySelector('span');
                if (span) {
                    if (data.is_typing) {
                        span.textContent = `${data.user_name} está digitando...`;
                        indicator.classList.remove('hidden');
                    } else {
                        indicator.classList.add('hidden');
                    }
                }
            }
        }
        
        // Trigger custom event handlers
        this.triggerCustomEvent('userTyping', data);
    }
    
    // Public methods
    joinTicketRoom(ticketId) {
        if (!this.socket || !this.isConnected) {
            console.warn('Cannot join ticket room: socket not connected');
            return;
        }
        
        // Leave current room if any
        if (this.currentTicketRoom && this.currentTicketRoom !== ticketId) {
            this.leaveTicketRoom();
        }
        
        this.socket.emit('join_ticket', { ticket_id: ticketId });
        this.currentTicketRoom = ticketId;
    }
    
    leaveTicketRoom() {
        if (!this.socket || !this.currentTicketRoom) return;
        
        this.socket.emit('leave_ticket', { ticket_id: this.currentTicketRoom });
        this.currentTicketRoom = null;
    }
    
    sendMessage(ticketId, message, isInternal = false) {
        if (!this.socket || !this.isConnected) {
            console.warn('Cannot send message: socket not connected');
            return;
        }
        
        this.socket.emit('send_message', {
            ticket_id: ticketId,
            message: message,
            is_internal: isInternal
        });
    }
    
    sendTypingIndicator(ticketId, isTyping = true) {
        if (!this.socket || !this.isConnected) return;
        
        const currentUser = getCurrentUser();
        if (!currentUser) return;
        
        this.socket.emit('typing', {
            ticket_id: ticketId,
            user_name: currentUser.name,
            is_typing: isTyping
        });
    }
    
    // Custom event system
    on(eventName, handler) {
        if (!this.eventHandlers.has(eventName)) {
            this.eventHandlers.set(eventName, []);
        }
        this.eventHandlers.get(eventName).push(handler);
    }
    
    off(eventName, handler) {
        if (this.eventHandlers.has(eventName)) {
            const handlers = this.eventHandlers.get(eventName);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }
    
    triggerCustomEvent(eventName, data) {
        if (this.eventHandlers.has(eventName)) {
            this.eventHandlers.get(eventName).forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Error in custom event handler for ${eventName}:`, error);
                }
            });
        }
    }
    
    // Utility methods
    getCurrentTicketId() {
        const match = window.location.pathname.match(/\/ticket\/(\d+)/);
        return match ? parseInt(match[1]) : null;
    }
    
    playNotificationSound() {
        try {
            // Create a simple beep sound using Web Audio API
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (error) {
            console.log('Could not play notification sound:', error);
        }
    }
    
    disconnect() {
        if (this.socket) {
            this.leaveTicketRoom();
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
            this.currentTicketRoom = null;
        }
    }
    
    // Getters
    get connected() {
        return this.isConnected;
    }
    
    get reconnecting() {
        return !this.isConnected && this.reconnectAttempts > 0;
    }
}

// Global socket manager instance
let socketManager = null;

// Initialize socket manager
function initializeSocket() {
    if (!socketManager) {
        socketManager = new SocketManager();
    }
    return socketManager;
}

// Cleanup socket on page unload
window.addEventListener('beforeunload', () => {
    if (socketManager) {
        socketManager.disconnect();
    }
});

// Auto-initialize if user is authenticated
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('token');
    if (token && window.location.pathname !== '/login') {
        initializeSocket();
    }
});

// Export for use in other scripts
window.SocketManager = SocketManager;
window.initializeSocket = initializeSocket;
window.getSocketManager = () => socketManager;
