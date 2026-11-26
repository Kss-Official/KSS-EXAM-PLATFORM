"""
Reversible migration for Round 2 Result Storage & Code Retention (v4).
Supports both PostgreSQL (Neon) and SQLite fallback.

Usage:
    python migrations/add_coding_results_v4.py --up
    python migrations/add_coding_results_v4.py --down
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


def up(bind_engine=None) -> None:
    target_engine = bind_engine or default_engine
    from app.core.database import Base
    import app.models  # noqa: F401

    Base.metadata.create_all(bind=target_engine)
    is_pg = target_engine.dialect.name == "postgresql"
    dt_type = "TIMESTAMPTZ" if is_pg else "DATETIME"
    bool_false = "FALSE" if is_pg else "0"

    with target_engine.begin() as conn:
        exam_cols = _existing_columns(conn, "coding_exams")
        if exam_cols and "results_published" not in exam_cols:
            conn.execute(text(f"ALTER TABLE coding_exams ADD COLUMN results_published BOOLEAN NOT NULL DEFAULT {bool_false};"))

        att_cols = _existing_columns(conn, "coding_attempts")
        if att_cols:
            for col_name, col_def in (
                ("total_score", "NUMERIC(8,2) NOT NULL DEFAULT 0.00"),
                ("total_possible", "NUMERIC(8,2) NOT NULL DEFAULT 100.00"),
                ("overall_percent", "NUMERIC(6,2) NOT NULL DEFAULT 0.00"),
                ("finalized_at", dt_type),
            ):
                if col_name not in att_cols:
                    conn.execute(text(f"ALTER TABLE coding_attempts ADD COLUMN {col_name} {col_def};"))
            conn.execute(text(
                "CREATE INDEX IF NOT EXISTS ix_coding_attempts_exam_finalized ON coding_attempts (exam_id, finalized_at);"
            ))

        sub_cols = _existing_columns(conn, "coding_submissions")
        if sub_cols:
            if "code_hash" not in sub_cols:
                conn.execute(text("ALTER TABLE coding_submissions ADD COLUMN code_hash VARCHAR(64);"))
            if "retention_expires_at" not in sub_cols:
                conn.execute(text(f"ALTER TABLE coding_submissions ADD COLUMN retention_expires_at {dt_type};"))
            if is_pg:
                conn.execute(text("ALTER TABLE coding_submissions ALTER COLUMN source_code DROP NOT NULL;"))


def down(bind_engine=None) -> None:
    target_engine = bind_engine or default_engine
    with target_engine.begin() as conn:
        conn.execute(text("DROP INDEX IF EXISTS ix_coding_attempts_exam_finalized;"))
        insp = inspect(conn)
        if "coding_question_results" in insp.get_table_names():
            conn.execute(text("DROP TABLE coding_question_results;"))

        sub_cols = _existing_columns(conn, "coding_submissions")
        for col_name in ("retention_expires_at", "code_hash"):
            if col_name in sub_cols:
                conn.execute(text(f"ALTER TABLE coding_submissions DROP COLUMN {col_name};"))

        att_cols = _existing_columns(conn, "coding_attempts")
        for col_name in ("finalized_at", "overall_percent", "total_possible", "total_score"):
            if col_name in att_cols:
                conn.execute(text(f"ALTER TABLE coding_attempts DROP COLUMN {col_name};"))

        exam_cols = _existing_columns(conn, "coding_exams")
        if "results_published" in exam_cols:
            conn.execute(text("ALTER TABLE coding_exams DROP COLUMN results_published;"))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Round 2 Coding Results v4 migration")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--up", action="store_true")
    group.add_argument("--down", action="store_true")
    args = parser.parse_args()
    if args.up:
        up()
        print("[MIGRATION] add_coding_results_v4 UP complete.")
    else:
        down()
        print("[MIGRATION] add_coding_results_v4 DOWN complete.")
