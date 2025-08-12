import os
import logging
from flask import Flask
from werkzeug.middleware.proxy_fix import ProxyFix
from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO
from flask_cors import CORS
from database import db
from simple_app import app as simple_app, User as SimpleUser, Ticket as SimpleTicket

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Create the app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "dev-secret-key-change-in-production")
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)

# Configure CORS
CORS(app, origins="*", supports_credentials=True)

# Configure JWT
app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "jwt-secret-string")
app.config["JWT_ACCESS_TOKEN_EXPIRES"] = False  # Token doesn't expire for demo
jwt = JWTManager(app)

# Configure database
database_url = os.environ.get("DATABASE_URL", "sqlite:///helpdesk.db")
app.config["SQLALCHEMY_DATABASE_URI"] = database_url
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 300,
    "pool_pre_ping": True,
}
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Configure file uploads
app.config["UPLOAD_FOLDER"] = "uploads"
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024  # 16MB max file size

# Initialize extensions
db.init_app(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Ensure upload directory exists
os.makedirs(app.config["UPLOAD_FOLDER"], exist_ok=True)

with app.app_context():
    # Import models to ensure tables are created
    from models import User, Ticket, Message, Attachment
    import routes
    import auth
    import socketio_events
    
    # Force recreate all tables to ensure correct schema
    db.drop_all()
    db.create_all()
    
    # Create demo users
    from models import User
    from werkzeug.security import generate_password_hash
    
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
    socketio.run(app, host="0.0.0.0", port=5000, debug=True, use_reloader=False, log_output=True)
