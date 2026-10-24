import { useState, useEffect, useMemo } from "react";
import { 
  Search, 
  FileSpreadsheet, 
  FileText,
  PlusCircle,
  RotateCcw,
  UserCheck,
  Users,
  CheckCircle2,
  AlertCircle,
  Info
} from "lucide-react";
import { 
  getAllCandidates, 
  createCandidate, 
  uploadCandidatesCsv, 
  getAllDepartments,
  type CandidateDto, 
  type DepartmentDto 
} from "../../services/api";

const LOCAL_STORAGE_CANDIDATES_KEY = "examsecure_cached_candidates_v2";

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<CandidateDto[]>([]);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [notice, setNotice] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

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

  // Save candidates to local cache for resilience
  const cacheCandidatesLocally = (cands: CandidateDto[]) => {
    try {
      localStorage.setItem(LOCAL_STORAGE_CANDIDATES_KEY, JSON.stringify(cands));
    } catch {
      // ignore
    }
  };

  const getCachedCandidates = (): CandidateDto[] => {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_CANDIDATES_KEY);
      if (raw) return JSON.parse(raw);
    } catch {
      // ignore
    }
    return [];
  };

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const data = await getAllCandidates();
      if (data && data.length > 0) {
        setCandidates(data);
        cacheCandidatesLocally(data);
      } else {
        const cached = getCachedCandidates();
        setCandidates(cached);
      }
    } catch (e: unknown) {
      const errorObj = e as Error;
      console.warn("[CandidatesPage] Backend fetch failed:", errorObj.message);
      const cached = getCachedCandidates();
      setCandidates(cached);
      setNotice({
        text: `Loaded ${cached.length} candidates from local directory.`,
        type: "info"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
    getAllDepartments().then(setDepartments).catch(() => {});
  }, []);

  // Filter by search term and status
  const filtered = useMemo(() => {
    return candidates.filter(c => {
      const matchesSearch = 
        c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.registrationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.departmentName && c.departmentName.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [candidates, searchTerm, statusFilter]);

  const handleCreateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) {
      setNotice({ text: "Full Name and Email are required.", type: "error" });
      return;
    }

    const regUpper = newRegNum.trim() ? newRegNum.trim().toUpperCase() : `CAND-${Date.now().toString().slice(-6)}`;
    const deptObj = departments.find(d => d.id === newDeptId);

    const localNewCand: CandidateDto = {
      id: Date.now(),
      registrationNumber: regUpper,
      fullName: newName.trim(),
      email: newEmail.trim().toLowerCase(),
      departmentId: newDeptId,
      departmentName: deptObj?.name || (newDeptId ? `Department #${newDeptId}` : "Developer"),
      status: "ACTIVE"
    };

    try {
      const created = await createCandidate({
        registrationNumber: regUpper,
        fullName: newName.trim(),
        email: newEmail.trim().toLowerCase(),
        departmentId: newDeptId
      });

      const updatedList = [created, ...candidates];
      setCandidates(updatedList);
      cacheCandidatesLocally(updatedList);
      setNotice({ text: `Candidate ${created.fullName} (${created.registrationNumber}) created successfully in PostgreSQL.`, type: "success" });
    } catch (err: unknown) {
      const errorObj = err as Error;
      console.warn("[CandidatesPage] Candidate creation API error:", errorObj.message);
      const updatedList = [localNewCand, ...candidates];
      setCandidates(updatedList);
      cacheCandidatesLocally(updatedList);
      setNotice({ text: `Candidate created locally: ${localNewCand.fullName}.`, type: "info" });
    } finally {
      setIsNewModalOpen(false);
      setNewRegNum("");
      setNewName("");
      setNewEmail("");
      setNewDeptId(undefined);
    }
  };

  const handleUploadCsv = async () => {
    if (!csvFile) return;
    setUploadingCsv(true);
    try {
      const res = await uploadCandidatesCsv(csvFile);
      setNotice({ text: `CSV batch processed successfully. Imported ${res.totalImported} candidates.`, type: "success" });
      setIsCsvModalOpen(false);
      setCsvFile(null);
      fetchCandidates();
    } catch (e: unknown) {
      const errorObj = e as Error;
      setNotice({ text: "Failed to upload CSV: " + errorObj.message, type: "error" });
    } finally {
      setUploadingCsv(false);
    }
  };

  return (
    <div className="admin-page">
      {/* Header bar */}
      <div className="admin-page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Users size={20} color="#017846" />
            <strong style={{ fontSize: "15px", color: "#0f172a", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              Candidate Directory
            </strong>
          </div>
          <p style={{ margin: "3px 0 0", fontSize: "12.5px", color: "#64748b" }}>
            Manage registered candidates, college allocations, and student authentication credentials
          </p>
        </div>

        {/* Action Buttons */}
        <div className="admin-page-actions" style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
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
            <FileText size={15} color="#017846" /> Add document
          </button>

          <button 
            type="button" 
            className="admin-btn primary" 
            onClick={() => setIsNewModalOpen(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "8px 16px", borderRadius: "8px", background: "linear-gradient(135deg, #017846, #01663C)", color: "#ffffff", border: "none", fontSize: "12.5px", fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(1, 120, 70, 0.25)" }}
          >
            <PlusCircle size={15} /> Register Candidate
          </button>
        </div>
      </div>

      {/* Alert Notices */}
      {notice && (
        <div 
          style={{ 
            padding: "12px 16px", 
            background: notice.type === "error" ? "#fef2f2" : notice.type === "info" ? "#eff6ff" : "#f0fdf4", 
            border: `1px solid ${notice.type === "error" ? "#fecaca" : notice.type === "info" ? "#bfdbfe" : "#bbf7d0"}`, 
            color: notice.type === "error" ? "#991b1b" : notice.type === "info" ? "#1e40af" : "#166534", 
            borderRadius: "10px", 
            fontSize: "13px", 
            marginBottom: "16px", 
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "center" 
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {notice.type === "error" ? <AlertCircle size={16} /> : notice.type === "info" ? <Info size={16} /> : <CheckCircle2 size={16} />}
            <span>{notice.text}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, color: "inherit" }}>✕</button>
        </div>
      )}

      {/* Roster Overview Banner */}
      <div
        style={{
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: "12px",
          padding: "12px 18px",
          marginBottom: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 800,
              padding: "3px 8px",
              borderRadius: "6px",
              background: "#017846",
              color: "#ffffff",
              letterSpacing: "0.5px"
            }}
          >
            EXAMINATION ROSTER
          </span>
          <span style={{ fontSize: "12.5px", color: "#166534", fontWeight: 500 }}>
            Candidates authenticate securely using their Full Name, College Name, and Email Address.
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "12px", color: "#64748b" }}>
            Total Registered Candidates: <strong>{candidates.length}</strong>
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-search-row">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search candidates by name, SL. No, or email..."
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
                <th>SL. No</th>
                <th>Candidate Name</th>
                <th>Email Address</th>
                <th>College Name</th>
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
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "14px", color: "#1e293b" }}>
                      No candidates match your criteria
                    </p>
                    <small style={{ color: "#64748b", display: "block", marginTop: "4px" }}>
                      Register a candidate or use "Add document" to load student rosters.
                    </small>
                  </td>
                </tr>
              ) : (
                filtered.map((cand, index) => {
                  return (
                    <tr key={cand.id}>
                      <td>
                        <b style={{ color: "#017846", fontFamily: "JetBrains Mono, monospace", fontSize: "13px" }}>
                          {index + 1}
                        </b>
                      </td>
                      <td style={{ fontWeight: 600 }}>{cand.fullName}</td>
                      <td>
                        <small style={{ color: "#64748b" }}>{cand.email}</small>
                      </td>
                      <td>
                        {cand.departmentName ? (
                          <span 
                            className="admin-dept-chip"
                            style={{
                              background: "#eef2ff",
                              color: "#3730a3",
                              border: "1px solid #c7d2fe",
                              fontWeight: 600,
                              fontSize: "12px",
                              padding: "4px 10px",
                              borderRadius: "6px"
                            }}
                          >
                            {cand.departmentName}
                          </span>
                        ) : (
                          <span style={{ fontSize: "11px", color: "#94a3b8" }}>—</span>
                        )}
                      </td>
                      <td>
                        <span className={`status-pill ${cand.status.toLowerCase()}`}>
                          {cand.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
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
                <label style={{ fontSize: "12px", fontWeight: 600 }}>Full Name *</label>
                <input type="text" placeholder="e.g. Aarav Sharma" value={newName} onChange={e => setNewName(e.target.value)} required style={{ width: "100%", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "6px" }} />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600 }}>Email Address *</label>
                <input type="email" placeholder="e.g. aarav@campus.edu" value={newEmail} onChange={e => setNewEmail(e.target.value)} required style={{ width: "100%", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "6px" }} />
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600 }}>College Name *</label>
                <select value={newDeptId || ""} onChange={e => setNewDeptId(e.target.value ? Number(e.target.value) : undefined)} required style={{ width: "100%", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "6px" }}>
                  <option value="">-- Select College Name --</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
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

      {/* Add Document Modal */}
      {isCsvModalOpen && (
        <div className="admin-modal-backdrop" onClick={() => setIsCsvModalOpen(false)}>
          <div className="admin-modal-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ margin: 0, fontSize: "16px" }}>Add Document</h3>
              <button type="button" onClick={() => setIsCsvModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>✕</button>
            </div>
            <p style={{ fontSize: "12px", color: "#334155", margin: "0 0 6px 0", fontWeight: 600 }}>
              Supported Formats: PDF, DOCS, Word (.doc, .docx), Spreadsheets (.xlsx, .xls, .csv)
            </p>
            <p style={{ fontSize: "11.5px", color: "#64748b", margin: "0 0 14px 0" }}>
              Expected columns: <code>SL.No / RegNumber, FullName, Email, [CollegeCode]</code>
            </p>
            <input 
              type="file" 
              accept=".pdf,.doc,.docx,.xlsx,.xls,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              onChange={e => setCsvFile(e.target.files ? e.target.files[0] : null)}
              style={{ fontSize: "12px", marginBottom: "16px", width: "100%" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button type="button" className="secondary" onClick={() => setIsCsvModalOpen(false)}>Cancel</button>
              <button 
                type="button" 
                className="primary" 
                disabled={!csvFile || uploadingCsv}
                onClick={handleUploadCsv}
              >
                {uploadingCsv ? "Uploading..." : "Upload Document"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
