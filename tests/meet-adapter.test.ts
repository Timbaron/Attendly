import { describe, it, expect, beforeEach } from "vitest";
import { MeetAdapter } from "../src/content/meet-adapter";

describe("MeetAdapter Participant & Control Detection", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  describe("isValidParticipantName", () => {
    it("should accept valid human names", () => {
      expect(MeetAdapter.isValidParticipantName("Timothy Akiode")).toBe(true);
      expect(MeetAdapter.isValidParticipantName("Jane Doe")).toBe(true);
      expect(MeetAdapter.isValidParticipantName("Dr. Sarah Connor, PhD")).toBe(true);
      expect(MeetAdapter.isValidParticipantName("Jean-Luc Picard")).toBe(true);
    });

    it("should reject Material Symbol ligatures with underscores", () => {
      expect(MeetAdapter.isValidParticipantName("frame_person")).toBe(false);
      expect(MeetAdapter.isValidParticipantName("frame_personReframe")).toBe(false);
      expect(MeetAdapter.isValidParticipantName("visual_effects")).toBe(false);
      expect(MeetAdapter.isValidParticipantName("visual_effectsBackgrounds and effects")).toBe(false);
      expect(MeetAdapter.isValidParticipantName("mic_off")).toBe(false);
      expect(MeetAdapter.isValidParticipantName("videocam_off")).toBe(false);
    });

    it("should reject Google Meet UI control labels and keywords", () => {
      expect(MeetAdapter.isValidParticipantName("reframe")).toBe(false);
      expect(MeetAdapter.isValidParticipantName("Turn on captions")).toBe(false);
      expect(MeetAdapter.isValidParticipantName("Present now")).toBe(false);
      expect(MeetAdapter.isValidParticipantName("Raise hand")).toBe(false);
      expect(MeetAdapter.isValidParticipantName("People")).toBe(false);
      expect(MeetAdapter.isValidParticipantName("Chat")).toBe(false);
      expect(MeetAdapter.isValidParticipantName("Activities")).toBe(false);
      expect(MeetAdapter.isValidParticipantName("Settings")).toBe(false);
      expect(MeetAdapter.isValidParticipantName("12:34")).toBe(false);
    });

    it("should reject elements that are inside buttons or icons", () => {
      const button = document.createElement("button");
      const iconSpan = document.createElement("span");
      iconSpan.className = "material-icons";
      iconSpan.textContent = "John Doe"; // even if text happens to be a name
      button.appendChild(iconSpan);
      document.body.appendChild(button);

      expect(MeetAdapter.isValidParticipantName("John Doe", iconSpan)).toBe(false);
    });
  });

  describe("extractHeaderCount", () => {
    it("should extract count from parenthesized aria-label", () => {
      const btn = document.createElement("button");
      btn.setAttribute("aria-label", "Show everyone (1)");
      document.body.appendChild(btn);

      expect(MeetAdapter.extractHeaderCount()).toBe(1);
    });

    it("should extract count from people badge number", () => {
      const btn = document.createElement("button");
      btn.setAttribute("aria-label", "People");
      const badge = document.createElement("span");
      badge.textContent = "5";
      btn.appendChild(badge);
      document.body.appendChild(btn);

      expect(MeetAdapter.extractHeaderCount()).toBe(5);
    });

    it("should extract count from data-participant-count attribute", () => {
      const div = document.createElement("div");
      div.setAttribute("data-participant-count", "12");
      document.body.appendChild(div);

      expect(MeetAdapter.extractHeaderCount()).toBe(12);
    });
  });

  describe("Single attendee isolation", () => {
    it("should strictly report 1 participant when header count is 1", () => {
      // Simulate Google Meet when alone in call
      const selfTile = document.createElement("div");
      selfTile.setAttribute("data-self-name", "Timothy Akiode");
      document.body.appendChild(selfTile);

      const peopleBtn = document.createElement("button");
      peopleBtn.setAttribute("aria-label", "People (1)");
      document.body.appendChild(peopleBtn);

      const snapshot = MeetAdapter.captureSnapshot();
      expect(snapshot.headerCount).toBe(1);
      expect(snapshot.participants).toHaveLength(1);
      expect(snapshot.participants[0].displayName).toBe("Timothy Akiode");
    });
  });
});
