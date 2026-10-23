/**
 * Coding Examination Service & Types
 * Manages configuration, drafts, and API contracts for Round 2 Coding Assessments.
 * 
 * BACKEND INTEGRATION NOTE:
 * When the Java/Spring Boot backend implements Coding Assessment endpoints,
 * map these functions to:
 * - POST   /api/admin/exams/coding        -> Create coding exam
 * - GET    /api/admin/exams/coding        -> List coding exams
 * - GET    /api/admin/exams/coding/:id    -> Get coding exam with questions & test cases
 * - PUT    /api/admin/exams/coding/:id    -> Update coding exam
 * - POST   /api/admin/exams/coding/:id/publish -> Publish coding exam
 */

export type SupportedLanguage = 
  | "cpp" 
  | "java" 
  | "python3" 
  | "python" 
  | "javascript" 
  | "typescript" 
  | "csharp" 
  | "c";

export interface LanguageMeta {
  id: SupportedLanguage;
  name: string;
  version: string;
  extension: string;
  popular?: boolean;
}

export const ALL_SUPPORTED_LANGUAGES: LanguageMeta[] = [
  { id: "cpp", name: "C++", version: "GCC 11 (C++20)", extension: ".cpp", popular: true },
  { id: "java", name: "Java", version: "OpenJDK 17/21", extension: ".java", popular: true },
  { id: "python3", name: "Python 3", version: "Python 3.11", extension: ".py", popular: true },
  { id: "python", name: "Python 2", version: "Python 2.7 (Legacy)", extension: ".py" },
  { id: "javascript", name: "JavaScript", version: "Node.js 20 LTS", extension: ".js", popular: true },
  { id: "typescript", name: "TypeScript", version: "TS 5.4 / Node.js", extension: ".ts" },
  { id: "csharp", name: "C#", version: ".NET 8.0 SDK", extension: ".cs" },
  { id: "c", name: "C", version: "GCC 11 (C17)", extension: ".c" }
];

export interface TestCaseDto {
  id: string;
  label: string;
  input: string;
  expectedOutput: string;
  isHidden: boolean; // false = sample/public testcase; true = hidden/evaluation testcase
  marks: number;     // Weightage if partial scoring is enabled
  explanation?: string;
}

export interface CodingQuestionDto {
  id: string;
  title: string;
  problemStatement: string;
  difficulty: "Easy" | "Medium" | "Hard";
  maxMarks: number;
  inputFormat: string;
  outputFormat: string;
  constraints: string;
  sampleInput: string;
  sampleOutput: string;
  sampleExplanation: string;
  allowedLanguages: SupportedLanguage[]; // Empty array implies all exam languages
  testCases: TestCaseDto[];
  timeLimitMs?: number;   // default 2000 ms
  memoryLimitMb?: number; // default 256 MB
}

export interface CodingExamDto {
  id?: number | string;
  title: string;
  description: string;
  instructions: string;
  durationMinutes: number;
  timingMode: "DURATION_FROM_START" | "SCHEDULED";
  examDate?: string;
  startTime?: string;
  selectedDepartments: string[]; // e.g. ["Developer", "Tester", "Computer Science & Engineering"]
  allowedLanguages: SupportedLanguage[];
  evaluationMode: "ALL_OR_NOTHING" | "PARTIAL_PER_TESTCASE";
  qualificationPercentage: number;
  questions: CodingQuestionDto[];
  totalMarks: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  createdAt?: string;
  updatedAt?: string;
}

const CODING_EXAMS_LOCAL_STORAGE_KEY = "examsecure_coding_exams_drafts_v1";

/**
 * Starter boilerplate question for admin convenience
 */
export const SAMPLE_INITIAL_CODING_QUESTION: CodingQuestionDto = {
  id: "q-sample-1",
  title: "Target Pair Sum in Sorted Array",
  problemStatement: "Given an array of integers `nums` that is already sorted in ascending order and an integer `target`, find two distinct indices such that the numbers at those indices add up to `target`.\n\nReturn the 1-based indices of the two numbers `[index1, index2]` separated by a single space. You may assume that each input will have exactly one solution, and you may not use the same element twice.",
  difficulty: "Easy",
  maxMarks: 20,
  inputFormat: "The first line contains an integer N, the size of the array.\nThe second line contains N space-separated integers representing the array elements.\nThe third line contains an integer Target.",
  outputFormat: "Print two space-separated integers denoting the 1-based indices [index1, index2] in ascending order.",
  constraints: "2 <= N <= 10^5\n-10^9 <= nums[i] <= 10^9\nnums is sorted in non-decreasing order.\n-10^9 <= target <= 10^9\nExactly one valid answer exists.",
  sampleInput: "4\n2 7 11 15\n9",
  sampleOutput: "1 2",
  sampleExplanation: "The sum of 2 and 7 is 9. Therefore, index1 = 1, index2 = 2. We return 1 2.",
  allowedLanguages: ["cpp", "java", "python3", "javascript", "csharp", "c"],
  timeLimitMs: 2000,
  memoryLimitMb: 256,
  testCases: [
    {
      id: "tc-1",
      label: "Sample Case 1",
      input: "4\n2 7 11 15\n9",
      expectedOutput: "1 2",
      isHidden: false,
      marks: 5,
      explanation: "Standard positive array sum"
    },
    {
      id: "tc-2",
      label: "Sample Case 2",
      input: "3\n2 3 4\n6",
      expectedOutput: "1 3",
      isHidden: false,
      marks: 5,
      explanation: "Non-adjacent pair sum"
    },
    {
      id: "tc-3",
      label: "Hidden Evaluation Case 1",
      input: "5\n-10 -3 0 5 9\n-1",
      expectedOutput: "1 5",
      isHidden: true,
      marks: 5,
      explanation: "Handles negative and positive boundaries"
    },
    {
      id: "tc-4",
      label: "Hidden Evaluation Case 2 (Large)",
      input: "6\n1 2 3 4 4 9\n8",
      expectedOutput: "4 5",
      isHidden: true,
      marks: 5,
      explanation: "Duplicate number sum handling"
    }
  ]
};

/**
 * Retrieve saved coding examinations from local drafts store
 */
export function getSavedCodingExams(): CodingExamDto[] {
  try {
    const raw = localStorage.getItem(CODING_EXAMS_LOCAL_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as CodingExamDto[];
  } catch (err) {
    console.warn("[codingExamService] Failed to read coding exams from localStorage:", err);
    return [];
  }
}

/**
 * Save or update a coding examination draft in local store
 */
export function saveCodingExamDraft(exam: CodingExamDto): CodingExamDto {
  const all = getSavedCodingExams();
  const id = exam.id || `code-exam-${Date.now()}`;
  const now = new Date().toISOString();
  
  const updatedExam: CodingExamDto = {
    ...exam,
    id,
    updatedAt: now,
    createdAt: exam.createdAt || now
  };

  const existingIdx = all.findIndex(e => String(e.id) === String(id));
  if (existingIdx !== -1) {
    all[existingIdx] = updatedExam;
  } else {
    all.unshift(updatedExam);
  }

  try {
    localStorage.setItem(CODING_EXAMS_LOCAL_STORAGE_KEY, JSON.stringify(all));
  } catch (err) {
    console.warn("[codingExamService] Failed to write coding exam draft:", err);
  }

  return updatedExam;
}
