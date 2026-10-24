from typing import Optional
from datetime import datetime
from app.schemas.base import CamelModel

class DepartmentDto(CamelModel):
    id: Optional[int] = None
    name: str
    code: str
    description: Optional[str] = None
    active: bool = True
    created_at: Optional[datetime] = None
    associated_exams_count: Optional[int] = 0

class DepartmentSetSummary(CamelModel):
    id: int
    set_code: str
    name: str
    question_count: int = 0
    has_question_paper: bool = False
    question_paper_name: Optional[str] = None
    has_answer_key: bool = False
    answer_key_name: Optional[str] = None
    is_configured: bool = False

class ExamDepartmentSummary(CamelModel):
    id: int
    name: str
    code: str
    description: Optional[str] = None
    configured_sets_count: int = 0
