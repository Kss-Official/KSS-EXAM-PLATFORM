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
  CheckSquare,
  FileCode2,
  Terminal
} from "lucide-react";
import { useRouter } from "../../router";
import { getAllExams, publishExam, closeExam, deleteExam, ApiError, type ExamDto } from "../../services/api";
import { 
  getSavedCodingExams, 
  deleteCodingExam, 
  publishCodingExam, 
  closeCodingExam, 
  type CodingExamDto 
} from "../../services/codingExamService";

export default function ExamsPage() {
  const { navigate } = useRouter();

  // Round Switcher State: "ROUND_1" (MCQ Assessment) vs "ROUND_2" (Coding Assessment)
  const [selectedRound, setSelectedRound] = useState<"ROUND_1" | "ROUND_2">("ROUND_1");

  // Round 1 (MCQ) State
  const [exams, setExams] = useState<ExamDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExam, setSelectedExam] = useState<ExamDto | null>(null);
  const [examToDelete, setExamToDelete] = useState<ExamDto | null>(null);
  const [deleteNeedsForce, setDeleteNeedsForce] = useState(false);
  const [deleteWarningMsg, setDeleteWarningMsg] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Round 2 (Coding) State
  const [codingExams, setCodingExams] = useState<CodingExamDto[]>([]);
  const [selectedCodingExam, setSelectedCodingExam] = useState<CodingExamDto | null>(null);
  const [codingExamToDelete, setCodingExamToDelete] = useState<CodingExamDto | null>(null);

  // Shared Search & Status Filter
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

  const fetchCodingExams = () => {
    const list = getSavedCodingExams();
    setCodingExams(list);
  };

  useEffect(() => {
    fetchExams();
    fetchCodingExams();
  }, []);

  // Round 1 (MCQ) Actions
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

  // Round 2 (Coding) Actions
  const handlePublishCoding = (id: string | number) => {
    const updated = publishCodingExam(id);
    if (updated) {
      fetchCodingExams();
      setActionNotice(`Coding assessment "${updated.title}" is now LIVE and PUBLISHED.`);
    }
  };

  const handleCloseCoding = (id: string | number) => {
    const updated = closeCodingExam(id);
    if (updated) {
      fetchCodingExams();
      setActionNotice(`Coding assessment "${updated.title}" closed.`);
    }
  };

  const handleDeleteCodingConfirm = () => {
    if (!codingExamToDelete) return;
    deleteCodingExam(codingExamToDelete.id || "");
    fetchCodingExams();
    setActionNotice(`Coding assessment "${codingExamToDelete.title}" was removed.`);
    setCodingExamToDelete(null);
  };

  // Filter Round 1 MCQ Exams
  const filteredExams = exams.filter(e => {
    const matchesSearch = 
      e.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.description && e.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      String(e.id).includes(searchQuery);

    const matchesStatus = statusFilter === "ALL" || e.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Filter Round 2 Coding Exams
  const filteredCodingExams = codingExams.filter(c => {
    const matchesSearch = 
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
      String(c.id || "").toLowerCase().includes(searchQuery.toLowerCase());

    const isArchived = c.status === "ARCHIVED";
    const matchesStatus = 
      statusFilter === "ALL" || 
      c.status === statusFilter || 
      (statusFilter === "COMPLETED" && isArchived);

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
            Manage Round 1 (MCQ Assessment) and Round 2 (Coding Assessment) examination lifecycles
          </p>
        </div>
        <div className="admin-page-actions" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button 
            type="button"
            className="admin-btn secondary" 
            onClick={() => {
              fetchExams();
              fetchCodingExams();
            }}
            title="Refresh examinations"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
          >
            <RotateCcw size={14} /> Refresh
          </button>
          
          {selectedRound === "ROUND_1" ? (
            <button 
              type="button"
              className="admin-btn primary" 
              onClick={() => navigate("/admin/exams/new/mcq")}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "8px", background: "linear-gradient(135deg, #017846, #01663C)", color: "#ffffff", border: "none", fontSize: "12.5px", fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(1, 120, 70, 0.25)" }}
            >
              <PlusCircle size={15} /> Create MCQ Exam
            </button>
          ) : (
            <button 
              type="button"
              className="admin-btn primary" 
              onClick={() => navigate("/admin/exams/new/coding")}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "8px", background: "linear-gradient(135deg, #0284c7, #0369a1)", color: "#ffffff", border: "none", fontSize: "12.5px", fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(2, 132, 199, 0.25)" }}
            >
              <PlusCircle size={15} /> Create Coding Exam
            </button>
          )}
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
            Γ£ò
          </button>
        </div>
      )}

      {/* ========================================================
          ROUND SELECTION TABS (ROUND 1 MCQ vs ROUND 2 CODING)
          ======================================================== */}
      <div className="candidate-round-tabs" style={{ marginBottom: "16px" }}>
        <button
          type="button"
          className={`candidate-round-tab ${selectedRound === "ROUND_1" ? "active" : ""}`}
          onClick={() => setSelectedRound("ROUND_1")}
        >
          <CheckSquare size={16} />
          <span>Round 1 ΓÇö MCQ Assessment</span>
          <span className="candidate-round-count">{exams.length}</span>
        </button>

        <button
          type="button"
          className={`candidate-round-tab round2 ${selectedRound === "ROUND_2" ? "active round2" : ""}`}
          onClick={() => setSelectedRound("ROUND_2")}
        >
          <Code2 size={16} />
          <span>Round 2 ΓÇö Coding Assessment</span>
          <span className="candidate-round-count">{codingExams.length}</span>
        </button>
      </div>

      {/* Round Overview Banner */}
      <div
        style={{
          background: selectedRound === "ROUND_1" ? "#f0fdf4" : "#eff6ff",
          border: `1px solid ${selectedRound === "ROUND_1" ? "#bbf7d0" : "#bfdbfe"}`,
          borderRadius: "12px",
          padding: "12px 18px",
          marginBottom: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 800,
              padding: "3px 8px",
              borderRadius: "6px",
              background: selectedRound === "ROUND_1" ? "#017846" : "#0284c7",
              color: "#ffffff",
              letterSpacing: "0.4px"
            }}
          >
            {selectedRound === "ROUND_1" ? "ROUND 1: MCQ ASSESSMENT" : "ROUND 2: CODING ASSESSMENT"}
          </span>
          <span style={{ fontSize: "13px", color: selectedRound === "ROUND_1" ? "#166534" : "#1e40af", fontWeight: 600 }}>
            {selectedRound === "ROUND_1" 
              ? "Multiple-choice assessment with 4-set question shuffling (Sets AΓÇôD), section timing & automated grading."
              : "Technical programming evaluation with multi-language runtime execution, custom testcases & memory limits."}
          </span>
        </div>

        <button
          type="button"
          onClick={() => navigate(selectedRound === "ROUND_1" ? "/admin/exams/new/mcq" : "/admin/exams/new/coding")}
          style={{
            background: "none",
            border: "none",
            color: selectedRound === "ROUND_1" ? "#017846" : "#0284c7",
            fontSize: "12.5px",
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "5px"
          }}
        >
          <PlusCircle size={14} />
          {selectedRound === "ROUND_1" ? "Configure New MCQ Exam" : "Configure New Coding Exam"}
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-search-row">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input 
            type="text" 
            placeholder={`Search ${selectedRound === "ROUND_1" ? "MCQ" : "coding"} examinations by title, description or ID...`} 
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

      {/* ========================================================
          TABLE 1: ROUND 1 (MCQ) EXAMINATIONS
          ======================================================== */}
      {selectedRound === "ROUND_1" && (
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
                      Loading MCQ examinations from PostgreSQL database...
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
                      <p style={{ margin: 0, fontWeight: 700, fontSize: "14px", color: "#1e293b" }}>No MCQ examinations found</p>
                      <small style={{ color: "#64748b", display: "block", marginTop: "4px" }}>
                        Create a Round 1 MCQ examination using the button above to begin configuring question sets AΓÇôD.
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
      )}

      {/* ========================================================
          TABLE 2: ROUND 2 (CODING) EXAMINATIONS
          ======================================================== */}
      {selectedRound === "ROUND_2" && (
        <div className="admin-table-card">
          <div className="table-responsive">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Coding Exam & ID</th>
                  <th>Target Departments</th>
                  <th>Duration & Problems</th>
                  <th>Marks & Evaluation</th>
                  <th>Allowed Languages</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCodingExams.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", padding: "50px 20px", color: "#64748b" }}>
                      <Code2 size={36} color="#cbd5e1" style={{ margin: "0 auto 10px" }} />
                      <p style={{ margin: 0, fontWeight: 700, fontSize: "14px", color: "#1e293b" }}>No Coding Assessments Found</p>
                      <small style={{ color: "#64748b", display: "block", marginTop: "4px" }}>
                        Click "+ Create Coding Exam" above to configure problems, test cases, and multi-language evaluation.
                      </small>
                    </td>
                  </tr>
                ) : (
                  filteredCodingExams.map(cExam => {
                    const statusClass = cExam.status === "PUBLISHED" ? "published" : cExam.status === "ARCHIVED" ? "completed" : "draft";
                    return (
                      <tr key={String(cExam.id)}>
                        <td>
                          <div style={{ fontWeight: 700, color: "#0f172a", fontSize: "13.5px", display: "flex", alignItems: "center", gap: "6px" }}>
                            <FileCode2 size={15} color="#0284c7" />
                            {cExam.title}
                          </div>
                          <small style={{ color: "#64748b", fontFamily: "JetBrains Mono, monospace" }}>
                            ID: {String(cExam.id)}
                          </small>
                        </td>
                        <td>
                          {cExam.selectedDepartments && cExam.selectedDepartments.length > 0 ? (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "5px" }}>
                              {cExam.selectedDepartments.map((dept, i) => (
                                <span 
                                  key={i} 
                                  className="admin-dept-chip"
                                  style={{ background: "#eff6ff", color: "#1e40af", borderColor: "#bfdbfe" }}
                                >
                                  {dept}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: "11px", color: "#94a3b8" }}>All Departments</span>
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{cExam.durationMinutes} mins</div>
                          <small style={{ color: "#0284c7", fontWeight: 600 }}>
                            {cExam.questions?.length || 0} Coding Problem{(cExam.questions?.length || 0) === 1 ? "" : "s"}
                          </small>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{cExam.totalMarks} Marks</div>
                          <small style={{ color: "#16a34a", fontWeight: 600 }}>
                            Pass: {cExam.qualificationPercentage}% ΓÇó {cExam.evaluationMode === "PARTIAL_PER_TESTCASE" ? "Partial" : "All/Nothing"}
                          </small>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                            {cExam.allowedLanguages && cExam.allowedLanguages.slice(0, 3).map((lang, idx) => (
                              <span 
                                key={idx}
                                style={{
                                  fontSize: "10.5px",
                                  fontWeight: 700,
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background: "#f1f5f9",
                                  color: "#334155",
                                  fontFamily: "JetBrains Mono, monospace",
                                  border: "1px solid #e2e8f0"
                                }}
                              >
                                {lang.toUpperCase()}
                              </span>
                            ))}
                            {cExam.allowedLanguages && cExam.allowedLanguages.length > 3 && (
                              <span style={{ fontSize: "10px", color: "#64748b", alignSelf: "center" }}>
                                +{cExam.allowedLanguages.length - 3}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`status-pill ${statusClass}`}>
                            {cExam.status === "ARCHIVED" ? "COMPLETED" : cExam.status}
                          </span>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <div className="admin-action-btn-group">
                            {/* View Coding Details Modal */}
                            <button 
                              type="button"
                              className="btn-view" 
                              title="View Assessment Problems & Details"
                              onClick={() => setSelectedCodingExam(cExam)}
                            >
                              <Eye size={12} /> View
                            </button>

                            {/* Configure / Edit */}
                            <button 
                              type="button"
                              className="btn-sets" 
                              title="Configure in Wizard"
                              style={{ color: "#0284c7", borderColor: "#bfdbfe", background: "#f0f9ff" }}
                              onClick={() => navigate("/admin/exams/new/coding")}
                            >
                              <Code2 size={12} /> Edit
                            </button>

                            {/* Publish Coding Exam */}
                            {cExam.status === "DRAFT" && (
                              <button 
                                type="button"
                                className="btn-publish" 
                                title="Publish Coding Assessment"
                                onClick={() => handlePublishCoding(cExam.id || "")}
                              >
                                <CheckCircle size={12} /> Publish
                              </button>
                            )}

                            {/* Close Coding Exam */}
                            {cExam.status === "PUBLISHED" && (
                              <button 
                                type="button"
                                className="btn-close-exam" 
                                title="Close / Archive Assessment"
                                onClick={() => handleCloseCoding(cExam.id || "")}
                              >
                                <Clock size={12} /> Close
                              </button>
                            )}

                            {/* Results */}
                            <button 
                              type="button"
                              className="btn-results" 
                              title="View Round 2 Results"
                              onClick={() => navigate("/admin/results")}
                            >
                              <BarChart2 size={12} /> Results
                            </button>

                            {/* Delete Coding Exam Action */}
                            <button 
                              type="button"
                              className="btn-delete" 
                              title="Delete Coding Assessment"
                              onClick={() => setCodingExamToDelete(cExam)}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================
          DELETE MCQ EXAM CONFIRMATION MODAL
          ======================================================== */}
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
              {deleteNeedsForce ? "Confirm Force Cascade Deletion" : "Delete MCQ Examination"}
            </h3>
            
            {deleteNeedsForce ? (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "14px", marginBottom: "16px" }}>
                <div style={{ color: "#991b1b", fontWeight: 700, fontSize: "13px", marginBottom: "6px" }}>
                  ΓÜá∩╕Å Active Candidate Attempts Detected
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

      {/* ========================================================
          DELETE CODING EXAM CONFIRMATION MODAL
          ======================================================== */}
      {codingExamToDelete && (
        <div 
          className="admin-modal-backdrop" 
          onClick={() => setCodingExamToDelete(null)}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", zIndex: 1100 }}
        >
          <div 
            className="admin-modal-box" 
            onClick={e => e.stopPropagation()} 
            style={{ 
              maxWidth: "480px", 
              width: "100%", 
              boxSizing: "border-box", 
              borderRadius: "12px", 
              padding: "24px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)"
            }}
          >
            <h3 style={{ margin: "0 0 12px 0", color: "#dc2626", display: "flex", alignItems: "center", gap: "8px", fontSize: "16px" }}>
              <Trash2 size={20} />
              Delete Coding Assessment
            </h3>
            
            <p style={{ fontSize: "13px", color: "#475569", lineHeight: 1.5, margin: "0 0 16px 0" }}>
              Are you sure you want to delete coding assessment <b>"{codingExamToDelete.title}"</b> (ID: {String(codingExamToDelete.id)})? 
              This will remove all associated coding problems and test case suites.
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "18px" }}>
              <button 
                type="button" 
                className="secondary" 
                onClick={() => setCodingExamToDelete(null)}
                style={{ padding: "8px 16px", fontSize: "13px" }}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="primary" 
                style={{ 
                  background: "#dc2626", 
                  borderColor: "#dc2626", 
                  padding: "8px 18px",
                  fontSize: "13px",
                  fontWeight: 600
                }} 
                onClick={handleDeleteCodingConfirm}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================
          ROUND 1 (MCQ) EXAM DETAILS MODAL
          ======================================================== */}
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
              <div><span style={{ color: "#64748b" }}>Assessment Type:</span> <b style={{ color: "#017846" }}>Round 1 (MCQ)</b></div>
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

      {/* ========================================================
          ROUND 2 (CODING) EXAM DETAILS MODAL
          ======================================================== */}
      {selectedCodingExam && (
        <div className="admin-modal-backdrop" onClick={() => setSelectedCodingExam(null)}>
          <div 
            className="admin-modal-box" 
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: "680px", maxHeight: "90vh", overflowY: "auto" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                  <span 
                    style={{
                      fontSize: "11px",
                      fontWeight: 800,
                      padding: "2px 8px",
                      borderRadius: "4px",
                      background: "#eff6ff",
                      color: "#0369a1",
                      border: "1px solid #bfdbfe"
                    }}
                  >
                    ROUND 2 CODING
                  </span>
                  <span className={`status-pill ${selectedCodingExam.status === "PUBLISHED" ? "published" : "draft"}`}>
                    {selectedCodingExam.status}
                  </span>
                </div>
                <h2 style={{ margin: "4px 0 0 0", fontSize: "18px", color: "#0f172a" }}>
                  {selectedCodingExam.title}
                </h2>
                <small style={{ color: "#64748b", fontFamily: "JetBrains Mono, monospace" }}>
                  Assessment ID: {String(selectedCodingExam.id)}
                </small>
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

            <p style={{ fontSize: "13px", color: "#475569", lineHeight: 1.5, margin: "0 0 14px" }}>
              {selectedCodingExam.description || "No description provided."}
            </p>

            {/* Spec Details Grid */}
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(2, 1fr)", 
              gap: "12px", 
              background: "#f8fafc", 
              padding: "14px", 
              borderRadius: "8px", 
              marginBottom: "16px",
              fontSize: "12px"
            }}>
              <div><span style={{ color: "#64748b" }}>Duration:</span> <b>{selectedCodingExam.durationMinutes} Minutes</b></div>
              <div><span style={{ color: "#64748b" }}>Timing Mode:</span> <b>{selectedCodingExam.timingMode}</b></div>
              <div><span style={{ color: "#64748b" }}>Total Marks:</span> <b>{selectedCodingExam.totalMarks} Marks</b></div>
              <div><span style={{ color: "#64748b" }}>Pass Threshold:</span> <b>{selectedCodingExam.qualificationPercentage}%</b></div>
              <div><span style={{ color: "#64748b" }}>Evaluation:</span> <b>{selectedCodingExam.evaluationMode === "PARTIAL_PER_TESTCASE" ? "Partial per Testcase" : "All or Nothing"}</b></div>
              <div>
                <span style={{ color: "#64748b" }}>Allowed Languages:</span>{" "}
                <b>{selectedCodingExam.allowedLanguages?.join(", ").toUpperCase() || "All"}</b>
              </div>
            </div>

            {/* Questions Roster */}
            <div style={{ marginTop: "12px" }}>
              <h4 style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", margin: "0 0 10px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Terminal size={15} color="#0284c7" />
                Coding Problems Included ({selectedCodingExam.questions?.length || 0})
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {selectedCodingExam.questions?.map((q, idx) => (
                  <div 
                    key={q.id || idx}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      padding: "10px 14px"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <strong style={{ fontSize: "13px", color: "#0f172a" }}>
                        {idx + 1}. {q.title}
                      </strong>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <span 
                          style={{
                            fontSize: "10.5px",
                            fontWeight: 700,
                            padding: "2px 7px",
                            borderRadius: "4px",
                            background: q.difficulty === "Easy" ? "#dcfce7" : q.difficulty === "Medium" ? "#fef3c7" : "#fee2e2",
                            color: q.difficulty === "Easy" ? "#166534" : q.difficulty === "Medium" ? "#92400e" : "#991b1b"
                          }}
                        >
                          {q.difficulty}
                        </span>
                        <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b" }}>
                          {q.maxMarks} Marks
                        </span>
                      </div>
                    </div>
                    <p style={{ fontSize: "12px", color: "#64748b", margin: 0, lineHeight: 1.4 }}>
                      {q.problemStatement.slice(0, 140)}...
                    </p>
                    <div style={{ marginTop: "6px", fontSize: "11px", color: "#0284c7", fontWeight: 600 }}>
                      Γ£ô {q.testCases?.filter(t => !t.isHidden).length || 0} Sample Cases | ≡ƒöÆ {q.testCases?.filter(t => t.isHidden).length || 0} Hidden Evaluation Cases
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "20px" }}>
              <button 
                type="button"
                className="secondary" 
                onClick={() => {
                  setSelectedCodingExam(null);
                  navigate("/admin/exams/new/coding");
                }}
              >
                Open in Wizard Editor
              </button>
              <button className="primary" onClick={() => setSelectedCodingExam(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
