import { useState, useEffect, useMemo } from "react";
import { X, Send, ChevronDown, ChevronRight } from "lucide-react";
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
  total = 0,
  currentIndex,
  answers,
  flags,
  isOpen,
  onClose,
  onSelectQuestion,
  onRequestSubmit
}: QuestionNavigatorProps) {
  // Dynamically calculate sections based on actual total questions
  const sections = useMemo(() => {
    if (!total || total <= 0) return [];
    if (total <= 25) {
      return [
        { id: "A", name: "Section A", start: 1, end: total, title: "All Questions" }
      ];
    }
    if (total <= 50) {
      const half = Math.ceil(total / 2);
      return [
        { id: "A", name: "Section A", start: 1, end: half, title: "Part 1" },
        { id: "B", name: "Section B", start: half + 1, end: total, title: "Part 2" }
      ];
    }
    const q1 = Math.ceil(total / 4);
    const q2 = Math.ceil((total * 2) / 4);
    const q3 = Math.ceil((total * 3) / 4);
    return [
      { id: "A", name: "Section A", start: 1, end: q1, title: "Quantitative Aptitude" },
      { id: "B", name: "Section B", start: q1 + 1, end: q2, title: "Logical Reasoning" },
      { id: "C", name: "Section C", start: q2 + 1, end: q3, title: "Domain Core" },
      { id: "D", name: "Section D", start: q3 + 1, end: total, title: "Specialization" }
    ];
  }, [total]);

  // Determine which section the current question belongs to
  const getSectionIdForIndex = (qIdx: number) => {
    const qNum = qIdx + 1;
    const matched = sections.find(s => qNum >= s.start && qNum <= s.end);
    return matched ? matched.id : (sections[0]?.id || "A");
  };

  // Only one section can be open at a time (single-open accordion)
  const [activeSection, setActiveSection] = useState<string>("A");

  // Auto-switch active section when candidate navigates to a question in a different section
  useEffect(() => {
    const secId = getSectionIdForIndex(currentIndex);
    setActiveSection(secId);
  }, [currentIndex, sections]);

  const toggleSection = (secId: string) => {
    // If the clicked section is already open, toggle it closed; otherwise open it and close all others
    setActiveSection(prev => (prev === secId ? "" : secId));
  };

  // Count answered in each section
  const getAnsweredCountForSection = (start: number, end: number) => {
    let count = 0;
    for (let q = start; q <= end; q++) {
      if (answers[q] !== undefined) {
        count++;
      }
    }
    return count;
  };

  return (
    <aside
      className={`qnav-palette-card ${isOpen ? "open" : ""}`}
      aria-label="Question Navigator Palette"
    >
      {/* Top: Live Proctor Feed */}
      <LiveProctorFeed />

      {/* Navigator Main Card */}
      <div className="qnav-body-card">
        <div className="qnav-header-row">
          <div>
            <h3 className="qnav-title">Question navigator</h3>
            <p className="qnav-subtitle">Jump to any question</p>
          </div>
          <button
            type="button"
            className="qnav-mobile-close"
            onClick={onClose}
            aria-label="Close question navigator"
          >
            <X size={18} />
          </button>
        </div>

        {/* Legend */}
        <div className="qnav-legend-row">
          <span className="qnav-legend-item">
            <span className="qnav-dot green" /> Answered
          </span>
          <span className="qnav-legend-item">
            <span className="qnav-dot amber" /> Flagged
          </span>
          <span className="qnav-legend-item">
            <span className="qnav-dot hollow" /> Unanswered
          </span>
        </div>

        {/* 4 Accordion Sections */}
        <div className="qnav-sections-accordion">
          {sections.map(sec => {
            const isSectionOpen = activeSection === sec.id;
            const answeredInSec = getAnsweredCountForSection(sec.start, sec.end);
            const totalInSec = sec.end - sec.start + 1;

            return (
              <div key={sec.id} className="qnav-section-item">
                <button
                  type="button"
                  className="qnav-section-header"
                  onClick={() => toggleSection(sec.id)}
                >
                  <div className="qnav-sec-left">
                    {isSectionOpen ? (
                      <ChevronDown size={15} color="#475569" />
                    ) : (
                      <ChevronRight size={15} color="#475569" />
                    )}
                    <strong>{sec.name}</strong>
                    <span className="qnav-sec-range">({sec.start} - {sec.end})</span>
                  </div>
                  <span className="qnav-sec-count">
                    {answeredInSec}/{totalInSec} answered
                  </span>
                </button>

                {isSectionOpen && (
                  <div className="qnav-numbers-grid">
                    {Array.from({ length: totalInSec }, (_, i) => {
                      const qNum = sec.start + i;
                      const qIndex = qNum - 1;
                      const isCurrent = qIndex === currentIndex;
                      const isAnswered = answers[qNum] !== undefined;
                      const isFlagged = flags.includes(qNum);

                      let btnClass = "qnav-btn";
                      if (isCurrent && !isAnswered) btnClass += " current";
                      else if (isAnswered) btnClass += isCurrent ? " answered current-answered" : " answered";
                      else if (isFlagged) btnClass += " flagged";
                      else btnClass += " unanswered";

                      return (
                        <button
                          key={qNum}
                          type="button"
                          className={btnClass}
                          onClick={() => {
                            onSelectQuestion(qIndex);
                            onClose();
                          }}
                          aria-label={`Question ${qNum}`}
                        >
                          {qNum}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Submit Assessment Button */}
        <button
          type="button"
          className="qnav-submit-btn"
          onClick={onRequestSubmit}
        >
          <Send size={15} />
          <span>Submit assessment</span>
        </button>
      </div>
    </aside>
  );
}
