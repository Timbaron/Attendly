import { ObservedParticipantRaw } from "../types/attendance";

export interface MeetObservationSnapshot {
  participants: ObservedParticipantRaw[];
  headerCount: number | null;
  isPeoplePanelOpen: boolean;
  virtualizationDetected: boolean;
}

export class MeetAdapter {
  /**
   * Checks whether the People / Participants panel is open.
   */
  public static isPeoplePanelOpen(): boolean {
    // 1. Check if the People tab toggle button is active/pressed
    const peopleBtn =
      document.querySelector("button[aria-label*='people' i][aria-pressed='true']") ||
      document.querySelector("button[aria-label*='show everyone' i][aria-pressed='true']") ||
      document.querySelector("button[aria-label*='everyone' i][aria-pressed='true']") ||
      document.querySelector("button[data-panel-id='1'][aria-pressed='true']");

    if (peopleBtn) return true;

    // 2. Check if the People side panel container exists and is visible
    const panel =
      document.querySelector("div[role='tabpanel'][aria-label*='people' i]") ||
      document.querySelector("div[role='tabpanel'][aria-label*='participant' i]") ||
      document.querySelector("div[data-panel-id='1']");

    if (panel && panel.getBoundingClientRect().width > 0) {
      return true;
    }

    // 3. Fallback: check for list of participants in sidebar
    const participantList = document.querySelector("div[aria-label*='participants' i]");
    if (participantList && participantList.getBoundingClientRect().width > 0) {
      return true;
    }

    return false;
  }

  /**
   * Extracts the total participant count from Meet UI badges or tabs.
   */
  public static extractHeaderCount(): number | null {
    // Look at People button aria-label or text: e.g. "Show everyone (18)"
    const candidates = [
      document.querySelector("button[aria-label*='show everyone' i]"),
      document.querySelector("button[aria-label*='people' i]"),
      document.querySelector("button[data-panel-id='1']"),
      document.querySelector("div[aria-label*='people' i]"),
      document.querySelector("div[role='tab'][aria-label*='people' i]"),
    ];

    for (const el of candidates) {
      if (!el) continue;
      const text = `${el.getAttribute("aria-label") || ""} ${el.textContent || ""}`;
      const match = text.match(/\((\d+)\)/) || text.match(/\b(\d+)\s*(people|participants)?\b/i);
      if (match && match[1]) {
        const count = parseInt(match[1], 10);
        if (!isNaN(count) && count > 0) {
          return count;
        }
      }
    }

    return null;
  }

  /**
   * Reads participant elements from the People panel.
   */
  public static readPeoplePanelParticipants(): ObservedParticipantRaw[] {
    const participants: ObservedParticipantRaw[] = [];
    const seenNames = new Set<string>();

    // Strategy A: Find participant list items by ARIA role
    const items = Array.from(
      document.querySelectorAll(
        "div[role='listitem'], div[role='list'] > div, div[data-participant-id]"
      )
    );

    for (const item of items) {
      const parsed = this.parseParticipantItem(item);
      if (parsed && !seenNames.has(parsed.displayName.toLowerCase())) {
        seenNames.add(parsed.displayName.toLowerCase());
        participants.push(parsed);
      }
    }

    // Strategy B: If Strategy A yields few results, inspect structured containers inside the panel
    if (participants.length === 0) {
      const nameContainers = Array.from(
        document.querySelectorAll(
          "span.zWGUib, span[jsname='W297wb'], div[jsname='base'] span"
        )
      );

      for (const span of nameContainers) {
        const name = span.textContent?.trim();
        if (name && name.length > 1 && !this.isIgnoredLabel(name) && !seenNames.has(name.toLowerCase())) {
          seenNames.add(name.toLowerCase());
          participants.push({
            displayName: name,
            isHost: false,
          });
        }
      }
    }

    return participants;
  }

  /**
   * Reads participants visible on the main video grid / tiles when panel is closed.
   */
  public static readGridParticipants(): ObservedParticipantRaw[] {
    const participants: ObservedParticipantRaw[] = [];
    const seenNames = new Set<string>();

    const tileNameElements = Array.from(
      document.querySelectorAll(
        "div[data-self-name], div[data-requested-participant-id] span, div[data-participant-id] span"
      )
    );

    for (const el of tileNameElements) {
      const name =
        el.getAttribute("data-self-name") ||
        el.getAttribute("title") ||
        el.textContent?.trim();

      if (
        name &&
        name.length > 1 &&
        !this.isIgnoredLabel(name) &&
        !seenNames.has(name.toLowerCase())
      ) {
        seenNames.add(name.toLowerCase());
        participants.push({
          displayName: name,
          isHost: false,
        });
      }
    }

    return participants;
  }

  /**
   * Takes a full observation snapshot of the Google Meet DOM.
   */
  public static captureSnapshot(): MeetObservationSnapshot {
    const isPeoplePanelOpen = this.isPeoplePanelOpen();
    const headerCount = this.extractHeaderCount();

    let participants: ObservedParticipantRaw[] = [];

    if (isPeoplePanelOpen) {
      participants = this.readPeoplePanelParticipants();
    } else {
      participants = this.readGridParticipants();
    }

    // Virtualization detection:
    // If header count indicates 25 people, but we only have 8 in DOM, virtualization is occurring
    const virtualizationDetected =
      isPeoplePanelOpen &&
      headerCount !== null &&
      headerCount > 2 &&
      participants.length < headerCount - 2;

    return {
      participants,
      headerCount,
      isPeoplePanelOpen,
      virtualizationDetected,
    };
  }

  private static parseParticipantItem(element: Element): ObservedParticipantRaw | null {
    // Check if this element contains a participant
    const nameEl =
      element.querySelector("span[title]") ||
      element.querySelector("span.zWGUib") ||
      element.querySelector("span[jsname]") ||
      element.querySelector("div[title]");

    const rawName = nameEl?.getAttribute("title") || nameEl?.textContent?.trim();
    if (!rawName || rawName.length < 2 || this.isIgnoredLabel(rawName)) {
      return null;
    }

    // Check for avatar
    const imgEl = element.querySelector("img[src*='googleusercontent.com']");
    const avatarUrl = imgEl ? (imgEl.getAttribute("src") || undefined) : undefined;

    // Check for host indicator
    const isHost =
      Boolean(element.querySelector("[aria-label*='host' i]")) ||
      element.textContent?.toLowerCase().includes("meeting host") === true;

    const rawId = element.getAttribute("data-participant-id") || undefined;

    return {
      rawId,
      displayName: rawName,
      avatarUrl,
      isHost,
    };
  }

  private static isIgnoredLabel(text: string): boolean {
    const lower = text.toLowerCase();
    const ignored = [
      "people",
      "chat",
      "activities",
      "host controls",
      "in call",
      "contributors",
      "search for people",
      "add people",
      "mute all",
      "meeting details",
      "turn on captions",
      "present now",
    ];
    return ignored.includes(lower);
  }
}
