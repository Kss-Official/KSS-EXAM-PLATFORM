import { useEffect, useState } from "react";
import { Plus, Trash2, CheckCircle2, BarChart3, Users, Code2, Upload } from "lucide-react";
import {
  createAdminCodingExam,
  deleteAdminCodingExam,
  getCodingEligibilitySetting,
  importCodingExamFiles,
  listAdminCodingExams,
  publishAdminCodingExam,
  setCodingEligibilitySetting,
  type AdminCodingExamDto,
  type AdminCodingQuestionInput,
} from "../../services/codingExamsAdminApi";

function makeBlankQuestion(index: number): AdminCodingQuestionInput {
  const qid = `q_${Date.now()}_${index}`;
  return {
    id: qid,
    title: `Problem ${index}`,
    problemStatement: "",
    difficulty: "Medium",
    maxMarks: 25,
    inputFormat: "Standard input",
    outputFormat: "Standard output",
    constraints: "1 <= N <= 10^5",
    sampleInput: "",
    sampleOutput: "",
    allowedLanguages: ["python3", "java", "cpp", "javascript"],
    timeLimitMs: 2000,
    memoryLimitMb: 256,
    testCases: [
      { id: `${qid}_s1`, label: "Sample 1", input: "", expectedOutput: "", isHidden: false, marks: 5 },
      { id: `${qid}_h1`, label: "Hidden 1", input: "", expectedOutput: "", isHidden: true, marks: 20 },
    ],
  };
}

