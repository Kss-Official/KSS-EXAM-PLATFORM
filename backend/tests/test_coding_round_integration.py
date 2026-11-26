import json
import time
from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import create_session_token
from app.models.candidate import Candidate
from app.models.department import Department
from app.models.exam import Exam
from app.models.attempt import ExamAttempt
from app.models.question import QuestionSet
from app.models.coding import CodingExam, CodingQuestion, CodingTestCase, CodingAttempt

client = TestClient(app)


@pytest.fixture
def coding_fixtures(monkeypatch):
    monkeypatch.setattr(settings, "CODING_ROUND_ENABLED", True)
    monkeypatch.setattr(settings, "CODING_SANDBOX_DRIVER", "mock")
    monkeypatch.setattr(settings, "CODING_REQUIRE_ROUND1_QUALIFIED", True)

    db = SessionLocal()
    try:
        dept = db.query(Department).first()
        if not dept:
            dept = Department(name="CSE", code="CSE_TEST", active=True)
            db.add(dept)
            db.commit()
            db.refresh(dept)

        uniq = int(time.time() * 1000) % 1000000
        cand1 = Candidate(
            registration_number=f"REG-A-{uniq}",
            full_name="Alice Coder",
            email=f"alice_{uniq}@test.local",
            department_id=dept.id,
            status="ACTIVE",
        )
        cand2 = Candidate(
            registration_number=f"REG-B-{uniq}",
            full_name="Bob Unqualified",
            email=f"bob_{uniq}@test.local",
            department_id=dept.id,
            status="ACTIVE",
        )
        db.add_all([cand1, cand2])
        db.commit()
        db.refresh(cand1)
        db.refresh(cand2)

        r1_exam = Exam(title=f"R1_{uniq}", duration_minutes=30, total_questions=1, status="PUBLISHED")
        db.add(r1_exam)
        db.commit()
        db.refresh(r1_exam)

        qset = QuestionSet(exam_id=r1_exam.id, set_code="A", name="Set A")
        db.add(qset)
        db.commit()
        db.refresh(qset)

        r1_attempt = ExamAttempt(
            candidate_id=cand1.id,
            exam_id=r1_exam.id,
            question_set_id=qset.id,
            status="SUBMITTED",
            qualification_status="QUALIFIED",
        )
        db.add(r1_attempt)

        c_exam = CodingExam(title=f"Round 2 Coding {uniq}", duration_minutes=60, status="PUBLISHED", total_marks=20)
        db.add(c_exam)
        db.commit()
        db.refresh(c_exam)

        q_id = f"q_echo_{uniq}"
        c_q = CodingQuestion(
            id=q_id,
            exam_id=c_exam.id,
            title="Echo Sum",
            problem_statement="Print hello",
            max_marks=20,
            allowed_languages=json.dumps(["python3", "javascript"]),
            starter_code_json=json.dumps({"python3": "print('hello')"}),
        )
        db.add(c_q)
        db.commit()

        tc_sample = CodingTestCase(
            id=f"tc_pub_{uniq}",
            question_id=q_id,
            label="Sample 1",
            input_data="pub_in",
            expected_output="hello",
            is_hidden=False,
            marks=5,
        )
        tc_hidden = CodingTestCase(
            id=f"tc_hid_{uniq}",
            question_id=q_id,
            label="Hidden 1",
            input_data="SECRET_HIDDEN_INPUT_XYZ",
            expected_output="SECRET_HIDDEN_OUTPUT_XYZ",
            is_hidden=True,
            marks=15,
        )
        db.add_all([tc_sample, tc_hidden])
        db.commit()

        tok1 = create_session_token({"role": "CANDIDATE", "candidate_id": cand1.id, "email": cand1.email})
        tok2 = create_session_token({"role": "CANDIDATE", "candidate_id": cand2.id, "email": cand2.email})

        yield {
            "cand1": cand1,
            "cand2": cand2,
            "tok1": tok1,
            "tok2": tok2,
            "exam_id": c_exam.id,
            "question_id": q_id,
        }
    finally:
        db.close()


