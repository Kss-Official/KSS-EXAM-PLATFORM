import time
import secrets
import threading
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.email import EmailService
from app.models.candidate import Candidate, CandidateAccessCode
from app.models.audit import AuditLog
from app.admin.services.candidate_service import CandidateService

logger = logging.getLogger("ExamSecure.BatchEmail")

# Thread-safe in-memory job registry for tracking batch email progress
_BATCH_JOBS: Dict[str, Dict[str, Any]] = {}
_LOCK = threading.Lock()

class BatchEmailService:
    @classmethod
    def get_job_status(cls, job_id: str) -> Optional[Dict[str, Any]]:
        with _LOCK:
            return _BATCH_JOBS.get(job_id)

    @classmethod
    def start_batch_dispatch(
        cls,
        round_name: str,
        candidate_ids: Optional[List[int]],
        exam_title: str,
        provider: str = "auto",
        delay_seconds: float = 1.2,
        performed_by: str = "ADMIN"
    ) -> Dict[str, Any]:
        job_id = f"job_email_{int(time.time())}_{secrets.token_hex(3)}"

        # Initial query to determine eligible candidate targets
        db: Session = SessionLocal()
        try:
            query = db.query(Candidate).filter(Candidate.status == "ACTIVE")
            if candidate_ids:
                query = query.filter(Candidate.id.in_(candidate_ids))
            
            all_cands = query.all()
            
            # If round is ROUND_2, filter for technical departments
            eligible_cands = []
            for c in all_cands:
                if round_name.upper() == "ROUND_2":
                    dept = (c.department.name if c.department else "").lower()
                    # Check technical department keywords
                    tech_keywords = ["developer", "tester", "qa", "computer science", "cse", "information technology", "it", "electronics", "ece", "software"]
                    if not dept or any(k in dept for k in tech_keywords):
                        eligible_cands.append(c.id)
                else:
                    eligible_cands.append(c.id)

            total_count = len(eligible_cands)
        finally:
            db.close()

        with _LOCK:
            _BATCH_JOBS[job_id] = {
                "jobId": job_id,
                "round": round_name,
                "status": "QUEUED",
                "total": total_count,
                "sent": 0,
                "failed": 0,
                "percent": 0.0,
                "currentCandidate": "",
                "errors": [],
                "provider": provider,
                "delaySeconds": delay_seconds,
                "examTitle": exam_title,
                "startedAt": datetime.now(timezone.utc).isoformat(),
                "completedAt": None,
                "performedBy": performed_by
            }

        # Spawn background dispatch worker thread
        worker = threading.Thread(
            target=cls._dispatch_worker,
            args=(job_id, eligible_cands, round_name, exam_title, provider, delay_seconds, performed_by),
            daemon=True
        )
        worker.start()

        return {
            "success": True,
            "jobId": job_id,
            "status": "QUEUED",
            "totalCandidates": total_count,
            "round": round_name,
            "message": f"Batch email dispatch job created for {total_count} candidates in {round_name}. Pacing: {delay_seconds}s per email."
        }

    @classmethod
    def _dispatch_worker(
        cls,
        job_id: str,
        candidate_ids: List[int],
        round_name: str,
        exam_title: str,
        provider: str,
        delay_seconds: float,
        performed_by: str
    ):
        with _LOCK:
            if job_id in _BATCH_JOBS:
                _BATCH_JOBS[job_id]["status"] = "RUNNING"

        db: Session = SessionLocal()
        sent_count = 0
        failed_count = 0
        errors = []

        try:
            total = len(candidate_ids)
            for idx, cid in enumerate(candidate_ids):
                cand = db.query(Candidate).filter(Candidate.id == cid).first()
                if not cand or not cand.email:
                    failed_count += 1
                    continue

                with _LOCK:
                    if job_id in _BATCH_JOBS:
                        _BATCH_JOBS[job_id]["currentCandidate"] = f"{cand.full_name} ({cand.registration_number})"

                try:
                    # Ensure active code for this specific round with remaining uses
                    active_code = db.query(CandidateAccessCode).filter(
                        CandidateAccessCode.candidate_id == cand.id,
                        CandidateAccessCode.round == round_name.upper(),
                        CandidateAccessCode.is_active == True,
                        CandidateAccessCode.usage_count < CandidateAccessCode.max_uses
                    ).first()

                    if not active_code:
                        dto = CandidateService.generate_access_code(
                            db, candidate_id=cand.id, performed_by=triggered_by, round_name=round_name.upper()
                        )
                        active_code = db.query(CandidateAccessCode).filter(CandidateAccessCode.id == dto.id).first()

                    # Send Email via EmailService
                    res = EmailService.send_unique_id_email(
                        to_email=cand.email,
                        candidate_name=cand.full_name,
                        access_code=active_code.code,
                        max_uses=active_code.max_uses,
                        exam_title=f"{exam_title} ({'Round 1 MCQ' if round_name.upper() == 'ROUND_1' else 'Round 2 Coding'})"
                    )

                    if res.get("success", False):
                        sent_count += 1
                        active_code.sent_to_email = cand.email
                        active_code.sent_at = datetime.now(timezone.utc)
                        db.commit()
                    else:
                        failed_count += 1
                        errors.append(f"{cand.email}: {res.get('message', 'Failed to deliver')}")

                except Exception as ex:
                    failed_count += 1
                    errors.append(f"{cand.email}: {str(ex)}")
                    db.rollback()

                with _LOCK:
                    if job_id in _BATCH_JOBS:
                        _BATCH_JOBS[job_id]["sent"] = sent_count
                        _BATCH_JOBS[job_id]["failed"] = failed_count
                        _BATCH_JOBS[job_id]["percent"] = round(((sent_count + failed_count) / max(total, 1)) * 100, 1)

                # Pacing delay between emails to avoid hitting SMTP rate limits / bans
                if delay_seconds > 0 and idx < total - 1:
                    time.sleep(delay_seconds)

            # Record audit log
            db.add(AuditLog(
                action="BATCH_EMAIL_DISPATCH",
                entity_type="CandidateAccessCode",
                entity_id=job_id,
                performed_by=performed_by,
                details=f"Completed batch email send for {round_name}: {sent_count} sent, {failed_count} failed out of {total} targets."
            ))
            db.commit()

        except Exception as e:
            logger.error(f"Fatal error in batch dispatch worker {job_id}: {e}")
            with _LOCK:
                if job_id in _BATCH_JOBS:
                    _BATCH_JOBS[job_id]["status"] = "FAILED"
                    _BATCH_JOBS[job_id]["errors"].append(str(e))
        finally:
            db.close()
            with _LOCK:
                if job_id in _BATCH_JOBS:
                    _BATCH_JOBS[job_id]["status"] = "COMPLETED"
                    _BATCH_JOBS[job_id]["completedAt"] = datetime.now(timezone.utc).isoformat()
                    _BATCH_JOBS[job_id]["currentCandidate"] = "Completed"
