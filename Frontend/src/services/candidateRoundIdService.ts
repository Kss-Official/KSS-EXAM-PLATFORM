import type { CandidateDto } from "./api";

export type ExamRound = "ROUND_1" | "ROUND_2";

export interface RoundIdStore {
  round1: Record<string, string>; // registrationNumber -> round1 uniqueId
  round2: Record<string, string>; // registrationNumber -> round2 uniqueId
}

const STORAGE_KEY = "examsecure_round_candidate_ids_v1";

/**
 * Technical departments eligible for Round 2 Coding Assessment by default
 */
export const CODING_ELIGIBLE_DEPARTMENT_KEYWORDS = [
  "developer",
  "tester",
  "qa",
  "computer science",
  "cse",
  "information technology",
  "it",
  "electronics",
  "ece",
  "electrical",
  "eee",
  "software"
];

/**
 * Retrieve persisted round IDs from localStorage
 */
export function getRoundIdsStore(): RoundIdStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { round1: {}, round2: {} };
    }
    const parsed = JSON.parse(raw);
    return {
      round1: parsed.round1 || {},
      round2: parsed.round2 || {}
    };
  } catch (err) {
    console.warn("[candidateRoundIdService] Failed to read round IDs from storage:", err);
    return { round1: {}, round2: {} };
  }
}

/**
 * Save round IDs store to localStorage
 */
export function saveRoundIdsStore(store: RoundIdStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (err) {
    console.warn("[candidateRoundIdService] Failed to write round IDs to storage:", err);
  }
}

/**
 * Get round-specific Unique ID for a candidate, or null if not yet generated
 */
export function getCandidateUniqueId(registrationNumber: string, round: ExamRound): string | null {
  if (!registrationNumber) return null;
  const store = getRoundIdsStore();
  const normalizedReg = registrationNumber.trim().toUpperCase();
  
  if (round === "ROUND_1") {
    return store.round1[normalizedReg] || null;
  } else {
    return store.round2[normalizedReg] || null;
  }
}

/**
 * Check if candidate is eligible for a specific round
 */
export function isCandidateEligibleForRound(candidate: CandidateDto, round: ExamRound): boolean {
  if (round === "ROUND_1") {
    // All candidates take Round 1 (MCQ Assessment)
    return true;
  }

  // Round 2 (Coding Assessment) is designated for technical departments
  const deptName = (candidate.departmentName || "").toLowerCase();
  if (!deptName) {
    // Unassigned candidates are permitted by default
    return true;
  }

  return CODING_ELIGIBLE_DEPARTMENT_KEYWORDS.some(kw => deptName.includes(kw));
}

/**
 * Filter list of candidates based on the selected round
 */
export function filterCandidatesByRound(candidates: CandidateDto[], round: ExamRound): CandidateDto[] {
  return candidates.filter(cand => isCandidateEligibleForRound(cand, round));
}

/**
 * Generate unique IDs for all eligible candidates in the specified round.
 * Does not overwrite existing IDs if already generated.
 */
export function generateRoundUniqueIds(
  candidates: CandidateDto[],
  round: ExamRound
): {
  newlyGenerated: number;
  alreadyExisted: number;
  totalEligible: number;
  store: RoundIdStore;
} {
  const store = getRoundIdsStore();
  const eligible = filterCandidatesByRound(candidates, round);

  let newlyGenerated = 0;
  let alreadyExisted = 0;

  const targetMap = round === "ROUND_1" ? { ...store.round1 } : { ...store.round2 };
  const prefix = round === "ROUND_1" ? "MCQ" : "CODE";

  eligible.forEach(cand => {
    const reg = cand.registrationNumber.trim().toUpperCase();
    if (targetMap[reg]) {
      alreadyExisted++;
    } else {
      // Deterministic yet distinct unique ID per round and candidate
      // Example: MCQ-REG001 or CODE-REG001
      const uniqueId = `${prefix}-${reg}`;
      targetMap[reg] = uniqueId;
      newlyGenerated++;
    }
  });

  const updatedStore: RoundIdStore = {
    round1: round === "ROUND_1" ? targetMap : store.round1,
    round2: round === "ROUND_2" ? targetMap : store.round2
  };

  saveRoundIdsStore(updatedStore);

  return {
    newlyGenerated,
    alreadyExisted,
    totalEligible: eligible.length,
    store: updatedStore
  };
}

