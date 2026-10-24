import { useState, useEffect, useMemo } from "react";
import { 
  Search, 
  FileSpreadsheet, 
  PlusCircle,
  RotateCcw,
  UserCheck,
  Users,
  KeyRound,
  CheckSquare,
  Code2,
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
import {
  type ExamRound,
  type RoundIdStore,
  getRoundIdsStore,
  filterCandidatesByRound,
  generateRoundUniqueIds,
  FALLBACK_SEED_CANDIDATES
} from "../../services/candidateRoundIdService";

const LOCAL_STORAGE_CANDIDATES_KEY = "examsecure_cached_candidates_v1";

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<CandidateDto[]>([]);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [notice, setNotice] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // Active Assessment Round Tab (Round 1: MCQ | Round 2: Coding)
  const [selectedRound, setSelectedRound] = useState<ExamRound>("ROUND_1");

  // Round IDs Store ({ round1: { [reg]: id }, round2: { [reg]: id } })
  const [roundIdsStore, setRoundIdsStore] = useState<RoundIdStore>(getRoundIdsStore);

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

  // Save candidates to local cache for resilience against backend 500 errors
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
    return FALLBACK_SEED_CANDIDATES;
  };

  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const data = await getAllCandidates();
      if (data && data.length > 0) {
        setCandidates(data);
        cacheCandidatesLocally(data);
      } else {
        // If backend returned empty list, check cached or fallback candidates
        const cached = getCachedCandidates();
        setCandidates(cached);
      }
    } catch (e: unknown) {
      const errorObj = e as Error;
      console.warn("[CandidatesPage] Backend fetch failed:", errorObj.message);
      // Fallback gracefully so the admin can test round selection & unique ID generation
      const cached = getCachedCandidates();
      setCandidates(cached);
      setNotice({
        text: `Backend error (500 proxy). Loaded ${cached.length} candidates from local directory.`,
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

  // Filter candidates strictly for the selected round
  const roundEligibleCandidates = useMemo(() => {
    return filterCandidatesByRound(candidates, selectedRound);
  }, [candidates, selectedRound]);

  // Total eligible counts for both rounds
  const round1EligibleCount = useMemo(() => {
    return filterCandidatesByRound(candidates, "ROUND_1").length;
  }, [candidates]);

  const round2EligibleCount = useMemo(() => {
    return filterCandidatesByRound(candidates, "ROUND_2").length;
  }, [candidates]);

  // Filter by search term and status within the eligible round candidates
  const filtered = useMemo(() => {
    return roundEligibleCandidates.filter(c => {
      const matchesSearch = 
        c.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.registrationNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.departmentName && c.departmentName.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = statusFilter === "ALL" || c.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [roundEligibleCandidates, searchTerm, statusFilter]);

  // Count how many candidates in current round already have generated IDs
  const generatedCountInCurrentRound = useMemo(() => {
    const targetMap = selectedRound === "ROUND_1" ? roundIdsStore.round1 : roundIdsStore.round2;
    return roundEligibleCandidates.filter(c => !!targetMap[c.registrationNumber.trim().toUpperCase()]).length;
  }, [roundEligibleCandidates, roundIdsStore, selectedRound]);

  // Handler: Generate Unique IDs for the selected round
  const handleGenerateUniqueIds = () => {
    if (roundEligibleCandidates.length === 0) {
      setNotice({
        text: `No eligible candidates found for ${selectedRound === "ROUND_1" ? "Round 1 (MCQ)" : "Round 2 (Coding)"}.`,
        type: "info"
      });
      return;
    }

    const result = generateRoundUniqueIds(candidates, selectedRound);
    setRoundIdsStore(result.store);

    if (result.newlyGenerated > 0) {
      setNotice({
        text: `Generated ${result.newlyGenerated} new Unique IDs for ${selectedRound === "ROUND_1" ? "Round 1 (MCQ)" : "Round 2 (Coding)"} assessment (${result.totalEligible} total eligible).`,
        type: "success"
      });
    } else {
      setNotice({
        text: `All ${result.totalEligible} eligible candidates in ${selectedRound === "ROUND_1" ? "Round 1" : "Round 2"} already have unique IDs assigned.`,
        type: "info"
      });
    }
  };

  const handleCreateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRegNum.trim() || !newName.trim() || !newEmail.trim()) {
      setNotice({ text: "Registration Number, Full Name, and Email are required.", type: "error" });
      return;
    }

    const regUpper = newRegNum.trim().toUpperCase();
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
      setNotice({ text: `Candidate ${created.fullName} (${created.registrationNumber}) created successfully.`, type: "success" });
    } catch {
      // Backend failed, save locally
      const updatedList = [localNewCand, ...candidates];
      setCandidates(updatedList);
      cacheCandidatesLocally(updatedList);
      setNotice({ text: `Candidate ${localNewCand.fullName} registered locally.`, type: "success" });
    }

    setIsNewModalOpen(false);
    setNewRegNum("");
    setNewName("");
    setNewEmail("");
  };

  const handleUploadCsv = async () => {
    if (!csvFile) return;
    setUploadingCsv(true);
    try {
      const res = await uploadCandidatesCsv(csvFile);
      setNotice({ text: `Batch import complete: ${res.totalImported} candidates inserted.`, type: "success" });
      setIsCsvModalOpen(false);
      setCsvFile(null);
      fetchCandidates();
    } catch (err: unknown) {
      const errorObj = err as Error;
      setNotice({ text: "Batch CSV upload failed: " + errorObj.message, type: "error" });
    } finally {
      setUploadingCsv(false);
    }
  };

  return (
    <div className="admin-page-container">
      {/* Top Page Header */}
      <div className="admin-page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Users size={18} color="#017846" />
            <strong style={{ fontSize: "15px", color: "#0f172a", fontFamily: "Plus Jakarta Sans, sans-serif" }}>
              Registered Candidates Roster
            </strong>
          </div>
          <p style={{ margin: "3px 0 0", fontSize: "12.5px", color: "#64748b" }}>
            Manage student registrations, department eligibility tracks, and round-specific unique ID generation
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
            <FileSpreadsheet size={15} color="#059669" /> Batch CSV Import
          </button>

          {/* Create Unique ID Action Button */}
          <button 
            type="button" 
            className="admin-btn primary" 
            onClick={handleGenerateUniqueIds}
            style={{ 
              display: "inline-flex", 
              alignItems: "center", 
              gap: "6px", 
              padding: "8px 16px", 
              borderRadius: "8px", 
              background: selectedRound === "ROUND_1" ? "linear-gradient(135deg, #017846, #01663C)" : "linear-gradient(135deg, #0284c7, #0369a1)", 
              color: "#ffffff", 
              border: "none", 
              fontSize: "12.5px", 
              fontWeight: 700, 
              cursor: "pointer", 
              boxShadow: selectedRound === "ROUND_1" ? "0 2px 8px rgba(1, 120, 70, 0.25)" : "0 2px 8px rgba(2, 132, 199, 0.25)",
              transition: "all 0.15s ease"
            }}
            title={`Generate unique candidate IDs for all eligible candidates in ${selectedRound === "ROUND_1" ? "Round 1 (MCQ)" : "Round 2 (Coding)"}`}
          >
            <KeyRound size={15} />
            <span>Create Unique ID</span>
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
          <button type="button" onClick={() => setNotice(null)} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, color: "inherit" }}>Γ£ò</button>
        </div>
      )}

      {/* ========================================================
          ROUND SELECTION TABS (ROUND 1 MCQ vs ROUND 2 CODING)
          ======================================================== */}
      <div className="candidate-round-tabs">
        <button
          type="button"
          className={`candidate-round-tab ${selectedRound === "ROUND_1" ? "active" : ""}`}
          onClick={() => setSelectedRound("ROUND_1")}
        >
          <CheckSquare size={16} />
          <span>Round 1 ΓÇö MCQ Assessment</span>
          <span className="candidate-round-count">{round1EligibleCount}</span>
        </button>

        <button
          type="button"
          className={`candidate-round-tab round2 ${selectedRound === "ROUND_2" ? "active round2" : ""}`}
          onClick={() => setSelectedRound("ROUND_2")}
        >
          <Code2 size={16} />
          <span>Round 2 ΓÇö Coding Assessment</span>
          <span className="candidate-round-count">{round2EligibleCount}</span>
        </button>
      </div>

      {/* Round Overview & Unique ID Status Banner */}
      <div
        style={{
          background: selectedRound === "ROUND_1" ? "#f0fdf4" : "#eff6ff",
          border: `1px solid ${selectedRound === "ROUND_1" ? "#bbf7d0" : "#bfdbfe"}`,
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
              background: selectedRound === "ROUND_1" ? "#017846" : "#0284c7",
              color: "#ffffff",
              letterSpacing: "0.5px"
            }}
          >
            {selectedRound === "ROUND_1" ? "ROUND 1 ROSTER" : "ROUND 2 ROSTER"}
          </span>
          <span style={{ fontSize: "12.5px", color: selectedRound === "ROUND_1" ? "#166534" : "#1e40af", fontWeight: 500 }}>
            {selectedRound === "ROUND_1" 
              ? "Showing all candidates eligible for multiple-choice assessment across all departments."
              : "Showing candidates from technical departments eligible for hands-on coding assessment (Developer, Tester, CSE, IT, ECE, EEE)."
            }
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "12px", color: "#64748b" }}>
            Unique IDs: <strong>{generatedCountInCurrentRound}</strong> / {roundEligibleCandidates.length} generated
          </span>
          {generatedCountInCurrentRound === roundEligibleCandidates.length && roundEligibleCandidates.length > 0 ? (
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#166534", background: "#dcfce7", border: "1px solid #86efac", padding: "2px 8px", borderRadius: "999px" }}>
              Γ£ô All IDs Generated
            </span>
          ) : (
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#d97706", background: "#fef3c7", border: "1px solid #fde68a", padding: "2px 8px", borderRadius: "999px" }}>
              ΓùÅ Pending Generation ({roundEligibleCandidates.length - generatedCountInCurrentRound})
            </span>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-search-row">
        <div className="search-input-wrapper">
          <Search size={16} className="search-icon" />
          <input 
            type="text" 
            placeholder={`Search ${selectedRound === "ROUND_1" ? "Round 1" : "Round 2"} candidates by name, registration number, or email...`}
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
                <th>
                  {selectedRound === "ROUND_1" ? "Round 1 Unique ID" : "Round 2 Unique ID"}
                </th>
                <th>Assigned Department</th>
                <th>Account Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                    Loading candidate records from PostgreSQL...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "50px 20px", color: "#64748b" }}>
                    <UserCheck size={36} color="#cbd5e1" style={{ margin: "0 auto 10px" }} />
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "14px", color: "#1e293b" }}>
                      No {selectedRound === "ROUND_1" ? "Round 1" : "Round 2"} candidates match your criteria
                    </p>
                    <small style={{ color: "#64748b", display: "block", marginTop: "4px" }}>
                      {selectedRound === "ROUND_2"
                        ? "Only candidates from technical departments (e.g. Developer, Tester, CSE, IT) appear in Round 2."
                        : "Register a candidate or use Batch CSV Import to load student rosters."}
                    </small>
                  </td>
                </tr>
              ) : (
                filtered.map(cand => {
                  const regUpper = cand.registrationNumber.trim().toUpperCase();
                  const targetMap = selectedRound === "ROUND_1" ? roundIdsStore.round1 : roundIdsStore.round2;
                  const roundUniqueId = targetMap[regUpper];

                  return (
                    <tr key={cand.id}>
                      <td>
                        <b style={{ color: "#0f172a", fontFamily: "JetBrains Mono, monospace" }}>
                          {cand.registrationNumber}
                        </b>
                      </td>
                      <td style={{ fontWeight: 600 }}>{cand.fullName}</td>
                      <td>
                        <small style={{ color: "#64748b" }}>{cand.email}</small>
                      </td>
                      <td>
                        {/* Unique ID: displays only after generated */}
                        {roundUniqueId ? (
                          <span className={`candidate-id-badge ${selectedRound === "ROUND_1" ? "round1" : "round2"}`}>
                            {roundUniqueId}
                          </span>
                        ) : (
                          <span className="candidate-id-empty" title="Click 'Create Unique ID' above to generate">
                            ΓÇö Not Generated ΓÇö
                          </span>
                        )}
                      </td>
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
              <button type="button" onClick={() => setIsNewModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>Γ£ò</button>
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
              <button type="button" onClick={() => setIsCsvModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>Γ£ò</button>
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
