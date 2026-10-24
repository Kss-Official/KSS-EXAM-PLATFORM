import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core import SessionLocal, init_super_admin, init_default_departments
from app.models import AppUser, Department, Exam, QuestionSet, Question, Candidate, CandidateAccessCode, CodingExam

client = TestClient(app)

ADMIN_EMAIL = "d.koushik@kalpanaaasoftwaresolutions.in"
ADMIN_PASSWORD = "Admin@ExamSecure2026!"

@pytest.fixture(scope="module")
def admin_token():
    """Logs in as super admin and yields the bearer token."""
    db = SessionLocal()
    init_super_admin(db)
    init_default_departments(db)
    db.close()

    resp = client.post("/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    token = resp.json().get("token")
    assert token, "Token not returned in auth response"
    return token

def test_admin_me_and_session(admin_token):
    """Verifies that the /api/auth/me endpoint authenticates the Super Admin."""
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == ADMIN_EMAIL.lower()
    assert data["role"] == "SUPER_ADMIN"
    assert "id" in data

def test_admin_dashboard_telemetry(admin_token):
    """Verifies that /api/admin/dashboard returns valid live metrics."""
    resp = client.get("/api/admin/dashboard", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "UP"
    assert data["totalExams"] >= 1
    assert data["totalDepartments"] >= 10
    assert data["totalCandidates"] >= 1
    assert "submittedAttempts" in data
    assert "qualifiedCandidates" in data

def test_admin_audit_logs(admin_token):
    """Verifies /api/admin/audit-logs with pagination and filters."""
    resp = client.get("/api/admin/audit-logs?page=1&pageSize=10", headers={"Authorization": f"Bearer {admin_token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "pageSize" in data
    assert "totalPages" in data
    assert data["page"] == 1
    assert len(data["items"]) <= 10
    assert data["total"] > 0

    # Search filter test
    search_resp = client.get("/api/admin/audit-logs?search=EXAM", headers={"Authorization": f"Bearer {admin_token}"})
    assert search_resp.status_code == 200
    assert "items" in search_resp.json()

def test_admin_departments_workflow(admin_token):
    """Verifies department CRUD lifecycle."""
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. List departments
    list_resp = client.get("/api/admin/departments", headers=headers)
    assert list_resp.status_code == 200
    depts = list_resp.json()
    assert len(depts) >= 10

    # 2. Create custom department
    create_resp = client.post("/api/admin/departments", headers=headers, json={
        "name": "Artificial Intelligence & Data Science",
        "code": "AIDS_TEST",
        "description": "Department dedicated to Machine Learning & Neural Networks",
        "active": True
    })
    assert create_resp.status_code == 200
    created = create_resp.json()
    dept_id = created["id"]
    assert created["code"] == "AIDS_TEST"

    # 3. Read by ID
    get_resp = client.get(f"/api/admin/departments/{dept_id}", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["name"] == "Artificial Intelligence & Data Science"

    # 4. Update
    update_resp = client.put(f"/api/admin/departments/{dept_id}", headers=headers, json={
        "name": "AI & Data Science (Updated)",
        "code": "AIDS_TEST",
        "description": "Updated description",
        "active": False
    })
    assert update_resp.status_code == 200
    assert update_resp.json()["name"] == "AI & Data Science (Updated)"
    assert update_resp.json()["active"] is False

    # 5. Delete
    del_resp = client.delete(f"/api/admin/departments/{dept_id}", headers=headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["success"] is True

def test_admin_mcq_exam_lifecycle(admin_token):
    """Verifies MCQ exam creation, sets initialization, publish, close, and deletion."""
    headers = {"Authorization": f"Bearer {admin_token}"}

    # 1. Create MCQ Exam
    exam_payload = {
        "title": "Automated Admin Panel Test Exam 2026",
        "description": "Testing full admin workflow lifecycle",
        "durationMinutes": 45,
        "totalQuestions": 10,
        "status": "DRAFT",
        "qualificationMode": "PERCENTAGE",
        "qualificationThreshold": 50.0,
        "timingMode": "DURATION_FROM_START",
        "totalMarks": 10.0,
        "marksPerQuestion": 1.0,
        "negativeMarks": 0.0,
        "departmentIds": [1]
    }
    create_resp = client.post("/api/admin/exams", headers=headers, json=exam_payload)
    assert create_resp.status_code == 200
    exam = create_resp.json()
    exam_id = exam["id"]
    assert exam["title"] == "Automated Admin Panel Test Exam 2026"
    assert exam["status"] == "DRAFT"

    # 2. Check sets initialized (Sets A, B, C, D)
    sets_resp = client.get(f"/api/admin/exams/{exam_id}/departments/1/sets", headers=headers)
    assert sets_resp.status_code == 200
    sets = sets_resp.json()
    assert len(sets) == 4
    set_codes = [s["setCode"] for s in sets]
    assert set_codes == ["A", "B", "C", "D"]
    set_a_id = sets[0]["id"]

    # 3. Add a question to Set A
    q_payload = {
        "questionText": "What is the time complexity of binary search on a sorted array?",
        "marks": 1.0,
        "negativeMarks": 0.0,
        "options": [
            {"optionText": "O(N)", "correct": False},
            {"optionText": "O(log N)", "correct": True},
            {"optionText": "O(N log N)", "correct": False},
            {"optionText": "O(1)", "correct": False}
        ]
    }
    q_resp = client.post(f"/api/admin/sets/{set_a_id}/questions", headers=headers, json=q_payload)
    assert q_resp.status_code == 200
    q_data = q_resp.json()
    assert len(q_data["options"]) == 4

    # 4. Import questions via raw text
    text_import_payload = {
        "rawText": (
            "1. Which data structure uses LIFO order?\n"
            "A) Queue\n"
            "B) Stack\n"
            "C) Linked List\n"
            "D) Array\n"
        )
    }
    import_resp = client.post(f"/api/admin/sets/{set_a_id}/import", headers=headers, json=text_import_payload)
    assert import_resp.status_code == 200
    imported = import_resp.json()
    assert len(imported) >= 1

    # 5. Apply Answer Key to Set A
    key_resp = client.post(f"/api/admin/sets/{set_a_id}/answer-key", headers=headers, json={
        "answerKeyText": "1. B\n2. B"
    })
    assert key_resp.status_code == 200

    # 6. Publish Exam
    pub_resp = client.post(f"/api/admin/exams/{exam_id}/publish", headers=headers)
    assert pub_resp.status_code == 200
    assert pub_resp.json()["status"] == "PUBLISHED"

    # 7. Close Exam
    close_resp = client.post(f"/api/admin/exams/{exam_id}/close", headers=headers)
    assert close_resp.status_code == 200
    assert close_resp.json()["status"] == "COMPLETED"

    # 8. Delete Exam with force=True
    del_resp = client.delete(f"/api/admin/exams/{exam_id}?force=true", headers=headers)
    assert del_resp.status_code == 200
    assert del_resp.json()["success"] is True

def test_admin_candidate_and_round_ids(admin_token):
    """Verifies candidate creation, 3-use Round 1 & Round 2 unique ID generation."""
    headers = {"Authorization": f"Bearer {admin_token}"}

    import time
    reg_num = f"ADM_TEST_{int(time.time())}"
    # 1. Create candidate
    cand_payload = {
        "registrationNumber": reg_num,
        "fullName": "Admin Workflow Test Candidate",
        "email": f"{reg_num.lower()}@example.com",
        "departmentId": 1
    }
    create_resp = client.post("/api/admin/candidates", headers=headers, json=cand_payload)
    assert create_resp.status_code == 200
    cand = create_resp.json()
    cand_id = cand["id"]
    assert cand["registrationNumber"] == reg_num

    # 2. Generate Round 1 Unique Access ID (strictly 3 uses)
    r1_resp = client.post(f"/api/admin/candidates/{cand_id}/generate-access-code?round=ROUND_1", headers=headers)
    assert r1_resp.status_code == 200
    r1_data = r1_resp.json()
    assert r1_data["code"].startswith("MCQ-")
    assert r1_data["maxUses"] == 3
    assert r1_data["usageCount"] == 0

    # 3. Generate Round 2 Unique Access ID (independent 3 uses)
    r2_resp = client.post(f"/api/admin/candidates/{cand_id}/generate-access-code?round=ROUND_2", headers=headers)
    assert r2_resp.status_code == 200
    r2_data = r2_resp.json()
    assert r2_data["code"].startswith("CODE-")
    assert r2_data["maxUses"] == 3
    assert r2_data["usageCount"] == 0
    assert r2_data["code"] != r1_data["code"]

    # 4. Batch round IDs query
    r1_map_resp = client.get("/api/admin/candidates/round-ids?round=ROUND_1", headers=headers)
    assert r1_map_resp.status_code == 200
    r1_map = r1_map_resp.json()
    assert reg_num in r1_map
    assert r1_map[reg_num] == r1_data["code"]

def test_admin_results_and_publishing_toggle(admin_token):
    """Verifies results querying and result publication status toggling."""
    headers = {"Authorization": f"Bearer {admin_token}"}

    # Query all results
    res_resp = client.get("/api/admin/results", headers=headers)
    assert res_resp.status_code == 200
    results = res_resp.json()
    assert isinstance(results, list)

    # Publish results for Exam 17
    pub_resp = client.post("/api/admin/results/exam/17/publish", headers=headers, json={"published": True})
    assert pub_resp.status_code == 200
    assert pub_resp.json()["resultsPublished"] is True

    # Unpublish results
    unpub_resp = client.post("/api/admin/results/exam/17/publish", headers=headers, json={"published": False})
    assert unpub_resp.status_code == 200
    assert unpub_resp.json()["resultsPublished"] is False
