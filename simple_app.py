import os
import logging
from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
from werkzeug.middleware.proxy_fix import ProxyFix
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
from sqlalchemy import event

# Configure logging
logging.basicConfig(level=logging.DEBUG)

class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)

# Create the app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key-change-in-production")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# Configure database
database_url = os.environ.get("DATABASE_URL", "sqlite:///helpdesk.db")
app.config["SQLALCHEMY_DATABASE_URI"] = database_url
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Initialize extensions
db.init_app(app)

# Models
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    active = db.Column(db.Boolean, default=True)

class Ticket(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    department = db.Column(db.String(100), nullable=False)
    priority = db.Column(db.String(10), nullable=False)
    status = db.Column(db.String(20), default='Aberto')
    observations = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    resolved_at = db.Column(db.DateTime)
    closed_at = db.Column(db.DateTime)
    sla_due = db.Column(db.DateTime)
    sla_violated = db.Column(db.Boolean, default=False)
    creator_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    assigned_to = db.Column(db.Integer, db.ForeignKey('user.id'))

# Routes
@app.route('/')
def index():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    # Get dashboard stats
    stats = {
        'total_tickets': Ticket.query.count(),
        'open_tickets': Ticket.query.filter(Ticket.status.in_(['Aberto', 'Em Andamento'])).count(),
        'resolved_tickets': Ticket.query.filter_by(status='Resolvido').count(),
        'closed_tickets': Ticket.query.filter_by(status='Fechado').count()
    }
    
    # Get recent tickets for current user
    user_role = session.get('user_role')
    user_id = session.get('user_id')
    
    if user_role == 'Colaborador':
        recent_tickets = Ticket.query.filter_by(creator_id=user_id).order_by(Ticket.created_at.desc()).limit(5).all()
    else:
        recent_tickets = Ticket.query.order_by(Ticket.created_at.desc()).limit(5).all()
    
    return render_template('simple_dashboard.html', stats=stats, recent_tickets=recent_tickets)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        if not username or not password:
            return render_template('simple_login.html', error='Por favor, preencha todos os campos.')
        
        user = User.query.filter_by(username=username, active=True).first()
        
        if user and check_password_hash(user.password_hash, password):
            session['user_id'] = user.id
            session['user_name'] = user.name
            session['user_role'] = user.role
            session['username'] = user.username
            return redirect(url_for('index'))
        else:
            return render_template('simple_login.html', error='Credenciais inválidas.')
    
    return render_template('simple_login.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/dashboard')
def dashboard():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return redirect(url_for('index'))

@app.route('/tickets')
def tickets():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return render_template('tickets.html')

@app.route('/users')
def users():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    if session.get('user_role') not in ['Administrador', 'Diretoria']:
        return redirect(url_for('index'))
    return render_template('users.html')

@app.route('/reports')
def reports():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    if session.get('user_role') not in ['Administrador', 'Diretoria']:
        return redirect(url_for('index'))
    return render_template('reports.html')

# API Routes
@app.route('/api/dashboard/stats')
def get_dashboard_stats():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    user_role = session.get('user_role')
    if user_role not in ['Administrador', 'Diretoria', 'Técnico']:
        return jsonify({'error': 'Access denied'}), 403
    
    # Basic stats
    total_tickets = Ticket.query.count()
    open_tickets = Ticket.query.filter(Ticket.status.in_(['Aberto', 'Em Andamento'])).count()
    resolved_tickets = Ticket.query.filter_by(status='Resolvido').count()
    closed_tickets = Ticket.query.filter_by(status='Fechado').count()
    
    return jsonify({
        'total_tickets': total_tickets,
        'open_tickets': open_tickets,
        'resolved_tickets': resolved_tickets,
        'closed_tickets': closed_tickets,
        'sla_violated': 0,
        'sla_warning': 0,
        'priority_breakdown': [
            {'priority': 'Alta', 'count': 0},
            {'priority': 'Média', 'count': 0},
            {'priority': 'Baixa', 'count': 0}
        ],
        'status_breakdown': [
            {'status': 'Aberto', 'count': open_tickets},
            {'status': 'Resolvido', 'count': resolved_tickets},
            {'status': 'Fechado', 'count': closed_tickets}
        ],
        'department_breakdown': [
            {'department': 'TI', 'count': total_tickets}
        ],
        'recent_activity': []
    })

@app.route('/api/tickets')
def get_tickets():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    user_id = session.get('user_id')
    user_role = session.get('user_role')
    
    query = Ticket.query
    
    # Filter based on user role
    if user_role == 'Colaborador':
        query = query.filter_by(creator_id=user_id)
    
    tickets = query.order_by(Ticket.created_at.desc()).all()
    
    result = []
    for ticket in tickets:
        creator = User.query.get(ticket.creator_id)
        assignee = User.query.get(ticket.assigned_to) if ticket.assigned_to else None
        
        result.append({
            'id': ticket.id,
            'title': ticket.title,
            'description': ticket.description,
            'department': ticket.department,
            'priority': ticket.priority,
            'status': ticket.status,
            'observations': ticket.observations,
            'created_at': ticket.created_at.isoformat(),
            'updated_at': ticket.updated_at.isoformat(),
            'sla_due': ticket.sla_due.isoformat() if ticket.sla_due else None,
            'sla_status': 'ok',
            'creator': {
                'id': creator.id,
                'name': creator.name,
                'email': creator.email
            } if creator else None,
            'assignee': {
                'id': assignee.id,
                'name': assignee.name,
                'email': assignee.email
            } if assignee else None,
            'message_count': 0,
            'attachment_count': 0
        })
    
    return jsonify(result)

@app.route('/api/tickets', methods=['POST'])
def create_ticket():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    data = request.get_json()
    user_id = session.get('user_id')
    
    required_fields = ['title', 'description', 'department', 'priority']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'error': f'{field} is required'}), 400
    
    ticket = Ticket(
        title=data['title'],
        description=data['description'],
        department=data['department'],
        priority=data['priority'],
        observations=data.get('observations', ''),
        creator_id=user_id
    )
    
    # Calculate SLA
    if ticket.priority == 'Alta':
        ticket.sla_due = ticket.created_at + timedelta(hours=4)
    elif ticket.priority == 'Média':
        ticket.sla_due = ticket.created_at + timedelta(hours=8)
    else:
        ticket.sla_due = ticket.created_at + timedelta(hours=24)
    
    db.session.add(ticket)
    db.session.commit()
    
    return jsonify({'message': 'Ticket created successfully', 'ticket_id': ticket.id}), 201

with app.app_context():
    # Drop and recreate all tables
    db.drop_all()
    db.create_all()
    
    # Create demo users
    demo_users = [
        {"username": "admin", "password": "admin123", "role": "Administrador", "email": "admin@company.com", "name": "Administrador Sistema"},
        {"username": "tecnico1", "password": "tecnico123", "role": "Técnico", "email": "tecnico1@company.com", "name": "João Silva"},
        {"username": "colaborador1", "password": "colab123", "role": "Colaborador", "email": "colaborador1@company.com", "name": "Maria Santos"},
        {"username": "diretor", "password": "diretor123", "role": "Diretoria", "email": "diretor@company.com", "name": "Carlos Diretor"}
    ]
    
    for user_data in demo_users:
        user = User(
            username=user_data["username"],
            password_hash=generate_password_hash(user_data["password"]),
            role=user_data["role"],
            email=user_data["email"],
            name=user_data["name"]
        )
        db.session.add(user)
    
    db.session.commit()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)