import React from "react";
import { AlertTriangle, ChevronRight } from "lucide-react";

interface SubmitConfirmationDialogProps {
  total: number;
  answeredCount: number;
  flaggedCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function SubmitConfirmationDialog({
  total,
  answeredCount,
  flaggedCount,
  onCancel,
  onConfirm
}: SubmitConfirmationDialogProps) {
  const unansweredCount = Math.max(0, total - answeredCount);

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
      <section className="modal">
        <div className="modalicon">
          <AlertTriangle size={24} />
        </div>
        <h2 id="submit-modal-title">Submit your assessment?</h2>
        <p>
          You have answered <strong>{answeredCount}</strong> of <strong>{total}</strong> questions
          and flagged <strong>{flaggedCount}</strong> for review.
          {unansweredCount > 0 && (
            <span style={{ display: "block", marginTop: "6px", color: "#b45309" }}>
              Note: You still have {unansweredCount} unanswered {unansweredCount === 1 ? "question" : "questions"}.
            </span>
          )}
        </p>
        <p style={{ marginTop: "6px" }}>
          Once submitted, your responses will be locked and you cannot return to this examination.
        </p>
        <div className="modalactions">
          <button type="button" className="secondary" onClick={onCancel}>
            Continue exam
          </button>
          <button type="button" className="primary" onClick={onConfirm}>
            Confirm submission <ChevronRight size={16} />
          </button>
        </div>
        <small>DEMO SESSION ┬╖ Saved to local session storage only</small>
      </section>
    </div>
  );
}
