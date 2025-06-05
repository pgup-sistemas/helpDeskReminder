from flask_socketio import emit, join_room, leave_room
from flask_jwt_extended import decode_token
from app import socketio
from models import User, Ticket
from auth import can_access_ticket

@socketio.on('connect')
def handle_connect(auth):
    """Handle client connection"""
    try:
        if auth and 'token' in auth:
            # Decode JWT token to get user
            decoded_token = decode_token(auth['token'])
            user_id = decoded_token['sub']
            user = User.query.get(user_id)
            
            if user and user.is_active:
                emit('connected', {'status': 'success', 'message': 'Connected successfully'})
            else:
                emit('connected', {'status': 'error', 'message': 'Invalid user'})
                return False
        else:
            emit('connected', {'status': 'error', 'message': 'Authentication required'})
            return False
    except Exception as e:
        emit('connected', {'status': 'error', 'message': 'Authentication failed'})
        return False

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    print('Client disconnected')

@socketio.on('join_ticket')
def handle_join_ticket(data):
    """Join a ticket room for real-time chat"""
    try:
        token = data.get('token')
        ticket_id = data.get('ticket_id')
        
        if not token or not ticket_id:
            emit('error', {'message': 'Token and ticket_id required'})
            return
        
        # Decode JWT token
        decoded_token = decode_token(token)
        user_id = decoded_token['sub']
        user = User.query.get(user_id)
        
        if not user or not user.is_active:
            emit('error', {'message': 'Invalid user'})
            return
        
        # Check if user can access ticket
        ticket = Ticket.query.get(ticket_id)
        if not ticket or not can_access_ticket(user, ticket):
            emit('error', {'message': 'Access denied'})
            return
        
        # Join room
        room = f'ticket_{ticket_id}'
        join_room(room)
        
        emit('joined_ticket', {
            'ticket_id': ticket_id,
            'room': room,
            'message': f'Joined ticket {ticket_id} chat'
        })
        
        # Notify others in the room
        emit('user_joined', {
            'username': user.username,
            'ticket_id': ticket_id
        }, room=room, include_self=False)
        
    except Exception as e:
        emit('error', {'message': 'Failed to join ticket chat'})

@socketio.on('leave_ticket')
def handle_leave_ticket(data):
    """Leave a ticket room"""
    try:
        token = data.get('token')
        ticket_id = data.get('ticket_id')
        
        if not token or not ticket_id:
            emit('error', {'message': 'Token and ticket_id required'})
            return
        
        # Decode JWT token
        decoded_token = decode_token(token)
        user_id = decoded_token['sub']
        user = User.query.get(user_id)
        
        if not user or not user.is_active:
            emit('error', {'message': 'Invalid user'})
            return
        
        # Leave room
        room = f'ticket_{ticket_id}'
        leave_room(room)
        
        emit('left_ticket', {
            'ticket_id': ticket_id,
            'message': f'Left ticket {ticket_id} chat'
        })
        
        # Notify others in the room
        emit('user_left', {
            'username': user.username,
            'ticket_id': ticket_id
        }, room=room)
        
    except Exception as e:
        emit('error', {'message': 'Failed to leave ticket chat'})

@socketio.on('send_message')
def handle_send_message(data):
    """Send a message to a ticket room"""
    try:
        token = data.get('token')
        ticket_id = data.get('ticket_id')
        content = data.get('content')
        
        if not all([token, ticket_id, content]):
            emit('error', {'message': 'Token, ticket_id, and content required'})
            return
        
        # Decode JWT token
        decoded_token = decode_token(token)
        user_id = decoded_token['sub']
        user = User.query.get(user_id)
        
        if not user or not user.is_active:
            emit('error', {'message': 'Invalid user'})
            return
        
        # Check if user can access ticket
        ticket = Ticket.query.get(ticket_id)
        if not ticket or not can_access_ticket(user, ticket):
            emit('error', {'message': 'Access denied'})
            return
        
        # Create and save message
        from models import ChatMessage, db
        message = ChatMessage(
            content=content,
            ticket_id=ticket_id,
            author_id=user_id
        )
        
        db.session.add(message)
        db.session.commit()
        
        # Emit to room
        room = f'ticket_{ticket_id}'
        emit('new_message', message.to_dict(), room=room)
        
    except Exception as e:
        emit('error', {'message': 'Failed to send message'})
