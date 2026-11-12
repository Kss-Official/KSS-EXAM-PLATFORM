from datetime import datetime, timezone
from sqlalchemy import Column, BigInteger, Integer, String, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from app.core.database import Base, ID_TYPE

class ProctorAlert(Base):
    __tablename__ = "proctor_alerts"
    __table_args__ = (
        Index("ix_proctor_alerts_candidate_id", "candidate_id"),
        Index("ix_proctor_alerts_attempt_id", "attempt_id"),
        Index("ix_proctor_alerts_created_at", "created_at"),
        Index("ix_proctor_alerts_status", "status"),
        Index("ix_proctor_alerts_alert_type", "alert_type"),
    )

    id = Column(ID_TYPE, primary_key=True, autoincrement=True)
    candidate_id = Column(BigInteger, ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False)
    attempt_id = Column(BigInteger, ForeignKey("exam_attempts.id", ondelete="SET NULL"), nullable=True)
    alert_type = Column(String(50), nullable=False)  # TAB_SWITCH, SEB_EXIT, FULLSCREEN_EXIT, MULTI_FACE, NO_FACE, DEVTOOLS, SUSPICIOUS_KEY, ADMIN_STOPPED
    severity = Column(String(20), nullable=False, default="MEDIUM")  # LOW, MEDIUM, HIGH, CRITICAL
    message = Column(String(500), nullable=False)
    status = Column(String(20), nullable=False, default="NEW")  # NEW, REVIEWED, DISMISSED, ACTION_TAKEN
    reviewed_by = Column(String(150), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    candidate = relationship("Candidate")
    attempt = relationship("ExamAttempt")

    def __repr__(self):
        return f"<ProctorAlert id={self.id} cand={self.candidate_id} type='{self.alert_type}' status='{self.status}'>"

