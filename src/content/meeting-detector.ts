/**
 * Detects Google Meet page states:
 * - Homepage / Landing
 * - Pre-join / Lobby ("Ready to join?", "Ask to join", "Join now")
 * - In-Call (active meeting toolbar with leave call button)
 * - Left-Call ("You left the meeting", "Rejoin")
 */

export interface MeetPageStatus {
  stage: "homepage" | "lobby" | "in_call" | "left_call" | "unsupported";
  meetingCode: string | null;
  meetingTitle: string | null;
}

const MEET_CODE_REGEX = /\b([a-z]{3}-[a-z]{4}-[a-z]{3})\b/i;

export class MeetingDetector {
  public static extractMeetingCode(urlOrPath = window.location.pathname): string | null {
    // Check path or full URL for standard 3-4-3 meeting code pattern
    const match = urlOrPath.match(MEET_CODE_REGEX);
    return match ? match[1].toLowerCase() : null;
  }

  public static getMeetingTitle(): string | null {
    // 1. Try to find the title element in Google Meet header
    const titleEl =
      document.querySelector("div[data-meeting-title]") ||
      document.querySelector("div[jsname='r4nke']") ||
      document.querySelector("div.u6vdEc");

    if (titleEl && titleEl.textContent?.trim()) {
      return titleEl.textContent.trim();
    }

    // 2. Try document title if it contains meeting name
    const docTitle = document.title;
    if (docTitle && !docTitle.toLowerCase().includes("meet -") && docTitle !== "Google Meet") {
      return docTitle.replace(/ - Google Meet/i, "").trim();
    }

    return null;
  }

  public static detectPageStatus(): MeetPageStatus {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;

    if (!hostname.includes("meet.google.com")) {
      return { stage: "unsupported", meetingCode: null, meetingTitle: null };
    }

    const meetingCode = this.extractMeetingCode(pathname);
    if (!meetingCode) {
      return { stage: "homepage", meetingCode: null, meetingTitle: null };
    }

    // 1. Check if user has left the call
    const leftCallIndicators = [
      "div[data-call-ended='true']",
      "button[jsname='A9uide']", // "Rejoin" button
      "a[href='/']", // "Return to home screen" link
    ];
    for (const sel of leftCallIndicators) {
      const d = document.querySelector(sel);
      if (d && d.textContent?.toLowerCase().includes("rejoin")) {
        return {
          stage: "left_call",
          meetingCode,
          meetingTitle: this.getMeetingTitle() || meetingCode,
        };
      }
    }

    // 2. Check if actively in-call FIRST before lobby!
    // The leave call button and call controls only exist when inside an active meeting.
    const inCallIndicators = [
      "button[data-is-leave-call='true']",
      "button[aria-label*='leave call' i]",
      "button[aria-label*='leave meeting' i]",
      "button[jsname='CQylAd']", // Leave button jsname
      "div[data-call-controls='true']",
      "div[aria-label*='meeting controls' i]",
      "button[aria-label*='show everyone' i]",
      "button[aria-label*='people' i]",
      "button[data-panel-id='1']",
    ];

    for (const sel of inCallIndicators) {
      if (document.querySelector(sel)) {
        return {
          stage: "in_call",
          meetingCode,
          meetingTitle: this.getMeetingTitle() || meetingCode,
        };
      }
    }

    // 3. Check if user is in lobby / green room / pre-join
    const lobbyIndicators = [
      "button[jsname='Qx7uuf']", // "Join now" or "Ask to join"
      "button[aria-label*='ask to join' i]",
      "button[aria-label*='join now' i]",
    ];
    for (const sel of lobbyIndicators) {
      if (document.querySelector(sel)) {
        return {
          stage: "lobby",
          meetingCode,
          meetingTitle: "Ready to join?",
        };
      }
    }

    // Check headings/body text for pre-join screen
    const bodyText = document.body ? document.body.innerText : "";
    if (bodyText.includes("Ready to join?") || bodyText.includes("Ask to join")) {
      return {
        stage: "lobby",
        meetingCode,
        meetingTitle: "Ready to join?",
      };
    }

    return {
      stage: "in_call",
      meetingCode,
      meetingTitle: this.getMeetingTitle() || meetingCode,
    };
  }
}
