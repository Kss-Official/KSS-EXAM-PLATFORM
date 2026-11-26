import json
import time
from datetime import datetime, timedelta, timezone
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import create_session_token
from app.models.candidate import Candidate
from app.models.department import Department
from app.models.user import AppUser
from app.models.coding import (
    CodingAttempt,
    CodingDraft,
    CodingExam,
    CodingQuestion,
    CodingQuestionResult,
    CodingSubmission,
    CodingTestCase,
)
from app.coding.scoring import compute_overall_attempt_score, compute_question_result_metrics
from app.coding.results_service import finalize_coding_attempt_results, purge_expired_submission_code

client = TestClient(app)


# ==============================================================================
# 1. Weighted Scoring Unit Tests
# ==============================================================================

def test_scoring_all_pass():
    tcs = [{"id": "s1", "marks": 5, "isHidden": False}, {"id": "h1", "marks": 15, "isHidden": True}]
    res = [
        {"testCaseId": "s1", "passed": True, "isHidden": False, "verdict": "ACCEPTED", "runtimeMs": 10, "memoryKb": 1024},
        {"testCaseId": "h1", "passed": True, "isHidden": True, "verdict": "ACCEPTED", "runtimeMs": 20, "memoryKb": 2048},
    ]
    out = compute_question_result_metrics(tcs, res, 20.0, "python3", 1, "print('hi')", "ACCEPTED")
    assert out.score_awarded == 20.0
    assert out.score_percent == 100.0
    assert out.tests_passed == 2 and out.sample_passed == 1 and out.hidden_passed == 1
    assert out.code_hash is not None


def test_scoring_partial_weighted():
    tcs = [{"id": "s1", "marks": 5, "isHidden": False}, {"id": "h1", "marks": 15, "isHidden": True}]
    res = [
        {"testCaseId": "s1", "passed": True, "isHidden": False, "verdict": "ACCEPTED"},
        {"testCaseId": "h1", "passed": False, "isHidden": True, "verdict": "WRONG_ANSWER"},
    ]
    out = compute_question_result_metrics(tcs, res, 20.0, "python3", 2, "x=1", "WRONG_ANSWER")
    assert out.score_awarded == 5.0
    assert out.score_percent == 25.0
    assert out.failure_summary == {"WRONG_ANSWER": 1}
    assert out.first_failure_type == "WRONG_ANSWER"


def test_scoring_compile_error_is_zero():
    tcs = [{"id": "s1", "marks": 5, "isHidden": False}, {"id": "h1", "marks": 15, "isHidden": True}]
    res = [
        {"testCaseId": "s1", "passed": True, "isHidden": False, "verdict": "ACCEPTED"},
    ]
    out = compute_question_result_metrics(
        tcs, res, 20.0, "cpp", 1, "bad syntax", "COMPILE_ERROR", compile_error="error: expected ';'\n  line 1"
    )
    assert out.score_awarded == 0.0
    assert out.score_percent == 0.0
    assert out.compile_error_short is not None and len(out.compile_error_short) <= 300


def test_scoring_all_fail_and_tle_mix_keeps_passed_credit():
    tcs = [
        {"id": "s1", "marks": 5, "isHidden": False},
        {"id": "h1", "marks": 10, "isHidden": True},
        {"id": "h2", "marks": 15, "isHidden": True},
    ]
    all_fail = [
        {"testCaseId": "s1", "passed": False, "isHidden": False, "verdict": "WRONG_ANSWER"},
        {"testCaseId": "h1", "passed": False, "isHidden": True, "verdict": "WRONG_ANSWER"},
        {"testCaseId": "h2", "passed": False, "isHidden": True, "verdict": "WRONG_ANSWER"},
    ]
    out_fail = compute_question_result_metrics(tcs, all_fail, 30.0, "python3", 1, "x", "WRONG_ANSWER")
    assert out_fail.score_awarded == 0.0

    tle_mix = [
        {"testCaseId": "s1", "passed": True, "isHidden": False, "verdict": "ACCEPTED"},
        {"testCaseId": "h1", "passed": True, "isHidden": True, "verdict": "ACCEPTED"},
        {"testCaseId": "h2", "passed": False, "isHidden": True, "verdict": "TIME_LIMIT_EXCEEDED"},
    ]
    out_tle = compute_question_result_metrics(tcs, tle_mix, 30.0, "python3", 1, "x", "TIME_LIMIT_EXCEEDED")
    assert out_tle.score_awarded == 15.0
    assert out_tle.score_percent == 50.0
    assert out_tle.failure_summary == {"TIME_LIMIT_EXCEEDED": 1}

    agg = compute_overall_attempt_score([(15.0, 30.0), (20.0, 20.0)], qualification_percentage=60.0)
    assert agg["total_score"] == 35.0
    assert agg["total_possible"] == 50.0
    assert agg["overall_percent"] == 70.0
    assert agg["qualification_status"] == "QUALIFIED"


