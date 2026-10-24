import pytest
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models import Candidate, CandidateAccessCode
from app.admin.services.candidate_service import CandidateService
from app.core.database import SessionLocal

@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()

def test_unique_id_exact_pattern_consistency(db: Session):
    """
    Verifies that candidate Unique Access IDs strictly follow the uniform pattern:
      Round 1: MCQ-<REGISTRATION_NUMBER>
      Round 2: CODE-<REGISTRATION_NUMBER>
    And that re-generating or resetting codes NEVER appends random salts or changes the pattern.
    """
    test_reg = "TEST-PATTERN-REG-99"
    existing = db.query(Candidate).filter(Candidate.registration_number == test_reg).first()
    if existing:
        db.delete(existing)
        db.commit()

    cand = Candidate(
        registration_number=test_reg,
        full_name="Pattern Test Candidate",
        email="pattern_test@campus.edu",
        status="ACTIVE"
    )
    db.add(cand)
    db.commit()
    db.refresh(cand)

    # 1. Generate Round 1 Unique ID
    r1_dto = CandidateService.generate_access_code(db, cand.id, "TEST_ADMIN", round_name="ROUND_1")
    assert r1_dto.code == f"MCQ-{test_reg}"
    assert r1_dto.usage_count == 0
    assert r1_dto.max_uses == 3
    assert r1_dto.is_active is True

    # 2. Re-generate Round 1 Unique ID (e.g. admin resets or re-issues code)
    # MUST MAINTAIN THE EXACT SAME PATTERN, NO RANDOM SALT HEX
    r1_regen = CandidateService.generate_access_code(db, cand.id, "TEST_ADMIN", round_name="ROUND_1")
    assert r1_regen.code == f"MCQ-{test_reg}"
    assert r1_regen.usage_count == 0
    assert r1_regen.max_uses == 3
    assert r1_regen.is_active is True
    assert "-" not in r1_regen.code.replace(f"MCQ-{test_reg}", "")  # No extra suffixes

    # 3. Generate Round 2 Unique ID
    r2_dto = CandidateService.generate_access_code(db, cand.id, "TEST_ADMIN", round_name="ROUND_2")
    assert r2_dto.code == f"CODE-{test_reg}"
    assert r2_dto.usage_count == 0
    assert r2_dto.max_uses == 3
    assert r2_dto.is_active is True

    # 4. Re-generate Round 2 Unique ID
    r2_regen = CandidateService.generate_access_code(db, cand.id, "TEST_ADMIN", round_name="ROUND_2")
    assert r2_regen.code == f"CODE-{test_reg}"
    assert r2_regen.usage_count == 0
    assert r2_regen.max_uses == 3
    assert r2_regen.is_active is True

    # 5. Clean up candidate with prefixed reg to verify no duplicate prefixing
    prefixed_reg = "CODE-ALGO-STUDENT-01"
    existing_prefixed = db.query(Candidate).filter(Candidate.registration_number == prefixed_reg).first()
    if existing_prefixed:
        db.delete(existing_prefixed)
        db.commit()

    cand_pref = Candidate(
        registration_number=prefixed_reg,
        full_name="Prefixed Student",
        email="prefixed_student@campus.edu",
        status="ACTIVE"
    )
    db.add(cand_pref)
    db.commit()
    db.refresh(cand_pref)

    r1_pref = CandidateService.generate_access_code(db, cand_pref.id, "TEST_ADMIN", round_name="ROUND_1")
    r2_pref = CandidateService.generate_access_code(db, cand_pref.id, "TEST_ADMIN", round_name="ROUND_2")

    assert r1_pref.code == "MCQ-ALGO-STUDENT-01"
    assert r2_pref.code == "CODE-ALGO-STUDENT-01"
    assert "CODE-CODE" not in r2_pref.code
    assert "MCQ-CODE" not in r1_pref.code


