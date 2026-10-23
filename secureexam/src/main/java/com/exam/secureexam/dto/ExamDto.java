package com.exam.secureexam.dto;

import com.exam.secureexam.model.Department;
import com.exam.secureexam.model.Exam;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

public class ExamDto {
    private Long id;
    private String title;
    private String description;
    private Integer durationMinutes;
    private Integer totalQuestions;
    private String status;
    private String qualificationMode;
    private BigDecimal qualificationThreshold;
    private String timingMode;
    private BigDecimal totalMarks;
    private BigDecimal marksPerQuestion;
    private BigDecimal negativeMarks;
    private OffsetDateTime scheduledStartTime;
    private OffsetDateTime scheduledEndTime;
    private boolean resultsPublished;
    private OffsetDateTime createdAt;
    private List<Long> departmentIds;
    private List<String> departmentNames;

    public ExamDto() {}

    public static ExamDto fromEntity(Exam e) {
        ExamDto dto = new ExamDto();
        dto.setId(e.getId());
        dto.setTitle(e.getTitle());
        dto.setDescription(e.getDescription());
        dto.setDurationMinutes(e.getDurationMinutes());
        dto.setTotalQuestions(e.getTotalQuestions());
        dto.setStatus(e.getStatus());
        dto.setQualificationMode(e.getQualificationMode());
        dto.setQualificationThreshold(e.getQualificationThreshold());
        dto.setTimingMode(e.getTimingMode());
        dto.setTotalMarks(e.getTotalMarks());
        dto.setMarksPerQuestion(e.getMarksPerQuestion());
        dto.setNegativeMarks(e.getNegativeMarks());
        dto.setScheduledStartTime(e.getScheduledStartTime());
        dto.setScheduledEndTime(e.getScheduledEndTime());
        dto.setResultsPublished(e.isResultsPublished());
        dto.setCreatedAt(e.getCreatedAt());
        if (e.getDepartments() != null) {
            try {
                dto.setDepartmentIds(e.getDepartments().stream().map(Department::getId).collect(Collectors.toList()));
                dto.setDepartmentNames(e.getDepartments().stream().map(Department::getName).collect(Collectors.toList()));
            } catch (Exception ex) {
                dto.setDepartmentIds(Collections.emptyList());
                dto.setDepartmentNames(Collections.emptyList());
            }
        }
        return dto;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public Integer getDurationMinutes() { return durationMinutes; }
    public void setDurationMinutes(Integer durationMinutes) { this.durationMinutes = durationMinutes; }

    public Integer getTotalQuestions() { return totalQuestions; }
    public void setTotalQuestions(Integer totalQuestions) { this.totalQuestions = totalQuestions; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

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

    public boolean isResultsPublished() { return resultsPublished; }
    public void setResultsPublished(boolean resultsPublished) { this.resultsPublished = resultsPublished; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public List<Long> getDepartmentIds() { return departmentIds; }
    public void setDepartmentIds(List<Long> departmentIds) { this.departmentIds = departmentIds; }

    public List<String> getDepartmentNames() { return departmentNames; }
    public void setDepartmentNames(List<String> departmentNames) { this.departmentNames = departmentNames; }
}
