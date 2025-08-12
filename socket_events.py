from flask_socketio import emit, join_room, leave_room
from flask import session
from app import socketio
from models import User, Ticket
from database import db

@socketio.on('connect')
def on_connect():
    """Handle client connection"""
    if 'user_id' not in session:
        return False  # Reject connection
    
    user_id = session['user_id']
    user = User.query.get(user_id)
    
    if not user or not user.is_active:
        return False
    
    # Join role-based rooms
    if user.role in ['Técnico', 'Administrador']:
        join_room('technicians')
    
    emit('connected', {'message': f'Conectado como {user.username}'})

@socketio.on('disconnect')
def on_disconnect():
    """Handle client disconnection"""
    if 'user_id' in session:
        user_id = session['user_id']
        user = User.query.get(user_id)
        
        if user and user.role in ['Técnico', 'Administrador']:
            leave_room('technicians')

@socketio.on('join_ticket')
def on_join_ticket(data):
    """Join a ticket room for real-time updates"""
    if 'user_id' not in session:
        return
    
    ticket_id = data.get('ticket_id')
    if not ticket_id:
        return
    
    user_id = session['user_id']
    user = User.query.get(user_id)
    ticket = Ticket.query.get(ticket_id)
    
    if not user or not ticket:
        return
    
    # Check permissions
    if user.role == 'Colaborador' and ticket.creator_id != user.id:
        return
    
    room = f'ticket_{ticket_id}'
    join_room(room)
    
    emit('joined_ticket', {
        'ticket_id': ticket_id,
        'room': room,
        'message': f'{user.username} entrou no chat do chamado'
    }, room=room)

@socketio.on('leave_ticket')
def on_leave_ticket(data):
    """Leave a ticket room"""
    if 'user_id' not in session:
        return
    
    ticket_id = data.get('ticket_id')
    if not ticket_id:
        return
    
    room = f'ticket_{ticket_id}'
    leave_room(room)
    
    user_id = session['user_id']
    user = User.query.get(user_id)
    
    if user:
        emit('left_ticket', {
            'ticket_id': ticket_id,
            'message': f'{user.username} saiu do chat do chamado'
        }, room=room)

@socketio.on('typing')
def on_typing(data):
    """Handle typing indicators"""
    if 'user_id' not in session:
        return
    
    ticket_id = data.get('ticket_id')
    is_typing = data.get('is_typing', False)
    
    if not ticket_id:
        return
    
    user_id = session['user_id']
    user = User.query.get(user_id)
    
    if not user:
        return
    
    room = f'ticket_{ticket_id}'
    emit('user_typing', {
        'ticket_id': ticket_id,
        'user_id': user.id,
        'username': user.username,
        'is_typing': is_typing
    }, room=room, include_self=False)

@socketio.on('ping')
def on_ping():
    """Handle ping for connection health check"""
    emit('pong')
