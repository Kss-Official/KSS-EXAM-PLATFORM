package com.exam.secureexam.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "question_sets", uniqueConstraints = {
    @UniqueConstraint(name = "uq_exam_dept_set", columnNames = {"exam_id", "department_id", "set_code"})
})
public class QuestionSet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exam_id", nullable = false)
    @JsonIgnore
    private Exam exam;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "department_id")
    private Department department;

    @Column(name = "set_code", nullable = false, length = 10)
    private String setCode; // 'A', 'B', 'C', 'D'

    @Column(nullable = false, length = 100)
    private String name;

    @OneToMany(mappedBy = "questionSet", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("displayOrder ASC")
    private List<Question> questions = new ArrayList<>();

    public QuestionSet() {}

    public QuestionSet(Exam exam, String setCode, String name) {
        this.exam = exam;
        this.setCode = setCode;
        this.name = name;
    }

    public QuestionSet(Exam exam, Department department, String setCode, String name) {
        this.exam = exam;
        this.department = department;
        this.setCode = setCode;
        this.name = name;
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Exam getExam() { return exam; }
    public void setExam(Exam exam) { this.exam = exam; }

    public Department getDepartment() { return department; }
    public void setDepartment(Department department) { this.department = department; }

    public String getSetCode() { return setCode; }
    public void setSetCode(String setCode) { this.setCode = setCode; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public List<Question> getQuestions() { return questions; }
    public void setQuestions(List<Question> questions) { this.questions = questions; }
}
