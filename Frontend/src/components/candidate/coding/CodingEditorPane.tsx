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
  const isDark = theme === "vs-dark";
  const toolbarBg = isDark ? "#0f172a" : "#f8fafc";
  const toolbarBorder = isDark ? "#1e293b" : "#e2e8f0";
  const controlBg = isDark ? "#1e293b" : "#ffffff";
  const controlBorder = isDark ? "#334155" : "#cbd5e1";
  const controlText = isDark ? "#e2e8f0" : "#334155";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", minWidth: 0, overflow: "hidden", background: isDark ? "#1e1e1e" : "#ffffff" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "9px 14px",
          borderBottom: `1px solid ${toolbarBorder}`,
          background: toolbarBg,
          gap: "8px",
          flexWrap: "wrap",
          boxSizing: "border-box",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <select
            id="coding-lang-select"
            aria-label="Programming language"
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            style={{
              padding: "5px 10px",
              borderRadius: "7px",
              border: `1px solid ${controlBorder}`,
              fontSize: "12.5px",
              fontWeight: 600,
              background: controlBg,
              color: controlText,
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
          <select
            id="coding-font-select"
            aria-label="Editor font size"
            value={fontSize}
            onChange={(e) => onFontSizeChange(Number(e.target.value))}
            style={{
              padding: "5px 8px",
              borderRadius: "7px",
              border: `1px solid ${controlBorder}`,
              fontSize: "12px",
              fontWeight: 500,
              background: controlBg,
              color: controlText,
            }}
          >
            {[12, 14, 16, 18, 20].map((s) => (
              <option key={s} value={s}>
                Size: {s}px
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
              gap: "5px",
              padding: "5px 10px",
              borderRadius: "7px",
              border: `1px solid ${controlBorder}`,
              background: controlBg,
              fontSize: "12px",
              fontWeight: 500,
              color: controlText,
            }}
          >
            {isDark ? <Sun size={13} /> : <Moon size={13} />}
            {isDark ? "Light" : "Dark"}
          </button>

          <button
            type="button"
            onClick={onResetCode}
            aria-label="Reset to starter code"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "5px 10px",
              borderRadius: "7px",
              border: `1px solid ${controlBorder}`,
              background: controlBg,
              fontSize: "12px",
              fontWeight: 500,
              color: controlText,
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
