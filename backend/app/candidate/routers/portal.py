from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Query, Body, HTTPException, status, Request, Response
from sqlalchemy.orm import Session, joinedload

from app.core import (
    get_db, rate_limiter, get_client_ip,
    extract_token_from_request, verify_session_token, set_auth_cookie
)
from app.models import Department, Exam
from app.schemas import (
    DepartmentDto, CandidateVerifyRequest, CandidateVerifyResponse,
    CandidateStartAttemptResponse, AnswerSaveRequest, SubmissionResponse
)
from app.candidate.services import CandidateExamService

router = APIRouter(prefix="/api/candidate", tags=["Candidate Examination Portal"])

import time

_DEPT_CACHE = None
_DEPT_CACHE_TIME = 0.0

def _require_candidate_id(cid) -> int:
    """Ownership checks must never be skippable: candidateId is mandatory."""
    if cid is None or cid == "":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="candidateId is required")
    try:
        return int(cid)
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="candidateId must be an integer")


def _verify_candidate_ownership(request: Request, cid: Any) -> int:
    """Ownership guard: ensures candidateId matches the signed candidate session token if one is present."""
    int_cid = _require_candidate_id(cid)
    token = extract_token_from_request(request)
    if token:
        data = verify_session_token(token)
        if data and data.get("role") == "CANDIDATE" and "candidate_id" in data:
            token_cid = int(data["candidate_id"])
            if int_cid != token_cid:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: Candidate ID does not match active session token."
                )
    return int_cid


def _candidate_safe_exam(exam):
    """Strip hidden test cases so graders' inputs/expected outputs are never served to candidates."""
    for q in exam.questions:
        q.testCases = [tc for tc in q.testCases if not tc.isHidden]
    return exam

@router.get("/departments", response_model=List[DepartmentDto])
def get_eligible_departments(db: Session = Depends(get_db)):
    """
    Returns only the two primary candidate tracks: Technical Department and Non-Technical Department.
    """
    return [
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

@router.post("/verify", response_model=CandidateVerifyResponse)
@router.post("/login", response_model=CandidateVerifyResponse)
def verify_candidate(
    req: CandidateVerifyRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Candidate verification & login endpoint.
    Accepts candidate credentials (fullName, email, department/college) and returns examination eligibility.
    Available at both /api/candidate/verify and /api/candidate/login for full compatibility with load testing suites.
    """
    email_str = (req.email or "").strip().lower()
    email_key = f"candidate_email:{email_str}" if email_str else f"candidate_anon:{get_client_ip(request)}"

    if rate_limiter.is_blocked(email_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many verification attempts for this account. Please wait 15 minutes before retrying."
        )
    res = CandidateExamService.verify_candidate(db, req)
    if not res.eligible:
        msg_l = (res.message or "").lower()
        is_timing_or_system = any(w in msg_l for w in ["opens at", "entry closed", "scheduled for", "activated examination", "not available"])
        if not is_timing_or_system:
            rate_limiter.record_failed_attempt(email_key)
    else:
        rate_limiter.record_successful_attempt(email_key)
    return res

@router.post("/start", response_model=CandidateStartAttemptResponse)
def start_or_resume_attempt(
    request: Request,
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
    verified_cid = _verify_candidate_ownership(request, cand_id)
    return CandidateExamService.start_or_resume_attempt(db, verified_cid, int(exam_id))

@router.post("/answers")
def save_answer(
    request: Request,
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
    cid = payload.get("candidateId") or payload.get("candidate_id")
    verified_cid = _verify_candidate_ownership(request, cid)
    return CandidateExamService.save_answer(
        db, int(aid), int(qid), int(opt_id) if opt_id is not None else None,
        candidate_id=verified_cid
    )

@router.post("/submit", response_model=SubmissionResponse)
def submit_attempt(
    request: Request,
    attemptId: Optional[int] = Query(None, alias="attemptId"),
    attempt_id: Optional[int] = Query(None, alias="attempt_id"),
    candidateId: Optional[int] = Query(None, alias="candidateId"),
    candidate_id: Optional[int] = Query(None, alias="candidate_id"),
    payload: Optional[Dict[str, Any]] = Body(None),
    db: Session = Depends(get_db)
):
    aid = attemptId or attempt_id
    cid = candidateId or candidate_id
    answers_payload = None
    if payload:
        aid = aid or payload.get("attemptId") or payload.get("attempt_id")
        cid = cid or payload.get("candidateId") or payload.get("candidate_id")
        answers_payload = payload.get("answers")
    if not aid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="attemptId is required")
    verified_cid = _verify_candidate_ownership(request, cid)
    return CandidateExamService.submit_attempt(
        db, int(aid), answers_payload=answers_payload,
        candidate_id=verified_cid
    )

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
    return [_candidate_safe_exam(e) for e in CodingExamService.get_all_coding_exams(db) if e.status in ("ACTIVATED", "PUBLISHED")]

@router.get("/coding/exams/{exam_id}", response_model=CodingExamDto)
def get_coding_exam_for_candidate(exam_id: int, db: Session = Depends(get_db)):
    """Retrieves problem definitions and public test cases for a coding exam."""
    exam = CodingExamService.get_coding_exam_by_id(db, exam_id)
    if exam.status not in ("ACTIVATED", "PUBLISHED"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Coding exam {exam_id} not found")
    return _candidate_safe_exam(exam)

@router.post("/coding/run", response_model=CodeRunResponse)
def run_candidate_code(req: CodeRunRequest):
    """Runs candidate code against custom or sample inputs in a secure sandbox."""
    # DISABLED: unauthenticated, unsandboxed code execution (audit report 2). Re-enable only with auth + sandbox.
    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Code execution is temporarily disabled until a sandboxed runner is available.")

@router.post("/coding/submit", response_model=CodeSubmitResponse)
def submit_candidate_code(req: CodeSubmitRequest, db: Session = Depends(get_db)):
    """Evaluates candidate code against all hidden & public test cases, scoring the attempt."""
    # DISABLED: see /coding/run.
    raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Code execution is temporarily disabled until a sandboxed runner is available.")


