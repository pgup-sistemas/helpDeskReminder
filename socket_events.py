from flask_socketio import emit, join_room, leave_room
from flask_jwt_extended import decode_token
from app import socketio
from models import User, Ticket

@socketio.on('connect')
def on_connect(auth):
    """Handle client connection"""
    try:
        if auth and 'token' in auth:
            # Decode JWT token to get user info
            decoded_token = decode_token(auth['token'])
            user_id = decoded_token['sub']
            user = User.query.get(user_id)
            
            if user:
                # Join user to appropriate rooms based on role
                if user.role in ['Técnico', 'Administrador']:
                    join_room('technicians')
                
                emit('connected', {'message': 'Conectado ao chat em tempo real'})
        else:
            emit('error', {'message': 'Token de autenticação necessário'})
            return False
    except Exception as e:
        emit('error', {'message': 'Erro de autenticação'})
        return False

@socketio.on('disconnect')
def on_disconnect():
    """Handle client disconnection"""
    print('Cliente desconectado')

@socketio.on('join_ticket')
def on_join_ticket(data):
    """Join a specific ticket room for real-time updates"""
    try:
        ticket_id = data.get('ticket_id')
        if ticket_id:
            room = f'ticket_{ticket_id}'
            join_room(room)
            emit('joined_ticket', {'ticket_id': ticket_id, 'room': room})
    except Exception as e:
        emit('error', {'message': 'Erro ao entrar no canal do chamado'})

@socketio.on('leave_ticket')
def on_leave_ticket(data):
    """Leave a specific ticket room"""
    try:
        ticket_id = data.get('ticket_id')
        if ticket_id:
            room = f'ticket_{ticket_id}'
            leave_room(room)
            emit('left_ticket', {'ticket_id': ticket_id, 'room': room})
    except Exception as e:
        emit('error', {'message': 'Erro ao sair do canal do chamado'})

@socketio.on('send_message')
def on_send_message(data):
    """Handle real-time message sending"""
    try:
        ticket_id = data.get('ticket_id')
        message_content = data.get('message')
        is_internal = data.get('is_internal', False)
        
        if ticket_id and message_content:
            # The actual message saving is handled by the REST API
            # This is just for real-time notification
            room = f'ticket_{ticket_id}'
            emit('message_notification', {
                'ticket_id': ticket_id,
                'message': message_content,
                'is_internal': is_internal
            }, room=room)
    except Exception as e:
        emit('error', {'message': 'Erro ao enviar mensagem'})

@socketio.on('typing')
def on_typing(data):
    """Handle typing indicators"""
    try:
        ticket_id = data.get('ticket_id')
        user_name = data.get('user_name')
        is_typing = data.get('is_typing', False)
        
        if ticket_id and user_name:
            room = f'ticket_{ticket_id}'
            emit('user_typing', {
                'ticket_id': ticket_id,
                'user_name': user_name,
                'is_typing': is_typing
            }, room=room, include_self=False)
    except Exception as e:
        emit('error', {'message': 'Erro no indicador de digitação'})
