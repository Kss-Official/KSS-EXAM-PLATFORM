import sys
import os
import requests
import json
import time

# Ensure backend directory is in sys.path for database cleanup
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

API_BASE = "http://127.0.0.1:8000"
FRONTEND_BASE = "http://127.0.0.1:5173"

def print_section(title):
    print("\n" + "=" * 60)
    print(f" {title.upper()} ")
    print("=" * 60)

audit_results = []

def record(test_name, passed, details=""):
    status = "PASS" if passed else "FAIL"
    audit_results.append((test_name, status, details))
    print(f"[{status}] {test_name}" + (f" -> {details}" if details else ""))

# 1. SERVER HEALTH & CONNECTIVITY
print_section("1. Live Server & Endpoint Health Check")
try:
    r = requests.get(f"{API_BASE}/health", timeout=5)
    record("FastAPI /health check", r.status_code == 200, f"Status: {r.status_code}")
except Exception as e:
    record("FastAPI /health check", False, str(e))

try:
    r = requests.get(f"{FRONTEND_BASE}", timeout=5)
    record("Frontend Vite dev server check", r.status_code == 200, f"Status: {r.status_code}")
except Exception as e:
    record("Frontend Vite dev server check", False, str(e))

# 2. ADMIN AUTHENTICATION
print_section("2. Admin Authentication")
admin_token = None
try:
    r = requests.post(f"{API_BASE}/api/auth/login", json={"email": "d.koushik@kalpanaaasoftwaresolutions.in", "password": "Admin@ExamSecure2026!"}, timeout=5)
    if r.status_code == 200:
        data = r.json()
        admin_token = data.get("token")
        record("Admin Login (/api/auth/login)", bool(admin_token), f"Token obtained, User: {data.get('user', {}).get('email')}, Role: {data.get('user', {}).get('role')}")
    else:
        record("Admin Login (/api/auth/login)", False, f"Status {r.status_code}: {r.text}")
except Exception as e:
    record("Admin Login (/api/auth/login)", False, str(e))

auth_headers = {"Authorization": f"Bearer {admin_token}"} if admin_token else {}

