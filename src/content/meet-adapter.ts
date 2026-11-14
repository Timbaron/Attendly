import { ObservedParticipantRaw } from "../types/attendance";

export interface MeetObservationSnapshot {
  participants: ObservedParticipantRaw[];
  headerCount: number | null;
  isPeoplePanelOpen: boolean;
  virtualizationDetected: boolean;
}

export class MeetAdapter {
  /**
   * Validates whether a text string represents an actual participant name
   * rather than a Google Meet UI control, button, or Material Symbol ligature.
   */
  public static isValidParticipantName(name: string | null | undefined, el?: Element): boolean {
    if (!name || typeof name !== "string") return false;
    const clean = name.trim();
    if (clean.length < 2 || clean.length > 70) return false;

    // Check if element is inside a button, control, or icon
    if (el) {
      if (
        el.closest(
          "button, [role='button'], [role='menuitem'], [role='tab'], [role='tooltip'], [aria-haspopup], [aria-hidden='true']"
        )
      ) {
        return false;
      }
      if (
        el.closest(
          ".google-material-icons, .material-icons, .google-symbols, .material-symbols-outlined, i, svg, [class*='icon' i], [class*='symbol' i]"
        )
      ) {
        return false;
      }
    }

    const lower = clean.toLowerCase();

    // Reject Material symbol ligatures that contain underscores (e.g. frame_person, visual_effects, etc.)
    if (lower.includes("_")) {
      return false;
    }

    // Reject timestamps/durations (e.g. "12:34", "0:00")
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(clean)) {
      return false;
    }

    // Common UI buttons and controls in Google Meet
    const bannedKeywords = [
      "reframe",
      "frame_person",
      "visual_effects",
      "background",
      "effects",
      "more options",
      "turn on captions",
      "turn off",
      "mute",
      "unmute",
      "camera",
      "microphone",
      "share screen",
      "present now",
      "raise hand",
      "send a message",
      "host controls",
      "meeting details",
      "ready to join",
      "ask to join",
      "join now",
      "switch camera",
      "settings",
      "people",
      "chat",
      "activities",
      "in call",
      "pin to screen",
      "unpin",
      "blur",
      "check audio",
      "more_vert",
      "mic_off",
      "videocam_off",
      "call_end",
      "volume_off",
    ];

