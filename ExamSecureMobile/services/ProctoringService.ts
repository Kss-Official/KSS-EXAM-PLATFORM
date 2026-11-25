import { NativeEventEmitter, NativeModules, Platform } from "react-native";
import {
  ProctoringEvent,
  ProctoringConfig,
  DEFAULT_PROCTORING_CONFIG,
} from "../types/ProctoringEvent";
import { reportProctorAlert } from "./api";

const { ProctoringModule } = NativeModules;
let proctorEventEmitter: NativeEventEmitter | null = null;
try {
  if (ProctoringModule && ProctoringModule.addListener && ProctoringModule.removeListeners) {
    proctorEventEmitter = new NativeEventEmitter(ProctoringModule);
  }
} catch (_e) {
  // Not available in Expo Go or on this platform
}

type ProctorEventListener = (event: ProctoringEvent) => void;

class ProctoringService {
  private static instance: ProctoringService;
  private listeners: Set<ProctorEventListener> = new Set();
  private subscription: any = null;
  private isRunning: boolean = false;
  private candidateId: number | null = null;
  private attemptId: number | null = null;
  private totalStrikes: number = 0;
  private lastIncidentTime: number = 0;

  private constructor() {}

  public static getInstance(): ProctoringService {
    if (!ProctoringService.instance) {
      ProctoringService.instance = new ProctoringService();
    }
    return ProctoringService.instance;
  }

  public async start(
    candidateId: number,
    attemptId: number,
    config: Partial<ProctoringConfig> = {}
  ): Promise<boolean> {
    this.candidateId = candidateId;
    this.attemptId = attemptId;
    const finalConfig = { ...DEFAULT_PROCTORING_CONFIG, ...config };

    if (Platform.OS === "android" && ProctoringModule) {
      try {
        await ProctoringModule.startProctoring(finalConfig);
        this.subscription = proctorEventEmitter?.addListener(
          "onProctoringEvent",
          (data: any) => this.handleNativeEvent(data as ProctoringEvent)
        );
        this.isRunning = true;
        return true;
      } catch (err) {
        console.warn("[ProctoringService] Native start failed, falling back to JS loop:", err);
      }
    }
    this.isRunning = true;
    return true;
  }

  public async stop(): Promise<void> {
    this.isRunning = false;
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
    if (Platform.OS === "android" && ProctoringModule) {
      try {
        await ProctoringModule.stopProctoring();
      } catch (err) {
        console.warn("[ProctoringService] Stop failed:", err);
      }
    }
  }

  public addListener(listener: ProctorEventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public getStrikes(): number {
    return this.totalStrikes;
  }

  private handleNativeEvent = (event: ProctoringEvent) => {
    // Notify all UI listeners
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (e) {
        console.error("[ProctoringService] Listener error:", e);
      }
    });

    // Escalate strikes for CRITICAL violations
    if (event.severity === "CRITICAL" || event.type === "PHONE_DETECTED" || event.type === "MULTIPLE_FACES") {
      const now = Date.now();
      if (now - this.lastIncidentTime > 2500) {
        this.totalStrikes += 1;
        this.lastIncidentTime = now;
        this.syncIncidentWithBackend(event);
      }
    }
  };

  private async syncIncidentWithBackend(event: ProctoringEvent) {
    if (!this.candidateId) return;
    try {
      await reportProctorAlert({
        candidateId: this.candidateId,
        attemptId: this.attemptId ?? undefined,
        alertType: event.type,
        message: event.message,
        severity: event.severity,
      });
    } catch (err) {
      // Non-blocking telemetry
      console.warn("[ProctoringService] Incident sync suppressed:", err);
    }
  }
}

export const proctoringService = ProctoringService.getInstance();
