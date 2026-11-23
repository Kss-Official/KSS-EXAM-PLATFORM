import React, { useState, useRef, useEffect } from "react";
import { 
  Sparkles, 
  X, 
  Send, 
  Trash2, 
  Maximize2, 
  Minimize2, 
  ArrowRight, 
  CheckCircle2, 
  Compass, 
  Sliders, 
  FileSpreadsheet,
  Zap,
  RotateCcw
} from "lucide-react";
import { useRouter } from "../../router";
import { sendAIChat, type AIChatMessage } from "../../services/api";
import { dispatchUIAction, type ClientUIAction } from "../../services/aiActionBus";

interface ChatItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  clientActions?: ClientUIAction[];
  toolCalls?: Array<{ tool: string; arguments: any; summary: string }>;
  timestamp: string;
}

const DEFAULT_SUGGESTIONS = [
  "What exams are available in the platform?",
  "Show me the results of that exam and sort high to low",
  "Show today's Slot 1 candidates",
  "Open the candidate Add Document modal"
];

export default function AICopilotWidget() {
  const { path, navigate } = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatItem[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I am **ExamSecure Copilot**. I analyze real-time platform data and directly control this web application (navigating pages, filtering candidates, sorting result tables, and opening modals) per your instructions.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    }
  ]);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen, messages]);

  const handleSend = async (customText?: string) => {
    const textToSend = customText || inputMessage;
    if (!textToSend.trim() || loading) return;

    const userMsg: ChatItem = {
      id: `usr-${Date.now()}`,
      role: "user",
      content: textToSend.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!customText) setInputMessage("");
    setLoading(true);

    try {
      // Build conversation history for context
      const historyPayload: AIChatMessage[] = messages
        .filter(m => m.id !== "welcome")
        .slice(-6)
        .map(m => ({ role: m.role, content: m.content }));

      const res = await sendAIChat({
        message: userMsg.content,
        history: historyPayload,
        currentPage: path,
        currentParams: {}
      });

      const assistantMsg: ChatItem = {
        id: `ast-${Date.now()}`,
        role: "assistant",
        content: res.reply || "Done.",
        clientActions: res.client_actions || [],
        toolCalls: res.tool_calls || [],
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };

      setMessages(prev => [...prev, assistantMsg]);

      // 🚀 Automatically execute all UI action directives on the webpage!
      if (res.client_actions && Array.isArray(res.client_actions)) {
        res.client_actions.forEach(action => {
          dispatchUIAction(action, navigate);
        });
      }
    } catch (err: any) {
      const errorMsg: ChatItem = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: "Sorry, I encountered an issue executing that command. Please verify connection and try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: "Chat cleared. What can I help you inspect, navigate, or filter?",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      }
    ]);
  };

  return (
    <div style={{ position: "fixed", bottom: "24px", right: "24px", zIndex: 9999, fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: "linear-gradient(135deg, #017846 0%, #015431 100%)",
            color: "#ffffff",
            padding: "12px 18px",
            borderRadius: "30px",
            border: "1.5px solid rgba(255, 255, 255, 0.2)",
            boxShadow: "0 10px 25px -5px rgba(1, 120, 70, 0.45), 0 8px 10px -6px rgba(0, 0, 0, 0.15)",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "14px",
            transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)"
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = "translateY(-3px) scale(1.02)";
            e.currentTarget.style.boxShadow = "0 15px 30px -5px rgba(1, 120, 70, 0.55)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = "translateY(0) scale(1)";
            e.currentTarget.style.boxShadow = "0 10px 25px -5px rgba(1, 120, 70, 0.45)";
          }}
        >
          <div style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255, 255, 255, 0.2)",
            borderRadius: "50%",
            padding: "6px"
          }}>
            <Sparkles size={17} color="#ffffff" />
            <span style={{
              position: "absolute",
              top: "-2px",
              right: "-2px",
              width: "8px",
              height: "8px",
              background: "#4ade80",
              borderRadius: "50%",
              boxShadow: "0 0 6px #4ade80"
            }} />
          </div>
          <span>AI Copilot</span>
        </button>
      )}

      {/* Floating Chat Window */}
      {isOpen && (
        <div style={{
          width: isMinimized ? "320px" : "420px",
          height: isMinimized ? "52px" : "580px",
          maxHeight: "85vh",
          background: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 20px 40px -10px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.08)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)"
        }}>
          {/* Header */}
          <div style={{
            background: "linear-gradient(135deg, #017846 0%, #015431 100%)",
            color: "#ffffff",
            padding: "12px 16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer"
          }}>
            <div 
              onClick={() => setIsMinimized(!isMinimized)} 
              style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}
            >
              <div style={{
                background: "rgba(255, 255, 255, 0.2)",
                borderRadius: "8px",
                padding: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>
                <Sparkles size={16} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: "14px", lineHeight: "1.2" }}>ExamSecure Copilot</div>
                <div style={{ fontSize: "11px", opacity: 0.85, display: "flex", alignItems: "center", gap: "5px" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#4ade80", display: "inline-block" }}></span>
                  Groq 120B • Webpage Controller
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <button
                onClick={handleClearChat}
                title="Clear conversation"
                style={{ background: "transparent", border: "none", color: "#ffffff", cursor: "pointer", padding: "4px", opacity: 0.8 }}
                onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                onMouseLeave={e => e.currentTarget.style.opacity = "0.8"}
              >
                <Trash2 size={15} />
              </button>
              <button
                onClick={() => setIsMinimized(!isMinimized)}
                title={isMinimized ? "Expand" : "Minimize"}
                style={{ background: "transparent", border: "none", color: "#ffffff", cursor: "pointer", padding: "4px", opacity: 0.8 }}
                onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                onMouseLeave={e => e.currentTarget.style.opacity = "0.8"}
              >
                {isMinimized ? <Maximize2 size={15} /> : <Minimize2 size={15} />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close"
                style={{ background: "transparent", border: "none", color: "#ffffff", cursor: "pointer", padding: "4px", opacity: 0.8 }}
                onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                onMouseLeave={e => e.currentTarget.style.opacity = "0.8"}
              >
                <X size={17} />
              </button>
            </div>
          </div>

          {/* Body when expanded */}
          {!isMinimized && (
            <>
              {/* Messages List */}
              <div style={{
                flex: 1,
                padding: "16px",
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                background: "#f8fafc"
              }}>
                {messages.map(m => (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: m.role === "user" ? "flex-end" : "flex-start",
                      maxWidth: "100%"
                    }}
                  >
                    <div style={{
                      maxWidth: "88%",
                      padding: "10px 14px",
                      borderRadius: m.role === "user" ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                      background: m.role === "user" ? "#017846" : "#ffffff",
                      color: m.role === "user" ? "#ffffff" : "#1e293b",
                      fontSize: "13px",
                      lineHeight: "1.5",
                      boxShadow: m.role === "user" ? "0 2px 6px rgba(1, 120, 70, 0.25)" : "0 1px 3px rgba(0,0,0,0.06)",
                      border: m.role === "user" ? "none" : "1px solid #e2e8f0",
                      wordBreak: "break-word"
                    }}>
                      <div dangerouslySetInnerHTML={{
                        __html: m.content
                          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                          .replace(/\n/g, "<br />")
                      }} />

                      {/* Display Action pills if executed */}
                      {m.clientActions && m.clientActions.length > 0 && (
                        <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
                          {m.clientActions.map((act, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                background: "#f0fdf4",
                                border: "1px solid #bbf7d0",
                                color: "#166534",
                                padding: "4px 8px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: 600
                              }}
                            >
                              <Zap size={12} color="#16a34a" />
                              <span>Action: {act.action}</span>
                              {act.route && <span style={{ opacity: 0.8 }}>({act.route})</span>}
                              {act.direction && <span style={{ opacity: 0.8 }}>({act.direction.toUpperCase()})</span>}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Display Tool Executed chips */}
                      {m.toolCalls && m.toolCalls.length > 0 && (
                        <div style={{ marginTop: "6px", fontSize: "10.5px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
                          <CheckCircle2 size={11} color="#017846" />
                          <span>Queried: {m.toolCalls.map(t => t.tool).join(", ")}</span>
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: "10px", color: "#94a3b8", marginTop: "3px", padding: "0 4px" }}>
                      {m.timestamp}
                    </span>
                  </div>
                ))}

                {/* Loading indicator */}
                {loading && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#64748b", fontSize: "12px", padding: "6px 10px" }}>
                    <div style={{
                      width: "14px",
                      height: "14px",
                      border: "2px solid #017846",
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      animation: "spin 0.8s linear infinite"
                    }} />
                    <span>Analyzing database & executing actions...</span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Suggestions shortcuts bar */}
              {messages.length <= 2 && (
                <div style={{ padding: "8px 12px", background: "#f1f5f9", borderTop: "1px solid #e2e8f0", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {DEFAULT_SUGGESTIONS.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSend(s)}
                      style={{
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: "12px",
                        padding: "4px 9px",
                        fontSize: "11px",
                        color: "#334155",
                        cursor: "pointer",
                        fontWeight: 500,
                        textAlign: "left",
                        transition: "all 0.15s ease"
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = "#017846";
                        e.currentTarget.style.color = "#017846";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = "#cbd5e1";
                        e.currentTarget.style.color = "#334155";
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Input Box */}
              <div style={{
                padding: "12px 14px",
                background: "#ffffff",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={e => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything or command the page..."
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    outline: "none",
                    boxShadow: "inset 0 1px 2px rgba(0,0,0,0.04)"
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = "#017846"}
                  onBlur={e => e.currentTarget.style.borderColor = "#cbd5e1"}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={loading || !inputMessage.trim()}
                  style={{
                    background: inputMessage.trim() && !loading ? "#017846" : "#e2e8f0",
                    color: inputMessage.trim() && !loading ? "#ffffff" : "#94a3b8",
                    border: "none",
                    borderRadius: "8px",
                    width: "36px",
                    height: "36px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: inputMessage.trim() && !loading ? "pointer" : "default",
                    transition: "all 0.2s ease"
                  }}
                >
                  <Send size={15} />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
