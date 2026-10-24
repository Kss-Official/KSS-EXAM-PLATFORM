import pytest
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models import Candidate, Department, Exam, QuestionSet, Question, QuestionOption, ExamAttempt, AttemptAnswer
from app.schemas import CandidateVerifyRequest
from app.candidate.services.candidate_exam_service import CandidateExamService

@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

def setup_test_candidate(db: Session, reg: str, name: str, email: str, dept_name: str, dept_code: str):
    dept = db.query(Department).filter((Department.name == dept_name) | (Department.code == dept_code)).first()
    if not dept:
        dept = Department(name=dept_name, code=dept_code, active=True)
        db.add(dept)
        db.commit()
        db.refresh(dept)

    cand = db.query(Candidate).filter((Candidate.registration_number == reg) | (Candidate.email == email)).first()
    if not cand:
        cand = Candidate(
            registration_number=reg,
            full_name=name,
            email=email,
            department_id=dept.id,
            status="ACTIVE"
        )
        db.add(cand)
        db.commit()
        db.refresh(cand)
    else:
        cand.registration_number = reg
        cand.full_name = name
        cand.email = email
        cand.department_id = dept.id
        cand.status = "ACTIVE"
        db.commit()
        db.refresh(cand)

    return cand, dept


def test_strict_validation_valid_candidate_details(db: Session):
    """
    Scenario 1: Valid Login Details
    When Full Name, Department, and Email Address match the stored database record,
    verification succeeds and returns candidate examination eligibility.
    """
    cand, dept = setup_test_candidate(
        db, "TEST-VAL-01", "Aarav Sharma", "aarav.sharma@testcampus.edu", "Developer", "DEV"
    )

    req = CandidateVerifyRequest(
        full_name="Aarav Sharma",
        email="aarav.sharma@testcampus.edu",
        department="Developer",
        department_name="Developer",
        department_id=dept.id
    )

    resp = CandidateExamService.verify_candidate(db, req)
    assert resp.eligible is True
    assert resp.candidate_id == cand.id
    assert resp.candidate_name == "Aarav Sharma"
    assert resp.email == "aarav.sharma@testcampus.edu"


def test_strict_validation_case_and_whitespace_insensitivity(db: Session):
    """
    Scenario 2: Case & Whitespace Insensitivity
    Email with uppercase or spaces, name with whitespace is handled cleanly.
    """
    cand, dept = setup_test_candidate(
        db, "TEST-VAL-02", "Priya Patel", "priya.patel@testcampus.edu", "Computer Science and Engineering", "CSE"
    )

    req = CandidateVerifyRequest(
        full_name="  Priya Patel  ",
        email="  Priya.Patel@TestCampus.EDU  ",
        department="Computer Science & Engineering"
    )

    resp = CandidateExamService.verify_candidate(db, req)
    assert resp.eligible is True
    assert resp.candidate_id == cand.id


def test_strict_validation_mismatched_full_name(db: Session):
    """
    Scenario 3: Full Name Mismatch
    When the email exists, but the entered Full Name does not match the candidate's record.
    Access must be denied with a clear mismatch error.
    """
    cand, dept = setup_test_candidate(
        db, "TEST-VAL-03", "Aarav Sharma", "aarav.mismatch@testcampus.edu", "Developer", "DEV"
    )

    req = CandidateVerifyRequest(
        full_name="John Doe",
        email="aarav.mismatch@testcampus.edu",
        department="Developer"
    )

    resp = CandidateExamService.verify_candidate(db, req)
    assert resp.eligible is False
    assert "Full Name mismatch" in resp.message


def test_strict_validation_mismatched_department(db: Session):
    """
    Scenario 4: Department Mismatch
    When the candidate is registered in 'Developer', but chooses 'Civil Engineering'.
    Access must be denied with a clear department mismatch error.
    """
    cand, dept = setup_test_candidate(
        db, "TEST-VAL-04", "Aarav Sharma", "aarav.dept@testcampus.edu", "Developer", "DEV"
    )

    req = CandidateVerifyRequest(
        full_name="Aarav Sharma",
        email="aarav.dept@testcampus.edu",
        department="Civil Engineering"
    )

    resp = CandidateExamService.verify_candidate(db, req)
    assert resp.eligible is False
    assert "Department mismatch" in resp.message


