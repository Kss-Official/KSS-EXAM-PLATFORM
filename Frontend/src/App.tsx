import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { RouterProvider, useRouter } from "./router";
import type { AdminDashboardResponse } from "./services/api";

import { getAdminDashboard, ApiError } from "./services/api";
import AdminLayout from "./components/admin/AdminLayout";
import AdminRouteGuard from "./components/admin/AdminRouteGuard";
import ErrorBoundary from "./components/ErrorBoundary";

import "./styles.css";
import "./styles/admin.css";

// Route-level code-splitting for high-speed initial loads
const OverviewPage = lazy(() => import("./pages/admin/OverviewPage"));
const ExamsPage = lazy(() => import("./pages/admin/ExamsPage"));
const CreateExamPage = lazy(() => import("./pages/admin/CreateExamPage"));
const QuestionBankPage = lazy(() => import("./pages/admin/QuestionBankPage"));
const CandidatesPage = lazy(() => import("./pages/admin/CandidatesPage"));
const ResultsPage = lazy(() => import("./pages/admin/ResultsPage"));
const DepartmentsPage = lazy(() => import("./pages/admin/DepartmentsPage"));
const SettingsPage = lazy(() => import("./pages/admin/SettingsPage"));
const AdminLoginPage = lazy(() => import("./pages/admin/AdminLoginPage"));
const CandidatePortal = lazy(() => import("./pages/candidate/CandidatePortal"));

function PageLoading() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      flexDirection: 'column',
      gap: '14px',
      color: '#94a3b8'
    }}>
      <div style={{
        width: '32px',
        height: '32px',
        border: '3px solid rgba(59, 130, 246, 0.2)',
        borderTopColor: '#3b82f6',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite'
      }} />
      <span style={{ fontSize: '13px', fontWeight: 500, letterSpacing: '0.02em' }}>Loading...</span>
    </div>
  );
}

function AppContent() {
  const { path } = useRouter();

  // Admin Dashboard API state
  const [dashboardData, setDashboardData] = useState<AdminDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusCode, setStatusCode] = useState<number | undefined>(undefined);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    setStatusCode(undefined);
    try {
      const data = await getAdminDashboard();
      setDashboardData(data);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
        setStatusCode(err.statusCode);
      } else {
        const errorObj = err as Error;
        setError(errorObj.message || "Failed to connect to backend");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only fetch dashboard if on an admin route other than login
    if (path.startsWith("/admin") && !path.startsWith("/admin/login")) {
      fetchDashboard();
    }
  }, [fetchDashboard, path]);

  // Route 1: Candidate Examination Portal & Root Landing
  if (path.startsWith("/candidate") || path === "/" || path === "") {
    return (
      <Suspense fallback={<PageLoading />}>
        <CandidatePortal />
      </Suspense>
    );
  }

  // Route 2: Admin Login Portal
  if (path === "/admin/login" || path.startsWith("/admin/login")) {
    return (
      <Suspense fallback={<PageLoading />}>
        <AdminLoginPage />
      </Suspense>
    );
  }

  // Route 3: Admin Dashboard Console & Sub-pages (Protected by RBAC Route Guard)
  const renderAdminPage = () => {
    if (path.startsWith("/admin/exams/new")) {
      return <CreateExamPage />;
    }
    if (path.startsWith("/admin/exams")) {
      return <ExamsPage />;
    }
    if (path.startsWith("/admin/departments")) {
      return <DepartmentsPage />;
    }
    if (path.startsWith("/admin/questions")) {
      return <QuestionBankPage />;
    }
    if (path.startsWith("/admin/candidates")) {
      return <CandidatesPage />;
    }
    if (path.startsWith("/admin/results")) {
      return <ResultsPage />;
    }
    if (path.startsWith("/admin/settings")) {
      return <SettingsPage />;
    }
    // Default Overview
    return (
      <OverviewPage 
        data={dashboardData}
        loading={loading}
        error={error}
        statusCode={statusCode}
        onRetry={fetchDashboard}
      />
    );
  };

  return (
    <AdminRouteGuard>
      {(authUser) => (
        <AdminLayout
          dashboardData={dashboardData}
          loading={loading}
          error={error}
          statusCode={statusCode}
          currentUser={authUser}
        >
          <Suspense fallback={<PageLoading />}>
            {renderAdminPage()}
          </Suspense>
        </AdminLayout>
      )}
    </AdminRouteGuard>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <RouterProvider>
        <AppContent />
      </RouterProvider>
    </ErrorBoundary>
  );
}
