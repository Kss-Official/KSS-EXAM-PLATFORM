import { useState, useRef, useEffect, type ReactNode } from "react";
import { 
  ShieldCheck, 
  LayoutDashboard, 
  FileText, 
  PlusCircle, 
  HelpCircle, 
  Users, 
  BarChart3, 
  Settings, 
  Menu, 
  X, 
  Bell, 
  ExternalLink,
  ChevronRight,
  User,
  LogOut,
  ChevronDown,
  Mail,
  Shield,
  Briefcase
} from "lucide-react";
import { useRouter, Link } from "../../router";
import type { AdminDashboardResponse } from "../../types";
import { logoutAdmin, type AuthUser } from "../../services/api";

interface AdminLayoutProps {
  children: ReactNode;
  dashboardData: AdminDashboardResponse | null;
  loading: boolean;
  error: string | null;
  statusCode?: number;
  currentUser?: AuthUser;
}

export default function AdminLayout({
  children,
  dashboardData,
  loading,
  error,
  statusCode,
  currentUser
}: AdminLayoutProps) {
  const { path, navigate } = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await logoutAdmin();
    setUserMenuOpen(false);
    navigate("/admin/login");
  };

  const getPageTitle = () => {
    if (path === "/admin/exams/new/coding" || path.startsWith("/admin/exams/new/coding")) return "Create Coding Examination (Round 2)";
    if (path === "/admin/exams/new/mcq" || path.startsWith("/admin/exams/new/mcq")) return "Create MCQ Examination (Round 1)";
    if (path.startsWith("/admin/exams/new")) return "Create Examination ΓÇö Select Round";
    if (path.startsWith("/admin/exams")) return "Examinations Management";
    if (path.startsWith("/admin/departments")) return "Academic Departments";
    if (path.startsWith("/admin/questions")) return "Question Bank (MCQs)";
    if (path.startsWith("/admin/candidates")) return "Candidate Directory";
    if (path.startsWith("/admin/results")) return "Examination Results & Analytics";
    if (path.startsWith("/admin/settings")) return "Platform & SEB Settings";
    return "Campus Placement Dashboard";
  };

  const adminFullName = currentUser?.fullName || "D. Koushik";
  const adminEmail = currentUser?.email || "d.koushik@kalpanaaasoftwaresolutions.in";
  const adminRoleDisplay = currentUser?.role === "SUPER_ADMIN" ? "Super Administrator" : (currentUser?.role || "Administrator");
  const adminInitials = adminFullName
    .split(" ")
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase() || "DK";

  const getActiveNavRoute = (currentPath: string): string => {
    const normalized = currentPath.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";

    // 1. Specific child route checked first: Create Exam (/admin/exams/new)
    if (normalized === "/admin/exams/new" || normalized.startsWith("/admin/exams/new/")) {
      return "/admin/exams/new";
    }

    // 2. Department configuration (renders exam creation workflow)
    if (normalized === "/admin/departments" || normalized.startsWith("/admin/departments/")) {
      return "/admin/exams/new";
    }

    // 3. Exams list and nested exam routes, explicitly excluding /admin/exams/new
    if (normalized === "/admin/exams" || normalized.startsWith("/admin/exams/")) {
      return "/admin/exams";
    }

    // 4. Question Bank
    if (normalized === "/admin/questions" || normalized.startsWith("/admin/questions/")) {
      return "/admin/questions";
    }

    // 5. Candidates
    if (normalized === "/admin/candidates" || normalized.startsWith("/admin/candidates/")) {
      return "/admin/candidates";
    }

    // 6. Results & Analytics
    if (normalized === "/admin/results" || normalized.startsWith("/admin/results/")) {
      return "/admin/results";
    }

    // 7. Settings
    if (normalized === "/admin/settings" || normalized.startsWith("/admin/settings/")) {
      return "/admin/settings";
    }

    // 8. Overview / Dashboard
    if (normalized === "/admin/dashboard" || normalized === "/admin" || normalized.startsWith("/admin/dashboard/")) {
      return "/admin/dashboard";
    }

    return "";
  };

  const activeNavRoute = getActiveNavRoute(path);

  const navItems = [
    { label: "Overview", to: "/admin/dashboard", icon: LayoutDashboard },
    { label: "Exams", to: "/admin/exams", icon: FileText, badge: dashboardData ? String(dashboardData.totalExams) : undefined },
    { label: "Create Exam", to: "/admin/exams/new", icon: PlusCircle },
    { label: "Question Bank", to: "/admin/questions", icon: HelpCircle },
    { label: "Candidates", to: "/admin/candidates", icon: Users, badge: dashboardData ? String(dashboardData.totalCandidates) : undefined },
    { label: "Results", to: "/admin/results", icon: BarChart3 },
    { label: "Settings", to: "/admin/settings", icon: Settings },
  ];

  return (
    <div className="admin-app">
      {/* Sidebar */}
      <aside className={`admin-sidebar ${mobileMenuOpen ? "open" : ""}`}>
        <div className="admin-sidebar-header">
          <Link to="/admin/dashboard" className="admin-sidebar-brand" onClick={() => setMobileMenuOpen(false)}>
            <div className="admin-sidebar-logo">
              <ShieldCheck size={22} />
            </div>
            <div className="admin-sidebar-brand-text">
              <b>ExamSecure</b>
              <small>ADMIN CONSOLE</small>
            </div>
          </Link>
          <button 
            type="button" 
            className="sidebar-toggle-btn"
            style={{ color: "#ffffff" }}
            onClick={() => setMobileMenuOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="admin-sidebar-nav">
          <span className="admin-nav-section-title">Navigation</span>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeNavRoute === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`admin-nav-link ${isActive ? "active" : ""}`}
                onClick={() => setMobileMenuOpen(false)}
              >
                <Icon size={17} />
                <span>{item.label}</span>
                {item.badge && <span className="badge">{item.badge}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <button
            type="button"
            className="candidate-portal-switch"
            onClick={() => {
              setMobileMenuOpen(false);
              navigate("/candidate");
            }}
          >
            <ExternalLink size={14} />
            <span>Open Candidate View</span>
          </button>

          <div className="admin-system-health">
            <span style={{ display: "flex", alignItems: "center" }}>
              <i 
                className={`health-dot ${
                  loading ? "auth" : error && statusCode === 401 ? "auth" : error ? "offline" : "online"
                }`} 
              />
              Backend: {loading ? "Connecting..." : error && statusCode === 401 ? "Spring Security 401" : error ? "Offline" : "Online"}
            </span>
            <small style={{ color: "#94a3b8" }}>v1.0.0</small>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="admin-main-wrap">
        <header className="admin-header">
          <div className="admin-header-left">
            <button 
              type="button" 
              className="sidebar-toggle-btn"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div>
              <h1 className="admin-page-title">{getPageTitle()}</h1>
              <div className="admin-breadcrumb">
                <span>Secure Exam Platform</span>
                <ChevronRight size={12} />
                <span>Admin</span>
                <ChevronRight size={12} />
                <span style={{ color: "#0f172a", fontWeight: 600 }}>{getPageTitle()}</span>
              </div>
            </div>
          </div>

          <div className="admin-header-right">
            {/* Notifications Button */}
            <div style={{ position: "relative" }}>
              <button 
                type="button" 
                className="admin-notifications-btn"
                title="Notifications"
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <Bell size={17} />
                <span className="admin-notifications-badge" />
              </button>

              {showNotifications && (
                <div style={{
                  position: "absolute",
                  top: "42px",
                  right: 0,
                  width: "280px",
                  background: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.1)",
                  padding: "14px",
                  zIndex: 60
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <b style={{ fontSize: "12px" }}>System Notifications</b>
                    <small style={{ color: "#64748b", cursor: "pointer" }} onClick={() => setShowNotifications(false)}>Close</small>
                  </div>
                  <div style={{ fontSize: "11.5px", color: "#475569", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: "6px" }}>
                      <strong>Safe Exam Browser (SEB)</strong>
                      <p style={{ margin: "2px 0 0 0", color: "#64748b" }}>Configuration profile verified for campus placement.</p>
                    </div>
                    <div>
                      <strong>Spring Boot Backend</strong>
                      <p style={{ margin: "2px 0 0 0", color: "#64748b" }}>
                        {dashboardData ? "API connected and healthy." : "Backend authorization is active."}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Administrator Profile Pill & Dropdown */}
            <div ref={userMenuRef} style={{ position: "relative" }}>
              <button
                type="button"
                className="admin-user-pill"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                style={{
                  cursor: "pointer",
                  border: userMenuOpen ? "1.5px solid #017846" : "1px solid #e2e8f0",
                  background: userMenuOpen ? "#f8fafc" : "#ffffff",
                  boxShadow: userMenuOpen ? "0 0 0 3px rgba(1, 120, 70, 0.12)" : "none",
                  paddingRight: "8px",
                  transition: "all 0.15s ease",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}
                aria-haspopup="true"
                aria-expanded={userMenuOpen}
                title="Super Administrator Menu"
              >
                <div className="admin-avatar">{adminInitials}</div>
                <div className="admin-user-details" style={{ textAlign: "left" }}>
                  <span className="admin-user-name">{adminFullName}</span>
                  <span className="admin-user-role">{adminRoleDisplay}</span>
                </div>
                <ChevronDown 
                  size={14} 
                  color="#64748b" 
                  style={{ 
                    transform: userMenuOpen ? "rotate(180deg)" : "none", 
                    transition: "transform 0.18s ease" 
                  }} 
                />
              </button>

              {/* Dropdown Menu */}
              {userMenuOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "46px",
                    right: 0,
                    width: "260px",
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "10px",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                    padding: "6px",
                    zIndex: 100,
                    animation: "fadeIn 0.15s ease-out"
                  }}
                >
                  {/* Officer Header Info */}
                  <div style={{ padding: "10px 12px 10px", borderBottom: "1px solid #f1f5f9", marginBottom: "4px" }}>
                    <div style={{ fontSize: "12.5px", fontWeight: 700, color: "#0f172a" }}>{adminFullName}</div>
                    <div style={{ fontSize: "11px", color: "#64748b", margin: "1px 0 6px", wordBreak: "break-all" }}>{adminEmail}</div>
                    <span 
                      style={{
                        display: "inline-block",
                        fontSize: "10px",
                        fontWeight: 600,
                        padding: "2px 6px",
                        background: "#EAF6EF",
                        color: "#017846",
                        borderRadius: "4px",
                        border: "1px solid #D9E6DF"
                      }}
                    >
                      {adminRoleDisplay}
                    </span>
                  </div>

                  {/* Dropdown Action Items */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    {/* Profile Item */}
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        setShowProfileModal(true);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        width: "100%",
                        padding: "8px 12px",
                        fontSize: "12px",
                        fontWeight: 500,
                        color: "#1e293b",
                        background: "none",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        textAlign: "left"
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                    >
                      <User size={15} color="#017846" />
                      <span>Profile</span>
                    </button>

                    {/* Settings Item */}
                    <button
                      type="button"
                      onClick={() => {
                        setUserMenuOpen(false);
                        navigate("/admin/settings");
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        width: "100%",
                        padding: "8px 12px",
                        fontSize: "12px",
                        fontWeight: 500,
                        color: "#1e293b",
                        background: "none",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        textAlign: "left"
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#f1f5f9")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                    >
                      <Settings size={15} color="#017846" />
                      <span>Settings</span>
                    </button>

                    {/* Divider */}
                    <div style={{ height: "1px", background: "#f1f5f9", margin: "4px 0" }} />

                    {/* Sign Out Item */}
                    <button
                      type="button"
                      onClick={handleSignOut}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        width: "100%",
                        padding: "8px 12px",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "#dc2626",
                        background: "none",
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        textAlign: "left"
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#fef2f2")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
                    >
                      <LogOut size={15} color="#dc2626" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Administrator Profile Modal */}
        {showProfileModal && (
          <div 
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(15, 23, 42, 0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
              padding: "16px"
            }}
            onClick={() => setShowProfileModal(false)}
          >
            <div 
              style={{
                background: "#ffffff",
                borderRadius: "12px",
                maxWidth: "480px",
                width: "100%",
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.15)",
                padding: "24px"
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div className="admin-avatar" style={{ width: "42px", height: "42px", fontSize: "16px" }}>{adminInitials}</div>
                  <div>
                    <h3 style={{ margin: "0 0 2px 0", fontSize: "16px", color: "#0f172a" }}>{adminFullName}</h3>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>ExamSecure {adminRoleDisplay} Account</span>
                  </div>
                </div>
                <button 
                  type="button" 
                  onClick={() => setShowProfileModal(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: "18px", padding: "4px" }}
                >
                  Γ£ò
                </button>
              </div>

              {/* Profile Details Grid */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12.5px" }}>
                  <User size={16} color="#017846" style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: "11px", color: "#64748b" }}>Full Name</div>
                    <strong style={{ color: "#0f172a" }}>{adminFullName}</strong>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12.5px" }}>
                  <Mail size={16} color="#017846" style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: "11px", color: "#64748b" }}>Email Address</div>
                    <strong style={{ color: "#0f172a", wordBreak: "break-all" }}>{adminEmail}</strong>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12.5px" }}>
                  <Briefcase size={16} color="#017846" style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: "11px", color: "#64748b" }}>Department & Role</div>
                    <strong style={{ color: "#0f172a" }}>Examination Controller ┬╖ Head Administrator</strong>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "12.5px" }}>
                  <Shield size={16} color="#16a34a" style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: "11px", color: "#64748b" }}>Access Permissions</div>
                    <span style={{ fontSize: "11.5px", color: "#166534", fontWeight: 600 }}>
                      ROLE_SUPER_ADMIN ┬╖ Safe Exam Browser Controller
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ background: "#f8fafc", borderRadius: "8px", padding: "10px 12px", marginBottom: "18px", fontSize: "11.5px", color: "#475569", border: "1px solid #e2e8f0" }}>
                <strong>Assigned Session:</strong> Campus Placement Assessment 2026 (800 Candidates ┬╖ 4 Question Sets AΓÇôD)
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                <button 
                  type="button" 
                  className="secondary" 
                  onClick={() => setShowProfileModal(false)}
                >
                  Close
                </button>
                <button 
                  type="button" 
                  className="primary" 
                  onClick={() => {
                    setShowProfileModal(false);
                    navigate("/admin/settings");
                  }}
                >
                  Go to Settings
                </button>
              </div>
            </div>
          </div>
        )}

        <main className="admin-content">
          {children}
        </main>
      </div>
    </div>
  );
}
