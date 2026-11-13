import { AttendlyMessage } from "../types/messages";
import { MeetingAttendanceData } from "../types/attendance";

// Keep track of meeting codes mapped to active tabs
const tabMeetingMap = new Map<number, string>();

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Attendly] Service Worker Installed.");
  chrome.action.setBadgeBackgroundColor({ color: "#173D37" });
});

chrome.runtime.onMessage.addListener(
  (
    message: AttendlyMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ) => {
    switch (message.type) {
      case "MEETING_STATE_UPDATE": {
        const data = message.data as MeetingAttendanceData;
        if (sender.tab?.id) {
          tabMeetingMap.set(sender.tab.id, data.meeting.meetingCode);
          updateBadge(sender.tab.id, data);
        }
        sendResponse({ success: true });
        break;
      }

      case "OPEN_DASHBOARD": {
        chrome.tabs.create({
          url: chrome.runtime.getURL("dashboard.html"),
        });
        sendResponse({ success: true });
        break;
      }

      default:
        sendResponse({ status: "acknowledged" });
        break;
    }

    return true;
  }
);

// Listen for tab closed / removed
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const meetingCode = tabMeetingMap.get(tabId);
  if (meetingCode) {
    tabMeetingMap.delete(tabId);
    // Notice that session data is safely stored in chrome.storage.session and local draft
  }
});

function updateBadge(tabId: number, data: MeetingAttendanceData): void {
  try {
    if (data.trackingState === "tracking") {
      const presentCount = Object.values(data.participants).filter(
        (p) => p.status === "present"
      ).length;
      chrome.action.setBadgeText({
        tabId,
        text: presentCount > 0 ? String(presentCount) : "",
      });
      chrome.action.setBadgeBackgroundColor({ tabId, color: "#173D37" });
    } else if (data.trackingState === "paused") {
      chrome.action.setBadgeText({ tabId, text: "PAUSE" });
      chrome.action.setBadgeBackgroundColor({ tabId, color: "#D97706" }); // Amber
    } else {
      chrome.action.setBadgeText({ tabId, text: "" });
    }
  } catch (err) {
    console.warn("[Attendly] Error updating badge:", err);
  }
}
