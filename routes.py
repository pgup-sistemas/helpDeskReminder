
import os
import csv
from datetime import datetime
from flask import render_template, request, jsonify, send_file, redirect, url_for, session, flash
from flask_login import login_user, logout_user, login_required, current_user
from werkzeug.utils import secure_filename
from io import StringIO, BytesIO

from app import app, db, socketio
from models import User, Ticket, ChatMessage, TicketAttachment, UserRole, TicketStatus, TicketPriority
from auth import role_required, can_access_ticket, can_modify_ticket
from utils import allowed_file, get_dashboard_stats

# Frontend routes
@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login_page'))

@app.route('/login')
def login_page():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    return render_template('login.html')

@app.route('/login', methods=['POST'])
def login():
    username = request.form.get('username')
    password = request.form.get('password')
    
    if not username or not password:
        flash('Username e senha são obrigatórios', 'error')
        return redirect(url_for('login_page'))
    
    user = User.query.filter_by(username=username).first()
    
    if user and user.check_password(password) and user.is_active:
        login_user(user, remember=True)
        next_page = request.args.get('next')
        return redirect(next_page) if next_page else redirect(url_for('dashboard'))
    
    flash('Credenciais inválidas', 'error')
    return redirect(url_for('login_page'))

@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('Logout realizado com sucesso', 'success')
    return redirect(url_for('login_page'))

@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html')

@app.route('/tickets')
@login_required
def tickets():
    return render_template('tickets.html')

@app.route('/ticket/<int:ticket_id>')
@login_required
def ticket_detail(ticket_id):
    ticket = Ticket.query.get_or_404(ticket_id)
    if not can_access_ticket(current_user, ticket):
        flash('Acesso negado', 'error')
        return redirect(url_for('tickets'))
    return render_template('ticket_detail.html', ticket_id=ticket_id)

@app.route('/users')
@role_required(UserRole.ADMINISTRADOR)
def users():
    return render_template('users.html')

@app.route('/reports')
@role_required(UserRole.ADMINISTRADOR, UserRole.DIRETORIA)
def reports():
    return render_template('reports.html')

# API routes
@app.route('/api/me', methods=['GET'])
@login_required
def get_current_user_info():
    return jsonify(current_user.to_dict())

@app.route('/api/dashboard/stats', methods=['GET'])
@role_required(UserRole.ADMINISTRADOR, UserRole.DIRETORIA, UserRole.TECNICO)
def dashboard_stats():
    stats = get_dashboard_stats()
    return jsonify(stats)

@app.route('/api/tickets', methods=['GET'])
@login_required
def get_tickets():
    query = Ticket.query
    
    # Filter based on user role
    if current_user.role == UserRole.COLABORADOR:
        query = query.filter_by(requester_id=current_user.id)
    
    # Apply filters
    status = request.args.get('status')
    priority = request.args.get('priority')
    department = request.args.get('department')
    assigned_to = request.args.get('assigned_to')
    
    if status:
        query = query.filter_by(status=TicketStatus(status))
    if priority:
        query = query.filter_by(priority=TicketPriority(priority))
    if department:
        query = query.filter_by(department=department)
    if assigned_to:
        query = query.filter_by(assigned_to_id=int(assigned_to))
    
    tickets = query.order_by(Ticket.created_at.desc()).all()
    
    # Check SLA violations
    for ticket in tickets:
        ticket.check_sla_violation()
    
    return jsonify([ticket.to_dict() for ticket in tickets])

@app.route('/api/tickets', methods=['POST'])
@login_required
def create_ticket():
    data = request.get_json()
    
    required_fields = ['title', 'description', 'department', 'priority']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'message': f'{field} is required'}), 400
    
    ticket = Ticket(
        title=data['title'],
        description=data['description'],
        department=data['department'],
        priority=TicketPriority(data['priority']),
        observations=data.get('observations', ''),
        requester_id=current_user.id
    )
    
    db.session.add(ticket)
    db.session.commit()
    
    # Create system message
    system_message = ChatMessage(
        content=f"Chamado criado por {current_user.username}",
        message_type='system',
        ticket_id=ticket.id,
        author_id=current_user.id
    )
    db.session.add(system_message)
    db.session.commit()
    
    return jsonify(ticket.to_dict()), 201

@app.route('/api/tickets/<int:ticket_id>', methods=['GET'])
@login_required
def get_ticket(ticket_id):
    ticket = Ticket.query.get_or_404(ticket_id)
    
    if not can_access_ticket(current_user, ticket):
        return jsonify({'message': 'Access denied'}), 403
    
    ticket.check_sla_violation()
    return jsonify(ticket.to_dict())

