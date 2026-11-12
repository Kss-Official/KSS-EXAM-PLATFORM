from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc, or_
from fastapi import HTTPException, status

from app.models import (
    Candidate, ExamAttempt, Exam, Department, College, QuestionSet, AuditLog, ProctorAlert
)
from app.schemas.live_monitoring import LiveExamineeDto, ProctorAlertDto

def _ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if not dt:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

class LiveMonitoringService:

    @classmethod
    def get_live_examinees(
        cls,
        db: Session,
        date: Optional[str] = None,
        batch: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[LiveExamineeDto]:
        now = datetime.now(timezone.utc)
        IST = timezone(timedelta(hours=5, minutes=30))
        today_ist = now.astimezone(IST).strftime("%Y-%m-%d")

        query = db.query(ExamAttempt).options(
            joinedload(ExamAttempt.candidate).joinedload(Candidate.department),
            joinedload(ExamAttempt.candidate).joinedload(Candidate.college),
            joinedload(ExamAttempt.question_set),
            joinedload(ExamAttempt.exam)
        )

        # Focus on active/recent sessions: IN_PROGRESS, ASSIGNED, STOPPED, DISCARDED, and today's SUBMITTED/EXPIRED
        query = query.filter(
            or_(
                ExamAttempt.status.in_(["IN_PROGRESS", "ASSIGNED", "STOPPED", "DISCARDED"]),
                ExamAttempt.submitted_at >= now - timedelta(hours=12)
            )
        )

        if search and search.strip():
            s = f"%{search.strip().lower()}%"
            query = query.join(ExamAttempt.candidate).filter(
                or_(
                    func.lower(Candidate.full_name).like(s),
                    func.lower(Candidate.registration_number).like(s),
                    func.lower(Candidate.email).like(s)
                )
            )

        attempts = query.order_by(
            # Priority: IN_PROGRESS first, then DISCARDED/STOPPED, then others
            ExamAttempt.status.desc(),
            ExamAttempt.started_at.desc()
        ).all()

        # Collect candidate IDs to fetch alert counts and recent alert in bulk
        cand_ids = [a.candidate_id for a in attempts]
        alerts_by_cand: Dict[int, List[ProctorAlert]] = {}
        if cand_ids:
            all_alerts = db.query(ProctorAlert).filter(
                ProctorAlert.candidate_id.in_(cand_ids)
            ).order_by(ProctorAlert.created_at.desc()).all()
            for al in all_alerts:
                alerts_by_cand.setdefault(al.candidate_id, []).append(al)

        examinees: List[LiveExamineeDto] = []
        seen_cand_ids = set()

        for a in attempts:
            if a.candidate_id in seen_cand_ids:
                continue
            seen_cand_ids.add(a.candidate_id)

            cand = a.candidate
            if not cand:
                continue

            # Optional date / slot filtering
            if date and date != "ALL":
                cand_date = str(cand.exam_date or "").strip()
                if not cand_date and cand.created_at:
                    cand_date = cand.created_at.astimezone(IST).strftime("%Y-%m-%d")
                if cand_date != date:
                    continue

            if batch and batch != "ALL":
                b_str = str(cand.batch or "").strip().lower()
                target_b = batch.strip().lower()
                if target_b not in b_str:
                    continue

            exp_utc = _ensure_utc(a.expires_at)
            rem_sec = 0
            if a.status == "IN_PROGRESS" and exp_utc:
                rem_sec = max(0, int((exp_utc - now).total_seconds()))

            cand_alerts = alerts_by_cand.get(cand.id, [])
            alerts_count = len(cand_alerts)
            last_alert_obj = cand_alerts[0] if cand_alerts else None
            last_alert_dict = None
            if last_alert_obj:
                last_alert_dict = {
                    "id": last_alert_obj.id,
                    "alertType": last_alert_obj.alert_type,
                    "severity": last_alert_obj.severity,
                    "message": last_alert_obj.message,
                    "status": last_alert_obj.status,
                    "createdAt": last_alert_obj.created_at.isoformat() if last_alert_obj.created_at else None
                }

            examinees.append(
                LiveExamineeDto(
                    candidateId=cand.id,
                    registrationNumber=cand.registration_number,
                    fullName=cand.full_name,
                    email=cand.email,
                    department=cand.department.name if cand.department else "Unassigned",
                    college=cand.college.name if cand.college else "-",
                    batch=cand.batch or "Slot 1",
                    assignedSet=cand.assigned_set or (a.question_set.set_code if a.question_set else "Set A"),
                    attemptId=a.id,
                    status=a.status,
                    startedAt=a.started_at,
                    expiresAt=a.expires_at,
                    extraTimeMinutes=getattr(a, "extra_time_minutes", 0) or 0,
                    questionsAnswered=a.questions_answered or 0,
                    totalQuestions=a.total_questions or (len(a.question_set.questions) if (a.question_set and a.question_set.questions) else 30),
                    remainingSeconds=rem_sec,
                    alertsCount=alerts_count,
                    lastAlert=last_alert_dict,
                    terminationReason=getattr(a, "termination_reason", None)
                )
            )

        return examinees

    @classmethod
    def give_extra_time(
        cls,
        db: Session,
        candidate_id: int,
        attempt_id: Optional[int],
        extra_minutes: int,
        performed_by: str
    ) -> Dict[str, Any]:
        if extra_minutes <= 0:
            extra_minutes = 10

        query = db.query(ExamAttempt).filter(ExamAttempt.candidate_id == candidate_id)
        if attempt_id:
            query = query.filter(ExamAttempt.id == attempt_id)
        attempt = query.order_by(ExamAttempt.created_at.desc()).first()

        if not attempt:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No active exam attempt found for candidate #{candidate_id}."
            )

        if attempt.status in ("DISCARDED", "STOPPED"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot add extra time: Examination attempt has been stopped/discarded by an administrator."
            )

        now = datetime.now(timezone.utc)
        current_exp = _ensure_utc(attempt.expires_at)

        # If expired or close to expiring, calculate from now, else add to existing deadline
        if not current_exp or current_exp < now:
            new_exp = now + timedelta(minutes=extra_minutes)
        else:
            new_exp = current_exp + timedelta(minutes=extra_minutes)

        attempt.expires_at = new_exp
        attempt.status = "IN_PROGRESS"
        attempt.extra_time_minutes = (getattr(attempt, "extra_time_minutes", 0) or 0) + extra_minutes

        # Log audit trail
        cand_name = attempt.candidate.full_name if attempt.candidate else f"ID {candidate_id}"
        reg_no = attempt.candidate.registration_number if attempt.candidate else ""
        db.add(AuditLog(
            action="GRANT_EXTRA_TIME",
            entity_type="ExamAttempt",
            entity_id=str(attempt.id),
            performed_by=performed_by,
            details=f"Granted +{extra_minutes} mins to {cand_name} ({reg_no}). Total extra: {attempt.extra_time_minutes}m. New deadline: {new_exp.isoformat()}"
        ))

        db.commit()
        db.refresh(attempt)

        return {
            "success": True,
            "message": f"Successfully granted +{extra_minutes} minutes extra time to {cand_name}.",
            "attemptId": attempt.id,
            "expiresAt": attempt.expires_at.isoformat(),
            "extraTimeMinutes": attempt.extra_time_minutes
        }

    @classmethod
    def stop_candidate_exam(
        cls,
        db: Session,
        candidate_id: int,
        attempt_id: Optional[int],
        reason: str,
        performed_by: str
    ) -> Dict[str, Any]:
        query = db.query(ExamAttempt).filter(ExamAttempt.candidate_id == candidate_id)
        if attempt_id:
            query = query.filter(ExamAttempt.id == attempt_id)
        attempt = query.order_by(ExamAttempt.created_at.desc()).first()

        if not attempt:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"No exam attempt found for candidate #{candidate_id}."
            )

        now = datetime.now(timezone.utc)
        attempt.status = "DISCARDED"
        attempt.termination_reason = reason or "Examination stopped by administrator."
        attempt.submitted_at = now

        cand = attempt.candidate or db.query(Candidate).filter(Candidate.id == candidate_id).first()
        if cand:
            cand.status = "DISCARDED"

        cand_name = cand.full_name if cand else f"Candidate #{candidate_id}"
        reg_no = cand.registration_number if cand else ""

        # Audit log entry
        db.add(AuditLog(
            action="STOP_EXAM_ATTEMPT",
            entity_type="ExamAttempt",
            entity_id=str(attempt.id),
            performed_by=performed_by,
            details=f"Exam stopped/discarded by {performed_by} for {cand_name} ({reg_no}). Reason: {reason}"
        ))

        # Record high-severity proctor alert for the incident
        db.add(ProctorAlert(
            candidate_id=candidate_id,
            attempt_id=attempt.id,
            alert_type="ADMIN_STOPPED",
            severity="CRITICAL",
            message=f"Examination stopped by administrator ({performed_by}): {reason}",
            status="ACTION_TAKEN",
            reviewed_by=performed_by,
            reviewed_at=now
        ))

        db.commit()

        return {
            "success": True,
            "message": f"Examination for {cand_name} ({reg_no}) has been stopped and terminated.",
            "attemptId": attempt.id,
            "status": "DISCARDED"
        }

    @classmethod
    def record_proctor_alert(
        cls,
        db: Session,
        candidate_id: int,
        attempt_id: Optional[int],
        alert_type: str,
        message: str,
        severity: str = "MEDIUM"
    ) -> ProctorAlert:
        # Check for duplicate alerts within last 5 seconds to avoid flooding
        recent = db.query(ProctorAlert).filter(
            ProctorAlert.candidate_id == candidate_id,
            ProctorAlert.alert_type == alert_type,
            ProctorAlert.created_at >= datetime.now(timezone.utc) - timedelta(seconds=5)
        ).first()

        if recent:
            return recent

        alert = ProctorAlert(
            candidate_id=candidate_id,
            attempt_id=attempt_id,
            alert_type=alert_type.upper(),
            severity=severity.upper() if severity else "MEDIUM",
            message=message[:500] if message else "Proctoring incident detected",
            status="NEW",
            created_at=datetime.now(timezone.utc)
        )
        db.add(alert)

        # Also add to AuditLog for permanent forensic history
        cand = db.query(Candidate).filter(Candidate.id == candidate_id).first()
        cand_str = f"{cand.registration_number} - {cand.full_name}" if cand else f"Candidate #{candidate_id}"
        db.add(AuditLog(
            action=f"PROCTOR_{alert_type.upper()}",
            entity_type="ProctorAlert",
            entity_id=str(attempt_id or candidate_id),
            performed_by=f"ProctorClient:{cand_str}",
            details=message
        ))

        db.commit()
        db.refresh(alert)
        return alert

    @classmethod
    def get_proctor_alerts(
        cls,
        db: Session,
        candidate_id: Optional[int] = None,
        status_filter: Optional[str] = None,
        limit: int = 100
    ) -> List[ProctorAlertDto]:
        query = db.query(ProctorAlert).options(
            joinedload(ProctorAlert.candidate).joinedload(Candidate.department)
        )
        if candidate_id:
            query = query.filter(ProctorAlert.candidate_id == candidate_id)
        if status_filter and status_filter != "ALL":
            query = query.filter(ProctorAlert.status == status_filter)

        alerts = query.order_by(ProctorAlert.created_at.desc()).limit(limit).all()

        results: List[ProctorAlertDto] = []
        for al in alerts:
            cand = al.candidate
            results.append(
                ProctorAlertDto(
                    id=al.id,
                    candidateId=al.candidate_id,
                    candidateName=cand.full_name if cand else "Unknown",
                    registrationNumber=cand.registration_number if cand else "-",
                    department=cand.department.name if (cand and cand.department) else "-",
                    attemptId=al.attempt_id,
                    alertType=al.alert_type,
                    severity=al.severity,
                    message=al.message,
                    status=al.status,
                    reviewedBy=al.reviewed_by,
                    reviewedAt=al.reviewed_at,
                    createdAt=al.created_at
                )
            )
        return results

    @classmethod
    def review_proctor_alert(
        cls,
        db: Session,
        alert_id: int,
        status_value: str,
        reviewed_by: str
    ) -> Dict[str, Any]:
        alert = db.query(ProctorAlert).filter(ProctorAlert.id == alert_id).first()
        if not alert:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proctor alert not found.")

        alert.status = status_value
        alert.reviewed_by = reviewed_by
        alert.reviewed_at = datetime.now(timezone.utc)
        db.commit()
        return {"success": True, "alertId": alert_id, "status": alert.status}

