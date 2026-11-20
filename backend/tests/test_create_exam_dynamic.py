import sys
import os
import requests
import json
import time

# Ensure backend directory is in sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

API_BASE = "http://127.0.0.1:8000"

def print_section(title):
    print("\n" + "=" * 60)
    print(f" {title.upper()} ")
    print("=" * 60)

test_results = []
def record(name, passed, details=""):
    st = "PASS" if passed else "FAIL"
    test_results.append((name, st, details))
    print(f"[{st}] {name}" + (f" -> {details}" if details else ""))

# Clean up any leftover exam from previous partial test
from app.core import SessionLocal
from app.models import Exam, ExamAttempt, AttemptAnswer, ProctorAlert, QuestionSet, Question, QuestionOption, Candidate

db_init = SessionLocal()
for old_test_e in db_init.query(Exam).filter(Exam.title == "Dynamic Audit Placement Exam 2026").all():
    print(f"Cleaning previous test exam #{old_test_e.id}")
    for a in db_init.query(ExamAttempt).filter(ExamAttempt.exam_id == old_test_e.id).all():
        db_init.query(AttemptAnswer).filter(AttemptAnswer.attempt_id == a.id).delete()
        db_init.query(ProctorAlert).filter(ProctorAlert.attempt_id == a.id).delete()
        db_init.delete(a)
    for qs in db_init.query(QuestionSet).filter(QuestionSet.exam_id == old_test_e.id).all():
        for q in db_init.query(Question).filter(Question.question_set_id == qs.id).all():
            db_init.query(QuestionOption).filter(QuestionOption.question_id == q.id).delete()
            db_init.delete(q)
        db_init.delete(qs)
    db_init.delete(old_test_e)
db_init.commit()
db_init.close()

# 1. ADMIN AUTHENTICATION
print_section("1. Admin Authentication")
r_login = requests.post(
    f"{API_BASE}/api/auth/login",
    json={"email": "d.koushik@kalpanaaasoftwaresolutions.in", "password": "Admin@ExamSecure2026!"},
    timeout=10
)
admin_token = r_login.json().get("token")
record("Super Admin Login", bool(admin_token), f"Token obtained")
auth_headers = {"Authorization": f"Bearer {admin_token}"}

# 2. FETCH AVAILABLE DEPARTMENTS
print_section("2. Department Selection for New Exam")
r_depts = requests.get(f"{API_BASE}/api/admin/departments", headers=auth_headers, timeout=10)
all_depts = r_depts.json()
record("Fetch Active Academic Departments", len(all_depts) > 0, f"Found {len(all_depts)} departments")

# Pick Information Technology (IT)
target_dept = next((d for d in all_depts if d.get("code") == "IT"), all_depts[0])
target_dept_id = target_dept.get("id")
print(f"Selected Target Department: {target_dept.get('name')} (ID: {target_dept_id}, Code: {target_dept.get('code')})")

# 3. CREATE NEW EXAM VIA ADMIN API
print_section("3. Create New Examination")
new_exam_payload = {
    "title": "Dynamic Audit Placement Exam 2026",
    "description": "Comprehensive IT & Software Assessment created dynamically during audit",
    "durationMinutes": 45,
    "totalQuestions": 10,
    "totalMarks": 20.0,
    "marksPerQuestion": 2.0,
    "negativeMarks": 0.5,
    "qualificationMode": "PERCENTAGE",
    "qualificationThreshold": 60.0,
    "timingMode": "DURATION_FROM_START",
    "departmentIds": [target_dept_id]
}

r_create = requests.post(f"{API_BASE}/api/admin/exams", json=new_exam_payload, headers=auth_headers, timeout=15)
record("Create Exam API (POST /api/admin/exams)", r_create.status_code in (200, 201), f"Status: {r_create.status_code}")
created_exam = r_create.json()
exam_id = created_exam.get("id")
record("Exam Created with Initial DRAFT Status", created_exam.get("status") == "DRAFT", f"Exam ID: {exam_id}, Status: {created_exam.get('status')}")

# 4. QUESTION SETS GENERATION CHECK
print_section("4. Automatic 4-Set (A, B, C, D) Question Bank Initialization")
r_sets = requests.get(f"{API_BASE}/api/admin/exams/{exam_id}/departments/{target_dept_id}/sets", headers=auth_headers, timeout=10)
record("Fetch Generated Question Sets for New Exam", r_sets.status_code == 200, f"Status: {r_sets.status_code}")
sets = r_sets.json()
set_codes = [s.get("setCode") for s in sets]
record("Independent Sets A, B, C, D Automatically Generated", all(c in set_codes for c in ["A", "B", "C", "D"]), f"Sets: {set_codes}")

