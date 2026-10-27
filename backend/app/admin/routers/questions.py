from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, Body, HTTPException, status
from sqlalchemy.orm import Session

from app.core import get_db, require_super_admin
from app.models import (
    AppUser, Exam, Department, QuestionSet, Question, StoredDocument, AuditLog
)
from app.schemas import (
    QuestionDto, QuestionSetSummary, DepartmentSetSummary, ExamDepartmentSummary
)
from app.admin.services import QuestionService, DocumentStorageService

router = APIRouter(prefix="/api/admin", tags=["Admin Question Bank & Sets"])

def is_academic_department(d: Department) -> bool:
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

# 1. Departments for Exam
@router.get("/exams/{exam_id}/departments", response_model=List[ExamDepartmentSummary])
def get_exam_departments(
    exam_id: int,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")

    # Filter out colleges: Question Bank is strictly organized by academic/engineering departments
    raw_depts = set(exam.departments) if exam.departments else set()
    q_sets = db.query(QuestionSet).filter(QuestionSet.exam_id == exam_id).all()
    for qs in q_sets:
        if qs.department:
            raw_depts.add(qs.department)

    academic_depts = [d for d in raw_depts if is_academic_department(d)]

    # If exam has no specific academic departments, include all active academic departments
    if not academic_depts:
        all_active = db.query(Department).filter(Department.active == True).all()
        academic_depts = [d for d in all_active if is_academic_department(d)]

    # Check if universal sets exist with questions for this exam
    universal_sets = db.query(QuestionSet).filter(
        QuestionSet.exam_id == exam_id,
        QuestionSet.department_id == None
    ).all()
    has_universal_sets = len(universal_sets) >= 4 and any(len(qs.questions) > 0 for qs in universal_sets)

    summaries = []
    for d in sorted(academic_depts, key=lambda x: x.name):
        cnt = db.query(QuestionSet).filter(
            QuestionSet.exam_id == exam_id,
            QuestionSet.department_id == d.id
        ).count()
        display_cnt = cnt if cnt > 0 else (4 if has_universal_sets else 0)

        summaries.append(ExamDepartmentSummary(
            id=d.id,
            name=d.name,
            code=d.code,
            description=d.description or "Academic & engineering department curriculum",
            configured_sets_count=display_cnt
        ))
    return summaries

# 2. Sets for Department in Exam
@router.get("/exams/{exam_id}/departments/{department_id}/sets", response_model=List[DepartmentSetSummary])
def get_department_sets(
    exam_id: int,
    department_id: int,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    q_sets = db.query(QuestionSet).filter(
        QuestionSet.exam_id == exam_id,
        QuestionSet.department_id == department_id
    ).order_by(QuestionSet.set_code.asc()).all()

    # Check universal sets for this exam
    universal_sets = db.query(QuestionSet).filter(
        QuestionSet.exam_id == exam_id,
        QuestionSet.department_id == None
    ).order_by(QuestionSet.set_code.asc()).all()
    univ_map = {qs.set_code.upper(): qs for qs in universal_sets if qs.questions and len(qs.questions) > 0}

    if len(q_sets) < 4:
        existing_codes = {qs.set_code for qs in q_sets}
        dept = db.query(Department).filter(Department.id == department_id).first()
        dept_name = dept.name if dept else f"Department {department_id}"
        added = False
        for code in ["A", "B", "C", "D"]:
            if code not in existing_codes:
                new_qs = QuestionSet(
                    exam_id=exam_id,
                    department_id=department_id,
                    set_code=code,
                    name=f"{dept_name} - Set {code}"
                )
                db.add(new_qs)
                added = True
        if added:
            db.commit()
            q_sets = db.query(QuestionSet).filter(
                QuestionSet.exam_id == exam_id,
                QuestionSet.department_id == department_id
            ).order_by(QuestionSet.set_code.asc()).all()

    result = []
    for qs in q_sets:
        target_qs = qs
        if (not qs.questions or len(qs.questions) == 0) and qs.set_code.upper() in univ_map:
            target_qs = univ_map[qs.set_code.upper()]

        q_count = len(target_qs.questions) if target_qs.questions else 0
        qp_doc = db.query(StoredDocument).filter(
            StoredDocument.question_set_id == target_qs.id,
            StoredDocument.document_type == "QUESTION_PAPER"
        ).order_by(StoredDocument.created_at.desc()).first()
        ak_doc = db.query(StoredDocument).filter(
            StoredDocument.question_set_id == target_qs.id,
            StoredDocument.document_type == "ANSWER_KEY"
        ).order_by(StoredDocument.created_at.desc()).first()

        result.append(DepartmentSetSummary(
            id=target_qs.id,
            set_code=qs.set_code,
            name=qs.name,
            question_count=q_count,
            has_question_paper=bool(qp_doc),
            question_paper_name=qp_doc.original_filename if qp_doc else None,
            has_answer_key=bool(ak_doc),
            answer_key_name=ak_doc.original_filename if ak_doc else None,
            is_configured=(q_count > 0 or bool(qp_doc))
        ))
    return result

# 3. Initialize Department Sets A, B, C, D
@router.post("/exams/{exam_id}/departments/{department_id}/initialize-sets", response_model=List[DepartmentSetSummary])
def initialize_department_sets(
    exam_id: int,
    department_id: int,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    dept = db.query(Department).filter(Department.id == department_id).first()
    if not dept:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")

    exam = db.query(Exam).filter(Exam.id == exam_id).first()
    if not exam:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")

    for sc in ["A", "B", "C", "D"]:
        exists = db.query(QuestionSet).filter(
            QuestionSet.exam_id == exam_id,
            QuestionSet.department_id == department_id,
            QuestionSet.set_code == sc
        ).first()
        if not exists:
            qs = QuestionSet(
                exam_id=exam_id,
                department_id=department_id,
                set_code=sc,
                name=f"{dept.name} - Set {sc}"
            )
            db.add(qs)

    db.commit()
    return get_department_sets(exam_id, department_id, current_user, db)

# 4. Exam-Level Question Sets
@router.get("/exams/{exam_id}/sets", response_model=List[QuestionSetSummary])
def get_exam_sets(
    exam_id: int,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    q_sets = db.query(QuestionSet).filter(QuestionSet.exam_id == exam_id).order_by(QuestionSet.set_code.asc()).all()
    result = []
    for qs in q_sets:
        q_count = len(qs.questions) if qs.questions else 0
        qp_doc = db.query(StoredDocument).filter(
            StoredDocument.question_set_id == qs.id,
            StoredDocument.document_type == "QUESTION_PAPER"
        ).order_by(StoredDocument.created_at.desc()).first()
        ak_doc = db.query(StoredDocument).filter(
            StoredDocument.question_set_id == qs.id,
            StoredDocument.document_type == "ANSWER_KEY"
        ).order_by(StoredDocument.created_at.desc()).first()

        result.append(QuestionSetSummary(
            id=qs.id,
            set_code=qs.set_code,
            name=qs.name,
            question_count=q_count,
            has_question_paper=bool(qp_doc),
            question_paper_name=qp_doc.original_filename if qp_doc else None,
            has_answer_key=bool(ak_doc),
            answer_key_name=ak_doc.original_filename if ak_doc else None,
            is_configured=(q_count > 0 or bool(qp_doc))
        ))
    return result

# 5. Questions in Set by Set Code
@router.get("/exams/{exam_id}/sets/{set_code}/questions", response_model=List[QuestionDto])
def get_questions_by_exam_set(
    exam_id: int,
    set_code: str,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    return QuestionService.get_questions_by_exam_and_set_code(db, exam_id, set_code)

@router.get("/exams/{exam_id}/departments/{department_id}/sets/{set_code}/questions", response_model=List[QuestionDto])
def get_questions_by_dept_set(
    exam_id: int,
    department_id: int,
    set_code: str,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    return QuestionService.get_questions_by_exam_dept_and_set_code(db, exam_id, department_id, set_code)

# 6. Add Question to Set
@router.post("/sets/{question_set_id}/questions", response_model=QuestionDto)
def create_question_in_set(
    question_set_id: int,
    dto: QuestionDto,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    return QuestionService.create_question(db, question_set_id, dto, current_user.email)

# 7. Delete Question
@router.delete("/questions/{question_id}")
def delete_question(
    question_id: int,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    QuestionService.delete_question(db, question_id, current_user.email)
    return {"success": True, "message": "Question deleted successfully"}

# 8. Text Import
@router.post("/sets/{question_set_id}/import", response_model=List[QuestionDto])
def import_questions_text(
    question_set_id: int,
    payload: Dict[str, str] = Body(...),
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    raw_text = payload.get("rawText") or payload.get("raw_text") or ""
    return QuestionService.import_questions_from_text(db, question_set_id, raw_text, current_user.email)

# 9. Apply Answer Key
@router.post("/sets/{question_set_id}/answer-key")
def apply_answer_key(
    question_set_id: int,
    payload: Dict[str, str] = Body(...),
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    key_text = payload.get("answerKeyText") or payload.get("answer_key_text") or ""
    return QuestionService.apply_answer_key(db, question_set_id, key_text, current_user.email)

# 10. Bulk Update
@router.put("/sets/{question_set_id}/bulk", response_model=List[QuestionDto])
def bulk_update_questions(
    question_set_id: int,
    questions: List[QuestionDto],
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    return QuestionService.bulk_update_questions(db, question_set_id, questions, current_user.email)

# 11. Clear Questions in Set
@router.delete("/sets/{question_set_id}/questions")
def delete_all_questions_in_set(
    question_set_id: int,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    QuestionService.delete_all_questions_in_set(db, question_set_id, current_user.email)
    return {"success": True, "message": "All questions deleted successfully"}

# 12. Delete Question Set
@router.delete("/sets/{question_set_id}")
def delete_question_set(
    question_set_id: int,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    QuestionService.delete_question_set(db, question_set_id, current_user.email)
    return {"success": True, "message": "Question Set deleted successfully"}

# 13. Upload Documents
@router.post("/exams/{exam_id}/departments/{department_id}/sets/{question_set_id}/upload-document")
def upload_dept_set_document(
    exam_id: int,
    department_id: int,
    question_set_id: int,
    file: UploadFile = File(...),
    document_type: str = Form("QUESTION_PAPER", alias="documentType"),
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    doc = DocumentStorageService.store_document_sync(
        db, file, exam_id, department_id, question_set_id, document_type, current_user.id
    )
    qs = db.query(QuestionSet).filter(QuestionSet.id == question_set_id).first()
    set_code = qs.set_code if qs else None
    return {
        "success": True,
        "documentId": doc.id,
        "id": doc.id,
        "filename": doc.original_filename,
        "originalFilename": doc.original_filename,
        "documentType": doc.document_type,
        "size": doc.file_size,
        "sha256": doc.sha256_checksum,
        "sha256Checksum": doc.sha256_checksum,
        "setCode": set_code
    }

@router.post("/exams/{exam_id}/sets/{question_set_id}/upload-document")
def upload_set_document(
    exam_id: int,
    question_set_id: int,
    file: UploadFile = File(...),
    document_type: str = Form("QUESTION_PAPER", alias="documentType"),
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    doc = DocumentStorageService.store_document_sync(
        db, file, exam_id, None, question_set_id, document_type, current_user.id
    )
    qs = db.query(QuestionSet).filter(QuestionSet.id == question_set_id).first()
    set_code = qs.set_code if qs else None
    return {
        "success": True,
        "documentId": doc.id,
        "id": doc.id,
        "filename": doc.original_filename,
        "originalFilename": doc.original_filename,
        "documentType": doc.document_type,
        "size": doc.file_size,
        "sha256": doc.sha256_checksum,
        "sha256Checksum": doc.sha256_checksum,
        "setCode": set_code
    }

# 14. Remove Document
@router.delete("/exams/{exam_id}/sets/{question_set_id}/documents/{document_type}")
def remove_set_document(
    exam_id: int,
    question_set_id: int,
    document_type: str,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    docs = db.query(StoredDocument).filter(
        StoredDocument.exam_id == exam_id,
        StoredDocument.question_set_id == question_set_id,
        StoredDocument.document_type == document_type.upper()
    ).all()
    for d in docs:
        db.delete(d)
    db.commit()
    return {"success": True, "message": f"{document_type} document removed successfully"}
