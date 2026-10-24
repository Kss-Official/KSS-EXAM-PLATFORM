import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from app.core.database import Base, engine, SessionLocal
import app.models  # ensure models are registered
Base.metadata.create_all(bind=engine)

from app.core.bootstrap import init_super_admin
with SessionLocal() as db:
    init_super_admin(db)