# 5. POPULATE DYNAMIC QUESTIONS INTO SET A
print_section("5. Upload/Persist Questions into Set A")
set_a = next((s for s in sets if s.get("setCode") == "A"), sets[0])
set_a_id = set_a.get("id")

sample_questions = [
    {
        "questionText": "What is the time complexity of searching an element in a balanced binary search tree?",
        "marks": 2.0,
        "negativeMarks": 0.5,
        "displayOrder": 1,
        "options": [
            {"label": "A", "optionText": "O(1)", "correct": False, "displayOrder": 1},
            {"label": "B", "optionText": "O(log N)", "correct": True, "displayOrder": 2},
            {"label": "C", "optionText": "O(N)", "correct": False, "displayOrder": 3},
            {"label": "D", "optionText": "O(N log N)", "correct": False, "displayOrder": 4}
        ]
    },
    {
        "questionText": "Which protocol operates at the Transport Layer of the OSI model?",
        "marks": 2.0,
        "negativeMarks": 0.5,
        "displayOrder": 2,
        "options": [
            {"label": "A", "optionText": "IP", "correct": False, "displayOrder": 1},
            {"label": "B", "optionText": "TCP", "correct": True, "displayOrder": 2},
            {"label": "C", "optionText": "HTTP", "correct": False, "displayOrder": 3},
            {"label": "D", "optionText": "Ethernet", "correct": False, "displayOrder": 4}
        ]
    }
]

# Exact endpoint used by CreateExamPage: PUT /api/admin/sets/{setId}/bulk
r_bulk = requests.put(f"{API_BASE}/api/admin/sets/{set_a_id}/bulk", json=sample_questions, headers=auth_headers, timeout=15)
record("Bulk Persist Questions into Set A (PUT /api/admin/sets/{id}/bulk)", r_bulk.status_code in (200, 201), f"Status: {r_bulk.status_code}")

r_q_check = requests.get(f"{API_BASE}/api/admin/exams/{exam_id}/departments/{target_dept_id}/sets/A/questions", headers=auth_headers, timeout=10)
persisted_q = r_q_check.json()
record("Verify Persisted Questions in Set A", len(persisted_q) == 2, f"Total Questions Saved: {len(persisted_q)}")

# 6. PUBLISH THE NEW EXAMINATION
print_section("6. Publish Examination")
r_pub = requests.post(f"{API_BASE}/api/admin/exams/{exam_id}/publish", headers=auth_headers, timeout=30)
record("Publish Exam API (POST /api/admin/exams/{id}/publish)", r_pub.status_code == 200, f"Status: {r_pub.status_code}")
pub_data = r_pub.json()
record("Exam Status Changed to ACTIVATED / PUBLISHED", pub_data.get("status") in ("ACTIVATED", "PUBLISHED"), f"New Status: {pub_data.get('status')}")

# 7. DYNAMIC REFLECTION IN ADMIN EXAMS LIST & DASHBOARD
print_section("7. Dynamic Reflection in Admin Console")
r_all_exams = requests.get(f"{API_BASE}/api/admin/exams", headers=auth_headers, timeout=10)
all_exams_list = r_all_exams.json()
found_in_list = any(e.get("id") == exam_id for e in all_exams_list)
record("New Exam Appears Immediately in /api/admin/exams", found_in_list, f"Total Exams in DB: {len(all_exams_list)}")

r_dash = requests.get(f"{API_BASE}/api/admin/dashboard", headers=auth_headers, timeout=10)
record("Admin Dashboard Reflects Active Exams", r_dash.json().get("activeExams", 0) >= 1, f"Active Exams Count: {r_dash.json().get('activeExams')}")

# 8. DYNAMIC REFLECTION IN CANDIDATE PORTAL
print_section("8. Dynamic Reflection in Candidate Portal")
# Assign Rohan Verma (REG003, IT department) to test the new exam dynamically
db = SessionLocal()
cand_it = db.query(Candidate).filter(Candidate.email == "rohan.verma@campus.edu").first()
if cand_it:
    cand_it.exam_date = "2026-11-13"
    cand_it.batch = "Demo / Testing"
    cand_it.department_id = target_dept_id
    cand_it.assigned_set = "A"
    cand_it.status = "ACTIVE"
    for a in db.query(ExamAttempt).filter(ExamAttempt.candidate_id == cand_it.id).all():
        db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id == a.id).delete()
        db.query(ProctorAlert).filter(ProctorAlert.attempt_id == a.id).delete()
        db.delete(a)
    db.commit()
    print(f"Configured Candidate {cand_it.full_name} ({cand_it.email}) in department {target_dept.get('name')}")
