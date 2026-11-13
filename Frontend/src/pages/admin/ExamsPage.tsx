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
            <BookOpen size={20} color="#2563EB" />
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
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "8px", background: "linear-gradient(135deg, #2563EB, #1D4ED8)", color: "#ffffff", border: "none", fontSize: "12.5px", fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(37, 99, 235, 0.25)" }}
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
                          onClick={() => navigate(`/admin/results?examId=${exam.id}`)}
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
        <div 
          className="admin-modal-backdrop" 
          onClick={() => setSelectedExam(null)}
        >
          <div 
            style={{
              background: "#ffffff",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "600px",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(15, 23, 42, 0.08)",
              display: "flex",
              flexDirection: "column",
              animation: "adminModalScaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards"
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{
              padding: "20px 24px",
              borderBottom: "1px solid #f1f5f9",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "16px"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                <div style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: "#EFF6FF",
                  border: "1px solid #d1fae5",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#2563EB",
                  flexShrink: 0
                }}>
                  <BookOpen size={22} />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span 
                      style={{
                        fontSize: "11px",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        padding: "2px 8px",
                        borderRadius: "999px",
                        background: selectedExam.status === "PUBLISHED" ? "#ecfdf5" : "#fef3c7",
                        color: selectedExam.status === "PUBLISHED" ? "#047857" : "#b45309",
                        border: selectedExam.status === "PUBLISHED" ? "1px solid #a7f3d0" : "1px solid #fde68a"
                      }}
                    >
                      {selectedExam.status}
                    </span>
                    <span style={{ fontSize: "12px", color: "#64748b" }}>•</span>
                    <code style={{
                      fontSize: "11.5px",
                      background: "#f1f5f9",
                      padding: "1px 6px",
                      borderRadius: "4px",
                      color: "#475569",
                      fontFamily: "ui-monospace, monospace"
                    }}>
                      ID #{selectedExam.id}
                    </code>
                  </div>
                  <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.01em" }}>
                    {selectedExam.title}
                  </h2>
                </div>
              </div>

              <button 
                type="button" 
                onClick={() => setSelectedExam(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: "6px",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.15s ease"
                }}
                onMouseEnter={e => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.color = "#0f172a"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#94a3b8"; }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: "20px 24px" }}>
              {/* Description Box */}
              {selectedExam.description && (
                <div style={{
                  background: "#f8fafc",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                  padding: "12px 16px",
                  marginBottom: "18px"
                }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#64748b", letterSpacing: "0.04em", marginBottom: "4px" }}>
                    Overview & Syllabus Notes
                  </div>
                  <p style={{ margin: 0, fontSize: "13px", color: "#334155", lineHeight: 1.5 }}>
                    {selectedExam.description}
                  </p>
                </div>
              )}

              {/* Specifications Grid */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: "12px",
                marginBottom: "10px"
              }}>
                <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "12px 14px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#64748b", letterSpacing: "0.03em", marginBottom: "3px" }}>
                    Timing Mode
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                    {selectedExam.timingMode === "DURATION_FROM_START" ? "Duration from Start (On-Demand)" : selectedExam.timingMode}
                  </div>
                </div>

                <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "12px 14px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#64748b", letterSpacing: "0.03em", marginBottom: "3px" }}>
                    Exam Duration
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#2563EB", display: "flex", alignItems: "center", gap: "5px" }}>
                    <Clock size={14} /> {selectedExam.durationMinutes} Minutes
                  </div>
                </div>

                <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "12px 14px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#64748b", letterSpacing: "0.03em", marginBottom: "3px" }}>
                    Total Questions
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                    {selectedExam.totalQuestions} MCQs
                  </div>
                </div>

                <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "12px 14px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#64748b", letterSpacing: "0.03em", marginBottom: "3px" }}>
                    Total Marks
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                    {selectedExam.totalMarks} Marks
                  </div>
                </div>

                <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "12px 14px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#64748b", letterSpacing: "0.03em", marginBottom: "3px" }}>
                    Scoring Rule
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                    +{selectedExam.marksPerQuestion} Correct / -{selectedExam.negativeMarks} Wrong
                  </div>
                </div>

                <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "12px 14px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#64748b", letterSpacing: "0.03em", marginBottom: "3px" }}>
                    Qualifying Pass Policy
                  </div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#166534" }}>
                    {selectedExam.qualificationThreshold} {selectedExam.qualificationMode === "PERCENTAGE" ? "%" : "marks"} required
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: "16px 24px",
              background: "#f8fafc",
              borderTop: "1px solid #f1f5f9",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <span style={{ fontSize: "12px", color: "#64748b" }}>
                Results Published: <b style={{ color: selectedExam.resultsPublished ? "#2563EB" : "#64748b" }}>{selectedExam.resultsPublished ? "Yes" : "No"}</b>
              </span>
              <button 
                type="button"
                className="primary" 
                onClick={() => setSelectedExam(null)}
                style={{
                  padding: "8px 20px",
                  fontSize: "13px",
                  fontWeight: 600,
                  borderRadius: "8px"
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
