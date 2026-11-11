from typing import Optional
from datetime import datetime
from decimal import Decimal
from app.schemas.base import CamelModel, JsonDecimal

class SubmissionResponse(CamelModel):
    success: bool
    message: str
    receipt_id: str
    submitted_at: datetime
    attempt_id: int
    score: Optional[JsonDecimal] = None
    total_marks: Optional[JsonDecimal] = None
    percentage: Optional[JsonDecimal] = None
    is_published: Optional[bool] = False
    results_published: Optional[bool] = False
    qualification_status: Optional[str] = None
    total_questions: Optional[int] = None
    questions_answered: Optional[int] = None
    correct_answers: Optional[int] = None
    incorrect_answers: Optional[int] = None
    unanswered_questions: Optional[int] = None
    duration_seconds: Optional[int] = None
    started_at: Optional[datetime] = None
    candidate_code: Optional[str] = None
    question_set_code: Optional[str] = None

class ExamResultDto(CamelModel):
    attempt_id: int
    candidate_id: int
    candidate_name: str
    registration_number: str
    department_name: str
    exam_id: int
    exam_title: str
    set_code: str
    slot_number: Optional[int] = None
    attempt_status: str
    answered_count: int
    unanswered_count: int
    score: Optional[JsonDecimal] = None
    total_marks: Optional[JsonDecimal] = None
    percentage: Optional[JsonDecimal] = None
    qualification_threshold: Optional[JsonDecimal] = None
    qualification_status: Optional[str] = None
    results_published: bool = False
    is_published: bool = False
    submitted_at: Optional[datetime] = None
    receipt_id: Optional[str] = None
    candidate_email: Optional[str] = None
    candidate_batch: Optional[str] = None
    total_questions: Optional[int] = None
    questions_answered: Optional[int] = None
    correct_answers: Optional[int] = None
    incorrect_answers: Optional[int] = None
    duration_seconds: Optional[int] = None
    started_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    exam_date: Optional[str] = None
    candidate_code: Optional[str] = None
    question_set_code: Optional[str] = None