# 3. ADMIN OVERVIEW & STATS
print_section("3. Admin Overview & Dashboard Metrics")
try:
    r = requests.get(f"{API_BASE}/api/admin/dashboard", headers=auth_headers, timeout=5)
    record("Admin Dashboard Stats (/api/admin/dashboard)", r.status_code == 200, f"HTTP {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        print(f"  Summary: ActiveExams={data.get('activeExams', 0)}, Candidates={data.get('registeredCandidates', 0)}, Departments={data.get('activeDepartments', 0)}")
except Exception as e:
    record("Admin Dashboard Stats", False, str(e))

# 4. DEPARTMENTS & TRACKS (TECHNICAL & NON-TECHNICAL)
print_section("4. Departments Management & Dynamic Categorization")
try:
    r = requests.get(f"{API_BASE}/api/admin/departments", headers=auth_headers, timeout=5)
    record("Fetch Admin Departments (/api/admin/departments)", r.status_code == 200, f"Found {len(r.json())} depts")
    depts = r.json()
    tech = [d for d in depts if d.get("category") == "TECHNICAL"]
    non_tech = [d for d in depts if d.get("category") == "NON_TECHNICAL"]
    record("Department Technical / Non-Technical Split", len(tech) > 0 and len(non_tech) > 0, f"Tech: {len(tech)}, Non-Tech: {len(non_tech)}")
except Exception as e:
    record("Fetch Admin Departments", False, str(e))

# 5. DYNAMIC SYNC AUDIT: Admin -> Candidate Portal
print_section("5. Dynamic Sync: Admin Changes -> Candidate Portal")
test_dept_id = None
try:
    # A: Create a test department in Admin
    create_payload = {
        "code": "AUDIT_SYNC",
        "name": "Audit Sync Specialization",
        "category": "NON_TECHNICAL",
        "description": "Temporary department to test dynamic sync",
        "active": True
    }
    r = requests.post(f"{API_BASE}/api/admin/departments", json=create_payload, headers=auth_headers, timeout=5)
    if r.status_code in (200, 201):
        created = r.json()
        test_dept_id = created.get("id")
        record("Create Department in Admin Portal", True, f"Created ID {test_dept_id}")

        # B: Check Candidate Portal immediately sees it
        r_cand = requests.get(f"{API_BASE}/api/candidate/departments", timeout=5)
        cand_depts = r_cand.json()
        found_in_cand = any(d.get("id") == test_dept_id for d in cand_depts)
        record("Candidate Portal dynamically reflects NEW department", found_in_cand, f"Found in candidate department list: {found_in_cand}")

        # C: Update the department in Admin
        update_payload = {
            "code": "AUDIT_SYNC",
            "name": "Audit Sync Specialization UPDATED",
            "category": "TECHNICAL",
            "active": True
        }
        r_up = requests.put(f"{API_BASE}/api/admin/departments/{test_dept_id}", json=update_payload, headers=auth_headers, timeout=5)
        record("Update Department in Admin Portal", r_up.status_code == 200, f"Updated category to TECHNICAL")

        # D: Check Candidate Portal immediately reflects update
        r_cand2 = requests.get(f"{API_BASE}/api/candidate/departments", timeout=5)
        cand_depts2 = r_cand2.json()
        updated_item = next((d for d in cand_depts2 if d.get("id") == test_dept_id), None)
        record("Candidate Portal dynamically reflects UPDATED department", 
               updated_item is not None and updated_item.get("category") == "TECHNICAL",
               f"Reflected title: {updated_item.get('name') if updated_item else None}, category: {updated_item.get('category') if updated_item else None}")

        # E: Clean up: delete test department
        r_del = requests.delete(f"{API_BASE}/api/admin/departments/{test_dept_id}", headers=auth_headers, timeout=5)
        record("Delete Department in Admin Portal", r_del.status_code in (200, 204), "Deleted successfully")

        # F: Verify Candidate Portal no longer has it
        r_cand3 = requests.get(f"{API_BASE}/api/candidate/departments", timeout=5)
        still_present = any(d.get("id") == test_dept_id for d in r_cand3.json())
        record("Candidate Portal dynamically reflects DELETED department", not still_present, "Removed from candidate list")
    else:
        record("Create Department in Admin Portal", False, f"HTTP {r.status_code}: {r.text}")
except Exception as e:
    record("Dynamic Sync: Admin -> Candidate", False, str(e))

# 6. QUESTION BANK AUDIT
print_section("6. Question Bank & Question Sets")
try:
    # First get published exam id
    r_exams = requests.get(f"{API_BASE}/api/admin/exams", headers=auth_headers, timeout=5)
    record("Fetch Admin Exams (/api/admin/exams)", r_exams.status_code == 200, f"Total exams: {len(r_exams.json())}")
    exams = r_exams.json()
    if exams and isinstance(exams, list):
        exam_id = exams[0].get("id")
        r_depts = requests.get(f"{API_BASE}/api/admin/exams/{exam_id}/departments", headers=auth_headers, timeout=5)
        record(f"Fetch Question Bank Departments for Exam #{exam_id}", r_depts.status_code == 200, f"Departments configured: {len(r_depts.json())}")
        
        dept_list = r_depts.json()
        if dept_list and isinstance(dept_list, list):
            first_dept = dept_list[0]
            dept_id = first_dept.get("id")
            r_sets = requests.get(f"{API_BASE}/api/admin/exams/{exam_id}/departments/{dept_id}/sets", headers=auth_headers, timeout=5)
            record(f"Fetch Sets for Dept '{first_dept.get('name')}'", r_sets.status_code == 200, f"Sets found: {len(r_sets.json())}")
            sets_data = r_sets.json()
            set_codes = [s.get("setCode") for s in sets_data]
            record("Sets A, B, C, D verified", all(c in set_codes for c in ["A", "B", "C", "D"]), f"Sets: {set_codes}")
except Exception as e:
    record("Question Bank Audit", False, str(e))

# 7. CANDIDATE DIRECTORY & DATE FILTERING
print_section("7. Candidate Directory & Date Filtering")
try:
    r = requests.get(f"{API_BASE}/api/admin/candidates?date=ALL", headers=auth_headers, timeout=5)
    record("Fetch Candidates (date=ALL)", r.status_code == 200, f"Total candidates: {r.json().get('total', 0)}")
    
    r_dates = requests.get(f"{API_BASE}/api/admin/candidates/dates", headers=auth_headers, timeout=5)
    record("Fetch Candidate Dates (/api/admin/candidates/dates)", r_dates.status_code == 200, f"Dates: {r_dates.json()}")
except Exception as e:
    record("Candidate Directory & Date Filtering", False, str(e))

# 8. LIVE EXAM MONITORING & PROCTORING AUDIT
print_section("8. Live Exam Monitoring & Proctoring")
try:
    # A: Check examinees endpoint
    r = requests.get(f"{API_BASE}/api/admin/live-monitoring/examinees", headers=auth_headers, timeout=5)
    record("Live Examinees Endpoint (/api/admin/live-monitoring/examinees)", r.status_code == 200, f"Found {len(r.json())} examinees")
    examinees = r.json()
    if examinees:
        first_ex = examinees[0]
        has_date = bool(first_ex.get("examDate"))
        record("Examinee DTO includes examDate property", has_date, f"Candidate: {first_ex.get('fullName')} | examDate: {first_ex.get('examDate')}")
    
    # B: Check proctor alerts endpoint
    r_al = requests.get(f"{API_BASE}/api/admin/live-monitoring/alerts?limit=10", headers=auth_headers, timeout=5)
    record("Proctor Cheating Alerts Feed (/api/admin/live-monitoring/alerts)", r_al.status_code == 200, f"Status: {r_al.status_code}")
except Exception as e:
    record("Live Monitoring Audit", False, str(e))

# 9. END-TO-END CANDIDATE PORTAL EXAM LIFECYCLE
print_section("9. End-to-End Candidate Exam Lifecycle")
try:
    # Prepare idempotent test candidate state
    from app.core import SessionLocal
    from app.models import Candidate, ExamAttempt, AttemptAnswer, ProctorAlert
    db_prep = SessionLocal()
    cand_obj = db_prep.query(Candidate).filter(Candidate.email == "jingyasa.p@campus.edu").first()
    if cand_obj:
        cand_obj.exam_date = "2026-11-13"
        cand_obj.batch = "Demo / Testing"
        cand_obj.status = "ACTIVE"
        for a in db_prep.query(ExamAttempt).filter(ExamAttempt.candidate_id == cand_obj.id).all():
            db_prep.query(AttemptAnswer).filter(AttemptAnswer.attempt_id == a.id).delete()
            db_prep.query(ProctorAlert).filter(ProctorAlert.attempt_id == a.id).delete()
            db_prep.delete(a)
        db_prep.commit()
    db_prep.close()

    verify_payload = {
        "fullName": "Jingyasa Priyadarsini",
        "email": "jingyasa.p@campus.edu",
        "department": "Developer"
    }
    r_ver = requests.post(f"{API_BASE}/api/candidate/verify", json=verify_payload, timeout=5)
    if r_ver.status_code == 200:
        ver_data = r_ver.json()
        eligible = ver_data.get("eligible")
        record("Candidate Portal Login & Verification (/api/candidate/verify)", eligible == True, 
               f"Eligible: {eligible}, Exam: {ver_data.get('examTitle')}, Set: {ver_data.get('setCode')}")
        
        cand_id = ver_data.get("candidateId")
        exam_id = ver_data.get("examId")
        cand_token = ver_data.get("token")
        cand_headers = {"Authorization": f"Bearer {cand_token}"} if cand_token else {}

        if eligible:
            # Start Exam Attempt
            r_start = requests.post(f"{API_BASE}/api/candidate/start", 
                                    json={"candidateId": cand_id, "examId": exam_id}, 
                                    headers=cand_headers, timeout=5)
            record("Start or Resume Candidate Attempt (/api/candidate/start)", r_start.status_code == 200, f"HTTP {r_start.status_code}")
            
            if r_start.status_code == 200:
                attempt_data = r_start.json()
                attempt_id = attempt_data.get("attemptId")
                questions = attempt_data.get("questions", [])
                record("Candidate received exam questions dynamically", len(questions) > 0, f"Total Questions: {len(questions)}")

                # Autosave answer for Question 1
                if questions:
                    q1 = questions[0]
                    q1_id = q1.get("id") or q1.get("questionId")
                    opts = q1.get("options", [])
                    sel_opt = opts[0].get("id") or opts[0].get("optionId") if opts else 1
                    r_ans = requests.post(f"{API_BASE}/api/candidate/answers", 
                                          json={"candidateId": cand_id, "attemptId": attempt_id, "questionId": q1_id, "selectedOptionId": sel_opt},
                                          headers=cand_headers, timeout=5)
                    record("Autosave Candidate Answer (/api/candidate/answers)", r_ans.status_code == 200, f"HTTP {r_ans.status_code}")

                # Post real-time proctor alert (e.g. Tab switch detected)
                r_alert = requests.post(f"{API_BASE}/api/candidate/proctor/alert", 
                                        json={
                                            "candidateId": cand_id,
                                            "attemptId": attempt_id,
                                            "alertType": "TAB_SWITCH",
                                            "message": "Candidate switched tabs to external browser",
                                            "severity": "HIGH"
                                        },
                                        headers=cand_headers, timeout=5)
                record("Ingest Proctor Alert (/api/candidate/proctor/alert)", r_alert.status_code == 200, f"Alert recorded: {r_alert.status_code == 200}")

                # Candidate Heartbeat
                r_hb = requests.get(f"{API_BASE}/api/candidate/heartbeat?candidateId={cand_id}&attemptId={attempt_id}", headers=cand_headers, timeout=5)
                record("Candidate Heartbeat & Timer Sync (/api/candidate/heartbeat)", r_hb.status_code == 200, 
                       f"Status: {r_hb.json().get('status')}, Remaining: {r_hb.json().get('remainingSeconds')}s")

                # Admin gives candidate +10 mins extra time
                r_extra = requests.post(f"{API_BASE}/api/admin/live-monitoring/give-extra-time", 
                                        json={"candidateId": cand_id, "attemptId": attempt_id, "extraMinutes": 10},
                                        headers=auth_headers, timeout=5)
                record("Admin grants +10 mins extra time in Live Monitoring", r_extra.status_code == 200, f"HTTP {r_extra.status_code}")

                # Candidate Heartbeat sees revised extra time
                r_hb2 = requests.get(f"{API_BASE}/api/candidate/heartbeat?candidateId={cand_id}&attemptId={attempt_id}", headers=cand_headers, timeout=5)
                record("Candidate Heartbeat immediately receives Extra Time", 
                       r_hb2.json().get("extraTimeMinutes") == 10, 
                       f"Extra time confirmed on candidate screen: +{r_hb2.json().get('extraTimeMinutes')} mins")

                # Candidate submits exam
                r_sub = requests.post(f"{API_BASE}/api/candidate/submit", 
                                      json={"candidateId": cand_id, "attemptId": attempt_id},
                                      headers=cand_headers, timeout=5)
                record("Candidate Exam Submission (/api/candidate/submit)", r_sub.status_code == 200, 
                       f"Score: {r_sub.json().get('score')}/{r_sub.json().get('totalMarks')}, Passed: {r_sub.json().get('passed')}")
    else:
        record("Candidate Portal Login & Verification", False, f"HTTP {r_ver.status_code}: {r_ver.text}")
except Exception as e:
    record("Candidate Exam Lifecycle", False, str(e))

# 10. RESULTS MANAGEMENT AUDIT
print_section("10. Results & Analytics Audit")
try:
    r = requests.get(f"{API_BASE}/api/admin/results", headers=auth_headers, timeout=5)
    record("Fetch Admin Results (/api/admin/results)", r.status_code == 200, f"Found {len(r.json())} submitted results")
except Exception as e:
    record("Results Management Audit", False, str(e))

# AUDIT SUMMARY
print_section("Comprehensive Live Audit Summary")
total_tests = len(audit_results)
passed_tests = sum(1 for _, st, _ in audit_results if st == "PASS")
failed_tests = total_tests - passed_tests

print(f"Total Tests Executed: {total_tests}")
print(f"PASSED: {passed_tests}")
print(f"FAILED: {failed_tests}")
print(f"Success Rate: {(passed_tests / total_tests) * 100:.1f}%\n")

if failed_tests > 0:
    print("FAILED TESTS:")
    for name, st, details in audit_results:
        if st == "FAIL":
            print(f"  ❌ {name}: {details}")
    sys.exit(1)
else:
    print("🎉 ALL SYSTEMS AND PATHWAYS ARE WORKING 100% PERFECTLY!")
