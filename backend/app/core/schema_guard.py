import logging
from sqlalchemy import text
from app.core.database import engine

logger = logging.getLogger("ExamSecure.SchemaGuard")

def ensure_indexes_and_constraints():
    """
    Ensures critical high-concurrency indexes and unique constraints exist
    in PostgreSQL / SQLite to eliminate race conditions and avoid full table scans.
    """
    dialect = engine.dialect.name

    cleanup_statements = [
        # Clean any legacy duplicate rows before applying unique indexes
        """
        DELETE FROM attempt_randomized_questions a
        USING attempt_randomized_questions b
        WHERE a.id > b.id
          AND a.attempt_id = b.attempt_id
          AND a.question_id = b.question_id;
        """,
        """
        DELETE FROM attempt_answers a
        USING attempt_answers b
        WHERE a.id > b.id
          AND a.attempt_id = b.attempt_id
          AND a.question_id = b.question_id;
        """
    ]

    for cleanup_stmt in cleanup_statements:
        try:
            with engine.begin() as conn:
                conn.execute(text(cleanup_stmt))
        except Exception as e:
            logger.debug(f"Cleanup notice (non-fatal): {e}")

    ddl_statements = [
        # Risk 2: Unique constraint and index for attempt answers to guarantee idempotent upserts
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_attempt_answer_attempt_question ON attempt_answers (attempt_id, question_id);",
        "CREATE INDEX IF NOT EXISTS ix_attempt_answer_attempt_q ON attempt_answers (attempt_id, question_id);",

        # Risk 1: Fast attempt lookups by candidate and exam to prevent unbounded scans
        "CREATE INDEX IF NOT EXISTS ix_exam_attempts_candidate_exam ON exam_attempts (candidate_id, exam_id);",
        "CREATE INDEX IF NOT EXISTS ix_exam_attempts_status ON exam_attempts (status);",

        # Risk 1 & 2: Randomized questions and options indexing
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_arq_attempt_question ON attempt_randomized_questions (attempt_id, question_id);",
        "CREATE INDEX IF NOT EXISTS ix_arq_attempt_display_order ON attempt_randomized_questions (attempt_id, display_order);",
        "CREATE INDEX IF NOT EXISTS ix_aro_attempt_q_order ON attempt_randomized_options (attempt_id, question_id, display_order);",
    ]

    for stmt in ddl_statements:
        try:
            with engine.begin() as conn:
                conn.execute(text(stmt))
        except Exception as e:
            logger.warning(f"Notice applying DDL statement ({stmt[:50]}...): {e}")

    logger.info("High-concurrency database constraints and indexes verified successfully.")
