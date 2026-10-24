from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Query, Body, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core import get_db
from app.models import Department, Exam
from app.schemas import (
    DepartmentDto, CandidateVerifyRequest, CandidateVerifyResponse,
    CandidateStartAttemptResponse, AnswerSaveRequest, SubmissionResponse
)
from app.candidate.services import CandidateExamService

router = APIRouter(prefix="/api/candidate", tags=["Candidate Examination Portal"])

@router.get("/departments", response_model=List[DepartmentDto])
def get_eligible_departments(db: Session = Depends(get_db)):
    """
    Returns the department and college options for candidate entry:
    The two primary tracks (Technical and Non-Technical) followed by all registered colleges.
    """
    primary = [
        DepartmentDto(
            id=1,
            name="Technical Department",
            code="TECH",
            description="Technical Department (Engineering, Development, Testing, UI/UX)",
            active=True
        ),
        DepartmentDto(
            id=2,
            name="Non-Technical Department",
            code="NON_TECH",
            description="Non-Technical Department (Human Resources, Sales & Marketing, Management)",
            active=True
        )
    ]
    colleges = db.query(Department).filter(Department.active == True).order_by(Department.name).all()
    college_dtos = [
        DepartmentDto(
            id=c.id,
            name=c.name,
            code=c.code or f"COL_{c.id}",
            description=c.description or f"College: {c.name}",
            active=True
        )
        for c in colleges
        if c.name not in ("Technical Department", "Non-Technical Department")
    ]
    return primary + college_dtos

@router.post("/verify", response_model=CandidateVerifyResponse)
def verify_candidate(
    req: CandidateVerifyRequest,
    db: Session = Depends(get_db)
):
    return CandidateExamService.verify_candidate(db, req)

@router.post("/start", response_model=CandidateStartAttemptResponse)
def start_or_resume_attempt(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db)
):
    cand_id = payload.get("candidateId") or payload.get("candidate_id")
    exam_id = payload.get("examId") or payload.get("exam_id")
    if not cand_id or not exam_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="candidateId and examId are required"
        )
    return CandidateExamService.start_or_resume_attempt(db, int(cand_id), int(exam_id))

@router.post("/answers")
def save_answer(
    attemptId: Optional[int] = Query(None, alias="attemptId"),
    attempt_id: Optional[int] = Query(None, alias="attempt_id"),
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db)
):
    aid = attemptId or attempt_id or payload.get("attemptId") or payload.get("attempt_id")
    if not aid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="attemptId is required")
    qid = payload.get("questionId") if "questionId" in payload else payload.get("question_id")
    if qid is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="questionId is required")
    opt_id = payload.get("selectedOptionId") if "selectedOptionId" in payload else payload.get("selected_option_id")
    return CandidateExamService.save_answer(
        db, int(aid), int(qid), int(opt_id) if opt_id is not None else None
    )

@router.post("/submit", response_model=SubmissionResponse)
def submit_attempt(
    attemptId: Optional[int] = Query(None, alias="attemptId"),
    attempt_id: Optional[int] = Query(None, alias="attempt_id"),
    payload: Optional[Dict[str, Any]] = Body(None),
    db: Session = Depends(get_db)
):
    aid = attemptId or attempt_id
    answers_payload = None
    if payload:
        aid = aid or payload.get("attemptId") or payload.get("attempt_id")
        answers_payload = payload.get("answers")
    if not aid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="attemptId is required")
    return CandidateExamService.submit_attempt(db, int(aid), answers_payload=answers_payload)

@router.post("/proctor/warning")
def record_proctor_warning(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db)
):
    """
    Logs proctoring violation alerts (multi-face, absent face, background movement, tab switch) to AuditLog.
    """
    attempt_id = payload.get("attemptId") or payload.get("attempt_id")
    cand_id = payload.get("candidateId") or payload.get("candidate_id")
    warning_type = payload.get("warningType") or payload.get("type") or "PROCTOR_ALERT"
    message = payload.get("message") or "Proctoring notice detected"

    from app.models import AuditLog
    log = AuditLog(
        action=f"PROCTOR_{str(warning_type).upper()}",
        entity_type="ExamAttempt" if attempt_id else "Candidate",
        entity_id=str(attempt_id or cand_id or "UNKNOWN"),
        performed_by=f"CandidateProctor:{cand_id or attempt_id or 'FEED'}",
        details=message
    )
    db.add(log)
    db.commit()
    return {"success": True, "recorded": True}

# ==================== Round 2 Coding Assessments ====================
from app.schemas.coding import CodeRunRequest, CodeRunResponse, CodeSubmitRequest, CodeSubmitResponse, CodingExamDto
from app.candidate.services.code_runner_service import CodeRunnerService
from app.admin.services.coding_exam_service import CodingExamService

@router.get("/coding/exams", response_model=List[CodingExamDto])
def list_available_coding_exams(db: Session = Depends(get_db)):
    """Retrieves all active Round 2 Coding assessments for candidates."""
    return CodingExamService.get_all_coding_exams(db)

@router.get("/coding/exams/{exam_id}", response_model=CodingExamDto)
def get_coding_exam_for_candidate(exam_id: int, db: Session = Depends(get_db)):
    """Retrieves problem definitions and public test cases for a coding exam."""
    return CodingExamService.get_coding_exam_by_id(db, exam_id)

@router.post("/coding/run", response_model=CodeRunResponse)
def run_candidate_code(req: CodeRunRequest):
    """Runs candidate code against custom or sample inputs in a secure sandbox."""
    return CodeRunnerService.run_candidate_code(req)

@router.post("/coding/submit", response_model=CodeSubmitResponse)
def submit_candidate_code(req: CodeSubmitRequest, db: Session = Depends(get_db)):
    """Evaluates candidate code against all hidden & public test cases, scoring the attempt."""
    return CodeRunnerService.evaluate_and_submit_code(db, req)


