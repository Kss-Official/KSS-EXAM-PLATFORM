import pytest
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models import Candidate, CandidateAccessCode, Department, Exam, QuestionSet
from app.schemas import CandidateVerifyRequest
from app.admin.services.candidate_service import CandidateService
from app.candidate.services.candidate_exam_service import CandidateExamService

@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

def setup_test_candidate_and_dept(db: Session, reg: str, name: str, dept_name: str, dept_code: str):
    dept = db.query(Department).filter((Department.name == dept_name) | (Department.code == dept_code)).first()
    if not dept:
        dept = Department(name=dept_name, code=dept_code, active=True)
        db.add(dept)
        db.commit()
        db.refresh(dept)

    cand = db.query(Candidate).filter(Candidate.registration_number == reg).first()
    if not cand:
        cand = Candidate(
            registration_number=reg,
            full_name=name,
            email=f"{reg.lower()}@campus.edu",
            department_id=dept.id,
            status="ACTIVE"
        )
        db.add(cand)
        db.commit()
        db.refresh(cand)
    else:
        cand.full_name = name
        cand.department_id = dept.id
        cand.status = "ACTIVE"
        db.commit()
        db.refresh(cand)

    code_dto = CandidateService.generate_access_code(db, cand.id, "TEST_ADMIN", round_name="ROUND_1")
    return cand, dept, code_dto


def test_strict_validation_valid_candidate_details(db: Session):
    """
    Scenario 1: Valid Records
    When Full Name, Department, and Unique Candidate ID match the stored database record,
    verification succeeds and returns candidate examination eligibility.
    """
    cand, dept, code_dto = setup_test_candidate_and_dept(
        db, "TEST-VALID-01", "Aarav Sharma", "Developer", "DEV"
    )

    req = CandidateVerifyRequest(
        registration_number=cand.registration_number,
        unique_id=code_dto.code,
        access_code=code_dto.code,
        full_name="Aarav Sharma",
        department_id=dept.id,
        department_name=dept.name
    )

    resp = CandidateExamService.verify_candidate(db, req)
    assert resp.eligible is True
    assert resp.candidate_id == cand.id
    assert resp.registration_number == cand.registration_number
    assert resp.full_name == "Aarav Sharma"
    assert resp.department_name == "Developer"


def test_strict_validation_mismatched_full_name(db: Session):
    """
    Scenario 2: Mismatched Full Name
    When Unique Candidate ID and Department are valid, but the entered Full Name
    does not match the stored candidate record, the submission is rejected with a clear error.
    """
    cand, dept, code_dto = setup_test_candidate_and_dept(
        db, "TEST-NAME-MISMATCH-01", "Priya Patel", "Computer Science", "CSE"
    )

    req = CandidateVerifyRequest(
        registration_number=cand.registration_number,
        unique_id=code_dto.code,
        access_code=code_dto.code,
        full_name="Priya Sharma",  # Intentional name mismatch
        department_id=dept.id,
        department_name=dept.name
    )

    resp = CandidateExamService.verify_candidate(db, req)
    assert resp.eligible is False
    assert "Full Name mismatch" in resp.message
    assert "does not match" in resp.message

    # Verify database was NOT modified
    db.refresh(cand)
    assert cand.full_name == "Priya Patel"


def test_strict_validation_mismatched_department(db: Session):
    """
    Scenario 3: Mismatched Department
    When Unique Candidate ID and Full Name match, but the candidate selects a department
    different from the one assigned in the database, the submission is rejected.
    """
    cand, dept_dev, code_dto = setup_test_candidate_and_dept(
        db, "TEST-DEPT-MISMATCH-01", "Rohan Verma", "Developer", "DEV"
    )

    # Other department
    dept_tester = db.query(Department).filter((Department.name == "Tester") | (Department.code == "QA")).first()
    if not dept_tester:
        dept_tester = Department(name="Tester", code="QA", active=True)
        db.add(dept_tester)
        db.commit()
        db.refresh(dept_tester)

    req = CandidateVerifyRequest(
        registration_number=cand.registration_number,
        unique_id=code_dto.code,
        access_code=code_dto.code,
        full_name="Rohan Verma",
        department_id=dept_tester.id,  # Mismatched department ID
        department_name="Tester"
    )

    resp = CandidateExamService.verify_candidate(db, req)
    assert resp.eligible is False
    assert "Department mismatch" in resp.message

    # Verify candidate's department was NOT mutated in the database
    db.refresh(cand)
    assert cand.department_id == dept_dev.id


