import type { 
  AdminQuestion, 
  AnswerKeyDraft, 
  QuestionOption, 
  QuestionSetKey, 
  QuestionSetSummary 
} from "../types/adminExam";
import type { Exam } from "../types";

export const ADMIN_EXAMS_STORAGE_KEY = "secureexam:admin-exam-drafts:v1";

/**
 * Standard seed demo questions for Set A, Set B, Set C, Set D.
 * Each set is kept distinct to fulfill 4-set requirements.
 */
function createInitialQuestion(
  id: string,
  setKey: QuestionSetKey,
  qNum: number,
  text: string,
  opts: string[],
  correctIndex: number,
  subject: string,
  difficulty: "EASY" | "MEDIUM" | "HARD" = "EASY",
  marks = 1
): AdminQuestion {
  const options: QuestionOption[] = opts.map((t, i) => ({
    id: `opt_${setKey.toLowerCase()}_${qNum}_${i}`,
    label: (["A", "B", "C", "D"][i] || "A") as "A" | "B" | "C" | "D",
    text: t
  }));

  return {
    id,
    setKey,
    questionNumber: qNum,
    text,
    options,
    correctOptionId: options[correctIndex]?.id || options[0].id,
    marks,
    subject,
    difficulty
  };
}

export const INITIAL_QUESTION_SETS: Record<QuestionSetKey, AdminQuestion[]> = {
  SET_A: [
    createInitialQuestion("QA-1", "SET_A", 1, "Which principle of OOP allows a class to inherit state and behavior from a parent class?", ["Encapsulation", "Inheritance", "Polymorphism", "Abstraction"], 1, "Java & OOP"),
    createInitialQuestion("QA-2", "SET_A", 2, "Which SQL clause is used to filter records based on aggregate functions?", ["WHERE", "GROUP BY", "HAVING", "ORDER BY"], 2, "Databases & SQL"),
    createInitialQuestion("QA-3", "SET_A", 3, "What data structure operates under the Last In First Out (LIFO) order?", ["Queue", "Stack", "Linked List", "Binary Tree"], 1, "Data Structures"),
    createInitialQuestion("QA-4", "SET_A", 4, "Which HTTP status code signifies that a requested resource was created successfully?", ["200 OK", "201 Created", "204 No Content", "301 Redirect"], 1, "Web Fundamentals"),
    createInitialQuestion("QA-5", "SET_A", 5, "What is the primary role of Inversion of Control (IoC) in Spring Framework?", ["Compile Java code", "Decouple component creation and dependency wiring", "Encrypt database passwords", "Perform load testing"], 1, "Spring Boot", "MEDIUM", 2)
  ],
  SET_B: [
    createInitialQuestion("QB-1", "SET_B", 1, "Which keyword in Java prevents a class from being inherited or sub-classed?", ["static", "abstract", "final", "synchronized"], 2, "Java & OOP"),
    createInitialQuestion("QB-2", "SET_B", 2, "In relational algebra, which operation combines tuples from two relations matching a common field?", ["Union", "Cartesian Product", "Inner Join", "Projection"], 2, "Databases & SQL"),
    createInitialQuestion("QB-3", "SET_B", 3, "What is the worst-case time complexity of searching in an unbalanced Binary Search Tree?", ["O(1)", "O(log n)", "O(n)", "O(n log n)"], 2, "Data Structures"),
    createInitialQuestion("QB-4", "SET_B", 4, "Which REST HTTP verb is considered idempotent and used to replace an entire resource entity?", ["POST", "PUT", "PATCH", "DELETE"], 1, "Web Fundamentals"),
    createInitialQuestion("QB-5", "SET_B", 5, "In Spring Boot, which annotation marks a class as a source of bean definitions?", ["@Component", "@Service", "@Configuration", "@Repository"], 2, "Spring Boot", "MEDIUM", 2)
  ],
  SET_C: [
    createInitialQuestion("QC-1", "SET_C", 1, "Which Java collection permits key-value mappings with null keys and null values?", ["TreeMap", "Hashtable", "HashMap", "ConcurrentHashMap"], 2, "Java & OOP"),
    createInitialQuestion("QC-2", "SET_C", 2, "Which ACID property guarantees that database transactions are fully completed or rolled back completely?", ["Atomicity", "Consistency", "Isolation", "Durability"], 0, "Databases & SQL"),
    createInitialQuestion("QC-3", "SET_C", 3, "What queue implementation allows inserting and deleting elements at both ends in O(1)?", ["PriorityQueue", "Deque", "CircularBuffer", "Heap"], 1, "Data Structures"),
    createInitialQuestion("QC-4", "SET_C", 4, "Which HTTP response header is required by browsers to enforce HTTPS across future connections?", ["Strict-Transport-Security", "X-Frame-Options", "Content-Security-Policy", "X-Content-Type-Options"], 0, "Web Security"),
    createInitialQuestion("QC-5", "SET_C", 5, "Which Spring annotation injects property values directly from application.properties?", ["@Autowired", "@Value", "@Qualifier", "@PathVariable"], 1, "Spring Boot", "MEDIUM", 2)
  ],
  SET_D: [
    createInitialQuestion("QD-1", "SET_D", 1, "Which memory area in JVM stores Java class metadata and bytecode?", ["Heap Memory", "Stack Memory", "Metaspace", "Program Counter"], 2, "Java & JVM"),
    createInitialQuestion("QD-2", "SET_D", 2, "What is the default isolation level in PostgreSQL?", ["Read Uncommitted", "Read Committed", "Repeatable Read", "Serializable"], 1, "Databases & SQL"),
    createInitialQuestion("QD-3", "SET_D", 3, "Which sorting algorithm is guaranteed to be stable and achieves O(n log n) in all cases?", ["QuickSort", "HeapSort", "MergeSort", "SelectionSort"], 2, "Data Structures"),
    createInitialQuestion("QD-4", "SET_D", 4, "Which protocol upgrades an existing HTTP/1.1 connection to a full-duplex TCP channel?", ["HTTP/2", "WebSocket", "gRPC", "MQTT"], 1, "Web Fundamentals"),
    createInitialQuestion("QD-5", "SET_D", 5, "In Spring Boot actuator, which endpoint reports service liveness and readiness probes?", ["/metrics", "/health", "/env", "/beans"], 1, "Spring Boot", "MEDIUM", 2)
  ]
};

