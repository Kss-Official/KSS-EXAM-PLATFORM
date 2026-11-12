import { useState, useEffect, useCallback, useMemo } from "react";
import { 
  Building2, 
  Plus, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Edit3, 
  Trash2, 
  RefreshCw, 
  Loader2, 
  AlertCircle,
  GraduationCap,
  Users,
  LayoutGrid,
  List,
  Sparkles,
  BookOpen,
  Layers,
  X,
  ChevronRight,
  Hash,
  Award
} from "lucide-react";
import { 
  getAllDepartments, 
  createDepartment, 
  updateDepartment, 
  deleteDepartment,
  getColleges,
  createCollege,
  updateCollege,
  deleteCollege,
  type DepartmentDto,
  type CollegeDto,
  ApiError 
} from "../../services/api";

type TabType = "academic" | "college";
type ViewMode = "grid" | "table";
type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

interface BaseItem {
  id: number;
  name: string;
  code: string;
  category?: "TECHNICAL" | "NON_TECHNICAL";
  description?: string;
  active: boolean;
  createdAt?: string;
  associatedExamsCount?: number;
  candidatesCount?: number;
}

export default function DepartmentsPage() {
  const [activeTab, setActiveTab] = useState<TabType>("academic");
  const [items, setItems] = useState<BaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | "TECHNICAL" | "NON_TECHNICAL">("ALL");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BaseItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formCategory, setFormCategory] = useState<"TECHNICAL" | "NON_TECHNICAL">("TECHNICAL");
  const [formDesc, setFormDesc] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Success toast notice
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === "academic") {
        const data = await getAllDepartments({ type: "academic" });
        setItems(data.map(d => {
          let cat = d.category;
          if (!cat) {
            const cU = (d.code || "").toUpperCase();
            const nL = (d.name || "").toLowerCase();
            if (["HR", "SALES", "MKT", "MGMT", "NON_TECH"].some(k => cU.includes(k)) || nL.includes("human") || nL.includes("sales") || nL.includes("market") || nL.includes("non-tech")) {
              cat = "NON_TECHNICAL";
            } else {
              cat = "TECHNICAL";
            }
          }
          return {
            id: d.id || 0,
            name: d.name,
            code: d.code,
            category: cat as "TECHNICAL" | "NON_TECHNICAL",
            description: d.description,
            active: d.active,
            createdAt: d.createdAt,
            associatedExamsCount: d.associatedExamsCount || 0,
            candidatesCount: d.candidatesCount || 0
          };
        }));
      } else {
        const data = await getColleges();
        setItems(data.map(c => ({
          id: c.id,
          name: c.name,
          code: c.code || "",
          description: c.description,
          active: c.active,
          createdAt: c.createdAt,
          associatedExamsCount: 0,
          candidatesCount: c.candidatesCount || 0
        })));
      }
    } catch (err: unknown) {
      const errorObj = err as ApiError;
      setError(errorObj.message || `Failed to load ${activeTab === "academic" ? "departments" : "colleges"} from database.`);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setFormName("");
    setFormCode("");
    setFormCategory("TECHNICAL");
    setFormDesc("");
    setFormActive(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: BaseItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormCode(item.code);
    setFormCategory(item.category || "TECHNICAL");
    setFormDesc(item.description || "");
    setFormActive(item.active);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError(`${activeTab === "academic" ? "Department" : "College"} name is required.`);
      return;
    }
    if (!formCode.trim()) {
      setFormError(`${activeTab === "academic" ? "Department" : "College"} unique code is required.`);
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      if (activeTab === "academic") {
        if (editingItem) {
          await updateDepartment(editingItem.id, {
            name: formName.trim(),
            code: formCode.trim().toUpperCase(),
            category: formCategory,
            description: formDesc.trim(),
            active: formActive
          });
          showToast(`Department "${formName.trim()}" updated successfully.`);
        } else {
          await createDepartment({
            name: formName.trim(),
            code: formCode.trim().toUpperCase(),
            category: formCategory,
            description: formDesc.trim(),
            active: formActive
          });
          showToast(`Department "${formName.trim()}" created successfully.`);
        }
      } else {
        if (editingItem) {
          await updateCollege(editingItem.id, {
            name: formName.trim(),
            code: formCode.trim().toUpperCase(),
            description: formDesc.trim(),
            active: formActive
          });
          showToast(`College "${formName.trim()}" updated successfully.`);
        } else {
          await createCollege({
            name: formName.trim(),
            code: formCode.trim().toUpperCase(),
            description: formDesc.trim(),
            active: formActive
          });
          showToast(`College "${formName.trim()}" created successfully.`);
        }
      }
      setIsModalOpen(false);
      fetchItems();
    } catch (err: unknown) {
      const errorObj = err as ApiError;
      setFormError(errorObj.message || `Failed to save ${activeTab === "academic" ? "department" : "college"}. Code must be unique.`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (item: BaseItem) => {
    try {
      if (activeTab === "academic") {
        await updateDepartment(item.id, {
          name: item.name,
          code: item.code,
          description: item.description,
          active: !item.active
        });
      } else {
        await updateCollege(item.id, {
          name: item.name,
          code: item.code,
          description: item.description,
          active: !item.active
        });
      }
      showToast(`${item.name} is now ${!item.active ? "Active" : "Inactive"}.`);
      fetchItems();
    } catch (err: unknown) {
      const errorObj = err as ApiError;
      alert(`Failed to update status: ${errorObj.message}`);
    }
  };

  const handleDelete = async (item: BaseItem) => {
    const itemType = activeTab === "academic" ? "department" : "college";
    if (!window.confirm(`Are you sure you want to delete ${itemType} "${item.name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      if (activeTab === "academic") {
        await deleteDepartment(item.id);
      } else {
        await deleteCollege(item.id);
      }
      showToast(`${item.name} has been deleted.`);
      fetchItems();
    } catch (err: unknown) {
      const errorObj = err as ApiError;
      alert(`Cannot delete ${itemType}: ${errorObj.message}`);
    }
  };

  // Filtered Items Memo
  const filteredItems = useMemo(() => {
    return items.filter(d => {
      const matchesSearch = 
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (d.description && d.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = 
        statusFilter === "ALL" ? true :
        statusFilter === "ACTIVE" ? d.active : !d.active;

      const matchesCategory = 
        activeTab !== "academic" || categoryFilter === "ALL" ? true :
        categoryFilter === "TECHNICAL" ? (d.category !== "NON_TECHNICAL") :
        (d.category === "NON_TECHNICAL");

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [items, searchQuery, statusFilter, categoryFilter, activeTab]);

  // Aggregate Metrics
  const totalCount = items.length;
  const activeCount = items.filter(d => d.active).length;
  const inactiveCount = totalCount - activeCount;
  const techCount = items.filter(d => d.category !== "NON_TECHNICAL").length;
  const nonTechCount = items.filter(d => d.category === "NON_TECHNICAL").length;
  const totalCandidatesMapped = items.reduce((sum, item) => sum + (item.candidatesCount || 0), 0);
  const totalExamsMapped = items.reduce((sum, item) => sum + (item.associatedExamsCount || 0), 0);

  // Department Category Accent Helper
  const getBadgeAccent = (code: string) => {
    const c = code.toUpperCase();
    if (["DEV", "AIML", "IT", "CYBERSEC", "DEVOPS"].some(k => c.includes(k))) {
      return { bg: "#ecfdf5", text: "#047857", border: "#a7f3d0", dot: "#10b981" };
    }
    if (["CSE", "ECE", "EEE", "CIVIL", "MECH"].some(k => c.includes(k))) {
      return { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe", dot: "#3b82f6" };
    }
    if (["HR", "SALES", "MKT", "FINANCE", "MGMT"].some(k => c.includes(k))) {
      return { bg: "#faf5ff", text: "#7e22ce", border: "#e9d5ff", dot: "#a855f7" };
    }
    return { bg: "#f1f5f9", text: "#334155", border: "#cbd5e1", dot: "#64748b" };
  };

  const renderCard = (item: BaseItem) => {
    const accent = getBadgeAccent(item.code);
    return (
      <div 
        key={item.id} 
        style={{ 
          background: "#ffffff",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          borderLeft: item.active 
            ? (activeTab === "academic" 
                ? (item.category === "NON_TECHNICAL" ? "4px solid #7e22ce" : "4px solid #017846")
                : "4px solid #2563eb")
            : "4px solid #cbd5e1",
          padding: "20px",
          display: "flex", 
          flexDirection: "column", 
          justifyContent: "space-between",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
          transition: "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
          position: "relative"
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "0 6px 16px rgba(0, 0, 0, 0.05)";
          e.currentTarget.style.borderColor = "#cbd5e1";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.03)";
          e.currentTarget.style.borderColor = "#e2e8f0";
        }}
      >
        <div>
          {/* Badge & Status Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <span style={{ 
                padding: "3px 10px", 
                background: accent.bg, 
                color: accent.text, 
                border: `1px solid ${accent.border}`,
                fontWeight: 800, 
                fontSize: "12px", 
                borderRadius: "6px",
                fontFamily: "monospace",
                letterSpacing: "0.5px"
              }}>
                {item.code}
              </span>
              <span style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>
                ID #{item.id}
              </span>
              {activeTab === "academic" && (
                <span style={{
                  fontSize: "10.5px",
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: "999px",
                  background: item.category === "NON_TECHNICAL" ? "#faf5ff" : "#ecfdf5",
                  color: item.category === "NON_TECHNICAL" ? "#7e22ce" : "#047857",
                  border: item.category === "NON_TECHNICAL" ? "1px solid #e9d5ff" : "1px solid #a7f3d0"
                }}>
                  {item.category === "NON_TECHNICAL" ? "💼 Non-Technical" : "🛠️ Technical"}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => handleToggleActive(item)}
              title={item.active ? "Click to deactivate track" : "Click to activate track"}
              style={{
                background: item.active ? "#ecfdf5" : "#f1f5f9",
                border: item.active ? "1px solid #a7f3d0" : "1px solid #e2e8f0",
                borderRadius: "20px",
                padding: "3px 9px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                transition: "all 0.15s ease"
              }}
            >
              <span style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: item.active ? "#10b981" : "#94a3b8"
              }} />
              <span style={{
                fontSize: "11px",
                fontWeight: 700,
                color: item.active ? "#065f46" : "#64748b"
              }}>
                {item.active ? "Active" : "Inactive"}
              </span>
            </button>
          </div>

          {/* Title */}
          <h3 style={{ 
            margin: "0 0 8px 0", 
            fontSize: "16px", 
            fontWeight: 700, 
            color: "#0f172a",
            lineHeight: 1.3
          }}>
            {item.name}
          </h3>

          {/* Description */}
          <p style={{ 
            fontSize: "12.5px", 
            color: "#64748b", 
            margin: "0 0 16px 0", 
            minHeight: "36px", 
            lineHeight: 1.5,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden"
          }}>
            {item.description || <i style={{ color: "#94a3b8" }}>No curriculum description provided.</i>}
          </p>

          {/* Associated Metrics Pills */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
            {activeTab === "academic" ? (
              <>
                <div style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  padding: "3px 8px",
                  borderRadius: "6px",
                  fontSize: "11.5px",
                  color: "#475569"
                }}>
                  <Users size={12} color="#059669" />
                  <span><b>{item.candidatesCount ?? 0}</b> Examinees</span>
                </div>
                <div style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  padding: "3px 8px",
                  borderRadius: "6px",
                  fontSize: "11.5px",
                  color: "#475569"
                }}>
                  <BookOpen size={12} color="#2563eb" />
                  <span><b>{item.associatedExamsCount ?? 0}</b> Exams</span>
                </div>
              </>
            ) : (
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                background: "#eff6ff",
                border: "1px solid #bfdbfe",
                padding: "3px 9px",
                borderRadius: "6px",
                fontSize: "11.5px",
                color: "#1d4ed8"
              }}>
                <Users size={12} color="#2563eb" />
                <span><b>{item.candidatesCount ?? 0}</b> Registered Candidates</span>
              </div>
            )}
          </div>
        </div>

        {/* Card Action Footer */}
        <div style={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: "center", 
          paddingTop: "14px", 
          borderTop: "1px solid #f1f5f9" 
        }}>
          <span style={{ fontSize: "11px", color: "#94a3b8" }}>
            {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "System Managed"}
          </span>

          <div style={{ display: "flex", gap: "8px" }}>
            <button 
              type="button" 
              onClick={() => handleOpenEditModal(item)}
              style={{ 
                padding: "5px 12px", 
                fontSize: "12px", 
                fontWeight: 600,
                color: "#334155",
                background: "#ffffff",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                cursor: "pointer",
                display: "inline-flex", 
                alignItems: "center", 
                gap: "5px",
                transition: "all 0.12s ease"
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#f8fafc"; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#ffffff"; }}
            >
              <Edit3 size={13} color="#475569" />
              <span>Edit</span>
            </button>
            <button 
              type="button" 
              onClick={() => handleDelete(item)}
              style={{ 
                padding: "5px 10px", 
                fontSize: "12px", 
                fontWeight: 600,
                color: "#dc2626", 
                background: "#ffffff",
                border: "1px solid #fecaca",
                borderRadius: "6px",
                cursor: "pointer",
                display: "inline-flex", 
                alignItems: "center", 
                gap: "4px",
                transition: "all 0.12s ease"
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#fef2f2"; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#ffffff"; }}
            >
              <Trash2 size={13} color="#dc2626" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: "1280px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px", paddingBottom: "40px" }}>
      
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          backgroundColor: "#064e3b",
          color: "#ffffff",
          padding: "12px 20px",
          borderRadius: "10px",
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.2)",
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontSize: "13.5px",
          fontWeight: 600,
          zIndex: 99999,
          animation: "fadeIn 0.2s ease"
        }}>
          <CheckCircle2 size={18} color="#34d399" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Page Header */}
      <div style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderLeft: activeTab === "academic" ? "4px solid #017846" : "4px solid #2563eb",
        borderRadius: "12px",
        padding: "20px 24px",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "16px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{
            width: "52px",
            height: "52px",
            borderRadius: "14px",
            background: activeTab === "academic" 
              ? "linear-gradient(135deg, #017846 0%, #059669 100%)" 
              : "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#ffffff",
            boxShadow: activeTab === "academic" 
              ? "0 8px 16px -4px rgba(1, 120, 70, 0.35)" 
              : "0 8px 16px -4px rgba(37, 99, 235, 0.35)"
          }}>
            {activeTab === "academic" ? <GraduationCap size={28} /> : <Building2 size={28} />}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#64748b", fontWeight: 500, marginBottom: "4px" }}>
              <span>Admin Console</span>
              <ChevronRight size={12} color="#94a3b8" />
              <span style={{ color: activeTab === "academic" ? "#017846" : "#2563eb", fontWeight: 600 }}>
                {activeTab === "academic" ? "Academic Tracks" : "Institutions & Campuses"}
              </span>
            </div>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.4px" }}>
              {activeTab === "academic" ? "Academic Departments & Tracks" : "Affiliated Colleges & Campuses"}
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
              {activeTab === "academic" 
                ? "Configure engineering disciplines, technology tracks, syllabus specializations & examinee quotas."
                : "Manage partnered colleges, university examination centers, and institutional candidate rosters."}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button 
            type="button" 
            onClick={fetchItems} 
            disabled={loading}
            style={{
              padding: "9px 16px",
              borderRadius: "10px",
              fontSize: "13px",
              fontWeight: 600,
              color: "#334155",
              backgroundColor: "#ffffff",
              border: "1px solid #cbd5e1",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
              transition: "all 0.15s ease"
            }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} color="#64748b" />
            <span>Refresh</span>
          </button>
          <button 
            type="button" 
            onClick={handleOpenCreateModal}
            style={{ 
              padding: "9px 20px",
              borderRadius: "10px",
              fontSize: "13px",
              fontWeight: 700,
              color: "#ffffff",
              background: activeTab === "academic" 
                ? "linear-gradient(135deg, #017846 0%, #059669 100%)" 
                : "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
              border: "none",
              cursor: "pointer",
              display: "inline-flex", 
              alignItems: "center", 
              gap: "8px",
              boxShadow: activeTab === "academic" 
                ? "0 4px 12px rgba(1, 120, 70, 0.28)" 
                : "0 4px 12px rgba(37, 99, 235, 0.28)",
              transition: "all 0.15s ease"
            }}
          >
            <Plus size={16} strokeWidth={2.5} />
            <span>{activeTab === "academic" ? "Create Department" : "Add College"}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Row (4 Metric Cards) */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
        gap: "16px"
      }}>
        {/* Card 1: Total */}
        <div style={{
          background: "#ffffff",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          padding: "18px 20px",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div>
            <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {activeTab === "academic" ? "Specialization Tracks" : "Registered Colleges"}
            </div>
            <div style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a", marginTop: "4px" }}>
              {totalCount}
            </div>
            <div style={{ fontSize: "12px", color: "#059669", fontWeight: 500, marginTop: "2px" }}>
              {activeCount} actively receiving examinees
            </div>
          </div>
          <div style={{
            width: "44px",
            height: "44px",
            borderRadius: "10px",
            background: "#f0fdf4",
            color: "#059669",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <Layers size={22} />
          </div>
        </div>

        {/* Card 2: Active Rate */}
        <div style={{
          background: "#ffffff",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          padding: "18px 20px",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div>
            <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Operational Health
            </div>
            <div style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a", marginTop: "4px" }}>
              {totalCount > 0 ? `${Math.round((activeCount / totalCount) * 100)}%` : "0%"}
            </div>
            <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 500, marginTop: "2px" }}>
              {inactiveCount} inactive / suspended
            </div>
          </div>
          <div style={{
            width: "44px",
            height: "44px",
            borderRadius: "10px",
            background: "#ecfdf5",
            color: "#10b981",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <CheckCircle2 size={22} />
          </div>
        </div>

        {/* Card 3: Candidates Linked */}
        <div style={{
          background: "#ffffff",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          padding: "18px 20px",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div>
            <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Enrolled Examinees
            </div>
            <div style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a", marginTop: "4px" }}>
              {totalCandidatesMapped.toLocaleString()}
            </div>
            <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 500, marginTop: "2px" }}>
              Active platform candidates
            </div>
          </div>
          <div style={{
            width: "44px",
            height: "44px",
            borderRadius: "10px",
            background: "#eff6ff",
            color: "#2563eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <Users size={22} />
          </div>
        </div>

        {/* Card 4: Assessment Mappings */}
        <div style={{
          background: "#ffffff",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          padding: "18px 20px",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center"
        }}>
          <div>
            <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {activeTab === "academic" ? "Exams Provisioned" : "Institutional Tracks"}
            </div>
            <div style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a", marginTop: "4px" }}>
              {activeTab === "academic" ? totalExamsMapped : 16}
            </div>
            <div style={{ fontSize: "12px", color: "#64748b", fontWeight: 500, marginTop: "2px" }}>
              {activeTab === "academic" ? "Linked published exams" : "Academic specializations"}
            </div>
          </div>
          <div style={{
            width: "44px",
            height: "44px",
            borderRadius: "10px",
            background: "#faf5ff",
            color: "#7e22ce",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <BookOpen size={22} />
          </div>
        </div>
      </div>

      {/* Navigation Pills (Tab Switcher) */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "12px",
        background: "#ffffff",
        padding: "8px 12px",
        borderRadius: "12px",
        border: "1px solid #e2e8f0"
      }}>
        {/* Left Tabs */}
        <div style={{ display: "inline-flex", gap: "6px", background: "#f1f5f9", padding: "4px", borderRadius: "10px" }}>
          <button
            type="button"
            onClick={() => { setActiveTab("academic"); setSearchQuery(""); setStatusFilter("ALL"); }}
            style={{
              padding: "8px 18px",
              fontSize: "13px",
              fontWeight: 700,
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              background: activeTab === "academic" ? "#ffffff" : "transparent",
              color: activeTab === "academic" ? "#017846" : "#64748b",
              boxShadow: activeTab === "academic" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.15s ease"
            }}
          >
            <GraduationCap size={16} />
            <span>Academic Departments</span>
            <span style={{
              background: activeTab === "academic" ? "#ecfdf5" : "#e2e8f0",
              color: activeTab === "academic" ? "#017846" : "#64748b",
              fontSize: "11px",
              padding: "2px 7px",
              borderRadius: "12px",
              fontWeight: 700
            }}>
              16
            </span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab("college"); setSearchQuery(""); setStatusFilter("ALL"); }}
            style={{
              padding: "8px 18px",
              fontSize: "13px",
              fontWeight: 700,
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              background: activeTab === "college" ? "#ffffff" : "transparent",
              color: activeTab === "college" ? "#2563eb" : "#64748b",
              boxShadow: activeTab === "college" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.15s ease"
            }}
          >
            <Building2 size={16} />
            <span>Affiliated Colleges</span>
            <span style={{
              background: activeTab === "college" ? "#eff6ff" : "#e2e8f0",
              color: activeTab === "college" ? "#2563eb" : "#64748b",
              fontSize: "11px",
              padding: "2px 7px",
              borderRadius: "12px",
              fontWeight: 700
            }}>
              13
            </span>
          </button>
        </div>

        {/* Right View Toggle */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
          <div style={{ display: "inline-flex", background: "#f1f5f9", padding: "3px", borderRadius: "8px" }}>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              title="Card Grid View"
              style={{
                padding: "6px 10px",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                background: viewMode === "grid" ? "#ffffff" : "transparent",
                color: viewMode === "grid" ? "#0f172a" : "#64748b",
                boxShadow: viewMode === "grid" ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "12px",
                fontWeight: 600
              }}
            >
              <LayoutGrid size={15} />
              <span>Grid</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              title="Table View"
              style={{
                padding: "6px 10px",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                background: viewMode === "table" ? "#ffffff" : "transparent",
                color: viewMode === "table" ? "#0f172a" : "#64748b",
                boxShadow: viewMode === "table" ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "12px",
                fontWeight: 600
              }}
            >
              <List size={15} />
              <span>Table</span>
            </button>
          </div>
        </div>
      </div>

      {/* Search & Filtering Toolbar */}
      <div style={{
        display: "flex",
        gap: "12px",
        alignItems: "center",
        flexWrap: "wrap",
        background: "#ffffff",
        padding: "12px 18px",
        borderRadius: "12px",
        border: "1px solid #e2e8f0",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)"
      }}>
        {/* Search Input */}
        <div style={{ flex: 1, minWidth: "260px", position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          <input 
            type="text" 
            placeholder={`Search ${activeTab === "academic" ? "specialization tracks" : "campuses"} by code, title, or keywords...`}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ 
              width: "100%", 
              paddingLeft: "38px", 
              paddingRight: searchQuery ? "36px" : "14px",
              height: "38px", 
              borderRadius: "8px", 
              border: "1px solid #cbd5e1",
              fontSize: "13px",
              color: "#0f172a",
              outline: "none",
              transition: "border 0.15s ease"
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              style={{
                position: "absolute",
                right: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#94a3b8"
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Academic Stream Filter Pills */}
        {activeTab === "academic" && (
          <div style={{ display: "inline-flex", background: "#f1f5f9", padding: "3px", borderRadius: "8px", gap: "2px" }}>
            <button
              type="button"
              onClick={() => setCategoryFilter("ALL")}
              style={{
                padding: "6px 12px",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                background: categoryFilter === "ALL" ? "#ffffff" : "transparent",
                color: categoryFilter === "ALL" ? "#017846" : "#64748b",
                boxShadow: categoryFilter === "ALL" ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                fontSize: "12px",
                fontWeight: 600,
                transition: "all 0.12s ease"
              }}
            >
              <span>All Tracks</span>
              <span style={{ fontSize: "10.5px", fontWeight: 700, opacity: 0.75 }}>({items.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter("TECHNICAL")}
              style={{
                padding: "6px 12px",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                background: categoryFilter === "TECHNICAL" ? "#ffffff" : "transparent",
                color: categoryFilter === "TECHNICAL" ? "#017846" : "#64748b",
                boxShadow: categoryFilter === "TECHNICAL" ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                fontSize: "12px",
                fontWeight: 600,
                transition: "all 0.12s ease"
              }}
            >
              <span>🛠️ Technical</span>
              <span style={{ fontSize: "10.5px", fontWeight: 700, opacity: 0.75 }}>({techCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter("NON_TECHNICAL")}
              style={{
                padding: "6px 12px",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                background: categoryFilter === "NON_TECHNICAL" ? "#ffffff" : "transparent",
                color: categoryFilter === "NON_TECHNICAL" ? "#7e22ce" : "#64748b",
                boxShadow: categoryFilter === "NON_TECHNICAL" ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                fontSize: "12px",
                fontWeight: 600,
                transition: "all 0.12s ease"
              }}
            >
              <span>💼 Non-Technical</span>
              <span style={{ fontSize: "10.5px", fontWeight: 700, opacity: 0.75 }}>({nonTechCount})</span>
            </button>
          </div>
        )}

        {/* Status Dropdown */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "12.5px", color: "#64748b", fontWeight: 600 }}>Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              fontSize: "13px",
              color: "#334155",
              backgroundColor: "#ffffff",
              cursor: "pointer",
              fontWeight: 600,
              outline: "none"
            }}
          >
            <option value="ALL">All Status ({items.length})</option>
            <option value="ACTIVE">Active Only ({activeCount})</option>
            <option value="INACTIVE">Inactive Only ({inactiveCount})</option>
          </select>
        </div>

        {/* Counter Badge */}
        <div style={{ fontSize: "12.5px", color: "#64748b", fontWeight: 500, paddingLeft: "4px" }}>
          Showing <b>{filteredItems.length}</b> of {items.length} {activeTab === "academic" ? "tracks" : "colleges"}
        </div>
      </div>

      {/* Error Callout */}
      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "12px", padding: "14px 18px", display: "flex", gap: "12px", color: "#991b1b" }}>
          <AlertCircle size={20} style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            <strong>Database Error:</strong> {error}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "64px 0", color: "#64748b" }}>
          <Loader2 size={36} className="animate-spin" style={{ margin: "0 auto 12px", color: activeTab === "academic" ? "#017846" : "#2563eb" }} />
          <p style={{ fontSize: "14px", fontWeight: 500 }}>
            Loading {activeTab === "academic" ? "departments & curriculum tracks" : "colleges & campuses"} from database...
          </p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "64px 24px",
          background: "#ffffff",
          borderRadius: "16px",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
        }}>
          <Building2 size={44} style={{ margin: "0 auto 12px", color: "#94a3b8" }} />
          <h3 style={{ margin: "0 0 6px", color: "#0f172a", fontSize: "16px", fontWeight: 700 }}>
            No {activeTab === "academic" ? "Departments" : "Colleges"} Found
          </h3>
          <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#64748b" }}>
            {items.length === 0 
              ? `No ${activeTab === "academic" ? "academic departments" : "affiliated colleges"} have been registered yet.`
              : "No records match your active search and status filter."}
          </p>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            style={{
              padding: "8px 18px",
              background: activeTab === "academic" ? "#017846" : "#2563eb",
              color: "#ffffff",
              borderRadius: "8px",
              border: "none",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <Plus size={15} /> Add New
          </button>
        </div>
      ) : viewMode === "grid" ? (
        /* GRID CARDS VIEW */
        activeTab === "college" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "18px" }}>
            {filteredItems.map(renderCard)}
          </div>
        ) : (
          /* ACADEMIC DEPARTMENTS - DUAL STREAM VIEW */
          <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
            {/* TECHNICAL DEPARTMENTS SECTION */}
            {(categoryFilter === "ALL" || categoryFilter === "TECHNICAL") && (
              <div>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingBottom: "10px",
                  marginBottom: "14px",
                  borderBottom: "1px solid #e2e8f0"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
                      🛠️ Technical Departments
                    </h3>
                    <span style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      background: "#ecfdf5",
                      color: "#017846",
                      padding: "2px 8px",
                      borderRadius: "999px",
                      border: "1px solid #a7f3d0"
                    }}>
                      {filteredItems.filter(i => i.category !== "NON_TECHNICAL").length} Tracks
                    </span>
                  </div>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    Core Engineering, Software Architecture, DevOps & QA
                  </span>
                </div>

                {filteredItems.filter(i => i.category !== "NON_TECHNICAL").length === 0 ? (
                  <div style={{ padding: "24px", textAlign: "center", color: "#94a3b8", fontSize: "13px", background: "#ffffff", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
                    No technical departments found matching your search.
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "18px" }}>
                    {filteredItems.filter(i => i.category !== "NON_TECHNICAL").map(renderCard)}
                  </div>
                )}
              </div>
            )}

            {/* NON-TECHNICAL DEPARTMENTS SECTION */}
            {(categoryFilter === "ALL" || categoryFilter === "NON_TECHNICAL") && (
              <div>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingBottom: "10px",
                  marginBottom: "14px",
                  borderBottom: "1px solid #e2e8f0"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
                      💼 Non-Technical Departments
                    </h3>
                    <span style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      background: "#faf5ff",
                      color: "#7e22ce",
                      padding: "2px 8px",
                      borderRadius: "999px",
                      border: "1px solid #e9d5ff"
                    }}>
                      {filteredItems.filter(i => i.category === "NON_TECHNICAL").length} Tracks
                    </span>
                  </div>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>
                    Human Resources, Sales & Business Management
                  </span>
                </div>

                {filteredItems.filter(i => i.category === "NON_TECHNICAL").length === 0 ? (
                  <div style={{ padding: "24px", textAlign: "center", color: "#94a3b8", fontSize: "13px", background: "#ffffff", borderRadius: "12px", border: "1px dashed #cbd5e1" }}>
                    No non-technical departments found matching your search.
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "18px" }}>
                    {filteredItems.filter(i => i.category === "NON_TECHNICAL").map(renderCard)}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      ) : (
        /* TABLE LIST VIEW */
        <div style={{
          background: "#ffffff",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontWeight: 700, fontSize: "11.5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                <th style={{ padding: "12px 18px" }}>Code</th>
                <th style={{ padding: "12px 18px" }}>Name / Title</th>
                {activeTab === "academic" && <th style={{ padding: "12px 18px" }}>Track Stream</th>}
                <th style={{ padding: "12px 18px" }}>Description</th>
                <th style={{ padding: "12px 18px" }}>{activeTab === "academic" ? "Exams / Candidates" : "Enrolled"}</th>
                <th style={{ padding: "12px 18px" }}>Status</th>
                <th style={{ padding: "12px 18px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item, idx) => {
                const accent = getBadgeAccent(item.code);
                return (
                  <tr 
                    key={item.id}
                    style={{ 
                      borderBottom: idx < filteredItems.length - 1 ? "1px solid #f1f5f9" : "none",
                      transition: "background 0.12s ease"
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <td style={{ padding: "14px 18px", verticalAlign: "middle" }}>
                      <span style={{ 
                        padding: "3px 8px", 
                        background: accent.bg, 
                        color: accent.text, 
                        border: `1px solid ${accent.border}`,
                        fontWeight: 800, 
                        fontSize: "11.5px", 
                        borderRadius: "6px",
                        fontFamily: "monospace"
                      }}>
                        {item.code}
                      </span>
                    </td>
                    <td style={{ padding: "14px 18px", verticalAlign: "middle" }}>
                      <div style={{ fontWeight: 700, color: "#0f172a" }}>{item.name}</div>
                      <div style={{ fontSize: "11px", color: "#94a3b8" }}>ID: #{item.id}</div>
                    </td>
                    {activeTab === "academic" && (
                      <td style={{ padding: "14px 18px", verticalAlign: "middle" }}>
                        <span style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: "999px",
                          background: item.category === "NON_TECHNICAL" ? "#faf5ff" : "#ecfdf5",
                          color: item.category === "NON_TECHNICAL" ? "#7e22ce" : "#047857",
                          border: item.category === "NON_TECHNICAL" ? "1px solid #e9d5ff" : "1px solid #a7f3d0",
                          whiteSpace: "nowrap"
                        }}>
                          {item.category === "NON_TECHNICAL" ? "💼 Non-Technical" : "🛠️ Technical"}
                        </span>
                      </td>
                    )}
                    <td style={{ padding: "14px 18px", verticalAlign: "middle", maxWidth: "340px", color: "#64748b", lineHeight: 1.4 }}>
                      {item.description || <i style={{ color: "#94a3b8" }}>No description</i>}
                    </td>
                    <td style={{ padding: "14px 18px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                      {activeTab === "academic" ? (
                        <div style={{ display: "flex", gap: "6px" }}>
                          <span style={{ fontSize: "11px", background: "#ecfdf5", color: "#065f46", padding: "2px 6px", borderRadius: "4px", fontWeight: 600 }}>
                            👥 {item.candidatesCount || 0}
                          </span>
                          <span style={{ fontSize: "11px", background: "#eff6ff", color: "#1d4ed8", padding: "2px 6px", borderRadius: "4px", fontWeight: 600 }}>
                            🎯 {item.associatedExamsCount || 0}
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: "11px", background: "#eff6ff", color: "#1d4ed8", padding: "2px 8px", borderRadius: "4px", fontWeight: 600 }}>
                          👥 {item.candidatesCount || 0} Candidates
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "14px 18px", verticalAlign: "middle" }}>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(item)}
                        style={{
                          background: item.active ? "#ecfdf5" : "#f1f5f9",
                          border: item.active ? "1px solid #a7f3d0" : "1px solid #e2e8f0",
                          borderRadius: "16px",
                          padding: "2px 8px",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px"
                        }}
                      >
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: item.active ? "#10b981" : "#94a3b8" }} />
                        <span style={{ fontSize: "11px", fontWeight: 700, color: item.active ? "#065f46" : "#64748b" }}>
                          {item.active ? "Active" : "Inactive"}
                        </span>
                      </button>
                    </td>
                    <td style={{ padding: "14px 18px", verticalAlign: "middle", textAlign: "right", whiteSpace: "nowrap" }}>
                      <button 
                        type="button" 
                        onClick={() => handleOpenEditModal(item)}
                        style={{ 
                          padding: "4px 8px", 
                          fontSize: "11.5px", 
                          fontWeight: 600,
                          color: "#334155",
                          background: "#ffffff",
                          border: "1px solid #cbd5e1",
                          borderRadius: "6px",
                          cursor: "pointer",
                          marginRight: "6px"
                        }}
                      >
                        Edit
                      </button>
                      <button 
                        type="button" 
                        onClick={() => handleDelete(item)}
                        style={{ 
                          padding: "4px 8px", 
                          fontSize: "11.5px", 
                          fontWeight: 600,
                          color: "#dc2626", 
                          background: "#ffffff",
                          border: "1px solid #fecaca",
                          borderRadius: "6px",
                          cursor: "pointer"
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modern Create / Edit Modal Dialog */}
      {isModalOpen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(15, 23, 42, 0.65)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "16px"
        }}>
          <div style={{
            maxWidth: "520px",
            width: "100%",
            background: "#ffffff",
            borderRadius: "16px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            overflow: "hidden",
            animation: "fadeIn 0.2s ease"
          }}>
            {/* Modal Header */}
            <div style={{
              padding: "20px 24px",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "#f8fafc"
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: "#0f172a" }}>
                  {editingItem 
                    ? `Edit ${activeTab === "academic" ? "Academic Department" : "College"}` 
                    : `Create New ${activeTab === "academic" ? "Academic Department" : "College"}`}
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#64748b" }}>
                  {editingItem ? "Update record metadata and status." : "Register a new track or institution in the database."}
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#94a3b8",
                  padding: "4px"
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSave} style={{ padding: "24px" }}>
              {formError && (
                <div style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "10px",
                  padding: "10px 14px",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "12.5px",
                  color: "#991b1b"
                }}>
                  <AlertCircle size={16} />
                  <span>{formError}</span>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Code Field */}
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                    Unique Identifier Code *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={activeTab === "academic" ? "e.g. AIML, DEV, CSE, CIVIL" : "e.g. SJEC, CEC, AJIET"}
                    value={formCode}
                    onChange={e => setFormCode(e.target.value.toUpperCase())}
                    style={{
                      width: "100%",
                      height: "40px",
                      padding: "0 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      fontFamily: "monospace",
                      fontWeight: 700,
                      color: "#0f172a",
                      outline: "none"
                    }}
                  />
                  <span style={{ fontSize: "11px", color: "#64748b", marginTop: "3px", display: "block" }}>
                    Must be uppercase and unique across all entries.
                  </span>
                </div>

                {/* Name Field */}
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                    {activeTab === "academic" ? "Department / Specialization Title *" : "Official College / Campus Name *"}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={activeTab === "academic" ? "e.g. AI/ML Developer, Software Engineer" : "e.g. St Joseph Engineering College"}
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    style={{
                      width: "100%",
                      height: "40px",
                      padding: "0 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      color: "#0f172a",
                      outline: "none"
                    }}
                  />
                </div>

                {/* Track / Category Selector (Academic Departments only) */}
                {activeTab === "academic" && (
                  <div>
                    <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                      Department Stream / Track *
                    </label>
                    <select
                      value={formCategory}
                      onChange={e => setFormCategory(e.target.value as "TECHNICAL" | "NON_TECHNICAL")}
                      style={{
                        width: "100%",
                        height: "40px",
                        padding: "0 12px",
                        borderRadius: "8px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#0f172a",
                        backgroundColor: "#ffffff",
                        outline: "none",
                        cursor: "pointer"
                      }}
                    >
                      <option value="TECHNICAL">🛠️ Technical Department (Engineering, Development, Testing, UI/UX)</option>
                      <option value="NON_TECHNICAL">💼 Non-Technical Department (HR, Sales, Marketing, Operations)</option>
                    </select>
                    <span style={{ fontSize: "11px", color: "#64748b", marginTop: "3px", display: "block" }}>
                      Determines whether candidates selecting this department in the candidate portal receive Technical or Non-Technical exams.
                    </span>
                  </div>
                )}

                {/* Description Field */}
                <div>
                  <label style={{ display: "block", fontSize: "12.5px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                    Curriculum Description / Specialization Notes
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Brief description of skills, syllabus focus, or campus affiliation..."
                    value={formDesc}
                    onChange={e => setFormDesc(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      color: "#0f172a",
                      outline: "none",
                      resize: "vertical"
                    }}
                  />
                </div>

                {/* Active Checkbox */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#f8fafc",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0"
                }}>
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>Status: Active</div>
                    <div style={{ fontSize: "11.5px", color: "#64748b" }}>Permit candidate allocation and assessment scheduling</div>
                  </div>
                  <input 
                    type="checkbox"
                    checked={formActive}
                    onChange={e => setFormActive(e.target.checked)}
                    style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "#017846" }}
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "24px" }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "#475569",
                    background: "#ffffff",
                    border: "1px solid #cbd5e1",
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding: "9px 20px",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "#ffffff",
                    background: activeTab === "academic" ? "#017846" : "#2563eb",
                    border: "none",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  {saving && <Loader2 size={14} className="animate-spin" />}
                  <span>{editingItem ? "Update Changes" : "Save Record"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
