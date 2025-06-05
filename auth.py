from functools import wraps
from flask import jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import User, UserRole

def role_required(*allowed_roles):
    def decorator(f):
        @wraps(f)
        @jwt_required()
        def decorated_function(*args, **kwargs):
            current_user_id = get_jwt_identity()
            user = User.query.get(current_user_id)
            
            if not user or not user.is_active:
                return jsonify({'message': 'User not found or inactive'}), 401
            
            if user.role not in allowed_roles:
                return jsonify({'message': 'Insufficient permissions'}), 403
            
            return f(current_user=user, *args, **kwargs)
        return decorated_function
    return decorator

def get_current_user():
    """Get current user from JWT token"""
    try:
        current_user_id = get_jwt_identity()
        if current_user_id:
            return User.query.get(current_user_id)
    except:
        pass
    return None

def can_access_ticket(user, ticket):
    """Check if user can access a specific ticket"""
    if user.role in [UserRole.ADMINISTRADOR, UserRole.DIRETORIA]:
        return True
    elif user.role == UserRole.TECNICO:
        return True  # Technicians can see all tickets
    elif user.role == UserRole.COLABORADOR:
        return ticket.requester_id == user.id  # Employees can only see their own tickets
    return False

def can_modify_ticket(user, ticket):
    """Check if user can modify a specific ticket"""
    if user.role == UserRole.ADMINISTRADOR:
        return True
    elif user.role == UserRole.TECNICO:
        return ticket.assigned_to_id == user.id or ticket.assigned_to_id is None
    elif user.role == UserRole.COLABORADOR:
        return ticket.requester_id == user.id and ticket.status.value == 'aberto'
    return False