export const INITIAL_ANSWER_KEYS: Record<QuestionSetKey, AnswerKeyDraft> = {
  SET_A: {
    setKey: "SET_A",
    fileName: "Official_AnswerKey_SetA_v1.txt",
    fileSize: "1.2 KB",
    uploadedAt: new Date().toLocaleDateString(),
    entries: { 1: "B", 2: "C", 3: "B", 4: "B", 5: "B" },
    isValidated: true,
    validationErrors: [],
    isDemoDraft: true
  },
  SET_B: {
    setKey: "SET_B",
    fileName: "Official_AnswerKey_SetB_v1.txt",
    fileSize: "1.1 KB",
    uploadedAt: new Date().toLocaleDateString(),
    entries: { 1: "C", 2: "C", 3: "C", 4: "B", 5: "C" },
    isValidated: true,
    validationErrors: [],
    isDemoDraft: true
  },
  SET_C: {
    setKey: "SET_C",
    fileName: "Official_AnswerKey_SetC_v1.txt",
    fileSize: "1.1 KB",
    uploadedAt: new Date().toLocaleDateString(),
    entries: { 1: "C", 2: "A", 3: "B", 4: "A", 5: "B" },
    isValidated: true,
    validationErrors: [],
    isDemoDraft: true
  },
  SET_D: {
    setKey: "SET_D",
    fileName: "Official_AnswerKey_SetD_v1.txt",
    fileSize: "1.2 KB",
    uploadedAt: new Date().toLocaleDateString(),
    entries: { 1: "C", 2: "B", 3: "C", 4: "B", 5: "B" },
    isValidated: true,
    validationErrors: [],
    isDemoDraft: true
  }
};

/**
 * Load admin exam drafts from localStorage
 */