def test_strict_validation_invalid_unique_id(db: Session):
    """
    Scenario 4: Invalid / Non-existent Unique ID
    When an unassigned or non-existent unique candidate ID is entered,
    submission is rejected without creating phantom records in the database.
    """
    cand_count_before = db.query(Candidate).count()

    req = CandidateVerifyRequest(
        registration_number="MCQ-NONEXISTENT-99999",
        unique_id="MCQ-NONEXISTENT-99999",
        access_code="MCQ-NONEXISTENT-99999",
        full_name="Fake Student",
        department_id=1,
        department_name="Developer"
    )

    resp = CandidateExamService.verify_candidate(db, req)
    assert resp.eligible is False
    assert "Invalid Unique Candidate ID" in resp.message

    # Verify no phantom candidate record was created
    cand_count_after = db.query(Candidate).count()
    assert cand_count_after == cand_count_before


def test_strict_validation_unauthorized_cross_candidate_tampering(db: Session):
    """
    Scenario 5: Unauthorized Cross-Candidate Tampering
    An unauthorized user attempts to enter by using Alice's Unique ID
    along with Bob's name and department. The backend must reject the attempt.
    """
    cand_alice, dept_alice, code_alice = setup_test_candidate_and_dept(
        db, "TEST-ALICE-01", "Alice Johnson", "Developer", "DEV"
    )
    cand_bob, dept_bob, code_bob = setup_test_candidate_and_dept(
        db, "TEST-BOB-01", "Bob Smith", "Tester", "QA"
    )

    # Bob tries to use Alice's Unique ID with his own name and department
    tampered_req = CandidateVerifyRequest(
        registration_number=code_alice.code,
        unique_id=code_alice.code,
        access_code=code_alice.code,
        full_name="Bob Smith",
        department_id=dept_bob.id,
        department_name=dept_bob.name
    )

    resp = CandidateExamService.verify_candidate(db, tampered_req)
    assert resp.eligible is False
    assert ("Full Name mismatch" in resp.message or "Department mismatch" in resp.message)

    # Alice's candidate record remains unchanged and secure
    db.refresh(cand_alice)
    assert cand_alice.full_name == "Alice Johnson"
    assert cand_alice.department_id == dept_alice.id


def test_strict_validation_missing_required_fields(db: Session):
    """
    Scenario 6: Missing Required Fields
    Direct API requests that omit full name, department, or unique ID
    must be immediately rejected.
    """
    # Missing full name
    req_no_name = CandidateVerifyRequest(
        unique_id="MCQ-SOME-ID",
        access_code="MCQ-SOME-ID",
        department_id=1
    )
    resp = CandidateExamService.verify_candidate(db, req_no_name)
    assert resp.eligible is False
    assert "Full Name is required" in resp.message

    # Missing department
    req_no_dept = CandidateVerifyRequest(
        unique_id="MCQ-SOME-ID",
        access_code="MCQ-SOME-ID",
        full_name="Candidate Name"
    )
    resp = CandidateExamService.verify_candidate(db, req_no_dept)
    assert resp.eligible is False
    assert "Department selection is required" in resp.message

    # Missing unique ID
    req_no_id = CandidateVerifyRequest(
        full_name="Candidate Name",
        department_id=1
    )
    resp = CandidateExamService.verify_candidate(db, req_no_id)
    assert resp.eligible is False
    assert "Unique Candidate ID is required" in resp.message
