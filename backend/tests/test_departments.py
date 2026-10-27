import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core import settings

client = TestClient(app)

def test_department_endpoints_with_auth():
    # Login as admin
    login_res = client.post("/api/auth/login", json={
        "email": settings.ADMIN_BOOTSTRAP_EMAIL,
        "password": settings.ADMIN_BOOTSTRAP_PASSWORD
    })
    assert login_res.status_code == 200
    client.cookies.set("JSESSIONID", login_res.cookies["JSESSIONID"])

    # Fetch departments
    res = client.get("/api/admin/departments")
    assert res.status_code == 200
    depts = res.json()
    assert isinstance(depts, list)

    # Fetch active departments
    res_active = client.get("/api/admin/departments/active")
    assert res_active.status_code == 200
    assert isinstance(res_active.json(), list)

    # Fetch colleges
    res_colleges = client.get("/api/admin/departments/colleges")
    assert res_colleges.status_code == 200
    assert isinstance(res_colleges.json(), list)

    client.cookies.clear()
