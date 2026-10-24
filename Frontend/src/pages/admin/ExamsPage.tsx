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
  RotateCcw,
  Code2,
  Terminal,
  FileCode2,
  CheckCircle2,
  ShieldCheck
} from "lucide-react";
import { useRouter } from "../../router";
import { 
  getAllExams, 
  publishExam, 
  closeExam, 
  deleteExam, 
  getAllCodingExams,
  publishCodingExam,
  deleteCodingExam,
  ApiError, 
  type ExamDto,
  type CodingExamDto
} from "../../services/api";
import { getSavedCodingExams } from "../../services/codingExamService";

export default function ExamsPage() {
  const { navigate } = useRouter();
  const [selectedRound, setSelectedRound] = useState<"ROUND_1" | "ROUND_2">("ROUND_1");

  // Round 1 (MCQ) Exams
  const [exams, setExams] = useState<ExamDto[]>([]);
  const [selectedExam, setSelectedExam] = useState<ExamDto | null>(null);
  const [examToDelete, setExamToDelete] = useState<ExamDto | null>(null);
  const [deleteNeedsForce, setDeleteNeedsForce] = useState(false);
  const [deleteWarningMsg, setDeleteWarningMsg] = useState<string | null>(null);

  // Round 2 (Coding) Exams
  const [codingExams, setCodingExams] = useState<CodingExamDto[]>([]);
  const [selectedCodingExam, setSelectedCodingExam] = useState<CodingExamDto | null>(null);
  const [codingExamToDelete, setCodingExamToDelete] = useState<CodingExamDto | null>(null);

  // Shared UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchAllExamsData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [mcqData, codingData] = await Promise.allSettled([
        getAllExams(),
        getAllCodingExams()
      ]);

      if (mcqData.status === "fulfilled") {
        setExams(mcqData.value);
      } else {
        setError(mcqData.reason?.message || "Failed to load examinations from backend");
      }

      if (codingData.status === "fulfilled" && codingData.value.length > 0) {
        setCodingExams(codingData.value);
      } else {
        setCodingExams(getSavedCodingExams());
      }
    } catch (err: unknown) {
      const errorObj = err as Error;
      setError(errorObj.message || "Failed to load examinations from backend");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllExamsData();
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

  const handlePublishCoding = async (examId: number | string) => {
    setActionNotice(null);
    try {
      const updated = await publishCodingExam(examId);
      setCodingExams(prev => prev.map(e => String(e.id) === String(examId) ? { ...e, status: "PUBLISHED" } : e));
      setActionNotice(`Coding Assessment "${updated.title}" successfully published! Active for candidate entrance.`);
    } catch (err: any) {
      setActionNotice(`Publication failed: ${err.message || "Server error"}`);
    }
  };

  const handleDeleteCodingConfirm = async () => {
    if (!codingExamToDelete || isDeleting) return;
    setIsDeleting(true);
    setActionNotice(null);
    const idToDelete = codingExamToDelete.id;
    try {
      if (idToDelete) {
        await deleteCodingExam(idToDelete);
      }
      setCodingExams(prev => prev.filter(e => String(e.id) !== String(idToDelete)));
      setActionNotice(`Coding Assessment "${codingExamToDelete.title}" deleted.`);
    } catch (err: any) {
      const updated = codingExams.filter(e => String(e.id) !== String(idToDelete));
      setCodingExams(updated);
      try {
        localStorage.setItem("examsecure_coding_exams_drafts_v1", JSON.stringify(updated));
      } catch {}
      setActionNotice(`Coding Assessment removed (${err.message})`);
    } finally {
      setIsDeleting(false);
      setCodingExamToDelete(null);
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

  const filteredCodingExams = codingExams.filter(e => {
    const matchesSearch = 
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.description && e.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      String(e.id || "").includes(searchQuery);

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
            Manage database examinations, 4-set question collections (A–D), and Round 2 Coding assessments
          </p>
        </div>
        <div className="admin-page-actions">
          <button 
            type="button"
            className="admin-btn secondary" 
            onClick={fetchAllExamsData}
            title="Refresh from Database"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
          >
            <RotateCcw size={14} /> Refresh
          </button>
          {selectedRound === "ROUND_1" ? (
            <button 
              type="button"
              className="admin-btn primary" 
              onClick={() => navigate("/admin/exams/new")}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "8px", background: "linear-gradient(135deg, #017846, #01663C)", color: "#ffffff", border: "none", fontSize: "12.5px", fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(1, 120, 70, 0.25)" }}
            >
              <PlusCircle size={15} /> Create MCQ Examination
            </button>
          ) : (
            <button 
              type="button"
              className="admin-btn primary" 
              onClick={() => navigate("/admin/exams/new/coding")}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "8px", background: "linear-gradient(135deg, #017846, #01663C)", color: "#ffffff", border: "none", fontSize: "12.5px", fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(1, 120, 70, 0.25)" }}
            >
              <Code2 size={15} /> Create Coding Assessment
            </button>
          )}
        </div>
      </div>

      {/* Round Selection Tabs */}
      <div style={{ display: "flex", gap: "10px", margin: "16px 0" }}>
        <button
          type="button"
          onClick={() => setSelectedRound("ROUND_1")}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
            border: selectedRound === "ROUND_1" ? "2px solid #017846" : "1px solid #cbd5e1",
            background: selectedRound === "ROUND_1" ? "#eaf6ef" : "#ffffff",
            color: selectedRound === "ROUND_1" ? "#017846" : "#475569",
            display: "inline-flex",
            alignItems: "center",
            gap: "7px"
          }}
        >
          <BookOpen size={15} /> Round 1: MCQ Assessments ({exams.length})
        </button>
        <button
          type="button"
          onClick={() => setSelectedRound("ROUND_2")}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 700,
            cursor: "pointer",
            border: selectedRound === "ROUND_2" ? "2px solid #017846" : "1px solid #cbd5e1",
            background: selectedRound === "ROUND_2" ? "#eaf6ef" : "#ffffff",
            color: selectedRound === "ROUND_2" ? "#017846" : "#475569",
            display: "inline-flex",
            alignItems: "center",
            gap: "7px"
          }}
        >
          <Code2 size={15} /> Round 2: Coding Assessments ({codingExams.length})
        </button>
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
            placeholder={selectedRound === "ROUND_1" ? "Search MCQ examinations..." : "Search coding assessments..."} 
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
          {selectedRound === "ROUND_1" ? (
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
                      Loading examinations from database...
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
                            onClick={() => navigate(`/admin/results?examId=${exam.id}`)}
                          >
                            <BarChart2 size={12} /> Results
                          </button>

                          {/* Delete Exam */}
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
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Assessment ID & Title</th>
                  <th>Departments</th>
                  <th>Duration & Problems</th>
                  <th>Marks & Threshold</th>
                  <th>Languages</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                      Loading coding assessments...
                    </td>
                  </tr>
                ) : filteredCodingExams.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "50px 20px", color: "#64748b" }}>
                      <Code2 size={36} color="#cbd5e1" style={{ margin: "0 auto 10px" }} />
                      <p style={{ margin: 0, fontWeight: 700, fontSize: "14px", color: "#1e293b" }}>No Coding Assessments Found</p>
                      <small style={{ color: "#64748b", display: "block", marginTop: "4px" }}>
                        Create a Round 2 coding assessment with test cases and sandbox execution using the button above.
                      </small>
                    </td>
                  </tr>
                ) : (
                  filteredCodingExams.map(exam => (
                    <tr key={String(exam.id || exam.title)}>
                      <td>
                        <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "13.5px" }}>{exam.title}</div>
                        <small style={{ color: "#64748b", fontFamily: "JetBrains Mono, monospace" }}>ID: #{exam.id || "DRAFT"}</small>
                      </td>
                      <td>
                        {exam.selectedDepartments && exam.selectedDepartments.length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                            {exam.selectedDepartments.map((d: string, i: number) => (
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
                        <small style={{ color: "#64748b" }}>{exam.questions?.length || 0} Problems</small>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{exam.totalMarks} Marks</div>
                        <small style={{ color: "#16a34a", fontWeight: 600 }}>
                          Pass: {exam.qualificationPercentage}% ({exam.evaluationMode})
                        </small>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                          {exam.allowedLanguages?.slice(0, 4).map((lang: string, li: number) => (
                            <span key={li} style={{
                              fontSize: "10px",
                              fontWeight: 600,
                              padding: "2px 6px",
                              borderRadius: "4px",
                              background: "#e2e8f0",
                              color: "#334155"
                            }}>
                              {lang}
                            </span>
                          ))}
                          {exam.allowedLanguages && exam.allowedLanguages.length > 4 && (
                            <span style={{ fontSize: "10px", color: "#64748b" }}>+{exam.allowedLanguages.length - 4}</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`status-pill ${exam.status.toLowerCase()}`}>
                          {exam.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div className="admin-action-btn-group">
                          <button 
                            type="button"
                            className="btn-view" 
                            title="View Problems & Test Cases"
                            onClick={() => setSelectedCodingExam(exam)}
                          >
                            <Eye size={12} /> Problems
                          </button>

                          {exam.status === "DRAFT" && exam.id && (
                            <button 
                              type="button"
                              className="btn-publish" 
                              title="Publish Coding Assessment"
                              onClick={() => handlePublishCoding(exam.id!)}
                            >
                              <CheckCircle size={12} /> Publish
                            </button>
                          )}

                          <button 
                            type="button"
                            className="btn-delete" 
                            title="Delete Assessment"
                            onClick={() => setCodingExamToDelete(exam)}
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
          )}
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

      {/* Delete Coding Exam Modal */}
      {codingExamToDelete && (
        <div 
          className="admin-modal-backdrop" 
          onClick={() => { if (!isDeleting) setCodingExamToDelete(null); }}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 1100 }}
        >
          <div 
            className="admin-modal-box" 
            onClick={e => e.stopPropagation()} 
            style={{ 
              maxWidth: "460px", 
              width: "100%", 
              boxSizing: "border-box", 
              borderRadius: "12px", 
              padding: "24px"
            }}
          >
            <h3 style={{ margin: "0 0 12px 0", color: "#dc2626", display: "flex", alignItems: "center", gap: "8px", fontSize: "16px" }}>
              <Trash2 size={20} />
              Delete Coding Assessment
            </h3>
            <p style={{ fontSize: "13px", color: "#475569", lineHeight: 1.5, margin: "0 0 16px 0" }}>
              Are you sure you want to delete coding assessment <b>"{codingExamToDelete.title}"</b>? 
              All associated problems, test cases, and candidate coding logs will be removed.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button 
                type="button" 
                className="secondary" 
                disabled={isDeleting}
                onClick={() => setCodingExamToDelete(null)}
                style={{ padding: "8px 16px", fontSize: "13px" }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="primary" 
                disabled={isDeleting}
                style={{ background: "#dc2626", borderColor: "#dc2626", padding: "8px 18px", fontSize: "13px", fontWeight: 600 }}
                onClick={handleDeleteCodingConfirm}
              >
                {isDeleting ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MCQ Exam Details Modal */}
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
                <small style={{ color: "#64748b" }}>Database ID: #{selectedExam.id}</small>
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

      {/* Coding Exam Details Modal */}
      {selectedCodingExam && (
        <div className="admin-modal-backdrop" onClick={() => setSelectedCodingExam(null)}>
          <div className="admin-modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: "680px", width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <span className={`status-pill ${selectedCodingExam.status.toLowerCase()}`} style={{ marginBottom: "6px" }}>
                  {selectedCodingExam.status}
                </span>
                <h2 style={{ margin: "4px 0 0 0", fontSize: "18px", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Code2 size={20} color="#017846" /> {selectedCodingExam.title}
                </h2>
                <small style={{ color: "#64748b" }}>Round 2 Assessment ID: #{selectedCodingExam.id || "DRAFT"}</small>
              </div>
              <button 
                type="button" 
                className="secondary" 
                style={{ padding: "5px 7px" }} 
                onClick={() => setSelectedCodingExam(null)}
              >
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: "13px", color: "#475569", lineHeight: 1.5 }}>
              {selectedCodingExam.description || "Round 2 Coding Examination with automated test case evaluation."}
            </p>

            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(3, 1fr)", 
              gap: "10px", 
              background: "#f8fafc", 
              padding: "14px", 
              borderRadius: "8px", 
              margin: "16px 0",
              fontSize: "12px"
            }}>
              <div><span style={{ color: "#64748b" }}>Duration:</span> <b>{selectedCodingExam.durationMinutes} Mins</b></div>
              <div><span style={{ color: "#64748b" }}>Total Marks:</span> <b>{selectedCodingExam.totalMarks} Marks</b></div>
              <div><span style={{ color: "#64748b" }}>Evaluation:</span> <b>{selectedCodingExam.evaluationMode}</b></div>
            </div>

            <h4 style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", margin: "14px 0 8px" }}>
              Configured Problems ({selectedCodingExam.questions?.length || 0}):
            </h4>
            <div style={{ maxHeight: "240px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
              {selectedCodingExam.questions?.map((q: any, qIdx: number) => (
                <div key={q.id || qIdx} style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}>
                  <div>
                    <strong style={{ fontSize: "13px", color: "#0f172a" }}>Problem {qIdx + 1}: {q.title}</strong>
                    <div style={{ fontSize: "11.5px", color: "#64748b", marginTop: "2px" }}>
                      {q.difficulty} • {q.maxMarks} Marks • {q.testCases?.length || 0} Test Cases
                    </div>
                  </div>
                  <span style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: "4px",
                    background: q.difficulty === "Easy" ? "#dcfce7" : q.difficulty === "Medium" ? "#fef3c7" : "#fee2e2",
                    color: q.difficulty === "Easy" ? "#166534" : q.difficulty === "Medium" ? "#92400e" : "#991b1b"
                  }}>
                    {q.difficulty}
                  </span>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "18px" }}>
              <button className="primary" onClick={() => setSelectedCodingExam(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
