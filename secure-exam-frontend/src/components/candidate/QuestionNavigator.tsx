import { X, Send } from "lucide-react";
import LiveProctorFeed from "./LiveProctorFeed";

interface QuestionNavigatorProps {
  total: number;
  currentIndex: number;
  answers: Record<number, number>;
  flags: number[];
  isOpen: boolean;
  onClose: () => void;
  onSelectQuestion: (index: number) => void;
  onRequestSubmit: () => void;
}

export default function QuestionNavigator({
  total,
  currentIndex,
  answers,
  flags,
  isOpen,
  onClose,
  onSelectQuestion,
  onRequestSubmit
}: QuestionNavigatorProps) {
  const answeredCount = Object.keys(answers).length;
  const flaggedCount = flags.length;
  const unansweredCount = Math.max(0, total - answeredCount);

  return (
    <aside
      className={`palette card ${isOpen ? "open" : ""}`}
      aria-label="Question Navigator Palette"
    >
      {/* Active Proctoring Surveillance Tile */}
      <LiveProctorFeed />

      <div className="palhead">
        <div>
          <b>Question navigator</b>
          <small>Jump to any question</small>
        </div>
        <button
          type="button"
          className="close"
          onClick={onClose}
          aria-label="Close question navigator"
        >
          <X size={18} />
        </button>
      </div>

      <div className="legend">
        <span><i className="answeredkey" /> Answered</span>
        <span><i className="flagkey" /> Flagged</span>
        <span><i /> Unanswered</span>
      </div>

      <div className="grid">
        {Array.from({ length: total }, (_, i) => {
          const qNum = i + 1;
          const isCurrent = i === currentIndex;
          const isAnswered = answers[qNum] !== undefined;
          const isFlagged = flags.includes(qNum);

          let classNames = "";
          if (isCurrent) classNames += " current";
          if (isAnswered) classNames += " answered";
          if (isFlagged) classNames += " flagged";

          return (
            <button
              key={qNum}
              type="button"
              onClick={() => {
                onSelectQuestion(i);
                onClose();
              }}
              className={classNames.trim()}
              aria-label={`Question ${qNum}${isAnswered ? ", answered" : ""}${isFlagged ? ", flagged" : ""}${isCurrent ? ", currently selected" : ""}`}
            >
              {qNum}
            </button>
          );
        })}
      </div>

      <div className="pal-footer">
        <div className="summary">
          <div>
            <span>Answered</span>
            <b>{answeredCount}</b>
          </div>
          <div>
            <span>Flagged</span>
            <b>{flaggedCount}</b>
          </div>
          <div>
            <span>Unanswered</span>
            <b>{unansweredCount}</b>
          </div>
        </div>
        <button
          type="button"
          className="primary full"
          onClick={onRequestSubmit}
        >
          <Send size={14} /> Submit assessment
        </button>
      </div>
    </aside>
  );
}
