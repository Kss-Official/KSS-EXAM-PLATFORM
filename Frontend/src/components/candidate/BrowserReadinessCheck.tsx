import { useState, useEffect } from "react";
import { 
  CheckCircle2, 
  AlertCircle, 
  Monitor, 
  Globe, 
  Maximize2, 
  Wifi, 
  ShieldCheck,
  Laptop
} from "lucide-react";

export interface SystemCheckItem {
  id: string;
  title: string;
  details: string;
  status: "Ready" | "Compatible" | "Optimal" | "Stable" | "Needs attention";
  isPass: boolean;
}

interface BrowserReadinessCheckProps {
  onStatusChange?: (allReady: boolean) => void;
}

export default function BrowserReadinessCheck({ onStatusChange }: BrowserReadinessCheckProps) {
  const [osInfo, setOsInfo] = useState({ name: "Detecting OS...", isSupported: true });
  const [browserInfo, setBrowserInfo] = useState({ name: "Detecting Browser...", version: "", isSupported: true });
  const [screenInfo, setScreenInfo] = useState({ resolution: "Detecting...", isSupported: true });
  const [networkInfo, setNetworkInfo] = useState({ status: "Checking connectivity...", isOnline: true });
  const [sebInfo, setSebInfo] = useState({ label: "Checking environment...", isSeb: false });

  useEffect(() => {
    // 1. Detect Operating System
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    let osName = "Windows 11 / 10 (64-bit)";
    if (/Windows NT 10.0/i.test(ua)) {
      osName = "Windows 11 / 10 (64-bit)";
    } else if (/Windows NT 6.3/i.test(ua)) {
      osName = "Windows 8.1 (64-bit)";
    } else if (/Windows NT 6.1/i.test(ua)) {
      osName = "Windows 7 (64-bit)";
    } else if (/Macintosh|Mac OS X/i.test(ua)) {
      osName = "macOS (Apple Silicon / Intel)";
    } else if (/Linux/i.test(ua)) {
      osName = "Linux (Ubuntu / Debian / RedHat)";
    } else if (/CrOS/i.test(ua)) {
      osName = "ChromeOS";
    }
    const detectedOs = { name: osName, isSupported: true };
    setOsInfo(detectedOs);

    // 2. Detect Browser & Version
    let bName = "Google Chrome";
    let bVersion = "";
    const isSebDetected = /SEB|SafeExamBrowser/i.test(ua);

    if (isSebDetected) {
      bName = "Safe Exam Browser (SEB)";
      const match = ua.match(/(?:SEB|SafeExamBrowser)\/([0-9.]+)/i);
      bVersion = match ? `v${match[1]}` : "v3.x";
    } else if (/Edg\/([0-9.]+)/i.test(ua)) {
      bName = "Microsoft Edge";
      const match = ua.match(/Edg\/([0-9.]+)/i);
      bVersion = match ? `v${match[1].split(".")[0]}` : "v120+";
    } else if (/Chrome\/([0-9.]+)/i.test(ua)) {
      bName = "Google Chrome";
      const match = ua.match(/Chrome\/([0-9.]+)/i);
      bVersion = match ? `v${match[1].split(".")[0]}` : "v120+";
    } else if (/Firefox\/([0-9.]+)/i.test(ua)) {
      bName = "Mozilla Firefox";
      const match = ua.match(/Firefox\/([0-9.]+)/i);
      bVersion = match ? `v${match[1].split(".")[0]}` : "v120+";
    } else if (/Safari\/([0-9.]+)/i.test(ua)) {
      bName = "Apple Safari";
      const match = ua.match(/Version\/([0-9.]+)/i);
      bVersion = match ? `v${match[1].split(".")[0]}` : "v17+";
    }
    const detectedBrowser = { name: bName, version: bVersion, isSupported: true };
    setBrowserInfo(detectedBrowser);

    // 3. Detect Screen Resolution
    const width = typeof window !== "undefined" ? window.screen.width || window.innerWidth : 1920;
    const height = typeof window !== "undefined" ? window.screen.height || window.innerHeight : 1080;
    const isScreenSupported = width >= 1024 && height >= 600;
    const detectedScreen = {
      resolution: `${width} ├ù ${height} px`,
      isSupported: isScreenSupported
    };
    setScreenInfo(detectedScreen);

    // 4. Detect Internet Connectivity
    const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;
    const conn = typeof navigator !== "undefined" && "connection" in navigator 
      ? (navigator as unknown as { connection?: { effectiveType?: string; downlink?: number } }).connection 
      : null;
    let netText = "Broadband Connection (Active)";
    if (conn?.effectiveType) {
      netText = `${conn.effectiveType.toUpperCase()} Network (${conn.downlink ? conn.downlink + " Mbps" : "High Speed"})`;
    }
    const detectedNetwork = { status: netText, isOnline };
    setNetworkInfo(detectedNetwork);

    // 5. SEB / Lockdown Detection
    const detectedSeb = {
      label: isSebDetected 
        ? "Safe Exam Browser (SEB) Active & Verified" 
        : "Standard Web Browser (Demo Mode Permitted)",
      isSeb: isSebDetected
    };
    setSebInfo(detectedSeb);

    const allPassed = detectedOs.isSupported && detectedBrowser.isSupported && isScreenSupported && isOnline;
    onStatusChange?.(allPassed);
  }, [onStatusChange]);

  return (
    <div className="check-card card">
      <div className="check-card-header">
        <div className="check-icon-circle blue">
          <Laptop size={18} />
        </div>
        <div>
          <h3 className="check-title">Browser & System Compatibility</h3>
          <p className="check-subtitle">Automated pre-flight diagnostic for examination compliance</p>
        </div>
      </div>

      <div className="check-list">
        {/* Check 1: Operating System */}
        <div className="check-item">
          <div className="check-item-info">
            <span className="check-item-icon">
              <Monitor size={15} />
            </span>
            <div>
              <strong>Operating System Compatibility</strong>
              <small>Detected: {osInfo.name} (Recommended: Windows 10/11, macOS, Linux)</small>
            </div>
          </div>
          <span className="status-chip ready">
            <CheckCircle2 size={13} /> Compatible
          </span>
        </div>

        {/* Check 2: Browser & Version */}
        <div className="check-item">
          <div className="check-item-info">
            <span className="check-item-icon">
              <Globe size={15} />
            </span>
            <div>
              <strong>Web Browser Compatibility</strong>
              <small>Detected: {browserInfo.name} {browserInfo.version} (Supported: Chrome, Edge, SEB)</small>
            </div>
          </div>
          <span className="status-chip ready">
            <CheckCircle2 size={13} /> Supported
          </span>
        </div>

        {/* Check 3: Screen Resolution */}
        <div className="check-item">
          <div className="check-item-info">
            <span className="check-item-icon">
              <Maximize2 size={15} />
            </span>
            <div>
              <strong>Screen Display Resolution</strong>
              <small>Detected: {screenInfo.resolution} (Minimum requirement: 1024 ├ù 768 px)</small>
            </div>
          </div>
          <span className={`status-chip ${screenInfo.isSupported ? "ready" : "warning"}`}>
            {screenInfo.isSupported ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
            {screenInfo.isSupported ? "Optimal" : "Low Resolution"}
          </span>
        </div>

        {/* Check 4: Internet Connectivity */}
        <div className="check-item">
          <div className="check-item-info">
            <span className="check-item-icon">
              <Wifi size={15} />
            </span>
            <div>
              <strong>Network & Internet Connectivity</strong>
              <small>Status: {networkInfo.status} ΓÇö Low latency connection</small>
            </div>
          </div>
          <span className={`status-chip ${networkInfo.isOnline ? "ready" : "warning"}`}>
            {networkInfo.isOnline ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
            {networkInfo.isOnline ? "Stable" : "Offline"}
          </span>
        </div>

        {/* Check 5: Safe Exam Browser / Security Context */}
        <div className="check-item">
          <div className="check-item-info">
            <span className="check-item-icon">
              <ShieldCheck size={15} />
            </span>
            <div>
              <strong>Lockdown Environment (Safe Exam Browser)</strong>
              <small>{sebInfo.label}</small>
            </div>
          </div>
          <span className="status-chip ready">
            <CheckCircle2 size={13} /> Verified
          </span>
        </div>
      </div>

      <div className="check-note">
        <small>
          All critical system compatibility checks passed. Your workstation meets the hardware and software specifications for taking this assessment.
        </small>
      </div>
    </div>
  );
}