@app.route('/api/tickets/<int:ticket_id>', methods=['PUT'])
@login_required
def update_ticket(ticket_id):
    ticket = Ticket.query.get_or_404(ticket_id)
    
    if not can_modify_ticket(current_user, ticket):
        return jsonify({'message': 'Access denied'}), 403
    
    data = request.get_json()
    
    # Track changes for system messages
    changes = []
    
    if 'status' in data and data['status'] != ticket.status.value:
        old_status = ticket.status.value
        ticket.status = TicketStatus(data['status'])
        changes.append(f"Status alterado de {old_status} para {data['status']}")
        
        if ticket.status == TicketStatus.RESOLVIDO:
            ticket.resolved_at = datetime.utcnow()
        elif ticket.status == TicketStatus.FECHADO:
            ticket.closed_at = datetime.utcnow()
    
    if 'assigned_to_id' in data:
        old_assigned = ticket.assigned_technician.username if ticket.assigned_technician else "Nenhum"
        if data['assigned_to_id']:
            new_tech = User.query.get(data['assigned_to_id'])
            ticket.assigned_to_id = data['assigned_to_id']
            changes.append(f"Técnico alterado de {old_assigned} para {new_tech.username}")
        else:
            ticket.assigned_to_id = None
            changes.append(f"Técnico removido ({old_assigned})")
    
    if 'priority' in data and data['priority'] != ticket.priority.value:
        old_priority = ticket.priority.value
        ticket.priority = TicketPriority(data['priority'])
        ticket.set_sla_deadline()  # Recalculate SLA
        changes.append(f"Prioridade alterada de {old_priority} para {data['priority']}")
    
    if 'observations' in data:
        ticket.observations = data['observations']
    
    ticket.updated_at = datetime.utcnow()
    db.session.commit()
    
    # Create system messages for changes
    for change in changes:
        system_message = ChatMessage(
            content=f"{change} por {current_user.username}",
            message_type='system',
            ticket_id=ticket.id,
            author_id=current_user.id
        )
        db.session.add(system_message)
    
    db.session.commit()
    
    return jsonify(ticket.to_dict())

@app.route('/api/tickets/<int:ticket_id>/messages', methods=['GET'])
@login_required
def get_ticket_messages(ticket_id):
    ticket = Ticket.query.get_or_404(ticket_id)
    
    if not can_access_ticket(current_user, ticket):
        return jsonify({'message': 'Access denied'}), 403
    
    messages = ChatMessage.query.filter_by(ticket_id=ticket_id).order_by(ChatMessage.created_at).all()
    return jsonify([message.to_dict() for message in messages])

@app.route('/api/tickets/<int:ticket_id>/messages', methods=['POST'])
@login_required
def create_message(ticket_id):
    ticket = Ticket.query.get_or_404(ticket_id)
    
    if not can_access_ticket(current_user, ticket):
        return jsonify({'message': 'Access denied'}), 403
    
    data = request.get_json()
    content = data.get('content')
    
    if not content:
        return jsonify({'message': 'Message content required'}), 400
    
    message = ChatMessage(
        content=content,
        ticket_id=ticket_id,
        author_id=current_user.id
    )
    
    db.session.add(message)
    db.session.commit()
    
    # Emit to socket room
    socketio.emit('new_message', message.to_dict(), room=f'ticket_{ticket_id}')
    
    return jsonify(message.to_dict()), 201

@app.route('/api/tickets/<int:ticket_id>/attachments', methods=['POST'])
@login_required
def upload_attachment(ticket_id):
    ticket = Ticket.query.get_or_404(ticket_id)
    
    if not can_access_ticket(current_user, ticket):
        return jsonify({'message': 'Access denied'}), 403
    
    if 'file' not in request.files:
        return jsonify({'message': 'No file provided'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'message': 'No file selected'}), 400
    
    if not allowed_file(file.filename):
        return jsonify({'message': 'File type not allowed'}), 400
    
    original_filename = secure_filename(file.filename)
    filename = f"{ticket_id}_{datetime.utcnow().timestamp()}_{original_filename}"
    
    # Ensure upload directory exists
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(file_path)
    
    # Get file info
    file_size = os.path.getsize(file_path)
    
    attachment = TicketAttachment(
        filename=filename,
        original_filename=original_filename,
        file_size=file_size,
        mime_type=file.mimetype,
        ticket_id=ticket_id,
        uploaded_by_id=current_user.id
    )
    
    db.session.add(attachment)
    db.session.commit()
    
    # Create system message
    system_message = ChatMessage(
        content=f"Arquivo anexado: {original_filename}",
        message_type='attachment',
        ticket_id=ticket_id,
        author_id=current_user.id
    )
    db.session.add(system_message)
    db.session.commit()
    
    return jsonify(attachment.to_dict()), 201

@app.route('/api/tickets/<int:ticket_id>/attachments', methods=['GET'])
@login_required
def get_attachments(ticket_id):
    ticket = Ticket.query.get_or_404(ticket_id)
    
    if not can_access_ticket(current_user, ticket):
        return jsonify({'message': 'Access denied'}), 403
    
    attachments = TicketAttachment.query.filter_by(ticket_id=ticket_id).all()
    return jsonify([attachment.to_dict() for attachment in attachments])

