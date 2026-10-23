package com.exam.secureexam.controller;

import com.exam.secureexam.dto.DepartmentDto;
import com.exam.secureexam.service.DepartmentService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/departments")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class AdminDepartmentController {

    private final DepartmentService departmentService;

    public AdminDepartmentController(DepartmentService departmentService) {
        this.departmentService = departmentService;
    }

    @GetMapping
    public List<DepartmentDto> getAllDepartments() {
        return departmentService.getAllDepartments();
    }

    @GetMapping("/active")
    public List<DepartmentDto> getActiveDepartments() {
        return departmentService.getActiveDepartments();
    }

    @GetMapping("/{id}")
    public DepartmentDto getDepartmentById(@PathVariable Long id) {
        return departmentService.getDepartmentById(id);
    }

    @PostMapping
    public ResponseEntity<DepartmentDto> createDepartment(
            @RequestBody DepartmentDto dto,
            Authentication authentication
    ) {
        String adminUser = authentication != null ? authentication.getName() : "ADMIN";
        DepartmentDto created = departmentService.createDepartment(dto, adminUser);
        return ResponseEntity.ok(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<DepartmentDto> updateDepartment(
            @PathVariable Long id,
            @RequestBody DepartmentDto dto,
            Authentication authentication
    ) {
        String adminUser = authentication != null ? authentication.getName() : "ADMIN";
        DepartmentDto updated = departmentService.updateDepartment(id, dto, adminUser);
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Map<String, Object>> deleteDepartment(
            @PathVariable Long id,
            Authentication authentication
    ) {
        String adminUser = authentication != null ? authentication.getName() : "ADMIN";
        departmentService.deleteDepartment(id, adminUser);
        return ResponseEntity.ok(Map.of("success", true, "message", "Department deleted successfully"));
    }
}
