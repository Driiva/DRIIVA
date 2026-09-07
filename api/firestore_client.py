"""Lazily-initialised Firestore client. Extracted from api/main.py."""

import os

# Firestore client (will be initialized lazily if credentials are available)
_db = None
_firestore_initialized = False

def get_db():
    """Get Firestore client, initializing lazily if needed."""
    global _db, _firestore_initialized
    
    if _firestore_initialized:
        return _db
    
    _firestore_initialized = True
    
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore
        
        # Check if already initialized
        try:
            firebase_admin.get_app()
        except ValueError:
            # Check for service account key in environment
            service_account_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
            if service_account_path and os.path.exists(service_account_path):
                cred = credentials.Certificate(service_account_path)
                firebase_admin.initialize_app(cred)
            else:
                # No credentials available
                print("Firestore credentials not found")
                return None
        
        _db = firestore.client()
        print("Firestore initialized successfully")
    except Exception as e:
        print(f"Firestore not available: {e}")
        _db = None
    
    return _db
