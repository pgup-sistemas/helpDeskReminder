from flask_socketio import emit, join_room, leave_room, rooms
from flask_jwt_extended import decode_token
from app import socketio, db
from models import User, Ticket, Message
import logging

# Store active connections
active_connections = {}

@socketio.on('connect')
def handle_connect(auth):
    try:
        if auth and 'token' in auth:
            # Verify JWT token
            try:
                decoded_token = decode_token(auth['token'])
                user_id = decoded_token['sub']
                user = User.query.get(user_id)
                
                if user:
                    active_connections[request.sid] = {
                        'user_id': user_id,
                        'username': user.username,
                        'name': user.name,
                        'role': user.role
                    }
                    emit('connected', {'message': 'Connected successfully'})
                    logging.info(f"User {user.username} connected via WebSocket")
                else:
                    emit('error', {'message': 'Invalid user'})
                    return False
            except Exception as e:
                emit('error', {'message': 'Invalid token'})
                logging.error(f"WebSocket connection error: {str(e)}")
                return False
        else:
            emit('error', {'message': 'Authentication required'})
            return False
    except Exception as e:
        logging.error(f"WebSocket connection error: {str(e)}")
        return False

@socketio.on('disconnect')
def handle_disconnect():
    if request.sid in active_connections:
        user_info = active_connections[request.sid]
        logging.info(f"User {user_info['username']} disconnected from WebSocket")
        del active_connections[request.sid]

@socketio.on('join_ticket')
def handle_join_ticket(data):
    try:
        if request.sid not in active_connections:
            emit('error', {'message': 'Not authenticated'})
            return
        
        user_info = active_connections[request.sid]
        ticket_id = data.get('ticket_id')
        
        if not ticket_id:
            emit('error', {'message': 'Ticket ID required'})
            return
        
        # Verify user has access to this ticket
        ticket = Ticket.query.get(ticket_id)
        if not ticket:
            emit('error', {'message': 'Ticket not found'})
            return
        
        user = User.query.get(user_info['user_id'])
        if user.role == 'Colaborador' and ticket.creator_id != user.id:
            emit('error', {'message': 'Access denied'})
            return
        
        # Join the room for this ticket
        room = f"ticket_{ticket_id}"
        join_room(room)
        
        emit('joined_ticket', {
            'ticket_id': ticket_id,
            'message': f'Joined ticket #{ticket_id} chat'
        })
        
        # Notify others in the room
        emit('user_joined', {
            'user': {
                'name': user_info['name'],
                'role': user_info['role']
            },
            'ticket_id': ticket_id
        }, room=room, include_self=False)
        
        logging.info(f"User {user_info['username']} joined ticket #{ticket_id} chat")
        
    except Exception as e:
        emit('error', {'message': str(e)})
        logging.error(f"Error joining ticket chat: {str(e)}")

@socketio.on('leave_ticket')
def handle_leave_ticket(data):
    try:
        if request.sid not in active_connections:
            return
        
        user_info = active_connections[request.sid]
        ticket_id = data.get('ticket_id')
        
        if ticket_id:
            room = f"ticket_{ticket_id}"
            leave_room(room)
            
            # Notify others in the room
            emit('user_left', {
                'user': {
                    'name': user_info['name'],
                    'role': user_info['role']
                },
                'ticket_id': ticket_id
            }, room=room)
            
            logging.info(f"User {user_info['username']} left ticket #{ticket_id} chat")
            
    except Exception as e:
        logging.error(f"Error leaving ticket chat: {str(e)}")

@socketio.on('send_message')
def handle_send_message(data):
    try:
        if request.sid not in active_connections:
            emit('error', {'message': 'Not authenticated'})
            return
        
        user_info = active_connections[request.sid]
        ticket_id = data.get('ticket_id')
        content = data.get('content')
        
        if not ticket_id or not content:
            emit('error', {'message': 'Ticket ID and content required'})
            return
        
        # Verify user has access to this ticket
        ticket = Ticket.query.get(ticket_id)
        if not ticket:
            emit('error', {'message': 'Ticket not found'})
            return
        
        user = User.query.get(user_info['user_id'])
        if user.role == 'Colaborador' and ticket.creator_id != user.id:
            emit('error', {'message': 'Access denied'})
            return
        
        # Create message in database
        message = Message(
            content=content,
            ticket_id=ticket_id,
            user_id=user_info['user_id'],
            message_type='message'
        )
        
        db.session.add(message)
        db.session.commit()
        
        # Broadcast message to all users in the ticket room
        room = f"ticket_{ticket_id}"
        emit('new_message', {
            'id': message.id,
            'content': message.content,
            'timestamp': message.timestamp.isoformat(),
            'message_type': message.message_type,
            'author': {
                'id': user.id,
                'name': user.name,
                'role': user.role
            },
            'ticket_id': ticket_id
        }, room=room)
        
        logging.info(f"Message sent by {user_info['username']} in ticket #{ticket_id}")
        
    except Exception as e:
        db.session.rollback()
        emit('error', {'message': str(e)})
        logging.error(f"Error sending message: {str(e)}")

@socketio.on('typing')
def handle_typing(data):
    try:
        if request.sid not in active_connections:
            return
        
        user_info = active_connections[request.sid]
        ticket_id = data.get('ticket_id')
        is_typing = data.get('is_typing', False)
        
        if ticket_id:
            room = f"ticket_{ticket_id}"
            emit('user_typing', {
                'user': {
                    'name': user_info['name'],
                    'role': user_info['role']
                },
                'ticket_id': ticket_id,
                'is_typing': is_typing
            }, room=room, include_self=False)
            
    except Exception as e:
        logging.error(f"Error handling typing indicator: {str(e)}")

@socketio.on('ticket_updated')
def handle_ticket_update(data):
    try:
        if request.sid not in active_connections:
            return
        
        user_info = active_connections[request.sid]
        ticket_id = data.get('ticket_id')
        
        if ticket_id:
            room = f"ticket_{ticket_id}"
            emit('ticket_status_changed', {
                'ticket_id': ticket_id,
                'updated_by': {
                    'name': user_info['name'],
                    'role': user_info['role']
                }
            }, room=room, include_self=False)
            
    except Exception as e:
        logging.error(f"Error handling ticket update: {str(e)}")
