import uuid
import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.core import SessionLocal
from app.models import Department, Exam, QuestionSet, Question, QuestionOption, Candidate, ExamAttempt, AttemptAnswer
from app.schemas import QuestionDto, QuestionOptionDto, CandidateVerifyRequest
from app.candidate.services import CandidateExamService
from app.admin.services import ExamService, QuestionService

client = TestClient(app)

@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

def test_candidate_department_sync_and_unlinking(db: Session):
    uid = uuid.uuid4().hex[:6].upper()
    reg_num = f"DEPT-TEST-{uid}"
    dept_code = f"D{uid[:4]}"

    dept = Department(name=f"Sync Dept {uid}", code=dept_code, active=True)
    db.add(dept)
    db.commit()
    db.refresh(dept)

    try:
        # 1. Register candidate linked to department
        cand = Candidate(
            registration_number=reg_num,
            full_name=f"Sync Candidate {uid}",
            email=f"sync_{uid.lower()}@campus.edu",
            department_id=dept.id,
            status="ACTIVE"
        )
        db.add(cand)
        db.commit()
        db.refresh(cand)
        assert cand.department_id == dept.id

        # 2. Safe deletion of department: unlinks candidate without FK error
        db.query(Candidate).filter(Candidate.department_id == dept.id).update({"department_id": None}, synchronize_session=False)
        db.delete(dept)
        db.commit()

        db.refresh(cand)
        assert cand.department_id is None, "Candidate must be safely unlinked from deleted department"
    finally:
        try:
            cand = db.query(Candidate).filter(Candidate.registration_number == reg_num).first()
            if cand:
                db.delete(cand)
            d = db.query(Department).filter(Department.code == dept_code).first()
            if d:
                db.delete(d)
            db.commit()
        except Exception:
            db.rollback()

def test_save_answer_clearing_and_deduplication(db: Session):
    uid = uuid.uuid4().hex[:6].upper()
    admin_email = "test_admin@secureexam.local"

    test_dept = db.query(Department).first()
    if not test_dept:
        test_dept = Department(name="Developer", code="DEV", active=True)
        db.add(test_dept)
        db.commit()
        db.refresh(test_dept)

    # Create exam and question
    exam_dto = ExamService.create_exam(
        db,
        type("Dto", (), {
            "title": f"Deduplication Exam {uid}",
            "description": "Test deduplication and clearing",
            "duration_minutes": 30,
            "total_questions": 1,
            "qualification_mode": "PERCENTAGE",
            "qualification_threshold": Decimal("50.00"),
            "timing_mode": "DURATION_FROM_START",
            "total_marks": Decimal("10.00"),
            "marks_per_question": Decimal("10.00"),
            "negative_marks": Decimal("0.00"),
            "scheduled_start_time": None,
            "scheduled_end_time": None,
            "department_ids": [test_dept.id]
        })(),
        admin_email
    )
    exam_id = exam_dto.id

    try:
        q_sets = db.query(QuestionSet).filter(QuestionSet.exam_id == exam_id).all()
        set_a = next(s for s in q_sets if s.set_code == "A")

        # Create Question with Option A correct (10 marks)
        q_dto = QuestionDto(
            question_text="Test question deduplication?",
            marks=Decimal("10.00"),
            negative_marks=Decimal("0.00"),
            display_order=1,
            options=[
                QuestionOptionDto(option_text="Correct Option", correct=True, display_order=1),
                QuestionOptionDto(option_text="Wrong Option", correct=False, display_order=2)
            ]
        )
        created_q = QuestionService.create_question(db, set_a.id, q_dto, admin_email)
        ExamService.publish_exam(db, exam_id, admin_email)

        # Register candidate and start attempt
        cand_reg = f"DEDUP-{uid}"
        test_cand = Candidate(
            registration_number=cand_reg,
            full_name=f"Dedup Candidate {uid}",
            email=f"dedup_{uid.lower()}@campus.edu",
            department_id=test_dept.id,
            status="ACTIVE"
        )
        db.add(test_cand)
        db.commit()
        db.refresh(test_cand)

        from app.admin.services.candidate_service import CandidateService
        code_dto = CandidateService.generate_access_code(db, test_cand.id, "TEST_ADMIN", round_name="ROUND_1")

        v_res = CandidateExamService.verify_candidate(
            db, CandidateVerifyRequest(
                email=test_cand.email,
                registration_number=cand_reg,
                unique_id=code_dto.code,
                access_code=code_dto.code,
                full_name=test_cand.full_name,
                department_id=test_dept.id,
                department_name=test_dept.name
            )
        )
        assert v_res.eligible is True
        cand_id = v_res.candidate_id

        start_resp = CandidateExamService.start_or_resume_attempt(db, cand_id, exam_id)
        attempt_id = start_resp.attempt_id
        q_id = created_q.id

        opt_correct = db.query(QuestionOption).filter(
            QuestionOption.question_id == q_id,
            QuestionOption.is_correct == True
        ).first()

        # 1. Save answer
        save1 = CandidateExamService.save_answer(db, attempt_id, q_id, opt_correct.id)
        assert save1["success"] is True

        # 2. Simulate concurrent second save for same question -> should NOT duplicate rows
        save2 = CandidateExamService.save_answer(db, attempt_id, q_id, opt_correct.id)
        assert save2["success"] is True

        ans_rows = db.query(AttemptAnswer).filter(
            AttemptAnswer.attempt_id == attempt_id,
            AttemptAnswer.question_id == q_id
        ).all()
        assert len(ans_rows) == 1, "There must be exactly 1 answer row for this question"

        # 3. Test choice clearing with -1 and 0 (defensive check)
        clear1 = CandidateExamService.save_answer(db, attempt_id, q_id, -1)
        assert clear1["success"] is True
        ans_cleared = db.query(AttemptAnswer).filter(
            AttemptAnswer.attempt_id == attempt_id,
            AttemptAnswer.question_id == q_id
        ).first()
        assert ans_cleared.selected_option_id is None, "Option ID -1 must clear the selection to None"

        # 4. Re-select correct answer and submit
        CandidateExamService.save_answer(db, attempt_id, q_id, opt_correct.id)

        # Finalize submission (Results NOT published yet)
        sub_resp = CandidateExamService.submit_attempt(db, attempt_id)
        assert sub_resp.success is True
        assert sub_resp.results_published is False
        assert sub_resp.score is None, "Score must be hidden when results are not published"

        # Idempotent re-submission should ALSO hide score when unpublished!
        sub_resp2 = CandidateExamService.submit_attempt(db, attempt_id)
        assert sub_resp2.score is None, "Re-submission must NOT leak score when unpublished"

        # 5. Publish results and verify score is now revealed
        exam = db.query(Exam).filter(Exam.id == exam_id).first()
        exam.results_published = True
        db.commit()

        sub_resp3 = CandidateExamService.submit_attempt(db, attempt_id)
        assert sub_resp3.results_published is True
        assert sub_resp3.score == Decimal("10.00"), "Score must be revealed once results are published"
        assert sub_resp3.percentage == Decimal("100.00")
        assert sub_resp3.qualification_status == "QUALIFIED"

    finally:
        try:
            ExamService.delete_exam(db, exam_id, force=True, performed_by=admin_email)
            c = db.query(Candidate).filter(Candidate.registration_number == cand_reg).first()
            if c:
                db.delete(c)
            db.commit()
        except Exception:
            db.rollback()
