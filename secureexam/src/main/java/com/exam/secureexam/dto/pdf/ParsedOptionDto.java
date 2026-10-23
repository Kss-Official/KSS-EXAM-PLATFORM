package com.exam.secureexam.dto.pdf;

public class ParsedOptionDto {
    private String label; // "A", "B", "C", "D"
    private String optionText;
    private boolean correct;

    public ParsedOptionDto() {}

    public ParsedOptionDto(String label, String optionText, boolean correct) {
        this.label = label;
        this.optionText = optionText;
        this.correct = correct;
    }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }

    public String getOptionText() { return optionText; }
    public void setOptionText(String optionText) { this.optionText = optionText; }

    public boolean isCorrect() { return correct; }
    public void setCorrect(boolean correct) { this.correct = correct; }
}