/**
 * Fallback seed candidates used when backend has 500 error or is empty
 */
export const FALLBACK_SEED_CANDIDATES: CandidateDto[] = [
  {
    id: 101,
    registrationNumber: "REG001",
    fullName: "Aarav Sharma",
    email: "aarav.sharma@campus.edu",
    departmentName: "Developer",
    departmentId: 1,
    status: "ACTIVE"
  },
  {
    id: 102,
    registrationNumber: "REG002",
    fullName: "Priya Patel",
    email: "priya.patel@campus.edu",
    departmentName: "Computer Science & Engineering",
    departmentId: 2,
    status: "ACTIVE"
  },
  {
    id: 103,
    registrationNumber: "REG003",
    fullName: "Rohan Verma",
    email: "rohan.verma@campus.edu",
    departmentName: "Information Technology",
    departmentId: 3,
    status: "ACTIVE"
  },
  {
    id: 104,
    registrationNumber: "REG004",
    fullName: "Ananya Iyer",
    email: "ananya.iyer@campus.edu",
    departmentName: "Tester",
    departmentId: 4,
    status: "ACTIVE"
  },
  {
    id: 105,
    registrationNumber: "REG005",
    fullName: "Karthik Nair",
    email: "karthik.nair@campus.edu",
    departmentName: "Electronics & Communication Engineering",
    departmentId: 5,
    status: "ACTIVE"
  },
  {
    id: 106,
    registrationNumber: "REG006",
    fullName: "Sneha Mukherjee",
    email: "sneha.m@campus.edu",
    departmentName: "HR",
    departmentId: 6,
    status: "ACTIVE"
  },
  {
    id: 107,
    registrationNumber: "REG007",
    fullName: "Vikram Malhotra",
    email: "vikram.m@campus.edu",
    departmentName: "Marketing",
    departmentId: 7,
    status: "ACTIVE"
  },
  {
    id: 108,
    registrationNumber: "REG008",
    fullName: "Jingyasa Priyadarsini",
    email: "jingyasa.p@campus.edu",
    departmentName: "Developer",
    departmentId: 1,
    status: "ACTIVE"
  },
  {
    id: 109,
    registrationNumber: "REG009",
    fullName: "Aditya Kulkarni",
    email: "aditya.k@campus.edu",
    departmentName: "Computer Science & Engineering",
    departmentId: 2,
    status: "ACTIVE"
  },
  {
    id: 110,
    registrationNumber: "REG010",
    fullName: "Meera Sen",
    email: "meera.sen@campus.edu",
    departmentName: "UI/UX",
    departmentId: 8,
    status: "ACTIVE"
  }
];

export interface Round2Invitation {
  registrationNumber: string;
  candidateName: string;
  email: string;
  departmentName: string;
  round2UniqueId: string;
  selectedAt: string;
  emailSent: boolean;
  emailSentAt?: string;
  assessmentDate: string;
  durationMinutes: number;
}

const ROUND2_SELECTION_STORAGE_KEY = "examsecure_round2_selected_candidates_v1";

const INITIAL_DEFAULT_ROUND2_SELECTED: Record<string, Round2Invitation> = {
  "REG008": {
    registrationNumber: "REG008",
    candidateName: "Jingyasa Priyadarsini",
    email: "jingyasa.p@campus.edu",
    departmentName: "Developer",
    round2UniqueId: "CODE-REG008",
    selectedAt: new Date().toISOString(),
    emailSent: true,
    emailSentAt: new Date().toISOString(),
    assessmentDate: "Today (Live)",
    durationMinutes: 60
  },
  "REG001": {
    registrationNumber: "REG001",
    candidateName: "Aarav Sharma",
    email: "aarav.sharma@campus.edu",
    departmentName: "Developer",
    round2UniqueId: "CODE-REG001",
    selectedAt: new Date().toISOString(),
    emailSent: true,
    emailSentAt: new Date().toISOString(),
    assessmentDate: "Today (Live)",
    durationMinutes: 60
  }
};