@app.route('/api/attachments/<int:attachment_id>/download', methods=['GET'])
@login_required
def download_attachment(attachment_id):
    attachment = TicketAttachment.query.get_or_404(attachment_id)
    
    if not can_access_ticket(current_user, attachment.ticket):
        return jsonify({'message': 'Access denied'}), 403
    
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], attachment.filename)
    
    if not os.path.exists(file_path):
        return jsonify({'message': 'File not found'}), 404
    
    return send_file(file_path, as_attachment=True, download_name=attachment.original_filename)

@app.route('/api/users', methods=['GET'])
@role_required(UserRole.ADMINISTRADOR)
def get_users():
    users = User.query.all()
    return jsonify([user.to_dict() for user in users])

@app.route('/api/users', methods=['POST'])
@role_required(UserRole.ADMINISTRADOR)
def create_user():
    data = request.get_json()
    
    required_fields = ['username', 'email', 'password', 'role']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'message': f'{field} is required'}), 400
    
    # Check if user already exists
    if User.query.filter_by(username=data['username']).first():
        return jsonify({'message': 'Username already exists'}), 400
    
    if User.query.filter_by(email=data['email']).first():
        return jsonify({'message': 'Email already exists'}), 400
    
    user = User(
        username=data['username'],
        email=data['email'],
        role=UserRole(data['role']),
        department=data.get('department', '')
    )
    user.set_password(data['password'])
    
    db.session.add(user)
    db.session.commit()
    
    return jsonify(user.to_dict()), 201

@app.route('/api/users/<int:user_id>', methods=['PUT'])
@role_required(UserRole.ADMINISTRADOR)
def update_user(user_id):
    user = User.query.get_or_404(user_id)
    data = request.get_json()
    
    if 'username' in data:
        existing_user = User.query.filter_by(username=data['username']).first()
        if existing_user and existing_user.id != user_id:
            return jsonify({'message': 'Username already exists'}), 400
        user.username = data['username']
    
    if 'email' in data:
        existing_user = User.query.filter_by(email=data['email']).first()
        if existing_user and existing_user.id != user_id:
            return jsonify({'message': 'Email already exists'}), 400
        user.email = data['email']
    
    if 'role' in data:
        user.role = UserRole(data['role'])
    
    if 'department' in data:
        user.department = data['department']
    
    if 'is_active' in data:
        user.is_active = data['is_active']
    
    if 'password' in data and data['password']:
        user.set_password(data['password'])
    
    db.session.commit()
    
    return jsonify(user.to_dict())

@app.route('/api/technicians', methods=['GET'])
@login_required
def get_technicians():
    technicians = User.query.filter_by(role=UserRole.TECNICO, is_active=True).all()
    return jsonify([{'id': tech.id, 'username': tech.username} for tech in technicians])

@app.route('/api/reports/export', methods=['GET'])
@role_required(UserRole.ADMINISTRADOR, UserRole.DIRETORIA)
def export_tickets():
    # Get filter parameters
    status = request.args.get('status')
    priority = request.args.get('priority')
    department = request.args.get('department')
    date_from = request.args.get('date_from')
    date_to = request.args.get('date_to')
    
    query = Ticket.query
    
    # Apply filters
    if status:
        query = query.filter_by(status=TicketStatus(status))
    if priority:
        query = query.filter_by(priority=TicketPriority(priority))
    if department:
        query = query.filter_by(department=department)
    if date_from:
        query = query.filter(Ticket.created_at >= datetime.fromisoformat(date_from))
    if date_to:
        query = query.filter(Ticket.created_at <= datetime.fromisoformat(date_to))
    
    tickets = query.order_by(Ticket.created_at.desc()).all()
    
    # Create CSV
    output = StringIO()
    writer = csv.writer(output)
    
    # Write header
    writer.writerow([
        'ID', 'Título', 'Descrição', 'Status', 'Prioridade', 'Departamento',
        'Solicitante', 'Técnico Responsável', 'Data Criação', 'Data Resolução',
        'SLA Violado', 'Observações'
    ])
    
    # Write data
    for ticket in tickets:
        writer.writerow([
            ticket.id,
            ticket.title,
            ticket.description,
            ticket.status.value,
            ticket.priority.value,
            ticket.department,
            ticket.requester.username if ticket.requester else '',
            ticket.assigned_technician.username if ticket.assigned_technician else '',
            ticket.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            ticket.resolved_at.strftime('%Y-%m-%d %H:%M:%S') if ticket.resolved_at else '',
            'Sim' if ticket.sla_violated else 'Não',
            ticket.observations or ''
        ])
    
    # Create BytesIO object for file download
    mem = BytesIO()
    mem.write(output.getvalue().encode('utf-8'))
    mem.seek(0)
    
    return send_file(
        mem,
        mimetype='text/csv',
        as_attachment=True,
        download_name=f'chamados_export_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv'
    )
