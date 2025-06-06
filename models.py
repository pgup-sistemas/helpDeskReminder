
import enum
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import UserMixin
from app import db

class UserRole(enum.Enum):
    ADMINISTRADOR = 'administrador'
    DIRETORIA = 'diretoria'
    TECNICO = 'tecnico'
    COLABORADOR = 'colaborador'

class TicketStatus(enum.Enum):
    ABERTO = 'aberto'
    EM_ANDAMENTO = 'em_andamento'
    AGUARDANDO = 'aguardando'
    RESOLVIDO = 'resolvido'
    FECHADO = 'fechado'

class TicketPriority(enum.Enum):
    BAIXA = 'baixa'
    MEDIA = 'media'
    ALTA = 'alta'
    CRITICA = 'critica'

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.Enum(UserRole), nullable=False, default=UserRole.COLABORADOR)
    department = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    # Relationships
    created_tickets = db.relationship('Ticket', foreign_keys='Ticket.requester_id', backref='requester', lazy='dynamic')
    assigned_tickets = db.relationship('Ticket', foreign_keys='Ticket.assigned_to_id', backref='assigned_technician', lazy='dynamic')
    messages = db.relationship('ChatMessage', backref='author', lazy='dynamic')
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'role': self.role.value,
            'department': self.department,
            'created_at': self.created_at.isoformat(),
            'is_active': self.is_active
        }

class Ticket(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    status = db.Column(db.Enum(TicketStatus), nullable=False, default=TicketStatus.ABERTO)
    priority = db.Column(db.Enum(TicketPriority), nullable=False, default=TicketPriority.MEDIA)
    department = db.Column(db.String(100), nullable=False)
    observations = db.Column(db.Text)
    
    # Foreign keys
    requester_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    assigned_to_id = db.Column(db.Integer, db.ForeignKey('user.id'))
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = db.Column(db.DateTime)
    closed_at = db.Column(db.DateTime)
    
    # SLA tracking
    sla_deadline = db.Column(db.DateTime)
    sla_violated = db.Column(db.Boolean, default=False)
    
    # Relationships
    messages = db.relationship('ChatMessage', backref='ticket', lazy='dynamic', cascade='all, delete-orphan')
    attachments = db.relationship('TicketAttachment', backref='ticket', lazy='dynamic', cascade='all, delete-orphan')
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.set_sla_deadline()
    
    def set_sla_deadline(self):
        if self.priority == TicketPriority.CRITICA:
            hours = 2
        elif self.priority == TicketPriority.ALTA:
            hours = 4
        elif self.priority == TicketPriority.MEDIA:
            hours = 8
        else:  # BAIXA
            hours = 24
        
        self.sla_deadline = self.created_at + timedelta(hours=hours)
    
    def check_sla_violation(self):
        if not self.sla_violated and datetime.utcnow() > self.sla_deadline:
            if self.status not in [TicketStatus.RESOLVIDO, TicketStatus.FECHADO]:
                self.sla_violated = True
                db.session.commit()
    
    def time_until_sla(self):
        if self.sla_deadline:
            delta = self.sla_deadline - datetime.utcnow()
            return delta.total_seconds()
        return None
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'status': self.status.value,
            'priority': self.priority.value,
            'department': self.department,
            'observations': self.observations,
            'requester': self.requester.username if self.requester else None,
            'assigned_to': self.assigned_technician.username if self.assigned_technician else None,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'resolved_at': self.resolved_at.isoformat() if self.resolved_at else None,
            'closed_at': self.closed_at.isoformat() if self.closed_at else None,
            'sla_deadline': self.sla_deadline.isoformat() if self.sla_deadline else None,
            'sla_violated': self.sla_violated,
            'time_until_sla': self.time_until_sla()
        }

class ChatMessage(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    message_type = db.Column(db.String(20), default='message')  # message, system, attachment
    
    # Foreign keys
    ticket_id = db.Column(db.Integer, db.ForeignKey('ticket.id'), nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    
    # Timestamps
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'content': self.content,
            'message_type': self.message_type,
            'author': self.author.username,
            'author_role': self.author.role.value,
            'created_at': self.created_at.isoformat(),
            'ticket_id': self.ticket_id
        }

class TicketAttachment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    file_size = db.Column(db.Integer)
    mime_type = db.Column(db.String(100))
    
    # Foreign keys
    ticket_id = db.Column(db.Integer, db.ForeignKey('ticket.id'), nullable=False)
    uploaded_by_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    
    # Timestamps
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    uploaded_by = db.relationship('User', backref='uploaded_attachments')
    
    def to_dict(self):
        return {
            'id': self.id,
            'filename': self.filename,
            'original_filename': self.original_filename,
            'file_size': self.file_size,
            'mime_type': self.mime_type,
            'uploaded_by': self.uploaded_by.username,
            'uploaded_at': self.uploaded_at.isoformat()
        }
