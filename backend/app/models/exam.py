from datetime import datetime, timezone
from sqlalchemy import (
    Column, BigInteger, Integer, String, Text, Boolean, Numeric,
    DateTime, ForeignKey, Index
)
from sqlalchemy.orm import relationship
from app.core.database import Base, ID_TYPE
from app.models.department import exam_departments

class Exam(Base):
    __tablename__ = "exams"

    id = Column(ID_TYPE, primary_key=True, autoincrement=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    duration_minutes = Column(Integer, nullable=False, default=60)
    total_questions = Column(Integer, nullable=False, default=50)
    status = Column(String(20), nullable=False, default="DRAFT")  # DRAFT, PUBLISHED, COMPLETED, CANCELLED
    qualification_mode = Column(String(20), default="PERCENTAGE")  # PERCENTAGE or ABSOLUTE
    qualification_threshold = Column(Numeric(6, 2), default=60.00)
    timing_mode = Column(String(30), default="DURATION_FROM_START")  # DURATION_FROM_START or SCHEDULED
    total_marks = Column(Numeric(8, 2), default=100.00)
    marks_per_question = Column(Numeric(6, 2), default=1.00)
    negative_marks = Column(Numeric(6, 2), default=0.00)
    scheduled_start_time = Column(DateTime(timezone=True), nullable=True)
    scheduled_end_time = Column(DateTime(timezone=True), nullable=True)
    results_published = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    departments = relationship("Department", secondary=exam_departments, back_populates="exams")
    question_sets = relationship("QuestionSet", back_populates="exam", cascade="all, delete-orphan")
    slots = relationship("ExamSlot", back_populates="exam", cascade="all, delete-orphan")
    attempts = relationship("ExamAttempt", back_populates="exam", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Exam id={self.id} title='{self.title}' status='{self.status}'>"


class ExamSlot(Base):
    __tablename__ = "exam_slots"
    __table_args__ = (
        Index("ix_exam_slots_exam_id", "exam_id"),
    )

    id = Column(ID_TYPE, primary_key=True, autoincrement=True)
    exam_id = Column(BigInteger, ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    slot_number = Column(Integer, nullable=False, default=1)
    starts_at = Column(DateTime(timezone=True), nullable=False)
    ends_at = Column(DateTime(timezone=True), nullable=False)
    capacity = Column(Integer, nullable=False, default=150)

    exam = relationship("Exam", back_populates="slots")

    def __repr__(self):
        return f"<ExamSlot id={self.id} exam_id={self.exam_id} slot={self.slot_number}>"
