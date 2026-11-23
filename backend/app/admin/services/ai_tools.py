import logging
from typing import Any, Dict, List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc, asc

from app.models.exam import Exam, ExamSlot
from app.models.candidate import Candidate
from app.models.attempt import ExamAttempt
from app.models.department import Department
from app.models.college import College

logger = logging.getLogger("ExamSecure.AITools")

def normalize_exam_date(date_str: Optional[str], db: Session) -> Optional[str]:
    """Smart date resolution: translates human dates ('18th nov', 'nov 18', '2024-11-18') to valid platform dates."""
    if not date_str:
        return None
    s = str(date_str).strip().lower()
    if s in ["today", "now"]:
        return "2026-11-20"
    if s == "yesterday":
        return "2026-11-19"
    if s == "tomorrow":
        return "2026-11-21"
    if s == "all":
        return "ALL"

    try:
        available_dates = [d[0] for d in db.query(Candidate.exam_date).filter(Candidate.exam_date.isnot(None)).distinct().all() if d[0]]
    except Exception:
        available_dates = ["2026-11-18", "2026-11-20"]

    for d in available_dates:
        if s == d.lower():
            return d

    import re
    # Replace any pre-2026 years (e.g. 2024, 2025) with 2026
    if re.search(r"202[0-5]-(\d{2})-(\d{2})", s):
        converted = re.sub(r"202[0-5]-", "2026-", s)
        for d in available_dates:
            if converted == d:
                return d
        return converted

    # Match day and month: e.g. "18th nov", "18 nov", "nov 18", "18/11"
    clean_s = re.sub(r"(\d+)(st|nd|rd|th)", r"\1", s)
    months = {
        "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
        "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12
    }
    found_month = None
    for m_name, m_num in months.items():
        if m_name in clean_s:
            found_month = m_num
            break

    day_match = re.search(r"\b([0-2]?[0-9]|3[01])\b", clean_s)
    found_day = int(day_match.group(1)) if day_match else None

    if found_day:
        for ad in available_dates:
            try:
                parts = ad.split("-")
                ad_year, ad_month, ad_day = int(parts[0]), int(parts[1]), int(parts[2])
                if ad_day == found_day:
                    if found_month is None or ad_month == found_month:
                        return ad
            except Exception:
                continue

    return date_str

def query_exams(
    db: Session,
    search: Optional[str] = None,
    date: Optional[str] = None,
    status: Optional[str] = None
) -> Dict[str, Any]:
    """Search and retrieve examinations in the platform."""
    try:
        q = db.query(Exam)
        if search and search.strip():
            raw_s = search.strip()
            # Try full title match first, or split into terms
            words = [w for w in raw_s.split() if len(w) > 2]
            filters = [Exam.title.ilike(f"%{raw_s}%"), Exam.description.ilike(f"%{raw_s}%")]
            for w in words:
                filters.append(Exam.title.ilike(f"%{w}%"))
                filters.append(Exam.description.ilike(f"%{w}%"))
            q = q.filter(or_(*filters))
        if status and status.strip():
            q = q.filter(Exam.status.ilike(f"%{status.strip()}%"))
        
        exams = q.order_by(Exam.id.desc()).limit(20).all()
        results = []
        for e in exams:
            # Check slot dates or candidate dates if available
            slot_dates = [s.starts_at.strftime("%Y-%m-%d") for s in e.slots if s.starts_at]
            dept_names = [d.name for d in e.departments] if e.departments else []
            candidate_count = db.query(Candidate).filter(Candidate.assigned_exam_id == e.id).count()
            attempt_count = db.query(ExamAttempt).filter(ExamAttempt.exam_id == e.id).count()
            
            results.append({
                "id": e.id,
                "title": e.title,
                "status": e.status,
                "duration_minutes": e.duration_minutes,
                "total_questions": e.total_questions,
                "total_marks": float(e.total_marks or 100),
                "pass_percentage": float(e.qualification_threshold or 60),
                "scheduled_start": e.scheduled_start_time.isoformat() if e.scheduled_start_time else None,
                "slot_dates": slot_dates,
                "departments": dept_names,
                "enrolled_candidates": candidate_count,
                "completed_attempts": attempt_count,
            })
        return {"total_found": len(results), "exams": results}
    except Exception as ex:
        logger.error(f"Error querying exams: {ex}")
        return {"error": str(ex), "exams": []}