export default function CodingExamsAdminPage() {
  const [exams, setExams] = useState<AdminCodingExamDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [qualificationPercentage, setQualificationPercentage] = useState(60);
  const [questions, setQuestions] = useState<AdminCodingQuestionInput[]>([makeBlankQuestion(1)]);
  const [questionsPdfFile, setQuestionsPdfFile] = useState<File | null>(null);
  const [testcasesFile, setTestcasesFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [requireRound1, setRequireRound1] = useState<boolean>(true);
  const [togglingEligibility, setTogglingEligibility] = useState(false);

  const handleToggleEligibility = async () => {
    setTogglingEligibility(true);
    try {
      const res = await setCodingEligibilitySetting(!requireRound1);
      setRequireRound1(res.requireRound1Qualified);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTogglingEligibility(false);
    }
  };

  const handleImportFiles = async () => {
    if (!questionsPdfFile) {
      setError("Please select a Questions PDF file first.");
      return;
    }
    setError(null);
    setImportWarnings([]);
    setImporting(true);
    try {
      const res = await importCodingExamFiles(questionsPdfFile, testcasesFile);
      setQuestions(res.questions);
      setImportWarnings(res.warnings || []);
      if (!title.trim() && questionsPdfFile.name) {
        setTitle(questionsPdfFile.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim());
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listAdminCodingExams();
      setExams(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    void getCodingEligibilitySetting()
      .then((res) => setRequireRound1(res.requireRound1Qualified))
      .catch(() => {});
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Exam title is required.");
      return;
    }
    const totalMarks = questions.reduce((sum, q) => sum + Number(q.maxMarks || 0), 0);
    setSaving(true);
    try {
      await createAdminCodingExam({
        title: title.trim(),
        description: description.trim(),
        durationMinutes,
        allowedLanguages: ["python3", "java", "cpp", "javascript"],
        qualificationPercentage,
        totalMarks: totalMarks || 100,
        status: "DRAFT",
        questions,
      });
      setTitle("");
      setDescription("");
      setQuestions([makeBlankQuestion(1)]);
      setShowForm(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (id: number) => {
    await publishAdminCodingExam(id);
    await load();
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this Round 2 coding exam?")) return;
    await deleteAdminCodingExam(id);
    await load();
  };

  return (
    <div className="admin-page-container" style={{ padding: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "22px", display: "flex", alignItems: "center", gap: "8px" }}>
            <Code2 size={22} color="#017846" /> Round 2 Coding Assessments
          </h1>
          <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "13px" }}>
            Create, publish, and manage Round 2 coding exams, problems, and test cases.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <a
            href="/admin/candidates"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid #b7dfd0",
              background: "#f3faf6",
              color: "#017846",
              fontWeight: 700,
              fontSize: "13px",
              textDecoration: "none",
            }}
          >
            <Users size={14} /> Manage Candidates
          </a>
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 15px",
              borderRadius: "8px",
              border: "1px solid #017846",
              background: "#017846",
              color: "#ffffff",
              fontWeight: 700,
              fontSize: "13px",
              cursor: "pointer",
            }}
          >
            <Plus size={14} /> {showForm ? "Cancel" : "Create Coding Exam"}
          </button>
        </div>
      </div>

      <div style={{ padding: "12px 16px", marginBottom: "18px", borderRadius: "10px", background: "#f3faf6", border: "1px solid #d9e6df", fontSize: "13px", color: "#014d32", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <strong>Round 2 Candidate Access:</strong>{" "}
          {requireRound1
            ? "Only ACTIVE candidates who QUALIFIED in Round 1 can enter."
            : "Direct Round 2 enabled — any ACTIVE registered candidate in Candidate Directory can enter without Round 1."}
        </div>
        <button
          type="button"
          disabled={togglingEligibility}
          onClick={() => void handleToggleEligibility()}
          style={{
            padding: "7px 14px",
            borderRadius: "8px",
            border: requireRound1 ? "1px solid #b7dfd0" : "1px solid #017846",
            background: requireRound1 ? "#ffffff" : "#017846",
            color: requireRound1 ? "#017846" : "#ffffff",
            fontWeight: 700,
            fontSize: "12.5px",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {togglingEligibility
            ? "Updating..."
            : requireRound1
              ? "Allow Direct Round 2 (Skip Round 1)"
              : "Direct Round 2: ON (Click to Require Round 1)"}
        </button>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", marginBottom: "16px", borderRadius: "8px", background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: "13px" }}>
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} noValidate style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px", marginBottom: "24px", display: "flex", flexDirection: "column", gap: "14px" }}>
          <h2 style={{ margin: 0, fontSize: "17px" }}>New Round 2 Coding Exam</h2>

          <div style={{ padding: "14px 16px", borderRadius: "10px", background: "#f3faf6", border: "1px solid #b7dfd0", display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ fontSize: "13.5px", fontWeight: 700, color: "#014d32", display: "flex", alignItems: "center", gap: "6px" }}>
              <Upload size={15} /> Import from Separate Files (Optional)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "10px", alignItems: "end" }}>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                  1. Questions PDF (.pdf)
                </label>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => setQuestionsPdfFile(e.target.files?.[0] || null)}
                  style={{ fontSize: "12px", width: "100%" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                  2. Test Cases (.json, .csv, or .pdf)
                </label>
                <input
                  type="file"
                  accept=".json,.csv,.pdf"
                  onChange={(e) => setTestcasesFile(e.target.files?.[0] || null)}
                  style={{ fontSize: "12px", width: "100%" }}
                />
              </div>
              <button
                type="button"
                disabled={importing || !questionsPdfFile}
                onClick={() => void handleImportFiles()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "1px solid #017846",
                  background: "#017846",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: "12.5px",
                  cursor: importing || !questionsPdfFile ? "not-allowed" : "pointer",
                  opacity: importing || !questionsPdfFile ? 0.6 : 1,
                }}
              >
                <Upload size={13} /> {importing ? "Importing..." : "Import & Preview"}
              </button>
            </div>
            {importWarnings.length > 0 && (
              <div style={{ fontSize: "12px", color: "#92400e", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: "6px", padding: "8px 10px" }}>
                {importWarnings.join(" · ")}
              </div>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Title *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Campus Round 2 Coding" required style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Duration (min)</label>
              <input type="number" min={5} value={durationMinutes} onChange={(e) => setDurationMinutes(Number(e.target.value) || 60)} style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Qualifying %</label>
              <input type="number" min={0} max={100} value={qualificationPercentage} onChange={(e) => setQualificationPercentage(Number(e.target.value) || 60)} style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, marginBottom: "4px" }}>Description</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short instructions or description" style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
          </div>

          <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <strong style={{ fontSize: "14px" }}>Problems ({questions.length})</strong>
              <button
                type="button"
                onClick={() => setQuestions((qs) => [...qs, makeBlankQuestion(qs.length + 1)])}
                style={{
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "1px solid #b7dfd0",
                  background: "#f3faf6",
                  color: "#017846",
                  fontWeight: 700,
                  fontSize: "12.5px",
                  cursor: "pointer",
                }}
              >
                + Add Problem
              </button>
            </div>
            {questions.map((q, qIdx) => (
              <div key={q.id} style={{ padding: "14px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "#f8fafc", marginBottom: "10px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "8px" }}>
                  <input
                    value={q.title}
                    onChange={(e) => setQuestions((qs) => qs.map((it, i) => (i === qIdx ? { ...it, title: e.target.value } : it)))}
                    placeholder="Problem title"
                    style={{ padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                  <select
                    value={q.difficulty}
                    onChange={(e) => setQuestions((qs) => qs.map((it, i) => (i === qIdx ? { ...it, difficulty: e.target.value } : it)))}
                    style={{ padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={q.maxMarks}
                    onChange={(e) => setQuestions((qs) => qs.map((it, i) => (i === qIdx ? { ...it, maxMarks: Number(e.target.value) || 10 } : it)))}
                    placeholder="Max Marks"
                    style={{ padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </div>
                <textarea
                  rows={3}
                  value={q.problemStatement}
                  onChange={(e) => setQuestions((qs) => qs.map((it, i) => (i === qIdx ? { ...it, problemStatement: e.target.value } : it)))}
                  placeholder="Problem statement (stdin/stdout)..."
                  style={{ padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", width: "100%" }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {q.testCases.map((tc, tcIdx) => (
                    <div key={tc.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto auto", gap: "6px", alignItems: "center" }}>
                      <input
                        value={tc.label}
                        onChange={(e) => setQuestions((qs) => qs.map((it, i) => i === qIdx ? { ...it, testCases: it.testCases.map((t, j) => j === tcIdx ? { ...t, label: e.target.value } : t) } : it))}
                        placeholder="Label"
                        style={{ padding: "5px 8px", borderRadius: "5px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                      />
                      <input
                        value={tc.input}
                        onChange={(e) => setQuestions((qs) => qs.map((it, i) => i === qIdx ? { ...it, testCases: it.testCases.map((t, j) => j === tcIdx ? { ...t, input: e.target.value } : t) } : it))}
                        placeholder="Input (stdin)"
                        style={{ padding: "5px 8px", borderRadius: "5px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                      />
                      <input
                        value={tc.expectedOutput}
                        onChange={(e) => setQuestions((qs) => qs.map((it, i) => i === qIdx ? { ...it, testCases: it.testCases.map((t, j) => j === tcIdx ? { ...t, expectedOutput: e.target.value } : t) } : it))}
                        placeholder="Expected Output"
                        style={{ padding: "5px 8px", borderRadius: "5px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                      />
                      <label style={{ fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                        <input
                          type="checkbox"
                          checked={tc.isHidden}
                          onChange={(e) => setQuestions((qs) => qs.map((it, i) => i === qIdx ? { ...it, testCases: it.testCases.map((t, j) => j === tcIdx ? { ...t, isHidden: e.target.checked } : t) } : it))}
                        />
                        Hidden
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={tc.marks}
                        onChange={(e) => setQuestions((qs) => qs.map((it, i) => i === qIdx ? { ...it, testCases: it.testCases.map((t, j) => j === tcIdx ? { ...t, marks: Number(e.target.value) || 1 } : t) } : it))}
                        style={{ width: "60px", padding: "5px", borderRadius: "5px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div style={{ padding: "10px 14px", borderRadius: "8px", background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: "13px" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: "9px 18px",
                borderRadius: "8px",
                border: "1px solid #017846",
                background: "#017846",
                color: "#ffffff",
                fontWeight: 700,
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              {saving ? "Saving..." : "Save Coding Exam"}
            </button>
          </div>
        </form>
      )}

      <div className="admin-table-card" style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: "24px", color: "#64748b" }}>Loading Round 2 Coding Exams...</div>
        ) : exams.length === 0 ? (
          <div style={{ padding: "24px", color: "#64748b" }}>No Round 2 coding exams created yet. Click <strong>Create Coding Exam</strong> above.</div>
        ) : (
          <table className="admin-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Title</th>
                <th>Duration</th>
                <th>Problems</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {exams.map((ex) => (
                <tr key={ex.id}>
                  <td style={{ fontWeight: 700, color: "#64748b" }}>#{ex.id}</td>
                  <td>
                    <div style={{ fontWeight: 700, color: "#0f172a" }}>{ex.title}</div>
                    {ex.description && <div style={{ fontSize: "11.5px", color: "#64748b" }}>{ex.description}</div>}
                  </td>
                  <td>{ex.durationMinutes} min</td>
                  <td>{ex.questions?.length ?? 0}</td>
                  <td>
                    <span style={{ padding: "3px 9px", borderRadius: "999px", fontSize: "11.5px", fontWeight: 700, background: ex.status === "PUBLISHED" ? "#eaf6ef" : "#f1f5f9", color: ex.status === "PUBLISHED" ? "#017846" : "#475569" }}>
                      {ex.status}
                    </span>
                  </td>
                  <td style={{ display: "flex", justifyContent: "flex-end", gap: "8px", flexWrap: "wrap" }}>
                    {ex.status !== "PUBLISHED" && ex.id && (
                      <button
                        type="button"
                        onClick={() => void handlePublish(ex.id!)}
                        style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "6px 12px", borderRadius: "8px", border: "1px solid #017846", background: "#017846", color: "#fff", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}
                      >
                        <CheckCircle2 size={13} /> Publish
                      </button>
                    )}
                    <a
                      href={`/admin/coding-results?examId=${ex.id}`}
                      style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "6px 12px", borderRadius: "8px", border: "1px solid #b7dfd0", background: "#f3faf6", color: "#017846", fontWeight: 700, fontSize: "12px", textDecoration: "none" }}
                    >
                      <BarChart3 size={13} /> Results
                    </a>
                    {ex.id && (
                      <button
                        type="button"
                        onClick={() => void handleDelete(ex.id!)}
                        style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "6px 12px", borderRadius: "8px", border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
