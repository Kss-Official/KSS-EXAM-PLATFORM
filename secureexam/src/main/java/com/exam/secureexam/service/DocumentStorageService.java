package com.exam.secureexam.service;

import com.exam.secureexam.model.Department;
import com.exam.secureexam.model.Exam;
import com.exam.secureexam.model.QuestionSet;
import com.exam.secureexam.model.StoredDocument;
import com.exam.secureexam.repository.StoredDocumentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.*;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.Set;
import java.util.UUID;

@Service
public class DocumentStorageService {

    private static final Logger logger = LoggerFactory.getLogger(DocumentStorageService.class);

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("pdf", "txt", "csv", "doc", "docx");
    private static final long MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

    private final Path storageDirectory;
    private final StoredDocumentRepository documentRepository;

    public DocumentStorageService(
            @Value("${app.storage.upload-dir:./private-storage/documents}") String uploadDir,
            StoredDocumentRepository documentRepository) {
        this.storageDirectory = Paths.get(uploadDir).toAbsolutePath().normalize();
        this.documentRepository = documentRepository;

        try {
            Files.createDirectories(this.storageDirectory);
            logger.info("[Storage] Document storage directory initialized at: {}", this.storageDirectory);
        } catch (IOException e) {
            throw new RuntimeException("Could not initialize local document storage directory", e);
        }
    }

    public StoredDocument storeDocument(
            MultipartFile file,
            Exam exam,
            Department department,
            QuestionSet questionSet,
            String documentType,
            Long adminId
    ) throws IOException {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Cannot store empty file");
        }

        if (file.getSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("File size exceeds 25 MB limit");
        }

        String originalFilename = file.getOriginalFilename();
        if (originalFilename == null || originalFilename.contains("..")) {
            throw new IllegalArgumentException("Invalid filename containing path traversal sequence");
        }

        String extension = getFileExtension(originalFilename).toLowerCase();
        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw new IllegalArgumentException("File type not allowed. Permitted: " + ALLOWED_EXTENSIONS);
        }

        String generatedKey = UUID.randomUUID() + "_" + System.currentTimeMillis() + "." + extension;
        Path targetPath = this.storageDirectory.resolve(generatedKey).normalize();

        if (!targetPath.startsWith(this.storageDirectory)) {
            throw new SecurityException("Path traversal attempt detected");
        }

        MessageDigest digest;
        try {
            digest = MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }

        try (InputStream inputStream = file.getInputStream();
             DigestInputStream dis = new DigestInputStream(inputStream, digest)) {
            Files.copy(dis, targetPath, StandardCopyOption.REPLACE_EXISTING);
        }

        String sha256 = HexFormat.of().formatHex(digest.digest());

        StoredDocument doc = new StoredDocument();
        doc.setExam(exam);
        doc.setDepartment(department);
        doc.setQuestionSet(questionSet);
        doc.setDocumentType(documentType); // QUESTION_PAPER, ANSWER_KEY
        doc.setOriginalFilename(originalFilename);
        doc.setStoragePath(targetPath.toString());
        doc.setMimeType(file.getContentType());
        doc.setFileSize(file.getSize());
        doc.setSha256Checksum(sha256);
        doc.setUploadingAdminId(adminId);
        doc.setValidationStatus("VALIDATED");
        doc.setVersionNumber(1);
        doc.setCreatedAt(OffsetDateTime.now());

        StoredDocument saved = documentRepository.save(doc);
        logger.info("[Storage] Successfully stored confidential document id={} type={} sha256={}",
                saved.getId(), documentType, sha256);
        return saved;
    }

    private String getFileExtension(String filename) {
        int dotIndex = filename.lastIndexOf('.');
        return (dotIndex == -1) ? "" : filename.substring(dotIndex + 1);
    }
}
