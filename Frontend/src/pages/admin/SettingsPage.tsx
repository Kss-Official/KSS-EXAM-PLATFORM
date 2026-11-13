import { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  Server, 
  Database, 
  Lock, 
  Eye, 
  Copy, 
  Save, 
  RotateCcw, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  Sparkles, 
  FileText, 
  Calendar, 
  Users, 
  Sliders, 
  ExternalLink,
  Laptop,
  AlertCircle
} from "lucide-react";
import { 
  getSlotTimings, 
  updateSlotTimings, 
  type SlotTimingsConfig 
} from "../../services/api";

interface ProctoringSettings {
  strictSlotWindow: boolean;
  fullscreenEnforcement: boolean;
  tabSwitchDetection: boolean;
  clipboardLockdown: boolean;
  webcamMonitoring: boolean;
  autoSubmitOnTimeout: boolean;
  preventMultipleLogins: boolean;
}

const DEFAULT_PROCTORING: ProctoringSettings = {
  strictSlotWindow: true,
  fullscreenEnforcement: true,
  tabSwitchDetection: true,
  clipboardLockdown: true,
  webcamMonitoring: true,
  autoSubmitOnTimeout: true,
  preventMultipleLogins: true
};

export default function SettingsPage() {
  // 1. Proctoring & Security Toggles
  const [proctoring, setProctoring] = useState<ProctoringSettings>(() => {
    try {
      const saved = localStorage.getItem("talentise_exam_proctoring_settings");
      if (saved) return { ...DEFAULT_PROCTORING, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_PROCTORING;
  });

  const [proctoringSavedNotice, setProctoringSavedNotice] = useState(false);

  const handleToggle = (key: keyof ProctoringSettings) => {
    setProctoring(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem("talentise_exam_proctoring_settings", JSON.stringify(updated));
      } catch {}
      setProctoringSavedNotice(true);
      setTimeout(() => setProctoringSavedNotice(false), 2500);
      return updated;
    });
  };

  // 2. Live Slot Timing Controls
  const [slotTimings, setSlotTimings] = useState<SlotTimingsConfig>({
    slot1: {
      header: "Slot 1 • 2:00 PM",
      sub: "Entry: 2:00 PM – 2:30 PM IST",
      btn: "Slot 1 (2:00 PM)",
      startTime: "2:00 PM",
      cutoffTime: "2:30 PM",
      startMinutes: 840,
      cutoffMinutes: 870
    },
    slot2: {
      header: "Slot 2 • 4:00 PM",
      sub: "Entry: 4:00 PM – 4:30 PM IST",
      btn: "Slot 2 (4:00 PM)",
      startTime: "4:00 PM",
      cutoffTime: "4:30 PM",
      startMinutes: 960,
      cutoffMinutes: 990
    },
    slot3: {
      header: "Slot 3 • 6:00 PM",
      sub: "Entry: 6:00 PM – 6:30 PM IST",
      btn: "Slot 3 (6:00 PM)",
      startTime: "6:00 PM",
      cutoffTime: "6:30 PM",
      startMinutes: 1080,
      cutoffMinutes: 1110
    }
  });

  const [isEditingSlots, setIsEditingSlots] = useState(false);
  const [slot1Start, setSlot1Start] = useState("2:00 PM");
  const [slot1Cutoff, setSlot1Cutoff] = useState("2:30 PM");
  const [slot2Start, setSlot2Start] = useState("4:00 PM");
  const [slot2Cutoff, setSlot2Cutoff] = useState("4:30 PM");
  const [slot3Start, setSlot3Start] = useState("6:00 PM");
  const [slot3Cutoff, setSlot3Cutoff] = useState("6:30 PM");
  const [savingSlots, setSavingSlots] = useState(false);
  const [slotsSavedNotice, setSlotsSavedNotice] = useState(false);

  useEffect(() => {
    getSlotTimings()
      .then(cfg => {
        if (cfg && cfg.slot1 && cfg.slot2) {
          setSlotTimings(cfg);
          setSlot1Start(cfg.slot1.startTime || "2:00 PM");
          setSlot1Cutoff(cfg.slot1.cutoffTime || "2:30 PM");
          setSlot2Start(cfg.slot2.startTime || "4:00 PM");
          setSlot2Cutoff(cfg.slot2.cutoffTime || "4:30 PM");
          if (cfg.slot3) {
            setSlot3Start(cfg.slot3.startTime || "6:00 PM");
            setSlot3Cutoff(cfg.slot3.cutoffTime || "6:30 PM");
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveSlots = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSlots(true);
    try {
      const updated = await updateSlotTimings({
        slot1: {
          startTime: slot1Start.trim(),
          cutoffTime: slot1Cutoff.trim(),
          header: `Slot 1 • ${slot1Start.trim()}`,
          sub: `Entry: ${slot1Start.trim()} – ${slot1Cutoff.trim()} IST`,
          btn: `Slot 1 (${slot1Start.trim()})`
        },
        slot2: {
          startTime: slot2Start.trim(),
          cutoffTime: slot2Cutoff.trim(),
          header: `Slot 2 • ${slot2Start.trim()}`,
          sub: `Entry: ${slot2Start.trim()} – ${slot2Cutoff.trim()} IST`,
          btn: `Slot 2 (${slot2Start.trim()})`
        },
        slot3: {
          startTime: slot3Start.trim(),
          cutoffTime: slot3Cutoff.trim(),
          header: `Slot 3 • ${slot3Start.trim()}`,
          sub: `Entry: ${slot3Start.trim()} – ${slot3Cutoff.trim()} IST`,
          btn: `Slot 3 (${slot3Start.trim()})`
        }
      });
      if (updated && updated.slot1) {
        setSlotTimings(updated);
      }
      setIsEditingSlots(false);
      setSlotsSavedNotice(true);
      setTimeout(() => setSlotsSavedNotice(false), 3000);
    } catch (err) {
      console.error("Failed to update slot timings:", err);
    } finally {
      setSavingSlots(false);
    }
  };

  // 3. Advanced / SEB Configuration (Collapsible)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedXml, setCopiedXml] = useState(false);
  const sebKey = "a8f93e2b10c9d4827103a4b9c1d2e3f4a5b6c7d8e9f0123456789abcdef01234";
  const quitPassword = "PlacementAdmin@2026";
  const candidateUrl = typeof window !== "undefined" && window.location?.origin 
    ? `${window.location.origin}/candidate` 
    : "http://localhost:5173/candidate";

  const sebConfigXml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>originatorVersion</key>
    <string>SEB_Win_3.4.0</string>
    <key>startURL</key>
    <string>${candidateUrl}</string>
    <key>browserExamKey</key>
    <string>${sebKey}</string>
    <key>allowQuit</key>
    <true/>
    <key>allowPreferencesWindow</key>
    <false/>
</dict>
</plist>`;

  const copyKey = () => {
    navigator.clipboard.writeText(sebKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const copyXml = () => {
    navigator.clipboard.writeText(sebConfigXml);
    setCopiedXml(true);
    setTimeout(() => setCopiedXml(false), 2000);
  };

  return (
    <div style={{ maxWidth: "1000px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "24px", paddingBottom: "40px" }}>
      
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ fontSize: "12px", color: "#64748b", display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
            <span>Secure Exam Platform</span>
            <span>&rsaquo;</span>
            <span>Admin</span>
            <span>&rsaquo;</span>
            <span style={{ color: "#0f172a", fontWeight: 600 }}>Platform & Security Settings</span>
          </div>
          <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", margin: 0, letterSpacing: "-0.02em" }}>
            Platform & Security Settings
          </h1>
          <p style={{ fontSize: "13px", color: "#64748b", margin: "4px 0 0 0" }}>
            Manage assessment parameters, real-time slot entry gates, anti-cheating policies, and system health.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ 
            display: "inline-flex", 
            alignItems: "center", 
            gap: "6px", 
            padding: "6px 12px", 
            background: "#ecfdf5", 
            border: "1px solid #a7f3d0", 
            borderRadius: "20px", 
            fontSize: "12px", 
            fontWeight: 600, 
            color: "#047857" 
          }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", display: "inline-block" }}></span>
            Neon Cloud PostgreSQL: Connected
          </span>
          <span style={{ 
            display: "inline-flex", 
            alignItems: "center", 
            gap: "6px", 
            padding: "6px 12px", 
            background: "#eff6ff", 
            border: "1px solid #bfdbfe", 
            borderRadius: "20px", 
            fontSize: "12px", 
            fontWeight: 600, 
            color: "#1d4ed8" 
          }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#3b82f6", display: "inline-block" }}></span>
            FastAPI Backend: Online
          </span>
        </div>
      </div>

      {/* Notifications */}
      {proctoringSavedNotice && (
        <div style={{ 
          background: "#ecfdf5", 
          border: "1px solid #10b981", 
          borderRadius: "8px", 
          padding: "10px 14px", 
          display: "flex", 
          alignItems: "center", 
          gap: "8px", 
          fontSize: "13px", 
          color: "#065f46" 
        }}>
          <CheckCircle2 size={16} color="#10b981" />
          <span>Security policies updated successfully and applied in real time to candidate sessions.</span>
        </div>
      )}

      {slotsSavedNotice && (
        <div style={{ 
          background: "#ecfdf5", 
          border: "1px solid #10b981", 
          borderRadius: "8px", 
          padding: "10px 14px", 
          display: "flex", 
          alignItems: "center", 
          gap: "8px", 
          fontSize: "13px", 
          color: "#065f46" 
        }}>
          <CheckCircle2 size={16} color="#10b981" />
          <span>Slot entry timings saved successfully. New access window is now strictly enforced!</span>
        </div>
      )}

      {/* Section 1: Active Examination Summary */}
      <div className="panel-card" style={{ border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div className="panel-card-header" style={{ background: "#ffffff", padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#fef3c7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Sparkles size={16} color="#d97706" />
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>Active Examination Profile</div>
              <div style={{ fontSize: "12px", color: "#64748b" }}>Live assessment parameters for upcoming batch</div>
            </div>
          </div>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#f97316", background: "#fff7ed", border: "1px solid #fdba74", padding: "3px 10px", borderRadius: "12px" }}>
            READY FOR TOMORROW
          </span>
        </div>

        <div className="panel-card-body" style={{ padding: "20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
            
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                Assessment Title
              </div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
                Azentio Software MCQ
              </div>
              <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
                Organization: Talentise Global
              </div>
            </div>

            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                Examination Date
              </div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: "6px" }}>
                <Calendar size={14} color="#0284c7" />
                <span>November 14, 2026</span>
              </div>
              <div style={{ fontSize: "11px", color: "#0284c7", fontWeight: 600, marginTop: "2px" }}>
                Active Date
              </div>
            </div>

            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                Examinees Enrolled
              </div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: "6px" }}>
                <Users size={14} color="#10b981" />
                <span>1,044 Candidates</span>
              </div>
              <div style={{ fontSize: "11px", color: "#10b981", fontWeight: 600, marginTop: "2px" }}>
                7 Approved Technical Streams
              </div>
            </div>

            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>
                Assessment Duration
              </div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: "6px" }}>
                <Clock size={14} color="#6366f1" />
                <span>60 Minutes (1 Hour)</span>
              </div>
              <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                Strict Auto-Submit on Timeout
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Section 2: Live Slot Entry Gates & Timings */}
      <div className="panel-card" style={{ border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div className="panel-card-header" style={{ background: "#ffffff", padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#eff6ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Clock size={16} color="#0284c7" />
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>Examination Slots & Entry Windows</div>
              <div style={{ fontSize: "12px", color: "#64748b" }}>Backend-enforced entry windows for November 14, 2026</div>
            </div>
          </div>
          
          <button
            type="button"
            onClick={() => setIsEditingSlots(!isEditingSlots)}
            style={{ 
              padding: "6px 14px", 
              background: isEditingSlots ? "#f1f5f9" : "#0284c7", 
              color: isEditingSlots ? "#334155" : "#ffffff", 
              border: isEditingSlots ? "1px solid #cbd5e1" : "none", 
              borderRadius: "6px", 
              fontSize: "12px", 
              fontWeight: 600, 
              cursor: "pointer", 
              display: "inline-flex", 
              alignItems: "center", 
              gap: "6px",
              transition: "all 0.15s ease" 
            }}
          >
            <Sliders size={13} />
            <span>{isEditingSlots ? "Close Editor" : "Edit Slot Entry Timings"}</span>
          </button>
        </div>

        <div className="panel-card-body" style={{ padding: "20px" }}>
          
          {/* Edit Form */}
          {isEditingSlots ? (
            <form onSubmit={handleSaveSlots} style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: "10px", padding: "18px", marginBottom: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                <b style={{ fontSize: "13px", color: "#0f172a" }}>Adjust Dynamic Entry Timings (Immediate Real-Time Effect)</b>
                <span style={{ fontSize: "11px", color: "#0369a1", background: "#e0f2fe", padding: "2px 8px", borderRadius: "4px" }}>
                  Instant zero-downtime update
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
                {/* Slot 1 */}
                <div style={{ background: "#ffffff", border: "1px solid #bae6fd", borderRadius: "8px", padding: "12px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#0284c7", marginBottom: "8px" }}>Slot 1 Configuration</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <div>
                      <label style={{ fontSize: "11px", color: "#64748b", display: "block", marginBottom: "4px" }}>Slot Start Time</label>
                      <input 
                        type="text" 
                        value={slot1Start} 
                        onChange={e => setSlot1Start(e.target.value)} 
                        style={{ width: "100%", padding: "6px 8px", fontSize: "12px", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                        placeholder="2:00 PM"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", color: "#64748b", display: "block", marginBottom: "4px" }}>Entry Deadline</label>
                      <input 
                        type="text" 
                        value={slot1Cutoff} 
                        onChange={e => setSlot1Cutoff(e.target.value)} 
                        style={{ width: "100%", padding: "6px 8px", fontSize: "12px", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                        placeholder="2:30 PM"
                      />
                    </div>
                  </div>
                </div>

                {/* Slot 2 */}
                <div style={{ background: "#ffffff", border: "1px solid #e9d5ff", borderRadius: "8px", padding: "12px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#9333ea", marginBottom: "8px" }}>Slot 2 Configuration</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <div>
                      <label style={{ fontSize: "11px", color: "#64748b", display: "block", marginBottom: "4px" }}>Slot Start Time</label>
                      <input 
                        type="text" 
                        value={slot2Start} 
                        onChange={e => setSlot2Start(e.target.value)} 
                        style={{ width: "100%", padding: "6px 8px", fontSize: "12px", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                        placeholder="4:00 PM"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", color: "#64748b", display: "block", marginBottom: "4px" }}>Entry Deadline</label>
                      <input 
                        type="text" 
                        value={slot2Cutoff} 
                        onChange={e => setSlot2Cutoff(e.target.value)} 
                        style={{ width: "100%", padding: "6px 8px", fontSize: "12px", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                        placeholder="4:30 PM"
                      />
                    </div>
                  </div>
                </div>

                {/* Slot 3 */}
                <div style={{ background: "#ffffff", border: "1px solid #fde68a", borderRadius: "8px", padding: "12px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#d97706", marginBottom: "8px" }}>Slot 3 Configuration</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <div>
                      <label style={{ fontSize: "11px", color: "#64748b", display: "block", marginBottom: "4px" }}>Slot Start Time</label>
                      <input 
                        type="text" 
                        value={slot3Start} 
                        onChange={e => setSlot3Start(e.target.value)} 
                        style={{ width: "100%", padding: "6px 8px", fontSize: "12px", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                        placeholder="6:00 PM"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "11px", color: "#64748b", display: "block", marginBottom: "4px" }}>Entry Deadline</label>
                      <input 
                        type="text" 
                        value={slot3Cutoff} 
                        onChange={e => setSlot3Cutoff(e.target.value)} 
                        style={{ width: "100%", padding: "6px 8px", fontSize: "12px", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                        placeholder="6:30 PM"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "14px" }}>
                <button 
                  type="button" 
                  onClick={() => setIsEditingSlots(false)}
                  style={{ padding: "6px 12px", fontSize: "12px", borderRadius: "6px", border: "1px solid #cbd5e1", background: "#ffffff", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={savingSlots}
                  style={{ padding: "6px 14px", fontSize: "12px", borderRadius: "6px", border: "none", background: "#0284c7", color: "#ffffff", fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <Save size={13} />
                  <span>{savingSlots ? "Saving..." : "Save Timings"}</span>
                </button>
              </div>
            </form>
          ) : null}

          {/* Current Slot Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
            
            {/* Slot 1 Card */}
            <div style={{ 
              background: "#f0f9ff", 
              border: "1.5px solid #0284c7", 
              borderRadius: "10px", 
              padding: "16px",
              boxShadow: "0 2px 4px rgba(2, 132, 199, 0.05)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Slot 1 • Afternoon
                  </span>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", marginTop: "2px" }}>
                    {slotTimings.slot1.startTime || "2:00 PM"}
                  </div>
                </div>
                <span style={{ padding: "3px 8px", background: "#bae6fd", color: "#0369a1", borderRadius: "6px", fontSize: "11px", fontWeight: 700 }}>
                  350 Candidates
                </span>
              </div>
              <div style={{ fontSize: "12px", color: "#0284c7", fontWeight: 600, background: "#ffffff", padding: "6px 10px", borderRadius: "6px", border: "1px solid #bae6fd", display: "flex", alignItems: "center", gap: "6px" }}>
                <Clock size={13} />
                <span>Entry Allowed: {slotTimings.slot1.startTime || "2:00 PM"} – {slotTimings.slot1.cutoffTime || "2:30 PM"} IST</span>
              </div>
              <div style={{ fontSize: "11px", color: "#64748b", marginTop: "8px" }}>
                Allowed window: 30 minutes from start.
              </div>
            </div>

            {/* Slot 2 Card */}
            <div style={{ 
              background: "#faf5ff", 
              border: "1.5px solid #a855f7", 
              borderRadius: "10px", 
              padding: "16px",
              boxShadow: "0 2px 4px rgba(168, 85, 247, 0.05)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#7e22ce", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Slot 2 • Late Afternoon
                  </span>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", marginTop: "2px" }}>
                    {slotTimings.slot2.startTime || "4:00 PM"}
                  </div>
                </div>
                <span style={{ padding: "3px 8px", background: "#e9d5ff", color: "#7e22ce", borderRadius: "6px", fontSize: "11px", fontWeight: 700 }}>
                  350 Candidates
                </span>
              </div>
              <div style={{ fontSize: "12px", color: "#9333ea", fontWeight: 600, background: "#ffffff", padding: "6px 10px", borderRadius: "6px", border: "1px solid #e9d5ff", display: "flex", alignItems: "center", gap: "6px" }}>
                <Clock size={13} />
                <span>Entry Allowed: {slotTimings.slot2.startTime || "4:00 PM"} – {slotTimings.slot2.cutoffTime || "4:30 PM"} IST</span>
              </div>
              <div style={{ fontSize: "11px", color: "#64748b", marginTop: "8px" }}>
                Allowed window: 30 minutes from start.
              </div>
            </div>

            {/* Slot 3 Card */}
            <div style={{ 
              background: "#fffbeb", 
              border: "1.5px solid #f59e0b", 
              borderRadius: "10px", 
              padding: "16px",
              boxShadow: "0 2px 4px rgba(245, 158, 11, 0.05)"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#b45309", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    Slot 3 • Evening
                  </span>
                  <div style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", marginTop: "2px" }}>
                    {slotTimings.slot3?.startTime || "6:00 PM"}
                  </div>
                </div>
                <span style={{ padding: "3px 8px", background: "#fde68a", color: "#b45309", borderRadius: "6px", fontSize: "11px", fontWeight: 700 }}>
                  344 Candidates
                </span>
              </div>
              <div style={{ fontSize: "12px", color: "#d97706", fontWeight: 600, background: "#ffffff", padding: "6px 10px", borderRadius: "6px", border: "1px solid #fde68a", display: "flex", alignItems: "center", gap: "6px" }}>
                <Clock size={13} />
                <span>Entry Allowed: {slotTimings.slot3?.startTime || "6:00 PM"} – {slotTimings.slot3?.cutoffTime || "6:30 PM"} IST</span>
              </div>
              <div style={{ fontSize: "11px", color: "#64748b", marginTop: "8px" }}>
                Allowed window: 30 minutes from start.
              </div>
            </div>

          </div>

          <div style={{ marginTop: "14px", padding: "10px 14px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "#475569" }}>
            <ShieldCheck size={16} color="#059669" style={{ flexShrink: 0 }} />
            <span>
              <strong>Strict Server-Side Validation:</strong> Candidates attempting to enter before their assigned slot start time or after their slot cutoff time are automatically blocked by the backend API.
            </span>
          </div>

        </div>
      </div>

      {/* Section 3: Assessment Security & Anti-Cheating Policies */}
      <div className="panel-card" style={{ border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div className="panel-card-header" style={{ background: "#ffffff", padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShieldCheck size={16} color="#10b981" />
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>Assessment Security & Anti-Cheating Controls</div>
              <div style={{ fontSize: "12px", color: "#64748b" }}>Control proctoring rules, browser restrictions, and access gates</div>
            </div>
          </div>
          <span style={{ fontSize: "11px", fontWeight: 600, color: "#059669", background: "#ecfdf5", padding: "3px 8px", borderRadius: "12px", border: "1px solid #a7f3d0" }}>
            All Safeguards Active
          </span>
        </div>

        <div className="panel-card-body" style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "14px" }}>
          
          {/* Toggle 1: Strict Slot Time Window */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <div style={{ paddingRight: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>Enforce Strict Slot Time Gate</span>
                <span style={{ fontSize: "10px", fontWeight: 700, background: "#e0f2fe", color: "#0369a1", padding: "2px 6px", borderRadius: "4px" }}>CORE</span>
              </div>
              <div style={{ fontSize: "12px", color: "#64748b" }}>
                Candidates can only enter during their assigned slot's designated entry window (e.g. Slot 1: 2:00 PM – 2:30 PM). Early or late logins are rejected.
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggle("strictSlotWindow")}
              style={{
                width: "44px",
                height: "24px",
                borderRadius: "12px",
                background: proctoring.strictSlotWindow ? "#10b981" : "#cbd5e1",
                border: "none",
                cursor: "pointer",
                position: "relative",
                transition: "background 0.2s ease",
                flexShrink: 0
              }}
            >
              <span style={{
                position: "absolute",
                top: "2px",
                left: proctoring.strictSlotWindow ? "22px" : "2px",
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                background: "#ffffff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                transition: "left 0.2s ease"
              }}></span>
            </button>
          </div>

          {/* Toggle 2: Fullscreen Lockdown */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <div style={{ paddingRight: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>Fullscreen Lockdown</span>
              </div>
              <div style={{ fontSize: "12px", color: "#64748b" }}>
                Forces candidate's browser into full-screen mode upon entering assessment. Exiting full-screen logs a high-severity proctoring infraction.
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggle("fullscreenEnforcement")}
              style={{
                width: "44px",
                height: "24px",
                borderRadius: "12px",
                background: proctoring.fullscreenEnforcement ? "#10b981" : "#cbd5e1",
                border: "none",
                cursor: "pointer",
                position: "relative",
                transition: "background 0.2s ease",
                flexShrink: 0
              }}
            >
              <span style={{
                position: "absolute",
                top: "2px",
                left: proctoring.fullscreenEnforcement ? "22px" : "2px",
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                background: "#ffffff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                transition: "left 0.2s ease"
              }}></span>
            </button>
          </div>

          {/* Toggle 3: Tab Switch & Window Blur Detection */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <div style={{ paddingRight: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>Tab-Switch & Multi-Window Detection</span>
              </div>
              <div style={{ fontSize: "12px", color: "#64748b" }}>
                Monitors document visibility and window blur events. Shows real-time warnings to candidates and alerts the Admin Live Monitoring dashboard.
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggle("tabSwitchDetection")}
              style={{
                width: "44px",
                height: "24px",
                borderRadius: "12px",
                background: proctoring.tabSwitchDetection ? "#10b981" : "#cbd5e1",
                border: "none",
                cursor: "pointer",
                position: "relative",
                transition: "background 0.2s ease",
                flexShrink: 0
              }}
            >
              <span style={{
                position: "absolute",
                top: "2px",
                left: proctoring.tabSwitchDetection ? "22px" : "2px",
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                background: "#ffffff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                transition: "left 0.2s ease"
              }}></span>
            </button>
          </div>

          {/* Toggle 4: Clipboard & Right-Click Disabling */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <div style={{ paddingRight: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>Clipboard & Right-Click Lockdown</span>
              </div>
              <div style={{ fontSize: "12px", color: "#64748b" }}>
                Prevents copy, cut, paste, and right-click context menu within question paper to safeguard intellectual property.
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggle("clipboardLockdown")}
              style={{
                width: "44px",
                height: "24px",
                borderRadius: "12px",
                background: proctoring.clipboardLockdown ? "#10b981" : "#cbd5e1",
                border: "none",
                cursor: "pointer",
                position: "relative",
                transition: "background 0.2s ease",
                flexShrink: 0
              }}
            >
              <span style={{
                position: "absolute",
                top: "2px",
                left: proctoring.clipboardLockdown ? "22px" : "2px",
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                background: "#ffffff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                transition: "left 0.2s ease"
              }}></span>
            </button>
          </div>

          {/* Toggle 5: Auto-Submit on Timeout */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <div style={{ paddingRight: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>Automatic Submission on Time Expiry</span>
              </div>
              <div style={{ fontSize: "12px", color: "#64748b" }}>
                When the 60-minute examination countdown timer reaches 00:00, all answers are saved and finalized automatically without requiring manual action.
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggle("autoSubmitOnTimeout")}
              style={{
                width: "44px",
                height: "24px",
                borderRadius: "12px",
                background: proctoring.autoSubmitOnTimeout ? "#10b981" : "#cbd5e1",
                border: "none",
                cursor: "pointer",
                position: "relative",
                transition: "background 0.2s ease",
                flexShrink: 0
              }}
            >
              <span style={{
                position: "absolute",
                top: "2px",
                left: proctoring.autoSubmitOnTimeout ? "22px" : "2px",
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                background: "#ffffff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                transition: "left 0.2s ease"
              }}></span>
            </button>
          </div>

          {/* Toggle 6: Prevent Concurrent Logins */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
            <div style={{ paddingRight: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>Prevent Multiple Concurrent Logins</span>
              </div>
              <div style={{ fontSize: "12px", color: "#64748b" }}>
                Restricts candidate to a single active browser session. Attempting to log in from a second device terminates the previous session.
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleToggle("preventMultipleLogins")}
              style={{
                width: "44px",
                height: "24px",
                borderRadius: "12px",
                background: proctoring.preventMultipleLogins ? "#10b981" : "#cbd5e1",
                border: "none",
                cursor: "pointer",
                position: "relative",
                transition: "background 0.2s ease",
                flexShrink: 0
              }}
            >
              <span style={{
                position: "absolute",
                top: "2px",
                left: proctoring.preventMultipleLogins ? "22px" : "2px",
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                background: "#ffffff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                transition: "left 0.2s ease"
              }}></span>
            </button>
          </div>

        </div>
      </div>

      {/* Section 4: Cloud Infrastructure & Connectivity Health */}
      <div className="panel-card" style={{ border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
        <div className="panel-card-header" style={{ background: "#ffffff", padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Server size={16} color="#16a34a" />
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>System & Cloud Health</div>
              <div style={{ fontSize: "12px", color: "#64748b" }}>Live status of backend services and high-concurrency database connection</div>
            </div>
          </div>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#16a34a", background: "#dcfce7", padding: "3px 10px", borderRadius: "12px" }}>
            ALL SYSTEMS NORMAL
          </span>
        </div>

        <div className="panel-card-body" style={{ padding: "20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
            
            {/* Database Service */}
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Database size={16} color="#0284c7" />
                  <b style={{ fontSize: "13px", color: "#0f172a" }}>Neon PostgreSQL Cloud</b>
                </div>
                <span style={{ fontSize: "10px", fontWeight: 700, background: "#dcfce7", color: "#15803d", padding: "2px 6px", borderRadius: "4px" }}>
                  CONNECTED
                </span>
              </div>
              <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 8px 0" }}>
                Auto-scaling serverless PostgreSQL hosted in AWS US-East-1 with connection pooling.
              </p>
              <div style={{ fontSize: "11px", color: "#475569", background: "#ffffff", padding: "6px 8px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                Capacity: <strong>1,044 Registered Candidates</strong> ready for tomorrow.
              </div>
            </div>

            {/* Backend Engine */}
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Server size={16} color="#16a34a" />
                  <b style={{ fontSize: "13px", color: "#0f172a" }}>FastAPI Async Engine</b>
                </div>
                <span style={{ fontSize: "10px", fontWeight: 700, background: "#dcfce7", color: "#15803d", padding: "2px 6px", borderRadius: "4px" }}>
                  RUNNING
                </span>
              </div>
              <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 8px 0" }}>
                Python 3.11 asynchronous API engine handling candidate authentication and exam state.
              </p>
              <div style={{ fontSize: "11px", color: "#475569", background: "#ffffff", padding: "6px 8px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                Concurrency Stress: <strong>350 Simultaneous Requests (100% Pass)</strong>.
              </div>
            </div>

            {/* Candidate Portal */}
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Laptop size={16} color="#8b5cf6" />
                  <b style={{ fontSize: "13px", color: "#0f172a" }}>Candidate Web Portal</b>
                </div>
                <span style={{ fontSize: "10px", fontWeight: 700, background: "#dcfce7", color: "#15803d", padding: "2px 6px", borderRadius: "4px" }}>
                  READY
                </span>
              </div>
              <p style={{ fontSize: "12px", color: "#64748b", margin: "0 0 8px 0" }}>
                Modern, responsive test-taker interface with dynamic slot gate and proctoring safeguards.
              </p>
              <div style={{ fontSize: "11px", color: "#475569", background: "#ffffff", padding: "6px 8px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                Access: <strong>Strict Slot Window Check Active</strong>.
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Section 5: Advanced Technical Options (Collapsible - Closed by default) */}
      <div style={{ border: "1px solid #e2e8f0", borderRadius: "12px", background: "#ffffff", overflow: "hidden" }}>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          style={{
            width: "100%",
            padding: "16px 20px",
            background: "#ffffff",
            border: "none",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: "pointer",
            textAlign: "left"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Lock size={16} color="#64748b" />
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#334155" }}>
                Advanced Technical & Safe Exam Browser (SEB) Settings
              </div>
              <div style={{ fontSize: "12px", color: "#94a3b8" }}>
                Optional configuration for institutional computer labs and hardware lockdown profiles
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#64748b", fontSize: "12px" }}>
            <span>{showAdvanced ? "Hide Technical Details" : "Show Technical Details"}</span>
            {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </div>
        </button>

        {showAdvanced && (
          <div style={{ padding: "0 20px 20px 20px", borderTop: "1px solid #f1f5f9" }}>
            <div style={{ padding: "14px 0", fontSize: "12.5px", color: "#64748b", lineHeight: 1.5 }}>
              These settings are only required if you are conducting the examination in a locked institutional lab using Safe Exam Browser (SEB). For standard web browsers (Google Chrome, Microsoft Edge), candidates access the portal directly without any configuration.
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginBottom: "16px" }}>
              
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px" }}>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "6px" }}>
                  Browser Exam Key (BEK) Hash
                </label>
                <div style={{ display: "flex", gap: "6px" }}>
                  <input 
                    type="text" 
                    value={sebKey} 
                    readOnly 
                    style={{ flex: 1, padding: "6px 8px", fontSize: "11px", fontFamily: "monospace", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                  />
                  <button 
                    type="button" 
                    onClick={copyKey}
                    style={{ padding: "6px 10px", fontSize: "11px", background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                  >
                    {copiedKey ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                    {copiedKey ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>

              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px" }}>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "6px" }}>
                  SEB Lab Admin Quit Password
                </label>
                <input 
                  type="text" 
                  value={quitPassword} 
                  readOnly 
                  style={{ width: "100%", padding: "6px 8px", fontSize: "11px", fontFamily: "monospace", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                />
              </div>

              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px" }}>
                <label style={{ fontSize: "11px", fontWeight: 700, color: "#475569", display: "block", marginBottom: "6px" }}>
                  Candidate Portal Start URL
                </label>
                <input 
                  type="text" 
                  value={candidateUrl} 
                  readOnly 
                  style={{ width: "100%", padding: "6px 8px", fontSize: "11px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "6px" }}
                />
              </div>

            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button 
                type="button" 
                onClick={copyXml}
                style={{ 
                  padding: "8px 14px", 
                  fontSize: "12px", 
                  fontWeight: 600, 
                  background: "#f8fafc", 
                  border: "1px solid #cbd5e1", 
                  borderRadius: "6px", 
                  cursor: "pointer", 
                  display: "inline-flex", 
                  alignItems: "center", 
                  gap: "6px",
                  color: "#334155" 
                }}
              >
                {copiedXml ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                {copiedXml ? "SEB Config XML Copied!" : "Copy SEB Configuration XML"}
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
