import React from "react";
import { AlertTriangle, ChevronRight, Flag, CheckCircle2, ArrowRight } from "lucide-react";

interface SubmitConfirmationDialogProps {
  total: number;
  answeredCount: number;
  flaggedCount?: number;
  flaggedQuestions?: number[];
  unansweredQuestions?: number[];
  onCancel: () => void;
  onConfirm: () => void;
  onJumpToQuestion?: (questionNum: number) => void;
}

export default function SubmitConfirmationDialog({
  total,
  answeredCount,
  flaggedCount,
  flaggedQuestions = [],
  unansweredQuestions = [],
  onCancel,
  onConfirm,
  onJumpToQuestion
}: SubmitConfirmationDialogProps) {
  const effectiveUnanswered = unansweredQuestions.length > 0 
    ? unansweredQuestions 
    : Array.from({ length: Math.max(0, total - answeredCount) }, (_, i) => i + 1);

  const effectiveFlagged = flaggedQuestions;
  const unansweredCount = effectiveUnanswered.length;
  const flagCount = effectiveFlagged.length > 0 ? effectiveFlagged.length : (flaggedCount ?? 0);

  return (
    <div
      className="backdrop"
      onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="submit-modal-title"
    >
      <section 
        className="modal" 
        style={{ 
          width: "min(560px, 95vw)", 
          maxWidth: "560px", 
          maxHeight: "90vh", 
          overflowY: "auto", 
          padding: "24px 26px" 
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
          <div className="modalicon" style={{ flexShrink: 0 }}>
            <AlertTriangle size={22} />
          </div>
          <div>
            <h2 id="submit-modal-title" style={{ margin: 0, fontSize: "18px", color: "#0f172a" }}>
              Submit your assessment?
            </h2>
            <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
              Please review your progress before final submission.
            </p>
          </div>
        </div>

        {/* 3-Card Summary Overview */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", margin: "14px 0" }}>
          <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "10px 12px", textAlign: "center" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#166534", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Answered
            </div>
            <div style={{ fontSize: "18px", fontWeight: 800, color: "#15803d", marginTop: "2px" }}>
              {answeredCount} <span style={{ fontSize: "12px", fontWeight: 500, color: "#166534" }}>/ {total}</span>
            </div>
          </div>

          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "10px", padding: "10px 12px", textAlign: "center" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Flagged
            </div>
            <div style={{ fontSize: "18px", fontWeight: 800, color: "#b45309", marginTop: "2px" }}>
              {flagCount}
            </div>
          </div>

          <div style={{ background: "#fff1f2", border: "1px solid #fecdd3", borderRadius: "10px", padding: "10px 12px", textAlign: "center" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#9f1239", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Unanswered
            </div>
            <div style={{ fontSize: "18px", fontWeight: 800, color: "#be123c", marginTop: "2px" }}>
              {unansweredCount}
            </div>
          </div>
        </div>

        {/* Flagged Questions List */}
        {effectiveFlagged.length > 0 && (
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "12px", padding: "12px 14px", marginTop: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, fontSize: "12.5px", color: "#92400e" }}>
                <Flag size={14} color="#d97706" />
                <span>Flagged Questions for Review ({effectiveFlagged.length})</span>
              </div>
              {onJumpToQuestion && (
                <span style={{ fontSize: "11px", color: "#b45309", fontStyle: "italic" }}>
                  Click to jump & review
                </span>
              )}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", maxHeight: "100px", overflowY: "auto", paddingRight: "4px" }}>
              {effectiveFlagged.map((qNum) => (
                <button
                  key={qNum}
                  type="button"
                  onClick={() => onJumpToQuestion?.(qNum)}
                  title={`Click to review Question ${qNum}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "4px 9px",
                    borderRadius: "6px",
                    border: "1px solid #fcd34d",
                    backgroundColor: "#fef3c7",
                    color: "#92400e",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: onJumpToQuestion ? "pointer" : "default",
                    transition: "all 0.15s ease"
                  }}
                >
                  <Flag size={11} color="#d97706" />
                  <span>Q{qNum}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Unanswered Questions List */}
        {unansweredCount > 0 && (
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "12px 14px", marginTop: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, fontSize: "12.5px", color: "#334155" }}>
                <AlertTriangle size={14} color="#e11d48" />
                <span>Unanswered Questions ({unansweredCount})</span>
              </div>
              {onJumpToQuestion && (
                <span style={{ fontSize: "11px", color: "#64748b", fontStyle: "italic" }}>
                  Click to jump & answer
                </span>
              )}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", maxHeight: "110px", overflowY: "auto", paddingRight: "4px" }}>
              {effectiveUnanswered.map((qNum) => (
                <button
                  key={qNum}
                  type="button"
                  onClick={() => onJumpToQuestion?.(qNum)}
                  title={`Click to answer Question ${qNum}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: "34px",
                    padding: "4px 8px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    color: "#334155",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: onJumpToQuestion ? "pointer" : "default",
                    transition: "all 0.15s ease"
                  }}
                >
                  Q{qNum}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* All Answered & None Flagged Banner */}
        {effectiveFlagged.length === 0 && unansweredCount === 0 && (
          <div style={{ 
            background: "#ecfdf5", 
            border: "1px solid #a7f3d0", 
            borderRadius: "12px", 
            padding: "12px 14px", 
            marginTop: "12px", 
            display: "flex", 
            alignItems: "center", 
            gap: "8px", 
            color: "#065f46", 
            fontSize: "12.5px", 
            fontWeight: 600 
          }}>
            <CheckCircle2 size={18} color="#059669" />
            <span>Great job! You have answered all {total} questions and have no pending flagged questions.</span>
          </div>
        )}

        {/* Final Warning Callout */}
        <div style={{ 
          marginTop: "14px", 
          padding: "10px 12px", 
          borderRadius: "8px", 
          background: "#fff1f2", 
          border: "1px solid #fecdd3", 
          fontSize: "11.5px", 
          color: "#9f1239", 
          lineHeight: 1.5 
        }}>
          <strong>Final Notice:</strong> Once submitted, your responses will be permanently locked and you cannot return to this examination.
        </div>

        {/* Modal Actions */}
        <div className="modalactions" style={{ marginTop: "18px" }}>
          <button 
            type="button" 
            className="secondary" 
            onClick={onCancel}
            style={{ cursor: "pointer", fontWeight: 600 }}
          >
            Return to Exam
          </button>
          <button 
            type="button" 
            className="primary" 
            onClick={onConfirm}
            style={{ 
              cursor: "pointer", 
              fontWeight: 700, 
              display: "inline-flex", 
              alignItems: "center", 
              justifyContent: "center", 
              gap: "6px",
              background: "#017846"
            }}
          >
            Confirm & Submit <ChevronRight size={16} />
          </button>
        </div>
      </section>
    </div>
  );
}
