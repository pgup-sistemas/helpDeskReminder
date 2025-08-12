

from simple_app import app, init_database, db, User
from werkzeug.security import generate_password_hash
import os

if __name__ == "__main__":
    # Remove DATABASE_URL to force SQLite usage
    if 'DATABASE_URL' in os.environ:
        del os.environ['DATABASE_URL']
        print("Removed DATABASE_URL, using SQLite")
    
    with app.app_context():
        try:
            # Initialize database when running directly
            init_database()
        except Exception as e:
            print(f"Initial database setup failed: {e}")
            # Force create tables and basic user
            try:
                db.create_all()
                
                # Create admin user if none exists
                if not User.query.first():
                    admin_user = User(
                        username='admin',
                        password_hash=generate_password_hash('admin123'),
                        role='Administrador',
                        email='admin@company.com',
                        name='Administrador Sistema'
                    )
                    db.session.add(admin_user)
                    db.session.commit()
                    print("Emergency admin user created - login with admin/admin123")
                    
            except Exception as emergency_error:
                print(f"Emergency setup failed: {emergency_error}")
    
    app.run(host="0.0.0.0", port=5000, debug=True)

