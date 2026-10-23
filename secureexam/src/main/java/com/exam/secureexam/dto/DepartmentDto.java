package com.exam.secureexam.dto;

import com.exam.secureexam.model.Department;
import java.time.OffsetDateTime;

public class DepartmentDto {
    private Long id;
    private String name;
    private String code;
    private String description;
    private boolean active;
    private OffsetDateTime createdAt;
    private int associatedExamsCount;

    public DepartmentDto() {}

    public static DepartmentDto fromEntity(Department d) {
        DepartmentDto dto = new DepartmentDto();
        dto.setId(d.getId());
        dto.setName(d.getName());
        dto.setCode(d.getCode());
        dto.setDescription(d.getDescription());
        dto.setActive(d.isActive());
        dto.setCreatedAt(d.getCreatedAt());
        int count = 0;
        try {
            if (d.getExams() != null && org.hibernate.Hibernate.isInitialized(d.getExams())) {
                count = d.getExams().size();
            }
        } catch (Exception ignored) {
            count = 0;
        }
        dto.setAssociatedExamsCount(count);
        return dto;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public OffsetDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(OffsetDateTime createdAt) { this.createdAt = createdAt; }

    public int getAssociatedExamsCount() { return associatedExamsCount; }
    public void setAssociatedExamsCount(int associatedExamsCount) { this.associatedExamsCount = associatedExamsCount; }
}
