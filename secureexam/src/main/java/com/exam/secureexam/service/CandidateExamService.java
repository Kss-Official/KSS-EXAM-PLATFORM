package com.exam.secureexam.service;

import com.exam.secureexam.dto.CandidateExamDtos.*;
import com.exam.secureexam.dto.CandidateQuestionDto;
import com.exam.secureexam.dto.CandidateQuestionDto.CandidateOptionDto;
import com.exam.secureexam.model.*;
import com.exam.secureexam.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class CandidateExamService {

    private final CandidateRepository candidateRepository;
    private final DepartmentRepository departmentRepository;
    private final ExamRepository examRepository;
    private final QuestionSetRepository questionSetRepository;
    private final QuestionRepository questionRepository;
    private final QuestionOptionRepository questionOptionRepository;
    private final ExamSlotRepository examSlotRepository;
    private final ExamAttemptRepository examAttemptRepository;
    private final AttemptAnswerRepository attemptAnswerRepository;
    private final AttemptRandomizedQuestionRepository randomizedQuestionRepository;
    private final AttemptRandomizedOptionRepository randomizedOptionRepository;
    private final AuditLogRepository auditLogRepository;

    private final SecureRandom secureRandom = new SecureRandom();

    public CandidateExamService(
            CandidateRepository candidateRepository,
            DepartmentRepository departmentRepository,
            ExamRepository examRepository,
            QuestionSetRepository questionSetRepository,
            QuestionRepository questionRepository,
            QuestionOptionRepository questionOptionRepository,
            ExamSlotRepository examSlotRepository,
            ExamAttemptRepository examAttemptRepository,
            AttemptAnswerRepository attemptAnswerRepository,
            AttemptRandomizedQuestionRepository randomizedQuestionRepository,
            AttemptRandomizedOptionRepository randomizedOptionRepository,
            AuditLogRepository auditLogRepository
    ) {
        this.candidateRepository = candidateRepository;
        this.departmentRepository = departmentRepository;
        this.examRepository = examRepository;
        this.questionSetRepository = questionSetRepository;
        this.questionRepository = questionRepository;
        this.questionOptionRepository = questionOptionRepository;
        this.examSlotRepository = examSlotRepository;
        this.examAttemptRepository = examAttemptRepository;
        this.attemptAnswerRepository = attemptAnswerRepository;
        this.randomizedQuestionRepository = randomizedQuestionRepository;
        this.randomizedOptionRepository = randomizedOptionRepository;
        this.auditLogRepository = auditLogRepository;
    }

    /**
     * Step 1: Candidate Verification & Exam Matching
     */
    @Transactional
    public CandidateVerifyResponse verifyCandidate(CandidateVerifyRequest req) {
        CandidateVerifyResponse resp = new CandidateVerifyResponse();

        String regNum = req.getRegistrationNumber() != null ? req.getRegistrationNumber().trim().toUpperCase() : "";
        Optional<Candidate> candOpt = candidateRepository.findByRegistrationNumberIgnoreCase(regNum);

        Candidate candidate;
        if (candOpt.isEmpty()) {
            Department dept = null;
            if (req.getDepartmentId() != null) {
                dept = departmentRepository.findById(req.getDepartmentId()).orElse(null);
            }
            candidate = new Candidate(
                    regNum,
                    "Candidate " + regNum,
                    regNum.toLowerCase() + "@secureexam.local",
                    dept
            );
            candidate.setStatus("ACTIVE");
            candidate = candidateRepository.save(candidate);
        } else {
            candidate = candOpt.get();
        }

        if (!"ACTIVE".equalsIgnoreCase(candidate.getStatus())) {
            resp.setEligible(false);
            resp.setMessage("Candidate account is disabled or suspended.");
            return resp;
        }

        resp.setCandidateId(candidate.getId());
        resp.setRegistrationNumber(candidate.getRegistrationNumber());
        resp.setFullName(candidate.getFullName());

        // Find active attempt or matching published exam
        List<ExamAttempt> existingAttempts = examAttemptRepository.findByCandidateId(candidate.getId());
        ExamAttempt activeAttempt = existingAttempts.stream()
                .filter(a -> "ASSIGNED".equals(a.getStatus()) || "IN_PROGRESS".equals(a.getStatus()))
                .findFirst()
                .orElse(null);

        Exam exam;
        QuestionSet questionSet;
        ExamSlot slot;

        if (activeAttempt != null) {
            exam = activeAttempt.getExam();
            questionSet = activeAttempt.getQuestionSet();
            slot = activeAttempt.getSlot();
        } else {
            // Check department eligibility
            Long deptId = req.getDepartmentId() != null
                    ? req.getDepartmentId()
                    : (candidate.getDepartment() != null ? candidate.getDepartment().getId() : null);

            if (deptId == null) {
                resp.setEligible(false);
                resp.setMessage("Please select your assigned department to proceed.");
                return resp;
            }

            List<Exam> publishedExams = examRepository.findPublishedExamsByDepartmentId(deptId);
            if (publishedExams.isEmpty()) {
                // Check if any published exam applies to all departments or matches this department
                List<Exam> allPublished = examRepository.findByStatusOrderByCreatedAtDesc("PUBLISHED");
                publishedExams = allPublished.stream()
                        .filter(e -> e.getDepartments() == null || e.getDepartments().isEmpty()
                                || e.getDepartments().stream().anyMatch(d -> d.getId().equals(deptId)))
                        .collect(Collectors.toList());
            }

            if (publishedExams.isEmpty()) {
                resp.setEligible(false);
                resp.setMessage("No published examination is currently available for this department. Please ensure an exam is published by the administrator.");
                return resp;
            }

            exam = publishedExams.get(0);

            // Assign set in round-robin fashion across A, B, C, D for candidate's department
            List<QuestionSet> sets = questionSetRepository.findByExamIdAndDepartmentIdOrderBySetCodeAsc(exam.getId(), deptId);
            if (sets.isEmpty()) {
                sets = questionSetRepository.findByExamIdOrderBySetCodeAsc(exam.getId());
            }
            if (sets.isEmpty()) {
                resp.setEligible(false);
                resp.setMessage("Examination sets are not configured. Please contact administrator.");
                return resp;
            }

            long totalAssigned = examAttemptRepository.countByExamId(exam.getId());
            int setIndex = (int) (totalAssigned % sets.size());
            questionSet = sets.get(setIndex);

            slot = examSlotRepository.findByExamIdOrderBySlotNumberAsc(exam.getId()).stream().findFirst().orElse(null);

            // Create assigned attempt
            ExamAttempt newAttempt = new ExamAttempt(candidate, exam, slot, questionSet);
            activeAttempt = examAttemptRepository.save(newAttempt);
        }

        resp.setEligible(true);
        resp.setMessage("Candidate verified successfully. Ready to start examination.");
        resp.setExamId(exam.getId());
        resp.setExamTitle(exam.getTitle());
        resp.setDurationMinutes(exam.getDurationMinutes());
        resp.setTotalQuestions(exam.getTotalQuestions());
        resp.setTimingMode(exam.getTimingMode());
        resp.setScheduledStartTime(exam.getScheduledStartTime());
        resp.setScheduledEndTime(exam.getScheduledEndTime());
        resp.setSetCode(questionSet.getSetCode());
        resp.setDepartmentName(candidate.getDepartment() != null ? candidate.getDepartment().getName() : "General Assessment");
        resp.setSlotName(slot != null ? "Slot " + slot.getSlotNumber() : "Slot 1 (Main)");

        return resp;
    }

    /**
     * Step 2: Start or Resume Examination with Server-Enforced Timer and Randomization
     */
    @Transactional
    public CandidateStartAttemptResponse startOrResumeAttempt(Long candidateId, Long examId) {
        ExamAttempt attempt = examAttemptRepository.findByCandidateIdAndExamId(candidateId, examId)
                .orElseThrow(() -> new IllegalArgumentException("No examination assignment found for candidate"));

        Exam exam = attempt.getExam();
        OffsetDateTime now = OffsetDateTime.now();

        if ("SUBMITTED".equals(attempt.getStatus()) || "EXPIRED".equals(attempt.getStatus())) {
            throw new IllegalStateException("Examination attempt has already been finalized (" + attempt.getStatus() + ").");
        }

        // Initialize timer if first launch
        if ("ASSIGNED".equals(attempt.getStatus())) {
            attempt.setStatus("IN_PROGRESS");
            attempt.setStartedAt(now);
            attempt.setExpiresAt(now.plusMinutes(exam.getDurationMinutes()));
            attempt = examAttemptRepository.save(attempt);

            // Randomize and persist question order
            List<Question> rawQuestions = questionRepository.findByQuestionSetIdOrderByDisplayOrderAsc(attempt.getQuestionSet().getId());
            List<Question> shuffledQuestions = new ArrayList<>(rawQuestions);
            Collections.shuffle(shuffledQuestions, secureRandom);

            for (int i = 0; i < shuffledQuestions.size(); i++) {
                Question q = shuffledQuestions.get(i);
                AttemptRandomizedQuestion arq = new AttemptRandomizedQuestion(attempt, q, i + 1);
                randomizedQuestionRepository.save(arq);

                // Independently randomize options for this question
                List<QuestionOption> rawOptions = new ArrayList<>(q.getOptions());
                Collections.shuffle(rawOptions, secureRandom);

                String[] labels = {"A", "B", "C", "D"};
                for (int j = 0; j < rawOptions.size(); j++) {
                    QuestionOption opt = rawOptions.get(j);
                    String lbl = j < labels.length ? labels[j] : String.valueOf((char)('A' + j));
                    AttemptRandomizedOption aro = new AttemptRandomizedOption(attempt, q, opt, j + 1, lbl);
                    randomizedOptionRepository.save(aro);
                }
            }

            auditLogRepository.save(new AuditLog(
                    "START_EXAM_ATTEMPT",
                    "ExamAttempt",
                    String.valueOf(attempt.getId()),
                    attempt.getCandidate().getRegistrationNumber(),
                    "Started attempt: examId=" + exam.getId() + " set=" + attempt.getQuestionSet().getSetCode()
            ));
        } else if ("IN_PROGRESS".equals(attempt.getStatus())) {
            // Check deadline expiry
            if (attempt.getExpiresAt() != null && now.isAfter(attempt.getExpiresAt())) {
                finalizeSubmission(attempt);
                throw new IllegalStateException("Examination deadline has expired. Attempt has been auto-submitted.");
            }
        }

        // Fetch persisted randomized questions and options
        List<AttemptRandomizedQuestion> savedQSequence = randomizedQuestionRepository.findByAttemptIdOrderByDisplayOrderAsc(attempt.getId());
        List<AttemptRandomizedOption> savedOptSequence = randomizedOptionRepository.findByAttemptIdOrderByQuestionIdAscDisplayOrderAsc(attempt.getId());

        Map<Long, List<AttemptRandomizedOption>> optionsByQuestionId = savedOptSequence.stream()
                .collect(Collectors.groupingBy(o -> o.getQuestion().getId()));

        // Fetch previously saved answers for this attempt
        Map<Long, Long> answeredMap = attemptAnswerRepository.findByAttemptId(attempt.getId()).stream()
                .filter(a -> a.getSelectedOption() != null)
                .collect(Collectors.toMap(a -> a.getQuestion().getId(), a -> a.getSelectedOption().getId()));

        List<CandidateQuestionDto> candidateQuestions = new ArrayList<>();
        for (AttemptRandomizedQuestion arq : savedQSequence) {
            Question q = arq.getQuestion();
            CandidateQuestionDto cqDto = new CandidateQuestionDto();
            cqDto.setQuestionId(q.getId());
            cqDto.setDisplayIndex(arq.getDisplayOrder());
            cqDto.setQuestionText(q.getQuestionText());
            cqDto.setMarks(q.getMarks());
            cqDto.setSelectedOptionId(answeredMap.get(q.getId()));

            List<AttemptRandomizedOption> optList = optionsByQuestionId.getOrDefault(q.getId(), Collections.emptyList());
            for (AttemptRandomizedOption aro : optList) {
                cqDto.getOptions().add(new CandidateOptionDto(
                        aro.getOption().getId(),
                        aro.getDisplayLabel(),
                        aro.getOption().getOptionText()
                ));
            }

            candidateQuestions.add(cqDto);
        }

        CandidateStartAttemptResponse resp = new CandidateStartAttemptResponse();
        resp.setAttemptId(attempt.getId());
        resp.setExamId(exam.getId());
        resp.setExamTitle(exam.getTitle());
        resp.setSetCode(attempt.getQuestionSet().getSetCode());
        resp.setStartedAt(attempt.getStartedAt());
        resp.setDeadlineAt(attempt.getExpiresAt());

        long remainingSec = Math.max(0, Duration.between(now, attempt.getExpiresAt()).getSeconds());
        resp.setTotalDurationSeconds((int) remainingSec);
        resp.setQuestions(candidateQuestions);

        return resp;
    }

    /**
     * Step 3: Server-authoritative answer saving
     */
    @Transactional
    public Map<String, Object> saveAnswer(Long attemptId, Long questionId, Long selectedOptionId) {
        ExamAttempt attempt = examAttemptRepository.findById(attemptId)
                .orElseThrow(() -> new IllegalArgumentException("Attempt not found with ID: " + attemptId));

        if (!"IN_PROGRESS".equals(attempt.getStatus())) {
            throw new IllegalStateException("Cannot record answers: attempt is " + attempt.getStatus());
        }

        if (attempt.getExpiresAt() != null && OffsetDateTime.now().isAfter(attempt.getExpiresAt())) {
            finalizeSubmission(attempt);
            throw new IllegalStateException("Exam deadline expired. Answers are no longer accepted.");
        }

        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> new IllegalArgumentException("Question not found with ID: " + questionId));

        QuestionOption option = null;
        if (selectedOptionId != null) {
            option = questionOptionRepository.findById(selectedOptionId)
                    .orElseThrow(() -> new IllegalArgumentException("Selected option not found"));
            if (!option.getQuestion().getId().equals(questionId)) {
                throw new IllegalArgumentException("Selected option does not belong to question");
            }
        }

        AttemptAnswer answer = attemptAnswerRepository.findByAttemptIdAndQuestionId(attemptId, questionId)
                .orElse(new AttemptAnswer(attempt, question, option));

        answer.setSelectedOption(option);
        answer.setAnsweredAt(OffsetDateTime.now());
        attemptAnswerRepository.save(answer);

        return Map.of("success", true, "questionId", questionId, "savedOptionId", selectedOptionId != null ? selectedOptionId : -1L);
    }

    /**
     * Step 4: Submission & Objective Server-Side Scoring
     */
    @Transactional
    public SubmissionResponse submitAttempt(Long attemptId) {
        ExamAttempt attempt = examAttemptRepository.findById(attemptId)
                .orElseThrow(() -> new IllegalArgumentException("Attempt not found with ID: " + attemptId));

        return finalizeSubmission(attempt);
    }

    private SubmissionResponse finalizeSubmission(ExamAttempt attempt) {
        if ("SUBMITTED".equals(attempt.getStatus())) {
            SubmissionResponse r = new SubmissionResponse();
            r.setSuccess(true);
            r.setMessage("Attempt was already submitted.");
            r.setAttemptId(attempt.getId());
            r.setReceiptId(attempt.getReceiptId());
            r.setSubmittedAt(attempt.getSubmittedAt());
            return r;
        }

        Exam exam = attempt.getExam();
        List<AttemptAnswer> answers = attemptAnswerRepository.findByAttemptId(attempt.getId());

        BigDecimal calculatedScore = BigDecimal.ZERO;
        for (AttemptAnswer a : answers) {
            Question q = a.getQuestion();
            QuestionOption selected = a.getSelectedOption();
            if (selected != null) {
                if (selected.isCorrect()) {
                    calculatedScore = calculatedScore.add(q.getMarks() != null ? q.getMarks() : BigDecimal.ONE);
                } else {
                    calculatedScore = calculatedScore.subtract(q.getNegativeMarks() != null ? q.getNegativeMarks() : BigDecimal.ZERO);
                }
            }
        }

        // Prevent negative final score if below zero
        if (calculatedScore.compareTo(BigDecimal.ZERO) < 0) {
            calculatedScore = BigDecimal.ZERO;
        }

        BigDecimal totalExamMarks = exam.getTotalMarks() != null && exam.getTotalMarks().compareTo(BigDecimal.ZERO) > 0
                ? exam.getTotalMarks()
                : new BigDecimal("100.00");

        BigDecimal percentage = calculatedScore.divide(totalExamMarks, 4, RoundingMode.HALF_UP)
                .multiply(new BigDecimal("100"))
                .setScale(2, RoundingMode.HALF_UP);

        BigDecimal threshold = exam.getQualificationThreshold() != null
                ? exam.getQualificationThreshold()
                : new BigDecimal("60.00");

        String qualStatus;
        if ("PERCENTAGE".equalsIgnoreCase(exam.getQualificationMode())) {
            qualStatus = percentage.compareTo(threshold) >= 0 ? "QUALIFIED" : "NOT_QUALIFIED";
        } else {
            qualStatus = calculatedScore.compareTo(threshold) >= 0 ? "QUALIFIED" : "NOT_QUALIFIED";
        }

        String receipt = "SEB-REC-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase() + "-" + System.currentTimeMillis();

        attempt.setStatus("SUBMITTED");
        attempt.setSubmittedAt(OffsetDateTime.now());
        attempt.setScore(calculatedScore);
        attempt.setTotalMarks(totalExamMarks);
        attempt.setPercentage(percentage);
        attempt.setQualificationStatus(qualStatus);
        attempt.setReceiptId(receipt);

        ExamAttempt saved = examAttemptRepository.save(attempt);

        auditLogRepository.save(new AuditLog(
                "SUBMIT_EXAM",
                "ExamAttempt",
                String.valueOf(saved.getId()),
                attempt.getCandidate().getRegistrationNumber(),
                "Finalized exam submission: score=" + calculatedScore + " status=" + qualStatus + " receipt=" + receipt
        ));

        SubmissionResponse resp = new SubmissionResponse();
        resp.setSuccess(true);
        resp.setMessage("Examination submitted successfully. Your answers have been safely acknowledged and recorded.");
        resp.setReceiptId(receipt);
        resp.setSubmittedAt(saved.getSubmittedAt());
        resp.setAttemptId(saved.getId());

        // Only expose score if results are published by administrator
        if (exam.isResultsPublished()) {
            resp.setScore(calculatedScore);
            resp.setQualificationStatus(qualStatus);
        }

        return resp;
    }
}
