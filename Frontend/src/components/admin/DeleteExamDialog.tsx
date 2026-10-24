import { Trash2, AlertTriangle, X } from "lucide-react";
import type { Exam } from "../../types";

interface DeleteExamDialogProps {
  exam: Exam;
  onCancel: () => void;
  onConfirmDelete: (examId: string) => void;
}

export default function DeleteExamDialog({
  exam,
  onCancel,
  onConfirmDelete
}: DeleteExamDialogProps) {
  return (
    <div className="admin-modal-backdrop" onClick={onCancel}>
      <div 
        className="admin-modal-box" 
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: "480px" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-exam-title"
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ 
              width: "36px", 
              height: "36px", 
              borderRadius: "10px", 
              background: "#fee2e2", 
              color: "#dc2626", 
              display: "grid", 
              placeItems: "center" 
            }}>
              <Trash2 size={18} />
            </div>
            <div>
              <h3 id="delete-exam-title" style={{ margin: 0, fontSize: "16px", color: "#0f172a" }}>
                Confirm Examination Deletion
              </h3>
              <small style={{ color: "#64748b" }}>ID: {exam.id}</small>
            </div>
          </div>
          <button 
            type="button" 
            className="secondary" 
            style={{ padding: "4px 6px" }} 
            onClick={onCancel}
          >
            <X size={15} />
          </button>
        </div>

        <p style={{ fontSize: "13px", color: "#334155", lineHeight: 1.5, margin: "0 0 12px" }}>
          Are you sure you want to delete the examination blueprint for <strong>"{exam.title}"</strong>?
        </p>

        <div className="pending-impl-notice" style={{ margin: "0 0 16px 0", background: "#fff7ed", borderColor: "#fed7aa" }}>
          <AlertTriangle size={16} color="#ea580c" style={{ flexShrink: 0, marginTop: "2px" }} />
          <div style={{ fontSize: "11px", color: "#9a3412" }}>
            <strong>Database Deletion Notice:</strong>
            <br />
            This will permanently remove the exam blueprint, all associated question sets, and all randomized questions from the PostgreSQL database.
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
          <button 
            type="button" 
            className="secondary" 
            onClick={onCancel}
          >
            Cancel
          </button>
          <button 
            type="button" 
            className="primary" 
            style={{ background: "#dc2626", borderColor: "#dc2626" }}
            onClick={() => onConfirmDelete(exam.id)}
          >
            <Trash2 size={14} /> Confirm Delete (Local Demo)
          </button>
        </div>
      </div>
    </div>
  );
}
