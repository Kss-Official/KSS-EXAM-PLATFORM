import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core import rate_limiter
from app.core.security import create_session_token

client = TestClient(app)

@pytest.fixture(autouse=True)
def reset_rate_limits():
    rate_limiter.reset_all()
    yield
    rate_limiter.reset_all()

def test_candidate_token_cannot_access_admin_endpoints():
    """Verify that a token with role=CANDIDATE cannot access any admin route."""
    candidate_token = create_session_token({
        "candidate_id": 999,
        "email": "test.candidate@university.edu",
        "role": "CANDIDATE"
    })
    
    # 1. Test /api/auth/me
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {candidate_token}"})
    assert res.status_code == 401, f"Expected 401 Unauthorized for admin /api/auth/me, got {res.status_code}"
    
    # 2. Test /api/admin/candidates
    res = client.get("/api/admin/candidates", headers={"Authorization": f"Bearer {candidate_token}"})
    assert res.status_code == 401, f"Expected 401 Unauthorized for admin /candidates, got {res.status_code}"
    
    # 3. Test /api/admin/exams
    res = client.get("/api/admin/exams", headers={"Authorization": f"Bearer {candidate_token}"})
    assert res.status_code == 401, f"Expected 401 Unauthorized for admin /exams, got {res.status_code}"

def test_candidate_verify_issues_signed_token():
    """Verify that candidate verification returns a signed token."""
    res = client.post("/api/candidate/verify", json={
        "fullName": "Jingyasa Priyadarsini",
        "email": "jingyasa.p@campus.edu",
        "department": "Developer"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["eligible"] is True
    assert data.get("token") is not None
    assert len(data["token"]) > 20

def test_cross_candidate_token_spoofing_rejected():
    """Verify that using Candidate A's token with Candidate B's candidateId returns 403 Forbidden."""
    token_cand_a = create_session_token({
        "candidate_id": 1,
        "email": "candidate.a@test.edu",
        "role": "CANDIDATE"
    })
    
    # Attempt to start for candidate 2 using candidate 1's token
    headers = {"Authorization": f"Bearer {token_cand_a}"}
    res = client.post("/api/candidate/start", json={
        "candidateId": 2,
        "examId": 1
    }, headers=headers)
    assert res.status_code == 403, f"Expected 403 Forbidden for candidate ID mismatch, got {res.status_code}"
    data = res.json()
    msg = data.get("message") or data.get("error") or data.get("detail", "")
    assert "Access denied: Candidate ID does not match active session token." in msg
