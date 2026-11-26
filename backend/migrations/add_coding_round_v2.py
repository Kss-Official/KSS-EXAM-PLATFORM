"""
Reversible migration for Round 2: Coding Round v2 columns, indexes, and idempotency constraint.
Supports both PostgreSQL (Neon) and SQLite fallback.

Usage:
    python migrations/add_coding_round_v2.py --up
    python migrations/add_coding_round_v2.py --down
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import inspect, text
from app.core.database import engine as default_engine


def _existing_columns(conn, table_name: str) -> set[str]:
    insp = inspect(conn)
    if table_name not in insp.get_table_names():
        return set()
    return {c["name"] for c in insp.get_columns(table_name)}


def _existing_indexes(conn, table_name: str) -> set[str]:
    insp = inspect(conn)
    if table_name not in insp.get_table_names():
        return set()
    return {idx["name"] for idx in insp.get_indexes(table_name) if idx.get("name")}


def up(bind_engine=None) -> None:
    target_engine = bind_engine or default_engine
    from app.core.database import Base
    import app.models  # noqa: F401 - register all models

    # Ensure base tables exist first
    Base.metadata.create_all(bind=target_engine)

    with target_engine.begin() as conn:
        q_cols = _existing_columns(conn, "coding_questions")
        if q_cols and "starter_code_json" not in q_cols:
            conn.execute(text("ALTER TABLE coding_questions ADD COLUMN starter_code_json TEXT DEFAULT '{}';"))

        att_cols = _existing_columns(conn, "coding_attempts")
        if att_cols:
            if "expires_at" not in att_cols:
                dt_type = "TIMESTAMPTZ" if target_engine.dialect.name == "postgresql" else "DATETIME"
                conn.execute(text(f"ALTER TABLE coding_attempts ADD COLUMN expires_at {dt_type};"))
            if "extra_time_minutes" not in att_cols:
                conn.execute(text("ALTER TABLE coding_attempts ADD COLUMN extra_time_minutes INTEGER NOT NULL DEFAULT 0;"))

        sub_cols = _existing_columns(conn, "coding_submissions")
        if sub_cols:
            dt_type = "TIMESTAMPTZ" if target_engine.dialect.name == "postgresql" else "DATETIME"
            additions = [
                ("candidate_id", "BIGINT" if target_engine.dialect.name == "postgresql" else "INTEGER"),
                ("idempotency_key", "VARCHAR(128)"),
                ("is_run_only", "BOOLEAN NOT NULL DEFAULT FALSE" if target_engine.dialect.name == "postgresql" else "BOOLEAN NOT NULL DEFAULT 0"),
                ("job_id", "VARCHAR(128)"),
                ("verdict", "VARCHAR(40) NOT NULL DEFAULT 'QUEUED'"),
                ("runtime_ms", "INTEGER"),
                ("memory_kb", "INTEGER"),
                ("error_message", "TEXT"),
                ("updated_at", dt_type),
            ]
            for col_name, col_def in additions:
                if col_name not in sub_cols:
                    conn.execute(text(f"ALTER TABLE coding_submissions ADD COLUMN {col_name} {col_def};"))

            idxs = _existing_indexes(conn, "coding_submissions")
            if "ix_coding_sub_attempt_q" not in idxs:
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_coding_sub_attempt_q ON coding_submissions (attempt_id, question_id);"))
            if "ix_coding_sub_cand_submitted" not in idxs:
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_coding_sub_cand_submitted ON coding_submissions (candidate_id, submitted_at);"))
            if "ix_coding_sub_job_id" not in idxs:
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_coding_sub_job_id ON coding_submissions (job_id);"))
            if "uq_coding_sub_attempt_idempotency" not in idxs:
                conn.execute(text(
                    "CREATE UNIQUE INDEX IF NOT EXISTS uq_coding_sub_attempt_idempotency "
                    "ON coding_submissions (attempt_id, idempotency_key);"
                ))


def down(bind_engine=None) -> None:
    target_engine = bind_engine or default_engine
    is_sqlite = target_engine.dialect.name == "sqlite"
    with target_engine.begin() as conn:
        for idx_name in (
            "uq_coding_sub_attempt_idempotency",
            "ix_coding_sub_job_id",
            "ix_coding_sub_cand_submitted",
            "ix_coding_sub_attempt_q",
        ):
            conn.execute(text(f"DROP INDEX IF EXISTS {idx_name};"))

        if not is_sqlite:
            conn.execute(text(
                "ALTER TABLE coding_submissions DROP CONSTRAINT IF EXISTS uq_coding_sub_attempt_idempotency;"
            ))
            sub_cols = _existing_columns(conn, "coding_submissions")
            for col_name in (
                "updated_at", "error_message", "memory_kb", "runtime_ms",
                "verdict", "job_id", "is_run_only", "idempotency_key", "candidate_id"
            ):
                if col_name in sub_cols:
                    conn.execute(text(f"ALTER TABLE coding_submissions DROP COLUMN {col_name};"))
        else:
            # SQLite cannot DROP COLUMN when referenced by a table-level UNIQUE constraint;
            # recreate coding_submissions with only the original v1 columns.
            sub_cols = _existing_columns(conn, "coding_submissions")
            if "idempotency_key" in sub_cols:
                conn.execute(text("""
                    CREATE TABLE coding_submissions_v1_tmp (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        attempt_id BIGINT NOT NULL REFERENCES coding_attempts(id) ON DELETE CASCADE,
                        question_id VARCHAR(64) NOT NULL REFERENCES coding_questions(id) ON DELETE CASCADE,
                        language VARCHAR(30) NOT NULL,
                        source_code TEXT NOT NULL,
                        status VARCHAR(30) NOT NULL DEFAULT 'EVALUATED',
                        passed_test_cases INTEGER NOT NULL DEFAULT 0,
                        total_test_cases INTEGER NOT NULL DEFAULT 0,
                        marks_awarded NUMERIC(6, 2) NOT NULL DEFAULT 0.00,
                        test_case_results TEXT DEFAULT '[]',
                        submitted_at DATETIME NOT NULL
                    );
                """))
                conn.execute(text("""
                    INSERT INTO coding_submissions_v1_tmp (
                        id, attempt_id, question_id, language, source_code,
                        status, passed_test_cases, total_test_cases,
                        marks_awarded, test_case_results, submitted_at
                    )
                    SELECT
                        id, attempt_id, question_id, language, source_code,
                        status, passed_test_cases, total_test_cases,
                        marks_awarded, test_case_results, submitted_at
                    FROM coding_submissions;
                """))
                conn.execute(text("DROP TABLE coding_submissions;"))
                conn.execute(text("ALTER TABLE coding_submissions_v1_tmp RENAME TO coding_submissions;"))

        att_cols = _existing_columns(conn, "coding_attempts")
        for col_name in ("extra_time_minutes", "expires_at"):
            if col_name in att_cols:
                conn.execute(text(f"ALTER TABLE coding_attempts DROP COLUMN {col_name};"))

        q_cols = _existing_columns(conn, "coding_questions")
        if "starter_code_json" in q_cols:
            conn.execute(text("ALTER TABLE coding_questions DROP COLUMN starter_code_json;"))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Round 2 Coding migration")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--up", action="store_true", help="Apply migration")
    group.add_argument("--down", action="store_true", help="Rollback migration")
    args = parser.parse_args()
    if args.up:
        up()
        print("[MIGRATION] add_coding_round_v2 UP complete.")
    else:
        down()
        print("[MIGRATION] add_coding_round_v2 DOWN complete.")
