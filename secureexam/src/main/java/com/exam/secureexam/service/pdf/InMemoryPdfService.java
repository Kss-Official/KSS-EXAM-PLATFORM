package com.exam.secureexam.service.pdf;

import com.exam.secureexam.dto.pdf.*;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Service for In-Memory PDF processing of Question Papers and Answer Sheets.
 * Strictly guarantees that no uploaded PDF bytes are persisted to local disk,
 * database, cloud storage, or external services.
 */
@Service
public class InMemoryPdfService {

    private static final Logger logger = LoggerFactory.getLogger(InMemoryPdfService.class);

    private static final long MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
    private static final byte[] PDF_MAGIC_BYTES = new byte[]{0x25, 0x50, 0x44, 0x46, 0x2D}; // "%PDF-"

    /**
     * Validates and extracts text from Question Paper PDF and optional Answer Sheet PDF strictly in-memory.
     */
    public PdfParseResponseDto parsePdfInMem(
            MultipartFile questionPaperFile,
            MultipartFile answerSheetFile,
            PdfParsingRulesDto rules
    ) {
        PdfParseResponseDto response = new PdfParseResponseDto();
        List<String> errors = new ArrayList<>();
        List<String> warnings = new ArrayList<>();

        // 1. Validate Question Paper
        validatePdf(questionPaperFile, "Question Paper", errors);
        if (!errors.isEmpty()) {
            response.setSuccess(false);
            response.setErrors(errors);
            return response;
        }

        response.setQuestionPaperFileName(questionPaperFile.getOriginalFilename());
        response.setQuestionPaperSizeBytes(questionPaperFile.getSize());

        // 2. Extract Question Paper Text strictly in-memory
        String qpText;
        try {
            qpText = extractTextFromBytes(questionPaperFile.getBytes(), questionPaperFile.getOriginalFilename());
        } catch (PdfSecurityException | IllegalArgumentException e) {
            errors.add(e.getMessage());
            response.setSuccess(false);
            response.setErrors(errors);
            return response;
        } catch (IOException e) {
            logger.error("Failed to read question paper stream in-memory", e);
            errors.add("Failed to read question paper: " + e.getMessage());
            response.setSuccess(false);
            response.setErrors(errors);
            return response;
        }

        // Check for Scanned / Non-extractable Question Paper
        if (qpText == null || qpText.trim().length() < 50 || qpText.replaceAll("\\s+", "").length() < 30) {
            response.setSuccess(false);
            response.setRequiresOcr(true);
            response.setOcrReason("The uploaded Question Paper appears to be a scanned image or raster PDF with insufficient extractable text (fewer than 50 characters). Optical Character Recognition (OCR) is required.");
            errors.add(response.getOcrReason());
            response.setErrors(errors);
            return response;
        }

        // 3. Optional Answer Sheet processing
        Map<Integer, String> answerKeyMap = new HashMap<>();
        if (answerSheetFile != null && !answerSheetFile.isEmpty()) {
            validatePdf(answerSheetFile, "Answer Sheet", errors);
            if (!errors.isEmpty()) {
                response.setSuccess(false);
                response.setErrors(errors);
                return response;
            }

            response.setAnswerSheetFileName(answerSheetFile.getOriginalFilename());
            response.setAnswerSheetSizeBytes(answerSheetFile.getSize());

            try {
                String asText = extractTextFromBytes(answerSheetFile.getBytes(), answerSheetFile.getOriginalFilename());
                if (asText == null || asText.trim().length() < 10) {
                    warnings.add("Answer Sheet has minimal text; could be a scanned document. Please verify answer key manually.");
                } else {
                    answerKeyMap = parseAnswerSheetText(asText, rules);
                }
            } catch (Exception e) {
                warnings.add("Could not parse answer sheet: " + e.getMessage() + ". You may specify answers manually in review.");
            }
        }

        // 4. Parse Question Paper Text into Structured Questions
        List<ParsedQuestionDto> questions = parseQuestionsFromText(qpText, rules);
        if (questions.isEmpty()) {
            response.setSuccess(false);
            errors.add("No multiple-choice questions matching standard numbering patterns (e.g., '1.', 'Q1.', 'Question 1:') could be extracted. Please check document formatting.");
            response.setErrors(errors);
            return response;
        }

        // 5. Reconcile with Answer Key, Detect Duplicates, Missing Options & Gaps
        reconcileAndValidate(questions, answerKeyMap, warnings, errors);

        // 6. Calculate Confidence Score
        double confidence = calculateConfidence(questions, answerKeyMap, warnings, errors);
        response.setConfidenceScore(Math.round(confidence * 10.0) / 10.0);
        response.setTotalQuestions(questions.size());
        response.setMappedAnswersCount((int) questions.stream().filter(q -> q.getCorrectOption() != null).count());
        response.setQuestions(questions);
        response.setExtractedAnswerKey(answerKeyMap);
        response.setWarnings(warnings);
        response.setErrors(errors);
        response.setSuccess(errors.isEmpty() && !response.isRequiresOcr());

        return response;
    }

