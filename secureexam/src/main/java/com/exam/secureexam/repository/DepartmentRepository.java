package com.exam.secureexam.repository;

import com.exam.secureexam.model.Department;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DepartmentRepository extends JpaRepository<Department, Long> {

    Optional<Department> findByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCase(String code);

    List<Department> findByActiveTrueOrderByNameAsc();

    @Query("SELECT DISTINCT d FROM Department d " +
           "JOIN d.exams e " +
           "WHERE d.active = true AND e.status = 'PUBLISHED' " +
           "ORDER BY d.name ASC")
    List<Department> findActiveDepartmentsWithPublishedExams();
}
