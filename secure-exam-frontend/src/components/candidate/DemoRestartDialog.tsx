import React from "react";
import { RotateCcw } from "lucide-react";

interface DemoRestartDialogProps {
  onCancel: () => void;
  onConfirmRestart: () => void;
}

export default function DemoRestartDialog({
  onCancel,
  onConfirmRestart
}: DemoRestartDialogProps) {
  return (
    <div
      className="backdrop"
      onMouseDown={(e: React.MouseEvent<HTMLDivElement>) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="restart-modal-title"
    >
      <section className="modal">
        <div className="modalicon" style={{ background: "#e0f2fe", color: "#0284c7" }}>
          <RotateCcw size={24} />
        </div>
        <h2 id="restart-modal-title">Restart Demo Examination?</h2>
        <p>
          This action will clear your locally stored candidate session, answers, and demo receipt, allowing you to test the candidate flow from the beginning.
        </p>
        <div className="modalactions">
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="primary"
            onClick={onConfirmRestart}
          >
            Confirm & Start Fresh
          </button>
        </div>
        <small>Clears localStorage entry for secureexam:candidate-session:v1</small>
      </section>
    </div>
  );
}
