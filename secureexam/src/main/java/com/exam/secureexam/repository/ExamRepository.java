package com.exam.secureexam.repository;

import com.exam.secureexam.model.Exam;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ExamRepository extends JpaRepository<Exam, Long> {

    List<Exam> findByStatusOrderByCreatedAtDesc(String status);

    List<Exam> findAllByOrderByCreatedAtDesc();

    long countByStatus(String status);

    @Query("SELECT DISTINCT e FROM Exam e " +
           "JOIN e.departments d " +
           "WHERE d.id = :departmentId AND e.status = 'PUBLISHED' " +
           "ORDER BY e.createdAt DESC")
    List<Exam> findPublishedExamsByDepartmentId(@Param("departmentId") Long departmentId);

    @Query("SELECT DISTINCT e FROM Exam e " +
           "JOIN e.departments d " +
           "WHERE LOWER(d.code) = LOWER(:deptCode) AND e.status = 'PUBLISHED' " +
           "ORDER BY e.createdAt DESC")
    List<Exam> findPublishedExamsByDepartmentCode(@Param("deptCode") String deptCode);
}
