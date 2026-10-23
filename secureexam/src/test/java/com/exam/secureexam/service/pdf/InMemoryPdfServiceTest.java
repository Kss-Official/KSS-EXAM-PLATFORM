package com.exam.secureexam.service.pdf;

import com.exam.secureexam.dto.pdf.PdfParseResponseDto;
import com.exam.secureexam.dto.pdf.PdfParsingRulesDto;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.encryption.AccessPermission;
import org.apache.pdfbox.pdmodel.encryption.StandardProtectionPolicy;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;

import static org.junit.jupiter.api.Assertions.*;

class InMemoryPdfServiceTest {

    private InMemoryPdfService pdfService;

    @BeforeEach
    void setUp() {
        pdfService = new InMemoryPdfService();
    }

    private byte[] createPdfWithText(String[] lines) throws IOException {
        try (PDDocument document = new PDDocument()) {
            PDPage page = new PDPage();
            document.addPage(page);

            try (PDPageContentStream contentStream = new PDPageContentStream(document, page)) {
                contentStream.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
                contentStream.beginText();
                contentStream.newLineAtOffset(50, 700);
                contentStream.setLeading(14.5f);

                for (String line : lines) {
                    contentStream.showText(line);
                    contentStream.newLine();
                }
                contentStream.endText();
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            document.save(baos);
            return baos.toByteArray();
        }
    }

    @Test
    void testValidQuestionPaperAndAnswerSheetParsing() throws IOException {
        String[] qpLines = {
                "CAMPUS RECRUITMENT ASSESSMENT 2026",
                "1. What is the default port for a Spring Boot Tomcat server?",
                "A) 3000",
                "B) 5432",
                "C) 8080",
                "D) 80",
                "",
                "2. Which interface in Java is used to define custom sorting by multiple fields?",
                "A) Comparable",
                "B) Comparator",
                "C) Serializable",
                "D) Cloneable",
                "",
                "3. What is the primary advantage of binary search over linear search in sorted arrays?",
                "A) Constant time complexity",
                "B) Logarithmic time complexity O(log n)",
                "C) Handles unsorted data faster",
                "D) Uses less auxiliary heap memory"
        };

        String[] asLines = {
                "OFFICIAL ANSWER KEY",
                "1. C",
                "2. B",
                "3. B"
        };

        byte[] qpBytes = createPdfWithText(qpLines);
        byte[] asBytes = createPdfWithText(asLines);

        MockMultipartFile qpFile = new MockMultipartFile("questionPaper", "exam_questions.pdf", "application/pdf", qpBytes);
        MockMultipartFile asFile = new MockMultipartFile("answerSheet", "answer_key.pdf", "application/pdf", asBytes);

        PdfParseResponseDto response = pdfService.parsePdfInMem(qpFile, asFile, new PdfParsingRulesDto());

        assertTrue(response.isSuccess());
        assertEquals(3, response.getTotalQuestions());
        assertEquals(3, response.getMappedAnswersCount());
        assertFalse(response.isRequiresOcr());
        assertTrue(response.getConfidenceScore() >= 80.0);

        // Verify Question 1 details
        assertEquals(1, response.getQuestions().get(0).getDisplayOrder());
        assertEquals("C", response.getQuestions().get(0).getCorrectOption());
        assertEquals(4, response.getQuestions().get(0).getOptions().size());
        assertTrue(response.getQuestions().get(0).getOptions().get(2).isCorrect()); // Option C

        // Verify Question 2 details
        assertEquals(2, response.getQuestions().get(1).getDisplayOrder());
        assertEquals("B", response.getQuestions().get(1).getCorrectOption());
        assertTrue(response.getQuestions().get(1).getOptions().get(1).isCorrect()); // Option B
    }

    @Test
    void testScannedPdfDetectionRequiresOcr() throws IOException {
        // PDF with almost no text (< 50 chars)
        byte[] lowTextBytes = createPdfWithText(new String[]{"Scan Page"});
        MockMultipartFile file = new MockMultipartFile("questionPaper", "scanned.pdf", "application/pdf", lowTextBytes);

        PdfParseResponseDto response = pdfService.parsePdfInMem(file, null, null);

        assertFalse(response.isSuccess());
        assertTrue(response.isRequiresOcr());
        assertNotNull(response.getOcrReason());
        assertTrue(response.getOcrReason().contains("OCR"));
    }

    @Test
    void testEncryptedPdfRejection() throws IOException {
        byte[] normalPdf = createPdfWithText(new String[]{
                "1. What is Java?",
                "A) Lang",
                "B) OS",
                "C) DB",
                "D) Tool"
        });

        // Encrypt the PDF
        byte[] encryptedBytes;
        try (PDDocument doc = org.apache.pdfbox.Loader.loadPDF(normalPdf)) {
            AccessPermission ap = new AccessPermission();
            StandardProtectionPolicy spp = new StandardProtectionPolicy("ownerSecret123", "userSecret123", ap);
            spp.setEncryptionKeyLength(128);
            spp.setPermissions(ap);
            doc.protect(spp);
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            doc.save(baos);
            encryptedBytes = baos.toByteArray();
        }

        MockMultipartFile encFile = new MockMultipartFile("questionPaper", "encrypted.pdf", "application/pdf", encryptedBytes);

        PdfParseResponseDto response = pdfService.parsePdfInMem(encFile, null, null);

        assertFalse(response.isSuccess());
        assertTrue(response.getErrors().stream().anyMatch(e -> e.contains("encrypted") || e.contains("password-protected")));
    }

    @Test
    void testCorruptedSignatureRejection() {
        byte[] corruptedHeader = "NOT_A_PDF_CONTENT_HERE".getBytes();
        MockMultipartFile file = new MockMultipartFile("questionPaper", "fake.pdf", "application/pdf", corruptedHeader);

        PdfParseResponseDto response = pdfService.parsePdfInMem(file, null, null);

        assertFalse(response.isSuccess());
        assertTrue(response.getErrors().stream().anyMatch(e -> e.contains("%PDF-")));
    }
}
