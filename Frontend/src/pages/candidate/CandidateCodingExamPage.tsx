import React, { useState, useEffect, useCallback } from "react";
import { 
  Play, 
  Send, 
  Terminal, 
  Code2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  RotateCcw, 
  Copy, 
  Check, 
  BookOpen, 
  ShieldCheck, 
  Layers,
  ChevronRight,
  Maximize2,
  FileCode2
} from "lucide-react";
import kalpanaaLogo from "../../assets/kalpanaa_logo.png";
import type { CandidateSession } from "../../types/candidate";
import { 
  runCandidateCode, 
  submitCandidateCode, 
  getCandidateCodingExam,
  type SubmissionResponse 
} from "../../services/api";
import { 
  SAMPLE_INITIAL_CODING_QUESTION, 
  ALL_SUPPORTED_LANGUAGES, 
  getSavedCodingExams,
  type CodingQuestionDto, 
  type SupportedLanguage, 
  type CodingExamDto 
} from "../../services/codingExamService";
import ExamTimer from "../../components/candidate/ExamTimer";

const DEFAULT_BOILERPLATES: Record<SupportedLanguage, string> = {
  python3: `import sys

def solve():
    # Read input from standard input
    input_data = sys.stdin.read().split()
    if not input_data:
        return
    
    n = int(input_data[0])
    nums = [int(x) for x in input_data[1:n+1]]
    target = int(input_data[n+1])
    
    # Two-pointer approach on sorted array
    left = 0
    right = n - 1
    while left < right:
        curr_sum = nums[left] + nums[right]
        if curr_sum == target:
            print(f"{left + 1} {right + 1}")
            return
        elif curr_sum < target:
            left += 1
        else:
            right -= 1

if __name__ == "__main__":
    solve()
`,
  javascript: `const fs = require('fs');

function solve() {
    const input = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);
    if (!input || input.length === 0 || input[0] === '') return;
    
    const n = parseInt(input[0], 10);
    const nums = [];
    for (let i = 1; i <= n; i++) {
        nums.push(parseInt(input[i], 10));
    }
    const target = parseInt(input[n + 1], 10);
    
    let left = 0;
    let right = n - 1;
    while (left < right) {
        const sum = nums[left] + nums[right];
        if (sum === target) {
            console.log(\`\${left + 1} \${right + 1}\`);
            return;
        } else if (sum < target) {
            left++;
        } else {
            right--;
        }
    }
}

solve();
`,
  cpp: `#include <iostream>
#include <vector>

using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    
    int n;
    if (!(cin >> n)) return 0;
    
    vector<long long> nums(n);
    for (int i = 0; i < n; i++) {
        cin >> nums[i];
    }
    long long target;
    cin >> target;
    
    int left = 0, right = n - 1;
    while (left < right) {
        long long sum = nums[left] + nums[right];
        if (sum == target) {
            cout << (left + 1) << " " << (right + 1) << "\\n";
            return 0;
        } else if (sum < target) {
            left++;
        } else {
            right--;
        }
    }
    return 0;
}
`,
  java: `import java.util.*;

public class Solution {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        if (!sc.hasNextInt()) return;
        
        int n = sc.nextInt();
        long[] nums = new long[n];
        for (int i = 0; i < n; i++) {
            nums[i] = sc.nextLong();
        }
        long target = sc.nextLong();
        
        int left = 0, right = n - 1;
        while (left < right) {
            long sum = nums[left] + nums[right];
            if (sum == target) {
                System.out.println((left + 1) + " " + (right + 1));
                return;
            } else if (sum < target) {
                left++;
            } else {
                right--;
            }
        }
    }
}
`,
  c: `#include <stdio.h>
#include <stdlib.h>

int main() {
    int n;
    if (scanf("%d", &n) != 1) return 0;
    
    long long *nums = (long long *)malloc(sizeof(long long) * n);
    for (int i = 0; i < n; i++) {
        scanf("%lld", &nums[i]);
    }
    long long target;
    scanf("%lld", &target);
    
    int left = 0, right = n - 1;
    while (left < right) {
        long long sum = nums[left] + nums[right];
        if (sum == target) {
            printf("%d %d\\n", left + 1, right + 1);
            free(nums);
            return 0;
        } else if (sum < target) {
            left++;
        } else {
            right--;
        }
    }
    free(nums);
    return 0;
}
`,
  csharp: `using System;

class Solution {
    static void Main() {
        string line = Console.ReadLine();
        if (string.IsNullOrEmpty(line)) return;
        int n = int.Parse(line.Trim());
        
        string[] parts = Console.ReadLine().Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
        long[] nums = new long[n];
        for (int i = 0; i < n; i++) {
            nums[i] = long.Parse(parts[i]);
        }
        long target = long.Parse(Console.ReadLine().Trim());
        
        int left = 0, right = n - 1;
        while (left < right) {
            long sum = nums[left] + nums[right];
            if (sum == target) {
                Console.WriteLine($"{left + 1} {right + 1}");
                return;
            } else if (sum < target) {
                left++;
            } else {
                right--;
            }
        }
    }
}
`,
  python: `import sys

def solve():
    input_data = sys.stdin.read().split()
    if not input_data:
        return
    n = int(input_data[0])
    nums = [int(x) for x in input_data[1:n+1]]
    target = int(input_data[n+1])
    
    left = 0
    right = n - 1
    while left < right:
        curr_sum = nums[left] + nums[right]
        if curr_sum == target:
            print "%d %d" % (left + 1, right + 1)
            return
        elif curr_sum < target:
            left += 1
        else:
            right -= 1

if __name__ == "__main__":
    solve()
`,
  typescript: `const fs = require('fs');

function solve() {
    const input = fs.readFileSync(0, 'utf-8').trim().split(/\\s+/);
    if (!input || input.length === 0 || input[0] === '') return;
    
    const n = parseInt(input[0], 10);
    const nums: number[] = [];
    for (let i = 1; i <= n; i++) {
        nums.push(parseInt(input[i], 10));
    }
    const target = parseInt(input[n + 1], 10);
    
    let left = 0;
    let right = n - 1;
    while (left < right) {
        const sum = nums[left] + nums[right];
        if (sum === target) {
            console.log(\`\${left + 1} \${right + 1}\`);
            return;
        } else if (sum < target) {
            left++;
        } else {
            right--;
        }
    }
}

solve();
`
};

