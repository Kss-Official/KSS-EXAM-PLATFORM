package com.exam.secureexam.repository;

import com.exam.secureexam.model.Candidate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CandidateRepository extends JpaRepository<Candidate, Long> {

    Optional<Candidate> findByRegistrationNumberIgnoreCase(String registrationNumber);

    Optional<Candidate> findByEmailIgnoreCase(String email);

    boolean existsByRegistrationNumberIgnoreCase(String registrationNumber);

    boolean existsByEmailIgnoreCase(String email);

    List<Candidate> findByDepartmentIdOrderByFullNameAsc(Long departmentId);

    List<Candidate> findAllByOrderByCreatedAtDesc();
}
