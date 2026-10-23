import { useState, useEffect } from "react";
import { 
  ArrowLeft, 
  Save, 
  Calendar, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  Building2, 
  Plus, 
  Trash2, 
  Sparkles, 
  FolderPlus,
  ArrowRight
} from "lucide-react";
import { useRouter } from "../../router";
import { 
  createExam, 
  publishExam,
  parsePdfInMemory,
  getActiveDepartments, 
  createDepartment, 
  getExamDepartmentSets,
  uploadDeptSetDocument,
  bulkUpdateSetQuestions,
  ApiError, 
  type DepartmentDto,
  type ParsedQuestionDto
} from "../../services/api";

const STANDARD_DEPARTMENTS = [
  { name: "Developer", code: "DEV", description: "Software & Web Development" },
  { name: "Tester", code: "QA", description: "Quality Assurance & Testing" },
  { name: "UI/UX", code: "UIUX", description: "User Interface & Experience Design" },
  { name: "Marketing", code: "MKT", description: "Marketing & Growth" },
  { name: "HR", code: "HR", description: "Human Resources & Recruitment" },
  { name: "Computer Science & Engineering", code: "CSE", description: "B.Tech Computer Science and Engineering" },
  { name: "Information Technology", code: "IT", description: "B.Tech Information Technology" },
  { name: "Electronics & Communication Engineering", code: "ECE", description: "B.Tech Electronics & Communication" },
  { name: "Electrical & Electronics Engineering", code: "EEE", description: "B.Tech Electrical & Electronics" },
  { name: "Mechanical Engineering", code: "MECH", description: "B.Tech Mechanical Engineering" },
  { name: "Civil Engineering", code: "CIVIL", description: "B.Tech Civil Engineering" }
];

