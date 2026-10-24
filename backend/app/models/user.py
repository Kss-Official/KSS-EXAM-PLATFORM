from datetime import datetime, timezone
from sqlalchemy import Column, BigInteger, Integer, String, Boolean, DateTime
from app.core.database import Base, ID_TYPE

class AppUser(Base):
    __tablename__ = "app_users"

    id = Column(ID_TYPE, primary_key=True, autoincrement=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(150), nullable=False)
    role = Column(String(50), nullable=False, default="SUPER_ADMIN")
    enabled = Column(Boolean, nullable=False, default=True)
    account_non_locked = Column(Boolean, nullable=False, default=True)
    failed_login_attempts = Column(Integer, nullable=False, default=0)
    lock_expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f"<AppUser id={self.id} email='{self.email}' role='{self.role}'>"
