package com.exam.secureexam.dto;

import com.exam.secureexam.model.QuestionOption;

public class QuestionOptionDto {
    private Long id;
    private String optionText;
    private boolean correct;
    private Integer displayOrder;
    private String label; // "A", "B", "C", "D"

    public QuestionOptionDto() {}

    public static QuestionOptionDto fromEntity(QuestionOption o, String label) {
        QuestionOptionDto dto = new QuestionOptionDto();
        dto.setId(o.getId());
        dto.setOptionText(o.getOptionText());
        dto.setCorrect(o.isCorrect());
        dto.setDisplayOrder(o.getDisplayOrder());
        dto.setLabel(label);
        return dto;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getOptionText() { return optionText; }
    public void setOptionText(String optionText) { this.optionText = optionText; }

    public boolean isCorrect() { return correct; }
    public void setCorrect(boolean correct) { this.correct = correct; }

    public Integer getDisplayOrder() { return displayOrder; }
    public void setDisplayOrder(Integer displayOrder) { this.displayOrder = displayOrder; }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
}
