package com.exam.secureexam.service;

import com.exam.secureexam.dto.ExamDto;
import com.exam.secureexam.model.*;
import com.exam.secureexam.repository.*;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class ExamService {

    @PersistenceContext
    private EntityManager entityManager;

    private final ExamRepository examRepository;
    private final DepartmentRepository departmentRepository;
    private final QuestionSetRepository questionSetRepository;
    private final QuestionRepository questionRepository;
    private final QuestionOptionRepository questionOptionRepository;
    private final ExamSlotRepository examSlotRepository;
    private final ExamAttemptRepository examAttemptRepository;
    private final AuditLogRepository auditLogRepository;

    public ExamService(
            ExamRepository examRepository,
            DepartmentRepository departmentRepository,
            QuestionSetRepository questionSetRepository,
            QuestionRepository questionRepository,
            QuestionOptionRepository questionOptionRepository,
            ExamSlotRepository examSlotRepository,
            ExamAttemptRepository examAttemptRepository,
            AuditLogRepository auditLogRepository
    ) {
        this.examRepository = examRepository;
        this.departmentRepository = departmentRepository;
        this.questionSetRepository = questionSetRepository;
        this.questionRepository = questionRepository;
        this.questionOptionRepository = questionOptionRepository;
        this.examSlotRepository = examSlotRepository;
        this.examAttemptRepository = examAttemptRepository;
        this.auditLogRepository = auditLogRepository;
    }

    @Transactional(readOnly = true)
    public List<ExamDto> getAllExams() {
        return examRepository.findAllByOrderByCreatedAtDesc().stream()
                .map(ExamDto::fromEntity)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<ExamDto> getPublishedExams() {
        return examRepository.findByStatusOrderByCreatedAtDesc("PUBLISHED").stream()
                .map(ExamDto::fromEntity)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ExamDto getExamById(Long id) {
        Exam exam = examRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Exam not found with ID: " + id));
        return ExamDto.fromEntity(exam);
    }

    @Transactional
    public ExamDto createExam(ExamDto dto, String performedBy) {
        Exam exam = new Exam();
        exam.setTitle(dto.getTitle().trim());
        exam.setDescription(dto.getDescription());
        exam.setDurationMinutes(dto.getDurationMinutes() != null ? dto.getDurationMinutes() : 60);
        exam.setTotalQuestions(dto.getTotalQuestions() != null ? dto.getTotalQuestions() : 50);
        exam.setStatus("DRAFT");
        exam.setQualificationMode(dto.getQualificationMode() != null ? dto.getQualificationMode() : "PERCENTAGE");
        exam.setQualificationThreshold(dto.getQualificationThreshold() != null ? dto.getQualificationThreshold() : new BigDecimal("60.00"));
        exam.setTimingMode(dto.getTimingMode() != null ? dto.getTimingMode() : "DURATION_FROM_START");
        exam.setTotalMarks(dto.getTotalMarks() != null ? dto.getTotalMarks() : new BigDecimal("100.00"));
        exam.setMarksPerQuestion(dto.getMarksPerQuestion() != null ? dto.getMarksPerQuestion() : new BigDecimal("1.00"));
        exam.setNegativeMarks(dto.getNegativeMarks() != null ? dto.getNegativeMarks() : BigDecimal.ZERO);
        exam.setScheduledStartTime(dto.getScheduledStartTime());
        exam.setScheduledEndTime(dto.getScheduledEndTime());
        exam.setResultsPublished(false);
        exam.setCreatedAt(OffsetDateTime.now());

        // Assign departments
        Set<Department> depts = new HashSet<>();
        if (dto.getDepartmentIds() != null && !dto.getDepartmentIds().isEmpty()) {
            depts.addAll(departmentRepository.findAllById(dto.getDepartmentIds()));
            exam.setDepartments(depts);
        }

        Exam saved = examRepository.save(exam);

        // Automatically initialize 4 independent Question Sets (A, B, C, D) for each department
        String[] sets = {"A", "B", "C", "D"};
        if (!depts.isEmpty()) {
            for (Department dept : depts) {
                for (String s : sets) {
                    QuestionSet qs = new QuestionSet(saved, dept, s, dept.getName() + " - Set " + s);
                    questionSetRepository.save(qs);
                }
            }
        } else {
            for (String s : sets) {
                QuestionSet qs = new QuestionSet(saved, s, "Question Set " + s);
                questionSetRepository.save(qs);
            }
        }

        // Initialize Default Slot 1 (capacity 150)
        OffsetDateTime now = OffsetDateTime.now();
        ExamSlot defaultSlot = new ExamSlot(saved, 1, now, now.plusDays(30), 150);
        examSlotRepository.save(defaultSlot);

        auditLogRepository.save(new AuditLog(
                "CREATE_EXAM",
                "Exam",
                String.valueOf(saved.getId()),
                performedBy,
                "Created exam: " + saved.getTitle() + " with 4 independent sets A-D per department and Slot 1"
        ));

        return ExamDto.fromEntity(saved);
    }

    @Transactional
    public ExamDto updateExam(Long id, ExamDto dto, String performedBy) {
        Exam exam = examRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Exam not found with ID: " + id));

        if ("PUBLISHED".equals(exam.getStatus()) || "COMPLETED".equals(exam.getStatus())) {
            long attemptCount = examAttemptRepository.countByExamId(id);
            if (attemptCount > 0) {
                throw new IllegalStateException("Cannot modify exam configuration once candidate attempts have begun.");
            }
        }

        exam.setTitle(dto.getTitle().trim());
        exam.setDescription(dto.getDescription());
        exam.setDurationMinutes(dto.getDurationMinutes());
        exam.setTotalQuestions(dto.getTotalQuestions());
        exam.setQualificationMode(dto.getQualificationMode());
        exam.setQualificationThreshold(dto.getQualificationThreshold());
        exam.setTimingMode(dto.getTimingMode());
        exam.setTotalMarks(dto.getTotalMarks());
        exam.setMarksPerQuestion(dto.getMarksPerQuestion());
        exam.setNegativeMarks(dto.getNegativeMarks());
        exam.setScheduledStartTime(dto.getScheduledStartTime());
        exam.setScheduledEndTime(dto.getScheduledEndTime());

        if (dto.getDepartmentIds() != null) {
            Set<Department> depts = new HashSet<>(departmentRepository.findAllById(dto.getDepartmentIds()));
            exam.setDepartments(depts);
            for (Department dept : depts) {
                for (String s : new String[]{"A", "B", "C", "D"}) {
                    if (!questionSetRepository.existsByExamIdAndDepartmentIdAndSetCode(id, dept.getId(), s)) {
                        QuestionSet qs = new QuestionSet(exam, dept, s, dept.getName() + " - Set " + s);
                        questionSetRepository.save(qs);
                    }
                }
            }
        }

        Exam saved = examRepository.save(exam);

        auditLogRepository.save(new AuditLog(
                "UPDATE_EXAM",
                "Exam",
                String.valueOf(saved.getId()),
                performedBy,
                "Updated exam configuration: " + saved.getTitle()
        ));

        return ExamDto.fromEntity(saved);
    }

    @Transactional
    public List<QuestionSet> initializeDepartmentSets(Long examId, Long departmentId, String performedBy) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new IllegalArgumentException("Exam not found with ID: " + examId));
        Department dept = departmentRepository.findById(departmentId)
                .orElseThrow(() -> new IllegalArgumentException("Department not found with ID: " + departmentId));

        for (String code : new String[]{"A", "B", "C", "D"}) {
            if (!questionSetRepository.existsByExamIdAndDepartmentIdAndSetCode(examId, departmentId, code)) {
                QuestionSet qs = new QuestionSet(exam, dept, code, dept.getName() + " - Set " + code);
                questionSetRepository.save(qs);
            }
        }

        auditLogRepository.save(new AuditLog(
                "INITIALIZE_DEPT_SETS",
                "Department",
                String.valueOf(departmentId),
                performedBy,
                "Initialized Sets A, B, C, D for Exam #" + examId + " & Department: " + dept.getName()
        ));

        return questionSetRepository.findByExamIdAndDepartmentIdOrderBySetCodeAsc(examId, departmentId);
    }

    @Transactional(readOnly = true)
    public List<Department> getExamDepartments(Long examId) {
        Exam exam = examRepository.findById(examId)
                .orElseThrow(() -> new IllegalArgumentException("Exam not found with ID: " + examId));
        return new ArrayList<>(exam.getDepartments());
    }

    @Transactional
    public ExamDto publishExam(Long id, String performedBy) {
        Exam exam = examRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Exam not found with ID: " + id));

        String[] setCodes = new String[]{"A", "B", "C", "D"};

        // Department-wise 4 sets validation & shuffle replication
        if (exam.getDepartments() != null && !exam.getDepartments().isEmpty()) {
            for (Department dept : exam.getDepartments()) {
                List<QuestionSet> deptSets = questionSetRepository.findByExamIdAndDepartmentIdOrderBySetCodeAsc(id, dept.getId());
                Set<String> existingCodes = deptSets.stream().map(QuestionSet::getSetCode).collect(Collectors.toSet());
                for (String code : setCodes) {
                    if (!existingCodes.contains(code)) {
                        QuestionSet qs = new QuestionSet(exam, dept, code, dept.getName() + " - Set " + code);
                        questionSetRepository.save(qs);
                    }
                }
                deptSets = questionSetRepository.findByExamIdAndDepartmentIdOrderBySetCodeAsc(id, dept.getId());

                QuestionSet sourceSet = null;
                for (QuestionSet s : deptSets) {
                    if (questionRepository.countByQuestionSetId(s.getId()) > 0) {
                        sourceSet = s;
                        break;
                    }
                }

                if (sourceSet != null) {
                    List<Question> sourceQuestions = questionRepository.findByQuestionSetIdOrderByDisplayOrderAsc(sourceSet.getId());
                    for (QuestionSet targetSet : deptSets) {
                        if (targetSet.getId().equals(sourceSet.getId())) continue;
                        if (questionRepository.countByQuestionSetId(targetSet.getId()) == 0) {
                            List<Question> shuffled = new ArrayList<>(sourceQuestions);
                            Collections.shuffle(shuffled);
                            int order = 1;
                            for (Question sq : shuffled) {
                                Question nq = new Question(targetSet, sq.getQuestionText(), sq.getMarks(), sq.getNegativeMarks(), order++);
                                nq = questionRepository.save(nq);
                                for (QuestionOption so : sq.getOptions()) {
                                    QuestionOption no = new QuestionOption(nq, so.getOptionText(), so.isCorrect(), so.getDisplayOrder());
                                    questionOptionRepository.save(no);
                                }
                            }
                        }
                    }
                }
            }
        } else {
            List<QuestionSet> sets = questionSetRepository.findByExamIdOrderBySetCodeAsc(id);
            Set<String> existingCodes = sets.stream().map(QuestionSet::getSetCode).collect(Collectors.toSet());
            for (String code : setCodes) {
                if (!existingCodes.contains(code)) {
                    QuestionSet qs = new QuestionSet(exam, code, "Question Set " + code);
                    questionSetRepository.save(qs);
                }
            }
            sets = questionSetRepository.findByExamIdOrderBySetCodeAsc(id);

            QuestionSet sourceSet = null;
            for (QuestionSet s : sets) {
                if (questionRepository.countByQuestionSetId(s.getId()) > 0) {
                    sourceSet = s;
                    break;
                }
            }

            if (sourceSet != null) {
                List<Question> sourceQuestions = questionRepository.findByQuestionSetIdOrderByDisplayOrderAsc(sourceSet.getId());
                for (QuestionSet targetSet : sets) {
                    if (targetSet.getId().equals(sourceSet.getId())) continue;
                    if (questionRepository.countByQuestionSetId(targetSet.getId()) == 0) {
                        List<Question> shuffled = new ArrayList<>(sourceQuestions);
                        Collections.shuffle(shuffled);
                        int order = 1;
                        for (Question sq : shuffled) {
                            Question nq = new Question(targetSet, sq.getQuestionText(), sq.getMarks(), sq.getNegativeMarks(), order++);
                            nq = questionRepository.save(nq);
                            for (QuestionOption so : sq.getOptions()) {
                                QuestionOption no = new QuestionOption(nq, so.getOptionText(), so.isCorrect(), so.getDisplayOrder());
                                questionOptionRepository.save(no);
                            }
                        }
                    }
                }
            }
        }

        exam.setStatus("PUBLISHED");
        Exam saved = examRepository.save(exam);

        auditLogRepository.save(new AuditLog(
                "PUBLISH_EXAM",
                "Exam",
                String.valueOf(saved.getId()),
                performedBy,
                "Published examination: " + saved.getTitle()
        ));

        return ExamDto.fromEntity(saved);
    }

    @Transactional
    public ExamDto closeExam(Long id, String performedBy) {
        Exam exam = examRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Exam not found with ID: " + id));

        exam.setStatus("COMPLETED");
        Exam saved = examRepository.save(exam);

        auditLogRepository.save(new AuditLog(
                "CLOSE_EXAM",
                "Exam",
                String.valueOf(saved.getId()),
                performedBy,
                "Closed examination: " + saved.getTitle()
        ));

        return ExamDto.fromEntity(saved);
    }

    @Transactional
    public ExamDto createExamFromParsed(com.exam.secureexam.dto.pdf.CreateExamFromParsedDto dto, String performedBy) {
        if (dto.getQuestions() == null || dto.getQuestions().isEmpty()) {
            throw new IllegalArgumentException("Cannot create examination with 0 questions. Please provide parsed questions.");
        }

        Exam exam = new Exam();
        exam.setTitle(dto.getTitle().trim());
        exam.setDescription(dto.getDescription());
        exam.setDurationMinutes(dto.getDurationMinutes() != null ? dto.getDurationMinutes() : 60);
        exam.setTotalQuestions(dto.getQuestions().size());
        exam.setStatus(dto.isPublishImmediately() ? "PUBLISHED" : "DRAFT");
        exam.setQualificationMode(dto.getQualificationMode() != null ? dto.getQualificationMode() : "PERCENTAGE");
        exam.setQualificationThreshold(dto.getQualificationThreshold() != null ? dto.getQualificationThreshold() : new BigDecimal("60.00"));
        exam.setTimingMode(dto.getTimingMode() != null ? dto.getTimingMode() : "DURATION_FROM_START");
        exam.setTotalMarks(dto.getTotalMarks() != null ? dto.getTotalMarks() : BigDecimal.valueOf(dto.getQuestions().size()));
        exam.setMarksPerQuestion(dto.getMarksPerQuestion() != null ? dto.getMarksPerQuestion() : BigDecimal.ONE);
        exam.setNegativeMarks(dto.getNegativeMarks() != null ? dto.getNegativeMarks() : BigDecimal.ZERO);
        exam.setScheduledStartTime(dto.getScheduledStartTime());
        exam.setScheduledEndTime(dto.getScheduledEndTime());
        exam.setResultsPublished(false);
        exam.setCreatedAt(OffsetDateTime.now());

        // Assign departments
        if (dto.getDepartmentIds() != null && !dto.getDepartmentIds().isEmpty()) {
            Set<Department> depts = new HashSet<>(departmentRepository.findAllById(dto.getDepartmentIds()));
            exam.setDepartments(depts);
        }

        Exam saved = examRepository.save(exam);

        // Sets to populate: default {"A", "B", "C", "D"}
        List<String> setCodes = (dto.getTargetSets() != null && !dto.getTargetSets().isEmpty())
                ? dto.getTargetSets()
                : List.of("A", "B", "C", "D");

        for (String s : setCodes) {
            QuestionSet qs = new QuestionSet(saved, s, "Question Set " + s);
            QuestionSet savedQs = questionSetRepository.save(qs);

            int order = 1;
            for (com.exam.secureexam.dto.pdf.ParsedQuestionDto pq : dto.getQuestions()) {
                Question q = new Question(
                        savedQs,
                        pq.getQuestionText().trim(),
                        pq.getMarks() != null ? pq.getMarks() : exam.getMarksPerQuestion(),
                        pq.getNegativeMarks() != null ? pq.getNegativeMarks() : exam.getNegativeMarks(),
                        order++
                );
                Question savedQ = questionRepository.save(q);

                if (pq.getOptions() != null) {
                    int optOrder = 1;
                    for (com.exam.secureexam.dto.pdf.ParsedOptionDto optDto : pq.getOptions()) {
                        boolean isCorrect = (pq.getCorrectOption() != null && pq.getCorrectOption().equalsIgnoreCase(optDto.getLabel()))
                                || optDto.isCorrect();
                        QuestionOption option = new QuestionOption(savedQ, optDto.getOptionText().trim(), isCorrect, optOrder++);
                        questionOptionRepository.save(option);
                    }
                }
            }
        }

        // Initialize Slot 1
        OffsetDateTime now = OffsetDateTime.now();
        ExamSlot defaultSlot = new ExamSlot(saved, 1, now, now.plusDays(30), 150);
        examSlotRepository.save(defaultSlot);

        auditLogRepository.save(new AuditLog(
                "CREATE_EXAM_FROM_PARSED_PDF",
                "Exam",
                String.valueOf(saved.getId()),
                performedBy,
                "Created examination from in-memory parsed PDF: " + saved.getTitle() + " with " + dto.getQuestions().size() + " MCQs across Sets " + setCodes
        ));

        return ExamDto.fromEntity(saved);
    }

    @Transactional
    public void deleteExam(Long id, String performedBy) {
        deleteExam(id, false, performedBy);
    }

    @Transactional
    public void deleteExam(Long id, boolean force, String performedBy) {
        Exam exam = examRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Exam not found with ID: " + id));

        long attemptCount = examAttemptRepository.countByExamId(id);
        if (attemptCount > 0 && !force) {
            throw new IllegalStateException("Exam has " + attemptCount + " candidate attempt record(s). Deleting will permanently remove all candidate attempts, answers, and results. Please confirm deletion with force=true.");
        }

        String examTitle = exam.getTitle();

        // 1. Delete randomized options and questions for attempts of this exam
        entityManager.createNativeQuery("DELETE FROM attempt_randomized_options WHERE attempt_id IN (SELECT id FROM exam_attempts WHERE exam_id = :examId)")
                .setParameter("examId", id).executeUpdate();

        entityManager.createNativeQuery("DELETE FROM attempt_randomized_questions WHERE attempt_id IN (SELECT id FROM exam_attempts WHERE exam_id = :examId)")
                .setParameter("examId", id).executeUpdate();

        // 2. Delete attempt answers
        entityManager.createNativeQuery("DELETE FROM attempt_answers WHERE attempt_id IN (SELECT id FROM exam_attempts WHERE exam_id = :examId)")
                .setParameter("examId", id).executeUpdate();

        // 3. Delete exam attempts
        entityManager.createNativeQuery("DELETE FROM exam_attempts WHERE exam_id = :examId")
                .setParameter("examId", id).executeUpdate();

        // 4. Delete candidate slots for slots of this exam
        entityManager.createNativeQuery("DELETE FROM candidate_slots WHERE slot_id IN (SELECT id FROM exam_slots WHERE exam_id = :examId)")
                .setParameter("examId", id).executeUpdate();

        // 5. Delete exam slots
        entityManager.createNativeQuery("DELETE FROM exam_slots WHERE exam_id = :examId")
                .setParameter("examId", id).executeUpdate();

        // 6. Delete stored documents associated with this exam or its question sets
        entityManager.createNativeQuery("DELETE FROM stored_documents WHERE exam_id = :examId OR question_set_id IN (SELECT id FROM question_sets WHERE exam_id = :examId)")
                .setParameter("examId", id).executeUpdate();

        // Capture all department IDs associated with this exam before cascade deletion
        @SuppressWarnings("unchecked")
        List<Number> examDeptIds = entityManager.createNativeQuery(
                "SELECT DISTINCT department_id FROM (" +
                "  SELECT department_id FROM exam_departments WHERE exam_id = :examId " +
                "  UNION " +
                "  SELECT department_id FROM question_sets WHERE exam_id = :examId AND department_id IS NOT NULL" +
                ") sub"
        ).setParameter("examId", id).getResultList();

        List<Long> deptIdList = (examDeptIds != null) ? examDeptIds.stream()
                .filter(Objects::nonNull)
                .map(Number::longValue)
                .toList() : Collections.emptyList();

        // 7. Delete question options for questions in question sets of this exam or associated departments
        entityManager.createNativeQuery("DELETE FROM question_options WHERE question_id IN (SELECT q.id FROM questions q JOIN question_sets qs ON q.question_set_id = qs.id WHERE qs.exam_id = :examId)")
                .setParameter("examId", id).executeUpdate();

        if (!deptIdList.isEmpty()) {
            entityManager.createNativeQuery("DELETE FROM question_options WHERE question_id IN (SELECT q.id FROM questions q JOIN question_sets qs ON q.question_set_id = qs.id WHERE qs.department_id IN (:deptIds))")
                    .setParameter("deptIds", deptIdList).executeUpdate();
        }

        // 8. Delete questions in question sets of this exam or associated departments
        entityManager.createNativeQuery("DELETE FROM questions WHERE question_set_id IN (SELECT id FROM question_sets WHERE exam_id = :examId)")
                .setParameter("examId", id).executeUpdate();

        if (!deptIdList.isEmpty()) {
            entityManager.createNativeQuery("DELETE FROM questions WHERE question_set_id IN (SELECT id FROM question_sets WHERE department_id IN (:deptIds))")
                    .setParameter("deptIds", deptIdList).executeUpdate();
        }

        // 9. Delete stored documents referencing this exam or associated departments
        entityManager.createNativeQuery("DELETE FROM stored_documents WHERE exam_id = :examId OR question_set_id IN (SELECT id FROM question_sets WHERE exam_id = :examId)")
                .setParameter("examId", id).executeUpdate();

        if (!deptIdList.isEmpty()) {
            entityManager.createNativeQuery("DELETE FROM stored_documents WHERE department_id IN (:deptIds)")
                    .setParameter("deptIds", deptIdList).executeUpdate();
        }

        // 10. Delete question sets of this exam or associated departments
        entityManager.createNativeQuery("DELETE FROM question_sets WHERE exam_id = :examId")
                .setParameter("examId", id).executeUpdate();

        if (!deptIdList.isEmpty()) {
            entityManager.createNativeQuery("DELETE FROM question_sets WHERE department_id IN (:deptIds)")
                    .setParameter("deptIds", deptIdList).executeUpdate();
        }

        // 11. Delete exam_departments join table for this exam
        entityManager.createNativeQuery("DELETE FROM exam_departments WHERE exam_id = :examId")
                .setParameter("examId", id).executeUpdate();

        // 12. Delete the exam
        entityManager.createNativeQuery("DELETE FROM exams WHERE id = :examId")
                .setParameter("examId", id).executeUpdate();

        // 13. Unlink candidates and delete the departments that were associated with this exam
        if (!deptIdList.isEmpty()) {
            entityManager.createNativeQuery("UPDATE candidates SET department_id = NULL WHERE department_id IN (:deptIds)")
                    .setParameter("deptIds", deptIdList).executeUpdate();

            entityManager.createNativeQuery("DELETE FROM exam_departments WHERE department_id IN (:deptIds)")
                    .setParameter("deptIds", deptIdList).executeUpdate();

            entityManager.createNativeQuery("DELETE FROM departments WHERE id IN (:deptIds)")
                    .setParameter("deptIds", deptIdList).executeUpdate();
        }

        // 14. Clean up any remaining orphaned departments not attached to any exam
        entityManager.createNativeQuery("UPDATE candidates SET department_id = NULL WHERE department_id NOT IN (SELECT DISTINCT department_id FROM exam_departments WHERE department_id IS NOT NULL)").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM stored_documents WHERE department_id IS NOT NULL AND department_id NOT IN (SELECT DISTINCT department_id FROM exam_departments WHERE department_id IS NOT NULL)").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM question_options WHERE question_id IN (SELECT q.id FROM questions q JOIN question_sets qs ON q.question_set_id = qs.id WHERE qs.department_id IS NOT NULL AND qs.department_id NOT IN (SELECT DISTINCT department_id FROM exam_departments WHERE department_id IS NOT NULL))").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM questions WHERE question_set_id IN (SELECT id FROM question_sets WHERE department_id IS NOT NULL AND department_id NOT IN (SELECT DISTINCT department_id FROM exam_departments WHERE department_id IS NOT NULL))").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM question_sets WHERE department_id IS NOT NULL AND department_id NOT IN (SELECT DISTINCT department_id FROM exam_departments WHERE department_id IS NOT NULL)").executeUpdate();
        entityManager.createNativeQuery("DELETE FROM departments WHERE id NOT IN (SELECT DISTINCT department_id FROM exam_departments WHERE department_id IS NOT NULL)").executeUpdate();

        auditLogRepository.save(new AuditLog(
                force && attemptCount > 0 ? "FORCE_DELETE_EXAM" : "DELETE_EXAM",
                "Exam",
                String.valueOf(id),
                performedBy,
                "Deleted examination: " + examTitle + (attemptCount > 0 ? " (cascade deleted " + attemptCount + " candidate attempts)" : "")
        ));
    }
}
