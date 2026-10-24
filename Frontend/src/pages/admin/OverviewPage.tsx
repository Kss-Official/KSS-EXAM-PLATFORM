import { useState, useEffect } from "react";
import { 
  FileText, 
  Users, 
  CheckCircle2, 
  PlusCircle, 
  Calendar,
  Layers
} from "lucide-react";
import { getAllExams, type ExamDto, type AdminDashboardResponse } from "../../services/api";
import { useRouter } from "../../router";
import BackendStatusBanner from "../../components/admin/BackendStatusBanner";

interface OverviewPageProps {
  data: AdminDashboardResponse | null;
  loading: boolean;
  error: string | null;
  statusCode?: number;
  onRetry: () => void;
}

export default function OverviewPage({
  data,
  loading,
  error,
  statusCode,
  onRetry
}: OverviewPageProps) {
  const { navigate } = useRouter();
  const [exams, setExams] = useState<ExamDto[]>([]);
  const [loadingExams, setLoadingExams] = useState(true);

  useEffect(() => {
    let isCancelled = false;
    const fetchRecentExams = async () => {
      try {
        const list = await getAllExams();
        if (!isCancelled) {
          setExams(list);
        }
      } catch (e) {
        console.warn("Could not load exams list:", e);
      } finally {
        if (!isCancelled) setLoadingExams(false);
      }
    };
    fetchRecentExams();
    return () => { isCancelled = true; };
  }, []);

  const totalExams = data?.totalExams ?? (loading ? "..." : 0);
  const totalCandidates = data?.totalCandidates ?? (loading ? "..." : 0);
  const activeExams = data?.activeExams ?? (loading ? "..." : 0);
  const totalDepartments = data?.totalDepartments ?? (loading ? "..." : 0);
  const submittedAttempts = data?.submittedAttempts ?? (loading ? "..." : 0);
  const qualifiedCandidates = data?.qualifiedCandidates ?? (loading ? "..." : 0);

  return (
    <div className="dashboard-grid">
      {/* FastAPI Backend Status Banner */}
      <BackendStatusBanner 
        data={data as any}
        loading={loading}
        error={error}
        statusCode={statusCode}
        onRetry={onRetry}
      />

      {/* Summary Stat Cards */}
      <div className="stat-cards-row">
        <div className="stat-card">
          <div className="stat-card-info">
            <small>Total Examinations</small>
            <div className="stat-card-value">{totalExams}</div>
            <span className="stat-card-sub">
              {activeExams} published & live
            </span>
          </div>
          <div className="stat-card-icon blue">
            <FileText size={22} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-info">
            <small>Registered Candidates</small>
            <div className="stat-card-value">{totalCandidates}</div>
            <span className="stat-card-sub">
              Database roster
            </span>
          </div>
          <div className="stat-card-icon green">
            <Users size={22} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-info">
            <small>Active Departments</small>
            <div className="stat-card-value">{totalDepartments}</div>
            <span className="stat-card-sub">
              Academic units configured
            </span>
          </div>
          <div className="stat-card-icon purple">
            <Layers size={22} />
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-info">
            <small>Exam Submissions</small>
            <div className="stat-card-value">{submittedAttempts}</div>
            <span className="stat-card-sub">
              {qualifiedCandidates} qualified candidates
            </span>
          </div>
          <div className="stat-card-icon orange">
            <CheckCircle2 size={22} />
          </div>
        </div>
      </div>

      {/* Main Dashboard Two-Column Section */}
      <div className="dashboard-content-grid">
        {/* Left Column: Real Database Examinations */}
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <div>
              <h3>Configured Examinations</h3>
              <p>Real examinations retrieved from PostgreSQL</p>
            </div>
            <button 
              type="button" 
              className="primary"
              onClick={() => navigate("/admin/exams/new")}
              style={{ fontSize: "12px", padding: "6px 12px" }}
            >
              <PlusCircle size={14} /> Create Exam
            </button>
          </div>

          <div className="schedule-list">
            {loadingExams ? (
              <div style={{ padding: "20px", textAlign: "center", color: "#64748b" }}>Loading examinations...</div>
            ) : exams.length === 0 ? (
              <div style={{ padding: "30px", textAlign: "center", color: "#64748b" }}>
                <FileText size={32} color="#cbd5e1" style={{ margin: "0 auto 8px" }} />
                <p style={{ margin: 0, fontWeight: 600 }}>No examinations created yet</p>
                <small>Click "Create Exam" to set up your first examination with 4 sets (A, B, C, D).</small>
              </div>
            ) : (
              exams.map((exam) => (
                <div key={exam.id} className="schedule-item">
                  <div className="schedule-date-badge">
                    <span className="month">{exam.durationMinutes}m</span>
                    <span className="day">{exam.totalQuestions}Q</span>
                  </div>
                  <div className="schedule-details">
                    <h4>{exam.title}</h4>
                    <div className="schedule-meta">
                      <span><Calendar size={13} /> {exam.timingMode}</span>
                      <span>•</span>
                      <span>Total Marks: {exam.totalMarks}</span>
                      <span>•</span>
                      <span className={`status-pill ${exam.status.toLowerCase()}`}>{exam.status}</span>
                    </div>
                  </div>
                  <button 
                    type="button"
                    className="secondary"
                    onClick={() => navigate("/admin/exams")}
                    style={{ fontSize: "11px", padding: "4px 10px" }}
                  >
                    Manage
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Platform Status & Quick Actions */}
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <div>
              <h3>Administrative Controls</h3>
              <p>Platform management modules</p>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "16px 0" }}>
            <div 
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}
            >
              <div>
                <strong style={{ fontSize: "13px", color: "#0f172a" }}>Create Exam & Upload Questions</strong>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#64748b" }}>Choose academic departments and upload examination question sets directly.</p>
              </div>
              <button 
                type="button" 
                className="primary"
                onClick={() => navigate("/admin/exams/new")}
                style={{ fontSize: "12px" }}
              >
                + New Exam
              </button>
            </div>

            <div 
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}
            >
              <div>
                <strong style={{ fontSize: "13px", color: "#0f172a" }}>Question Bank (4 Sets A-D)</strong>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#64748b" }}>Manage independent question collections and upload answer keys.</p>
              </div>
              <button 
                type="button" 
                className="secondary"
                onClick={() => navigate("/admin/questions")}
                style={{ fontSize: "12px" }}
              >
                Question Bank
              </button>
            </div>

            <div 
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}
            >
              <div>
                <strong style={{ fontSize: "13px", color: "#0f172a" }}>Candidate Roster & CSV Batch</strong>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#64748b" }}>Upload candidate lists and assign exams, slots, and sets.</p>
              </div>
              <button 
                type="button" 
                className="secondary"
                onClick={() => navigate("/admin/candidates")}
                style={{ fontSize: "12px" }}
              >
                Candidates
              </button>
            </div>

            <div 
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}
            >
              <div>
                <strong style={{ fontSize: "13px", color: "#0f172a" }}>Results & Qualification Review</strong>
                <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#64748b" }}>Review auto-scored attempts and control score publication.</p>
              </div>
              <button 
                type="button" 
                className="secondary"
                onClick={() => navigate("/admin/results")}
                style={{ fontSize: "12px" }}
              >
                Results
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