def test_create_new_ids_for_all_and_selected(db: Session):
    """
    Tests both options of the 'Create New ID' feature:
      Option 1: Create New IDs for All Candidates in current round
      Option 2: Create New IDs for Selected Candidates
    Verifies that IDs are generated in the uniform pattern, saved to DB, and have 3-use limits.
    """
    # Create 3 test candidates
    cands = []
    for i in range(1, 4):
        reg = f"TEST-SEL-REG-{i:02d}"
        cand = db.query(Candidate).filter(Candidate.registration_number == reg).first()
        if not cand:
            cand = Candidate(
                registration_number=reg,
                full_name=f"Selected Candidate {i}",
                email=f"candidate_{i}@campus.edu",
                status="ACTIVE"
            )
            db.add(cand)
            db.commit()
            db.refresh(cand)
        cands.append(cand)

    c1, c2, c3 = cands

    # Ensure clean slate for test candidates' access codes
    db.query(CandidateAccessCode).filter(
        CandidateAccessCode.candidate_id.in_([c1.id, c2.id, c3.id])
    ).delete(synchronize_session=False)
    db.commit()

    # --- Test Option 2: Generate New IDs for Selected Candidates (c1 and c2 only) ---
    res_selected = CandidateService.generate_selected_round_ids(
        db, [c1.id, c2.id], round_name="ROUND_1", performed_by="TEST_ADMIN"
    )
    assert res_selected["generatedCount"] == 2
    assert c1.registration_number.upper() in res_selected["roundIds"]
    assert c2.registration_number.upper() in res_selected["roundIds"]
    assert res_selected["roundIds"][c1.registration_number.upper()] == f"MCQ-{c1.registration_number.upper()}"
    assert res_selected["roundIds"][c2.registration_number.upper()] == f"MCQ-{c2.registration_number.upper()}"

    # Verify code in DB
    code1 = db.query(CandidateAccessCode).filter(
        CandidateAccessCode.candidate_id == c1.id,
        CandidateAccessCode.round == "ROUND_1"
    ).first()
    assert code1 is not None
    assert code1.code == f"MCQ-{c1.registration_number.upper()}"
    assert code1.max_uses == 3

    # Verify c3 was not generated yet in this step
    code3 = db.query(CandidateAccessCode).filter(
        CandidateAccessCode.candidate_id == c3.id,
        CandidateAccessCode.round == "ROUND_1"
    ).first()
    assert code3 is None

    # --- Test Option 1: Generate New IDs for All Candidates in Round ---
    res_all = CandidateService.batch_generate_round_ids(db, "ROUND_1", "TEST_ADMIN")
    assert res_all["round"] == "ROUND_1"
    assert c3.registration_number.upper() in res_all["roundIds"]
    assert res_all["roundIds"][c3.registration_number.upper()] == f"MCQ-{c3.registration_number.upper()}"

    code3_now = db.query(CandidateAccessCode).filter(
        CandidateAccessCode.candidate_id == c3.id,
        CandidateAccessCode.round == "ROUND_1"
    ).first()
    assert code3_now is not None
    assert code3_now.code == f"MCQ-{c3.registration_number.upper()}"
    assert code3_now.max_uses == 3


def test_question_paper_set_assignment_and_workflow(db: Session):
    """
    Tests Question Paper Set Assignment:
      1. Assign single candidate to Set A, Set B, Set C, Set D, or None.
      2. Batch assign candidates to Set B.
      3. Verify database persistence and CandidateDto mapping.
      4. Verify that verification delivers the assigned set.
    """
    reg = "TEST-SET-CAND-01"
    cand = db.query(Candidate).filter(Candidate.registration_number == reg).first()
    if not cand:
        cand = Candidate(
            registration_number=reg,
            full_name="Set Test Candidate",
            email="set_candidate@campus.edu",
            status="ACTIVE"
        )
        db.add(cand)
        db.commit()
        db.refresh(cand)

    # 1. Assign Set A
    dto_a = CandidateService.assign_candidate_set(db, cand.id, "Set A")
    assert dto_a.assigned_set == "Set A"

    # Refresh DB and verify column persistence
    db.refresh(cand)
    assert cand.assigned_set == "Set A"

    # 2. Assign Set C with raw lowercase "c"
    dto_c = CandidateService.assign_candidate_set(db, cand.id, "c")
    assert dto_c.assigned_set == "Set C"

    # 3. Clear assignment
    dto_clear = CandidateService.assign_candidate_set(db, cand.id, None)
    assert dto_clear.assigned_set is None

    # 4. Batch assign Set D to multiple candidates
    reg2 = "TEST-SET-CAND-02"
    cand2 = db.query(Candidate).filter(Candidate.registration_number == reg2).first()
    if not cand2:
        cand2 = Candidate(
            registration_number=reg2,
            full_name="Set Test Candidate 2",
            email="set_candidate2@campus.edu",
            status="ACTIVE"
        )
        db.add(cand2)
        db.commit()
        db.refresh(cand2)

    batch_res = CandidateService.batch_assign_candidate_set(db, [cand.id, cand2.id], "Set D")
    assert batch_res["updatedCount"] == 2
    assert batch_res["assignedSet"] == "Set D"

    db.refresh(cand)
    db.refresh(cand2)
    assert cand.assigned_set == "Set D"
    assert cand2.assigned_set == "Set D"


