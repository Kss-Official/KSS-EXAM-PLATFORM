package com.exam.secureexam.repository;

import com.exam.secureexam.model.AttemptRandomizedOption;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AttemptRandomizedOptionRepository extends JpaRepository<AttemptRandomizedOption, Long> {

    List<AttemptRandomizedOption> findByAttemptIdAndQuestionIdOrderByDisplayOrderAsc(Long attemptId, Long questionId);

    List<AttemptRandomizedOption> findByAttemptIdOrderByQuestionIdAscDisplayOrderAsc(Long attemptId);
}
