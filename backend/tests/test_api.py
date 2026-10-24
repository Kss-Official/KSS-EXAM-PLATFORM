import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.config import settings

client = TestClient(app)

def test_health_check():
    res = client.get("/actuator/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "UP"

def test_candidate_departments():
    res = client.get("/api/candidate/departments")
    assert res.status_code == 200
    assert isinstance(res.json(), list)

def test_admin_auth_and_session_lifecycle():
    # Login with bootstrap credentials
    login_payload = {
        "email": settings.ADMIN_BOOTSTRAP_EMAIL,
        "password": settings.ADMIN_BOOTSTRAP_PASSWORD
    }
    res = client.post("/api/auth/login", json=login_payload)
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["user"]["role"] == "SUPER_ADMIN"
    assert "JSESSIONID" in res.cookies

    # Set session cookie directly on client instance
    client.cookies.set("JSESSIONID", res.cookies["JSESSIONID"])

    # Verify session via /api/auth/me
    me_res = client.get("/api/auth/me")
    assert me_res.status_code == 200
    me_data = me_res.json()
    assert me_data["email"] == settings.ADMIN_BOOTSTRAP_EMAIL

    # Verify admin dashboard access
    dash_res = client.get("/api/admin/dashboard")
    assert dash_res.status_code == 200
    dash_data = dash_res.json()
    assert dash_data["status"] == "UP"
    assert "totalExams" in dash_data

    # Verify admin exams list
    exams_res = client.get("/api/admin/exams")
    assert exams_res.status_code == 200
    assert isinstance(exams_res.json(), list)

    # Logout
    logout_res = client.post("/api/auth/logout")
    assert logout_res.status_code == 200
    assert logout_res.json()["success"] is True
    client.cookies.clear()

def test_rate_limiter_protection():
    # Invalid password attempt
    bad_payload = {
        "email": "attacker@example.com",
        "password": "WrongPassword123!"
    }
    res = client.post("/api/auth/login", json=bad_payload)
    assert res.status_code == 401
    assert "Remaining attempts" in res.json()["message"]
