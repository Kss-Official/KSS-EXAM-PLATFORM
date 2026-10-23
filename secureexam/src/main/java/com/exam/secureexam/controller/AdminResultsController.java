package com.exam.secureexam.controller;

import com.exam.secureexam.dto.CandidateExamDtos.ExamResultDto;
import com.exam.secureexam.model.Exam;
import com.exam.secureexam.service.DashboardService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/results")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class AdminResultsController {

    private final DashboardService dashboardService;

    public AdminResultsController(DashboardService dashboardService) {
        this.dashboardService = dashboardService;
    }

    @GetMapping
    public List<ExamResultDto> getAllResults() {
        return dashboardService.getExamResults(null);
    }

    @GetMapping("/exam/{examId}")
    public List<ExamResultDto> getResultsByExam(@PathVariable Long examId) {
        return dashboardService.getExamResults(examId);
    }

    @PostMapping("/exam/{examId}/publish")
    public ResponseEntity<Map<String, Object>> publishResults(
            @PathVariable Long examId,
            @RequestBody Map<String, Boolean> payload,
            Authentication authentication
    ) {
        String adminUser = authentication != null ? authentication.getName() : "ADMIN";
        boolean publish = payload.getOrDefault("published", true);
        Exam exam = dashboardService.publishExamResults(examId, publish, adminUser);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "examId", examId,
                "resultsPublished", exam.isResultsPublished(),
                "message", "Results publication status updated"
        ));
    }
}
