package com.exam.secureexam.dto.pdf;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public class ParsedQuestionDto {
    private Integer displayOrder; // e.g. 1, 2, 3...
    private String questionText;
    private List<ParsedOptionDto> options = new ArrayList<>();
    private String correctOption; // "A", "B", "C", "D" or null
    private BigDecimal marks = BigDecimal.ONE;
    private BigDecimal negativeMarks = BigDecimal.ZERO;
    private boolean hasIssue = false;
    private String issueDescription;

    public ParsedQuestionDto() {}

    public ParsedQuestionDto(Integer displayOrder, String questionText) {
        this.displayOrder = displayOrder;
        this.questionText = questionText;
    }

    public Integer getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(Integer displayOrder) { this.displayOrder = displayOrder; }

    public String getQuestionText() { return questionText; }
    public void setQuestionText(String questionText) { this.questionText = questionText; }

    public List<ParsedOptionDto> getOptions() { return options; }
    public void setOptions(List<ParsedOptionDto> options) { this.options = options; }

    public String getCorrectOption() { return correctOption; }
    public void setCorrectOption(String correctOption) { this.correctOption = correctOption; }

    public BigDecimal getMarks() { return marks; }
    public void setMarks(BigDecimal marks) { this.marks = marks; }

    public BigDecimal getNegativeMarks() { return negativeMarks; }
    public void setNegativeMarks(BigDecimal negativeMarks) { this.negativeMarks = negativeMarks; }

    public boolean isHasIssue() { return hasIssue; }
    public void setHasIssue(boolean hasIssue) { this.hasIssue = hasIssue; }

    public String getIssueDescription() { return issueDescription; }
    public void setIssueDescription(String issueDescription) { this.issueDescription = issueDescription; }
}
