import os
from werkzeug.utils import secure_filename
from models import User, UserRole, db

ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'xls', 'xlsx'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def create_demo_users():
    """Create demo users if they don't exist"""
    
    # Check if admin user exists
    admin = User.query.filter_by(username='admin').first()
    if not admin:
        admin = User(
            username='admin',
            email='admin@company.com',
            role=UserRole.ADMINISTRADOR,
            department='TI'
        )
        admin.set_password('admin123')
        db.session.add(admin)
    
    # Check if technician exists
    tech = User.query.filter_by(username='tecnico').first()
    if not tech:
        tech = User(
            username='tecnico',
            email='tecnico@company.com',
            role=UserRole.TECNICO,
            department='TI'
        )
        tech.set_password('tecnico123')
        db.session.add(tech)
    
    # Check if employee exists
    employee = User.query.filter_by(username='colaborador').first()
    if not employee:
        employee = User(
            username='colaborador',
            email='colaborador@company.com',
            role=UserRole.COLABORADOR,
            department='Vendas'
        )
        employee.set_password('colaborador123')
        db.session.add(employee)
    
    try:
        db.session.commit()
        print("Demo users created successfully")
    except Exception as e:
        db.session.rollback()
        print(f"Error creating demo users: {e}")
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
    
    # Tickets created today
    today = datetime.utcnow().date()
    today_start = datetime.combine(today, datetime.min.time())
    today_end = datetime.combine(today, datetime.max.time())
    tickets_today = Ticket.query.filter(
        Ticket.created_at >= today_start,
        Ticket.created_at <= today_end
    ).count()
    
    # Tickets this week
    week_start = datetime.utcnow() - timedelta(days=7)
    tickets_this_week = Ticket.query.filter(Ticket.created_at >= week_start).count()
    
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
        'tickets_today': tickets_today,
        'tickets_this_week': tickets_this_week
    }
