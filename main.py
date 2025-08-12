

from simple_app import app, init_database
import os

if __name__ == "__main__":
    # Remove DATABASE_URL to force SQLite usage
    if 'DATABASE_URL' in os.environ:
        del os.environ['DATABASE_URL']
        print("Removed DATABASE_URL, using SQLite")
    
    # Initialize database when running directly
    init_database()
    app.run(host="0.0.0.0", port=5000, debug=True)

