import { useState, useEffect } from "react";
import { 
  PlusCircle, 
  Search, 
  Eye, 
  Trash2, 
  BookOpen, 
  BarChart2, 
  CheckCircle, 
  Clock, 
  RotateCcw,
  X
} from "lucide-react";
import { useRouter } from "../../router";
import { getAllExams, activateExam, deactivateExam, deleteExam, ApiError, type ExamDto } from "../../services/api";

export default function ExamsPage() {
  const { navigate } = useRouter();

  const [exams, setExams] = useState<ExamDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExam, setSelectedExam] = useState<ExamDto | null>(null);
  const [examToDelete, setExamToDelete] = useState<ExamDto | null>(null);
  const [deleteNeedsForce, setDeleteNeedsForce] = useState(false);
  const [deleteWarningMsg, setDeleteWarningMsg] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Search & Status Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fetchExams = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllExams();
      setExams(data);
    } catch (err: unknown) {
      const errorObj = err as Error;
      setError(errorObj.message || "Failed to load examinations from backend");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
  }, []);

  const isExamActive = (st: string) => st === "ACTIVATED" || st === "PUBLISHED";

  const handleActivate = async (examId: number) => {
    setActionNotice(null);
    try {
      const updated = await activateExam(examId);
      // Enforce Single Active Exam in state: only this exam is ACTIVATED, all others become DEACTIVATED
      setExams(prev => prev.map(e => e.id === examId ? { ...updated, status: "ACTIVATED" } : { ...e, status: "DEACTIVATED" }));
      setActionNotice(`Examination "${updated.title}" is now ACTIVATED! (All other exams are deactivated). Live for candidates.`);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setActionNotice(`Cannot activate examination: ${err.message}`);
      } else {
        const errorObj = err as Error;
        setActionNotice(`Activation failed: ${errorObj.message}`);
      }
    }
  };

  const handleDeactivate = async (examId: number) => {
    setActionNotice(null);
    try {
      const updated = await deactivateExam(examId);
      setExams(prev => prev.map(e => e.id === examId ? { ...e, status: "DEACTIVATED" } : e));
      setActionNotice(`Examination "${updated.title}" status changed to DEACTIVATED.`);
    } catch (err: unknown) {
      const errorObj = err as Error;
      setActionNotice(`Could not deactivate exam: ${errorObj.message}`);
    }
  };

  const handleDeleteConfirm = async (force: boolean = false) => {
    if (!examToDelete || isDeleting) return;
    setIsDeleting(true);
    setActionNotice(null);
    try {
      const res = await deleteExam(examToDelete.id, force);
      setExams(prev => prev.filter(e => e.id !== examToDelete.id));
      setActionNotice(res.message || `Examination "${examToDelete.title}" deleted.`);
      setExamToDelete(null);
      setDeleteNeedsForce(false);
      setDeleteWarningMsg(null);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        setDeleteNeedsForce(true);
        const cleanMsg = (err.message || "").replace(/^Backend error 409:\s*/i, "");
        setDeleteWarningMsg(cleanMsg || "This examination has recorded candidate attempts. Deleting will permanently remove all candidate records.");
      } else {
        const errorObj = err as Error;
        setActionNotice(`Delete failed: ${errorObj.message}`);
        setExamToDelete(null);
        setDeleteNeedsForce(false);
        setDeleteWarningMsg(null);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered examinations list
  const filteredExams = exams.filter(exam => {
    const matchesSearch = 
      exam.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (exam.description && exam.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      String(exam.id).includes(searchQuery);

    const matchesStatus = 
      statusFilter === "ALL" || 
      (statusFilter === "ACTIVATED" && isExamActive(exam.status)) ||
      (statusFilter === "DEACTIVATED" && !isExamActive(exam.status));
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="admin-page">
      {/* Header bar */}
      <div className="admin-page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <BookOpen size={20} color="#017846" />
            <strong style={{ fontSize: "15px", color: "#0f172a", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              Examinations Management
            </strong>
          </div>
          <p style={{ margin: "3px 0 0", fontSize: "12.5px", color: "#64748b" }}>
            Create, schedule, publish, and oversee campus placement assessments
          </p>
        </div>
        <div className="admin-page-actions" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button 
            type="button"
            className="admin-btn secondary" 
            onClick={fetchExams}
            title="Refresh examinations"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
          >
            <RotateCcw size={14} /> Refresh
          </button>
          
          <button 
            type="button"
            className="admin-btn primary" 
            onClick={() => navigate("/admin/exams/new")}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "8px", background: "linear-gradient(135deg, #017846, #01663C)", color: "#ffffff", border: "none", fontSize: "12.5px", fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(1, 120, 70, 0.25)" }}
          >
            <PlusCircle size={15} /> Create New Exam
          </button>
        </div>
      </div>

      {/* Action Notification Alert */}
      {actionNotice && (
        <div 
          style={{
            background: actionNotice.includes("Cannot") || actionNotice.includes("failed") ? "#fef2f2" : "#f0fdf4",
            border: actionNotice.includes("Cannot") || actionNotice.includes("failed") ? "1px solid #fecaca" : "1px solid #bbf7d0",
            color: actionNotice.includes("Cannot") || actionNotice.includes("failed") ? "#991b1b" : "#166534",
            borderRadius: "10px",
            padding: "12px 16px",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
            marginBottom: "16px"
          }}
        >
          <span>{actionNotice}</span>
          <button 
            type="button" 
            onClick={() => setActionNotice(null)} 
            style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontWeight: 700, fontSize: "14px" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="filter-search-row">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search examinations by title, description, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="status-filter-pills">
          {["ALL", "ACTIVATED", "DEACTIVATED"].map(st => (
            <button
              key={st}
              type="button"
              className={`filter-pill ${statusFilter === st ? "active" : ""}`}
              onClick={() => setStatusFilter(st)}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="admin-notice" style={{ background: "#fef2f2", borderColor: "#f87171", color: "#991b1b" }}>
          <span>{error}</span>
          <button type="button" className="retry-btn" onClick={fetchExams}>Retry</button>
        </div>
      )}

      {/* Examinations Table */}
      <div className="admin-table-card">
        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Examination Title & Code</th>
                <th>Target Track</th>
                <th>Duration & Items</th>
                <th>Pass Threshold</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                    Loading examinations from PostgreSQL...
                  </td>
                </tr>
              ) : filteredExams.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "50px 20px", color: "#64748b" }}>
                    <BookOpen size={36} color="#cbd5e1" style={{ margin: "0 auto 10px" }} />
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "14px", color: "#1e293b" }}>No Examinations Found</p>
                    <small style={{ color: "#64748b", display: "block", marginTop: "4px" }}>
                      Create a new assessment using the button above.
                    </small>
                  </td>
                </tr>
              ) : (
                filteredExams.map(exam => (
                  <tr key={exam.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "13.5px" }}>
                        {exam.title}
                      </div>
                      <small style={{ color: "#64748b" }}>
                        Exam #{exam.id} &bull; {exam.timingMode}
                      </small>
                    </td>
                    <td>
                      {exam.departmentNames && exam.departmentNames.length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                          {exam.departmentNames.map((d, i) => (
                            <span key={i} className="admin-dept-chip">
                              {d}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: "11px", color: "#94a3b8" }}>Universal / All Tracks</span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{exam.durationMinutes} mins</div>
                      <small style={{ color: "#64748b" }}>{exam.totalQuestions} Questions &bull; {exam.totalMarks} Marks</small>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{exam.qualificationThreshold} {exam.qualificationMode === "PERCENTAGE" ? "%" : "marks"}</div>
                      <small style={{ color: "#64748b" }}>Passing score</small>
                    </td>
                    <td>
                      {isExamActive(exam.status) ? (
                        <span 
                          className="status-pill activated" 
                          style={{ 
                            background: "#ecfdf5", 
                            color: "#065f46", 
                            border: "1px solid #a7f3d0", 
                            fontWeight: 700, 
                            padding: "4px 10px", 
                            borderRadius: "12px", 
                            fontSize: "11px", 
                            letterSpacing: "0.5px" 
                          }}
                        >
                          ACTIVATED
                        </span>
                      ) : (
                        <span 
                          className="status-pill deactivated" 
                          style={{ 
                            background: "#f8fafc", 
                            color: "#64748b", 
                            border: "1px solid #cbd5e1", 
                            fontWeight: 600, 
                            padding: "4px 10px", 
                            borderRadius: "12px", 
                            fontSize: "11px", 
                            letterSpacing: "0.5px" 
                          }}
                        >
                          DEACTIVATED
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="action-buttons-group">
                        {isExamActive(exam.status) ? (
                          <button 
                            type="button"
                            className="btn-close" 
                            title="Deactivate Examination"
                            onClick={() => handleDeactivate(exam.id)}
                            style={{ 
                              display: "inline-flex", 
                              alignItems: "center", 
                              gap: "4px", 
                              padding: "5px 10px", 
                              borderRadius: "6px", 
                              background: "#fff1f2", 
                              color: "#e11d48", 
                              border: "1px solid #fecdd3", 
                              fontSize: "11.5px", 
                              fontWeight: 600, 
                              cursor: "pointer" 
                            }}
                          >
                            <Clock size={12} /> Deactivate
                          </button>
                        ) : (
                          <button 
                            type="button"
                            className="btn-publish" 
                            title="Activate Examination (Deactivates all other exams)"
                            onClick={() => handleActivate(exam.id)}
                            style={{ 
                              display: "inline-flex", 
                              alignItems: "center", 
                              gap: "4px", 
                              padding: "5px 10px", 
                              borderRadius: "6px", 
                              background: "#ecfdf5", 
                              color: "#059669", 
                              border: "1px solid #a7f3d0", 
                              fontSize: "11.5px", 
                              fontWeight: 700, 
                              cursor: "pointer" 
                            }}
                          >
                            <CheckCircle size={12} /> Activate
                          </button>
                        )}

                        <button 
                          type="button"
                          className="btn-view" 
                          title="View Exam Specs"
                          onClick={() => setSelectedExam(exam)}
                        >
                          <Eye size={12} /> Specs
                        </button>

                        <button 
                          type="button"
                          className="btn-results" 
                          title="View Results"
                          onClick={() => navigate("/admin/results")}
                        >
                          <BarChart2 size={12} /> Results
                        </button>

                        {/* Delete Exam Action */}
                        <button 
                          type="button"
                          className="btn-delete" 
                          title="Delete Examination"
                          onClick={() => {
                            setExamToDelete(exam);
                            setDeleteNeedsForce(false);
                            setDeleteWarningMsg(null);
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Exam Confirmation Modal */}
      {examToDelete && (
        <div className="admin-modal-backdrop" onClick={() => setExamToDelete(null)}>
          <div className="admin-modal-box" onClick={e => e.stopPropagation()}>
            <h3 style={{ margin: "0 0 12px 0", color: "#dc2626" }}>Delete Examination</h3>
            
            <p style={{ fontSize: "13px", color: "#475569", lineHeight: 1.5 }}>
              Are you sure you want to delete examination <b>"{examToDelete.title}"</b> (ID: #{examToDelete.id})?
            </p>

            {deleteWarningMsg && (
              <div style={{
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "8px",
                padding: "12px",
                marginTop: "12px",
                color: "#991b1b",
                fontSize: "12.5px"
              }}>
                <div style={{ fontWeight: 700, marginBottom: "4px" }}>Active Attempts Warning</div>
                {deleteWarningMsg}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
              <button 
                type="button" 
                className="secondary" 
                onClick={() => setExamToDelete(null)}
              >
                Cancel
              </button>
              
              {deleteNeedsForce ? (
                <button 
                  type="button" 
                  className="primary" 
                  style={{ background: "#dc2626", borderColor: "#dc2626" }} 
                  onClick={() => handleDeleteConfirm(true)}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Force Deleting..." : "Force Delete (Cascade All)"}
                </button>
              ) : (
                <button 
                  type="button" 
                  className="primary" 
                  style={{ background: "#dc2626", borderColor: "#dc2626" }} 
                  onClick={() => handleDeleteConfirm(false)}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Delete"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Exam Details Modal */}
      {selectedExam && (
        <div className="admin-modal-backdrop" onClick={() => setSelectedExam(null)}>
          <div className="admin-modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <span className={`status-pill ${selectedExam.status.toLowerCase()}`} style={{ marginBottom: "6px" }}>
                  {selectedExam.status}
                </span>
                <h2 style={{ margin: "4px 0 0 0", fontSize: "18px", color: "#0f172a" }}>
                  {selectedExam.title}
                </h2>
                <small style={{ color: "#64748b" }}>PostgreSQL Database ID: #{selectedExam.id}</small>
              </div>
              <button 
                type="button" 
                className="secondary" 
                style={{ padding: "5px 7px" }} 
                onClick={() => setSelectedExam(null)}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: "13px", color: "#475569", lineHeight: 1.5 }}>
              {selectedExam.description || "No description provided."}
            </p>

            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(2, 1fr)", 
              gap: "12px", 
              background: "#f8fafc", 
              padding: "14px", 
              borderRadius: "8px", 
              margin: "16px 0",
              fontSize: "12px"
            }}>
              <div><span style={{ color: "#64748b" }}>Timing Mode:</span> <b>{selectedExam.timingMode}</b></div>
              <div><span style={{ color: "#64748b" }}>Duration:</span> <b>{selectedExam.durationMinutes} Minutes</b></div>
              <div><span style={{ color: "#64748b" }}>Questions:</span> <b>{selectedExam.totalQuestions} MCQs</b></div>
              <div><span style={{ color: "#64748b" }}>Total Marks:</span> <b>{selectedExam.totalMarks}</b></div>
              <div><span style={{ color: "#64748b" }}>Marks per Correct:</span> <b>+{selectedExam.marksPerQuestion}</b></div>
              <div><span style={{ color: "#64748b" }}>Negative Marks:</span> <b>{selectedExam.negativeMarks}</b></div>
              <div><span style={{ color: "#64748b" }}>Pass Policy:</span> <b>{selectedExam.qualificationThreshold} {selectedExam.qualificationMode === "PERCENTAGE" ? "%" : "marks"}</b></div>
              <div><span style={{ color: "#64748b" }}>Results Published:</span> <b>{selectedExam.resultsPublished ? "Yes" : "No"}</b></div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
              <button className="primary" onClick={() => setSelectedExam(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