def test_strict_validation_unknown_email(db: Session):
    """
    Scenario 5: Unknown / Non-existent Email
    When a candidate enters an email that does not exist in database records.
    Access must be denied with an appropriate error message.
    """
    req = CandidateVerifyRequest(
        full_name="Non Existent Candidate",
        email="does.not.exist@nowhere.com",
        department="Developer"
    )

    resp = CandidateExamService.verify_candidate(db, req)
    assert resp.eligible is False
    assert "No candidate record found" in resp.message


def test_strict_validation_missing_required_fields(db: Session):
    """
    Scenario 6: Missing Required Fields
    Verify that omitting any of Full Name, Email Address, or Department denies access.
    """
    # Missing Full Name
    resp1 = CandidateExamService.verify_candidate(db, CandidateVerifyRequest(
        email="test@campus.edu",
        department="Developer"
    ))
    assert resp1.eligible is False
    assert "Full Name is required" in resp1.message

    # Missing Email
    resp2 = CandidateExamService.verify_candidate(db, CandidateVerifyRequest(
        full_name="Test Name",
        department="Developer"
    ))
    assert resp2.eligible is False
    assert "Email Address is required" in resp2.message

    # Missing Department
    resp3 = CandidateExamService.verify_candidate(db, CandidateVerifyRequest(
        full_name="Test Name",
        email="test@campus.edu"
    ))
    assert resp3.eligible is False
    assert "Department" in resp3.message


def test_strict_validation_cross_candidate_tampering(db: Session):
    """
    Scenario 7: Unauthorized Cross-Candidate Tampering
    Candidate A cannot use their own name with Candidate B's email.
    """
    cand_a, _ = setup_test_candidate(db, "CAND-A-01", "Candidate Alice", "alice@testcampus.edu", "Developer", "DEV")
    cand_b, _ = setup_test_candidate(db, "CAND-B-01", "Candidate Bob", "bob@testcampus.edu", "Developer", "DEV")

    # Alice tries to log in using Bob's email address
    tampering_req = CandidateVerifyRequest(
        full_name="Candidate Alice",
        email="bob@testcampus.edu",
        department="Developer"
    )

    resp = CandidateExamService.verify_candidate(db, tampering_req)
    assert resp.eligible is False
    assert "Full Name mismatch" in resp.message


def test_single_round_examination_workflow(db: Session):
    """
    Scenario 8: Complete Single-Round Examination Lifecycle
    Login verification -> Start Attempt -> Save Answer -> Submit Attempt -> Persistent Scoring.
    """
    cand, dept = setup_test_candidate(
        db, "TEST-E2E-01", "E2E Candidate", "e2e.candidate@testcampus.edu", "Developer", "DEV"
    )

    # Clean up any existing attempts for this test candidate so it can run repeatedly
    db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id.in_(
        db.query(ExamAttempt.id).filter(ExamAttempt.candidate_id == cand.id)
    )).delete(synchronize_session=False)
    db.query(ExamAttempt).filter(ExamAttempt.candidate_id == cand.id).delete(synchronize_session=False)
    db.commit()

    # 1. Login verification
    verify_req = CandidateVerifyRequest(
        full_name="E2E Candidate",
        email="e2e.candidate@testcampus.edu",
        department="Developer"
    )
    v_resp = CandidateExamService.verify_candidate(db, verify_req)
    assert v_resp.eligible is True
    assert v_resp.candidate_id == cand.id
    exam_id = v_resp.assigned_exam_id or v_resp.exam_id
    assert exam_id is not None

    # 2. Start attempt
    start_resp = CandidateExamService.start_or_resume_attempt(db, cand.id, exam_id)
    assert start_resp.attempt_id is not None
    assert len(start_resp.questions) > 0

    first_q = start_resp.questions[0]
    q_id = first_q.question_id
    opt_id = first_q.options[0].option_id if first_q.options else None

    # 3. Save an answer
    if opt_id:
        ans_res = CandidateExamService.save_answer(db, start_resp.attempt_id, q_id, opt_id)
        assert ans_res["success"] is True

    # 4. Final submission
    sub_res = CandidateExamService.submit_attempt(db, start_resp.attempt_id)
    assert sub_res.receipt_id is not None
    assert sub_res.success is True

    # Check attempt in DB is submitted
    attempt = db.query(ExamAttempt).filter(ExamAttempt.id == start_resp.attempt_id).first()
    assert attempt.status == "SUBMITTED"
    assert attempt.candidate_id == cand.id
    assert attempt.submitted_at is not None


