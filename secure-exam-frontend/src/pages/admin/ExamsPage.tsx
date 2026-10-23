import { useState, useEffect } from "react";
import { 
  PlusCircle, 
  Search, 
  Eye, 
  AlertCircle,
  X,
  Trash2,
  BookOpen,
  BarChart2,
  CheckCircle,
  Clock,
  RotateCcw
} from "lucide-react";
import { useRouter } from "../../router";
import { getAllExams, publishExam, closeExam, deleteExam, ApiError, type ExamDto } from "../../services/api";

export default function ExamsPage() {
  const { navigate } = useRouter();
  const [exams, setExams] = useState<ExamDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedExam, setSelectedExam] = useState<ExamDto | null>(null);
  const [examToDelete, setExamToDelete] = useState<ExamDto | null>(null);
  const [deleteNeedsForce, setDeleteNeedsForce] = useState(false);
  const [deleteWarningMsg, setDeleteWarningMsg] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handlePublish = async (examId: number) => {
    setActionNotice(null);
    try {
      const updated = await publishExam(examId);
      setExams(prev => prev.map(e => e.id === examId ? updated : e));
      setActionNotice(`Examination "${updated.title}" successfully published! Active for candidate entrance.`);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setActionNotice(`Cannot publish examination: ${err.message}`);
      } else {
        const errorObj = err as Error;
        setActionNotice(`Publication failed: ${errorObj.message}`);
      }
    }
  };

  const handleClose = async (examId: number) => {
    setActionNotice(null);
    try {
      const updated = await closeExam(examId);
      setExams(prev => prev.map(e => e.id === examId ? updated : e));
      setActionNotice(`Examination "${updated.title}" status changed to COMPLETED.`);
    } catch (err: unknown) {
      const errorObj = err as Error;
      setActionNotice(`Could not close exam: ${errorObj.message}`);
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
        setDeleteWarningMsg(err.message || "This examination has recorded candidate attempts. Deleting will permanently remove all candidate records.");
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

  const filteredExams = exams.filter(e => {
    const matchesSearch = 
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.description && e.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      String(e.id).includes(searchQuery);

    const matchesStatus = statusFilter === "ALL" || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="admin-page-container">
      {/* Header Toolbar */}
      <div className="admin-page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <BookOpen size={18} color="#017846" />
            <strong style={{ fontSize: "15px", color: "#0f172a", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              Active Examinations Registry
            </strong>
          </div>
          <p style={{ margin: "3px 0 0", fontSize: "12.5px", color: "#64748b" }}>
            Manage database examinations, 4-set question collections (A–D), and live entrance lifecycle
          </p>
        </div>
        <div className="admin-page-actions">
          <button 
            type="button"
            className="admin-btn secondary" 
            onClick={fetchExams}
            title="Refresh from PostgreSQL"
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
            <PlusCircle size={15} /> Create Examination
          </button>
        </div>
      </div>

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
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)"
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
            placeholder="Search examinations by title, description or ID..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="status-filter-pills">
          {["ALL", "DRAFT", "PUBLISHED", "COMPLETED"].map(st => (
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

      {/* Examinations Table */}
      <div className="admin-table-card">
        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Exam ID & Title</th>
                <th>Departments</th>
                <th>Duration & Questions</th>
                <th>Marks & Threshold</th>
                <th>Timing Mode</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                    Loading examinations from PostgreSQL database...
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "#dc2626" }}>
                    <AlertCircle size={22} style={{ margin: "0 auto 8px" }} />
                    <div>{error}</div>
                  </td>
                </tr>
              ) : filteredExams.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "50px 20px", color: "#64748b" }}>
                    <BookOpen size={36} color="#cbd5e1" style={{ margin: "0 auto 10px" }} />
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "14px", color: "#1e293b" }}>No examinations found</p>
                    <small style={{ color: "#64748b", display: "block", marginTop: "4px" }}>
                      Create an examination using the button above to begin configuring question sets A–D.
                    </small>
                  </td>
                </tr>
              ) : (
                filteredExams.map(exam => (
                  <tr key={exam.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "13.5px" }}>{exam.title}</div>
                      <small style={{ color: "#64748b", fontFamily: "JetBrains Mono, monospace" }}>ID: #{exam.id}</small>
                    </td>
                    <td>
                      {exam.departmentNames && exam.departmentNames.length > 0 ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                          {exam.departmentNames.map((d, i) => (
                            <span key={i} className="admin-dept-chip">
                              {d}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ fontSize: "11px", color: "#94a3b8" }}>All Departments</span>
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{exam.durationMinutes} mins</div>
                      <small style={{ color: "#64748b" }}>{exam.totalQuestions} Questions</small>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{exam.totalMarks} Total</div>
                      <small style={{ color: "#16a34a", fontWeight: 600 }}>
                        Pass: {exam.qualificationThreshold} {exam.qualificationMode === "PERCENTAGE" ? "%" : "marks"}
                      </small>
                    </td>
                    <td>
                      <span style={{ fontSize: "12px", color: "#475569", fontWeight: 500 }}>{exam.timingMode}</span>
                    </td>
                    <td>
                      <span className={`status-pill ${exam.status.toLowerCase()}`}>
                        {exam.status}
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="admin-action-btn-group">
                        {/* View Details */}
                        <button 
                          type="button"
                          className="btn-view" 
                          title="View Details"
                          onClick={() => setSelectedExam(exam)}
                        >
                          <Eye size={12} /> View
                        </button>

                        {/* Question Bank Sets A-D */}
                        <button 
                          type="button"
                          className="btn-sets" 
                          title="Manage Question Sets A-D"
                          onClick={() => navigate("/admin/questions")}
                        >
                          <BookOpen size={12} /> Sets A-D
                        </button>

                        {/* Publish Exam */}
                        {exam.status === "DRAFT" && (
                          <button 
                            type="button"
                            className="btn-publish" 
                            title="Publish Examination"
                            onClick={() => handlePublish(exam.id)}
                          >
                            <CheckCircle size={12} /> Publish
                          </button>
                        )}

                        {/* Close Exam */}
                        {exam.status === "PUBLISHED" && (
                          <button 
                            type="button"
                            className="btn-close-exam" 
                            title="Close Examination"
                            onClick={() => handleClose(exam.id)}
                          >
                            <Clock size={12} /> Close
                          </button>
                        )}

                        {/* Results */}
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
        <div 
          className="admin-modal-backdrop" 
          onClick={() => { if (!isDeleting) { setExamToDelete(null); setDeleteNeedsForce(false); } }}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 1100 }}
        >
          <div 
            className="admin-modal-box" 
            onClick={e => e.stopPropagation()} 
            style={{ 
              maxWidth: "500px", 
              width: "100%", 
              boxSizing: "border-box", 
              borderRadius: "12px", 
              padding: "24px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.08)"
            }}
          >
            <h3 style={{ margin: "0 0 12px 0", color: "#dc2626", display: "flex", alignItems: "center", gap: "8px", fontSize: "16px" }}>
              <Trash2 size={20} />
              {deleteNeedsForce ? "Confirm Force Cascade Deletion" : "Delete Examination"}
            </h3>
            
            {deleteNeedsForce ? (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "14px", marginBottom: "16px" }}>
                <div style={{ color: "#991b1b", fontWeight: 700, fontSize: "13px", marginBottom: "6px" }}>
                  ⚠️ Active Candidate Attempts Detected
                </div>
                <p style={{ fontSize: "12px", color: "#7f1d1d", margin: 0, lineHeight: 1.45 }}>
                  {deleteWarningMsg}
                  <br /><br />
                  Proceeding with <strong>Force Delete</strong> will permanently remove this examination along with all candidate slots, responses, attempt histories, and generated results from Neon PostgreSQL.
                </p>
              </div>
            ) : (
              <p style={{ fontSize: "13px", color: "#475569", lineHeight: 1.5, margin: "0 0 16px 0" }}>
                Are you sure you want to delete examination <b>"{examToDelete.title}"</b> (ID #{examToDelete.id})? 
                All associated question sets and options will be safely removed.
              </p>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "18px", flexWrap: "wrap" }}>
              <button 
                type="button" 
                className="secondary" 
                disabled={isDeleting}
                onClick={() => { setExamToDelete(null); setDeleteNeedsForce(false); }}
                style={{ cursor: isDeleting ? "not-allowed" : "pointer", padding: "8px 16px", fontSize: "13px" }}
              >
                Cancel
              </button>
              {deleteNeedsForce ? (
                <button 
                  type="button" 
                  className="primary" 
                  disabled={isDeleting}
                  style={{ 
                    background: "#b91c1c", 
                    borderColor: "#991b1b", 
                    cursor: isDeleting ? "not-allowed" : "pointer", 
                    opacity: isDeleting ? 0.75 : 1,
                    padding: "8px 18px",
                    fontSize: "13px",
                    fontWeight: 600
                  }} 
                  onClick={() => handleDeleteConfirm(true)}
                >
                  {isDeleting ? "Deleting Records..." : "Confirm Force Delete"}
                </button>
              ) : (
                <button 
                  type="button" 
                  className="primary" 
                  disabled={isDeleting}
                  style={{ 
                    background: "#dc2626", 
                    borderColor: "#dc2626", 
                    cursor: isDeleting ? "not-allowed" : "pointer", 
                    opacity: isDeleting ? 0.75 : 1,
                    padding: "8px 18px",
                    fontSize: "13px",
                    fontWeight: 600
                  }} 
                  onClick={() => handleDeleteConfirm(false)}
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
