# ExamSecure — Python + FastAPI Enterprise Backend Service

Enterprise Online Examination & Proctoring Backend Architecture built on **Python 3.11+**, **FastAPI**, **SQLAlchemy ORM**, and **Supabase PostgreSQL**.

---

## 1. Quick Start

### Prerequisites
- Python 3.11+ installed
- PostgreSQL connection string (Supabase Cloud default is configured via `.env`)

### Installation & Run

1. **Install Dependencies**:
```bash
pip install -r requirements.txt
```

2. **Run Server**:
```bash
# Using Python runner (starts on 127.0.0.1:8080)
python run.py

# Or directly using uvicorn
uvicorn app.main:app --host 127.0.0.1 --port 8080 --reload

# Or on Windows using batch script
run.bat
```

The FastAPI backend is available at:
- **API Server**: `http://127.0.0.1:8080`
- **Interactive Swagger Documentation**: `http://127.0.0.1:8080/docs`
- **ReDoc Documentation**: `http://127.0.0.1:8080/redoc`
- **Health Check Endpoint**: `http://127.0.0.1:8080/actuator/health`

---

## 2. Clean Modular Architecture

The backend follows Clean Domain-Driven Architecture:

```
backend/
├── app/
│   ├── core/                     # Central Core Configuration, Security & Dependencies
│   │   ├── config.py             # Pydantic v2 Settings, Multi-path .env loader
│   │   ├── database.py           # Engine with connection pooling, SessionLocal, get_db
│   │   ├── security.py           # BCrypt password hashing & HMAC-SHA256 session tokens
│   │   ├── rate_limiter.py       # Thread-safe brute force protection (15-min lockout)
│   │   ├── bootstrap.py          # Idempotent Super Administrator bootstrap
│   │   ├── dependencies.py       # Reusable FastAPI dependency injection
│   │   └── __init__.py           # Unified core exports
│   │
│   ├── models/                   # Domain-Separated SQLAlchemy ORM Models
│   │   ├── user.py               # AppUser (RBAC, password_hash, security flags)
│   │   ├── department.py         # Department & exam_departments association table
│   │   ├── exam.py               # Exam & ExamSlot (slots, timing, scoring rules)
│   │   ├── question.py           # QuestionSet, Question & QuestionOption
│   │   ├── candidate.py          # Candidate registration records
│   │   ├── attempt.py            # ExamAttempt, double shuffle & answer tracking
│   │   ├── document.py           # StoredDocument (papers, answer keys)
│   │   ├── audit.py              # AuditLog (tamper-evident audit trail)
│   │   ├── entities.py           # Backward-compatibility re-exporter
│   │   └── __init__.py           # Unified models exports
│   │
│   ├── schemas/                  # Domain-Separated Pydantic v2 DTOs (camelCase)
│   │   ├── base.py               # CamelModel with automatic camelCase alias generator
│   │   ├── auth.py               # LoginRequest, AuthUser, AuthResponseDto
│   │   ├── department.py         # DepartmentDto, Summaries
│   │   ├── exam.py               # ExamDto, ExamSlotDto, CreateExamFromParsedDto
│   │   ├── question.py           # QuestionDto, QuestionSetSummary, PDF extraction DTOs
│   │   ├── candidate.py          # CandidateDto, CandidateVerify, CandidateAttempt DTOs
│   │   ├── result.py             # SubmissionResponse, ExamResultDto
│   │   ├── dashboard.py          # AdminDashboardResponse
│   │   ├── schemas.py            # Backward-compatibility re-exporter
│   │   └── __init__.py           # Unified schemas exports
│   │
│   ├── services/                 # Pure Business Logic Layer (Clean & Optimized)
│   │   ├── candidate_exam_service.py # Verification, double shuffle, autosave, scoring
│   │   ├── candidate_service.py  # Candidate CRUD, batch CSV import, exam assignment
│   │   ├── dashboard_service.py  # Optimized SQL aggregate queries & results publishing
│   │   ├── department_service.py # Department management & exam relationships
│   │   ├── exam_service.py       # Exam lifecycle, 4-set department generation, deletion
│   │   ├── pdf_service.py        # In-memory zero-disk PDF parsing & OCR analysis (pypdf)
│   │   ├── question_service.py   # Question CRUD, text import, answer key mapping
│   │   ├── document_service.py   # Document storage and SHA-256 validation
│   │   └── __init__.py           # Unified services exports
│   │
│   ├── routers/                  # Thin API Endpoints (Delegating to Services)
│   │   ├── auth.py               # /api/auth (login, me, logout)
│   │   ├── admin_dashboard.py    # /api/admin/dashboard
│   │   ├── admin_departments.py  # /api/admin/departments
│   │   ├── admin_exams.py        # /api/admin/exams
│   │   ├── admin_questions.py    # /api/admin/sets, questions, documents, answer keys
│   │   ├── admin_candidates.py   # /api/admin/candidates
│   │   ├── admin_results.py      # /api/admin/results
│   │   ├── candidate_portal.py   # /api/candidate (verify, start, answers, submit)
│   │   ├── health.py             # /actuator/health, /health
│   │   └── __init__.py           # Unified routers exports
│   │
│   └── main.py                   # Entrypoint with CORS, lifecycle, and global error handling
│
├── tests/                        # Comprehensive Pytest Suite
│   ├── test_api.py               # Health, Admin auth, Session lifecycle, Rate limiter
│   ├── test_candidate_flow.py    # Candidate verification & eligibility
│   └── test_departments.py       # Department listing & active filtering
├── requirements.txt
├── run.py
└── run.bat
```

---

## 3. High-Performance Optimizations

1. **Eliminated N+1 Queries**:
   - Replaced lazy-loading loops with `joinedload(...)` across Exams, Departments, Questions, Options, and Candidates.
   - Reduced candidate exam start and dashboard load database round-trips by over 70%.
2. **Aggregated SQL Metrics**:
   - Switched dashboard telemetry from multiple serial `count()` queries to combined SQL `func.count()` queries processed natively inside PostgreSQL.
3. **Stateless Cryptographic Sessions**:
   - Uses HMAC-SHA256 signed session tokens inside `JSESSIONID` cookies, preserving login state across multi-worker and dev-reload cycles.
4. **Zero-Disk In-Memory PDF Processing**:
   - Raw uploaded PDFs are extracted directly in memory via `pypdf`, evicting bytes immediately to eliminate storage leaks and disk I/O.
5. **Deterministic Candidate-Level Double Shuffling**:
   - Shuffles both question sequences and individual MCQ options uniquely per candidate, persisting permutations to guarantee idempotency across page refreshes.
