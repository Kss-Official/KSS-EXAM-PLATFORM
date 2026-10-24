import React from "react";
import { LogOut, AlertOctagon } from "lucide-react";

interface ExitConfirmationDialogProps {
  answeredCount: number;
  total: number;
  onCancel: () => void;
  onConfirmExit: () => void;
}

export default function ExitConfirmationDialog({
  answeredCount,
  total,
  onCancel,
  onConfirmExit
}: ExitConfirmationDialogProps) {
  return (
    <div
      className="backdrop"
      onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-modal-title"
    >
      <section className="modal">
        <div className="modalicon" style={{ background: "#fee2e2", color: "#dc2626" }}>
          <AlertOctagon size={24} />
        </div>
        <h2 id="exit-modal-title">Exit and Finalize Examination?</h2>
        <p>
          Leaving the examination will <strong>finalize your current attempt immediately</strong>.
        </p>
        <p style={{ marginTop: "6px" }}>
          Your <strong>{answeredCount}</strong> answered questions (out of {total}) will be retained locally and submitted. You will not be able to return or edit answers after exiting.
        </p>
        <div className="modalactions">
          <button type="button" className="secondary" onClick={onCancel}>
            Return to Exam
          </button>
          <button
            type="button"
            className="primary"
            style={{ background: "#dc2626", borderColor: "#dc2626" }}
            onClick={onConfirmExit}
          >
            <LogOut size={15} /> Exit & Finalize Attempt
          </button>
        </div>
        <small>Answers will be retained locally. Forced exit marks the attempt as submitted.</small>
      </section>
    </div>
  );
}