    /**
     * Validates PDF file size, extension, MIME type, and magic bytes signature.
     */
    private void validatePdf(MultipartFile file, String documentName, List<String> errors) {
        if (file == null || file.isEmpty()) {
            errors.add(documentName + " file is empty or missing.");
            return;
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            errors.add(documentName + " size (" + (file.getSize() / (1024 * 1024)) + " MB) exceeds the maximum allowed 25 MB limit.");
            return;
        }

        String originalName = file.getOriginalFilename();
        if (originalName == null || !originalName.toLowerCase().endsWith(".pdf")) {
            errors.add(documentName + " must be a PDF document ending with .pdf extension.");
            return;
        }

        // Check magic bytes "%PDF-"
        try {
            byte[] header = file.getBytes();
            if (header.length < 5) {
                errors.add(documentName + " is too small to be a valid PDF.");
                return;
            }

            boolean signatureMatches = header[0] == PDF_MAGIC_BYTES[0]
                    && header[1] == PDF_MAGIC_BYTES[1]
                    && header[2] == PDF_MAGIC_BYTES[2]
                    && header[3] == PDF_MAGIC_BYTES[3]
                    && header[4] == PDF_MAGIC_BYTES[4];

            if (!signatureMatches) {
                errors.add(documentName + " is invalid or corrupted (Missing '%PDF-' file signature header).");
            }
        } catch (IOException e) {
            errors.add("Unable to inspect " + documentName + " header: " + e.getMessage());
        }
    }

    /**
     * Extracts plain text from raw PDF bytes strictly in-memory using PDFBox.
     */
    private String extractTextFromBytes(byte[] pdfBytes, String filename) {
        try (PDDocument document = Loader.loadPDF(pdfBytes)) {
            if (document.isEncrypted()) {
                throw new PdfSecurityException("The document '" + filename + "' is encrypted or password-protected. Encrypted PDFs are rejected for security and audit compliance.");
            }

            if (document.getNumberOfPages() == 0) {
                throw new IllegalArgumentException("The document '" + filename + "' has 0 pages.");
            }

            PDFTextStripper textStripper = new PDFTextStripper();
            textStripper.setSortByPosition(true);
            return textStripper.getText(document);
        } catch (PdfSecurityException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("Failed to read PDF structure for '" + filename + "': " + e.getMessage(), e);
        }
    }

