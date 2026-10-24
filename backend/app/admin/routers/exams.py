from typing import List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, Query
from sqlalchemy.orm import Session

from app.core import get_db, require_super_admin
from app.models import AppUser
from app.schemas import ExamDto, CreateExamFromParsedDto, PdfParseResponseDto
from app.admin.services import ExamService, InMemoryPdfService

router = APIRouter(prefix="/api/admin/exams", tags=["Admin Exams"])

@router.get("", response_model=List[ExamDto])
def get_all_exams(
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    return ExamService.get_all_exams(db)

@router.get("/{id}", response_model=ExamDto)
def get_exam_by_id(
    id: int,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    return ExamService.get_exam_by_id(db, id)

@router.post("", response_model=ExamDto)
def create_exam(
    dto: ExamDto,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    return ExamService.create_exam(db, dto, current_user.email)

@router.post("/parse-pdf", response_model=PdfParseResponseDto)
async def parse_pdf_in_memory(
    question_paper: UploadFile = File(..., alias="questionPaper"),
    answer_sheet: Optional[UploadFile] = File(None, alias="answerSheet"),
    question_pattern: Optional[str] = Form(None, alias="questionPattern"),
    option_pattern: Optional[str] = Form(None, alias="optionPattern"),
    answer_key_pattern: Optional[str] = Form(None, alias="answerKeyPattern"),
    marks_per_question: Optional[float] = Form(1.0, alias="marksPerQuestion"),
    negative_marks: Optional[float] = Form(0.0, alias="negativeMarks"),
    current_user: AppUser = Depends(require_super_admin)
):
    return await InMemoryPdfService.parse_pdf_in_mem(
        question_paper_file=question_paper,
        answer_sheet_file=answer_sheet,
        question_pattern_str=question_pattern,
        option_pattern_str=option_pattern,
        answer_key_pattern_str=answer_key_pattern,
        marks_per_question=marks_per_question or 1.0,
        negative_marks=negative_marks or 0.0
    )

@router.post("/create-from-parsed", response_model=ExamDto)
def create_exam_from_parsed(
    dto: CreateExamFromParsedDto,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    return ExamService.create_exam_from_parsed(db, dto, current_user.email)

@router.put("/{id}", response_model=ExamDto)
def update_exam(
    id: int,
    dto: ExamDto,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    return ExamService.update_exam(db, id, dto, current_user.email)

@router.post("/{id}/publish", response_model=ExamDto)
def publish_exam(
    id: int,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    return ExamService.publish_exam(db, id, current_user.email)

@router.post("/{id}/close", response_model=ExamDto)
def close_exam(
    id: int,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    return ExamService.close_exam(db, id, current_user.email)

@router.delete("/{id}")
def delete_exam(
    id: int,
    force: bool = Query(False),
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    ExamService.delete_exam(db, id, force, current_user.email)
    return {"success": True, "message": "Exam deleted successfully"}
