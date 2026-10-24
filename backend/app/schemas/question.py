from typing import List, Optional, Dict
from decimal import Decimal
from app.schemas.base import CamelModel, JsonDecimal

class QuestionOptionDto(CamelModel):
    id: Optional[int] = None
    option_text: str
    correct: bool = False
    display_order: Optional[int] = 1
    label: Optional[str] = None

class QuestionDto(CamelModel):
    id: Optional[int] = None
    question_set_id: Optional[int] = None
    question_text: str
    marks: Optional[JsonDecimal] = Decimal("1.00")
    negative_marks: Optional[JsonDecimal] = Decimal("0.00")
    display_order: Optional[int] = 1
    options: List[QuestionOptionDto] = []
    correct_option_id: Optional[int] = None

class QuestionSetSummary(CamelModel):
    id: int
    set_code: str
    name: str
    question_count: int = 0
    has_question_paper: Optional[bool] = False
    question_paper_name: Optional[str] = None
    has_answer_key: Optional[bool] = False
    answer_key_name: Optional[str] = None
    is_configured: Optional[bool] = False

class ParsedOptionDto(CamelModel):
    label: str
    option_text: str
    correct: bool = False

class ParsedQuestionDto(CamelModel):
    display_order: int
    question_text: str
    options: List[ParsedOptionDto] = []
    correct_option: Optional[str] = None
    marks: Optional[float] = 1.0
    negative_marks: Optional[float] = 0.0
    has_issue: Optional[bool] = False
    issue_description: Optional[str] = None

class PdfParseResponseDto(CamelModel):
    success: bool
    confidence_score: float = 0.0
    total_questions: int = 0
    mapped_answers_count: int = 0
    requires_ocr: bool = False
    ocr_reason: Optional[str] = None
    warnings: List[str] = []
    errors: List[str] = []
    extracted_answer_key: Dict[int, str] = {}
    questions: List[ParsedQuestionDto] = []
    question_paper_file_name: Optional[str] = None
    question_paper_size_bytes: Optional[int] = None
    answer_sheet_file_name: Optional[str] = None
    answer_sheet_size_bytes: Optional[int] = None