def query_exam_results(
    db: Session,
    exam_id: Optional[int] = None,
    exam_title: Optional[str] = None,
    min_score: Optional[float] = None,
    max_score: Optional[float] = None,
    sort_by: str = "score",
    sort_order: str = "desc",
    limit: int = 25
) -> Dict[str, Any]:
    """Retrieve scoring and performance results for a specific examination."""
    try:
        # Resolve exam_id if title given
        target_exam = None
        if exam_id:
            target_exam = db.query(Exam).filter(Exam.id == exam_id).first()
        elif exam_title:
            target_exam = db.query(Exam).filter(Exam.title.ilike(f"%{exam_title.strip()}%")).first()
        
        if not target_exam:
            # Fallback to the latest active exam
            target_exam = db.query(Exam).filter(Exam.status.in_(["ACTIVATED", "COMPLETED", "PUBLISHED"])).order_by(Exam.id.desc()).first()

        if not target_exam:
            return {"error": "No examination found matching criteria.", "results": []}

        q = db.query(ExamAttempt, Candidate).join(Candidate, ExamAttempt.candidate_id == Candidate.id)
        q = q.filter(ExamAttempt.exam_id == target_exam.id)

        if min_score is not None:
            q = q.filter(ExamAttempt.score >= min_score)
        if max_score is not None:
            q = q.filter(ExamAttempt.score <= max_score)

        # Sorting
        order_col = ExamAttempt.score
        if sort_by.lower() in ["percentage", "percent"]:
            order_col = ExamAttempt.percentage
        elif sort_by.lower() in ["date", "submitted", "submitted_at"]:
            order_col = ExamAttempt.submitted_at

        if sort_order.lower() == "asc":
            q = q.order_by(asc(order_col))
        else:
            q = q.order_by(desc(order_col))

        total_attempts = q.count()
        attempts = q.limit(min(limit, 50)).all()

        # Calculate high-level stats
        stats = db.query(
            func.avg(ExamAttempt.score).label("avg_score"),
            func.max(ExamAttempt.score).label("max_score"),
            func.min(ExamAttempt.score).label("min_score"),
            func.count(ExamAttempt.id).label("total")
        ).filter(ExamAttempt.exam_id == target_exam.id).first()

        ranked_list = []
        for att, cand in attempts:
            ranked_list.append({
                "candidate_name": cand.full_name,
                "reg_no": cand.registration_number,
                "email": cand.email,
                "score": float(att.score or 0),
                "total_marks": float(att.total_marks or target_exam.total_marks or 100),
                "percentage": float(att.percentage or 0),
                "qualification_status": att.qualification_status,
                "status": att.status,
                "batch": cand.batch,
                "submitted_at": att.submitted_at.isoformat() if att.submitted_at else None
            })

        return {
            "exam_id": target_exam.id,
            "exam_title": target_exam.title,
            "total_examinees": total_attempts,
            "stats": {
                "average_score": round(float(stats.avg_score or 0), 2) if stats else 0,
                "highest_score": float(stats.max_score or 0) if stats else 0,
                "lowest_score": float(stats.min_score or 0) if stats else 0,
            },
            "sort_applied": f"{sort_by} {sort_order}",
            "records": ranked_list
        }
    except Exception as ex:
        logger.error(f"Error querying exam results: {ex}")
        return {"error": str(ex), "records": []}

def query_candidates(
    db: Session,
    date: Optional[str] = None,
    slot: Optional[str] = None,
    department_name: Optional[str] = None,
    college_name: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = 30
) -> Dict[str, Any]:
    """Retrieve and filter candidates in the candidate directory."""
    try:
        clean_date = normalize_exam_date(date, db)
        q = db.query(Candidate)

        if clean_date and clean_date != "ALL":
            q = q.filter(Candidate.exam_date == clean_date)
        
        if slot:
            clean_slot = slot.strip()
            if "slot" in clean_slot.lower():
                q = q.filter(Candidate.batch.ilike(f"%{clean_slot}%"))
            else:
                q = q.filter(Candidate.batch.ilike(f"%Slot {clean_slot}%"))

        if department_name:
            q = q.join(Department, Candidate.department_id == Department.id, isouter=True)
            q = q.filter(Department.name.ilike(f"%{department_name.strip()}%"))

        if college_name:
            q = q.join(College, Candidate.college_id == College.id, isouter=True)
            q = q.filter(College.name.ilike(f"%{college_name.strip()}%"))

        if status:
            q = q.filter(Candidate.status.ilike(f"%{status.strip()}%"))

        if search:
            term = f"%{search.strip()}%"
            q = q.filter(
                or_(
                    Candidate.full_name.ilike(term),
                    Candidate.registration_number.ilike(term),
                    Candidate.email.ilike(term)
                )
            )

        total_matching = q.count()
        candidates = q.order_by(Candidate.id.asc()).limit(min(limit, 50)).all()

        cand_list = []
        for c in candidates:
            dept_name = c.department.name if c.department else None
            college_title = c.college.name if c.college else None
            exam_title = c.assigned_exam.title if c.assigned_exam else None

            cand_list.append({
                "id": c.id,
                "reg_no": c.registration_number,
                "name": c.full_name,
                "email": c.email,
                "department": dept_name,
                "college": college_title,
                "assigned_exam": exam_title,
                "exam_id": c.assigned_exam_id,
                "slot": c.batch,
                "exam_date": c.exam_date,
                "status": c.status
            })

        # Compute slot breakdown if date is filtered
        slot_breakdown = {}
        if clean_date and clean_date != "ALL":
            for b_name, b_cnt in db.query(Candidate.batch, func.count(Candidate.id)).filter(Candidate.exam_date == clean_date).group_by(Candidate.batch).all():
                slot_breakdown[b_name or "Unassigned"] = b_cnt

        return {
            "total_matching": total_matching,
            "resolved_date": clean_date,
            "slot_breakdown": slot_breakdown,
            "filter_applied": {
                "date": clean_date,
                "slot": slot,
                "department": department_name,
                "college": college_name,
                "search": search
            },
            "candidates": cand_list
        }
    except Exception as ex:
        logger.error(f"Error querying candidates: {ex}")
        return {"error": str(ex), "candidates": []}

