# Round 2: Coding Round — Setup, Scaling & Exam-Day Runbook

## 1. Architecture Summary
- **Frontend (`Frontend/`)**: Lazy-loaded `CodingRoundPage` (`@monaco-editor/react`), gated by `VITE_CODING_ROUND_ENABLED=true`. Zero impact on Round 1 bundles.
- **API (`backend/app/coding/`)**: Stateless FastAPI endpoints (`/api/coding/*`) behind Nginx (`nginx/conf.d/exam_portal.conf`), gated by `CODING_ROUND_ENABLED=true`. Never executes code.
- **Queue & Backpressure**: Redis + ARQ (`backend/worker/coding_worker.py`). All rate limits, concurrency caps, and queue depth checks live in Redis (`CodingRedisGuard`) so multiple Uvicorn workers share state.
- **Sandbox**: Self-hosted **Judge0 CE `v1.13.1`** (`isolate` cgroup sandbox) in `docker-compose.coding.yml` on an isolated `sandbox_net` (`internal: true`, zero internet or DB access). Local dev/tests use `CODING_SANDBOX_DRIVER=mock`.

---

## 2. Environment Variables

### Backend (`backend/.env`)
```env
CODING_ROUND_ENABLED=true
CODING_REQUIRE_ROUND1_QUALIFIED=true
CODING_SANDBOX_DRIVER=judge0          # "mock" locally, "judge0" in staging/prod
REDIS_URL=redis://127.0.0.1:6379/0
JUDGE0_URL=http://127.0.0.1:2358
JUDGE0_AUTH_TOKEN=                    # Set strong token in production
CODING_MAX_CODE_BYTES=65536
CODING_MAX_INPUT_BYTES=65536
CODING_MAX_QUEUE_DEPTH=5000
CODING_USER_RATE_LIMIT_PER_MIN=12
CODING_USER_MAX_CONCURRENT=2
CODING_JOB_TIMEOUT_SECONDS=30
```

### Frontend (`Frontend/.env`)
```env
VITE_CODING_ROUND_ENABLED=true
```

---

## 3. Host OS Requirements for Judge0 CE (`v1.13.1`)
Judge0 CE `v1.13.1` uses `isolate`, which **requires cgroup v1** on the Linux host:
- Recommended OS: **Ubuntu 22.04 LTS** or **Ubuntu 20.04 LTS** with kernel parameter `systemd.unified_cgroup_hierarchy=0` in `/etc/default/grub` (`GRUB_CMDLINE_LINUX="systemd.unified_cgroup_hierarchy=0"` -> `sudo update-grub && sudo reboot`).
- Verify before starting Docker: `stat -fc %T /sys/fs/cgroup/` should report `tmpfs` (cgroup v1), not `cgroup2fs`.
- If the host cannot enable cgroup v1, deploy **Piston** as an HTTP sandbox fallback behind `SandboxExecutor`.

---

## 4. Database Migration & Pool Size Math

### Reversible Migration
```bash
cd backend
python migrations/add_coding_round_v2.py --up
# Rollback if needed:
python migrations/add_coding_round_v2.py --down
```

### DB Connection Pool & Write Load Math (10,000 Users)
- With `8` Uvicorn API workers + `8` ARQ coding workers = `16` Python processes.
- Set `DB_POOL_SIZE=10` and `DB_MAX_OVERFLOW=10` per process -> max `16 * 20 = 320` app connections.
- Always point `DATABASE_URL` to **Neon's PgBouncer pooler** (`-pooler` endpoint) so 320 app connections multiplex cleanly onto `<= 60` physical PostgreSQL connections.
- **Draft Autosave Write Load**: `PUT /api/coding/drafts` performs an atomic `ON CONFLICT (attempt_id, question_id, language) DO UPDATE` upsert (never blind inserts). At `1.5s` debounce with 30–50% of 10,000 users actively typing (pausing every 5–10s), steady-state write load is **~300–1,000 upserts/sec** (worst-case simultaneous pause ~3,333/s), bounded per user by `CODING_DRAFT_RATE_LIMIT_PER_MIN=60` in Redis.

### Finalization Precedence on Timer Expiry
- Explicit `POST /api/coding/submit` calls received before `expires_at + CODING_SUBMIT_GRACE_SECONDS` always count as the candidate's submission.
- When `finalize_expired_coding_attempts` runs (under Redis lock `coding:lock:finalizer`), it promotes a question's latest saved `CodingDraft` (`updated_at <= expires_at + grace`) **only if** no explicit submission exists with `submitted_at >= draft.updated_at`. Post-deadline drafts are never promoted.

