import { Clock, Calendar, CheckCircle2, Info } from "lucide-react";
import type { ExamTimingMode } from "../../types/adminExam";

interface ExamTimingModeSelectorProps {
  timingMode: ExamTimingMode;
  onChangeMode: (mode: ExamTimingMode) => void;
  examDate: string;
  onChangeDate: (date: string) => void;
  startTime: string;
  onChangeStartTime: (time: string) => void;
  durationMinutes: string;
  onChangeDuration: (duration: string) => void;
  errors?: Record<string, string>;
  submissionAttempted?: boolean;
}

export default function ExamTimingModeSelector({
  timingMode,
  onChangeMode,
  examDate,
  onChangeDate,
  startTime,
  onChangeStartTime,
  durationMinutes,
  onChangeDuration,
  errors = {},
  submissionAttempted = false
}: ExamTimingModeSelectorProps) {
  // Compute calculated end time preview for Scheduled mode
  const getCalculatedEndTime = () => {
    if (!startTime || !durationMinutes) return "—";
    try {
      const [hoursStr, minutesStr] = startTime.split(":");
      const hours = parseInt(hoursStr, 10);
      const minutes = parseInt(minutesStr, 10);
      const duration = parseInt(durationMinutes, 10);

      if (isNaN(hours) || isNaN(minutes) || isNaN(duration)) return "—";

      const startDate = new Date();
      startDate.setHours(hours, minutes, 0, 0);

      const endDate = new Date(startDate.getTime() + duration * 60 * 1000);
      return endDate.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });
    } catch {
      return "—";
    }
  };

  const formatStartTimePreview = () => {
    if (!startTime) return "—";
    try {
      const [h, m] = startTime.split(":");
      const d = new Date();
      d.setHours(parseInt(h, 10), parseInt(m, 10));
      return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    } catch {
      return startTime;
    }
  };

  return (
    <div className="timing-mode-section" style={{ marginBottom: "20px" }}>
      <label style={{ fontSize: "12px", fontWeight: 700, color: "#1e293b", display: "block", marginBottom: "8px" }}>
        Exam Timing Mode *
      </label>

      {/* Two mutually exclusive choices */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
        {/* Mode A: Scheduled Start */}
        <div 
          onClick={() => onChangeMode("SCHEDULED")}
          style={{
            border: `1.5px solid ${timingMode === "SCHEDULED" ? "#365fe5" : "#cbd5e1"}`,
            background: timingMode === "SCHEDULED" ? "#eff6ff" : "#ffffff",
            borderRadius: "10px",
            padding: "14px",
            cursor: "pointer",
            transition: "all 0.15s ease",
            position: "relative"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>
              <Calendar size={16} color="#365fe5" /> Mode A: Scheduled Start
            </span>
            <input 
              type="radio" 
              name="timingMode" 
              checked={timingMode === "SCHEDULED"} 
              onChange={() => onChangeMode("SCHEDULED")}
              style={{ cursor: "pointer" }}
            />
          </div>
          <p style={{ margin: 0, fontSize: "11px", color: "#64748b", lineHeight: 1.45 }}>
            Synchronized cohort start time. All candidates begin simultaneously at a fixed schedule with a shared deadline.
          </p>
        </div>

        {/* Mode B: Candidate Starts Anytime */}
        <div 
          onClick={() => onChangeMode("DURATION_FROM_START")}
          style={{
            border: `1.5px solid ${timingMode === "DURATION_FROM_START" ? "#365fe5" : "#cbd5e1"}`,
            background: timingMode === "DURATION_FROM_START" ? "#eff6ff" : "#ffffff",
            borderRadius: "10px",
            padding: "14px",
            cursor: "pointer",
            transition: "all 0.15s ease",
            position: "relative"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>
              <Clock size={16} color="#365fe5" /> Mode B: Candidate Starts Anytime
            </span>
            <input 
              type="radio" 
              name="timingMode" 
              checked={timingMode === "DURATION_FROM_START"} 
              onChange={() => onChangeMode("DURATION_FROM_START")}
              style={{ cursor: "pointer" }}
            />
          </div>
          <p style={{ margin: 0, fontSize: "11px", color: "#64748b", lineHeight: 1.45 }}>
            Flexible on-demand start. Each candidate receives their own individual countdown and personal deadline upon login.
          </p>
        </div>
      </div>

      {/* Mode-Specific Fields */}
      <div style={{ background: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
        <div className="form-grid" style={{ marginBottom: 0 }}>
          {/* Exam Date */}
          <div className="form-group">
            <label htmlFor="examDate">
              {timingMode === "SCHEDULED" ? "Examination Date *" : "Availability Window Date *"}
            </label>
            <input 
              id="examDate"
              type="date"
              value={examDate}
              onChange={e => onChangeDate(e.target.value)}
              style={{ borderColor: submissionAttempted && errors.examDate ? "#ef4444" : undefined }}
            />
            {submissionAttempted && errors.examDate && (
              <span className="form-error-msg">{errors.examDate}</span>
            )}
          </div>

          {/* Start Time: shown/enabled only in Scheduled mode */}
          {timingMode === "SCHEDULED" ? (
            <div className="form-group">
              <label htmlFor="startTime">Scheduled Start Time (IST) *</label>
              <input 
                id="startTime"
                type="time"
                value={startTime}
                onChange={e => onChangeStartTime(e.target.value)}
                style={{ borderColor: submissionAttempted && errors.startTime ? "#ef4444" : undefined }}
              />
              {submissionAttempted && errors.startTime && (
                <span className="form-error-msg">{errors.startTime}</span>
              )}
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="anytimeNotice" style={{ color: "#64748b" }}>Common Start Time</label>
              <div style={{ 
                height: "38px", 
                display: "flex", 
                alignItems: "center", 
                background: "#f1f5f9", 
                border: "1px dashed #cbd5e1", 
                borderRadius: "8px", 
                padding: "0 12px", 
                fontSize: "11px", 
                color: "#64748b" 
              }}>
                <Info size={14} style={{ marginRight: "6px", flexShrink: 0 }} /> Not required — starts on candidate entry
              </div>
            </div>
          )}

          {/* Duration in Minutes */}
          <div className="form-group">
            <label htmlFor="duration">Exam Duration (Minutes) *</label>
            <input 
              id="duration"
              type="number"
              min="5"
              max="360"
              value={durationMinutes}
              onChange={e => onChangeDuration(e.target.value)}
              style={{ borderColor: submissionAttempted && errors.durationMinutes ? "#ef4444" : undefined }}
            />
            {submissionAttempted && errors.durationMinutes && (
              <span className="form-error-msg">{errors.durationMinutes}</span>
            )}
          </div>
        </div>

        {/* Real-time Calculated Preview */}
        <div style={{ 
          marginTop: "12px", 
          padding: "10px 14px", 
          borderRadius: "8px", 
          background: "#ffffff", 
          border: "1px solid #cbd5e1",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "10px"
        }}>
          {timingMode === "SCHEDULED" ? (
            <>
              <div style={{ fontSize: "11px", color: "#334155" }}>
                <strong>Calculated Cohort Schedule:</strong> Start: <b>{formatStartTimePreview()}</b> · Duration: <b>{durationMinutes || 0} mins</b>
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#166534", background: "#dcfce7", padding: "3px 8px", borderRadius: "6px" }}>
                <CheckCircle2 size={13} /> Expected End Time: {getCalculatedEndTime()}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: "11px", color: "#334155" }}>
                <strong>Individual Candidate Window:</strong> Each candidate receives an independent countdown starting at their login.
              </div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", fontWeight: 700, color: "#1e40af", background: "#dbeafe", padding: "3px 8px", borderRadius: "6px" }}>
                <Clock size={13} /> Personal Duration: {durationMinutes || 60} Minutes
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
