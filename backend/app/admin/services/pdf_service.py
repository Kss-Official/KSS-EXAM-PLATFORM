import io
import re
import gc
import csv
import asyncio
from typing import Optional, List, Dict, Tuple
from decimal import Decimal
try:
    import pymupdf
except ImportError:
    import fitz as pymupdf
try:
    import docx
except ImportError:
    docx = None
from fastapi import UploadFile

from app.schemas import (
    PdfParseResponseDto, ParsedQuestionDto, ParsedOptionDto
)

PDF_MAGIC_BYTES = b"%PDF-"
MAX_FILE_SIZE = 15 * 1024 * 1024  # 15 MB bound to protect worker memory
PARSE_TIMEOUT_SECONDS = 25.0  # 25s execution timeout bound

# Bound concurrency: at most 2 parsing jobs can run simultaneously across the API
_pdf_semaphore = asyncio.Semaphore(2)


def extract_pdf_text(pdf_bytes: bytes) -> str:
    """
    Core extraction function using PyMuPDF.
    Extracts text from every page in the correct order, preserves meaningful line breaks,
    handles empty pages without crashing, and raises descriptive ValueErrors for invalid/encrypted/scanned files.
    """
    if not pdf_bytes:
        raise ValueError("The uploaded document is empty.")
    if len(pdf_bytes) < 5:
        raise ValueError("The uploaded document is corrupted or too small.")
    if not pdf_bytes.startswith(PDF_MAGIC_BYTES):
        raise ValueError("The uploaded file is not a valid PDF document (missing %PDF- header).")

    try:
        with pymupdf.open(
            stream=io.BytesIO(pdf_bytes),
            filetype="pdf",
        ) as document:
            if document.is_encrypted:
                raise ValueError("Password-protected PDFs are not supported.")

            page_texts = []

            for page_number, page in enumerate(document, start=1):
                text = page.get_text("text", sort=True)

                if text and text.strip():
                    cleaned = (
                        text.replace("\xa0", " ")
                        .replace("\u201c", '"')
                        .replace("\u201d", '"')
                        .replace("\u2019", "'")
                    )
                    if cleaned.strip():
                        page_texts.append(cleaned.strip())

            extracted_text = "\n\n".join(page_texts).strip()

            if not extracted_text:
                raise ValueError(
                    "No selectable text was found in the PDF. "
                    "The file may contain scanned images or require OCR preprocessing."
                )

            return extracted_text

    except ValueError:
        raise
    except Exception as exc:
        raise ValueError(
            f"Unable to extract text from the uploaded PDF: {str(exc)}"
        ) from exc


