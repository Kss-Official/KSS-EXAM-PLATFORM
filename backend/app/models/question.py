from datetime import datetime, timezone
from sqlalchemy import (
    Column, BigInteger, Integer, String, Text, Boolean, Numeric,
    DateTime, ForeignKey, Index
)
from sqlalchemy.orm import relationship
from app.core.database import Base, ID_TYPE

class QuestionSet(Base):
    __tablename__ = "question_sets"
    __table_args__ = (
        Index("ix_question_sets_exam_id", "exam_id"),
        Index("ix_question_sets_exam_dept", "exam_id", "department_id"),
    )

    id = Column(ID_TYPE, primary_key=True, autoincrement=True)
    exam_id = Column(BigInteger, ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    department_id = Column(BigInteger, ForeignKey("departments.id", ondelete="CASCADE"), nullable=True)
    set_code = Column(String(10), nullable=False)  # A, B, C, D
    name = Column(String(100), nullable=True, default="Set A")

    exam = relationship("Exam", back_populates="question_sets")
    department = relationship("Department", back_populates="question_sets")
    questions = relationship("Question", back_populates="question_set", cascade="all, delete-orphan", order_by="Question.display_order")

    def __repr__(self):
        return f"<QuestionSet id={self.id} exam_id={self.exam_id} code='{self.set_code}'>"


class Question(Base):
    __tablename__ = "questions"
    __table_args__ = (
        Index("ix_questions_question_set_id", "question_set_id"),
        Index("ix_questions_set_display", "question_set_id", "display_order"),
    )

    id = Column(ID_TYPE, primary_key=True, autoincrement=True)
    question_set_id = Column(BigInteger, ForeignKey("question_sets.id", ondelete="CASCADE"), nullable=False)
    question_text = Column(Text, nullable=False)
    marks = Column(Numeric(6, 2), nullable=False, default=1.00)
    negative_marks = Column(Numeric(6, 2), nullable=False, default=0.00)
    display_order = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    question_set = relationship("QuestionSet", back_populates="questions")
    options = relationship("QuestionOption", back_populates="question", cascade="all, delete-orphan", order_by="QuestionOption.display_order")

    def __repr__(self):
        return f"<Question id={self.id} set_id={self.question_set_id} order={self.display_order}>"


class QuestionOption(Base):
    __tablename__ = "question_options"
    __table_args__ = (
        Index("ix_question_options_question_id", "question_id"),
        Index("ix_question_options_q_display", "question_id", "display_order"),
    )

    id = Column(ID_TYPE, primary_key=True, autoincrement=True)
    question_id = Column(BigInteger, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    option_text = Column(Text, nullable=False)
    is_correct = Column(Boolean, nullable=False, default=False)
    display_order = Column(Integer, nullable=False, default=1)

    question = relationship("Question", back_populates="options")

    def __repr__(self):
        return f"<QuestionOption id={self.id} q_id={self.question_id} order={self.display_order} correct={self.is_correct}>"
