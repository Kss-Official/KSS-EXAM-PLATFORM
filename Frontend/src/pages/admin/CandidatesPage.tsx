import { useState, useEffect, useCallback, useRef } from "react";
import { 
  Search, 
  FileText,
  PlusCircle,
  RotateCcw,
  UserCheck,
  Users,
  CheckCircle2,
  AlertCircle,
  Info,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  Building2,
  GraduationCap,
  Clock
} from "lucide-react";
import { 
  getCandidates,
  createCandidate, 
  uploadCandidatesCsv, 
  getAllDepartments,
  getColleges,
  assignCandidateBatch,
  type CandidateDto, 
  type DepartmentDto,
  type CollegeDto 
} from "../../services/api";

const PAGE_SIZE = 30;

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<CandidateDto[]>([]);
  const [totalCandidates, setTotalCandidates] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [batchFilter, setBatchFilter] = useState<string>("ALL");
  const [collegeFilter, setCollegeFilter] = useState<number | undefined>(undefined);
  const [departmentFilter, setDepartmentFilter] = useState<number | undefined>(undefined);
  const [sortBy, setSortBy] = useState<string>("registration_number");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Distinct Lists from separate Colleges and Departments tables
  const [colleges, setColleges] = useState<CollegeDto[]>([]);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [notice, setNotice] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // New Candidate Modal
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newRegNum, setNewRegNum] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newBatch, setNewBatch] = useState("Slot 1");
  const [newCollegeId, setNewCollegeId] = useState<number | undefined>(undefined);
  const [newDeptId, setNewDeptId] = useState<number | undefined>(undefined);

  // CSV Import Modal
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [uploadingCsv, setUploadingCsv] = useState(false);

  // IntersectionObserver sentinel for progressive infinite scrolling
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Fetch both Colleges and Academic Departments from their separate tables
  useEffect(() => {
    try {
      localStorage.removeItem("examsecure_cached_candidates_v2");
    } catch {
      // ignore
    }
    getColleges().then(setColleges).catch(() => {});
    getAllDepartments({ type: "academic" }).then(setDepartments).catch(() => {});
  }, []);

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch initial screen (Page 1) whenever filters, debounced search, or sort parameters change
  const fetchPage1 = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getCandidates({
        page: 1,
        limit: PAGE_SIZE,
        search: debouncedSearch,
        collegeId: collegeFilter,
        departmentId: departmentFilter,
        batch: batchFilter !== "ALL" ? batchFilter : undefined,
        status: statusFilter,
        sortBy,
        sortOrder
      });
      setCandidates(res.items);
      setTotalCandidates(res.total);
      setPage(1);
      setHasMore(res.hasMore);
    } catch (e: unknown) {
      const errorObj = e as Error;
      console.warn("[CandidatesPage] Server fetch failed:", errorObj.message);
      setNotice({
        text: `Failed to fetch candidate records: ${errorObj.message}`,
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, collegeFilter, departmentFilter, batchFilter, statusFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchPage1();
  }, [fetchPage1]);

  // Progressively fetch next page as the user scrolls towards the bottom
  const loadMoreCandidates = useCallback(async () => {
    if (loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const nextPage = page + 1;
    try {
      const res = await getCandidates({
        page: nextPage,
        limit: PAGE_SIZE,
        search: debouncedSearch,
        collegeId: collegeFilter,
        departmentId: departmentFilter,
        batch: batchFilter !== "ALL" ? batchFilter : undefined,
        status: statusFilter,
        sortBy,
        sortOrder
      });
      setCandidates(prev => {
        const existingIds = new Set(prev.map(c => c.id));
        const newRecords = res.items.filter(c => !existingIds.has(c.id));
        return [...prev, ...newRecords];
      });
      setTotalCandidates(res.total);
      setPage(nextPage);
      setHasMore(res.hasMore);
    } catch (e: unknown) {
      const errorObj = e as Error;
      console.warn("[CandidatesPage] Progressive fetch error:", errorObj.message);
    } finally {
      setLoadingMore(false);
    }
  }, [loading, loadingMore, hasMore, page, debouncedSearch, collegeFilter, departmentFilter, batchFilter, statusFilter, sortBy, sortOrder]);

  // Attach IntersectionObserver to sentinel element for infinite scrolling
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
          loadMoreCandidates();
        }
      },
      {
        root: null,
        rootMargin: "250px", // Trigger fetch 250px before bottom is reached for seamless scrolling
        threshold: 0.1
      }
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [hasMore, loading, loadingMore, loadMoreCandidates]);

  // Format status badge
  const formatStatus = (rawStatus?: string) => {
    const s = (rawStatus || "").toUpperCase().replace(/_/g, " ");
    if (s === "COMPLETED" || s === "SUBMITTED") return "COMPLETED";
    if (s === "GOING ON" || s === "IN PROGRESS") return "GOING ON";
    if (s === "PENDING" || s === "ASSIGNED" || s === "NOT ATTEMPTED" || s === "ACTIVE") return "PENDING";
    if (s === "DISABLED") return "DISABLED";
    return s || "PENDING";
  };

  const getStatusClass = (rawStatus?: string) => {
    const s = formatStatus(rawStatus);
    if (s === "COMPLETED") return "completed";
    if (s === "GOING ON") return "going_on";
    if (s === "PENDING") return "pending";
    if (s === "DISABLED") return "disabled";
    return "pending";
  };

  // Toggle sorting
  const handleSort = (colKey: string) => {
    if (sortBy === colKey) {
      setSortOrder(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(colKey);
      setSortOrder("asc");
    }
  };

  const renderSortIndicator = (colKey: string) => {
    if (sortBy !== colKey) {
      return <ArrowUpDown size={12} color="#94a3b8" style={{ marginLeft: "4px", opacity: 0.6 }} />;
    }
    return sortOrder === "asc" ? (
      <ArrowUp size={12} color="#017846" style={{ marginLeft: "4px" }} />
    ) : (
      <ArrowDown size={12} color="#017846" style={{ marginLeft: "4px" }} />
    );
  };

  // Slot / Batch quick assignment
  const handleAssignSlot = async (candidateId: number, slot: string) => {
    try {
      await assignCandidateBatch(candidateId, slot);
      setCandidates(prev => prev.map(c => c.id === candidateId ? { ...c, batch: slot } : c));
      setNotice({ text: `Slot updated to ${slot || "Unassigned"} for candidate.`, type: "success" });
    } catch (err: unknown) {
      const errorObj = err as Error;
      setNotice({ text: "Failed to update slot: " + errorObj.message, type: "error" });
    }
  };

  // Handle manual candidate creation
  const handleCreateCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newEmail.trim()) {
      setNotice({ text: "Full Name and Email are required.", type: "error" });
      return;
    }

    const regUpper = newRegNum.trim() ? newRegNum.trim().toUpperCase() : `CAND-${Date.now().toString().slice(-6)}`;

    try {
      const created = await createCandidate({
        registrationNumber: regUpper,
        fullName: newName.trim(),
        email: newEmail.trim().toLowerCase(),
        batch: newBatch || undefined,
        collegeId: newCollegeId,
        departmentId: newDeptId
      });

      setCandidates(prev => [created, ...prev]);
      setTotalCandidates(prev => prev + 1);
      setNotice({
        text: `Candidate ${created.fullName} (${created.registrationNumber}) registered successfully in PostgreSQL under ${newBatch || "Unassigned"}.`,
        type: "success"
      });
    } catch (err: unknown) {
      const errorObj = err as Error;
      setNotice({ text: "Candidate registration failed: " + errorObj.message, type: "error" });
    } finally {
      setIsNewModalOpen(false);
      setNewRegNum("");
      setNewName("");
      setNewEmail("");
      setNewBatch("Slot 1");
      setNewCollegeId(undefined);
      setNewDeptId(undefined);
    }
  };

  // Batch CSV Upload
  const handleUploadCsv = async () => {
    if (!csvFile) return;
    setUploadingCsv(true);
    try {
      const res = await uploadCandidatesCsv(csvFile);
      setNotice({
        text: `Roster processed successfully. Imported ${res.totalImported} candidates.`,
        type: "success"
      });
      setIsCsvModalOpen(false);
      setCsvFile(null);
      fetchPage1();
    } catch (e: unknown) {
      const errorObj = e as Error;
      setNotice({ text: "Failed to upload roster document: " + errorObj.message, type: "error" });
    } finally {
      setUploadingCsv(false);
    }
  };

  return (
    <div className="admin-page">
      <style>{`
        @keyframes shimmerPulse {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .skeleton-cell {
          background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%);
          background-size: 200% 100%;
          animation: shimmerPulse 1.5s infinite;
          border-radius: 4px;
          height: 16px;
        }
        .sortable-th {
          cursor: pointer;
          user-select: none;
          transition: background-color 0.15s ease;
        }
        .sortable-th:hover {
          background-color: #f1f5f9;
        }
      `}</style>

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
            Manage registered candidates, college affiliations, and academic department specializations
          </p>
        </div>

        <div className="header-actions">
          <button 
            type="button" 
            className="secondary" 
            onClick={() => {
              setSearchTerm("");
              setDebouncedSearch("");
              setStatusFilter("ALL");
              setBatchFilter("ALL");
              setCollegeFilter(undefined);
              setDepartmentFilter(undefined);
              fetchPage1();
            }}
            title="Reset Filters & Refresh Records"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <RotateCcw size={14} /> Refresh
          </button>
          <button 
            type="button" 
            className="secondary" 
            onClick={() => setIsCsvModalOpen(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <FileText size={15} color="#017846" /> Add Document
          </button>
          <button 
            type="button" 
            className="primary" 
            onClick={() => setIsNewModalOpen(true)}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
          >
            <PlusCircle size={15} /> Add Candidate
          </button>
        </div>
      </div>

      {notice && (
        <div className={`admin-notice ${notice.type}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {notice.type === "success" && <CheckCircle2 size={16} />}
            {notice.type === "error" && <AlertCircle size={16} />}
            {notice.type === "info" && <Info size={16} />}
            <span>{notice.text}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", fontWeight: 700 }}>✕</button>
        </div>
      )}

      {/* KPI Cards Row with Slot Highlights */}
      <div className="candidate-kpi-grid">
        <div 
          className="kpi-mini-card" 
          style={{ cursor: "pointer", border: batchFilter === "ALL" ? "2px solid #017846" : undefined }}
          onClick={() => setBatchFilter("ALL")}
          title="Click to view all candidates"
        >
          <span className="kpi-mini-label">Total Registered</span>
          <span className="kpi-mini-value" style={{ color: "#017846" }}>{totalCandidates}</span>
        </div>
        <div 
          className="kpi-mini-card" 
          style={{ cursor: "pointer", border: batchFilter === "Slot 1" ? "2px solid #0284c7" : undefined }}
          onClick={() => setBatchFilter(prev => prev === "Slot 1" ? "ALL" : "Slot 1")}
          title="Click to filter Slot 1 (10:00 AM)"
        >
          <span className="kpi-mini-label" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <Clock size={13} color="#0284c7" /> Slot 1 (10:00 AM)
          </span>
          <span className="kpi-mini-value" style={{ color: "#0284c7" }}>
            {candidates.filter(c => c.batch === "Slot 1").length} <small style={{ fontSize: "11px", color: "#64748b" }}>loaded</small>
          </span>
        </div>
        <div 
          className="kpi-mini-card" 
          style={{ cursor: "pointer", border: batchFilter === "Slot 2" ? "2px solid #7c3aed" : undefined }}
          onClick={() => setBatchFilter(prev => prev === "Slot 2" ? "ALL" : "Slot 2")}
          title="Click to filter Slot 2 (2:00 PM)"
        >
          <span className="kpi-mini-label" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <Clock size={13} color="#7c3aed" /> Slot 2 (2:00 PM)
          </span>
          <span className="kpi-mini-value" style={{ color: "#7c3aed" }}>
            {candidates.filter(c => c.batch === "Slot 2").length} <small style={{ fontSize: "11px", color: "#64748b" }}>loaded</small>
          </span>
        </div>
        <div className="kpi-mini-card">
          <span className="kpi-mini-label">Affiliated Colleges</span>
          <span className="kpi-mini-value" style={{ color: "#2563eb" }}>{colleges.length}</span>
        </div>
        <div className="kpi-mini-card">
          <span className="kpi-mini-label">Academic Departments</span>
          <span className="kpi-mini-value" style={{ color: "#059669" }}>{departments.length}</span>
        </div>
        <div className="kpi-mini-card">
          <span className="kpi-mini-label">Records Visible</span>
          <span className="kpi-mini-value" style={{ color: "#0f172a" }}>{candidates.length}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="filter-search-row" style={{ flexWrap: "wrap", gap: "10px" }}>
        <div className="search-input-wrapper" style={{ flex: "1 1 240px" }}>
          <Search size={16} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search candidates by name, SL. No / Register No., email, or college..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Batch / Slot Filter Dropdown */}
        <div style={{ minWidth: "190px" }}>
          <select
            value={batchFilter}
            onChange={e => setBatchFilter(e.target.value)}
            style={{ 
              width: "100%", 
              padding: "8px 12px", 
              borderRadius: "8px", 
              border: batchFilter !== "ALL" ? "2px solid #0284c7" : "1px solid #cbd5e1", 
              fontSize: "13px", 
              height: "40px",
              fontWeight: 600,
              backgroundColor: batchFilter === "Slot 1" ? "#f0f9ff" : batchFilter === "Slot 2" ? "#faf5ff" : "#fff",
              color: batchFilter === "Slot 1" ? "#0284c7" : batchFilter === "Slot 2" ? "#7c3aed" : "#334155"
            }}
          >
            <option value="ALL">🕒 All Exam Slots / Batches</option>
            <option value="Slot 1">🕒 Slot 1 (10:00 AM - 10:30 AM Entry)</option>
            <option value="Slot 2">🕒 Slot 2 (2:00 PM - 2:30 PM Entry)</option>
          </select>
        </div>

        {/* College Filter Dropdown */}
        <div style={{ minWidth: "180px" }}>
          <select
            value={collegeFilter ?? ""}
            onChange={e => setCollegeFilter(e.target.value ? Number(e.target.value) : undefined)}
            style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", height: "40px" }}
          >
            <option value="">🏫 All Colleges ({colleges.length})</option>
            {colleges.map(c => (
              <option key={c.id} value={c.id}>{c.code ? `[${c.code}] ` : ""}{c.name}</option>
            ))}
          </select>
        </div>

        {/* Academic Department Filter Dropdown */}
        <div style={{ minWidth: "180px" }}>
          <select
            value={departmentFilter ?? ""}
            onChange={e => setDepartmentFilter(e.target.value ? Number(e.target.value) : undefined)}
            style={{ width: "100%", padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", height: "40px" }}
          >
            <option value="">🎓 All Departments ({departments.length})</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.code ? `[${d.code}] ` : ""}{d.name}</option>
            ))}
          </select>
        </div>

        <div className="status-filter-pills">
          {["ALL", "COMPLETED", "GOING ON", "PENDING"].map(st => (
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
                <th 
                  className="sortable-th"
                  onClick={() => handleSort("registration_number")}
                  title="Sort by SL. No / Register Number"
                  style={{ width: "120px" }}
                >
                  <div style={{ display: "inline-flex", alignItems: "center" }}>
                    SL. No / Reg No.
                    {renderSortIndicator("registration_number")}
                  </div>
                </th>
                <th 
                  className="sortable-th"
                  onClick={() => handleSort("full_name")}
                  title="Sort by Candidate Name"
                >
                  <div style={{ display: "inline-flex", alignItems: "center" }}>
                    Candidate Name
                    {renderSortIndicator("full_name")}
                  </div>
                </th>
                <th 
                  className="sortable-th"
                  onClick={() => handleSort("email")}
                  title="Sort by Email Address"
                >
                  <div style={{ display: "inline-flex", alignItems: "center" }}>
                    Email Address
                    {renderSortIndicator("email")}
                  </div>
                </th>
                <th 
                  className="sortable-th"
                  onClick={() => handleSort("college")}
                  title="Sort by College Name"
                >
                  <div style={{ display: "inline-flex", alignItems: "center" }}>
                    Affiliated College
                    {renderSortIndicator("college")}
                  </div>
                </th>
                <th 
                  className="sortable-th"
                  onClick={() => handleSort("department")}
                  title="Sort by Academic Department"
                >
                  <div style={{ display: "inline-flex", alignItems: "center" }}>
                    Department Track
                    {renderSortIndicator("department")}
                  </div>
                </th>
                <th 
                  className="sortable-th"
                  onClick={() => handleSort("batch")}
                  title="Sort by Exam Slot / Batch"
                  style={{ width: "170px" }}
                >
                  <div style={{ display: "inline-flex", alignItems: "center" }}>
                    Exam Slot / Batch
                    {renderSortIndicator("batch")}
                  </div>
                </th>
                <th>Account Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                // Shimmer Skeleton Rows for initial screen
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={`skel-${idx}`}>
                    <td style={{ width: "120px" }}><div className="skeleton-cell" style={{ width: "80px" }} /></td>
                    <td><div className="skeleton-cell" style={{ width: "160px" }} /></td>
                    <td><div className="skeleton-cell" style={{ width: "200px" }} /></td>
                    <td><div className="skeleton-cell" style={{ width: "140px" }} /></td>
                    <td><div className="skeleton-cell" style={{ width: "120px" }} /></td>
                    <td style={{ width: "170px" }}><div className="skeleton-cell" style={{ width: "130px" }} /></td>
                    <td style={{ width: "120px" }}><div className="skeleton-cell" style={{ width: "90px" }} /></td>
                  </tr>
                ))
              ) : candidates.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "50px 20px", color: "#64748b" }}>
                    <UserCheck size={36} color="#cbd5e1" style={{ margin: "0 auto 10px" }} />
                    <p style={{ margin: 0, fontWeight: 700, fontSize: "14px", color: "#1e293b" }}>
                      No candidates match your criteria
                    </p>
                    <small style={{ color: "#64748b", display: "block", marginTop: "4px" }}>
                      Try adjusting your search query, batch, college, or department filters.
                    </small>
                  </td>
                </tr>
              ) : (
                candidates.map((cand, index) => {
                  return (
                    <tr key={cand.id}>
                      <td>
                        <b style={{ color: "#017846", fontFamily: "JetBrains Mono, monospace", fontSize: "13px" }}>
                          {cand.registrationNumber || index + 1}
                        </b>
                      </td>
                      <td style={{ fontWeight: 600 }}>{cand.fullName}</td>
                      <td>
                        <small style={{ color: "#64748b" }}>{cand.email}</small>
                      </td>
                      <td>
                        {cand.collegeName ? (
                          <span 
                            className="admin-dept-chip"
                            style={{
                              background: "#eff6ff",
                              color: "#1d4ed8",
                              border: "1px solid #bfdbfe",
                              fontWeight: 600,
                              fontSize: "12px",
                              padding: "4px 8px",
                              borderRadius: "6px"
                            }}
                          >
                            {cand.collegeName}
                          </span>
                        ) : (
                          <span style={{ fontSize: "11px", color: "#94a3b8" }}>—</span>
                        )}
                      </td>
                      <td>
                        {cand.departmentName ? (
                          <span 
                            className="admin-dept-chip"
                            style={{
                              background: "#f5f3ff",
                              color: "#6d28d9",
                              border: "1px solid #ddd6fe",
                              fontWeight: 600,
                              fontSize: "12px",
                              padding: "4px 8px",
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
                        <select
                          value={cand.batch || ""}
                          onChange={(e) => handleAssignSlot(cand.id, e.target.value)}
                          title="Change candidate's scheduled slot"
                          style={{
                            padding: "4px 8px",
                            borderRadius: "6px",
                            fontSize: "12px",
                            fontWeight: 600,
                            cursor: "pointer",
                            outline: "none",
                            border: cand.batch === "Slot 1" 
                              ? "1px solid #7dd3fc" 
                              : cand.batch === "Slot 2" 
                                ? "1px solid #d8b4fe" 
                                : "1px solid #cbd5e1",
                            backgroundColor: cand.batch === "Slot 1" 
                              ? "#f0f9ff" 
                              : cand.batch === "Slot 2" 
                                ? "#faf5ff" 
                                : "#ffffff",
                            color: cand.batch === "Slot 1" 
                              ? "#0369a1" 
                              : cand.batch === "Slot 2" 
                                ? "#6b21a8" 
                                : "#64748b"
                          }}
                        >
                          <option value="">Unassigned</option>
                          <option value="Slot 1">🕒 Slot 1 (10:00 AM)</option>
                          <option value="Slot 2">🕒 Slot 2 (2:00 PM)</option>
                        </select>
                      </td>
                      <td>
                        <span className={`status-pill ${getStatusClass(cand.status)}`}>
                          {formatStatus(cand.status)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Progressive Loading Indicator & Sentinel */}
        <div ref={sentinelRef} style={{ minHeight: "10px" }}>
          {loadingMore && (
            <div 
              style={{ 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                gap: "8px", 
                padding: "16px", 
                color: "#017846", 
                fontSize: "13px", 
                fontWeight: 600,
                background: "#f8fafc",
                borderTop: "1px solid #e2e8f0"
              }}
            >
              <Loader2 size={16} className="animate-spin" />
              <span>Loading more candidates...</span>
            </div>
          )}

          {!hasMore && !loading && candidates.length > 0 && (
            <div 
              style={{ 
                textAlign: "center", 
                padding: "12px", 
                color: "#64748b", 
                fontSize: "12px", 
                background: "#f8fafc",
                borderTop: "1px solid #f1f5f9"
              }}
            >
              ✓ All {totalCandidates} candidate records loaded
            </div>
          )}
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
                <label style={{ fontSize: "12px", fontWeight: 600 }}>Register No. / SL. No. *</label>
                <input type="text" placeholder="e.g. 1, 2, ... or REG-101" value={newRegNum} onChange={e => setNewRegNum(e.target.value)} required style={{ width: "100%", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "6px" }} />
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
                <label style={{ fontSize: "12px", fontWeight: 600 }}>Affiliated College *</label>
                <select value={newCollegeId || ""} onChange={e => setNewCollegeId(e.target.value ? Number(e.target.value) : undefined)} required style={{ width: "100%", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "6px" }}>
                  <option value="">-- Select College --</option>
                  {colleges.map(c => (
                    <option key={c.id} value={c.id}>{c.code ? `[${c.code}] ` : ""}{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600 }}>Academic Department / Specialization Track</label>
                <select value={newDeptId || ""} onChange={e => setNewDeptId(e.target.value ? Number(e.target.value) : undefined)} style={{ width: "100%", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "6px" }}>
                  <option value="">-- Select Department Track (Optional) --</option>
                  {departments.map(d => (
                    <option key={d.id} value={d.id}>{d.code ? `[${d.code}] ` : ""}{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: "12px", fontWeight: 600 }}>Exam Slot / Batch *</label>
                <select 
                  value={newBatch} 
                  onChange={e => setNewBatch(e.target.value)} 
                  required 
                  style={{ width: "100%", padding: "8px", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                >
                  <option value="Slot 1">🕒 Slot 1 (10:00 AM - 10:30 AM Entry Cutoff)</option>
                  <option value="Slot 2">🕒 Slot 2 (2:00 PM - 2:30 PM Entry Cutoff)</option>
                  <option value="">Unassigned</option>
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
