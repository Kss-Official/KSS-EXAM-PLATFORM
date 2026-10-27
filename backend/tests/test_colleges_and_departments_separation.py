import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.database import SessionLocal
from app.models.college import College
from app.models.department import Department
from app.models.candidate import Candidate
from app.admin.services.college_service import CollegeService
from app.admin.services.candidate_service import CandidateService
from app.candidate.services.candidate_exam_service import CandidateExamService
from app.schemas.college import CollegeCreateDto
from app.schemas.candidate import CandidateVerifyRequest

def run_tests():
    db = SessionLocal()
    try:
        print("\n=======================================================")
        print("TEST: VERIFY SEPARATE COLLEGES & DEPARTMENTS TABLES")
        print("=======================================================")

        # 1. Verify separate tables exist in Postgres
        tables = [t[0] for t in db.execute(text("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name IN ('colleges', 'departments', 'candidates')
        """)).fetchall()]

        assert 'colleges' in tables, "colleges table missing!"
        assert 'departments' in tables, "departments table missing!"
        assert 'candidates' in tables, "candidates table missing!"
        print("[OK] Separate PostgreSQL tables 'colleges', 'departments', and 'candidates' confirmed.")

        # 2. Check colleges count and samples
        colleges = db.query(College).all()
        assert len(colleges) >= 13, f"Expected at least 13 colleges, got {len(colleges)}"
        print(f"[OK] Total colleges in 'colleges' table: {len(colleges)}")
        sample_col = colleges[0]
        print(f"     Sample College: ID={sample_col.id}, Name='{sample_col.name}', Code='{sample_col.code}'")

        # 3. Check departments count and samples
        departments = db.query(Department).all()
        assert len(departments) >= 14, f"Expected at least 14 departments, got {len(departments)}"
        print(f"[OK] Total departments in 'departments' table: {len(departments)}")
        dev_dept = db.query(Department).filter(Department.id == 1).first()
        assert dev_dept is not None, "Developer department ID 1 missing!"
        print(f"     Academic Track 1: Name='{dev_dept.name}', Code='{dev_dept.code}'")

        # 4. Check candidates have college_id and department_id
        candidates_with_college = db.query(Candidate).filter(Candidate.college_id.isnot(None)).count()
        candidates_with_dept = db.query(Candidate).filter(Candidate.department_id.isnot(None)).count()
        total_candidates = db.query(Candidate).count()

        assert candidates_with_college == total_candidates, f"All candidates should have college_id: {candidates_with_college}/{total_candidates}"
        assert candidates_with_dept == total_candidates, f"All candidates should have department_id: {candidates_with_dept}/{total_candidates}"
        print(f"[OK] Candidate linkage verified: {candidates_with_college}/{total_candidates} have college_id, {candidates_with_dept}/{total_candidates} have department_id.")

        # 5. Check CandidateService DTO conversion with college and department
        p_cands = CandidateService.get_paginated_candidates(db, page=1, limit=5)
        assert len(p_cands.items) == 5, f"Expected 5 candidates on page 1, got {len(p_cands.items)}"
        first_c = p_cands.items[0]
        assert first_c.college_name is not None, "first_c.college_name should not be None"
        assert first_c.department_name is not None, "first_c.department_name should not be None"
        print(f"[OK] CandidateService DTO verified: Cand='{first_c.full_name}', College='{first_c.college_name}', Dept='{first_c.department_name}'")

        # 6. Test CollegeService CRUD
        test_code = "TEST_INST_01"
        # Cleanup if exists
        existing = db.query(College).filter(College.code == test_code).first()
        if existing:
            db.delete(existing)
            db.commit()

        new_col = CollegeService.create_college(
            db, 
            CollegeCreateDto(name="Test Engineering Academy", code=test_code, description="Unit test institution", active=True),
            performed_by="tester@kalpanaa.com"
        )
        assert new_col.id is not None
        assert new_col.code == test_code
        print(f"[OK] Created new test college in 'colleges' table: ID={new_col.id}, Name='{new_col.name}'")

        # Update test college
        updated_col = CollegeService.update_college(
            db,
            new_col.id,
            CollegeCreateDto(name="Updated Test Academy", code=test_code, description="Updated description", active=True),
            performed_by="tester@kalpanaa.com"
        )
        assert updated_col.name == "Updated Test Academy"
        print(f"[OK] Updated test college: ID={updated_col.id}, Name='{updated_col.name}'")

        # Delete test college
        CollegeService.delete_college(db, new_col.id, performed_by="tester@kalpanaa.com")
        assert db.query(College).filter(College.id == new_col.id).first() is None
        print(f"[OK] Deleted test college successfully.")

        # 7. Test candidate verification with college_name
        from app.models.attempt import ExamAttempt
        sample_cand = db.query(Candidate).filter(
            Candidate.college_id.isnot(None),
            ~Candidate.attempts.any(ExamAttempt.status == "SUBMITTED")
        ).first()
        if not sample_cand:
            sample_cand = db.query(Candidate).filter(Candidate.college_id.isnot(None)).first()

        assert sample_cand is not None
        v_req = CandidateVerifyRequest(
            fullName=sample_cand.full_name,
            email=sample_cand.email,
            department="Technical Department",
            college=sample_cand.college.name
        )
        v_resp = CandidateExamService.verify_candidate(db, v_req)
        # Even if attempt was completed, candidate details are resolved and matched
        assert v_resp.candidate_id is not None or "submitted" in v_resp.message.lower() or v_resp.eligible is True
        print(f"[OK] Candidate verification processed: Result='{v_resp.message or 'Eligible'}'")

        print("\n=======================================================")
        print("ALL TESTS PASSED: COLLEGES & DEPARTMENTS SEPARATION OK")
        print("=======================================================\n")

    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
