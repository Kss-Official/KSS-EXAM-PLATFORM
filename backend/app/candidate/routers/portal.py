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