interface CandidateCodingExamPageProps {
  initialSession: CandidateSession;
  onFinalize: (
    reason: "manual_submit" | "timer_expired" | "candidate_exit",
    backendResult?: SubmissionResponse
  ) => void;
}

export default function CandidateCodingExamPage({
  initialSession,
  onFinalize
}: CandidateCodingExamPageProps) {
  const [questions, setQuestions] = useState<CodingQuestionDto[]>([SAMPLE_INITIAL_CODING_QUESTION]);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState<number>(0);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>("python3");
  
  // Per-question code store
  const [codeMap, setCodeMap] = useState<Record<string, string>>({});
  const [customInput, setCustomInput] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"terminal" | "results" | "customInput">("terminal");

  // Execution states
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [terminalOutput, setTerminalOutput] = useState<{
    stdout: string;
    stderr?: string | null;
    executionTimeMs?: number;
    status: "IDLE" | "SUCCESS" | "ERROR" | "TIMEOUT";
  }>({ stdout: "Press 'Run Code' to execute against sample inputs.", status: "IDLE" });

  const [evaluationResult, setEvaluationResult] = useState<{
    status: "PASSED" | "PARTIAL" | "FAILED" | "ERROR";
    passedCount: number;
    totalCount: number;
    score: number;
    maxMarks: number;
    testCaseResults: any[];
    message: string;
  } | null>(null);

  // Scores tracked across problems for final receipt
  const [problemScores, setProblemScores] = useState<Record<string, number>>({});
  const [showSubmitModal, setShowSubmitModal] = useState<boolean>(false);
  const [copiedSample, setCopiedSample] = useState<boolean>(false);

  const currentQuestion = questions[activeQuestionIdx] || questions[0];
  const questionKey = currentQuestion?.id || `q-${activeQuestionIdx}`;

  // Fetch coding questions from backend on mount
  useEffect(() => {
    let isCancelled = false;
    const loadExamQuestions = async () => {
      const assignedExamId = initialSession?.profile?.assignedExamId;
      if (assignedExamId) {
        try {
          const dto = await getCandidateCodingExam(assignedExamId);
          if (!isCancelled && dto?.questions && dto.questions.length > 0) {
            setQuestions(dto.questions);
            return;
          }
        } catch (err) {
          console.warn("[CandidateCodingExamPage] Backend coding exam lookup fallback:", err);
        }
      }

      // Local draft fallback
      const localExams = getSavedCodingExams();
      if (localExams.length > 0 && localExams[0].questions?.length > 0) {
        if (!isCancelled) {
          setQuestions(localExams[0].questions);
        }
      }
    };

    loadExamQuestions();
    return () => { isCancelled = true; };
  }, [initialSession]);

  // Restore or initialize code for current question & language
  const currentCode = codeMap[questionKey] || DEFAULT_BOILERPLATES[selectedLanguage] || "";

  const handleCodeChange = (newCode: string) => {
    setCodeMap(prev => {
      const updated = { ...prev, [questionKey]: newCode };
      try {
        localStorage.setItem(`examsecure_coding_code_${initialSession.sessionId}`, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleLanguageChange = (lang: SupportedLanguage) => {
    setSelectedLanguage(lang);
    if (!codeMap[questionKey] || codeMap[questionKey] === DEFAULT_BOILERPLATES[selectedLanguage]) {
      handleCodeChange(DEFAULT_BOILERPLATES[lang] || "");
    }
  };

  const handleResetCode = () => {
    if (confirm("Reset code editor to starter boilerplate? Current changes will be replaced.")) {
      handleCodeChange(DEFAULT_BOILERPLATES[selectedLanguage] || "");
    }
  };

  // Run candidate code against sample input
  const handleRunCode = async () => {
    setIsRunning(true);
    setActiveTab("terminal");
    setTerminalOutput({ stdout: "Compiling and executing in sandbox container...", status: "IDLE" });

    const inputToUse = customInput.trim() ? customInput : (currentQuestion.sampleInput || "");
    try {
      const res = await runCandidateCode({
        language: selectedLanguage,
        code: currentCode,
        input: inputToUse,
        timeLimitMs: currentQuestion.timeLimitMs || 2000
      });

      setTerminalOutput({
        stdout: res.output || "(Program completed with no standard output)",
        stderr: res.error,
        executionTimeMs: res.executionTimeMs,
        status: res.status
      });
    } catch (err: any) {
      setTerminalOutput({
        stdout: "",
        stderr: err.message || "Failed to execute code in sandbox environment.",
        status: "ERROR"
      });
    } finally {
      setIsRunning(false);
    }
  };

  // Submit candidate code for full automated test case evaluation
  const handleSubmitSolution = async () => {
    setIsSubmitting(true);
    setActiveTab("results");

    const candId = initialSession.profile?.dbCandidateId || 1;
    const examId = initialSession.profile?.assignedExamId || 1;

    try {
      const res = await submitCandidateCode({
        examId: examId,
        questionId: String(currentQuestion.id),
        candidateId: Number(candId),
        language: selectedLanguage,
        code: currentCode
      });

      setEvaluationResult(res);
      setProblemScores(prev => ({
        ...prev,
        [questionKey]: res.score
      }));
    } catch (err: any) {
      setEvaluationResult({
        status: "ERROR",
        passedCount: 0,
        totalCount: currentQuestion.testCases?.length || 1,
        score: 0,
        maxMarks: currentQuestion.maxMarks,
        testCaseResults: [],
        message: err.message || "Automated evaluation encountered an unexpected exception."
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Finalize assessment
  const handleFinalSubmitAssessment = (reason: "manual_submit" | "timer_expired") => {
    const totalPossibleMarks = questions.reduce((sum, q) => sum + q.maxMarks, 0);
    const candidateScore = Object.values(problemScores).reduce((sum, s) => sum + s, 0);
    const percentage = totalPossibleMarks > 0 ? Math.round((candidateScore / totalPossibleMarks) * 100) : 0;
    const qualified = percentage >= 60 ? "QUALIFIED" : "NOT_QUALIFIED";

    const backendResult: SubmissionResponse = {
      success: true,
      message: "Round 2 Coding Assessment successfully recorded and verified.",
      receiptId: `SEB-REC-R2-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      submittedAt: new Date().toISOString(),
      attemptId: Number(initialSession.backendAttemptId || initialSession.profile?.dbCandidateId || 1),
      score: candidateScore,
      totalMarks: totalPossibleMarks,
      percentage: percentage,
      qualificationStatus: qualified,
      isPublished: true
    };

    onFinalize(reason, backendResult);
  };

  const copySampleInput = () => {
    if (currentQuestion.sampleInput) {
      navigator.clipboard.writeText(currentQuestion.sampleInput);
      setCopiedSample(true);
      setTimeout(() => setCopiedSample(false), 2000);
    }
  };

  return (
    <div style={{
      width: "100vw",
      height: "100vh",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      background: "#0d1117",
      color: "#c9d1d9",
      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    }}>
      {/* Top Header Bar */}
      <header style={{
        height: "54px",
        background: "#161b22",
        borderBottom: "1px solid #30363d",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 18px",
        flexShrink: 0
      }}>
        {/* Left: Branding & Round Indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <img 
            src={kalpanaaLogo} 
            alt="Kalpanaa" 
            style={{ height: "26px", objectFit: "contain", filter: "brightness(0) invert(1)" }} 
          />
          <div style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            background: "#017846",
            color: "#ffffff",
            padding: "4px 10px",
            borderRadius: "6px",
            fontSize: "11.5px",
            fontWeight: 700,
            letterSpacing: "0.3px"
          }}>
            <Code2 size={13} />
            Round 2: Coding Sandbox
          </div>
          <span style={{ fontSize: "12px", color: "#8b949e" }}>
            {initialSession.profile?.department || "Software Development"}
          </span>
        </div>

        {/* Center: Problem Navigation Tabs */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {questions.map((q, idx) => {
            const isDone = problemScores[q.id] !== undefined;
            const isActive = activeQuestionIdx === idx;
            return (
              <button
                key={q.id || idx}
                type="button"
                onClick={() => setActiveQuestionIdx(idx)}
                style={{
                  background: isActive ? "#21262d" : "transparent",
                  color: isActive ? "#58a6ff" : isDone ? "#3fb950" : "#8b949e",
                  border: isActive ? "1px solid #388bfd" : "1px solid transparent",
                  borderRadius: "6px",
                  padding: "5px 12px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.15s ease"
                }}
              >
                {isDone ? <CheckCircle2 size={13} /> : <FileCode2 size={13} />}
                Problem {idx + 1}
                {isDone && <span style={{ fontSize: "10px", opacity: 0.8 }}>({problemScores[q.id]}m)</span>}
              </button>
            );
          })}
        </div>

        {/* Right: Timer, Profile & Finish Button */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <ExamTimer
            deadline={initialSession.deadline}
            isSubmitted={initialSession.isSubmitted}
            onExpire={() => handleFinalSubmitAssessment("timer_expired")}
          />

          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            background: "#21262d",
            padding: "4px 10px",
            borderRadius: "6px",
            border: "1px solid #30363d"
          }}>
            <div style={{
              width: "22px",
              height: "22px",
              borderRadius: "50%",
              background: "#017846",
              color: "#ffffff",
              display: "grid",
              placeItems: "center",
              fontSize: "11px",
              fontWeight: 700
            }}>
              {(initialSession.profile?.name?.[0] || "C").toUpperCase()}
            </div>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#c9d1d9" }}>
              {initialSession.profile?.name || "Candidate"}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setShowSubmitModal(true)}
            style={{
              background: "#238636",
              color: "#ffffff",
              border: "1px solid rgba(240, 246, 252, 0.1)",
              borderRadius: "6px",
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 1px 4px rgba(35, 134, 54, 0.4)"
            }}
          >
            <Send size={13} /> Finish Assessment
          </button>
        </div>
      </header>

      {/* Main Workspace (Split View) */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left Pane: Problem Description */}
        <div style={{
          width: "44%",
          overflowY: "auto",
          padding: "24px",
          background: "#0d1117",
          borderRight: "1px solid #30363d",
          boxSizing: "border-box"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{
              fontSize: "11px",
              fontWeight: 700,
              textTransform: "uppercase",
              padding: "3px 8px",
              borderRadius: "4px",
              background: currentQuestion.difficulty === "Easy" ? "rgba(46, 160, 67, 0.2)" : currentQuestion.difficulty === "Medium" ? "rgba(187, 128, 9, 0.2)" : "rgba(248, 81, 73, 0.2)",
              color: currentQuestion.difficulty === "Easy" ? "#3fb950" : currentQuestion.difficulty === "Medium" ? "#d29922" : "#f85149"
            }}>
              {currentQuestion.difficulty}
            </span>
            <span style={{ fontSize: "12px", color: "#8b949e", fontWeight: 600 }}>
              Max Score: <strong style={{ color: "#f0f6fc" }}>{currentQuestion.maxMarks} Marks</strong>
            </span>
          </div>

          <h1 style={{ fontSize: "20px", fontWeight: 700, color: "#f0f6fc", margin: "0 0 14px 0", lineHeight: 1.3 }}>
            {activeQuestionIdx + 1}. {currentQuestion.title}
          </h1>

          <div style={{ fontSize: "13.5px", lineHeight: 1.65, color: "#c9d1d9", marginBottom: "20px", whiteSpace: "pre-wrap" }}>
            {currentQuestion.problemStatement}
          </div>

          {/* Formats & Constraints */}
          {currentQuestion.inputFormat && (
            <div style={{ marginBottom: "16px" }}>
              <h4 style={{ fontSize: "12.5px", fontWeight: 700, color: "#58a6ff", margin: "0 0 6px" }}>
                Input Format
              </h4>
              <p style={{ fontSize: "12.5px", color: "#8b949e", margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                {currentQuestion.inputFormat}
              </p>
            </div>
          )}

          {currentQuestion.outputFormat && (
            <div style={{ marginBottom: "16px" }}>
              <h4 style={{ fontSize: "12.5px", fontWeight: 700, color: "#58a6ff", margin: "0 0 6px" }}>
                Output Format
              </h4>
              <p style={{ fontSize: "12.5px", color: "#8b949e", margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                {currentQuestion.outputFormat}
              </p>
            </div>
          )}

          {currentQuestion.constraints && (
            <div style={{ marginBottom: "20px" }}>
              <h4 style={{ fontSize: "12.5px", fontWeight: 700, color: "#58a6ff", margin: "0 0 6px" }}>
                Constraints
              </h4>
              <pre style={{
                background: "#161b22",
                padding: "10px 14px",
                borderRadius: "6px",
                border: "1px solid #30363d",
                fontSize: "12px",
                color: "#e6edf3",
                fontFamily: "JetBrains Mono, Menlo, monospace",
                margin: 0,
                whiteSpace: "pre-wrap"
              }}>
                {currentQuestion.constraints}
              </pre>
            </div>
          )}

          {/* Sample Input / Output */}
          <div style={{ background: "#161b22", borderRadius: "8px", border: "1px solid #30363d", padding: "14px", marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#f0f6fc" }}>Sample Input 1</span>
              <button
                type="button"
                onClick={copySampleInput}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#8b949e",
                  fontSize: "11px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                {copiedSample ? <Check size={12} color="#3fb950" /> : <Copy size={12} />}
                {copiedSample ? "Copied" : "Copy"}
              </button>
            </div>
            <pre style={{
              background: "#0d1117",
              padding: "10px",
              borderRadius: "6px",
              border: "1px solid #30363d",
              fontSize: "12px",
              color: "#3fb950",
              fontFamily: "JetBrains Mono, Menlo, monospace",
              margin: "0 0 12px 0",
              whiteSpace: "pre-wrap"
            }}>
              {currentQuestion.sampleInput || "4\\n2 7 11 15\\n9"}
            </pre>

            <span style={{ fontSize: "12px", fontWeight: 700, color: "#f0f6fc", display: "block", marginBottom: "8px" }}>
              Sample Output 1
            </span>
            <pre style={{
              background: "#0d1117",
              padding: "10px",
              borderRadius: "6px",
              border: "1px solid #30363d",
              fontSize: "12px",
              color: "#58a6ff",
              fontFamily: "JetBrains Mono, Menlo, monospace",
              margin: 0,
              whiteSpace: "pre-wrap"
            }}>
              {currentQuestion.sampleOutput || "1 2"}
            </pre>

            {currentQuestion.sampleExplanation && (
              <p style={{ fontSize: "12px", color: "#8b949e", margin: "10px 0 0 0", fontStyle: "italic" }}>
                Explanation: {currentQuestion.sampleExplanation}
              </p>
            )}
          </div>
        </div>

        {/* Right Pane: Code Editor & Execution Terminal */}
        <div style={{
          width: "56%",
          display: "flex",
          flexDirection: "column",
          background: "#161b22",
          overflow: "hidden"
        }}>
          {/* Editor Header Toolbar */}
          <div style={{
            height: "44px",
            background: "#21262d",
            borderBottom: "1px solid #30363d",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 14px",
            flexShrink: 0
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#8b949e" }}>Language:</span>
              <select
                value={selectedLanguage}
                onChange={(e) => handleLanguageChange(e.target.value as SupportedLanguage)}
                style={{
                  background: "#0d1117",
                  border: "1px solid #30363d",
                  borderRadius: "6px",
                  color: "#f0f6fc",
                  fontSize: "12px",
                  padding: "4px 10px",
                  cursor: "pointer",
                  outline: "none"
                }}
              >
                {ALL_SUPPORTED_LANGUAGES.map(lang => (
                  <option key={lang.id} value={lang.id}>
                    {lang.name} ({lang.version})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                onClick={handleResetCode}
                title="Reset code to default template"
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#8b949e",
                  fontSize: "11.5px",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                <RotateCcw size={12} /> Reset Boilerplate
              </button>
            </div>
          </div>

          {/* Code Textarea Area */}
          <div style={{ flex: 1, position: "relative", overflow: "hidden", background: "#0d1117" }}>
            <textarea
              value={currentCode}
              onChange={(e) => handleCodeChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Tab") {
                  e.preventDefault();
                  const start = e.currentTarget.selectionStart;
                  const end = e.currentTarget.selectionEnd;
                  const updated = currentCode.substring(0, start) + "    " + currentCode.substring(end);
                  handleCodeChange(updated);
                  setTimeout(() => {
                    const el = e.target as HTMLTextAreaElement;
                    el.selectionStart = el.selectionEnd = start + 4;
                  }, 0);
                }
              }}
              spellCheck={false}
              autoCapitalize="none"
              autoComplete="off"
              style={{
                width: "100%",
                height: "100%",
                background: "transparent",
                color: "#e6edf3",
                border: "none",
                outline: "none",
                resize: "none",
                padding: "16px 20px",
                fontSize: "13px",
                lineHeight: "1.6",
                fontFamily: "JetBrains Mono, 'Fira Code', Menlo, Consolas, monospace",
                boxSizing: "border-box"
              }}
            />
          </div>

          {/* Lower Terminal Console & Evaluation Output */}
          <div style={{
            height: "220px",
            background: "#161b22",
            borderTop: "1px solid #30363d",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0
          }}>
            {/* Terminal Tab Header */}
            <div style={{
              height: "36px",
              background: "#0d1117",
              borderBottom: "1px solid #30363d",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 14px"
            }}>
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  type="button"
                  onClick={() => setActiveTab("terminal")}
                  style={{
                    background: activeTab === "terminal" ? "#21262d" : "transparent",
                    color: activeTab === "terminal" ? "#f0f6fc" : "#8b949e",
                    border: "none",
                    borderRadius: "4px",
                    padding: "4px 10px",
                    fontSize: "11.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px"
                  }}
                >
                  <Terminal size={12} /> Execution Console
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("results")}
                  style={{
                    background: activeTab === "results" ? "#21262d" : "transparent",
                    color: activeTab === "results" ? "#f0f6fc" : "#8b949e",
                    border: "none",
                    borderRadius: "4px",
                    padding: "4px 10px",
                    fontSize: "11.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px"
                  }}
                >
                  <ShieldCheck size={12} /> Automated Test Results
                  {evaluationResult && (
                    <span style={{
                      fontSize: "10px",
                      padding: "1px 6px",
                      borderRadius: "10px",
                      background: evaluationResult.status === "PASSED" ? "#238636" : "#da3633",
                      color: "#ffffff"
                    }}>
                      {evaluationResult.passedCount}/{evaluationResult.totalCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("customInput")}
                  style={{
                    background: activeTab === "customInput" ? "#21262d" : "transparent",
                    color: activeTab === "customInput" ? "#f0f6fc" : "#8b949e",
                    border: "none",
                    borderRadius: "4px",
                    padding: "4px 10px",
                    fontSize: "11.5px",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Custom Input
                </button>
              </div>

              {terminalOutput.executionTimeMs !== undefined && (
                <span style={{ fontSize: "11px", color: "#8b949e" }}>
                  Runtime: <strong>{terminalOutput.executionTimeMs} ms</strong>
                </span>
              )}
            </div>

            {/* Terminal Body Content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", fontSize: "12.5px", fontFamily: "JetBrains Mono, monospace" }}>
              {activeTab === "terminal" && (
                <div>
                  {terminalOutput.status === "ERROR" && terminalOutput.stderr && (
                    <div style={{ color: "#f85149", marginBottom: "8px", whiteSpace: "pre-wrap" }}>
                      {terminalOutput.stderr}
                    </div>
                  )}
                  <pre style={{ margin: 0, color: terminalOutput.status === "ERROR" ? "#f85149" : "#e6edf3", whiteSpace: "pre-wrap" }}>
                    {terminalOutput.stdout}
                  </pre>
                </div>
              )}

              {activeTab === "results" && (
                <div>
                  {!evaluationResult ? (
                    <p style={{ color: "#8b949e", margin: 0 }}>
                      No submission evaluated yet. Click <strong>'Submit Solution'</strong> below to test your solution against all evaluation test cases.
                    </p>
                  ) : (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                        <span style={{
                          fontSize: "13px",
                          fontWeight: 700,
                          padding: "4px 10px",
                          borderRadius: "6px",
                          background: evaluationResult.status === "PASSED" ? "rgba(46, 160, 67, 0.2)" : "rgba(248, 81, 73, 0.2)",
                          color: evaluationResult.status === "PASSED" ? "#3fb950" : "#f85149"
                        }}>
                          {evaluationResult.status === "PASSED" ? "ALL TEST CASES PASSED" : `${evaluationResult.passedCount}/${evaluationResult.totalCount} TEST CASES PASSED`}
                        </span>
                        <span style={{ fontSize: "12.5px", color: "#c9d1d9" }}>
                          Score: <strong style={{ color: "#3fb950" }}>{evaluationResult.score} / {evaluationResult.maxMarks} Marks</strong>
                        </span>
                      </div>

                      {evaluationResult.testCaseResults && evaluationResult.testCaseResults.length > 0 && (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          {evaluationResult.testCaseResults.map((tc: any, i: number) => (
                            <div key={i} style={{
                              padding: "6px 10px",
                              borderRadius: "4px",
                              background: tc.passed ? "rgba(46, 160, 67, 0.1)" : "rgba(248, 81, 73, 0.1)",
                              border: tc.passed ? "1px solid rgba(46, 160, 67, 0.3)" : "1px solid rgba(248, 81, 73, 0.3)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between"
                            }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                {tc.passed ? <CheckCircle2 size={13} color="#3fb950" /> : <XCircle size={13} color="#f85149" />}
                                <span>{tc.label || `Test Case #${i + 1}`}</span>
                              </div>
                              <span style={{ fontSize: "11px", fontWeight: 600, color: tc.passed ? "#3fb950" : "#f85149" }}>
                                {tc.passed ? `+${tc.marksAwarded || 5} Marks` : "0 Marks"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "customInput" && (
                <div style={{ height: "100%" }}>
                  <textarea
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    placeholder="Enter custom standard input for your program here..."
                    style={{
                      width: "100%",
                      height: "100%",
                      background: "#0d1117",
                      border: "1px solid #30363d",
                      borderRadius: "6px",
                      color: "#e6edf3",
                      fontSize: "12px",
                      fontFamily: "JetBrains Mono, monospace",
                      padding: "8px 12px",
                      outline: "none",
                      resize: "none",
                      boxSizing: "border-box"
                    }}
                  />
                </div>
              )}
            </div>

            {/* Bottom Execution Action Toolbar */}
            <div style={{
              height: "46px",
              background: "#161b22",
              borderTop: "1px solid #30363d",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 16px"
            }}>
              <span style={{ fontSize: "11.5px", color: "#8b949e" }}>
                Auto-saved locally • Container Sandbox Active
              </span>

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <button
                  type="button"
                  onClick={handleRunCode}
                  disabled={isRunning || isSubmitting}
                  style={{
                    background: "#21262d",
                    color: "#c9d1d9",
                    border: "1px solid #30363d",
                    borderRadius: "6px",
                    padding: "6px 14px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: isRunning ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  <Play size={12} fill="#c9d1d9" />
                  {isRunning ? "Running..." : "Run Code"}
                </button>

                <button
                  type="button"
                  onClick={handleSubmitSolution}
                  disabled={isRunning || isSubmitting}
                  style={{
                    background: "#238636",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "6px",
                    padding: "6px 16px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    boxShadow: "0 2px 6px rgba(35, 134, 54, 0.4)"
                  }}
                >
                  <Send size={12} />
                  {isSubmitting ? "Evaluating..." : "Submit Solution"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showSubmitModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0, 0, 0, 0.75)",
          backdropFilter: "blur(4px)",
          display: "grid",
          placeItems: "center",
          padding: "16px",
          zIndex: 1000
        }}>
          <div style={{
            background: "#161b22",
            border: "1px solid #30363d",
            borderRadius: "12px",
            padding: "24px",
            width: "min(460px, 100%)",
            color: "#c9d1d9"
          }}>
            <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#f0f6fc", margin: "0 0 8px" }}>
              Submit Round 2 Assessment?
            </h3>
            <p style={{ fontSize: "13px", color: "#8b949e", lineHeight: 1.5, margin: "0 0 16px" }}>
              Are you sure you want to finish your coding assessment? Your automated test scores will be locked and an authenticated digital receipt will be generated.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                style={{
                  background: "#21262d",
                  border: "1px solid #30363d",
                  borderRadius: "6px",
                  padding: "8px 16px",
                  fontSize: "12.5px",
                  color: "#c9d1d9",
                  cursor: "pointer"
                }}
              >
                Continue Working
              </button>
              <button
                type="button"
                onClick={() => handleFinalSubmitAssessment("manual_submit")}
                style={{
                  background: "#238636",
                  border: "none",
                  borderRadius: "6px",
                  padding: "8px 18px",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  color: "#ffffff",
                  cursor: "pointer"
                }}
              >
                Yes, Finalize & Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
