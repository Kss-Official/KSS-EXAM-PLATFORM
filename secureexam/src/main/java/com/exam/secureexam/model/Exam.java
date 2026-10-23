package com.exam.secureexam.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Entity
@Table(name = "exams")
public class Exam {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "duration_minutes", nullable = false)
    private Integer durationMinutes = 60;

    @Column(name = "total_questions", nullable = false)
    private Integer totalQuestions = 50;

    @Column(nullable = false, length = 20)
    private String status = "DRAFT"; // DRAFT, PUBLISHED, COMPLETED, CANCELLED

    @Column(name = "qualification_mode", length = 20)
    private String qualificationMode = "PERCENTAGE"; // PERCENTAGE or ABSOLUTE

    @Column(name = "qualification_threshold", precision = 6, scale = 2)
    private BigDecimal qualificationThreshold = new BigDecimal("60.00");

    @Column(name = "timing_mode", length = 30)
    private String timingMode = "DURATION_FROM_START"; // DURATION_FROM_START or SCHEDULED

    @Column(name = "total_marks", precision = 8, scale = 2)
    private BigDecimal totalMarks = new BigDecimal("100.00");

    @Column(name = "marks_per_question", precision = 6, scale = 2)
    private BigDecimal marksPerQuestion = new BigDecimal("1.00");

    @Column(name = "negative_marks", precision = 6, scale = 2)
    private BigDecimal negativeMarks = BigDecimal.ZERO;

    @Column(name = "scheduled_start_time")
    private OffsetDateTime scheduledStartTime;

    @Column(name = "scheduled_end_time")
    private OffsetDateTime scheduledEndTime;

    @Column(name = "results_published", nullable = false)
    private boolean resultsPublished = false;

    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt = OffsetDateTime.now();

    @ManyToMany(fetch = FetchType.EAGER)
    @JoinTable(
        name = "exam_departments",
        joinColumns = @JoinColumn(name = "exam_id"),
        inverseJoinColumns = @JoinColumn(name = "department_id")
    )
    private Set<Department> departments = new HashSet<>();

    @OneToMany(mappedBy = "exam", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<QuestionSet> questionSets = new ArrayList<>();

    @OneToMany(mappedBy = "exam", cascade = CascadeType.ALL, orphanRemoval = true)
    @JsonIgnore
    private List<ExamSlot> slots = new ArrayList<>();

    public Exam() {}

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

    public Set<Department> getDepartments() { return departments; }
    public void setDepartments(Set<Department> departments) { this.departments = departments; }

    public List<QuestionSet> getQuestionSets() { return questionSets; }
    public void setQuestionSets(List<QuestionSet> questionSets) { this.questionSets = questionSets; }

    public List<ExamSlot> getSlots() { return slots; }
    public void setSlots(List<ExamSlot> slots) { this.slots = slots; }
}
