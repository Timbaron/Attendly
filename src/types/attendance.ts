export type TrackingState =
  | "not_in_meeting"
  | "meeting_detected"
  | "ready"
  | "tracking"
  | "paused"
  | "stopped";

export type ParticipantStatus = "present" | "left" | "unknown";

export type ConfidenceLevel = "observed" | "estimated";

export type IdentityConfidence = "high" | "low";

export interface AttendanceSession {
  id: string;
  joinedAt: string; // ISO 8601
  leftAt: string | null; // ISO 8601 or null
  durationMs: number;
  confidence: ConfidenceLevel;
}

export interface ParticipantAttendance {
  id: string;
  displayName: string;
  avatarUrl?: string;
  firstJoinedAt: string; // ISO 8601
  lastLeftAt: string | null; // ISO 8601
  totalDurationMs: number;
  sessions: AttendanceSession[];
  status: ParticipantStatus;
  isLate: boolean;
  leftEarly: boolean;
  attendancePercentage: number | null;
  identityConfidence: IdentityConfidence;
  notes?: string;
}

export interface DiagnosticRecord {
  id: string;
  timestamp: string; // ISO 8601
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface MeetingMetadata {
  meetingCode: string;
  title: string | null;
  platform: "google-meet" | "zoom" | "teams";
  url: string;
  tabId?: number;
}

export interface TrackingSessionConfig {
  gracePeriodMinutes: number; // Default 10 min
  expectedDurationMinutes: number | null; // Optional expected meeting duration
  earlyDepartureThresholdMinutes: number; // Default 5 min
  attendancePercentageThreshold: number; // Default 75%
  excludeHost: boolean;
  timeFormat: "12h" | "24h";
  theme: "light" | "dark" | "system";
}

export interface MeetingAttendanceData {
  sessionId: string;
  meeting: MeetingMetadata;
  config: TrackingSessionConfig;
  trackingState: TrackingState;
  trackingStartedAt: string | null; // ISO 8601
  trackingPausedAt: string | null;
  trackingStoppedAt: string | null;
  totalPausedDurationMs: number;
  participants: Record<string, ParticipantAttendance>;
  diagnostics: DiagnosticRecord[];
  lastObservedCount: number | null;
  virtualizationDetected: boolean;
  peoplePanelOpen: boolean;
}

export interface ObservedParticipantRaw {
  rawId?: string;
  displayName: string;
  avatarUrl?: string;
  isHost?: boolean;
}

export interface ParticipantSummaryStats {
  totalUnique: number;
  currentlyPresent: number;
  confirmedDeparted: number;
  unknownStatus: number;
  lateArrivals: number;
  earlyDepartures: number;
  averageDurationMs: number;
  elapsedTrackingMs: number;
}
