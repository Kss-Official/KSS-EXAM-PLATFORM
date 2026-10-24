import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core import SessionLocal
from app.models import Candidate, Department

client = TestClient(app)

def test_candidate_verify_and_portal_lifecycle():
    # 1. Fetch departments
    dept_res = client.get("/api/candidate/departments")
    assert dept_res.status_code == 200
    assert isinstance(dept_res.json(), list)

    db = SessionLocal()
    try:
        dept = db.query(Department).first()
        if not dept:
            dept = Department(name="Flow Test Dept", code="FTD", active=True)
            db.add(dept)
            db.commit()
            db.refresh(dept)

        import uuid
        uid = uuid.uuid4().hex[:6].upper()
        reg_num = f"FLOW-{uid}"
        cand = Candidate(
            registration_number=reg_num,
            full_name=f"Flow Test Candidate {uid}",
            email=f"flow_{uid.lower()}@campus.edu",
            department_id=dept.id,
            status="ACTIVE"
        )
        db.add(cand)
        db.commit()
        db.refresh(cand)

        # 2. Verify candidate eligibility with 3 required fields (Full Name, Department, Email Address)
        verify_payload = {
            "fullName": cand.full_name,
            "email": cand.email,
            "department": dept.name,
            "departmentId": dept.id,
            "departmentName": dept.name
        }
        verify_res = client.post("/api/candidate/verify", json=verify_payload)
        assert verify_res.status_code == 200
        v_data = verify_res.json()
        assert v_data["eligible"] is True
        assert "message" in v_data
        assert v_data["fullName"] == cand.full_name
        assert v_data["email"] == cand.email
        assert v_data["candidateId"] == cand.id
    finally:
        db.close()
