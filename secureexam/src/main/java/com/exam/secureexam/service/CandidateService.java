package com.exam.secureexam.service;

import com.exam.secureexam.dto.CandidateDto;
import com.exam.secureexam.model.*;
import com.exam.secureexam.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class CandidateService {

    private final CandidateRepository candidateRepository;
    private final DepartmentRepository departmentRepository;
    private final ExamRepository examRepository;
    private final ExamSlotRepository examSlotRepository;
    private final QuestionSetRepository questionSetRepository;
    private final ExamAttemptRepository examAttemptRepository;
    private final CandidateSlotRepository candidateSlotRepository;
    private final AuditLogRepository auditLogRepository;

    public CandidateService(
            CandidateRepository candidateRepository,
            DepartmentRepository departmentRepository,
            ExamRepository examRepository,
            ExamSlotRepository examSlotRepository,
            QuestionSetRepository questionSetRepository,
            ExamAttemptRepository examAttemptRepository,
            CandidateSlotRepository candidateSlotRepository,
            AuditLogRepository auditLogRepository
    ) {
        this.candidateRepository = candidateRepository;
        this.departmentRepository = departmentRepository;
        this.examRepository = examRepository;
        this.examSlotRepository = examSlotRepository;
        this.questionSetRepository = questionSetRepository;
        this.examAttemptRepository = examAttemptRepository;
        this.candidateSlotRepository = candidateSlotRepository;
        this.auditLogRepository = auditLogRepository;
    }

    public List<CandidateDto> getAllCandidates() {
        return candidateRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(CandidateDto::fromEntity)
                .collect(Collectors.toList());
    }

    @Transactional
    public CandidateDto createCandidate(CandidateDto dto, String performedBy) {
        String regNum = dto.getRegistrationNumber().trim().toUpperCase();
        if (candidateRepository.existsByRegistrationNumberIgnoreCase(regNum)) {
            throw new IllegalArgumentException("Candidate with Registration Number '" + regNum + "' already exists");
        }

        String email = dto.getEmail().trim().toLowerCase();
        if (candidateRepository.existsByEmailIgnoreCase(email)) {
            throw new IllegalArgumentException("Candidate with email '" + email + "' already exists");
        }

        Department dept = null;
        if (dto.getDepartmentId() != null) {
            dept = departmentRepository.findById(dto.getDepartmentId()).orElse(null);
        }

        Candidate c = new Candidate(regNum, dto.getFullName().trim(), email, dept);
        Candidate saved = candidateRepository.save(c);

        auditLogRepository.save(new AuditLog(
                "CREATE_CANDIDATE",
                "Candidate",
                String.valueOf(saved.getId()),
                performedBy,
                "Registered candidate: " + saved.getFullName() + " (" + regNum + ")"
        ));

        return CandidateDto.fromEntity(saved);
    }

    /**
     * Batch CSV Import:
     * Format: RegistrationNumber,FullName,Email,DepartmentCode
     */
    @Transactional
    public Map<String, Object> importCandidatesCsv(MultipartFile file, String performedBy) {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Uploaded CSV file is empty");
        }

        List<CandidateDto> createdList = new ArrayList<>();
        List<String> errors = new ArrayList<>();
        int lineNum = 0;

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                lineNum++;
                line = line.trim();
                if (line.isEmpty()) continue;

                // Skip header if line starts with registration or name
                if (lineNum == 1 && (line.toLowerCase().contains("registration") || line.toLowerCase().contains("email"))) {
                    continue;
                }

                String[] parts = line.split(",");
                if (parts.length < 3) {
                    errors.add("Line " + lineNum + ": insufficient columns (expected RegNumber, Name, Email, [DeptCode])");
                    continue;
                }

                String regNum = parts[0].trim().toUpperCase();
                String name = parts[1].trim();
                String email = parts[2].trim().toLowerCase();
                String deptCode = parts.length > 3 ? parts[3].trim().toUpperCase() : null;

                if (candidateRepository.existsByRegistrationNumberIgnoreCase(regNum)) {
                    errors.add("Line " + lineNum + ": RegNumber '" + regNum + "' already exists. Skipped.");
                    continue;
                }
                if (candidateRepository.existsByEmailIgnoreCase(email)) {
                    errors.add("Line " + lineNum + ": Email '" + email + "' already exists. Skipped.");
                    continue;
                }

                Department dept = null;
                if (deptCode != null && !deptCode.isEmpty()) {
                    dept = departmentRepository.findByCodeIgnoreCase(deptCode).orElse(null);
                }

                Candidate c = new Candidate(regNum, name, email, dept);
                Candidate saved = candidateRepository.save(c);
                createdList.add(CandidateDto.fromEntity(saved));
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to read CSV stream: " + e.getMessage(), e);
        }

        auditLogRepository.save(new AuditLog(
                "BATCH_IMPORT_CANDIDATES",
                "Candidate",
                "COUNT_" + createdList.size(),
                performedBy,
                "Imported " + createdList.size() + " candidates. Errors: " + errors.size()
        ));

        return Map.of(
                "success", true,
                "totalImported", createdList.size(),
                "errorsCount", errors.size(),
                "errors", errors,
                "candidates", createdList
        );
    }

    /**
     * Assign candidate to a specific Exam, Slot, and Question Set (A, B, C, or D)
     */
    @Transactional
    public ExamAttempt assignCandidateToExam(Long candidateId, Long examId, Long slotId, String setCode, String performedBy) {
        Candidate candidate = candidateRepository.findById(candidateId)
                .orElseThrow(() -> new IllegalArgumentException("Candidate not found with ID: " + candidateId));

        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new IllegalArgumentException("Exam not found with ID: " + examId));

        ExamSlot slot = slotId != null
                ? examSlotRepository.findById(slotId).orElseThrow(() -> new IllegalArgumentException("Slot not found: " + slotId))
                : examSlotRepository.findByExamIdOrderBySlotNumberAsc(examId).stream().findFirst()
                    .orElseThrow(() -> new IllegalStateException("Exam has no active slots"));

        QuestionSet questionSet = setCode != null
                ? questionSetRepository.findByExamIdAndSetCode(examId, setCode.toUpperCase()).orElseThrow(() -> new IllegalArgumentException("Set not found: " + setCode))
                : questionSetRepository.findByExamIdOrderBySetCodeAsc(examId).stream().findFirst()
                    .orElseThrow(() -> new IllegalStateException("Exam has no question sets"));

        Optional<ExamAttempt> existing = examAttemptRepository.findByCandidateIdAndExamId(candidateId, examId);
        if (existing.isPresent()) {
            return existing.get();
        }

        ExamAttempt attempt = new ExamAttempt(candidate, exam, slot, questionSet);
        ExamAttempt savedAttempt = examAttemptRepository.save(attempt);

        // Record slot assignment
        candidateSlotRepository.save(new CandidateSlot(candidateId, slot.getId()));

        auditLogRepository.save(new AuditLog(
                "ASSIGN_CANDIDATE",
                "ExamAttempt",
                String.valueOf(savedAttempt.getId()),
                performedBy,
                "Assigned candidate " + candidate.getRegistrationNumber() + " to exam '" + exam.getTitle() + "' Set " + questionSet.getSetCode()
        ));

        return savedAttempt;
    }
}
