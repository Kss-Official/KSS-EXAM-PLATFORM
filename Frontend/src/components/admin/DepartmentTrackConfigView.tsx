import React, { useState, useRef } from "react";
import { 
  ArrowLeft, 
  Code2, 
  Briefcase, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Layers, 
  Shuffle, 
  Sparkles, 
  FileText, 
  KeyRound, 
  Eye, 
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  FolderPlus
} from "lucide-react";
import type { 
  PrimaryDepartmentType, 
  SubDepartmentItem, 
  CategoryQuestionBankState, 
  SetCode 
} from "../../types/departmentHierarchy";
import type { ParsedQuestionDto, DepartmentDto } from "../../services/api";

interface DepartmentTrackConfigViewProps {
  category: PrimaryDepartmentType;
  subDepartments: SubDepartmentItem[];
  availableDepartments?: DepartmentDto[];
  bank: CategoryQuestionBankState;
  onBackToOverview: () => void;
  onSwitchCategory: (newCategory: PrimaryDepartmentType) => void;
  onAddSubDept: (
    category: PrimaryDepartmentType, 
    name: string, 
    code: string, 
    description?: string,
    existingDeptId?: number
  ) => { success: boolean; error?: string };
  onUpdateSubDept: (tempId: string, name: string, code: string, description?: string) => { success: boolean; error?: string };
  onRemoveSubDept: (tempId: string) => void;
  onToggleRandomize: (category: PrimaryDepartmentType, enabled: boolean) => void;
  onSetFileChange: (
    category: PrimaryDepartmentType,
    setCode: SetCode,
    docType: "questionPaperFile" | "answerKeyFile",
    file: File | null
  ) => void;
  onReviewQuestions: (deptName: string, setCode: SetCode, questions: ParsedQuestionDto[]) => void;
}

