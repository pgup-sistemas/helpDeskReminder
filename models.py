from database import db
from datetime import datetime, timedelta
from sqlalchemy import event

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), nullable=False)  # Colaborador, Técnico, Administrador, Diretoria
    email = db.Column(db.String(120), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    active = db.Column(db.Boolean, default=True)
    
    # Relationships
    created_tickets = db.relationship('Ticket', foreign_keys='Ticket.creator_id', backref='creator', lazy='dynamic')
    assigned_tickets = db.relationship('Ticket', foreign_keys='Ticket.assigned_to', backref='assignee', lazy='dynamic')
    messages = db.relationship('Message', backref='author', lazy='dynamic')

class Ticket(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    department = db.Column(db.String(100), nullable=False)
    priority = db.Column(db.String(10), nullable=False)  # Alta, Média, Baixa
    status = db.Column(db.String(20), default='Aberto')  # Aberto, Em Andamento, Resolvido, Fechado
    observations = db.Column(db.Text)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = db.Column(db.DateTime)
    closed_at = db.Column(db.DateTime)
    
    # SLA tracking
    sla_due = db.Column(db.DateTime)
    sla_violated = db.Column(db.Boolean, default=False)
    
    # Foreign keys
    creator_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    assigned_to = db.Column(db.Integer, db.ForeignKey('user.id'))
    
    # Relationships
    messages = db.relationship('Message', backref='ticket', lazy='dynamic', cascade='all, delete-orphan')
    attachments = db.relationship('Attachment', backref='ticket', lazy='dynamic', cascade='all, delete-orphan')

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    message_type = db.Column(db.String(20), default='message')  # message, status_update, system
    
    # Foreign keys
    ticket_id = db.Column(db.Integer, db.ForeignKey('ticket.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)

class Attachment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    file_size = db.Column(db.Integer, nullable=False)
    mime_type = db.Column(db.String(100), nullable=False)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Foreign keys
    ticket_id = db.Column(db.Integer, db.ForeignKey('ticket.id'), nullable=False)
    uploaded_by = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    
    # Relationships
    uploader = db.relationship('User', backref='uploaded_files')

# Event listeners for SLA calculation
@event.listens_for(Ticket, 'before_insert')
def calculate_sla_on_insert(mapper, connection, target):
    """Calculate SLA due date when ticket is created"""
    if target.priority == 'Alta':
        target.sla_due = target.created_at + timedelta(hours=4)
    elif target.priority == 'Média':
        target.sla_due = target.created_at + timedelta(hours=8)
    else:  # Baixa
        target.sla_due = target.created_at + timedelta(hours=24)

@event.listens_for(Ticket, 'before_update')
def update_timestamps_on_update(mapper, connection, target):
    """Update timestamps when ticket status changes"""
    if target.status == 'Resolvido' and not target.resolved_at:
        target.resolved_at = datetime.utcnow()
    elif target.status == 'Fechado' and not target.closed_at:
        target.closed_at = datetime.utcnow()
    
    # Check SLA violation
    if target.status not in ['Resolvido', 'Fechado'] and target.sla_due:
        target.sla_violated = datetime.utcnow() > target.sla_due
