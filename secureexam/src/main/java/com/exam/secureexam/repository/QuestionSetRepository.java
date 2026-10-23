package com.exam.secureexam.repository;

import com.exam.secureexam.model.QuestionSet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface QuestionSetRepository extends JpaRepository<QuestionSet, Long> {

    List<QuestionSet> findByExamIdOrderBySetCodeAsc(Long examId);

    Optional<QuestionSet> findByExamIdAndSetCode(Long examId, String setCode);

    boolean existsByExamIdAndSetCode(Long examId, String setCode);

    List<QuestionSet> findByExamIdAndDepartmentIdOrderBySetCodeAsc(Long examId, Long departmentId);

    Optional<QuestionSet> findByExamIdAndDepartmentIdAndSetCode(Long examId, Long departmentId, String setCode);

    boolean existsByExamIdAndDepartmentIdAndSetCode(Long examId, Long departmentId, String setCode);

    long countByExamIdAndDepartmentId(Long examId, Long departmentId);
}