export function loadAdminExamDrafts(): Exam[] {
  try {
    const raw = localStorage.getItem(ADMIN_EXAMS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Exam[];
  } catch (err) {
    console.error("[AdminExamStorage] Error loading exam drafts:", err);
    return [];
  }
}

/**
 * Save an exam draft to local demo storage
 */
export function saveAdminExamDraft(exam: Exam): void {
  try {
    const existing = loadAdminExamDrafts();
    const index = existing.findIndex((e) => e.id === exam.id);
    let updated: Exam[];
    if (index >= 0) {
      updated = [...existing];
      updated[index] = exam;
    } else {
      updated = [exam, ...existing];
    }
    localStorage.setItem(ADMIN_EXAMS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("[AdminExamStorage] Error saving exam draft:", err);
  }
}

/**
 * Delete an exam draft from local demo storage
 */
export function deleteAdminExamDraft(examId: string): boolean {
  try {
    const existing = loadAdminExamDrafts();
    const filtered = existing.filter((e) => e.id !== examId);
    localStorage.setItem(ADMIN_EXAMS_STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (err) {
    console.error("[AdminExamStorage] Error deleting exam draft:", err);
    return false;
  }
}

/**
 * Calculate Summary for Question Sets (Set A, B, C, D)
 */
export function computeQuestionSetSummaries(
  questionSets: Record<QuestionSetKey, AdminQuestion[]>,
  answerKeys: Partial<Record<QuestionSetKey, AnswerKeyDraft>>
): Record<QuestionSetKey, QuestionSetSummary> {
  const keys: QuestionSetKey[] = ["SET_A", "SET_B", "SET_C", "SET_D"];
  const result = {} as Record<QuestionSetKey, QuestionSetSummary>;

  keys.forEach((key) => {
    const qList = questionSets[key] || [];
    const ak = answerKeys[key];
    const validQuestions = qList.filter(
      (q) => q.text.trim() && q.options.length === 4 && q.options.every((o) => o.text.trim()) && q.correctOptionId
    );
    const totalMarks = validQuestions.reduce((sum, q) => sum + (q.marks || 1), 0);

    let akStatus: QuestionSetSummary["answerKeyStatus"] = "MISSING";
    if (ak) {
      if (ak.isValidated && ak.validationErrors.length === 0) {
        akStatus = "VALIDATED";
      } else if (ak.validationErrors.length > 0) {
        akStatus = "ERROR";
      } else {
        akStatus = "PENDING";
      }
    }

    result[key] = {
      setKey: key,
      title: key.replace("_", " "),
      totalQuestions: qList.length,
      validQuestionsCount: validQuestions.length,
      incompleteQuestionsCount: qList.length - validQuestions.length,
      totalMarks,
      hasAnswerKey: !!ak && ak.isValidated,
      answerKeyStatus: akStatus
    };
  });

  return result;
}

/**
 * Parses raw text formatted questions into structured AdminQuestion array.
 * Supports standard formats:
 * Question: What is OOP?
 * A. ...
 * B. ...
 * C. ...
 * D. ...
 * Answer: B
 * Marks: 1
 */
export function parseQuestionsFromText(
  rawText: string,
  targetSet: QuestionSetKey,
  startingQuestionNumber = 1
): { questions: AdminQuestion[]; errors: string[] } {
  const errors: string[] = [];
  const questions: AdminQuestion[] = [];

  const rawBlocks = rawText.split(/(?:^|\n)(?=Question\s*\d*[:.-]|\d+[\.\)]\s+)/i);

  let qNumber = startingQuestionNumber;

  rawBlocks.forEach((block, blockIndex) => {
    const trimmed = block.trim();
    if (!trimmed) return;

    const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 5) {
      // Need at least question text + 4 options
      errors.push(`Block ${blockIndex + 1} does not have enough lines to form a complete 4-option MCQ.`);
      return;
    }

    const firstLine = lines[0];
    const qText = firstLine.replace(/^(?:Question\s*\d*[:.-]|\d+[\.\)]\s*)/i, "").trim();

    // Extract options A, B, C, D
    const options: QuestionOption[] = [];
    let correctLetter: "A" | "B" | "C" | "D" = "A";
    let marks = 1;

    lines.slice(1).forEach((line) => {
      const optMatch = line.match(/^([A-D])[\.\)\:\-]\s*(.+)$/i);
      if (optMatch) {
        const letter = optMatch[1].toUpperCase() as "A" | "B" | "C" | "D";
        options.push({
          id: `opt_${targetSet.toLowerCase()}_${qNumber}_${letter}`,
          label: letter,
          text: optMatch[2].trim()
        });
      }

      const ansMatch = line.match(/^(?:Answer|Correct\s*Answer|Ans|Key)[\:\s\-]+([A-D])/i);
      if (ansMatch) {
        correctLetter = ansMatch[1].toUpperCase() as "A" | "B" | "C" | "D";
      }

      const markMatch = line.match(/^Marks[\:\s\-]+(\d+(?:\.\d+)?)/i);
      if (markMatch) {
        marks = parseFloat(markMatch[1]) || 1;
      }
    });

    if (options.length < 4) {
      errors.push(`Question "${qText.substring(0, 30)}..." has only ${options.length} recognized options (expected 4).`);
      return;
    }

    const correctOpt = options.find((o) => o.label === correctLetter) || options[0];

    questions.push({
      id: `Q-${targetSet}-${qNumber}`,
      setKey: targetSet,
      questionNumber: qNumber,
      text: qText,
      options: options.slice(0, 4),
      correctOptionId: correctOpt.id,
      marks,
      subject: "Imported Document",
      difficulty: "EASY"
    });

    qNumber++;
  });

  return { questions, errors };
}

/**
 * Parses structured Answer Key text formatted as:
 * Set A
 * 1. B
 * 2. D
 * ...
 * Set B
 * 1. C
 * ...
 */
export function parseAnswerKeyText(rawText: string): Record<QuestionSetKey, Record<number, "A" | "B" | "C" | "D">> {
  const result: Record<QuestionSetKey, Record<number, "A" | "B" | "C" | "D">> = {
    SET_A: {},
    SET_B: {},
    SET_C: {},
    SET_D: {}
  };

  let currentSet: QuestionSetKey = "SET_A";
  const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);

  lines.forEach((line) => {
    // Detect Set header
    if (/^Set\s*A/i.test(line)) {
      currentSet = "SET_A";
      return;
    }
    if (/^Set\s*B/i.test(line)) {
      currentSet = "SET_B";
      return;
    }
    if (/^Set\s*C/i.test(line)) {
      currentSet = "SET_C";
      return;
    }
    if (/^Set\s*D/i.test(line)) {
      currentSet = "SET_D";
      return;
    }

    // Match question number and answer letter: e.g. "1. B" or "1: D" or "1 B"
    const match = line.match(/^(\d+)[\.\:\-\s]+([A-D])/i);
    if (match) {
      const qNum = parseInt(match[1], 10);
      const letter = match[2].toUpperCase() as "A" | "B" | "C" | "D";
      if (!isNaN(qNum) && qNum > 0) {
        result[currentSet][qNum] = letter;
      }
    }
  });

  return result;
}
