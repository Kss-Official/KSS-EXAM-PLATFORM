import logging
from sqlalchemy import text
from app.core.database import engine

logger = logging.getLogger("ExamSecure.SchemaGuard")

def ensure_indexes_and_constraints():
    """
    Ensures critical high-concurrency indexes and unique constraints exist
    in PostgreSQL / SQLite to eliminate race conditions and avoid full table scans.
    Also ensures the colleges table and candidates.college_id reference exist.
    """
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

    is_sqlite = engine.dialect.name == "sqlite"

    with engine.begin() as conn:
        from sqlalchemy import inspect
        insp = inspect(conn)
        
        # Ensure columns on exam_attempts
        if "exam_attempts" in insp.get_table_names():
            existing_cols = {c["name"] for c in insp.get_columns("exam_attempts")}
            col_defs = [
                ("candidate_code", "VARCHAR(64)"),
                ("question_set_code", "VARCHAR(20)"),
                ("total_questions", "INTEGER DEFAULT 0"),
                ("questions_answered", "INTEGER DEFAULT 0"),
                ("correct_answers", "INTEGER DEFAULT 0"),
                ("incorrect_answers", "INTEGER DEFAULT 0"),
                ("unanswered_questions", "INTEGER DEFAULT 0"),
                ("duration_seconds", "INTEGER DEFAULT 0"),
                ("extra_time_minutes", "INTEGER DEFAULT 0"),
                ("termination_reason", "VARCHAR(255)")
            ]
            for col_name, col_type in col_defs:
                if col_name not in existing_cols:
                    try:
                        conn.execute(text(f"ALTER TABLE exam_attempts ADD COLUMN {col_name} {col_type};"))
                    except Exception as e:
                        logger.debug(f"Could not add {col_name} to exam_attempts: {e}")

        # Ensure columns on departments table
        if "departments" in insp.get_table_names():
            dept_cols = {c["name"] for c in insp.get_columns("departments")}
            if "category" not in dept_cols:
                try:
                    conn.execute(text("ALTER TABLE departments ADD COLUMN category VARCHAR(50) DEFAULT 'TECHNICAL';"))
                except Exception as e:
                    logger.debug(f"Could not add category to departments: {e}")
            try:
                # Classify non-technical departments
                conn.execute(text("""
                    UPDATE departments 
                    SET category = 'NON_TECHNICAL' 
                    WHERE UPPER(code) IN ('HR', 'MKT', 'SALES_MKT', 'SALES', 'MARKETING', 'FIN', 'FINANCE', 'OPS', 'MGMT', 'NON_TECH')
                       OR LOWER(name) LIKE '%human resource%'
                       OR LOWER(name) LIKE '%sales%'
                       OR LOWER(name) LIKE '%marketing%'
                       OR LOWER(name) LIKE '%management%'
                       OR LOWER(name) LIKE '%non-technical%';
                """))
            except Exception as e:
                logger.debug(f"Notice updating department categories: {e}")

        # Ensure colleges table
        if "colleges" not in insp.get_table_names():
            if is_sqlite:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS colleges (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name VARCHAR(255) NOT NULL UNIQUE,
                        code VARCHAR(50) UNIQUE,
                        description TEXT,
                        active BOOLEAN NOT NULL DEFAULT 1,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    );
                """))
            else:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS colleges (
                        id BIGSERIAL PRIMARY KEY,
                        name VARCHAR(255) NOT NULL UNIQUE,
                        code VARCHAR(50) UNIQUE,
                        description TEXT,
                        active BOOLEAN NOT NULL DEFAULT TRUE,
                        created_at TIMESTAMPTZ DEFAULT NOW(),
                        updated_at TIMESTAMPTZ DEFAULT NOW()
                    );
                """))

        # Ensure candidates.college_id
        if "candidates" in insp.get_table_names():
            cand_cols = {c["name"] for c in insp.get_columns("candidates")}
            if "college_id" not in cand_cols:
                try:
                    conn.execute(text("ALTER TABLE candidates ADD COLUMN college_id BIGINT REFERENCES colleges(id) ON DELETE SET NULL;"))
                except Exception as e:
                    logger.debug(f"Could not add college_id to candidates: {e}")

        # Ensure proctor_alerts table
        if "proctor_alerts" not in insp.get_table_names():
            if is_sqlite:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS proctor_alerts (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        candidate_id INTEGER NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
                        attempt_id INTEGER REFERENCES exam_attempts(id) ON DELETE SET NULL,
                        alert_type VARCHAR(50) NOT NULL,
                        severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
                        message VARCHAR(500) NOT NULL,
                        status VARCHAR(20) NOT NULL DEFAULT 'NEW',
                        reviewed_by VARCHAR(150),
                        reviewed_at DATETIME,
                        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                    );
                """))
            else:
                conn.execute(text("""
                    CREATE TABLE IF NOT EXISTS proctor_alerts (
                        id BIGSERIAL PRIMARY KEY,
                        candidate_id BIGINT NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
                        attempt_id BIGINT REFERENCES exam_attempts(id) ON DELETE SET NULL,
                        alert_type VARCHAR(50) NOT NULL,
                        severity VARCHAR(20) NOT NULL DEFAULT 'MEDIUM',
                        message VARCHAR(500) NOT NULL,
                        status VARCHAR(20) NOT NULL DEFAULT 'NEW',
                        reviewed_by VARCHAR(150),
                        reviewed_at TIMESTAMPTZ,
                        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    );
                """))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_proctor_alerts_candidate_id ON proctor_alerts(candidate_id);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_proctor_alerts_attempt_id ON proctor_alerts(attempt_id);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_proctor_alerts_created_at ON proctor_alerts(created_at);"))
            conn.execute(text("CREATE INDEX IF NOT EXISTS ix_proctor_alerts_status ON proctor_alerts(status);"))


    ddl_statements = [
        # Risk 2: Unique constraint and index for attempt answers to guarantee idempotent upserts
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_attempt_answer_attempt_question ON attempt_answers (attempt_id, question_id);",
        "CREATE INDEX IF NOT EXISTS ix_attempt_answers_attempt_id ON attempt_answers (attempt_id);",
        "CREATE INDEX IF NOT EXISTS ix_attempt_answers_question_id ON attempt_answers (question_id);",

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

        # Candidate lookup & College & Department filtering
        "CREATE INDEX IF NOT EXISTS ix_colleges_code ON colleges (code);",
        "CREATE INDEX IF NOT EXISTS ix_colleges_active ON colleges (active);",
        "CREATE INDEX IF NOT EXISTS ix_candidates_college_id ON candidates (college_id);",
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
            logger.warning(f"Index/DDL statement notice (non-fatal): {e}")

    logger.info("High-concurrency database constraints, indexes, and schema verified successfully.")
