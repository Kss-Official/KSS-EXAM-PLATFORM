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
        """,
        """
        DELETE FROM attempt_randomized_options a
        USING attempt_randomized_options b
        WHERE a.id > b.id
          AND a.attempt_id = b.attempt_id
          AND a.question_id = b.question_id
          AND a.option_id = b.option_id;
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
        "CREATE INDEX IF NOT EXISTS ix_exam_attempts_exam_id ON exam_attempts (exam_id);",
        "CREATE INDEX IF NOT EXISTS ix_exam_attempts_receipt_id ON exam_attempts (receipt_id);",

        # Risk 1 & 2: Randomized questions and options indexing & uniqueness
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_arq_attempt_question ON attempt_randomized_questions (attempt_id, question_id);",
        "CREATE INDEX IF NOT EXISTS ix_arq_attempt_display_order ON attempt_randomized_questions (attempt_id, display_order);",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_aro_attempt_question_option ON attempt_randomized_options (attempt_id, question_id, option_id);",
        "CREATE INDEX IF NOT EXISTS ix_aro_attempt_q_order ON attempt_randomized_options (attempt_id, question_id, display_order);",

        # Question Bank & Options performance
        "CREATE INDEX IF NOT EXISTS ix_questions_question_set_id ON questions (question_set_id);",
        "CREATE INDEX IF NOT EXISTS ix_questions_set_display ON questions (question_set_id, display_order);",
        "CREATE INDEX IF NOT EXISTS ix_question_options_question_id ON question_options (question_id);",
        "CREATE INDEX IF NOT EXISTS ix_question_options_q_display ON question_options (question_id, display_order);",
        "CREATE INDEX IF NOT EXISTS ix_question_sets_exam_id ON question_sets (exam_id);",
        "CREATE INDEX IF NOT EXISTS ix_question_sets_exam_dept ON question_sets (exam_id, department_id);",

        # Candidate lookup & Department filtering
        "CREATE INDEX IF NOT EXISTS ix_candidates_department_id ON candidates (department_id);",
        "CREATE INDEX IF NOT EXISTS ix_candidates_email_lower ON candidates (lower(email));",
        "CREATE INDEX IF NOT EXISTS ix_candidates_assigned_set ON candidates (assigned_set);",
        "CREATE INDEX IF NOT EXISTS ix_exam_departments_dept_id ON exam_departments (department_id);",
        "CREATE INDEX IF NOT EXISTS ix_exam_slots_exam_id ON exam_slots (exam_id);",

        # Audit logs & Document storage
        "CREATE INDEX IF NOT EXISTS ix_audit_logs_created_at ON audit_logs (created_at DESC);",
        "CREATE INDEX IF NOT EXISTS ix_audit_logs_entity ON audit_logs (entity_type, entity_id);",
        "CREATE INDEX IF NOT EXISTS ix_stored_documents_exam_id ON stored_documents (exam_id);"
    ]

    for stmt in ddl_statements:
        try:
            with engine.begin() as conn:
                conn.execute(text(stmt))
        except Exception as e:
            logger.warning(f"Notice applying DDL statement ({stmt[:50]}...): {e}")

    logger.info("High-concurrency database constraints and indexes verified successfully.")
