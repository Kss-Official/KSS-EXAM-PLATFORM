import io
import pytest
from decimal import Decimal
from fastapi import UploadFile
from sqlalchemy.orm import Session

from app.core import SessionLocal
from app.models import Department, Exam, QuestionSet, Question, QuestionOption, Candidate
from app.services import QuestionService, CandidateService, InMemoryPdfService

@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

def test_question_import_and_answer_key_parity(db: Session):
    # Setup test department, exam and question set
    dept = Department(name="Unit Test Dept", code="UTD", active=True)
    db.add(dept)
    db.flush()

    exam = Exam(title="Unit Test Exam", duration_minutes=30, total_questions=2)
    db.add(exam)
    db.flush()

    q_set = QuestionSet(exam_id=exam.id, department_id=dept.id, set_code="A", name="Set A")
    db.add(q_set)
    db.commit()
    db.refresh(q_set)

    try:
        raw_text = """
        Question 1: What does CPU stand for?
        A) Central Processing Unit
        B) Computer Personal Unit
        C) Central Performance Utility
        D) Core Processing Union
        Answer: A

        Question 2: Which protocol secures web traffic?
        A) FTP
        B) HTTP
        C) HTTPS
        D) SMTP
        Ans: C
        """

        imported = QuestionService.import_questions_from_text(db, q_set.id, raw_text, "TEST_ADMIN")
        assert len(imported) == 2
        assert "CPU" in imported[0].question_text
        assert len(imported[0].options) == 4
        # Check correct option
        correct_opts_q1 = [o for o in imported[0].options if o.correct]
        assert len(correct_opts_q1) == 1
        assert correct_opts_q1[0].option_text == "Central Processing Unit"

        # Test apply answer key updating answers: change Q1 to B and Q2 to D
        key_payload = "1: B\n2: D"
        res = QuestionService.apply_answer_key(db, q_set.id, key_payload, "TEST_ADMIN")
        assert res["success"] is True
        assert res["mappedAnswers"] == 2

        # Verify Q1 now has B as correct
        q1_reloaded = db.query(Question).filter(Question.id == imported[0].id).first()
        for opt in q1_reloaded.options:
            if opt.option_text == "Computer Personal Unit":
                assert opt.is_correct is True
            else:
                assert opt.is_correct is False

    finally:
        # Cleanup
        db.delete(q_set)
        db.delete(exam)
        db.delete(dept)
        db.commit()

def test_candidate_csv_import(db: Session):
    db.query(Candidate).filter(Candidate.registration_number.in_(["CAND-PARITY-1", "CAND-PARITY-2"])).delete(synchronize_session=False)
    db.commit()

    csv_data = (
        "Registration Number,Full Name,Email,Department\n"
        "CAND-PARITY-1,Parity User One,parity1@test.local,\n"
        "CAND-PARITY-2,Parity User Two,parity2@test.local,\n"
    ).encode("utf-8")

    upload_file = UploadFile(
        filename="candidates.csv",
        file=io.BytesIO(csv_data)
    )

    result = CandidateService.import_candidates_csv_sync(db, upload_file, "TEST_ADMIN")
    assert result["success"] is True
    assert result["totalImported"] == 2

    # Cleanup imported test candidates
    try:
        cands = db.query(Candidate).filter(Candidate.registration_number.in_(["CAND-PARITY-1", "CAND-PARITY-2"])).all()
        for c in cands:
            db.delete(c)
        db.commit()
    except Exception:
        db.rollback()

def test_pdf_ocr_heuristic():
    # Test non-PDF header failure
    with pytest.raises(ValueError, match="not a valid PDF document"):
        InMemoryPdfService.extract_text_from_pdf_bytes(b"INVALID_HEADER_DATA", "test.pdf")
