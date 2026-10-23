package com.exam.secureexam.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

public class CandidateExamDtos {

    public static class CandidateVerifyRequest {
        private String registrationNumber;
        private Long departmentId;

        public CandidateVerifyRequest() {}

        public String getRegistrationNumber() { return registrationNumber; }
        public void setRegistrationNumber(String registrationNumber) { this.registrationNumber = registrationNumber; }

        public Long getDepartmentId() { return departmentId; }
        public void setDepartmentId(Long departmentId) { this.departmentId = departmentId; }
    }

    public static class CandidateVerifyResponse {
        private boolean eligible;
        private String message;
        private Long candidateId;
        private String registrationNumber;
        private String fullName;
        private Long examId;
        private String examTitle;
        private Integer durationMinutes;
        private Integer totalQuestions;
        private String timingMode;
        private OffsetDateTime scheduledStartTime;
        private OffsetDateTime scheduledEndTime;
        private String setCode; // 'A', 'B', 'C', 'D'
        private String departmentName;
        private String slotName;

        public CandidateVerifyResponse() {}

        public Long getAssignedExamId() { return examId; }
        public String getQuestionSetCode() { return setCode; }

        public String getDepartmentName() { return departmentName; }
        public void setDepartmentName(String departmentName) { this.departmentName = departmentName; }

        public String getSlotName() { return slotName; }
        public void setSlotName(String slotName) { this.slotName = slotName; }

        public boolean isEligible() { return eligible; }
        public void setEligible(boolean eligible) { this.eligible = eligible; }

        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }

        public Long getCandidateId() { return candidateId; }
        public void setCandidateId(Long candidateId) { this.candidateId = candidateId; }

        public String getRegistrationNumber() { return registrationNumber; }
        public void setRegistrationNumber(String registrationNumber) { this.registrationNumber = registrationNumber; }

        public String getFullName() { return fullName; }
        public void setFullName(String fullName) { this.fullName = fullName; }

        public Long getExamId() { return examId; }
        public void setExamId(Long examId) { this.examId = examId; }

        public String getExamTitle() { return examTitle; }
        public void setExamTitle(String examTitle) { this.examTitle = examTitle; }

        public Integer getDurationMinutes() { return durationMinutes; }
        public void setDurationMinutes(Integer durationMinutes) { this.durationMinutes = durationMinutes; }

        public Integer getTotalQuestions() { return totalQuestions; }
        public void setTotalQuestions(Integer totalQuestions) { this.totalQuestions = totalQuestions; }

        public String getTimingMode() { return timingMode; }
        public void setTimingMode(String timingMode) { this.timingMode = timingMode; }

        public OffsetDateTime getScheduledStartTime() { return scheduledStartTime; }
        public void setScheduledStartTime(OffsetDateTime scheduledStartTime) { this.scheduledStartTime = scheduledStartTime; }

        public OffsetDateTime getScheduledEndTime() { return scheduledEndTime; }
        public void setScheduledEndTime(OffsetDateTime scheduledEndTime) { this.scheduledEndTime = scheduledEndTime; }