export default function DepartmentTrackConfigView({
  category,
  subDepartments,
  availableDepartments = [],
  bank,
  onBackToOverview,
  onSwitchCategory,
  onAddSubDept,
  onUpdateSubDept,
  onRemoveSubDept,
  onToggleRandomize,
  onSetFileChange,
  onReviewQuestions
}: DepartmentTrackConfigViewProps) {
  const isTech = category === "TECHNICAL";
  const primaryBrand = isTech ? "#017846" : "#0284c7";
  const lightBg = isTech ? "#EAF6EF" : "#f0f9ff";
  const paleBg = isTech ? "#F3FAF6" : "#f8fafc";
  const accentBorder = isTech ? "#86efac" : "#bae6fd";

  // Section reference for quick scrolling to question bank
  const questionBankSectionRef = useRef<HTMLDivElement>(null);

  // Add sub-department state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addMode, setAddMode] = useState<"existing" | "custom">("existing");
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [newCodeEdited, setNewCodeEdited] = useState(false);
  const [newDesc, setNewDesc] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  // Edit sub-department state
  const [editingTempId, setEditingTempId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  // Delete confirmation modal state
  const [deletingSubDept, setDeletingSubDept] = useState<SubDepartmentItem | null>(null);

  const categorySubDepts = subDepartments.filter(s => s.category === category);
  const configuredCodes = new Set(subDepartments.map(s => s.code.toUpperCase()));
  const selectableExisting = availableDepartments.filter(d => !configuredCodes.has(d.code.toUpperCase()));

  const handleStartEdit = (sub: SubDepartmentItem) => {
    setEditingTempId(sub.tempId);
    setEditName(sub.name);
    setEditCode(sub.code);
    setEditDesc(sub.description || "");
    setEditError(null);
  };

  const handleCancelEdit = () => {
    setEditingTempId(null);
    setEditName("");
    setEditCode("");
    setEditDesc("");
    setEditError(null);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTempId) return;

    const trimmedName = editName.trim();
    const trimmedCode = editCode.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");

    if (!trimmedName) {
      setEditError("Sub-Department Name cannot be empty.");
      return;
    }
    if (!trimmedCode) {
      setEditError("Department Code cannot be empty.");
      return;
    }

    const res = onUpdateSubDept(editingTempId, trimmedName, trimmedCode, editDesc.trim());
    if (res.success) {
      handleCancelEdit();
    } else {
      setEditError(res.error || `A sub-department named "${trimmedName}" already exists.`);
    }
  };

  const handleNewNameChange = (val: string) => {
    setNewName(val);
    setAddError(null);
    if (!newCodeEdited) {
      const clean = val.trim();
      if (!clean) {
        setNewCode("");
      } else {
        const parts = clean.split(/\s+/);
        if (parts.length === 1) {
          setNewCode(parts[0].substring(0, 8).toUpperCase().replace(/[^A-Z0-9_]/g, ""));
        } else {
          setNewCode(parts.map(p => p[0]).join("").toUpperCase().substring(0, 8).replace(/[^A-Z0-9_]/g, ""));
        }
      }
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);

    if (addMode === "existing") {
      if (!selectedDeptId) {
        setAddError("Please select an academic department from the list.");
        return;
      }
      const dept = availableDepartments.find(d => String(d.id) === selectedDeptId);
      if (!dept) {
        setAddError("Selected department could not be found.");
        return;
      }
      const res = onAddSubDept(category, dept.name, dept.code, dept.description, dept.id);
      if (res.success) {
        setSelectedDeptId("");
        setShowAddForm(false);
      } else {
        setAddError(res.error || `Department "${dept.name}" could not be added.`);
      }
      return;
    }

    const trimmedName = newName.trim();
    const trimmedCode = newCode.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "");

    if (!trimmedName) {
      setAddError("Sub-Department Name is required.");
      return;
    }

    const res = onAddSubDept(category, trimmedName, trimmedCode, newDesc.trim() || undefined);
    if (res.success) {
      setNewName("");
      setNewCode("");
      setNewCodeEdited(false);
      setNewDesc("");
      setShowAddForm(false);
    } else {
      setAddError(res.error || `A sub-department named "${trimmedName}" already exists.`);
    }
  };

  const scrollToQuestionBank = () => {
    if (questionBankSectionRef.current) {
      questionBankSectionRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Navigation & Category Switcher Bar */}
      <div 
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          background: "#ffffff",
          padding: "12px 18px",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 4px rgba(15, 23, 42, 0.04)"
        }}
      >
        <button
          type="button"
          onClick={onBackToOverview}
          className="secondary"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            fontSize: "12.5px",
            padding: "8px 14px",
            fontWeight: 700,
            color: "#334155"
          }}
        >
          <ArrowLeft size={16} /> Back to Department Selection
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "12px", color: "#64748b" }}>Quick Track Switcher:</span>
          <button
            type="button"
            onClick={() => onSwitchCategory(isTech ? "NON_TECHNICAL" : "TECHNICAL")}
            style={{
              background: lightBg,
              border: `1.5px solid ${primaryBrand}`,
              color: primaryBrand,
              borderRadius: "8px",
              padding: "7px 14px",
              fontSize: "12px",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            {isTech ? (
              <>
                <Briefcase size={14} /> Switch to Non-Technical Department <ArrowRight size={13} />
              </>
            ) : (
              <>
                <Code2 size={14} /> Switch to Technical Department <ArrowRight size={13} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Category Track Header Banner */}
      <div 
        style={{
          background: `linear-gradient(135deg, #ffffff 0%, ${paleBg} 100%)`,
          border: `1.5px solid ${isTech ? "#D9E6DF" : "#bae6fd"}`,
          borderRadius: "14px",
          padding: "20px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          boxShadow: `0 4px 16px ${isTech ? "rgba(1, 120, 70, 0.06)" : "rgba(2, 132, 199, 0.06)"}`
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div 
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "12px",
              background: lightBg,
              color: primaryBrand,
              display: "grid",
              placeItems: "center",
              border: `1px solid ${accentBorder}`
            }}
          >
            {isTech ? <Code2 size={28} /> : <Briefcase size={28} />}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span 
                style={{
                  fontSize: "10.5px",
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: primaryBrand,
                  background: lightBg,
                  padding: "2px 8px",
                  borderRadius: "4px"
                }}
              >
                Primary Department Track
              </span>
              <span style={{ fontSize: "11.5px", color: "#64748b" }}>
                · Candidate Selection Tier 1
              </span>
            </div>
            <h2 style={{ margin: "0 0 4px 0", fontSize: "20px", color: "#0f172a", fontWeight: 800 }}>
              {isTech ? "Technical Department" : "Non-Technical Department"}
            </h2>
            <p style={{ margin: 0, fontSize: "12.5px", color: "#475569" }}>
              {isTech
                ? "Manage sub-departments (Tier 2 selection) and the common Technical question bank with 4 independent sets."
                : "Manage sub-departments (Tier 2 selection) and the common Non-Technical question bank with 4 independent sets."}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={scrollToQuestionBank}
          className="secondary"
          style={{
            fontSize: "12px",
            padding: "8px 14px",
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            borderColor: primaryBrand,
            color: primaryBrand
          }}
        >
          <Layers size={14} /> Jump to Shared Question Bank ↓
        </button>
      </div>

      {/* SECTION 1: Sub-Departments Management */}
      <div className="admin-form-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px", color: "#0f172a" }}>
              <Sparkles size={18} color={primaryBrand} />
              1. Sub-Departments Management ({categorySubDepts.length})
            </h3>
            <p style={{ margin: 0, fontSize: "12px", color: "#64748b", maxWidth: "680px" }}>
              These sub-departments represent the second-level specialization choices available to candidates who choose the{" "}
              <b>{isTech ? "Technical" : "Non-Technical"}</b> track. All sub-departments here share the common question bank below.
            </p>
          </div>

          <button
            type="button"
            className="primary"
            onClick={() => setShowAddForm(!showAddForm)}
            style={{
              padding: "7px 14px",
              fontSize: "12px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: primaryBrand
            }}
          >
            <Plus size={14} /> {showAddForm ? "Cancel Adding" : `Add Another ${isTech ? "Technical" : "Non-Technical"} Sub-Dept`}
          </button>
        </div>

        {/* Inline Add Sub-Department Form */}
        {showAddForm && (
          <form 
            onSubmit={handleAddSubmit}
            style={{
              background: paleBg,
              border: `1.5px solid ${accentBorder}`,
              borderRadius: "10px",
              padding: "16px",
              marginBottom: "18px"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <strong style={{ fontSize: "13px", color: "#0f172a", display: "flex", alignItems: "center", gap: "6px" }}>
                  <FolderPlus size={15} color={primaryBrand} />
                  Add {isTech ? "Technical" : "Non-Technical"} Sub-Department
                </strong>
                <div style={{ display: "flex", background: "#ffffff", padding: "2px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                  <button
                    type="button"
                    onClick={() => { setAddMode("existing"); setAddError(null); }}
                    style={{
                      padding: "4px 10px",
                      fontSize: "11px",
                      fontWeight: addMode === "existing" ? 700 : 500,
                      borderRadius: "4px",
                      border: "none",
                      cursor: "pointer",
                      background: addMode === "existing" ? lightBg : "transparent",
                      color: addMode === "existing" ? primaryBrand : "#64748b"
                    }}
                  >
                    From Database ({selectableExisting.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAddMode("custom"); setAddError(null); }}
                    style={{
                      padding: "4px 10px",
                      fontSize: "11px",
                      fontWeight: addMode === "custom" ? 700 : 500,
                      borderRadius: "4px",
                      border: "none",
                      cursor: "pointer",
                      background: addMode === "custom" ? lightBg : "transparent",
                      color: addMode === "custom" ? primaryBrand : "#64748b"
                    }}
                  >
                    + New Custom Role
                  </button>
                </div>
              </div>
              <small style={{ color: "#64748b", fontSize: "11px" }}>Duplicate codes or names are strictly prevented.</small>
            </div>

            {addError && (
              <div style={{ color: "#dc2626", fontSize: "11.5px", background: "#fef2f2", border: "1px solid #fecaca", padding: "8px 12px", borderRadius: "6px", marginBottom: "12px" }}>
                {addError}
              </div>
            )}

            {addMode === "existing" ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "10px", alignItems: "flex-end" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Select Academic Department *
                  </label>
                  {selectableExisting.length === 0 ? (
                    <div style={{ padding: "8px 12px", background: "#ffffff", borderRadius: "6px", border: "1px dashed #cbd5e1", fontSize: "12px", color: "#64748b" }}>
                      All existing academic departments are already enrolled. Switch to "+ New Custom Role" above to create a new specialization.
                    </div>
                  ) : (
                    <select
                      value={selectedDeptId}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                        setSelectedDeptId(e.target.value);
                        setAddError(null);
                      }}
                      style={{ width: "100%", padding: "8px 10px", fontSize: "12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#ffffff" }}
                      autoFocus
                    >
                      <option value="">-- Choose from Database Catalog --</option>
                      {selectableExisting.map(d => (
                        <option key={d.id} value={String(d.id)}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <button
                  type="submit"
                  className="primary"
                  disabled={selectableExisting.length === 0}
                  style={{ padding: "8px 16px", fontSize: "12px", background: primaryBrand, height: "35px" }}
                >
                  Add to Track
                </button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setShowAddForm(false)}
                  style={{ padding: "8px 12px", fontSize: "12px", height: "35px" }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 2fr auto", gap: "10px", alignItems: "flex-end" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Sub-Department Name *
                  </label>
                  <input
                    type="text"
                    placeholder={isTech ? "e.g. Data Engineer, Cybersecurity" : "e.g. Operations Manager, PR"}
                    value={newName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleNewNameChange(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", fontSize: "12px", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                    autoFocus
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Code * (Auto-suggested)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. DATA, OPS"
                    value={newCode}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      setNewCodeEdited(true);
                      setNewCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ""));
                    }}
                    style={{ width: "100%", padding: "8px 10px", fontSize: "12px", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Description (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Scope, candidate role, or syllabus notes"
                    value={newDesc}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewDesc(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px", fontSize: "12px", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                  />
                </div>

                <div style={{ display: "flex", gap: "6px" }}>
                  <button
                    type="submit"
                    className="primary"
                    style={{ padding: "8px 16px", fontSize: "12px", background: primaryBrand, height: "35px" }}
                  >
                    Save & Add
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setShowAddForm(false)}
                    style={{ padding: "8px 12px", fontSize: "12px", height: "35px" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </form>
        )}

        {/* Sub-Departments Table / List */}
        {categorySubDepts.length === 0 ? (
          <div style={{ padding: "24px", background: "#f8fafc", border: "1.5px dashed #cbd5e1", borderRadius: "10px", textAlign: "center" }}>
            <AlertTriangle size={32} color="#f59e0b" style={{ margin: "0 auto 8px" }} />
            <p style={{ margin: "0 0 6px 0", fontSize: "13.5px", fontWeight: 700, color: "#0f172a" }}>
              No Sub-Departments Configured for {isTech ? "Technical" : "Non-Technical"}
            </p>
            <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "#64748b" }}>
              At least one sub-department is recommended so candidates can select their specialization.
            </p>
            <button
              type="button"
              className="primary"
              onClick={() => setShowAddForm(true)}
              style={{ fontSize: "12px", padding: "7px 14px", background: primaryBrand }}
            >
              + Add Sub-Department Now
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {categorySubDepts.map((sub, index) => {
              const isEditing = editingTempId === sub.tempId;

              if (isEditing) {
                return (
                  <form
                    key={sub.tempId}
                    onSubmit={handleSaveEdit}
                    style={{
                      padding: "14px",
                      borderRadius: "8px",
                      border: `1.5px solid ${primaryBrand}`,
                      background: lightBg,
                      display: "grid",
                      gridTemplateColumns: "1.8fr 1fr 2fr auto",
                      gap: "10px",
                      alignItems: "flex-end"
                    }}
                  >
                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Edit Name *
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditName(e.target.value)}
                        style={{ width: "100%", padding: "7px 10px", fontSize: "12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff" }}
                        autoFocus
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Edit Code *
                      </label>
                      <input
                        type="text"
                        value={editCode}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditCode(e.target.value.toUpperCase())}
                        style={{ width: "100%", padding: "7px 10px", fontSize: "12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff" }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "11px", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                        Description
                      </label>
                      <input
                        type="text"
                        value={editDesc}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditDesc(e.target.value)}
                        style={{ width: "100%", padding: "7px 10px", fontSize: "12px", border: "1px solid #cbd5e1", borderRadius: "6px", background: "#fff" }}
                      />
                    </div>

                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        type="submit"
                        className="primary"
                        style={{ padding: "7px 12px", fontSize: "11.5px", background: primaryBrand, height: "34px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                      >
                        <Check size={14} /> Save
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={handleCancelEdit}
                        style={{ padding: "7px 10px", fontSize: "11.5px", height: "34px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                      >
                        <X size={14} /> Cancel
                      </button>
                    </div>

                    {editError && (
                      <div style={{ gridColumn: "1 / -1", color: "#dc2626", fontSize: "11px", marginTop: "4px" }}>
                        {editError}
                      </div>
                    )}
                  </form>
                );
              }

              return (
                <div
                  key={sub.tempId}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 16px",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    background: "#ffffff",
                    transition: "all 0.15s ease"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <span 
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        background: "#f1f5f9",
                        color: "#475569",
                        fontSize: "11px",
                        fontWeight: 700,
                        display: "grid",
                        placeItems: "center"
                      }}
                    >
                      {index + 1}
                    </span>

                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                        <strong style={{ fontSize: "13.5px", color: "#0f172a" }}>{sub.name}</strong>
                        <span 
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "2px 7px",
                            borderRadius: "4px",
                            background: lightBg,
                            color: primaryBrand
                          }}
                        >
                          {sub.code}
                        </span>
                        {sub.id ? (
                          <span style={{ fontSize: "9.5px", color: "#166534", background: "#dcfce7", padding: "1px 6px", borderRadius: "3px", fontWeight: 700 }}>
                            ✓ Active in DB
                          </span>
                        ) : (
                          <span style={{ fontSize: "9.5px", color: "#0284c7", background: "#e0f2fe", padding: "1px 6px", borderRadius: "3px", fontWeight: 700 }}>
                            Specialization
                          </span>
                        )}
                        {sub.isDefault && (
                          <span style={{ fontSize: "9.5px", color: "#64748b", background: "#f1f5f9", padding: "1px 5px", borderRadius: "3px" }}>
                            Standard Role
                          </span>
                        )}
                      </div>
                      {sub.description && (
                        <p style={{ margin: "2px 0 0 0", fontSize: "11.5px", color: "#64748b" }}>
                          {sub.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={scrollToQuestionBank}
                      style={{
                        background: "none",
                        border: "none",
                        color: primaryBrand,
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: "pointer",
                        padding: "4px 8px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px"
                      }}
                      title="View the common question sets configured for this sub-department"
                    >
                      <Layers size={13} /> Question Sets Attached
                    </button>

                    <button
                      type="button"
                      onClick={() => handleStartEdit(sub)}
                      className="secondary"
                      style={{
                        padding: "5px 10px",
                        fontSize: "11px",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px"
                      }}
                    >
                      <Edit3 size={12} /> Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeletingSubDept(sub)}
                      style={{
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                        color: "#dc2626",
                        padding: "5px 10px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px"
                      }}
                    >
                      <Trash2 size={12} /> Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 2: Unified Category Question Bank (Sets A, B, C, D) */}
      <div className="admin-form-card" ref={questionBankSectionRef}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h3 style={{ margin: "0 0 4px 0", fontSize: "16px", display: "flex", alignItems: "center", gap: "8px", color: "#0f172a" }}>
              <Layers size={18} color={primaryBrand} />
              2. Common {isTech ? "Technical" : "Non-Technical"} Question Bank (Sets A, B, C, D)
            </h3>
            <p style={{ margin: 0, fontSize: "12px", color: "#64748b", maxWidth: "720px", lineHeight: 1.5 }}>
              Configure four independent question sets for this primary department track. 
              <b> All {categorySubDepts.length} {isTech ? "Technical" : "Non-Technical"} sub-departments automatically share this exact question bank.</b>
              {" "}You do not need to upload questions separately for each sub-department.
            </p>
          </div>

          <span 
            style={{
              fontSize: "11.5px",
              fontWeight: 700,
              background: lightBg,
              color: primaryBrand,
              padding: "4px 10px",
              borderRadius: "20px"
            }}
          >
            Shared Track Repository
          </span>
        </div>

        {/* Question Randomization & Integrity Card */}
        <div 
          style={{
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            padding: "14px 16px",
            marginBottom: "20px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div 
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "8px",
                background: lightBg,
                color: primaryBrand,
                display: "grid",
                placeItems: "center"
              }}
            >
              <Shuffle size={18} />
            </div>
            <div>
              <b style={{ fontSize: "13px", color: "#0f172a" }}>Dynamic Question & Option Randomization</b>
              <p style={{ margin: "2px 0 0 0", fontSize: "11.5px", color: "#64748b" }}>
                Each candidate receives a shuffled sequence of questions and multiple-choice options. Correct answer keys remain strictly synchronized.
              </p>
            </div>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "12.5px", fontWeight: 700, color: primaryBrand }}>
            <input
              type="checkbox"
              checked={bank.randomizeQuestions}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onToggleRandomize(category, e.target.checked)}
              style={{ width: "17px", height: "17px", cursor: "pointer", accentColor: primaryBrand }}
            />
            Randomize Order upon Delivery
          </label>
        </div>

        {/* Single Unified Question Paper & Answer Key Upload Card */}
        {(() => {
          const masterQP = bank.masterQuestionPaperFile || bank.sets.A.questionPaperFile;
          const masterAK = bank.masterAnswerKeyFile || bank.sets.A.answerKeyFile;
          const isMasterExtracting = !!(bank.extracting || bank.sets.A.extracting || bank.sets.B.extracting || bank.sets.C.extracting || bank.sets.D.extracting);
          const masterQuestions = (bank.masterQuestions && bank.masterQuestions.length > 0) ? bank.masterQuestions : (bank.sets.A.parsedQuestions || []);
          const masterHasQuestions = masterQuestions.length > 0;
          const isMasterComplete = !!(masterQP && masterAK);
          const isMasterConfigured = !!(masterQP || masterAK);

          return (
            <div>
              <div 
                style={{
                  border: masterHasQuestions ? "1.5px solid #86efac" : (isMasterConfigured ? `1.5px solid ${accentBorder}` : "1.5px solid #cbd5e1"),
                  borderRadius: "12px",
                  padding: "18px 20px",
                  background: masterHasQuestions ? "#f0fdf4" : (isMasterConfigured ? "#fcfdfd" : "#ffffff"),
                  boxShadow: "0 2px 6px rgba(15, 23, 42, 0.04)",
                  marginBottom: "20px"
                }}
              >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span 
                        style={{
                          display: "inline-block",
                          padding: "3px 9px",
                          borderRadius: "6px",
                          background: lightBg,
                          color: primaryBrand,
                          fontWeight: 800,
                          fontSize: "11px"
                        }}
                      >
                        MASTER UPLOAD
                      </span>
                      <strong style={{ fontSize: "14.5px", color: "#0f172a" }}>
                        {isTech ? "Technical" : "Non-Technical"} Department Question Paper
                      </strong>
                    </div>
                    <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                      Upload one question paper for all {categorySubDepts.length} {isTech ? "Technical" : "Non-Technical"} specializations. The system automatically creates Sets A, B, C, D.
                    </p>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>
                      Supported: PDF, DOCX, TXT, CSV (Max 25 MB)
                    </span>
                    <span 
                      style={{
                        fontSize: "11px",
                        padding: "3px 10px",
                        borderRadius: "12px",
                        fontWeight: 700,
                        background: masterHasQuestions ? "#dcfce7" : (isMasterComplete ? lightBg : "#f1f5f9"),
                        color: masterHasQuestions ? "#15803d" : (isMasterComplete ? primaryBrand : "#64748b")
                      }}
                    >
                      {isMasterExtracting 
                        ? "⏳ Extracting MCQs..." 
                        : (masterHasQuestions 
                            ? `✓ ${masterQuestions.length} MCQs Ready` 
                            : (masterQP ? "Paper Attached" : (masterAK ? "Key Attached" : "Not Configured")))}
                    </span>
                  </div>
                </div>

                {/* Upload Slots Grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
                  {/* Master Question Paper */}
                  <div style={{ background: "#ffffff", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <span style={{ fontWeight: 700, color: "#334155", fontSize: "12px", display: "flex", alignItems: "center", gap: "5px" }}>
                        <FileText size={14} color="#0284c7" /> Question Paper: <span style={{ color: "#dc2626" }}>*</span>
                      </span>
                      {masterQP && (
                        <button
                          type="button"
                          onClick={() => onSetFileChange(category, "A", "questionPaperFile", null)}
                          style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: "11.5px", fontWeight: 600, padding: 0 }}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {masterQP ? (
                      <div 
                        style={{
                          padding: "8px 12px",
                          background: "#eff6ff",
                          border: "1px solid #bfdbfe",
                          borderRadius: "6px",
                          fontSize: "12px",
                          color: "#1e40af",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center"
                        }}
                      >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "75%" }}>
                          📄 {masterQP.name}
                        </span>
                        <small style={{ color: "#60a5fa" }}>{(masterQP.size / 1024).toFixed(0)} KB</small>
                      </div>
                    ) : (
                      <input
                        type="file"
                        accept=".pdf,.docx,.txt,.csv,.xlsx,.xls"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          if (e.target.files && e.target.files[0]) {
                            onSetFileChange(category, "A", "questionPaperFile", e.target.files[0]);
                          }
                        }}
                        style={{ fontSize: "12px", width: "100%" }}
                      />
                    )}
                  </div>

                  {/* Master Answer Key */}
                  <div style={{ background: "#ffffff", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                      <span style={{ fontWeight: 700, color: "#334155", fontSize: "12px", display: "flex", alignItems: "center", gap: "5px" }}>
                        <KeyRound size={14} color="#059669" /> Answer Key: <span style={{ color: "#64748b", fontWeight: 400 }}>(Optional)</span>
                      </span>
                      {masterAK && (
                        <button
                          type="button"
                          onClick={() => onSetFileChange(category, "A", "answerKeyFile", null)}
                          style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: "11.5px", fontWeight: 600, padding: 0 }}
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    {masterAK ? (
                      <div 
                        style={{
                          padding: "8px 12px",
                          background: "#f0fdf4",
                          border: "1px solid #bbf7d0",
                          borderRadius: "6px",
                          fontSize: "12px",
                          color: "#166534",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center"
                        }}
                      >
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "75%" }}>
                          🔑 {masterAK.name}
                        </span>
                        <small style={{ color: "#4ade80" }}>{(masterAK.size / 1024).toFixed(0)} KB</small>
                      </div>
                    ) : (
                      <input
                        type="file"
                        accept=".pdf,.txt,.csv,.xlsx,.xls,.docx"
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          if (e.target.files && e.target.files[0]) {
                            onSetFileChange(category, "A", "answerKeyFile", e.target.files[0]);
                          }
                        }}
                        style={{ fontSize: "12px", width: "100%" }}
                      />
                    )}
                  </div>
                </div>

                {/* Extraction status & live action bar */}
                {isMasterExtracting && (
                  <div style={{ marginTop: "12px", fontSize: "12px", color: primaryBrand, display: "flex", alignItems: "center", gap: "6px", fontWeight: 600 }}>
                    <span>⏳ Extracting text & MCQs in-memory and preparing Sets A, B, C, D...</span>
                  </div>
                )}

                {masterHasQuestions && !isMasterExtracting && (
                  <div 
                    style={{
                      marginTop: "12px",
                      padding: "8px 14px",
                      background: "#f0fdf4",
                      border: "1px solid #bbf7d0",
                      borderRadius: "8px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "8px"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "12px", color: "#166534", fontWeight: 700 }}>
                        ✓ {masterQuestions.length} MCQs Successfully Extracted
                      </span>
                      <span style={{ fontSize: "11px", color: "#15803d" }}>
                        ({bank.randomizeQuestions ? "Automatically shuffled into Sets A, B, C, D" : "Replicated across Sets A, B, C, D"})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onReviewQuestions(`${isTech ? "Technical" : "Non-Technical"} Department`, "A", masterQuestions)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#017846",
                        fontSize: "12px",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: 0
                      }}
                    >
                      <Eye size={13} /> Review Extracted Questions ({masterQuestions.length}) →
                    </button>
                  </div>
                )}
              </div>

              {/* Generated Candidate Exam Sets: Sets A, B, C, D */}
              <div style={{ marginBottom: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px", flexWrap: "wrap", gap: "6px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Layers size={14} color={primaryBrand} /> Generated Candidate Exam Sets (Sets A, B, C, D):
                  </span>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    {bank.randomizeQuestions 
                      ? "🔀 Anti-cheat double-shuffle active: questions and options are randomized across sets"
                      : "Standard sequence active: identical order across sets"}
                  </span>
                </div>
                <p style={{ margin: "0 0 12px 0", fontSize: "11.5px", color: "#64748b" }}>
                  Candidates entering the examination will be automatically distributed across these 4 sets. Correct answer keys remain strictly synchronized.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "12px" }}>
                {(["A", "B", "C", "D"] as const).map(setCode => {
                  const slot = bank.sets[setCode];
                  const qCount = slot.parsedQuestions.length || (masterHasQuestions ? masterQuestions.length : 0);
                  const questions = slot.parsedQuestions.length > 0 ? slot.parsedQuestions : masterQuestions;
                  const isReady = qCount > 0;
                  const isShuffled = bank.randomizeQuestions && setCode !== "A";

                  return (
                    <div
                      key={setCode}
                      style={{
                        border: isReady ? "1.5px solid #86efac" : "1px solid #e2e8f0",
                        borderRadius: "8px",
                        padding: "12px",
                        background: isReady ? "#f0fdf4" : "#f8fafc",
                        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.03)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span 
                            style={{
                              display: "inline-block",
                              width: "22px",
                              height: "22px",
                              lineHeight: "22px",
                              borderRadius: "50%",
                              background: isReady ? (isTech ? "#16a34a" : "#0284c7") : "#94a3b8",
                              color: "#ffffff",
                              textAlign: "center",
                              fontWeight: 800,
                              fontSize: "11px"
                            }}
                          >
                            {setCode}
                          </span>
                          <strong style={{ fontSize: "12.5px", color: "#0f172a" }}>
                            Set {setCode} ({isTech ? "Tech" : "Non-Tech"})
                          </strong>
                        </div>

                        <span 
                          style={{
                            fontSize: "10px",
                            padding: "2px 7px",
                            borderRadius: "6px",
                            fontWeight: 700,
                            background: isReady ? "#dcfce7" : "#e2e8f0",
                            color: isReady ? "#15803d" : "#64748b"
                          }}
                        >
                          {isReady ? `✓ ${qCount} MCQs` : "Pending"}
                        </span>
                      </div>

                      <div style={{ fontSize: "11px", color: "#64748b", lineHeight: 1.35 }}>
                        {isReady ? (
                          isShuffled ? (
                            <span style={{ color: "#0284c7", fontWeight: 600 }}>
                              🔀 Anti-cheat shuffled sequence
                            </span>
                          ) : (
                            <span style={{ color: "#166534", fontWeight: 600 }}>
                              ✓ Primary sequence
                            </span>
                          )
                        ) : (
                          "Upload question paper above to populate"
                        )}
                      </div>

                      {isReady && (
                        <div style={{ marginTop: "auto", paddingTop: "6px", borderTop: "1px dashed #cbd5e1", textAlign: "right" }}>
                          <button
                            type="button"
                            onClick={() => onReviewQuestions(`${isTech ? "Technical" : "Non-Technical"} Department`, setCode, questions)}
                            style={{
                              background: "none",
                              border: "none",
                              color: primaryBrand,
                              fontSize: "11px",
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                              padding: 0
                            }}
                          >
                            <Eye size={12} /> Review Set {setCode} →
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Track Configuration Bottom Actions */}
      <div 
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          paddingTop: "14px",
          borderTop: "1px solid #e2e8f0"
        }}
      >
        <button
          type="button"
          onClick={onBackToOverview}
          className="secondary"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            padding: "10px 18px",
            fontSize: "13px"
          }}
        >
          <ArrowLeft size={16} /> Back to Department Selection
        </button>

        <div style={{ display: "flex", gap: "10px" }}>
          <button
            type="button"
            onClick={() => onSwitchCategory(isTech ? "NON_TECHNICAL" : "TECHNICAL")}
            className="secondary"
            style={{
              padding: "10px 18px",
              fontSize: "13px",
              fontWeight: 700,
              display: "inline-flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            Configure {isTech ? "Non-Technical" : "Technical"} Department →
          </button>

          <button
            type="button"
            onClick={onBackToOverview}
            className="primary"
            style={{
              padding: "10px 22px",
              fontSize: "13px",
              fontWeight: 700,
              background: "#017846",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            Save & Continue to Overview <CheckCircle2 size={16} />
          </button>
        </div>
      </div>

      {/* Delete Sub-Department Confirmation Modal */}
      {deletingSubDept && (
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
              maxWidth: "460px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              overflow: "hidden"
            }}
          >
            <div style={{ padding: "18px 20px", borderBottom: "1px solid #fee2e2", background: "#fef2f2", display: "flex", alignItems: "center", gap: "10px" }}>
              <AlertTriangle size={22} color="#dc2626" />
              <h4 style={{ margin: 0, fontSize: "15px", color: "#991b1b", fontWeight: 700 }}>
                Remove Sub-Department from Examination?
              </h4>
            </div>

            <div style={{ padding: "20px", fontSize: "13px", color: "#334155", lineHeight: 1.5 }}>
              Are you sure you want to remove <b>{deletingSubDept.name} ({deletingSubDept.code})</b> from this examination?
              <div style={{ marginTop: "10px", padding: "10px 12px", background: "#f8fafc", borderRadius: "6px", fontSize: "12px", color: "#64748b" }}>
                • Candidates will not be able to choose this specialization during registration.<br />
                • The common {isTech ? "Technical" : "Non-Technical"} question bank (Sets A-D) will remain intact.
              </div>
            </div>

            <div style={{ padding: "14px 20px", background: "#f8fafc", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button
                type="button"
                className="secondary"
                onClick={() => setDeletingSubDept(null)}
                style={{ padding: "8px 16px", fontSize: "12.5px" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onRemoveSubDept(deletingSubDept.tempId);
                  setDeletingSubDept(null);
                }}
                style={{
                  background: "#dc2626",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "8px 18px",
                  fontSize: "12.5px",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                Yes, Remove Sub-Department
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
