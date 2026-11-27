import { lazy, Suspense } from "react";
import { RotateCcw, Sun, Moon } from "lucide-react";

const MonacoEditor = lazy(async () => {
  await import("./monacoSetup");
  return import("@monaco-editor/react");
});

export const DEFAULT_STARTER_TEMPLATES: Record<string, string> = {
  python3: "import sys\n\ndef solve():\n    data = sys.stdin.read().strip()\n    # Write your solution here\n    print(data)\n\nif __name__ == '__main__':\n    solve()\n",
  javascript: "const fs = require('fs');\nconst input = fs.readFileSync(0, 'utf-8').trim();\nconsole.log(input);\n",
  cpp: "#include <iostream>\nusing namespace std;\n\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    return 0;\n}\n",
  c: "#include <stdio.h>\n\nint main(void) {\n    return 0;\n}\n",
  java: "import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n    }\n}\n",
};

const MONACO_LANG_MAP: Record<string, string> = {
  python3: "python",
  javascript: "javascript",
  cpp: "cpp",
  c: "c",
  java: "java",
};

interface CodingEditorPaneProps {
  language: string;
  allowedLanguages: string[];
  code: string;
  theme: "vs-dark" | "light";
  fontSize: number;
  onLanguageChange: (lang: string) => void;
  onCodeChange: (code: string) => void;
  onThemeToggle: () => void;
  onFontSizeChange: (size: number) => void;
  onResetCode: () => void;
}

export default function CodingEditorPane({
  language,
  allowedLanguages,
  code,
  theme,
  fontSize,
  onLanguageChange,
  onCodeChange,
  onThemeToggle,
  onFontSizeChange,
  onResetCode,
}: CodingEditorPaneProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", minWidth: 0, overflow: "hidden", background: theme === "vs-dark" ? "#1e1e1e" : "#ffffff" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 14px",
          borderBottom: "1px solid #e2e8f0",
          background: "#f8fafc",
          gap: "8px",
          flexWrap: "wrap",
          boxSizing: "border-box",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label htmlFor="coding-lang-select" style={{ fontSize: "12px", fontWeight: 600, color: "#475569" }}>
            Language
          </label>
          <select
            id="coding-lang-select"
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              fontSize: "13px",
              background: "#ffffff",
            }}
          >
            {allowedLanguages.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label htmlFor="coding-font-select" style={{ fontSize: "12px", color: "#475569" }}>
            Size
          </label>
          <select
            id="coding-font-select"
            value={fontSize}
            onChange={(e) => onFontSizeChange(Number(e.target.value))}
            style={{
              padding: "4px 8px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              fontSize: "12px",
              background: "#ffffff",
            }}
          >
            {[12, 14, 16, 18, 20].map((s) => (
              <option key={s} value={s}>
                {s}px
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onThemeToggle}
            aria-label="Toggle editor theme"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 8px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              fontSize: "12px",
              color: "#334155",
            }}
          >
            {theme === "vs-dark" ? <Sun size={14} /> : <Moon size={14} />}
            {theme === "vs-dark" ? "Light" : "Dark"}
          </button>

          <button
            type="button"
            onClick={onResetCode}
            aria-label="Reset to starter code"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 10px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              background: "#ffffff",
              fontSize: "12px",
              color: "#334155",
            }}
          >
            <RotateCcw size={13} /> Reset
          </button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <Suspense
          fallback={
            <div style={{ padding: "24px", color: "#64748b", fontSize: "13px" }}>
              Loading code editor...
            </div>
          }
        >
          <MonacoEditor
            height="100%"
            language={MONACO_LANG_MAP[language] || "python"}
            theme={theme}
            value={code}
            onChange={(val) => onCodeChange(val ?? "")}
            options={{
              fontSize,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 4,
              wordWrap: "on",
            }}
          />
        </Suspense>
      </div>
    </div>
  );
}
