import type { 
  AdminQuestion, 
  AnswerKeyDraft, 
  LocalScoringRule, 
  LocalScoringResult, 
  QuestionSetKey 
} from "../types/adminExam";

export interface CandidateAttemptSubmission {
  candidateId: string;
  candidateName: string;
  department: string;
  setKey: QuestionSetKey;
  submittedAt: string;
  /** Map of question number (1-based) to chosen option id (e.g. "opt_1") or chosen index */
  answers: Record<number, string | number>;
}

/**
 * Pure TypeScript client-side scoring engine.
 * Computes scores deterministically using stable option IDs.
 * Note: Client scoring is for local preview/demo verification only.
 * Production scoring must be computed by FastAPI server-side to prevent tampering.
 */
export function calculateLocalScore(
  attempt: CandidateAttemptSubmission,
  questions: AdminQuestion[],
  answerKey: AnswerKeyDraft | undefined,
  rule: LocalScoringRule
): LocalScoringResult {
  const totalQuestions = questions.length;
  const answeredQuestionNumbers = Object.keys(attempt.answers).map(Number);
  const answeredCount = answeredQuestionNumbers.length;
  const unansweredCount = Math.max(0, totalQuestions - answeredCount);

  // If answer key is missing or not validated, flag scoring as incomplete
  if (!answerKey || !answerKey.isValidated) {
    return {
      candidateId: attempt.candidateId,
      candidateName: attempt.candidateName,
      department: attempt.department,
      setKey: attempt.setKey,
      totalQuestions,
      answeredCount,
      unansweredCount,
      correctCount: 0,
      wrongCount: 0,
      calculatedScore: 0,
      maxScore: totalQuestions * rule.marksPerCorrect,
      percentage: 0,
      status: "Pending Review",
      isDemoScore: true,
      notes: "Scoring unavailable — official answer key requires validation."
    };
  }

  let correctCount = 0;
  let wrongCount = 0;

  questions.forEach((q) => {
    const candidateChoice = attempt.answers[q.questionNumber];
    if (candidateChoice === undefined || candidateChoice === null || candidateChoice === "") {
      // Unanswered: no penalty applied
      return;
    }

    // Determine correct option ID from question or answer key
    const officialLetter = answerKey.entries[q.questionNumber];
    let correctId = q.correctOptionId;

    if (officialLetter) {
      const matchingOpt = q.options.find((opt) => opt.label === officialLetter);
      if (matchingOpt) {
        correctId = matchingOpt.id;
      }
    }

    // Compare with candidate choice
    let isCorrect = false;
    if (typeof candidateChoice === "number") {
      // Index-based comparison (0 -> A, 1 -> B, etc.)
      const chosenOpt = q.options[candidateChoice];
      if (chosenOpt && chosenOpt.id === correctId) {
        isCorrect = true;
      }
    } else {
      // ID-based or letter-based comparison
      if (candidateChoice === correctId) {
        isCorrect = true;
      } else {
        const chosenOpt = q.options.find((o) => o.id === candidateChoice || o.label === candidateChoice);
        if (chosenOpt && chosenOpt.id === correctId) {
          isCorrect = true;
        }
      }
    }

    if (isCorrect) {
      correctCount++;
    } else {
      wrongCount++;
    }
  });

  const rawScore = correctCount * rule.marksPerCorrect - wrongCount * rule.negativeMarking;
  const finalScore = rule.allowNegativeTotal ? rawScore : Math.max(0, rawScore);
  const maxPossibleScore = totalQuestions * rule.marksPerCorrect;
  const percentage = maxPossibleScore > 0 ? Math.round((finalScore / maxPossibleScore) * 1000) / 10 : 0;

  return {
    candidateId: attempt.candidateId,
    candidateName: attempt.candidateName,
    department: attempt.department,
    setKey: attempt.setKey,
    totalQuestions,
    answeredCount,
    unansweredCount,
    correctCount,
    wrongCount,
    calculatedScore: Math.round(finalScore * 100) / 100,
    maxScore: maxPossibleScore,
    percentage,
    status: "Scored",
    isDemoScore: true,
    notes: `Local scoring preview — not server verified. (+${rule.marksPerCorrect} / -${rule.negativeMarking})`
  };
}
