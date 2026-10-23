package com.exam.secureexam.service;

import com.exam.secureexam.dto.DepartmentDto;
import com.exam.secureexam.model.AuditLog;
import com.exam.secureexam.model.Department;
import com.exam.secureexam.repository.AuditLogRepository;
import com.exam.secureexam.repository.DepartmentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class DepartmentService {

    private final DepartmentRepository departmentRepository;
    private final AuditLogRepository auditLogRepository;

    public DepartmentService(DepartmentRepository departmentRepository, AuditLogRepository auditLogRepository) {
        this.departmentRepository = departmentRepository;
        this.auditLogRepository = auditLogRepository;
    }

    @Transactional(readOnly = true)
    public List<DepartmentDto> getAllDepartments() {
        return departmentRepository.findAll().stream()
                .map(DepartmentDto::fromEntity)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<DepartmentDto> getActiveDepartments() {
        return departmentRepository.findByActiveTrueOrderByNameAsc().stream()
                .map(DepartmentDto::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * Used by Candidate Portal:
     * Only returns departments that are active AND have at least one published exam.
     */
    @Transactional(readOnly = true)
    public List<DepartmentDto> getEligibleDepartmentsForCandidates() {
        List<Department> withPublished = departmentRepository.findActiveDepartmentsWithPublishedExams();
        if (!withPublished.isEmpty()) {
            return withPublished.stream().map(DepartmentDto::fromEntity).collect(Collectors.toList());
        }
        return departmentRepository.findByActiveTrueOrderByNameAsc().stream()
                .map(DepartmentDto::fromEntity)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public DepartmentDto getDepartmentById(Long id) {
        Department dept = departmentRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Department not found with ID: " + id));
        return DepartmentDto.fromEntity(dept);
    }

    @Transactional
    public DepartmentDto createDepartment(DepartmentDto dto, String performedBy) {
        String cleanCode = dto.getCode().trim().toUpperCase();
        if (departmentRepository.existsByCodeIgnoreCase(cleanCode)) {
            throw new IllegalArgumentException("Department with code '" + cleanCode + "' already exists");
        }

        Department dept = new Department(dto.getName().trim(), cleanCode, dto.getDescription());
        dept.setActive(dto.isActive());
        Department saved = departmentRepository.save(dept);

        auditLogRepository.save(new AuditLog(
                "CREATE_DEPARTMENT",
                "Department",
                String.valueOf(saved.getId()),
                performedBy,
                "Created department: " + saved.getName() + " (" + saved.getCode() + ")"
        ));

        return DepartmentDto.fromEntity(saved);
    }

    @Transactional
    public DepartmentDto updateDepartment(Long id, DepartmentDto dto, String performedBy) {
        Department dept = departmentRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Department not found with ID: " + id));

        String cleanCode = dto.getCode().trim().toUpperCase();
        if (!dept.getCode().equalsIgnoreCase(cleanCode) && departmentRepository.existsByCodeIgnoreCase(cleanCode)) {
            throw new IllegalArgumentException("Department with code '" + cleanCode + "' already exists");
        }

        dept.setName(dto.getName().trim());
        dept.setCode(cleanCode);
        dept.setDescription(dto.getDescription());
        dept.setActive(dto.isActive());

        Department saved = departmentRepository.save(dept);

        auditLogRepository.save(new AuditLog(
                "UPDATE_DEPARTMENT",
                "Department",
                String.valueOf(saved.getId()),
                performedBy,
                "Updated department: " + saved.getName() + " active=" + saved.isActive()
        ));

        return DepartmentDto.fromEntity(saved);
    }

    @Transactional
    public void deleteDepartment(Long id, String performedBy) {
        Department dept = departmentRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Department not found with ID: " + id));

        if (dept.getExams() != null && !dept.getExams().isEmpty()) {
            throw new IllegalStateException("Cannot delete department with associated examinations. Deactivate it instead.");
        }

        departmentRepository.delete(dept);

        auditLogRepository.save(new AuditLog(
                "DELETE_DEPARTMENT",
                "Department",
                String.valueOf(id),
                performedBy,
                "Deleted department: " + dept.getName()
        ));
    }
}
