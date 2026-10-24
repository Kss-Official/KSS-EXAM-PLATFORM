import io
import re
import gc
from typing import Optional, List, Dict, Tuple
from decimal import Decimal
import pypdf
from fastapi import UploadFile

from app.schemas import (
    PdfParseResponseDto, ParsedQuestionDto, ParsedOptionDto
)

PDF_MAGIC_BYTES = b"%PDF-"
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB

class InMemoryPdfService:
    @staticmethod
    def extract_text_from_pdf_bytes(pdf_bytes: bytes, filename: str) -> str:
        if not pdf_bytes or len(pdf_bytes) < 5:
            raise ValueError(f"File '{filename}' is empty or corrupted.")
        if not pdf_bytes.startswith(PDF_MAGIC_BYTES):
            raise ValueError(f"File '{filename}' is not a valid PDF document (missing %PDF- header).")
        
        try:
            reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
            text_parts = []
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    # Normalize Unicode spaces and quotes
                    cleaned = (
                        page_text.replace("\xa0", " ")
                        .replace("\u201c", '"')
                        .replace("\u201d", '"')
                        .replace("\u2019", "'")
                    )
                    text_parts.append(cleaned)
            return "\n".join(text_parts)
        except Exception as e:
            raise ValueError(f"In-memory PDF text extraction failed: {str(e)}")

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
            total_questions=0,
            mapped_answers_count=0,
            requires_ocr=False,
            warnings=[],
            errors=[],
            extracted_answer_key={},
            questions=[]
        )

        # 1. Read Question Paper strictly into volatile RAM
        qp_bytes = await question_paper_file.read()
        if len(qp_bytes) > MAX_FILE_SIZE:
            response.success = False
            response.errors.append("Question Paper exceeds maximum allowed 25 MB limit.")
            return response

        response.question_paper_file_name = question_paper_file.filename
        response.question_paper_size_bytes = len(qp_bytes)

        try:
            qp_text = cls.extract_text_from_pdf_bytes(qp_bytes, question_paper_file.filename)
        except ValueError as e:
            response.success = False
            response.errors.append(str(e))
            return response
        finally:
            del qp_bytes
            gc.collect()

        # Check for scanned image PDF (< 50 printable characters)
        if not qp_text or len(qp_text.strip()) < 50 or len(re.sub(r"\s+", "", qp_text)) < 30:
            response.success = False
            response.requires_ocr = True
            response.ocr_reason = (
                "The uploaded Question Paper appears to be a scanned image or raster PDF with "
                "insufficient extractable text (fewer than 50 characters). Optical Character Recognition (OCR) is required."
            )
            response.errors.append(response.ocr_reason)
            return response

        # 2. Process optional Answer Sheet
        answer_key_map: Dict[int, str] = {}
        if answer_sheet_file and answer_sheet_file.filename:
            as_bytes = await answer_sheet_file.read()
            if len(as_bytes) > MAX_FILE_SIZE:
                response.warnings.append("Answer Sheet exceeds 25 MB limit; skipped.")
            else:
                response.answer_sheet_file_name = answer_sheet_file.filename
                response.answer_sheet_size_bytes = len(as_bytes)
                try:
                    as_text = cls.extract_text_from_pdf_bytes(as_bytes, answer_sheet_file.filename)
                    if as_text and len(as_text.strip()) >= 10:
                        answer_key_map = cls._parse_answer_sheet_text(as_text, answer_key_pattern_str)
                    else:
                        response.warnings.append("Answer Sheet has minimal text; verify answer key manually.")
                except Exception as e:
                    response.warnings.append(f"Answer Sheet extraction warning: {str(e)}")
                finally:
                    del as_bytes
                    gc.collect()

        # 3. Parse MCQs from Question Paper Text
        questions, parsed_keys = cls._extract_questions(
            qp_text,
            question_pattern_str,
            option_pattern_str,
            answer_key_pattern_str,
            Decimal(str(marks_per_question)),
            Decimal(str(negative_marks))
        )

        # Merge answer keys from answer sheet
        if answer_key_map:
            for q in questions:
                if q.display_order in answer_key_map:
                    target_label = answer_key_map[q.display_order]
                    q.correct_option = target_label
                    for opt in q.options:
                        opt.correct = (opt.label.upper() == target_label.upper())

        # Collect final answer map
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
            response.warnings.append("No standard MCQs could be identified using default regex heuristics.")
            response.confidence_score = 0.3
        else:
            mapped_ratio = len(final_answer_map) / len(questions) if questions else 0
            response.confidence_score = round(0.7 + (0.3 * mapped_ratio), 2)

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
