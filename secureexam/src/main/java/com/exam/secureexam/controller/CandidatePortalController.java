package com.exam.secureexam.controller;

import com.exam.secureexam.dto.CandidateExamDtos.*;
import com.exam.secureexam.dto.DepartmentDto;
import com.exam.secureexam.service.CandidateExamService;
import com.exam.secureexam.service.DepartmentService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/candidate")
public class CandidatePortalController {

    private final CandidateExamService candidateExamService;
    private final DepartmentService departmentService;

    public CandidatePortalController(CandidateExamService candidateExamService, DepartmentService departmentService) {
        this.candidateExamService = candidateExamService;
        this.departmentService = departmentService;
    }

    /**
     * Fetch real active departments that have an eligible published examination
     */
    @GetMapping("/departments")
    public List<DepartmentDto> getEligibleDepartments() {
        return departmentService.getEligibleDepartmentsForCandidates();
    }

    /**
     * Candidate enters candidate ID + department to verify eligibility
     */
    @PostMapping("/verify")
    public ResponseEntity<CandidateVerifyResponse> verifyCandidate(@RequestBody CandidateVerifyRequest req) {
        CandidateVerifyResponse resp = candidateExamService.verifyCandidate(req);
        return ResponseEntity.ok(resp);
    }

    /**
     * Candidate launches or resumes examination
     */
    @PostMapping("/start")
    public ResponseEntity<CandidateStartAttemptResponse> startAttempt(@RequestBody Map<String, Object> payload) {
        Object candObj = payload != null ? payload.get("candidateId") : null;
        Object examObj = payload != null ? payload.get("examId") : null;
        if (candObj == null || examObj == null) {
            throw new IllegalArgumentException("candidateId and examId are required");
        }
        Long candidateId = Long.valueOf(candObj.toString());
        Long examId = Long.valueOf(examObj.toString());
        CandidateStartAttemptResponse resp = candidateExamService.startOrResumeAttempt(candidateId, examId);
        return ResponseEntity.ok(resp);
    }

    /**
     * Auto-save selected answer
     */
    @PostMapping("/answers")
    public ResponseEntity<Map<String, Object>> saveAnswer(
            @RequestParam("attemptId") Long attemptId,
            @RequestBody AnswerSaveRequest req
    ) {
        Map<String, Object> resp = candidateExamService.saveAnswer(attemptId, req.getQuestionId(), req.getSelectedOptionId());
        return ResponseEntity.ok(resp);
    }

    /**
     * Candidate submits exam (or auto-submitted by timer expiry)
     */
    @PostMapping("/submit")
    public ResponseEntity<SubmissionResponse> submitAttempt(@RequestParam("attemptId") Long attemptId) {
        SubmissionResponse resp = candidateExamService.submitAttempt(attemptId);
        return ResponseEntity.ok(resp);
    }
}
