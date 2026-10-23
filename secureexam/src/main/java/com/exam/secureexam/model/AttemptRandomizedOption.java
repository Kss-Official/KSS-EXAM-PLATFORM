package com.exam.secureexam.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;

@Entity
@Table(name = "attempt_randomized_options", uniqueConstraints = {
    @UniqueConstraint(name = "uq_attempt_option", columnNames = {"attempt_id", "option_id"}),
    @UniqueConstraint(name = "uq_attempt_option_order", columnNames = {"attempt_id", "question_id", "display_order"})
})
public class AttemptRandomizedOption {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "attempt_id", nullable = false)
    @JsonIgnore
    private ExamAttempt attempt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_id", nullable = false)
    @JsonIgnore
    private Question question;

    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "option_id", nullable = false)
    private QuestionOption option;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;

    @Column(name = "display_label", nullable = false, length = 5)
    private String displayLabel; // "A", "B", "C", "D"

    public AttemptRandomizedOption() {}

    public AttemptRandomizedOption(ExamAttempt attempt, Question question, QuestionOption option, Integer displayOrder, String displayLabel) {
        this.attempt = attempt;
        this.question = question;
        this.option = option;
        this.displayOrder = displayOrder;
        this.displayLabel = displayLabel;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public ExamAttempt getAttempt() { return attempt; }
    public void setAttempt(ExamAttempt attempt) { this.attempt = attempt; }

    public Question getQuestion() { return question; }
    public void setQuestion(Question question) { this.question = question; }

    public QuestionOption getOption() { return option; }
    public void setOption(QuestionOption option) { this.option = option; }

    public Integer getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(Integer displayOrder) { this.displayOrder = displayOrder; }

    public String getDisplayLabel() { return displayLabel; }
    public void setDisplayLabel(String displayLabel) { this.displayLabel = displayLabel; }
}
