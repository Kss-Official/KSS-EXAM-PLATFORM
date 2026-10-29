from typing import List, Dict, Any, Optional, Union
from fastapi import APIRouter, Depends, UploadFile, File, Body, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core import get_db, require_super_admin
from app.models import AppUser
from app.schemas import CandidateDto, PaginatedCandidatesResponse
from app.admin.services import CandidateService

router = APIRouter(prefix="/api/admin/candidates", tags=["Admin Candidates"])

@router.get("", response_model=Union[PaginatedCandidatesResponse, List[CandidateDto]])
def get_candidates(
    page: Optional[int] = Query(None, ge=1, description="Page number (1-indexed)"),
    limit: Optional[int] = Query(None, ge=1, le=200, description="Page size (records per page)"),
    search: Optional[str] = Query(None, description="Search by name, reg number, email, or department"),
    department_id: Optional[int] = Query(None, alias="departmentId", description="Filter by department ID"),
    college_id: Optional[int] = Query(None, alias="collegeId", description="Filter by college ID"),
    status: Optional[str] = Query(None, description="Filter by status (COMPLETED, GOING ON, PENDING, ALL)"),
    batch: Optional[str] = Query(None, description="Filter by batch (Slot 1, Slot 2, UNASSIGNED, ALL)"),
    sort_by: str = Query("registration_number", alias="sortBy", description="Sort field"),
    sort_order: str = Query("asc", alias="sortOrder", description="Sort order (asc or desc)"),
    all: bool = Query(False, description="Return all candidates unpaginated"),
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    if all:
        return CandidateService.get_all_candidates(db)
    p = page if page is not None else 1
    l = limit if limit is not None else 30
    return CandidateService.get_paginated_candidates(
        db,
        page=p,
        limit=l,
        search=search,
        department_id=department_id,
        college_id=college_id,
        status=status,
        batch=batch,
        sort_by=sort_by,
        sort_order=sort_order
    )

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

@router.post("/batch-assign-batch")
def batch_assign_candidate_batch(
    payload: Dict[str, Any] = Body(...),
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Batch assigns a batch/slot (Slot 1, Slot 2, or None) to selected candidate IDs."""
    candidate_ids = payload.get("candidateIds") or payload.get("candidate_ids") or []
    batch = payload.get("batch")
    return CandidateService.batch_assign_candidate_batch(
        db, candidate_ids=candidate_ids, batch=batch, performed_by=current_user.email
    )

@router.post("/{candidate_id}/assign-batch")
def assign_candidate_batch(
    candidate_id: int,
    payload: Dict[str, Any] = Body(...),
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Assigns or updates a batch/slot for a single candidate."""
    batch = payload.get("batch")
    return CandidateService.assign_candidate_batch(
        db, candidate_id=candidate_id, batch=batch, performed_by=current_user.email
    )


