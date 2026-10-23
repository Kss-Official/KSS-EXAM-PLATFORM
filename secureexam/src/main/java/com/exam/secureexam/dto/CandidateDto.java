package com.exam.secureexam.dto;

import com.exam.secureexam.model.Candidate;
import java.time.OffsetDateTime;

public class CandidateDto {
    private Long id;
    private String registrationNumber;
    private String fullName;
    private String email;
    private Long departmentId;
    private String departmentName;
    private String status;
    private OffsetDateTime createdAt;

    public CandidateDto() {}

    public static CandidateDto fromEntity(Candidate c) {
        CandidateDto dto = new CandidateDto();
        dto.setId(c.getId());
        dto.setRegistrationNumber(c.getRegistrationNumber());
        dto.setFullName(c.getFullName());
        dto.setEmail(c.getEmail());
        if (c.getDepartment() != null) {
            dto.setDepartmentId(c.getDepartment().getId());
            dto.setDepartmentName(c.getDepartment().getName());
        }
        dto.setStatus(c.getStatus());
        dto.setCreatedAt(c.getCreatedAt());
        return dto;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getRegistrationNumber() { return registrationNumber; }
    public void setRegistrationNumber(String registrationNumber) { this.registrationNumber = registrationNumber; }

    public String getFullName() { return fullName; }
    public void setFullName(String fullName) { this.fullName = fullName; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public Long getDepartmentId() { return departmentId; }
    public void setDepartmentId(Long departmentId) { this.departmentId = departmentId; }

    public String getDepartmentName() { return departmentName; }
    public void setDepartmentName(String departmentName) { this.departmentName = departmentName; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }
}