# ==============================================================================
# 2. Finalize, Retention Ordering, Privacy, & Admin Pagination Integration Tests
# ==============================================================================

@pytest.fixture
def phase7_fixtures(monkeypatch):
    monkeypatch.setattr(settings, "CODING_ROUND_ENABLED", True)
    monkeypatch.setattr(settings, "CODING_CODE_RETENTION", "none")

    db = SessionLocal()
    try:
        dept = db.query(Department).first()
        if not dept:
            dept = Department(name="CSE", code="CSE_P7", active=True)
            db.add(dept)
            db.commit()
            db.refresh(dept)

        uniq = int(time.time() * 1000) % 1000000
        admin = db.query(AppUser).filter(AppUser.role == "SUPER_ADMIN").first()
        admin_tok = create_session_token({"user_id": admin.id, "email": admin.email, "role": admin.role})

        exam = CodingExam(title=f"Phase7 Exam {uniq}", duration_minutes=60, status="PUBLISHED", total_marks=20, results_published=False)
        db.add(exam)
        db.commit()
        db.refresh(exam)

        qid = f"q_p7_{uniq}"
        q = CodingQuestion(id=qid, exam_id=exam.id, title="Weighted Sum", problem_statement="Sum", max_marks=20)
        db.add(q)
        db.commit()
        db.add_all([
            CodingTestCase(id=f"tc_p7_pub_{uniq}", question_id=qid, label="Sample 1", input_data="1", expected_output="1", is_hidden=False, marks=5),
            CodingTestCase(id=f"tc_p7_hid_{uniq}", question_id=qid, label="Hidden 1", input_data="SECRET_IN_P7", expected_output="SECRET_OUT_P7", is_hidden=True, marks=15),
        ])
        db.commit()

        cands = []
        toks = []
        for idx in range(3):
            c = Candidate(
                registration_number=f"P7-{uniq}-{idx}",
                full_name=f"Phase7 User {idx}",
                email=f"p7_{uniq}_{idx}@test.local",
                department_id=dept.id,
                status="ACTIVE",
            )
            db.add(c)
            db.commit()
            db.refresh(c)
            cands.append(c)
            toks.append(create_session_token({"role": "CANDIDATE", "candidate_id": c.id, "email": c.email}))

            att = CodingAttempt(candidate_id=c.id, exam_id=exam.id, status="IN_PROGRESS", total_marks=20)
            db.add(att)
            db.commit()
            db.refresh(att)

            db.add(CodingDraft(attempt_id=att.id, candidate_id=c.id, question_id=qid, language="python3", source_code="print('1')"))
            db.add(CodingSubmission(
                attempt_id=att.id,
                candidate_id=c.id,
                question_id=qid,
                language="python3",
                source_code="print('1')",
                idempotency_key=f"p7-sub-{uniq}-{idx}",
                is_run_only=False,
                verdict="WRONG_ANSWER" if idx > 0 else "ACCEPTED",
                status="PARTIAL" if idx > 0 else "PASSED",
                passed_test_cases=1 if idx > 0 else 2,
                total_test_cases=2,
                marks_awarded=5 if idx > 0 else 20,
                test_case_results=json.dumps([
                    {"testCaseId": f"tc_p7_pub_{uniq}", "label": "Sample 1", "passed": True, "isHidden": False, "verdict": "ACCEPTED", "input": "1", "expectedOutput": "1", "actualOutput": "1"},
                    {"testCaseId": f"tc_p7_hid_{uniq}", "label": "Hidden 1", "passed": idx == 0, "isHidden": True, "verdict": "ACCEPTED" if idx == 0 else "WRONG_ANSWER"},
                ]),
            ))
            db.commit()

        yield {"exam": exam, "qid": qid, "cands": cands, "toks": toks, "admin_tok": admin_tok}
    finally:
        db.close()