db.close()

# Candidate verifies login
r_cand_ver = requests.post(f"{API_BASE}/api/candidate/verify", json={
    "fullName": "Rohan Verma",
    "email": "rohan.verma@campus.edu",
    "department": target_dept.get("name")
}, timeout=10)

record("Candidate Verification for Newly Created Exam", r_cand_ver.status_code == 200, f"Status: {r_cand_ver.status_code}")
cand_data = r_cand_ver.json()
record("Candidate Assigned to Newly Created Exam Dynamically", 
       cand_data.get("eligible") == True and cand_data.get("examId") == exam_id,
       f"Assigned Exam: '{cand_data.get('examTitle')}' (ID: {cand_data.get('examId')}), Set: {cand_data.get('setCode')}")

# Candidate starts the newly created exam
cand_token = cand_data.get("token")
cand_headers = {"Authorization": f"Bearer {cand_token}"}
r_cand_start = requests.post(f"{API_BASE}/api/candidate/start", json={
    "candidateId": cand_data.get("candidateId"),
    "examId": exam_id
}, headers=cand_headers, timeout=10)

record("Candidate Starts Newly Created Exam", r_cand_start.status_code == 200, f"Status: {r_cand_start.status_code}")
start_data = r_cand_start.json()
retrieved_questions = start_data.get("questions", [])
record("Candidate Receives The Exact Questions Configured in New Exam", 
       len(retrieved_questions) >= 2 and any("binary search tree" in q.get("questionText", "") for q in retrieved_questions),
       f"Total Questions Received: {len(retrieved_questions)}")

# Candidate answers Question 1
if retrieved_questions:
    q1 = retrieved_questions[0]
    sel_opt = q1.get("options", [])[1].get("id") if q1.get("options") else 1
    r_ans = requests.post(f"{API_BASE}/api/candidate/answers", json={
        "candidateId": cand_data.get("candidateId"),
        "attemptId": start_data.get("attemptId"),
        "questionId": q1.get("id"),
        "selectedOptionId": sel_opt
    }, headers=cand_headers, timeout=10)
    record("Candidate Autosave Answer in New Exam", r_ans.status_code == 200, f"Status: {r_ans.status_code}")

    # Candidate submits the exam
    r_sub = requests.post(f"{API_BASE}/api/candidate/submit", json={
        "candidateId": cand_data.get("candidateId"),
        "attemptId": start_data.get("attemptId")
    }, headers=cand_headers, timeout=10)
    record("Candidate Submits New Exam", r_sub.status_code == 200, f"Score: {r_sub.json().get('score')}/{r_sub.json().get('totalMarks')}")

# 9. CLEAN UP TEST EXAM & RESTORE DEFAULT EXAM
print_section("9. Clean Up Audit Test Exam & Restore Default Exam")
db_clean = SessionLocal()
for a in db_clean.query(ExamAttempt).filter(ExamAttempt.exam_id == exam_id).all():
    db_clean.query(AttemptAnswer).filter(AttemptAnswer.attempt_id == a.id).delete()
    db_clean.query(ProctorAlert).filter(ProctorAlert.attempt_id == a.id).delete()
    db_clean.delete(a)
db_clean.commit()
db_clean.close()

r_del = requests.delete(f"{API_BASE}/api/admin/exams/{exam_id}?force=true", headers=auth_headers, timeout=10)
record("Delete Test Exam (DELETE /api/admin/exams/{id}?force=true)", r_del.status_code == 200, f"Cleaned up Exam ID: {exam_id}")

# Reactivate the primary exam (ID: 107) so platform remains active
r_reactivate = requests.post(f"{API_BASE}/api/admin/exams/107/publish", headers=auth_headers, timeout=20)
record("Reactivate Primary Exam (ID: 107)", r_reactivate.status_code == 200, "Primary Exam Restored to ACTIVE/PUBLISHED")

# SUMMARY
print_section("Create Exam Dynamic Verification Summary")
total = len(test_results)
passed = sum(1 for _, st, _ in test_results if st == "PASS")
failed = total - passed
print(f"Total Tests: {total} | Passed: {passed} | Failed: {failed}")
print(f"Success Rate: {(passed / total) * 100:.1f}%\n")

if failed == 0:
    print("🎉 CREATE EXAM IS 100% WORKING AND COMPLETELY DYNAMIC!")
else:
    sys.exit(1)