    for (const kw of bannedKeywords) {
      if (lower === kw || lower.startsWith(kw + " ") || lower.endsWith(" " + kw)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Checks whether the People / Participants panel is open.
   */
  public static isPeoplePanelOpen(): boolean {
    const peopleBtn =
      document.querySelector("button[aria-label*='people' i][aria-pressed='true']") ||
      document.querySelector("button[aria-label*='show everyone' i][aria-pressed='true']") ||
      document.querySelector("button[aria-label*='everyone' i][aria-pressed='true']") ||
      document.querySelector("button[data-panel-id='1'][aria-pressed='true']");

    if (peopleBtn) return true;

    const panel =
      document.querySelector("div[role='tabpanel'][aria-label*='people' i]") ||
      document.querySelector("div[role='tabpanel'][aria-label*='participant' i]") ||
      document.querySelector("div[data-panel-id='1']");

    if (panel && panel.getBoundingClientRect().width > 0) {
      return true;
    }

    const participantList = document.querySelector("div[aria-label*='participants' i]");
    if (participantList && participantList.getBoundingClientRect().width > 0) {
      return true;
    }

    return false;
  }

  /**
   * Extracts the current user's display name from Google Account profile or self tile.
   */
  public static getSelfName(): string {
    // 1. Google Account profile button at top-right (most reliable and early)
    const accountEl =
      document.querySelector("[aria-label*='Google Account:' i]") ||
      document.querySelector("a[aria-label*='Google Account' i]") ||
      document.querySelector("button[aria-label*='Google Account' i]");

    if (accountEl) {
      const aria = accountEl.getAttribute("aria-label") || "";
      const match = aria.match(/Google Account:\s*([^\n\r(]+)/i);
      if (match && match[1]) {
        const candidate = match[1].trim();
        if (this.isValidParticipantName(candidate)) {
          return candidate;
        }
      }
    }

    // 2. Meet explicit data attributes
    const candidates = [
      document.querySelector("[data-self-name]")?.getAttribute("data-self-name"),
      document.querySelector("div[data-user-name]")?.getAttribute("data-user-name"),
      document.querySelector("[data-requested-participant-id*='self']")?.getAttribute("data-name"),
    ];

    for (const name of candidates) {
      if (name && this.isValidParticipantName(name)) {
        return name.replace(/\s*\((you|host)\)\s*/gi, "").trim();
      }
    }

    // 3. Check for any video tile or badge containing (You)
    const elementsWithYou = Array.from(
      document.querySelectorAll(
        "div[data-participant-id] span.zWGUib, div[data-participant-id] div.NWp9Yd, span.zWGUib, div.NWp9Yd"
      )
    );
    for (const el of elementsWithYou) {
      const text = el.textContent?.trim();
      if (text && /\((you)\)/i.test(text)) {
        const cleaned = text.replace(/\s*\((you|host)\)\s*/gi, "").trim();
        if (this.isValidParticipantName(cleaned, el)) {
          return cleaned;
        }
      }
    }

    return "You";
  }

  /**
   * Extracts the total participant count from Meet UI badges or tabs.
   */
  public static extractHeaderCount(): number | null {
    const candidates = [
      document.querySelector("button[aria-label*='show everyone' i]"),
      document.querySelector("button[aria-label*='people' i]"),
      document.querySelector("button[data-panel-id='1']"),
      document.querySelector("div[aria-label*='people' i]"),
      document.querySelector("div[role='tab'][aria-label*='people' i]"),
      document.querySelector("[data-participant-count]"),
    ];

    for (const el of candidates) {
      if (!el) continue;

      // 1. Check data-participant-count attribute
      const attrCount = el.getAttribute("data-participant-count");
      if (attrCount) {
        const c = parseInt(attrCount, 10);
        if (!isNaN(c) && c > 0) return c;
      }

      // 2. Check aria-label and text
      const aria = el.getAttribute("aria-label") || "";
      const text = el.textContent || "";
      const combined = `${aria} ${text}`;

      // Match "(1)" or "People (1)" or "(12)"
      const parenMatch = combined.match(/\((\d+)\)/);
      if (parenMatch) {
        const c = parseInt(parenMatch[1], 10);
        if (!isNaN(c) && c > 0) return c;
      }

      // Match "1 person", "2 people", "5 participants"
      const wordMatch = combined.match(/\b(\d+)\s*(people|participants|person)\b/i);
      if (wordMatch) {
        const c = parseInt(wordMatch[1], 10);
        if (!isNaN(c) && c > 0) return c;
      }

      // 3. Check child badge elements (often an isolated number inside span/div)
      const badges = Array.from(el.querySelectorAll("span, div"));
      for (const badge of badges) {
        const badgeText = badge.textContent?.trim();
        if (badgeText && /^\d+$/.test(badgeText)) {
          const c = parseInt(badgeText, 10);
          if (!isNaN(c) && c > 0) return c;
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
    const selfName = this.getSelfName();

    const items = Array.from(
      document.querySelectorAll(
        "div[role='listitem'], div[role='list'] > div, div[data-participant-id]"
      )
    );

    for (const item of items) {
      const parsed = this.parseParticipantItem(item);
      if (parsed) {
        const isSelf = /\((you)\)/i.test(parsed.displayName);
        const cleanName = parsed.displayName.replace(/\s*\((you|host)\)\s*/gi, "").trim();
        parsed.displayName = cleanName;
        const isLocal = isSelf || (selfName !== "You" && cleanName.toLowerCase() === selfName.toLowerCase());
        parsed.isSelf = isLocal;
        parsed.isLocalUser = isLocal;

        if (!seenNames.has(cleanName.toLowerCase())) {
          seenNames.add(cleanName.toLowerCase());
          participants.push(parsed);
        }
      }
    }

    if (participants.length === 0) {
      const nameContainers = Array.from(
        document.querySelectorAll(
          "span.zWGUib, span[jsname='W297wb'], div[jsname='base'] span"
        )
      );

      for (const span of nameContainers) {
        const rawName = span.textContent?.trim();
        if (rawName && this.isValidParticipantName(rawName, span)) {
          const isSelf = /\((you)\)/i.test(rawName);
          const cleanName = rawName.replace(/\s*\((you|host)\)\s*/gi, "").trim();
          const isLocal = isSelf || (selfName !== "You" && cleanName.toLowerCase() === selfName.toLowerCase());
          if (cleanName && !seenNames.has(cleanName.toLowerCase())) {
            seenNames.add(cleanName.toLowerCase());
            participants.push({
              displayName: cleanName,
              isHost: false,
              isSelf: isLocal,
              isLocalUser: isLocal,
            });
          }
        }
      }
    }

    return participants;
  }

  /**
   * Reads participants visible on the main video grid when the People panel is closed.
   */
  public static readGridParticipants(): ObservedParticipantRaw[] {
    const participants: ObservedParticipantRaw[] = [];
    const seenNames = new Set<string>();
    const selfName = this.getSelfName();

    // Target name badge selectors on video tiles
    const targetSelectors = [
      "div[data-requested-participant-id] span.zWGUib",
      "div[data-participant-id] span.zWGUib",
      "div[data-requested-participant-id] div.NWp9Yd",
      "div[data-participant-id] div.NWp9Yd",
      "div[data-requested-participant-id] div.jT5rCe",
      "div[data-participant-id] div.jT5rCe",
      "div[data-requested-participant-id] div[data-name]",
      "div[data-participant-id] div[data-name]",
      "div[data-participant-id] span.dwLVNd",
    ];

    const elements = Array.from(document.querySelectorAll(targetSelectors.join(", ")));

    for (const el of elements) {
      const rawText = el.getAttribute("data-name") || el.getAttribute("title") || el.textContent?.trim();
      if (!rawText) continue;

      const isSelf = /\((you)\)/i.test(rawText);
      const cleanName = rawText.replace(/\s*\((you|host)\)\s*/gi, "").trim();
      const isLocal = isSelf || (selfName !== "You" && cleanName.toLowerCase() === selfName.toLowerCase());

      if (cleanName && this.isValidParticipantName(cleanName, el) && !seenNames.has(cleanName.toLowerCase())) {
        seenNames.add(cleanName.toLowerCase());

        const tile = el.closest("div[data-participant-id], div[data-requested-participant-id]");
        const imgEl = tile?.querySelector("img[src*='googleusercontent.com']");
        const avatarUrl = imgEl ? (imgEl.getAttribute("src") || undefined) : undefined;

        participants.push({
          displayName: cleanName,
          avatarUrl,
          isHost: false,
          isSelf: isLocal,
          isLocalUser: isLocal,
        });
      }
    }

    // Ensure self is included if grid didn't capture self yet
    const hasSelf = participants.some((p) => p.isSelf || (selfName !== "You" && p.displayName.toLowerCase() === selfName.toLowerCase()));
    if (!hasSelf && selfName) {
      if (!seenNames.has(selfName.toLowerCase())) {
        seenNames.add(selfName.toLowerCase());
        participants.push({
          displayName: selfName,
          isHost: false,
          isSelf: true,
          isLocalUser: true,
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

    // Correlation with official Meet header count badge:
    if (headerCount === 1) {
      // Exactly 1 person in the meeting: it's the current user!
      const selfName = this.getSelfName();
      participants = [{ displayName: selfName, isHost: false, isSelf: true, isLocalUser: true }];
    } else if (headerCount !== null && headerCount > 0 && participants.length > headerCount) {
      participants = participants.slice(0, headerCount);
    }

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
    const nameEl =
      element.querySelector("span[title]") ||
      element.querySelector("span.zWGUib") ||
      element.querySelector("span[jsname]") ||
      element.querySelector("div[title]");

    const rawName = nameEl?.getAttribute("title") || nameEl?.textContent?.trim();
    if (!rawName || !this.isValidParticipantName(rawName, element)) {
      return null;
    }

    const imgEl = element.querySelector("img[src*='googleusercontent.com']");
    const avatarUrl = imgEl ? (imgEl.getAttribute("src") || undefined) : undefined;

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
}
