package com.exam.secureexam.repository;

import com.exam.secureexam.model.ExamAttempt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ExamAttemptRepository extends JpaRepository<ExamAttempt, Long> {

    Optional<ExamAttempt> findByCandidateIdAndExamId(Long candidateId, Long examId);

    List<ExamAttempt> findByCandidateId(Long candidateId);

    List<ExamAttempt> findByExamIdOrderByCreatedAtDesc(Long examId);

    long countByStatus(String status);

    long countByExamId(Long examId);

    long countByQuestionSetId(Long questionSetId);

    boolean existsByQuestionSetId(Long questionSetId);

    @Query("SELECT ea FROM ExamAttempt ea " +
           "JOIN FETCH ea.candidate c " +
           "JOIN FETCH ea.exam e " +
           "JOIN FETCH ea.questionSet qs " +
           "WHERE (:examId IS NULL OR e.id = :examId) " +
           "ORDER BY ea.createdAt DESC")
    List<ExamAttempt> findAttemptsWithDetails(@Param("examId") Long examId);
}
