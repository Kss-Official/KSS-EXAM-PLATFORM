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
  AlertCircle
} from "lucide-react";
import { 
  getAllDepartments, 
  createDepartment, 
  updateDepartment, 
  deleteDepartment, 
  type DepartmentDto, 
  ApiError 
} from "../../services/api";

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<DepartmentDto | null>(null);
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAllDepartments();
      setDepartments(data);
    } catch (err: unknown) {
      const errorObj = err as ApiError;
      setError(errorObj.message || "Failed to load departments from database.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const handleOpenCreateModal = () => {
    setEditingDept(null);
    setFormName("");
    setFormCode("");
    setFormDesc("");
    setFormActive(true);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (dept: DepartmentDto) => {
    setEditingDept(dept);
    setFormName(dept.name);
    setFormCode(dept.code);
    setFormDesc(dept.description || "");
    setFormActive(dept.active);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError("Department name is required.");
      return;
    }
    if (!formCode.trim()) {
      setFormError("Department unique code is required.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      if (editingDept) {
        await updateDepartment(editingDept.id, {
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
      setIsModalOpen(false);
      fetchDepartments();
    } catch (err: unknown) {
      const errorObj = err as ApiError;
      setFormError(errorObj.message || "Failed to save department. Department code must be unique.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (dept: DepartmentDto) => {
    try {
      await updateDepartment(dept.id, {
        name: dept.name,
        code: dept.code,
        description: dept.description,
        active: !dept.active
      });
      fetchDepartments();
    } catch (err: unknown) {
      const errorObj = err as ApiError;
      alert("Failed to update department status: " + errorObj.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this department?")) {
      return;
    }
    try {
      await deleteDepartment(id);
      fetchDepartments();
    } catch (err: unknown) {
      const errorObj = err as ApiError;
      alert("Cannot delete department: " + errorObj.message);
    }
  };

  const filteredDepts = departments.filter(d => 
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
            <Building2 size={22} color="#017846" />
            Academic Departments Management
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "13px", color: "#64748b" }}>
            Manage departments eligible for examination enrollment. Real database records only.
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button 
            type="button" 
            className="secondary" 
            onClick={fetchDepartments} 
            disabled={loading}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <button 
            type="button" 
            className="primary" 
            onClick={handleOpenCreateModal}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <Plus size={16} /> Create Department
          </button>
        </div>
      </div>

      {/* Search & Statistics Banner */}
      <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: "260px", position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          <input 
            type="text"
            placeholder="Search departments by name, code or description..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: "100%", paddingLeft: "36px", height: "40px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
          />
        </div>
        <div style={{ display: "flex", gap: "12px", fontSize: "13px", color: "#475569" }}>
          <span>Total: <b>{departments.length}</b></span>
          <span>Active: <b style={{ color: "#16a34a" }}>{departments.filter(d => d.active).length}</b></span>
          <span>Inactive: <b style={{ color: "#dc2626" }}>{departments.filter(d => !d.active).length}</b></span>
        </div>
      </div>

      {error && (
        <div style={{ background: "#fef2f2", border: "1px solid #f87171", borderRadius: "8px", padding: "12px", display: "flex", gap: "10px", color: "#991b1b" }}>
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
          <span>{error}</span>
        </div>
      )}

      {/* Department Cards Grid */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#64748b" }}>
          <Loader2 size={32} className="animate-spin" style={{ margin: "0 auto 8px" }} />
          <p>Loading departments from PostgreSQL database...</p>
        </div>
      ) : filteredDepts.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 24px", color: "#64748b" }}>
          <Building2 size={40} style={{ margin: "0 auto 12px", opacity: 0.5 }} />
          <h3 style={{ margin: "0 0 6px", color: "#1e293b" }}>No Departments Found</h3>
          <p style={{ margin: 0, fontSize: "13px" }}>
            {departments.length === 0 
              ? "No academic departments have been created yet. Click 'Create Department' to add your first real department."
              : "No departments match your search filter."}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "16px" }}>
          {filteredDepts.map(dept => (
            <div key={dept.id} className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", border: "1px solid #e2e8f0" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ 
                      padding: "3px 8px", 
                      background: "#EAF6EF", 
                      color: "#017846", 
                      fontWeight: 700, 
                      fontSize: "12px", 
                      borderRadius: "6px",
                      fontFamily: "monospace"
                    }}>
                      {dept.code}
                    </span>
                    <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
                      {dept.name}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggleActive(dept)}
                    title={dept.active ? "Click to deactivate" : "Click to activate"}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  >
                    {dept.active ? (
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
                  {dept.description || <i>No description provided.</i>}
                </p>
              </div>

              <div style={{ 
                display: "flex", 
                justifyContent: "space-between", 
                alignItems: "center", 
                paddingTop: "12px", 
                borderTop: "1px solid #f1f5f9" 
              }}>
                <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                  ID: #{dept.id}
                </span>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button 
                    type="button" 
                    className="secondary" 
                    onClick={() => handleOpenEditModal(dept)}
                    style={{ padding: "4px 8px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                  >
                    <Edit3 size={12} /> Edit
                  </button>
                  <button 
                    type="button" 
                    className="secondary" 
                    onClick={() => handleDelete(dept.id)}
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
              {editingDept ? "Edit Academic Department" : "Create New Academic Department"}
            </h3>

            {formError && (
              <div style={{ background: "#fef2f2", border: "1px solid #f87171", borderRadius: "6px", padding: "10px", fontSize: "12.5px", color: "#991b1b", marginBottom: "14px" }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleSave}>
              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>
                  Department Name <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input 
                  type="text" 
                  value={formName} 
                  onChange={e => setFormName(e.target.value)}
                  placeholder="e.g. Computer Science and Engineering"
                  required
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: "12px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>
                  Department Code <span style={{ color: "#dc2626" }}>*</span> (Unique identifier)
                </label>
                <input 
                  type="text" 
                  value={formCode} 
                  onChange={e => setFormCode(e.target.value)}
                  placeholder="e.g. CSE"
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
                  placeholder="Brief description of department scope..."
                  rows={3}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "20px" }}>
                <input 
                  type="checkbox" 
                  id="deptActive"
                  checked={formActive} 
                  onChange={e => setFormActive(e.target.checked)} 
                  style={{ width: "16px", height: "16px" }}
                />
                <label htmlFor="deptActive" style={{ fontSize: "13px", color: "#334155", cursor: "pointer" }}>
                  Active (Department appears in examination assignments)
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
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : null}
                  {editingDept ? "Save Changes" : "Create Department"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
