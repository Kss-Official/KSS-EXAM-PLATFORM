from typing import List, Optional, Dict
from datetime import datetime
from decimal import Decimal
from app.schemas.base import CamelModel, JsonDecimal

class CandidateAccessCodeDto(CamelModel):
    id: Optional[int] = None
    candidate_id: int
    code: str
    usage_count: int = 0
    max_uses: int = 3
    is_active: bool = True
    sent_to_email: Optional[str] = None
    sent_at: Optional[datetime] = None
    last_used_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

class CandidateDto(CamelModel):
    id: Optional[int] = None
    registration_number: str
    full_name: str
    email: str
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    college_id: Optional[int] = None
    college_name: Optional[str] = None
    status: Optional[str] = "ACTIVE"
    created_at: Optional[datetime] = None
    current_access_code: Optional[str] = None
    round_1_access_code: Optional[str] = None
    round_2_access_code: Optional[str] = None
    access_code_uses: Optional[int] = 0
    access_code_max_uses: Optional[int] = 3
    access_code_active: Optional[bool] = True
    access_code_sent_at: Optional[datetime] = None
    assigned_set: Optional[str] = None

class CandidateAssignSetRequest(CamelModel):
    set_code: Optional[str] = None

class CandidateBatchAssignSetRequest(CamelModel):
    candidate_ids: List[int]
    set_code: Optional[str] = None

class CandidateBatchGenerateSelectedRequest(CamelModel):
    candidate_ids: List[int]
    round: str = "ROUND_1"

class CandidateVerifyRequest(CamelModel):
    full_name: Optional[str] = None
    name: Optional[str] = None
    email: Optional[str] = None
    department: Optional[str] = None
    department_name: Optional[str] = None
    department_id: Optional[int] = None
    college: Optional[str] = None
    college_name: Optional[str] = None
    college_id: Optional[int] = None
    registration_number: Optional[str] = None

class CandidateVerifyResponse(CamelModel):
    eligible: bool
    message: str
    candidate_id: Optional[int] = None
    registration_number: Optional[str] = None
    full_name: Optional[str] = None
    candidate_name: Optional[str] = None
    email: Optional[str] = None
    department_name: Optional[str] = None
    college_name: Optional[str] = None
    exam_id: Optional[int] = None
    assigned_exam_id: Optional[int] = None
    exam_title: Optional[str] = None
    slot_name: Optional[str] = None
    duration_minutes: Optional[int] = None
    total_questions: Optional[int] = None
    timing_mode: Optional[str] = None
    scheduled_start_time: Optional[datetime] = None
    scheduled_end_time: Optional[datetime] = None
    set_code: Optional[str] = None
    question_set_code: Optional[str] = None

class CandidateOptionDto(CamelModel):
    option_id: int
    id: Optional[int] = None
    label: str
    option_text: str

class CandidateQuestionDto(CamelModel):
    question_id: int
    id: Optional[int] = None
    display_index: int
    question_text: str
    marks: JsonDecimal
    options: List[CandidateOptionDto] = []
    selected_option_id: Optional[int] = None

class CandidateStartAttemptResponse(CamelModel):
    attempt_id: int
    exam_id: int
    exam_title: str
    set_code: str
    question_set_code: Optional[str] = None
    started_at: datetime
    deadline_at: datetime
    expires_at: Optional[datetime] = None
    total_duration_seconds: int
    questions: List[CandidateQuestionDto] = []
    answers: Optional[Dict[str, int]] = {}

class AnswerSaveRequest(CamelModel):
    question_id: int
    selected_option_id: Optional[int] = None

class PaginatedCandidatesResponse(CamelModel):
    items: List[CandidateDto]
    total: int
    page: int
    limit: int
    total_pages: int
    has_more: bool
