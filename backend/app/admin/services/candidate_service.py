import csv
import io
import re
import secrets
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
from sqlalchemy import func, or_, and_
from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, UploadFile, status

from app.models import (
    Candidate, CandidateAccessCode, Department, College, Exam, ExamSlot, QuestionSet, ExamAttempt,
    AttemptAnswer, AttemptRandomizedOption, AttemptRandomizedQuestion, AuditLog
)
from app.schemas import CandidateDto, CandidateAccessCodeDto, PaginatedCandidatesResponse
from app.core import EmailService

class CandidateService:
    @staticmethod
    def _to_dto(c: Candidate, attempt_status: Optional[str] = None) -> CandidateDto:
        dept_name = c.department.name if c.department else None
        college_name = c.college.name if c.college else None

        # Determine real-time exam / account status: COMPLETED, GOING ON, PENDING, or DISABLED
        if c.status and c.status.upper() == "DISABLED":
            computed_status = "DISABLED"
        elif attempt_status:
            att = attempt_status.upper()
            if att == "SUBMITTED":
                computed_status = "COMPLETED"
            elif att == "IN_PROGRESS":
                computed_status = "GOING ON"
            else:
                computed_status = "PENDING"
        else:
            computed_status = "PENDING"

        return CandidateDto(
            id=c.id,
            registration_number=c.registration_number,
            full_name=c.full_name,
            email=c.email,
            department_id=c.department_id,
            department_name=dept_name,
            college_id=c.college_id,
            college_name=college_name,
            status=computed_status,
            created_at=c.created_at,
            assigned_set=c.assigned_set,
            batch=c.batch,
            exam_date=getattr(c, "exam_date", None)
        )

    @classmethod
    def get_all_candidates(cls, db: Session, date: Optional[str] = None) -> List[CandidateDto]:
        """
        Retrieves all registered candidates with eager-loaded departments, colleges, and access codes in a single query.
        Optionally filters by examination date (YYYY-MM-DD).
        """
        query = db.query(Candidate).options(
            joinedload(Candidate.department),
            joinedload(Candidate.college),
            joinedload(Candidate.access_codes)
        )
        if date and date.strip() and date.strip().upper() != "ALL":
            d_clean = date.strip()
            query = query.filter(
                or_(
                    Candidate.exam_date == d_clean,
                    and_(
                        Candidate.exam_date == None,
                        func.to_char(func.timezone('Asia/Kolkata', Candidate.created_at), 'YYYY-MM-DD') == d_clean
                    )
                )
            )
        cands = query.all()

        # Query all attempts to accurately determine candidate progress in real time
        attempts = db.query(ExamAttempt.candidate_id, ExamAttempt.status).all()
        attempt_map: Dict[int, str] = {}
        for cand_id, att_st in attempts:
            if not cand_id:
                continue
            if att_st == "SUBMITTED":
                attempt_map[cand_id] = "SUBMITTED"
            elif att_st == "IN_PROGRESS" and attempt_map.get(cand_id) != "SUBMITTED":
                attempt_map[cand_id] = "IN_PROGRESS"
            elif cand_id not in attempt_map:
                attempt_map[cand_id] = att_st or "PENDING"

        # Natural ordering: numerical Register No. (1, 2, ... 282) first, followed by others
        cands.sort(key=lambda c: (
            0 if c.registration_number and c.registration_number.isdigit() else 1,
            int(c.registration_number) if c.registration_number and c.registration_number.isdigit() else 0,
            c.id or 0
        ))
        return [cls._to_dto(c, attempt_status=attempt_map.get(c.id)) for c in cands]

    @classmethod
    def get_available_candidate_dates(cls, db: Session) -> List[str]:
        """
        Retrieves all distinct dates on which candidates are scheduled or registered (YYYY-MM-DD),
        sorted in descending order (most upcoming/recent date first).
        """
        raw_dates = db.query(Candidate.exam_date).filter(
            Candidate.exam_date != None,
            Candidate.exam_date != ""
        ).distinct().all()
        dates_set = {d[0] for d in raw_dates if d[0]}

        fallback_dates = db.query(
            func.to_char(func.timezone('Asia/Kolkata', Candidate.created_at), 'YYYY-MM-DD')
        ).filter(
            or_(Candidate.exam_date == None, Candidate.exam_date == "")
        ).distinct().all()
        for fd in fallback_dates:
            if fd[0]:
                dates_set.add(fd[0])

        return sorted(list(dates_set), reverse=True)

    @classmethod
    def get_paginated_candidates(
        cls,
        db: Session,
        page: int = 1,
        limit: int = 30,
        search: Optional[str] = None,
        department_id: Optional[int] = None,
        college_id: Optional[int] = None,
        status: Optional[str] = None,
        batch: Optional[str] = None,
        date: Optional[str] = None,
        sort_by: str = "registration_number",
        sort_order: str = "asc"
    ) -> PaginatedCandidatesResponse:
        """
        High-performance server-side paginated candidate query.
        Filters, sorts, and limits at the SQL level, loading only the visible page
        and querying attempt status strictly for the returned candidate slice.
        Supports Academic Department, College institution, and Batch/Slot filters.
        """
        page = max(1, page)
        limit = max(1, min(200, limit))

        query = db.query(Candidate).outerjoin(Candidate.department).outerjoin(Candidate.college)

        # 1. Server-side Search filter across registration number, full name, email, department, or college
        if search and search.strip():
            s = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    Candidate.full_name.ilike(s),
                    Candidate.registration_number.ilike(s),
                    Candidate.email.ilike(s),
                    Department.name.ilike(s),
                    Department.code.ilike(s),
                    College.name.ilike(s),
                    College.code.ilike(s)
                )
            )

        # 2. Server-side Department filter
        if department_id is not None:
            query = query.filter(Candidate.department_id == department_id)

        # 3. Server-side College filter
        if college_id is not None:
            query = query.filter(Candidate.college_id == college_id)

        # 3b. Server-side Batch/Slot filter (e.g. 'Slot 1', 'Slot 2', 'UNASSIGNED', 'ALL')
        if batch and batch.strip() and batch.strip().upper() != "ALL":
            b_clean = batch.strip()
            if b_clean.upper() == "UNASSIGNED":
                query = query.filter(or_(Candidate.batch == None, Candidate.batch == ""))
            else:
                query = query.filter(Candidate.batch == b_clean)

        # 3c. Server-side Date filter (e.g. '2026-10-31', '2026-10-30', 'ALL')
        if date and date.strip() and date.strip().upper() != "ALL":
            d_clean = date.strip()
            query = query.filter(
                or_(
                    Candidate.exam_date == d_clean,
                    and_(
                        Candidate.exam_date == None,
                        func.to_char(func.timezone('Asia/Kolkata', Candidate.created_at), 'YYYY-MM-DD') == d_clean
                    )
                )
            )

        # 4. Server-side Real-time Status filter (COMPLETED, GOING ON, PENDING, DISABLED)
        if status and status.strip() and status.strip().upper() != "ALL":
            st = status.strip().upper()
            if st in ("COMPLETED", "SUBMITTED"):
                query = query.filter(
                    Candidate.id.in_(
                        db.query(ExamAttempt.candidate_id).filter(ExamAttempt.status == "SUBMITTED")
                    )
                )
            elif st in ("GOING ON", "IN_PROGRESS", "IN PROGRESS"):
                query = query.filter(
                    Candidate.id.in_(
                        db.query(ExamAttempt.candidate_id).filter(ExamAttempt.status == "IN_PROGRESS")
                    ),
                    Candidate.id.not_in(
                        db.query(ExamAttempt.candidate_id).filter(ExamAttempt.status == "SUBMITTED")
                    )
                )
            elif st == "DISABLED":
                query = query.filter(Candidate.status == "DISABLED")
            elif st == "PENDING":
                query = query.filter(
                    Candidate.status != "DISABLED",
                    Candidate.id.not_in(
                        db.query(ExamAttempt.candidate_id).filter(
                            ExamAttempt.status.in_(["SUBMITTED", "IN_PROGRESS"])
                        )
                    )
                )

        # 5. Total record count via fast scalar count
        has_filter = (
            bool(search and search.strip()) or 
            (department_id is not None) or 
            (college_id is not None) or 
            bool(batch and batch.strip() and batch.strip().upper() != "ALL") or
            bool(date and date.strip() and date.strip().upper() != "ALL") or
            bool(status and status.strip() and status.strip().upper() != "ALL")
        )
        if not has_filter:
            total = db.query(func.count(Candidate.id)).scalar() or 0
        else:
            total = query.with_entities(func.count(Candidate.id)).scalar() or 0

        # 6. Server-side Sorting
        is_desc = (sort_order.lower() == "desc")
        if sort_by == "full_name":
            query = query.order_by(Candidate.full_name.desc() if is_desc else Candidate.full_name.asc())
        elif sort_by == "email":
            query = query.order_by(Candidate.email.desc() if is_desc else Candidate.email.asc())
        elif sort_by in ("department", "department_name"):
            query = query.order_by(Department.name.desc() if is_desc else Department.name.asc())
        elif sort_by in ("college", "college_name"):
            query = query.order_by(College.name.desc() if is_desc else College.name.asc())
        elif sort_by == "batch":
            query = query.order_by(Candidate.batch.desc() if is_desc else Candidate.batch.asc())
        elif sort_by == "created_at":
            query = query.order_by(Candidate.created_at.desc() if is_desc else Candidate.created_at.asc())
        else:  # registration_number or default
            query = query.order_by(Candidate.id.desc() if is_desc else Candidate.id.asc())

        # 7. Slice only the requested page with both department and college eager-loaded
        offset_val = (page - 1) * limit
        cands = query.options(
            joinedload(Candidate.department),
            joinedload(Candidate.college)
        ).offset(offset_val).limit(limit).all()

        # 7. Query attempts ONLY for the current page slice (eliminates loading all attempts in database)
        cand_ids = [c.id for c in cands]
        attempt_map: Dict[int, str] = {}
        if cand_ids:
            attempts = db.query(ExamAttempt.candidate_id, ExamAttempt.status).filter(
                ExamAttempt.candidate_id.in_(cand_ids)
            ).all()
            for cid, att_st in attempts:
                if not cid:
                    continue
                if att_st == "SUBMITTED":
                    attempt_map[cid] = "SUBMITTED"
                elif att_st == "IN_PROGRESS" and attempt_map.get(cid) != "SUBMITTED":
                    attempt_map[cid] = "IN_PROGRESS"
                elif cid not in attempt_map:
                    attempt_map[cid] = att_st or "PENDING"

        total_pages = max(1, (total + limit - 1) // limit) if total > 0 else 1
        has_more = page < total_pages
        items = [cls._to_dto(c, attempt_status=attempt_map.get(c.id)) for c in cands]

        return PaginatedCandidatesResponse(
            items=items,
            total=total,
            page=page,
            limit=limit,
            total_pages=total_pages,
            has_more=has_more
        )

    @classmethod
    def create_candidate(cls, db: Session, dto: CandidateDto, performed_by: str) -> CandidateDto:
        reg_num = dto.registration_number.strip().upper()
        if db.query(Candidate).filter(Candidate.registration_number.ilike(reg_num)).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Candidate with Registration Number '{reg_num}' already exists"
            )

        email = dto.email.strip().lower()
        if db.query(Candidate).filter(Candidate.email.ilike(email)).first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Candidate with email '{email}' already exists"
            )

        dept = None
        if dto.department_id:
            dept = db.query(Department).filter(Department.id == dto.department_id).first()

        college = None
        if dto.college_id:
            college = db.query(College).filter(College.id == dto.college_id).first()
        elif dto.college_name:
            cname = dto.college_name.strip()
            college = db.query(College).filter(func.lower(College.name) == cname.lower()).first()

        c = Candidate(
            registration_number=reg_num,
            full_name=dto.full_name.strip(),
            email=email,
            department_id=dept.id if dept else None,
            college_id=college.id if college else None,
            batch=dto.batch.strip() if dto.batch else None,
            status="ACTIVE",
            created_at=datetime.now(timezone.utc)
        )
        db.add(c)
        db.flush()

        db.add(AuditLog(
            action="CREATE_CANDIDATE",
            entity_type="Candidate",
            entity_id=str(c.id),
            performed_by=performed_by,
            details=f"Registered candidate: {c.full_name} ({reg_num})"
        ))
        db.commit()
        db.refresh(c)
        return cls._to_dto(c)

    @classmethod
    def import_candidates_csv_sync(cls, db: Session, file: UploadFile, performed_by: str) -> Dict[str, Any]:
        """
        Imports candidates in bulk from uploaded PDF, Excel (.xlsx/.xls), Word (.docx), or CSV file.
        Dynamically resolves column mappings (RegNumber/Sl.No, FullName, Email, College/Department),
        handles arbitrary column arrangements, and applies cell-level regex detection.
        """
        content = file.file.read()
        if not content:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")

        filename = (file.filename or "").lower()
        rows: List[List[str]] = []

        if filename.endswith((".xlsx", ".xls")):
            try:
                import openpyxl
                wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
                for ws in wb.worksheets:
                    for r in ws.iter_rows(values_only=True):
                        if any(r):
                            rows.append([str(cell).replace('\n', ' ').strip() if cell is not None else "" for cell in r])
            except Exception as e:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to parse Excel file: {e}")

        elif filename.endswith(".docx"):
            try:
                import docx
                doc = docx.Document(io.BytesIO(content))
                for table in doc.tables:
                    for row in table.rows:
                        cell_vals = [cell.text.replace('\n', ' ').strip() for cell in row.cells]
                        if any(cell_vals):
                            rows.append(cell_vals)
                if not rows:
                    for p in doc.paragraphs:
                        text_line = p.text.strip()
                        if text_line:
                            parts = [pt.strip() for pt in re.split(r'\t+|\s{2,}', text_line) if pt.strip()]
                            if len(parts) >= 2:
                                rows.append(parts)
            except Exception as e:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to parse Word document: {e}")

        elif filename.endswith(".pdf"):
            try:
                try:
                    import pymupdf
                except ImportError:
                    try:
                        import fitz as pymupdf
                    except ImportError:
                        pymupdf = None

                if pymupdf is not None:
                    doc = pymupdf.open(stream=io.BytesIO(content), filetype="pdf")
                    for page in doc:
                        tables = page.find_tables()
                        if tables and tables.tables:
                            for t in tables:
                                for row in t.extract():
                                    if any(row):
                                        rows.append([str(c or "").replace('\n', ' ').strip() for c in row])
                        else:
                            # Fallback: cluster words by vertical y0 coordinate with 3.0pt tolerance
                            words = page.get_text("words")
                            if words:
                                words.sort(key=lambda w: (w[1], w[0]))
                                curr_line = []
                                curr_y = None
                                for w in words:
                                    y = w[1]
                                    if curr_y is None or abs(y - curr_y) > 3.0:
                                        if curr_line:
                                            rows.append([" ".join([x[4] for x in curr_line])])
                                        curr_line = [w]
                                        curr_y = y
                                    else:
                                        curr_line.append(w)
                                if curr_line:
                                    rows.append([" ".join([x[4] for x in curr_line])])
                            else:
                                for line in page.get_text("text").splitlines():
                                    if line.strip():
                                        rows.append([line.strip()])
                    doc.close()
                else:
                    import pypdf
                    reader = pypdf.PdfReader(io.BytesIO(content))
                    for page in reader.pages:
                        text = page.extract_text()
                        if text:
                            for line in text.splitlines():
                                if line.strip():
                                    rows.append([line.strip()])
            except Exception as e:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Failed to parse PDF document: {e}")
        else:
            text = ""
            for encoding in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
                try:
                    text = content.decode(encoding)
                    break
                except UnicodeDecodeError:
                    continue
            if text:
                reader = csv.reader(io.StringIO(text))
                rows = [[str(c).replace('\n', ' ').strip() for c in r] for r in reader if any(r)]

        created_list: List[CandidateDto] = []
        errors: List[str] = []

        # Pre-cache existing registration numbers, emails, and departments
        existing_regs = {r[0].upper() for r in db.query(Candidate.registration_number).all() if r[0]}
        existing_emails = {e[0].lower() for e in db.query(Candidate.email).all() if e[0]}
        dept_map = {d.code.upper(): d.id for d in db.query(Department).all() if d.code}

        # Detect Header Row in top 15 rows
        reg_idx, name_idx, email_idx, college_idx = None, None, None, None
        header_row_idx = -1

        for idx, r in enumerate(rows[:15]):
            if len(r) < 3:
                continue
            r_clean = [re.sub(r'\s+', ' ', cell.lower().strip()) for cell in r]
            has_email = any("email" in c or "e-mail" in c or "mail" in c for c in r_clean)
            has_name = any("name" in c and "institute" not in c and "college" not in c for c in r_clean)
            has_reg = any("reg" in c or "sl" in c or "s.no" in c or "roll" in c or "id" in c for c in r_clean)

            if has_email or (has_name and has_reg):
                header_row_idx = idx
                for c_idx, cell in enumerate(r_clean):
                    if ("email" in cell or "e-mail" in cell or "mail" in cell) and email_idx is None:
                        email_idx = c_idx
                    elif ("candidate name" in cell or "full name" in cell or "student name" in cell or ("name" in cell and "institute" not in cell and "college" not in cell)) and name_idx is None:
                        name_idx = c_idx
                    elif ("sl" in cell or "s.no" in cell or "reg" in cell or "roll" in cell or "serial" in cell) and reg_idx is None:
                        reg_idx = c_idx
                    elif ("institute" in cell or "college" in cell or "dept" in cell or "department" in cell or "branch" in cell) and college_idx is None:
                        college_idx = c_idx
                if email_idx is not None:
                    break

        email_regex = re.compile(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+')
        college_keywords = ["COLLEGE", "INSTITUTE", "ENGINEERING", "TECHNOLOGY", "UNIVERSITY", "POLYTECHNIC"]
        start_idx = header_row_idx + 1 if header_row_idx >= 0 else 0

        new_candidates = []
        line_num = 0

        for r in rows[start_idx:]:
            line_num += 1
            if not r or all(not str(col).strip() for col in r):
                continue

            # Case A: Single concatenated line from word clustering or OCR text
            if len(r) == 1 or (len(r) < 3 and "@" in r[0]):
                line = r[0]
                m = email_regex.search(line)
                if not m:
                    continue
                email = m.group(0).lower()

                # Extract college if keyword present
                college_or_dept = None
                upper_line = line.upper()
                for kw in college_keywords:
                    if kw in upper_line:
                        col_match = re.search(r'\b[A-Z\s&]+(?:COLLEGE|INSTITUTE|UNIVERSITY|TECHNOLOGY)[A-Z\s&]*', upper_line)
                        if col_match:
                            raw_col = col_match.group(0).strip()
                            college_or_dept = re.sub(r'\s+(NO|YES|FEMALE|MALE|\d+.*)$', '', raw_col, flags=re.I).strip()
                        break

                # Extract Registration / Serial No.
                reg_match = re.search(r'\b(\d{1,5})\b', line)
                reg_num = reg_match.group(1) if reg_match else str(len(new_candidates) + 1)

                # Extract Name (capitalized words before keywords)
                name_match = re.match(r'^(?:\d+\s+)?([A-Z\s\.\'\-]+?)(?:\s+(?:SOFTWARE|DEVELOPER|TESTER|FEMALE|MALE|B\.E|B\.TECH|CSE|ISE)\b)', line, re.I)
                if name_match:
                    full_name = name_match.group(1).strip()
                else:
                    full_name = email.split("@")[0].replace(".", " ").title()

            # Case B: Multi-column row (from Excel, CSV, or PDF table)
            else:
                email = None
                if email_idx is not None and email_idx < len(r) and "@" in r[email_idx]:
                    m = email_regex.search(r[email_idx])
                    if m:
                        email = m.group(0).lower()
                if not email:
                    for cell in r:
                        if "@" in cell:
                            m = email_regex.search(cell)
                            if m:
                                email = m.group(0).lower()
                                break

                if not email:
                    continue

                # Extract Name
                full_name = None
                if name_idx is not None and name_idx < len(r) and r[name_idx]:
                    val = r[name_idx].strip()
                    if "@" not in val and not val.isdigit() and len(val) >= 2:
                        full_name = val
                if not full_name:
                    for cell in r:
                        c_clean = cell.strip()
                        if c_clean and "@" not in c_clean and not c_clean.isdigit() and len(c_clean) >= 2:
                            c_up = c_clean.upper()
                            if not any(kw in c_up for kw in college_keywords + ["MALE", "FEMALE"]):
                                full_name = c_clean
                                break
                if not full_name:
                    full_name = email.split("@")[0].replace(".", " ").title()

                # Extract Reg / Sl. No
                reg_num = None
                if reg_idx is not None and reg_idx < len(r) and r[reg_idx]:
                    reg_num = r[reg_idx].strip().upper()
                if not reg_num:
                    for cell in r:
                        c_clean = cell.strip()
                        if c_clean and (c_clean.isdigit() or c_clean.upper().startswith("REG")):
                            reg_num = c_clean.upper()
                            break
                if not reg_num:
                    reg_num = str(len(new_candidates) + 1)

                # Extract College / Department
                college_or_dept = None
                if college_idx is not None and college_idx < len(r) and r[college_idx]:
                    college_or_dept = r[college_idx].strip()
                if not college_or_dept:
                    for cell in r:
                        c_clean = cell.strip()
                        c_up = c_clean.upper()
                        if any(kw in c_up for kw in college_keywords):
                            college_or_dept = c_clean
                            break

            if reg_num in existing_regs:
                errors.append(f"Line {line_num}: Registration number '{reg_num}' is already in use.")
                continue

            if email in existing_emails:
                errors.append(f"Line {line_num}: Email '{email}' is already in use.")
                continue

            # Resolve Department or College Name
            dept_id = None
            if college_or_dept:
                clean_cd = college_or_dept.strip()
                if clean_cd.upper() in dept_map:
                    dept_id = dept_map[clean_cd.upper()]
                else:
                    existing_dept = db.query(Department).filter(func.lower(Department.name) == clean_cd.lower()).first()
                    if existing_dept:
                        dept_id = existing_dept.id
                    else:
                        new_dept = Department(
                            name=clean_cd,
                            code=re.sub(r'[^A-Z0-9]', '', clean_cd.upper())[:10] or "COLLEGE",
                            description=f"College: {clean_cd}",
                            active=True
                        )
                        db.add(new_dept)
                        db.commit()
                        db.refresh(new_dept)
                        dept_id = new_dept.id
                        dept_map[new_dept.code.upper()] = dept_id

            c = Candidate(
                registration_number=reg_num,
                full_name=full_name,
                email=email,
                department_id=dept_id,
                status="ACTIVE",
                created_at=datetime.now(timezone.utc)
            )
            new_candidates.append(c)
            existing_regs.add(reg_num)
            existing_emails.add(email)

        if new_candidates:
            db.add_all(new_candidates)
            db.commit()
            for cand in new_candidates:
                db.refresh(cand)
                created_list.append(cls._to_dto(cand))

            db.add(AuditLog(
                action="BATCH_IMPORT_CANDIDATES",
                entity_type="Candidate",
                entity_id="BATCH",
                performed_by=performed_by,
                details=f"Batch imported {len(new_candidates)} candidates via CSV"
            ))
            db.commit()

        return {
            "success": True,
            "totalImported": len(created_list),
            "errorsCount": len(errors),
            "errors": errors,
            "candidates": [c.model_dump(by_alias=True) for c in created_list]
        }

    @classmethod
    def assign_candidate_to_exam(
        cls, db: Session, candidate_id: int, exam_id: int,
        slot_id: Optional[int], set_code: Optional[str], performed_by: str
    ) -> ExamAttempt:
        candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
        if not candidate:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

        exam = db.query(Exam).filter(Exam.id == exam_id).first()
        if not exam:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam not found")

        # Check existing attempt
        existing = db.query(ExamAttempt).filter(
            ExamAttempt.candidate_id == candidate_id,
            ExamAttempt.exam_id == exam_id
        ).first()
        if existing:
            return existing

        # Choose question set (respecting candidate's department if configured)
        q_sets = db.query(QuestionSet).filter(QuestionSet.exam_id == exam_id).all()
        if not q_sets:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No question sets configured for this exam")

        if candidate.department_id:
            dept_sets = [qs for qs in q_sets if qs.department_id == candidate.department_id]
            if dept_sets:
                q_sets = dept_sets

        target_set = None
        if set_code:
            for qs in q_sets:
                if qs.set_code == set_code.upper():
                    target_set = qs
                    break
        if not target_set:
            target_set = q_sets[0]

        # Slot check
        slot = None
        if slot_id:
            slot = db.query(ExamSlot).filter(ExamSlot.id == slot_id).first()

        try:
            attempt = ExamAttempt(
                candidate_id=candidate.id,
                exam_id=exam.id,
                slot_id=slot.id if slot else None,
                question_set_id=target_set.id,
                status="ASSIGNED",
                created_at=datetime.now(timezone.utc)
            )
            db.add(attempt)
            db.commit()
            db.refresh(attempt)

            db.add(AuditLog(
                action="ASSIGN_EXAM_CANDIDATE",
                entity_type="ExamAttempt",
                entity_id=str(attempt.id),
                performed_by=performed_by,
                details=f"Assigned candidate {candidate.registration_number} to exam {exam.id} (Set {target_set.set_code})"
            ))
            db.commit()
        except Exception:
            db.rollback()
            raise
        return attempt

    @classmethod
    def generate_access_code(
        cls, db: Session, candidate_id: int, performed_by: str, round_name: str = "ROUND_1", force_new: bool = False
    ) -> CandidateAccessCodeDto:
        """
        Generates/resets a secure Unique Access ID valid for strictly 3 uses for the given round.
        Format:
          Canonical initial: MCQ-<REGISTRATION_NUMBER> or CODE-<REGISTRATION_NUMBER>
          When force_new=True and code exists: increments to MCQ-<REG>-2, MCQ-<REG>-3, etc.
        Deactivates previous codes for this candidate & round, and activates the new Unique ID with 3 fresh attempts.
        """
        candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
        if not candidate:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

        r_upper = round_name.upper()
        prefix = "MCQ" if r_upper == "ROUND_1" else "CODE"

        # Sanitize candidate registration: uppercase, strip accidental leading MCQ- or CODE- prefixes
        raw_reg = candidate.registration_number.strip().upper()
        clean_reg = re.sub(r'^(MCQ|CODE)[-_]', '', raw_reg) or raw_reg
        base_code = f"{prefix}-{clean_reg}"

        now = datetime.now(timezone.utc)

        # Retrieve all existing access codes for this candidate & round
        existing_codes = db.query(CandidateAccessCode).filter(
            CandidateAccessCode.candidate_id == candidate_id,
            CandidateAccessCode.round == r_upper
        ).order_by(CandidateAccessCode.created_at.desc()).all()

        target_code = base_code
        ac = None

        if not existing_codes:
            # First time generating code for this candidate and round: use base canonical code
            taken = db.query(CandidateAccessCode).filter(CandidateAccessCode.code == base_code).first()
            if taken and taken.candidate_id != candidate.id:
                next_v = 2
                while db.query(CandidateAccessCode).filter(CandidateAccessCode.code == f"{base_code}-{next_v}").first():
                    next_v += 1
                target_code = f"{base_code}-{next_v}"
            else:
                target_code = base_code

            ac = CandidateAccessCode(
                candidate_id=candidate.id,
                code=target_code,
                round=r_upper,
                usage_count=0,
                max_uses=3,
                is_active=True,
                created_at=now
            )
            db.add(ac)
            db.flush()
        else:
            if not force_new:
                # If not forcing new, re-activate and reset the canonical or latest code
                canonical_ac = next((c for c in existing_codes if c.code == base_code), None)
                ac = canonical_ac or existing_codes[0]
                ac.is_active = True
                ac.usage_count = 0
                ac.max_uses = 3
                ac.created_at = now
                ac.last_used_at = None
                target_code = ac.code

                for other in existing_codes:
                    if other.id != ac.id:
                        other.is_active = False
            else:
                # force_new == True: Generate a brand new, distinct versioned Unique ID
                versions = [1]
                for c in existing_codes:
                    m = re.match(r"^" + re.escape(base_code) + r"-(\d+)$", c.code)
                    if m:
                        try:
                            versions.append(int(m.group(1)))
                        except ValueError:
                            pass
                    elif c.code == base_code:
                        versions.append(1)

                next_ver = max(versions) + 1
                target_code = f"{base_code}-{next_ver}"

                # Ensure global uniqueness across candidate_access_codes table
                while db.query(CandidateAccessCode).filter(CandidateAccessCode.code == target_code).first():
                    next_ver += 1
                    target_code = f"{base_code}-{next_ver}"

                # Deactivate all previous codes for this candidate & round
                for old in existing_codes:
                    old.is_active = False

                ac = CandidateAccessCode(
                    candidate_id=candidate.id,
                    code=target_code,
                    round=r_upper,
                    usage_count=0,
                    max_uses=3,
                    is_active=True,
                    created_at=now
                )
                db.add(ac)
                db.flush()

        db.add(AuditLog(
            action="GENERATE_ACCESS_CODE",
            entity_type="CandidateAccessCode",
            entity_id=target_code,
            performed_by=performed_by,
            details=f"Generated {r_upper} Unique Access ID {target_code} (3-use limit) for candidate {candidate.registration_number}"
        ))
        db.commit()
        db.refresh(ac)

        return CandidateAccessCodeDto(
            id=ac.id,
            candidate_id=ac.candidate_id,
            code=ac.code,
            usage_count=ac.usage_count,
            max_uses=ac.max_uses,
            is_active=ac.is_active,
            created_at=ac.created_at
        )

    @classmethod
    def get_round_ids_map(cls, db: Session, round_name: str = "ROUND_1") -> Dict[str, str]:
        """
        Returns a dictionary mapping candidate registration numbers to their active Unique ID for the given round.
        """
        r_upper = round_name.upper()
        codes = db.query(CandidateAccessCode).join(Candidate).filter(
            CandidateAccessCode.round == r_upper,
            CandidateAccessCode.is_active == True,
            CandidateAccessCode.usage_count < CandidateAccessCode.max_uses
        ).order_by(CandidateAccessCode.created_at.desc()).all()

        mapping = {}
        for c in codes:
            if c.candidate:
                reg = c.candidate.registration_number.strip().upper()
                if reg not in mapping:
                    mapping[reg] = c.code
        return mapping

    @classmethod
    def batch_generate_round_ids(
        cls, db: Session, round_name: str = "ROUND_1", performed_by: str = "ADMIN", force_new: bool = False
    ) -> Dict[str, Any]:
        """
        Generates Unique Access IDs (strictly 3-use limit) for all eligible candidates in the selected round.
        When force_new=True, generates a new Unique ID for each candidate.
        """
        r_upper = round_name.upper()
        candidates = db.query(Candidate).filter(Candidate.status == "ACTIVE").all()

        # Filter for Round 2 technical departments if applicable
        tech_keywords = ["developer", "tester", "qa", "computer science", "cse", "information technology", "it", "electronics", "ece", "software"]
        eligible_candidates = []
        for c in candidates:
            if r_upper == "ROUND_2":
                dept = (c.department.name if c.department else "").lower()
                if not dept or any(k in dept for k in tech_keywords):
                    eligible_candidates.append(c)
            else:
                eligible_candidates.append(c)

        newly_generated = 0
        already_existed = 0
        round_map: Dict[str, str] = {}

        for cand in eligible_candidates:
            reg_upper = cand.registration_number.strip().upper()

            if not force_new:
                active_code = db.query(CandidateAccessCode).filter(
                    CandidateAccessCode.candidate_id == cand.id,
                    CandidateAccessCode.round == r_upper,
                    CandidateAccessCode.is_active == True,
                    CandidateAccessCode.usage_count < CandidateAccessCode.max_uses
                ).order_by(CandidateAccessCode.created_at.desc()).first()

                if active_code:
                    already_existed += 1
                    round_map[reg_upper] = active_code.code
                    continue

            dto = cls.generate_access_code(db, cand.id, performed_by, round_name=r_upper, force_new=force_new)
            round_map[reg_upper] = dto.code
            newly_generated += 1

        return {
            "success": True,
            "round": r_upper,
            "totalEligible": len(eligible_candidates),
            "newlyGenerated": newly_generated,
            "alreadyExisted": already_existed,
            "roundIds": round_map
        }

    @classmethod
    def send_access_code_email(
        cls, db: Session, candidate_id: int, performed_by: str, round_name: str = "ROUND_1"
    ) -> Dict[str, Any]:
        """
        Generates/fetches the candidate's unique access code and sends it to their email address.
        """
        candidate = db.query(Candidate).options(
            joinedload(Candidate.access_codes)
        ).filter(Candidate.id == candidate_id).first()
        if not candidate:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

        if not candidate.email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Candidate has no registered email address")

        r_upper = round_name.upper()

        # Fetch current active code with remaining uses for this round, or generate a fresh one
        active_code = next(
            (ac for ac in candidate.access_codes if ac.is_active and ac.round == r_upper and ac.usage_count < ac.max_uses),
            None
        )

        if not active_code:
            code_dto = cls.generate_access_code(db, candidate_id, performed_by, round_name=r_upper)
            active_code = db.query(CandidateAccessCode).filter(CandidateAccessCode.id == code_dto.id).first()

        exam_round_title = "Round 1: Multiple Choice Examination" if r_upper == "ROUND_1" else "Round 2: Technical Coding Assessment"

        # Send email via EmailService
        delivery_res = EmailService.send_unique_id_email(
            to_email=candidate.email,
            candidate_name=candidate.full_name,
            access_code=active_code.code,
            max_uses=active_code.max_uses,
            exam_title=exam_round_title
        )

        # Record sent metadata
        now = datetime.now(timezone.utc)
        active_code.sent_to_email = candidate.email
        active_code.sent_at = now

        db.add(AuditLog(
            action="SEND_ACCESS_CODE_EMAIL",
            entity_type="CandidateAccessCode",
            entity_id=active_code.code,
            performed_by=performed_by,
            details=f"Sent {r_upper} access ID {active_code.code} via {delivery_res.get('provider')} to {candidate.email}"
        ))
        db.commit()

        return {
            "success": delivery_res.get("success", False),
            "candidateId": candidate.id,
            "candidateName": candidate.full_name,
            "email": candidate.email,
            "round": r_upper,
            "accessCode": active_code.code,
            "usageCount": active_code.usage_count,
            "maxUses": active_code.max_uses,
            "provider": delivery_res.get("provider", "unknown"),
            "message": delivery_res.get("message", "Email sent successfully")
        }

    @classmethod
    def generate_selected_round_ids(
        cls, db: Session, candidate_ids: List[int], round_name: str = "ROUND_1", performed_by: str = "ADMIN", force_new: bool = False
    ) -> Dict[str, Any]:
        """
        Generates/resets Unique Access IDs for the specified selected candidate IDs.
        Enforces uniform pattern (MCQ-<REG> or CODE-<REG>), 3-use limits, and database validation.
        """
        if not candidate_ids:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No candidate IDs provided for ID generation.")

        r_upper = round_name.upper()
        round_map: Dict[str, str] = {}
        failed_ids: List[int] = []
        generated_count = 0

        for cid in candidate_ids:
            try:
                dto = cls.generate_access_code(db, cid, performed_by, round_name=r_upper, force_new=force_new)
                cand = db.query(Candidate).filter(Candidate.id == cid).first()
                if cand:
                    round_map[cand.registration_number.strip().upper()] = dto.code
                    generated_count += 1
            except Exception as e:
                failed_ids.append(cid)

        return {
            "success": len(failed_ids) == 0,
            "round": r_upper,
            "totalSelected": len(candidate_ids),
            "generatedCount": generated_count,
            "failedIds": failed_ids,
            "roundIds": round_map
        }

    @classmethod
    def assign_candidate_set(
        cls, db: Session, candidate_id: int, set_code: Optional[str], performed_by: str = "ADMIN"
    ) -> CandidateDto:
        """
        Assigns or updates the question paper set (Set A, Set B, Set C, Set D, or None) for a candidate.
        If the candidate has an existing attempt with status 'ASSIGNED', updates the attempt's question set.
        Preserves 'IN_PROGRESS' and 'SUBMITTED' attempts.
        """
        candidate = db.query(Candidate).options(
            joinedload(Candidate.department),
            joinedload(Candidate.access_codes)
        ).filter(Candidate.id == candidate_id).first()

        if not candidate:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

        normalized_set = normalize_set_code(set_code)
        previous_set = candidate.assigned_set
        candidate.assigned_set = normalized_set

        # If candidate has an existing attempt that is pending start (status == "ASSIGNED"),
        # update the attempt to the matching QuestionSet if one exists
        if normalized_set:
            clean_letter = normalized_set.replace("Set ", "").strip().upper()
            pending_attempts = db.query(ExamAttempt).filter(
                ExamAttempt.candidate_id == candidate_id,
                ExamAttempt.status == "ASSIGNED"
            ).all()

            for attempt in pending_attempts:
                dept_id = candidate.department_id
                target_qs = None
                if dept_id:
                    target_qs = db.query(QuestionSet).filter(
                        QuestionSet.exam_id == attempt.exam_id,
                        QuestionSet.department_id == dept_id,
                        func.upper(QuestionSet.set_code) == clean_letter
                    ).first()
                if not target_qs:
                    target_qs = db.query(QuestionSet).filter(
                        QuestionSet.exam_id == attempt.exam_id,
                        func.upper(QuestionSet.set_code) == clean_letter
                    ).first()
                if target_qs:
                    attempt.question_set_id = target_qs.id

        db.add(AuditLog(
            action="ASSIGN_QUESTION_PAPER_SET",
            entity_type="Candidate",
            entity_id=str(candidate.id),
            performed_by=performed_by,
            details=f"Assigned Question Paper Set '{normalized_set or 'Unassigned'}' (previously '{previous_set or 'Unassigned'}') to {candidate.full_name} ({candidate.registration_number})"
        ))
        db.commit()
        db.refresh(candidate)
        return cls._to_dto(candidate)

    @classmethod
    def batch_assign_candidate_set(
        cls, db: Session, candidate_ids: List[int], set_code: Optional[str], performed_by: str = "ADMIN"
    ) -> Dict[str, Any]:
        """
        Batch assigns a question paper set (Set A, Set B, Set C, Set D, or None) to multiple candidates.
        """
        if not candidate_ids:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No candidate IDs provided for batch assignment.")

        normalized_set = normalize_set_code(set_code)
        candidates = db.query(Candidate).filter(Candidate.id.in_(candidate_ids)).all()
        clean_letter = normalized_set.replace("Set ", "").strip().upper() if normalized_set else None

        updated_count = 0
        for cand in candidates:
            cand.assigned_set = normalized_set
            updated_count += 1

            if clean_letter:
                pending_attempts = db.query(ExamAttempt).filter(
                    ExamAttempt.candidate_id == cand.id,
                    ExamAttempt.status == "ASSIGNED"
                ).all()
                for attempt in pending_attempts:
                    dept_id = cand.department_id
                    target_qs = None
                    if dept_id:
                        target_qs = db.query(QuestionSet).filter(
                            QuestionSet.exam_id == attempt.exam_id,
                            QuestionSet.department_id == dept_id,
                            func.upper(QuestionSet.set_code) == clean_letter
                        ).first()
                    if not target_qs:
                        target_qs = db.query(QuestionSet).filter(
                            QuestionSet.exam_id == attempt.exam_id,
                            func.upper(QuestionSet.set_code) == clean_letter
                        ).first()
                    if target_qs:
                        attempt.question_set_id = target_qs.id

        db.add(AuditLog(
            action="BATCH_ASSIGN_QUESTION_PAPER_SET",
            entity_type="Candidate",
            entity_id="BATCH",
            performed_by=performed_by,
            details=f"Batch assigned Question Paper Set '{normalized_set or 'Unassigned'}' to {updated_count} candidates."
        ))
        db.commit()
        return {
            "success": True,
            "updatedCount": updated_count,
            "assignedSet": normalized_set
        }

    @classmethod
    def batch_assign_candidate_batch(
        cls, db: Session, candidate_ids: List[int], batch: Optional[str], performed_by: str = "ADMIN"
    ) -> Dict[str, Any]:
        """Batch assigns a batch/slot (e.g. Slot 1, Slot 2, or None) to selected candidate IDs."""
        if not candidate_ids:
            return {"success": True, "updatedCount": 0, "batch": batch}

        cleaned_batch = (batch or "").strip() if batch and batch.strip().lower() not in ("none", "unassigned", "null", "") else None

        updated_count = db.query(Candidate).filter(
            Candidate.id.in_(candidate_ids)
        ).update(
            {"batch": cleaned_batch},
            synchronize_session=False
        )
        db.add(AuditLog(
            action="BATCH_ASSIGN_CANDIDATE_BATCH",
            entity_type="Candidate",
            entity_id="BATCH",
            performed_by=performed_by,
            details=f"Batch assigned {updated_count} candidates to batch '{cleaned_batch or 'Unassigned'}'."
        ))
        db.commit()
        return {"success": True, "updatedCount": updated_count, "batch": cleaned_batch}

    @classmethod
    def assign_candidate_batch(
        cls, db: Session, candidate_id: int, batch: Optional[str], performed_by: str = "ADMIN"
    ) -> Dict[str, Any]:
        """Assigns or updates a batch/slot for a single candidate."""
        cand = db.query(Candidate).filter(Candidate.id == candidate_id).first()
        if not cand:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")
        cleaned_batch = (batch or "").strip() if batch and batch.strip().lower() not in ("none", "unassigned", "null", "") else None
        cand.batch = cleaned_batch
        db.add(AuditLog(
            action="ASSIGN_CANDIDATE_BATCH",
            entity_type="Candidate",
            entity_id=str(cand.id),
            performed_by=performed_by,
            details=f"Assigned candidate {cand.registration_number} to batch '{cleaned_batch or 'Unassigned'}'."
        ))
        db.commit()
        db.refresh(cand)
        return {"success": True, "candidateId": cand.id, "batch": cand.batch}

    @classmethod
    def reschedule_candidate_slot(
        cls,
        db: Session,
        candidate_id: int,
        target_slot: str = "Slot 2",
        reset_attempt: bool = True,
        performed_by: str = "ADMIN",
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Reschedules an individual candidate to a different exam slot (e.g. Slot 1 -> Slot 2)
        and resets previous attempt records so the student can start fresh without timers
        being expired or being blocked by previous submissions.
        """
        cand = db.query(Candidate).filter(Candidate.id == candidate_id).first()
        if not cand:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Candidate not found")

        old_slot = cand.batch or "Unassigned"
        cleaned_target = (target_slot or "").strip()
        cand.batch = cleaned_target

        reset_count = 0
        if reset_attempt:
            attempts = db.query(ExamAttempt).filter(ExamAttempt.candidate_id == cand.id).all()
            for att in attempts:
                db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id == att.id).delete()
                db.query(AttemptRandomizedOption).filter(AttemptRandomizedOption.attempt_id == att.id).delete()
                db.query(AttemptRandomizedQuestion).filter(AttemptRandomizedQuestion.attempt_id == att.id).delete()
                db.delete(att)
                reset_count += 1
            cand.status = "ACTIVE"

        db.add(AuditLog(
            action="RESCHEDULE_CANDIDATE_SLOT",
            entity_type="Candidate",
            entity_id=str(cand.id),
            performed_by=performed_by,
            details=f"Rescheduled candidate {cand.registration_number} ({cand.full_name}) from '{old_slot}' to '{cleaned_target}'. Attempts reset: {reset_count}. Reason: {reason or 'Candidate reschedule request'}."
        ))
        db.commit()
        db.refresh(cand)
        return {
            "success": True,
            "candidateId": cand.id,
            "registrationNumber": cand.registration_number,
            "fullName": cand.full_name,
            "oldSlot": old_slot,
            "newSlot": cand.batch,
            "attemptsReset": reset_count,
            "message": f"Successfully moved {cand.full_name} ({cand.registration_number}) to {cleaned_target}" + (" with exam attempt reset." if reset_attempt else ".")
        }

    @classmethod
    def batch_reschedule_candidate_slot(
        cls,
        db: Session,
        candidate_ids: List[int],
        target_slot: str = "Slot 2",
        reset_attempt: bool = True,
        performed_by: str = "ADMIN",
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Batch reschedules multiple candidates to a target slot (e.g., Slot 2)
        and resets their previous attempts so all candidates can start cleanly.
        """
        if not candidate_ids:
            return {"success": True, "rescheduledCount": 0, "message": "No candidates provided"}

        candidates = db.query(Candidate).filter(Candidate.id.in_(candidate_ids)).all()
        cleaned_target = (target_slot or "").strip()
        total_resets = 0

        for cand in candidates:
            cand.batch = cleaned_target
            if reset_attempt:
                attempts = db.query(ExamAttempt).filter(ExamAttempt.candidate_id == cand.id).all()
                for att in attempts:
                    db.query(AttemptAnswer).filter(AttemptAnswer.attempt_id == att.id).delete()
                    db.query(AttemptRandomizedOption).filter(AttemptRandomizedOption.attempt_id == att.id).delete()
                    db.query(AttemptRandomizedQuestion).filter(AttemptRandomizedQuestion.attempt_id == att.id).delete()
                    db.delete(att)
                    total_resets += 1
                cand.status = "ACTIVE"

        db.add(AuditLog(
            action="BATCH_RESCHEDULE_CANDIDATE_SLOT",
            entity_type="Candidate",
            entity_id=f"count:{len(candidates)}",
            performed_by=performed_by,
            details=f"Batch rescheduled {len(candidates)} candidates to '{cleaned_target}'. Total attempts reset: {total_resets}. Reason: {reason or 'Batch emergency slot reassignment'}."
        ))
        db.commit()
        return {
            "success": True,
            "rescheduledCount": len(candidates),
            "targetSlot": cleaned_target,
            "totalAttemptsReset": total_resets,
            "message": f"Successfully moved {len(candidates)} candidates to {cleaned_target}."
        }


def normalize_set_code(raw: Optional[str]) -> Optional[str]:
    """
    Normalizes set codes like 'A', 'Set A', 'set_a', 'SET A' to canonical 'Set A', 'Set B', 'Set C', 'Set D'.
    Returns None if empty or unassigned.
    Raises HTTPException 400 if invalid.
    """
    if not raw or not str(raw).strip() or str(raw).strip().lower() in ("none", "unassigned", "null", "", "-"):
        return None
    val = str(raw).strip().upper().replace("SET", "").replace("_", "").replace("-", "").strip()
    if val in ("A", "B", "C", "D"):
        return f"Set {val}"
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Invalid question paper set '{raw}'. Permitted options are Set A, Set B, Set C, Set D (or None to unassign)."
    )


