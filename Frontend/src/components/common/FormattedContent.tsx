import React, { useState } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { Copy, Check, Maximize2, X } from "lucide-react";

interface FormattedContentProps {
  content: string;
  className?: string;
  imageUrl?: string;
}

export default function FormattedContent({ content, className = "", imageUrl }: FormattedContentProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  if (!content && !imageUrl) {
    return null;
  }

  const handleCopyCode = (code: string, blockIdx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(blockIdx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  // Helper to render KaTeX safely
  const renderMathSafely = (formula: string, displayMode: boolean) => {
    try {
      const html = katex.renderToString(formula.trim(), {
        displayMode,
        throwOnError: false,
      });
      return <span dangerouslySetInnerHTML={{ __html: html }} />;
    } catch {
      return <code>{formula}</code>;
    }
  };

  // Helper to format inline text with bold (**text**), italics (*text*), inline code (`code`), and inline math ($formula$)
  const renderInlineFormatted = (text: string, keyPrefix: string) => {
    // Regex matches inline math $...$, inline code `...`, bold **...**, italics *...*, or markdown images ![alt](url)
    const tokenRegex = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|`[^`]+?`|\*\*[^*]+?\*\*|\*[^*]+?\*|!\[.*?\]\(.*?\))/g;
    const parts = text.split(tokenRegex);

    return parts.map((part, i) => {
      const partKey = `${keyPrefix}-${i}`;

      if (!part) return null;

      // Display math $$...$$
      if (part.startsWith("$$") && part.endsWith("$$")) {
        const math = part.slice(2, -2);
        return (
          <div key={partKey} className="formatted-display-math" style={{ margin: "10px 0", textAlign: "center" }}>
            {renderMathSafely(math, true)}
          </div>
        );
      }

      // Inline math $...$
      if (part.startsWith("$") && part.endsWith("$") && part.length > 2) {
        const math = part.slice(1, -1);
        return <span key={partKey} className="formatted-inline-math">{renderMathSafely(math, false)}</span>;
      }

      // Inline code `...`
      if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
        return (
          <code 
            key={partKey} 
            style={{
              background: "#f1f5f9",
              color: "#0f172a",
              padding: "2px 6px",
              borderRadius: "4px",
              fontSize: "0.9em",
              fontFamily: "'JetBrains Mono', Consolas, monospace",
              border: "1px solid #e2e8f0"
            }}
          >
            {part.slice(1, -1)}
          </code>
        );
      }

      // Bold **...**
      if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
        return <strong key={partKey} style={{ color: "#0f172a" }}>{part.slice(2, -2)}</strong>;
      }

      // Italics *...*
      if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
        return <em key={partKey}>{part.slice(1, -1)}</em>;
      }

      // Markdown image ![alt](url)
      const imgMatch = part.match(/^!\[(.*?)\]\((.*?)\)$/);
      if (imgMatch) {
        const alt = imgMatch[1];
        const src = imgMatch[2];
        return (
          <div key={partKey} className="formatted-image-wrapper" style={{ margin: "14px 0", textAlign: "center" }}>
            <div style={{ position: "relative", display: "inline-block", maxWidth: "100%" }}>
              <img 
                src={src} 
                alt={alt || "Diagram"} 
                onClick={() => setZoomImage(src)}
                style={{
                  maxWidth: "100%",
                  maxHeight: "360px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  cursor: "zoom-in",
                  objectFit: "contain"
                }} 
              />
              <button
                type="button"
                onClick={() => setZoomImage(src)}
                title="Click to expand"
                style={{
                  position: "absolute",
                  bottom: "8px",
                  right: "8px",
                  background: "rgba(15, 23, 42, 0.75)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "4px",
                  padding: "4px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                <Maximize2 size={13} />
              </button>
            </div>
            {alt && <div style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", fontStyle: "italic" }}>{alt}</div>}
          </div>
        );
      }

      // Plain text
      return <span key={partKey}>{part}</span>;
    });
  };

  // Parse blocks: split text by code block markers (```lang ... ```)
  const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let blockIndex = 0;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // 1. Text before code block
    if (match.index > lastIndex) {
      const textChunk = content.substring(lastIndex, match.index);
      const paragraphs = textChunk.split(/\n{2,}/);
      paragraphs.forEach((p, pIdx) => {
        if (p.trim()) {
          elements.push(
            <div key={`p-${blockIndex}-${pIdx}`} style={{ marginBottom: "8px", lineHeight: "1.6" }}>
              {renderInlineFormatted(p, `p-${blockIndex}-${pIdx}`)}
            </div>
          );
        }
      });
    }

    // 2. The Code block
    const lang = (match[1] || "CODE").toUpperCase();
    const rawCode = match[2].trim();
    const currentBlockIdx = blockIndex;
    const lines = rawCode.split("\n");

    elements.push(
      <div 
        key={`code-${currentBlockIdx}`}
        style={{
          margin: "14px 0",
          borderRadius: "8px",
          background: "#090d16",
          border: "1px solid #1e293b",
          overflow: "hidden",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          fontFamily: "'JetBrains Mono', Consolas, monospace",
          fontSize: "13px"
        }}
      >
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 12px",
          background: "#0f172a",
          borderBottom: "1px solid #1e293b",
          fontSize: "11px",
          color: "#94a3b8",
          letterSpacing: "0.05em",
          fontWeight: 600
        }}>
          <span>{lang}</span>
          <button
            type="button"
            onClick={() => handleCopyCode(rawCode, currentBlockIdx)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              background: "transparent",
              border: "none",
              color: copiedIndex === currentBlockIdx ? "#4ade80" : "#94a3b8",
              cursor: "pointer",
              fontSize: "11px",
              padding: "2px 6px",
              borderRadius: "4px"
            }}
          >
            {copiedIndex === currentBlockIdx ? (
              <>
                <Check size={12} /> Copied!
              </>
            ) : (
              <>
                <Copy size={12} /> Copy Code
              </>
            )}
          </button>
        </div>
        <div style={{
          padding: "12px",
          overflowX: "auto",
          lineHeight: "1.5",
          color: "#e2e8f0"
        }}>
          <table style={{ borderCollapse: "collapse", width: "100%", margin: 0 }}>
            <tbody>
              {lines.map((line, lIdx) => (
                <tr key={`line-${lIdx}`}>
                  <td style={{
                    width: "36px",
                    userSelect: "none",
                    color: "#475569",
                    textAlign: "right",
                    paddingRight: "12px",
                    verticalAlign: "top",
                    fontSize: "12px"
                  }}>
                    {lIdx + 1}
                  </td>
                  <td style={{
                    whiteSpace: "pre",
                    fontFamily: "inherit",
                    verticalAlign: "top",
                    color: "#f8fafc"
                  }}>
                    {line}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );

    lastIndex = match.index + match[0].length;
    blockIndex++;
  }

  // 3. Any trailing text after the last code block
  if (lastIndex < content.length) {
    const textChunk = content.substring(lastIndex);
    const paragraphs = textChunk.split(/\n{2,}/);
    paragraphs.forEach((p, pIdx) => {
      if (p.trim()) {
        elements.push(
          <div key={`p-end-${pIdx}`} style={{ marginBottom: "8px", lineHeight: "1.6" }}>
            {renderInlineFormatted(p, `p-end-${pIdx}`)}
          </div>
        );
      }
    });
  }

  return (
    <div className={`formatted-content-root ${className}`}>
      {elements}

      {/* Optional attached question image */}
      {imageUrl && (
        <div style={{ margin: "14px 0", textAlign: "center" }}>
          <div style={{ position: "relative", display: "inline-block", maxWidth: "100%" }}>
            <img 
              src={imageUrl} 
              alt="Question Diagram" 
              onClick={() => setZoomImage(imageUrl)}
              style={{
                maxWidth: "100%",
                maxHeight: "360px",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                cursor: "zoom-in",
                objectFit: "contain"
              }} 
            />
            <button
              type="button"
              onClick={() => setZoomImage(imageUrl)}
              title="Click to expand"
              style={{
                position: "absolute",
                bottom: "8px",
                right: "8px",
                background: "rgba(15, 23, 42, 0.75)",
                color: "#ffffff",
                border: "none",
                borderRadius: "4px",
                padding: "4px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Maximize2 size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Lightbox Zoom Modal */}
      {zoomImage && (
        <div 
          onClick={() => setZoomImage(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.85)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999999,
            padding: "24px",
            cursor: "zoom-out"
          }}
        >
          <div style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh" }}>
            <button
              type="button"
              onClick={() => setZoomImage(null)}
              style={{
                position: "absolute",
                top: "-36px",
                right: 0,
                background: "transparent",
                border: "none",
                color: "#ffffff",
                cursor: "pointer"
              }}
            >
              <X size={24} />
            </button>
            <img 
              src={zoomImage} 
              alt="Zoomed diagram" 
              style={{
                maxWidth: "100%",
                maxHeight: "85vh",
                borderRadius: "8px",
                boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
                background: "#ffffff"
              }} 
            />
          </div>
        </div>
      )}
    </div>
  );
}

