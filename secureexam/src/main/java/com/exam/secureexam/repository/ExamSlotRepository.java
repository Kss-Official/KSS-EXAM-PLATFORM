package com.exam.secureexam.repository;

import com.exam.secureexam.model.ExamSlot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ExamSlotRepository extends JpaRepository<ExamSlot, Long> {

    List<ExamSlot> findByExamIdOrderBySlotNumberAsc(Long examId);

    Optional<ExamSlot> findByExamIdAndSlotNumber(Long examId, Integer slotNumber);
}
