import React, { useState } from "react";
import { 
  Code2, 
  Briefcase, 
  Plus, 
  ArrowRight, 
  CheckCircle2, 
  FileText, 
  Shuffle, 
  Sparkles, 
  Layers, 
  HelpCircle 
} from "lucide-react";
import type { 
  PrimaryDepartmentType, 
  SubDepartmentItem, 
  CategoryQuestionBankState, 
  SetCode 
} from "../../types/departmentHierarchy";
import type { DepartmentDto } from "../../services/api";

interface PrimaryDepartmentOverviewProps {
  technicalSubDepts: SubDepartmentItem[];
  nonTechnicalSubDepts: SubDepartmentItem[];
  technicalBank: CategoryQuestionBankState;
  nonTechnicalBank: CategoryQuestionBankState;
  availableDepartments?: DepartmentDto[];
  onOpenCategory: (category: PrimaryDepartmentType) => void;
  onAddSubDeptQuick: (
    category: PrimaryDepartmentType, 
    name: string, 
    code: string, 
    description?: string,
    existingDeptId?: number
  ) => { success: boolean; error?: string };
  onRemoveSubDept?: (tempId: string) => void;
}

export default function PrimaryDepartmentOverview({
  technicalSubDepts,
  nonTechnicalSubDepts,
  technicalBank,
  nonTechnicalBank,
  availableDepartments = [],
  onOpenCategory,
  onAddSubDeptQuick,
  onRemoveSubDept
}: PrimaryDepartmentOverviewProps) {
  // Quick-add modal state from overview
  const STANDARD_TECH_ROLES = [
    { name: "AI/ML Developer", code: "AIML", description: "Machine Learning, Deep Learning, NLP & AI Model Architecture" },
    { name: "Software Developer", code: "DEV", description: "Full Stack Development, Web & Mobile Applications, Architecture" },
    { name: "Software Tester", code: "QA", description: "Quality Assurance, Test Automation, Performance & Reliability" },
    { name: "DevOps", code: "DEVOPS", description: "Cloud Infrastructure, CI/CD Automations, Kubernetes & SRE" },
    { name: "UI/UX Designer", code: "UIUX", description: "Design Systems, User Experience Research, Prototyping & Figma" },
    { name: "Cybersecurity & Information Defense", code: "CYBERSEC", description: "Network Security, Penetration Testing & Cryptography" },
  ];

  const STANDARD_NON_TECH_ROLES = [
    { name: "Human Resources", code: "HR", description: "Human Resources, Talent Acquisition, People Ops & Compliance" },
    { name: "Sales & Marketing", code: "SALES_MKT", description: "Enterprise Sales, Digital Marketing, Growth & Account Strategy" },
    { name: "Talent Acquisition Lead", code: "RECRUIT", description: "Technical Recruiting, Candidate Sourcing & Interview Ops" },
    { name: "Operations Management", code: "OPS", description: "Business Process Operations, Resource Allocation & QA" },
    { name: "Business Development", code: "BIZDEV", description: "Strategic Partnerships, Lead Generation & Client Relations" },
    { name: "Finance & Accounting", code: "FINANCE", description: "Financial Analysis, Corporate Accounting & Budgeting" },
    { name: "Data & Marketing", code: "DATAMKT", description: "Marketing Analytics, Growth Experiments & Customer Funnels" },
    { name: "Corporate Relations", code: "CORPREL", description: "Corporate Communications, Campus Placement & Public Relations" },
  ];

  const [quickAddCategory, setQuickAddCategory] = useState<PrimaryDepartmentType | null>(null);
  const [quickMode, setQuickMode] = useState<"existing" | "new">("existing");
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [quickName, setQuickName] = useState("");
  const [quickCode, setQuickCode] = useState("");
  const [quickDesc, setQuickDesc] = useState("");
  const [codeManuallyEdited, setCodeManuallyEdited] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);

  const openQuickAddModal = (cat: PrimaryDepartmentType) => {
    setQuickAddCategory(cat);
    setSelectedDeptId("");
    setQuickName("");
    setQuickCode("");
    setQuickDesc("");
    setCodeManuallyEdited(false);
    setQuickError(null);
    setQuickMode("existing");
  };

  const getSetStats = (bank: CategoryQuestionBankState) => {
    const setKeys: SetCode[] = ["A", "B", "C", "D"];
    let configuredCount = 0;
    let totalQuestions = 0;

    for (const key of setKeys) {
      const s = bank.sets[key];
      if (s.questionPaperFile || s.answerKeyFile || s.parsedQuestions.length > 0) {
        configuredCount++;
      }
      totalQuestions += s.parsedQuestions.length;
    }

    return { configuredCount, totalQuestions };
  };

  const techStats = getSetStats(technicalBank);
  const nonTechStats = getSetStats(nonTechnicalBank);

  const handleNameChange = (val: string) => {
    setQuickName(val);
    setQuickError(null);
    if (!codeManuallyEdited) {
      const clean = val.trim();
      if (!clean) {
        setQuickCode("");
      } else {
        const parts = clean.split(/\s+/);
        if (parts.length === 1) {
          setQuickCode(parts[0].substring(0, 8).toUpperCase().replace(/[^A-Z0-9_]/g, ""));
        } else {
          setQuickCode(parts.map(p => p[0]).join("").toUpperCase().substring(0, 8).replace(/[^A-Z0-9_]/g, ""));
        }
      }
    }
  };

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddCategory) return;
    setQuickError(null);

    if (quickMode === "existing") {
      if (!selectedDeptId) {
        setQuickError(`Please select a ${quickAddCategory === "TECHNICAL" ? "technical" : "non-technical"} role from the catalog.`);
        return;
      }

      // Check database catalog first
      const dbDept = availableDepartments.find(d => String(d.id) === selectedDeptId);
      // Check preset catalog
      const standardList = quickAddCategory === "TECHNICAL" ? STANDARD_TECH_ROLES : STANDARD_NON_TECH_ROLES;
      const stdPreset = standardList.find(s => s.code === selectedDeptId);

      const targetName = dbDept ? dbDept.name : (stdPreset ? stdPreset.name : "");
      const targetCode = dbDept ? dbDept.code : (stdPreset ? stdPreset.code : "");
      const targetDesc = dbDept ? dbDept.description : (stdPreset ? stdPreset.description : undefined);
      const targetId = dbDept ? dbDept.id : undefined;

      if (!targetName || !targetCode) {
        setQuickError("Selected department role could not be resolved.");
        return;
      }

      const res = onAddSubDeptQuick(quickAddCategory, targetName, targetCode, targetDesc, targetId);
      if (res.success) {
        setSelectedDeptId("");
        setQuickAddCategory(null);
      } else {
        setQuickError(res.error || `Department "${targetName}" could not be added.`);
      }
      return;
    }

    const trimmedName = quickName.trim();
    let trimmedCode = quickCode.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");

    if (!trimmedName) {
      setQuickError("Sub-Department Name is required.");
      return;
    }

    if (!trimmedCode) {
      const parts = trimmedName.split(/\s+/);
      if (parts.length === 1) {
        trimmedCode = parts[0].substring(0, 8).toUpperCase();
      } else {
        trimmedCode = parts.map(p => p[0]).join("").toUpperCase().substring(0, 8);
      }
    }

    const res = onAddSubDeptQuick(quickAddCategory, trimmedName, trimmedCode, quickDesc.trim() || undefined);
    if (res.success) {
      setQuickName("");
      setQuickCode("");
      setQuickDesc("");
      setCodeManuallyEdited(false);
      setQuickAddCategory(null);
    } else {
      setQuickError(res.error || `A sub-department named "${trimmedName}" already exists.`);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header Banner */}
      <div 
        style={{
          background: "linear-gradient(135deg, #ffffff 0%, #F3FAF6 100%)",
          border: "1.5px solid #D9E6DF",
          borderRadius: "14px",
          padding: "20px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          boxShadow: "0 2px 10px rgba(1, 120, 70, 0.05)"
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
            <span 
              style={{
                fontSize: "11px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "#017846",
                background: "#EAF6EF",
                padding: "3px 9px",
                borderRadius: "6px"
              }}
            >
              Step 3 of 4 · Department Tracks
            </span>
            <span style={{ fontSize: "12px", color: "#64748b" }}>Examination Blueprint</span>
          </div>
          <h2 style={{ margin: "0 0 6px 0", fontSize: "18px", color: "#0f172a", fontWeight: 800 }}>
            Department Sets & Questions
          </h2>
          <p style={{ margin: 0, fontSize: "13px", color: "#475569", maxWidth: "640px", lineHeight: 1.5 }}>
            Select a primary department track to manage its specialized sub-departments and configure the 
            unified 4-Set Question Bank (Sets A, B, C, D). All sub-departments in a category automatically share its common question bank.
          </p>
        </div>

        {/* Global Blueprint Metrics */}
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <div 
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              padding: "10px 16px",
              textAlign: "center",
              minWidth: "120px",
              boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)"
            }}
          >
            <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, display: "block" }}>Sub-Departments</span>
            <strong style={{ fontSize: "18px", color: "#017846" }}>
              {technicalSubDepts.length + nonTechnicalSubDepts.length}
            </strong>
            <small style={{ display: "block", fontSize: "10px", color: "#94a3b8" }}>
              {technicalSubDepts.length} Tech · {nonTechnicalSubDepts.length} Non-Tech
            </small>
          </div>

          <div 
            style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              padding: "10px 16px",
              textAlign: "center",
              minWidth: "120px",
              boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)"
            }}
          >
            <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, display: "block" }}>Sets Configured</span>
            <strong style={{ fontSize: "18px", color: "#0f172a" }}>
              {techStats.configuredCount + nonTechStats.configuredCount} / 8
            </strong>
            <small style={{ display: "block", fontSize: "10px", color: "#16a34a" }}>
              {techStats.totalQuestions + nonTechStats.totalQuestions} MCQs Ready
            </small>
          </div>
        </div>
      </div>

      {/* Two Primary Department Cards Grid */}
      <div 
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))",
          gap: "20px"
        }}
      >
        {/* Card 1: Technical Department */}
        <div 
          style={{
            background: "#ffffff",
            border: "1.5px solid #017846",
            borderRadius: "14px",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            boxShadow: "0 4px 20px rgba(1, 120, 70, 0.08)",
            position: "relative",
            overflow: "hidden",
            transition: "all 0.2s ease"
          }}
        >
          {/* Top highlight bar */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "4px", background: "linear-gradient(90deg, #017846, #10b981)" }} />

          <div>
            {/* Header info */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div 
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "10px",
                    background: "#EAF6EF",
                    color: "#017846",
                    display: "grid",
                    placeItems: "center"
                  }}
                >
                  <Code2 size={24} />
                </div>
                <div>
                  <span 
                    style={{
                      fontSize: "10.5px",
                      fontWeight: 800,
                      color: "#017846",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase"
                    }}
                  >
                    Primary Category · Mandatory
                  </span>
                  <h3 style={{ margin: "2px 0 0 0", fontSize: "19px", color: "#0f172a", fontWeight: 800 }}>
                    Technical Department
                  </h3>
                </div>
              </div>

              <span 
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  background: "#EAF6EF",
                  color: "#017846",
                  padding: "4px 10px",
                  borderRadius: "20px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                <Sparkles size={12} /> {technicalSubDepts.length} Sub-Departments
              </span>
            </div>

            <p style={{ fontSize: "13px", color: "#475569", lineHeight: 1.5, margin: "0 0 16px 0" }}>
              Dedicated assessment pipeline for engineering, software development, quality engineering, 
              cloud operations, and user experience design roles.
            </p>

            {/* Sub-Departments List & Badges */}
            <div 
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "14px",
                marginBottom: "16px"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Active Technical Sub-Departments ({technicalSubDepts.length})
                </span>
                <button
                  type="button"
                  onClick={() => openQuickAddModal("TECHNICAL")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#017846",
                    fontSize: "11.5px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: 0
                  }}
                >
                  <Plus size={13} /> Add Sub-Department
                </button>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {technicalSubDepts.map(sub => (
                  <div
                    key={sub.tempId}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      padding: "5px 10px",
                      fontSize: "12px",
                      color: "#1e293b",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <span>{sub.name}</span>
                    <span 
                      style={{
                        fontSize: "9.5px",
                        background: "#EAF6EF",
                        color: "#017846",
                        padding: "1px 5px",
                        borderRadius: "4px",
                        fontWeight: 700
                      }}
                    >
                      {sub.code}
                    </span>
                    {onRemoveSubDept && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveSubDept(sub.tempId);
                        }}
                        title={`Remove ${sub.name} from examination`}
                        style={{
                          border: "none",
                          background: "none",
                          color: "#94a3b8",
                          cursor: "pointer",
                          padding: "0 2px",
                          display: "inline-flex",
                          alignItems: "center",
                          fontSize: "12px",
                          fontWeight: 700,
                          lineHeight: 1
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#dc2626")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Unified Question Bank Status */}
            <div 
              style={{
                border: "1px dashed #cbd5e1",
                borderRadius: "10px",
                padding: "12px 14px",
                marginBottom: "20px",
                background: "#fcfdfd"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>
                  <Layers size={14} color="#017846" /> Common Technical Question Bank
                </div>
                <span style={{ fontSize: "11px", color: (technicalBank.masterQuestionPaperFile || techStats.configuredCount > 0) ? "#16a34a" : "#64748b", fontWeight: 600 }}>
                  {technicalBank.masterQuestionPaperFile ? "1 Question Paper Uploaded (Sets A-D Auto-Generated)" : "No Question Paper Uploaded"}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
                {(["A", "B", "C", "D"] as const).map(setCode => {
                  const set = technicalBank.sets[setCode];
                  const hasQuestions = set.parsedQuestions.length > 0;
                  const hasFiles = !!(set.questionPaperFile || set.answerKeyFile);

                  return (
                    <div
                      key={setCode}
                      style={{
                        background: hasQuestions ? "#dcfce7" : (hasFiles ? "#EAF6EF" : "#f1f5f9"),
                        border: `1px solid ${hasQuestions ? "#86efac" : (hasFiles ? "#a7f3d0" : "#e2e8f0")}`,
                        borderRadius: "6px",
                        padding: "6px 4px",
                        textAlign: "center"
                      }}
                    >
                      <b style={{ fontSize: "11px", color: hasQuestions ? "#166534" : (hasFiles ? "#017846" : "#475569") }}>
                        Set {setCode}
                      </b>
                      <div style={{ fontSize: "9.5px", color: hasQuestions ? "#15803d" : (hasFiles ? "#017846" : "#94a3b8"), marginTop: "2px" }}>
                        {hasQuestions ? `${set.parsedQuestions.length} Qs` : (hasFiles ? "Synced" : "Empty")}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px", fontSize: "11px", color: "#64748b" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <Shuffle size={12} color={technicalBank.randomizeQuestions ? "#017846" : "#64748b"} /> Randomization: <b style={{ color: technicalBank.randomizeQuestions ? "#017846" : "#64748b" }}>{technicalBank.randomizeQuestions ? "Enabled (Shuffled Sets)" : "Disabled (Identical Sets)"}</b>
                </span>
                <span>Shared by all {technicalSubDepts.length} Tech roles</span>
              </div>
            </div>
          </div>

          {/* Primary Action Button */}
          <button
            type="button"
            className="primary"
            onClick={() => onOpenCategory("TECHNICAL")}
            style={{
              width: "100%",
              padding: "12px 18px",
              fontSize: "13px",
              fontWeight: 700,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "8px",
              borderRadius: "8px",
              background: "#017846",
              boxShadow: "0 2px 8px rgba(1, 120, 70, 0.2)"
            }}
          >
            Configure Technical Department & Question Sets <ArrowRight size={16} />
          </button>
        </div>

        {/* Card 2: Non-Technical Department */}
        <div 
          style={{
            background: "#ffffff",
            border: "1.5px solid #0284c7",
            borderRadius: "14px",
            padding: "24px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            boxShadow: "0 4px 20px rgba(2, 132, 199, 0.08)",
            position: "relative",
            overflow: "hidden",
            transition: "all 0.2s ease"
          }}
        >
          {/* Top highlight bar */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "4px", background: "linear-gradient(90deg, #0284c7, #38bdf8)" }} />

          <div>
            {/* Header info */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div 
                  style={{
                    width: "44px",
                    height: "44px",
                    borderRadius: "10px",
                    background: "#f0f9ff",
                    color: "#0284c7",
                    display: "grid",
                    placeItems: "center"
                  }}
                >
                  <Briefcase size={24} />
                </div>
                <div>
                  <span 
                    style={{
                      fontSize: "10.5px",
                      fontWeight: 800,
                      color: "#0284c7",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase"
                    }}
                  >
                    Primary Category · Mandatory
                  </span>
                  <h3 style={{ margin: "2px 0 0 0", fontSize: "19px", color: "#0f172a", fontWeight: 800 }}>
                    Non-Technical Department
                  </h3>
                </div>
              </div>

              <span 
                style={{
                  fontSize: "11px",
                  fontWeight: 700,
                  background: "#f0f9ff",
                  color: "#0284c7",
                  padding: "4px 10px",
                  borderRadius: "20px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                <Sparkles size={12} /> {nonTechnicalSubDepts.length} Sub-Departments
              </span>
            </div>

            <p style={{ fontSize: "13px", color: "#475569", lineHeight: 1.5, margin: "0 0 16px 0" }}>
              Dedicated assessment pipeline for human resources, recruitment, corporate operations, 
              enterprise sales, business development, and marketing tracks.
            </p>

            {/* Sub-Departments List & Badges */}
            <div 
              style={{
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: "10px",
                padding: "14px",
                marginBottom: "16px"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#334155", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Active Non-Technical Sub-Departments ({nonTechnicalSubDepts.length})
                </span>
                <button
                  type="button"
                  onClick={() => openQuickAddModal("NON_TECHNICAL")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#0284c7",
                    fontSize: "11.5px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: 0
                  }}
                >
                  <Plus size={13} /> Add Sub-Department
                </button>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {nonTechnicalSubDepts.map(sub => (
                  <div
                    key={sub.tempId}
                    style={{
                      background: "#ffffff",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      padding: "5px 10px",
                      fontSize: "12px",
                      color: "#1e293b",
                      fontWeight: 600,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <span>{sub.name}</span>
                    <span 
                      style={{
                        fontSize: "9.5px",
                        background: "#e0f2fe",
                        color: "#0284c7",
                        padding: "1px 5px",
                        borderRadius: "4px",
                        fontWeight: 700
                      }}
                    >
                      {sub.code}
                    </span>
                    {onRemoveSubDept && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveSubDept(sub.tempId);
                        }}
                        title={`Remove ${sub.name} from examination`}
                        style={{
                          border: "none",
                          background: "none",
                          color: "#94a3b8",
                          cursor: "pointer",
                          padding: "0 2px",
                          display: "inline-flex",
                          alignItems: "center",
                          fontSize: "12px",
                          fontWeight: 700,
                          lineHeight: 1
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#dc2626")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Unified Question Bank Status */}
            <div 
              style={{
                border: "1px dashed #cbd5e1",
                borderRadius: "10px",
                padding: "12px 14px",
                marginBottom: "20px",
                background: "#fcfdfd"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: 700, color: "#0f172a" }}>
                  <Layers size={14} color="#0284c7" /> Common Non-Technical Question Bank
                </div>
                <span style={{ fontSize: "11px", color: (nonTechnicalBank.masterQuestionPaperFile || nonTechStats.configuredCount > 0) ? "#0284c7" : "#64748b", fontWeight: 600 }}>
                  {nonTechnicalBank.masterQuestionPaperFile ? "1 Question Paper Uploaded (Sets A-D Auto-Generated)" : "No Question Paper Uploaded"}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
                {(["A", "B", "C", "D"] as const).map(setCode => {
                  const set = nonTechnicalBank.sets[setCode];
                  const hasQuestions = set.parsedQuestions.length > 0;
                  const hasFiles = !!(set.questionPaperFile || set.answerKeyFile);

                  return (
                    <div
                      key={setCode}
                      style={{
                        background: hasQuestions ? "#dcfce7" : (hasFiles ? "#e0f2fe" : "#f1f5f9"),
                        border: `1px solid ${hasQuestions ? "#86efac" : (hasFiles ? "#bae6fd" : "#e2e8f0")}`,
                        borderRadius: "6px",
                        padding: "6px 4px",
                        textAlign: "center"
                      }}
                    >
                      <b style={{ fontSize: "11px", color: hasQuestions ? "#166534" : (hasFiles ? "#0284c7" : "#475569") }}>
                        Set {setCode}
                      </b>
                      <div style={{ fontSize: "9.5px", color: hasQuestions ? "#15803d" : (hasFiles ? "#0284c7" : "#94a3b8"), marginTop: "2px" }}>
                        {hasQuestions ? `${set.parsedQuestions.length} Qs` : (hasFiles ? "Synced" : "Empty")}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px", fontSize: "11px", color: "#64748b" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                  <Shuffle size={12} color={nonTechnicalBank.randomizeQuestions ? "#0284c7" : "#64748b"} /> Randomization: <b style={{ color: nonTechnicalBank.randomizeQuestions ? "#0284c7" : "#64748b" }}>{nonTechnicalBank.randomizeQuestions ? "Enabled (Shuffled Sets)" : "Disabled (Identical Sets)"}</b>
                </span>
                <span>Shared by all {nonTechnicalSubDepts.length} Non-Tech roles</span>
              </div>
            </div>
          </div>

          {/* Primary Action Button */}
          <button
            type="button"
            className="secondary"
            onClick={() => onOpenCategory("NON_TECHNICAL")}
            style={{
              width: "100%",
              padding: "12px 18px",
              fontSize: "13px",
              fontWeight: 700,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "8px",
              borderRadius: "8px",
              border: "1.5px solid #0284c7",
              color: "#0369a1",
              background: "#f0f9ff"
            }}
          >
            Configure Non-Technical Department & Question Sets <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Quick Add Sub-Department Modal from Overview */}
      {quickAddCategory && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.55)",
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
              maxWidth: "480px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              overflow: "hidden"
            }}
          >
            <div 
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: quickAddCategory === "TECHNICAL" ? "#F3FAF6" : "#f0f9ff"
              }}
            >
              <div>
                <h4 style={{ margin: 0, fontSize: "15px", color: "#0f172a", fontWeight: 700 }}>
                  Add {quickAddCategory === "TECHNICAL" ? "Technical" : "Non-Technical"} Sub-Department
                </h4>
                <small style={{ color: "#64748b", fontSize: "11.5px" }}>
                  This specialization will share the common {quickAddCategory === "TECHNICAL" ? "Technical" : "Non-Technical"} question bank.
                </small>
              </div>
              <button
                type="button"
                onClick={() => setQuickAddCategory(null)}
                style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#64748b", fontWeight: 700 }}
              >
                ✕
              </button>
            </div>

            {/* Mode Selector Tabs */}
            {(() => {
              const isTech = quickAddCategory === "TECHNICAL";
              const configuredCodes = new Set([...technicalSubDepts, ...nonTechnicalSubDepts].map(s => s.code.toUpperCase()));
              const configuredNames = new Set([...technicalSubDepts, ...nonTechnicalSubDepts].map(s => s.name.trim().toLowerCase()));

              // Filter database catalog departments
              const NON_TECH_CODES = new Set(["HR", "SALES_MKT", "MKT", "SALES", "MARKETING", "FIN", "FINANCE", "OPS", "MGMT", "NON_TECH", "DATAMKT", "BIZDEV", "RECRUIT"]);
              const isDeptNonTech = (d: DepartmentDto) => {
                const c = (d.code || "").toUpperCase();
                const n = (d.name || "").toLowerCase();
                return NON_TECH_CODES.has(c) || n.includes("human resource") || n.includes("hr") || n.includes("marketing") || n.includes("sales") || n.includes("business") || n.includes("finance");
              };

              const dbTrackDepts = availableDepartments.filter(d => {
                if (configuredCodes.has(d.code.toUpperCase()) || configuredNames.has(d.name.trim().toLowerCase())) return false;
                return isTech ? !isDeptNonTech(d) : isDeptNonTech(d);
              });

              // Standard presets for the category that are not yet added
              const standardList = isTech ? STANDARD_TECH_ROLES : STANDARD_NON_TECH_ROLES;
              const unconfiguredPresets = standardList.filter(p => 
                !configuredCodes.has(p.code.toUpperCase()) && 
                !configuredNames.has(p.name.trim().toLowerCase()) &&
                !dbTrackDepts.some(d => d.code.toUpperCase() === p.code.toUpperCase() || d.name.toLowerCase() === p.name.toLowerCase())
              );

              interface CatalogOption {
                value: string;
                name: string;
                code: string;
                group: string;
              }

              const catalogOptions: CatalogOption[] = [
                ...unconfiguredPresets.map(p => ({
                  value: p.code,
                  name: p.name,
                  code: p.code,
                  group: isTech ? "Recommended Technical Roles" : "Recommended Non-Technical Roles"
                })),
                ...dbTrackDepts.map(d => ({
                  value: String(d.id),
                  name: d.name,
                  code: d.code,
                  group: "Database Catalog"
                }))
              ];

              const totalSelectable = catalogOptions.length;

              return (
                <form onSubmit={handleQuickAddSubmit} style={{ padding: "20px" }}>
                  {quickError && (
                    <div style={{ color: "#dc2626", fontSize: "12px", background: "#fef2f2", border: "1px solid #fecaca", padding: "8px 12px", borderRadius: "6px", marginBottom: "14px" }}>
                      {quickError}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "8px", marginBottom: "16px", borderBottom: "1px solid #e2e8f0", paddingBottom: "10px" }}>
                    <button
                      type="button"
                      onClick={() => { setQuickMode("existing"); setQuickError(null); }}
                      style={{
                        padding: "6px 12px",
                        fontSize: "12px",
                        fontWeight: quickMode === "existing" ? 700 : 500,
                        borderRadius: "6px",
                        border: "none",
                        cursor: "pointer",
                        background: quickMode === "existing" ? (isTech ? "#EAF6EF" : "#eff6ff") : "transparent",
                        color: quickMode === "existing" ? (isTech ? "#017846" : "#0284c7") : "#64748b"
                      }}
                    >
                      {isTech ? "Technical Catalog / Roles" : "Non-Technical Catalog / Roles"} ({totalSelectable})
                    </button>
                    <button
                      type="button"
                      onClick={() => { setQuickMode("new"); setQuickError(null); }}
                      style={{
                        padding: "6px 12px",
                        fontSize: "12px",
                        fontWeight: quickMode === "new" ? 700 : 500,
                        borderRadius: "6px",
                        border: "none",
                        cursor: "pointer",
                        background: quickMode === "new" ? (isTech ? "#EAF6EF" : "#eff6ff") : "transparent",
                        color: quickMode === "new" ? (isTech ? "#017846" : "#0284c7") : "#64748b"
                      }}
                    >
                      + Create Custom Sub-Dept
                    </button>
                  </div>

                  {quickMode === "existing" ? (
                    <div style={{ marginBottom: "18px" }}>
                      <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                        Select {isTech ? "Technical" : "Non-Technical"} Role / Department *
                      </label>
                      {totalSelectable === 0 ? (
                        <div style={{ padding: "12px", background: "#f8fafc", borderRadius: "6px", border: "1px dashed #cbd5e1", fontSize: "12px", color: "#64748b" }}>
                          All standard and database {isTech ? "technical" : "non-technical"} departments are already configured in this exam. Switch to "+ Create Custom Sub-Dept" to add a new specialization.
                        </div>
                      ) : (
                        <select
                          value={selectedDeptId}
                          onChange={e => {
                            setSelectedDeptId(e.target.value);
                            setQuickError(null);
                          }}
                          style={{ width: "100%", padding: "9px 12px", fontSize: "13px", border: "1px solid #cbd5e1", borderRadius: "8px", background: "#ffffff" }}
                          autoFocus
                        >
                          <option value="">-- Choose {isTech ? "Technical" : "Non-Technical"} Role --</option>
                          {catalogOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>
                              {opt.name} ({opt.code}) - {opt.group}
                            </option>
                          ))}
                        </select>
                      )}
                      <small style={{ color: "#64748b", fontSize: "11px", marginTop: "4px", display: "block" }}>
                        Select an existing active department to enroll candidates into this category track.
                      </small>
                    </div>
                  ) : (
                    <>
                      <div style={{ marginBottom: "14px" }}>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "5px" }}>
                          Sub-Department Name *
                        </label>
                        <input
                          type="text"
                          placeholder={isTech ? "e.g. Cloud Security Architect, Data Engineer" : "e.g. Talent Acquisition Lead, Operations Manager"}
                          value={quickName}
                          onChange={e => handleNameChange(e.target.value)}
                          style={{ width: "100%", padding: "9px 12px", fontSize: "13px", border: "1px solid #cbd5e1", borderRadius: "8px" }}
                          autoFocus
                        />
                      </div>

                      <div style={{ marginBottom: "14px" }}>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "5px" }}>
                          Department Code * (Unique alphanumeric)
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. SEC, OPS, FIN"
                          value={quickCode}
                          onChange={e => {
                            setCodeManuallyEdited(true);
                            setQuickCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""));
                          }}
                          style={{ width: "100%", padding: "9px 12px", fontSize: "13px", border: "1px solid #cbd5e1", borderRadius: "8px" }}
                        />
                        <small style={{ color: "#64748b", fontSize: "11px", marginTop: "4px", display: "block" }}>
                          Auto-suggested from name. You can customize it if needed.
                        </small>
                      </div>

                      <div style={{ marginBottom: "18px" }}>
                        <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "5px" }}>
                          Description (Optional)
                        </label>
                        <input
                          type="text"
                          placeholder="Scope, candidate role, or syllabus notes"
                          value={quickDesc}
                          onChange={e => setQuickDesc(e.target.value)}
                          style={{ width: "100%", padding: "9px 12px", fontSize: "13px", border: "1px solid #cbd5e1", borderRadius: "8px" }}
                        />
                      </div>
                    </>
                  )}

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => setQuickAddCategory(null)}
                      style={{ padding: "8px 16px", fontSize: "12.5px" }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="primary"
                      disabled={quickMode === "existing" && totalSelectable === 0}
                      style={{ padding: "8px 20px", fontSize: "12.5px", background: isTech ? "#017846" : "#0284c7" }}
                    >
                      Add to Examination
                    </button>
                  </div>
                </form>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
