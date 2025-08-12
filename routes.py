from flask import request, jsonify, render_template, send_file, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, create_access_token
from werkzeug.security import check_password_hash
from werkzeug.utils import secure_filename
from app import app
from database import db
from models import User, Ticket, Message, Attachment
from datetime import datetime, timedelta
import os
import uuid
import csv
import io
from sqlalchemy import func, and_, or_

@app.route('/')
def index():
    return render_template('login.html')

@app.route('/dashboard')
def dashboard():
    return render_template('index.html')

@app.route('/login')
def login_page():
    return render_template('login.html')

@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        if not username or not password:
            return jsonify({'error': 'Username and password are required'}), 400
        
        user = User.query.filter_by(username=username, active=True).first()
        
        if user and check_password_hash(user.password_hash, password):
            access_token = create_access_token(identity=user.id)
            return jsonify({
                'access_token': access_token,
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'name': user.name,
                    'role': user.role,
                    'email': user.email
                }
            })
        else:
            return jsonify({'error': 'Invalid credentials'}), 401
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tickets', methods=['GET'])
@jwt_required()
def get_tickets():
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        query = Ticket.query
        
        # Filter based on user role
        if user.role == 'Colaborador':
            query = query.filter_by(creator_id=user_id)
        elif user.role == 'Técnico':
            query = query.filter(or_(Ticket.assigned_to == user_id, Ticket.assigned_to.is_(None)))
        # Admin and Diretoria can see all tickets
        
        # Apply filters from query parameters
        status = request.args.get('status')
        priority = request.args.get('priority')
        department = request.args.get('department')
        assigned_to = request.args.get('assigned_to')
        
        if status:
            query = query.filter_by(status=status)
        if priority:
            query = query.filter_by(priority=priority)
        if department:
            query = query.filter_by(department=department)
        if assigned_to:
            query = query.filter_by(assigned_to=assigned_to)
        
        tickets = query.order_by(Ticket.created_at.desc()).all()
        
        result = []
        for ticket in tickets:
            # Check SLA violation
            sla_status = 'ok'
            if ticket.status not in ['Resolvido', 'Fechado'] and ticket.sla_due:
                now = datetime.utcnow()
                time_left = ticket.sla_due - now
                if time_left.total_seconds() < 0:
                    sla_status = 'violated'
                elif time_left.total_seconds() < 3600:  # Less than 1 hour
                    sla_status = 'warning'
            
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
                'sla_status': sla_status,
                'creator': {
                    'id': ticket.creator.id,
                    'name': ticket.creator.name,
                    'email': ticket.creator.email
                },
                'assignee': {
                    'id': ticket.assignee.id,
                    'name': ticket.assignee.name,
                    'email': ticket.assignee.email
                } if ticket.assignee else None,
                'message_count': ticket.messages.count(),
                'attachment_count': ticket.attachments.count()
            })
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tickets', methods=['POST'])
@jwt_required()
def create_ticket():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
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
        
        db.session.add(ticket)
        db.session.commit()
        
        return jsonify({'message': 'Ticket created successfully', 'ticket_id': ticket.id}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/tickets/<int:ticket_id>', methods=['GET'])
@jwt_required()
def get_ticket(ticket_id):
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        ticket = Ticket.query.get(ticket_id)
        
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404
        
        # Check permissions
        if user.role == 'Colaborador' and ticket.creator_id != user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        # Check SLA status
        sla_status = 'ok'
        if ticket.status not in ['Resolvido', 'Fechado'] and ticket.sla_due:
            now = datetime.utcnow()
            time_left = ticket.sla_due - now
            if time_left.total_seconds() < 0:
                sla_status = 'violated'
            elif time_left.total_seconds() < 3600:
                sla_status = 'warning'
        
        return jsonify({
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
            'sla_status': sla_status,
            'creator': {
                'id': ticket.creator.id,
                'name': ticket.creator.name,
                'email': ticket.creator.email
            },
            'assignee': {
                'id': ticket.assignee.id,
                'name': ticket.assignee.name,
                'email': ticket.assignee.email
            } if ticket.assignee else None
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tickets/<int:ticket_id>', methods=['PUT'])
@jwt_required()
def update_ticket(ticket_id):
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        ticket = Ticket.query.get(ticket_id)
        
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404
        
        # Check permissions
        if user.role == 'Colaborador' and ticket.creator_id != user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        
        # Update allowed fields based on user role
        if user.role in ['Administrador', 'Técnico']:
            if 'status' in data:
                old_status = ticket.status
                ticket.status = data['status']
                
                # Create system message for status change
                if old_status != ticket.status:
                    message = Message(
                        content=f"Status alterado de '{old_status}' para '{ticket.status}'",
                        ticket_id=ticket.id,
                        user_id=user_id,
                        message_type='system'
                    )
                    db.session.add(message)
            
            if 'assigned_to' in data:
                ticket.assigned_to = data['assigned_to'] if data['assigned_to'] else None
                
                # Create system message for assignment
                if ticket.assigned_to:
                    assignee = User.query.get(ticket.assigned_to)
                    message = Message(
                        content=f"Chamado atribuído para {assignee.name}",
                        ticket_id=ticket.id,
                        user_id=user_id,
                        message_type='system'
                    )
                    db.session.add(message)
        
        if 'observations' in data:
            ticket.observations = data['observations']
        
        if user.role == 'Administrador':
            # Admin can update more fields
            if 'title' in data:
                ticket.title = data['title']
            if 'description' in data:
                ticket.description = data['description']
            if 'priority' in data:
                ticket.priority = data['priority']
            if 'department' in data:
                ticket.department = data['department']
        
        db.session.commit()
        
        return jsonify({'message': 'Ticket updated successfully'})
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/tickets/<int:ticket_id>/messages', methods=['GET'])
@jwt_required()
def get_ticket_messages(ticket_id):
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        ticket = Ticket.query.get(ticket_id)
        
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404
        
        # Check permissions
        if user.role == 'Colaborador' and ticket.creator_id != user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        messages = Message.query.filter_by(ticket_id=ticket_id).order_by(Message.timestamp.asc()).all()
        
        result = []
        for message in messages:
            result.append({
                'id': message.id,
                'content': message.content,
                'timestamp': message.timestamp.isoformat(),
                'message_type': message.message_type,
                'author': {
                    'id': message.author.id,
                    'name': message.author.name,
                    'role': message.author.role
                }
            })
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tickets/<int:ticket_id>/messages', methods=['POST'])
@jwt_required()
def create_message(ticket_id):
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        ticket = Ticket.query.get(ticket_id)
        
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404
        
        # Check permissions
        if user.role == 'Colaborador' and ticket.creator_id != user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        content = data.get('content')
        
        if not content:
            return jsonify({'error': 'Message content is required'}), 400
        
        message = Message(
            content=content,
            ticket_id=ticket_id,
            user_id=user_id,
            message_type='message'
        )
        
        db.session.add(message)
        db.session.commit()
        
        return jsonify({
            'id': message.id,
            'content': message.content,
            'timestamp': message.timestamp.isoformat(),
            'message_type': message.message_type,
            'author': {
                'id': message.author.id,
                'name': message.author.name,
                'role': message.author.role
            }
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/users', methods=['GET'])
@jwt_required()
def get_users():
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if user.role not in ['Administrador', 'Diretoria']:
            return jsonify({'error': 'Access denied'}), 403
        
        users = User.query.filter_by(active=True).all()
        
        result = []
        for u in users:
            result.append({
                'id': u.id,
                'username': u.username,
                'name': u.name,
                'email': u.email,
                'role': u.role,
                'created_at': u.created_at.isoformat()
            })
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/dashboard/stats', methods=['GET'])
@jwt_required()
def get_dashboard_stats():
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if user.role not in ['Administrador', 'Diretoria', 'Técnico']:
            return jsonify({'error': 'Access denied'}), 403
        
        # Basic stats
        total_tickets = Ticket.query.count()
        open_tickets = Ticket.query.filter(Ticket.status.in_(['Aberto', 'Em Andamento'])).count()
        resolved_tickets = Ticket.query.filter_by(status='Resolvido').count()
        closed_tickets = Ticket.query.filter_by(status='Fechado').count()
        
        # SLA stats
        now = datetime.utcnow()
        sla_violated = Ticket.query.filter(
            and_(
                Ticket.status.in_(['Aberto', 'Em Andamento']),
                Ticket.sla_due < now
            )
        ).count()
        
        sla_warning = Ticket.query.filter(
            and_(
                Ticket.status.in_(['Aberto', 'Em Andamento']),
                Ticket.sla_due > now,
                Ticket.sla_due < now + timedelta(hours=1)
            )
        ).count()
        
        # Priority breakdown
        priority_stats = db.session.query(
            Ticket.priority,
            func.count(Ticket.id).label('count')
        ).group_by(Ticket.priority).all()
        
        # Status breakdown
        status_stats = db.session.query(
            Ticket.status,
            func.count(Ticket.id).label('count')
        ).group_by(Ticket.status).all()
        
        # Department breakdown
        department_stats = db.session.query(
            Ticket.department,
            func.count(Ticket.id).label('count')
        ).group_by(Ticket.department).all()
        
        # Recent activity (last 7 days)
        week_ago = now - timedelta(days=7)
        recent_tickets = db.session.query(
            func.date(Ticket.created_at).label('date'),
            func.count(Ticket.id).label('count')
        ).filter(Ticket.created_at >= week_ago).group_by(func.date(Ticket.created_at)).all()
        
        return jsonify({
            'total_tickets': total_tickets,
            'open_tickets': open_tickets,
            'resolved_tickets': resolved_tickets,
            'closed_tickets': closed_tickets,
            'sla_violated': sla_violated,
            'sla_warning': sla_warning,
            'priority_breakdown': [{'priority': p[0], 'count': p[1]} for p in priority_stats],
            'status_breakdown': [{'status': s[0], 'count': s[1]} for s in status_stats],
            'department_breakdown': [{'department': d[0], 'count': d[1]} for d in department_stats],
            'recent_activity': [{'date': str(r[0]), 'count': r[1]} for r in recent_tickets]
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/reports/export', methods=['GET'])
@jwt_required()
def export_reports():
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if user.role not in ['Administrador', 'Diretoria']:
            return jsonify({'error': 'Access denied'}), 403
        
        # Get filters from query parameters
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        status = request.args.get('status')
        priority = request.args.get('priority')
        department = request.args.get('department')
        
        query = Ticket.query
        
        if start_date:
            query = query.filter(Ticket.created_at >= datetime.fromisoformat(start_date))
        if end_date:
            query = query.filter(Ticket.created_at <= datetime.fromisoformat(end_date))
        if status:
            query = query.filter_by(status=status)
        if priority:
            query = query.filter_by(priority=priority)
        if department:
            query = query.filter_by(department=department)
        
        tickets = query.order_by(Ticket.created_at.desc()).all()
        
        # Create CSV
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            'ID', 'Título', 'Descrição', 'Departamento', 'Prioridade', 'Status',
            'Criado por', 'Atribuído para', 'Data de Criação', 'Data de Atualização',
            'SLA Vencimento', 'SLA Violado'
        ])
        
        # Write data
        for ticket in tickets:
            writer.writerow([
                ticket.id,
                ticket.title,
                ticket.description,
                ticket.department,
                ticket.priority,
                ticket.status,
                ticket.creator.name,
                ticket.assignee.name if ticket.assignee else '',
                ticket.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                ticket.updated_at.strftime('%Y-%m-%d %H:%M:%S'),
                ticket.sla_due.strftime('%Y-%m-%d %H:%M:%S') if ticket.sla_due else '',
                'Sim' if ticket.sla_violated else 'Não'
            ])
        
        # Prepare file for download
        output.seek(0)
        
        # Create a bytes buffer
        buffer = io.BytesIO()
        buffer.write(output.getvalue().encode('utf-8'))
        buffer.seek(0)
        
        return send_file(
            buffer,
            as_attachment=True,
            download_name=f'tickets_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.csv',
            mimetype='text/csv'
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tickets/<int:ticket_id>/upload', methods=['POST'])
@jwt_required()
def upload_file(ticket_id):
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        ticket = Ticket.query.get(ticket_id)
        
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404
        
        # Check permissions
        if user.role == 'Colaborador' and ticket.creator_id != user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if file:
            # Generate unique filename
            filename = str(uuid.uuid4()) + '_' + secure_filename(file.filename)
            file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], filename)
            
            # Save file
            file.save(file_path)
            
            # Create attachment record
            attachment = Attachment(
                filename=filename,
                original_filename=file.filename,
                file_size=os.path.getsize(file_path),
                mime_type=file.content_type or 'application/octet-stream',
                ticket_id=ticket_id,
                uploaded_by=user_id
            )
            
            db.session.add(attachment)
            db.session.commit()
            
            return jsonify({
                'message': 'File uploaded successfully',
                'attachment_id': attachment.id,
                'filename': attachment.original_filename
            }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/attachments/<int:attachment_id>/download')
@jwt_required()
def download_file(attachment_id):
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        attachment = Attachment.query.get(attachment_id)
        
        if not attachment:
            return jsonify({'error': 'Attachment not found'}), 404
        
        # Check permissions
        ticket = attachment.ticket
        if user.role == 'Colaborador' and ticket.creator_id != user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        file_path = os.path.join(current_app.config['UPLOAD_FOLDER'], attachment.filename)
        
        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found on disk'}), 404
        
        return send_file(
            file_path,
            as_attachment=True,
            download_name=attachment.original_filename,
            mimetype=attachment.mime_type
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tickets/<int:ticket_id>/attachments', methods=['GET'])
@jwt_required()
def get_ticket_attachments(ticket_id):
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        ticket = Ticket.query.get(ticket_id)
        
        if not ticket:
            return jsonify({'error': 'Ticket not found'}), 404
        
        # Check permissions
        if user.role == 'Colaborador' and ticket.creator_id != user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        attachments = Attachment.query.filter_by(ticket_id=ticket_id).all()
        
        result = []
        for attachment in attachments:
            result.append({
                'id': attachment.id,
                'filename': attachment.original_filename,
                'file_size': attachment.file_size,
                'mime_type': attachment.mime_type,
                'uploaded_at': attachment.uploaded_at.isoformat(),
                'uploader': {
                    'id': attachment.uploader.id,
                    'name': attachment.uploader.name
                }
            })
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
