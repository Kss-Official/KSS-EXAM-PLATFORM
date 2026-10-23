package com.exam.secureexam.dto;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

/**
 * Candidate-Facing Question representation.
 * Strictly excludes answer keys, correct answers, and scoring formulas.
 */
public class CandidateQuestionDto {
    private Long questionId;
    private Integer displayIndex; // 1, 2, ...
    private String questionText;
    private BigDecimal marks;
    private List<CandidateOptionDto> options = new ArrayList<>();
    private Long selectedOptionId; // Previously answered option ID if resumed

    public CandidateQuestionDto() {}

    public Long getQuestionId() { return questionId; }
    public void setQuestionId(Long questionId) { this.questionId = questionId; }

    public Integer getDisplayIndex() { return displayIndex; }
    public void setDisplayIndex(Integer displayIndex) { this.displayIndex = displayIndex; }

    public String getQuestionText() { return questionText; }
    public void setQuestionText(String questionText) { this.questionText = questionText; }

    public BigDecimal getMarks() { return marks; }
    public void setMarks(BigDecimal marks) { this.marks = marks; }

    public List<CandidateOptionDto> getOptions() { return options; }
    public void setOptions(List<CandidateOptionDto> options) { this.options = options; }

    public Long getSelectedOptionId() { return selectedOptionId; }
    public void setSelectedOptionId(Long selectedOptionId) { this.selectedOptionId = selectedOptionId; }

    public static class CandidateOptionDto {
        private Long optionId;
        private String label; // "A", "B", "C", "D"
        private String optionText;

        public CandidateOptionDto() {}

        public CandidateOptionDto(Long optionId, String label, String optionText) {
            this.optionId = optionId;
            this.label = label;
            this.optionText = optionText;
        }

        public Long getOptionId() { return optionId; }
        public void setOptionId(Long optionId) { this.optionId = optionId; }

        public String getLabel() { return label; }
        public void setLabel(String label) { this.label = label; }

        public String getOptionText() { return optionText; }
        public void setOptionText(String optionText) { this.optionText = optionText; }
    }
}
