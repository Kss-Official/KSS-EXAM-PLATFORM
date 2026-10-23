package com.exam.secureexam.controller;

import com.exam.secureexam.dto.ExamDto;
import com.exam.secureexam.dto.pdf.CreateExamFromParsedDto;
import com.exam.secureexam.dto.pdf.PdfParseResponseDto;
import com.exam.secureexam.dto.pdf.PdfParsingRulesDto;
import com.exam.secureexam.service.ExamService;
import com.exam.secureexam.service.pdf.InMemoryPdfService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/exams")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class AdminExamController {

    private final ExamService examService;
    private final InMemoryPdfService inMemoryPdfService;

    public AdminExamController(ExamService examService, InMemoryPdfService inMemoryPdfService) {
        this.examService = examService;
        this.inMemoryPdfService = inMemoryPdfService;
    }

    @GetMapping
    public List<ExamDto> getAllExams() {
        return examService.getAllExams();
    }

    @GetMapping("/{id}")
    public ExamDto getExamById(@PathVariable Long id) {
        return examService.getExamById(id);
    }

    @PostMapping
    public ResponseEntity<ExamDto> createExam(
            @RequestBody ExamDto dto,
            Authentication authentication
    ) {
        String adminUser = authentication != null ? authentication.getName() : "ADMIN";
        ExamDto created = examService.createExam(dto, adminUser);
        return ResponseEntity.ok(created);
    }

    /**
     * In-Memory PDF Upload and Extraction Endpoint.
     * Takes Question Paper PDF and optional Answer Sheet PDF.
     * Extracts text, questions, options, and answers purely in RAM.
     * Original PDF files are NEVER persisted to disk, database, or external storage.
     */
    @PostMapping("/parse-pdf")
    public ResponseEntity<PdfParseResponseDto> parsePdfInMemory(
            @RequestParam("questionPaper") MultipartFile questionPaper,
            @RequestParam(value = "answerSheet", required = false) MultipartFile answerSheet,
            @RequestParam(value = "questionPattern", required = false) String questionPattern,
            @RequestParam(value = "optionPattern", required = false) String optionPattern,
            @RequestParam(value = "answerKeyPattern", required = false) String answerKeyPattern,
            @RequestParam(value = "marksPerQuestion", required = false) Double marksPerQuestion,
            @RequestParam(value = "negativeMarks", required = false) Double negativeMarks
    ) {
        PdfParsingRulesDto rules = new PdfParsingRulesDto();
        rules.setQuestionPattern(questionPattern);
        rules.setOptionPattern(optionPattern);
        rules.setAnswerKeyPattern(answerKeyPattern);
        rules.setMarksPerQuestion(marksPerQuestion != null ? marksPerQuestion : 1.0);
        rules.setNegativeMarks(negativeMarks != null ? negativeMarks : 0.0);

        PdfParseResponseDto response = inMemoryPdfService.parsePdfInMem(questionPaper, answerSheet, rules);
        return ResponseEntity.ok(response);
    }

    /**
     * Confirms and persists structured MCQ exam data after admin review and verification.
     * Persists structured relational data only (Exams, Questions, Options, Keys);
     * original PDF files were already discarded from memory.
     */
    @PostMapping("/create-from-parsed")
    public ResponseEntity<ExamDto> createFromParsed(
            @RequestBody CreateExamFromParsedDto dto,
            Authentication authentication
    ) {
        String adminUser = authentication != null ? authentication.getName() : "ADMIN";
        ExamDto created = examService.createExamFromParsed(dto, adminUser);
        return ResponseEntity.ok(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ExamDto> updateExam(
            @PathVariable Long id,
            @RequestBody ExamDto dto,
            Authentication authentication
    ) {
        String adminUser = authentication != null ? authentication.getName() : "ADMIN";
        ExamDto updated = examService.updateExam(id, dto, adminUser);
        return ResponseEntity.ok(updated);
    }

    @PostMapping("/{id}/publish")
    public ResponseEntity<ExamDto> publishExam(
            @PathVariable Long id,
            Authentication authentication
    ) {
        String adminUser = authentication != null ? authentication.getName() : "ADMIN";
        ExamDto published = examService.publishExam(id, adminUser);
        return ResponseEntity.ok(published);
    }

    @PostMapping("/{id}/close")
    public ResponseEntity<ExamDto> closeExam(
            @PathVariable Long id,
            Authentication authentication
    ) {
        String adminUser = authentication != null ? authentication.getName() : "ADMIN";
        ExamDto closed = examService.closeExam(id, adminUser);
        return ResponseEntity.ok(closed);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> deleteExam(
            @PathVariable Long id,
            @RequestParam(value = "force", defaultValue = "false") boolean force,
            Authentication authentication
    ) {
        String adminUser = authentication != null ? authentication.getName() : "ADMIN";
        try {
            examService.deleteExam(id, force, adminUser);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "message", "Exam deleted successfully"
            ));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                    "success", false,
                    "requiresConfirmation", true,
                    "message", e.getMessage()
            ));
        }
    }
}