def test_round2_eligibility_and_hidden_test_isolation(coding_fixtures):
    fx = coding_fixtures
    # Unauthenticated -> 401
    assert client.get(f"/api/coding/problems/{fx['question_id']}").status_code == 401

    # Unqualified Round 1 candidate -> 403
    res_unq = client.get(
        f"/api/coding/problems/{fx['question_id']}",
        headers={"Authorization": f"Bearer {fx['tok2']}"},
    )
    assert res_unq.status_code == 403

    # Qualified candidate gets problem, NEVER hidden test data
    res_ok = client.get(
        f"/api/coding/problems/{fx['question_id']}",
        headers={"Authorization": f"Bearer {fx['tok1']}"},
    )
    assert res_ok.status_code == 200
    assert "SECRET_HIDDEN_INPUT_XYZ" not in res_ok.text
    assert "SECRET_HIDDEN_OUTPUT_XYZ" not in res_ok.text
    assert len(res_ok.json()["sampleTestCases"]) == 1


def test_run_submit_idempotency_and_hidden_redaction(coding_fixtures):
    fx = coding_fixtures
    headers = {"Authorization": f"Bearer {fx['tok1']}"}

    # 1. Run sample test
    run_res = client.post(
        "/api/coding/run",
        headers=headers,
        json={
            "examId": fx["exam_id"],
            "questionId": fx["question_id"],
            "language": "python3",
            "code": "print('hello')",
        },
    )
    assert run_res.status_code == 202
    run_id = run_res.json()["submissionId"]
    time.sleep(0.2)
    run_status = client.get(f"/api/coding/submissions/{run_id}", headers=headers)
    assert run_status.status_code == 200
    assert run_status.json()["verdict"] == "ACCEPTED"

    # 2. Submit with idempotencyKey
    idem_key = f"idem-{int(time.time() * 1000)}"
    sub1 = client.post(
        "/api/coding/submit",
        headers=headers,
        json={
            "examId": fx["exam_id"],
            "questionId": fx["question_id"],
            "language": "python3",
            "code": "print('hello')",
            "idempotencyKey": idem_key,
        },
    )
    assert sub1.status_code == 202
    sub_id = sub1.json()["submissionId"]

    # Replay same idempotencyKey -> returns same submissionId with idempotentReplay=True
    sub2 = client.post(
        "/api/coding/submit",
        headers=headers,
        json={
            "examId": fx["exam_id"],
            "questionId": fx["question_id"],
            "language": "python3",
            "code": "print('hello')",
            "idempotencyKey": idem_key,
        },
    )
    assert sub2.status_code == 202
    assert sub2.json()["submissionId"] == sub_id
    assert sub2.json()["idempotentReplay"] is True

    time.sleep(0.2)
    sub_status = client.get(f"/api/coding/submissions/{sub_id}", headers=headers)
    assert sub_status.status_code == 200
    body = sub_status.json()
    assert body["totalCount"] == 2
    assert body["passedCount"] == 1  # Sample passed, hidden failed
    # Critical: hidden test input/expected/actual must NEVER appear in response
    assert "SECRET_HIDDEN_INPUT_XYZ" not in sub_status.text
    assert "SECRET_HIDDEN_OUTPUT_XYZ" not in sub_status.text
    hidden_items = [tc for tc in body["testCaseResults"] if tc["isHidden"]]
    assert len(hidden_items) == 1
    assert hidden_items[0]["input"] is None
    assert hidden_items[0]["expectedOutput"] is None
    assert hidden_items[0]["actualOutput"] is None


def test_expired_attempt_blocks_run_and_submit(coding_fixtures):
    fx = coding_fixtures
    headers = {"Authorization": f"Bearer {fx['tok1']}"}
    db = SessionLocal()
    try:
        att = (
            db.query(CodingAttempt)
            .filter(CodingAttempt.candidate_id == fx["cand1"].id, CodingAttempt.exam_id == fx["exam_id"])
            .first()
        )
        if not att:
            att = CodingAttempt(
                candidate_id=fx["cand1"].id,
                exam_id=fx["exam_id"],
                status="IN_PROGRESS",
                started_at=datetime.now(timezone.utc) - timedelta(hours=2),
                expires_at=datetime.now(timezone.utc) - timedelta(minutes=5),
            )
            db.add(att)
        else:
            att.expires_at = datetime.now(timezone.utc) - timedelta(minutes=5)
        db.commit()
    finally:
        db.close()

    res = client.post(
        "/api/coding/run",
        headers=headers,
        json={
            "examId": fx["exam_id"],
            "questionId": fx["question_id"],
            "language": "python3",
            "code": "print('hello')",
        },
    )
    assert res.status_code == 403
