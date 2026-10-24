import { useState, useEffect, useCallback } from "react";
import { RouterProvider, useRouter } from "./router";
import type { AdminDashboardResponse } from "./services/api";

import { getAdminDashboard, ApiError } from "./services/api";
import AdminLayout from "./components/admin/AdminLayout";
import AdminRouteGuard from "./components/admin/AdminRouteGuard";
import OverviewPage from "./pages/admin/OverviewPage";
import ExamsPage from "./pages/admin/ExamsPage";
import CreateExamPage from "./pages/admin/CreateExamPage";
import QuestionBankPage from "./pages/admin/QuestionBankPage";
import CandidatesPage from "./pages/admin/CandidatesPage";
import ResultsPage from "./pages/admin/ResultsPage";
import SettingsPage from "./pages/admin/SettingsPage";
import AdminLoginPage from "./pages/admin/AdminLoginPage";
import CandidatePortal from "./pages/candidate/CandidatePortal";
import ErrorBoundary from "./components/ErrorBoundary";

import "./styles.css";
import "./styles/admin.css";

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
    return <CandidatePortal />;
  }

  // Route 2: Admin Login Portal
  if (path === "/admin/login" || path.startsWith("/admin/login")) {
    return <AdminLoginPage />;
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
      return <CreateExamPage />;
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
          {renderAdminPage()}
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
