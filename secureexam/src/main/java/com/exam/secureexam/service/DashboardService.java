package com.exam.secureexam.service;

import com.exam.secureexam.dto.CandidateExamDtos.DashboardStatsDto;
import com.exam.secureexam.dto.CandidateExamDtos.ExamResultDto;
import com.exam.secureexam.model.AuditLog;
import com.exam.secureexam.model.Exam;
import com.exam.secureexam.model.ExamAttempt;
import com.exam.secureexam.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class DashboardService {

    private final ExamRepository examRepository;
    private final CandidateRepository candidateRepository;
    private final DepartmentRepository departmentRepository;
    private final ExamAttemptRepository examAttemptRepository;
    private final AttemptAnswerRepository attemptAnswerRepository;
    private final AuditLogRepository auditLogRepository;

    public DashboardService(
            ExamRepository examRepository,
            CandidateRepository candidateRepository,
            DepartmentRepository departmentRepository,
            ExamAttemptRepository examAttemptRepository,
            AttemptAnswerRepository attemptAnswerRepository,
            AuditLogRepository auditLogRepository
    ) {
        this.examRepository = examRepository;
        this.candidateRepository = candidateRepository;
        this.departmentRepository = departmentRepository;
        this.examAttemptRepository = examAttemptRepository;
        this.attemptAnswerRepository = attemptAnswerRepository;
        this.auditLogRepository = auditLogRepository;
    }

    public DashboardStatsDto getLiveStatistics() {
        DashboardStatsDto stats = new DashboardStatsDto();
        stats.setApplication("ExamSecure Examination Platform");
        stats.setStatus("UP");
        stats.setTotalExams(examRepository.count());
        stats.setActiveExams(examRepository.countByStatus("PUBLISHED"));
        stats.setTotalCandidates(candidateRepository.count());
        stats.setTotalDepartments(departmentRepository.count());
        stats.setTotalAttempts(examAttemptRepository.count());
        stats.setSubmittedAttempts(examAttemptRepository.countByStatus("SUBMITTED"));

        long qualified = examAttemptRepository.findAll().stream()
                .filter(a -> "QUALIFIED".equalsIgnoreCase(a.getQualificationStatus()))
                .count();
        stats.setQualifiedCandidates(qualified);
        stats.setMessage("Live statistics aggregated from PostgreSQL database");
        return stats;
    }

    public List<ExamResultDto> getExamResults(Long examId) {
        List<ExamAttempt> attempts = examAttemptRepository.findAttemptsWithDetails(examId);

        return attempts.stream().map(a -> {
            ExamResultDto dto = new ExamResultDto();
            dto.setAttemptId(a.getId());
            dto.setCandidateId(a.getCandidate().getId());
            dto.setCandidateName(a.getCandidate().getFullName());
            dto.setRegistrationNumber(a.getCandidate().getRegistrationNumber());
            dto.setDepartmentName(a.getCandidate().getDepartment() != null ? a.getCandidate().getDepartment().getName() : "Unassigned");
            dto.setExamId(a.getExam().getId());
            dto.setExamTitle(a.getExam().getTitle());
            dto.setSetCode(a.getQuestionSet() != null ? a.getQuestionSet().getSetCode() : "-");
            dto.setSlotNumber(a.getSlot() != null ? a.getSlot().getSlotNumber() : 1);
            dto.setAttemptStatus(a.getStatus());

            long answered = attemptAnswerRepository.countByAttemptIdAndSelectedOptionIsNotNull(a.getId());
            long totalQ = a.getExam().getTotalQuestions();
            dto.setAnsweredCount(answered);
            dto.setUnansweredCount(Math.max(0, totalQ - answered));

            dto.setScore(a.getScore());
            dto.setTotalMarks(a.getTotalMarks() != null ? a.getTotalMarks() : a.getExam().getTotalMarks());
            dto.setPercentage(a.getPercentage());
            dto.setQualificationThreshold(a.getExam().getQualificationThreshold());
            dto.setQualificationStatus(a.getQualificationStatus());
            dto.setResultsPublished(a.getExam().isResultsPublished());
            dto.setSubmittedAt(a.getSubmittedAt());
            return dto;
        }).collect(Collectors.toList());
    }

    @Transactional
    public Exam publishExamResults(Long examId, boolean published, String performedBy) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new IllegalArgumentException("Exam not found with ID: " + examId));

        exam.setResultsPublished(published);
        Exam saved = examRepository.save(exam);

        auditLogRepository.save(new AuditLog(
                published ? "PUBLISH_RESULTS" : "UNPUBLISH_RESULTS",
                "Exam",
                String.valueOf(examId),
                performedBy,
                "Results publication state set to " + published + " for exam: " + exam.getTitle()
        ));

        return saved;
    }
}
