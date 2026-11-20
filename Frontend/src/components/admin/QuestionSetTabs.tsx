import { Layers, CheckCircle2, AlertTriangle, FileKey } from "lucide-react";
import type { QuestionSetKey, QuestionSetSummary } from "../../types/adminExam";

interface QuestionSetTabsProps {
  activeSet: QuestionSetKey;
  onSelectSet: (setKey: QuestionSetKey) => void;
  summaries: Record<QuestionSetKey, QuestionSetSummary>;
  targetQuestionCount?: number;
}

export default function QuestionSetTabs({
  activeSet,
  onSelectSet,
  summaries,
  targetQuestionCount
}: QuestionSetTabsProps) {
  const sets: QuestionSetKey[] = ["SET_A", "SET_B", "SET_C", "SET_D"];

  return (
    <div className="question-set-tabs-wrapper" style={{ marginBottom: "16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Layers size={16} color="#017846" />
          <strong style={{ fontSize: "13px", color: "#0f172a" }}>Four Authorized Exam Sets (A / B / C / D)</strong>
        </div>
        <small style={{ color: "#64748b" }}>
          {targetQuestionCount ? `Blueprint Target: ${targetQuestionCount} MCQs per set` : "Select a set to manage its questions"}
        </small>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
        {sets.map((setKey) => {
          const s = summaries[setKey];
          const isSelected = activeSet === setKey;
          const hasIncomplete = s.incompleteQuestionsCount > 0;

          return (
            <button
              key={setKey}
              type="button"
              onClick={() => onSelectSet(setKey)}
              style={{
                background: isSelected ? "#017846" : "#ffffff",
                color: isSelected ? "#ffffff" : "#0f172a",
                border: `1.5px solid ${isSelected ? "#017846" : "#cbd5e1"}`,
                borderRadius: "8px",
                padding: "10px 12px",
                textAlign: "left",
                cursor: "pointer",
                transition: "all 0.15s ease",
                boxShadow: isSelected ? "0 4px 12px rgba(1, 120, 70, 0.25)" : "none"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <strong style={{ fontSize: "13px" }}>{s.title}</strong>
                {s.answerKeyStatus === "VALIDATED" ? (
                  <span title="Answer Key Validated" style={{ color: isSelected ? "#a7f3d0" : "#16a34a" }}>
                    <CheckCircle2 size={14} />
                  </span>
                ) : (
                  <span title="Answer Key Pending" style={{ color: isSelected ? "#fef08a" : "#d97706" }}>
                    <FileKey size={14} />
                  </span>
                )}
              </div>

              <div style={{ fontSize: "11px", opacity: isSelected ? 0.9 : 0.75, display: "flex", justifyContent: "space-between" }}>
                <span>{s.validQuestionsCount} Questions</span>
                <span>{s.totalMarks} Marks</span>
              </div>

              {hasIncomplete && (
                <div style={{ 
                  marginTop: "4px", 
                  fontSize: "9px", 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "3px", 
                  color: isSelected ? "#fee2e2" : "#dc2626",
                  fontWeight: 600
                }}>
                  <AlertTriangle size={11} /> {s.incompleteQuestionsCount} incomplete
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
