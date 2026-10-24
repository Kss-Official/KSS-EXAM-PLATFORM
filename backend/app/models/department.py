from datetime import datetime, timezone
from sqlalchemy import Column, BigInteger, String, Text, Boolean, DateTime, ForeignKey, Table, Index
from sqlalchemy.orm import relationship
from app.core.database import Base, ID_TYPE

# Many-to-Many association table: exam_departments
exam_departments = Table(
    "exam_departments",
    Base.metadata,
    Column("exam_id", BigInteger, ForeignKey("exams.id", ondelete="CASCADE"), primary_key=True),
    Column("department_id", BigInteger, ForeignKey("departments.id", ondelete="CASCADE"), primary_key=True),
    Index("ix_exam_departments_dept_id", "department_id")
)

class Department(Base):
    __tablename__ = "departments"

    id = Column(ID_TYPE, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    exams = relationship("Exam", secondary=exam_departments, back_populates="departments")
    candidates = relationship("Candidate", back_populates="department")
    question_sets = relationship("QuestionSet", back_populates="department")

    def __repr__(self):
        return f"<Department id={self.id} code='{self.code}' name='{self.name}'>"
