
import os
import logging
from flask import Flask, jsonify
from flask_sqlalchemy import SQLAlchemy
# JWT removed - using Flask-Login only
from flask_socketio import SocketIO
from flask_cors import CORS
from flask_login import LoginManager
from sqlalchemy.orm import DeclarativeBase
from werkzeug.middleware.proxy_fix import ProxyFix

# Configure logging
logging.basicConfig(level=logging.DEBUG)

class Base(DeclarativeBase):
    pass

db = SQLAlchemy(model_class=Base)
socketio = SocketIO(cors_allowed_origins="*")
login_manager = LoginManager()

# Create the app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key-change-in-production")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# Configure CORS
CORS(app)

# JWT configuration removed - using Flask-Login only

# Configure Flask-Login
login_manager.init_app(app)
login_manager.login_view = 'login_page'
login_manager.login_message = 'Por favor, faça login para acessar esta página.'
login_manager.login_message_category = 'info'

# Configure the database
database_url = os.environ.get("DATABASE_URL")
if not database_url:
    database_url = "sqlite:///helpdesk.db"

app.config["SQLALCHEMY_DATABASE_URI"] = database_url
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}

# Configure upload folder
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Initialize extensions
db.init_app(app)
socketio.init_app(app)

@login_manager.user_loader
def load_user(user_id):
    from models import User
    return User.query.get(int(user_id))

# Using Flask-Login for session management

# Import routes and socket handlers
from routes import *
from socketio_handlers import *

with app.app_context():
    # Import models to ensure tables are created
    import models
    db.create_all()
    
    # Create demo users if they don't exist
    from utils import create_demo_users
    create_demo_users()
