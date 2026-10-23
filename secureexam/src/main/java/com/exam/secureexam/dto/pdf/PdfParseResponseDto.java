package com.exam.secureexam.dto.pdf;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class PdfParseResponseDto {
    private boolean success;
    private double confidenceScore;
    private int totalQuestions;
    private int mappedAnswersCount;
    private boolean requiresOcr;
    private String ocrReason;
    private List<String> warnings = new ArrayList<>();
    private List<String> errors = new ArrayList<>();
    private Map<Integer, String> extractedAnswerKey = new HashMap<>();
    private List<ParsedQuestionDto> questions = new ArrayList<>();

    private String questionPaperFileName;
    private long questionPaperSizeBytes;
    private String answerSheetFileName;
    private long answerSheetSizeBytes;

    public PdfParseResponseDto() {}

    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }

    public double getConfidenceScore() { return confidenceScore; }
    public void setConfidenceScore(double confidenceScore) { this.confidenceScore = confidenceScore; }

    public int getTotalQuestions() { return totalQuestions; }
    public void setTotalQuestions(int totalQuestions) { this.totalQuestions = totalQuestions; }

    public int getMappedAnswersCount() { return mappedAnswersCount; }
    public void setMappedAnswersCount(int mappedAnswersCount) { this.mappedAnswersCount = mappedAnswersCount; }

    public boolean isRequiresOcr() { return requiresOcr; }
    public void setRequiresOcr(boolean requiresOcr) { this.requiresOcr = requiresOcr; }

    public String getOcrReason() { return ocrReason; }
    public void setOcrReason(String ocrReason) { this.ocrReason = ocrReason; }

    public List<String> getWarnings() { return warnings; }
    public void setWarnings(List<String> warnings) { this.warnings = warnings; }

    public List<String> getErrors() { return errors; }
    public void setErrors(List<String> errors) { this.errors = errors; }

    public Map<Integer, String> getExtractedAnswerKey() { return extractedAnswerKey; }
    public void setExtractedAnswerKey(Map<Integer, String> extractedAnswerKey) { this.extractedAnswerKey = extractedAnswerKey; }

    public List<ParsedQuestionDto> getQuestions() { return questions; }
    public void setQuestions(List<ParsedQuestionDto> questions) { this.questions = questions; }

    public String getQuestionPaperFileName() { return questionPaperFileName; }
    public void setQuestionPaperFileName(String questionPaperFileName) { this.questionPaperFileName = questionPaperFileName; }

    public long getQuestionPaperSizeBytes() { return questionPaperSizeBytes; }
    public void setQuestionPaperSizeBytes(long questionPaperSizeBytes) { this.questionPaperSizeBytes = questionPaperSizeBytes; }

    public String getAnswerSheetFileName() { return answerSheetFileName; }
    public void setAnswerSheetFileName(String answerSheetFileName) { this.answerSheetFileName = answerSheetFileName; }

    public long getAnswerSheetSizeBytes() { return answerSheetSizeBytes; }
    public void setAnswerSheetSizeBytes(long answerSheetSizeBytes) { this.answerSheetSizeBytes = answerSheetSizeBytes; }
}
