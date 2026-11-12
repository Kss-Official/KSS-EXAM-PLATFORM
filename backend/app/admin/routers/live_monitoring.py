from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Query, Body, HTTPException, status
from sqlalchemy.orm import Session

from app.core import get_db, require_super_admin
from app.models import AppUser
from app.schemas.live_monitoring import (
    LiveExamineeDto, ProctorAlertDto, GiveExtraTimeRequest,
    StopExamRequest, ReviewAlertRequest
)
from app.admin.services.live_monitoring_service import LiveMonitoringService

router = APIRouter(prefix="/api/admin/live-monitoring", tags=["Admin Live Exam Monitoring & Proctoring"])

@router.get("/examinees", response_model=List[LiveExamineeDto])
def get_live_examinees(
    date: Optional[str] = Query(None, description="Date filter (YYYY-MM-DD or ALL)"),
    batch: Optional[str] = Query(None, description="Slot/batch filter (Slot 1, Slot 2, ALL)"),
    search: Optional[str] = Query(None, description="Search candidate name, reg number, or email"),
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Returns real-time examinees currently writing or recently submitted with live timers and cheating alert counts.
    """
    return LiveMonitoringService.get_live_examinees(db, date=date, batch=batch, search=search)

@router.post("/give-extra-time")
def give_extra_time(
    req: GiveExtraTimeRequest,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Grants additional minutes (+10 mins) to an individual candidate experiencing technical or network issues.
    Updates the database deadline immediately so candidate screen and server-side timer synchronize.
    """
    return LiveMonitoringService.give_extra_time(
        db,
        candidate_id=req.candidateId,
        attempt_id=req.attemptId,
        extra_minutes=req.extraMinutes,
        performed_by=current_user.email
    )

@router.post("/stop-exam")
def stop_candidate_exam(
    req: StopExamRequest,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Immediately stops and terminates a candidate's ongoing examination.
    Updates attempt status to DISCARDED in DB and notifies candidate screen to redirect to login.
    """
    return LiveMonitoringService.stop_candidate_exam(
        db,
        candidate_id=req.candidateId,
        attempt_id=req.attemptId,
        reason=req.reason,
        performed_by=current_user.email
    )

@router.get("/alerts", response_model=List[ProctorAlertDto])
def get_proctor_alerts(
    candidateId: Optional[int] = Query(None, alias="candidateId"),
    status: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Returns real-time suspicious activity / cheating alerts (tab switch, SEB exit, multiple faces, etc.).
    """
    return LiveMonitoringService.get_proctor_alerts(
        db, candidate_id=candidateId, status_filter=status, limit=limit
    )

@router.post("/alerts/{alert_id}/review")
def review_proctor_alert(
    alert_id: int,
    req: ReviewAlertRequest,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Updates proctor alert review status (REVIEWED, DISMISSED, ACTION_TAKEN).
    """
    return LiveMonitoringService.review_proctor_alert(
        db, alert_id=alert_id, status_value=req.status, reviewed_by=current_user.email
    )

@router.get("/alerts/history/{candidate_id}", response_model=List[ProctorAlertDto])
def get_candidate_alert_history(
    candidate_id: int,
    current_user: AppUser = Depends(require_super_admin),
    db: Session = Depends(get_db)
):
    """
    Retrieves full audit timeline of cheating / proctoring alerts for an individual candidate.
    """
    return LiveMonitoringService.get_proctor_alerts(db, candidate_id=candidate_id, limit=200)

