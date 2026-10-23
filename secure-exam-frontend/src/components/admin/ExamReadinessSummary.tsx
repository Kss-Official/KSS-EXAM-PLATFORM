import { ShieldCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { ExamTimingMode, QuestionSetKey, QuestionSetSummary } from "../../types/adminExam";

interface ExamReadinessSummaryProps {
  title: string;
  timingMode: ExamTimingMode;
  durationMinutes: string;
  examDate: string;
  startTime: string;
  totalQuestions: string;
  totalMarks: string;
  marksPerCorrect: string;
  negativeMarking: string;
  candidateAssignment: "ALL" | "BATCH" | "MANUAL";
  setSummaries: Record<QuestionSetKey, QuestionSetSummary>;
}

export default function ExamReadinessSummary({
  title,
  timingMode,
  durationMinutes,
  examDate,
  startTime,
  totalQuestions,
  totalMarks,
  marksPerCorrect,
  negativeMarking,
  candidateAssignment,
  setSummaries
}: ExamReadinessSummaryProps) {
  const targetQ = parseInt(totalQuestions, 10) || 0;
  const targetM = parseFloat(totalMarks) || 0;
  const mpc = parseFloat(marksPerCorrect) || 0;

  // Determine readiness flags
  const warnings: string[] = [];
  if (!title.trim()) warnings.push("Examination title is missing.");
  if (timingMode === "SCHEDULED" && !startTime) warnings.push("Scheduled start time is not configured.");
  if (!durationMinutes || parseInt(durationMinutes, 10) < 5) warnings.push("Exam duration is invalid.");

  const sets: QuestionSetKey[] = ["SET_A", "SET_B", "SET_C", "SET_D"];
  let allSetsHaveQuestions = true;
  let allSetsHaveAnswerKeys = true;

  sets.forEach((key) => {
    const s = setSummaries[key];
    if (s.validQuestionsCount === 0) {
      allSetsHaveQuestions = false;
      warnings.push(`${s.title} has no valid questions configured.`);
    }
    if (s.answerKeyStatus !== "VALIDATED") {
      allSetsHaveAnswerKeys = false;
      warnings.push(`${s.title} requires an authorized and validated answer key.`);
    }
  });

  // Calculate consistency check
  const calculatedTotal = targetQ * mpc;
  const hasMarksInconsistency = targetQ > 0 && mpc > 0 && targetM > 0 && calculatedTotal !== targetM;
  if (hasMarksInconsistency) {
    warnings.push(`Marks mismatch: ${targetQ} questions × ${mpc} marks = ${calculatedTotal} total marks (entered: ${targetM}).`);
  }

  // Determine overall blueprint readiness status
  let readinessStatus: "Draft" | "Needs Schedule" | "Needs Questions" | "Needs Answer Key" | "Ready for Backend Integration" = "Draft";
  if (timingMode === "SCHEDULED" && !startTime) {
    readinessStatus = "Needs Schedule";
  } else if (!allSetsHaveQuestions) {
    readinessStatus = "Needs Questions";
  } else if (!allSetsHaveAnswerKeys) {
    readinessStatus = "Needs Answer Key";
  } else if (warnings.length === 0) {
    readinessStatus = "Ready for Backend Integration";
  }

  const getStatusColor = (st: typeof readinessStatus) => {
    switch (st) {
      case "Ready for Backend Integration":
        return { bg: "#dcfce7", color: "#166534", border: "#86efac" };
      case "Needs Questions":
      case "Needs Answer Key":
      case "Needs Schedule":
        return { bg: "#fff7ed", color: "#9a3412", border: "#fed7aa" };
      default:
        return { bg: "#f1f5f9", color: "#475569", border: "#cbd5e1" };
    }
  };

  const statusStyle = getStatusColor(readinessStatus);

  return (
    <div className="exam-readiness-summary-card" style={{ 
      background: "#ffffff", 
      border: "1px solid #e2e8f0", 
      borderRadius: "10px", 
      padding: "16px",
      marginBottom: "20px"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <ShieldCheck size={18} color="#017846" />
          <strong style={{ fontSize: "14px", color: "#0f172a" }}>Exam Blueprint & Readiness Summary</strong>
        </div>

        <span style={{ 
          fontSize: "11px", 
          fontWeight: 700, 
          padding: "4px 10px", 
          borderRadius: "999px",
          background: statusStyle.bg,
          color: statusStyle.color,
          border: `1px solid ${statusStyle.border}`
        }}>
          Status: {readinessStatus}
        </span>
      </div>

      {/* Grid Summary */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(4, 1fr)", 
        gap: "10px", 
        background: "#f8fafc", 
        padding: "12px", 
        borderRadius: "8px", 
        fontSize: "11.5px",
        marginBottom: "12px"
      }}>
        <div>
          <span style={{ color: "#64748b", display: "block" }}>Timing Mode</span>
          <b>{timingMode === "SCHEDULED" ? "Scheduled Start" : "Candidate Starts Anytime"}</b>
        </div>
        <div>
          <span style={{ color: "#64748b", display: "block" }}>Duration & Date</span>
          <b>{durationMinutes || 60}m · {examDate}</b>
        </div>
        <div>
          <span style={{ color: "#64748b", display: "block" }}>Marking Scheme</span>
          <b>+{marksPerCorrect || 1} / -{negativeMarking || 0}</b>
        </div>
        <div>
          <span style={{ color: "#64748b", display: "block" }}>Candidate Target</span>
          <b>{candidateAssignment === "ALL" ? "All Cohort (~800)" : candidateAssignment}</b>
        </div>
      </div>

      {/* Sets Breakdown */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px", flexWrap: "wrap" }}>
        {sets.map(key => {
          const s = setSummaries[key];
          return (
            <div key={key} style={{ 
              flex: 1, 
              minWidth: "120px", 
              background: "#ffffff", 
              border: "1px solid #cbd5e1", 
              borderRadius: "6px", 
              padding: "6px 8px", 
              fontSize: "10.5px" 
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, color: "#0f172a" }}>
                <span>{s.title}</span>
                <span style={{ color: s.hasAnswerKey ? "#16a34a" : "#ea580c" }}>
                  {s.hasAnswerKey ? "Key Validated" : "Key Pending"}
                </span>
              </div>
              <div style={{ color: "#64748b", marginTop: "2px" }}>
                {s.validQuestionsCount} questions · {s.totalMarks} marks
              </div>
            </div>
          );
        })}
      </div>

      {/* Warnings & Integrity Feedback */}
      {warnings.length > 0 ? (
        <div style={{ background: "#fffbeb", border: "1px solid #fef3c7", padding: "8px 12px", borderRadius: "6px", fontSize: "11px", color: "#92400e" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", fontWeight: 700, marginBottom: "3px" }}>
            <AlertTriangle size={13} color="#d97706" /> Blueprint Checklist Items:
          </div>
          <ul style={{ margin: 0, paddingLeft: "16px" }}>
            {warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "8px 12px", borderRadius: "6px", fontSize: "11px", color: "#166534" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px", fontWeight: 700 }}>
            <CheckCircle2 size={13} color="#16a34a" /> Blueprint is fully validated across all 4 sets and ready for backend persistence.
          </div>
        </div>
      )}
    </div>
  );
}
