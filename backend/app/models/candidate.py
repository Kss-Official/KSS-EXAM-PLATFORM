from datetime import datetime, timezone
from sqlalchemy import Column, BigInteger, Integer, Boolean, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base, ID_TYPE

class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(ID_TYPE, primary_key=True, autoincrement=True)
    registration_number = Column(String(50), unique=True, nullable=False, index=True)
    full_name = Column(String(150), nullable=False)
    email = Column(String(150), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=True)
    department_id = Column(BigInteger, ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    assigned_set = Column(String(10), nullable=True)  # Set A, Set B, Set C, Set D, or None
    status = Column(String(20), default="ACTIVE")
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    department = relationship("Department", back_populates="candidates")
    attempts = relationship("ExamAttempt", back_populates="candidate", cascade="all, delete-orphan")
    access_codes = relationship("CandidateAccessCode", back_populates="candidate", cascade="all, delete-orphan", order_by="CandidateAccessCode.created_at.desc()")

    def __repr__(self):
        return f"<Candidate id={self.id} reg='{self.registration_number}' name='{self.full_name}'>"


class CandidateAccessCode(Base):
    __tablename__ = "candidate_access_codes"

    id = Column(ID_TYPE, primary_key=True, autoincrement=True)
    candidate_id = Column(BigInteger, ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False, index=True)
    code = Column(String(32), unique=True, nullable=False, index=True)
    round = Column(String(20), nullable=False, default="ROUND_1")
    usage_count = Column(Integer, nullable=False, default=0)
    max_uses = Column(Integer, nullable=False, default=3)
    is_active = Column(Boolean, nullable=False, default=True)
    sent_to_email = Column(String(150), nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    candidate = relationship("Candidate", back_populates="access_codes")

    def __repr__(self):
        return f"<CandidateAccessCode id={self.id} code='{self.code}' uses={self.usage_count}/{self.max_uses} active={self.is_active}>"

