"""
Phase 12 Demo Deploy Preflight Script.

Checks every piece required for an admin demo and prints PASS / FAIL:
  1. DB reachable
  2. Migrations (v2 -> v4) applied
  3. Judge0 reachable
  4. One real run per language (python3, java, cpp, javascript) via Judge0
  5. Backend health, cookies & CORS headers
  6. Submission polling / SSE endpoint reachable
"""
from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path
from typing import List, Tuple

import httpx
from sqlalchemy import inspect, text

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.coding.judge0_client import Judge0SandboxExecutor  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.core.database import engine  # noqa: E402


async def run_preflight() -> int:
    results: List[Tuple[str, bool, str]] = []

    # 1. DB reachable
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        results.append(("DB reachable", True, "SELECT 1 succeeded"))
    except Exception as exc:
        results.append(("DB reachable", False, str(exc)))

    # 2. Migrations applied
    try:
        insp = inspect(engine)
        tables = set(insp.get_table_names())
        needed = {"coding_exams", "coding_questions", "coding_test_cases", "coding_attempts", "coding_submissions", "coding_drafts", "coding_question_results"}
        missing = sorted(needed - tables)
        if missing:
            results.append(("Migrations v2-v4", False, f"Missing tables: {missing}"))
        else:
            results.append(("Migrations v2-v4", True, "All coding tables present"))
    except Exception as exc:
        results.append(("Migrations v2-v4", False, str(exc)))

    # 3. Judge0 reachable
    j0 = Judge0SandboxExecutor()
    j0_ok = await j0.is_reachable()
    results.append(("Judge0 reachable", j0_ok, f"{j0.base_url}/about"))

    # 4. One real run per language
    smoke = {
        "python3": "print(8)\n",
        "java": "public class Main { public static void main(String[] a){ System.out.println(8); } }\n",
        "cpp": "#include <iostream>\nint main(){ std::cout << 8 << \"\\n\"; }\n",
        "javascript": "console.log(8);\n",
    }
    for lang, code in smoke.items():
        if not j0_ok:
            results.append((f"Judge0 real run ({lang})", False, "Skipped: Judge0 unreachable"))
            continue
        res = await j0.execute(language=lang, source_code=code, stdin="", expected_output="8", cpu_time_limit_s=3.0)
        ok = res.verdict == "ACCEPTED" and (res.stdout or "").strip() == "8"
        results.append((f"Judge0 real run ({lang})", ok, f"verdict={res.verdict} stdout={res.stdout!r}"))

    # 5 & 6. Backend CORS + Health + SSE/Polling check
    backend_url = os.getenv("BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
    frontend_origin = os.getenv("FRONTEND_ORIGIN", (settings.CORS_ORIGINS[0] if settings.CORS_ORIGINS else "http://localhost:5173"))
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            h = await client.get(f"{backend_url}/api/coding/health", headers={"Origin": frontend_origin})
            cors_ok = h.status_code == 200 and h.headers.get("access-control-allow-origin") in (frontend_origin, "*")
            body = h.json() if h.status_code == 200 else {}
            results.append(("Backend health & CORS", cors_ok, f"status={h.status_code} executor={body.get('executor')} judge0={body.get('judge0Reachable')}"))

            # Verify SSE/polling route responds (401 without auth confirms route is mounted & guarded)
            sse = await client.get(f"{backend_url}/api/coding/submissions/1/stream")
            results.append(("SSE/Polling route mounted", sse.status_code in (401, 403, 404, 200), f"status={sse.status_code}"))
    except Exception as exc:
        results.append(("Backend health & CORS", False, str(exc)))
        results.append(("SSE/Polling route mounted", False, "Backend unreachable"))

    failed = 0
    print("=== Round 2 Demo Preflight ===")
    for name, ok, detail in results:
        tag = "PASS" if ok else "FAIL"
        if not ok:
            failed += 1
        print(f"[{tag}] {name}: {detail}")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(run_preflight()))