def test_candidate_verification_delivers_assigned_set(db: Session):
    """
    Verifies that during examination verification, a candidate with an assigned set
    (e.g. Set B) is allocated the exact matching QuestionSet ('B').
    """
    from app.models.exam import Exam
    from app.models.question import QuestionSet
    from app.schemas import CandidateVerifyRequest
    from app.candidate.services.candidate_exam_service import CandidateExamService

    # 1. Ensure a published exam exists with QuestionSets A and B
    exam = db.query(Exam).filter(Exam.status == "PUBLISHED").first()
    if not exam:
        exam = Exam(
            title="Assigned Set Verification Exam",
            description="Testing Set assignment",
            status="PUBLISHED",
            duration_minutes=60,
            total_questions=10
        )
        db.add(exam)
        db.commit()
        db.refresh(exam)

    # Ensure QuestionSet A and QuestionSet B exist for this exam
    qs_a = db.query(QuestionSet).filter(QuestionSet.exam_id == exam.id, QuestionSet.set_code == "A").first()
    if not qs_a:
        qs_a = QuestionSet(exam_id=exam.id, set_code="A", name="Set A")
        db.add(qs_a)

    qs_b = db.query(QuestionSet).filter(QuestionSet.exam_id == exam.id, QuestionSet.set_code == "B").first()
    if not qs_b:
        qs_b = QuestionSet(exam_id=exam.id, set_code="B", name="Set B")
        db.add(qs_b)

    db.commit()
    db.refresh(qs_a)
    db.refresh(qs_b)

    from app.models.department import Department
    dept = db.query(Department).filter(Department.name == "Developer").first()
    if not dept:
        dept = Department(name="Developer", code="DEV", active=True)
        db.add(dept)
        db.commit()
        db.refresh(dept)

    # 2. Candidate with assigned_set = "Set B" and department
    reg = "TEST-VERIFY-SET-B"
    cand = db.query(Candidate).filter(Candidate.registration_number == reg).first()
    if not cand:
        cand = Candidate(
            registration_number=reg,
            full_name="Set B Verification Student",
            email="set_b_student@campus.edu",
            status="ACTIVE",
            department_id=dept.id,
            assigned_set="Set B"
        )
        db.add(cand)
        db.commit()
        db.refresh(cand)
    else:
        cand.assigned_set = "Set B"
        cand.department_id = dept.id
        cand.full_name = "Set B Verification Student"
        db.commit()
        db.refresh(cand)

    # Generate Round 1 code for cand
    code_dto = CandidateService.generate_access_code(db, cand.id, "TEST_ADMIN", round_name="ROUND_1")

    # 3. Call candidate verification with valid, matching details
    req = CandidateVerifyRequest(
        registration_number=cand.registration_number,
        access_code=code_dto.code,
        full_name=cand.full_name,
        department_id=dept.id,
        department_name=dept.name
    )
    resp = CandidateExamService.verify_candidate(db, req)

    assert resp.eligible is True
    assert resp.set_code == "B"


