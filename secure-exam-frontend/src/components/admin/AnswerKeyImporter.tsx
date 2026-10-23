import { useState, useRef } from "react";
import { FileKey, CheckCircle2, AlertTriangle, X, UploadCloud, Download } from "lucide-react";
import type { AnswerKeyDraft, QuestionSetKey, AdminQuestion } from "../../types/adminExam";
import { parseAnswerKeyText } from "../../services/adminExamStorage";

interface AnswerKeyImporterProps {
  setKey: QuestionSetKey;
  questions: AdminQuestion[];
  currentAnswerKey?: AnswerKeyDraft;
  onSaveAnswerKey: (draft: AnswerKeyDraft) => void;
  onRemoveAnswerKey: (setKey: QuestionSetKey) => void;
}

const SAMPLE_ANSWER_KEY_TEMPLATE = `Set A
1. B
2. C
3. B
4. B
5. B

Set B
1. C
2. C
3. C
4. B
5. C

Set C
1. C
2. A
3. B
4. A
5. B

Set D
1. C
2. B
3. C
4. B
5. B
`;

export default function AnswerKeyImporter({
  setKey,
  questions,
  currentAnswerKey,
  onSaveAnswerKey,
  onRemoveAnswerKey
}: AnswerKeyImporterProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rawText, setRawText] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_ANSWER_KEY_TEMPLATE], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "Official_Exam_Answer_Key_Template.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const validateMapping = (entries: Record<number, "A" | "B" | "C" | "D">) => {
    const errors: string[] = [];
    const questionNumbers = Object.keys(entries).map(Number);

    if (questionNumbers.length === 0) {
      errors.push(`No valid answer key entries recognized for ${setKey.replace("_", " ")}.`);
      return errors;
    }

    // Check for questions without answer key
    questions.forEach((q) => {
      if (!entries[q.questionNumber]) {
        errors.push(`Question #${q.questionNumber} ("${q.text.substring(0, 24)}...") has no matching answer entry.`);
      }
    });

    // Check for answer key entries beyond question set
    questionNumbers.forEach((num) => {
      if (questions.length > 0 && !questions.some((q) => q.questionNumber === num)) {
        errors.push(`Answer key specifies entry for Q#${num}, which does not exist in ${setKey.replace("_", " ")}.`);
      }
    });

    return errors;
  };

  const processText = (text: string, fileName?: string, fileSize?: string) => {
    const allSets = parseAnswerKeyText(text);
    const setEntries = allSets[setKey] || {};

    const errs = validateMapping(setEntries);
    setValidationErrors(errs);

    if (Object.keys(setEntries).length > 0 && errs.length === 0) {
      const draft: AnswerKeyDraft = {
        setKey,
        fileName: fileName || `${setKey}_Answer_Key.txt`,
        fileSize: fileSize || "1.0 KB",
        uploadedAt: new Date().toLocaleDateString(),
        entries: setEntries,
        isValidated: true,
        validationErrors: [],
        isDemoDraft: true
      };
      onSaveAnswerKey(draft);
    }
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || "";
      setRawText(text);
      processText(text, file.name, `${Math.round(file.size / 1024)} KB`);
    };
    reader.readAsText(file);
  };

  const handleManualParse = () => {
    if (!rawText.trim()) return;
    processText(rawText);
  };

  return (
    <div className="answer-key-importer" style={{ background: "#f8fafc", padding: "16px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <FileKey size={16} color="#017846" />
            <strong style={{ fontSize: "13px", color: "#0f172a" }}>
              Answer Key / Official Scoring Document — {setKey.replace("_", " ")}
            </strong>
          </div>
          <small style={{ color: "#64748b" }}>
            Authorized answer keys determine the correct answer mapping for automatic candidate scoring.
          </small>
        </div>

        <button 
          type="button" 
          className="secondary" 
          style={{ fontSize: "11px", padding: "4px 8px" }}
          onClick={handleDownloadTemplate}
        >
          <Download size={13} /> Sample Key Template
        </button>
      </div>

      {/* Active Answer Key Status Banner if present */}
      {currentAnswerKey && currentAnswerKey.isValidated && (
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "space-between", 
          background: "#f0fdf4", 
          border: "1.5px solid #86efac", 
          padding: "10px 14px", 
          borderRadius: "8px", 
          marginBottom: "14px" 
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#166534", fontWeight: 700, fontSize: "12px" }}>
              <CheckCircle2 size={16} /> Validated Answer Key Active for {setKey.replace("_", " ")}
            </div>
            <small style={{ color: "#15803d" }}>
              {Object.keys(currentAnswerKey.entries).length} recognized questions mapped · {currentAnswerKey.fileName || "Active Draft"}
            </small>
          </div>

          <button 
            type="button" 
            className="secondary" 
            style={{ fontSize: "11px", padding: "4px 8px", color: "#dc2626" }}
            onClick={() => onRemoveAnswerKey(setKey)}
          >
            <X size={13} /> Remove Key
          </button>
        </div>
      )}

      {/* File Upload Zone */}
      <div 
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: "1.5px dashed #cbd5e1",
          background: "#ffffff",
          borderRadius: "8px",
          padding: "16px",
          textAlign: "center",
          cursor: "pointer",
          marginBottom: "12px"
        }}
      >
        <input 
          ref={fileInputRef}
          type="file" 
          accept=".txt,.pdf,.docx,.doc" 
          style={{ display: "none" }}
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFileUpload(e.target.files[0]);
            }
          }}
        />

        <UploadCloud size={24} color="#017846" style={{ margin: "0 auto 6px" }} />
        <strong style={{ display: "block", fontSize: "12px", color: "#0f172a" }}>
          Upload Official Answer Key Document (.pdf, .docx, .txt)
        </strong>
        <span style={{ fontSize: "10.5px", color: "#64748b" }}>
          Structured multi-set files automatically resolve to {setKey.replace("_", " ")}
        </span>
      </div>

      {/* Direct Paste Fallback */}
      <div style={{ marginBottom: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
          <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#475569" }}>Or Paste Text Answer Key:</span>
          {rawText.trim() && (
            <button 
              type="button" 
              className="secondary" 
              style={{ fontSize: "10px", padding: "2px 8px" }}
              onClick={handleManualParse}
            >
              Parse Key
            </button>
          )}
        </div>
        <textarea
          rows={3}
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder={`Set A\n1. B\n2. C\n3. B\n4. B\n5. B`}
          style={{ width: "100%", padding: "6px 8px", fontSize: "11px", fontFamily: "monospace", borderRadius: "6px", border: "1px solid #cbd5e1" }}
        />
      </div>

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", padding: "10px 12px", borderRadius: "8px", marginBottom: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#c2410c", fontWeight: 700, fontSize: "11.5px", marginBottom: "4px" }}>
            <AlertTriangle size={14} /> Answer Key Validation Required
          </div>
          <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "11px", color: "#9a3412" }}>
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Preview Table of Active Key */}
      {currentAnswerKey && (
        <div style={{ background: "#ffffff", padding: "10px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
          <small style={{ fontWeight: 700, color: "#64748b", display: "block", marginBottom: "6px" }}>
            Current Answer Key Mapping for {setKey.replace("_", " ")}:
          </small>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {Object.entries(currentAnswerKey.entries).map(([qNum, letter]) => (
              <span key={qNum} style={{ fontSize: "10.5px", padding: "2px 6px", background: "#eff6ff", color: "#1e40af", borderRadius: "4px", border: "1px solid #bfdbfe" }}>
                Q{qNum}: <b>{letter}</b>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
