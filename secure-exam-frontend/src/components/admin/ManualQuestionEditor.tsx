import { useState } from "react";
import { PlusCircle, Trash2, HelpCircle } from "lucide-react";
import type { AdminQuestion, QuestionOption, QuestionSetKey } from "../../types/adminExam";

interface ManualQuestionEditorProps {
  setKey: QuestionSetKey;
  questions: AdminQuestion[];
  onAddQuestion: (q: AdminQuestion) => void;
  onDeleteQuestion: (id: string) => void;
  targetCount?: number;
}

export default function ManualQuestionEditor({
  setKey,
  questions,
  onAddQuestion,
  onDeleteQuestion,
  targetCount
}: ManualQuestionEditorProps) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [text, setText] = useState("");
  const [optA, setOptA] = useState("");
  const [optB, setOptB] = useState("");
  const [optC, setOptC] = useState("");
  const [optD, setOptD] = useState("");
  const [correctLetter, setCorrectLetter] = useState<"A" | "B" | "C" | "D">("A");
  const [marks, setMarks] = useState("1");
  const [subject, setSubject] = useState("Core Technical");
  const [difficulty, setDifficulty] = useState<"EASY" | "MEDIUM" | "HARD">("EASY");
  const [formError, setFormError] = useState("");

  const validQuestionsCount = questions.filter(
    (q) => q.text.trim() && q.options.length === 4 && q.options.every((o) => o.text.trim()) && q.correctOptionId
  ).length;
  const incompleteCount = questions.length - validQuestionsCount;
  const totalMarks = questions.reduce((acc, q) => acc + (q.marks || 1), 0);
  const remainingNeeded = targetCount ? Math.max(0, targetCount - validQuestionsCount) : 0;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !optA.trim() || !optB.trim() || !optC.trim() || !optD.trim()) {
      setFormError("Question text and all four options (A, B, C, D) are required.");
      return;
    }

    const nextQNum = questions.length + 1;
    const options: QuestionOption[] = [
      { id: `opt_${setKey.toLowerCase()}_${nextQNum}_A`, label: "A", text: optA.trim() },
      { id: `opt_${setKey.toLowerCase()}_${nextQNum}_B`, label: "B", text: optB.trim() },
      { id: `opt_${setKey.toLowerCase()}_${nextQNum}_C`, label: "C", text: optC.trim() },
      { id: `opt_${setKey.toLowerCase()}_${nextQNum}_D`, label: "D", text: optD.trim() }
    ];

    const correctOpt = options.find((o) => o.label === correctLetter) || options[0];

    const newQuestion: AdminQuestion = {
      id: `Q-${setKey}-${Date.now().toString().slice(-4)}`,
      setKey,
      questionNumber: nextQNum,
      text: text.trim(),
      options,
      correctOptionId: correctOpt.id,
      marks: parseFloat(marks) || 1,
      subject: subject.trim(),
      difficulty
    };

    onAddQuestion(newQuestion);
    setIsFormOpen(false);
    setText("");
    setOptA("");
    setOptB("");
    setOptC("");
    setOptD("");
    setFormError("");
  };

  return (
    <div className="manual-question-editor">
      {/* Draft Status Summary */}
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "space-between", 
        background: "#f8fafc", 
        padding: "10px 14px", 
        borderRadius: "8px", 
        border: "1px solid #e2e8f0",
        marginBottom: "14px",
        flexWrap: "wrap",
        gap: "10px"
      }}>
        <div style={{ display: "flex", gap: "14px", fontSize: "12px", color: "#334155" }}>
          <span>Valid Questions: <strong style={{ color: "#16a34a" }}>{validQuestionsCount}</strong></span>
          {incompleteCount > 0 && (
            <span>Incomplete: <strong style={{ color: "#dc2626" }}>{incompleteCount}</strong></span>
          )}
          <span>Total Marks: <strong>{totalMarks}</strong></span>
          {targetCount && (
            <span>Remaining Target: <strong>{remainingNeeded}</strong></span>
          )}
        </div>

        <button 
          type="button" 
          className="primary" 
          style={{ fontSize: "11px", padding: "6px 12px" }}
          onClick={() => setIsFormOpen(!isFormOpen)}
        >
          <PlusCircle size={14} /> {isFormOpen ? "Close Form" : "Add New Question"}
        </button>
      </div>

      {/* Add Question Inline Form */}
      {isFormOpen && (
        <form onSubmit={handleSave} style={{ 
          background: "#ffffff", 
          border: "1.5px solid #017846", 
          borderRadius: "10px", 
          padding: "16px", 
          marginBottom: "16px",
          boxShadow: "0 4px 14px rgba(1, 120, 70, 0.08)"
        }}>
          <h4 style={{ margin: "0 0 12px", fontSize: "14px", color: "#0f172a" }}>
            Add Question to {setKey.replace("_", " ")}
          </h4>

          {formError && (
            <div style={{ background: "#fef2f2", color: "#dc2626", padding: "8px 10px", borderRadius: "6px", fontSize: "11px", marginBottom: "10px" }}>
              {formError}
            </div>
          )}

          <div className="form-group" style={{ marginBottom: "10px" }}>
            <label style={{ fontSize: "11px", fontWeight: 700 }}>Question Text *</label>
            <textarea 
              rows={2}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Enter the technical MCQ question statement..."
              style={{ width: "100%", padding: "8px", fontSize: "12px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "10px" }}>
            <div>
              <label style={{ fontSize: "10.5px", fontWeight: 600 }}>Option A *</label>
              <input 
                type="text" 
                value={optA} 
                onChange={e => setOptA(e.target.value)}
                placeholder="Option A text"
                style={{ width: "100%", padding: "6px 8px", fontSize: "11.5px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "10.5px", fontWeight: 600 }}>Option B *</label>
              <input 
                type="text" 
                value={optB} 
                onChange={e => setOptB(e.target.value)}
                placeholder="Option B text"
                style={{ width: "100%", padding: "6px 8px", fontSize: "11.5px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "10.5px", fontWeight: 600 }}>Option C *</label>
              <input 
                type="text" 
                value={optC} 
                onChange={e => setOptC(e.target.value)}
                placeholder="Option C text"
                style={{ width: "100%", padding: "6px 8px", fontSize: "11.5px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "10.5px", fontWeight: 600 }}>Option D *</label>
              <input 
                type="text" 
                value={optD} 
                onChange={e => setOptD(e.target.value)}
                placeholder="Option D text"
                style={{ width: "100%", padding: "6px 8px", fontSize: "11.5px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1.5fr", gap: "8px", marginBottom: "12px" }}>
            <div>
              <label style={{ fontSize: "10.5px", fontWeight: 700 }}>Correct Option *</label>
              <select 
                value={correctLetter} 
                onChange={e => setCorrectLetter(e.target.value as any)}
                style={{ width: "100%", padding: "6px 8px", fontSize: "11.5px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              >
                <option value="A">Option A</option>
                <option value="B">Option B</option>
                <option value="C">Option C</option>
                <option value="D">Option D</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: "10.5px", fontWeight: 700 }}>Marks *</label>
              <input 
                type="number" 
                step="0.5" 
                min="0.5" 
                value={marks} 
                onChange={e => setMarks(e.target.value)}
                style={{ width: "100%", padding: "6px 8px", fontSize: "11.5px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              />
            </div>

            <div>
              <label style={{ fontSize: "10.5px", fontWeight: 700 }}>Difficulty</label>
              <select 
                value={difficulty} 
                onChange={e => setDifficulty(e.target.value as any)}
                style={{ width: "100%", padding: "6px 8px", fontSize: "11.5px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              >
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: "10.5px", fontWeight: 700 }}>Category / Subject</label>
              <input 
                type="text"
                value={subject} 
                onChange={e => setSubject(e.target.value)}
                placeholder="e.g. Core Technical"
                style={{ width: "100%", padding: "6px 8px", fontSize: "11.5px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <button type="button" className="secondary" style={{ padding: "6px 12px", fontSize: "11px" }} onClick={() => setIsFormOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="primary" style={{ padding: "6px 14px", fontSize: "11px" }}>
              Save to {setKey.replace("_", " ")} Draft
            </button>
          </div>
        </form>
      )}

      {/* Questions List for Active Set */}
      <div className="questions-draft-list" style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {questions.length === 0 ? (
          <div style={{ textAlign: "center", padding: "28px", color: "#64748b", background: "#f8fafc", borderRadius: "8px", border: "1px dashed #cbd5e1", fontSize: "12px" }}>
            <HelpCircle size={24} style={{ margin: "0 auto 6px", opacity: 0.5 }} />
            No questions added to {setKey.replace("_", " ")} yet. Use "Add New Question" or "Import from Document".
          </div>
        ) : (
          questions.map((q, idx) => {
            const correctOpt = q.options.find(o => o.id === q.correctOptionId) || q.options[0];
            return (
              <div 
                key={q.id || idx} 
                style={{ 
                  background: "#ffffff", 
                  border: "1px solid #e2e8f0", 
                  borderRadius: "8px", 
                  padding: "10px 14px",
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "12px"
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "3px" }}>
                    <span style={{ fontSize: "10px", fontWeight: 700, background: "#EAF6EF", color: "#017846", padding: "1px 6px", borderRadius: "4px" }}>
                      Q{idx + 1}
                    </span>
                    <span style={{ fontSize: "10px", color: "#64748b" }}>{q.subject || "General"}</span>
                    <span style={{ fontSize: "10px", color: "#64748b" }}>· {q.marks || 1} mark(s)</span>
                  </div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#0f172a", marginBottom: "4px" }}>
                    {q.text}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", fontSize: "11px", color: "#475569" }}>
                    {q.options.map((opt) => (
                      <span 
                        key={opt.id}
                        style={{ 
                          fontWeight: opt.id === q.correctOptionId ? 700 : 400,
                          color: opt.id === q.correctOptionId ? "#16a34a" : "#475569" 
                        }}
                      >
                        <b>{opt.label}.</b> {opt.text}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "10px", fontWeight: 700, color: "#166534", background: "#dcfce7", padding: "2px 6px", borderRadius: "4px" }}>
                    Ans: {correctOpt?.label}
                  </span>
                  <button 
                    type="button" 
                    className="secondary" 
                    style={{ padding: "4px 6px", color: "#dc2626" }}
                    onClick={() => onDeleteQuestion(q.id)}
                    title="Remove from draft"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
