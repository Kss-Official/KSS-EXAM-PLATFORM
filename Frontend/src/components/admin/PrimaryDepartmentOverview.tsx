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

interface PrimaryDepartmentOverviewProps {
  technicalSubDepts: SubDepartmentItem[];
  nonTechnicalSubDepts: SubDepartmentItem[];
  technicalBank: CategoryQuestionBankState;
  nonTechnicalBank: CategoryQuestionBankState;
  onOpenCategory: (category: PrimaryDepartmentType) => void;
  onAddSubDeptQuick: (category: PrimaryDepartmentType, name: string, code: string) => boolean;
}

export default function PrimaryDepartmentOverview({
  technicalSubDepts,
  nonTechnicalSubDepts,
  technicalBank,
  nonTechnicalBank,
  onOpenCategory,
  onAddSubDeptQuick
}: PrimaryDepartmentOverviewProps) {
  // Quick-add modal state from overview
  const [quickAddCategory, setQuickAddCategory] = useState<PrimaryDepartmentType | null>(null);
  const [quickName, setQuickName] = useState("");
  const [quickCode, setQuickCode] = useState("");
  const [quickError, setQuickError] = useState<string | null>(null);

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

  const handleQuickAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddCategory) return;
    setQuickError(null);

    const trimmedName = quickName.trim();
    const trimmedCode = quickCode.trim().toUpperCase();

    if (!trimmedName || !trimmedCode) {
      setQuickError("Both Sub-Department Name and Code are required.");
      return;
    }

    const success = onAddSubDeptQuick(quickAddCategory, trimmedName, trimmedCode);
    if (success) {
      setQuickName("");
      setQuickCode("");
      setQuickAddCategory(null);
    } else {
      setQuickError(`A sub-department named "${trimmedName}" already exists in this category.`);
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
                  onClick={() => {
                    setQuickAddCategory("TECHNICAL");
                    setQuickName("");
                    setQuickCode("");
                    setQuickError(null);
                  }}
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
                  onClick={() => {
                    setQuickAddCategory("NON_TECHNICAL");
                    setQuickName("");
                    setQuickCode("");
                    setQuickError(null);
                  }}
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
                  Add New {quickAddCategory === "TECHNICAL" ? "Technical" : "Non-Technical"} Sub-Department
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

            <form onSubmit={handleQuickAddSubmit} style={{ padding: "20px" }}>
              {quickError && (
                <div style={{ color: "#dc2626", fontSize: "12px", background: "#fef2f2", border: "1px solid #fecaca", padding: "8px 12px", borderRadius: "6px", marginBottom: "14px" }}>
                  {quickError}
                </div>
              )}

              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "5px" }}>
                  Sub-Department Name *
                </label>
                <input
                  type="text"
                  placeholder={quickAddCategory === "TECHNICAL" ? "e.g. Cloud Security Architect" : "e.g. Talent Acquisition Lead"}
                  value={quickName}
                  onChange={e => setQuickName(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", fontSize: "13px", border: "1px solid #cbd5e1", borderRadius: "8px" }}
                  autoFocus
                />
              </div>

              <div style={{ marginBottom: "18px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "5px" }}>
                  Department Code * (Unique within track)
                </label>
                <input
                  type="text"
                  placeholder="e.g. SEC, BD, CRM"
                  value={quickCode}
                  onChange={e => setQuickCode(e.target.value.toUpperCase())}
                  style={{ width: "100%", padding: "9px 12px", fontSize: "13px", border: "1px solid #cbd5e1", borderRadius: "8px" }}
                />
              </div>

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
                  style={{ padding: "8px 20px", fontSize: "12.5px", background: "#017846" }}
                >
                  Add to Examination
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
