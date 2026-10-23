package com.exam.secureexam.dto.pdf;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

public class CreateExamFromParsedDto {
    private String title;
    private String description;
    private Integer durationMinutes = 60;
    private Integer totalQuestions = 50;
    private String qualificationMode = "PERCENTAGE"; // PERCENTAGE or ABSOLUTE
    private BigDecimal qualificationThreshold = new BigDecimal("60.00");
    private String timingMode = "DURATION_FROM_START";
    private BigDecimal totalMarks = new BigDecimal("100.00");
    private BigDecimal marksPerQuestion = new BigDecimal("1.00");
    private BigDecimal negativeMarks = BigDecimal.ZERO;
    private OffsetDateTime scheduledStartTime;
    private OffsetDateTime scheduledEndTime;
    private List<Long> departmentIds = new ArrayList<>();
    private List<String> targetSets = List.of("A", "B", "C", "D");
    private boolean publishImmediately = false;

    // Structured parsed questions (after admin review and edits)
    private List<ParsedQuestionDto> questions = new ArrayList<>();

    public CreateExamFromParsedDto() {}

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Integer getDurationMinutes() { return durationMinutes; }
    public void setDurationMinutes(Integer durationMinutes) { this.durationMinutes = durationMinutes; }

    public Integer getTotalQuestions() { return totalQuestions; }
    public void setTotalQuestions(Integer totalQuestions) { this.totalQuestions = totalQuestions; }

    public String getQualificationMode() { return qualificationMode; }
    public void setQualificationMode(String qualificationMode) { this.qualificationMode = qualificationMode; }

    public BigDecimal getQualificationThreshold() { return qualificationThreshold; }
    public void setQualificationThreshold(BigDecimal qualificationThreshold) { this.qualificationThreshold = qualificationThreshold; }

    public String getTimingMode() { return timingMode; }
    public void setTimingMode(String timingMode) { this.timingMode = timingMode; }

    public BigDecimal getTotalMarks() { return totalMarks; }
    public void setTotalMarks(BigDecimal totalMarks) { this.totalMarks = totalMarks; }

    public BigDecimal getMarksPerQuestion() { return marksPerQuestion; }
    public void setMarksPerQuestion(BigDecimal marksPerQuestion) { this.marksPerQuestion = marksPerQuestion; }

    public BigDecimal getNegativeMarks() { return negativeMarks; }
    public void setNegativeMarks(BigDecimal negativeMarks) { this.negativeMarks = negativeMarks; }

    public OffsetDateTime getScheduledStartTime() { return scheduledStartTime; }
    public void setScheduledStartTime(OffsetDateTime scheduledStartTime) { this.scheduledStartTime = scheduledStartTime; }

    public OffsetDateTime getScheduledEndTime() { return scheduledEndTime; }
    public void setScheduledEndTime(OffsetDateTime scheduledEndTime) { this.scheduledEndTime = scheduledEndTime; }

    public List<Long> getDepartmentIds() { return departmentIds; }
    public void setDepartmentIds(List<Long> departmentIds) { this.departmentIds = departmentIds; }

    public List<String> getTargetSets() { return targetSets; }
    public void setTargetSets(List<String> targetSets) { this.targetSets = targetSets; }

    public boolean isPublishImmediately() { return publishImmediately; }
    public void setPublishImmediately(boolean publishImmediately) { this.publishImmediately = publishImmediately; }

    public List<ParsedQuestionDto> getQuestions() { return questions; }
    public void setQuestions(List<ParsedQuestionDto> questions) { this.questions = questions; }
}
