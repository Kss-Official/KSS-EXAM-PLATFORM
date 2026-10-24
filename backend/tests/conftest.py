import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.database import Base, engine, SessionLocal
import app.models  # ensure models are registered
Base.metadata.create_all(bind=engine)

from app.core.bootstrap import init_super_admin
with SessionLocal() as db_session:
    init_super_admin(db_session)

import pytest

@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


