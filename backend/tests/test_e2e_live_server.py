import time
import pytest
import requests

import os
BASE_URL = os.environ["EXAMSECURE_TEST_BASE_URL"]  # private test server (see conftest.py)

@pytest.mark.skip(reason="LEGACY: targets the retired Unique-ID / 3-use-limit / Round-2 workflow (removed in commit 982d58e). Needs rewriting for the 3-field candidate login flow; current flow is covered by test_full_suite, test_candidate_strict_validation and test_exam_data_storage_and_admin_sync.")
def test_complete_e2e_live_system():
    print("\n========================================================")
    print("  EXAMSECURE COMPLETE END-TO-END SYSTEM VERIFICATION")
    print("========================================================\n")

    session = requests.Session()

    # ---------------------------------------------------------
    # 1. Health Check
    # ---------------------------------------------------------
    print("[TEST 1/8] Verifying Backend Health API...")
    res = session.get(f"{BASE_URL}/api/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    health_data = res.json()
    assert health_data.get("status") == "UP"
    print("  [OK] Backend is ONLINE: status=UP\n")

    # ---------------------------------------------------------
    # 2. Super Administrator Authentication
    # ---------------------------------------------------------
    print("[TEST 2/8] Authenticating Super Administrator...")
    login_payload = {
        "email": "d.koushik@kalpanaaasoftwaresolutions.in",
        "password": "Admin@ExamSecure2026!"
    }
    res = session.post(f"{BASE_URL}/api/auth/login", json=login_payload)
    assert res.status_code == 200, f"Admin login failed: {res.text}"
    login_data = res.json()
    assert login_data.get("success") is True, f"Login not successful: {login_data}"
    # API wraps user info under a nested 'user' key
    user_info = login_data.get("user") or login_data
    assert user_info["email"] == "d.koushik@kalpanaaasoftwaresolutions.in"
    assert user_info["role"] == "SUPER_ADMIN"
    print(f"  [OK] Admin authenticated successfully: {user_info['fullName']} ({user_info['role']})")

    # Verify session cookie persists
    me_res = session.get(f"{BASE_URL}/api/auth/me")
    assert me_res.status_code == 200
    print("  [OK] Active session cookie verified via /api/auth/me\n")

    # ---------------------------------------------------------
    # 3. Department Setup
    # ---------------------------------------------------------
    print("[TEST 3/8] Managing Departments...")
    dept_res = session.get(f"{BASE_URL}/api/admin/departments")
    assert dept_res.status_code == 200
    depts = dept_res.json()
    dev_dept = next((d for d in depts if d["code"] == "DEV"), None)
    if not dev_dept:
        create_dept_res = session.post(f"{BASE_URL}/api/admin/departments", json={
            "name": "Developer",
            "code": "DEV",
            "description": "Software Engineering & Architecture",
            "active": True
        })
        assert create_dept_res.status_code in (200, 201)
        dev_dept = create_dept_res.json()
    print(f"  [OK] Department verified: {dev_dept['name']} (ID: {dev_dept['id']})\n")

    # ---------------------------------------------------------
    # 4. Candidate Registration & Round-Specific Unique IDs
    # ---------------------------------------------------------
    print("[TEST 4/8] Candidate Registration & Round-Specific Unique IDs (3-Use Limit)...")
    cand_reg = f"E2E-CAND-{int(time.time())}"
    cand_payload = {
        "registrationNumber": cand_reg,
        "fullName": "Kavya Ramesh",
        "email": f"kavya_{int(time.time())}@campus.edu",
        "departmentId": dev_dept["id"],
        "status": "ACTIVE"
    }
    cand_create_res = session.post(f"{BASE_URL}/api/admin/candidates", json=cand_payload)
    assert cand_create_res.status_code == 200, f"Candidate creation failed: {cand_create_res.text}"
    cand = cand_create_res.json()
    cand_id = cand["id"]
    print(f"  [OK] Registered Candidate: {cand['fullName']} (Reg: {cand['registrationNumber']})")

    # Batch generate Round 1 IDs
    r1_batch_res = session.post(f"{BASE_URL}/api/admin/candidates/round-ids/batch-generate", json={"round": "ROUND_1"})
    assert r1_batch_res.status_code == 200
    r1_data = r1_batch_res.json()
    assert cand_reg in r1_data["roundIds"]
    r1_code = r1_data["roundIds"][cand_reg]
    print(f"  [OK] Round 1 (MCQ) Unique ID Generated: {r1_code}")

    # Batch generate Round 2 IDs
    r2_batch_res = session.post(f"{BASE_URL}/api/admin/candidates/round-ids/batch-generate", json={"round": "ROUND_2"})
    assert r2_batch_res.status_code == 200
    r2_data = r2_batch_res.json()
    assert cand_reg in r2_data["roundIds"]
    r2_code = r2_data["roundIds"][cand_reg]
    print(f"  [OK] Round 2 (Coding) Unique ID Generated: {r2_code}")

    # Query mapping endpoint
    map_res = session.get(f"{BASE_URL}/api/admin/candidates/round-ids?round=ROUND_1")
    assert map_res.status_code == 200
    assert map_res.json().get(cand_reg) == r1_code
    print("  [OK] Persisted Round 1 Unique ID mapping lookup verified")

    # Send Unique ID to Candidate Email
    send_email_res = session.post(f"{BASE_URL}/api/admin/candidates/{cand_id}/send-access-code?round=ROUND_1")
    assert send_email_res.status_code == 200
    email_data = send_email_res.json()
    assert email_data["success"] is True
    assert email_data["accessCode"] == r1_code
    print(f"  [OK] Single Email Dispatched: Access ID {r1_code} to {email_data['email']} (Provider: {email_data.get('provider')})")

    # Test Batch Email Queue Dispatch with rate pacing
    batch_email_res = session.post(f"{BASE_URL}/api/admin/candidates/batch-send-access-codes", json={
        "round": "ROUND_1",
        "candidateIds": [cand_id],
        "examTitle": "Campus Placement Drive 2026",
        "provider": "mock_logger",
        "delaySeconds": 0.0
    })
    assert batch_email_res.status_code == 200
    job_info = batch_email_res.json()
    assert "jobId" in job_info
    job_id = job_info["jobId"]
    print(f"  [OK] Batch Email Queue Created: Job {job_id}")

    # Check status of batch email job
    time.sleep(0.5)
    status_res = session.get(f"{BASE_URL}/api/admin/candidates/batch-send-status/{job_id}")
    assert status_res.status_code == 200
    job_status = status_res.json()
    assert job_status["jobId"] == job_id
    print(f"  [OK] Batch Email Status Polled: status={job_status['status']}, sent={job_status['sent']}/{job_status['total']}\n")

    # ---------------------------------------------------------
    # 5. Round 1 MCQ Exam Creation & Verification
    # ---------------------------------------------------------
    print("[TEST 5/8] Round 1 MCQ Assessment Management & Setup...")
    exam_payload = {
        "title": f"Live E2E General Aptitude Exam {int(time.time())}",
        "description": "Multi-set verified aptitude exam",
        "durationMinutes": 45,
        "totalQuestions": 1,
        "qualificationMode": "PERCENTAGE",
        "qualificationThreshold": 50.0,
        "timingMode": "DURATION_FROM_START",
        "totalMarks": 10.0,
        "marksPerQuestion": 10.0,
        "negativeMarks": 0.0,
        "departmentIds": [dev_dept["id"]],
        "status": "DRAFT"
    }
    exam_res = session.post(f"{BASE_URL}/api/admin/exams", json=exam_payload)
    assert exam_res.status_code in (200, 201), f"Exam creation failed: {exam_res.text}"
    exam = exam_res.json()
    exam_id = exam["id"]
    print(f"  [OK] Created MCQ Exam: '{exam['title']}' (ID: {exam_id})")

    # Initialize sets for the department and find Set A's database ID
    session.post(f"{BASE_URL}/api/admin/exams/{exam_id}/departments/{dev_dept['id']}/initialize-sets")
    sets_res = session.get(f"{BASE_URL}/api/admin/exams/{exam_id}/sets")
    assert sets_res.status_code == 200, f"Get sets failed: {sets_res.text}"
    sets_data = sets_res.json()
    set_a = next((s for s in sets_data if s.get("setCode") == "A"), sets_data[0] if sets_data else None)
    assert set_a, f"Set A not found in: {sets_data}"
    set_a_id = set_a["id"]
    print(f"  [OK] Set A initialized (DB ID: {set_a_id})")

    # Add question via correct endpoint: POST /api/admin/sets/{set_id}/questions
    q_payload = {
        "questionText": "What is the time complexity of searching an element in a balanced BST?",
        "marks": 10.0,
        "negativeMarks": 0.0,
        "displayOrder": 1,
        "options": [
            {"optionText": "O(log N)", "isCorrect": True, "displayOrder": 1},
            {"optionText": "O(N)", "isCorrect": False, "displayOrder": 2},
            {"optionText": "O(1)", "isCorrect": False, "displayOrder": 3},
            {"optionText": "O(N log N)", "isCorrect": False, "displayOrder": 4}
        ]
    }
    q_res = session.post(f"{BASE_URL}/api/admin/sets/{set_a_id}/questions", json=q_payload)
    assert q_res.status_code in (200, 201), f"Add question failed: {q_res.text}"
    print("  [OK] Added MCQ question with 4 options to Set A")

    # Publish Exam
    pub_res = session.post(f"{BASE_URL}/api/admin/exams/{exam_id}/publish")
    assert pub_res.status_code == 200, f"Publish failed: {pub_res.text}"
    print(f"  [OK] Published MCQ Exam: ID {exam_id}\n")

    # ---------------------------------------------------------
    # 6. Candidate Verification & Strict 3-Use Limit Enforcement
    # ---------------------------------------------------------
    print("[TEST 6/8] Candidate Verification & Strict 3-Use Limit Enforcement...")

    # Generate a dedicated fresh access code starting at 0 uses for clean limit testing
    limit_code_res = session.post(
        f"{BASE_URL}/api/admin/candidates/{cand_id}/generate-access-code?round=ROUND_1"
    )
    assert limit_code_res.status_code == 200, f"Limit code gen failed: {limit_code_res.text}"
    limit_code_data = limit_code_res.json()
    limit_code = limit_code_data["code"]
    assert limit_code_data["maxUses"] == 3
    assert limit_code_data["usageCount"] == 0
    print(f"  [OK] Fresh access code for 3-use limit test: {limit_code} (0/3 uses, maxUses=3)")

    # 1st Use — must succeed, eligible=True
    v1 = requests.post(f"{BASE_URL}/api/candidate/verify", json={
        "registrationNumber": cand_reg,
        "accessCode": limit_code,
        "uniqueId": limit_code,
        "fullName": cand["fullName"],
        "departmentId": dev_dept["id"],
        "departmentName": dev_dept["name"]
    })
    assert v1.status_code == 200, f"1st verify failed: {v1.text}"
    assert v1.json().get("eligible") is True
    print(f"  [OK] 1st Verification: ALLOWED (eligible=True, 1/3 uses consumed)")

    # 2nd Use — must succeed
    v2 = requests.post(f"{BASE_URL}/api/candidate/verify", json={
        "registrationNumber": cand_reg,
        "accessCode": limit_code,
        "uniqueId": limit_code,
        "fullName": cand["fullName"],
        "departmentId": dev_dept["id"],
        "departmentName": dev_dept["name"]
    })
    assert v2.status_code == 200, f"2nd verify failed: {v2.text}"
    assert v2.json().get("eligible") is True
    print(f"  [OK] 2nd Verification: ALLOWED (eligible=True, 2/3 uses consumed)")

    # 3rd Use — must succeed
    v3 = requests.post(f"{BASE_URL}/api/candidate/verify", json={
        "registrationNumber": cand_reg,
        "accessCode": limit_code,
        "uniqueId": limit_code,
        "fullName": cand["fullName"],
        "departmentId": dev_dept["id"],
        "departmentName": dev_dept["name"]
    })
    assert v3.status_code == 200, f"3rd verify failed: {v3.text}"
    assert v3.json().get("eligible") is True
    print(f"  [OK] 3rd Verification: ALLOWED (eligible=True, 3/3 uses consumed)")

    # 4th Use: MUST BE REJECTED WITH 403 FORBIDDEN — limit exhausted
    v4 = requests.post(f"{BASE_URL}/api/candidate/verify", json={
        "registrationNumber": cand_reg,
        "accessCode": limit_code,
        "uniqueId": limit_code,
        "fullName": cand["fullName"],
        "departmentId": dev_dept["id"],
        "departmentName": dev_dept["name"]
    })
    assert v4.status_code == 403, (
        f"Expected 403 Forbidden on 4th use, got {v4.status_code}: {v4.text}"
    )
    blocked_detail = v4.json().get("detail") or v4.json().get("message", "blocked")
    print(f"  [OK] 4th Verification: STRICTLY BLOCKED (HTTP 403) - {blocked_detail}")
    print("  [OK] Strict 3-Use Limit successfully enforced at the database level!\n")

    # ---------------------------------------------------------
    # 7. Candidate Exam Attempt, Answers & Submission Flow
    # ---------------------------------------------------------
    print("[TEST 7/8] Candidate Exam Attempt, Answer Saving & Submission Flow...")
    # Generate fresh access code for candidate to perform full attempt
    fresh_code_res = session.post(f"{BASE_URL}/api/admin/candidates/{cand_id}/generate-access-code?round=ROUND_1")
    assert fresh_code_res.status_code == 200
    fresh_code = fresh_code_res.json()["code"]

    # Verify fresh code
    v_fresh = requests.post(f"{BASE_URL}/api/candidate/verify", json={
        "registrationNumber": cand_reg,
        "accessCode": fresh_code,
        "uniqueId": fresh_code,
        "fullName": cand["fullName"],
        "departmentId": dev_dept["id"],
        "departmentName": dev_dept["name"]
    })
    assert v_fresh.status_code == 200, f"Fresh code verify failed: {v_fresh.text}"
    assert v_fresh.json().get("eligible") is True
    print(f"  [OK] Fresh access code {fresh_code} verified")

    # Start or resume attempt
    assigned_exam_id = v_fresh.json().get("assignedExamId") or v_fresh.json().get("examId") or exam_id
    start_res = requests.post(f"{BASE_URL}/api/candidate/start", json={
        "candidateId": cand_id,
        "examId": assigned_exam_id
    })
    assert start_res.status_code == 200, f"Start attempt failed: {start_res.text}"
    start_data = start_res.json()
    attempt_id = start_data["attemptId"]
    questions = start_data.get("questions", [])
    assert len(questions) > 0, f"No questions in start response: {start_data}"
    question = questions[0]
    correct_opt = next(
        (o for o in question["options"] if "O(log N)" in o.get("optionText", "")),
        question["options"][0]
    )
    print(f"  [OK] Attempt started: ID {attempt_id}, Set {start_data.get('setCode', '-')}")

    # Save answer
    ans_res = requests.post(f"{BASE_URL}/api/candidate/answers", json={
        "attemptId": attempt_id,
        "questionId": question["id"],
        "selectedOptionId": correct_opt["id"],
        "candidateId": cand_id
    })
    assert ans_res.status_code == 200
    print(f"  [OK] Answer saved: Option {correct_opt['id']} for Question {question['id']}")

    # Admin publishes exam results so score & qualification status are revealed to the candidate
    pub_res_res = session.post(f"{BASE_URL}/api/admin/results/exam/{assigned_exam_id}/publish", json={"published": True})
    assert pub_res_res.status_code == 200, f"Publish results failed: {pub_res_res.text}"
    print(f"  [OK] Admin published results for Exam ID {assigned_exam_id}")

    # Submit attempt
    sub_res = requests.post(f"{BASE_URL}/api/candidate/submit", json={
        "attemptId": attempt_id,
        "candidateId": cand_id
    })
    assert sub_res.status_code == 200, f"Submit attempt failed: {sub_res.text}"
    sub_data = sub_res.json()
    assert sub_data["success"] is True
    assert sub_data["qualificationStatus"] == "QUALIFIED"
    assert sub_data["score"] == 10.0
    assert "receiptId" in sub_data
    print(f"  [OK] Candidate submitted assessment successfully!")
    print(f"    - Score: {sub_data['score']} / {sub_data['totalMarks']} ({sub_data['percentage']}%)")
    print(f"    - Status: {sub_data['qualificationStatus']}")
    print(f"    - Digital Receipt ID: {sub_data['receiptId']}\n")

    # ---------------------------------------------------------
    # 8. Round 2 Coding Assessment Studio & Sandbox Test Runner
    # ---------------------------------------------------------
    print("[TEST 8/8] Round 2 Coding Assessment Studio & Candidate Test Runner...")
    coding_exam_payload = {
        "title": f"Algorithm Problem Solving Challenge {int(time.time())}",
        "description": "Assess candidate algorithms and code quality",
        "instructions": "Implement optimal algorithms adhering to constraints.",
        "durationMinutes": 60,
        "timingMode": "DURATION_FROM_START",
        "selectedDepartments": ["Developer", "QA / Tester"],
        "allowedLanguages": ["python3", "javascript"],
        "evaluationMode": "PARTIAL_PER_TESTCASE",
        "qualificationPercentage": 60.0,
        "totalMarks": 20.0,
        "status": "DRAFT",
        "questions": [
            {
                "id": f"code-q-e2e-{int(time.time())}",
                "title": "Array Element Reversal",
                "problemStatement": "Given N integers, reverse the array in-place and print space-separated elements.",
                "difficulty": "Easy",
                "maxMarks": 20,
                "inputFormat": "First line N, second line space-separated integers",
                "outputFormat": "Reversed space-separated integers",
                "sampleInput": "4\n1 2 3 4",
                "sampleOutput": "4 3 2 1",
                "allowedLanguages": ["python3", "javascript"],
                "testCases": [
                    {
                        "id": f"tc-e2e-1-{int(time.time())}",
                        "label": "Sample Public Case",
                        "input": "4\n1 2 3 4",
                        "expectedOutput": "4 3 2 1",
                        "isHidden": False,
                        "marks": 10.0,
                        "explanation": "Standard 4 elements"
                    },
                    {
                        "id": f"tc-e2e-2-{int(time.time())}",
                        "label": "Hidden Evaluation Case",
                        "input": "5\n10 20 30 40 50",
                        "expectedOutput": "50 40 30 20 10",
                        "isHidden": True,
                        "marks": 10.0,
                        "explanation": "5 elements boundary"
                    }
                ]
            }
        ]
    }
    coding_create_res = session.post(f"{BASE_URL}/api/admin/exams/coding", json=coding_exam_payload)
    assert coding_create_res.status_code in (200, 201), f"Coding exam creation failed: {coding_create_res.text}"
    coding_exam = coding_create_res.json()
    coding_exam_id = coding_exam["id"]
    print(f"  [OK] Created Coding Assessment: '{coding_exam['title']}' (ID: {coding_exam_id})")

    # Publish coding assessment
    pub_code_res = session.post(f"{BASE_URL}/api/admin/exams/coding/{coding_exam_id}/publish")
    assert pub_code_res.status_code == 200
    print(f"  [OK] Published Coding Assessment: ID {coding_exam_id}")

    # Candidate Sandbox Code Execution (Direct Run)
    py_solution = (
        "import sys\n"
        "lines = sys.stdin.read().split()\n"
        "if lines:\n"
        "    n = int(lines[0])\n"
        "    arr = lines[1:]\n"
        "    print(' '.join(reversed(arr)))\n"
    )
    run_code_res = requests.post(f"{BASE_URL}/api/candidate/coding/run", json={
        "language": "python3",
        "code": py_solution,
        "input": "4\n1 2 3 4"
    })
    assert run_code_res.status_code == 200, f"Run code failed: {run_code_res.text}"
    run_out = run_code_res.json()
    assert run_out["status"] == "SUCCESS"
    assert run_out["output"].strip() == "4 3 2 1"
    print(f"  [OK] Candidate Sandbox Runner (Python 3): Output='{run_out['output'].strip()}' in {run_out['executionTimeMs']}ms")

    # Candidate Coding Submission (Automated Grading across hidden & public cases)
    submit_code_res = requests.post(f"{BASE_URL}/api/candidate/coding/submit", json={
        "examId": coding_exam_id,
        "questionId": coding_exam["questions"][0]["id"],
        "candidateId": cand_id,
        "language": "python3",
        "code": py_solution
    })
    assert submit_code_res.status_code == 200, f"Submit code failed: {submit_code_res.text}"
    submit_eval = submit_code_res.json()
    assert submit_eval["success"] is True
    assert submit_eval["status"] == "PASSED"
    assert submit_eval["passedCount"] == 2
    assert submit_eval["totalCount"] == 2
    assert submit_eval["score"] == 20.0
    print(f"  [OK] Automated Coding Evaluation: Passed {submit_eval['passedCount']}/{submit_eval['totalCount']} test cases")
    print(f"    - Score Awarded: {submit_eval['score']} / {submit_eval['maxMarks']}")
    print(f"    - Status: {submit_eval['status']}")
    print(f"    - Public & Hidden Test Cases verified and evaluated.")

    print("\n========================================================")
    print("  ALL 8/8 END-TO-END SYSTEM INTEGRATION TESTS PASSED!  ")
    print("========================================================\n")

if __name__ == "__main__":
    test_complete_e2e_live_system()
