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
    Returns active academic departments dynamically from the database,
    categorized as TECHNICAL or NON_TECHNICAL.
    """
    from app.models import Department
    from app.admin.routers.departments import is_academic_department, to_dto

    depts = db.query(Department).filter(Department.active == True).all()
    academic_depts = [d for d in depts if is_academic_department(d)]
    
    # Preferred order matching client examination streams
    preferred_order = [
        "Computer Science & Engineering (CSE)",
        "Information Science & Engineering (ISE)",
        "Master of Computer Applications (MCA)",
        "Information Technology (IT)",
        "AI & Machine Learning (CSE-AIML)",
        "Data Science (CSE-DS)",
        "IoT & Cyber Security (CSE-IOT)"
    ]
    name_to_rank = {name.lower(): idx for idx, name in enumerate(preferred_order)}
    academic_depts.sort(key=lambda d: (name_to_rank.get((d.name or "").lower(), 999), d.name or ""))
    
    return [to_dto(d) for d in academic_depts]

@router.get("/slot-timings")
def get_candidate_slot_timings(db: Session = Depends(get_db)):
    """
    Public endpoint providing live examination slot schedules and entry cutoff windows
    so candidate portals dynamically reflect real-time administrative changes.
    """
    from app.core.slot_config import get_slot_timings_config
    return get_slot_timings_config(db=db)

@router.post("/verify", response_model=CandidateVerifyResponse)
@router.post("/login", response_model=CandidateVerifyResponse)
def verify_candidate(
    req: CandidateVerifyRequest,
    request: Request,
    response: Response,
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
        if res.token:
            try:
                set_auth_cookie(response, res.token)
            except Exception:
                pass
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

@router.get("/heartbeat")
def get_candidate_heartbeat(
    request: Request,
    candidateId: Optional[int] = Query(None, alias="candidateId"),
    candidate_id: Optional[int] = Query(None, alias="candidate_id"),
    attemptId: Optional[int] = Query(None, alias="attemptId"),
    attempt_id: Optional[int] = Query(None, alias="attempt_id"),
    db: Session = Depends(get_db)
):
    """
    Real-time candidate exam session heartbeat.
    Checks for administrator timer updates (+10 mins) and live exam stop/termination commands.
    """
    cid = candidateId or candidate_id
    if not cid:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="candidateId is required")
    verified_cid = _verify_candidate_ownership(request, cid)

    from datetime import datetime, timezone
    from app.models import ExamAttempt, Candidate

    now = datetime.now(timezone.utc)
    aid = attemptId or attempt_id
    query = db.query(ExamAttempt).filter(ExamAttempt.candidate_id == verified_cid)
    if aid:
        query = query.filter(ExamAttempt.id == int(aid))
    attempt = query.order_by(ExamAttempt.created_at.desc()).first()

    cand = db.query(Candidate).filter(Candidate.id == verified_cid).first()
    if cand and cand.status in ("DISCARDED", "STOPPED"):
        return {
            "status": "TERMINATED",
            "terminationReason": "Your examination session has been terminated by the administrator.",
            "serverTime": now.isoformat()
        }

    if not attempt:
        return {
            "status": "NONE",
            "serverTime": now.isoformat()
        }

    if attempt.status in ("DISCARDED", "STOPPED"):
        return {
            "status": "TERMINATED",
            "terminationReason": getattr(attempt, "termination_reason", None) or "Your examination session has been stopped by the administrator.",
            "serverTime": now.isoformat()
        }

    exp_utc = None
    if attempt.expires_at:
        exp_utc = attempt.expires_at if attempt.expires_at.tzinfo else attempt.expires_at.replace(tzinfo=timezone.utc)
    rem_sec = max(0, int((exp_utc - now).total_seconds())) if exp_utc else 0

    return {
        "status": attempt.status,
        "attemptId": attempt.id,
        "expiresAt": attempt.expires_at.isoformat() if attempt.expires_at else None,
        "deadlineMs": int(exp_utc.timestamp() * 1000) if exp_utc else None,
        "remainingSeconds": rem_sec,
        "extraTimeMinutes": getattr(attempt, "extra_time_minutes", 0) or 0,
        "serverTime": now.isoformat(),
        "terminationReason": getattr(attempt, "termination_reason", None)
    }

@router.post("/proctor/alert")
def record_candidate_proctor_alert(
    request: Request,
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db)
):
    """
    Records real-time cheating alerts (tab switch, SEB exit, multiple faces, etc.) to the database.
    """
    cand_id = payload.get("candidateId") or payload.get("candidate_id")
    if not cand_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="candidateId is required")
    verified_cid = _verify_candidate_ownership(request, cand_id)

    attempt_id = payload.get("attemptId") or payload.get("attempt_id")
    alert_type = payload.get("alertType") or payload.get("type") or "SUSPICIOUS_ACTIVITY"
    message = payload.get("message") or "Suspicious activity detected"
    severity = payload.get("severity") or "MEDIUM"

    from app.admin.services.live_monitoring_service import LiveMonitoringService
    alert = LiveMonitoringService.record_proctor_alert(
        db,
        candidate_id=verified_cid,
        attempt_id=int(attempt_id) if attempt_id else None,
        alert_type=str(alert_type),
        message=str(message),
        severity=str(severity)
    )
    if not alert:
        return {"success": False, "message": "Proctor alert could not be recorded (candidate or session not found)."}
    return {"success": True, "alertId": alert.id, "alertType": alert.alert_type}

@router.post("/proctor/warning")
def record_proctor_warning(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db)
):
    """
    Logs proctoring violation alerts (multi-face, absent face, background movement, tab switch) to AuditLog and ProctorAlert.
    """
    attempt_id = payload.get("attemptId") or payload.get("attempt_id")
    cand_id = payload.get("candidateId") or payload.get("candidate_id")
    warning_type = payload.get("warningType") or payload.get("type") or "PROCTOR_ALERT"
    message = payload.get("message") or "Proctoring notice detected"

    from app.admin.services.live_monitoring_service import LiveMonitoringService
    if cand_id:
        try:
            LiveMonitoringService.record_proctor_alert(
                db,
                candidate_id=int(cand_id),
                attempt_id=int(attempt_id) if attempt_id else None,
                alert_type=str(warning_type),
                message=str(message),
                severity="MEDIUM"
            )
        except Exception:
            pass

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

# In-memory registry of latest candidate proctor frames for real-time invigilator feed
LATEST_CANDIDATE_FRAMES: Dict[int, Dict[str, Any]] = {}

@router.post("/proctor/analyze-frame")
def analyze_proctor_frame(
    request: Request,
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db)
):
    """
    Receives candidate front-camera snapshot, runs OpenCV Haar Face Detection in real-time,
    stores latest frame for live admin surveillance, and flags MULTI_FACE or NO_FACE.
    """
    import base64
    cand_id = payload.get("candidateId") or payload.get("candidate_id")
    if not cand_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="candidateId is required")
    verified_cid = _verify_candidate_ownership(request, cand_id)

    attempt_id = payload.get("attemptId") or payload.get("attempt_id")
    image_b64 = payload.get("imageBase64") or payload.get("image") or ""
    
    faces_detected = 1
    alert_triggered = None
    alert_msg = None

    if image_b64:
        try:
            if "," in image_b64:
                image_b64 = image_b64.split(",", 1)[1]

            import cv2
            import numpy as np
            img_bytes = base64.b64decode(image_b64)
            np_arr = np.frombuffer(img_bytes, np.uint8)
            img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

            if img is not None:
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
                face_cascade = cv2.CascadeClassifier(cascade_path)
                faces = face_cascade.detectMultiScale(gray, scaleFactor=1.15, minNeighbors=4, minSize=(35, 35))
                faces_detected = len(faces)

                # Eye / Gaze Cascade for Lap Glance / Off-Screen Detection
                off_screen_gaze = False
                if faces_detected == 1:
                    x, y, w, h = faces[0]
                    face_roi_gray = gray[y:y+h, x:x+w]
                    eye_cascade_path = cv2.data.haarcascades + 'haarcascade_eye.xml'
                    eye_cascade = cv2.CascadeClassifier(eye_cascade_path)
                    eyes = eye_cascade.detectMultiScale(face_roi_gray, scaleFactor=1.1, minNeighbors=3, minSize=(10, 10))
                    # If face center is in the bottom of the frame or eyes looking down continuously:
                    img_h, _ = gray.shape
                    face_center_y = y + h / 2
                    if face_center_y > img_h * 0.82:
                        off_screen_gaze = True

                # Cache latest frame for live admin viewing
                LATEST_CANDIDATE_FRAMES[verified_cid] = {
                    "candidateId": verified_cid,
                    "attemptId": int(attempt_id) if attempt_id else None,
                    "imageBase64": image_b64,
                    "facesDetected": faces_detected,
                    "offScreenGaze": off_screen_gaze,
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }

                from app.admin.services.live_monitoring_service import LiveMonitoringService
                if faces_detected > 1:
                    alert_triggered = "MULTI_FACE"
                    alert_msg = f"Multiple individuals ({faces_detected} faces) detected in candidate camera!"
                    LiveMonitoringService.record_proctor_alert(
                        db,
                        candidate_id=verified_cid,
                        attempt_id=int(attempt_id) if attempt_id else None,
                        alert_type="MULTI_FACE",
                        message=alert_msg,
                        severity="HIGH"
                    )
                elif faces_detected == 0:
                    alert_triggered = "NO_FACE"
                    alert_msg = "No candidate face visible in camera field!"
                    LiveMonitoringService.record_proctor_alert(
                        db,
                        candidate_id=verified_cid,
                        attempt_id=int(attempt_id) if attempt_id else None,
                        alert_type="NO_FACE",
                        message=alert_msg,
                        severity="MEDIUM"
                    )
                elif off_screen_gaze:
                    alert_triggered = "OFF_SCREEN_GAZE"
                    alert_msg = "Candidate looking downwards away from screen (suspicious lap / secondary device gaze)!"
                    LiveMonitoringService.record_proctor_alert(
                        db,
                        candidate_id=verified_cid,
                        attempt_id=int(attempt_id) if attempt_id else None,
                        alert_type="OFF_SCREEN_GAZE",
                        message=alert_msg,
                        severity="MEDIUM"
                    )
        except Exception as e:
            logger.warning(f"Frame analysis error: {e}")

    return {
        "success": True,
        "facesDetected": faces_detected,
        "alert": alert_triggered,
        "message": alert_msg
    }

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


