from datetime import datetime, timezone
from sqlalchemy import Column, BigInteger, String, Text, DateTime, Index
from app.core.database import Base, ID_TYPE

class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_created_at", "created_at"),
        Index("ix_audit_logs_entity", "entity_type", "entity_id"),
    )

    id = Column(ID_TYPE, primary_key=True, autoincrement=True)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(100), nullable=False)
    entity_id = Column(String(100), nullable=True)
    performed_by = Column(String(255), nullable=False)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f"<AuditLog id={self.id} action='{self.action}' entity='{self.entity_type}'>"