        public String getSetCode() { return setCode; }
        public void setSetCode(String setCode) { this.setCode = setCode; }
    }

    public static class CandidateStartAttemptResponse {
        private Long attemptId;
        private Long examId;
        private String examTitle;
        private String setCode;
        private OffsetDateTime startedAt;
        private OffsetDateTime deadlineAt;
        private Integer totalDurationSeconds;
        private List<CandidateQuestionDto> questions;

        public CandidateStartAttemptResponse() {}

        public Long getAttemptId() { return attemptId; }
        public void setAttemptId(Long attemptId) { this.attemptId = attemptId; }

        public Long getExamId() { return examId; }
        public void setExamId(Long examId) { this.examId = examId; }

        public String getExamTitle() { return examTitle; }
        public void setExamTitle(String examTitle) { this.examTitle = examTitle; }

        public String getSetCode() { return setCode; }
        public void setSetCode(String setCode) { this.setCode = setCode; }

        public OffsetDateTime getStartedAt() { return startedAt; }
        public void setStartedAt(OffsetDateTime startedAt) { this.startedAt = startedAt; }

        public OffsetDateTime getDeadlineAt() { return deadlineAt; }
        public void setDeadlineAt(OffsetDateTime deadlineAt) { this.deadlineAt = deadlineAt; }

        public Integer getTotalDurationSeconds() { return totalDurationSeconds; }
        public void setTotalDurationSeconds(Integer totalDurationSeconds) { this.totalDurationSeconds = totalDurationSeconds; }

        public List<CandidateQuestionDto> getQuestions() { return questions; }
        public void setQuestions(List<CandidateQuestionDto> questions) { this.questions = questions; }
    }

    public static class AnswerSaveRequest {
        private Long questionId;
        private Long selectedOptionId;

        public AnswerSaveRequest() {}

        public Long getQuestionId() { return questionId; }
        public void setQuestionId(Long questionId) { this.questionId = questionId; }

        public Long getSelectedOptionId() { return selectedOptionId; }
        public void setSelectedOptionId(Long selectedOptionId) { this.selectedOptionId = selectedOptionId; }
    }

    public static class SubmissionResponse {
        private boolean success;
        private String message;
        private String receiptId;
        private OffsetDateTime submittedAt;
        private Long attemptId;
        private BigDecimal score; // only populated if results published
        private String qualificationStatus; // only populated if results published

        public SubmissionResponse() {}

        public boolean isSuccess() { return success; }
        public void setSuccess(boolean success) { this.success = success; }

        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }

        public String getReceiptId() { return receiptId; }
        public void setReceiptId(String receiptId) { this.receiptId = receiptId; }

        public OffsetDateTime getSubmittedAt() { return submittedAt; }
        public void setSubmittedAt(OffsetDateTime submittedAt) { this.submittedAt = submittedAt; }

        public Long getAttemptId() { return attemptId; }
        public void setAttemptId(Long attemptId) { this.attemptId = attemptId; }

        public BigDecimal getScore() { return score; }
        public void setScore(BigDecimal score) { this.score = score; }

        public String getQualificationStatus() { return qualificationStatus; }
        public void setQualificationStatus(String qualificationStatus) { this.qualificationStatus = qualificationStatus; }
    }

    public static class ExamResultDto {
        private Long attemptId;
        private Long candidateId;
        private String candidateName;
        private String registrationNumber;
        private String departmentName;
        private Long examId;
        private String examTitle;
        private String setCode;
        private Integer slotNumber;
        private String attemptStatus;
        private long answeredCount;
        private long unansweredCount;
        private BigDecimal score;
        private BigDecimal totalMarks;
        private BigDecimal percentage;
        private BigDecimal qualificationThreshold;
        private String qualificationStatus; // QUALIFIED, NOT_QUALIFIED, PENDING
        private boolean resultsPublished;
        private OffsetDateTime submittedAt;

        public ExamResultDto() {}

        public Long getAttemptId() { return attemptId; }
        public void setAttemptId(Long attemptId) { this.attemptId = attemptId; }

        public Long getCandidateId() { return candidateId; }
        public void setCandidateId(Long candidateId) { this.candidateId = candidateId; }

        public String getCandidateName() { return candidateName; }
        public void setCandidateName(String candidateName) { this.candidateName = candidateName; }

        public String getRegistrationNumber() { return registrationNumber; }
        public void setRegistrationNumber(String registrationNumber) { this.registrationNumber = registrationNumber; }

        public String getDepartmentName() { return departmentName; }
        public void setDepartmentName(String departmentName) { this.departmentName = departmentName; }

        public Long getExamId() { return examId; }
        public void setExamId(Long examId) { this.examId = examId; }

        public String getExamTitle() { return examTitle; }
        public void setExamTitle(String examTitle) { this.examTitle = examTitle; }

        public String getSetCode() { return setCode; }
        public void setSetCode(String setCode) { this.setCode = setCode; }

        public Integer getSlotNumber() { return slotNumber; }
        public void setSlotNumber(Integer slotNumber) { this.slotNumber = slotNumber; }

        public String getAttemptStatus() { return attemptStatus; }
        public void setAttemptStatus(String attemptStatus) { this.attemptStatus = attemptStatus; }

        public long getAnsweredCount() { return answeredCount; }
        public void setAnsweredCount(long answeredCount) { this.answeredCount = answeredCount; }

        public long getUnansweredCount() { return unansweredCount; }
        public void setUnansweredCount(long unansweredCount) { this.unansweredCount = unansweredCount; }

        public BigDecimal getScore() { return score; }
        public void setScore(BigDecimal score) { this.score = score; }

        public BigDecimal getTotalMarks() { return totalMarks; }
        public void setTotalMarks(BigDecimal totalMarks) { this.totalMarks = totalMarks; }

        public BigDecimal getPercentage() { return percentage; }
        public void setPercentage(BigDecimal percentage) { this.percentage = percentage; }

        public BigDecimal getQualificationThreshold() { return qualificationThreshold; }
        public void setQualificationThreshold(BigDecimal qualificationThreshold) { this.qualificationThreshold = qualificationThreshold; }

        public String getQualificationStatus() { return qualificationStatus; }
        public void setQualificationStatus(String qualificationStatus) { this.qualificationStatus = qualificationStatus; }

        public boolean isResultsPublished() { return resultsPublished; }
        public void setResultsPublished(boolean resultsPublished) { this.resultsPublished = resultsPublished; }

        public OffsetDateTime getSubmittedAt() { return submittedAt; }
        public void setSubmittedAt(OffsetDateTime submittedAt) { this.submittedAt = submittedAt; }
    }

    public static class DashboardStatsDto {
        private String application;
        private String status;
        private long totalExams;
        private long activeExams;
        private long totalCandidates;
        private long totalDepartments;
        private long totalAttempts;
        private long submittedAttempts;
        private long qualifiedCandidates;
        private String message;

        public DashboardStatsDto() {}

        public String getApplication() { return application; }
        public void setApplication(String application) { this.application = application; }

        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }

        public long getTotalExams() { return totalExams; }
        public void setTotalExams(long totalExams) { this.totalExams = totalExams; }

        public long getActiveExams() { return activeExams; }
        public void setActiveExams(long activeExams) { this.activeExams = activeExams; }

        public long getTotalCandidates() { return totalCandidates; }
        public void setTotalCandidates(long totalCandidates) { this.totalCandidates = totalCandidates; }

        public long getTotalDepartments() { return totalDepartments; }
        public void setTotalDepartments(long totalDepartments) { this.totalDepartments = totalDepartments; }

        public long getTotalAttempts() { return totalAttempts; }
        public void setTotalAttempts(long totalAttempts) { this.totalAttempts = totalAttempts; }

        public long getSubmittedAttempts() { return submittedAttempts; }
        public void setSubmittedAttempts(long submittedAttempts) { this.submittedAttempts = submittedAttempts; }

        public long getQualifiedCandidates() { return qualifiedCandidates; }
        public void setQualifiedCandidates(long qualifiedCandidates) { this.qualifiedCandidates = qualifiedCandidates; }

        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
    }
}
