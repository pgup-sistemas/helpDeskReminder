// TechSupport Pro - Socket.IO Client Implementation

class SocketManager {
    constructor() {
        this.socket = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.pingInterval = null;
        this.currentRoom = null;
        this.eventListeners = new Map();
        
        this.init();
    }
    
    init() {
        if (typeof io === 'undefined') {
            console.warn('Socket.IO not loaded, real-time features disabled');
            return;
        }
        
        this.connect();
        this.setupEventListeners();
    }
    
    connect() {
        try {
            this.socket = io({
                transports: ['websocket', 'polling'],
                timeout: 20000,
                reconnection: true,
                reconnectionDelay: this.reconnectDelay,
                reconnectionAttempts: this.maxReconnectAttempts
            });
            
            this.socket.on('connect', () => this.onConnect());
            this.socket.on('disconnect', (reason) => this.onDisconnect(reason));
            this.socket.on('connect_error', (error) => this.onConnectError(error));
            this.socket.on('reconnect', (attemptNumber) => this.onReconnect(attemptNumber));
            this.socket.on('reconnect_failed', () => this.onReconnectFailed());
            
        } catch (error) {
            console.error('Failed to initialize socket connection:', error);
        }
    }
    
    onConnect() {
        console.log('Socket connected successfully');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Start ping interval to keep connection alive
        this.startPing();
        
        // Show connection status
        this.showConnectionStatus('connected');
        
        // Emit custom connect event
        this.emit('socket_connected');
    }
    
    onDisconnect(reason) {
        console.log('Socket disconnected:', reason);
        this.isConnected = false;
        this.currentRoom = null;
        
        // Stop ping interval
        this.stopPing();
        
        // Show disconnection status
        this.showConnectionStatus('disconnected');
        
        // Emit custom disconnect event
        this.emit('socket_disconnected', reason);
    }
    
