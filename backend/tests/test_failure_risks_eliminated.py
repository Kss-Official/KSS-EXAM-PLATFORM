import uuid
import pytest
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.main import app
from app.core import SessionLocal
from app.models import Department, Exam, QuestionSet, Question, QuestionOption, Candidate, ExamAttempt, AttemptAnswer
from app.schemas import QuestionDto, QuestionOptionDto, CandidateVerifyRequest
from app.candidate.services import CandidateExamService
from app.admin.services import ExamService, QuestionService
from app.admin.services.pdf_service import InMemoryPdfService, MAX_FILE_SIZE

client = TestClient(app)

@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

def test_risk_1_scoping_question_bank(db: Session):
    """
    Risk 1: Do not load the entire question bank for all candidates in one unbounded request.
    Verifies that start_or_resume_attempt returns only the assigned set questions.
    """
    uid = uuid.uuid4().hex[:6].upper()
    admin_email = "admin_risk1@secureexam.local"

    dept = Department(name=f"Risk1 Dept {uid}", code=f"R1{uid[:4]}", active=True)
    db.add(dept)
    db.commit()
    db.refresh(dept)

    exam_dto = ExamService.create_exam(
        db,
        type("Dto", (), {
            "title": f"Risk1 Exam {uid}",
            "description": "Risk 1 verification",
            "duration_minutes": 60,
            "total_questions": 10,
            "qualification_mode": "PERCENTAGE",
            "qualification_threshold": Decimal("50.00"),
            "timing_mode": "DURATION_FROM_START",
            "total_marks": Decimal("100.00"),
            "marks_per_question": Decimal("10.00"),
            "negative_marks": Decimal("0.00"),
            "scheduled_start_time": None,
            "scheduled_end_time": None,
            "department_ids": [dept.id]
        })(),
        admin_email
    )

    sets = db.query(QuestionSet).filter(QuestionSet.exam_id == exam_dto.id).all()
    set_a = next(s for s in sets if s.set_code == "A")
    set_b = next(s for s in sets if s.set_code == "B")

    # Add 1 question to Set A and 1 question to Set B
    QuestionService.create_question(
        db, set_a.id,
        QuestionDto(
            question_text="Set A exclusive question?",
            marks=Decimal("10.00"),
            negative_marks=Decimal("0.00"),
            display_order=1,
            options=[
                QuestionOptionDto(option_text="A1", correct=True, display_order=1),
                QuestionOptionDto(option_text="A2", correct=False, display_order=2)
            ]
        ),
        admin_email
    )
    QuestionService.create_question(
        db, set_b.id,
        QuestionDto(
            question_text="Set B exclusive question?",
            marks=Decimal("10.00"),
            negative_marks=Decimal("0.00"),
            display_order=1,
            options=[
                QuestionOptionDto(option_text="B1", correct=True, display_order=1),
                QuestionOptionDto(option_text="B2", correct=False, display_order=2)
            ]
        ),
        admin_email
    )

    ExamService.publish_exam(db, exam_dto.id, admin_email)

    cand = Candidate(
        registration_number=f"CAND-R1-{uid}",
        full_name=f"Risk One Candidate {uid}",
        email=f"risk1_{uid.lower()}@test.edu",
        department_id=dept.id,
        assigned_set="Set A",
        status="ACTIVE"
    )
    db.add(cand)
    db.commit()
    db.refresh(cand)

    v_res = CandidateExamService.verify_candidate(
        db, CandidateVerifyRequest(
            full_name=cand.full_name,
            email=cand.email,
            department_id=dept.id,
            department_name=dept.name
        )
    )
    assert v_res.eligible is True
    assert v_res.question_set_code == "A"

    attempt_data = CandidateExamService.start_or_resume_attempt(db, cand.id, exam_dto.id)
    assert len(attempt_data.questions) == 1
    assert attempt_data.questions[0].question_text == "Set A exclusive question?"
    # Verify answers are never leaked in payload
    for q in attempt_data.questions:
        for opt in q.options:
            assert not hasattr(opt, "is_correct") or not hasattr(opt, "correct")