### Neon Storage Estimate (10,000 Candidates × N Questions)
With `CODING_CODE_RETENTION=none` (default), `coding_drafts` are deleted on finalization and `coding_submissions.source_code` is nulled (retaining only the 64-byte `code_hash`).

**Formula**:
$$\text{Total Storage} \approx 10{,}000 \times \big(\text{AttemptRow} + N \times \text{ResultRow} + S \times \text{SlimSubmissionRow}\big) \times 1.35\text{ (index overhead)}$$

| Table | Assumed Avg Row + Index Size | 10k × 2 Qs (`N=2, S=4`) | Measured (Staging) |
|---|---|---|---|
| `coding_attempts` | ~220 B | ~2.2 MB | *(pending staging run)* |
| `coding_question_results` | ~380 B | ~7.6 MB | *(pending staging run)* |
| `coding_submissions` (`source_code=NULL`) | ~320 B | ~12.8 MB | *(pending staging run)* |
| `coding_drafts` (post-exam) | 0 B (purged on finalize) | 0 MB | *(pending staging run)* |
| **Total (with ~35% B-tree index overhead)** | — | **~30.5 MB** | *(pending staging run)* |

---

## 5. Capacity Math for 10,000 Concurrent Users

### Measured vs Assumed Table
| Metric / Parameter | Assumed (Design Target) | Measured (Staging k6) |
|---|---|---|
| Concurrent Virtual Users | 10,000 | *(pending staging run)* |
| Traffic Mix (Read / Run / Submit) | 70% / 20% / 10% | *(pending staging run)* |
| Peak Job Arrival Rate | ~150 jobs/s | *(pending staging run)* |
| Avg Sandbox Execution Time | 1.5s (run) / 2.5s (submit) | *(pending staging run)* |
| Concurrent Sandbox Slots Needed | 375 (`150 * 2.5`) | *(pending staging run)* |
| p95 HTTP Latency | < 1,500 ms | *(pending staging run)* |
| 5xx Error Rate | < 1.0% | *(pending staging run)* |
| Max Queue Depth Observed | <= 5,000 (`CODING_MAX_QUEUE_DEPTH`) | *(pending staging run)* |
| Degradation / Saturation Point | — | *(pending staging run)* |

- **Worker Sizing**: Run `docker compose -f docker-compose.coding.yml up -d --scale coding-worker=8 --scale judge0-worker=12` across dedicated worker nodes (4–8 vCPU each).
- **Backpressure**: When queue depth reaches `CODING_MAX_QUEUE_DEPTH=5000`, the API returns `429 Too Many Requests` with `Retry-After` instead of crashing.

---

## 6. Staging Deployment, Compose Validation & k6 Load Test
1. Validate Compose config (with `.env` populated):
   `docker compose -f docker-compose.coding.yml config`
2. Apply migration: `python backend/migrations/add_coding_drafts_v3.py --up`
3. Start Redis, Judge0 CE, and coding workers:
   `docker compose -f docker-compose.coding.yml up -d --scale coding-worker=4 --scale judge0-worker=6`
4. Verify network isolation & connectivity:
   - `docker compose -f docker-compose.coding.yml exec coding-worker python -c "import redis; r=redis.from_url('redis://:'+__import__('os').environ['REDIS_PASSWORD']+'@redis:6379/0'); print(r.ping())"` (expects `True`)
   - `docker compose -f docker-compose.coding.yml exec coding-worker curl -sf -H "X-Auth-Token: $JUDGE0_AUTH_TOKEN" http://judge0-server:2358/about` (expects JSON)
   - `docker compose -f docker-compose.coding.yml exec judge0-worker curl -sf --max-time 3 https://1.1.1.1` (expects failure — no internet)
5. Start API cluster (`scripts/start_cluster.py --workers 8`) behind Nginx (`nginx/conf.d/exam_portal.conf`).
6. Run k6 10,000-VU test:
   `k6 run -e BASE_URL=https://staging.example.com -e EXAM_ID=1 -e QUESTION_ID=q1 -e TOKEN=<candidate_jwt> scripts/k6_coding_10k.js`

---

## 7. Exam-Day Runbook
- **Pre-Exam (T-30m)**: Verify `GET /api/coding/health` (`redisConnected: true`, `queueDepth: 0`) and `GET /api/coding/metrics`.
- **During Exam**: Watch `coding_queue_depth`, `coding_rate_limited_total`, and `coding_failed_total` at `/api/coding/metrics`. Scale workers if `coding_queue_depth > 1000`.
- **Emergency Kill Switch**: Set `CODING_ROUND_ENABLED=false` and reload Uvicorn workers to immediately return `503` without affecting Round 1.
