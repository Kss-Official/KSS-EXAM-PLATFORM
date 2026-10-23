package com.exam.secureexam.repository;

import com.exam.secureexam.model.CandidateSlot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CandidateSlotRepository extends JpaRepository<CandidateSlot, CandidateSlot.CandidateSlotId> {

    List<CandidateSlot> findByCandidateId(Long candidateId);

    List<CandidateSlot> findBySlotId(Long slotId);

    long countBySlotId(Long slotId);

    Optional<CandidateSlot> findByCandidateIdAndSlotId(Long candidateId, Long slotId);
}