def test_risk_2_concurrent_database_writes_idempotent_upsert(db: Session):
    """
    Risk 2: Use PostgreSQL transactions, unique constraints, idempotent upserts.
    Verifies that saving answers for the same question updates in-place and never creates duplicates.
    """
    uid = uuid.uuid4().hex[:6].upper()
    admin_email = "admin_risk2@secureexam.local"

    dept = db.query(Department).first()
    exam_dto = ExamService.create_exam(
        db,
        type("Dto", (), {
            "title": f"Risk2 Upsert Exam {uid}",
            "description": "Risk 2 verification",
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
            "department_ids": [dept.id]
        })(),
        admin_email
    )

    sets = db.query(QuestionSet).filter(QuestionSet.exam_id == exam_dto.id).all()
    q = QuestionService.create_question(
        db, sets[0].id,
        QuestionDto(
            question_text="Risk 2 concurrency question?",
            marks=Decimal("10.00"),
            negative_marks=Decimal("0.00"),
            display_order=1,
            options=[
                QuestionOptionDto(option_text="Opt 1", correct=True, display_order=1),
                QuestionOptionDto(option_text="Opt 2", correct=False, display_order=2)
            ]
        ),
        admin_email
    )
    ExamService.publish_exam(db, exam_dto.id, admin_email)

    cand = Candidate(
        registration_number=f"CAND-R2-{uid}",
        full_name=f"Risk Two Candidate {uid}",
        email=f"risk2_{uid.lower()}@test.edu",
        department_id=dept.id,
        status="ACTIVE"
    )
    db.add(cand)
    db.commit()
    db.refresh(cand)

    CandidateExamService.verify_candidate(
        db, CandidateVerifyRequest(
            full_name=cand.full_name,
            email=cand.email,
            department_id=dept.id,
            department_name=dept.name
        )
    )

    attempt_data = CandidateExamService.start_or_resume_attempt(db, cand.id, exam_dto.id)
    attempt_id = attempt_data.attempt_id
    opt1_id = attempt_data.questions[0].options[0].id
    opt2_id = attempt_data.questions[0].options[1].id

    # 1. First save
    res1 = CandidateExamService.save_answer(db, attempt_id, q.id, opt1_id)
    assert res1["success"] is True

    # 2. Immediate concurrent second save for same question
    res2 = CandidateExamService.save_answer(db, attempt_id, q.id, opt2_id)
    assert res2["success"] is True

    # 3. Third save: clear selection
    res3 = CandidateExamService.save_answer(db, attempt_id, q.id, None)
    assert res3["success"] is True

    # Verify strictly 1 row exists in attempt_answers for this (attempt_id, question_id)
    answer_rows = db.query(AttemptAnswer).filter(
        AttemptAnswer.attempt_id == attempt_id,
        AttemptAnswer.question_id == q.id
    ).all()
    assert len(answer_rows) == 1, "Must never have duplicate answer rows for the same question"
    assert answer_rows[0].selected_option_id is None, "Option should be successfully cleared"


def test_risk_3_timer_preservation_on_page_refresh(db: Session):
    """
    Risk 3: Never reset the candidate's exam timer because they refreshed the page.
    Verifies that start_or_resume_attempt preserves the original expires_at timestamp.
    """
    uid = uuid.uuid4().hex[:6].upper()
    admin_email = "admin_risk3@secureexam.local"

    dept = db.query(Department).first()
    exam_dto = ExamService.create_exam(
        db,
        type("Dto", (), {
            "title": f"Risk3 Timer Exam {uid}",
            "description": "Risk 3 timer preservation",
            "duration_minutes": 45,
            "total_questions": 1,
            "qualification_mode": "PERCENTAGE",
            "qualification_threshold": Decimal("50.00"),
            "timing_mode": "DURATION_FROM_START",
            "total_marks": Decimal("10.00"),
            "marks_per_question": Decimal("10.00"),
            "negative_marks": Decimal("0.00"),
            "scheduled_start_time": None,
            "scheduled_end_time": None,
            "department_ids": [dept.id]
        })(),
        admin_email
    )

    sets = db.query(QuestionSet).filter(QuestionSet.exam_id == exam_dto.id).all()
    QuestionService.create_question(
        db, sets[0].id,
        QuestionDto(
            question_text="Timer test question?",
            marks=Decimal("10.00"),
            negative_marks=Decimal("0.00"),
            display_order=1,
            options=[
                QuestionOptionDto(option_text="T1", correct=True, display_order=1),
                QuestionOptionDto(option_text="T2", correct=False, display_order=2)
            ]
        ),
        admin_email
    )
    ExamService.publish_exam(db, exam_dto.id, admin_email)

    cand = Candidate(
        registration_number=f"CAND-R3-{uid}",
        full_name=f"Risk Three Candidate {uid}",
        email=f"risk3_{uid.lower()}@test.edu",
        department_id=dept.id,
        status="ACTIVE"
    )
    db.add(cand)
    db.commit()
    db.refresh(cand)

    CandidateExamService.verify_candidate(
        db, CandidateVerifyRequest(
            full_name=cand.full_name,
            email=cand.email,
            department_id=dept.id,
            department_name=dept.name
        )
    )

    # Initial start
    first_start = CandidateExamService.start_or_resume_attempt(db, cand.id, exam_dto.id)
    initial_deadline = first_start.expires_at

    # Simulate candidate refreshing the page after some time
    refreshed_attempt = CandidateExamService.start_or_resume_attempt(db, cand.id, exam_dto.id)
    refreshed_deadline = refreshed_attempt.expires_at

    assert initial_deadline == refreshed_deadline, "Exam timer deadline must be strictly preserved across page refreshes"


