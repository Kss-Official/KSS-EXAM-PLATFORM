from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core import get_db, require_super_admin
from app.models import AppUser
from app.schemas.coding import CodingExamDto
from app.admin.services.coding_exam_service import CodingExamService
from app.coding.import_service import parse_questions_pdf, parse_testcases_file

router = APIRouter(prefix="/api/admin/exams/coding", tags=["Admin Coding Assessments"])

@router.post("/import-files")
async def import_coding_exam_files(
    questions_pdf: UploadFile = File(...),
    testcases_file: Optional[UploadFile] = File(None),
    current_user: AppUser = Depends(require_super_admin),
):
    """Parse a Questions PDF and optional Test Cases (.json/.csv/.pdf) into editable form preview."""
    q_bytes = await questions_pdf.read()
    questions, warnings = parse_questions_pdf(q_bytes)
    if not questions:
        raise HTTPException(status_code=400, detail=warnings[0] if warnings else "No problems found in Questions PDF.")

    if testcases_file is not None and testcases_file.filename:
        tc_bytes = await testcases_file.read()
        by_q, tc_warnings = parse_testcases_file(testcases_file.filename, tc_bytes)
        warnings.extend(tc_warnings)
        for idx, q in enumerate(questions, start=1):
            if idx in by_q and by_q[idx]:
                q["testCases"] = by_q[idx]
                q["maxMarks"] = int(sum(float(t.get("marks") or 0) for t in by_q[idx])) or q["maxMarks"]

    return {"questions": questions, "warnings": warnings}


@router.get("/eligibility-setting")
def get_coding_eligibility_setting(
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    from app.coding.router import is_round1_qualification_required
    return {"requireRound1Qualified": is_round1_qualification_required(db)}


@router.post("/eligibility-setting")
def set_coding_eligibility_setting(
    payload: Dict[str, Any],
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    from app.core.config import settings
    from app.models.setting import SystemSetting

    val = bool(payload.get("requireRound1Qualified", True))
    row = db.query(SystemSetting).filter(SystemSetting.key == "coding_require_round1_qualified").first()
    if row:
        row.value = "true" if val else "false"
    else:
        db.add(SystemSetting(key="coding_require_round1_qualified", value="true" if val else "false"))
    db.commit()
    settings.CODING_REQUIRE_ROUND1_QUALIFIED = val
    return {"requireRound1Qualified": val}


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
