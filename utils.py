import os
from werkzeug.utils import secure_filename
from models import User, UserRole, db

ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'xls', 'xlsx'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def create_demo_users():
    """Create demo users if they don't exist"""
    demo_users = [
        {
            'username': 'admin',
            'email': 'admin@helpdesk.com',
            'password': 'admin123',
            'role': UserRole.ADMINISTRADOR,
            'department': 'TI'
        },
        {
            'username': 'tecnico1',
            'email': 'tecnico1@helpdesk.com',
            'password': 'tecnico123',
            'role': UserRole.TECNICO,
            'department': 'TI'
        },
        {
            'username': 'colaborador1',
            'email': 'colaborador1@helpdesk.com',
            'password': 'colab123',
            'role': UserRole.COLABORADOR,
            'department': 'Vendas'
        },
        {
            'username': 'diretor',
            'email': 'diretor@helpdesk.com',
            'password': 'diretor123',
            'role': UserRole.DIRETORIA,
            'department': 'Diretoria'
        }
    ]

    for user_data in demo_users:
        existing_user = User.query.filter_by(username=user_data['username']).first()
        if not existing_user:
            user = User(
                username=user_data['username'],
                email=user_data['email'],
                role=user_data['role'],
                department=user_data['department']
            )
            user.set_password(user_data['password'])
            db.session.add(user)

    try:
        db.session.commit()
        print("Demo users created successfully")
    except Exception as e:
        db.session.rollback()
        print(f"Error creating demo users: {e}")

def get_dashboard_stats():
    """Get dashboard statistics"""
    from models import Ticket, TicketStatus, TicketPriority
    from sqlalchemy import func
    from datetime import datetime, timedelta

    total_tickets = Ticket.query.count()
    open_tickets = Ticket.query.filter_by(status=TicketStatus.ABERTO).count()
    in_progress_tickets = Ticket.query.filter_by(status=TicketStatus.EM_ANDAMENTO).count()
    resolved_tickets = Ticket.query.filter_by(status=TicketStatus.RESOLVIDO).count()
    closed_tickets = Ticket.query.filter_by(status=TicketStatus.FECHADO).count()

    # SLA violations
    sla_violated = Ticket.query.filter_by(sla_violated=True).count()

    # Tickets by priority
    high_priority = Ticket.query.filter_by(priority=TicketPriority.ALTA).count()
    medium_priority = Ticket.query.filter_by(priority=TicketPriority.MEDIA).count()
    low_priority = Ticket.query.filter_by(priority=TicketPriority.BAIXA).count()

    # Critical tickets (assuming CRITICA priority exists)
    try:
        critical_tickets = Ticket.query.filter_by(priority=TicketPriority.CRITICA).count()
    except:
        critical_tickets = high_priority  # fallback to high priority

    # Tickets created today
    today = datetime.utcnow().date()
    today_start = datetime.combine(today, datetime.min.time())
    today_end = datetime.combine(today, datetime.max.time())
    tickets_today = Ticket.query.filter(
        Ticket.created_at >= today_start,
        Ticket.created_at <= today_end
    ).count()

    return {
        'total_tickets': total_tickets,
        'open_tickets': open_tickets,
        'in_progress_tickets': in_progress_tickets,
        'resolved_tickets': resolved_tickets,
        'closed_tickets': closed_tickets,
        'sla_violated': sla_violated,
        'high_priority': high_priority,
        'medium_priority': medium_priority,
        'low_priority': low_priority,
        'critical_tickets': critical_tickets,
        'tickets_today': tickets_today
    }

    # Tickets this week
    week_start = datetime.utcnow() - timedelta(days=7)
    tickets_this_week = Ticket.query.filter(Ticket.created_at >= week_start).count()

    # Calculate average resolution time
    resolved_with_time = Ticket.query.filter(
        Ticket.status == TicketStatus.RESOLVIDO,
        Ticket.resolved_at.isnot(None)
    ).all()

    avg_resolution_time = "N/A"
    if resolved_with_time:
        total_time = sum([
            (ticket.resolved_at - ticket.created_at).total_seconds() 
            for ticket in resolved_with_time
        ])
        avg_seconds = total_time / len(resolved_with_time)
        avg_hours = avg_seconds / 3600
        avg_resolution_time = f"{avg_hours:.1f}h"

    return {
        'total_tickets': total_tickets,
        'open_tickets': open_tickets,
        'in_progress_tickets': in_progress_tickets,
        'resolved_tickets': resolved_tickets,
        'closed_tickets': closed_tickets,
        'sla_violated': sla_violated,
        'critical_tickets': critical_tickets,
        'high_priority': high_priority,
        'medium_priority': medium_priority,
        'low_priority': low_priority,
        'tickets_today': tickets_today,
        'tickets_this_week': tickets_this_week,
        'avg_resolution_time': avg_resolution_time
    }