export default function CreateExamPage() {
  const { navigate } = useRouter();

  // 4-Step Progressive Wizard State
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);

  // Basic Examination Details
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timingMode, setTimingMode] = useState<"DURATION_FROM_START" | "SCHEDULED">("DURATION_FROM_START");
  const [examDate, setExamDate] = useState("2026-10-25");
  const [startTime, setStartTime] = useState("10:00");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [totalQuestions, setTotalQuestions] = useState("50");
  const [totalMarks, setTotalMarks] = useState("100");
  const [marksPerQuestion, setMarksPerQuestion] = useState("2");
  const [negativeMarks, setNegativeMarks] = useState("0");
  
  // Qualification Settings
  const [qualificationMode, setQualificationMode] = useState<"PERCENTAGE" | "ABSOLUTE">("PERCENTAGE");
  const [qualificationThreshold, setQualificationThreshold] = useState("60");

  // Departments State
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [selectedDeptIds, setSelectedDeptIds] = useState<number[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);

  // Per-Department 4 Question-Paper & Answer-Key Sets Upload State
  const [deptSetFiles, setDeptSetFiles] = useState<Record<number, Record<"A" | "B" | "C" | "D", { questionPaperFile?: File | null; answerKeyFile?: File | null }>>>({});
  const [deptSetParsedQuestions, setDeptSetParsedQuestions] = useState<Record<number, Record<"A" | "B" | "C" | "D", ParsedQuestionDto[]>>>({});
  const [deptSetExtracting, setDeptSetExtracting] = useState<Record<string, boolean>>({});
  const [reviewingSet, setReviewingSet] = useState<{ deptName: string; deptId: number; setCode: "A" | "B" | "C" | "D"; questions: ParsedQuestionDto[] } | null>(null);
  const [selectedDeptToAdd, setSelectedDeptToAdd] = useState<string>("");

  // In-page Department Creation State
  const [showAddDeptForm, setShowAddDeptForm] = useState(false);
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptCode, setNewDeptCode] = useState("");
  const [newDeptDesc, setNewDeptDesc] = useState("");
  const [creatingDept, setCreatingDept] = useState(false);
  const [deptFormError, setDeptFormError] = useState<string | null>(null);

  const [publishImmediately, setPublishImmediately] = useState(true);

  // Status & Notifications
  const [submitting, setSubmitting] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Load Departments on Mount
  const loadDepartments = async () => {
    setLoadingDepts(true);
    try {
      const data = await getActiveDepartments();
      setDepartments(data);
      if (data.length > 0 && selectedDeptIds.length === 0) {
        setSelectedDeptIds(data.map(d => d.id));
      }
    } catch (e) {
      console.warn("Could not fetch departments:", e);
    } finally {
      setLoadingDepts(false);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  const handleAddDepartment = (deptId: number) => {
    if (!selectedDeptIds.includes(deptId)) {
      setSelectedDeptIds(prev => [...prev, deptId]);
    }
  };

  const handleRemoveDepartment = (deptId: number) => {
    setSelectedDeptIds(prev => prev.filter(id => id !== deptId));
    setDeptSetFiles(prev => {
      const copy = { ...prev };
      delete copy[deptId];
      return copy;
    });
  };

  const triggerSetPdfExtraction = async (
    deptId: number,
    setCode: "A" | "B" | "C" | "D",
    qpFile: File,
    akFile?: File | null
  ) => {
    const ext = qpFile.name.split(".").pop()?.toLowerCase();
    if (ext !== "pdf") return;

    const key = `${deptId}_${setCode}`;
    setDeptSetExtracting(prev => ({ ...prev, [key]: true }));

    try {
      const formData = new FormData();
      formData.append("questionPaper", qpFile);
      if (akFile && akFile.name.toLowerCase().endsWith(".pdf")) {
        formData.append("answerSheet", akFile);
      }
      formData.append("marksPerQuestion", marksPerQuestion);
      formData.append("negativeMarks", negativeMarks);

      const resp = await parsePdfInMemory(formData);
      if (resp.questions && resp.questions.length > 0) {
        setDeptSetParsedQuestions(prev => {
          const deptData = prev[deptId] || { A: [], B: [], C: [], D: [] };
          return {
            ...prev,
            [deptId]: {
              ...deptData,
              [setCode]: resp.questions
            }
          };
        });

        // Automatically update totalQuestions & totalMarks based on extracted count
        setTotalQuestions(prev => {
          const cur = parseInt(prev, 10) || 0;
          return String(Math.max(cur, resp.questions.length));
        });
        setTotalMarks(prev => {
          const cur = parseFloat(prev) || 0;
          const qCount = resp.questions.length;
          const mpq = parseFloat(marksPerQuestion) || 1;
          return String(Math.max(cur, qCount * mpq));
        });
      }
    } catch (err) {
      console.warn(`Extraction error for Dept ${deptId} Set ${setCode}:`, err);
    } finally {
      setDeptSetExtracting(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleSetFileChange = (
    deptId: number,
    setCode: "A" | "B" | "C" | "D",
    docType: "questionPaperFile" | "answerKeyFile",
    file: File | null
  ) => {
    if (file) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["pdf", "docx", "txt", "csv"].includes(ext || "")) {
        alert("Unsupported file format. Please upload a PDF, DOCX, TXT, or CSV document.");
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        alert("File size exceeds maximum 25 MB limit.");
        return;
      }
    }

    setDeptSetFiles(prev => {
      const deptData = prev[deptId] || { A: {}, B: {}, C: {}, D: {} };
      const setData = deptData[setCode] || {};
      return {
        ...prev,
        [deptId]: {
          ...deptData,
          [setCode]: {
            ...setData,
            [docType]: file
          }
        }
      };
    });

    if (file && docType === "questionPaperFile") {
      const currentAk = deptSetFiles[deptId]?.[setCode]?.answerKeyFile;
      triggerSetPdfExtraction(deptId, setCode, file, currentAk);
    } else if (file && docType === "answerKeyFile") {
      const currentQp = deptSetFiles[deptId]?.[setCode]?.questionPaperFile;
      if (currentQp) {
        triggerSetPdfExtraction(deptId, setCode, currentQp, file);
      }
    } else if (!file && docType === "questionPaperFile") {
      // Clear extracted questions if QP is removed
      setDeptSetParsedQuestions(prev => {
        const dData = prev[deptId] || { A: [], B: [], C: [], D: [] };
        return {
          ...prev,
          [deptId]: {
            ...dData,
            [setCode]: []
          }
        };
      });
    }
  };

  const handleSelectAllDepts = () => {
    setSelectedDeptIds(departments.map(d => d.id));
  };

  const handleClearAllDepts = () => {
    setSelectedDeptIds([]);
    setDeptSetFiles({});
  };

  // In-page Create Single Department
  const handleCreateNewDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeptFormError(null);
    if (!newDeptName.trim() || !newDeptCode.trim()) {
      setDeptFormError("Department Name and Code (e.g. CSE) are required.");
      return;
    }

    setCreatingDept(true);
    try {
      const created = await createDepartment({
        name: newDeptName.trim(),
        code: newDeptCode.trim().toUpperCase(),
        description: newDeptDesc.trim() || undefined,
        active: true
      });

      setDepartments(prev => [...prev, created]);
      setSelectedDeptIds(prev => [...prev, created.id]);
      setNewDeptName("");
      setNewDeptCode("");
      setNewDeptDesc("");
      setShowAddDeptForm(false);
    } catch (err: unknown) {
      const errorObj = err as Error;
      setDeptFormError(errorObj.message || "Failed to create department");
    } finally {
      setCreatingDept(false);
    }
  };

  // Quick Populate Standard Engineering Departments
  const handleQuickPopulateDepartments = async () => {
    setCreatingDept(true);
    setDeptFormError(null);
    try {
      const existingCodes = new Set(departments.map(d => d.code.toUpperCase()));
      const toCreate = STANDARD_DEPARTMENTS.filter(d => !existingCodes.has(d.code));

      if (toCreate.length === 0) {
        setDeptFormError("Standard departments already exist in database.");
        setCreatingDept(false);
        return;
      }

      const createdList: DepartmentDto[] = [];
      for (const dept of toCreate) {
        const res = await createDepartment({ ...dept, active: true });
        createdList.push(res);
      }

      setDepartments(prev => [...prev, ...createdList]);
      setSelectedDeptIds(prev => [...prev, ...createdList.map(d => d.id)]);
      setShowAddDeptForm(false);
    } catch (err: unknown) {
      const errorObj = err as Error;
      setDeptFormError(`Populate failed: ${errorObj.message}`);
    } finally {
      setCreatingDept(false);
    }
  };


  const validate = () => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = "Exam title is required";
    if (!description.trim()) errs.description = "Exam description is required";
    
    const dur = parseInt(durationMinutes, 10);
    if (isNaN(dur) || dur < 5 || dur > 360) {
      errs.durationMinutes = "Duration must be between 5 and 360 minutes";
    }

    const tq = parseInt(totalQuestions, 10);
    if (isNaN(tq) || tq < 1 || tq > 500) {
      errs.totalQuestions = "Total questions must be between 1 and 500";
    }

    const tm = parseFloat(totalMarks);
    if (isNaN(tm) || tm <= 0) {
      errs.totalMarks = "Total marks must be a positive number";
    }

    const mpc = parseFloat(marksPerQuestion);
    if (isNaN(mpc) || mpc <= 0) {
      errs.marksPerQuestion = "Marks per question must be greater than 0";
    }

    const nm = parseFloat(negativeMarks);
    if (isNaN(nm) || nm < 0 || nm > mpc) {
      errs.negativeMarks = "Negative marking cannot exceed positive mark value";
    }

    const qt = parseFloat(qualificationThreshold);
    if (isNaN(qt) || qt <= 0) {
      errs.qualificationThreshold = "Qualification threshold must be greater than 0";
    }

    if (selectedDeptIds.length === 0) {
      errs.departments = "Please select or create at least one academic department for this examination.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setSuccessNotice(null);

    if (!validate()) return;

    setSubmitting(true);
    setSubmissionProgress("Creating examination blueprint in PostgreSQL...");

    try {
      const scheduledStart = timingMode === "SCHEDULED" ? `${examDate}T${startTime}:00Z` : undefined;

      // 1. Create Exam with Chosen Departments
      const created = await createExam({
        title: title.trim(),
        description: description.trim(),
        durationMinutes: parseInt(durationMinutes, 10),
        totalQuestions: parseInt(totalQuestions, 10),
        qualificationMode,
        qualificationThreshold: parseFloat(qualificationThreshold),
        timingMode,
        totalMarks: parseFloat(totalMarks),
        marksPerQuestion: parseFloat(marksPerQuestion),
        negativeMarks: parseFloat(negativeMarks),
        scheduledStartTime: scheduledStart,
        departmentIds: selectedDeptIds
      });

      let questionsUploadedCount = 0;
      let deptSetsUploaded = 0;

      // 2. Upload Department-Specific 4 Sets (A, B, C, D) Documents and Save Extracted Questions
      for (const deptId of selectedDeptIds) {
        try {
          const sets = await getExamDepartmentSets(created.id, deptId);
          const deptUploads = deptSetFiles[deptId];
          if (sets && sets.length > 0) {
            for (const s of sets) {
              const files = deptUploads ? deptUploads[s.setCode] : undefined;
              if (files?.questionPaperFile) {
                setSubmissionProgress(`Uploading Question Paper for ${s.name}...`);
                await uploadDeptSetDocument(created.id, deptId, s.id, files.questionPaperFile, "QUESTION_PAPER");
                deptSetsUploaded++;
              }
              if (files?.answerKeyFile) {
                setSubmissionProgress(`Uploading Answer Key for ${s.name}...`);
                await uploadDeptSetDocument(created.id, deptId, s.id, files.answerKeyFile, "ANSWER_KEY");
                deptSetsUploaded++;
              }

              // Save extracted questions directly to this question set!
              const setQuestions = deptSetParsedQuestions[deptId]?.[s.setCode];
              if (setQuestions && setQuestions.length > 0) {
                setSubmissionProgress(`Saving ${setQuestions.length} MCQs to ${s.name}...`);
                const dtos = setQuestions.map((q, idx) => ({
                  questionText: q.questionText,
                  marks: q.marks != null ? q.marks : parseFloat(marksPerQuestion) || 1,
                  negativeMarks: q.negativeMarks != null ? q.negativeMarks : parseFloat(negativeMarks) || 0,
                  displayOrder: idx + 1,
                  options: q.options.map((opt, oIdx) => ({
                    optionText: opt.optionText,
                    correct: (q.correctOption != null && q.correctOption.toUpperCase() === opt.label.toUpperCase()) || opt.correct,
                    displayOrder: oIdx + 1,
                    label: opt.label
                  }))
                }));
                await bulkUpdateSetQuestions(s.id, dtos);
                questionsUploadedCount += dtos.length;
              }
            }
          }
        } catch (deptUpErr) {
          console.warn(`Could not upload/persist questions for department #${deptId}:`, deptUpErr);
        }
      }

      if (publishImmediately) {
        setSubmissionProgress("Publishing examination for immediate candidate entrance...");
        try {
          await publishExam(created.id);
        } catch (pubErr) {
          console.warn("Could not publish immediately:", pubErr);
        }
      }

      setSubmissionProgress("");
      const assignedCount = selectedDeptIds.length;
      let successMsg = `Examination "${created.title}" successfully created for ${assignedCount} department(s)!`;
      if (publishImmediately) {
        successMsg += " Status: PUBLISHED (Live for candidate entrance).";
      }
      if (questionsUploadedCount > 0) {
        successMsg += ` ${questionsUploadedCount} MCQs automatically extracted from department set question papers and saved.`;
      }

      setSuccessNotice(successMsg);
      window.scrollTo({ top: 0, behavior: "smooth" });

      setTimeout(() => {
        navigate("/admin/exams");
      }, 1500);

    } catch (err: unknown) {
      setSubmissionProgress("");
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        const errorObj = err as Error;
        setServerError(errorObj.message || "Failed to create examination and upload questions");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: "1050px", margin: "0 auto", paddingBottom: "60px" }}>
      {/* Top back navigation */}
      <div style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button 
          type="button" 
          className="secondary" 
          onClick={() => navigate("/admin/exams")}
          style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
        >
          <ArrowLeft size={14} /> Back to Examinations
        </button>

        <span style={{ fontSize: "11px", color: "#64748b" }}>
          ExamSecure Assessment Engine · Integrated Department & Question Management
        </span>
      </div>

      {serverError && (
        <div 
          style={{
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
            borderRadius: "8px",
            padding: "12px",
            marginBottom: "16px",
            fontSize: "12.5px",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <AlertCircle size={16} />
          <span>{serverError}</span>
        </div>
      )}

      {successNotice && (
        <div 
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            color: "#166534",
            borderRadius: "8px",
            padding: "14px",
            marginBottom: "16px",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            boxShadow: "0 2px 8px rgba(22, 101, 52, 0.08)"
          }}
        >
          <CheckCircle2 size={18} color="#16a34a" />
          <div>
            <b>Examination & Questions Successfully Saved!</b>
            <p style={{ margin: "2px 0 0", fontSize: "12px" }}>{successNotice}</p>
          </div>
        </div>
      )}

      {/* 4-Step Progressive Stepper Bar */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "10px",
        marginBottom: "20px",
        background: "#ffffff",
        padding: "10px",
        borderRadius: "12px",
        border: "1px solid #e2e8f0",
        boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)"
      }}>
        {[
          { num: 1, label: "Identity & Timing", icon: Calendar },
          { num: 2, label: "Marking Scheme", icon: Layers },
          { num: 3, label: "Department Sets & Questions", icon: Building2 },
          { num: 4, label: "Review & Launch", icon: CheckCircle2 }
        ].map(step => {
          const isActive = wizardStep === step.num;
          const isDone = wizardStep > step.num;
          const Icon = step.icon;
          return (
            <button
              key={step.num}
              type="button"
              onClick={() => setWizardStep(step.num as any)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "none",
                background: isActive ? "#eff6ff" : "transparent",
                color: isActive ? "#1d4ed8" : (isDone ? "#166534" : "#64748b"),
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s ease",
                fontWeight: isActive ? 700 : 600,
                fontSize: "12px"
              }}
            >
              <div style={{
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                background: isActive ? "#2563eb" : (isDone ? "#dcfce7" : "#f1f5f9"),
                color: isActive ? "#ffffff" : (isDone ? "#166534" : "#64748b"),
                display: "grid",
                placeItems: "center",
                fontSize: "11px",
                fontWeight: 800,
                flexShrink: 0
              }}>
                {isDone ? "✓" : step.num}
              </div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                <Icon size={13} /> {step.label}
              </span>
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit}>
        {/* Step 1: Basic Examination Setup */}
        {wizardStep === 1 && (
          <div className="admin-form-card" style={{ marginBottom: "20px" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Calendar size={18} color="#365fe5" /> 1. Examination Details & Timing
          </h3>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Examination Title *
              </label>
              <input 
                type="text" 
                placeholder="e.g. Campus Placement 2026 - Core Engineering Assessment"
                value={title}
                onChange={e => setTitle(e.target.value)}
                style={{ width: "100%", padding: "10px", fontSize: "13px", border: "1px solid #cbd5e1", borderRadius: "8px" }}
              />
              {errors.title && <span style={{ color: "#dc2626", fontSize: "11px" }}>{errors.title}</span>}
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Description & Instructions *
              </label>
              <textarea 
                rows={3}
                placeholder="Topics covered, syllabus, test guidelines, and candidate instructions..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                style={{ width: "100%", padding: "10px", fontSize: "13px", border: "1px solid #cbd5e1", borderRadius: "8px", fontFamily: "inherit" }}
              />
              {errors.description && <span style={{ color: "#dc2626", fontSize: "11px" }}>{errors.description}</span>}
            </div>

            {/* Timing Mode & Duration */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Timing Mode
                </label>
                <select 
                  value={timingMode} 
                  onChange={e => setTimingMode(e.target.value as any)}
                  style={{ width: "100%", padding: "10px", fontSize: "13px", border: "1px solid #cbd5e1", borderRadius: "8px", background: "#ffffff" }}
                >
                  <option value="DURATION_FROM_START">Duration-from-Start (Candidate starts on demand)</option>
                  <option value="SCHEDULED">Scheduled Mode (Fixed date & time window)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Duration (Minutes) *
                </label>
                <input 
                  type="number" 
                  value={durationMinutes}
                  onChange={e => setDurationMinutes(e.target.value)}
                  style={{ width: "100%", padding: "10px", fontSize: "13px", border: "1px solid #cbd5e1", borderRadius: "8px" }}
                />
                {errors.durationMinutes && <span style={{ color: "#dc2626", fontSize: "11px" }}>{errors.durationMinutes}</span>}
              </div>
            </div>

            {timingMode === "SCHEDULED" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                    Exam Date
                  </label>
                  <input 
                    type="date" 
                    value={examDate}
                    onChange={e => setExamDate(e.target.value)}
                    style={{ width: "100%", padding: "10px", fontSize: "13px", border: "1px solid #cbd5e1", borderRadius: "8px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                    Start Time
                  </label>
                  <input 
                    type="time" 
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    style={{ width: "100%", padding: "10px", fontSize: "13px", border: "1px solid #cbd5e1", borderRadius: "8px" }}
                  />
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #f1f5f9" }}>
            <button
              type="button"
              className="primary"
              onClick={() => {
                if (!title.trim()) {
                  setErrors(prev => ({ ...prev, title: "Examination title is required" }));
                  return;
                }
                setWizardStep(2);
              }}
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 22px", fontSize: "13px" }}
            >
              Continue to Marking Scheme <ArrowRight size={16} />
            </button>
          </div>
        </div>
        )}

        {/* Step 2: Qualification & Scoring */}
        {wizardStep === 2 && (
          <div className="admin-form-card" style={{ marginBottom: "20px" }}>
          <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Layers size={18} color="#365fe5" /> 2. Marking Scheme & Qualification Rules
          </h3>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Total Questions *
              </label>
              <input 
                type="number" 
                value={totalQuestions}
                onChange={e => setTotalQuestions(e.target.value)}
                style={{ width: "100%", padding: "10px", fontSize: "13px", border: "1px solid #cbd5e1", borderRadius: "8px" }}
              />
              {errors.totalQuestions && <span style={{ color: "#dc2626", fontSize: "11px" }}>{errors.totalQuestions}</span>}
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Total Marks *
              </label>
              <input 
                type="number" 
                value={totalMarks}
                onChange={e => setTotalMarks(e.target.value)}
                style={{ width: "100%", padding: "10px", fontSize: "13px", border: "1px solid #cbd5e1", borderRadius: "8px" }}
              />
              {errors.totalMarks && <span style={{ color: "#dc2626", fontSize: "11px" }}>{errors.totalMarks}</span>}
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Marks Per Question *
              </label>
              <input 
                type="number" 
                value={marksPerQuestion}
                onChange={e => setMarksPerQuestion(e.target.value)}
                style={{ width: "100%", padding: "10px", fontSize: "13px", border: "1px solid #cbd5e1", borderRadius: "8px" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Negative Marks per Wrong Answer
              </label>
              <input 
                type="number" 
                step="0.25"
                value={negativeMarks}
                onChange={e => setNegativeMarks(e.target.value)}
                style={{ width: "100%", padding: "10px", fontSize: "13px", border: "1px solid #cbd5e1", borderRadius: "8px" }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Qualification Mode
              </label>
              <select 
                value={qualificationMode}
                onChange={e => setQualificationMode(e.target.value as any)}
                style={{ width: "100%", padding: "10px", fontSize: "13px", border: "1px solid #cbd5e1", borderRadius: "8px", background: "#ffffff" }}
              >
                <option value="PERCENTAGE">Percentage (%) based</option>
                <option value="ABSOLUTE">Absolute Marks based</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Qualifying Threshold ({qualificationMode === "PERCENTAGE" ? "%" : "marks"}) *
              </label>
              <input 
                type="number" 
                value={qualificationThreshold}
                onChange={e => setQualificationThreshold(e.target.value)}
                style={{ width: "100%", padding: "10px", fontSize: "13px", border: "1px solid #cbd5e1", borderRadius: "8px" }}
              />
            </div>
          </div>
        
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #f1f5f9" }}>
              <button
                type="button"
                className="secondary"
                onClick={() => setWizardStep(1)}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "10px 18px", fontSize: "13px" }}
              >
                <ArrowLeft size={16} /> Back to Identity
              </button>
              <button
                type="button"
                className="primary"
                onClick={() => setWizardStep(3)}
                style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 22px", fontSize: "13px" }}
              >
                Continue to Department Sets & Questions <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Departments & Questions */}
        {wizardStep === 3 && (
          <>
            {/* Card 3: Department-Wise Exam Configuration & 4 Question Sets (Sets A, B, C, D) */}
        <div className="admin-form-card" style={{ marginBottom: "20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
            <div>
              <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Building2 size={18} color="#365fe5" /> 3. Department-Wise Question Sets & MCQ Extraction
              </h3>
              <p style={{ margin: 0, fontSize: "12px", color: "#64748b" }}>
                Every assigned department has four independent sets (Set A, Set B, Set C, Set D). Attach question papers & answer keys directly to each set — text and MCQs are extracted automatically in-memory.
              </p>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button 
                type="button" 
                className="secondary"
                onClick={() => setShowAddDeptForm(!showAddDeptForm)}
                style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "5px", padding: "6px 12px" }}
              >
                <Plus size={14} /> {showAddDeptForm ? "Close Form" : "Create New Department"}
              </button>

              {departments.length === 0 && (
                <button 
                  type="button" 
                  className="primary"
                  onClick={handleQuickPopulateDepartments}
                  disabled={creatingDept}
                  style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "5px", padding: "6px 12px" }}
                >
                  <Sparkles size={14} /> {creatingDept ? "Populating..." : "Auto-Populate Standard"}
                </button>
              )}
            </div>
          </div>

          {/* Quick Add Department Inline Form */}
          {showAddDeptForm && (
            <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "8px", padding: "16px", marginBottom: "16px" }}>
              <h4 style={{ margin: "0 0 10px 0", fontSize: "13px", color: "#1e293b", display: "flex", alignItems: "center", gap: "6px" }}>
                <FolderPlus size={15} color="#365fe5" /> Create New Academic / Functional Department
              </h4>
              {deptFormError && (
                <div style={{ color: "#dc2626", fontSize: "11px", marginBottom: "8px" }}>{deptFormError}</div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 2fr auto", gap: "10px", alignItems: "flex-end" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                    Department Name *
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. Developer, Tester, HR, UI/UX" 
                    value={newDeptName}
                    onChange={e => setNewDeptName(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", fontSize: "12px", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                    Code *
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. DEV, QA, HR" 
                    value={newDeptCode}
                    onChange={e => setNewDeptCode(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", fontSize: "12px", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                    Description
                  </label>
                  <input 
                    type="text" 
                    placeholder="Optional description" 
                    value={newDeptDesc}
                    onChange={e => setNewDeptDesc(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", fontSize: "12px", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                  />
                </div>
                <button 
                  type="button" 
                  className="primary"
                  onClick={handleCreateNewDepartment}
                  disabled={creatingDept}
                  style={{ padding: "8px 16px", fontSize: "12px", height: "36px" }}
                >
                  {creatingDept ? "Saving..." : "Create & Add"}
                </button>
              </div>
            </div>
          )}

          {/* Department Selection Bar */}
          <div style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "8px",
            padding: "12px 14px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "10px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "12.5px", fontWeight: 600, color: "#334155" }}>Add Department to Exam:</span>
              <select
                value={selectedDeptToAdd}
                onChange={e => setSelectedDeptToAdd(e.target.value)}
                style={{
                  padding: "7px 12px",
                  fontSize: "12.5px",
                  border: "1px solid #cbd5e1",
                  borderRadius: "6px",
                  background: "#ffffff",
                  minWidth: "240px"
                }}
              >
                <option value="">-- Choose Department to Add --</option>
                {departments
                  .filter(d => !selectedDeptIds.includes(d.id))
                  .map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
              </select>
              <button
                type="button"
                className="primary"
                disabled={!selectedDeptToAdd}
                onClick={() => {
                  if (selectedDeptToAdd) {
                    handleAddDepartment(Number(selectedDeptToAdd));
                    setSelectedDeptToAdd("");
                  }
                }}
                style={{ padding: "7px 14px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "5px" }}
              >
                <Plus size={14} /> Add Department
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12px" }}>
              <span style={{ color: "#64748b" }}>
                Configured: <b>{selectedDeptIds.length}</b> department(s)
              </span>
              {departments.length > 0 && selectedDeptIds.length < departments.length && (
                <button
                  type="button"
                  onClick={handleSelectAllDepts}
                  style={{ background: "none", border: "none", color: "#365fe5", cursor: "pointer", fontSize: "12px", padding: 0 }}
                >
                  Add All
                </button>
              )}
              {selectedDeptIds.length > 0 && (
                <>
                  <span style={{ color: "#cbd5e1" }}>|</span>
                  <button
                    type="button"
                    onClick={handleClearAllDepts}
                    style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: "12px", padding: 0 }}
                  >
                    Clear All
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Department Cards List with 4 Sets (A, B, C, D) inside each */}
          {loadingDepts ? (
            <div style={{ color: "#64748b", fontSize: "12px", padding: "12px" }}>Loading departments from PostgreSQL database...</div>
          ) : selectedDeptIds.length === 0 ? (
            <div style={{ padding: "28px", background: "#f8fafc", border: "1.5px dashed #cbd5e1", borderRadius: "10px", textAlign: "center" }}>
              <Building2 size={36} color="#94a3b8" style={{ margin: "0 auto 8px" }} />
              <p style={{ margin: "0 0 6px 0", fontSize: "14px", fontWeight: 700, color: "#1e293b" }}>No Departments Added to this Examination</p>
              <p style={{ margin: "0 0 14px 0", fontSize: "12.5px", color: "#64748b" }}>
                Add at least one department (e.g. Developer, Tester, HR, CSE) using the selector above.
              </p>
              <div style={{ display: "flex", gap: "8px", justifyContent: "center", flexWrap: "wrap" }}>
                {departments.slice(0, 4).map(d => (
                  <button
                    key={d.id}
                    type="button"
                    className="secondary"
                    onClick={() => handleAddDepartment(d.id)}
                    style={{ fontSize: "12px", padding: "6px 12px" }}
                  >
                    + Add {d.name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              {selectedDeptIds.map(deptId => {
                const dept = departments.find(d => d.id === deptId);
                if (!dept) return null;
                const deptUploads = deptSetFiles[deptId] || { A: {}, B: {}, C: {}, D: {} };

                return (
                  <div 
                    key={dept.id}
                    style={{
                      border: "1px solid #cbd5e1",
                      borderRadius: "10px",
                      background: "#ffffff",
                      boxShadow: "0 1px 4px rgba(15, 23, 42, 0.04)",
                      overflow: "hidden"
                    }}
                  >
                    {/* Department Card Header */}
                    <div style={{
                      padding: "12px 16px",
                      background: "#f1f5f9",
                      borderBottom: "1px solid #e2e8f0",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <Building2 size={18} color="#2563eb" />
                        <div>
                          <strong style={{ fontSize: "14px", color: "#0f172a" }}>{dept.name}</strong>
                          <span style={{ marginLeft: "8px", fontSize: "11px", background: "#e0e7ff", color: "#3730a3", padding: "2px 7px", borderRadius: "4px", fontWeight: 700 }}>
                            {dept.code}
                          </span>
                          {dept.description && (
                            <span style={{ marginLeft: "10px", fontSize: "11.5px", color: "#64748b" }}>
                              — {dept.description}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveDepartment(dept.id)}
                        className="secondary"
                        style={{
                          fontSize: "11.5px",
                          color: "#dc2626",
                          border: "1px solid #fecaca",
                          background: "#fef2f2",
                          padding: "5px 10px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                        title="Remove department from this examination configuration"
                      >
                        <Trash2 size={13} /> Remove from Exam
                      </button>
                    </div>

                    {/* 4 Independent Sets Grid: Set A, Set B, Set C, Set D */}
                    <div style={{ padding: "14px 16px" }}>
                      <div style={{ fontSize: "11.5px", fontWeight: 600, color: "#475569", marginBottom: "12px", display: "flex", justifyContent: "space-between" }}>
                        <span>Four Question Paper Sets (Each set is fully independent):</span>
                        <span style={{ color: "#64748b", fontWeight: 400 }}>Formats: PDF, DOCX, TXT, CSV (Max 25 MB)</span>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "14px" }}>
                        {(["A", "B", "C", "D"] as const).map(setCode => {
                          const setData = deptUploads[setCode] || {};
                          const qp = setData.questionPaperFile;
                          const ak = setData.answerKeyFile;
                          const isConfigured = !!(qp || ak);
                          const isComplete = !!(qp && ak);
                          const isExtracting = deptSetExtracting[`${dept.id}_${setCode}`];
                          const setQuestions = deptSetParsedQuestions[dept.id]?.[setCode] || [];
                          const hasQuestions = setQuestions.length > 0;

                          return (
                            <div
                              key={setCode}
                              style={{
                                border: hasQuestions ? "1.5px solid #86efac" : (isComplete ? "1.5px solid #93c5fd" : (isConfigured ? "1.5px solid #cbd5e1" : "1px solid #e2e8f0")),
                                borderRadius: "8px",
                                padding: "12px",
                                background: hasQuestions ? "#f0fdf4" : (isConfigured ? "#f8fafc" : "#ffffff"),
                                transition: "all 0.15s ease"
                              }}
                            >
                              {/* Set Header with Status Badge */}
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  <span style={{
                                    display: "inline-block",
                                    width: "22px",
                                    height: "22px",
                                    lineHeight: "22px",
                                    borderRadius: "50%",
                                    background: hasQuestions ? "#16a34a" : (isConfigured ? "#2563eb" : "#64748b"),
                                    color: "#ffffff",
                                    textAlign: "center",
                                    fontWeight: 700,
                                    fontSize: "11px"
                                  }}>
                                    {setCode}
                                  </span>
                                  <b style={{ fontSize: "13px", color: "#0f172a" }}>Set {setCode}</b>
                                </div>

                                <span style={{
                                  fontSize: "10.5px",
                                  padding: "2px 8px",
                                  borderRadius: "10px",
                                  fontWeight: 600,
                                  background: hasQuestions ? "#dcfce7" : (isComplete ? "#dbeafe" : "#f1f5f9"),
                                  color: hasQuestions ? "#15803d" : (isComplete ? "#1d4ed8" : "#64748b")
                                }}>
                                  {isExtracting ? "⏳ Extracting..." : (hasQuestions ? `✓ ${setQuestions.length} MCQs Extracted` : (isComplete ? "✓ Fully Configured" : (qp ? "Paper Attached" : (ak ? "Key Attached" : "Not Configured"))))}
                                </span>
                              </div>

                              {/* Question Paper Upload Slot */}
                              <div style={{ marginBottom: "8px", fontSize: "12px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
                                  <span style={{ fontWeight: 600, color: "#334155", fontSize: "11.5px" }}>Question Paper:</span>
                                  {qp && (
                                    <button
                                      type="button"
                                      onClick={() => handleSetFileChange(dept.id, setCode, "questionPaperFile", null)}
                                      style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: "11px", padding: 0 }}
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>
                                {qp ? (
                                  <div style={{
                                    padding: "6px 10px",
                                    background: "#eff6ff",
                                    border: "1px solid #bfdbfe",
                                    borderRadius: "6px",
                                    fontSize: "11px",
                                    color: "#1e40af",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center"
                                  }}>
                                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "80%" }}>
                                      📄 {qp.name}
                                    </span>
                                    <small style={{ color: "#60a5fa" }}>{(qp.size / 1024).toFixed(0)} KB</small>
                                  </div>
                                ) : (
                                  <input
                                    type="file"
                                    accept=".pdf,.docx,.txt"
                                    onChange={e => {
                                      if (e.target.files && e.target.files[0]) {
                                        handleSetFileChange(dept.id, setCode, "questionPaperFile", e.target.files[0]);
                                      }
                                    }}
                                    style={{ fontSize: "11px", width: "100%" }}
                                  />
                                )}
                              </div>

                              {/* Answer Key Upload Slot */}
                              <div style={{ fontSize: "12px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
                                  <span style={{ fontWeight: 600, color: "#334155", fontSize: "11.5px" }}>Answer Key:</span>
                                  {ak && (
                                    <button
                                      type="button"
                                      onClick={() => handleSetFileChange(dept.id, setCode, "answerKeyFile", null)}
                                      style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: "11px", padding: 0 }}
                                    >
                                      Remove
                                    </button>
                                  )}
                                </div>
                                {ak ? (
                                  <div style={{
                                    padding: "6px 10px",
                                    background: "#f0fdf4",
                                    border: "1px solid #bbf7d0",
                                    borderRadius: "6px",
                                    fontSize: "11px",
                                    color: "#166534",
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center"
                                  }}>
                                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "80%" }}>
                                      🔑 {ak.name}
                                    </span>
                                    <small style={{ color: "#4ade80" }}>{(ak.size / 1024).toFixed(0)} KB</small>
                                  </div>
                                ) : (
                                  <input
                                    type="file"
                                    accept=".pdf,.txt,.csv"
                                    onChange={e => {
                                      if (e.target.files && e.target.files[0]) {
                                        handleSetFileChange(dept.id, setCode, "answerKeyFile", e.target.files[0]);
                                      }
                                    }}
                                    style={{ fontSize: "11px", width: "100%" }}
                                  />
                                )}
                              </div>

                              {/* Live In-Memory MCQ Extraction Status & Preview */}
                              {isExtracting && (
                                <div style={{ marginTop: "8px", fontSize: "11px", color: "#2563eb", display: "flex", alignItems: "center", gap: "6px" }}>
                                  <span>⏳ Extracting text & MCQs from PDF in-memory...</span>
                                </div>
                              )}

                              {hasQuestions && !isExtracting && (
                                <div style={{
                                  marginTop: "8px",
                                  padding: "5px 8px",
                                  background: "#f0fdf4",
                                  border: "1px solid #bbf7d0",
                                  borderRadius: "6px",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center"
                                }}>
                                  <span style={{ fontSize: "11px", color: "#166534", fontWeight: 700 }}>
                                    ✓ {setQuestions.length} MCQs Extracted
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setReviewingSet({ deptName: dept.name, deptId: dept.id, setCode, questions: setQuestions })}
                                    style={{ background: "none", border: "none", color: "#2563eb", fontSize: "11px", fontWeight: 600, cursor: "pointer", padding: 0 }}
                                  >
                                    Review Questions ({setQuestions.length}) →
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {errors.departments && <span style={{ color: "#dc2626", fontSize: "11px", display: "block", marginTop: "8px" }}>{errors.departments}</span>}
        </div>
          {/* Merged Navigation Bar for Step 3 */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #f1f5f9" }}>
            <button
              type="button"
              className="secondary"
              onClick={() => setWizardStep(2)}
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "10px 18px", fontSize: "13px" }}
            >
              <ArrowLeft size={16} /> Back to Marking Scheme
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => {
                if (selectedDeptIds.length === 0) {
                  setErrors(prev => ({ ...prev, departments: "Please select or create at least one department." }));
                  return;
                }
                setWizardStep(4);
              }}
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 22px", fontSize: "13px" }}
            >
              Continue to Review & Launch <ArrowRight size={16} />
            </button>
          </div>

          </>
        )}

        {/* Step 4: Final Review & Live Launch */}
        {wizardStep === 4 && (
          <div>
            {/* Examination Blueprint Summary Card */}
            <div className="admin-form-card" style={{ marginBottom: "20px" }}>
              <h3 style={{ margin: "0 0 14px 0", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                <CheckCircle2 size={18} color="#16a34a" /> 4. Review Blueprint & Pre-Flight Verification
              </h3>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "16px" }}>
                <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <small style={{ color: "#64748b", display: "block", fontSize: "11px" }}>Title & Duration</small>
                  <b style={{ color: "#0f172a", fontSize: "13px" }}>{title || "(Untitled Examination)"}</b>
                  <div style={{ fontSize: "11px", color: "#2563eb", marginTop: "4px" }}>{durationMinutes} Minutes ({timingMode === "SCHEDULED" ? `Scheduled: ${examDate} at ${startTime}` : "On-Demand Duration"})</div>
                </div>

                <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <small style={{ color: "#64748b", display: "block", fontSize: "11px" }}>Departments Allocated</small>
                  <b style={{ color: "#0f172a", fontSize: "13px" }}>{selectedDeptIds.length} Departments Selected</b>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
                    {departments.filter(d => selectedDeptIds.includes(d.id)).slice(0, 3).map(d => (
                      <span key={d.id} style={{ fontSize: "10px", background: "#e0e7ff", color: "#3730a3", padding: "1px 6px", borderRadius: "4px", fontWeight: 700 }}>
                        {d.code}
                      </span>
                    ))}
                    {selectedDeptIds.length > 3 && <span style={{ fontSize: "10px", color: "#64748b" }}>+{selectedDeptIds.length - 3} more</span>}
                  </div>
                </div>

                <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <small style={{ color: "#64748b", display: "block", fontSize: "11px" }}>Questions & Scoring</small>
                  <b style={{ color: "#0f172a", fontSize: "13px" }}>
                    {(() => {
                      let totalExtracted = 0;
                      for (const dId of selectedDeptIds) {
                        const sMap = deptSetParsedQuestions[dId];
                        if (sMap) {
                          for (const c of ["A", "B", "C", "D"] as const) {
                            totalExtracted += sMap[c]?.length || 0;
                          }
                        }
                      }
                      return totalExtracted > 0 ? `${totalExtracted} MCQs Extracted Across Sets` : `${totalQuestions} Questions`;
                    })()}
                  </b>
                  <div style={{ fontSize: "11px", color: "#166534", marginTop: "4px" }}>
                    {marksPerQuestion} Marks/Q · Pass Threshold: {qualificationThreshold}{qualificationMode === "PERCENTAGE" ? "%" : " marks"}
                  </div>
                </div>
              </div>

              {/* Department-Wise 4-Sets Configuration Breakdown */}
              <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px solid #e2e8f0" }}>
                <strong style={{ fontSize: "12.5px", color: "#334155", display: "block", marginBottom: "8px" }}>
                  Department Question Bank Sets (Sets A, B, C, D Status):
                </strong>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {selectedDeptIds.map(dId => {
                    const dept = departments.find(d => d.id === dId);
                    if (!dept) return null;
                    const uploads = deptSetFiles[dId] || { A: {}, B: {}, C: {}, D: {} };
                    return (
                      <div key={dId} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", padding: "8px 12px", borderRadius: "6px", fontSize: "12px", border: "1px solid #e2e8f0" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <b style={{ color: "#0f172a" }}>{dept.name}</b>
                          <span style={{ fontSize: "10.5px", background: "#e2e8f0", padding: "1px 5px", borderRadius: "3px" }}>{dept.code}</span>
                        </div>
                        <div style={{ display: "flex", gap: "6px" }}>
                          {(["A", "B", "C", "D"] as const).map(code => {
                            const qp = uploads[code]?.questionPaperFile;
                            const ak = uploads[code]?.answerKeyFile;
                            const isConfigured = !!(qp || ak);
                            const qCount = deptSetParsedQuestions[dId]?.[code]?.length || 0;
                            return (
                              <span 
                                key={code}
                                style={{
                                  fontSize: "11px",
                                  padding: "2px 7px",
                                  borderRadius: "4px",
                                  background: qCount > 0 ? "#dcfce7" : (isConfigured ? "#dbeafe" : "#f1f5f9"),
                                  color: qCount > 0 ? "#15803d" : (isConfigured ? "#1d4ed8" : "#64748b"),
                                  fontWeight: 600
                                }}
                              >
                                Set {code}: {qCount > 0 ? `✓ ${qCount} MCQs` : (isConfigured ? "Configured" : "Draft")}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Instant Publishing Banner */}
            <div style={{
              background: publishImmediately ? "#f0fdf4" : "#f8fafc",
              border: publishImmediately ? "1.5px solid #86efac" : "1px solid #e2e8f0",
              borderRadius: "10px",
              padding: "16px 20px",
              marginBottom: "24px"
            }}>
              <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: publishImmediately ? "#166534" : "#334155" }}>
                <input 
                  type="checkbox" 
                  checked={publishImmediately} 
                  onChange={e => setPublishImmediately(e.target.checked)} 
                  style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "#16a34a" }}
                />
                Publish Examination Immediately (Active for Candidate Entrance)
              </label>
              <p style={{ margin: "6px 0 0 28px", fontSize: "12px", color: publishImmediately ? "#15803d" : "#64748b", lineHeight: 1.45 }}>
                {publishImmediately
                  ? "✓ Active: Upon clicking create, this examination will be immediately PUBLISHED. Eligible candidates in assigned department(s) can enter the assessment portal and start answering questions right away."
                  : "Draft: The examination will be saved as DRAFT. You can publish it manually later from the Examinations Management table whenever ready."}
              </p>
            </div>

            {/* Submit Bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #e2e8f0", paddingTop: "16px" }}>
              <button 
                type="button" 
                className="secondary" 
                onClick={() => setWizardStep(3)}
                disabled={submitting}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "10px 18px", fontSize: "13px" }}
              >
                <ArrowLeft size={16} /> Back to Questions
              </button>

              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                {submissionProgress && (
                  <span style={{ fontSize: "12px", color: "#2563eb", fontWeight: 600 }}>
                    ⏳ {submissionProgress}
                  </span>
                )}
                {successNotice && (
                  <span style={{ fontSize: "12px", color: "#16a34a", fontWeight: 700, display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <CheckCircle2 size={15} color="#16a34a" /> Exam Saved! Redirecting...
                  </span>
                )}
                <button 
                  type="submit" 
                  className="primary" 
                  disabled={submitting}
                  style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "11px 26px", fontSize: "13px" }}
                >
                  <Save size={16} /> {submitting ? "Saving & Launching..." : (publishImmediately ? "Create & Publish Live Examination" : "Save as Draft Examination")}
                </button>
              </div>
            </div>
          </div>
        )}
      </form>

      {/* Review Extracted Questions Modal */}
      {reviewingSet && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "20px"
        }}>
          <div style={{
            background: "#ffffff",
            borderRadius: "12px",
            width: "100%",
            maxWidth: "750px",
            maxHeight: "85vh",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)"
          }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", color: "#0f172a" }}>
                  Extracted Questions — {reviewingSet.deptName} (Set {reviewingSet.setCode})
                </h3>
                <span style={{ fontSize: "12px", color: "#64748b" }}>
                  {reviewingSet.questions.length} questions extracted in-memory from attached Question Paper PDF
                </span>
              </div>
              <button
                type="button"
                onClick={() => setReviewingSet(null)}
                style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#64748b", fontWeight: 700 }}
              >
                ✕
              </button>
            </div>
            <div style={{ padding: "16px 20px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "12px" }}>
              {reviewingSet.questions.map((q, idx) => (
                <div key={idx} style={{ padding: "12px", border: "1px solid #e2e8f0", borderRadius: "8px", background: "#f8fafc" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <strong style={{ fontSize: "13px", color: "#0f172a" }}>Q{idx + 1}. {q.questionText}</strong>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#166534", background: "#dcfce7", padding: "2px 7px", borderRadius: "4px" }}>
                      Ans: {q.correctOption}
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "12px" }}>
                    {q.options.map(opt => {
                      const isCorrect = opt.label.toUpperCase() === q.correctOption?.toUpperCase();
                      return (
                        <div key={opt.label} style={{
                          padding: "4px 8px",
                          borderRadius: "4px",
                          background: isCorrect ? "#dcfce7" : "#ffffff",
                          border: isCorrect ? "1px solid #86efac" : "1px solid #cbd5e1",
                          color: isCorrect ? "#166534" : "#334155",
                          fontWeight: isCorrect ? 600 : 400
                        }}>
                          <b>{opt.label})</b> {opt.optionText}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", textAlign: "right" }}>
              <button type="button" className="primary" onClick={() => setReviewingSet(null)} style={{ fontSize: "12.5px", padding: "8px 20px" }}>
                Done Reviewing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
