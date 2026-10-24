import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core import SessionLocal
from app.models import Candidate, Department
from app.admin.services.candidate_service import CandidateService

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

        code_dto = CandidateService.generate_access_code(db, cand.id, "TEST_ADMIN")

        # 2. Verify candidate eligibility with registered credentials
        verify_payload = {
            "registrationNumber": cand.registration_number,
            "uniqueId": code_dto.code,
            "fullName": cand.full_name,
            "departmentId": dept.id,
            "departmentName": dept.name
        }
        verify_res = client.post("/api/candidate/verify", json=verify_payload)
        assert verify_res.status_code == 200
        v_data = verify_res.json()
        assert "eligible" in v_data
        assert "message" in v_data
        assert v_data["registrationNumber"] == reg_num
        assert v_data["fullName"] == f"Flow Test Candidate {uid}"
    finally:
        db.close()

