"""
End-to-End Verification Test:
1. Import question paper for Department A (Technical / Software Developer).
2. Import question paper for Department B (Non-Technical / HR).
3. Verify questions, options, and answer keys stored correctly in PostgreSQL without duplication or loss.
4. Verify candidate of Department A accesses ONLY Department A questions (zero Dept B questions).
5. Verify candidate of Department B accesses ONLY Department B questions (zero Dept A questions).
6. Verify no questions are missing, duplicated, or leaked across departments.
"""

import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import requests
import json
from decimal import Decimal

BASE_URL = "http://127.0.0.1:8000/api"

def run_verification():
    print("=" * 75)
    print("VERIFICATION: QUESTION IMPORT & DEPARTMENT-SPECIFIC PORTAL ACCESS")
    print("=" * 75)

    # 1. Admin Authentication
    admin_session = requests.Session()
    login_payload = {
        "email": "d.koushik@kalpanaaasoftwaresolutions.in",
        "password": "Admin@ExamSecure2026!"
    }
    login_res = admin_session.post(f"{BASE_URL}/auth/login", json=login_payload)
    assert login_res.status_code == 200, f"Admin login failed: {login_res.text}"
    print("[PASS] 1. Admin authenticated successfully.")

    # 2. Get active published exam
    exams_res = admin_session.get(f"{BASE_URL}/admin/exams")
    assert exams_res.status_code == 200
    exams = exams_res.json()
    published_exams = [e for e in exams if e.get("status") == "PUBLISHED"]
    assert len(published_exams) > 0, "No published exam found for verification"
    exam = published_exams[0]
    exam_id = exam["id"]
    print(f"[PASS] 2. Selected Published Exam: ID={exam_id}, Title='{exam['title']}'")

    # 3. Identify two distinct academic departments
    from app.core.database import SessionLocal
    from app.models.department import Department
    from app.models.candidate import Candidate
    from app.models.question import QuestionSet, Question, QuestionOption
    from app.models.attempt import ExamAttempt
    db = SessionLocal()

    # Find Technical Department and Non-Technical / HR Department
    tech_dept = db.query(Department).filter(
        Department.code.in_(["DEV", "TECH", "CSE", "IT"]),
        Department.active == True
    ).first()
    non_tech_dept = db.query(Department).filter(
        Department.code.in_(["HR", "NON_TECH", "MGMT", "MKT"]),
        Department.active == True
    ).first()

    if not tech_dept or not non_tech_dept:
        all_depts = db.query(Department).filter(Department.active == True).all()
        academic = [d for d in all_depts if not d.name.lower().startswith("college:")]
        tech_dept = academic[0]
        non_tech_dept = academic[1]

    print(f"[PASS] 3. Department A (Tech): ID={tech_dept.id}, Name='{tech_dept.name}' ({tech_dept.code})")
    print(f"       Department B (Non-Tech): ID={non_tech_dept.id}, Name='{non_tech_dept.name}' ({non_tech_dept.code})")

    # 4. Get or Create Question Sets for both departments
    tech_sets_res = admin_session.get(f"{BASE_URL}/admin/exams/{exam_id}/departments/{tech_dept.id}/sets")
    assert tech_sets_res.status_code == 200
    tech_sets = tech_sets_res.json()
    tech_set_a = next((s for s in tech_sets if s["setCode"] == "A"), tech_sets[0])
    tech_set_id = tech_set_a["id"]

    non_tech_sets_res = admin_session.get(f"{BASE_URL}/admin/exams/{exam_id}/departments/{non_tech_dept.id}/sets")
    assert non_tech_sets_res.status_code == 200
    non_tech_sets = non_tech_sets_res.json()
    non_tech_set_a = next((s for s in non_tech_sets if s["setCode"] == "A"), non_tech_sets[0])
    non_tech_set_id = non_tech_set_a["id"]

    assert tech_set_id != non_tech_set_id, "Question sets must be completely separate"
    print(f"[PASS] 4. Question Sets Confirmed: Dept A Set ID={tech_set_id}, Dept B Set ID={non_tech_set_id}")

    # 5. Clear old test questions in these sets to ensure exact count validation
    db.query(Question).filter(Question.question_set_id.in_([tech_set_id, non_tech_set_id])).delete(synchronize_session=False)
    db.commit()

    # 6. Import Questions for Department A (Technical)
    tech_import_text = """
1. What is the time complexity of binary search on a sorted array of size n?
A) O(1)
B) O(log n)
C) O(n)
D) O(n log n)
Answer: B

2. Which data structure operates on a Last-In-First-Out (LIFO) principle?
A) Queue
B) Array
C) Stack
D) Linked List
Answer: C

3. In object-oriented programming, what principle allows a child class to provide a specific implementation of a parent method?
A) Encapsulation
B) Polymorphism
C) Abstraction
D) Inheritance
Answer: B
""".strip()

    import_tech_res = admin_session.post(
        f"{BASE_URL}/admin/sets/{tech_set_id}/import",
        json={"rawText": tech_import_text}
    )
    assert import_tech_res.status_code == 200, f"Tech question import failed: {import_tech_res.text}"
    imported_tech = import_tech_res.json()
    assert len(imported_tech) == 3, f"Expected 3 imported tech questions, got {len(imported_tech)}"
    print(f"[PASS] 5. Successfully imported 3 Department A (Technical) questions into Set ID={tech_set_id}")

    # 7. Import Questions for Department B (Non-Technical / HR)
    non_tech_import_text = """
1. What does the acronym KPI stand for in organizational performance management?
A) Key Process Indicator
B) Key Performance Indicator
C) Knowledge Performance Index
D) Key Professional Incentive
Answer: B

2. Which interview technique asks candidates to describe past behavior to predict future performance?
A) Stress Interview
B) Behavioral Interview
C) Unstructured Interview
D) Group Interview
Answer: B

3. In business management, what does the SWOT analysis framework evaluate?
A) Sales, Wages, Output, Targets
B) Strengths, Weaknesses, Opportunities, Threats
C) Systems, Workflows, Operations, Timelines
D) Strategy, Workforce, Objectives, Tasks
Answer: B
""".strip()

    import_non_tech_res = admin_session.post(
        f"{BASE_URL}/admin/sets/{non_tech_set_id}/import",
        json={"rawText": non_tech_import_text}
    )
    assert import_non_tech_res.status_code == 200, f"Non-tech question import failed: {import_non_tech_res.text}"
    imported_non_tech = import_non_tech_res.json()
    assert len(imported_non_tech) == 3, f"Expected 3 imported non-tech questions, got {len(imported_non_tech)}"
    print(f"[PASS] 6. Successfully imported 3 Department B (Non-Tech) questions into Set ID={non_tech_set_id}")

    # 8. Verify Database Storage Integrity
    from sqlalchemy.orm import joinedload
    db_tech_questions = db.query(Question).options(joinedload(Question.options)).filter(
        Question.question_set_id == tech_set_id
    ).all()
    assert len(db_tech_questions) == 3
    for q in db_tech_questions:
        assert len(q.options) == 4, f"Question {q.id} must have exactly 4 options"
        assert any(o.is_correct for o in q.options), f"Question {q.id} must have a marked correct option"

    db_non_tech_questions = db.query(Question).filter(
        Question.question_set_id == non_tech_set_id
    ).all()
    assert len(db_non_tech_questions) == 3
    for q in db_non_tech_questions:
        assert len(q.options) == 4, f"Question {q.id} must have exactly 4 options"
        assert any(o.is_correct for o in q.options), f"Question {q.id} must have a marked correct option"

    # Confirm sets of question IDs are completely disjoint (zero cross-assignment)
    tech_q_ids = {q.id for q in db_tech_questions}
    non_tech_q_ids = {q.id for q in db_non_tech_questions}
    assert tech_q_ids.isdisjoint(non_tech_q_ids), "Question IDs between Department A and B must be completely disjoint"
    print("[PASS] 7. Database integrity verified: No duplicate questions, options valid, zero overlap.")

    # 9. Find or create candidate for Department A
    cand_tech = db.query(Candidate).filter(
        Candidate.department_id == tech_dept.id,
        Candidate.status == "ACTIVE"
    ).first()
    if not cand_tech:
        cand_tech = Candidate(
            registration_number="TEST-TECH-CAND-01",
            full_name="Arjun Technology Candidate",
            email="arjun.tech@campus.edu",
            department_id=tech_dept.id,
            status="ACTIVE"
        )
        db.add(cand_tech)
        db.commit()

    # Clear prior attempts for candidate A to ensure clean start
    db.query(ExamAttempt).filter(ExamAttempt.candidate_id == cand_tech.id).delete()
    db.commit()

    # 10. Find or create candidate for Department B
    cand_non_tech = db.query(Candidate).filter(
        Candidate.department_id == non_tech_dept.id,
        Candidate.status == "ACTIVE"
    ).first()
    if not cand_non_tech:
        cand_non_tech = Candidate(
            registration_number="TEST-NONTECH-CAND-01",
            full_name="Meera NonTech Candidate",
            email="meera.nontech@campus.edu",
            department_id=non_tech_dept.id,
            status="ACTIVE"
        )
        db.add(cand_non_tech)
        db.commit()

    # Clear prior attempts for candidate B
    db.query(ExamAttempt).filter(ExamAttempt.candidate_id == cand_non_tech.id).delete()
    db.commit()

    db.close()

    # 11. CANDIDATE PORTAL TEST: Candidate A (Department A) Enters & Starts
    cand_a_session = requests.Session()
    verify_a_res = cand_a_session.post(f"{BASE_URL}/candidate/verify", json={
        "fullName": cand_tech.full_name,
        "email": cand_tech.email,
        "registrationNumber": cand_tech.registration_number,
        "department": tech_dept.name,
        "departmentId": tech_dept.id
    })
    assert verify_a_res.status_code == 200, f"Candidate A verify failed: {verify_a_res.text}"
    cand_a_data = verify_a_res.json()
    assert cand_a_data["eligible"] is True, f"Candidate A not eligible: {cand_a_data['message']}"

    start_a_res = cand_a_session.post(f"{BASE_URL}/candidate/start", json={
        "candidateId": cand_tech.id,
        "examId": exam_id
    })
    assert start_a_res.status_code == 200, f"Candidate A start failed: {start_a_res.text}"
    portal_a_questions = start_a_res.json()["questions"]
    assert len(portal_a_questions) == 3, f"Candidate A expected 3 questions, got {len(portal_a_questions)}"

    # STRICT ASSERTION: Every question in Candidate A's portal MUST belong to Department A
    for q in portal_a_questions:
        q_id = q["id"] or q["questionId"]
        assert q_id in tech_q_ids, f"Question {q_id} does NOT belong to Department A!"
        assert q_id not in non_tech_q_ids, f"LEAK DETECTED: Question {q_id} from Department B appeared in Department A!"

    # Verify no duplicates in candidate portal
    retrieved_a_ids = [q["id"] or q["questionId"] for q in portal_a_questions]
    assert len(retrieved_a_ids) == len(set(retrieved_a_ids)), "Duplicate questions found in Candidate A portal!"
    print(f"[PASS] 8. Candidate A (Department A) received ONLY Department A questions (3/3 valid, 0 duplicates, 0 leaked).")

    # 12. CANDIDATE PORTAL TEST: Candidate B (Department B) Enters & Starts
    cand_b_session = requests.Session()
    verify_b_res = cand_b_session.post(f"{BASE_URL}/candidate/verify", json={
        "fullName": cand_non_tech.full_name,
        "email": cand_non_tech.email,
        "registrationNumber": cand_non_tech.registration_number,
        "department": non_tech_dept.name,
        "departmentId": non_tech_dept.id
    })
    assert verify_b_res.status_code == 200, f"Candidate B verify failed: {verify_b_res.text}"
    cand_b_data = verify_b_res.json()
    assert cand_b_data["eligible"] is True, f"Candidate B not eligible: {cand_b_data['message']}"

    start_b_res = cand_b_session.post(f"{BASE_URL}/candidate/start", json={
        "candidateId": cand_non_tech.id,
        "examId": exam_id
    })
    assert start_b_res.status_code == 200, f"Candidate B start failed: {start_b_res.text}"
    portal_b_questions = start_b_res.json()["questions"]
    assert len(portal_b_questions) == 3, f"Candidate B expected 3 questions, got {len(portal_b_questions)}"

    # STRICT ASSERTION: Every question in Candidate B's portal MUST belong to Department B
    for q in portal_b_questions:
        q_id = q["id"] or q["questionId"]
        assert q_id in non_tech_q_ids, f"Question {q_id} does NOT belong to Department B!"
        assert q_id not in tech_q_ids, f"LEAK DETECTED: Question {q_id} from Department A appeared in Department B!"

    # Verify no duplicates in candidate portal
    retrieved_b_ids = [q["id"] or q["questionId"] for q in portal_b_questions]
    assert len(retrieved_b_ids) == len(set(retrieved_b_ids)), "Duplicate questions found in Candidate B portal!"
    print(f"[PASS] 9. Candidate B (Department B) received ONLY Department B questions (3/3 valid, 0 duplicates, 0 leaked).")

    print("=" * 75)
    print("ALL VERIFICATION CHECKS PASSED: 100% DEPARTMENT ISOLATION & ZERO DATA LOSS")
    print("=" * 75)

if __name__ == "__main__":
    run_verification()
