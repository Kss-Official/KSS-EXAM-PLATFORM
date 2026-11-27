import asyncio
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.coding.rate_limiter import CodingRedisGuard
from app.coding.router import _normalize_and_validate_input
from app.candidate.services.code_runner_service import CodeRunnerService
from fastapi import HTTPException

client = TestClient(app)


class FakeAsyncRedisPipeline:
    def __init__(self, store: dict):
        self.store = store
        self.ops = []

    def incr(self, key: str):
        self.ops.append(("incr", key))
        return self

    def expire(self, key: str, ttl: int):
        self.ops.append(("expire", key, ttl))
        return self

    async def execute(self):
        results = []
        for op in self.ops:
            if op[0] == "incr":
                k = op[1]
                self.store[k] = int(self.store.get(k, 0)) + 1
                results.append(self.store[k])
            elif op[0] == "expire":
                results.append(True)
        return results


class FakeAsyncRedis:
    def __init__(self):
        self.store = {}

    def pipeline(self):
        return FakeAsyncRedisPipeline(self.store)

    async def decr(self, key: str):
        self.store[key] = int(self.store.get(key, 0)) - 1
        return self.store[key]

    async def set(self, key: str, val, ex=None):
        self.store[key] = val


def test_unsafe_local_code_runner_is_blocked():
    with pytest.raises(RuntimeError, match="UNSAFE, DO NOT USE"):
        CodeRunnerService._execute_code("python3", "print(1)", "")


def test_coding_routes_return_503_when_flag_disabled(monkeypatch):
    monkeypatch.setattr(settings, "CODING_ROUND_ENABLED", False)
    res = client.get("/api/coding/problems/q1")
    assert res.status_code == 503


def test_input_validation_language_and_size_limits():
    with pytest.raises(HTTPException) as exc_lang:
        _normalize_and_validate_input("ruby", "puts 1", None, ["python3"])
    assert exc_lang.value.status_code == 400

    with pytest.raises(HTTPException) as exc_empty:
        _normalize_and_validate_input("python3", "   ", None, ["python3"])
    assert exc_empty.value.status_code == 400

    huge_code = "a = 1\n" * 20000
    with pytest.raises(HTTPException) as exc_code:
        _normalize_and_validate_input("python3", huge_code, None, ["python3"])
    assert exc_code.value.status_code == 413

    huge_input = "x" * (settings.CODING_MAX_INPUT_BYTES + 10)
    with pytest.raises(HTTPException) as exc_in:
        _normalize_and_validate_input("python3", "print(1)", huge_input, ["python3"])
    assert exc_in.value.status_code == 413


def test_redis_guard_rate_limit_concurrency_and_queue_depth():
    async def _run():
        redis = FakeAsyncRedis()
        guard = CodingRedisGuard(redis)

        # 1. Queue depth exceeded -> reject with Retry-After
        ok, retry, _ = await guard.check_and_acquire(user_id=1, queue_depth=5000, max_queue_depth=5000)
        assert not ok and retry > 0

        # 2. Concurrency cap (max 2)
        ok1, _, _ = await guard.check_and_acquire(user_id=2, queue_depth=0, rate_per_min=10, max_concurrent=2)
        ok2, _, _ = await guard.check_and_acquire(user_id=2, queue_depth=0, rate_per_min=10, max_concurrent=2)
        ok3, retry3, _ = await guard.check_and_acquire(user_id=2, queue_depth=0, rate_per_min=10, max_concurrent=2)
        assert ok1 and ok2 and not ok3 and retry3 > 0

        await guard.release_concurrency(2)
        await guard.release_concurrency(2)

        # 3. Per-minute rate limit (max 3)
        ok_a, _, _ = await guard.check_and_acquire(user_id=3, queue_depth=0, rate_per_min=2, max_concurrent=5)
        ok_b, _, _ = await guard.check_and_acquire(user_id=3, queue_depth=0, rate_per_min=2, max_concurrent=5)
        ok_c, retry_c, _ = await guard.check_and_acquire(user_id=3, queue_depth=0, rate_per_min=2, max_concurrent=5)
        assert ok_a and ok_b and not ok_c and retry_c >= 1

    asyncio.run(_run())


def test_executor_guard_refuses_demo_and_production_without_judge0():
    from app.core.config import Settings, validate_security_settings

    for env_name in ("demo", "production"):
        bad_mock = Settings(
            ENVIRONMENT=env_name,
            DEBUG=False,
            SECRET_KEY="x" * 40,
            ADMIN_BOOTSTRAP_PASSWORD="StrongPassword!2026",
            CORS_ORIGINS=["https://demo.example.com"],
            CODING_ROUND_ENABLED=True,
            CODING_SANDBOX_DRIVER="mock",
            LOCAL_DEMO_SANDBOX=False,
        )
        with pytest.raises(RuntimeError, match="non-Judge0"):
            validate_security_settings(bad_mock)

        bad_local = Settings(
            ENVIRONMENT=env_name,
            DEBUG=False,
            SECRET_KEY="x" * 40,
            ADMIN_BOOTSTRAP_PASSWORD="StrongPassword!2026",
            CORS_ORIGINS=["https://demo.example.com"],
            CODING_ROUND_ENABLED=True,
            CODING_SANDBOX_DRIVER="local_python",
            LOCAL_DEMO_SANDBOX=True,
        )
        with pytest.raises(RuntimeError, match="non-Judge0"):
            validate_security_settings(bad_local)


def test_coding_health_reports_executor_and_judge0_reachability(monkeypatch):
    from fastapi.testclient import TestClient
    from app.main import app

    monkeypatch.setattr(settings, "CODING_ROUND_ENABLED", True)
    monkeypatch.setattr(settings, "CODING_SANDBOX_DRIVER", "mock")
    with TestClient(app) as client:
        res = client.get("/api/coding/health")
        assert res.status_code == 200
        data = res.json()
        assert data["executor"] == "mock"
        assert data["judge0Reachable"] is False


def test_parse_testcases_file_json_and_csv():
    from app.coding.import_service import parse_testcases_file

    json_bytes = (
        b'[{"questionIndex": 1, "label": "Sample 1", "input": "3 5", "expectedOutput": "8", "isHidden": false, "marks": 5},'
        b'{"questionIndex": 1, "label": "Hidden 1", "input": "10 20", "expectedOutput": "30", "isHidden": true, "marks": 15}]'
    )
    by_q, warns = parse_testcases_file("cases.json", json_bytes)
    assert not warns
    assert len(by_q[1]) == 2
    assert by_q[1][1]["isHidden"] is True
    assert by_q[1][1]["marks"] == 15.0

    csv_bytes = b"questionIndex,label,input,expectedOutput,isHidden,marks\n2,Sample 1,hello,olleh,false,5\n"
    by_q_csv, warns_csv = parse_testcases_file("cases.csv", csv_bytes)
    assert not warns_csv
    assert by_q_csv[2][0]["expectedOutput"] == "olleh"