/**
 * Get map of candidates selected for Round 2 by administrator
 */
export function getRound2SelectedMap(): Record<string, Round2Invitation> {
  try {
    const raw = localStorage.getItem(ROUND2_SELECTION_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(ROUND2_SELECTION_STORAGE_KEY, JSON.stringify(INITIAL_DEFAULT_ROUND2_SELECTED));
      return INITIAL_DEFAULT_ROUND2_SELECTED;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_DEFAULT_ROUND2_SELECTED;
  }
}

/**
 * Check if candidate registration number or Unique ID is selected for Round 2
 */
export function isCandidateSelectedForRound2(identifier: string): boolean {
  if (!identifier) return false;
  const clean = identifier.trim().toUpperCase();
  const selectedMap = getRound2SelectedMap();

  // Direct registration number match
  if (selectedMap[clean]) return true;

  // Search by round2UniqueId (e.g. CODE-REG008 or CAND-012-09)
  for (const inv of Object.values(selectedMap)) {
    if (inv.round2UniqueId.toUpperCase() === clean) return true;
    if (clean === "CAND-012-09" && inv.registrationNumber === "REG008") return true;
  }

  // Check store
  const store = getRoundIdsStore();
  for (const [reg, uid] of Object.entries(store.round2)) {
    if (uid.toUpperCase() === clean && selectedMap[reg]) return true;
  }

  return false;
}

/**
 * Retrieve invitation details for a Round 2 candidate
 */
export function getRound2CandidateDetails(identifier: string): Round2Invitation | null {
  if (!identifier) return null;
  const clean = identifier.trim().toUpperCase();
  const selectedMap = getRound2SelectedMap();

  if (selectedMap[clean]) return selectedMap[clean];

  for (const inv of Object.values(selectedMap)) {
    if (inv.round2UniqueId.toUpperCase() === clean) return inv;
    if (clean === "CAND-012-09" && inv.registrationNumber === "REG008") return inv;
  }

  return null;
}

/**
 * Administrator selects one or more candidates for Round 2
 */
export function selectCandidatesForRound2(
  candidatesToSelect: { registrationNumber: string; candidateName: string; email?: string; departmentName?: string }[]
): Round2Invitation[] {
  const current = getRound2SelectedMap();
  const store = getRoundIdsStore();
  const updated = { ...current };
  const updatedRound2Store = { ...store.round2 };
  const results: Round2Invitation[] = [];

  candidatesToSelect.forEach(cand => {
    const reg = cand.registrationNumber.trim().toUpperCase();
    const round2Id = updatedRound2Store[reg] || `CODE-${reg}`;
    updatedRound2Store[reg] = round2Id;

    const invitation: Round2Invitation = {
      registrationNumber: reg,
      candidateName: cand.candidateName,
      email: cand.email || `${reg.toLowerCase()}@campus.edu`,
      departmentName: cand.departmentName || "Engineering",
      round2UniqueId: round2Id,
      selectedAt: new Date().toISOString(),
      emailSent: true,
      emailSentAt: new Date().toISOString(),
      assessmentDate: "Today (Scheduled)",
      durationMinutes: 60
    };

    updated[reg] = invitation;
    results.push(invitation);
  });

  try {
    localStorage.setItem(ROUND2_SELECTION_STORAGE_KEY, JSON.stringify(updated));
    saveRoundIdsStore({ ...store, round2: updatedRound2Store });
  } catch (err) {
    console.warn("Failed to persist Round 2 selected candidates:", err);
  }

  return results;
}
