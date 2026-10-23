package com.exam.secureexam.repository;

import com.exam.secureexam.model.StoredDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface StoredDocumentRepository extends JpaRepository<StoredDocument, Long> {

    List<StoredDocument> findByExamIdOrderByCreatedAtDesc(Long examId);

    List<StoredDocument> findByExamIdAndQuestionSetIdOrderByCreatedAtDesc(Long examId, Long questionSetId);

    List<StoredDocument> findByQuestionSetIdOrderByCreatedAtDesc(Long questionSetId);

    java.util.Optional<StoredDocument> findTopByQuestionSetIdAndDocumentTypeOrderByCreatedAtDesc(Long questionSetId, String documentType);

    void deleteByQuestionSetIdAndDocumentType(Long questionSetId, String documentType);

    void deleteByQuestionSetId(Long questionSetId);
}
