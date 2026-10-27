from datetime import datetime, timezone
from sqlalchemy import Column, BigInteger, String, Text, Boolean, DateTime, Index
from sqlalchemy.orm import relationship
from app.core.database import Base, ID_TYPE

class College(Base):
    __tablename__ = "colleges"
    __table_args__ = (
        Index("ix_colleges_code", "code"),
        Index("ix_colleges_active", "active"),
    )

    id = Column(ID_TYPE, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False, unique=True)
    code = Column(String(50), nullable=True, unique=True)
    description = Column(Text, nullable=True)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    candidates = relationship("Candidate", back_populates="college")

    def __repr__(self):
        return f"<College id={self.id} code='{self.code}' name='{self.name}'>"
