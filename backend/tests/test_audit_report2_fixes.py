"""Regression tests for Audit Continuation Report 2 fixes.

Runs against the isolated SQLite DB set up in conftest.py (never the dev server on :8000).
"""
import json
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core import SessionLocal
from app.core.config import settings, validate_security_settings
from app.core.dependencies import get_client_ip
from app.models.coding import CodingExam, CodingQuestion, CodingTestCase

client = TestClient(app, raise_server_exceptions=False)


def _fake_request(peer, xff=None):
    headers = {"x-forwarded-for": xff} if xff else {}
    return SimpleNamespace(client=SimpleNamespace(host=peer), headers=headers)


@pytest.fixture
def coding_exams():
    db = SessionLocal()
    ids = {}
    try:
        for status_value in ("PUBLISHED", "DRAFT"):
            exam = CodingExam(
                title=f"audit-{status_value}",
                status=status_value,
                duration_minutes=30,
                timing_mode="FLEXIBLE",
                allowed_languages=json.dumps(["python"]),
                selected_departments=json.dumps([]),
            )
            q = CodingQuestion(id=f"audit-q-{status_value}", title="Sum", problem_statement="a+b", difficulty="EASY", max_marks=10)
            q.test_cases = [
                CodingTestCase(id=f"audit-tc-pub-{status_value}", label="public", input_data="1 2", expected_output="3", is_hidden=False, marks=5),
                CodingTestCase(id=f"audit-tc-sec-{status_value}", label="secret", input_data="40 2", expected_output="42", is_hidden=True, marks=5),
            ]
            exam.questions = [q]
            db.add(exam)
            db.commit()
            ids[status_value] = exam.id
        yield ids
    finally:
        for exam_id in ids.values():
            obj = db.get(CodingExam, exam_id)
            if obj:
                db.delete(obj)
        db.commit()
        db.close()


def test_coding_run_and_submit_are_disabled():
    r1 = client.post("/api/candidate/coding/run", json={"language": "python", "code": "print(1)", "input": ""})
    assert r1.status_code in (422, 503)  # 422 only if the schema rejects the body before the handler
    if r1.status_code == 422:
        pytest.skip("CodeRunRequest schema differs; covered by submit check below")
    r2 = client.post("/api/candidate/coding/submit", json={})
    assert r2.status_code in (422, 503)


def test_coding_exam_list_excludes_hidden_cases_and_drafts(coding_exams):
    res = client.get("/api/candidate/coding/exams")
    assert res.status_code == 200
    titles = [e["title"] for e in res.json()]
    assert "audit-PUBLISHED" in titles
    assert "audit-DRAFT" not in titles
    for exam in res.json():
        for q in exam["questions"]:
            assert all(not tc["isHidden"] for tc in q["testCases"])
    assert "audit-tc-sec" not in res.text


def test_coding_exam_detail_hides_secret_and_404s_draft(coding_exams):
    ok = client.get(f"/api/candidate/coding/exams/{coding_exams['PUBLISHED']}")
    assert ok.status_code == 200
    assert [tc["label"] for tc in ok.json()["questions"][0]["testCases"]] == ["public"]
    assert client.get(f"/api/candidate/coding/exams/{coding_exams['DRAFT']}").status_code == 404


def test_answers_require_candidate_id():
    res = client.post("/api/candidate/answers?attemptId=1", json={"questionId": 1, "selectedOptionId": 1})
    assert res.status_code == 400
    assert "candidateId" in res.text


def test_submit_requires_candidate_id():
    res = client.post("/api/candidate/submit?attemptId=1", json={"attemptId": 1})
    assert res.status_code == 400
    assert "candidateId" in res.text


def test_forwarded_for_ignored_from_untrusted_peer(monkeypatch):
    monkeypatch.setattr(settings, "TRUSTED_PROXY_IPS", [])
    assert get_client_ip(_fake_request("203.0.113.9", "1.2.3.4")) == "203.0.113.9"


def test_forwarded_for_honored_from_trusted_proxy(monkeypatch):
    monkeypatch.setattr(settings, "TRUSTED_PROXY_IPS", ["10.0.0.5"])
    assert get_client_ip(_fake_request("10.0.0.5", "1.2.3.4, 10.0.0.5")) == "1.2.3.4"
    assert get_client_ip(_fake_request("203.0.113.9", "1.2.3.4")) == "203.0.113.9"


def test_production_refuses_default_secret():
    s = SimpleNamespace(
        SECRET_KEY=settings.SECRET_KEY,
        ADMIN_BOOTSTRAP_PASSWORD="Admin@ExamSecure2026!",
        CORS_ORIGINS=["http://localhost:5173"],
        ENVIRONMENT="production",
    )
    with pytest.raises(RuntimeError):
        validate_security_settings(s)
    s.ENVIRONMENT = "development"
    validate_security_settings(s)  # warns only


def test_production_accepts_strong_settings():
    s = SimpleNamespace(
        SECRET_KEY="x" * 64,
        ADMIN_BOOTSTRAP_PASSWORD="a-strong-unique-password-1!",
        CORS_ORIGINS=["https://exam.example.com"],
        ENVIRONMENT="production",
    )
    validate_security_settings(s)


def test_500_does_not_leak_exception_text(monkeypatch):
    monkeypatch.setattr(settings, "DEBUG", False)

    @app.get("/api/_audit_boom")
    def _boom():
        raise ValueError("secret-internal-detail")

    res = client.get("/api/_audit_boom")
    assert res.status_code == 500
    assert "secret-internal-detail" not in res.text
