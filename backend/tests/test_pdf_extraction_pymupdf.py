import io
import pytest
import pymupdf
from fastapi import UploadFile

from app.admin.services.pdf_service import InMemoryPdfService, extract_pdf_text


def _build_synthetic_pdf(pages_text: list[str], password: str | None = None) -> bytes:
    """Helper to generate in-memory synthetic PDFs for testing."""
    doc = pymupdf.open()
    for text in pages_text:
        page = doc.new_page()
        if text:
            page.insert_text((50, 72), text, fontsize=11)
    
    if password:
        # Save with user encryption
        pdf_bytes = doc.tobytes(
            encryption=pymupdf.PDF_ENCRYPT_AES_256,
            owner_pw="owner123",
            user_pw=password
        )
    else:
        pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


# 1. Normal text-based PDF
def test_normal_text_pdf_extraction():
    content = "This is a standard question paper introductory statement for testing."
    pdf_bytes = _build_synthetic_pdf([content])
    
    extracted = InMemoryPdfService.extract_text_from_pdf_bytes(pdf_bytes, "normal.pdf")
    assert content in extracted
    
    standalone_extracted = extract_pdf_text(pdf_bytes)
    assert content in standalone_extracted


# 2. PDF containing multiple pages
def test_multipage_pdf_extraction():
    p1 = "Question Paper Header - General Instructions\nRead carefully before answering."
    p2 = "Section B - Core Domain Knowledge\nSolve all five questions."
    pdf_bytes = _build_synthetic_pdf([p1, p2])
    
    extracted = InMemoryPdfService.extract_text_from_pdf_bytes(pdf_bytes, "multipage.pdf")
    assert "General Instructions" in extracted
    assert "Section B" in extracted
    assert extracted.index("General Instructions") < extracted.index("Section B")


# 3. PDF with question statements and A/B/C/D options
def test_question_and_options_extraction():
    mcq_text = (
        "Q1. Which data structure operates on a First-In-First-Out (FIFO) basis?\n"
        "A) Stack\n"
        "B) Queue\n"
        "C) Tree\n"
        "D) Graph\n"
        "Answer: B"
    )
    pdf_bytes = _build_synthetic_pdf([mcq_text])
    
    extracted = InMemoryPdfService.extract_text_from_pdf_bytes(pdf_bytes, "mcq.pdf")
    assert "FIFO" in extracted
    assert "A) Stack" in extracted
    assert "B) Queue" in extracted
    assert "Answer: B" in extracted


# 4. Empty upload
def test_empty_upload():
    with pytest.raises(ValueError, match="empty or corrupted|empty"):
        InMemoryPdfService.extract_text_from_pdf_bytes(b"", "empty.pdf")
    
    with pytest.raises(ValueError, match="empty"):
        extract_pdf_text(b"")


# 5. Invalid PDF bytes
def test_invalid_pdf_bytes():
    with pytest.raises(ValueError, match="not a valid PDF document"):
        InMemoryPdfService.extract_text_from_pdf_bytes(b"INVALID_HEADER_DATA_12345", "invalid.pdf")
    
    with pytest.raises(ValueError, match="not a valid PDF document"):
        extract_pdf_text(b"INVALID_HEADER_DATA_12345")


# 6. Encrypted / password-protected PDF
def test_encrypted_pdf_rejection():
    pdf_bytes = _build_synthetic_pdf(["Secret Question 1"], password="securePassword123")
    
    with pytest.raises(ValueError, match="Password-protected|password-protected|encrypted"):
        InMemoryPdfService.extract_text_from_pdf_bytes(pdf_bytes, "locked.pdf")
    
    with pytest.raises(ValueError, match="Password-protected"):
        extract_pdf_text(pdf_bytes)


# 7. Scanned PDF containing no selectable text
def test_scanned_or_empty_text_pdf():
    # Build a PDF with an empty page (simulates scanned raster with zero text blocks)
    pdf_bytes = _build_synthetic_pdf([""])
    
    with pytest.raises(ValueError, match="No selectable text|scanned"):
        InMemoryPdfService.extract_text_from_pdf_bytes(pdf_bytes, "scanned.pdf")
    
    with pytest.raises(ValueError, match="No selectable text|scanned"):
        extract_pdf_text(pdf_bytes)


# 8. PDF with an empty page followed by a text page
def test_empty_page_followed_by_text_page():
    pdf_bytes = _build_synthetic_pdf(["", "Valid question content on page two."])
    
    extracted = InMemoryPdfService.extract_text_from_pdf_bytes(pdf_bytes, "page2_text.pdf")
    assert "Valid question content on page two." in extracted
    assert len(extracted.strip()) > 0
