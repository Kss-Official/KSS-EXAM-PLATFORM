from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core import get_db, require_super_admin
from app.models import AppUser
from app.schemas.college import CollegeDto, CollegeCreateDto
from app.admin.services.college_service import CollegeService

router = APIRouter(prefix="/api/admin/colleges", tags=["Admin Colleges"])

@router.get("", response_model=List[CollegeDto])
def get_all_colleges(
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Retrieves all colleges with active enrolled candidate counts."""
    return CollegeService.get_all_colleges(db)

@router.get("/active", response_model=List[CollegeDto])
def get_active_colleges(
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Retrieves active colleges."""
    return CollegeService.get_active_colleges(db)

@router.get("/{id}", response_model=CollegeDto)
def get_college_by_id(
    id: int,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Retrieves a single college by its ID."""
    return CollegeService.get_college_by_id(db, id)

@router.post("", response_model=CollegeDto, status_code=status.HTTP_201_CREATED)
def create_college(
    dto: CollegeCreateDto,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Creates a new institution/college."""
    return CollegeService.create_college(db, dto, current_user.email)

@router.put("/{id}", response_model=CollegeDto)
def update_college(
    id: int,
    dto: CollegeCreateDto,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Updates an existing college."""
    return CollegeService.update_college(db, id, dto, current_user.email)

@router.delete("/{id}")
def delete_college(
    id: int,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """Deletes or deactivates a college."""
    CollegeService.delete_college(db, id, current_user.email)
    return {"success": True, "message": f"College {id} processed successfully"}
