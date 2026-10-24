import type { ParsedQuestionDto } from "../services/api";

export type PrimaryDepartmentType = "TECHNICAL" | "NON_TECHNICAL";

export interface SubDepartmentItem {
  id?: number; // Backend department ID if mapped/synced
  tempId: string;
  name: string;
  code: string;
  description?: string;
  category: PrimaryDepartmentType;
  isDefault?: boolean;
}

export type SetCode = "A" | "B" | "C" | "D";

export interface QuestionSetSlot {
  questionPaperFile?: File | null;
  answerKeyFile?: File | null;
  parsedQuestions: ParsedQuestionDto[];
  extracting: boolean;
}

export interface CategoryQuestionBankState {
  masterQuestionPaperFile?: File | null;
  masterAnswerKeyFile?: File | null;
  masterQuestions?: ParsedQuestionDto[];
  extracting?: boolean;
  sets: Record<SetCode, QuestionSetSlot>;
  randomizeQuestions: boolean;
}

/**
 * Automatically derives 4 distinct question sets (Sets A, B, C, D) from a single master upload.
 * When randomize is true:
 * - Questions and option sequences are pseudo-randomly shuffled for sets B, C, D while keeping answer keys synchronized.
 * When randomize is false:
 * - All 4 sets receive the exact identical question ordering.
 */
export function generateShuffledSets(
  masterQuestions: ParsedQuestionDto[],
  randomize: boolean
): Record<SetCode, ParsedQuestionDto[]> {
  if (!masterQuestions || masterQuestions.length === 0) {
    return { A: [], B: [], C: [], D: [] };
  }

  if (!randomize) {
    return {
      A: [...masterQuestions],
      B: [...masterQuestions],
      C: [...masterQuestions],
      D: [...masterQuestions]
    };
  }

  const shuffleWithSeed = <T>(items: T[], seed: number): T[] => {
    const copy = [...items];
    let currentSeed = seed;
    for (let i = copy.length - 1; i > 0; i--) {
      currentSeed = (currentSeed * 9301 + 49297) % 233280;
      const j = Math.floor((currentSeed / 233280) * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const shuffleQuestionOptions = (q: ParsedQuestionDto, seed: number): ParsedQuestionDto => {
    if (!q.options || q.options.length <= 1) return { ...q };

    const standardLabels = ["A", "B", "C", "D", "E", "F"];

    // Identify current correct option
    const correctOpt = q.options.find(
      opt => (q.correctOption && opt.label?.toUpperCase() === q.correctOption.toUpperCase()) || opt.correct
    );
    const correctText = correctOpt ? correctOpt.optionText : null;

    const shuffled = shuffleWithSeed(q.options, seed);
    let newCorrectLabel = q.correctOption || "A";

    const mapped = shuffled.map((opt, idx) => {
      const label = standardLabels[idx] || String.fromCharCode(65 + idx);
      const isCorrect = correctText !== null ? opt.optionText === correctText : opt.correct;
      if (isCorrect) {
        newCorrectLabel = label;
      }
      return {
        ...opt,
        label,
        correct: isCorrect
      };
    });

    return {
      ...q,
      options: mapped,
      correctOption: newCorrectLabel
    };
  };

  const setA = masterQuestions.map((q, idx) => ({ ...q, displayOrder: idx + 1 }));

  const setB = shuffleWithSeed(masterQuestions, 101).map((q, idx) => ({
    ...shuffleQuestionOptions(q, 201 + idx * 7),
    displayOrder: idx + 1
  }));

  const setC = shuffleWithSeed(masterQuestions, 307).map((q, idx) => ({
    ...shuffleQuestionOptions(q, 409 + idx * 11),
    displayOrder: idx + 1
  }));

  const setD = shuffleWithSeed(masterQuestions, 521).map((q, idx) => ({
    ...shuffleQuestionOptions(q, 613 + idx * 13),
    displayOrder: idx + 1
  }));

  return { A: setA, B: setB, C: setC, D: setD };
}

export const INITIAL_TECHNICAL_SUBDEPTS: SubDepartmentItem[] = [
  {
    tempId: "tech-aiml",
    name: "AI/ML Developer",
    code: "AIML",
    description: "Machine Learning, Deep Learning, NLP & AI Model Architecture",
    category: "TECHNICAL",
    isDefault: true
  },
  {
    tempId: "tech-tester",
    name: "Software Tester",
    code: "QA",
    description: "Quality Assurance, Test Automation, Performance & Reliability",
    category: "TECHNICAL",
    isDefault: true
  },
  {
    tempId: "tech-devops",
    name: "DevOps",
    code: "DEVOPS",
    description: "Cloud Infrastructure, CI/CD Automations, Kubernetes & SRE",
    category: "TECHNICAL",
    isDefault: true
  },
  {
    tempId: "tech-uiux",
    name: "UI/UX Designer",
    code: "UIUX",
    description: "Design Systems, User Experience Research, Prototyping & Figma",
    category: "TECHNICAL",
    isDefault: true
  }
];

export const INITIAL_NON_TECHNICAL_SUBDEPTS: SubDepartmentItem[] = [
  {
    tempId: "nontech-hr",
    name: "HR",
    code: "HR",
    description: "Human Resources, Talent Acquisition, People Ops & Compliance",
    category: "NON_TECHNICAL",
    isDefault: true
  },
  {
    tempId: "nontech-mkt",
    name: "Sales & Marketing",
    code: "SALES_MKT",
    description: "Enterprise Sales, Digital Marketing, Growth & Account Strategy",
    category: "NON_TECHNICAL",
    isDefault: true
  }
];

export function createInitialCategoryBank(): CategoryQuestionBankState {
  return {
    masterQuestionPaperFile: null,
    masterAnswerKeyFile: null,
    masterQuestions: [],
    extracting: false,
    sets: {
      A: { questionPaperFile: null, answerKeyFile: null, parsedQuestions: [], extracting: false },
      B: { questionPaperFile: null, answerKeyFile: null, parsedQuestions: [], extracting: false },
      C: { questionPaperFile: null, answerKeyFile: null, parsedQuestions: [], extracting: false },
      D: { questionPaperFile: null, answerKeyFile: null, parsedQuestions: [], extracting: false }
    },
    randomizeQuestions: true
  };
}