class InMemoryPdfService:
    @staticmethod
    def extract_text_from_pdf_bytes(pdf_bytes: bytes, filename: str = "document.pdf") -> str:
        """
        Service-level interface accepting document bytes and filename.
        Dynamically extracts selectable text from PDF, DOCX, TXT, CSV, or Excel documents.
        """
        if not pdf_bytes or len(pdf_bytes) < 2:
            raise ValueError(f"File '{filename}' is empty or corrupted.")

        fname = (filename or "").lower()

        # Word document
        if fname.endswith(".docx"):
            if docx is None:
                raise ValueError("Processing Word documents (.docx) requires the 'python-docx' package.")
            try:
                doc = docx.Document(io.BytesIO(pdf_bytes))
                paras = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
                return "\n\n".join(paras)
            except Exception as e:
                raise ValueError(f"Failed to read Word document '{filename}': {e}")

        # Text / CSV
        if fname.endswith((".txt", ".csv")):
            for enc in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
                try:
                    return pdf_bytes.decode(enc)
                except UnicodeDecodeError:
                    continue
            return pdf_bytes.decode("utf-8", errors="replace")

        # Excel document
        if fname.endswith((".xlsx", ".xls")):
            try:
                wb = openpyxl.load_workbook(io.BytesIO(pdf_bytes), data_only=True)
                ws = wb.active
                lines = []
                for r in ws.iter_rows(values_only=True):
                    cleaned = " ".join([str(c).strip() for c in r if c is not None and str(c).strip()])
                    if cleaned:
                        lines.append(cleaned)
                return "\n\n".join(lines)
            except Exception as e:
                raise ValueError(f"Failed to read Excel document '{filename}': {e}")

        # Standard PDF
        if not pdf_bytes.startswith(PDF_MAGIC_BYTES):
            raise ValueError(f"File '{filename}' is not a valid PDF document (missing %PDF- header).")

        try:
            with pymupdf.open(
                stream=io.BytesIO(pdf_bytes),
                filetype="pdf",
            ) as document:
                if document.is_encrypted:
                    raise ValueError(f"File '{filename}' is password-protected. Encrypted PDFs are not supported.")

                page_texts = []
                for page in document:
                    text = page.get_text("text", sort=True)
                    if text and text.strip():
                        cleaned = (
                            text.replace("\xa0", " ")
                            .replace("\u201c", '"')
                            .replace("\u201d", '"')
                            .replace("\u2019", "'")
                        )
                        if cleaned.strip():
                            page_texts.append(cleaned.strip())

                extracted_text = "\n\n".join(page_texts).strip()
                if not extracted_text:
                    raise ValueError(
                        f"No selectable text was found in '{filename}'. "
                        "The file may contain scanned images or require OCR preprocessing."
                    )

                return extracted_text
        except ValueError:
            raise
        except Exception as exc:
            raise ValueError(
                f"In-memory text extraction failed for '{filename}': {str(exc)}"
            ) from exc

    @staticmethod
    def _parse_tabular_questions(
        rows: List[List[str]],
        marks: Decimal,
        negative_marks: Decimal
    ) -> Tuple[List[ParsedQuestionDto], Dict[int, str]]:
        """
        Parses questions and multiple choice options from structured spreadsheet/table rows.
        Identifies Question, Option A-D, and Correct Answer columns dynamically.
        """
        if not rows:
            return [], {}

        q_list: List[ParsedQuestionDto] = []
        ans_map: Dict[int, str] = {}

        header_row_idx = -1
        q_col, a_col, b_col, c_col, d_col, ans_col = None, None, None, None, None, None

        for idx, r in enumerate(rows[:5]):
            r_lower = [str(c or "").lower().strip() for c in r]
            for c_i, cell in enumerate(r_lower):
                if any(k in cell for k in ["question", "problem", "q text", "statement"]) and q_col is None:
                    q_col = c_i
                elif ("opt" in cell and "a" in cell) or cell in ("a", "option a", "option 1"):
                    a_col = c_i
                elif ("opt" in cell and "b" in cell) or cell in ("b", "option b", "option 2"):
                    b_col = c_i
                elif ("opt" in cell and "c" in cell) or cell in ("c", "option c", "option 3"):
                    c_col = c_i
                elif ("opt" in cell and "d" in cell) or cell in ("d", "option d", "option 4"):
                    d_col = c_i
                elif any(k in cell for k in ["ans", "correct", "key"]) and ans_col is None:
                    ans_col = c_i

            if q_col is not None and a_col is not None and b_col is not None:
                header_row_idx = idx
                break

        start_idx = 0
        if header_row_idx >= 0:
            start_idx = header_row_idx + 1
        elif len(rows[0]) >= 4:
            first_row_joined = " ".join([str(c).lower() for c in rows[0]])
            if any(k in first_row_joined for k in ["question", "option", "ans", "correct"]):
                start_idx = 1
            q_col = 0 if q_col is None else q_col
            a_col = 1 if a_col is None else a_col
            b_col = 2 if b_col is None else b_col
            c_col = 3 if c_col is None and len(rows[0]) > 3 else c_col
            d_col = 4 if d_col is None and len(rows[0]) > 4 else d_col
            ans_col = 5 if ans_col is None and len(rows[0]) > 5 else ans_col

        if q_col is not None and a_col is not None and b_col is not None:
            q_order = 1
            for r in rows[start_idx:]:
                if len(r) <= q_col or not str(r[q_col]).strip():
                    continue

                q_raw = str(r[q_col]).strip()
                q_text = re.sub(r"(?i)^(?:Q(?:uestion)?[\s\.]*\d+[\s\.:\)-]*|\d+[\.\)]\s*)", "", q_raw).strip()
                if not q_text:
                    q_text = q_raw

                correct_letter = None
                if ans_col is not None and ans_col < len(r) and str(r[ans_col]).strip():
                    raw_ans = str(r[ans_col]).strip().upper()
                    m_letter = re.search(r'\b([A-D])\b', raw_ans)
                    if m_letter:
                        correct_letter = m_letter.group(1)
                    else:
                        for letter, col_i in [("A", a_col), ("B", b_col), ("C", c_col), ("D", d_col)]:
                            if col_i is not None and col_i < len(r) and raw_ans.lower() == str(r[col_i]).strip().lower():
                                correct_letter = letter
                                break

                if not correct_letter:
                    correct_letter = "A"

                options: List[ParsedOptionDto] = []
                for letter, col_i in [("A", a_col), ("B", b_col), ("C", c_col), ("D", d_col)]:
                    if col_i is not None and col_i < len(r) and str(r[col_i]).strip():
                        opt_txt = str(r[col_i]).strip()
                        opt_txt = re.sub(r"^(?:[A-Da-d][\.\)\:\-]\s*|\([A-Da-d]\)\s*)", "", opt_txt).strip()
                        options.append(ParsedOptionDto(
                            label=letter,
                            option_text=opt_txt,
                            correct=(letter == correct_letter)
                        ))

                if len(options) >= 2:
                    q_list.append(ParsedQuestionDto(
                        display_order=q_order,
                        question_text=q_text,
                        options=options,
                        correct_option=correct_letter,
                        marks=marks,
                        negative_marks=negative_marks
                    ))
                    ans_map[q_order] = correct_letter
                    q_order += 1

        return q_list, ans_map

    @classmethod
    def _extract_multi_format_questions(
        cls,
        content: bytes,
        filename: str,
        q_pattern: Optional[str],
        opt_pattern: Optional[str],
        ans_pattern: Optional[str],
        marks: Decimal,
        negative_marks: Decimal
    ) -> Tuple[List[ParsedQuestionDto], Dict[int, str], bool, Optional[str]]:
        """
        Multi-format question extraction engine supporting Excel (.xlsx, .xls), CSV, Word (.docx),
        plain text (.txt), and PDF documents.
        Returns (questions, extracted_keys, requires_ocr, ocr_reason).
        """
        fname = (filename or "").lower()

        # Format 1: Excel (.xlsx, .xls)
        if fname.endswith((".xlsx", ".xls")):
            try:
                wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
                ws = wb.active
                rows = []
                for r in ws.iter_rows(values_only=True):
                    if any(r):
                        rows.append([str(c).strip() if c is not None else "" for c in r])

                questions, ans_keys = cls._parse_tabular_questions(rows, marks, negative_marks)
                if questions:
                    return questions, ans_keys, False, None

                combined_text = "\n\n".join([" ".join([c for c in r if c]) for r in rows])
                q_list, ans_map = cls._extract_questions(combined_text, q_pattern, opt_pattern, ans_pattern, marks, negative_marks)
                return q_list, ans_map, False, None
            except Exception as e:
                raise ValueError(f"Error extracting questions from Excel file '{filename}': {e}")

        # Format 2: CSV (.csv)
        if fname.endswith(".csv"):
            try:
                text = ""
                for enc in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
                    try:
                        text = content.decode(enc)
                        break
                    except UnicodeDecodeError:
                        continue
                reader = csv.reader(io.StringIO(text))
                rows = [[str(c).strip() for c in r] for r in reader if any(r)]
                questions, ans_keys = cls._parse_tabular_questions(rows, marks, negative_marks)
                if questions:
                    return questions, ans_keys, False, None

                q_list, ans_map = cls._extract_questions(text, q_pattern, opt_pattern, ans_pattern, marks, negative_marks)
                return q_list, ans_map, False, None
            except Exception as e:
                raise ValueError(f"Error extracting questions from CSV file '{filename}': {e}")

        # Format 3: Word Document (.docx)
        if fname.endswith(".docx"):
            if docx is None:
                raise ValueError("Processing Word documents (.docx) requires the 'python-docx' package.")
            try:
                doc = docx.Document(io.BytesIO(content))
                rows = []
                for t in doc.tables:
                    for r in t.rows:
                        vals = [c.text.strip() for c in r.cells]
                        if any(vals):
                            rows.append(vals)
                if rows:
                    questions, ans_keys = cls._parse_tabular_questions(rows, marks, negative_marks)
                    if questions:
                        return questions, ans_keys, False, None

                full_text = "\n\n".join([p.text.strip() for p in doc.paragraphs if p.text.strip()])
                q_list, ans_map = cls._extract_questions(full_text, q_pattern, opt_pattern, ans_pattern, marks, negative_marks)
                return q_list, ans_map, False, None
            except Exception as e:
                raise ValueError(f"Error extracting questions from Word document '{filename}': {e}")

        # Format 4: Plain Text (.txt)
        if fname.endswith(".txt"):
            text = ""
            for enc in ("utf-8-sig", "utf-8", "latin-1", "cp1252"):
                try:
                    text = content.decode(enc)
                    break
                except UnicodeDecodeError:
                    continue
            q_list, ans_map = cls._extract_questions(text, q_pattern, opt_pattern, ans_pattern, marks, negative_marks)
            return q_list, ans_map, False, None

        # Format 5: PDF (.pdf)
        table_rows = []
        try:
            with pymupdf.open(stream=io.BytesIO(content), filetype="pdf") as doc:
                if doc.is_encrypted:
                    raise ValueError(f"File '{filename}' is password-protected. Encrypted PDFs are not supported.")
                for page in doc:
                    tabs = page.find_tables()
                    if tabs and tabs.tables:
                        for t in tabs:
                            for r in t.extract():
                                if any(r):
                                    table_rows.append([str(c or "").strip() for c in r])
        except Exception:
            pass

        if table_rows:
            questions, ans_keys = cls._parse_tabular_questions(table_rows, marks, negative_marks)
            if questions:
                return questions, ans_keys, False, None

        qp_text = cls.extract_text_from_pdf_bytes(content, filename)
        if not qp_text or len(qp_text.strip()) < 50 or len(re.sub(r"\s+", "", qp_text)) < 30:
            ocr_reason = (
                "The uploaded Question Paper appears to be a scanned image or raster PDF with "
                "insufficient extractable text (fewer than 50 characters). Optical Character Recognition (OCR) is required."
            )
            return [], {}, True, ocr_reason

        questions, ans_keys = cls._extract_questions(qp_text, q_pattern, opt_pattern, ans_pattern, marks, negative_marks)
        return questions, ans_keys, False, None

    @classmethod
    def _extract_multi_format_answers(
        cls,
        content: bytes,
        filename: str,
        custom_pattern: Optional[str] = None
    ) -> Dict[int, str]:
        """
        Extracts Answer Key mapping ({question_order: correct_letter}) from Excel, CSV, PDF, Word, or TXT.
        """
        fname = (filename or "").lower()
        ans_map: Dict[int, str] = {}

        if fname.endswith((".xlsx", ".xls")):
            try:
                wb = openpyxl.load_workbook(io.BytesIO(content), data_only=True)
                ws = wb.active
                for r in ws.iter_rows(values_only=True):
                    cleaned = [str(c).strip() for c in r if c is not None and str(c).strip()]
                    if len(cleaned) >= 2:
                        m_q = re.search(r'\b(\d+)\b', cleaned[0])
                        m_a = re.search(r'\b([A-Da-d])\b', cleaned[1])
                        if m_q and m_a:
                            ans_map[int(m_q.group(1))] = m_a.group(1).upper()
            except Exception:
                pass
            if ans_map:
                return ans_map

        if fname.endswith(".csv"):
            try:
                text = ""
                for enc in ("utf-8-sig", "utf-8", "latin-1"):
                    try:
                        text = content.decode(enc)
                        break
                    except UnicodeDecodeError:
                        continue
                if text:
                    reader = csv.reader(io.StringIO(text))
                    for r in reader:
                        cleaned = [str(c).strip() for c in r if c]
                        if len(cleaned) >= 2:
                            m_q = re.search(r'\b(\d+)\b', cleaned[0])
                            m_a = re.search(r'\b([A-Da-d])\b', cleaned[1])
                            if m_q and m_a:
                                ans_map[int(m_q.group(1))] = m_a.group(1).upper()
            except Exception:
                pass
            if ans_map:
                return ans_map

        # Fallback to text regex extraction
        text = ""
        try:
            text = cls.extract_text_from_pdf_bytes(content, filename)
        except Exception:
            text = ""

        if text:
            ans_map = cls._parse_answer_sheet_text(text, custom_pattern)
        return ans_map

    @classmethod
    async def parse_pdf_in_mem(
        cls,
        question_paper_file: UploadFile,
        answer_sheet_file: Optional[UploadFile] = None,
        question_pattern_str: Optional[str] = None,
        option_pattern_str: Optional[str] = None,
        answer_key_pattern_str: Optional[str] = None,
        marks_per_question: float = 1.0,
        negative_marks: float = 0.0
    ) -> PdfParseResponseDto:
        response = PdfParseResponseDto(
            success=True,
            confidence_score=0.0,
            total_questions=0,
            mapped_answers_count=0,
            requires_ocr=False,
            warnings=[],
            errors=[],
            extracted_answer_key={},
            questions=[]
        )

        try:
            async with asyncio.timeout(PARSE_TIMEOUT_SECONDS):
                async with _pdf_semaphore:
                    # 1. Read Question Paper into RAM
                    qp_bytes = await question_paper_file.read()
                    if len(qp_bytes) > MAX_FILE_SIZE:
                        response.success = False
                        response.errors.append("Question Paper exceeds maximum allowed 15 MB limit.")
                        return response

                    response.question_paper_file_name = question_paper_file.filename
                    response.question_paper_size_bytes = len(qp_bytes)

                    try:
                        questions, parsed_keys, requires_ocr, ocr_reason = cls._extract_multi_format_questions(
                            qp_bytes,
                            question_paper_file.filename,
                            question_pattern_str,
                            option_pattern_str,
                            answer_key_pattern_str,
                            Decimal(str(marks_per_question)),
                            Decimal(str(negative_marks))
                        )
                        if requires_ocr:
                            response.success = False
                            response.requires_ocr = True
                            response.ocr_reason = ocr_reason
                            response.errors.append(ocr_reason)
                            return response
                    except ValueError as e:
                        err_str = str(e)
                        response.success = False
                        if "scanned" in err_str.lower() or "selectable text" in err_str.lower() or "ocr" in err_str.lower():
                            response.requires_ocr = True
                            response.ocr_reason = err_str
                        response.errors.append(err_str)
                        return response
                    finally:
                        del qp_bytes
                        gc.collect()

                    # 2. Process optional Answer Sheet
                    answer_key_map: Dict[int, str] = {}
                    if answer_sheet_file and answer_sheet_file.filename:
                        as_bytes = await answer_sheet_file.read()
                        if len(as_bytes) > MAX_FILE_SIZE:
                            response.warnings.append("Answer Sheet exceeds 15 MB limit; skipped.")
                        else:
                            response.answer_sheet_file_name = answer_sheet_file.filename
                            response.answer_sheet_size_bytes = len(as_bytes)
                            try:
                                answer_key_map = cls._extract_multi_format_answers(
                                    as_bytes, answer_sheet_file.filename, answer_key_pattern_str
                                )
                                if not answer_key_map:
                                    response.warnings.append("Answer Sheet has minimal or unmapped answer text; verify answer keys.")
                            except Exception as e:
                                response.warnings.append(f"Answer Sheet extraction warning: {str(e)}")
                            finally:
                                del as_bytes
                                gc.collect()

                    # 3. Merge Answer Keys
                    if answer_key_map:
                        for q in questions:
                            if q.display_order in answer_key_map:
                                target_label = answer_key_map[q.display_order]
                                q.correct_option = target_label
                                for opt in q.options:
                                    opt.correct = (opt.label.upper() == target_label.upper())

                    # 4. Collect final mapped answers
                    final_answer_map: Dict[int, str] = {}
                    for q in questions:
                        if q.correct_option:
                            final_answer_map[q.display_order] = q.correct_option
                        elif parsed_keys.get(q.display_order):
                            final_answer_map[q.display_order] = parsed_keys[q.display_order]

                    response.questions = questions
                    response.total_questions = len(questions)
                    response.extracted_answer_key = final_answer_map
                    response.mapped_answers_count = len(final_answer_map)

                    if len(questions) == 0:
                        response.warnings.append("No standard questions could be identified from the uploaded document.")
                        response.confidence_score = 0.3
                    else:
                        mapped_ratio = len(final_answer_map) / len(questions) if questions else 0
                        response.confidence_score = round(0.7 + (0.3 * mapped_ratio), 2)

                    return response
        except TimeoutError:
            response.success = False
            response.errors.append("Document parsing timed out after 25 seconds. Please ensure the document is not corrupted.")
            return response
        except Exception as e:
            response.success = False
            response.errors.append(f"Extraction error: {str(e)}")
            return response

    @staticmethod
    def _parse_answer_sheet_text(text: str, custom_pattern: Optional[str] = None) -> Dict[int, str]:
        pattern = custom_pattern if custom_pattern else r"(?i)(\d+)[\s\.:\)-]+([A-Da-d])"
        compiled = re.compile(pattern)
        results: Dict[int, str] = {}
        for match in compiled.finditer(text):
            try:
                q_num = int(match.group(1))
                ans_letter = match.group(2).upper()
                results[q_num] = ans_letter
            except Exception:
                continue
        return results

    @staticmethod
    def _extract_questions(
        text: str,
        q_pattern: Optional[str],
        opt_pattern: Optional[str],
        ans_pattern: Optional[str],
        marks: Decimal,
        negative_marks: Decimal
    ) -> Tuple[List[ParsedQuestionDto], Dict[int, str]]:
        question_regex = (
            q_pattern if q_pattern else
            r"(?i)(?:^|\n)\s*(?:Q(?:uestion)?[\s\.]*(\d+)[\s\.:\)-]+|\b(\d+)[\.\)]\s+)"
        )
        option_regex = (
            opt_pattern if opt_pattern else
            r"(?m)^\s*[\(\[]?([A-Da-d])[\)\]\.\:\-]\s*(.+)$"
        )
        answer_regex = (
            ans_pattern if ans_pattern else
            r"(?i)(?:Ans(?:wer)?|Correct)[\s\.:\)-]*([A-Da-d])"
        )

        compiled_q = re.compile(question_regex)
        compiled_opt = re.compile(option_regex)
        compiled_ans = re.compile(answer_regex)

        matches = list(compiled_q.finditer(text))
        questions: List[ParsedQuestionDto] = []
        extracted_keys: Dict[int, str] = {}

        if not matches:
            # Fallback: split by paragraph blocks
            blocks = re.split(r"\n\s*\n", text)
            idx = 1
            for block in blocks:
                block = block.strip()
                if not block:
                    continue
                opts = list(compiled_opt.finditer(block))
                if len(opts) >= 2:
                    q_dto, ans = InMemoryPdfService._build_question_from_block(
                        idx, block, compiled_opt, compiled_ans, marks, negative_marks
                    )
                    questions.append(q_dto)
                    if ans:
                        extracted_keys[idx] = ans
                    idx += 1
            return questions, extracted_keys

        for i in range(len(matches)):
            curr_match = matches[i]
            start_pos = curr_match.start()
            end_pos = matches[i + 1].start() if i + 1 < len(matches) else len(text)
            chunk = text[start_pos:end_pos].strip()

            order = i + 1
            q_num_group = curr_match.group(1) or curr_match.group(2)
            if q_num_group and q_num_group.isdigit():
                order = int(q_num_group)

            q_dto, ans = InMemoryPdfService._build_question_from_block(
                order, chunk, compiled_opt, compiled_ans, marks, negative_marks
            )
            questions.append(q_dto)
            if ans:
                extracted_keys[order] = ans

        return questions, extracted_keys

    @staticmethod
    def _build_question_from_block(
        order: int,
        block: str,
        opt_compiled: re.Pattern,
        ans_compiled: re.Pattern,
        marks: Decimal,
        negative_marks: Decimal
    ) -> Tuple[ParsedQuestionDto, Optional[str]]:
        opt_matches = list(opt_compiled.finditer(block))
        ans_match = ans_compiled.search(block)

        correct_letter = ans_match.group(1).upper() if ans_match else None

        if opt_matches:
            first_opt_start = opt_matches[0].start()
            q_text = block[:first_opt_start].strip()
        else:
            q_text = block.strip()

        # Clean leading numbers and Question tokens
        q_text = re.sub(r"(?i)^Q(?:uestion)?[\s\.]*\d+[\s\.:\)-]*", "", q_text).strip()
        q_text = re.sub(r"^\d+[\.\)]\s*", "", q_text).strip()

        options: List[ParsedOptionDto] = []
        for m in opt_matches:
            lbl = m.group(1).upper()
            txt = m.group(2).strip()
            # Remove answer key line if embedded in option text
            txt = re.sub(r"(?i)(?:Ans(?:wer)?|Correct)[\s\.:\)-]*[A-Da-d].*$", "", txt).strip()
            is_corr = (lbl == correct_letter) if correct_letter else False
            options.append(ParsedOptionDto(label=lbl, option_text=txt, correct=is_corr))

        # Default correct answer to option A if none specified
        if not correct_letter and options:
            options[0].correct = True
            correct_letter = options[0].label

        has_issue = len(options) < 2
        issue_desc = "Question has fewer than 2 valid options." if has_issue else None

        q_dto = ParsedQuestionDto(
            display_order=order,
            question_text=q_text if q_text else f"Question {order}",
            options=options,
            correct_option=correct_letter,
            marks=marks,
            negative_marks=negative_marks,
            has_issue=has_issue,
            issue_description=issue_desc
        )
        return q_dto, correct_letter