def get_slot_analytics(db: Session, date: Optional[str] = None) -> Dict[str, Any]:
    """Get candidate counts per slot and overall statistics for a given date."""
    try:
        clean_date = normalize_exam_date(date, db) or "2026-11-20"

        slots_counts = db.query(
            Candidate.batch,
            func.count(Candidate.id)
        ).filter(Candidate.exam_date == clean_date).group_by(Candidate.batch).all()

        slot_summary = {}
        total_for_date = 0
        for batch_name, count in slots_counts:
            name = batch_name or "Unassigned"
            slot_summary[name] = count
            total_for_date += count

        # Also get dates available
        distinct_dates = [d[0] for d in db.query(Candidate.exam_date).filter(Candidate.exam_date.isnot(None)).distinct().all() if d[0]]

        return {
            "query_date": clean_date,
            "total_candidates_on_date": total_for_date,
            "slot_breakdown": slot_summary,
            "available_dates_in_platform": sorted(distinct_dates, reverse=True)[:10]
        }
    except Exception as ex:
        logger.error(f"Error getting slot analytics: {ex}")
        return {"error": str(ex)}

def get_departments_and_colleges(db: Session) -> Dict[str, Any]:
    """List all available departments and affiliated institutions."""
    try:
        depts = db.query(Department).all()
        colleges = db.query(College).all()
        return {
            "departments": [{"id": d.id, "name": d.name, "code": d.code} for d in depts],
            "colleges": [{"id": c.id, "name": c.name, "code": c.code} for c in colleges]
        }
    except Exception as ex:
        return {"error": str(ex)}

# Export function tool definitions for Groq / OpenAI Tool Calling
TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "query_exams",
            "description": "Look up examinations, titles, dates, durations, and status in the database.",
            "parameters": {
                "type": "object",
                "properties": {
                    "search": {"type": "string", "description": "Exam title keyword (e.g. 'MCQ', 'Placement')"},
                    "date": {"type": "string", "description": "Date in YYYY-MM-DD or MM/DD/YYYY format"},
                    "status": {"type": "string", "description": "ACTIVATED, DRAFT, COMPLETED"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "query_exam_results",
            "description": "Fetch live candidate scores, marks, pass/fail status, and top/bottom rankings for an exam.",
            "parameters": {
                "type": "object",
                "properties": {
                    "exam_id": {"type": "integer", "description": "Examination ID number (e.g. 4)"},
                    "exam_title": {"type": "string", "description": "Title of the examination"},
                    "min_score": {"type": "number", "description": "Minimum score filter"},
                    "max_score": {"type": "number", "description": "Maximum score filter"},
                    "sort_by": {"type": "string", "enum": ["score", "percentage", "date"], "description": "Column to sort by"},
                    "sort_order": {"type": "string", "enum": ["desc", "asc"], "description": "desc (high to low) or asc (low to high)"},
                    "limit": {"type": "integer", "description": "Number of top records to return"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "query_candidates",
            "description": "Search and filter candidate records by date, slot (Slot 1, Slot 2), department, college, or search query.",
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {"type": "string", "description": "Exam date in YYYY-MM-DD format or 'today'"},
                    "slot": {"type": "string", "description": "Slot name or number like 'Slot 1', 'Slot 2'"},
                    "department_name": {"type": "string", "description": "Department track name (e.g. 'Developer')"},
                    "college_name": {"type": "string", "description": "Affiliated college name"},
                    "status": {"type": "string", "description": "ACTIVE, PENDING, COMPLETED"},
                    "search": {"type": "string", "description": "Candidate name, register number, or email"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_slot_analytics",
            "description": "Get real-time examinee distribution across slots and available exam dates.",
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {"type": "string", "description": "Date in YYYY-MM-DD format or 'today'"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_departments_and_colleges",
            "description": "List all registered departments and colleges.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    }
]

def execute_tool(tool_name: str, args: Dict[str, Any], db: Session) -> Any:
    """Dispatches tool execution to the corresponding python function."""
    if tool_name == "query_exams":
        return query_exams(db, **args)
    elif tool_name == "query_exam_results":
        return query_exam_results(db, **args)
    elif tool_name == "query_candidates":
        return query_candidates(db, **args)
    elif tool_name == "get_slot_analytics":
        return get_slot_analytics(db, **args)
    elif tool_name == "get_departments_and_colleges":
        return get_departments_and_colleges(db)
    else:
        return {"error": f"Unknown tool: {tool_name}"}
