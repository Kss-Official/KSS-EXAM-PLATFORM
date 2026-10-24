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
  Info,
  Mail,
  Send,
  Loader2
} from "lucide-react";
import { 
  getAllCandidates, 
  createCandidate, 
  uploadCandidatesCsv, 
  getAllDepartments,
  sendCandidateAccessCodeEmail,
  generateCandidateAccessCode,
  batchGenerateRoundUniqueIds,
  generateSelectedRoundUniqueIds,
  assignCandidateSet,
  batchAssignCandidateSet,
  getRoundUniqueIds,
  batchSendAccessCodesEmail,
  getBatchEmailStatus,
  type CandidateDto, 
  type DepartmentDto 
} from "../../services/api";
import {
  type ExamRound,
  type RoundIdStore,
  getRoundIdsStore,
  saveRoundIdsStore,
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
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // Batch Email Dispatch State
  const [isBatchEmailModalOpen, setIsBatchEmailModalOpen] = useState(false);
  const [batchEmailStarting, setBatchEmailStarting] = useState(false);
  const [batchEmailJob, setBatchEmailJob] = useState<{
    jobId: string;
    round: string;
    status: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | string;
    totalCandidates: number;
    sentCount: number;
    failedCount: number;
    provider: string;
  } | null>(null);

  // Checkbox selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Create New ID Modal state (Option 1: All Candidates, Option 2: Selected Candidates)
  const [isCreateIdModalOpen, setIsCreateIdModalOpen] = useState(false);
  const [createIdChoice, setCreateIdChoice] = useState<"ALL" | "SELECTED">("ALL");
  const [generatingIds, setGeneratingIds] = useState(false);

  // Question Paper Set assignment loading state
  const [assigningSetId, setAssigningSetId] = useState<number | null>(null);
  const [batchAssigningSet, setBatchAssigningSet] = useState(false);

  const handleStartBatchEmail = async () => {
    setBatchEmailStarting(true);
    try {
      const initResp = await batchSendAccessCodesEmail({
        round: selectedRound,
        examTitle: selectedRound === "ROUND_1" ? "Technical Campus MCQ Assessment" : "Technical Campus Coding Assessment"
      });
      setBatchEmailJob({
        jobId: initResp.jobId,
        round: selectedRound,
        status: initResp.status,
        totalCandidates: initResp.totalCandidates,
        sentCount: 0,
        failedCount: 0,
        provider: "auto"
      });
    } catch (err: any) {
      setNotice({
        text: "Failed to initiate batch email dispatch: " + (err?.message || "Unknown error"),
        type: "error"
      });
    } finally {
      setBatchEmailStarting(false);
    }
  };

  // Poll for batch email progress
  useEffect(() => {
    if (!batchEmailJob?.jobId || batchEmailJob.status === "COMPLETED" || batchEmailJob.status === "FAILED") {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const statusData = await getBatchEmailStatus(batchEmailJob.jobId);
        setBatchEmailJob(statusData);
      } catch (e) {
        console.warn("Batch email polling error:", e);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, [batchEmailJob?.jobId, batchEmailJob?.status]);


  const handleSendEmail = async (cand: CandidateDto) => {
    setActionLoadingId(cand.id);
    try {
      const res = await sendCandidateAccessCodeEmail(cand.id, selectedRound);
      setNotice({
        text: `Unique ID sent to ${cand.email} via ${res.provider}! Access ID: ${res.accessCode} (Round: ${selectedRound === "ROUND_1" ? "Round 1" : "Round 2"}, Limit: 3 uses).`,
        type: "success"
      });
      fetchCandidates();
    } catch (e: unknown) {
      const err = e as Error;
      setNotice({
        text: `Failed to send email to ${cand.email}: ` + err.message,
        type: "error"
      });
    } finally {
      setActionLoadingId(null);
    }
  };

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
        // Synchronize round unique IDs directly from loaded candidate access codes
        setRoundIdsStore(prev => {
          const newR1 = { ...prev.round1 };
          const newR2 = { ...prev.round2 };
          data.forEach(c => {
            const reg = c.registrationNumber.trim().toUpperCase();
            if (c.round1AccessCode) newR1[reg] = c.round1AccessCode;
            else if (c.currentAccessCode?.startsWith("MCQ-")) newR1[reg] = c.currentAccessCode;
            
            if (c.round2AccessCode) newR2[reg] = c.round2AccessCode;
            else if (c.currentAccessCode?.startsWith("CODE-")) newR2[reg] = c.currentAccessCode;
          });
          return { round1: newR1, round2: newR2 };
        });
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

    // Sync round unique IDs from backend
    const syncBackendRoundIds = async () => {
      try {
        const [r1, r2] = await Promise.all([
          getRoundUniqueIds("ROUND_1"),
          getRoundUniqueIds("ROUND_2")
        ]);
        if (r1 || r2) {
          setRoundIdsStore(prev => ({
            round1: { ...prev.round1, ...(r1 || {}) },
            round2: { ...prev.round2, ...(r2 || {}) }
          }));
        }
      } catch (e) {
        // silent fallback
      }
    };
    syncBackendRoundIds();
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

  // Selection Handlers
  const handleToggleSelectAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(c => c.id)));
    }
  };

  const handleToggleSelectOne = (id: number) => {
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

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Option 1: Generate Unique IDs for All Candidates
  const handleGenerateAllIds = async () => {
    if (roundEligibleCandidates.length === 0) {
      setNotice({
        text: `No eligible candidates found for ${selectedRound === "ROUND_1" ? "Round 1 (MCQ)" : "Round 2 (Coding)"}.`,
        type: "info"
      });
      return;
    }

    setGeneratingIds(true);
    try {
      const res = await batchGenerateRoundUniqueIds(selectedRound, true);
      if (res && res.roundIds) {
        setRoundIdsStore(prev => {
          const updated = {
            ...prev,
            [selectedRound === "ROUND_1" ? "round1" : "round2"]: {
              ...(selectedRound === "ROUND_1" ? prev.round1 : prev.round2),
              ...res.roundIds
            }
          };
          saveRoundIdsStore(updated);
          return updated;
        });

        // Immediately update candidates list in React state
        setCandidates(prev => prev.map(c => {
          const reg = c.registrationNumber.trim().toUpperCase();
          const newCode = res.roundIds[reg];
          if (!newCode) return c;
          if (selectedRound === "ROUND_1") {
            return { ...c, round1AccessCode: newCode, currentAccessCode: newCode, accessCodeUses: 0, accessCodeActive: true };
          } else {
            return { ...c, round2AccessCode: newCode, currentAccessCode: newCode, accessCodeUses: 0, accessCodeActive: true };
          }
        }));

        setNotice({
          text: `Successfully created new Unique IDs for ALL ${res.totalEligible} candidates in ${selectedRound === "ROUND_1" ? "Round 1 (MCQ)" : "Round 2 (Coding)"}.`,
          type: "success"
        });
        setIsCreateIdModalOpen(false);
        fetchCandidates();
        return;
      }
    } catch (err: any) {
      console.warn("Backend batch generation fallback to local generator:", err);
      const result = generateRoundUniqueIds(candidates, selectedRound);
      setRoundIdsStore(result.store);
      saveRoundIdsStore(result.store);
      setNotice({
        text: `Generated ${result.newlyGenerated} new Unique IDs (${result.totalEligible} total eligible).`,
        type: "success"
      });
      setIsCreateIdModalOpen(false);
    } finally {
      setGeneratingIds(false);
    }
  };

  // Option 2: Generate Unique IDs for Selected Candidates
  const handleGenerateSelectedIds = async () => {
    const idsArray = Array.from(selectedIds);
    if (idsArray.length === 0) {
      setNotice({
        text: "Please select at least one candidate using the table checkboxes before generating IDs.",
        type: "error"
      });
      return;
    }

    setGeneratingIds(true);
    try {
      const res = await generateSelectedRoundUniqueIds(idsArray, selectedRound, true);
      if (res && res.roundIds) {
        setRoundIdsStore(prev => {
          const updated = {
            ...prev,
            [selectedRound === "ROUND_1" ? "round1" : "round2"]: {
              ...(selectedRound === "ROUND_1" ? prev.round1 : prev.round2),
              ...res.roundIds
            }
          };
          saveRoundIdsStore(updated);
          return updated;
        });

        // Immediately update candidates list in React state
        setCandidates(prev => prev.map(c => {
          const reg = c.registrationNumber.trim().toUpperCase();
          const newCode = res.roundIds[reg];
          if (!newCode) return c;
          if (selectedRound === "ROUND_1") {
            return { ...c, round1AccessCode: newCode, currentAccessCode: newCode, accessCodeUses: 0, accessCodeActive: true };
          } else {
            return { ...c, round2AccessCode: newCode, currentAccessCode: newCode, accessCodeUses: 0, accessCodeActive: true };
          }
        }));

        setNotice({
          text: `Successfully created new Unique IDs for ${res.generatedCount} selected candidate(s) in ${selectedRound === "ROUND_1" ? "Round 1" : "Round 2"}.`,
          type: "success"
        });
        setIsCreateIdModalOpen(false);
        fetchCandidates();
      }
    } catch (err: any) {
      setNotice({
        text: "Failed to generate IDs for selected candidates: " + (err?.message || "Unknown error"),
        type: "error"
      });
    } finally {
      setGeneratingIds(false);
    }
  };

  // Option 3: Generate New Unique ID for Single Candidate
  const handleGenerateSingleCandidateId = async (cand: CandidateDto) => {
    setActionLoadingId(cand.id);
    try {
      const res = await generateCandidateAccessCode(cand.id, selectedRound, true);
      const regUpper = cand.registrationNumber.trim().toUpperCase();
      setRoundIdsStore(prev => {
        const updated = {
          ...prev,
          [selectedRound === "ROUND_1" ? "round1" : "round2"]: {
            ...(selectedRound === "ROUND_1" ? prev.round1 : prev.round2),
            [regUpper]: res.code
          }
        };
        saveRoundIdsStore(updated);
        return updated;
      });

      setCandidates(prev => prev.map(c => {
        if (c.id !== cand.id) return c;
        if (selectedRound === "ROUND_1") {
          return { ...c, round1AccessCode: res.code, currentAccessCode: res.code, accessCodeUses: 0, accessCodeActive: true };
        } else {
          return { ...c, round2AccessCode: res.code, currentAccessCode: res.code, accessCodeUses: 0, accessCodeActive: true };
        }
      }));

      setNotice({
        text: `Created new Unique ID '${res.code}' for ${cand.fullName} (${selectedRound === "ROUND_1" ? "Round 1" : "Round 2"}, strictly 3 uses).`,
        type: "success"
      });
    } catch (err: any) {
      setNotice({
        text: `Failed to create new ID for ${cand.fullName}: ` + (err?.message || "Unknown error"),
        type: "error"
      });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Question Paper Set Assignment Handlers
  const handleAssignSet = async (candidateId: number, setCode: string | null) => {
    setAssigningSetId(candidateId);
    try {
      const updated = await assignCandidateSet(candidateId, setCode);
      setCandidates(prev => prev.map(c => c.id === candidateId ? { ...c, assignedSet: updated.assignedSet } : c));
      cacheCandidatesLocally(candidates.map(c => c.id === candidateId ? { ...c, assignedSet: updated.assignedSet } : c));
      setNotice({
        text: `Updated Question Paper Set for ${updated.fullName} to ${updated.assignedSet || "Unassigned"}.`,
        type: "success"
      });
    } catch (err: any) {
      setNotice({
        text: "Failed to update Question Paper Set: " + (err?.message || "Server error"),
        type: "error"
      });
    } finally {
      setAssigningSetId(null);
    }
  };

  const handleBatchAssignSet = async (setCode: string | null) => {
    const idsArray = Array.from(selectedIds);
    if (idsArray.length === 0) return;

    setBatchAssigningSet(true);
    try {
      const res = await batchAssignCandidateSet(idsArray, setCode);
      setCandidates(prev => prev.map(c => idsArray.includes(c.id) ? { ...c, assignedSet: res.assignedSet } : c));
      setNotice({
        text: `Assigned ${res.assignedSet || "Unassigned"} to ${res.updatedCount} selected candidate(s).`,
        type: "success"
      });
      setSelectedIds(new Set());
    } catch (err: any) {
      setNotice({
        text: "Failed to batch assign Question Paper Set: " + (err?.message || "Server error"),
        type: "error"
      });
    } finally {
      setBatchAssigningSet(false);
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

          {/* Create New ID Action Button */}
          <button 
            type="button" 
            className="admin-btn primary" 
            onClick={() => {
              setCreateIdChoice(selectedIds.size > 0 ? "SELECTED" : "ALL");
              setIsCreateIdModalOpen(true);
            }}
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
            title="Create new Unique IDs for All Candidates or Selected Candidates"
          >
            <KeyRound size={15} />
            <span>Create New ID</span>
            {selectedIds.size > 0 && (
              <span style={{
                background: "rgba(255, 255, 255, 0.25)",
                padding: "1px 6px",
                borderRadius: "10px",
                fontSize: "11px",
                fontWeight: 800
              }}>
                {selectedIds.size}
              </span>
            )}
          </button>

          {/* Batch Email Dispatch Button */}
          <button 
            type="button" 
            className="admin-btn secondary" 
            onClick={() => setIsBatchEmailModalOpen(true)}
            style={{ 
              display: "inline-flex", 
              alignItems: "center", 
              gap: "6px", 
              padding: "8px 14px", 
              borderRadius: "8px", 
              border: "1px solid #93c5fd", 
              background: "#eff6ff", 
              color: "#1d4ed8", 
              fontSize: "12px", 
              fontWeight: 600, 
              cursor: "pointer" 
            }}
            title={`Dispatch unique IDs via email to all candidates in ${selectedRound === "ROUND_1" ? "Round 1 (MCQ)" : "Round 2 (Coding)"}`}
          >
            <Mail size={15} color="#1d4ed8" />
            <span>Batch Send Emails</span>
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
          <span>Round 1 — MCQ Assessment</span>
          <span className="candidate-round-count">{round1EligibleCount}</span>
        </button>

        <button
          type="button"
          className={`candidate-round-tab round2 ${selectedRound === "ROUND_2" ? "active round2" : ""}`}
          onClick={() => setSelectedRound("ROUND_2")}
        >
          <Code2 size={16} />
          <span>Round 2 — Coding Assessment</span>
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
              ✓ All IDs Generated
            </span>
          ) : (
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#d97706", background: "#fef3c7", border: "1px solid #fde68a", padding: "2px 8px", borderRadius: "999px" }}>
              ● Pending Generation ({roundEligibleCandidates.length - generatedCountInCurrentRound})
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
                <th style={{ width: "42px", textAlign: "center" }}>
                  <input
                    type="checkbox"
                    aria-label="Select all candidates in this view"
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    ref={el => {
                      if (el) {
                        el.indeterminate = selectedIds.size > 0 && selectedIds.size < filtered.length;
                      }
                    }}
                    onChange={handleToggleSelectAll}
                    style={{ cursor: "pointer", width: "16px", height: "16px", accentColor: "#017846" }}
                  />
                </th>
                <th>Registration Number</th>
                <th>Candidate Name</th>
                <th>Email Address</th>
                <th>
                  {selectedRound === "ROUND_1" ? "Round 1 Unique ID" : "Round 2 Unique ID"}
                </th>
                <th>Assigned Department</th>
                <th>Question Paper Set</th>
                <th>Account Status</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                    Loading candidate records from database...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: "center", padding: "50px 20px", color: "#64748b" }}>
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
                  const roundUniqueId = targetMap[regUpper] 
                    || (selectedRound === "ROUND_1"
                      ? (cand.round1AccessCode || (cand.currentAccessCode?.startsWith("MCQ-") ? cand.currentAccessCode : null))
                      : (cand.round2AccessCode || (cand.currentAccessCode?.startsWith("CODE-") ? cand.currentAccessCode : null))
                    );
                  const isSelected = selectedIds.has(cand.id);

                  return (
                    <tr 
                      key={cand.id} 
                      style={{ 
                        background: isSelected ? "rgba(1, 120, 70, 0.05)" : undefined,
                        transition: "background 0.15s ease" 
                      }}
                    >
                      <td style={{ textAlign: "center" }}>
                        <input
                          type="checkbox"
                          aria-label={`Select candidate ${cand.fullName}`}
                          checked={isSelected}
                          onChange={() => handleToggleSelectOne(cand.id)}
                          style={{ cursor: "pointer", width: "16px", height: "16px", accentColor: "#017846" }}
                        />
                      </td>
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
                          <span className="candidate-id-empty" title="Click 'Create New ID' above to generate">
                            — Not Generated —
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
                      {/* Question Paper Set Column */}
                      <td>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <select
                            aria-label={`Question Paper Set for ${cand.fullName}`}
                            value={cand.assignedSet || ""}
                            disabled={assigningSetId === cand.id}
                            onChange={(e) => handleAssignSet(cand.id, e.target.value ? e.target.value : null)}
                            style={{
                              padding: "4px 8px",
                              borderRadius: "6px",
                              border: cand.assignedSet ? "1.5px solid #017846" : "1px solid #cbd5e1",
                              background: cand.assignedSet ? "#f0fdf4" : "#ffffff",
                              color: cand.assignedSet ? "#166534" : "#475569",
                              fontWeight: cand.assignedSet ? 700 : 500,
                              fontSize: "12px",
                              cursor: "pointer",
                              fontFamily: "inherit"
                            }}
                          >
                            <option value="">— Not Assigned —</option>
                            <option value="Set A">Set A</option>
                            <option value="Set B">Set B</option>
                            <option value="Set C">Set C</option>
                            <option value="Set D">Set D</option>
                          </select>
                          {assigningSetId === cand.id && (
                            <Loader2 size={13} className="spin" color="#017846" />
                          )}
                        </div>
                      </td>
                      <td>
                        <span className={`status-pill ${cand.status.toLowerCase()}`}>
                          {cand.status}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                          <button
                            type="button"
                            className="admin-btn secondary"
                            style={{ 
                              padding: "5px 9px", 
                              fontSize: "11px", 
                              display: "inline-flex", 
                              alignItems: "center", 
                              gap: "4px", 
                              background: "#ffffff", 
                              color: "#017846", 
                              border: "1px solid #a7f3d0", 
                              borderRadius: "6px",
                              fontWeight: 600,
                              cursor: "pointer",
                              boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                            }}
                            disabled={actionLoadingId === cand.id}
                            onClick={() => handleGenerateSingleCandidateId(cand)}
                            title={`Generate a new, fresh Unique ID for ${cand.fullName}`}
                          >
                            <KeyRound size={12} color="#017846" />
                            <span>New ID</span>
                          </button>

                          <button
                            type="button"
                            className="admin-btn primary"
                            style={{ 
                              padding: "5px 12px", 
                              fontSize: "11px", 
                              display: "inline-flex", 
                              alignItems: "center", 
                              gap: "5px", 
                              background: "linear-gradient(135deg, #017846, #015c36)", 
                              color: "#ffffff", 
                              border: "none", 
                              borderRadius: "6px",
                              fontWeight: 600,
                              cursor: "pointer",
                              boxShadow: "0 2px 4px rgba(1, 120, 70, 0.2)"
                            }}
                            disabled={actionLoadingId === cand.id}
                            onClick={() => handleSendEmail(cand)}
                            title="Send the Unique ID to candidate's email address"
                          >
                            <Mail size={12} />
                            {actionLoadingId === cand.id ? "Sending..." : "Send to Email"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Floating Batch Selection Bar */}
        {selectedIds.size > 0 && (
          <div
            style={{
              marginTop: "16px",
              background: "#0f172a",
              color: "#ffffff",
              padding: "12px 18px",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "12px",
              boxShadow: "0 4px 14px rgba(0, 0, 0, 0.15)"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span
                style={{
                  background: "#017846",
                  color: "#ffffff",
                  fontWeight: 800,
                  fontSize: "12px",
                  padding: "3px 10px",
                  borderRadius: "999px"
                }}
              >
                {selectedIds.size} Selected
              </span>
              <span style={{ fontSize: "13px", color: "#cbd5e1" }}>
                Candidate{selectedIds.size > 1 ? "s" : ""} selected for batch operations
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              {/* Trigger Create New IDs for Selected */}
              <button
                type="button"
                disabled={generatingIds}
                onClick={handleGenerateSelectedIds}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "linear-gradient(135deg, #017846, #015c36)",
                  color: "#ffffff",
                  border: "none",
                  padding: "7px 14px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer"
                }}
              >
                {generatingIds ? <Loader2 size={13} className="spin" /> : <KeyRound size={13} />}
                <span>Create New IDs for Selected ({selectedIds.size})</span>
              </button>

              {/* Batch Question Paper Set Assignment */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "12px", color: "#94a3b8" }}>Set:</span>
                <select
                  disabled={batchAssigningSet}
                  onChange={(e) => {
                    if (e.target.value) {
                      handleBatchAssignSet(e.target.value === "CLEAR" ? null : e.target.value);
                      e.target.value = "";
                    }
                  }}
                  defaultValue=""
                  style={{
                    background: "#1e293b",
                    color: "#ffffff",
                    border: "1px solid #334155",
                    padding: "6px 10px",
                    borderRadius: "7px",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  <option value="" disabled>Assign Question Paper Set...</option>
                  <option value="Set A">Set A</option>
                  <option value="Set B">Set B</option>
                  <option value="Set C">Set C</option>
                  <option value="Set D">Set D</option>
                  <option value="CLEAR">— Unassign Set —</option>
                </select>
                {batchAssigningSet && <Loader2 size={13} className="spin" color="#38bdf8" />}
              </div>

              {/* Clear Selection */}
              <button
                type="button"
                onClick={handleClearSelection}
                style={{
                  background: "transparent",
                  color: "#94a3b8",
                  border: "1px solid #334155",
                  padding: "6px 12px",
                  borderRadius: "7px",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Deselect
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create New ID Choice Modal */}
      {isCreateIdModalOpen && (
        <div className="admin-modal-backdrop" onClick={() => !generatingIds && setIsCreateIdModalOpen(false)}>
          <div className="admin-modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: "540px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", display: "flex", alignItems: "center", gap: "8px", color: "#0f172a" }}>
                <KeyRound size={18} color="#017846" />
                <span>Create New ID Management</span>
              </h3>
              <button
                type="button"
                disabled={generatingIds}
                onClick={() => setIsCreateIdModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px" }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: "12.5px", color: "#475569", margin: "0 0 16px 0", lineHeight: 1.5 }}>
              Choose how you would like to generate unique access IDs for candidates in <b>{selectedRound === "ROUND_1" ? "Round 1 (MCQ Assessment)" : "Round 2 (Coding Assessment)"}</b>. All IDs strictly enforce the 3-attempt limit.
            </p>

            {/* Option 1: All Candidates */}
            <div
              onClick={() => setCreateIdChoice("ALL")}
              style={{
                border: createIdChoice === "ALL" ? "2px solid #017846" : "1.5px solid #e2e8f0",
                background: createIdChoice === "ALL" ? "#f0fdf4" : "#ffffff",
                borderRadius: "10px",
                padding: "12px 14px",
                marginBottom: "12px",
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
            >
              <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="createIdChoice"
                  checked={createIdChoice === "ALL"}
                  onChange={() => setCreateIdChoice("ALL")}
                  style={{ marginTop: "3px", accentColor: "#017846", cursor: "pointer" }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: "13.5px", color: "#0f172a" }}>Option 1: Create New IDs for All Candidates</strong>
                    <span style={{ fontSize: "11px", fontWeight: 700, background: "#dcfce7", color: "#166534", padding: "2px 8px", borderRadius: "999px" }}>
                      {roundEligibleCandidates.length} Candidates
                    </span>
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b", lineHeight: 1.4 }}>
                    Generate new unique IDs for every candidate in this round. Existing IDs will be cleanly regenerated and saved in the database.
                  </p>
                </div>
              </label>
            </div>

            {/* Option 2: Selected Candidates */}
            <div
              onClick={() => setCreateIdChoice("SELECTED")}
              style={{
                border: createIdChoice === "SELECTED" ? "2px solid #017846" : "1.5px solid #e2e8f0",
                background: createIdChoice === "SELECTED" ? "#f0fdf4" : "#ffffff",
                borderRadius: "10px",
                padding: "12px 14px",
                marginBottom: "16px",
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
            >
              <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer" }}>
                <input
                  type="radio"
                  name="createIdChoice"
                  checked={createIdChoice === "SELECTED"}
                  onChange={() => setCreateIdChoice("SELECTED")}
                  style={{ marginTop: "3px", accentColor: "#017846", cursor: "pointer" }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: "13.5px", color: "#0f172a" }}>Option 2: Create New IDs for Selected Candidates</strong>
                    <span style={{ 
                      fontSize: "11px", 
                      fontWeight: 700, 
                      background: selectedIds.size > 0 ? "#e0f2fe" : "#f1f5f9", 
                      color: selectedIds.size > 0 ? "#0369a1" : "#64748b", 
                      padding: "2px 8px", 
                      borderRadius: "999px" 
                    }}>
                      {selectedIds.size} Selected
                    </span>
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#64748b", lineHeight: 1.4 }}>
                    Generate new unique IDs only for candidates currently checked in the table. Unchecked candidates retain their existing IDs.
                  </p>
                  {selectedIds.size === 0 && (
                    <small style={{ display: "block", marginTop: "6px", color: "#d97706", fontWeight: 600 }}>
                      ⚠️ No candidates currently selected. Check candidate boxes in the table or choose Option 1.
                    </small>
                  )}
                </div>
              </label>
            </div>

            {/* Modal Footer */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                className="secondary"
                disabled={generatingIds}
                onClick={() => setIsCreateIdModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                disabled={generatingIds || (createIdChoice === "SELECTED" && selectedIds.size === 0)}
                onClick={() => {
                  if (createIdChoice === "ALL") {
                    handleGenerateAllIds();
                  } else {
                    handleGenerateSelectedIds();
                  }
                }}
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                {generatingIds ? <Loader2 size={14} className="spin" /> : <KeyRound size={14} />}
                <span>
                  {generatingIds 
                    ? "Generating IDs..." 
                    : createIdChoice === "ALL" 
                      ? `Generate for All (${roundEligibleCandidates.length})` 
                      : `Generate for Selected (${selectedIds.size})`
                  }
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

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
                {uploadingCsv ? "Ingesting..." : "Upload & Ingest to Database"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Email Dispatch Modal */}
      {isBatchEmailModalOpen && (
        <div className="admin-modal-backdrop" onClick={() => !batchEmailJob && setIsBatchEmailModalOpen(false)}>
          <div className="admin-modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: "520px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <h3 style={{ margin: 0, fontSize: "16px", display: "flex", alignItems: "center", gap: "8px", color: "#0f172a" }}>
                <Mail size={18} color="#017846" /> Batch Email Dispatch ({selectedRound === "ROUND_1" ? "Round 1 MCQ" : "Round 2 Coding"})
              </h3>
              <button
                type="button"
                disabled={batchEmailJob?.status === "PROCESSING"}
                onClick={() => {
                  setIsBatchEmailModalOpen(false);
                  setBatchEmailJob(null);
                }}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px" }}
              >
                ✕
              </button>
            </div>

            {!batchEmailJob ? (
              <div>
                <p style={{ fontSize: "13px", color: "#475569", lineHeight: 1.5, margin: "0 0 16px 0" }}>
                  This will initiate an asynchronous, rate-throttled batch email dispatch of <b>Unique Access IDs</b> to all <b>{roundEligibleCandidates.length}</b> eligible candidates in <b>{selectedRound === "ROUND_1" ? "Round 1 (MCQ Assessment)" : "Round 2 (Coding Assessment)"}</b>.
                </p>
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px", fontSize: "12px", color: "#334155", marginBottom: "16px" }}>
                  <ul style={{ margin: 0, paddingLeft: "16px", lineHeight: 1.6 }}>
                    <li>Access codes are valid for strictly <b>3 attempts/resumptions</b>.</li>
                    <li>Sent with anti-spam rate limiting (1.2s delay per candidate).</li>
                    <li>Includes direct examination link and portal credentials.</li>
                  </ul>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                  <button type="button" className="secondary" onClick={() => setIsBatchEmailModalOpen(false)}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="primary"
                    disabled={batchEmailStarting || roundEligibleCandidates.length === 0}
                    onClick={handleStartBatchEmail}
                    style={{ display: "flex", alignItems: "center", gap: "6px" }}
                  >
                    {batchEmailStarting ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                    <span>{batchEmailStarting ? "Starting Dispatch..." : `Send to ${roundEligibleCandidates.length} Candidates`}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 600, color: "#0f172a", marginBottom: "6px" }}>
                    <span>Dispatch Progress</span>
                    <span>
                      {batchEmailJob.sentCount} / {batchEmailJob.totalCandidates} sent
                      {batchEmailJob.failedCount > 0 && ` (${batchEmailJob.failedCount} failed)`}
                    </span>
                  </div>
                  {/* Progress Bar */}
                  <div style={{ width: "100%", height: "10px", background: "#e2e8f0", borderRadius: "6px", overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      background: batchEmailJob.status === "COMPLETED" ? "#10b981" : "#0284c7",
                      width: `${batchEmailJob.totalCandidates > 0 ? Math.round((batchEmailJob.sentCount / batchEmailJob.totalCandidates) * 100) : 0}%`,
                      transition: "width 0.3s ease"
                    }} />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", padding: "10px 14px", borderRadius: "8px", fontSize: "12px", marginBottom: "16px" }}>
                  <span style={{ color: "#64748b" }}>
                    Status: <b style={{ color: batchEmailJob.status === "COMPLETED" ? "#16a34a" : "#0284c7" }}>{batchEmailJob.status}</b>
                  </span>
                  <span style={{ color: "#64748b" }}>
                    Provider: <b style={{ color: "#0f172a" }}>{batchEmailJob.provider}</b>
                  </span>
                </div>

                {batchEmailJob.status === "COMPLETED" && (
                  <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "12px", borderRadius: "8px", color: "#166534", fontSize: "12.5px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
                    <CheckCircle2 size={18} color="#16a34a" />
                    <span>All candidate Unique Access IDs have been successfully dispatched!</span>
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button
                    type="button"
                    className="primary"
                    disabled={batchEmailJob.status === "PROCESSING"}
                    onClick={() => {
                      setIsBatchEmailModalOpen(false);
                      setBatchEmailJob(null);
                      fetchCandidates();
                    }}
                  >
                    {batchEmailJob.status === "PROCESSING" ? "Dispatching..." : "Done"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

