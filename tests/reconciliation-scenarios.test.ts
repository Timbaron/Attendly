import { describe, it, expect } from "vitest";
import {
  AttendanceEngine,
  createInitialMeetingData,
} from "../src/attendance/attendance-engine";
import {
  CANONICAL_LOCAL_USER_ID,
  consolidateAttendanceSessions,
  extractParticipantIdentityInfo,
  resolveParticipantIdentity,
} from "../src/attendance/participant-identity";
import { AttendanceSession, MeetingMetadata } from "../src/types/attendance";
import { generateCsvContent } from "../src/exports/csv-export";
import { generateExcelWorkbook } from "../src/exports/excel-export";
import { generatePdfDocument } from "../src/exports/pdf-export";

describe("Task 8: Complete 15 Verification & Regression Scenarios", () => {
  const meta: MeetingMetadata = {
    meetingCode: "abc-defg-hij",
    title: "All-Hands Sync",
    platform: "google-meet",
    url: "https://meet.google.com/abc-defg-hij",
  };

  // -------------------------------------------------------------------------
  // Scenario 1: Local user represented as "You"
  // -------------------------------------------------------------------------
  it("Scenario 1: Resolves local user represented as 'You' to canonical ID", () => {
    const res = resolveParticipantIdentity(
      { displayName: "You", isLocalUser: true },
      {}
    );
    expect(res.id).toBe(CANONICAL_LOCAL_USER_ID);
    expect(res.isLocalUser).toBe(true);
    expect(res.identityConfidence).toBe("high");
  });

  // -------------------------------------------------------------------------
  // Scenario 2: Local user represented by actual name
  // -------------------------------------------------------------------------
  it("Scenario 2: Resolves local user represented by their actual name", () => {
    const res = resolveParticipantIdentity(
      { displayName: "Timothy Akiode", isLocalUser: true },
      {}
    );
    expect(res.id).toBe(CANONICAL_LOCAL_USER_ID);
    expect(res.displayName).toBe("Timothy Akiode");
    expect(res.isLocalUser).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Scenario 3: Local user represented as "Name (You)"
  // -------------------------------------------------------------------------
  it("Scenario 3: Extracts clean name and resolves 'Timothy Akiode (You)' to canonical ID", () => {
    const info = extractParticipantIdentityInfo("Timothy Akiode (You)");
    expect(info.cleanName).toBe("Timothy Akiode");
    expect(info.isExplicitLocalUser).toBe(true);

    const res = resolveParticipantIdentity(
      { displayName: "Timothy Akiode (You)" },
      {}
    );
    expect(res.id).toBe(CANONICAL_LOCAL_USER_ID);
    expect(res.displayName).toBe("Timothy Akiode");
    expect(res.isLocalUser).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Scenario 4: Alternating local-user representations over multiple cycles
  // -------------------------------------------------------------------------
  it("Scenario 4: Handles alternating local-user representations across cycles without duplicates", () => {
    const engine = new AttendanceEngine(createInitialMeetingData(meta));
    engine.startTracking("2026-11-14T10:00:00.000Z");

    // Cycle 1: "You"
    engine.reconcileObservations({
      observedList: [{ displayName: "You", isLocalUser: true }],
      headerCount: 1,
      peoplePanelOpen: false,
      virtualizationDetected: false,
      currentTimeIso: "2026-11-14T10:00:00.000Z",
    });

    // Cycle 2: "Timothy Akiode (You)"
    engine.reconcileObservations({
      observedList: [{ displayName: "Timothy Akiode (You)" }],
      headerCount: 1,
      peoplePanelOpen: false,
      virtualizationDetected: false,
      currentTimeIso: "2026-11-14T10:00:02.000Z",
    });

    // Cycle 3: "Timothy Akiode" (isLocalUser flag passed from adapter)
    engine.reconcileObservations({
      observedList: [{ displayName: "Timothy Akiode", isLocalUser: true }],
      headerCount: 1,
      peoplePanelOpen: true,
      virtualizationDetected: false,
      currentTimeIso: "2026-11-14T10:00:04.000Z",
    });

    // Cycle 4: "You" again
    engine.reconcileObservations({
      observedList: [{ displayName: "You", isLocalUser: true }],
      headerCount: 1,
      peoplePanelOpen: false,
      virtualizationDetected: false,
      currentTimeIso: "2026-11-14T10:00:06.000Z",
    });

    // Must be exactly 1 participant in the session
    const participants = Object.values(engine.getData().participants);
    expect(participants.length).toBe(1);
    expect(participants[0].id).toBe(CANONICAL_LOCAL_USER_ID);
    expect(participants[0].displayName).toBe("Timothy Akiode");
    expect(participants[0].isLocalUser).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Scenario 5: Two different participants sharing a display name
  // -------------------------------------------------------------------------
  it("Scenario 5: Disambiguates two remote participants with identical display names", () => {
    const existing: Record<string, any> = {
      p_john_1: {
        id: "p_john_1",
        displayName: "John Smith",
        avatarUrl: "https://lh3.googleusercontent.com/avatar1",
        isLocalUser: false,
        identityConfidence: "high",
      },
    };

    // Another participant named John Smith joins with a different avatar
    const res = resolveParticipantIdentity(
      {
        displayName: "John Smith",
        avatarUrl: "https://lh3.googleusercontent.com/avatar2",
      },
      existing
    );

    expect(res.id).not.toBe("p_john_1");
    expect(res.displayName).toBe("John Smith (2)");
    expect(res.identityConfidence).toBe("low");
    expect(res.collisionWarning).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // Scenario 6: Opening and closing the People panel without false departures
  // -------------------------------------------------------------------------
  it("Scenario 6: Closing and reopening the People panel never triggers false departures", () => {
    const engine = new AttendanceEngine(createInitialMeetingData(meta));
    engine.startTracking("2026-11-14T10:00:00.000Z");

    // Start with People panel open, observing 3 participants
    engine.reconcileObservations({
      observedList: [
        { displayName: "Timothy Akiode", isLocalUser: true },
        { displayName: "Alice Wonderland" },
        { displayName: "Bob Builder" },
      ],
      headerCount: 3,
      peoplePanelOpen: true,
      virtualizationDetected: false,
      currentTimeIso: "2026-11-14T10:00:00.000Z",
    });

    expect(Object.values(engine.getData().participants).length).toBe(3);

    // People panel closes! Grid only renders Timothy and Alice (Bob is off-grid tile)
    // But headerCount remains 3!
    for (let i = 1; i <= 5; i++) {
      engine.reconcileObservations({
        observedList: [
          { displayName: "Timothy Akiode", isLocalUser: true },
          { displayName: "Alice Wonderland" },
        ],
        headerCount: 3, // header count still confirms 3 in call
        peoplePanelOpen: false,
        virtualizationDetected: false,
        currentTimeIso: `2026-11-14T10:00:0${i * 2}.000Z`,
      });
    }

    const participants = engine.getData().participants;
    const bob = Object.values(participants).find((p) => p.displayName === "Bob Builder");
    expect(bob).toBeDefined();
    // Bob must NOT be marked left because panel closed and count didn't drop!
    expect(bob?.status).not.toBe("left");

    // People panel reopens! Bob is visible again
    engine.reconcileObservations({
      observedList: [
        { displayName: "Timothy Akiode", isLocalUser: true },
        { displayName: "Alice Wonderland" },
        { displayName: "Bob Builder" },
      ],
      headerCount: 3,
      peoplePanelOpen: true,
      virtualizationDetected: false,
      currentTimeIso: "2026-11-14T10:00:15.000Z",
    });

    const bobReopened = Object.values(engine.getData().participants).find(
      (p) => p.displayName === "Bob Builder"
    );
    expect(bobReopened?.status).toBe("present");
  });

  // -------------------------------------------------------------------------
  // Scenario 7: Participant list rerendering / DOM shuffling
  // -------------------------------------------------------------------------
  it("Scenario 7: Prevents duplicate sessions during layout reshuffle", () => {
    const engine = new AttendanceEngine(createInitialMeetingData(meta));
    engine.startTracking("2026-11-14T10:00:00.000Z");

    // Cycle 1: Alice, Bob
    engine.reconcileObservations({
      observedList: [{ displayName: "Alice" }, { displayName: "Bob" }],
      headerCount: 2,
      peoplePanelOpen: true,
      virtualizationDetected: false,
      currentTimeIso: "2026-11-14T10:00:00.000Z",
    });

    // Cycle 2: DOM reshuffles order (Bob, Alice)
    engine.reconcileObservations({
      observedList: [{ displayName: "Bob" }, { displayName: "Alice" }],
      headerCount: 2,
      peoplePanelOpen: true,
      virtualizationDetected: false,
      currentTimeIso: "2026-11-14T10:00:02.000Z",
    });

    const list = Object.values(engine.getData().participants);
    expect(list.length).toBe(2);
    // Neither should have opened a duplicate session
    expect(list[0].sessions.length).toBe(1);
    expect(list[1].sessions.length).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Scenario 8: Temporary DOM removal (1-2 cycles)
  // -------------------------------------------------------------------------
  it("Scenario 8: Does not mark participant left when missing for only 1-2 cycles", () => {
    const engine = new AttendanceEngine(createInitialMeetingData(meta));
    engine.startTracking("2026-11-14T10:00:00.000Z");

    engine.reconcileObservations({
      observedList: [{ displayName: "Alice" }],
      headerCount: 1,
      peoplePanelOpen: true,
      virtualizationDetected: false,
      currentTimeIso: "2026-11-14T10:00:00.000Z",
    });

    // Alice missing for 1 cycle (e.g. pinned video transition)
    engine.reconcileObservations({
      observedList: [],
      headerCount: 1,
      peoplePanelOpen: true,
      virtualizationDetected: false,
      currentTimeIso: "2026-11-14T10:00:02.000Z",
    });

    let alice = Object.values(engine.getData().participants)[0];
    expect(alice.status).toBe("present"); // Still present, debouncing

    // Alice reappears on cycle 2
    engine.reconcileObservations({
      observedList: [{ displayName: "Alice" }],
      headerCount: 1,
      peoplePanelOpen: true,
      virtualizationDetected: false,
      currentTimeIso: "2026-11-14T10:00:04.000Z",
    });

    alice = Object.values(engine.getData().participants)[0];
    expect(alice.status).toBe("present");
    expect(alice.sessions.length).toBe(1); // Session was preserved without fragmentation
  });

  // -------------------------------------------------------------------------
  // Scenario 9: Genuine departure when reliably observable
  // -------------------------------------------------------------------------
  it("Scenario 9: Confirms departure when participant is absent for threshold cycles with corroborating evidence", () => {
    const engine = new AttendanceEngine(createInitialMeetingData(meta));
    engine.startTracking("2026-11-14T10:00:00.000Z");

    engine.reconcileObservations({
      observedList: [
        { displayName: "Timothy", isLocalUser: true },
        { displayName: "The ARK" },
      ],
      headerCount: 2,
      peoplePanelOpen: false,
      virtualizationDetected: false,
      currentTimeIso: "2026-11-14T10:00:00.000Z",
    });

    // ARK departs: headerCount drops to 1, ARK absent for 3 consecutive cycles
    for (let c = 1; c <= 3; c++) {
      engine.reconcileObservations({
        observedList: [{ displayName: "Timothy", isLocalUser: true }],
        headerCount: 1,
        peoplePanelOpen: false,
        virtualizationDetected: false,
        currentTimeIso: `2026-11-14T10:00:0${c * 2}.000Z`,
      });
    }

    const ark = Object.values(engine.getData().participants).find(
      (p) => p.displayName === "The ARK"
    );
    expect(ark).toBeDefined();
    expect(ark?.status).toBe("left");
    expect(ark?.confirmedLeftAt).toBe("2026-11-14T10:00:06.000Z");
    expect(ark?.sessions[0].leftAt).toBe("2026-11-14T10:00:06.000Z");
    expect(ark?.totalDurationMs).toBe(6000);
  });

  // -------------------------------------------------------------------------
  // Scenario 10: Reconnection after departure
  // -------------------------------------------------------------------------
  it("Scenario 10: Reconnection creates separate second interval and sums total duration", () => {
    const engine = new AttendanceEngine(createInitialMeetingData(meta));
    engine.startTracking("2026-11-14T10:00:00.000Z");

    // Session 1: 10:00 to 10:06 (6s)
    engine.reconcileObservations({
      observedList: [{ displayName: "The ARK" }],
      headerCount: 1,
      peoplePanelOpen: true,
      virtualizationDetected: false,
      currentTimeIso: "2026-11-14T10:00:00.000Z",
    });

    for (let c = 1; c <= 3; c++) {
      engine.reconcileObservations({
        observedList: [],
        headerCount: 0,
        peoplePanelOpen: true,
        virtualizationDetected: false,
        currentTimeIso: `2026-11-14T10:00:0${c * 2}.000Z`,
      });
    }

    const arkDeparted = Object.values(engine.getData().participants)[0];
    expect(arkDeparted.status).toBe("left");
    expect(arkDeparted.sessions.length).toBe(1);

    // Reconnection at 10:10:00 (4 minutes later)
    engine.reconcileObservations({
      observedList: [{ displayName: "The ARK" }],
      headerCount: 1,
      peoplePanelOpen: true,
      virtualizationDetected: false,
      currentTimeIso: "2026-11-14T10:10:00.000Z",
    });

    const arkReconnected = Object.values(engine.getData().participants)[0];
    expect(arkReconnected.status).toBe("present");
    expect(arkReconnected.sessions.length).toBe(2);
    expect(arkReconnected.sessions[1].joinedAt).toBe("2026-11-14T10:10:00.000Z");
  });

  // -------------------------------------------------------------------------
  // Scenario 11: Tracking started after participants already joined
  // -------------------------------------------------------------------------
  it("Scenario 11: Flags participants already present at start of tracking", () => {
    const engine = new AttendanceEngine(createInitialMeetingData(meta));
    // Meeting started earlier, tracking started at 10:15
    engine.startTracking("2026-11-14T10:15:00.000Z");

    engine.reconcileObservations({
      observedList: [
        { displayName: "Timothy Akiode", isLocalUser: true },
        { displayName: "Professor Oak" },
      ],
      headerCount: 2,
      peoplePanelOpen: true,
      virtualizationDetected: false,
      currentTimeIso: "2026-11-14T10:15:01.000Z",
    });

    const oak = Object.values(engine.getData().participants).find(
      (p) => p.displayName === "Professor Oak"
    );
    expect(oak?.presentAtTrackingStart).toBe(true);

    // Late participant joins at 10:30 (15 min after tracking started)
    engine.reconcileObservations({
      observedList: [
        { displayName: "Timothy Akiode", isLocalUser: true },
        { displayName: "Professor Oak" },
        { displayName: "Late Student" },
      ],
      headerCount: 3,
      peoplePanelOpen: true,
      virtualizationDetected: false,
      currentTimeIso: "2026-11-14T10:30:00.000Z",
    });

    const student = Object.values(engine.getData().participants).find(
      (p) => p.displayName === "Late Student"
    );
    expect(student?.presentAtTrackingStart).toBe(false);
    expect(student?.isLate).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Scenario 12: Duplicate observations in a single cycle
  // -------------------------------------------------------------------------
  it("Scenario 12: Deduplicates multiple observations within the same cycle", () => {
    const engine = new AttendanceEngine(createInitialMeetingData(meta));
    engine.startTracking("2026-11-14T10:00:00.000Z");

    // Grid reader accidentally produced duplicates in raw list
    engine.reconcileObservations({
      observedList: [
        { displayName: "Alice" },
        { displayName: "Alice" },
        { displayName: "Alice" },
      ],
      headerCount: 1,
      peoplePanelOpen: false,
      virtualizationDetected: false,
      currentTimeIso: "2026-11-14T10:00:00.000Z",
    });

    const participants = Object.values(engine.getData().participants);
    expect(participants.length).toBe(1);
    expect(participants[0].displayName).toBe("Alice");
  });

  // -------------------------------------------------------------------------
  // Scenario 13: Overlapping attendance intervals consolidation
  // -------------------------------------------------------------------------
  it("Scenario 13: Merges overlapping intervals without double-counting duration", () => {
    // Session 1: 10:00 to 10:10 (10 min)
    // Session 2: 10:05 to 10:15 (overlapping by 5 min)
    // Consolidated should be 10:00 to 10:15 (15 min, NOT 20 min)
    const rawSessions: AttendanceSession[] = [
      {
        id: "s1",
        joinedAt: "2026-11-14T10:00:00.000Z",
        leftAt: "2026-11-14T10:10:00.000Z",
        durationMs: 10 * 60 * 1000,
        confidence: "observed",
      },
      {
        id: "s2",
        joinedAt: "2026-11-14T10:05:00.000Z",
        leftAt: "2026-11-14T10:15:00.000Z",
        durationMs: 10 * 60 * 1000,
        confidence: "observed",
      },
    ];

    const consolidated = consolidateAttendanceSessions(rawSessions);
    expect(consolidated.length).toBe(1);
    expect(consolidated[0].joinedAt).toBe("2026-11-14T10:00:00.000Z");
    expect(consolidated[0].leftAt).toBe("2026-11-14T10:15:00.000Z");
    expect(consolidated[0].durationMs).toBe(15 * 60 * 1000);
  });

  // -------------------------------------------------------------------------
  // Scenario 14: Incomplete observation periods (Uncertain status)
  // -------------------------------------------------------------------------
  it("Scenario 14: Handles incomplete observation periods by marking unknown rather than fabricating departure", () => {
    const engine = new AttendanceEngine(createInitialMeetingData(meta));
    engine.startTracking("2026-11-14T10:00:00.000Z");

    engine.reconcileObservations({
      observedList: [
        { displayName: "Timothy", isLocalUser: true },
        { displayName: "Attendee X" },
      ],
      headerCount: 2,
      peoplePanelOpen: true,
      virtualizationDetected: false,
      currentTimeIso: "2026-11-14T10:00:00.000Z",
    });

    // Panel is closed, and Attendee X is not on the grid, BUT header count is still 2!
    for (let c = 1; c <= 7; c++) {
      engine.reconcileObservations({
        observedList: [{ displayName: "Timothy", isLocalUser: true }],
        headerCount: 2, // count proves 2 are still in call
        peoplePanelOpen: false,
        virtualizationDetected: false,
        currentTimeIso: `2026-11-14T10:00:0${c * 2}.000Z`,
      });
    }

    const attendeeX = Object.values(engine.getData().participants).find(
      (p) => p.displayName === "Attendee X"
    );
    expect(attendeeX).toBeDefined();
    expect(attendeeX?.status).toBe("unknown");
    // Active session should be closed with "estimated" confidence so time doesn't keep running
    expect(attendeeX?.sessions[0].confidence).toBe("estimated");
  });

  // -------------------------------------------------------------------------
  // Scenario 15: Corrected Excel, CSV, and PDF exports
  // -------------------------------------------------------------------------
  it("Scenario 15: Exports reflect canonical local user, present at start, and observation confidence", async () => {
    const engine = new AttendanceEngine(createInitialMeetingData(meta));
    engine.startTracking("2026-11-14T10:00:00.000Z");

    // Start with "You", then upgrade to "Timothy Akiode"
    engine.reconcileObservations({
      observedList: [{ displayName: "You", isLocalUser: true }],
      headerCount: 1,
      peoplePanelOpen: false,
      virtualizationDetected: false,
      currentTimeIso: "2026-11-14T10:00:00.000Z",
    });

    engine.reconcileObservations({
      observedList: [
        { displayName: "Timothy Akiode (You)" },
        { displayName: "Colleague B" },
      ],
      headerCount: 2,
      peoplePanelOpen: true,
      virtualizationDetected: false,
      currentTimeIso: "2026-11-14T10:05:00.000Z",
    });

    engine.stopTracking("2026-11-14T10:30:00.000Z");
    const data = engine.getData();

    // 1. CSV Verification
    const csv = generateCsvContent(data);
    expect(csv).toContain("Timothy Akiode");
    expect(csv).not.toContain(",You,");
    expect(csv).toContain("Present at Start");
    expect(csv).toContain("CONFIRMED");

    // 2. Excel Verification
    const workbook = await generateExcelWorkbook(data);
    const attendanceSheet = workbook.getWorksheet("Attendance");
    expect(attendanceSheet).toBeDefined();

    // Check rows count: 1 header + 2 participants = 3 rows
    expect(attendanceSheet?.rowCount).toBe(3);

    // 3. PDF Verification
    const pdf = generatePdfDocument(data);
    expect(pdf).toBeDefined();
  });
});
