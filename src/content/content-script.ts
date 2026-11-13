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
  private lastCheckedUrl: string = window.location.href;

  public initialize(): void {
    // 1. Always set up message listener first so we never drop messages
    this.setupMessageListener();

    // 2. Attempt meeting initialization for current page
    this.ensureMeetingInitialized();

    // 3. Monitor SPA navigation (Google Meet changes URLs without full reloads)
    window.addEventListener("popstate", () => this.ensureMeetingInitialized());
    window.addEventListener("hashchange", () => this.ensureMeetingInitialized());

    setInterval(() => {
      if (window.location.href !== this.lastCheckedUrl) {
        this.lastCheckedUrl = window.location.href;
        this.ensureMeetingInitialized();
      }
    }, 1000);
  }

  public async ensureMeetingInitialized(): Promise<boolean> {
    const pageStatus = MeetingDetector.detectPageStatus();

    if (pageStatus.stage === "unsupported" || !pageStatus.meetingCode) {
      return false;
    }

    // If meeting code hasn't changed and engine is already running
    if (this.meetingCode === pageStatus.meetingCode && this.engine) {
      // Re-evaluate lobby vs ready
      const currentData = this.engine.getData();
      if (pageStatus.stage === "lobby" && currentData.trackingState === "ready") {
        currentData.trackingState = "meeting_detected";
      } else if (pageStatus.stage === "in_call" && currentData.trackingState === "meeting_detected") {
        currentData.trackingState = "ready";
      }
      return true;
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

    if (this.observer) {
      this.observer.stop();
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

    // If session was actively tracking, resume observer
    if (initialData.trackingState === "tracking") {
      this.observer.start();
    }

    this.broadcastState();
    return true;
  }

  private handleStateChange(data: MeetingAttendanceData): void {
    StorageService.saveMeetingSession(data);
    this.broadcastState();
  }

  private broadcastState(): void {
    if (!this.engine) return;
    const data = this.engine.getData();

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
        // Ensure meeting is initialized before handling messages
        this.ensureMeetingInitialized().then((initialized) => {
          if (!this.engine || !initialized) {
            const pageStatus = MeetingDetector.detectPageStatus();
            sendResponse({
              error: "Not in an active meeting",
              pageStatus,
            });
            return;
          }

          switch (message.type) {
            case "GET_MEETING_STATE": {
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
        });

        return true; // Keep message channel open for async response
      }
    );
  }
}

// Instantiate and start
const controller = new ContentScriptController();
controller.initialize();
