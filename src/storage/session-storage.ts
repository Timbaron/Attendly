import { MeetingAttendanceData, TrackingSessionConfig } from "../types/attendance";
import { DEFAULT_CONFIG } from "../attendance/attendance-engine";

const SESSION_STORAGE_KEY_PREFIX = "attendly_session_";
const USER_PREFERENCES_KEY = "attendly_user_preferences";
const RECENT_EXPORT_DRAFT_KEY = "attendly_last_session_draft";

export class StorageService {
  /**
   * Saves meeting attendance data into chrome.storage.session.
   */
  public static async saveMeetingSession(data: MeetingAttendanceData): Promise<void> {
    try {
      const key = `${SESSION_STORAGE_KEY_PREFIX}${data.meeting.meetingCode}`;
      const payload = { [key]: data };

      if (typeof chrome !== "undefined" && chrome.storage?.session) {
        await chrome.storage.session.set(payload);
      }

      // Also save to chrome.storage.local as a safety draft in case of browser/tab crash
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        await chrome.storage.local.set({ [RECENT_EXPORT_DRAFT_KEY]: data });
      }
    } catch (e) {
      console.warn("[Attendly] Could not save session to storage:", e);
    }
  }

  /**
   * Retrieves meeting attendance data for a meeting code.
   */
  public static async getMeetingSession(
    meetingCode: string
  ): Promise<MeetingAttendanceData | null> {
    try {
      const key = `${SESSION_STORAGE_KEY_PREFIX}${meetingCode}`;
      if (typeof chrome !== "undefined" && chrome.storage?.session) {
        const res = await chrome.storage.session.get(key);
        if (res && res[key]) {
          return res[key] as MeetingAttendanceData;
        }
      }
    } catch (e) {
      console.warn("[Attendly] Could not retrieve session from storage:", e);
    }
    return null;
  }

  /**
   * Retrieves the most recent session draft (useful for the dashboard or accident recovery).
   */
  public static async getLastSessionDraft(): Promise<MeetingAttendanceData | null> {
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        const res = await chrome.storage.local.get(RECENT_EXPORT_DRAFT_KEY);
        if (res && res[RECENT_EXPORT_DRAFT_KEY]) {
          return res[RECENT_EXPORT_DRAFT_KEY] as MeetingAttendanceData;
        }
      }
    } catch (e) {
      console.warn("[Attendly] Could not get session draft:", e);
    }
    return null;
  }

  /**
   * Removes meeting session data.
   */
  public static async clearMeetingSession(meetingCode: string): Promise<void> {
    try {
      const key = `${SESSION_STORAGE_KEY_PREFIX}${meetingCode}`;
      if (typeof chrome !== "undefined" && chrome.storage?.session) {
        await chrome.storage.session.remove(key);
      }
    } catch (e) {
      console.warn("[Attendly] Could not clear session:", e);
    }
  }

  /**
   * Saves user configuration / preferences in local storage.
   */
  public static async savePreferences(config: Partial<TrackingSessionConfig>): Promise<void> {
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        const existing = await this.getPreferences();
        await chrome.storage.local.set({
          [USER_PREFERENCES_KEY]: { ...existing, ...config },
        });
      }
    } catch (e) {
      console.warn("[Attendly] Could not save preferences:", e);
    }
  }

  /**
   * Retrieves user preferences.
   */
  public static async getPreferences(): Promise<TrackingSessionConfig> {
    try {
      if (typeof chrome !== "undefined" && chrome.storage?.local) {
        const res = await chrome.storage.local.get(USER_PREFERENCES_KEY);
        if (res && res[USER_PREFERENCES_KEY]) {
          return { ...DEFAULT_CONFIG, ...res[USER_PREFERENCES_KEY] };
        }
      }
    } catch (e) {
      console.warn("[Attendly] Could not get preferences:", e);
    }
    return DEFAULT_CONFIG;
  }
}
