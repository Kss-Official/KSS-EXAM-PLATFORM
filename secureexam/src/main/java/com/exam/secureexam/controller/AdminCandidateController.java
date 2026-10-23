package com.exam.secureexam.controller;

import com.exam.secureexam.dto.CandidateDto;
import com.exam.secureexam.model.ExamAttempt;
import com.exam.secureexam.service.CandidateService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/candidates")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class AdminCandidateController {

    private final CandidateService candidateService;

    public AdminCandidateController(CandidateService candidateService) {
        this.candidateService = candidateService;
    }

    @GetMapping
    public List<CandidateDto> getAllCandidates() {
        return candidateService.getAllCandidates();
    }

    @PostMapping
    public ResponseEntity<CandidateDto> createCandidate(
            @RequestBody CandidateDto dto,
            Authentication authentication
    ) {
        String adminUser = authentication != null ? authentication.getName() : "ADMIN";
        CandidateDto created = candidateService.createCandidate(dto, adminUser);
        return ResponseEntity.ok(created);
    }

    @PostMapping("/batch")
    public ResponseEntity<Map<String, Object>> importCandidatesBatch(
            @RequestParam("file") MultipartFile file,
            Authentication authentication
    ) {
        String adminUser = authentication != null ? authentication.getName() : "ADMIN";
        Map<String, Object> result = candidateService.importCandidatesCsv(file, adminUser);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/{candidateId}/assign")
    public ResponseEntity<Map<String, Object>> assignCandidate(
            @PathVariable Long candidateId,
            @RequestBody Map<String, Object> payload,
            Authentication authentication
    ) {
        String adminUser = authentication != null ? authentication.getName() : "ADMIN";
        Long examId = Long.valueOf(payload.get("examId").toString());
        Long slotId = payload.get("slotId") != null ? Long.valueOf(payload.get("slotId").toString()) : null;
        String setCode = payload.get("setCode") != null ? payload.get("setCode").toString() : null;

        ExamAttempt attempt = candidateService.assignCandidateToExam(candidateId, examId, slotId, setCode, adminUser);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "attemptId", attempt.getId(),
                "status", attempt.getStatus(),
                "setCode", attempt.getQuestionSet().getSetCode()
        ));
    }
}
