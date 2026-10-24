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
    Returns the two primary departments for candidate self-selection on the entry portal:
    Technical Department and Non-Technical Department.
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

