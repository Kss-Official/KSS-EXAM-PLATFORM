import pytest
from datetime import datetime, timezone, timedelta
from app.models import ExamAttempt, Candidate, Exam, Department, ProctorAlert
from app.admin.services.live_monitoring_service import LiveMonitoringService

def test_live_monitoring_extra_time_and_stop(db):
    # 1. Setup sample candidate and exam
    dept = db.query(Department).first()
    if not dept:
        dept = Department(name="Live Monitoring Dept", code="LM_DEPT_TEST", active=True)
        db.add(dept)
        db.commit()

    cand = Candidate(
        registration_number="REG-TEST-LM1",
        full_name="Live Monitoring Test Candidate",
        email="lm_cand@test.com",
        department_id=dept.id,
        batch="Slot 1",
        status="ACTIVE"
    )
    db.add(cand)
    db.commit()

    exam = Exam(
        title="Live Proctoring Assessment",
        duration_minutes=60,
        total_questions=30,
        status="ACTIVATED"
    )
    db.add(exam)
    db.commit()

    now = datetime.now(timezone.utc)
    initial_deadline = now + timedelta(minutes=60)
    attempt = ExamAttempt(
        candidate_id=cand.id,
        exam_id=exam.id,
        question_set_id=1,
        started_at=now,
        expires_at=initial_deadline,
        status="IN_PROGRESS"
    )
    db.add(attempt)
    db.commit()

    # 2. Test Give Extra Time (+10 Minutes)
    extra_res = LiveMonitoringService.give_extra_time(
        db,
        candidate_id=cand.id,
        attempt_id=attempt.id,
        extra_minutes=10,
        performed_by="admin@test.com"
    )
    assert extra_res["success"] is True
    assert extra_res["extraTimeMinutes"] == 10

    # Verify attempt in DB
    db.refresh(attempt)
    assert attempt.extra_time_minutes == 10
    exp = attempt.expires_at if attempt.expires_at.tzinfo else attempt.expires_at.replace(tzinfo=timezone.utc)
    assert exp > initial_deadline + timedelta(minutes=9)
    assert attempt.status == "IN_PROGRESS"

    # 3. Test Proctor Cheating Alert Recording
    alert = LiveMonitoringService.record_proctor_alert(
        db,
        candidate_id=cand.id,
        attempt_id=attempt.id,
        alert_type="TAB_SWITCH",
        message="Candidate switched away from examination tab",
        severity="HIGH"
    )
    assert alert.id is not None
    assert alert.alert_type == "TAB_SWITCH"
    assert alert.status == "NEW"

    alerts_list = LiveMonitoringService.get_proctor_alerts(db, candidate_id=cand.id)
    assert len(alerts_list) >= 1
    assert alerts_list[0].alertType == "TAB_SWITCH"

    # Review Alert
    rev = LiveMonitoringService.review_proctor_alert(db, alert.id, "REVIEWED", "admin@test.com")
    assert rev["success"] is True
    assert rev["status"] == "REVIEWED"

    # 4. Test Stop / Discard Candidate Exam
    stop_res = LiveMonitoringService.stop_candidate_exam(
        db,
        candidate_id=cand.id,
        attempt_id=attempt.id,
        reason="Repeated tab switches detected during active exam",
        performed_by="admin@test.com"
    )
    assert stop_res["success"] is True
    assert stop_res["status"] == "DISCARDED"

    db.refresh(attempt)
    assert attempt.status == "DISCARDED"
    assert "Repeated tab switches" in attempt.termination_reason

    db.refresh(cand)
    assert cand.status == "DISCARDED"

    # Verify cannot give extra time to stopped/discarded exam
    with pytest.raises(Exception) as exc_info:
        LiveMonitoringService.give_extra_time(
            db,
            candidate_id=cand.id,
            attempt_id=attempt.id,
            extra_minutes=10,
            performed_by="admin@test.com"
        )
    assert "stopped/discarded" in str(exc_info.value)
