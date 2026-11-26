import asyncio
import json
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import (
    APIRouter, Depends, HTTPException, Request, Response, WebSocket, WebSocketDisconnect, status
)
from fastapi.responses import PlainTextResponse, StreamingResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.core.database import get_db
from app.core.security import extract_token_from_request, verify_session_token
from app.models.attempt import ExamAttempt
from app.models.candidate import Candidate
from app.models.coding import CodingAttempt, CodingExam, CodingQuestion, CodingSubmission
from app.coding.metrics import coding_metrics, log_coding_event
from app.coding.queue import coding_queue_manager
from app.coding.schemas import (
    CodingEnqueueResponse,
    CodingProblemPublicDto,
    CodingRunRequest,
    CodingSubmissionStatusDto,
    CodingSubmitRequest,
    SampleTestCaseDto,
    TestCaseVerdictDto,
)

router = APIRouter(prefix="/api/coding", tags=["Round 2 Coding"])

# Lightweight TTL cache for public problem statements (safe across workers since problem text is read-only during exam)
_PROBLEM_CACHE: Dict[str, Tuple[float, CodingProblemPublicDto]] = {}
_PROBLEM_CACHE_TTL_S = 60.0

LANGUAGE_ALIASES = {
    "py": "python3",
    "python": "python3",
    "python3": "python3",
    "js": "javascript",
    "node": "javascript",
    "javascript": "javascript",
    "c++": "cpp",
    "cpp": "cpp",
    "c": "c",
    "java": "java",
}


def _require_coding_enabled() -> None:
    if not settings.CODING_ROUND_ENABLED:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Round 2 Coding Round is currently disabled.",
        )


def _require_candidate_from_request(request: Request, db: Session) -> Candidate:
    token = extract_token_from_request(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Candidate authentication required.")
    data = verify_session_token(token)
    if not data or data.get("role") != "CANDIDATE" or "candidate_id" not in data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired candidate session.")
    cand = db.query(Candidate).filter(Candidate.id == int(data["candidate_id"])).first()
    if not cand:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Candidate record not found.")
    return cand


def _verify_round2_eligibility(cand: Candidate, db: Session) -> None:
    if not settings.CODING_REQUIRE_ROUND1_QUALIFIED:
        return
    qualified_attempt = (
        db.query(ExamAttempt)
        .filter(
            ExamAttempt.candidate_id == cand.id,
            ExamAttempt.status == "SUBMITTED",
            ExamAttempt.qualification_status == "QUALIFIED",
        )
        .first()
    )
    if not qualified_attempt:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Candidate is not eligible for Round 2 (Round 1 qualification required).",
        )


def _normalize_and_validate_input(language: str, code: str, custom_input: Optional[str], allowed_langs: List[str]) -> str:
    norm_lang = LANGUAGE_ALIASES.get((language or "").strip().lower(), (language or "").strip().lower())
    effective_allow = allowed_langs or settings.CODING_ALLOWED_LANGUAGES
    normalized_allow = {LANGUAGE_ALIASES.get(l.lower(), l.lower()) for l in effective_allow}
    if norm_lang not in normalized_allow or norm_lang not in settings.CODING_ALLOWED_LANGUAGES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Language '{language}' is not allowed for this problem.",
        )
    if not code or not code.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Source code cannot be empty.")
    if len(code.encode("utf-8")) > settings.CODING_MAX_CODE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Source code exceeds max size of {settings.CODING_MAX_CODE_BYTES} bytes.",
        )
    if custom_input and len(custom_input.encode("utf-8")) > settings.CODING_MAX_INPUT_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Custom input exceeds max size of {settings.CODING_MAX_INPUT_BYTES} bytes.",
        )
    return norm_lang