def test_candidate_primary_department_technical_matching(db: Session):
    """
    Candidate registered in a Technical sub-department (e.g. Developer, QA, UI/UX, Civil Engineering)
    can select 'Technical Department' and verification succeeds.
    """
    dev_cand, _ = setup_test_candidate(db, "TEST-TECH-01", "Tech Dev Cand", "tech.dev@testcampus.edu", "Developer", "DEV")
    qa_cand, _ = setup_test_candidate(db, "TEST-TECH-02", "Tech QA Cand", "tech.qa@testcampus.edu", "Software Tester", "QA")
    civ_cand, _ = setup_test_candidate(db, "TEST-TECH-03", "Tech Civil Cand", "tech.civ@testcampus.edu", "Civil Engineering", "CIVIL")

    # Developer selects Technical Department
    req1 = CandidateVerifyRequest(
        fullName=dev_cand.full_name,
        email=dev_cand.email,
        department="Technical Department"
    )
    r1 = CandidateExamService.verify_candidate(db, req1)
    assert r1.candidate_id == dev_cand.id
    assert r1.department_name == "Developer"

    # QA / Tester selects Technical Department
    req2 = CandidateVerifyRequest(
        fullName=qa_cand.full_name,
        email=qa_cand.email,
        department="Technical Department"
    )
    r2 = CandidateExamService.verify_candidate(db, req2)
    assert r2.candidate_id == qa_cand.id
    assert r2.department_name in ("Software Tester", "Quality Assurance & Testing")

    # Civil Engineering selects Technical Department
    req3 = CandidateVerifyRequest(
        fullName=civ_cand.full_name,
        email=civ_cand.email,
        department="Technical Department"
    )
    r3 = CandidateExamService.verify_candidate(db, req3)
    assert r3.candidate_id == civ_cand.id
    assert r3.department_name == "Civil Engineering"


def test_candidate_primary_department_non_technical_matching(db: Session):
    """
    Candidate registered in a Non-Technical sub-department (e.g. HR, Sales & Marketing)
    can select 'Non-Technical Department' and verification succeeds.
    """
    hr_cand, _ = setup_test_candidate(db, "TEST-NONTECH-01", "HR Cand", "hr.cand@testcampus.edu", "Human Resources", "HR")
    mkt_cand, _ = setup_test_candidate(db, "TEST-NONTECH-02", "Mkt Cand", "mkt.cand@testcampus.edu", "Sales & Marketing", "SALES_MKT")

    # HR selects Non-Technical Department
    req1 = CandidateVerifyRequest(
        fullName=hr_cand.full_name,
        email=hr_cand.email,
        department="Non-Technical Department"
    )
    r1 = CandidateExamService.verify_candidate(db, req1)
    assert r1.candidate_id == hr_cand.id
    assert r1.department_name == "Human Resources"

    # Sales & Marketing selects Non-Technical Department
    req2 = CandidateVerifyRequest(
        fullName=mkt_cand.full_name,
        email=mkt_cand.email,
        department="Non-Technical Department"
    )
    r2 = CandidateExamService.verify_candidate(db, req2)
    assert r2.candidate_id == mkt_cand.id
    assert r2.department_name == "Sales & Marketing"


def test_candidate_primary_department_mismatch_rejection(db: Session):
    """
    Candidate selecting the wrong primary department category is rejected with a clear Department mismatch error.
    """
    dev_cand, _ = setup_test_candidate(db, "TEST-MISMATCH-01", "Dev Cand", "dev.cand@testcampus.edu", "Developer", "DEV")
    hr_cand, _ = setup_test_candidate(db, "TEST-MISMATCH-02", "HR Cand", "hr.mismatch@testcampus.edu", "Human Resources", "HR")

    # Developer mistakenly selects Non-Technical Department
    bad_req1 = CandidateVerifyRequest(
        fullName=dev_cand.full_name,
        email=dev_cand.email,
        department="Non-Technical Department"
    )
    res1 = CandidateExamService.verify_candidate(db, bad_req1)
    assert res1.eligible is False
    assert "Department mismatch" in res1.message

    # HR mistakenly selects Technical Department
    bad_req2 = CandidateVerifyRequest(
        fullName=hr_cand.full_name,
        email=hr_cand.email,
        department="Technical Department"
    )
    res2 = CandidateExamService.verify_candidate(db, bad_req2)
    assert res2.eligible is False
    assert "Department mismatch" in res2.message

