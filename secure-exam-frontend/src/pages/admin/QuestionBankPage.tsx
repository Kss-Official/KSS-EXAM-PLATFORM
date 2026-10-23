import { useState, useEffect } from "react";
import { 
  ArrowLeft,
  UploadCloud,
  FileKey,
  Layers,
  Trash2,
  FileText,
  Edit3,
  Building2,
  ChevronRight,
  AlertTriangle,
  Save,
  X,
  Plus
} from "lucide-react";
import { 
  getAllExams, 
  getExamDepartments,
  getExamDepartmentSets,
  getQuestionsByDeptAndSet,
  bulkUpdateSetQuestions,
  deleteAllQuestionsInSet,
  deleteQuestionSet,
  addQuestionToSet, 
  deleteQuestion, 
  importQuestionsText, 
  applyAnswerKey,
  uploadDeptSetDocument,
  type ExamDto, 
  type ExamDepartmentSummary,
  type DepartmentSetSummary,
  type QuestionDto
} from "../../services/api";
import { useRouter } from "../../router";

export default function QuestionBankPage() {
  const { navigate } = useRouter();

  // Navigation Hierarchy State
  // Level 1: selectedDept === null, selectedSetCode === null (Department List)
  // Level 2: selectedDept !== null, selectedSetCode === null (Department 4-Sets Overview)
  // Level 3: selectedDept !== null, selectedSetCode !== null (Dedicated Set Question Bank)
  const [exams, setExams] = useState<ExamDto[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  
  const [departments, setDepartments] = useState<ExamDepartmentSummary[]>([]);
  const [selectedDept, setSelectedDept] = useState<ExamDepartmentSummary | null>(null);

  const [departmentSets, setDepartmentSets] = useState<DepartmentSetSummary[]>([]);
  const [selectedSetCode, setSelectedSetCode] = useState<"A" | "B" | "C" | "D" | null>(null);

  const [questions, setQuestions] = useState<QuestionDto[]>([]);

  // UI & Loading States
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [loadingSets, setLoadingSets] = useState(false);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Set-Level Editing State (Edit Mode)
  const [isEditingSet, setIsEditingSet] = useState(false);
  const [editDraftQuestions, setEditDraftQuestions] = useState<QuestionDto[]>([]);
  const [savingSetBulk, setSavingSetBulk] = useState(false);

  // Add Question Drawer/Modal State
  const [showAddQuestionModal, setShowAddQuestionModal] = useState(false);
  const [submittingQuestion, setSubmittingQuestion] = useState(false);
  const [newQuestionText, setNewQuestionText] = useState("");
  const [optA, setOptA] = useState("");
  const [optB, setOptB] = useState("");
  const [optC, setOptC] = useState("");
  const [optD, setOptD] = useState("");
  const [correctOption, setCorrectOption] = useState<"A" | "B" | "C" | "D">("A");
  const [marks, setMarks] = useState("1");
  const [negativeMarks, setNegativeMarks] = useState("0");
  const [addQuestionError, setAddQuestionError] = useState<string | null>(null);

  // Sub-tabs in Level 3: Questions list, Batch Import, Answer Key, Document Vault
  const [activeSubTab, setActiveSubTab] = useState<"QUESTIONS" | "IMPORT" | "ANSWER_KEY" | "DOCUMENTS">("QUESTIONS");
  const [rawTextImport, setRawTextImport] = useState("");
  const [answerKeyInput, setAnswerKeyInput] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadDocType, setUploadDocType] = useState<"QUESTION_PAPER" | "ANSWER_KEY">("QUESTION_PAPER");

  // Deletion Confirmation Dialogs State
  const [confirmDeleteSetModal, setConfirmDeleteSetModal] = useState(false);
  const [confirmDeleteAllQuestionsModal, setConfirmDeleteAllQuestionsModal] = useState(false);
  const [deletingInProgress, setDeletingInProgress] = useState(false);

  // Active exam entity
  const selectedExam = exams.find(e => e.id === selectedExamId);
  const activeSet = departmentSets.find(s => s.setCode === selectedSetCode);

  // 1. Fetch All Exams on Mount
  useEffect(() => {
    let isCancelled = false;
    const fetchExams = async () => {
      try {
        const data = await getAllExams();
        if (!isCancelled) {
          setExams(data || []);
          if (data && data.length > 0) {
            setSelectedExamId(data[0].id);
          } else {
            setSelectedExamId(null);
            setDepartments([]);
            setSelectedDept(null);
            setSelectedSetCode(null);
          }
        }
      } catch (e) {
        console.warn("Could not load exams:", e);
        if (!isCancelled) {
          setExams([]);
          setSelectedExamId(null);
          setDepartments([]);
          setSelectedDept(null);
          setSelectedSetCode(null);
        }
      }
    };
    fetchExams();
    return () => { isCancelled = true; };
  }, []);

  // 2. Fetch Departments when selectedExamId changes
  const fetchDepartments = async () => {
    setLoadingDepts(true);
    setSelectedDept(null);
    setSelectedSetCode(null);
    setIsEditingSet(false);

    if (!selectedExamId) {
      setDepartments([]);
      setLoadingDepts(false);
      return;
    }

    try {
      const data = await getExamDepartments(selectedExamId);
      setDepartments(data || []);
    } catch (e) {
      console.warn("Could not fetch departments for exam:", e);
      setDepartments([]);
    } finally {
      setLoadingDepts(false);
    }
  };

  useEffect(() => {
    if (selectedExamId) {
      fetchDepartments();
    } else {
      setDepartments([]);
      setLoadingDepts(false);
    }
  }, [selectedExamId]);

  // 3. Fetch 4 Sets when selectedDept changes
  const fetchDepartmentSets = async () => {
    if (!selectedExamId || !selectedDept) return;
    setLoadingSets(true);
    setIsEditingSet(false);
    try {
      const sets = await getExamDepartmentSets(selectedExamId, selectedDept.id);
      setDepartmentSets(sets);
    } catch (e) {
      console.warn("Could not fetch department sets:", e);
    } finally {
      setLoadingSets(false);
    }
  };

  useEffect(() => {
    fetchDepartmentSets();
  }, [selectedExamId, selectedDept]);

  // 4. Fetch Questions when selectedSetCode changes
  const fetchSetQuestions = async () => {
    if (!selectedExamId || !selectedDept || !selectedSetCode) return;
    setLoadingQuestions(true);
    setIsEditingSet(false);
    try {
      const qList = await getQuestionsByDeptAndSet(selectedExamId, selectedDept.id, selectedSetCode);
      setQuestions(qList);
    } catch (e) {
      console.warn("Could not fetch set questions:", e);
    } finally {
      setLoadingQuestions(false);
    }
  };

  useEffect(() => {
    fetchSetQuestions();
  }, [selectedExamId, selectedDept, selectedSetCode]);

  // Start Set-Level Edit Mode
  const handleStartEditSet = () => {
    // Clone questions into draft
    setEditDraftQuestions(JSON.parse(JSON.stringify(questions)));
    setIsEditingSet(true);
  };

  const handleCancelEditSet = () => {
    setEditDraftQuestions([]);
    setIsEditingSet(false);
  };

  const handleSaveSetBulk = async () => {
    if (!activeSet) return;
    setSavingSetBulk(true);
    try {
      const updated = await bulkUpdateSetQuestions(activeSet.id, editDraftQuestions);
      setQuestions(updated);
      setIsEditingSet(false);
      setNotice({ type: "success", message: `Successfully updated ${updated.length} questions in Set ${selectedSetCode}!` });
      fetchDepartmentSets();
    } catch (err: unknown) {
      const errObj = err as Error;
      setNotice({ type: "error", message: `Failed to save changes: ${errObj.message}` });
    } finally {
      setSavingSetBulk(false);
    }
  };

  const handleAddQuestionToDraft = () => {
    const newDraft: QuestionDto = {
      questionText: "",
      marks: 1,
      negativeMarks: 0,
      displayOrder: editDraftQuestions.length + 1,
      options: [
        { optionText: "", correct: true, label: "A" },
        { optionText: "", correct: false, label: "B" },
        { optionText: "", correct: false, label: "C" },
        { optionText: "", correct: false, label: "D" }
      ]
    };
    setEditDraftQuestions(prev => [...prev, newDraft]);
  };

  const handleRemoveDraftQuestion = (index: number) => {
    setEditDraftQuestions(prev => prev.filter((_, i) => i !== index));
  };

  // Add Manual Question Modal Handlers
  const handleSaveManualQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSet) return;
    setAddQuestionError(null);

    if (!newQuestionText.trim() || !optA.trim() || !optB.trim() || !optC.trim() || !optD.trim()) {
      setAddQuestionError("Question prompt and all 4 options (A-D) are required.");
      return;
    }

    setSubmittingQuestion(true);
    try {
      await addQuestionToSet(activeSet.id, {
        questionText: newQuestionText.trim(),
        marks: parseFloat(marks) || 1,
        negativeMarks: parseFloat(negativeMarks) || 0,
        options: [
          { optionText: optA.trim(), correct: correctOption === "A", label: "A" },
          { optionText: optB.trim(), correct: correctOption === "B", label: "B" },
          { optionText: optC.trim(), correct: correctOption === "C", label: "C" },
          { optionText: optD.trim(), correct: correctOption === "D", label: "D" },
        ]
      });

      setNewQuestionText("");
      setOptA("");
      setOptB("");
      setOptC("");
      setOptD("");
      setShowAddQuestionModal(false);
      setNotice({ type: "success", message: `New MCQ question successfully added to Set ${selectedSetCode}!` });
      fetchSetQuestions();
      fetchDepartmentSets();
    } catch (err: unknown) {
      const errObj = err as Error;
      setAddQuestionError(errObj.message || "Failed to save question.");
    } finally {
      setSubmittingQuestion(false);
    }
  };

  // Delete Individual Question
  const handleDeleteQuestion = async (id?: number) => {
    if (!id) return;
    try {
      await deleteQuestion(id);
      setQuestions(prev => prev.filter(q => q.id !== id));
      setNotice({ type: "success", message: "Question successfully deleted." });
      fetchDepartmentSets();
    } catch (err: unknown) {
      const errObj = err as Error;
      setNotice({ type: "error", message: `Delete failed: ${errObj.message}` });
    }
  };

  // Delete All Questions in a Set
  const handleConfirmDeleteAllQuestions = async () => {
    if (!activeSet) return;
    setDeletingInProgress(true);
    try {
      await deleteAllQuestionsInSet(activeSet.id);
      setQuestions([]);
      setConfirmDeleteAllQuestionsModal(false);
      setNotice({ type: "success", message: `All questions in Set ${selectedSetCode} have been deleted successfully.` });
      fetchDepartmentSets();
    } catch (err: unknown) {
      const errObj = err as Error;
      setNotice({ type: "error", message: `Delete all questions failed: ${errObj.message}` });
    } finally {
      setDeletingInProgress(false);
    }
  };

  // Delete Question Set / Bank
  const handleConfirmDeleteSet = async () => {
    if (!activeSet) return;
    setDeletingInProgress(true);
    try {
      await deleteQuestionSet(activeSet.id);
      setConfirmDeleteSetModal(false);
      setSelectedSetCode(null);
      setNotice({ type: "success", message: `Question Set ${selectedSetCode} has been deleted or deactivated.` });
      fetchDepartmentSets();
    } catch (err: unknown) {
      const errObj = err as Error;
      setNotice({ type: "error", message: `Delete set failed: ${errObj.message}` });
    } finally {
      setDeletingInProgress(false);
    }
  };

  // Import Raw Text MCQs
  const handleImportText = async () => {
    if (!activeSet || !rawTextImport.trim()) return;
    try {
      const imported = await importQuestionsText(activeSet.id, rawTextImport);
      setNotice({ type: "success", message: `Successfully parsed and saved ${imported.length} MCQs to Set ${selectedSetCode}!` });
      setRawTextImport("");
      fetchSetQuestions();
      fetchDepartmentSets();
    } catch (err: unknown) {
      const errObj = err as Error;
      setNotice({ type: "error", message: `Import failed: ${errObj.message}` });
    }
  };

  // Apply Answer Key
  const handleApplyAnswerKey = async () => {
    if (!activeSet || !answerKeyInput.trim()) return;
    try {
      const res = await applyAnswerKey(activeSet.id, answerKeyInput);
      setNotice({ type: "success", message: `Answer key applied: ${res.mappedAnswers} questions updated for Set ${selectedSetCode}.` });
      setAnswerKeyInput("");
      fetchSetQuestions();
    } catch (err: unknown) {
      const errObj = err as Error;
      setNotice({ type: "error", message: `Answer key mapping failed: ${errObj.message}` });
    }
  };

  // Upload Document to Set
  const handleUploadDoc = async () => {
    if (!selectedExamId || !selectedDept || !activeSet || !uploadFile) return;
    try {
      const res = await uploadDeptSetDocument(selectedExamId, selectedDept.id, activeSet.id, uploadFile, uploadDocType);
      setNotice({ type: "success", message: `File "${res.originalFilename}" uploaded successfully for Set ${selectedSetCode}!` });
      setUploadFile(null);
      fetchDepartmentSets();
    } catch (err: unknown) {
      const errObj = err as Error;
      setNotice({ type: "error", message: `Upload failed: ${errObj.message}` });
    }
  };

  return (
    <div className="admin-page-container">
      {/* Top Header & Exam Selector */}
      <div className="admin-page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Layers size={20} color="#2563eb" />
            <strong style={{ fontSize: "16px", color: "#0f172a", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              Question Bank Management
            </strong>
          </div>
          <p style={{ margin: "3px 0 0", fontSize: "12.5px", color: "#64748b" }}>
            Department-wise examination question sets, answer keys, and confidentiality management
          </p>
        </div>

        {/* Active Exam Selector */}
        {exams.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 600 }}>Active Exam:</span>
            <select
              value={selectedExamId || ""}
              onChange={e => {
                setSelectedExamId(Number(e.target.value));
                setSelectedDept(null);
                setSelectedSetCode(null);
              }}
              style={{
                height: "38px",
                padding: "6px 14px",
                fontSize: "12.5px",
                borderRadius: "8px",
                border: "1.5px solid #cbd5e1",
                background: "#ffffff",
                color: "#0f172a",
                fontWeight: 600
              }}
            >
              {exams.map(e => (
                <option key={e.id} value={e.id}>
                  #{e.id} {e.title} ({e.status})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Global Notification Banner */}
      {notice && (
        <div style={{
          padding: "10px 14px",
          background: notice.type === "error" ? "#fef2f2" : "#f0fdf4",
          border: `1px solid ${notice.type === "error" ? "#fecaca" : "#bbf7d0"}`,
          color: notice.type === "error" ? "#991b1b" : "#166534",
          borderRadius: "8px",
          fontSize: "12.5px",
          marginBottom: "16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <span>{notice.message}</span>
          <button 
            type="button" 
            onClick={() => setNotice(null)} 
            style={{ background: "none", border: "none", color: "inherit", cursor: "pointer", fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {exams.length === 0 ? (
        <div style={{
          padding: "50px 30px",
          background: "#ffffff",
          border: "1px dashed #cbd5e1",
          borderRadius: "12px",
          textAlign: "center",
          maxWidth: "560px",
          margin: "40px auto",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)"
        }}>
          <div style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: "#eff6ff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px"
          }}>
            <Layers size={28} color="#2563eb" />
          </div>
          <h3 style={{ margin: "0 0 8px", fontSize: "17px", color: "#0f172a", fontWeight: 700 }}>
            No Active Examinations Found
          </h3>
          <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#64748b", lineHeight: "1.5" }}>
            When an examination is deleted, all its associated departments and questions are deleted from the Question Bank. Create a new examination to configure and manage question sets.
          </p>
          <button
            type="button"
            className="primary"
            onClick={() => navigate("/admin/exams/new")}
            style={{
              padding: "10px 20px",
              fontSize: "13px",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              borderRadius: "8px",
              margin: "0 auto"
            }}
          >
            <Plus size={15} /> Create Examination
          </button>
        </div>
      ) : (
        <>
          {/* Breadcrumb Navigation Trail */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginBottom: "16px",
            fontSize: "12.5px",
            color: "#64748b"
          }}>
            <button
              type="button"
              onClick={() => {
                setSelectedDept(null);
                setSelectedSetCode(null);
                setIsEditingSet(false);
              }}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: selectedDept ? "#2563eb" : "#0f172a",
                fontWeight: selectedDept ? 600 : 700,
                cursor: selectedDept ? "pointer" : "default"
              }}
            >
              {selectedExam ? selectedExam.title : "Examinations"}
            </button>

            {selectedDept && (
              <>
                <ChevronRight size={14} color="#94a3b8" />
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSetCode(null);
                    setIsEditingSet(false);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: selectedSetCode ? "#2563eb" : "#0f172a",
                    fontWeight: selectedSetCode ? 600 : 700,
                    cursor: selectedSetCode ? "pointer" : "default"
                  }}
                >
                  {selectedDept.name} ({selectedDept.code})
                </button>
              </>
            )}

            {selectedSetCode && (
              <>
                <ChevronRight size={14} color="#94a3b8" />
                <span style={{ fontWeight: 700, color: "#0f172a" }}>
                  Set {selectedSetCode} Question Bank
                </span>
              </>
            )}
          </div>

          {/* =========================================================================
              PAGE 1: DEPARTMENT LIST
              ========================================================================= */}
          {!selectedDept && (
            <div>
              <div style={{ marginBottom: "12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: "14px", color: "#1e293b" }}>
                  Select Department to Manage Question Bank
                </strong>
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  Showing {departments.length} department(s) associated with this examination
                </span>
              </div>

              {loadingDepts ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                  Loading departments for examination...
                </div>
              ) : departments.length === 0 ? (
                <div style={{
                  padding: "40px",
                  background: "#ffffff",
                  border: "1px dashed #cbd5e1",
                  borderRadius: "10px",
                  textAlign: "center"
                }}>
                  <Building2 size={36} color="#94a3b8" style={{ margin: "0 auto 10px" }} />
                  <h4 style={{ margin: "0 0 6px 0", color: "#1e293b" }}>No Departments Linked to This Examination</h4>
                  <p style={{ margin: "0 0 14px 0", fontSize: "13px", color: "#64748b" }}>
                    This examination currently does not have any configured departments.
                  </p>
                </div>
              ) : (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: "16px"
                }}>
              {departments.map(dept => (
                <div
                  key={dept.id}
                  onClick={() => setSelectedDept(dept)}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    padding: "16px",
                    cursor: "pointer",
                    boxShadow: "0 2px 6px rgba(15, 23, 42, 0.04)",
                    transition: "all 0.15s ease",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between"
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = "#3b82f6";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(37, 99, 235, 0.1)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = "#e2e8f0";
                    e.currentTarget.style.boxShadow = "0 2px 6px rgba(15, 23, 42, 0.04)";
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                      <b style={{ fontSize: "15px", color: "#0f172a" }}>{dept.name}</b>
                      <span style={{
                        fontSize: "11px",
                        background: "#eff6ff",
                        color: "#1d4ed8",
                        padding: "2px 7px",
                        borderRadius: "4px",
                        fontWeight: 700
                      }}>
                        {dept.code}
                      </span>
                    </div>

                    <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#64748b", lineHeight: 1.4 }}>
                      {dept.description || "Academic & functional department question sets"}
                    </p>
                  </div>

                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderTop: "1px solid #f1f5f9",
                    paddingTop: "10px",
                    fontSize: "12px"
                  }}>
                    <span style={{ color: "#166534", background: "#f0fdf4", padding: "2px 8px", borderRadius: "4px", fontWeight: 600 }}>
                      4 Sets (A, B, C, D)
                    </span>
                    <span style={{ color: "#2563eb", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      Open Sets <ChevronRight size={14} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          PAGE 2: DEPARTMENT QUESTION BANK OVERVIEW (Sets A, B, C, D)
          ========================================================================= */}
      {selectedDept && !selectedSetCode && (
        <div>
          <div style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              type="button"
              className="secondary"
              onClick={() => setSelectedDept(null)}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12.5px" }}
            >
              <ArrowLeft size={14} /> Back to Departments
            </button>

            <span style={{ fontSize: "12.5px", color: "#64748b" }}>
              Department: <b style={{ color: "#0f172a" }}>{selectedDept.name}</b> ({selectedDept.code})
            </span>
          </div>

          <div style={{
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            padding: "16px",
            marginBottom: "20px"
          }}>
            <h3 style={{ margin: "0 0 4px 0", fontSize: "15px", color: "#0f172a" }}>
              {selectedDept.name} — Question Sets Overview
            </h3>
            <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
              Each set is completely isolated. Candidates assigned to {selectedDept.name} receive one of these four independent sets in round-robin fashion.
            </p>
          </div>

          {loadingSets ? (
            <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>Loading question sets...</div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
              gap: "16px"
            }}>
              {(["A", "B", "C", "D"] as const).map(code => {
                const s = departmentSets.find(item => item.setCode === code);
                const qCount = s ? s.questionCount : 0;
                const hasPaper = s ? s.hasQuestionPaper : false;
                const hasKey = s ? s.hasAnswerKey : false;

                return (
                  <div
                    key={code}
                    onClick={() => setSelectedSetCode(code)}
                    style={{
                      background: "#ffffff",
                      border: "1.5px solid #e2e8f0",
                      borderRadius: "10px",
                      padding: "16px",
                      cursor: "pointer",
                      boxShadow: "0 2px 6px rgba(15, 23, 42, 0.04)",
                      transition: "all 0.15s ease",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between"
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = "#2563eb";
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(37, 99, 235, 0.12)";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = "#e2e8f0";
                      e.currentTarget.style.boxShadow = "0 2px 6px rgba(15, 23, 42, 0.04)";
                    }}
                  >
                    <div>
                      {/* Set Badge & Title */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{
                            width: "28px",
                            height: "28px",
                            lineHeight: "28px",
                            borderRadius: "50%",
                            background: "#2563eb",
                            color: "#ffffff",
                            textAlign: "center",
                            fontWeight: 700,
                            fontSize: "13px"
                          }}>
                            {code}
                          </span>
                          <strong style={{ fontSize: "15px", color: "#0f172a" }}>Set {code}</strong>
                        </div>

                        <span style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          background: qCount > 0 ? "#dcfce7" : "#f1f5f9",
                          color: qCount > 0 ? "#15803d" : "#64748b",
                          padding: "3px 8px",
                          borderRadius: "10px"
                        }}>
                          {qCount} MCQs
                        </span>
                      </div>

                      {/* Paper & Answer Key Status */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11.5px", marginBottom: "14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "#64748b" }}>Question Paper:</span>
                          <span style={{ fontWeight: 600, color: hasPaper ? "#166534" : "#94a3b8" }}>
                            {hasPaper ? "✓ Uploaded" : "Not Configured"}
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span style={{ color: "#64748b" }}>Answer Key:</span>
                          <span style={{ fontWeight: 600, color: hasKey ? "#166534" : "#94a3b8" }}>
                            {hasKey ? "✓ Uploaded" : "Not Configured"}
                          </span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="primary"
                      style={{
                        width: "100%",
                        fontSize: "12px",
                        padding: "7px 10px",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: "6px"
                      }}
                    >
                      Manage Set {code} <ChevronRight size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          PAGE 3: INDIVIDUAL SET QUESTION BANK (Exam → Department → Set A)
          ========================================================================= */}
      {selectedDept && selectedSetCode && (
        <div>
          {/* Top Set Action Bar */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
            marginBottom: "16px"
          }}>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                setSelectedSetCode(null);
                setIsEditingSet(false);
              }}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12.5px" }}
            >
              <ArrowLeft size={14} /> Back to Sets ({selectedDept.name})
            </button>

            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              {!isEditingSet ? (
                <>
                  <button
                    type="button"
                    className="secondary"
                    onClick={handleStartEditSet}
                    style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "5px" }}
                  >
                    <Edit3 size={14} /> Edit Set
                  </button>

                  <button
                    type="button"
                    className="primary"
                    onClick={() => setShowAddQuestionModal(true)}
                    style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "5px" }}
                  >
                    <Plus size={14} /> + Add Question
                  </button>

                  {questions.length > 0 && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setConfirmDeleteAllQuestionsModal(true)}
                      style={{ fontSize: "12px", color: "#dc2626", border: "1px solid #fecaca", background: "#fef2f2" }}
                    >
                      Delete All Questions
                    </button>
                  )}

                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setConfirmDeleteSetModal(true)}
                    style={{ fontSize: "12px", color: "#991b1b", border: "1px solid #cbd5e1" }}
                  >
                    Delete Set
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="secondary"
                    onClick={handleCancelEditSet}
                    disabled={savingSetBulk}
                    style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "5px" }}
                  >
                    <X size={14} /> Cancel
                  </button>

                  <button
                    type="button"
                    className="primary"
                    onClick={handleSaveSetBulk}
                    disabled={savingSetBulk}
                    style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "5px" }}
                  >
                    <Save size={14} /> {savingSetBulk ? "Saving Changes..." : "Save Changes"}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Sub-tabs: Questions List, Batch Import, Apply Key, Private Document Vault */}
          {!isEditingSet && (
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap", borderBottom: "1px solid #e2e8f0", paddingBottom: "10px" }}>
              <button
                type="button"
                className={activeSubTab === "QUESTIONS" ? "btn-sets" : "btn-results"}
                style={{ fontSize: "12px", padding: "6px 12px", borderRadius: "6px" }}
                onClick={() => setActiveSubTab("QUESTIONS")}
              >
                Questions ({questions.length})
              </button>
              <button
                type="button"
                className={activeSubTab === "IMPORT" ? "btn-sets" : "btn-results"}
                style={{ fontSize: "12px", padding: "6px 12px", borderRadius: "6px" }}
                onClick={() => setActiveSubTab("IMPORT")}
              >
                <UploadCloud size={13} /> Batch Text Import
              </button>
              <button
                type="button"
                className={activeSubTab === "ANSWER_KEY" ? "btn-sets" : "btn-results"}
                style={{ fontSize: "12px", padding: "6px 12px", borderRadius: "6px" }}
                onClick={() => setActiveSubTab("ANSWER_KEY")}
              >
                <FileKey size={13} /> Apply Answer Key
              </button>
              <button
                type="button"
                className={activeSubTab === "DOCUMENTS" ? "btn-sets" : "btn-results"}
                style={{ fontSize: "12px", padding: "6px 12px", borderRadius: "6px" }}
                onClick={() => setActiveSubTab("DOCUMENTS")}
              >
                <FileText size={13} /> Document Storage
              </button>
            </div>
          )}

          {/* Tab 2: Batch Text Import */}
          {activeSubTab === "IMPORT" && !isEditingSet && (
            <div className="admin-form-card" style={{ marginBottom: "20px" }}>
              <h4 style={{ margin: "0 0 8px 0" }}>Batch Text Import for {selectedDept.name} — Set {selectedSetCode}</h4>
              <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#64748b" }}>
                Paste questions in structured format (e.g. Q1. Text... A) Opt1 B) Opt2 C) Opt3 D) Opt4 Ans: B).
              </p>
              <textarea
                rows={6}
                value={rawTextImport}
                onChange={e => setRawTextImport(e.target.value)}
                placeholder="Q1. What is Java?&#10;A) Language&#10;B) Coffee&#10;C) Island&#10;D) Browser&#10;Ans: A"
                style={{ width: "100%", padding: "10px", fontSize: "12px", border: "1px solid #cbd5e1", borderRadius: "6px", fontFamily: "monospace" }}
              />
              <div style={{ textAlign: "right", marginTop: "10px" }}>
                <button type="button" className="primary" onClick={handleImportText} style={{ fontSize: "12px", padding: "8px 16px" }}>
                  Parse & Save MCQs to Set {selectedSetCode}
                </button>
              </div>
            </div>
          )}

          {/* Tab 3: Answer Key Mapping */}
          {activeSubTab === "ANSWER_KEY" && !isEditingSet && (
            <div className="admin-form-card" style={{ marginBottom: "20px" }}>
              <h4 style={{ margin: "0 0 8px 0" }}>Official Answer Key Mapping for {selectedDept.name} — Set {selectedSetCode}</h4>
              <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#64748b" }}>
                Map correct answers to questions (Format: <code>1. B, 2. D, 3. A</code> or <code>1:B\n2:D</code>).
              </p>
              <textarea
                rows={3}
                value={answerKeyInput}
                onChange={e => setAnswerKeyInput(e.target.value)}
                placeholder="1. B, 2. A, 3. C, 4. D"
                style={{ width: "100%", padding: "10px", fontSize: "12px", border: "1px solid #cbd5e1", borderRadius: "6px", fontFamily: "monospace" }}
              />
              <div style={{ textAlign: "right", marginTop: "10px" }}>
                <button type="button" className="primary" onClick={handleApplyAnswerKey} style={{ fontSize: "12px", padding: "8px 16px" }}>
                  Apply Answer Key to Set {selectedSetCode}
                </button>
              </div>
            </div>
          )}

          {/* Tab 4: Private Document Storage */}
          {activeSubTab === "DOCUMENTS" && !isEditingSet && (
            <div className="admin-form-card" style={{ marginBottom: "20px" }}>
              <h4 style={{ margin: "0 0 8px 0" }}>Upload Confidential Paper / Key for {selectedDept.name} — Set {selectedSetCode}</h4>
              <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#64748b" }}>
                Stored in private encrypted vault with SHA-256 integrity checksums. Accessible only to authorized administrators.
              </p>
              <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                <select
                  value={uploadDocType}
                  onChange={e => setUploadDocType(e.target.value as any)}
                  style={{ padding: "8px", fontSize: "12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                >
                  <option value="QUESTION_PAPER">Question Paper (PDF/DOCX)</option>
                  <option value="ANSWER_KEY">Official Answer Key (TXT/CSV)</option>
                </select>
                <input 
                  type="file" 
                  accept=".pdf,.docx,.txt,.csv"
                  onChange={e => setUploadFile(e.target.files ? e.target.files[0] : null)}
                  style={{ fontSize: "12px" }}
                />
                <button 
                  type="button" 
                  className="primary" 
                  disabled={!uploadFile}
                  onClick={handleUploadDoc}
                  style={{ fontSize: "12px", padding: "8px 16px" }}
                >
                  Upload to Vault
                </button>
              </div>
            </div>
          )}

          {/* Set-Level Edit Mode View */}
          {isEditingSet && (
            <div style={{ marginBottom: "24px" }}>
              <div style={{
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                borderRadius: "8px",
                padding: "12px 16px",
                marginBottom: "16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <div>
                  <strong style={{ color: "#1e40af", fontSize: "13px" }}>Set-Level Edit Mode Active:</strong>
                  <span style={{ marginLeft: "8px", fontSize: "12px", color: "#3b82f6" }}>
                    Editing all questions for {selectedDept.name} — Set {selectedSetCode}. Changes apply only upon clicking "Save Changes".
                  </span>
                </div>
                <button
                  type="button"
                  className="secondary"
                  onClick={handleAddQuestionToDraft}
                  style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                >
                  <Plus size={14} /> Add Another Question
                </button>
              </div>

              {editDraftQuestions.length === 0 ? (
                <div style={{ padding: "30px", textAlign: "center", background: "#ffffff", border: "1px dashed #cbd5e1", borderRadius: "8px" }}>
                  <p style={{ margin: "0 0 10px 0", color: "#64748b" }}>No questions in draft list.</p>
                  <button type="button" className="primary" onClick={handleAddQuestionToDraft} style={{ fontSize: "12px" }}>
                    + Add First Question
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {editDraftQuestions.map((draft, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: "8px",
                        padding: "16px",
                        boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                        <span style={{ fontWeight: 700, color: "#2563eb", fontSize: "13px" }}>Question #{idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveDraftQuestion(idx)}
                          style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: "12px" }}
                        >
                          <Trash2 size={14} /> Remove
                        </button>
                      </div>

                      <div style={{ marginBottom: "10px" }}>
                        <label style={{ display: "block", fontSize: "11.5px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                          Question Text *
                        </label>
                        <textarea
                          rows={2}
                          value={draft.questionText}
                          onChange={e => {
                            const val = e.target.value;
                            setEditDraftQuestions(prev => {
                              const copy = [...prev];
                              copy[idx].questionText = val;
                              return copy;
                            });
                          }}
                          style={{ width: "100%", padding: "8px", fontSize: "12.5px", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                        />
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px", marginBottom: "10px" }}>
                        {(["A", "B", "C", "D"] as const).map((label, optIdx) => {
                          const opt = draft.options[optIdx] || { optionText: "", correct: false, label };
                          return (
                            <div key={label}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                                <label style={{ fontSize: "11px", fontWeight: 600, color: "#475569" }}>Option {label}</label>
                                <label style={{ fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "3px", cursor: "pointer", color: opt.correct ? "#16a34a" : "#64748b" }}>
                                  <input
                                    type="radio"
                                    name={`correct_${idx}`}
                                    checked={opt.correct}
                                    onChange={() => {
                                      setEditDraftQuestions(prev => {
                                        const copy = [...prev];
                                        copy[idx].options.forEach((o, i) => { o.correct = (i === optIdx); });
                                        return copy;
                                      });
                                    }}
                                  />
                                  Correct Answer
                                </label>
                              </div>
                              <input
                                type="text"
                                value={opt.optionText}
                                onChange={e => {
                                  const val = e.target.value;
                                  setEditDraftQuestions(prev => {
                                    const copy = [...prev];
                                    if (copy[idx].options[optIdx]) {
                                      copy[idx].options[optIdx].optionText = val;
                                    }
                                    return copy;
                                  });
                                }}
                                style={{
                                  width: "100%",
                                  padding: "6px 8px",
                                  fontSize: "12px",
                                  border: opt.correct ? "1.5px solid #86efac" : "1px solid #cbd5e1",
                                  borderRadius: "6px",
                                  background: opt.correct ? "#f0fdf4" : "#ffffff"
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
                        <div>
                          <label style={{ display: "block", fontSize: "11px", color: "#475569" }}>Marks</label>
                          <input
                            type="number"
                            value={draft.marks !== undefined ? draft.marks : 1}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 1;
                              setEditDraftQuestions(prev => {
                                const copy = [...prev];
                                copy[idx].marks = val as any;
                                return copy;
                              });
                            }}
                            style={{ width: "100%", padding: "6px 8px", fontSize: "12px", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                          />
                        </div>
                        <div>
                          <label style={{ display: "block", fontSize: "11px", color: "#475569" }}>Negative Marks</label>
                          <input
                            type="number"
                            value={draft.negativeMarks !== undefined ? draft.negativeMarks : 0}
                            onChange={e => {
                              const val = parseFloat(e.target.value) || 0;
                              setEditDraftQuestions(prev => {
                                const copy = [...prev];
                                copy[idx].negativeMarks = val as any;
                                return copy;
                              });
                            }}
                            style={{ width: "100%", padding: "6px 8px", fontSize: "12px", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Normal Set Questions Display Table */}
          {!isEditingSet && activeSubTab === "QUESTIONS" && (
            <div className="admin-table-card">
              <div style={{
                padding: "12px 16px",
                borderBottom: "1px solid #f1f5f9",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <strong style={{ fontSize: "13.5px", color: "#0f172a" }}>
                  {selectedDept.name} — Set {selectedSetCode} Questions ({questions.length} Total)
                </strong>
                <small style={{ color: "#64748b" }}>Isolated question bank for Set {selectedSetCode}</small>
              </div>

              {loadingQuestions ? (
                <div style={{ padding: "30px", textAlign: "center", color: "#64748b" }}>Loading questions for Set {selectedSetCode}...</div>
              ) : questions.length === 0 ? (
                <div style={{ padding: "40px", textAlign: "center", color: "#64748b" }}>
                  <p style={{ margin: "0 0 10px 0" }}>No questions in Set {selectedSetCode} yet.</p>
                  <button
                    type="button"
                    className="primary"
                    onClick={() => setShowAddQuestionModal(true)}
                    style={{ fontSize: "12px" }}
                  >
                    + Add First Question to Set {selectedSetCode}
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {questions.map((q, idx) => (
                    <div
                      key={q.id}
                      style={{
                        padding: "14px 16px",
                        borderBottom: "1px solid #f8fafc",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start"
                      }}
                    >
                      <div style={{ maxWidth: "88%" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                          <span style={{ fontWeight: 700, color: "#2563eb", fontSize: "13px" }}>Q{idx + 1}.</span>
                          <span style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>{q.questionText}</span>
                          <span style={{ fontSize: "10.5px", background: "#f1f5f9", color: "#475569", padding: "1px 6px", borderRadius: "4px" }}>
                            +{q.marks} / -{q.negativeMarks}
                          </span>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", marginTop: "8px" }}>
                          {q.options.map(opt => (
                            <div 
                              key={opt.id} 
                              style={{
                                fontSize: "12px",
                                padding: "6px 10px",
                                borderRadius: "6px",
                                background: opt.correct ? "#f0fdf4" : "#f8fafc",
                                border: opt.correct ? "1px solid #86efac" : "1px solid #e2e8f0",
                                color: opt.correct ? "#166534" : "#334155",
                                fontWeight: opt.correct ? 600 : 400
                              }}
                            >
                              <b>{opt.label})</b> {opt.optionText} {opt.correct && "✓ (Correct)"}
                            </div>
                          ))}
                        </div>
                      </div>

                      <button
                        type="button"
                        className="secondary"
                        onClick={() => handleDeleteQuestion(q.id)}
                        style={{ color: "#dc2626", padding: "4px 8px", fontSize: "11px" }}
                        title="Delete Question"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
        </>
      )}

      {/* =========================================================================
          MODAL 1: ADD QUESTION MODAL (Clean popup for + Add Question)
          ========================================================================= */}
      {showAddQuestionModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.5)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 9999,
          padding: "20px"
        }}>
          <form
            onSubmit={handleSaveManualQuestion}
            style={{
              background: "#ffffff",
              borderRadius: "10px",
              width: "100%",
              maxWidth: "600px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
              overflow: "hidden"
            }}
          >
            <div style={{
              padding: "14px 18px",
              background: "#f8fafc",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <strong style={{ fontSize: "14px", color: "#0f172a" }}>
                  Add Question to {selectedDept?.name} — Set {selectedSetCode}
                </strong>
                <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>
                  Exam: {selectedExam?.title}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowAddQuestionModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ padding: "18px", display: "flex", flexDirection: "column", gap: "12px", maxHeight: "75vh", overflowY: "auto" }}>
              {addQuestionError && (
                <div style={{ color: "#dc2626", fontSize: "11.5px", background: "#fef2f2", padding: "8px", borderRadius: "6px" }}>
                  {addQuestionError}
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                  Question Text *
                </label>
                <textarea
                  rows={2}
                  placeholder="Enter MCQ prompt..."
                  value={newQuestionText}
                  onChange={e => setNewQuestionText(e.target.value)}
                  style={{ width: "100%", padding: "8px", fontSize: "12.5px", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "11px", color: "#475569" }}>Option A *</label>
                  <input type="text" value={optA} onChange={e => setOptA(e.target.value)} style={{ width: "100%", padding: "7px", fontSize: "12px", border: "1px solid #cbd5e1", borderRadius: "6px" }} />
                </div>
                <div>
                  <label style={{ fontSize: "11px", color: "#475569" }}>Option B *</label>
                  <input type="text" value={optB} onChange={e => setOptB(e.target.value)} style={{ width: "100%", padding: "7px", fontSize: "12px", border: "1px solid #cbd5e1", borderRadius: "6px" }} />
                </div>
                <div>
                  <label style={{ fontSize: "11px", color: "#475569" }}>Option C *</label>
                  <input type="text" value={optC} onChange={e => setOptC(e.target.value)} style={{ width: "100%", padding: "7px", fontSize: "12px", border: "1px solid #cbd5e1", borderRadius: "6px" }} />
                </div>
                <div>
                  <label style={{ fontSize: "11px", color: "#475569" }}>Option D *</label>
                  <input type="text" value={optD} onChange={e => setOptD(e.target.value)} style={{ width: "100%", padding: "7px", fontSize: "12px", border: "1px solid #cbd5e1", borderRadius: "6px" }} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                    Correct Answer *
                  </label>
                  <select
                    value={correctOption}
                    onChange={e => setCorrectOption(e.target.value as any)}
                    style={{ width: "100%", padding: "7px", fontSize: "12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#ffffff" }}
                  >
                    <option value="A">Option A</option>
                    <option value="B">Option B</option>
                    <option value="C">Option C</option>
                    <option value="D">Option D</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Marks</label>
                  <input type="number" value={marks} onChange={e => setMarks(e.target.value)} style={{ width: "100%", padding: "7px", fontSize: "12px", border: "1px solid #cbd5e1", borderRadius: "6px" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>Negative Marks</label>
                  <input type="number" value={negativeMarks} onChange={e => setNegativeMarks(e.target.value)} style={{ width: "100%", padding: "7px", fontSize: "12px", border: "1px solid #cbd5e1", borderRadius: "6px" }} />
                </div>
              </div>
            </div>

            <div style={{
              padding: "12px 18px",
              background: "#f8fafc",
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px"
            }}>
              <button
                type="button"
                className="secondary"
                onClick={() => setShowAddQuestionModal(false)}
                disabled={submittingQuestion}
                style={{ fontSize: "12px", padding: "7px 14px" }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="primary"
                disabled={submittingQuestion}
                style={{ fontSize: "12px", padding: "7px 16px" }}
              >
                {submittingQuestion ? "Saving..." : "Save Question"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: DELETE SET CONFIRMATION MODAL
          ========================================================================= */}
      {confirmDeleteSetModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.5)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 9999,
          padding: "20px"
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: "10px",
            width: "100%",
            maxWidth: "480px",
            padding: "20px",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <AlertTriangle size={22} color="#dc2626" />
              <strong style={{ fontSize: "15px", color: "#991b1b" }}>Confirm Delete Question Set</strong>
            </div>

            <p style={{ fontSize: "13px", color: "#334155", margin: "0 0 14px 0", lineHeight: 1.5 }}>
              Are you sure you want to delete or deactivate <b>Set {selectedSetCode}</b> for department <b>{selectedDept?.name}</b> under examination <b>{selectedExam?.title}</b>?
            </p>

            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px", padding: "10px", fontSize: "12px", color: "#991b1b", marginBottom: "16px" }}>
              ⚠️ Historical candidate attempts and live exams will be protected. If candidates have started attempts with this set, deletion will be safely rejected.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="secondary"
                onClick={() => setConfirmDeleteSetModal(false)}
                disabled={deletingInProgress}
                style={{ fontSize: "12.5px" }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                onClick={handleConfirmDeleteSet}
                disabled={deletingInProgress}
                style={{ background: "#dc2626", borderColor: "#dc2626", fontSize: "12.5px" }}
              >
                {deletingInProgress ? "Deleting..." : "Confirm Delete Set"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 3: DELETE ALL QUESTIONS CONFIRMATION MODAL
          ========================================================================= */}
      {confirmDeleteAllQuestionsModal && (
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.5)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 9999,
          padding: "20px"
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: "10px",
            width: "100%",
            maxWidth: "480px",
            padding: "20px",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
              <AlertTriangle size={22} color="#dc2626" />
              <strong style={{ fontSize: "15px", color: "#991b1b" }}>Confirm Delete All Questions</strong>
            </div>

            <p style={{ fontSize: "13px", color: "#334155", margin: "0 0 14px 0", lineHeight: 1.5 }}>
              Are you sure you want to delete all <b>{questions.length}</b> questions from <b>Set {selectedSetCode}</b> ({selectedDept?.name})?
            </p>

            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "10px", fontSize: "12px", color: "#475569", marginBottom: "16px" }}>
              ℹ️ The Question Set configuration and other sets (Sets A, B, C, D) will NOT be affected.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="secondary"
                onClick={() => setConfirmDeleteAllQuestionsModal(false)}
                disabled={deletingInProgress}
                style={{ fontSize: "12.5px" }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                onClick={handleConfirmDeleteAllQuestions}
                disabled={deletingInProgress}
                style={{ background: "#dc2626", borderColor: "#dc2626", fontSize: "12.5px" }}
              >
                {deletingInProgress ? "Deleting..." : "Confirm Delete All Questions"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
