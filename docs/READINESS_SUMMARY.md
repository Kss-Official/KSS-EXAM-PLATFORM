# Round 2 Coding Platform — Readiness Summary

**Branch:** `feat/round2-coding-platform`  
**Status:** Ready for VM + Judge0 staging deployment; **not yet verified against live Judge0 CE**.

---

## Verified (with Local Tests / Code Checks)
- **Executor Startup Guard:** `ENVIRONMENT=demo` or `production` with `CODING_ROUND_ENABLED=true` refuses to start if `CODING_SANDBOX_DRIVER != "judge0"` or `LOCAL_DEMO_SANDBOX=true` (`test_executor_guard_refuses_demo_and_production_without_judge0`).
- **Health Endpoint:** `GET /api/coding/health` returns `executor` (`"mock"`, `"local_demo"`, or `"judge0"`) and `judge0Reachable` (`test_coding_health_reports_executor_and_judge0_reachability`).
- **Non-Real Executor Guardrails:** `MockSandboxExecutor` refuses `java`, `cpp`, `c++`, `c` with an explicit `INTERNAL_ERROR` message (`test_mock_executor_refuses_java_and_cpp_explicitly`); UI shows non-production banner (`MOCK EXECUTOR: results are not real` / `LOCAL DEMO EXECUTOR`) and displays `language` + `executor` on the result card.
- **Per-Language Tab Drafts:** Switching languages flushes unsaved edits immediately to `localStorage` and local draft state; `Run` / `Submit` send the active `language`.
- **Crash, Timer, Finalization & Retention:**
  - Draft save & restore across refresh (`test_server_drafts_save_restore_and_timer_grace_window`)
  - Disconnected candidate auto-finalize on expiry (`test_disconnected_candidate_draft_auto_submitted_on_expiry`)
  - Concurrent finalizer safety (`test_concurrent_finalization_produces_single_submission`)
  - Result row committed before source code purge (`test_idempotent_finalize_and_retention_ordering`)
- **Hidden Test Privacy:** Verified across REST, SSE, WebSocket, and candidate/admin result endpoints (`test_hidden_data_never_leaked_in_rest_sse_or_websocket`, `test_candidate_result_release_privacy_and_admin_pagination`).
- **Frontend TypeScript:** `npx tsc --noEmit` exited `0`.

## Not Verified (Requires Live Judge0 CE on VM)
- **E2E Verification Matrix (`backend/tests/e2e_matrix/MATRIX_REPORT.md`):** `0 PASS`, `0 FAIL`, **`88 not run`** (4 languages × 3 demo questions × 7 outcomes + 4 brute-force Hard cases) — Judge0 was unavailable on this host (`docker` not installed).
- **Live Judge0 Security (`backend/tests/test_judge0_security_live.py`):** **6 skipped** (fork bomb Python/C, env var read, outbound network call, host file write, `/proc/1/environ` read, and parallel benign session isolation) — Judge0 unavailable.
- **Load / Burst & Soak Tests:**

| Metric | Target | Measured | Status |
|---|---|---|---|
| Concurrent submissions burst (p95 latency) | — | — | Not run |
| Sustained soak test (error rate / queue lag) | — | — | Not run |
| Judge0 worker throughput (jobs/min) | — | — | Not run |

---

## Next Action Before Admin Demo
1. Provision VM with Docker + Judge0 CE using `docs/DEMO_DEPLOY.md`.
2. Run `python backend/scripts/demo_preflight.py` (all checks must print `PASS`).
3. Run `python backend/tests/e2e_matrix/run_matrix.py` and `pytest backend/tests/test_judge0_security_live.py -v` against live Judge0.
4. Execute burst & soak load tests and fill in the table above.
