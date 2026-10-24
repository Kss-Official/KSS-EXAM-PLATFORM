from typing import List, Optional
from datetime import datetime
from decimal import Decimal
from app.schemas.base import CamelModel, JsonDecimal
from app.schemas.question import ParsedQuestionDto

class ExamSlotDto(CamelModel):
    id: Optional[int] = None
    exam_id: int
    slot_number: int
    starts_at: datetime
    ends_at: datetime
    capacity: int

class ExamDto(CamelModel):
    id: Optional[int] = None
    title: str
    description: Optional[str] = None
    duration_minutes: int = 60
    total_questions: int = 50
    status: str = "DRAFT"
    qualification_mode: Optional[str] = "PERCENTAGE"
    qualification_threshold: Optional[JsonDecimal] = Decimal("60.00")
    timing_mode: Optional[str] = "DURATION_FROM_START"
    total_marks: Optional[JsonDecimal] = Decimal("100.00")
    marks_per_question: Optional[JsonDecimal] = Decimal("1.00")
    negative_marks: Optional[JsonDecimal] = Decimal("0.00")
    scheduled_start_time: Optional[datetime] = None
    scheduled_end_time: Optional[datetime] = None
    results_published: Optional[bool] = False
    created_at: Optional[datetime] = None
    department_ids: Optional[List[int]] = []
    department_names: Optional[List[str]] = []

class CreateExamFromParsedDto(CamelModel):
    title: str
    description: Optional[str] = None
    duration_minutes: Optional[int] = 60
    total_questions: Optional[int] = 50
    qualification_mode: Optional[str] = "PERCENTAGE"
    qualification_threshold: Optional[float] = 60.0
    timing_mode: Optional[str] = "DURATION_FROM_START"
    total_marks: Optional[float] = 100.0
    marks_per_question: Optional[float] = 1.0
    negative_marks: Optional[float] = 0.0
    scheduled_start_time: Optional[str] = None
    scheduled_end_time: Optional[str] = None
    department_ids: Optional[List[int]] = []
    target_sets: Optional[List[str]] = ["A", "B", "C", "D"]
    publish_immediately: Optional[bool] = False
    questions: List[ParsedQuestionDto] = []
