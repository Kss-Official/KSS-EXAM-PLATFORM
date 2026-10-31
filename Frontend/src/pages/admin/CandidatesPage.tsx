import { useState, useEffect, useCallback, useRef, useMemo } from "react";
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
  Clock,
  ArrowRight,
  CheckSquare,
  Square,
  Calendar
} from "lucide-react";
import { 
  getCandidates,
  createCandidate, 
  uploadCandidatesCsv, 
  getAllDepartments,
  getColleges,
  assignCandidateBatch,
  rescheduleCandidateSlot,
  batchRescheduleCandidateSlot,
  getAvailableCandidateDates,
  type CandidateDto, 
  type DepartmentDto,
  type CollegeDto 
} from "../../services/api";

const PAGE_SIZE = 30;

const getTodayIstString = (): string => {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
};

const getYesterdayIstString = (todayStr: string): string => {
  try {
    const [y, m, d] = todayStr.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - 1);
    return dt.toISOString().slice(0, 10);
  } catch {
    return "";
  }
};

const getTomorrowIstString = (todayStr: string): string => {
  try {
    const [y, m, d] = todayStr.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + 1);
    return dt.toISOString().slice(0, 10);
  } catch {
    return "";
  }
};

const formatDateShort = (dStr: string): string => {
  if (!dStr || dStr === "ALL") return "";
  try {
    const [y, m, d] = dStr.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
  } catch {
    return dStr;
  }
};

