from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Body, HTTPException, status
from sqlalchemy.orm import Session

from app.core import get_db, require_super_admin
from app.models import AppUser, ExamAttempt, AttemptAnswer, AttemptRandomizedOption, AttemptRandomizedQuestion, AuditLog
from app.schemas import ExamResultDto
from app.admin.services import DashboardService

router = APIRouter(prefix="/api/admin/results", tags=["Admin Exam Results"])

@router.get("", response_model=List[ExamResultDto])
def get_all_results(
    date: Optional[str] = None,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Retrieves candidate examination results with optional date filtering (YYYY-MM-DD in IST).
    """
    return DashboardService.get_exam_results(db, None, date=date)

@router.get("/dates", response_model=List[str])
def get_available_dates(
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Retrieves all distinct examination dates with recorded candidate attempts.
    """
    return DashboardService.get_available_dates(db)

@router.get("/exam/{exam_id}", response_model=List[ExamResultDto])
def get_results_by_exam(
    exam_id: int,
    date: Optional[str] = None,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Retrieves examination results for a specific exam with optional date filtering.
    """
    return DashboardService.get_exam_results(db, exam_id, date=date)

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

@router.post("/attempt/{attempt_id}/reset")
def reset_candidate_attempt(
    attempt_id: int,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Resets/deletes a candidate's submitted or failed exam attempt.
    Cleans up all associated answers, randomized allocations, and unlocks the student
    so they can immediately re-enter and retake the examination.
    """
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
    if not attempt:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Examination attempt #{attempt_id} was not found."
        )

    cand_id = attempt.candidate_id
    exam_id = attempt.exam_id

    # Clean up attempt answers and randomized mappings
    db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id == attempt.id).delete()
    db.query(AttemptRandomizedOption).filter(AttemptRandomizedOption.attempt_id == attempt.id).delete()
    db.query(AttemptRandomizedQuestion).filter(AttemptRandomizedQuestion.attempt_id == attempt.id).delete()
    db.delete(attempt)

    # Log action to audit log for compliance
    log = AuditLog(
        action="RESET_CANDIDATE_ATTEMPT",
        entity_type="ExamAttempt",
        entity_id=str(attempt_id),
        performed_by=current_user.email,
        details=f"Admin {current_user.email} reset attempt #{attempt_id} for candidate #{cand_id} on exam #{exam_id}."
    )
    db.add(log)
    db.commit()

    return {
        "success": True,
        "attemptId": attempt_id,
        "candidateId": cand_id,
        "examId": exam_id,
        "message": "Examination attempt reset successfully. The candidate can now log in and retake the exam."
    }
