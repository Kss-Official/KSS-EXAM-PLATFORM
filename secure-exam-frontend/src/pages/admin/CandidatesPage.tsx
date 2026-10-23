import { useState, useEffect } from "react";
import { 
  Search, 
  FileSpreadsheet, 
  PlusCircle,
  RotateCcw,
  UserCheck,
  Users
} from "lucide-react";
import { 
  getAllCandidates, 
  createCandidate, 
  uploadCandidatesCsv, 
  getAllDepartments,
  type CandidateDto, 
  type DepartmentDto 
} from "../../services/api";

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<CandidateDto[]>([]);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [notice, setNotice] = useState<string | null>(null);

  // New Candidate Modal
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newRegNum, setNewRegNum] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newDeptId, setNewDeptId] = useState<number | undefined>(undefined);

  // CSV Import Modal
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploadingCsv, setUploadingCsv] = useState(false);

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const data = await getAllCandidates();
      setCandidates(data);
    } catch (e: unknown) {
      const errorObj = e as Error;
      setNotice("Failed to load candidates: " + errorObj.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
    getAllDepartments().then(setDepartments).catch(() => {});
  }, []);

  const handleCreateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRegNum.trim() || !newName.trim() || !newEmail.trim()) {
      setNotice("Registration Number, Full Name, and Email are required.");
      return;
    }

    try {
      const created = await createCandidate({
        registrationNumber: newRegNum.trim().toUpperCase(),
        fullName: newName.trim(),
        email: newEmail.trim().toLowerCase(),
        departmentId: newDeptId
      });

      setCandidates(prev => [created, ...prev]);
      setNotice(`Candidate ${created.fullName} (${created.registrationNumber}) created in PostgreSQL.`);
      setIsNewModalOpen(false);
      setNewRegNum("");
      setNewName("");
      setNewEmail("");
    } catch (err: unknown) {
      const errorObj = err as Error;
      setNotice("Error creating candidate: " + errorObj.message);
    }
  };

  const handleUploadCsv = async () => {
    if (!csvFile) return;
    setUploadingCsv(true);
    try {
      const res = await uploadCandidatesCsv(csvFile);
      setNotice(`Batch import complete: ${res.totalImported} candidates inserted. Errors: ${res.errorsCount}`);
      setIsCsvModalOpen(false);
      setCsvFile(null);
      fetchCandidates();
    } catch (err: unknown) {
      const errorObj = err as Error;
      setNotice("Batch CSV upload failed: " + errorObj.message);
    } finally {
      setUploadingCsv(false);
    }
  };

  const filtered = candidates.filter(c => {
    const matchesSearch = 
      c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.registrationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.departmentName && c.departmentName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="admin-page-container">
      <div className="admin-page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Users size={18} color="#2563eb" />
            <strong style={{ fontSize: "15px", color: "#0f172a", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              Registered Candidates Roster
            </strong>
          </div>
          <p style={{ margin: "3px 0 0", fontSize: "12.5px", color: "#64748b" }}>
            Manage student registrations, department eligibility tracks, and batch CSV imports
          </p>
        </div>
        <div className="admin-page-actions">
          <button 
            type="button" 
            className="admin-btn secondary" 
            onClick={fetchCandidates}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
          >
            <RotateCcw size={14} /> Refresh
          </button>
          <button 
            type="button" 
            className="admin-btn secondary" 
            onClick={() => setIsCsvModalOpen(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#ffffff", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
          >
            <FileSpreadsheet size={15} color="#059669" /> Batch CSV Import
          </button>
          <button 
            type="button" 
            className="admin-btn primary" 
            onClick={() => setIsNewModalOpen(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "8px", background: "linear-gradient(135deg, #2563eb, #1d4ed8)", color: "#ffffff", border: "none", fontSize: "12.5px", fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(37, 99, 235, 0.25)" }}
          >
            <PlusCircle size={15} /> Register Candidate
          </button>
        </div>
      </div>

      {notice && (
        <div style={{ padding: "12px 16px", background: notice.includes("failed") || notice.includes("Error") ? "#fef2f2" : "#f0fdf4", border: "1px solid #cbd5e1", borderRadius: "10px", fontSize: "13px", marginBottom: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="filter-search-row">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search by candidate name, registration number, or email..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="status-filter-pills">
          {["ALL", "ACTIVE", "DISABLED"].map(st => (
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

      {/* Candidates Table */}
      <div className="admin-table-card">
        <div className="table-responsive">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Registration Number</th>
                <th>Candidate Name</th>
                <th>Email Address</th>
                <th>Assigned Department</th>
                <th>Account Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                    Loading candidate records from PostgreSQL...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "50px 20px", color: "#64748b" }}>
                    <UserCheck size={36} color="#cbd5e1" style={{ margin: "0 auto 10px" }} />
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "14px", color: "#1e293b" }}>No candidates registered yet</p>
                    <small style={{ color: "#64748b", display: "block", marginTop: "4px" }}>
                      Register a candidate or use Batch CSV Import to load student rosters.
                    </small>
                  </td>
                </tr>
              ) : (
                filtered.map(cand => (
                  <tr key={cand.id}>
                    <td>
                      <b style={{ color: "#0f172a", fontFamily: "JetBrains Mono, monospace" }}>{cand.registrationNumber}</b>
                    </td>
                    <td style={{ fontWeight: 600 }}>{cand.fullName}</td>
                    <td><small style={{ color: "#64748b" }}>{cand.email}</small></td>
                    <td>
                      {cand.departmentName ? (
                        <span className="admin-dept-chip">
                          {cand.departmentName}
                        </span>
                      ) : (
                        <span style={{ fontSize: "11px", color: "#94a3b8" }}>Unassigned</span>
                      )}
                    </td>
                    <td>
                      <span className={`status-pill ${cand.status.toLowerCase()}`}>
                        {cand.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Candidate Modal */}
      {isNewModalOpen && (
        <div className="admin-modal-backdrop" onClick={() => setIsNewModalOpen(false)}>
          <div className="admin-modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ margin: 0, fontSize: "16px" }}>Register Candidate</h3>
              <button type="button" onClick={() => setIsNewModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>✕</button>
            </div>
            <form onSubmit={handleCreateCandidate} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600 }}>Registration Number / Roll No *</label>
                <input type="text" placeholder="e.g. 2026-CSE-101" value={newRegNum} onChange={e => setNewRegNum(e.target.value)} required style={{ width: "100%", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "6px" }} />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600 }}>Full Name *</label>
                <input type="text" placeholder="e.g. Aarav Sharma" value={newName} onChange={e => setNewName(e.target.value)} required style={{ width: "100%", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "6px" }} />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600 }}>Email Address *</label>
                <input type="email" placeholder="e.g. aarav@campus.edu" value={newEmail} onChange={e => setNewEmail(e.target.value)} required style={{ width: "100%", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "6px" }} />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600 }}>Department</label>
                <select value={newDeptId || ""} onChange={e => setNewDeptId(e.target.value ? Number(e.target.value) : undefined)} style={{ width: "100%", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "6px" }}>
                  <option value="">-- Unassigned --</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.code})</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "10px" }}>
                <button type="button" className="secondary" onClick={() => setIsNewModalOpen(false)}>Cancel</button>
                <button type="submit" className="primary">Register</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {isCsvModalOpen && (
        <div className="admin-modal-backdrop" onClick={() => setIsCsvModalOpen(false)}>
          <div className="admin-modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ margin: 0, fontSize: "16px" }}>Batch Candidate CSV Ingestion</h3>
              <button type="button" onClick={() => setIsCsvModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>✕</button>
            </div>
            <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 12px 0" }}>
              CSV columns: <code>RegistrationNumber, FullName, Email, [DepartmentCode]</code>
            </p>
            <input 
              type="file" 
              accept=".csv"
              onChange={e => setCsvFile(e.target.files ? e.target.files[0] : null)}
              style={{ fontSize: "12px", marginBottom: "16px" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button type="button" className="secondary" onClick={() => setIsCsvModalOpen(false)}>Cancel</button>
              <button 
                type="button" 
                className="primary" 
                disabled={!csvFile || uploadingCsv}
                onClick={handleUploadCsv}
              >
                {uploadingCsv ? "Ingesting..." : "Upload & Ingest to PostgreSQL"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