const formatDateYear = (dStr: string): string => {
  if (!dStr || dStr === "ALL") return "";
  try {
    return dStr.slice(0, 4);
  } catch {
    return "";
  }
};

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
  const todayIst = useMemo(() => getTodayIstString(), []);
  const yesterdayIst = useMemo(() => getYesterdayIstString(todayIst), [todayIst]);
  const tomorrowIst = useMemo(() => getTomorrowIstString(todayIst), [todayIst]);

  // Day-wise candidate filter state (defaults to today's date dynamically)
  const [selectedDate, setSelectedDate] = useState<string>(todayIst);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [customDatePicker, setCustomDatePicker] = useState<string>("");
  const [dateCounts, setDateCounts] = useState<{ [d: string]: number }>({});
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

  // Global Slot Counts for high-level statistics
  const [slotCounts, setSlotCounts] = useState<{ total: number; slot1: number; slot2: number }>({
    total: 842,
    slot1: 421,
    slot2: 421
  });

  // Multi-select state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Reschedule Confirmation Modal state
  const [rescheduleModal, setRescheduleModal] = useState<{
    isOpen: boolean;
    isBulk: boolean;
    candidate?: CandidateDto;
    targetSlot: string;
    resetAttempt: boolean;
    reason: string;
    loading: boolean;
  }>({
    isOpen: false,
    isBulk: false,
    targetSlot: "Slot 2",
    resetAttempt: true,
    reason: "",
    loading: false
  });

  const refreshSlotCounts = useCallback(async (activeDate: string = selectedDate) => {
    try {
      const dParam = activeDate !== "ALL" ? activeDate : undefined;
      const [allRes, s1Res, s2Res] = await Promise.all([
        getCandidates({ limit: 1, date: dParam }),
        getCandidates({ limit: 1, batch: "Slot 1", date: dParam }),
        getCandidates({ limit: 1, batch: "Slot 2", date: dParam })
      ]);
      setSlotCounts({
        total: allRes.total,
        slot1: s1Res.total,
        slot2: s2Res.total
      });
    } catch {
      // ignore
    }
  }, [selectedDate]);

  const loadAvailableDates = useCallback(async () => {
    try {
      const dates = await getAvailableCandidateDates();
      setAvailableDates(dates);
      const counts: { [d: string]: number } = {};
      const datesToFetch = Array.from(new Set([...dates, todayIst, yesterdayIst, tomorrowIst]));
      await Promise.all(
        datesToFetch.map(async (d) => {
          try {
            const r = await getCandidates({ limit: 1, date: d });
            counts[d] = r.total;
          } catch {
            counts[d] = 0;
          }
        })
      );
      try {
        const allR = await getCandidates({ limit: 1 });
        counts["ALL"] = allR.total;
      } catch {}
      setDateCounts(counts);
    } catch {
      // ignore
    }
  }, [todayIst, yesterdayIst, tomorrowIst]);

  // Fetch both Colleges and Academic Departments from their separate tables
  useEffect(() => {
    try {
      localStorage.removeItem("examsecure_cached_candidates_v2");
    } catch {
      // ignore
    }
    getColleges().then(setColleges).catch(() => {});
    getAllDepartments({ type: "academic" }).then(setDepartments).catch(() => {});
    loadAvailableDates();
    refreshSlotCounts(selectedDate);
  }, [refreshSlotCounts, loadAvailableDates, selectedDate]);

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
        date: selectedDate !== "ALL" ? selectedDate : undefined,
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
  }, [debouncedSearch, collegeFilter, departmentFilter, batchFilter, selectedDate, statusFilter, sortBy, sortOrder]);

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
        date: selectedDate !== "ALL" ? selectedDate : undefined,
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
  }, [loading, loadingMore, hasMore, page, debouncedSearch, collegeFilter, departmentFilter, batchFilter, selectedDate, statusFilter, sortBy, sortOrder]);

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

  // Selection handlers
  const handleToggleSelectAll = () => {
    if (selectedIds.size === candidates.length && candidates.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(candidates.map(c => c.id)));
    }
  };

  const handleToggleSelectCandidate = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const openSingleRescheduleModal = (cand: CandidateDto, targetSlot: string = "Slot 2") => {
    setRescheduleModal({
      isOpen: true,
      isBulk: false,
      candidate: cand,
      targetSlot,
      resetAttempt: true,
      reason: "Emergency reschedule to " + targetSlot,
      loading: false
    });
  };

  const openBulkRescheduleModal = (targetSlot: string = "Slot 2") => {
    if (selectedIds.size === 0) return;
    setRescheduleModal({
      isOpen: true,
      isBulk: true,
      targetSlot,
      resetAttempt: true,
      reason: "Batch lab reschedule to " + targetSlot,
      loading: false
    });
  };

  const handleExecuteReschedule = async () => {
    setRescheduleModal(prev => ({ ...prev, loading: true }));
    try {
      if (rescheduleModal.isBulk) {
        const ids = Array.from(selectedIds);
        const res = await batchRescheduleCandidateSlot({
          candidateIds: ids,
          targetSlot: rescheduleModal.targetSlot,
          resetAttempt: rescheduleModal.resetAttempt,
          reason: rescheduleModal.reason
        });
        setCandidates(prev => prev.map(c => ids.includes(c.id) ? { ...c, batch: rescheduleModal.targetSlot, status: rescheduleModal.resetAttempt ? "PENDING" : c.status } : c));
        setSelectedIds(new Set());
        setNotice({ text: res.message, type: "success" });
      } else if (rescheduleModal.candidate) {
        const cand = rescheduleModal.candidate;
        const res = await rescheduleCandidateSlot(cand.id, {
          targetSlot: rescheduleModal.targetSlot,
          resetAttempt: rescheduleModal.resetAttempt,
          reason: rescheduleModal.reason
        });
        setCandidates(prev => prev.map(c => c.id === cand.id ? { ...c, batch: rescheduleModal.targetSlot, status: rescheduleModal.resetAttempt ? "PENDING" : c.status } : c));
        setNotice({ text: res.message, type: "success" });
      }
      refreshSlotCounts();
      setRescheduleModal(prev => ({ ...prev, isOpen: false, loading: false }));
    } catch (err: unknown) {
      const errorObj = err as Error;
      setNotice({ text: "Reschedule failed: " + errorObj.message, type: "error" });
      setRescheduleModal(prev => ({ ...prev, loading: false }));
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

  // Dynamic slot titles and timings based on selected date
  const is31OctView = selectedDate === "2026-10-31" || selectedDate.includes("31") || selectedDate === todayIst;
  const is30OctView = selectedDate === "2026-10-30" || selectedDate.includes("30") || selectedDate === yesterdayIst;

  const slot1Header = is31OctView ? "Slot 1 • 11:30 AM" : is30OctView ? "Slot 1 • 10:00 AM" : "Slot 1 (Morning)";
  const slot1Sub = is31OctView ? "Entry: 11:30 AM – 12:00 PM IST" : is30OctView ? "Entry: 10:00 – 10:30 AM IST" : "10:00 AM / 11:30 AM";
  const slot1Btn = is31OctView ? "Slot 1 (11:30 AM)" : is30OctView ? "Slot 1 (10:00 AM)" : "Slot 1";

  const slot2Header = is31OctView ? "Slot 2 • 4:00 PM" : is30OctView ? "Slot 2 • 2:00 PM" : "Slot 2 (Afternoon)";
  const slot2Sub = is31OctView ? "Entry: 4:00 – 4:30 PM IST" : is30OctView ? "Entry: 2:00 – 2:30 PM IST" : "2:00 PM / 4:00 PM";
  const slot2Btn = is31OctView ? "Slot 2 (4:00 PM)" : is30OctView ? "Slot 2 (2:00 PM)" : "Slot 2";

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
              setSelectedDate("ALL");
              setCustomDatePicker("");
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

      {/* Premium Overview Stat Cards */}
      <div className="stat-cards-row" style={{ marginBottom: "20px" }}>
        <div 
          className="stat-card" 
          style={{ 
            cursor: "pointer", 
            border: batchFilter === "ALL" ? "2px solid #017846" : "1px solid #e2e8f0",
            backgroundColor: batchFilter === "ALL" ? "#fbfdfc" : "#ffffff"
          }}
          onClick={() => setBatchFilter("ALL")}
          title="Click to view all candidates"
        >
          <div className="stat-card-info">
            <small style={{ color: batchFilter === "ALL" ? "#017846" : undefined }}>Total Candidates</small>
            <div className="stat-card-value" style={{ color: "#017846" }}>{slotCounts.total}</div>
            <span className="stat-card-sub">All registered examinees</span>
          </div>
          <div className="stat-card-icon blue">
            <Users size={22} />
          </div>
        </div>

        <div 
          className="stat-card" 
          style={{ 
            cursor: "pointer", 
            border: batchFilter === "Slot 1" ? "2px solid #0284c7" : "1px solid #e2e8f0",
            backgroundColor: batchFilter === "Slot 1" ? "#f0f9ff" : "#ffffff"
          }}
          onClick={() => setBatchFilter(prev => prev === "Slot 1" ? "ALL" : "Slot 1")}
          title="Click to filter Slot 1 (10:00 AM)"
        >
          <div className="stat-card-info">
            <small style={{ color: "#0284c7" }}>{slot1Header}</small>
            <div className="stat-card-value" style={{ color: "#0284c7" }}>{slotCounts.slot1}</div>
            <span className="stat-card-sub">{slot1Sub}</span>
          </div>
          <div className="stat-card-icon" style={{ background: "#e0f2fe", color: "#0284c7" }}>
            <Clock size={22} />
          </div>
        </div>

        <div 
          className="stat-card" 
          style={{ 
            cursor: "pointer", 
            border: batchFilter === "Slot 2" ? "2px solid #7c3aed" : "1px solid #e2e8f0",
            backgroundColor: batchFilter === "Slot 2" ? "#faf5ff" : "#ffffff"
          }}
          onClick={() => setBatchFilter(prev => prev === "Slot 2" ? "ALL" : "Slot 2")}
          title="Click to filter Slot 2 (2:00 PM)"
        >
          <div className="stat-card-info">
            <small style={{ color: "#7c3aed" }}>{slot2Header}</small>
            <div className="stat-card-value" style={{ color: "#7c3aed" }}>{slotCounts.slot2}</div>
            <span className="stat-card-sub">{slot2Sub}</span>
          </div>
          <div className="stat-card-icon" style={{ background: "#f3e8ff", color: "#7c3aed" }}>
            <Clock size={22} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-info">
            <small>Institutions & Tracks</small>
            <div className="stat-card-value">{departments.length}</div>
            <span className="stat-card-sub">{colleges.length} Affiliated Colleges</span>
          </div>
          <div className="stat-card-icon purple">
            <GraduationCap size={22} />
          </div>
        </div>
      </div>

      {/* Interactive Day-Wise Examination Date Navigation Bar */}
      <div 
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          background: "#ffffff",
          padding: "12px 18px",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          marginBottom: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginRight: "4px" }}>
            <Calendar size={16} color="#017846" />
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Exam Date:
            </span>
          </div>

          {/* Today Button */}
          <button
            type="button"
            onClick={() => { setSelectedDate(todayIst); setCustomDatePicker(""); }}
            style={{
              padding: "7px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              border: selectedDate === todayIst ? "2px solid #017846" : "1px solid #cbd5e1",
              backgroundColor: selectedDate === todayIst ? "#017846" : "#f8fafc",
              color: selectedDate === todayIst ? "#ffffff" : "#334155",
              transition: "all 0.15s ease",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <span>Today ({formatDateShort(todayIst)} {formatDateYear(todayIst)})</span>
            <span style={{
              background: selectedDate === todayIst ? "rgba(255,255,255,0.25)" : "#e2e8f0",
              color: selectedDate === todayIst ? "#fff" : "#475569",
              borderRadius: "12px",
              padding: "1px 7px",
              fontSize: "11.5px",
              fontWeight: 700
            }}>
              {dateCounts[todayIst] ?? (selectedDate === todayIst ? totalCandidates : 675)}
            </span>
          </button>

          {/* Yesterday Button */}
          <button
            type="button"
            onClick={() => { setSelectedDate(yesterdayIst); setCustomDatePicker(""); }}
            style={{
              padding: "7px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              border: selectedDate === yesterdayIst ? "2px solid #0284c7" : "1px solid #cbd5e1",
              backgroundColor: selectedDate === yesterdayIst ? "#0284c7" : "#f8fafc",
              color: selectedDate === yesterdayIst ? "#ffffff" : "#334155",
              transition: "all 0.15s ease",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <span>Yesterday ({formatDateShort(yesterdayIst)} {formatDateYear(yesterdayIst)})</span>
            <span style={{
              background: selectedDate === yesterdayIst ? "rgba(255,255,255,0.25)" : "#e0f2fe",
              color: selectedDate === yesterdayIst ? "#fff" : "#0369a1",
              borderRadius: "12px",
              padding: "1px 7px",
              fontSize: "11.5px",
              fontWeight: 700
            }}>
              {dateCounts[yesterdayIst] ?? 463}
            </span>
          </button>

          {/* Tomorrow Button */}
          <button
            type="button"
            onClick={() => { setSelectedDate(tomorrowIst); setCustomDatePicker(""); }}
            style={{
              padding: "7px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              border: selectedDate === tomorrowIst ? "2px solid #017846" : "1px solid #cbd5e1",
              backgroundColor: selectedDate === tomorrowIst ? "#017846" : "#f8fafc",
              color: selectedDate === tomorrowIst ? "#ffffff" : "#334155",
              transition: "all 0.15s ease",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <span>Tomorrow ({formatDateShort(tomorrowIst)} {formatDateYear(tomorrowIst)})</span>
            <span style={{
              background: selectedDate === tomorrowIst ? "rgba(255,255,255,0.25)" : "#e2e8f0",
              color: selectedDate === tomorrowIst ? "#fff" : "#475569",
              borderRadius: "12px",
              padding: "1px 7px",
              fontSize: "11.5px",
              fontWeight: 700
            }}>
              {dateCounts[tomorrowIst] ?? 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => { setSelectedDate("ALL"); setCustomDatePicker(""); }}
            style={{
              padding: "7px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              border: selectedDate === "ALL" ? "2px solid #475569" : "1px solid #cbd5e1",
              backgroundColor: selectedDate === "ALL" ? "#475569" : "#f8fafc",
              color: selectedDate === "ALL" ? "#ffffff" : "#334155",
              transition: "all 0.15s ease",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <span>All Dates Combined</span>
            <span style={{
              background: selectedDate === "ALL" ? "rgba(255,255,255,0.25)" : "#e2e8f0",
              color: selectedDate === "ALL" ? "#fff" : "#475569",
              borderRadius: "12px",
              padding: "1px 7px",
              fontSize: "11.5px",
              fontWeight: 700
            }}>
              {dateCounts["ALL"] ?? (totalCandidates || 1138)}
            </span>
          </button>

          {/* Custom Date Input */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginLeft: "4px" }}>
            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: 500 }}>Custom:</span>
            <input 
              type="date"
              value={customDatePicker}
              onChange={(e) => {
                const val = e.target.value;
                setCustomDatePicker(val);
                if (val) setSelectedDate(val);
              }}
              style={{
                padding: "4px 8px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "12.5px",
                color: "#334155",
                backgroundColor: selectedDate !== "ALL" && selectedDate !== "2026-10-31" && selectedDate !== "2026-10-30" ? "#f0fdf4" : "#ffffff"
              }}
            />
          </div>
        </div>

        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#475569" }}>
          <span>Active Date:</span>
          <span style={{
            background: "#ecfdf5",
            color: "#065f46",
            padding: "3px 9px",
            borderRadius: "6px",
            fontWeight: 700,
            fontSize: "12px",
            border: "1px solid #a7f3d0"
          }}>
            {selectedDate === "ALL" 
              ? "All Dates Combined" 
              : selectedDate === todayIst 
              ? `Today (${formatDateShort(todayIst)} ${formatDateYear(todayIst)})` 
              : selectedDate === yesterdayIst 
              ? `Yesterday (${formatDateShort(yesterdayIst)} ${formatDateYear(yesterdayIst)})` 
              : selectedDate === tomorrowIst 
              ? `Tomorrow (${formatDateShort(tomorrowIst)} ${formatDateYear(tomorrowIst)})` 
              : selectedDate}
          </span>
        </div>
      </div>

      {/* Interactive Slot Filter Navigation Bar */}
      <div 
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          background: "#ffffff",
          padding: "12px 18px",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          marginBottom: "16px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", marginRight: "4px" }}>
            Exam Slot:
          </span>
          <button
            type="button"
            onClick={() => setBatchFilter("ALL")}
            style={{
              padding: "7px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              border: batchFilter === "ALL" ? "2px solid #017846" : "1px solid #cbd5e1",
              backgroundColor: batchFilter === "ALL" ? "#017846" : "#f8fafc",
              color: batchFilter === "ALL" ? "#ffffff" : "#475569",
              transition: "all 0.15s ease",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            All Examinees
            <span style={{
              background: batchFilter === "ALL" ? "rgba(255,255,255,0.25)" : "#e2e8f0",
              color: batchFilter === "ALL" ? "#fff" : "#475569",
              borderRadius: "12px",
              padding: "1px 7px",
              fontSize: "11.5px",
              fontWeight: 700
            }}>
              {slotCounts.total}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setBatchFilter("Slot 1")}
            style={{
              padding: "7px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              border: batchFilter === "Slot 1" ? "2px solid #0284c7" : "1px solid #cbd5e1",
              backgroundColor: batchFilter === "Slot 1" ? "#0284c7" : "#f8fafc",
              color: batchFilter === "Slot 1" ? "#ffffff" : "#475569",
              transition: "all 0.15s ease",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <Clock size={14} />
            {slot1Btn}
            <span style={{
              background: batchFilter === "Slot 1" ? "rgba(255,255,255,0.25)" : "#e0f2fe",
              color: batchFilter === "Slot 1" ? "#fff" : "#0369a1",
              borderRadius: "12px",
              padding: "1px 7px",
              fontSize: "11.5px",
              fontWeight: 700
            }}>
              {slotCounts.slot1}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setBatchFilter("Slot 2")}
            style={{
              padding: "7px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
              border: batchFilter === "Slot 2" ? "2px solid #7c3aed" : "1px solid #cbd5e1",
              backgroundColor: batchFilter === "Slot 2" ? "#7c3aed" : "#f8fafc",
              color: batchFilter === "Slot 2" ? "#ffffff" : "#475569",
              transition: "all 0.15s ease",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <Clock size={14} />
            {slot2Btn}
            <span style={{
              background: batchFilter === "Slot 2" ? "rgba(255,255,255,0.25)" : "#f3e8ff",
              color: batchFilter === "Slot 2" ? "#fff" : "#6b21a8",
              borderRadius: "12px",
              padding: "1px 7px",
              fontSize: "11.5px",
              fontWeight: 700
            }}>
              {slotCounts.slot2}
            </span>
          </button>
        </div>

        <div style={{ fontSize: "12.5px", color: "#64748b", fontWeight: 500 }}>
          Viewing <b>{candidates.length}</b> of <b>{totalCandidates}</b> candidates
        </div>
      </div>

      {/* Emergency Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "12px",
            background: "#eff6ff",
            border: "1.5px solid #3b82f6",
            padding: "12px 18px",
            borderRadius: "10px",
            marginBottom: "16px",
            boxShadow: "0 2px 8px rgba(59, 130, 246, 0.15)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{
              background: "#2563eb",
              color: "#fff",
              padding: "4px 10px",
              borderRadius: "14px",
              fontSize: "12px",
              fontWeight: 700
            }}>
              {selectedIds.size} Selected
            </span>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#1e3a8a" }}>
              Batch slot actions for selected examinees
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              onClick={() => openBulkRescheduleModal("Slot 2")}
              style={{
                backgroundColor: "#7c3aed",
                color: "#ffffff",
                border: "none",
                padding: "8px 16px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 2px 4px rgba(124, 58, 237, 0.25)"
              }}
            >
              <Clock size={15} /> Move All Selected to Slot 2 (2:00 PM)
            </button>

            <button
              type="button"
              onClick={() => openBulkRescheduleModal("Slot 1")}
              style={{
                backgroundColor: "#0284c7",
                color: "#ffffff",
                border: "none",
                padding: "8px 14px",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px"
              }}
            >
              Move to Slot 1
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              style={{
                background: "#ffffff",
                color: "#64748b",
                border: "1px solid #cbd5e1",
                padding: "8px 12px",
                borderRadius: "8px",
                fontSize: "12.5px",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Clear
            </button>
          </div>
        </div>
      )}

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
                <th style={{ width: "42px", textAlign: "center" }}>
                  <input 
                    type="checkbox" 
                    checked={selectedIds.size === candidates.length && candidates.length > 0} 
                    onChange={handleToggleSelectAll}
                    title="Select / Deselect all visible candidates"
                    style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "#017846" }}
                  />
                </th>
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
                  style={{ width: "220px" }}
                >
                  <div style={{ display: "inline-flex", alignItems: "center" }}>
                    Exam Slot & Reschedule
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
                    <td style={{ width: "42px", textAlign: "center" }}><div className="skeleton-cell" style={{ width: "20px", margin: "0 auto" }} /></td>
                    <td style={{ width: "120px" }}><div className="skeleton-cell" style={{ width: "80px" }} /></td>
                    <td><div className="skeleton-cell" style={{ width: "160px" }} /></td>
                    <td><div className="skeleton-cell" style={{ width: "200px" }} /></td>
                    <td><div className="skeleton-cell" style={{ width: "140px" }} /></td>
                    <td><div className="skeleton-cell" style={{ width: "120px" }} /></td>
                    <td style={{ width: "220px" }}><div className="skeleton-cell" style={{ width: "180px" }} /></td>
                    <td style={{ width: "120px" }}><div className="skeleton-cell" style={{ width: "90px" }} /></td>
                  </tr>
                ))
              ) : candidates.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "50px 20px", color: "#64748b" }}>
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
                  const isSelected = selectedIds.has(cand.id);
                  return (
                    <tr key={cand.id} style={{ backgroundColor: isSelected ? "#f0fdf4" : undefined }}>
                      <td style={{ textAlign: "center" }}>
                        <input 
                          type="checkbox" 
                          checked={isSelected}
                          onChange={() => handleToggleSelectCandidate(cand.id)}
                          style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "#017846" }}
                        />
                      </td>
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
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          {cand.examDate && (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "3px",
                                fontSize: "11px",
                                fontWeight: 700,
                                padding: "2px 7px",
                                borderRadius: "5px",
                                backgroundColor: cand.examDate === "2026-10-31" ? "#ecfdf5" : "#f1f5f9",
                                color: cand.examDate === "2026-10-31" ? "#065f46" : "#475569",
                                border: cand.examDate === "2026-10-31" ? "1px solid #a7f3d0" : "1px solid #cbd5e1"
                              }}
                              title={`Scheduled Date: ${cand.examDate}`}
                            >
                              <Calendar size={10} />
                              {cand.examDate === "2026-10-31" ? "31 Oct" : cand.examDate === "2026-10-30" ? "30 Oct" : cand.examDate}
                            </span>
                          )}
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "11.5px",
                              fontWeight: 700,
                              padding: "3px 8px",
                              borderRadius: "6px",
                              backgroundColor: cand.batch === "Slot 1" ? "#e0f2fe" : cand.batch === "Slot 2" ? "#f3e8ff" : "#f1f5f9",
                              color: cand.batch === "Slot 1" ? "#0369a1" : cand.batch === "Slot 2" ? "#6b21a8" : "#64748b",
                              border: cand.batch === "Slot 1" ? "1px solid #bae6fd" : cand.batch === "Slot 2" ? "1px solid #e9d5ff" : "1px solid #cbd5e1"
                            }}
                          >
                            <Clock size={11} />
                            {cand.batch || "Unassigned"}
                          </span>

                          {cand.batch === "Slot 1" && (
                            <button
                              type="button"
                              onClick={() => openSingleRescheduleModal(cand, "Slot 2")}
                              title="Move candidate to Slot 2 (2:00 PM) with automatic attempt reset"
                              style={{
                                padding: "3px 8px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: 700,
                                backgroundColor: "#7c3aed",
                                color: "#ffffff",
                                border: "none",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "3px",
                                boxShadow: "0 1px 2px rgba(124, 58, 237, 0.2)"
                              }}
                            >
                              To Slot 2 <ArrowRight size={11} />
                            </button>
                          )}

                          {cand.batch === "Slot 2" && (
                            <button
                              type="button"
                              onClick={() => openSingleRescheduleModal(cand, "Slot 1")}
                              title="Move candidate to Slot 1 (10:00 AM) with automatic attempt reset"
                              style={{
                                padding: "3px 8px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: 600,
                                backgroundColor: "#f0f9ff",
                                color: "#0369a1",
                                border: "1px solid #bae6fd",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "3px"
                              }}
                            >
                              To Slot 1 <ArrowRight size={11} />
                            </button>
                          )}
                        </div>
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

      {/* Emergency Slot Reschedule Confirmation Modal */}
      {rescheduleModal.isOpen && (
        <div className="admin-modal-backdrop" onClick={() => setRescheduleModal(prev => ({ ...prev, isOpen: false }))}>
          <div className="admin-modal-box" style={{ maxWidth: "500px" }} onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Clock size={20} color="#7c3aed" />
                <h3 style={{ margin: 0, fontSize: "16px", color: "#0f172a" }}>
                  {rescheduleModal.isBulk 
                    ? `Batch Move ${selectedIds.size} Candidates to ${rescheduleModal.targetSlot}`
                    : `Move Candidate to ${rescheduleModal.targetSlot}`
                  }
                </h3>
              </div>
              <button 
                type="button" 
                onClick={() => setRescheduleModal(prev => ({ ...prev, isOpen: false }))} 
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", color: "#64748b" }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {!rescheduleModal.isBulk && rescheduleModal.candidate && (
                <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: 700, fontSize: "14px", color: "#1e293b" }}>
                    {rescheduleModal.candidate.fullName}
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "3px" }}>
                    Reg No: <b style={{ fontFamily: "monospace" }}>{rescheduleModal.candidate.registrationNumber}</b> • Current: <b>{rescheduleModal.candidate.batch || "Unassigned"}</b>
                  </div>
                </div>
              )}

              {rescheduleModal.isBulk && (
                <div style={{ background: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: 700, fontSize: "13px", color: "#1e293b" }}>
                    {selectedIds.size} candidates will be rescheduled together
                  </div>
                  <div style={{ fontSize: "12px", color: "#64748b", marginTop: "3px" }}>
                    All selected examinees will be moved to <b>{rescheduleModal.targetSlot}</b>.
                  </div>
                </div>
              )}

              <div>
                <label style={{ fontSize: "12px", fontWeight: 700, color: "#334155", display: "block", marginBottom: "4px" }}>
                  Target Exam Slot
                </label>
                <select
                  value={rescheduleModal.targetSlot}
                  onChange={e => setRescheduleModal(prev => ({ ...prev, targetSlot: e.target.value }))}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", fontWeight: 600 }}
                >
                  <option value="Slot 2">🕒 Slot 2 (2:00 PM - 2:30 PM Entry Window)</option>
                  <option value="Slot 1">🕒 Slot 1 (10:00 AM - 10:30 AM Entry Window)</option>
                </select>
              </div>

              {/* Automatic Attempt Reset Checkbox (Checked by Default) */}
              <div 
                style={{
                  background: "#faf5ff",
                  border: "1.5px solid #d8b4fe",
                  borderRadius: "8px",
                  padding: "12px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px"
                }}
              >
                <input 
                  type="checkbox" 
                  id="resetAttemptCheck"
                  checked={rescheduleModal.resetAttempt}
                  onChange={e => setRescheduleModal(prev => ({ ...prev, resetAttempt: e.target.checked }))}
                  style={{ marginTop: "3px", width: "16px", height: "16px", cursor: "pointer", accentColor: "#7c3aed" }}
                />
                <label htmlFor="resetAttemptCheck" style={{ fontSize: "12.5px", color: "#4c1d95", cursor: "pointer" }}>
                  <b style={{ display: "block" }}>Reset exam progress & timer for a fresh attempt (Recommended)</b>
                  <span style={{ fontSize: "11.5px", color: "#6b21a8", display: "block", marginTop: "2px" }}>
                    Wipes any interrupted/broken Slot 1 session so the student gets the full 60-minute duration in Slot 2 with zero lockouts.
                  </span>
                </label>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#475569", display: "block", marginBottom: "4px" }}>
                  Reason (Audit Trail)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lab PC crashed, network outage, or candidate request"
                  value={rescheduleModal.reason}
                  onChange={e => setRescheduleModal(prev => ({ ...prev, reason: e.target.value }))}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12.5px" }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setRescheduleModal(prev => ({ ...prev, isOpen: false }))}
                  disabled={rescheduleModal.loading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteReschedule}
                  disabled={rescheduleModal.loading}
                  style={{
                    backgroundColor: "#7c3aed",
                    color: "#ffffff",
                    border: "none",
                    padding: "8px 16px",
                    borderRadius: "6px",
                    fontWeight: 700,
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px"
                  }}
                >
                  {rescheduleModal.loading && <Loader2 size={14} className="animate-spin" />}
                  Confirm Move to {rescheduleModal.targetSlot}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