    /**
     * Parses questions and options from plain text.
     */
    public List<ParsedQuestionDto> parseQuestionsFromText(String text, PdfParsingRulesDto rules) {
        List<ParsedQuestionDto> questions = new ArrayList<>();

        // Normalise line endings
        String normalized = text.replace("\r\n", "\n").replace("\r", "\n");

        // Split text into question blocks based on question numbering
        // Supported: "1. ", "1) ", "Q1. ", "Q.1: ", "Question 1: ", etc.
        String questionSplitRegex = rules != null && rules.getQuestionPattern() != null && !rules.getQuestionPattern().isBlank()
                ? rules.getQuestionPattern()
                : "(?i)(?=(?:^|\\n)\\s*(?:Question\\s*|Q\\.?\\s*)?\\d+[\\.\\)\\:\\-]\\s+)";

        String[] blocks = normalized.split(questionSplitRegex);

        Pattern qNumPattern = Pattern.compile("(?i)^\\s*(?:Question\\s*|Q\\.?\\s*)?(\\d+)[\\.\\)\\:\\-]\\s*(.*)", Pattern.DOTALL);

        // Pattern for options: (A), A), A., [A], etc.
        // Can be on newline OR multiple options on same line (e.g. A) opt1 B) opt2 C) opt3 D) opt4)
        Pattern inlineAnsPattern = Pattern.compile("(?i)(?:Ans(?:wer)?|Correct(?:\\s*Option)?)\\s*[:.\\)\\-]?\\s*[\\(\\[]?([A-Da-d])[\\)\\]]?");

        int fallbackNumber = 1;

        for (String block : blocks) {
            String trimmed = block.trim();
            if (trimmed.isEmpty()) continue;

            Matcher qNumMatcher = qNumPattern.matcher(trimmed);
            if (!qNumMatcher.find()) {
                continue; // Not a question block (e.g. general header instructions)
            }

            int questionNumber;
            try {
                questionNumber = Integer.parseInt(qNumMatcher.group(1));
            } catch (NumberFormatException e) {
                questionNumber = fallbackNumber;
            }

            String contentAfterNumber = qNumMatcher.group(2).trim();

            // Extract inline answer if present
            String inlineAnswer = null;
            Matcher ansMatcher = inlineAnsPattern.matcher(contentAfterNumber);
            if (ansMatcher.find()) {
                inlineAnswer = ansMatcher.group(1).toUpperCase();
                // Remove the answer line from options text
                contentAfterNumber = contentAfterNumber.substring(0, ansMatcher.start()).trim();
            }

            // Extract question text and options
            ParsedQuestionDto question = extractQuestionAndOptions(questionNumber, contentAfterNumber, rules);
            if (inlineAnswer != null) {
                question.setCorrectOption(inlineAnswer);
                for (ParsedOptionDto opt : question.getOptions()) {
                    if (opt.getLabel().equalsIgnoreCase(inlineAnswer)) {
                        opt.setCorrect(true);
                    }
                }
            }

            if (rules != null && rules.getMarksPerQuestion() != null) {
                question.setMarks(BigDecimal.valueOf(rules.getMarksPerQuestion()));
            }
            if (rules != null && rules.getNegativeMarks() != null) {
                question.setNegativeMarks(BigDecimal.valueOf(rules.getNegativeMarks()));
            }

            questions.add(question);
            fallbackNumber = questionNumber + 1;
        }

        return questions;
    }

    /**
     * Extracts question prompt and options A, B, C, D from the content of a single question block.
     */
    private ParsedQuestionDto extractQuestionAndOptions(int qNum, String content, PdfParsingRulesDto rules) {
        ParsedQuestionDto q = new ParsedQuestionDto(qNum, "");

        // Find all option positions: e.g. A), B), C), D) or (A), (B), (C), (D) or A., B., C., D.
        Pattern optPattern = Pattern.compile("(?m)(?:^|[\\s\\t]{2,}|(?<=\\n))[\\(\\[]?([A-Da-d])[\\)\\]\\.\\:]\\s*");
        Matcher optMatcher = optPattern.matcher(content);

        List<Integer> optionStartIndices = new ArrayList<>();
        List<String> optionLabels = new ArrayList<>();

        while (optMatcher.find()) {
            optionStartIndices.add(optMatcher.start());
            optionLabels.add(optMatcher.group(1).toUpperCase());
        }

        if (optionStartIndices.isEmpty()) {
            // No options matched -> question with issue
            q.setQuestionText(content);
            q.setHasIssue(true);
            q.setIssueDescription("Could not detect multiple-choice options (A, B, C, D)");
            return q;
        }

        // Question text is everything before the first option
        String questionText = content.substring(0, optionStartIndices.get(0)).trim();
        q.setQuestionText(questionText);

        List<ParsedOptionDto> options = new ArrayList<>();
        for (int i = 0; i < optionStartIndices.size(); i++) {
            int start = optionStartIndices.get(i);
            int end = (i + 1 < optionStartIndices.size()) ? optionStartIndices.get(i + 1) : content.length();
            String optRaw = content.substring(start, end).trim();

            // Strip the leading label: "A) ", "(A) ", "A. "
            String strippedText = optRaw.replaceFirst("^[\\(\\[]?[A-Da-d][\\)\\]\\.\\:]\\s*", "").trim();
            String label = optionLabels.get(i);

            options.add(new ParsedOptionDto(label, strippedText, false));
        }

        q.setOptions(options);

        if (options.size() < 2) {
            q.setHasIssue(true);
            q.setIssueDescription("Only " + options.size() + " option found. Minimum 2 options required.");
        } else if (options.size() < 4) {
            q.setHasIssue(true);
            q.setIssueDescription("Found " + options.size() + " options. Standard examination expects 4 options (A-D).");
        }

        return q;
    }

