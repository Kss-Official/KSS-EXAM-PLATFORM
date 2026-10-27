import { useState, useEffect, useCallback } from "react";
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
  Users
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

interface BaseItem {
  id: number;
  name: string;
  code: string;
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

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BaseItem | null>(null);
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === "academic") {
        const data = await getAllDepartments({ type: "academic" });
        setItems(data);
      } else {
        const data = await getColleges();
        setItems(data.map(c => ({
          id: c.id,
          name: c.name,
          code: c.code || "",
          description: c.description,
          active: c.active,
          createdAt: c.createdAt,
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
    setFormDesc("");
    setFormActive(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: BaseItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormCode(item.code);
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
            description: formDesc.trim(),
            active: formActive
          });
        } else {
          await createDepartment({
            name: formName.trim(),
            code: formCode.trim().toUpperCase(),
            description: formDesc.trim(),
            active: formActive
          });
        }
      } else {
        if (editingItem) {
          await updateCollege(editingItem.id, {
            name: formName.trim(),
            code: formCode.trim().toUpperCase(),
            description: formDesc.trim(),
            active: formActive
          });
        } else {
          await createCollege({
            name: formName.trim(),
            code: formCode.trim().toUpperCase(),
            description: formDesc.trim(),
            active: formActive
          });
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
      fetchItems();
    } catch (err: unknown) {
      const errorObj = err as ApiError;
      alert(`Failed to update status: ${errorObj.message}`);
    }
  };

  const handleDelete = async (id: number) => {
    const itemType = activeTab === "academic" ? "department" : "college";
    if (!window.confirm(`Are you sure you want to delete this ${itemType}?`)) {
      return;
    }
    try {
      if (activeTab === "academic") {
        await deleteDepartment(id);
      } else {
        await deleteCollege(id);
      }
      fetchItems();
    } catch (err: unknown) {
      const errorObj = err as ApiError;
      alert(`Cannot delete ${itemType}: ${errorObj.message}`);
    }
  };

  const filteredItems = items.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (d.description && d.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
            {activeTab === "academic" ? (
              <>
                <GraduationCap size={24} color="#017846" />
                Academic Departments
              </>
            ) : (
              <>
                <Building2 size={24} color="#2563eb" />
                Affiliated Colleges & Institutes
              </>
            )}
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
            {activeTab === "academic" 
              ? "Manage academic departments & specialization tracks (stored in departments table)."
              : "Manage affiliated colleges and engineering institutions (stored in separate colleges table)."}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button 
            type="button" 
            className="secondary" 
            onClick={fetchItems} 
            disabled={loading}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <button 
            type="button" 
            className="primary" 
            onClick={handleOpenCreateModal}
            style={{ 
              display: "inline-flex", 
              alignItems: "center", 
              gap: "6px",
              background: activeTab === "academic" ? "#017846" : "#2563eb"
            }}
          >
            <Plus size={16} /> {activeTab === "academic" ? "Create Department" : "Add College"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #e2e8f0", paddingBottom: "8px" }}>
        <button
          type="button"
          onClick={() => setActiveTab("academic")}
          style={{
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: activeTab === "academic" ? 700 : 500,
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
            background: activeTab === "academic" ? "#EAF6EF" : "transparent",
            color: activeTab === "academic" ? "#017846" : "#64748b"
          }}
        >
          🎓 Academic Departments ({activeTab === "academic" ? items.length : "Departments Table"})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("college")}
          style={{
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: activeTab === "college" ? 700 : 500,
            borderRadius: "6px",
            border: "none",
            cursor: "pointer",
            background: activeTab === "college" ? "#eff6ff" : "transparent",
            color: activeTab === "college" ? "#2563eb" : "#64748b"
          }}
        >
          🏫 Affiliated Colleges ({activeTab === "college" ? items.length : "Colleges Table"})
        </button>
      </div>

      {/* Search & Statistics Banner */}
      <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: "260px", position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          <input 
            type="text" 
            placeholder={`Search ${activeTab === "academic" ? "departments" : "colleges"} by name, code or description...`}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: "100%", paddingLeft: "36px", height: "40px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
          />
        </div>
        <div style={{ display: "flex", gap: "12px", fontSize: "13px", color: "#475569" }}>
          <span>Total: <b>{items.length}</b></span>
          <span>Active: <b style={{ color: "#16a34a" }}>{items.filter(d => d.active).length}</b></span>
          <span>Inactive: <b style={{ color: "#dc2626" }}>{items.filter(d => !d.active).length}</b></span>
        </div>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #f87171", borderRadius: "8px", padding: "12px", display: "flex", gap: "10px", color: "#991b1b" }}>
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
          <span>{error}</span>
        </div>
      )}

      {/* Item Cards Grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#64748b" }}>
          <Loader2 size={32} className="animate-spin" style={{ margin: "0 auto 8px" }} />
          <p>Loading {activeTab === "academic" ? "departments" : "colleges"} from database...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px", color: "#64748b" }}>
          <Building2 size={40} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
          <h3 style={{ margin: "0 0 6px", color: "#1e293b" }}>
            No {activeTab === "academic" ? "Departments" : "Colleges"} Found
          </h3>
          <p style={{ margin: 0, fontSize: "13px" }}>
            {items.length === 0 
              ? `No ${activeTab === "academic" ? "academic departments" : "affiliated colleges"} have been registered yet. Click 'Add' to create your first.`
              : "No records match your search filter."}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {filteredItems.map(item => (
            <div key={item.id} className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", border: "1px solid #e2e8f0" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ 
                      padding: "3px 8px", 
                      background: activeTab === "academic" ? "#EAF6EF" : "#eff6ff", 
                      color: activeTab === "academic" ? "#017846" : "#2563eb", 
                      fontWeight: 700, 
                      fontSize: "12px", 
                      borderRadius: "6px",
                      fontFamily: "monospace"
                    }}>
                      {item.code}
                    </span>
                    <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
                      {item.name}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(item)}
                    title={item.active ? "Click to deactivate" : "Click to activate"}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    {item.active ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#16a34a", fontWeight: 600 }}>
                        <CheckCircle2 size={14} /> Active
                      </span>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>
                        <XCircle size={14} /> Inactive
                      </span>
                    )}
                  </button>
                </div>

                <p style={{ fontSize: "12.5px", color: "#64748b", margin: "0 0 16px 0", minHeight: "36px", lineHeight: 1.4 }}>
                  {item.description || <i>No description provided.</i>}
                </p>

                {activeTab === "college" && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "#f8fafc", padding: "4px 8px", borderRadius: "6px", fontSize: "12px", color: "#475569", marginBottom: "10px" }}>
                    <Users size={14} color="#64748b" />
                    <span><b>{item.candidatesCount ?? 0}</b> enrolled candidates</span>
                  </div>
                )}
              </div>

              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center", 
                paddingTop: "12px", 
                borderTop: "1px solid #f1f5f9" 
              }}>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                  ID: #{item.id}
                </span>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button 
                    type="button" 
                    className="secondary" 
                    onClick={() => handleOpenEditModal(item)}
                    style={{ padding: "4px 8px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                  >
                    <Edit3 size={12} /> Edit
                  </button>
                  <button 
                    type="button" 
                    className="secondary" 
                    onClick={() => handleDelete(item.id)}
                    style={{ padding: "4px 8px", fontSize: "11px", color: "#dc2626", borderColor: "#fecaca" }}
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal Dialog */}
      {isModalOpen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(15, 23, 42, 0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "16px"
        }}>
          <div className="card" style={{ maxWidth: "480px", width: "100%", background: "#fff", borderRadius: "12px", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)" }}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: "17px", fontWeight: 700, color: "#0f172a" }}>
              {editingItem 
                ? `Edit ${activeTab === "academic" ? "Academic Department" : "College"}` 
                : `Create New ${activeTab === "academic" ? "Academic Department" : "College"}`}
            </h3>

            {formError && (
              <div style={{ background: "#fef2f2", border: "1px solid #f87171", borderRadius: "6px", padding: "10px", fontSize: "12.5px", color: "#991b1b", marginBottom: "14px" }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleSave}>
              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>
                  {activeTab === "academic" ? "Department Name" : "College / Institute Name"} <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input 
                  type="text" 
                  value={formName} 
                  onChange={e => setFormName(e.target.value)}
                  placeholder={activeTab === "academic" ? "e.g. Computer Science and Engineering" : "e.g. St Joseph Engineering College"}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>
                  {activeTab === "academic" ? "Department Code" : "College Code"} <span style={{ color: "#dc2626" }}>*</span> (Unique identifier)
                </label>
                <input 
                  type="text" 
                  value={formCode} 
                  onChange={e => setFormCode(e.target.value)}
                  placeholder={activeTab === "academic" ? "e.g. CSE" : "e.g. SJEC"}
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", textTransform: "uppercase" }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>
                  Description (Optional)
                </label>
                <textarea 
                  value={formDesc} 
                  onChange={e => setFormDesc(e.target.value)}
                  placeholder={activeTab === "academic" ? "Brief description of department scope..." : "Location, affiliation, or campus details..."}
                  rows={3}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
                <input 
                  type="checkbox" 
                  id="itemActive"
                  checked={formActive} 
                  onChange={e => setFormActive(e.target.checked)} 
                  style={{ width: "16px", height: "16px" }}
                />
                <label htmlFor="itemActive" style={{ fontSize: "13px", color: "#334155", cursor: "pointer" }}>
                  Active ({activeTab === "academic" ? "Department appears in exam tracks" : "College appears in candidate registrations"})
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button 
                  type="button" 
                  className="secondary" 
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="primary" 
                  disabled={saving}
                  style={{ 
                    display: "inline-flex", 
                    alignItems: "center", 
                    gap: "6px",
                    background: activeTab === "academic" ? "#017846" : "#2563eb"
                  }}
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                  {editingItem ? "Save Changes" : `Create ${activeTab === "academic" ? "Department" : "College"}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
