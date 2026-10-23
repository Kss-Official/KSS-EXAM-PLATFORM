package com.exam.secureexam.dto.pdf;

public class PdfParsingRulesDto {
    private String questionPattern; // custom regex if provided
    private String optionPattern;   // custom regex if provided
    private String answerKeyPattern;// custom regex if provided
    private Double marksPerQuestion = 1.0;
    private Double negativeMarks = 0.0;
    private Integer expectedQuestionCount;

    public PdfParsingRulesDto() {}

    public String getQuestionPattern() { return questionPattern; }
    public void setQuestionPattern(String questionPattern) { this.questionPattern = questionPattern; }

    public String getOptionPattern() { return optionPattern; }
    public void setOptionPattern(String optionPattern) { this.optionPattern = optionPattern; }

    public String getAnswerKeyPattern() { return answerKeyPattern; }
    public void setAnswerKeyPattern(String answerKeyPattern) { this.answerKeyPattern = answerKeyPattern; }

    public Double getMarksPerQuestion() { return marksPerQuestion; }
    public void setMarksPerQuestion(Double marksPerQuestion) { this.marksPerQuestion = marksPerQuestion; }

    public Double getNegativeMarks() { return negativeMarks; }
    public void setNegativeMarks(Double negativeMarks) { this.negativeMarks = negativeMarks; }

    public Integer getExpectedQuestionCount() { return expectedQuestionCount; }
    public void setExpectedQuestionCount(Integer expectedQuestionCount) { this.expectedQuestionCount = expectedQuestionCount; }
}
