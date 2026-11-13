import {
  DiagnosticRecord,
  MeetingAttendanceData,
  MeetingMetadata,
  ObservedParticipantRaw,
  ParticipantSummaryStats,
  TrackingSessionConfig,
} from "../types/attendance";
import { getCurrentIso } from "../utils/time";
import { computeSummaryStats } from "./attendance-calculator";
import { SessionManager } from "./session-manager";

export const DEFAULT_CONFIG: TrackingSessionConfig = {
  gracePeriodMinutes: 10,
  expectedDurationMinutes: 60,
  earlyDepartureThresholdMinutes: 5,
  attendancePercentageThreshold: 75,
  excludeHost: false,
  timeFormat: "12h",
  theme: "system",
};

export function createInitialMeetingData(
  meeting: MeetingMetadata,
  config?: Partial<TrackingSessionConfig>
): MeetingAttendanceData {
  return {
    sessionId: `att_sess_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
    meeting,
    config: { ...DEFAULT_CONFIG, ...config },
    trackingState: "ready",
    trackingStartedAt: null,
    trackingPausedAt: null,
    trackingStoppedAt: null,
    totalPausedDurationMs: 0,
    participants: {},
    diagnostics: [],
    lastObservedCount: null,
    virtualizationDetected: false,
    peoplePanelOpen: false,
  };
}

export class AttendanceEngine {
  private data: MeetingAttendanceData;
  private sessionManager: SessionManager;
  private onStateChange?: (data: MeetingAttendanceData) => void;

  constructor(
    initialData: MeetingAttendanceData,
    onStateChange?: (data: MeetingAttendanceData) => void
  ) {
    this.data = initialData;
    this.sessionManager = new SessionManager();
    this.onStateChange = onStateChange;
  }

  public getData(): MeetingAttendanceData {
    return this.data;
  }

  public updateConfig(config: Partial<TrackingSessionConfig>): void {
    this.data = {
      ...this.data,
      config: { ...this.data.config, ...config },
    };
    this.notify();
  }

  public startTracking(startTimeIso?: string): boolean {
    if (this.data.trackingState === "tracking") {
      return false;
    }

    const now = startTimeIso || getCurrentIso();
    const isFirstStart = !this.data.trackingStartedAt;

    this.data = {
      ...this.data,
      trackingState: "tracking",
      trackingStartedAt: isFirstStart ? now : this.data.trackingStartedAt,
      trackingPausedAt: null,
      trackingStoppedAt: null,
    };

    this.addDiagnostic("info", "TRACKING_STARTED", "Attendance tracking started.", {
      time: now,
    });

    this.notify();
    return true;
  }

  public pauseTracking(pauseTimeIso?: string): boolean {
    if (this.data.trackingState !== "tracking") {
      return false;
    }

    const now = pauseTimeIso || getCurrentIso();

    // Close all active intervals at pause time
    this.data = this.sessionManager.closeAllOpenSessions(this.data, now, "paused");

    this.data = {
      ...this.data,
      trackingState: "paused",
      trackingPausedAt: now,
    };

    this.addDiagnostic(
      "info",
      "TRACKING_PAUSED",
      "Attendance tracking paused. Unobserved interval will not be credited.",
      { time: now }
    );

    this.notify();
    return true;
  }

  public resumeTracking(resumeTimeIso?: string): boolean {
    if (this.data.trackingState !== "paused") {
      return false;
    }

    const now = resumeTimeIso || getCurrentIso();

    // Calculate duration of paused interval
    let pauseIntervalMs = 0;
    if (this.data.trackingPausedAt) {
      const pStart = new Date(this.data.trackingPausedAt).getTime();
      const pEnd = new Date(now).getTime();
      if (!isNaN(pStart) && !isNaN(pEnd) && pEnd > pStart) {
        pauseIntervalMs = pEnd - pStart;
      }
    }

    // Resume open sessions for participants present before pause
    this.data = this.sessionManager.resumeOpenSessions(this.data, now);

    this.data = {
      ...this.data,
      trackingState: "tracking",
      trackingPausedAt: null,
      totalPausedDurationMs: this.data.totalPausedDurationMs + pauseIntervalMs,
    };

    this.addDiagnostic(
      "info",
      "TRACKING_RESUMED",
      "Attendance tracking resumed.",
      { pausedDurationMs: pauseIntervalMs }
    );

    this.notify();
    return true;
  }

  public stopTracking(stopTimeIso?: string): boolean {
    if (
      this.data.trackingState !== "tracking" &&
      this.data.trackingState !== "paused"
    ) {
      return false;
    }

    const now = stopTimeIso || getCurrentIso();

    // Close all open intervals permanently
    this.data = this.sessionManager.closeAllOpenSessions(this.data, now, "stopped");

    this.data = {
      ...this.data,
      trackingState: "stopped",
      trackingStoppedAt: now,
    };

    this.addDiagnostic(
      "info",
      "TRACKING_STOPPED",
      "Attendance tracking stopped. Report is ready for review and download.",
      { time: now }
    );

    this.notify();
    return true;
  }

  public reconcileObservations(options: {
    observedList: ObservedParticipantRaw[];
    headerCount: number | null;
    peoplePanelOpen: boolean;
    virtualizationDetected: boolean;
    currentTimeIso?: string;
  }): void {
    if (this.data.trackingState !== "tracking") {
      return;
    }

    const { updatedData } = this.sessionManager.reconcile(this.data, options);
    this.data = updatedData;
    this.notify();
  }

  public getSummaryStats(): ParticipantSummaryStats {
    return computeSummaryStats(
      this.data.participants,
      this.data.trackingStartedAt,
      this.data.trackingStoppedAt,
      this.data.totalPausedDurationMs,
      getCurrentIso()
    );
  }

  public addDiagnostic(
    severity: "info" | "warning" | "error",
    code: string,
    message: string,
    details?: Record<string, unknown>
  ): void {
    const record: DiagnosticRecord = {
      id: `diag_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: getCurrentIso(),
      severity,
      code,
      message,
      details,
    };
    this.data = {
      ...this.data,
      diagnostics: [...this.data.diagnostics, record],
    };
  }

  private notify(): void {
    if (this.onStateChange) {
      this.onStateChange(this.data);
    }
  }
}