    onConnectError(error) {
        console.error('Socket connection error:', error);
        this.reconnectAttempts++;
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.showConnectionStatus('failed');
            window.TechSupport?.showToast('Falha na conexão em tempo real. Alguns recursos podem não funcionar.', 'warning');
        }
    }
    
    onReconnect(attemptNumber) {
        console.log(`Socket reconnected after ${attemptNumber} attempts`);
        this.reconnectAttempts = 0;
        window.TechSupport?.showToast('Conexão em tempo real restaurada!', 'success');
    }
    
    onReconnectFailed() {
        console.error('Socket reconnection failed');
        this.showConnectionStatus('failed');
        window.TechSupport?.showToast('Não foi possível restabelecer a conexão em tempo real.', 'error');
    }
    
    setupEventListeners() {
        if (!this.socket) return;
        
        // Handle new tickets
        this.socket.on('new_ticket', (data) => {
            console.log('New ticket received:', data);
            this.emit('new_ticket', data);
            
            // Show notification for technicians
            if (window.location.pathname.includes('/dashboard') || window.location.pathname.includes('/tickets')) {
                window.TechSupport?.showToast(`Novo chamado: ${data.title}`, 'info');
            }
        });
        
        // Handle ticket updates
        this.socket.on('ticket_updated', (data) => {
            console.log('Ticket updated:', data);
            this.emit('ticket_updated', data);
        });
        
        // Handle new messages
        this.socket.on('new_message', (data) => {
            console.log('New message received:', data);
            this.emit('new_message', data);
            
            // Play notification sound (if enabled)
            this.playNotificationSound();
        });
        
        // Handle typing indicators
        this.socket.on('user_typing', (data) => {
            this.emit('user_typing', data);
        });
        
        // Handle user joining/leaving ticket rooms
        this.socket.on('joined_ticket', (data) => {
            console.log('User joined ticket room:', data);
            this.emit('user_joined_ticket', data);
        });
        
        this.socket.on('left_ticket', (data) => {
            console.log('User left ticket room:', data);
            this.emit('user_left_ticket', data);
        });
        
        // Handle pong response
        this.socket.on('pong', () => {
            console.log('Pong received');
        });
    }
    
    // Room management
    joinTicketRoom(ticketId) {
        if (!this.isConnected || !ticketId) return;
        
        this.socket.emit('join_ticket', { ticket_id: ticketId });
        this.currentRoom = `ticket_${ticketId}`;
        console.log(`Joined ticket room: ${this.currentRoom}`);
    }
    
    leaveTicketRoom(ticketId) {
        if (!this.isConnected || !ticketId) return;
        
        this.socket.emit('leave_ticket', { ticket_id: ticketId });
        
        if (this.currentRoom === `ticket_${ticketId}`) {
            this.currentRoom = null;
        }
        
        console.log(`Left ticket room: ticket_${ticketId}`);
    }
    
    // Typing indicators
    sendTypingIndicator(ticketId, isTyping = true) {
        if (!this.isConnected || !ticketId) return;
        
        this.socket.emit('typing', {
            ticket_id: ticketId,
            is_typing: isTyping
        });
    }
    
    // Ping functionality
    startPing() {
        this.stopPing(); // Clear any existing interval
        
        this.pingInterval = setInterval(() => {
            if (this.isConnected) {
                this.socket.emit('ping');
            }
        }, 30000); // Ping every 30 seconds
    }
    
    stopPing() {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
    
    // Connection status indicator
    showConnectionStatus(status) {
        const indicator = document.getElementById('connection-status');
        if (!indicator) return;
        
        const statusMap = {
            connected: {
                icon: 'fas fa-wifi text-green-500',
                text: 'Conectado',
                class: 'bg-green-100 text-green-800'
            },
            disconnected: {
                icon: 'fas fa-wifi text-yellow-500',
                text: 'Reconectando...',
                class: 'bg-yellow-100 text-yellow-800'
            },
            failed: {
                icon: 'fas fa-wifi text-red-500',
                text: 'Desconectado',
                class: 'bg-red-100 text-red-800'
            }
        };
        
        const config = statusMap[status] || statusMap.disconnected;
        
        indicator.innerHTML = `
            <i class="${config.icon} mr-1"></i>
            <span class="text-xs">${config.text}</span>
        `;
        
        indicator.className = `px-2 py-1 rounded-full ${config.class}`;
    }
    
    // Notification sound
    playNotificationSound() {
        try {
            // Create and play a subtle notification sound
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0, audioContext.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
            
        } catch (error) {
            console.log('Notification sound not available');
        }
    }
    
    // Event system
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }
    
    off(event, callback) {
        if (!this.eventListeners.has(event)) return;
        
        const listeners = this.eventListeners.get(event);
        const index = listeners.indexOf(callback);
        if (index > -1) {
            listeners.splice(index, 1);
        }
    }
    
    emit(event, data = null) {
        if (!this.eventListeners.has(event)) return;
        
        const listeners = this.eventListeners.get(event);
        listeners.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in socket event listener for ${event}:`, error);
            }
        });
    }
    
    // Public methods
    isSocketConnected() {
        return this.isConnected;
    }
    
    getCurrentRoom() {
        return this.currentRoom;
    }
    
    disconnect() {
        if (this.socket) {
            this.stopPing();
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
            this.currentRoom = null;
        }
    }
    
    // Send custom events
    sendCustomEvent(eventName, data) {
        if (this.isConnected) {
            this.socket.emit(eventName, data);
        }
    }
}

// Initialize socket manager when DOM is ready
let socketManager = null;

document.addEventListener('DOMContentLoaded', function() {
    // Only initialize if user is logged in (check for navigation presence)
    if (document.querySelector('nav')) {
        socketManager = new SocketManager();
        
        // Make socket manager globally available
        window.SocketManager = socketManager;
        
        console.log('Socket manager initialized');
    }
});

// Cleanup on page unload
window.addEventListener('beforeunload', function() {
    if (socketManager) {
        socketManager.disconnect();
    }
});

// Page-specific socket handlers
function setupTicketDetailSocketHandlers(ticketId) {
    if (!socketManager) return;
    
    // Join ticket room
    socketManager.joinTicketRoom(ticketId);
    
    // Handle new messages
    socketManager.on('new_message', function(data) {
        if (data.ticket_id === ticketId) {
            // Reload messages or append new message to chat
            if (typeof loadMessages === 'function') {
                loadMessages();
            }
        }
    });
    
    // Handle ticket updates
    socketManager.on('ticket_updated', function(data) {
        if (data.ticket_id === ticketId) {
            // Reload ticket details
            if (typeof loadTicketDetails === 'function') {
                loadTicketDetails();
            }
            
            window.TechSupport?.showToast(`Chamado atualizado por ${data.updated_by}`, 'info');
        }
    });
    
    // Handle typing indicators
    socketManager.on('user_typing', function(data) {
        if (data.ticket_id === ticketId) {
            const indicator = document.getElementById('typing-indicator');
            if (indicator) {
                if (data.is_typing) {
                    indicator.innerHTML = `<i class="fas fa-circle-notch fa-spin mr-1"></i>${data.username} está digitando...`;
                    indicator.classList.remove('hidden');
                } else {
                    indicator.classList.add('hidden');
                }
            }
        }
    });
    
    // Setup typing detection for message input
    const messageInput = document.getElementById('message-input');
    if (messageInput) {
        let typingTimeout = null;
        
        messageInput.addEventListener('input', function() {
            socketManager.sendTypingIndicator(ticketId, true);
            
            clearTimeout(typingTimeout);
            typingTimeout = setTimeout(() => {
                socketManager.sendTypingIndicator(ticketId, false);
            }, 1000);
        });
        
        // Stop typing when user leaves input
        messageInput.addEventListener('blur', function() {
            clearTimeout(typingTimeout);
            socketManager.sendTypingIndicator(ticketId, false);
        });
    }
    
    // Cleanup when leaving page
    window.addEventListener('beforeunload', function() {
        if (socketManager) {
            socketManager.leaveTicketRoom(ticketId);
        }
    });
}

function setupDashboardSocketHandlers() {
    if (!socketManager) return;
    
    // Handle new tickets
    socketManager.on('new_ticket', function(data) {
        // Refresh dashboard stats
        if (typeof loadDashboardStats === 'function') {
            loadDashboardStats();
        }
        
        // Show notification
        window.TechSupport?.showToast(`Novo chamado: ${data.title}`, 'info');
    });
    
    // Handle ticket updates
    socketManager.on('ticket_updated', function(data) {
        // Refresh dashboard stats
        if (typeof loadDashboardStats === 'function') {
            loadDashboardStats();
        }
    });
}

function setupTicketsListSocketHandlers() {
    if (!socketManager) return;
    
    // Handle new tickets
    socketManager.on('new_ticket', function(data) {
        // Refresh tickets list
        if (typeof loadTickets === 'function') {
            loadTickets(1); // Reload first page
        }
    });
    
    // Handle ticket updates
    socketManager.on('ticket_updated', function(data) {
        // Refresh tickets list
        if (typeof refreshTickets === 'function') {
            refreshTickets();
        }
    });
}

// Export for use in other scripts
window.setupTicketDetailSocketHandlers = setupTicketDetailSocketHandlers;
window.setupDashboardSocketHandlers = setupDashboardSocketHandlers;
window.setupTicketsListSocketHandlers = setupTicketsListSocketHandlers;

console.log('TechSupport Pro socket.js loaded successfully');
