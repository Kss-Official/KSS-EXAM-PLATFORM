from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Body
from sqlalchemy.orm import Session

from app.core import get_db, require_super_admin
from app.models import AppUser
from app.schemas import ExamResultDto
from app.admin.services import DashboardService

router = APIRouter(prefix="/api/admin/results", tags=["Admin Exam Results"])

@router.get("", response_model=List[ExamResultDto])
def get_all_results(
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    return DashboardService.get_exam_results(db, None)

@router.get("/exam/{exam_id}", response_model=List[ExamResultDto])
def get_results_by_exam(
    exam_id: int,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    return DashboardService.get_exam_results(db, exam_id)

@router.post("/exam/{exam_id}/publish")
def publish_results(
    exam_id: int,
    payload: Optional[Dict[str, Any]] = Body(None),
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    published = True
    if payload and "published" in payload:
        published = bool(payload["published"])
    exam = DashboardService.publish_exam_results(db, exam_id, published, current_user.email)
    return {
        "success": True,
        "examId": exam_id,
        "resultsPublished": exam.results_published,
        "message": "Results publication status updated"
    }
