import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.core.database import SessionLocal, engine
from app.core.schema_guard import ensure_indexes_and_constraints

def run_migration():
    print("[MIGRATION] 1. Ensuring schema, tables, and constraints...")
    ensure_indexes_and_constraints()

    db = SessionLocal()
    try:
        # 2. Check current colleges in departments table
        colleges_in_depts = db.execute(text("""
            SELECT id, name, code, description, active, created_at
            FROM departments
            WHERE id BETWEEN 43 AND 55 
               OR UPPER(name) LIKE '%COLLEGE%' 
               OR UPPER(name) LIKE '%INSTITUTE%'
               OR UPPER(name) LIKE '%UNIVERSITY%'
            ORDER BY id ASC;
        """)).fetchall()

        print(f"[MIGRATION] Found {len(colleges_in_depts)} college rows in departments table.")

        # 3. Insert each into colleges table preserving primary key id
        for row in colleges_in_depts:
            cid, name, code, desc, active, created_at = row
            db.execute(text("""
                INSERT INTO colleges (id, name, code, description, active, created_at, updated_at)
                VALUES (:id, :name, :code, :desc, :active, COALESCE(:created_at, NOW()), NOW())
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    code = EXCLUDED.code,
                    description = EXCLUDED.description,
                    active = EXCLUDED.active,
                    updated_at = NOW();
            """), {
                "id": cid,
                "name": name,
                "code": code,
                "desc": desc,
                "active": active,
                "created_at": created_at
            })
        db.commit()
        print(f"[MIGRATION] Successfully populated colleges table.")

        # 4. Advance PostgreSQL sequence for colleges.id
        db.execute(text("""
            SELECT setval(
                pg_get_serial_sequence('colleges', 'id'),
                COALESCE((SELECT MAX(id) FROM colleges), 1)
            );
        """))
        db.commit()
        print("[MIGRATION] Advanced colleges_id_seq to current MAX(id).")

        # 5. Populate candidate.college_id
        # For candidates whose department_id was one of the colleges (43..55)
        updated_cands = db.execute(text("""
            UPDATE candidates
            SET college_id = department_id
            WHERE college_id IS NULL 
              AND department_id IN (SELECT id FROM colleges);
        """)).rowcount
        db.commit()
        print(f"[MIGRATION] Set college_id for {updated_cands} candidates.")

        # 6. Ensure candidates have an academic department assigned
        # If candidate's department_id is still pointing to a college ID,
        # set department_id to 1 ('DEV' - Developer track) so they have an academic department.
        dev_dept = db.execute(text("SELECT id FROM departments WHERE id = 1")).fetchone()
        dev_id = dev_dept[0] if dev_dept else 1

        dept_reassigned = db.execute(text("""
            UPDATE candidates
            SET department_id = :dev_id
            WHERE department_id IN (SELECT id FROM colleges);
        """), {"dev_id": dev_id}).rowcount
        db.commit()
        print(f"[MIGRATION] Reassigned {dept_reassigned} candidates' department_id to Academic Track {dev_id} (Developer).")

        # 7. Verification summary
        total_colleges = db.execute(text("SELECT COUNT(*) FROM colleges")).scalar()
        total_depts = db.execute(text("SELECT COUNT(*) FROM departments WHERE id NOT IN (SELECT id FROM colleges)")).scalar()
        cands_with_college = db.execute(text("SELECT COUNT(*) FROM candidates WHERE college_id IS NOT NULL")).scalar()
        cands_with_dept = db.execute(text("SELECT COUNT(*) FROM candidates WHERE department_id IS NOT NULL")).scalar()
        total_cands = db.execute(text("SELECT COUNT(*) FROM candidates")).scalar()

        print("\n=== MIGRATION VERIFICATION ===")
        print(f"Colleges in 'colleges' table: {total_colleges}")
        print(f"Academic Departments in 'departments' table: {total_depts}")
        print(f"Total Candidates: {total_cands}")
        print(f"Candidates with college_id: {cands_with_college}")
        print(f"Candidates with department_id: {cands_with_dept}")
        print("=== SUCCESS ===")

    except Exception as e:
        db.rollback()
        print(f"[MIGRATION ERROR] {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    run_migration()
