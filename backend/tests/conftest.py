"""
Hermetic test harness for the ExamSecure backend.

Safety guarantees
-----------------
1. Tests NEVER touch the real database. Before any `app` module is imported we
   point DATABASE_URL at a throw-away SQLite file in a temp directory, and we
   abort the whole run if the engine is not SQLite (e.g. someone changes this
   file or an env var overrides it).
2. Tests NEVER talk to a developer's running server on port 8000. Tests that
   need a real HTTP server use the private uvicorn instance started below on a
   random free port, exposed as EXAMSECURE_TEST_BASE_URL.
3. The database is seeded with the same baseline the real startup creates
   (admin, departments, demo candidates) plus one published exam, so tests do
   not depend on data that happens to exist in a long-lived database.
"""
import atexit
import os
import shutil
import socket
import sys
import tempfile
import threading
import time
from decimal import Decimal
from pathlib import Path
from types import SimpleNamespace

backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

# --------------------------------------------------------------------------
# 1. Isolated environment -- MUST run before importing anything from `app`.
# --------------------------------------------------------------------------
_TEST_ROOT = Path(tempfile.mkdtemp(prefix="examsecure_tests_"))
atexit.register(shutil.rmtree, _TEST_ROOT, ignore_errors=True)

os.environ["DATABASE_URL"] = f"sqlite:///{(_TEST_ROOT / 'test.db').as_posix()}"
os.environ["UPLOAD_DIR"] = str(_TEST_ROOT / "uploads")


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


_TEST_PORT = _free_port()
os.environ["EXAMSECURE_TEST_BASE_URL"] = f"http://127.0.0.1:{_TEST_PORT}"

import pytest  # noqa: E402

from app.core.database import Base, engine, SessionLocal  # noqa: E402
import app.models  # noqa: E402,F401  (register models)

if engine.url.get_backend_name() != "sqlite":  # pragma: no cover - safety net
    pytest.exit(
        "REFUSING TO RUN: tests must use the isolated SQLite database, "
        f"but the engine points at '{engine.url.get_backend_name()}'.",
        returncode=2,
    )

Base.metadata.create_all(bind=engine)

SEED_ADMIN = "seed_admin@secureexam.local"


def _seed_baseline() -> None:
    from app.core.bootstrap import (
        init_super_admin,
        init_default_departments,
        init_default_candidates,
    )
    from app.models import Department, Exam, QuestionSet
    from app.schemas import QuestionDto, QuestionOptionDto
    from app.admin.services import ExamService, QuestionService

    with SessionLocal() as db:
        init_super_admin(db)
        init_default_departments(db)
        init_default_candidates(db)

        if db.query(Exam).count() > 0:
            return

        all_dept_ids = [d.id for d in db.query(Department).filter(Department.active == True).all()]
        exam_dto = ExamService.create_exam(
            db,
            SimpleNamespace(
                title="Seeded Baseline Exam",
                description="Published exam seeded for the automated test-suite",
                duration_minutes=30,
                total_questions=1,
                qualification_mode="PERCENTAGE",
                qualification_threshold=Decimal("50.00"),
                timing_mode="DURATION_FROM_START",
                total_marks=Decimal("10.00"),
                marks_per_question=Decimal("10.00"),
                negative_marks=Decimal("0.00"),
                scheduled_start_time=None,
                scheduled_end_time=None,
                department_ids=all_dept_ids,
            ),
            SEED_ADMIN,
        )
        set_a = (
            db.query(QuestionSet)
            .filter(QuestionSet.exam_id == exam_dto.id, QuestionSet.set_code == "A")
            .first()
        )
        QuestionService.create_question(
            db,
            set_a.id,
            QuestionDto(
                question_text="Seeded baseline question?",
                marks=Decimal("10.00"),
                negative_marks=Decimal("0.00"),
                display_order=1,
                options=[
                    QuestionOptionDto(option_text="Correct", correct=True, display_order=1),
                    QuestionOptionDto(option_text="Wrong", correct=False, display_order=2),
                ],
            ),
            SEED_ADMIN,
        )
        ExamService.publish_exam(db, exam_dto.id, SEED_ADMIN)


@pytest.fixture(scope="session", autouse=True)
def _live_server():
    """Private uvicorn instance (same process, same SQLite DB) on a random port."""
    import uvicorn
    from app.main import app as fastapi_app

    server = uvicorn.Server(
        uvicorn.Config(fastapi_app, host="127.0.0.1", port=_TEST_PORT, log_level="warning")
    )
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()

    deadline = time.time() + 30
    while not server.started and time.time() < deadline:
        time.sleep(0.05)
    if not server.started:  # pragma: no cover
        pytest.exit("Private test server failed to start", returncode=2)

    _seed_baseline()
    yield os.environ["EXAMSECURE_TEST_BASE_URL"]

    server.should_exit = True
    thread.join(timeout=10)


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
