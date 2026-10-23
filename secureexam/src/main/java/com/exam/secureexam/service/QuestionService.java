package com.exam.secureexam.service;

import com.exam.secureexam.dto.QuestionDto;
import com.exam.secureexam.dto.QuestionOptionDto;
import com.exam.secureexam.model.*;
import com.exam.secureexam.repository.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
public class QuestionService {

    private final QuestionSetRepository questionSetRepository;
    private final QuestionRepository questionRepository;
    private final QuestionOptionRepository questionOptionRepository;
    private final ExamAttemptRepository examAttemptRepository;
    private final StoredDocumentRepository storedDocumentRepository;
    private final AuditLogRepository auditLogRepository;

    public QuestionService(
            QuestionSetRepository questionSetRepository,
            QuestionRepository questionRepository,
            QuestionOptionRepository questionOptionRepository,
            ExamAttemptRepository examAttemptRepository,
            StoredDocumentRepository storedDocumentRepository,
            AuditLogRepository auditLogRepository
    ) {
        this.questionSetRepository = questionSetRepository;
        this.questionRepository = questionRepository;
        this.questionOptionRepository = questionOptionRepository;
        this.examAttemptRepository = examAttemptRepository;
        this.storedDocumentRepository = storedDocumentRepository;
        this.auditLogRepository = auditLogRepository;
    }

