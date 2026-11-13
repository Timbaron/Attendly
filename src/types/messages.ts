import { MeetingAttendanceData, ObservedParticipantRaw, TrackingSessionConfig } from "./attendance";

export type AttendlyMessage =
  | { type: "GET_MEETING_STATE"; tabId?: number }
  | { type: "MEETING_STATE_UPDATE"; data: MeetingAttendanceData }
  | { type: "START_TRACKING"; tabId?: number; config?: Partial<TrackingSessionConfig> }
  | { type: "PAUSE_TRACKING"; tabId?: number }
  | { type: "RESUME_TRACKING"; tabId?: number }
  | { type: "STOP_TRACKING"; tabId?: number }
  | { type: "DISCARD_SESSION"; tabId?: number }
  | { type: "UPDATE_CONFIG"; config: Partial<TrackingSessionConfig> }
  | { type: "OPEN_DASHBOARD"; tabId?: number }
  | {
      type: "CONTENT_OBSERVATION";
      meetingCode: string;
      title: string | null;
      participants: ObservedParticipantRaw[];
      headerCount: number | null;
      isPeoplePanelOpen: boolean;
      isInCall: boolean;
    }
  | {
      type: "DIAGNOSTIC_EVENT";
      code: string;
      message: string;
      severity: "info" | "warning" | "error";
      details?: Record<string, unknown>;
    };
