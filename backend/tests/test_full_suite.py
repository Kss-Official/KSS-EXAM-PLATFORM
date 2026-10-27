import pytest
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.core import SessionLocal
from app.models import (
    Department, Exam, QuestionSet, Question, QuestionOption,
    Candidate, ExamAttempt, AttemptAnswer, StoredDocument
)
from app.schemas import QuestionDto, QuestionOptionDto
from app.services import ExamService, QuestionService, CandidateExamService

client = TestClient(app)

@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

def test_full_backend_lifecycle_and_root_cause_fixes(db: Session):
    import uuid
    admin_email = "test_admin@secureexam.local"
    unique_suffix = uuid.uuid4().hex[:6].upper()
    dept_code = f"L{unique_suffix[:4]}"

    # Cleanup any leftover departments from previous aborted runs
    leftovers = db.query(Department).filter(Department.code == "LTD").all()
    for ld in leftovers:
        db.delete(ld)
    db.commit()

    # 1. Create a Test Department
    dept = Department(name=f"Lifecycle Test Dept {unique_suffix}", code=dept_code, active=True)
    db.add(dept)
    db.commit()
    db.refresh(dept)

    # 2. Create a Draft Exam linked to Department
    exam_dto = ExamService.create_exam(
        db,
        type("Dto", (), {
            "title": "Comprehensive E2E Lifecycle Exam",
            "description": "Testing root cause fixes",
            "duration_minutes": 45,
            "total_questions": 2,
            "qualification_mode": "PERCENTAGE",
            "qualification_threshold": Decimal("50.00"),
            "timing_mode": "DURATION_FROM_START",
            "total_marks": Decimal("10.00"),
            "marks_per_question": Decimal("5.00"),
            "negative_marks": Decimal("1.00"),
            "scheduled_start_time": None,
            "scheduled_end_time": None,
            "department_ids": [dept.id]
        })(),
        admin_email
    )
    exam_id = exam_dto.id

    try:
        # Verify Sets A, B, C, D were initialized
        sets = db.query(QuestionSet).filter(
            QuestionSet.exam_id == exam_id,
            QuestionSet.department_id == dept.id
        ).order_by(QuestionSet.set_code.asc()).all()
        assert len(sets) == 4
        set_a = next(s for s in sets if s.set_code == "A")

        # 3. ROOT CAUSE FIX VERIFICATION: Option A auto-selection bug
        # Create Question 1 with Option C marked correct explicitly
        q1_dto = QuestionDto(
            question_text="What is the capital of France?",
            marks=Decimal("5.00"),
            negative_marks=Decimal("1.00"),
            display_order=1,
            options=[
                QuestionOptionDto(option_text="Berlin", correct=False, display_order=1),
                QuestionOptionDto(option_text="Madrid", correct=False, display_order=2),
                QuestionOptionDto(option_text="Paris", correct=True, display_order=3),
                QuestionOptionDto(option_text="Rome", correct=False, display_order=4)
            ]
        )
        created_q1 = QuestionService.create_question(db, set_a.id, q1_dto, admin_email)
        # Verify Option A is NOT marked correct and Option C IS correct!
        q1_in_db = db.query(Question).filter(Question.id == created_q1.id).first()
        opts_db = {o.option_text: o.is_correct for o in q1_in_db.options}
        assert opts_db["Paris"] is True, "Paris (Option C) must be correct"
        assert opts_db["Berlin"] is False, "Berlin (Option A) must NOT be erroneously marked correct"

        # Create Question 2
        q2_dto = QuestionDto(
            question_text="What is 2 + 2?",
            marks=Decimal("5.00"),
            negative_marks=Decimal("1.00"),
            display_order=2,
            options=[
                QuestionOptionDto(option_text="3", correct=False, display_order=1),
                QuestionOptionDto(option_text="4", correct=True, display_order=2),
                QuestionOptionDto(option_text="5", correct=False, display_order=3),
                QuestionOptionDto(option_text="6", correct=False, display_order=4)
            ]
        )
        QuestionService.create_question(db, set_a.id, q2_dto, admin_email)

        # 4. ROOT CAUSE FIX VERIFICATION: Publish Exam auto-replicates questions into empty Sets B, C, D
        set_b = next((s for s in sets if s.set_code.upper() == "B"), sets[1])
        set_c = next((s for s in sets if s.set_code.upper() == "C"), sets[2])
        set_d = next((s for s in sets if s.set_code.upper() == "D"), sets[3])

        set_b_before = db.query(Question).filter(Question.question_set_id == set_b.id).count()
        assert set_b_before == 0, "Set B initially has 0 questions"

        pub_exam = ExamService.publish_exam(db, exam_id, admin_email)
        assert pub_exam.status == "PUBLISHED"

        set_b_after = db.query(Question).filter(Question.question_set_id == set_b.id).count()
        set_c_after = db.query(Question).filter(Question.question_set_id == set_c.id).count()
        set_d_after = db.query(Question).filter(Question.question_set_id == set_d.id).count()
        assert set_b_after == 2, "Set B must have auto-replicated 2 questions on publish"
        assert set_c_after == 2, "Set C must have auto-replicated 2 questions on publish"
        assert set_d_after == 2, "Set D must have auto-replicated 2 questions on publish"

        # 5. Candidate Verification via Portal API (with strict 3-point validation)
        from app.admin.services.candidate_service import CandidateService
        test_reg = f"LIFECYCLE-{unique_suffix}"
        test_cand = Candidate(
            registration_number=test_reg,
            full_name=f"Lifecycle Candidate {unique_suffix}",
            email=f"cand_{unique_suffix.lower()}@campus.edu",
            department_id=dept.id,
            status="ACTIVE"
        )
        db.add(test_cand)
        db.commit()
        db.refresh(test_cand)

        code_dto = CandidateService.generate_access_code(db, test_cand.id, admin_email, round_name="ROUND_1")

        v_res = client.post("/api/candidate/verify", json={
            "registrationNumber": test_reg,
            "uniqueId": code_dto.code,
            "email": test_cand.email,
            "fullName": test_cand.full_name,
            "departmentId": dept.id,
            "departmentName": dept.name
        })
        assert v_res.status_code == 200
        v_data = v_res.json()
        assert v_data["eligible"] is True
        assert v_data["examId"] == exam_id
        candidate_id = v_data["candidateId"]

        # 6. Start Attempt via Portal API
        start_res = client.post("/api/candidate/start", json={
            "candidateId": candidate_id,
            "examId": exam_id
        })
        assert start_res.status_code == 200
        start_data = start_res.json()
        attempt_id = start_data["attemptId"]
        assert len(start_data["questions"]) == 2
        # ROOT CAUSE FIX VERIFICATION: marks serialized as numeric float, not string
        assert isinstance(start_data["questions"][0]["marks"], (int, float))
        assert start_data["totalDurationSeconds"] > 0

        # Find the question for "Paris" and submit answer
        q_target = None
        target_opt_id = None
        for q in start_data["questions"]:
            if "capital" in q["questionText"].lower():
                q_target = q
                for opt in q["options"]:
                    if opt["optionText"] == "Paris":
                        target_opt_id = opt["id"]
                break

        assert q_target is not None
        assert target_opt_id is not None

        # 7. Save Answer via Portal API (testing query param alias & body fallback)
        ans_res = client.post(
            f"/api/candidate/answers?attemptId={attempt_id}",
            json={
                "questionId": q_target["id"],
                "selectedOptionId": target_opt_id,
                "candidateId": candidate_id
            }
        )
        assert ans_res.status_code == 200
        assert ans_res.json()["success"] is True

        # Test flexible alias: attempt_id as query param
        ans_res2 = client.post(
            f"/api/candidate/answers?attempt_id={attempt_id}",
            json={
                "question_id": q_target["id"],
                "selected_option_id": target_opt_id,
                "candidate_id": candidate_id
            }
        )
        assert ans_res2.status_code == 200

        # 8. Submit Attempt via Portal API
        sub_res = client.post(f"/api/candidate/submit?attemptId={attempt_id}", json={"candidateId": candidate_id})
        assert sub_res.status_code == 200
        sub_data = sub_res.json()
        assert sub_data["success"] is True
        assert "receiptId" in sub_data
        # Results not published yet
        assert sub_data["isPublished"] is False
        assert sub_data["resultsPublished"] is False

        # 9. Admin Results API & Publish Results with empty body
        # Log in as Super Admin
        auth_res = client.post("/api/auth/login", json={
            "email": "d.koushik@kalpanaaasoftwaresolutions.in",
            "password": "Admin@ExamSecure2026!"
        })
        assert auth_res.status_code == 200
        client.cookies.set("JSESSIONID", auth_res.cookies["JSESSIONID"])

        # Publish results for this exam (empty body test)
        pub_res = client.post(f"/api/admin/results/exam/{exam_id}/publish", json={})
        assert pub_res.status_code == 200
        assert pub_res.json()["resultsPublished"] is True

        # Fetch exam results: ensure JSON serialization has float/number values
        res_list = client.get(f"/api/admin/results/exam/{exam_id}")
        assert res_list.status_code == 200
        results_data = res_list.json()
        assert len(results_data) >= 1
        cand_result = next(r for r in results_data if r["attemptId"] == attempt_id)
        assert cand_result["attemptStatus"] == "SUBMITTED"
        assert cand_result["answeredCount"] == 1
        assert isinstance(cand_result["score"], (int, float))
        assert isinstance(cand_result["percentage"], (int, float))
        assert cand_result["score"] == 5.0
        assert cand_result["percentage"] == 50.0

        # 10. Submitting already submitted attempt returns consistent payload with revealed results
        sub_res_again = client.post(f"/api/candidate/submit?attemptId={attempt_id}", json={"candidateId": candidate_id})
        assert sub_res_again.status_code == 200
        sub_again_data = sub_res_again.json()
        assert sub_again_data["resultsPublished"] is True
        assert isinstance(sub_again_data["score"], (int, float))
        assert sub_again_data["score"] == 5.0

    finally:
        client.cookies.clear()
        # Cleanup exam and department (testing force cascade delete)
        try:
            ExamService.delete_exam(db, exam_id, force=True, performed_by=admin_email)
            db.delete(dept)
            cand = db.query(Candidate).filter(Candidate.registration_number == test_reg).first()
            if cand:
                db.delete(cand)
            db.commit()
        except Exception:
            db.rollback()
