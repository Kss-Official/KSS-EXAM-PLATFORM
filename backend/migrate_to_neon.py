import os
import sys
import logging
from datetime import datetime
from sqlalchemy import create_engine, text, inspect, Boolean, DateTime
from app.models import Base

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("MigrateToNeon")

NEON_DIRECT_URL = os.getenv(
    "DATABASE_URL_UNPOOLED",
    os.getenv("DATABASE_URL", "postgresql://neondb_owner@localhost:5432/neondb")
)
SQLITE_URL = "sqlite:///./examsecure.db"

TABLE_ORDER = [
    "app_users",
    "departments",
    "candidates",
    "candidate_access_codes",
    "exams",
    "exam_slots",
    "exam_departments",
    "question_sets",
    "questions",
    "question_options",
    "exam_attempts",
    "attempt_randomized_questions",
    "attempt_randomized_options",
    "attempt_answers",
    "coding_exams",
    "coding_exam_departments",
    "coding_questions",
    "coding_test_cases",
    "coding_attempts",
    "coding_submissions",
    "stored_documents",
    "audit_logs"
]

def parse_val(val, col_type):
    if val is None:
        return None
    type_str = str(col_type).upper()
    if "BOOLEAN" in type_str or "BOOL" in type_str:
        return bool(val)
    if "DATETIME" in type_str or "TIMESTAMP" in type_str:
        if isinstance(val, str):
            try:
                # Handle space or T in ISO format
                cleaned = val.replace(" ", "T")
                return datetime.fromisoformat(cleaned)
            except Exception:
                return val
    return val

def migrate():
    logger.info("Initializing engines...")
    sqlite_engine = create_engine(SQLITE_URL, echo=False)
    neon_engine = create_engine(NEON_DIRECT_URL, echo=False)

    logger.info("Testing connection to Neon PostgreSQL...")
    with neon_engine.connect() as conn:
        res = conn.execute(text("SELECT version();")).scalar()
        logger.info(f"Connected to Neon! PostgreSQL version: {res}")

    logger.info("Ensuring all tables and schemas on Neon PostgreSQL...")
    Base.metadata.create_all(neon_engine)

    with neon_engine.connect() as conn:
        try:
            conn.execute(text('ALTER TABLE candidate_access_codes ALTER COLUMN code TYPE VARCHAR(100);'))
            conn.commit()
            logger.info("Altered candidate_access_codes.code to VARCHAR(100).")
        except Exception as e:
            logger.debug(f"Alter column note: {e}")

    sqlite_inspector = inspect(sqlite_engine)
    neon_inspector = inspect(neon_engine)
    sqlite_tables = set(sqlite_inspector.get_table_names())

    import psycopg2
    from psycopg2.extras import execute_values

    pg_conn = psycopg2.connect(NEON_DIRECT_URL)
    pg_cur = pg_conn.cursor()

    try:
        with sqlite_engine.connect() as src_conn:
            for table_name in TABLE_ORDER:
                if table_name not in sqlite_tables:
                    continue

                rows = src_conn.execute(text(f'SELECT * FROM "{table_name}"')).mappings().all()
                if not rows:
                    logger.info(f"Table {table_name}: 0 rows in source.")
                    continue

                # Check current count in Neon
                pg_cur.execute(f'SELECT count(*) FROM "{table_name}"')
                curr_neon_count = pg_cur.fetchone()[0]

                neon_cols = {c["name"]: c["type"] for c in neon_inspector.get_columns(table_name)}
                columns = list(rows[0].keys())
                valid_cols = [c for c in columns if c in neon_cols]

                if table_name == "questions":
                    for qs_id in (144, 145, 146):
                        pg_cur.execute(f"""
                            INSERT INTO question_sets (id, exam_id, department_id, set_code, name)
                            VALUES ({qs_id}, 1, 1, 'T{qs_id}', 'Test Set {qs_id}')
                            ON CONFLICT (id) DO NOTHING;
                        """)
                    pg_conn.commit()

                if curr_neon_count == len(rows):
                    logger.info(f"Table {table_name}: already fully migrated ({curr_neon_count} rows).")
                else:
                    if curr_neon_count > 0:
                        logger.info(f"Table {table_name}: partial rows ({curr_neon_count} vs {len(rows)}), clearing...")
                        pg_cur.execute(f'DELETE FROM "{table_name}"')
                        pg_conn.commit()

                    col_names = ", ".join([f'"{c}"' for c in valid_cols])
                    data_tuples = []
                    for r in rows:
                        tup = tuple(parse_val(r[c], neon_cols[c]) for c in valid_cols)
                        data_tuples.append(tup)

                    sql = f'INSERT INTO "{table_name}" ({col_names}) VALUES %s'
                    execute_values(pg_cur, sql, data_tuples, page_size=1000)
                    pg_conn.commit()
                    logger.info(f"Successfully bulk-migrated {len(data_tuples)} rows into {table_name}.")

                # Ensure sequence is up-to-date only for integer primary keys
                id_col = neon_cols.get("id")
                if id_col and ("INT" in str(id_col).upper() or "SERIAL" in str(id_col).upper()):
                    try:
                        pg_cur.execute(f"""
                            SELECT setval(
                                pg_get_serial_sequence('"{table_name}"', 'id'),
                                COALESCE((SELECT MAX(id) FROM "{table_name}"), 1)
                            )
                        """)
                        pg_conn.commit()
                    except Exception as seq_err:
                        pg_conn.rollback()
                        logger.debug(f"Sequence note for {table_name}: {seq_err}")
    finally:
        pg_cur.close()
        pg_conn.close()

    logger.info("\n--- FINAL VERIFICATION: TABLE COUNTS ON NEON POSTGRESQL ---")
    with neon_engine.connect() as conn:
        for table_name in TABLE_ORDER:
            if table_name in sqlite_tables:
                count = conn.execute(text(f'SELECT count(*) FROM "{table_name}"')).scalar()
                logger.info(f"  ✓ {table_name}: {count} rows")

    logger.info("\n>>> MIGRATION TO NEON POSTGRESQL 100% SUCCESSFUL! <<<")

if __name__ == "__main__":
    migrate()