    @Transactional(readOnly = true)
    public List<QuestionDto> getQuestionsBySetId(Long questionSetId) {
        return questionRepository.findByQuestionSetIdOrderByDisplayOrderAsc(questionSetId).stream()
                .map(QuestionDto::fromEntity)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<QuestionDto> getQuestionsByExamAndSetCode(Long examId, String setCode) {
        QuestionSet qs = questionSetRepository.findByExamIdAndSetCode(examId, setCode.toUpperCase())
                .orElseThrow(() -> new IllegalArgumentException("Question Set '" + setCode + "' not found for Exam ID: " + examId));
        return getQuestionsBySetId(qs.getId());
    }

    @Transactional(readOnly = true)
    public List<QuestionDto> getQuestionsByExamDeptAndSetCode(Long examId, Long departmentId, String setCode) {
        Optional<QuestionSet> qsOpt = questionSetRepository.findByExamIdAndDepartmentIdAndSetCode(examId, departmentId, setCode.toUpperCase());
        if (qsOpt.isPresent()) {
            return getQuestionsBySetId(qsOpt.get().getId());
        }
        // Fallback to exam-level set if department-specific set isn't found
        return getQuestionsByExamAndSetCode(examId, setCode);
    }

    @Transactional
    public QuestionDto createQuestion(Long questionSetId, QuestionDto dto, String performedBy) {
        QuestionSet questionSet = questionSetRepository.findById(questionSetId)
                .orElseThrow(() -> new IllegalArgumentException("Question Set not found with ID: " + questionSetId));

        int nextOrder = dto.getDisplayOrder() != null ? dto.getDisplayOrder() : (int) questionRepository.countByQuestionSetId(questionSetId) + 1;

        Question question = new Question(
                questionSet,
                dto.getQuestionText().trim(),
                dto.getMarks() != null ? dto.getMarks() : BigDecimal.ONE,
                dto.getNegativeMarks() != null ? dto.getNegativeMarks() : BigDecimal.ZERO,
                nextOrder
        );
        Question savedQuestion = questionRepository.save(question);

        if (dto.getOptions() != null && !dto.getOptions().isEmpty()) {
            for (int i = 0; i < dto.getOptions().size(); i++) {
                QuestionOptionDto optDto = dto.getOptions().get(i);
                boolean isCorrect = (dto.getCorrectOptionId() != null && dto.getCorrectOptionId().equals(optDto.getId()))
                        || optDto.isCorrect()
                        || (dto.getCorrectOptionId() == null && i == 0); // default first if none specified

                QuestionOption option = new QuestionOption(savedQuestion, optDto.getOptionText().trim(), isCorrect, i + 1);
                QuestionOption savedOpt = questionOptionRepository.save(option);
                savedQuestion.getOptions().add(savedOpt);
            }
        }

        auditLogRepository.save(new AuditLog(
                "CREATE_QUESTION",
                "Question",
                String.valueOf(savedQuestion.getId()),
                performedBy,
                "Added MCQ to Set " + questionSet.getSetCode() + " order=" + nextOrder
        ));

        return QuestionDto.fromEntity(savedQuestion);
    }

    @Transactional
    public void deleteQuestion(Long questionId, String performedBy) {
        Question q = questionRepository.findById(questionId)
                .orElseThrow(() -> new IllegalArgumentException("Question not found with ID: " + questionId));
        questionRepository.delete(q);

        auditLogRepository.save(new AuditLog(
                "DELETE_QUESTION",
                "Question",
                String.valueOf(questionId),
                performedBy,
                "Deleted MCQ question ID: " + questionId
        ));
    }

    /**
     * Parses structured raw text containing multiple MCQs:
     * Format:
     * Q: <Question Text>
     * A) <Option 1>
     * B) <Option 2>
     * C) <Option 3>
     * D) <Option 4>
     * Ans: B
     */
    @Transactional
    public List<QuestionDto> importQuestionsFromText(Long questionSetId, String rawText, String performedBy) {
        QuestionSet qs = questionSetRepository.findById(questionSetId)
                .orElseThrow(() -> new IllegalArgumentException("Question Set not found with ID: " + questionSetId));

        List<Question> questionsToSave = new ArrayList<>();
        List<QuestionOption> optionsToSave = new ArrayList<>();
        String[] blocks = rawText.split("(?i)(?=Q(?:uestion)?\\s*\\d*\\s*[:.)])");

        int currentOrder = (int) questionRepository.countByQuestionSetId(questionSetId);

        Pattern optionPattern = Pattern.compile("(?m)^\\s*([A-Da-d])[\\)\\.]\\s*(.+)$");
        Pattern answerPattern = Pattern.compile("(?i)(?:Ans(?:wer)?|Correct)\\s*[:.)]\\s*([A-Da-d])");

        for (String block : blocks) {
            String trimmed = block.trim();
            if (trimmed.isEmpty()) continue;

            // Extract question title line
            String[] lines = trimmed.split("\n", 2);
            String questionHeader = lines[0].replaceFirst("(?i)^Q(?:uestion)?\\s*\\d*\\s*[:.)]\\s*", "").trim();
            if (questionHeader.isEmpty() && lines.length > 1) {
                questionHeader = lines[1].trim();
            }

            // Find options
            Matcher optMatcher = optionPattern.matcher(trimmed);
            Map<String, String> foundOptions = new LinkedHashMap<>();
            while (optMatcher.find()) {
                foundOptions.put(optMatcher.group(1).toUpperCase(), optMatcher.group(2).trim());
            }

            if (foundOptions.size() < 2) continue; // Skip unparsed blocks

            // Find answer
            Matcher ansMatcher = answerPattern.matcher(trimmed);
            String correctLetter = ansMatcher.find() ? ansMatcher.group(1).toUpperCase() : "A";

            currentOrder++;
            Question q = new Question(qs, questionHeader, BigDecimal.ONE, BigDecimal.ZERO, currentOrder);

            int optOrder = 1;
            for (Map.Entry<String, String> entry : foundOptions.entrySet()) {
                boolean isCorrect = entry.getKey().equalsIgnoreCase(correctLetter);
                QuestionOption opt = new QuestionOption(q, entry.getValue(), isCorrect, optOrder++);
                q.getOptions().add(opt);
                optionsToSave.add(opt);
            }

            questionsToSave.add(q);
        }

        List<Question> savedQuestions = questionRepository.saveAll(questionsToSave);
        questionOptionRepository.saveAll(optionsToSave);

        List<QuestionDto> imported = savedQuestions.stream()
                .map(QuestionDto::fromEntity)
                .collect(Collectors.toList());

        auditLogRepository.save(new AuditLog(
                "IMPORT_QUESTIONS",
                "QuestionSet",
                String.valueOf(questionSetId),
                performedBy,
                "Imported " + imported.size() + " MCQs to Question Set " + qs.getSetCode()
        ));

        return imported;
    }

    /**
     * Maps an Answer Key document or text string to the questions in a set.
     * Format: "1. B, 2. D, 3. A" or "1:B\n2:D\n3:A"
     */
    @Transactional
    public Map<String, Object> applyAnswerKey(Long questionSetId, String answerKeyText, String performedBy) {
        QuestionSet qs = questionSetRepository.findById(questionSetId)
                .orElseThrow(() -> new IllegalArgumentException("Question Set not found with ID: " + questionSetId));

        List<Question> questions = questionRepository.findByQuestionSetIdOrderByDisplayOrderAsc(questionSetId);
        if (questions.isEmpty()) {
            throw new IllegalStateException("Cannot apply answer key: Question Set " + qs.getSetCode() + " has no questions.");
        }

        Pattern pairPattern = Pattern.compile("(\\d+)\\s*[:.)-]\\s*([A-Da-d])");
        Matcher matcher = pairPattern.matcher(answerKeyText);

        Map<Integer, String> mappings = new HashMap<>();
        while (matcher.find()) {
            int qNum = Integer.parseInt(matcher.group(1));
            String optLetter = matcher.group(2).toUpperCase();
            mappings.put(qNum, optLetter);
        }

        int updatedCount = 0;
        for (int i = 0; i < questions.size(); i++) {
            Question q = questions.get(i);
            int displayNum = i + 1;
            String targetLetter = mappings.get(displayNum);

            if (targetLetter != null && q.getOptions() != null) {
                int targetIndex = targetLetter.charAt(0) - 'A';
                for (int oIdx = 0; oIdx < q.getOptions().size(); oIdx++) {
                    QuestionOption opt = q.getOptions().get(oIdx);
                    opt.setCorrect(oIdx == targetIndex);
                    questionOptionRepository.save(opt);
                }
                updatedCount++;
            }
        }

        auditLogRepository.save(new AuditLog(
                "APPLY_ANSWER_KEY",
                "QuestionSet",
                String.valueOf(questionSetId),
                performedBy,
                "Applied answer key to Set " + qs.getSetCode() + ": updated " + updatedCount + " questions"
        ));

        return Map.of(
                "success", true,
                "setCode", qs.getSetCode(),
                "totalQuestions", questions.size(),
                "mappedAnswers", updatedCount
        );
    }

    @Transactional
    public List<QuestionDto> bulkUpdateQuestions(Long questionSetId, List<QuestionDto> dtos, String performedBy) {
        QuestionSet qs = questionSetRepository.findById(questionSetId)
                .orElseThrow(() -> new IllegalArgumentException("Question Set not found with ID: " + questionSetId));

        if (examAttemptRepository.countByQuestionSetId(questionSetId) > 0) {
            throw new IllegalStateException("Cannot modify questions for Set " + qs.getSetCode() + ": Candidate attempts have already been started.");
        }

        // Delete existing questions in this set
        List<Question> existing = questionRepository.findByQuestionSetIdOrderByDisplayOrderAsc(questionSetId);
        questionRepository.deleteAll(existing);
        questionRepository.flush();

        List<Question> questionsToSave = new ArrayList<>();
        int order = 1;
        for (QuestionDto dto : dtos) {
            if (dto.getQuestionText() == null || dto.getQuestionText().trim().isEmpty()) continue;

            Question q = new Question(
                    qs,
                    dto.getQuestionText().trim(),
                    dto.getMarks() != null ? dto.getMarks() : BigDecimal.ONE,
                    dto.getNegativeMarks() != null ? dto.getNegativeMarks() : BigDecimal.ZERO,
                    order++
            );

            if (dto.getOptions() != null && !dto.getOptions().isEmpty()) {
                for (int i = 0; i < dto.getOptions().size(); i++) {
                    QuestionOptionDto optDto = dto.getOptions().get(i);
                    boolean isCorrect = (dto.getCorrectOptionId() != null && dto.getCorrectOptionId().equals(optDto.getId()))
                            || optDto.isCorrect()
                            || (dto.getCorrectOptionId() == null && i == 0);

                    QuestionOption option = new QuestionOption(q, optDto.getOptionText() != null ? optDto.getOptionText().trim() : "", isCorrect, i + 1);
                    q.getOptions().add(option);
                }
            }
            questionsToSave.add(q);
        }

        List<Question> savedQuestions = questionRepository.saveAll(questionsToSave);
        questionRepository.flush();

        List<QuestionDto> updated = savedQuestions.stream()
                .map(QuestionDto::fromEntity)
                .collect(Collectors.toList());

        auditLogRepository.save(new AuditLog(
                "BULK_UPDATE_QUESTIONS",
                "QuestionSet",
                String.valueOf(questionSetId),
                performedBy,
                "Bulk updated " + updated.size() + " MCQs for Set " + qs.getSetCode()
        ));

        return updated;
    }

    @Transactional
    public void deleteAllQuestionsInSet(Long questionSetId, String performedBy) {
        QuestionSet qs = questionSetRepository.findById(questionSetId)
                .orElseThrow(() -> new IllegalArgumentException("Question Set not found with ID: " + questionSetId));

        if (examAttemptRepository.countByQuestionSetId(questionSetId) > 0) {
            throw new IllegalStateException("Cannot delete questions for Set " + qs.getSetCode() + ": Candidate attempts exist.");
        }

        List<Question> questions = questionRepository.findByQuestionSetIdOrderByDisplayOrderAsc(questionSetId);
        int count = questions.size();
        questionRepository.deleteAll(questions);

        auditLogRepository.save(new AuditLog(
                "DELETE_ALL_QUESTIONS",
                "QuestionSet",
                String.valueOf(questionSetId),
                performedBy,
                "Deleted all " + count + " MCQs from Set " + qs.getSetCode()
        ));
    }

    @Transactional
    public void deleteQuestionSet(Long questionSetId, String performedBy) {
        QuestionSet qs = questionSetRepository.findById(questionSetId)
                .orElseThrow(() -> new IllegalArgumentException("Question Set not found with ID: " + questionSetId));

        if (examAttemptRepository.countByQuestionSetId(questionSetId) > 0) {
            throw new IllegalStateException("Cannot delete Question Set " + qs.getSetCode() + ": Historical candidate attempts exist.");
        }

        List<Question> questions = questionRepository.findByQuestionSetIdOrderByDisplayOrderAsc(questionSetId);
        questionRepository.deleteAll(questions);
        storedDocumentRepository.deleteByQuestionSetId(questionSetId);
        questionSetRepository.delete(qs);

        auditLogRepository.save(new AuditLog(
                "DELETE_QUESTION_SET",
                "QuestionSet",
                String.valueOf(questionSetId),
                performedBy,
                "Deleted Question Set ID: " + questionSetId + " (Set " + qs.getSetCode() + ")"
        ));
    }
}
