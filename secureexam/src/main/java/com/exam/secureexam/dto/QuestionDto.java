package com.exam.secureexam.dto;

import com.exam.secureexam.model.Question;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public class QuestionDto {
    private Long id;
    private Long questionSetId;
    private String questionText;
    private BigDecimal marks;
    private BigDecimal negativeMarks;
    private Integer displayOrder;
    private List<QuestionOptionDto> options = new ArrayList<>();
    private Long correctOptionId;

    public QuestionDto() {}

    public static QuestionDto fromEntity(Question q) {
        QuestionDto dto = new QuestionDto();
        dto.setId(q.getId());
        dto.setQuestionSetId(q.getQuestionSet() != null ? q.getQuestionSet().getId() : null);
        dto.setQuestionText(q.getQuestionText());
        dto.setMarks(q.getMarks());
        dto.setNegativeMarks(q.getNegativeMarks());
        dto.setDisplayOrder(q.getDisplayOrder());

        String[] labels = {"A", "B", "C", "D"};
        if (q.getOptions() != null) {
            for (int i = 0; i < q.getOptions().size(); i++) {
                var opt = q.getOptions().get(i);
                String lbl = i < labels.length ? labels[i] : String.valueOf((char)('A' + i));
                dto.getOptions().add(QuestionOptionDto.fromEntity(opt, lbl));
                if (opt.isCorrect()) {
                    dto.setCorrectOptionId(opt.getId());
                }
            }
        }
        return dto;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getQuestionSetId() { return questionSetId; }
    public void setQuestionSetId(Long questionSetId) { this.questionSetId = questionSetId; }

    public String getQuestionText() { return questionText; }
    public void setQuestionText(String questionText) { this.questionText = questionText; }

    public BigDecimal getMarks() { return marks; }
    public void setMarks(BigDecimal marks) { this.marks = marks; }

    public BigDecimal getNegativeMarks() { return negativeMarks; }
    public void setNegativeMarks(BigDecimal negativeMarks) { this.negativeMarks = negativeMarks; }

    public Integer getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(Integer displayOrder) { this.displayOrder = displayOrder; }

    public List<QuestionOptionDto> getOptions() { return options; }
    public void setOptions(List<QuestionOptionDto> options) { this.options = options; }

    public Long getCorrectOptionId() { return correctOptionId; }
    public void setCorrectOptionId(Long correctOptionId) { this.correctOptionId = correctOptionId; }
}
