"""
Legacy entity module re-exporting domain-driven models for 100% backward compatibility.
All models are now modularly defined under `app.models.*`.
"""
from app.models import (
    Base,
    AppUser,
    Department,
    exam_departments,
    Exam,
    ExamSlot,
    QuestionSet,
    Question,
    QuestionOption,
    Candidate,
    ExamAttempt,
    AttemptRandomizedQuestion,
    AttemptRandomizedOption,
    AttemptAnswer,
    StoredDocument,
    AuditLog,
)

__all__ = [
    "Base",
    "AppUser",
    "Department",
    "exam_departments",
    "Exam",
    "ExamSlot",
    "QuestionSet",
    "Question",
    "QuestionOption",
    "Candidate",
    "ExamAttempt",
    "AttemptRandomizedQuestion",
    "AttemptRandomizedOption",
    "AttemptAnswer",
    "StoredDocument",
    "AuditLog",
]