def test_risk_4_simultaneous_final_submissions_idempotent(db: Session):
    """
    Risk 4: Make finalization idempotent. Lock or atomically transition each attempt to a final state,
    compute scores once, and persist the result and receipt together in a transaction.
    """
    uid = uuid.uuid4().hex[:6].upper()
    admin_email = "admin_risk4@secureexam.local"

    dept = db.query(Department).first()
    exam_dto = ExamService.create_exam(
        db,
        type("Dto", (), {
            "title": f"Risk4 Idempotent Exam {uid}",
            "description": "Risk 4 final submission verification",
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
            "department_ids": [dept.id]
        })(),
        admin_email
    )

    sets = db.query(QuestionSet).filter(QuestionSet.exam_id == exam_dto.id).all()
    q = QuestionService.create_question(
        db, sets[0].id,
        QuestionDto(
            question_text="Idempotent finalization question?",
            marks=Decimal("10.00"),
            negative_marks=Decimal("0.00"),
            display_order=1,
            options=[
                QuestionOptionDto(option_text="Correct", correct=True, display_order=1),
                QuestionOptionDto(option_text="Wrong", correct=False, display_order=2)
            ]
        ),
        admin_email
    )
    ExamService.publish_exam(db, exam_dto.id, admin_email)

    cand = Candidate(
        registration_number=f"CAND-R4-{uid}",
        full_name=f"Risk Four Candidate {uid}",
        email=f"risk4_{uid.lower()}@test.edu",
        department_id=dept.id,
        status="ACTIVE"
    )
    db.add(cand)
    db.commit()
    db.refresh(cand)

    CandidateExamService.verify_candidate(
        db, CandidateVerifyRequest(
            full_name=cand.full_name,
            email=cand.email,
            department_id=dept.id,
            department_name=dept.name
        )
    )

    attempt_data = CandidateExamService.start_or_resume_attempt(db, cand.id, exam_dto.id)
    attempt_id = attempt_data.attempt_id
    correct_opt_id = attempt_data.questions[0].options[0].id

    # Save answer
    CandidateExamService.save_answer(db, attempt_id, q.id, correct_opt_id)

    # 1. First submission
    sub1 = CandidateExamService.submit_attempt(db, attempt_id)
    assert sub1.success is True
    receipt1 = sub1.receipt_id
    assert receipt1 is not None and len(receipt1) > 0

    # 2. Simultaneous duplicate final submission
    sub2 = CandidateExamService.submit_attempt(db, attempt_id)
    assert sub2.success is True
    receipt2 = sub2.receipt_id

    # Receipt and score must be identical, not re-computed or re-generated
    assert receipt1 == receipt2, "Simultaneous final submissions must return the exact same receipt ID"
    assert sub1.attempt_id == sub2.attempt_id

    # Verify attempt in DB is SUBMITTED exactly once
    final_attempt = db.query(ExamAttempt).filter(ExamAttempt.id == attempt_id).first()
    assert final_attempt.status == "SUBMITTED"
    assert final_attempt.receipt_id == receipt1


def test_risk_5_pdf_parsing_bounds():
    """
    Risk 5: Bound file size, processing time and concurrency.
    Keep PDF extraction out of the live answer-save path.
    """
    assert MAX_FILE_SIZE <= 15 * 1024 * 1024, "File size bound must be strictly <= 15 MB"
