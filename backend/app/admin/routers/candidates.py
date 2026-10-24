from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, UploadFile, File, Body, HTTPException, status
from sqlalchemy.orm import Session

from app.core import get_db, require_super_admin
from app.models import AppUser
from app.schemas import CandidateDto
from app.admin.services import CandidateService

router = APIRouter(prefix="/api/admin/candidates", tags=["Admin Candidates"])

@router.get("", response_model=List[CandidateDto])
def get_all_candidates(
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    return CandidateService.get_all_candidates(db)

@router.post("", response_model=CandidateDto)
def create_candidate(
    dto: CandidateDto,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    return CandidateService.create_candidate(db, dto, current_user.email)

@router.post("/batch")
def import_candidates_batch(
    file: UploadFile = File(...),
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    return CandidateService.import_candidates_csv_sync(db, file, current_user.email)

@router.post("/{candidate_id}/assign")
def assign_candidate(
    candidate_id: int,
    payload: Dict[str, Any] = Body(...),
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    raw_exam_id = payload.get("examId") or payload.get("exam_id")
    if not raw_exam_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="examId is required")
    exam_id = int(raw_exam_id)

    raw_slot_id = payload.get("slotId") or payload.get("slot_id")
    slot_id = int(raw_slot_id) if raw_slot_id else None
    set_code = payload.get("setCode") or payload.get("set_code")

    attempt = CandidateService.assign_candidate_to_exam(
        db, candidate_id, exam_id, slot_id, set_code, current_user.email
    )
    return {
        "success": True,
        "attemptId": attempt.id,
        "status": attempt.status,
        "setCode": attempt.question_set.set_code if attempt.question_set else "-"
    }

@router.post("/batch-assign-set")
def batch_assign_candidate_set(
    payload: Dict[str, Any] = Body(...),
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Batch assigns a question paper set (Set A, Set B, Set C, Set D, or None) to selected candidate IDs."""
    candidate_ids = payload.get("candidateIds") or payload.get("candidate_ids") or []
    set_code = payload.get("setCode") if "setCode" in payload else payload.get("set_code")
    return CandidateService.batch_assign_candidate_set(
        db, candidate_ids=candidate_ids, set_code=set_code, performed_by=current_user.email
    )

@router.post("/{candidate_id}/assign-set")
def assign_candidate_set(
    candidate_id: int,
    payload: Dict[str, Any] = Body(...),
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Assigns or updates a question paper set (Set A, Set B, Set C, Set D, or None) for a candidate."""
    set_code = payload.get("setCode") if "setCode" in payload else payload.get("set_code")
    return CandidateService.assign_candidate_set(
        db, candidate_id=candidate_id, set_code=set_code, performed_by=current_user.email
    )


