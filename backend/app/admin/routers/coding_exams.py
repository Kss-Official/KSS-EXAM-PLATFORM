from typing import List, Dict, Any
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core import get_db, require_super_admin
from app.models import AppUser
from app.schemas.coding import CodingExamDto
from app.admin.services.coding_exam_service import CodingExamService

router = APIRouter(prefix="/api/admin/exams/coding", tags=["Admin Coding Assessments"])

@router.get("", response_model=List[CodingExamDto])
def list_coding_exams(
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Retrieves all Round 2 Coding Assessments."""
    return CodingExamService.get_all_coding_exams(db)

@router.post("", response_model=CodingExamDto, status_code=status.HTTP_201_CREATED)
def create_coding_exam(
    dto: CodingExamDto,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Creates a new Round 2 Coding Assessment with problems and test cases."""
    return CodingExamService.create_coding_exam(db, dto, current_user.email)

@router.get("/{exam_id}", response_model=CodingExamDto)
def get_coding_exam(
    exam_id: int,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Retrieves a specific Coding Assessment by ID."""
    return CodingExamService.get_coding_exam_by_id(db, exam_id)

@router.put("/{exam_id}", response_model=CodingExamDto)
def update_coding_exam(
    exam_id: int,
    dto: CodingExamDto,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Updates an existing Coding Assessment and its problem definitions."""
    return CodingExamService.update_coding_exam(db, exam_id, dto, current_user.email)

@router.post("/{exam_id}/publish", response_model=CodingExamDto)
def publish_coding_exam(
    exam_id: int,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Publishes a Coding Assessment for candidate participation."""
    return CodingExamService.publish_coding_exam(db, exam_id, current_user.email)

@router.delete("/{exam_id}")
def delete_coding_exam(
    exam_id: int,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Deletes a Coding Assessment."""
    return CodingExamService.delete_coding_exam(db, exam_id, current_user.email)
