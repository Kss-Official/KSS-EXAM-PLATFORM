import { useState, useRef } from "react";
import { UploadCloud, FileText, CheckCircle2, AlertTriangle, Download, X, ArrowRight } from "lucide-react";
import type { AdminQuestion, QuestionSetKey } from "../../types/adminExam";
import { parseQuestionsFromText } from "../../services/adminExamStorage";

interface QuestionDocumentImporterProps {
  setKey: QuestionSetKey;
  onQuestionsImported: (imported: AdminQuestion[]) => void;
  currentCount: number;
}

const SAMPLE_QUESTION_TEMPLATE = `Question: Which principle of object-oriented programming allows one class to acquire properties from another?
A. Encapsulation
B. Inheritance
C. Polymorphism
D. Abstraction
Answer: B
Marks: 1

Question: Which SQL command is commonly used to retrieve records from a database table?
A. FETCH ONLY
B. OPEN TABLE
C. SELECT
D. PULL ROWS
Answer: C
Marks: 1

Question: Which data structure follows the Last In, First Out (LIFO) principle?
A. Queue
B. Stack
C. Linked List
D. Binary Tree
Answer: B
Marks: 1
`;

export default function QuestionDocumentImporter({
  setKey,
  onQuestionsImported,
  currentCount
}: QuestionDocumentImporterProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState("");
  const [parsedQuestions, setParsedQuestions] = useState<AdminQuestion[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Trigger client-side download of sample questions template
  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_QUESTION_TEMPLATE], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ExamSecure_Sample_Questions_Template.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const processFile = (file: File) => {
    setSelectedFile(file);
    setParseErrors([]);
    setParsedQuestions([]);

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["txt", "pdf", "docx", "doc"].includes(ext || "")) {
      setParseErrors(["Unsupported file type. Please upload a .txt, .docx, or selectable .pdf file."]);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setParseErrors(["File size exceeds 10MB limit."]);
      return;
    }

    setIsProcessing(true);

    const reader = new FileReader();

    if (ext === "txt") {
      reader.onload = (e) => {
        const text = (e.target?.result as string) || "";
        setRawText(text);
        const { questions, errors } = parseQuestionsFromText(text, setKey, currentCount + 1);
        setParsedQuestions(questions);
        setParseErrors(errors);
        setIsProcessing(false);
      };
      reader.readAsText(file);
    } else if (ext === "pdf" || ext === "docx" || ext === "doc") {
      // In browser client without external binary native modules, read as text stream to parse extractable text chunks
      reader.onload = (e) => {
        const content = (e.target?.result as string) || "";
        setRawText(content);
        const { questions, errors } = parseQuestionsFromText(content, setKey, currentCount + 1);

        if (questions.length === 0) {
          setParseErrors([
            `Document "${file.name}" was loaded locally. If this file contains scanned images or complex binary encoding, text cannot be parsed without server-side OCR. Please use the plain text template or paste the questions directly below.`
          ]);
        } else {
          setParsedQuestions(questions);
          setParseErrors(errors);
        }
        setIsProcessing(false);
      };
      reader.readAsText(file);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleManualTextParse = () => {
    if (!rawText.trim()) return;
    setIsProcessing(true);
    const { questions, errors } = parseQuestionsFromText(rawText, setKey, currentCount + 1);
    setParsedQuestions(questions);
    setParseErrors(errors);
    setIsProcessing(false);
  };

  const handleConfirmImport = () => {
    if (parsedQuestions.length > 0) {
      onQuestionsImported(parsedQuestions);
      // Reset
      setSelectedFile(null);
      setRawText("");
      setParsedQuestions([]);
      setParseErrors([]);
    }
  };

  return (
    <div className="question-document-importer">
      {/* File Upload Drop Zone */}
      <div 
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleFileDrop}
        style={{
          border: `2px dashed ${isDragOver ? "#017846" : "#cbd5e1"}`,
          background: isDragOver ? "#EAF6EF" : "#f8fafc",
          borderRadius: "10px",
          padding: "20px",
          textAlign: "center",
          marginBottom: "14px",
          cursor: "pointer",
          transition: "all 0.15s ease"
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input 
          ref={fileInputRef}
          type="file" 
          accept=".txt,.pdf,.docx,.doc" 
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              processFile(e.target.files[0]);
            }
          }}
        />

        <UploadCloud size={32} color="#017846" style={{ margin: "0 auto 8px" }} />
        <strong style={{ display: "block", fontSize: "13px", color: "#0f172a", marginBottom: "4px" }}>
          {isProcessing ? "Reading and parsing document..." : `Drop PDF, Word (.docx), or Text (.txt) files here to import into ${setKey.replace("_", " ")}`}
        </strong>
        <span style={{ fontSize: "11px", color: "#64748b" }}>
          Client-side local parsing only · No files are uploaded to external servers · Max 10MB
        </span>

        <div style={{ marginTop: "12px", display: "flex", justifyContent: "center", gap: "8px" }}>
          <button 
            type="button" 
            className="secondary" 
            style={{ fontSize: "11px", padding: "5px 12px" }}
            onClick={(e) => {
              e.stopPropagation();
              handleDownloadTemplate();
            }}
          >
            <Download size={13} /> Download Sample Format (.txt)
          </button>
        </div>
      </div>

      {/* Selected File Details */}
      {selectedFile && (
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between", 
          background: "#ffffff", 
          padding: "8px 12px", 
          borderRadius: "8px", 
          border: "1px solid #cbd5e1",
          marginBottom: "12px",
          fontSize: "12px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <FileText size={16} color="#017846" />
            <b>{selectedFile.name}</b>
            <span style={{ color: "#64748b" }}>({Math.round(selectedFile.size / 1024)} KB)</span>
          </div>
          <button 
            type="button" 
            className="secondary" 
            style={{ padding: "4px 6px" }}
            onClick={() => {
              setSelectedFile(null);
              setParsedQuestions([]);
              setParseErrors([]);
              setRawText("");
            }}
          >
            <X size={14} /> Remove
          </button>
        </div>
      )}

      {/* Format Fallback & Direct Paste Area */}
      <div style={{ marginBottom: "14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#334155" }}>
            Or Paste Formatted Questions Directly:
          </span>
          {rawText.trim() && (
            <button 
              type="button" 
              className="secondary" 
              style={{ fontSize: "10.5px", padding: "3px 8px" }}
              onClick={handleManualTextParse}
            >
              Parse Text Below
            </button>
          )}
        </div>
        <textarea
          rows={3}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder={`Question: What is polymorphism in OOP?\nA. Option 1\nB. Option 2\nC. Option 3\nD. Option 4\nAnswer: B`}
          style={{ width: "100%", padding: "8px", fontSize: "11px", fontFamily: "monospace", borderRadius: "6px", border: "1px solid #cbd5e1" }}
        />
      </div>

      {/* Parse Errors */}
      {parseErrors.length > 0 && (
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", padding: "10px 12px", borderRadius: "8px", marginBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#c2410c", fontWeight: 700, fontSize: "12px", marginBottom: "4px" }}>
            <AlertTriangle size={15} /> Parsing Warnings
          </div>
          <ul style={{ margin: 0, paddingLeft: "18px", fontSize: "11px", color: "#9a3412" }}>
            {parseErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Parsed Questions Review & Confirmation */}
      {parsedQuestions.length > 0 && (
        <div style={{ background: "#f0fdf4", border: "1.5px solid #86efac", padding: "14px", borderRadius: "10px", marginBottom: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#166534", fontWeight: 700, fontSize: "13px" }}>
              <CheckCircle2 size={16} /> Successfully Parsed {parsedQuestions.length} Questions for {setKey.replace("_", " ")}
            </div>
            <button 
              type="button" 
              className="primary" 
              style={{ padding: "6px 14px", fontSize: "11px" }}
              onClick={handleConfirmImport}
            >
              Confirm & Add to {setKey.replace("_", " ")} <ArrowRight size={13} />
            </button>
          </div>

          <div style={{ maxHeight: "180px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px", paddingRight: "4px" }}>
            {parsedQuestions.map((q, idx) => (
              <div key={idx} style={{ background: "#ffffff", padding: "8px 10px", borderRadius: "6px", border: "1px solid #dcfce7", fontSize: "11.5px" }}>
                <b>Q{q.questionNumber}.</b> {q.text}
                <div style={{ display: "flex", gap: "10px", color: "#475569", marginTop: "3px", fontSize: "10.5px" }}>
                  {q.options.map(o => (
                    <span key={o.id} style={{ color: o.id === q.correctOptionId ? "#16a34a" : undefined, fontWeight: o.id === q.correctOptionId ? 700 : 400 }}>
                      {o.label}. {o.text}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
