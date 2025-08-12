
from simple_app import app, init_database

if __name__ == "__main__":
    # Initialize database when running directly
    init_database()
    app.run(host="0.0.0.0", port=5000, debug=True)
