"""
Reversible migration for Round 2: coding_drafts table (server-side autosave & timer-expiry auto-submit).
Supports both PostgreSQL (Neon) and SQLite fallback.

Usage:
    python migrations/add_coding_drafts_v3.py --up
    python migrations/add_coding_drafts_v3.py --down
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import inspect, text
from app.core.database import engine as default_engine


def up(bind_engine=None) -> None:
    target_engine = bind_engine or default_engine
    from app.core.database import Base
    import app.models  # noqa: F401

    Base.metadata.create_all(bind=target_engine)


def down(bind_engine=None) -> None:
    target_engine = bind_engine or default_engine
    with target_engine.begin() as conn:
        insp = inspect(conn)
        if "coding_drafts" in insp.get_table_names():
            conn.execute(text("DROP TABLE coding_drafts;"))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Round 2 Coding Drafts migration")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--up", action="store_true", help="Apply migration")
    group.add_argument("--down", action="store_true", help="Rollback migration")
    args = parser.parse_args()
    if args.up:
        up()
        print("[MIGRATION] add_coding_drafts_v3 UP complete.")
    else:
        down()
        print("[MIGRATION] add_coding_drafts_v3 DOWN complete.")
