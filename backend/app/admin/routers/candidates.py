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

@router.get("/round-ids")
def get_round_ids(
    round: str = "ROUND_1",
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Retrieves persisted Unique Access IDs mapped by candidate registration number for a specific round."""
    return CandidateService.get_round_ids_map(db, round_name=round)

@router.post("/round-ids/batch-generate")
def batch_generate_round_ids(
    payload: Dict[str, Any] = Body(default={"round": "ROUND_1"}),
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Generates unique IDs with strictly 3-use limits for all eligible candidates in the selected round."""
    round_name = payload.get("round", "ROUND_1")
    return CandidateService.batch_generate_round_ids(db, round_name=round_name, performed_by=current_user.email)

@router.post("/round-ids/generate-selected")
def generate_selected_round_ids(
    payload: Dict[str, Any] = Body(...),
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Generates/resets unique IDs with strictly 3-use limits for selected candidate IDs."""
    candidate_ids = payload.get("candidateIds") or payload.get("candidate_ids") or []
    round_name = payload.get("round", "ROUND_1")
    return CandidateService.generate_selected_round_ids(
        db, candidate_ids=candidate_ids, performed_by=current_user.email, round_name=round_name
    )

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

@router.post("/batch-send-access-codes")
def batch_send_access_codes(
    payload: Dict[str, Any] = Body(...),
    current_user: AppUser = Depends(require_super_admin)
):
    """
    Initiates asynchronous, rate-throttled batch email dispatch of Unique Access IDs.
    Protects against SMTP rate limits and locks.
    """
    from app.admin.services.batch_email_service import BatchEmailService
    round_name = payload.get("round", "ROUND_1")
    candidate_ids = payload.get("candidateIds")
    exam_title = payload.get("examTitle", "Technical Campus Examination")
    provider = payload.get("provider", "auto")
    delay_seconds = float(payload.get("delaySeconds", 1.2))

    return BatchEmailService.start_batch_dispatch(
        round_name=round_name,
        candidate_ids=candidate_ids,
        exam_title=exam_title,
        provider=provider,
        delay_seconds=delay_seconds,
        performed_by=current_user.email
    )

@router.get("/batch-send-status/{job_id}")
def get_batch_send_status(
    job_id: str,
    current_user: AppUser = Depends(require_super_admin)
):
    """Polls real-time live progress and counters for a batch email dispatch job."""
    from app.admin.services.batch_email_service import BatchEmailService
    status_info = BatchEmailService.get_job_status(job_id)
    if not status_info:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Batch email job not found")
    return status_info

@router.post("/{candidate_id}/generate-access-code")
def generate_access_code(
    candidate_id: int,
    round: str = "ROUND_1",
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Generates a secure Unique Access ID valid for strictly 3 uses for the given round."""
    return CandidateService.generate_access_code(db, candidate_id, current_user.email, round_name=round)

@router.post("/{candidate_id}/send-access-code")
def send_access_code(
    candidate_id: int,
    round: str = "ROUND_1",
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Dispatches the Unique Access ID to the candidate's email address."""
    return CandidateService.send_access_code_email(db, candidate_id, current_user.email, round_name=round)

