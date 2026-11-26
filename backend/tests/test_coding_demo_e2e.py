import time
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.candidate import Candidate
from app.models.coding import CodingExam, CodingQuestion
from app.models.exam import Exam
from scripts.seed_coding_demo import (
    DEMO_CAND_EMAIL,
    DEMO_CAND_NAME,
    DEMO_EXAM_TITLE,
    DEMO_R1_TITLE,
    remove_demo,
    seed_demo,
)

client = TestClient(app)


def _poll_submission(c: TestClient, sub_id: int, headers: dict, timeout_s: float = 8.0):
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        res = c.get(f"/api/coding/submissions/{sub_id}", headers=headers)
        assert res.status_code == 200
        if res.json()["status"] not in ("QUEUED", "RUNNING"):
            return res.json()
        time.sleep(0.15)
    raise AssertionError(f"Submission {sub_id} did not finish within {timeout_s}s")


def test_demo_seed_e2e_flow_and_clean_remove(monkeypatch):
    monkeypatch.setattr(settings, "DEBUG", True)
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "CODING_ROUND_ENABLED", True)
    monkeypatch.setattr(settings, "CODING_SANDBOX_DRIVER", "local_python")
    monkeypatch.setattr(settings, "LOCAL_DEMO_SANDBOX", True)
    monkeypatch.setattr(settings, "CODING_CODE_RETENTION", "none")

    with TestClient(app) as c:
        # Record existing non-DEMO Round 1 exam count
        db = SessionLocal()
        try:
            non_demo_r1_before = db.query(Exam).filter(Exam.title != DEMO_R1_TITLE).count()
        finally:
            db.close()

        # 1. Seed idempotently (run twice)
        seed_demo(force=True)
        info = seed_demo(force=True)
        exam_id = info["examId"]
        assert len(info["questionIds"]) == 3

        # 2. Log in as DEMO candidate via Round 1 verify endpoint
        login_res = c.post(
            "/api/candidate/verify",
            json={
                "email": DEMO_CAND_EMAIL,
                "fullName": DEMO_CAND_NAME,
                "departmentName": info["department"],
            },
        )
        assert login_res.status_code == 200
        assert login_res.json()["eligible"] is True
        token = login_res.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 3. Load attempt & problem 1
        att_res = c.get(f"/api/coding/exams/{exam_id}/attempt", headers=headers)
        assert att_res.status_code == 200
        assert att_res.json()["questionIds"] == info["questionIds"]

        q1_id = info["questionIds"][0]
        p1_res = c.get(f"/api/coding/problems/{q1_id}", headers=headers)
        assert p1_res.status_code == 200
        assert len(p1_res.json()["sampleTestCases"]) == 2

        # 4. Save draft
        sol_q1 = "import sys\na, b = map(int, sys.stdin.read().split())\nprint(a + b)\n"
        draft_res = c.put(
            "/api/coding/drafts",
            headers=headers,
            json={"examId": exam_id, "questionId": q1_id, "language": "python3", "code": sol_q1},
        )
        assert draft_res.status_code == 200

        # 5. Run sample tests
        run_res = c.post(
            "/api/coding/run",
            headers=headers,
            json={"examId": exam_id, "questionId": q1_id, "language": "python3", "code": sol_q1},
        )
        assert run_res.status_code == 202
        run_status = _poll_submission(c, run_res.json()["submissionId"], headers)
        assert run_status["verdict"] == "ACCEPTED"

        # 6. Submit full solution for Q1 (20 marks out of 100 total across 3 questions)
        sub_res = c.post(
            "/api/coding/submit",
            headers=headers,
            json={
                "examId": exam_id,
                "questionId": q1_id,
                "language": "python3",
                "code": sol_q1,
                "idempotencyKey": f"demo-e2e-{int(time.time() * 1000)}",
            },
        )
        assert sub_res.status_code == 202
        sub_status = _poll_submission(c, sub_res.json()["submissionId"], headers)
        assert sub_status["verdict"] == "ACCEPTED"

        # 7. Finalize & check result percent (20 / 100 = 20.0%)
        fin_res = c.post(f"/api/coding/finalize/{exam_id}", headers=headers)
        assert fin_res.status_code == 200

        res_me = c.get(f"/api/coding/results/me?examId={exam_id}", headers=headers)
        assert res_me.status_code == 200
        body = res_me.json()
        assert body["resultsPublished"] is True
        assert body["totalScore"] == 20.0
        assert body["totalPossible"] == 100.0
        assert body["overallPercent"] == 20.0

        # 8. Remove DEMO rows and confirm Round 1 rows are untouched
        remove_demo(force=True)
        db = SessionLocal()
        try:
            assert db.query(CodingExam).filter(CodingExam.title == DEMO_EXAM_TITLE).first() is None
            assert db.query(CodingQuestion).filter(CodingQuestion.id == q1_id).first() is None
            assert db.query(Candidate).filter(Candidate.email == DEMO_CAND_EMAIL).first() is None
            assert db.query(Exam).filter(Exam.title == DEMO_R1_TITLE).first() is None
            assert db.query(Exam).filter(Exam.title != DEMO_R1_TITLE).count() == non_demo_r1_before
        finally:
            db.close()
