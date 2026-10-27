from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from app.core import get_db, require_super_admin
from app.models import AppUser, Department, Candidate, QuestionSet, AuditLog
from app.schemas import DepartmentDto

router = APIRouter(prefix="/api/admin/departments", tags=["Admin Departments"])

def is_academic_department(d: Department) -> bool:
    """
    Distinguishes true academic/engineering departments from colleges/institutions.
    """
    desc = (d.description or "").strip().lower()
    name = (d.name or "").strip().lower()
    code = (d.code or "").strip().upper()
    college_codes = {
        "AJIET", "AIT", "AIET", "CEC", "KIT", "LBS", "SCEM", 
        "SSIT", "SIT", "SUIET", "SJEC", "VCET", "YIT", "TESTINSTIT", "DEMOCOLLEG"
    }
    if code in college_codes:
        return False
    if desc.startswith("college:"):
        return False
    if "institute" in name or "college" in name:
        return False
    return True

def to_dto(d: Department) -> DepartmentDto:
    assoc_count = len(d.exams) if d.exams else 0
    return DepartmentDto(
        id=d.id,
        name=d.name,
        code=d.code,
        description=d.description,
        active=d.active,
        created_at=d.created_at,
        associated_exams_count=assoc_count
    )

@router.get("", response_model=List[DepartmentDto])
def get_all_departments(
    type: Optional[str] = Query("academic", description="Filter by type: academic, college, or all"),
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    depts = db.query(Department).options(
        joinedload(Department.exams)
    ).order_by(Department.name.asc()).all()
    
    if type == "academic":
        depts = [d for d in depts if is_academic_department(d)]
    elif type == "college":
        depts = [d for d in depts if not is_academic_department(d)]
    return [to_dto(d) for d in depts]

@router.get("/active", response_model=List[DepartmentDto])
def get_active_departments(
    type: Optional[str] = Query("academic", description="Filter by type: academic, college, or all"),
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    depts = db.query(Department).options(
        joinedload(Department.exams)
    ).filter(Department.active == True).order_by(Department.name.asc()).all()
    
    if type == "academic":
        depts = [d for d in depts if is_academic_department(d)]
    elif type == "college":
        depts = [d for d in depts if not is_academic_department(d)]
    return [to_dto(d) for d in depts]

@router.get("/colleges", response_model=List[DepartmentDto])
def get_all_colleges(
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    from app.models.college import College
    colleges = db.query(College).order_by(College.name.asc()).all()
    return [
        DepartmentDto(
            id=c.id,
            name=c.name,
            code=c.code or "",
            description=c.description,
            active=c.active,
            created_at=c.created_at,
            associated_exams_count=0
        )
        for c in colleges
    ]

@router.get("/{id}", response_model=DepartmentDto)
def get_department_by_id(
    id: int,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    dept = db.query(Department).options(
        joinedload(Department.exams)
    ).filter(Department.id == id).first()
    if not dept:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
    return to_dto(dept)

@router.post("", response_model=DepartmentDto)
def create_department(
    dto: DepartmentDto,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    code = dto.code.strip().upper()
    existing_by_name = db.query(Department).filter(Department.name.ilike(dto.name.strip())).first()
    if existing_by_name:
        if not existing_by_name.active:
            existing_by_name.active = True
            db.commit()
            db.refresh(existing_by_name)
        return to_dto(existing_by_name)

    existing_by_code = db.query(Department).filter(Department.code.ilike(code)).first()
    if existing_by_code:
        # If code matches an existing department with a different name, auto-disambiguate code safely
        base_code = code[:8]
        counter = 2
        new_code = f"{base_code}_{counter}"
        while db.query(Department).filter(Department.code.ilike(new_code)).first():
            counter += 1
            new_code = f"{base_code}_{counter}"
        code = new_code

    dept = Department(
        name=dto.name.strip(),
        code=code,
        description=dto.description,
        active=dto.active,
        created_at=datetime.now(timezone.utc)
    )
    db.add(dept)
    db.flush()

    db.add(AuditLog(
        action="CREATE_DEPARTMENT",
        entity_type="Department",
        entity_id=str(dept.id),
        performed_by=current_user.email,
        details=f"Created department: {dept.name} ({code})"
    ))
    db.commit()
    db.refresh(dept)
    return to_dto(dept)

@router.put("/{id}", response_model=DepartmentDto)
def update_department(
    id: int,
    dto: DepartmentDto,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    dept = db.query(Department).filter(Department.id == id).first()
    if not dept:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    dept.name = dto.name.strip()
    dept.code = dto.code.strip().upper()
    dept.description = dto.description
    dept.active = dto.active
    dept.updated_at = datetime.now(timezone.utc)

    db.add(AuditLog(
        action="UPDATE_DEPARTMENT",
        entity_type="Department",
        entity_id=str(dept.id),
        performed_by=current_user.email,
        details=f"Updated department: {dept.name} ({dept.code})"
    ))
    db.commit()
    db.refresh(dept)
    return to_dto(dept)

@router.delete("/{id}")
def delete_department(
    id: int,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    dept = db.query(Department).filter(Department.id == id).first()
    if not dept:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    name = dept.name
    try:
        # Disassociate candidates and question sets from deleted department
        db.query(Candidate).filter(Candidate.department_id == id).update({"department_id": None}, synchronize_session=False)
        db.query(QuestionSet).filter(QuestionSet.department_id == id).update({"department_id": None}, synchronize_session=False)
        db.delete(dept)
        db.add(AuditLog(
            action="DELETE_DEPARTMENT",
            entity_type="Department",
            entity_id=str(id),
            performed_by=current_user.email,
            details=f"Deleted department: {name}"
        ))
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"success": True, "message": "Department deleted successfully"}
