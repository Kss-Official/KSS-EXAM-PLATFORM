package com.exam.secureexam.repository;

import com.exam.secureexam.model.AttemptRandomizedQuestion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AttemptRandomizedQuestionRepository extends JpaRepository<AttemptRandomizedQuestion, Long> {

    List<AttemptRandomizedQuestion> findByAttemptIdOrderByDisplayOrderAsc(Long attemptId);

    boolean existsByAttemptId(Long attemptId);
}
