from datetime import datetime, timezone
from sqlalchemy import (
    Column, BigInteger, Integer, String, Numeric,
    DateTime, ForeignKey
)
from sqlalchemy.orm import relationship
from app.core.database import Base, ID_TYPE

class ExamAttempt(Base):
    __tablename__ = "exam_attempts"

    id = Column(ID_TYPE, primary_key=True, autoincrement=True)
    candidate_id = Column(BigInteger, ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False)
    exam_id = Column(BigInteger, ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    slot_id = Column(BigInteger, ForeignKey("exam_slots.id", ondelete="SET NULL"), nullable=True)
    question_set_id = Column(BigInteger, ForeignKey("question_sets.id", ondelete="CASCADE"), nullable=False)
    started_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), nullable=False, default="ASSIGNED")  # ASSIGNED, IN_PROGRESS, SUBMITTED, EXPIRED
    score = Column(Numeric(8, 2), nullable=True)
    total_marks = Column(Numeric(8, 2), nullable=True)
    percentage = Column(Numeric(6, 2), nullable=True)
    qualification_status = Column(String(20), default="PENDING")  # PENDING, QUALIFIED, NOT_QUALIFIED
    receipt_id = Column(String(64), nullable=True)
    candidate_code = Column(String(64), nullable=True)
    question_set_code = Column(String(20), nullable=True)
    total_questions = Column(Integer, nullable=False, default=0)
    questions_answered = Column(Integer, nullable=False, default=0)
    correct_answers = Column(Integer, nullable=False, default=0)
    incorrect_answers = Column(Integer, nullable=False, default=0)
    unanswered_questions = Column(Integer, nullable=False, default=0)
    duration_seconds = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    candidate = relationship("Candidate", back_populates="attempts")
    exam = relationship("Exam", back_populates="attempts")
    slot = relationship("ExamSlot")
    question_set = relationship("QuestionSet")
    randomized_questions = relationship("AttemptRandomizedQuestion", back_populates="attempt", cascade="all, delete-orphan", order_by="AttemptRandomizedQuestion.display_order")
    randomized_options = relationship("AttemptRandomizedOption", back_populates="attempt", cascade="all, delete-orphan")
    answers = relationship("AttemptAnswer", back_populates="attempt", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<ExamAttempt id={self.id} cand_id={self.candidate_id} exam_id={self.exam_id} status='{self.status}'>"


class AttemptRandomizedQuestion(Base):
    __tablename__ = "attempt_randomized_questions"

    id = Column(ID_TYPE, primary_key=True, autoincrement=True)
    attempt_id = Column(BigInteger, ForeignKey("exam_attempts.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(BigInteger, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    display_order = Column(Integer, nullable=False)

    attempt = relationship("ExamAttempt", back_populates="randomized_questions")
    question = relationship("Question")

    def __repr__(self):
        return f"<AttemptRandomizedQuestion attempt={self.attempt_id} q={self.question_id} order={self.display_order}>"


class AttemptRandomizedOption(Base):
    __tablename__ = "attempt_randomized_options"

    id = Column(ID_TYPE, primary_key=True, autoincrement=True)
    attempt_id = Column(BigInteger, ForeignKey("exam_attempts.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(BigInteger, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    option_id = Column(BigInteger, ForeignKey("question_options.id", ondelete="CASCADE"), nullable=False)
    display_order = Column(Integer, nullable=False)
    display_label = Column(String(5), nullable=False)  # A, B, C, D

    attempt = relationship("ExamAttempt", back_populates="randomized_options")
    question = relationship("Question")
    option = relationship("QuestionOption")

    def __repr__(self):
        return f"<AttemptRandomizedOption attempt={self.attempt_id} opt={self.option_id} label='{self.display_label}'>"


class AttemptAnswer(Base):
    __tablename__ = "attempt_answers"

    id = Column(ID_TYPE, primary_key=True, autoincrement=True)
    attempt_id = Column(BigInteger, ForeignKey("exam_attempts.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(BigInteger, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    selected_option_id = Column(BigInteger, ForeignKey("question_options.id", ondelete="SET NULL"), nullable=True)
    answered_at = Column(DateTime(timezone=True), nullable=True, default=lambda: datetime.now(timezone.utc))

    attempt = relationship("ExamAttempt", back_populates="answers")
    question = relationship("Question")
    selected_option = relationship("QuestionOption")

    def __repr__(self):
        return f"<AttemptAnswer attempt={self.attempt_id} q={self.question_id} opt={self.selected_option_id}>"
