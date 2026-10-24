import { useState, useEffect, type ReactNode } from "react";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { useRouter } from "../../router";
import { getAuthMe, type AuthUser } from "../../services/api";

interface AdminRouteGuardProps {
  children: (user: AuthUser) => ReactNode;
}

export default function AdminRouteGuard({ children }: AdminRouteGuardProps) {
  const { path, navigate } = useRouter();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    let isCancelled = false;

    const verifySession = async () => {
      setLoading(true);
      setForbidden(false);

      try {
        const user = await getAuthMe();
        if (isCancelled) return;

        if (user && user.role === "SUPER_ADMIN") {
          setCurrentUser(user);
        } else {
          // Authenticated but does not possess SUPER_ADMIN role
          setForbidden(true);
        }
      } catch {
        if (!isCancelled) {
          // Unauthenticated -> redirect to /admin/login
          navigate("/admin/login");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    verifySession();

    return () => {
      isCancelled = true;
    };
  }, [path, navigate]);

  if (loading) {
    return (
      <div 
        style={{
          minHeight: "100vh",
          width: "100vw",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#090d16",
          color: "#94a3b8",
          fontFamily: "'DM Sans', sans-serif",
          gap: "14px"
        }}
      >
        <div 
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "50%",
            border: "3px solid #1e293b",
            borderTopColor: "#017846",
            animation: "spin 0.8s linear infinite"
          }} 
        />
        <div style={{ textAlign: "center" }}>
          <strong style={{ display: "block", color: "#f8fafc", fontSize: "14px", marginBottom: "4px" }}>
            Verifying Administrator Clearance
          </strong>
          <span style={{ fontSize: "12px", color: "#64748b" }}>
            Checking server session cookie & RBAC permissions...
          </span>
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div 
        style={{
          minHeight: "100vh",
          width: "100vw",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
          color: "#f8fafc",
          fontFamily: "'DM Sans', sans-serif",
          padding: "20px"
        }}
      >
        <div 
          style={{
            background: "#1e293b",
            borderRadius: "12px",
            border: "1px solid #334155",
            padding: "32px",
            maxWidth: "460px",
            textAlign: "center"
          }}
        >
          <div 
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "50%",
              background: "#450a0a",
              color: "#ef4444",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px"
            }}
          >
            <ShieldAlert size={28} />
          </div>

          <h2 style={{ margin: "0 0 8px 0", fontSize: "18px", color: "#ffffff" }}>
            403 Forbidden: Insufficient Permissions
          </h2>
          <p style={{ margin: "0 0 20px 0", fontSize: "13px", color: "#94a3b8", lineHeight: "1.5" }}>
            Your account is authenticated, but you do not possess the required <strong>SUPER_ADMIN</strong> role to access the ExamSecure administrator portal.
          </p>

          <button
            type="button"
            className="secondary"
            onClick={() => navigate("/admin/login")}
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", padding: "8px 16px" }}
          >
            <ArrowLeft size={14} /> Return to Administrator Sign In
          </button>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return <>{children(currentUser)}</>;
}
