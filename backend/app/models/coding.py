import json
from datetime import datetime, timezone
from sqlalchemy import (
    Column, BigInteger, Integer, String, Text, Boolean, Numeric, DateTime, ForeignKey
)
from sqlalchemy.orm import relationship
from app.core.database import Base, ID_TYPE

class CodingExam(Base):
    __tablename__ = "coding_exams"

    id = Column(ID_TYPE, primary_key=True, autoincrement=True)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    instructions = Column(Text, nullable=True)
    duration_minutes = Column(Integer, nullable=False, default=60)
    timing_mode = Column(String(30), nullable=False, default="DURATION_FROM_START")
    exam_date = Column(String(50), nullable=True)
    start_time = Column(String(50), nullable=True)
    selected_departments = Column(Text, nullable=True, default="[]")  # JSON array
    allowed_languages = Column(Text, nullable=True, default="[]")     # JSON array
    evaluation_mode = Column(String(30), nullable=False, default="PARTIAL_PER_TESTCASE")
    qualification_percentage = Column(Numeric(6, 2), nullable=False, default=60.00)
    total_marks = Column(Numeric(8, 2), nullable=False, default=100.00)
    status = Column(String(20), nullable=False, default="DRAFT")  # DRAFT, PUBLISHED, ARCHIVED
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    questions = relationship("CodingQuestion", back_populates="exam", cascade="all, delete-orphan", order_by="CodingQuestion.id")
    attempts = relationship("CodingAttempt", back_populates="exam", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<CodingExam id={self.id} title='{self.title}' status='{self.status}'>"


class CodingQuestion(Base):
    __tablename__ = "coding_questions"

    id = Column(String(64), primary_key=True)
    exam_id = Column(BigInteger, ForeignKey("coding_exams.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(255), nullable=False)
    problem_statement = Column(Text, nullable=False)
    difficulty = Column(String(20), nullable=False, default="Medium")
    max_marks = Column(Integer, nullable=False, default=20)
    input_format = Column(Text, nullable=True)
    output_format = Column(Text, nullable=True)
    constraints = Column(Text, nullable=True)
    sample_input = Column(Text, nullable=True)
    sample_output = Column(Text, nullable=True)
    sample_explanation = Column(Text, nullable=True)
    allowed_languages = Column(Text, nullable=True, default="[]")  # JSON array
    time_limit_ms = Column(Integer, nullable=False, default=2000)
    memory_limit_mb = Column(Integer, nullable=False, default=256)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    exam = relationship("CodingExam", back_populates="questions")
    test_cases = relationship("CodingTestCase", back_populates="question", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<CodingQuestion id={self.id} title='{self.title}'>"


class CodingTestCase(Base):
    __tablename__ = "coding_test_cases"

    id = Column(String(64), primary_key=True)
    question_id = Column(String(64), ForeignKey("coding_questions.id", ondelete="CASCADE"), nullable=False)
    label = Column(String(100), nullable=False)
    input_data = Column(Text, nullable=False, default="")
    expected_output = Column(Text, nullable=False, default="")
    is_hidden = Column(Boolean, nullable=False, default=False)
    marks = Column(Numeric(6, 2), nullable=False, default=5.00)
    explanation = Column(Text, nullable=True)

    question = relationship("CodingQuestion", back_populates="test_cases")

    def __repr__(self):
        return f"<CodingTestCase id={self.id} label='{self.label}' hidden={self.is_hidden}>"


class CodingAttempt(Base):
    __tablename__ = "coding_attempts"

    id = Column(ID_TYPE, primary_key=True, autoincrement=True)
    candidate_id = Column(BigInteger, ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False)
    exam_id = Column(BigInteger, ForeignKey("coding_exams.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), nullable=False, default="IN_PROGRESS")  # IN_PROGRESS, SUBMITTED
    score = Column(Numeric(8, 2), nullable=False, default=0.00)
    total_marks = Column(Numeric(8, 2), nullable=False, default=100.00)
    percentage = Column(Numeric(6, 2), nullable=False, default=0.00)
    qualification_status = Column(String(20), default="PENDING")
    started_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    submitted_at = Column(DateTime(timezone=True), nullable=True)

    candidate = relationship("Candidate")
    exam = relationship("CodingExam", back_populates="attempts")
    submissions = relationship("CodingSubmission", back_populates="attempt", cascade="all, delete-orphan")


class CodingSubmission(Base):
    __tablename__ = "coding_submissions"

    id = Column(ID_TYPE, primary_key=True, autoincrement=True)
    attempt_id = Column(BigInteger, ForeignKey("coding_attempts.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(String(64), ForeignKey("coding_questions.id", ondelete="CASCADE"), nullable=False)
    language = Column(String(30), nullable=False)
    source_code = Column(Text, nullable=False)
    status = Column(String(30), nullable=False, default="EVALUATED")  # PASSED, PARTIAL, FAILED, ERROR
    passed_test_cases = Column(Integer, nullable=False, default=0)
    total_test_cases = Column(Integer, nullable=False, default=0)
    marks_awarded = Column(Numeric(6, 2), nullable=False, default=0.00)
    test_case_results = Column(Text, nullable=True, default="[]")  # Detailed JSON breakdown
    submitted_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    attempt = relationship("CodingAttempt", back_populates="submissions")
    question = relationship("CodingQuestion")