def _get_or_create_active_coding_attempt(cand: Candidate, exam_id: int, db: Session) -> CodingAttempt:
    exam = db.query(CodingExam).filter(CodingExam.id == exam_id).first()
    if not exam or exam.status not in ("ACTIVATED", "PUBLISHED"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Active coding exam not found.")

    attempt = (
        db.query(CodingAttempt)
        .filter(CodingAttempt.candidate_id == cand.id, CodingAttempt.exam_id == exam.id)
        .first()
    )
    now = datetime.now(timezone.utc)
    if not attempt:
        expires_at = now + timedelta(minutes=int(exam.duration_minutes or 60))
        attempt = CodingAttempt(
            candidate_id=cand.id,
            exam_id=exam.id,
            status="IN_PROGRESS",
            total_marks=exam.total_marks or 100,
            started_at=now,
            expires_at=expires_at,
        )
        db.add(attempt)
        db.commit()
        db.refresh(attempt)
    else:
        if attempt.status == "SUBMITTED":
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Coding attempt already submitted.")
        expires_at = attempt.expires_at
        if expires_at is None:
            expires_at = (attempt.started_at or now) + timedelta(
                minutes=int(exam.duration_minutes or 60) + int(attempt.extra_time_minutes or 0)
            )
            attempt.expires_at = expires_at
            db.commit()
        elif expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if now > expires_at:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Coding exam time has expired.")
    return attempt


def _submission_to_dto(sub: CodingSubmission, max_marks: float) -> CodingSubmissionStatusDto:
    raw_results = []
    try:
        raw_results = json.loads(sub.test_case_results or "[]")
    except Exception:
        raw_results = []

    safe_results: List[TestCaseVerdictDto] = []
    for item in raw_results:
        is_hidden = bool(item.get("isHidden"))
        if is_hidden:
            # Never expose hidden test inputs, outputs, or raw stderr to client
            safe_results.append(
                TestCaseVerdictDto(
                    testCaseId=str(item.get("testCaseId", "")),
                    label=str(item.get("label", "Hidden Test")),
                    passed=bool(item.get("passed")),
                    isHidden=True,
                    verdict=str(item.get("verdict", sub.verdict)),
                    runtimeMs=item.get("runtimeMs"),
                    memoryKb=item.get("memoryKb"),
                )
            )
        else:
            safe_results.append(
                TestCaseVerdictDto(
                    testCaseId=str(item.get("testCaseId", "")),
                    label=str(item.get("label", "Sample Test")),
                    passed=bool(item.get("passed")),
                    isHidden=False,
                    verdict=str(item.get("verdict", sub.verdict)),
                    runtimeMs=item.get("runtimeMs"),
                    memoryKb=item.get("memoryKb"),
                    input=item.get("input"),
                    expectedOutput=item.get("expectedOutput"),
                    actualOutput=item.get("actualOutput"),
                    error=item.get("error"),
                )
            )

    return CodingSubmissionStatusDto(
        submissionId=int(sub.id),
        attemptId=int(sub.attempt_id),
        questionId=sub.question_id,
        language=sub.language,
        isRunOnly=bool(sub.is_run_only),
        verdict=sub.verdict or sub.status,
        status=sub.status,
        passedCount=int(sub.passed_test_cases or 0),
        totalCount=int(sub.total_test_cases or 0),
        score=float(sub.marks_awarded or 0),
        maxMarks=float(max_marks),
        runtimeMs=sub.runtime_ms,
        memoryKb=sub.memory_kb,
        errorMessage=sub.error_message,
        testCaseResults=safe_results,
        submittedAt=sub.submitted_at.isoformat() if sub.submitted_at else None,
        updatedAt=sub.updated_at.isoformat() if sub.updated_at else None,
    )


@router.get("/health")
async def coding_health():
    redis_ok = await coding_queue_manager.is_redis_healthy()
    q_depth = await coding_queue_manager.get_queue_depth()
    return {
        "enabled": settings.CODING_ROUND_ENABLED,
        "driver": settings.CODING_SANDBOX_DRIVER,
        "redisConnected": redis_ok,
        "queueDepth": q_depth,
    }


@router.get("/metrics", response_class=PlainTextResponse)
async def coding_metrics_endpoint():
    q_depth = await coding_queue_manager.get_queue_depth()
    return PlainTextResponse(coding_metrics.render_prometheus(queue_depth=q_depth), media_type="text/plain")


@router.get("/problems/{problem_id}", response_model=CodingProblemPublicDto)
def get_coding_problem(
    problem_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    _require_coding_enabled()
    cand = _require_candidate_from_request(request, db)
    _verify_round2_eligibility(cand, db)

    now = time.time()
    cached = _PROBLEM_CACHE.get(problem_id)
    if cached and (now - cached[0]) < _PROBLEM_CACHE_TTL_S:
        return cached[1]

    q = (
        db.query(CodingQuestion)
        .options(joinedload(CodingQuestion.test_cases), joinedload(CodingQuestion.exam))
        .filter(CodingQuestion.id == problem_id)
        .first()
    )
    if not q or not q.exam or q.exam.status not in ("ACTIVATED", "PUBLISHED"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coding problem not found.")

    try:
        allowed_langs = json.loads(q.allowed_languages or "[]")
    except Exception:
        allowed_langs = []
    if not allowed_langs:
        try:
            allowed_langs = json.loads(q.exam.allowed_languages or "[]")
        except Exception:
            allowed_langs = settings.CODING_ALLOWED_LANGUAGES

    try:
        starter_code = json.loads(q.starter_code_json or "{}")
    except Exception:
        starter_code = {}

    sample_cases = [
        SampleTestCaseDto(
            id=tc.id,
            label=tc.label,
            input=tc.input_data or "",
            expectedOutput=tc.expected_output or "",
            explanation=tc.explanation,
        )
        for tc in q.test_cases
        if not tc.is_hidden
    ]

    dto = CodingProblemPublicDto(
        id=q.id,
        examId=int(q.exam_id),
        title=q.title,
        problemStatement=q.problem_statement,
        difficulty=q.difficulty,
        maxMarks=int(q.max_marks or 20),
        inputFormat=q.input_format or "",
        outputFormat=q.output_format or "",
        constraints=q.constraints or "",
        sampleInput=q.sample_input or "",
        sampleOutput=q.sample_output or "",
        sampleExplanation=q.sample_explanation or "",
        allowedLanguages=allowed_langs,
        timeLimitMs=int(q.time_limit_ms or 2000),
        memoryLimitMb=int(q.memory_limit_mb or 256),
        starterCode=starter_code,
        sampleTestCases=sample_cases,
    )
    _PROBLEM_CACHE[problem_id] = (now, dto)
    return dto


@router.post("/run", response_model=CodingEnqueueResponse, status_code=status.HTTP_202_ACCEPTED)
async def run_coding_sample(
    req: CodingRunRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    _require_coding_enabled()
    cand = _require_candidate_from_request(request, db)
    _verify_round2_eligibility(cand, db)
    attempt = _get_or_create_active_coding_attempt(cand, req.examId, db)

    q = db.query(CodingQuestion).filter(CodingQuestion.id == req.questionId, CodingQuestion.exam_id == req.examId).first()
    if not q:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coding problem not found.")

    try:
        q_langs = json.loads(q.allowed_languages or "[]")
    except Exception:
        q_langs = []
    norm_lang = _normalize_and_validate_input(req.language, req.code, req.customInput, q_langs)

    await coding_queue_manager.ensure_connected()
    q_depth = await coding_queue_manager.get_queue_depth()
    guard = coding_queue_manager.get_guard()
    allowed, retry_after, reason = await guard.check_and_acquire(cand.id, q_depth)
    if not allowed:
        if q_depth >= settings.CODING_MAX_QUEUE_DEPTH:
            coding_metrics.queue_rejected_total += 1
        else:
            coding_metrics.rate_limited_total += 1
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=reason,
            headers={"Retry-After": str(retry_after)},
        )

    sub = CodingSubmission(
        attempt_id=attempt.id,
        candidate_id=cand.id,
        question_id=q.id,
        language=norm_lang,
        source_code=req.code,
        idempotency_key=req.idempotencyKey,
        is_run_only=True,
        verdict="QUEUED",
        status="QUEUED",
        error_message=f"__CUSTOM_INPUT__:{req.customInput}" if req.customInput is not None else None,
    )
    try:
        db.add(sub)
        db.commit()
        db.refresh(sub)
    except IntegrityError:
        db.rollback()
        await guard.release_concurrency(cand.id)
        existing = (
            db.query(CodingSubmission)
            .filter(CodingSubmission.attempt_id == attempt.id, CodingSubmission.idempotency_key == req.idempotencyKey)
            .first()
        )
        if existing:
            return CodingEnqueueResponse(
                submissionId=int(existing.id),
                attemptId=int(existing.attempt_id),
                jobId=existing.job_id,
                verdict=existing.verdict,
                status=existing.status,
                idempotentReplay=True,
            )
        raise

    job_id = await coding_queue_manager.enqueue_submission(int(sub.id), int(cand.id))
    sub.job_id = job_id
    db.commit()
    log_coding_event("coding_run_enqueued", submission_id=sub.id, candidate_id=cand.id, language=norm_lang)

    return CodingEnqueueResponse(
        submissionId=int(sub.id),
        attemptId=int(attempt.id),
        jobId=job_id,
        verdict="QUEUED",
        status="QUEUED",
    )


@router.post("/submit", response_model=CodingEnqueueResponse, status_code=status.HTTP_202_ACCEPTED)
async def submit_coding_solution(
    req: CodingSubmitRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    _require_coding_enabled()
    cand = _require_candidate_from_request(request, db)
    _verify_round2_eligibility(cand, db)
    attempt = _get_or_create_active_coding_attempt(cand, req.examId, db)

    # Fast-path idempotency check before hitting rate limit / queue
    existing = (
        db.query(CodingSubmission)
        .filter(CodingSubmission.attempt_id == attempt.id, CodingSubmission.idempotency_key == req.idempotencyKey)
        .first()
    )
    if existing:
        return CodingEnqueueResponse(
            submissionId=int(existing.id),
            attemptId=int(existing.attempt_id),
            jobId=existing.job_id,
            verdict=existing.verdict,
            status=existing.status,
            idempotentReplay=True,
        )

    q = db.query(CodingQuestion).filter(CodingQuestion.id == req.questionId, CodingQuestion.exam_id == req.examId).first()
    if not q:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coding problem not found.")

    try:
        q_langs = json.loads(q.allowed_languages or "[]")
    except Exception:
        q_langs = []
    norm_lang = _normalize_and_validate_input(req.language, req.code, None, q_langs)

    await coding_queue_manager.ensure_connected()
    q_depth = await coding_queue_manager.get_queue_depth()
    guard = coding_queue_manager.get_guard()
    allowed, retry_after, reason = await guard.check_and_acquire(cand.id, q_depth)
    if not allowed:
        if q_depth >= settings.CODING_MAX_QUEUE_DEPTH:
            coding_metrics.queue_rejected_total += 1
        else:
            coding_metrics.rate_limited_total += 1
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=reason,
            headers={"Retry-After": str(retry_after)},
        )

    sub = CodingSubmission(
        attempt_id=attempt.id,
        candidate_id=cand.id,
        question_id=q.id,
        language=norm_lang,
        source_code=req.code,
        idempotency_key=req.idempotencyKey,
        is_run_only=False,
        verdict="QUEUED",
        status="QUEUED",
    )
    try:
        db.add(sub)
        db.commit()
        db.refresh(sub)
    except IntegrityError:
        db.rollback()
        await guard.release_concurrency(cand.id)
        existing_dup = (
            db.query(CodingSubmission)
            .filter(CodingSubmission.attempt_id == attempt.id, CodingSubmission.idempotency_key == req.idempotencyKey)
            .first()
        )
        if existing_dup:
            return CodingEnqueueResponse(
                submissionId=int(existing_dup.id),
                attemptId=int(existing_dup.attempt_id),
                jobId=existing_dup.job_id,
                verdict=existing_dup.verdict,
                status=existing_dup.status,
                idempotentReplay=True,
            )
        raise

    job_id = await coding_queue_manager.enqueue_submission(int(sub.id), int(cand.id))
    sub.job_id = job_id
    db.commit()
    log_coding_event("coding_submit_enqueued", submission_id=sub.id, candidate_id=cand.id, language=norm_lang)

    return CodingEnqueueResponse(
        submissionId=int(sub.id),
        attemptId=int(attempt.id),
        jobId=job_id,
        verdict="QUEUED",
        status="QUEUED",
    )


@router.get("/submissions/{submission_id}", response_model=CodingSubmissionStatusDto)
def get_coding_submission(
    submission_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    _require_coding_enabled()
    cand = _require_candidate_from_request(request, db)
    sub = (
        db.query(CodingSubmission)
        .options(joinedload(CodingSubmission.question), joinedload(CodingSubmission.attempt))
        .filter(CodingSubmission.id == submission_id)
        .first()
    )
    if not sub or not sub.attempt or int(sub.attempt.candidate_id) != int(cand.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")
    max_marks = float(sub.question.max_marks or 20) if sub.question else 20.0
    return _submission_to_dto(sub, max_marks)


@router.get("/problems/{problem_id}/submissions", response_model=List[CodingSubmissionStatusDto])
def list_problem_submissions(
    problem_id: str,
    request: Request,
    db: Session = Depends(get_db),
):
    _require_coding_enabled()
    cand = _require_candidate_from_request(request, db)
    subs = (
        db.query(CodingSubmission)
        .options(joinedload(CodingSubmission.question), joinedload(CodingSubmission.attempt))
        .filter(
            CodingSubmission.candidate_id == cand.id,
            CodingSubmission.question_id == problem_id,
            CodingSubmission.is_run_only == False,  # noqa: E712
        )
        .order_by(CodingSubmission.submitted_at.desc())
        .limit(25)
        .all()
    )
    return [
        _submission_to_dto(s, float(s.question.max_marks or 20) if s.question else 20.0)
        for s in subs
    ]


@router.get("/exams/{exam_id}/attempt")
def get_or_start_coding_attempt_info(
    exam_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    _require_coding_enabled()
    cand = _require_candidate_from_request(request, db)
    _verify_round2_eligibility(cand, db)
    attempt = _get_or_create_active_coding_attempt(cand, exam_id, db)
    exam = db.query(CodingExam).options(joinedload(CodingExam.questions)).filter(CodingExam.id == exam_id).first()
    now = datetime.now(timezone.utc)
    return {
        "attemptId": int(attempt.id),
        "examId": int(exam.id),
        "title": exam.title,
        "status": attempt.status,
        "startedAt": attempt.started_at.isoformat() if attempt.started_at else None,
        "expiresAt": attempt.expires_at.isoformat() if attempt.expires_at else None,
        "serverTime": now.isoformat(),
        "questionIds": [q.id for q in (exam.questions or [])],
    }


@router.get("/events/{submission_id}")
async def stream_submission_events(
    submission_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    """Server-Sent Events (SSE) stream for live submission updates via Redis Pub/Sub."""
    _require_coding_enabled()
    cand = _require_candidate_from_request(request, db)
    sub = (
        db.query(CodingSubmission)
        .options(joinedload(CodingSubmission.attempt))
        .filter(CodingSubmission.id == submission_id)
        .first()
    )
    if not sub or not sub.attempt or int(sub.attempt.candidate_id) != int(cand.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")

    async def event_generator():
        # If already terminal, emit immediately and close
        if sub.status not in ("QUEUED", "RUNNING"):
            payload = {"submissionId": submission_id, "status": sub.status, "verdict": sub.verdict}
            yield f"data: {json.dumps(payload)}\n\n"
            return

        async for msg in coding_queue_manager.subscribe_submission(submission_id, timeout_s=35.0):
            if await request.is_disconnected():
                break
            yield f"data: {json.dumps(msg)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.websocket("/ws/{submission_id}")
async def websocket_submission_events(websocket: WebSocket, submission_id: int, db: Session = Depends(get_db)):
    if not settings.CODING_ROUND_ENABLED:
        await websocket.close(code=1013)
        return
    token = websocket.query_params.get("token") or websocket.cookies.get(settings.SESSION_COOKIE_NAME)
    data = verify_session_token(token) if token else None
    if not data or data.get("role") != "CANDIDATE":
        await websocket.close(code=1008)
        return

    sub = (
        db.query(CodingSubmission)
        .options(joinedload(CodingSubmission.attempt))
        .filter(CodingSubmission.id == submission_id)
        .first()
    )
    if not sub or not sub.attempt or int(sub.attempt.candidate_id) != int(data.get("candidate_id", -1)):
        await websocket.close(code=1008)
        return

    await websocket.accept()
    try:
        if sub.status not in ("QUEUED", "RUNNING"):
            await websocket.send_json({"submissionId": submission_id, "status": sub.status, "verdict": sub.verdict})
            return
        async for msg in coding_queue_manager.subscribe_submission(submission_id, timeout_s=35.0):
            await websocket.send_json(msg)
    except WebSocketDisconnect:
        pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
