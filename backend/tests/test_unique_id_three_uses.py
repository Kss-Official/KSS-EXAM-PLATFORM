import pytest
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models import (
    Candidate, CandidateAccessCode, Exam, QuestionSet, Question, QuestionOption, ExamAttempt
)
from app.schemas import CandidateVerifyRequest
from app.admin.services.candidate_service import CandidateService
from app.candidate.services.candidate_exam_service import CandidateExamService
from app.core.database import SessionLocal

@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

def test_unique_id_three_uses_lifecycle(db: Session):
    # Setup candidate
    test_reg = "TEST-SEC-CANDIDATE-01"
    existing = db.query(Candidate).filter(Candidate.registration_number == test_reg).first()
    if existing:
        db.delete(existing)
        db.commit()

    from app.models.department import Department
    dept = db.query(Department).filter(Department.name == "Developer").first()
    if not dept:
        dept = Department(name="Developer", code="DEV", active=True)
        db.add(dept)
        db.commit()
        db.refresh(dept)

    cand = Candidate(
        registration_number=test_reg,
        full_name="Security Test Candidate",
        email="security_test@secureexam.local",
        department_id=dept.id,
        status="ACTIVE"
    )
    db.add(cand)
    db.commit()
    db.refresh(cand)

    # 1. Admin generates unique ID
    code_dto = CandidateService.generate_access_code(db, cand.id, "TEST_ADMIN")
    assert code_dto.code.startswith(("SEC-", "MCQ-"))
    assert code_dto.usage_count == 0
    assert code_dto.max_uses == 3
    assert code_dto.is_active is True

    # 2. Admin sends email
    email_res = CandidateService.send_access_code_email(db, cand.id, "TEST_ADMIN")
    assert email_res["success"] is True
    assert email_res["accessCode"] == code_dto.code
    assert email_res["maxUses"] == 3

    # Check database model updated with sent metadata
    ac = db.query(CandidateAccessCode).filter(CandidateAccessCode.id == code_dto.id).first()
    assert ac is not None
    assert ac.sent_to_email == "security_test@secureexam.local"
    assert ac.sent_at is not None

    # Setup exam and questions for attempt testing
    exam = db.query(Exam).filter(Exam.status == "PUBLISHED").first()
    if not exam:
        exam = Exam(
            title="Access Limit Evaluation Exam",
            duration_minutes=30,
            status="PUBLISHED",
            total_questions=1
        )
        db.add(exam)
        db.commit()
        db.refresh(exam)

    qset = db.query(QuestionSet).filter(QuestionSet.exam_id == exam.id).first()
    if not qset:
        qset = QuestionSet(exam_id=exam.id, set_code="A", department_id=None)
        db.add(qset)
        db.commit()
        db.refresh(qset)

    # Ensure a question exists
    q = db.query(Question).filter(Question.question_set_id == qset.id).first()
    if not q:
        q = Question(question_set_id=qset.id, question_text="What is 2 + 2?", display_order=1)
        db.add(q)
        db.commit()
        db.refresh(q)
        for opt_text, is_c in [("3", False), ("4", True), ("5", False)]:
            db.add(QuestionOption(question_id=q.id, option_text=opt_text, is_correct=is_c))
        db.commit()

    # 3. Candidate verifies using the unique ID
    verify_req = CandidateVerifyRequest(
        access_code=ac.code,
        full_name=cand.full_name,
        department_id=dept.id,
        department_name=dept.name
    )
    v_resp = CandidateExamService.verify_candidate(db, verify_req)
    assert v_resp.eligible is True
    assert v_resp.candidate_id == cand.id
    assert v_resp.access_code == ac.code
    assert v_resp.access_code_uses == 1
    assert v_resp.access_code_max_uses == 3
    assigned_exam_id = v_resp.exam_id

    # Use 1: Start Attempt 1
    CandidateExamService.start_or_resume_attempt(db, cand.id, assigned_exam_id)
    db.refresh(ac)
    assert ac.usage_count == 1
    assert ac.is_active is True

    # Candidate submits Attempt 1
    att1 = db.query(ExamAttempt).filter(ExamAttempt.candidate_id == cand.id, ExamAttempt.status == "IN_PROGRESS").first()
    att1.status = "SUBMITTED"
    db.commit()

    # Use 2: Verify and Start Attempt 2
    v_resp2 = CandidateExamService.verify_candidate(db, verify_req)
    assert v_resp2.eligible is True
    CandidateExamService.start_or_resume_attempt(db, cand.id, v_resp2.exam_id)
    db.refresh(ac)
    assert ac.usage_count == 2
    assert ac.is_active is True

    # Candidate submits Attempt 2
    att2 = db.query(ExamAttempt).filter(ExamAttempt.candidate_id == cand.id, ExamAttempt.status == "IN_PROGRESS").first()
    att2.status = "SUBMITTED"
    db.commit()

    # Use 3: Verify and Start Attempt 3 (Last permitted use!)
    v_resp3 = CandidateExamService.verify_candidate(db, verify_req)
    assert v_resp3.eligible is True
    CandidateExamService.start_or_resume_attempt(db, cand.id, v_resp3.exam_id)
    db.refresh(ac)
    assert ac.usage_count == 3
    # Once used 3 times, automatically becomes inactive
    assert ac.is_active is False

    # Candidate submits Attempt 3
    att3 = db.query(ExamAttempt).filter(ExamAttempt.candidate_id == cand.id, ExamAttempt.status == "IN_PROGRESS").first()
    att3.status = "SUBMITTED"
    db.commit()

    # Attempt 4: EXCEEDED LIMIT (4th use must be rejected immediately)
    # Verification must fail:
    v_resp4 = CandidateExamService.verify_candidate(db, verify_req)
    assert v_resp4.eligible is False
    assert "maximum limit" in v_resp4.message.lower() or "expired" in v_resp4.message.lower()

    # Direct start attempt API call must also fail with HTTP 403 Forbidden:
    # Simulate someone trying to bypass verify by setting attempt to ASSIGNED directly
    att3.status = "ASSIGNED"
    db.commit()

    with pytest.raises(HTTPException) as exc_info:
        CandidateExamService.start_or_resume_attempt(db, cand.id, v_resp3.exam_id)
    assert exc_info.value.status_code == 403
    assert "maximum limit" in str(exc_info.value.detail).lower()

    # Cleanup
    db.delete(cand)
    db.commit()
