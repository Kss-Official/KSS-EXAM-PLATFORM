"""
Live Judge0 CE security tests (Phase 12 item 2).

Runs ONLY against a reachable real Judge0 instance.
If Judge0 is unavailable, every test is marked skipped (never faked with MockSandboxExecutor).
"""
from __future__ import annotations

import asyncio
import pytest

from app.coding.judge0_client import Judge0SandboxExecutor


def _require_live_judge0() -> Judge0SandboxExecutor:
    executor = Judge0SandboxExecutor()
    if not asyncio.run(executor.is_reachable()):
        pytest.skip(f"Real Judge0 unavailable at {executor.base_url}; live security checks not run.")
    return executor


@pytest.mark.parametrize(
    "label,lang,code",
    [
        ("fork_bomb_py", "python3", "import os\nwhile True:\n    os.fork()\n"),
        ("fork_bomb_c", "c", "#include <unistd.h>\nint main(){ while(1) fork(); }\n"),
        ("env_var_read", "python3", "import os\nprint(os.environ.get('DATABASE_URL', '') + os.environ.get('SECRET_KEY', ''))\n"),
        ("network_call", "python3", "import urllib.request\nprint(urllib.request.urlopen('https://example.com', timeout=2).status)\n"),
        ("file_write_outside_sandbox", "python3", "open('/etc/examsecure_pwn', 'w').write('x')\n"),
        ("proc_read", "python3", "print(open('/proc/1/environ').read())\n"),
    ],
)
def test_judge0_sandbox_blocks_malicious_payload_and_keeps_parallel_session_clean(label: str, lang: str, code: str):
    executor = _require_live_judge0()

    async def _run_both():
        malicious_task = executor.execute(
            language=lang,
            source_code=code,
            stdin="",
            expected_output="ok",
            cpu_time_limit_s=2.0,
            wall_time_limit_s=4.0,
            memory_limit_kb=131072,
        )
        benign_task = executor.execute(
            language="python3",
            source_code="import sys\na, b = map(int, sys.stdin.read().split())\nprint(a + b)\n",
            stdin="3 5",
            expected_output="8",
            cpu_time_limit_s=2.0,
            wall_time_limit_s=4.0,
            memory_limit_kb=131072,
        )
        return await asyncio.gather(malicious_task, benign_task)

    mal_res, benign_res = asyncio.run(_run_both())
    assert mal_res.verdict != "ACCEPTED", f"{label} unexpectedly succeeded: {mal_res}"
    assert "postgres" not in (mal_res.stdout or "").lower()
    assert benign_res.verdict == "ACCEPTED"
    assert (benign_res.stdout or "").strip() == "8"