def test_idempotent_finalize_and_retention_ordering(phase7_fixtures):
    fx = phase7_fixtures
    db = SessionLocal()
    try:
        att = db.query(CodingAttempt).filter(CodingAttempt.candidate_id == fx["cands"][0].id, CodingAttempt.exam_id == fx["exam"].id).first()

        # Simulate crash in retention step: result row must still be committed, code NOT deleted yet
        with patch("app.coding.results_service.apply_code_retention_for_attempt", side_effect=RuntimeError("simulated crash")):
            with pytest.raises(RuntimeError, match="simulated crash"):
                finalize_coding_attempt_results(att.id, db)

        res_rows = db.query(CodingQuestionResult).filter(CodingQuestionResult.attempt_id == att.id).all()
        assert len(res_rows) == 1
        assert float(res_rows[0].score_awarded) == 20.0
        # Source code still intact because retention crashed after commit
        sub_before = db.query(CodingSubmission).filter(CodingSubmission.attempt_id == att.id).first()
        assert sub_before.source_code == "print('1')"

        # Idempotent second call succeeds and now applies retention="none"
        finalize_coding_attempt_results(att.id, db, retention_policy="none")
        finalize_coding_attempt_results(att.id, db, retention_policy="none")

        res_rows_after = db.query(CodingQuestionResult).filter(CodingQuestionResult.attempt_id == att.id).all()
        assert len(res_rows_after) == 1
        assert db.query(CodingDraft).filter(CodingDraft.attempt_id == att.id).count() == 0
        sub_after = db.query(CodingSubmission).filter(CodingSubmission.attempt_id == att.id).first()
        assert sub_after.source_code is None
        assert sub_after.code_hash is not None

        # Test days:0 purge job
        att1 = db.query(CodingAttempt).filter(CodingAttempt.candidate_id == fx["cands"][1].id, CodingAttempt.exam_id == fx["exam"].id).first()
        finalize_coding_attempt_results(att1.id, db, retention_policy="days:1")
        sub1 = db.query(CodingSubmission).filter(CodingSubmission.attempt_id == att1.id).first()
        assert sub1.source_code is not None
        sub1.retention_expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
        db.commit()
        purged = purge_expired_submission_code(db, batch_size=50)
        assert purged >= 1
        db.refresh(sub1)
        assert sub1.source_code is None
    finally:
        db.close()


def test_candidate_result_release_privacy_and_admin_pagination(phase7_fixtures):
    fx = phase7_fixtures
    db = SessionLocal()
    try:
        for c in fx["cands"]:
            att = db.query(CodingAttempt).filter(CodingAttempt.candidate_id == c.id, CodingAttempt.exam_id == fx["exam"].id).first()
            finalize_coding_attempt_results(att.id, db)
    finally:
        db.close()

    cand_headers = {"Authorization": f"Bearer {fx['toks'][1]}"}
    admin_headers = {"Authorization": f"Bearer {fx['admin_tok']}"}

    # 1. Before admin publishes results -> candidate sees resultsPublished=False
    r_unpub = client.get(f"/api/coding/results/me?examId={fx['exam'].id}", headers=cand_headers)
    assert r_unpub.status_code == 200
    assert r_unpub.json()["resultsPublished"] is False
    assert "overallPercent" not in r_unpub.json()

    # 2. Admin publishes results
    pub_res = client.post(f"/api/coding/admin/exams/{fx['exam'].id}/publish-results?published=true", headers=admin_headers)
    assert pub_res.status_code == 200 and pub_res.json()["resultsPublished"] is True

    # 3. Candidate sees result, sample details only, zero hidden test strings
    r_pub = client.get(f"/api/coding/results/me?examId={fx['exam'].id}", headers=cand_headers)
    assert r_pub.status_code == 200
    body = r_pub.json()
    assert body["resultsPublished"] is True
    assert body["overallPercent"] == 25.0
    assert body["questions"][0]["hiddenSummary"] == "0 of 1 hidden passed"
    assert "SECRET_IN_P7" not in r_pub.text
    assert "SECRET_OUT_P7" not in r_pub.text

    # 4. Admin pagination (pageSize=2 on 3 candidates -> page 1 has 2, page 2 has 1)
    p1 = client.get(f"/api/coding/admin/exams/{fx['exam'].id}/results?page=1&pageSize=2", headers=admin_headers)
    p2 = client.get(f"/api/coding/admin/exams/{fx['exam'].id}/results?page=2&pageSize=2", headers=admin_headers)
    assert p1.status_code == 200 and len(p1.json()["items"]) == 2 and p1.json()["total"] == 3
    assert p2.status_code == 200 and len(p2.json()["items"]) == 1

    # 5. Admin analytics & CSV export
    an = client.get(f"/api/coding/admin/exams/{fx['exam'].id}/analytics", headers=admin_headers)
    assert an.status_code == 200
    assert an.json()["questions"][0]["submissionsCount"] == 3

    csv_res = client.get(f"/api/coding/admin/exams/{fx['exam'].id}/results/export.csv", headers=admin_headers)
    assert csv_res.status_code == 200
    assert "OverallPercent" in csv_res.text
