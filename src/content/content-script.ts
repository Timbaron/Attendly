import {
  AttendanceEngine,
  createInitialMeetingData,
} from "../attendance/attendance-engine";
import { MeetingDetector } from "./meeting-detector";
import { MeetObserver } from "./meet-observer";
import { StorageService } from "../storage/session-storage";
import { AttendlyMessage } from "../types/messages";
import { MeetingAttendanceData, MeetingMetadata } from "../types/attendance";

class ContentScriptController {
  private engine: AttendanceEngine | null = null;
  private observer: MeetObserver | null = null;
  private meetingCode: string | null = null;

  public async initialize(): Promise<void> {
    const pageStatus = MeetingDetector.detectPageStatus();

    if (pageStatus.stage === "unsupported" || !pageStatus.meetingCode) {
      return;
    }

    this.meetingCode = pageStatus.meetingCode;

    const metadata: MeetingMetadata = {
      meetingCode: pageStatus.meetingCode,
      title: pageStatus.meetingTitle,
      platform: "google-meet",
      url: window.location.href,
    };

    // Check if an existing session is in storage for this meeting
    const saved = await StorageService.getMeetingSession(this.meetingCode);
    const prefs = await StorageService.getPreferences();

    const initialData: MeetingAttendanceData = saved
      ? saved
      : createInitialMeetingData(metadata, prefs);

    // Update state based on current page status
    if (pageStatus.stage === "lobby" && initialData.trackingState === "ready") {
      initialData.trackingState = "meeting_detected";
    } else if (pageStatus.stage === "in_call" && initialData.trackingState === "meeting_detected") {
      initialData.trackingState = "ready";
    }

    this.engine = new AttendanceEngine(initialData, (updatedData) => {
      this.handleStateChange(updatedData);
    });

    this.observer = new MeetObserver((snapshot) => {
      if (this.engine) {
        this.engine.reconcileObservations({
          observedList: snapshot.participants,
          headerCount: snapshot.headerCount,
          peoplePanelOpen: snapshot.isPeoplePanelOpen,
          virtualizationDetected: snapshot.virtualizationDetected,
        });
      }
    });

    // If session was actively tracking when script reloaded, resume observer
    if (initialData.trackingState === "tracking") {
      this.observer.start();
    }

    this.setupMessageListener();
    this.broadcastState();
  }

  private handleStateChange(data: MeetingAttendanceData): void {
    StorageService.saveMeetingSession(data);
    this.broadcastState();
  }

  private broadcastState(): void {
    if (!this.engine) return;
    const data = this.engine.getData();

    // Send state to background service worker (for badge updates & storage)
    try {
      chrome.runtime.sendMessage({
        type: "MEETING_STATE_UPDATE",
        data,
      });
    } catch {
      // Receiver may be dormant
    }
  }

  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener(
      (
        message: AttendlyMessage,
        _sender: chrome.runtime.MessageSender,
        sendResponse: (response?: unknown) => void
      ) => {
        if (!this.engine) {
          sendResponse({ error: "Attendance engine not initialized" });
          return true;
        }

        switch (message.type) {
          case "GET_MEETING_STATE": {
            // Re-check page status dynamically
            const status = MeetingDetector.detectPageStatus();
            const currentData = this.engine.getData();

            if (status.stage === "lobby" && currentData.trackingState === "ready") {
              currentData.trackingState = "meeting_detected";
            } else if (status.stage === "in_call" && currentData.trackingState === "meeting_detected") {
              currentData.trackingState = "ready";
            }

            if (status.meetingTitle && !currentData.meeting.title) {
              currentData.meeting.title = status.meetingTitle;
            }

            sendResponse({ data: currentData });
            break;
          }

          case "START_TRACKING": {
            if (message.config) {
              this.engine.updateConfig(message.config);
            }
            const started = this.engine.startTracking();
            if (started && this.observer) {
              this.observer.start();
            }
            sendResponse({ success: started, data: this.engine.getData() });
            break;
          }

          case "PAUSE_TRACKING": {
            const paused = this.engine.pauseTracking();
            if (paused && this.observer) {
              this.observer.stop();
            }
            sendResponse({ success: paused, data: this.engine.getData() });
            break;
          }

          case "RESUME_TRACKING": {
            const resumed = this.engine.resumeTracking();
            if (resumed && this.observer) {
              this.observer.start();
            }
            sendResponse({ success: resumed, data: this.engine.getData() });
            break;
          }

          case "STOP_TRACKING": {
            const stopped = this.engine.stopTracking();
            if (stopped && this.observer) {
              this.observer.stop();
            }
            sendResponse({ success: stopped, data: this.engine.getData() });
            break;
          }

          case "DISCARD_SESSION": {
            if (this.observer) {
              this.observer.stop();
            }
            const status = MeetingDetector.detectPageStatus();
            const resetData = createInitialMeetingData(
              {
                meetingCode: this.meetingCode || "meeting",
                title: status.meetingTitle,
                platform: "google-meet",
                url: window.location.href,
              },
              this.engine.getData().config
            );
            this.engine = new AttendanceEngine(resetData, (d) => this.handleStateChange(d));
            StorageService.clearMeetingSession(this.meetingCode || "");
            sendResponse({ success: true, data: resetData });
            break;
          }

          case "UPDATE_CONFIG": {
            this.engine.updateConfig(message.config);
            sendResponse({ success: true, data: this.engine.getData() });
            break;
          }

          default:
            sendResponse({ status: "ignored" });
            break;
        }

        return true;
      }
    );
  }
}

// Instantiate and start
const controller = new ContentScriptController();
controller.initialize();
