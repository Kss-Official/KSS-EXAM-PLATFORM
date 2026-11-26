import asyncio
import pytest
from app.coding.judge0_client import MockSandboxExecutor


@pytest.mark.parametrize(
    "malicious_code,expected_verdict",
    [
        ("while True:\n    pass", "TIME_LIMIT_EXCEEDED"),
        ("import os\nos.fork()", "RUNTIME_ERROR"),
        (":(){ :|:& };:", "RUNTIME_ERROR"),
        ("# MOCK_HUGE_OUTPUT\nwhile True:\n    print('A' * 1000000)", "RUNTIME_ERROR"),
        ("x = bytearray(10**10)", "MEMORY_LIMIT_EXCEEDED"),
        ("open('/etc/passwd').read()", "RUNTIME_ERROR"),
        ("import socket\nsocket.socket()", "RUNTIME_ERROR"),
    ],
)
def test_malicious_payloads_fail_safely_in_sandbox(malicious_code, expected_verdict):
    async def _run():
        executor = MockSandboxExecutor()
        res = await executor.execute(
            language="python3",
            source_code=malicious_code,
            stdin="",
            expected_output="ok",
            cpu_time_limit_s=1.0,
            wall_time_limit_s=2.0,
            memory_limit_kb=65536,
        )
        assert res.verdict == expected_verdict
        assert res.verdict != "ACCEPTED"

    asyncio.run(_run())
