"""
Re-export database engine and sessions from app.core.database for backward compatibility.
"""
from app.core.database import engine, SessionLocal, Base, get_db

__all__ = ["engine", "SessionLocal", "Base", "get_db"]
