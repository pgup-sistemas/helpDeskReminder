from datetime import datetime, timedelta
from models import Ticket
import os

def get_sla_hours(priority):
    """Get SLA hours based on priority"""
    sla_map = {
        'Alta': 4,
        'Média': 8,
        'Baixa': 24
    }
    return sla_map.get(priority, 24)

def calculate_sla_status(ticket):
    """Calculate SLA status for a ticket"""
    if ticket.status in ['Resolvido', 'Fechado']:
        return 'completed'
    
    if not ticket.sla_due:
        return 'ok'
    
    now = datetime.utcnow()
    time_left = ticket.sla_due - now
    
    if time_left.total_seconds() < 0:
        return 'violated'
    elif time_left.total_seconds() < 3600:  # Less than 1 hour
        return 'warning'
    else:
        return 'ok'

def format_time_remaining(sla_due):
    """Format time remaining until SLA violation"""
    if not sla_due:
        return None
    
    now = datetime.utcnow()
    time_left = sla_due - now
    
    if time_left.total_seconds() < 0:
        return "Vencido"
    
    days = time_left.days
    hours, remainder = divmod(time_left.seconds, 3600)
    minutes, _ = divmod(remainder, 60)
    
    if days > 0:
        return f"{days}d {hours}h {minutes}m"
    elif hours > 0:
        return f"{hours}h {minutes}m"
    else:
        return f"{minutes}m"

def allowed_file(filename):
    """Check if file extension is allowed"""
    ALLOWED_EXTENSIONS = {
        'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 
        'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'rar', '7z'
    }
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_file_size_mb(file_path):
    """Get file size in MB"""
    if os.path.exists(file_path):
        size_bytes = os.path.getsize(file_path)
        return round(size_bytes / (1024 * 1024), 2)
    return 0

def get_priority_color(priority):
    """Get color class for priority"""
    color_map = {
        'Alta': 'text-red-600 bg-red-50',
        'Média': 'text-yellow-600 bg-yellow-50',
        'Baixa': 'text-green-600 bg-green-50'
    }
    return color_map.get(priority, 'text-gray-600 bg-gray-50')

def get_status_color(status):
    """Get color class for status"""
    color_map = {
        'Aberto': 'text-blue-600 bg-blue-50',
        'Em Andamento': 'text-yellow-600 bg-yellow-50',
        'Resolvido': 'text-green-600 bg-green-50',
        'Fechado': 'text-gray-600 bg-gray-50'
    }
    return color_map.get(status, 'text-gray-600 bg-gray-50')

def get_sla_color(sla_status):
    """Get color class for SLA status"""
    color_map = {
        'ok': 'text-green-600 bg-green-50',
        'warning': 'text-yellow-600 bg-yellow-50',
        'violated': 'text-red-600 bg-red-50',
        'completed': 'text-gray-600 bg-gray-50'
    }
    return color_map.get(sla_status, 'text-gray-600 bg-gray-50')
