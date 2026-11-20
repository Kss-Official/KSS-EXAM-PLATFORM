import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ExamSecure ErrorBoundary Caught Error]:", error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.warn("Could not clear storage:", e);
    }
    window.location.href = "/candidate";
  };

  handleGoAdmin = () => {
    window.location.href = "/admin/login";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          width: "100vw",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#090d16",
          color: "#f8fafc",
          fontFamily: "'DM Sans', sans-serif",
          padding: "24px"
        }}>
          <div style={{
            background: "#1e293b",
            borderRadius: "14px",
            border: "1px solid #334155",
            padding: "36px",
            maxWidth: "600px",
            width: "100%",
            textAlign: "center",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)"
          }}>
            <div style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              background: "#450a0a",
              color: "#ef4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px"
            }}>
              <AlertTriangle size={30} />
            </div>

            <h2 style={{ margin: "0 0 10px 0", fontSize: "20px", color: "#ffffff" }}>
              Application Error Caught
            </h2>

            <p style={{ margin: "0 0 18px 0", fontSize: "13.5px", color: "#94a3b8", lineHeight: 1.5 }}>
              A client-side runtime exception occurred during rendering. This is usually caused by outdated cached exam session data in your browser.
            </p>

            <div style={{
              background: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "8px",
              padding: "12px",
              textAlign: "left",
              marginBottom: "24px",
              maxHeight: "140px",
              overflowY: "auto"
            }}>
              <code style={{ fontSize: "12px", color: "#f87171", fontFamily: "monospace", wordBreak: "break-all" }}>
                {this.state.error?.toString() || "Unknown error"}
              </code>
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  background: "#017846",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 18px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <RotateCcw size={15} /> Clear Cached Data & Restart
              </button>

              <button
                type="button"
                onClick={this.handleGoAdmin}
                style={{
                  background: "#334155",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 18px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <Home size={15} /> Admin Sign In
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
