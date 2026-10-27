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
  ArrowRight,
  Code2,
  Briefcase,
  Shuffle,
  Eye,
  Check
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
import PrimaryDepartmentOverview from "../../components/admin/PrimaryDepartmentOverview";
import DepartmentTrackConfigView from "../../components/admin/DepartmentTrackConfigView";
import { 
  type PrimaryDepartmentType, 
  type SubDepartmentItem, 
  type CategoryQuestionBankState, 
  type SetCode,
  INITIAL_TECHNICAL_SUBDEPTS, 
  INITIAL_NON_TECHNICAL_SUBDEPTS, 
  createInitialCategoryBank,
  generateShuffledSets
} from "../../types/departmentHierarchy";

export default function CreateExamPage() {
  const { navigate } = useRouter();

  // 4-Step Progressive Wizard State
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 3 Category Navigation: Overview ↔ Dedicated Technical ↔ Dedicated Non-Technical
  const [categoryView, setCategoryView] = useState<"OVERVIEW" | "TECHNICAL" | "NON_TECHNICAL">("OVERVIEW");

  // Basic Examination Details
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timingMode, setTimingMode] = useState<"DURATION_FROM_START" | "SCHEDULED">("DURATION_FROM_START");
  const [examDate, setExamDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState("10:00");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [totalQuestions, setTotalQuestions] = useState("50");
  const [totalMarks, setTotalMarks] = useState("100");
  const [marksPerQuestion, setMarksPerQuestion] = useState("2");
  const [negativeMarks, setNegativeMarks] = useState("0");
  
  // Qualification Settings
  const [qualificationMode, setQualificationMode] = useState<"PERCENTAGE" | "ABSOLUTE">("PERCENTAGE");
  const [qualificationThreshold, setQualificationThreshold] = useState("60");

  // Backend Departments Cache
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);

  // Top-Level Mandatory Categories & Sub-Departments
  const [technicalSubDepts, setTechnicalSubDepts] = useState<SubDepartmentItem[]>(INITIAL_TECHNICAL_SUBDEPTS);
  const [nonTechnicalSubDepts, setNonTechnicalSubDepts] = useState<SubDepartmentItem[]>(INITIAL_NON_TECHNICAL_SUBDEPTS);

  // Independent Unified Question Banks with 4 Sets (A, B, C, D)
  const [technicalBank, setTechnicalBank] = useState<CategoryQuestionBankState>(createInitialCategoryBank());
  const [nonTechnicalBank, setNonTechnicalBank] = useState<CategoryQuestionBankState>(createInitialCategoryBank());

  // Extracted Question Review Modal State
  const [reviewingSet, setReviewingSet] = useState<{ 
    deptName: string; 
    setCode: SetCode; 
    questions: ParsedQuestionDto[] 
  } | null>(null);

  const [publishImmediately, setPublishImmediately] = useState(true);

  // Status & Notifications
  const [submitting, setSubmitting] = useState(false);
  const [submissionProgress, setSubmissionProgress] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Synchronize Backend Departments on Mount
  const loadDepartments = async () => {
    setLoadingDepts(true);
    try {
      const data = await getActiveDepartments();
      setDepartments(data);

      if (Array.isArray(data) && data.length > 0) {
        // Link backend IDs to Technical sub-departments if matched
        setTechnicalSubDepts(prev => prev.map(sub => {
          const matched = data.find(d => 
            d.code.toUpperCase() === sub.code.toUpperCase() ||
            d.name.toLowerCase() === sub.name.toLowerCase()
          );
          return matched ? { ...sub, id: matched.id } : sub;
        }));

        // Link backend IDs to Non-Technical sub-departments if matched
        setNonTechnicalSubDepts(prev => prev.map(sub => {
          const matched = data.find(d => 
            d.code.toUpperCase() === sub.code.toUpperCase() ||
            d.name.toLowerCase() === sub.name.toLowerCase()
          );
          return matched ? { ...sub, id: matched.id } : sub;
        }));
      }
    } catch (e) {
      console.warn("Could not fetch departments from PostgreSQL backend:", e);
    } finally {
      setLoadingDepts(false);
    }
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  // Sub-Department Operations (Cross-category checked & collision prevented)
  const handleAddSubDepartment = (
    category: PrimaryDepartmentType, 
    name: string, 
    code: string, 
    description?: string,
    existingDeptId?: number
  ): { success: boolean; error?: string } => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return { success: false, error: "Sub-Department Name is required." };
    }

    let trimmedCode = code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");
    if (!trimmedCode) {
      const parts = trimmedName.split(/\s+/);
      if (parts.length === 1) {
        trimmedCode = parts[0].substring(0, 8).toUpperCase();
      } else {
        trimmedCode = parts.map(p => p[0]).join("").toUpperCase().substring(0, 8);
      }
    }

    const allConfigured = [...technicalSubDepts, ...nonTechnicalSubDepts];
    const nameExists = allConfigured.some(s => s.name.trim().toLowerCase() === trimmedName.toLowerCase());
    if (nameExists) {
      return { success: false, error: `A sub-department named "${trimmedName}" is already configured in this examination.` };
    }

    const codeExists = allConfigured.some(s => s.code.trim().toUpperCase() === trimmedCode);
    if (codeExists) {
      return { success: false, error: `Department code "${trimmedCode}" is already in use by another sub-department in this examination.` };
    }

    const matchedBackend = existingDeptId 
      ? departments.find(d => d.id === existingDeptId)
      : departments.find(d => 
          d.code.toUpperCase() === trimmedCode ||
          d.name.toLowerCase() === trimmedName.toLowerCase()
        );

    const newItem: SubDepartmentItem = {
      id: existingDeptId || matchedBackend?.id,
      tempId: `${category.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      name: trimmedName,
      code: trimmedCode,
      description: description?.trim() || undefined,
      category,
      isDefault: false
    };

    if (category === "TECHNICAL") {
      setTechnicalSubDepts(prev => [...prev, newItem]);
    } else {
      setNonTechnicalSubDepts(prev => [...prev, newItem]);
    }

    return { success: true };
  };

  const handleUpdateSubDepartment = (
    tempId: string, 
    name: string, 
    code: string, 
    description?: string
  ): { success: boolean; error?: string } => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return { success: false, error: "Sub-Department Name cannot be empty." };
    }
    const trimmedCode = code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");
    if (!trimmedCode) {
      return { success: false, error: "Department Code cannot be empty." };
    }

    const isTech = technicalSubDepts.some(s => s.tempId === tempId);
    const allConfigured = [...technicalSubDepts, ...nonTechnicalSubDepts];

    const duplicateName = allConfigured.some(s => s.tempId !== tempId && s.name.trim().toLowerCase() === trimmedName.toLowerCase());
    if (duplicateName) {
      return { success: false, error: `A sub-department named "${trimmedName}" already exists.` };
    }

    const duplicateCode = allConfigured.some(s => s.tempId !== tempId && s.code.trim().toUpperCase() === trimmedCode);
    if (duplicateCode) {
      return { success: false, error: `Department code "${trimmedCode}" is already in use by another sub-department.` };
    }

    const matchedBackend = departments.find(d => 
      d.code.toUpperCase() === trimmedCode ||
      d.name.toLowerCase() === trimmedName.toLowerCase()
    );

    const updater = (s: SubDepartmentItem) => {
      if (s.tempId !== tempId) return s;
      return {
        ...s,
        id: matchedBackend?.id,
        name: trimmedName,
        code: trimmedCode,
        description: description?.trim() || undefined
      };
    };

    if (isTech) {
      setTechnicalSubDepts(prev => prev.map(updater));
    } else {
      setNonTechnicalSubDepts(prev => prev.map(updater));
    }

    return { success: true };
  };

  const handleRemoveSubDepartment = (tempId: string) => {
    setTechnicalSubDepts(prev => prev.filter(s => s.tempId !== tempId));
    setNonTechnicalSubDepts(prev => prev.filter(s => s.tempId !== tempId));
  };

  const handleToggleRandomize = (category: PrimaryDepartmentType, enabled: boolean) => {
    const setter = category === "TECHNICAL" ? setTechnicalBank : setNonTechnicalBank;
    setter(prev => {
      const masterList = (prev.masterQuestions && prev.masterQuestions.length > 0)
        ? prev.masterQuestions
        : (prev.sets.A.parsedQuestions || []);
      const updatedSets = generateShuffledSets(masterList, enabled);
      return {
        ...prev,
        randomizeQuestions: enabled,
        sets: {
          A: { ...prev.sets.A, parsedQuestions: updatedSets.A },
          B: { ...prev.sets.B, parsedQuestions: updatedSets.B },
          C: { ...prev.sets.C, parsedQuestions: updatedSets.C },
          D: { ...prev.sets.D, parsedQuestions: updatedSets.D }
        }
      };
    });
  };

  // Live In-Memory Document Question Extraction for Category
  const triggerCategorySetExtraction = async (
    category: PrimaryDepartmentType,
    qpFile: File,
    akFile?: File | null
  ) => {
    const ext = qpFile.name.split(".").pop()?.toLowerCase();
    if (!["pdf", "docx", "txt", "csv", "xlsx", "xls"].includes(ext || "")) return;

    const setter = category === "TECHNICAL" ? setTechnicalBank : setNonTechnicalBank;
    const currentBank = category === "TECHNICAL" ? technicalBank : nonTechnicalBank;

    // Set extracting state
    const updateExtracting = (status: boolean) => {
      setter(prev => ({
        ...prev,
        extracting: status,
        sets: {
          A: { ...prev.sets.A, extracting: status },
          B: { ...prev.sets.B, extracting: status },
          C: { ...prev.sets.C, extracting: status },
          D: { ...prev.sets.D, extracting: status }
        }
      }));
    };

    updateExtracting(true);

    try {
      const formData = new FormData();
      formData.append("questionPaper", qpFile);
      if (akFile) {
        formData.append("answerSheet", akFile);
      }
      formData.append("marksPerQuestion", marksPerQuestion);
      formData.append("negativeMarks", negativeMarks);

      const resp = await parsePdfInMemory(formData);

      if (resp.questions && resp.questions.length > 0) {
        const generatedSets = generateShuffledSets(resp.questions, currentBank.randomizeQuestions);

        setter(prev => ({
          ...prev,
          masterQuestions: resp.questions,
          sets: {
            A: { ...prev.sets.A, parsedQuestions: generatedSets.A },
            B: { ...prev.sets.B, parsedQuestions: generatedSets.B },
            C: { ...prev.sets.C, parsedQuestions: generatedSets.C },
            D: { ...prev.sets.D, parsedQuestions: generatedSets.D }
          }
        }));

        // Dynamically adjust total questions and marks if extracted count is higher
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
      } else {
        console.warn(`Extraction returned 0 questions for ${category} document.`);
      }
    } catch (err: unknown) {
      console.warn(`Extraction failed for ${category} Question Paper:`, err);
      const errMsg = err instanceof Error ? err.message : "Document parsing failed";
      setServerError(`Question extraction error (${category}): ${errMsg}`);
    } finally {
      updateExtracting(false);
    }
  };

  // Upload/Remove File Handler for Department Track Single Master Upload
  const handleCategorySetFileChange = (
    category: PrimaryDepartmentType,
    _setCode: SetCode,
    docType: "questionPaperFile" | "answerKeyFile",
    file: File | null
  ) => {
    if (file) {
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["pdf", "docx", "txt", "csv", "xlsx", "xls"].includes(ext || "")) {
        alert("Unsupported file format. Please upload a PDF, DOCX, TXT, CSV, or Excel spreadsheet.");
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        alert("File size exceeds maximum 25 MB limit.");
        return;
      }
    }

    const currentBank = category === "TECHNICAL" ? technicalBank : nonTechnicalBank;
    const currentMasterQP = docType === "questionPaperFile" ? file : (currentBank.masterQuestionPaperFile || currentBank.sets.A.questionPaperFile);
    const currentMasterAK = docType === "answerKeyFile" ? file : (currentBank.masterAnswerKeyFile || currentBank.sets.A.answerKeyFile);
    const setter = category === "TECHNICAL" ? setTechnicalBank : setNonTechnicalBank;

    setter(prev => ({
      ...prev,
      [docType === "questionPaperFile" ? "masterQuestionPaperFile" : "masterAnswerKeyFile"]: file,
      masterQuestions: (!file && docType === "questionPaperFile") ? [] : prev.masterQuestions,
      sets: {
        A: {
          ...prev.sets.A,
          [docType]: file,
          parsedQuestions: (!file && docType === "questionPaperFile") ? [] : prev.sets.A.parsedQuestions
        },
        B: {
          ...prev.sets.B,
          [docType]: file,
          parsedQuestions: (!file && docType === "questionPaperFile") ? [] : prev.sets.B.parsedQuestions
        },
        C: {
          ...prev.sets.C,
          [docType]: file,
          parsedQuestions: (!file && docType === "questionPaperFile") ? [] : prev.sets.C.parsedQuestions
        },
        D: {
          ...prev.sets.D,
          [docType]: file,
          parsedQuestions: (!file && docType === "questionPaperFile") ? [] : prev.sets.D.parsedQuestions
        }
      }
    }));

    if (file && docType === "questionPaperFile") {
      triggerCategorySetExtraction(category, file, currentMasterAK);
    } else if (file && docType === "answerKeyFile" && currentMasterQP) {
      triggerCategorySetExtraction(category, currentMasterQP, file);
    }
  };

  // Validation
  // Step 1 Validation
  const validateStep1 = () => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = "Exam title is required";
    if (!description.trim()) errs.description = "Exam description is required";
    
    const dur = parseInt(durationMinutes, 10);
    if (isNaN(dur) || dur < 5 || dur > 360) {
      errs.durationMinutes = "Duration must be between 5 and 360 minutes";
    }

    if (timingMode === "SCHEDULED") {
      if (!examDate) errs.examDate = "Exam date is required for scheduled exams";
      if (!startTime) errs.startTime = "Start time is required for scheduled exams";
    }

    setErrors(prev => ({ ...prev, ...errs }));
    return Object.keys(errs).length === 0;
  };

  // Step 2 Validation
  const validateStep2 = () => {
    const errs: Record<string, string> = {};
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

    setErrors(prev => ({ ...prev, ...errs }));
    return Object.keys(errs).length === 0;
  };

  // Step 3 Validation
  const validateStep3 = () => {
    const totalSubDepts = technicalSubDepts.length + nonTechnicalSubDepts.length;
    if (totalSubDepts === 0) {
      setErrors(prev => ({ ...prev, departments: "Please configure at least one sub-department under Technical or Non-Technical." }));
      return false;
    }
    setErrors(prev => {
      const copy = { ...prev };
      delete copy.departments;
      return copy;
    });
    return true;
  };

  // Complete Validation
  const validate = () => {
    const s1 = validateStep1();
    const s2 = validateStep2();
    const s3 = validateStep3();
    return s1 && s2 && s3;
  };

  // Submit Examination & Persist Question Sets
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setSuccessNotice(null);

    if (!validateStep1()) {
      setWizardStep(1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      setServerError("Please complete the required Examination Details in Step 1.");
      return;
    }
    if (!validateStep2()) {
      setWizardStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
      setServerError("Please resolve the Marking Scheme configuration in Step 2.");
      return;
    }
    if (!validateStep3()) {
      setWizardStep(3);
      window.scrollTo({ top: 0, behavior: "smooth" });
      setServerError("Please configure at least one sub-department under Technical or Non-Technical in Step 3.");
      return;
    }

    setSubmitting(true);
    setSubmissionProgress("Resolving department blueprints in PostgreSQL...");

    try {
      const scheduledStart = timingMode === "SCHEDULED" 
        ? new Date(`${examDate}T${startTime}:00`).toISOString() 
        : undefined;

      // 1. Resolve or Create Sub-Departments in Backend
      const allSubDepts = [...technicalSubDepts, ...nonTechnicalSubDepts];
      const resolvedSubDepts: Array<SubDepartmentItem & { backendId: number }> = [];

      // Eagerly refresh active departments from backend
      let currentDepts = departments;
      try {
        currentDepts = await getActiveDepartments();
        setDepartments(currentDepts);
      } catch (deptFetchErr) {
        console.warn("Could not refresh departments from backend, using cached list:", deptFetchErr);
      }

      for (const sub of allSubDepts) {
        let matched = currentDepts.find(d => 
          (sub.id && d.id === sub.id) ||
          d.code.toUpperCase() === sub.code.toUpperCase() ||
          d.name.toLowerCase() === sub.name.toLowerCase()
        );

        if (matched) {
          resolvedSubDepts.push({ ...sub, backendId: matched.id });
        } else {
          // Register this new sub-department in the database
          try {
            setSubmissionProgress(`Registering sub-department "${sub.name}" in database...`);
            const createdDept = await createDepartment({
              name: sub.name,
              code: sub.code,
              description: sub.description,
              active: true
            });
            resolvedSubDepts.push({ ...sub, backendId: createdDept.id });
            currentDepts = [...currentDepts, createdDept];
            setDepartments(currentDepts);
          } catch (createErr) {
            // Check if department was created or exists in backend despite check
            const retryDepts = await getActiveDepartments().catch(() => []);
            const retryMatch = retryDepts.find(d => 
              d.code.toUpperCase() === sub.code.toUpperCase() ||
              d.name.toLowerCase() === sub.name.toLowerCase()
            );

            if (retryMatch) {
              resolvedSubDepts.push({ ...sub, backendId: retryMatch.id });
            } else {
              const errMsg = createErr instanceof Error ? createErr.message : "Database registration error";
              throw new Error(`Failed to initialize sub-department "${sub.name}" (${sub.code}): ${errMsg}`);
            }
          }
        }
      }

      // Collect unique department IDs for exam creation
      const uniqueDeptIds = Array.from(new Set(resolvedSubDepts.map(s => s.backendId)));
      if (uniqueDeptIds.length === 0) {
        throw new Error("No valid departments could be configured for this examination.");
      }

      // 2. Create Exam with Assigned Department IDs
      setSubmissionProgress("Creating examination blueprint...");
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
        departmentIds: uniqueDeptIds
      });

      let questionsUploadedCount = 0;
      let deptSetsUploaded = 0;

      // 3. Upload Question Sets: Technical Bank -> Technical Sub-Depts, Non-Tech Bank -> Non-Tech Sub-Depts
      // Deduplicate by department backendId so question sets are never uploaded or populated multiple times
      const processedDeptIds = new Set<number>();

      for (const sub of resolvedSubDepts) {
        if (processedDeptIds.has(sub.backendId)) continue;
        processedDeptIds.add(sub.backendId);

        const bank = sub.category === "TECHNICAL" ? technicalBank : nonTechnicalBank;

        try {
          const sets = await getExamDepartmentSets(created.id, sub.backendId);

          if (sets && sets.length > 0) {
            for (const s of sets) {
              const slot = bank.sets[s.setCode];
              if (!slot) continue;

              // Upload question paper
              if (slot.questionPaperFile) {
                setSubmissionProgress(`Uploading Question Paper for ${sub.name} (${s.name})...`);
                await uploadDeptSetDocument(created.id, sub.backendId, s.id, slot.questionPaperFile, "QUESTION_PAPER");
                deptSetsUploaded++;
              }

              // Upload answer key
              if (slot.answerKeyFile) {
                setSubmissionProgress(`Uploading Answer Key for ${sub.name} (${s.name})...`);
                await uploadDeptSetDocument(created.id, sub.backendId, s.id, slot.answerKeyFile, "ANSWER_KEY");
                deptSetsUploaded++;
              }

              // Bulk save extracted MCQs to this set
              if (slot.parsedQuestions && slot.parsedQuestions.length > 0) {
                setSubmissionProgress(`Persisting ${slot.parsedQuestions.length} MCQs to ${sub.name} (${s.name})...`);
                const dtos = slot.parsedQuestions.map((q, idx) => ({
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
        } catch (upErr) {
          console.warn(`Could not sync sets for sub-department ${sub.name}:`, upErr);
        }
      }

      // 4. Publish Exam if Requested
      if (publishImmediately) {
        setSubmissionProgress("Publishing examination for live candidate entrance...");
        try {
          await publishExam(created.id);
        } catch (pubErr) {
          console.warn("Could not publish immediately:", pubErr);
        }
      }

      setSubmissionProgress("");
      let successMsg = `Examination "${created.title}" successfully launched across Technical (${technicalSubDepts.length} roles) and Non-Technical (${nonTechnicalSubDepts.length} roles) tracks!`;
      if (publishImmediately) {
        successMsg += " Status: PUBLISHED (Live for candidate entrance).";
      }
      if (questionsUploadedCount > 0) {
        successMsg += ` ${questionsUploadedCount} MCQs saved across independent question sets.`;
      }

      setSuccessNotice(successMsg);
      window.scrollTo({ top: 0, behavior: "smooth" });

      setTimeout(() => {
        navigate("/admin/exams");
      }, 1600);

    } catch (err: unknown) {
      setSubmissionProgress("");
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        const errorObj = err as Error;
        setServerError(errorObj.message || "Failed to create examination and configure departments");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleStepClick = (targetStep: 1 | 2 | 3 | 4) => {
    if (targetStep > wizardStep) {
      if (wizardStep === 1 && !validateStep1()) return;
      if (wizardStep === 2 && !validateStep2()) return;
      if (wizardStep === 3 && !validateStep3()) return;
      if (targetStep >= 2 && !validateStep1()) {
        setWizardStep(1);
        return;
      }
      if (targetStep >= 3 && !validateStep2()) {
        setWizardStep(2);
        return;
      }
      if (targetStep === 4 && !validateStep3()) {
        setWizardStep(3);
        return;
      }
    }
    setWizardStep(targetStep);
    if (targetStep === 3) setCategoryView("OVERVIEW");
  };

  return (
    <div style={{ maxWidth: "1080px", margin: "0 auto", paddingBottom: "60px" }}>
      {/* Top Header Navigation */}
      <div style={{ marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button 
            type="button" 
            className="secondary" 
            onClick={() => navigate("/admin/exams")}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            title="Return to Examinations"
          >
            <ArrowLeft size={14} /> Back to Examinations
          </button>
        </div>

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
            <b>Examination Blueprint Successfully Created!</b>
            <p style={{ margin: "2px 0 0", fontSize: "12px" }}>{successNotice}</p>
          </div>
        </div>
      )}

      {/* 4-Step Progressive Stepper Bar */}
      <div 
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: "10px",
          marginBottom: "20px",
          background: "#ffffff",
          padding: "10px",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)"
        }}
      >
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
              onClick={() => handleStepClick(step.num as 1 | 2 | 3 | 4)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 12px",
                borderRadius: "8px",
                border: "none",
                background: isActive ? "#EAF6EF" : "transparent",
                color: isActive ? "#017846" : (isDone ? "#166534" : "#64748b"),
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.15s ease",
                fontWeight: isActive ? 700 : 600,
                fontSize: "12px"
              }}
            >
              <div 
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  background: isActive ? "#017846" : (isDone ? "#dcfce7" : "#f1f5f9"),
                  color: isActive ? "#ffffff" : (isDone ? "#166534" : "#64748b"),
                  display: "grid",
                  placeItems: "center",
                  fontSize: "11px",
                  fontWeight: 800,
                  flexShrink: 0
                }}
              >
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
        {/* Step 1: Basic Examination Details */}
        {wizardStep === 1 && (
          <div className="admin-form-card" style={{ marginBottom: "20px" }}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px", color: "#0f172a" }}>
              <Calendar size={18} color="#017846" /> 1. Examination Details & Timing
            </h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Examination Title *
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. Technical & Functional Campus Placement Assessment 2026"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  style={{ width: "100%", padding: "10px", fontSize: "13px", border: "1px solid #cbd5e1", borderRadius: "8px" }}
                />
                {errors.title && <span style={{ color: "#dc2626", fontSize: "11px" }}>{errors.title}</span>}
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Description & Candidate Instructions *
                </label>
                <textarea 
                  rows={3}
                  placeholder="Topics covered, syllabus notes, evaluation criteria, and candidate instructions..."
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
                  if (validateStep1()) {
                    setWizardStep(2);
                  }
                }}
                style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 22px", fontSize: "13px", background: "#017846" }}
              >
                Continue to Marking Scheme <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Marking Scheme & Qualification Rules */}
        {wizardStep === 2 && (
          <div className="admin-form-card" style={{ marginBottom: "20px" }}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px", color: "#0f172a" }}>
              <Layers size={18} color="#017846" /> 2. Marking Scheme & Qualification Rules
            </h3>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "16px" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                  Total Questions *
                </label>
                <input 
                  type="number" 
                  value={totalQuestions}
                  onChange={e => {
                    const val = e.target.value;
                    setTotalQuestions(val);
                    const qNum = parseInt(val, 10);
                    const mNum = parseFloat(marksPerQuestion);
                    if (!isNaN(qNum) && !isNaN(mNum) && qNum > 0 && mNum > 0) {
                      setTotalMarks(String(qNum * mNum));
                    }
                  }}
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
                  step="0.5"
                  value={marksPerQuestion}
                  onChange={e => {
                    const val = e.target.value;
                    setMarksPerQuestion(val);
                    const mNum = parseFloat(val);
                    const qNum = parseInt(totalQuestions, 10);
                    if (!isNaN(qNum) && !isNaN(mNum) && qNum > 0 && mNum > 0) {
                      setTotalMarks(String(qNum * mNum));
                    }
                  }}
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
                onClick={() => {
                  if (validateStep2()) {
                    setWizardStep(3);
                  }
                }}
                style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "10px 22px", fontSize: "13px", background: "#017846" }}
              >
                Continue to Department Sets & Questions <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Top-Level Departments & Unified Question Banks */}
        {wizardStep === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {categoryView === "OVERVIEW" && (
              <>
                <PrimaryDepartmentOverview
                  technicalSubDepts={technicalSubDepts}
                  nonTechnicalSubDepts={nonTechnicalSubDepts}
                  technicalBank={technicalBank}
                  nonTechnicalBank={nonTechnicalBank}
                  availableDepartments={departments}
                  onOpenCategory={(cat) => setCategoryView(cat)}
                  onAddSubDeptQuick={handleAddSubDepartment}
                  onRemoveSubDept={handleRemoveSubDepartment}
                />

                {/* Step 3 Overview Navigation Footer */}
                <div 
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "10px",
                    paddingTop: "16px",
                    borderTop: "1px solid #e2e8f0"
                  }}
                >
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
                      if (technicalSubDepts.length === 0 && nonTechnicalSubDepts.length === 0) {
                        setErrors(prev => ({ ...prev, departments: "Please configure at least one sub-department." }));
                        return;
                      }
                      setWizardStep(4);
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "10px 22px",
                      fontSize: "13px",
                      background: "#017846"
                    }}
                  >
                    Continue to Review & Launch <ArrowRight size={16} />
                  </button>
                </div>
              </>
            )}

            {categoryView === "TECHNICAL" && (
              <DepartmentTrackConfigView
                category="TECHNICAL"
                subDepartments={technicalSubDepts}
                availableDepartments={departments}
                bank={technicalBank}
                onBackToOverview={() => setCategoryView("OVERVIEW")}
                onSwitchCategory={(cat) => setCategoryView(cat)}
                onAddSubDept={handleAddSubDepartment}
                onUpdateSubDept={handleUpdateSubDepartment}
                onRemoveSubDept={handleRemoveSubDepartment}
                onToggleRandomize={handleToggleRandomize}
                onSetFileChange={handleCategorySetFileChange}
                onReviewQuestions={(deptName, setCode, questions) => {
                  setReviewingSet({ deptName, setCode, questions });
                }}
              />
            )}

            {categoryView === "NON_TECHNICAL" && (
              <DepartmentTrackConfigView
                category="NON_TECHNICAL"
                subDepartments={nonTechnicalSubDepts}
                availableDepartments={departments}
                bank={nonTechnicalBank}
                onBackToOverview={() => setCategoryView("OVERVIEW")}
                onSwitchCategory={(cat) => setCategoryView(cat)}
                onAddSubDept={handleAddSubDepartment}
                onUpdateSubDept={handleUpdateSubDepartment}
                onRemoveSubDept={handleRemoveSubDepartment}
                onToggleRandomize={handleToggleRandomize}
                onSetFileChange={handleCategorySetFileChange}
                onReviewQuestions={(deptName, setCode, questions) => {
                  setReviewingSet({ deptName, setCode, questions });
                }}
              />
            )}

            {errors.departments && (
              <span style={{ color: "#dc2626", fontSize: "12px", display: "block" }}>
                {errors.departments}
              </span>
            )}
          </div>
        )}

        {/* Step 4: Final Review & Live Launch */}
        {wizardStep === 4 && (
          <div>
            {/* Examination Blueprint Summary Card */}
            <div className="admin-form-card" style={{ marginBottom: "20px" }}>
              <h3 style={{ margin: "0 0 14px 0", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px", color: "#0f172a" }}>
                <CheckCircle2 size={18} color="#16a34a" /> 4. Review Blueprint & Pre-Flight Verification
              </h3>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "16px" }}>
                <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <small style={{ color: "#64748b", display: "block", fontSize: "11px" }}>Title & Duration</small>
                  <b style={{ color: "#0f172a", fontSize: "13px" }}>{title || "(Untitled Examination)"}</b>
                  <div style={{ fontSize: "11px", color: "#017846", marginTop: "4px" }}>
                    {durationMinutes} Minutes ({timingMode === "SCHEDULED" ? `Scheduled: ${examDate} at ${startTime}` : "On-Demand Duration"})
                  </div>
                </div>

                <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <small style={{ color: "#64748b", display: "block", fontSize: "11px" }}>Primary Department Tracks</small>
                  <b style={{ color: "#0f172a", fontSize: "13px" }}>2 Categories · {technicalSubDepts.length + nonTechnicalSubDepts.length} Sub-Depts</b>
                  <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                    <span style={{ fontSize: "10px", background: "#EAF6EF", color: "#017846", padding: "1px 6px", borderRadius: "4px", fontWeight: 700 }}>
                      Tech: {technicalSubDepts.length} roles
                    </span>
                    <span style={{ fontSize: "10px", background: "#e0f2fe", color: "#0284c7", padding: "1px 6px", borderRadius: "4px", fontWeight: 700 }}>
                      Non-Tech: {nonTechnicalSubDepts.length} roles
                    </span>
                  </div>
                </div>

                <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <small style={{ color: "#64748b", display: "block", fontSize: "11px" }}>Questions & Scoring</small>
                  <b style={{ color: "#0f172a", fontSize: "13px" }}>
                    {(() => {
                      let totalExtracted = 0;
                      for (const code of ["A", "B", "C", "D"] as const) {
                        totalExtracted += technicalBank.sets[code].parsedQuestions.length;
                        totalExtracted += nonTechnicalBank.sets[code].parsedQuestions.length;
                      }
                      return totalExtracted > 0 
                        ? `${totalExtracted} MCQs Extracted Across Sets` 
                        : `${totalQuestions} Questions Planned`;
                    })()}
                  </b>
                  <div style={{ fontSize: "11px", color: "#166534", marginTop: "4px" }}>
                    {marksPerQuestion} Marks/Q · Pass Threshold: {qualificationThreshold}{qualificationMode === "PERCENTAGE" ? "%" : " marks"}
                  </div>
                </div>
              </div>

              {/* Department Tracks & Question Banks Breakdown */}
              <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px solid #e2e8f0" }}>
                <strong style={{ fontSize: "12.5px", color: "#334155", display: "block", marginBottom: "10px" }}>
                  Primary Department Question Bank Status:
                </strong>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {/* Technical Track Summary */}
                  <div 
                    style={{
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      padding: "12px 14px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "10px"
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Code2 size={16} color="#017846" />
                        <b style={{ fontSize: "13px", color: "#0f172a" }}>Technical Department Track</b>
                        <span style={{ fontSize: "10.5px", background: "#EAF6EF", color: "#017846", padding: "1px 6px", borderRadius: "4px", fontWeight: 700 }}>
                          {technicalSubDepts.length} Sub-Departments
                        </span>
                      </div>
                      <small style={{ color: "#64748b", fontSize: "11.5px", marginTop: "2px", display: "block" }}>
                        Specializations: {technicalSubDepts.map(s => s.name).join(", ")}
                      </small>
                    </div>

                    <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                      {(["A", "B", "C", "D"] as const).map(code => {
                        const slot = technicalBank.sets[code];
                        const count = slot.parsedQuestions.length;
                        const hasFiles = !!(slot.questionPaperFile || slot.answerKeyFile);

                        return (
                          <span 
                            key={code}
                            style={{
                              fontSize: "10.5px",
                              padding: "2px 7px",
                              borderRadius: "4px",
                              background: count > 0 ? "#dcfce7" : (hasFiles ? "#EAF6EF" : "#f1f5f9"),
                              color: count > 0 ? "#15803d" : (hasFiles ? "#017846" : "#64748b"),
                              fontWeight: 600
                            }}
                          >
                            Set {code}: {count > 0 ? `✓ ${count} MCQs` : (hasFiles ? "Configured" : "Draft")}
                          </span>
                        );
                      })}
                      <span style={{ fontSize: "10px", color: "#017846", background: "#EAF6EF", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                        🔀 Shuffling: {technicalBank.randomizeQuestions ? "Active" : "Off"}
                      </span>
                    </div>
                  </div>

                  {/* Non-Technical Track Summary */}
                  <div 
                    style={{
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: "8px",
                      padding: "12px 14px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "10px"
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Briefcase size={16} color="#0284c7" />
                        <b style={{ fontSize: "13px", color: "#0f172a" }}>Non-Technical Department Track</b>
                        <span style={{ fontSize: "10.5px", background: "#e0f2fe", color: "#0284c7", padding: "1px 6px", borderRadius: "4px", fontWeight: 700 }}>
                          {nonTechnicalSubDepts.length} Sub-Departments
                        </span>
                      </div>
                      <small style={{ color: "#64748b", fontSize: "11.5px", marginTop: "2px", display: "block" }}>
                        Specializations: {nonTechnicalSubDepts.map(s => s.name).join(", ")}
                      </small>
                    </div>

                    <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                      {(["A", "B", "C", "D"] as const).map(code => {
                        const slot = nonTechnicalBank.sets[code];
                        const count = slot.parsedQuestions.length;
                        const hasFiles = !!(slot.questionPaperFile || slot.answerKeyFile);

                        return (
                          <span 
                            key={code}
                            style={{
                              fontSize: "10.5px",
                              padding: "2px 7px",
                              borderRadius: "4px",
                              background: count > 0 ? "#dcfce7" : (hasFiles ? "#e0f2fe" : "#f1f5f9"),
                              color: count > 0 ? "#15803d" : (hasFiles ? "#0284c7" : "#64748b"),
                              fontWeight: 600
                            }}
                          >
                            Set {code}: {count > 0 ? `✓ ${count} MCQs` : (hasFiles ? "Configured" : "Draft")}
                          </span>
                        );
                      })}
                      <span style={{ fontSize: "10px", color: "#0284c7", background: "#f0f9ff", padding: "2px 6px", borderRadius: "4px", fontWeight: 700 }}>
                        🔀 Shuffling: {nonTechnicalBank.randomizeQuestions ? "Active" : "Off"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Instant Publishing Banner */}
            <div 
              style={{
                background: publishImmediately ? "#f0fdf4" : "#f8fafc",
                border: publishImmediately ? "1.5px solid #86efac" : "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "16px 20px",
                marginBottom: "24px"
              }}
            >
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
                  ? "✓ Active: Upon clicking create, this examination will be immediately PUBLISHED. Candidates in Technical and Non-Technical specializations can enter the assessment portal and start answering questions right away."
                  : "Draft: The examination will be saved as DRAFT. You can publish it manually later from the Examinations Management table whenever ready."}
              </p>
            </div>

            {/* Step 4 Server Error Alert */}
            {serverError && (
              <div 
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  color: "#991b1b",
                  borderRadius: "8px",
                  padding: "12px 16px",
                  marginBottom: "16px",
                  fontSize: "12.5px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
              >
                <AlertCircle size={16} color="#dc2626" />
                <span>{serverError}</span>
              </div>
            )}

            {/* Submit Bar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #e2e8f0", paddingTop: "16px", flexWrap: "wrap", gap: "12px" }}>
              <button 
                type="button" 
                className="secondary" 
                onClick={() => setWizardStep(3)}
                disabled={submitting}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "10px 18px", fontSize: "13px" }}
              >
                <ArrowLeft size={16} /> Back to Department Sets
              </button>

              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                {submissionProgress && (
                  <span style={{ fontSize: "12px", color: "#017846", fontWeight: 600 }}>
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
                  style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "11px 26px", fontSize: "13px", background: "#017846" }}
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
        <div 
          style={{
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
          }}
        >
          <div 
            style={{
              background: "#ffffff",
              borderRadius: "14px",
              width: "100%",
              maxWidth: "760px",
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              overflow: "hidden"
            }}
          >
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#F3FAF6" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "16px", color: "#0f172a" }}>
                  Extracted Question Bank — {reviewingSet.deptName} (Set {reviewingSet.setCode})
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
                        <div 
                          key={opt.label} 
                          style={{
                            padding: "5px 8px",
                            borderRadius: "4px",
                            background: isCorrect ? "#dcfce7" : "#ffffff",
                            border: isCorrect ? "1px solid #86efac" : "1px solid #cbd5e1",
                            color: isCorrect ? "#166534" : "#334155",
                            fontWeight: isCorrect ? 600 : 400
                          }}
                        >
                          <b>{opt.label})</b> {opt.optionText}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", textAlign: "right", background: "#ffffff" }}>
              <button 
                type="button" 
                className="primary" 
                onClick={() => setReviewingSet(null)} 
                style={{ fontSize: "12.5px", padding: "8px 22px", background: "#017846" }}
              >
                Done Reviewing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
