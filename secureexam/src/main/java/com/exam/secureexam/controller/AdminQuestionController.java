package com.exam.secureexam.controller;

import com.exam.secureexam.dto.QuestionDto;
import com.exam.secureexam.model.Department;
import com.exam.secureexam.model.Exam;
import com.exam.secureexam.model.QuestionSet;
import com.exam.secureexam.model.StoredDocument;
import com.exam.secureexam.repository.DepartmentRepository;
import com.exam.secureexam.repository.ExamRepository;
import com.exam.secureexam.repository.QuestionRepository;
import com.exam.secureexam.repository.QuestionSetRepository;
import com.exam.secureexam.repository.StoredDocumentRepository;
import com.exam.secureexam.service.DocumentStorageService;
import com.exam.secureexam.service.ExamService;
import com.exam.secureexam.service.QuestionService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class AdminQuestionController {

    @PersistenceContext
    private EntityManager entityManager;

    private final QuestionService questionService;
    private final ExamService examService;
    private final QuestionSetRepository questionSetRepository;
    private final QuestionRepository questionRepository;
    private final ExamRepository examRepository;
    private final DepartmentRepository departmentRepository;
    private final StoredDocumentRepository storedDocumentRepository;
    private final DocumentStorageService documentStorageService;

    public AdminQuestionController(
            QuestionService questionService,
            ExamService examService,
            QuestionSetRepository questionSetRepository,
            QuestionRepository questionRepository,
            ExamRepository examRepository,
            DepartmentRepository departmentRepository,
            StoredDocumentRepository storedDocumentRepository,
            DocumentStorageService documentStorageService
    ) {
        this.questionService = questionService;
        this.examService = examService;
        this.questionSetRepository = questionSetRepository;
        this.questionRepository = questionRepository;
        this.examRepository = examRepository;
        this.departmentRepository = departmentRepository;
        this.storedDocumentRepository = storedDocumentRepository;
        this.documentStorageService = documentStorageService;
    }

    /**
     * Get active departments belonging to an examination
     */
    @GetMapping("/exams/{examId}/departments")
    @Transactional(readOnly = true)
    public List<Map<String, Object>> getExamDepartments(@PathVariable Long examId) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new IllegalArgumentException("Exam not found: " + examId));

        Set<Department> depts = new LinkedHashSet<>();
        if (exam.getDepartments() != null) {
            depts.addAll(exam.getDepartments());
        }

        // Also include any departments referenced by question_sets for this exam
        List<QuestionSet> questionSets = questionSetRepository.findByExamIdOrderBySetCodeAsc(examId);
        for (QuestionSet qs : questionSets) {
            if (qs.getDepartment() != null) {
                depts.add(qs.getDepartment());
            }
        }

        if (depts.isEmpty()) {
            return Collections.emptyList();
        }

        return depts.stream()
                .sorted(Comparator.comparing(Department::getName))
                .map(d -> {
                    long setCount = questionSetRepository.countByExamIdAndDepartmentId(examId, d.getId());
                    Map<String, Object> map = new LinkedHashMap<>();
                    map.put("id", d.getId());
                    map.put("name", d.getName());
                    map.put("code", d.getCode());
                    map.put("description", d.getDescription());
                    map.put("configuredSetsCount", setCount);
                    return map;
                })
                .collect(Collectors.toList());
    }

    /**
     * Get 4 independent Question Sets for a specific department under an exam
     */
    @Transactional
    @GetMapping("/exams/{examId}/departments/{departmentId}/sets")
    public List<Map<String, Object>> getDepartmentSets(
            @PathVariable Long examId,
            @PathVariable Long departmentId
    ) {
        try {
            entityManager.createNativeQuery("ALTER TABLE question_sets DROP CONSTRAINT IF EXISTS ukrf0mu3bnnhocthehfd7iwx306").executeUpdate();
        } catch (Exception ignored) {}

        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new IllegalArgumentException("Exam not found: " + examId));
        Department dept = departmentRepository.findById(departmentId)
                .orElseThrow(() -> new IllegalArgumentException("Department not found: " + departmentId));

        // Auto-ensure Sets A, B, C, D exist for this department
        List<QuestionSet> sets = questionSetRepository.findByExamIdAndDepartmentIdOrderBySetCodeAsc(examId, departmentId);
        if (sets.size() < 4) {
            String[] requiredCodes = {"A", "B", "C", "D"};
            for (String code : requiredCodes) {
                if (!questionSetRepository.existsByExamIdAndDepartmentIdAndSetCode(examId, departmentId, code)) {
                    QuestionSet qs = new QuestionSet(exam, dept, code, dept.getName() + " - Set " + code);
                    questionSetRepository.save(qs);
                }
            }
            sets = questionSetRepository.findByExamIdAndDepartmentIdOrderBySetCodeAsc(examId, departmentId);
        }

        return sets.stream().map(s -> {
            long qCount = questionRepository.countByQuestionSetId(s.getId());
            Optional<StoredDocument> qp = storedDocumentRepository.findTopByQuestionSetIdAndDocumentTypeOrderByCreatedAtDesc(s.getId(), "QUESTION_PAPER");
            Optional<StoredDocument> ak = storedDocumentRepository.findTopByQuestionSetIdAndDocumentTypeOrderByCreatedAtDesc(s.getId(), "ANSWER_KEY");

            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", s.getId());
            map.put("setCode", s.getSetCode());
            map.put("name", s.getName());
            map.put("questionCount", qCount);
            map.put("hasQuestionPaper", qp.isPresent());
            map.put("questionPaperName", qp.map(StoredDocument::getOriginalFilename).orElse(null));
            map.put("hasAnswerKey", ak.isPresent());
            map.put("answerKeyName", ak.map(StoredDocument::getOriginalFilename).orElse(null));
            map.put("isConfigured", qCount > 0 || qp.isPresent() || ak.isPresent());
            return map;
        }).collect(Collectors.toList());
    }

    /**
     * Legacy exam question sets retrieval (for backward compatibility)
     */
    @GetMapping("/exams/{examId}/sets")
    public List<Map<String, Object>> getExamQuestionSets(@PathVariable Long examId) {
        List<QuestionSet> sets = questionSetRepository.findByExamIdOrderBySetCodeAsc(examId);
        return sets.stream().map(s -> {
            long qCount = questionRepository.countByQuestionSetId(s.getId());
            Optional<StoredDocument> qp = storedDocumentRepository.findTopByQuestionSetIdAndDocumentTypeOrderByCreatedAtDesc(s.getId(), "QUESTION_PAPER");
            Optional<StoredDocument> ak = storedDocumentRepository.findTopByQuestionSetIdAndDocumentTypeOrderByCreatedAtDesc(s.getId(), "ANSWER_KEY");

            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", s.getId());
            map.put("setCode", s.getSetCode());
            map.put("name", s.getName());
            map.put("departmentId", s.getDepartment() != null ? s.getDepartment().getId() : null);
            map.put("departmentName", s.getDepartment() != null ? s.getDepartment().getName() : null);
            map.put("questionCount", qCount);
            map.put("hasQuestionPaper", qp.isPresent());
            map.put("questionPaperName", qp.map(StoredDocument::getOriginalFilename).orElse(null));
            map.put("hasAnswerKey", ak.isPresent());
            map.put("answerKeyName", ak.map(StoredDocument::getOriginalFilename).orElse(null));
            map.put("isConfigured", qCount > 0 || qp.isPresent() || ak.isPresent());
            return map;
        }).collect(Collectors.toList());
    }

    /**
     * Get questions for a specific exam, department, and set
     */
    @GetMapping("/exams/{examId}/departments/{departmentId}/sets/{setCode}/questions")
    public List<QuestionDto> getQuestionsByDeptAndSet(
            @PathVariable Long examId,
            @PathVariable Long departmentId,
            @PathVariable String setCode
    ) {
        return questionService.getQuestionsByExamDeptAndSetCode(examId, departmentId, setCode);
    }

    /**
     * Legacy get questions by exam & set code (backward compatible)
     */
    @GetMapping("/exams/{examId}/sets/{setCode}/questions")
    public List<QuestionDto> getQuestionsBySet(@PathVariable Long examId, @PathVariable String setCode) {
        return questionService.getQuestionsByExamAndSetCode(examId, setCode);
    }

    /**
     * Add question to a question set
     */
    @PostMapping("/sets/{questionSetId}/questions")
    public ResponseEntity<QuestionDto> addQuestion(
            @PathVariable Long questionSetId,
            @RequestBody QuestionDto dto,
            Authentication authentication
    ) {
        String adminUser = authentication != null ? authentication.getName() : "ADMIN";
        QuestionDto created = questionService.createQuestion(questionSetId, dto, adminUser);
        return ResponseEntity.ok(created);
    }

    /**
     * Bulk update all questions in a set (Edit Set Mode)
     */
    @PutMapping("/sets/{questionSetId}/bulk")
    public ResponseEntity<List<QuestionDto>> bulkUpdateQuestions(
            @PathVariable Long questionSetId,
            @RequestBody List<QuestionDto> dtos,
            Authentication authentication
    ) {
        String adminUser = authentication != null ? authentication.getName() : "ADMIN";
        List<QuestionDto> updated = questionService.bulkUpdateQuestions(questionSetId, dtos, adminUser);
        return ResponseEntity.ok(updated);
    }

    /**
     * Delete individual question
     */
    @DeleteMapping("/questions/{questionId}")
    public ResponseEntity<Map<String, Object>> deleteQuestion(
            @PathVariable Long questionId,
            Authentication authentication
    ) {
        String adminUser = authentication != null ? authentication.getName() : "ADMIN";
        questionService.deleteQuestion(questionId, adminUser);
        return ResponseEntity.ok(Map.of("success", true, "message", "Question deleted"));
    }

    /**
     * Delete all questions in a set (without deleting set configuration)
     */
    @DeleteMapping("/sets/{questionSetId}/questions")
    public ResponseEntity<Map<String, Object>> deleteAllQuestionsInSet(
            @PathVariable Long questionSetId,
            Authentication authentication
    ) {
        String adminUser = authentication != null ? authentication.getName() : "ADMIN";
        questionService.deleteAllQuestionsInSet(questionSetId, adminUser);
        return ResponseEntity.ok(Map.of("success", true, "message", "All questions in set deleted successfully"));
    }

    /**
     * Delete / Deactivate a Question Set
     */
    @DeleteMapping("/sets/{questionSetId}")
    public ResponseEntity<Map<String, Object>> deleteQuestionSet(
            @PathVariable Long questionSetId,
            Authentication authentication
    ) {
        String adminUser = authentication != null ? authentication.getName() : "ADMIN";
        questionService.deleteQuestionSet(questionSetId, adminUser);
        return ResponseEntity.ok(Map.of("success", true, "message", "Question set deleted successfully"));
    }

    /**
     * Import raw text MCQs
     */
    @PostMapping("/sets/{questionSetId}/import")
    public ResponseEntity<List<QuestionDto>> importQuestions(
            @PathVariable Long questionSetId,
            @RequestBody Map<String, String> payload,
            Authentication authentication
    ) {
        String adminUser = authentication != null ? authentication.getName() : "ADMIN";
        String rawText = payload.getOrDefault("rawText", "");
        List<QuestionDto> imported = questionService.importQuestionsFromText(questionSetId, rawText, adminUser);
        return ResponseEntity.ok(imported);
    }

    /**
     * Apply Answer Key string to question set
     */
    @PostMapping("/sets/{questionSetId}/answer-key")
    public ResponseEntity<Map<String, Object>> applyAnswerKey(
            @PathVariable Long questionSetId,
            @RequestBody Map<String, String> payload,
            Authentication authentication
    ) {
        String adminUser = authentication != null ? authentication.getName() : "ADMIN";
        String answerKeyText = payload.getOrDefault("answerKeyText", "");
        Map<String, Object> res = questionService.applyAnswerKey(questionSetId, answerKeyText, adminUser);
        return ResponseEntity.ok(res);
    }

    /**
     * Department-specific document upload (Question Paper / Answer Key)
     */
    @PostMapping("/exams/{examId}/departments/{departmentId}/sets/{questionSetId}/upload-document")
    public ResponseEntity<Map<String, Object>> uploadDepartmentDocument(
            @PathVariable Long examId,
            @PathVariable Long departmentId,
            @PathVariable Long questionSetId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "documentType", defaultValue = "QUESTION_PAPER") String docType
    ) throws IOException {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new IllegalArgumentException("Exam not found: " + examId));
        Department dept = departmentRepository.findById(departmentId)
                .orElseThrow(() -> new IllegalArgumentException("Department not found: " + departmentId));
        QuestionSet qs = questionSetRepository.findById(questionSetId)
                .orElseThrow(() -> new IllegalArgumentException("Question Set not found: " + questionSetId));

        StoredDocument doc = documentStorageService.storeDocument(file, exam, dept, qs, docType, 1L);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "documentId", doc.getId(),
                "originalFilename", doc.getOriginalFilename(),
                "sha256", doc.getSha256Checksum(),
                "size", doc.getFileSize(),
                "departmentId", dept.getId(),
                "setCode", qs.getSetCode()
        ));
    }

    /**
     * Legacy exam set document upload (compatible)
     */
    @PostMapping("/exams/{examId}/sets/{questionSetId}/upload-document")
    public ResponseEntity<Map<String, Object>> uploadDocument(
            @PathVariable Long examId,
            @PathVariable Long questionSetId,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "documentType", defaultValue = "QUESTION_PAPER") String docType
    ) throws IOException {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new IllegalArgumentException("Exam not found: " + examId));
        QuestionSet qs = questionSetRepository.findById(questionSetId)
                .orElseThrow(() -> new IllegalArgumentException("Question Set not found: " + questionSetId));

        Department dept = qs.getDepartment();
        StoredDocument doc = documentStorageService.storeDocument(file, exam, dept, qs, docType, 1L);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "documentId", doc.getId(),
                "originalFilename", doc.getOriginalFilename(),
                "sha256", doc.getSha256Checksum(),
                "size", doc.getFileSize()
        ));
    }

    /**
     * Remove / Replace uploaded document (Question Paper or Answer Key) for a set
     */
    @DeleteMapping("/exams/{examId}/sets/{questionSetId}/documents/{docType}")
    @Transactional
    public ResponseEntity<Map<String, Object>> removeSetDocument(
            @PathVariable Long examId,
            @PathVariable Long questionSetId,
            @PathVariable String docType
    ) {
        storedDocumentRepository.deleteByQuestionSetIdAndDocumentType(questionSetId, docType.toUpperCase());
        return ResponseEntity.ok(Map.of(
                "success", true,
                "message", "Document " + docType + " removed from set"
        ));
    }

    /**
     * Initialize 4 sets for a department
     */
    @PostMapping("/exams/{examId}/departments/{departmentId}/initialize-sets")
    public ResponseEntity<List<Map<String, Object>>> initializeDepartmentSets(
            @PathVariable Long examId,
            @PathVariable Long departmentId,
            Authentication authentication
    ) {
        String adminUser = authentication != null ? authentication.getName() : "ADMIN";
        examService.initializeDepartmentSets(examId, departmentId, adminUser);
        return ResponseEntity.ok(getDepartmentSets(examId, departmentId));
    }
}