    /**
     * Parses Answer Sheet text for question-to-answer mappings: e.g., "1. B", "1:B", "Q1-D".
     */
    public Map<Integer, String> parseAnswerSheetText(String text, PdfParsingRulesDto rules) {
        Map<Integer, String> answerKey = new HashMap<>();

        String regex = rules != null && rules.getAnswerKeyPattern() != null && !rules.getAnswerKeyPattern().isBlank()
                ? rules.getAnswerKeyPattern()
                : "(?i)(?:Question\\s*|Q\\.?\\s*)?(\\d+)\\s*[\\.\\:\\-\\)\\s]\\s*[\\(\\[]?([A-Da-d])[\\)\\]]?";

        Pattern pattern = Pattern.compile(regex);
        Matcher matcher = pattern.matcher(text);

        while (matcher.find()) {
            try {
                int qNum = Integer.parseInt(matcher.group(1));
                String ans = matcher.group(2).toUpperCase();
                answerKey.put(qNum, ans);
            } catch (NumberFormatException ignored) {}
        }

        return answerKey;
    }

    /**
     * Reconciles extracted questions with official answer key map and checks numbering integrity.
     */
    private void reconcileAndValidate(
            List<ParsedQuestionDto> questions,
            Map<Integer, String> answerKeyMap,
            List<String> warnings,
            List<String> errors
    ) {
        Set<Integer> seenNumbers = new HashSet<>();
        int prevNum = 0;

        for (ParsedQuestionDto q : questions) {
            int qNum = q.getDisplayOrder();

            // Check duplicate numbers
            if (seenNumbers.contains(qNum)) {
                q.setHasIssue(true);
                q.setIssueDescription("Duplicate question number #" + qNum + " detected in Question Paper.");
                errors.add("Duplicate question number #" + qNum + " detected.");
            } else {
                seenNumbers.add(qNum);
            }

            // Check missing gap
            if (prevNum > 0 && qNum > prevNum + 1) {
                warnings.add("Possible missing question(s) between #" + prevNum + " and #" + qNum + ".");
            }
            prevNum = qNum;

            // Apply answer from Answer Sheet if present
            if (answerKeyMap.containsKey(qNum)) {
                String correctLabel = answerKeyMap.get(qNum);
                q.setCorrectOption(correctLabel);

                boolean matchedOption = false;
                for (ParsedOptionDto opt : q.getOptions()) {
                    boolean isMatch = opt.getLabel().equalsIgnoreCase(correctLabel);
                    opt.setCorrect(isMatch);
                    if (isMatch) matchedOption = true;
                }

                if (!matchedOption) {
                    q.setHasIssue(true);
                    q.setIssueDescription("Answer key designates option '" + correctLabel + "', but this option was not found among parsed choices.");
                    warnings.add("Question #" + qNum + ": Answer Key specifies '" + correctLabel + "' which was not parsed as an option.");
                }
            } else if (q.getCorrectOption() == null) {
                q.setHasIssue(true);
                q.setIssueDescription("No official answer key designated. Please select the correct option in review.");
            }
        }

        // Check if answer key has items that don't correspond to any question
        for (Integer ansQNum : answerKeyMap.keySet()) {
            if (!seenNumbers.contains(ansQNum)) {
                warnings.add("Answer Sheet includes answer for Question #" + ansQNum + ", but no matching question exists in the Question Paper.");
            }
        }
    }

    /**
     * Calculates an overall confidence score (0-100%).
     */
    private double calculateConfidence(
            List<ParsedQuestionDto> questions,
            Map<Integer, String> answerKeyMap,
            List<String> warnings,
            List<String> errors
    ) {
        if (questions.isEmpty()) return 0.0;

        int total = questions.size();
        long with4Options = questions.stream().filter(q -> q.getOptions().size() >= 4).count();
        long withAnswer = questions.stream().filter(q -> q.getCorrectOption() != null).count();
        long withoutIssues = questions.stream().filter(q -> !q.isHasIssue()).count();

        double optionsScore = ((double) with4Options / total) * 35.0;
        double answersScore = ((double) withAnswer / total) * 40.0;
        double issuesScore = ((double) withoutIssues / total) * 25.0;

        double score = optionsScore + answersScore + issuesScore;
        if (!errors.isEmpty()) {
            score = Math.max(0, score - (errors.size() * 15.0));
        }
        return Math.min(100.0, Math.max(0.0, score));
    }

    public static class PdfSecurityException extends RuntimeException {
        public PdfSecurityException(String message) {
            super(message);
        }
    }
}
