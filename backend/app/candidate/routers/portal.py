from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Query, Body, HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.core import get_db
from app.models import Department, Exam
from app.schemas import (
    DepartmentDto, CandidateVerifyRequest, CandidateVerifyResponse,
    CandidateStartAttemptResponse, AnswerSaveRequest, SubmissionResponse,
    CodeRunRequest, CodeRunResponse, CodeSubmitRequest, CodeSubmitResponse
)
from app.candidate.services import CandidateExamService

router = APIRouter(prefix="/api/candidate", tags=["Candidate Examination Portal"])

@router.get("/departments", response_model=List[DepartmentDto])
def get_eligible_departments(db: Session = Depends(get_db)):
    """
    Returns active departments that have an eligible published examination.
    Uses eager loading to avoid N+1 query overhead.
    """
    published_exams = db.query(Exam).options(
        joinedload(Exam.departments)
    ).filter(Exam.status == "PUBLISHED").all()

    # Check if there is any published exam open to all departments
    has_universal_exam = any(not exam.departments for exam in published_exams)

    if not published_exams or has_universal_exam:
        depts = db.query(Department).options(
            joinedload(Department.exams)
        ).filter(Department.active == True).order_by(Department.name.asc()).all()
    else:
        dept_ids = {d.id for exam in published_exams for d in (exam.departments or []) if d.active}
        if not dept_ids:
            depts = db.query(Department).options(
                joinedload(Department.exams)
            ).filter(Department.active == True).order_by(Department.name.asc()).all()
        else:
            depts = db.query(Department).options(
                joinedload(Department.exams)
            ).filter(
                Department.id.in_(dept_ids),
                Department.active == True
            ).order_by(Department.name.asc()).all()

    return [
        DepartmentDto(
            id=d.id,
            name=d.name,
            code=d.code,
            description=d.description,
            active=d.active,
            created_at=d.created_at,
            associated_exams_count=len(d.exams) if d.exams else 0
        )
        for d in depts
    ]

@router.post("/verify", response_model=CandidateVerifyResponse)
def verify_candidate(
    req: CandidateVerifyRequest,
    db: Session = Depends(get_db)
):
    result = CandidateExamService.verify_candidate(db, req)
    # Raise 403 when access code has reached its usage limit (expired)
    if not result.eligible and result.access_code and result.access_code_uses is not None:
        if result.access_code_uses >= (result.access_code_max_uses or 3):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=result.message or (
                    f"This Unique Access ID ({result.access_code}) has reached its maximum limit "
                    f"({result.access_code_uses}/{result.access_code_max_uses} uses) and is permanently expired."
                )
            )
    return result

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
    if not aid and payload:
        aid = payload.get("attemptId") or payload.get("attempt_id")
    if not aid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="attemptId is required")
    return CandidateExamService.submit_attempt(db, int(aid))

# =========================================================================
# ROUND 2: CODING ASSESSMENT CANDIDATE TERMINAL ENDPOINTS
# =========================================================================

@router.post("/coding/run", response_model=CodeRunResponse)
def run_coding_sample(
    req: CodeRunRequest
):
    """
    Executes candidate code against sample or custom input in a sandbox.
    Captures stdout, stderr, compile errors, and runtime limits.
    """
    from app.candidate.services.code_runner_service import CodeRunnerService
    return CodeRunnerService.run_candidate_code(req)

@router.post("/coding/submit", response_model=CodeSubmitResponse)
def submit_coding_solution(
    req: CodeSubmitRequest,
    db: Session = Depends(get_db)
):
    """
    Submits candidate code for final automated grading across all test cases
    (both public sample and hidden evaluation test cases).
    """
    from app.candidate.services.code_runner_service import CodeRunnerService
    return CodeRunnerService.evaluate_and_submit_code(db, req)

@router.get("/coding/exam/{exam_id}")
def get_candidate_coding_exam(
    exam_id: int,
    db: Session = Depends(get_db)
):
    """
    Retrieves questions for a published coding assessment for candidate viewing.
    Masks hidden evaluation test cases from the client payload.
    """
    from app.models.coding import CodingExam
    from app.admin.services.coding_exam_service import CodingExamService
    dto = CodingExamService.get_coding_exam_by_id(db, exam_id)
    # Mask hidden test cases
    for q in dto.questions:
        q.testCases = [tc for tc in q.testCases if not tc.isHidden]
    return dto
