from functools import wraps
from flask import jsonify, request, redirect, url_for
from flask_login import login_required, current_user
from models import User, UserRole

def role_required(*allowed_roles):
    def decorator(f):
        @wraps(f)
        @login_required
        def decorated_function(*args, **kwargs):
            if not current_user.is_authenticated or not current_user.is_active:
                return jsonify({'message': 'User not found or inactive'}), 401

            if current_user.role not in allowed_roles:
                return jsonify({'message': 'Insufficient permissions'}), 403

            return f(*args, **kwargs)
        return decorated_function
    return decorator

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