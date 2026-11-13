import { describe, it, expect } from "vitest";
import {
  AttendanceEngine,
  createInitialMeetingData,
} from "../src/attendance/attendance-engine";
import {
  calculateAttendancePercentage,
  calculateTotalParticipantDuration,
  evaluateEarlyDeparture,
  evaluateLateArrival,
} from "../src/attendance/attendance-calculator";
import { resolveParticipantIdentity } from "../src/attendance/participant-identity";
import { AttendanceSession, MeetingMetadata } from "../src/types/attendance";

describe("Attendance Calculation Functions", () => {
  it("calculates session duration as sum of discrete intervals, NOT (lastLeft - firstJoin)", () => {
    // Participant:
    // Session 1: 9:00 AM - 9:20 AM (20 mins = 1,200,000 ms)
    // Session 2: 9:30 AM - 10:00 AM (30 mins = 1,800,000 ms)
    // Expected sum = 50 mins = 3,000,000 ms (NOT 60 mins)
    const sessions: AttendanceSession[] = [
      {
        id: "s1",
        joinedAt: "2026-11-13T09:00:00.000Z",
        leftAt: "2026-11-13T09:20:00.000Z",
        durationMs: 20 * 60 * 1000,
        confidence: "observed",
      },
      {
        id: "s2",
        joinedAt: "2026-11-13T09:30:00.000Z",
        leftAt: "2026-11-13T10:00:00.000Z",
        durationMs: 30 * 60 * 1000,
        confidence: "observed",
      },
    ];

    const total = calculateTotalParticipantDuration(
      sessions,
      "2026-11-13T10:00:00.000Z"
    );
    expect(total).toBe(50 * 60 * 1000); // exactly 50 minutes
  });

  it("evaluates late arrival correctly based on grace period", () => {
    const meetingStart = "2026-11-13T09:00:00.000Z";
    const gracePeriodMinutes = 10;

    // Joined at 9:05 -> on time
    expect(
      evaluateLateArrival(
        "2026-11-13T09:05:00.000Z",
        meetingStart,
        gracePeriodMinutes
      )
    ).toBe(false);

    // Joined at 9:10:00 -> on time
    expect(
      evaluateLateArrival(
        "2026-11-13T09:10:00.000Z",
        meetingStart,
        gracePeriodMinutes
      )
    ).toBe(false);

    // Joined at 9:15 -> late
    expect(
      evaluateLateArrival(
        "2026-11-13T09:15:00.000Z",
        meetingStart,
        gracePeriodMinutes
      )
    ).toBe(true);
  });

  it("evaluates early departure correctly", () => {
    const meetingStart = "2026-11-13T09:00:00.000Z";
    const expectedDurationMinutes = 60; // Expected end = 10:00 AM
    const thresholdMinutes = 5; // Left before 9:55 AM is early

    // Left at 9:40 AM -> early
    expect(
      evaluateEarlyDeparture(
        "2026-11-13T09:40:00.000Z",
        "left",
        meetingStart,
        expectedDurationMinutes,
        thresholdMinutes
      )
    ).toBe(true);

    // Left at 9:58 AM -> not early (within threshold)
    expect(
      evaluateEarlyDeparture(
        "2026-11-13T09:58:00.000Z",
        "left",
        meetingStart,
        expectedDurationMinutes,
        thresholdMinutes
      )
    ).toBe(false);

    // Still present -> not early
    expect(
      evaluateEarlyDeparture(
        null,
        "present",
        meetingStart,
        expectedDurationMinutes,
        thresholdMinutes
      )
    ).toBe(false);
  });

  it("calculates attendance percentage accurately and caps at 100%", () => {
    // 30 min in 60 min meeting = 50%
    expect(calculateAttendancePercentage(30 * 60000, 60 * 60000)).toBe(50);

    // 45 min in 60 min meeting = 75%
    expect(calculateAttendancePercentage(45 * 60000, 60 * 60000)).toBe(75);

    // 70 min in 60 min meeting (overtime) = capped at 100%
    expect(calculateAttendancePercentage(70 * 60000, 60 * 60000)).toBe(100);

    // Missing or invalid reference duration = null
    expect(calculateAttendancePercentage(30 * 60000, 0)).toBeNull();
  });
});

describe("Participant Identity Resolution", () => {
  it("resolves unique participant without collision", () => {
    const res = resolveParticipantIdentity(
      { displayName: "Alice Wonderland", avatarUrl: "avatar1.png" },
      {}
    );
    expect(res.displayName).toBe("Alice Wonderland");
    expect(res.identityConfidence).toBe("high");
    expect(res.isExisting).toBe(false);
  });

  it("disambiguates duplicate names and lowers confidence without silent merge", () => {
    const existing = {
      p1: {
        id: "p1",
        displayName: "John Smith",
        avatarUrl: "https://avatar.google.com/1",
        firstJoinedAt: "2026-11-13T09:00:00.000Z",
        lastLeftAt: null,
        totalDurationMs: 0,
        sessions: [],
        status: "present" as const,
        isLate: false,
        leftEarly: false,
        attendancePercentage: null,
        identityConfidence: "high" as const,
      },
    };

    // A second John Smith with a different avatar appears
    const res = resolveParticipantIdentity(
      { displayName: "John Smith", avatarUrl: "https://avatar.google.com/2" },
      existing
    );

    expect(res.displayName).toBe("John Smith (2)");
    expect(res.identityConfidence).toBe("low");
    expect(res.isExisting).toBe(false);
    expect(res.collisionWarning).toContain("Multiple participants detected");
  });
});

describe("Attendance Engine State Machine", () => {
  const dummyMeeting: MeetingMetadata = {
    meetingCode: "abc-defg-hij",
    title: "Project Review",
    platform: "google-meet",
    url: "https://meet.google.com/abc-defg-hij",
  };

  it("handles join, leave, rejoin, and paused intervals properly", () => {
    const data = createInitialMeetingData(dummyMeeting, {
      gracePeriodMinutes: 10,
      expectedDurationMinutes: 60,
    });
    const engine = new AttendanceEngine(data);

    // 1. Start tracking at 09:00
    engine.startTracking("2026-11-13T09:00:00.000Z");
    expect(engine.getData().trackingState).toBe("tracking");

    // 2. Participant joins at 09:02 (on time)
    engine.reconcileObservations({
      observedList: [{ displayName: "Bob Builder" }],
      headerCount: 1,
      peoplePanelOpen: true,
      virtualizationDetected: false,
      currentTimeIso: "2026-11-13T09:02:00.000Z",
    });

    const participants = engine.getData().participants;
    const bobKey = Object.keys(participants)[0];
    expect(bobKey).toBeDefined();
    expect(participants[bobKey].displayName).toBe("Bob Builder");
    expect(participants[bobKey].status).toBe("present");
    expect(participants[bobKey].isLate).toBe(false);
    expect(participants[bobKey].sessions.length).toBe(1);

    // 3. Pause tracking at 09:20
    engine.pauseTracking("2026-11-13T09:20:00.000Z");
    expect(engine.getData().trackingState).toBe("paused");
    // Session should be closed at 09:20 (20 - 2 = 18 mins = 1,080,000 ms)
    expect(engine.getData().participants[bobKey].sessions[0].leftAt).toBe(
      "2026-11-13T09:20:00.000Z"
    );
    expect(engine.getData().participants[bobKey].totalDurationMs).toBe(
      18 * 60 * 1000
    );

    // 4. Resume tracking at 09:30 (10 min paused gap)
    engine.resumeTracking("2026-11-13T09:30:00.000Z");
    expect(engine.getData().trackingState).toBe("tracking");
    expect(engine.getData().totalPausedDurationMs).toBe(10 * 60 * 1000);
    expect(engine.getData().participants[bobKey].sessions.length).toBe(2);

    // 5. Late participant joins at 09:35
    engine.reconcileObservations({
      observedList: [
        { displayName: "Bob Builder" },
        { displayName: "Charlie Brown" },
      ],
      headerCount: 2,
      peoplePanelOpen: true,
      virtualizationDetected: false,
      currentTimeIso: "2026-11-13T09:35:00.000Z",
    });

    const all = engine.getData().participants;
    const charlie = Object.values(all).find(
      (p) => p.displayName === "Charlie Brown"
    );
    expect(charlie).toBeDefined();
    expect(charlie?.isLate).toBe(true); // Joined at 9:35, start was 9:00, grace was 10 min

    // 6. Stop tracking at 10:00
    engine.stopTracking("2026-11-13T10:00:00.000Z");
    expect(engine.getData().trackingState).toBe("stopped");

    // Bob: session 1 (9:02 - 9:20 = 18 min) + session 2 (9:30 - 10:00 = 30 min) = 48 mins total
    const bobAfterStop = engine.getData().participants[bobKey];
    expect(bobAfterStop.status).toBe("left");
    expect(bobAfterStop.totalDurationMs).toBe(48 * 60 * 1000);

    // Summary stats
    const stats = engine.getSummaryStats();
    expect(stats.totalUnique).toBe(2);
    expect(stats.lateArrivals).toBe(1);
  });

  it("unifies a participant initially detected as 'You' with user's real name and stops duration on departure", () => {
    const meta: MeetingMetadata = {
      meetingCode: "beq-yweg-pje",
      title: "Team Call",
      platform: "google-meet",
      url: "https://meet.google.com/meet/beq-yweg-pje",
    };

    const initialData = createInitialMeetingData(meta, {
      gracePeriodMinutes: 10,
      expectedDurationMinutes: 60,
      earlyDepartureThresholdMinutes: 5,
      attendancePercentageThreshold: 75,
      excludeHost: false,
      timeFormat: "12h",
      theme: "system",
    });

    const engine = new AttendanceEngine(initialData);
    engine.startTracking("2026-11-13T12:00:00.000Z");

    // 1. Initial frame: User alone, detected as "You"
    engine.reconcileObservations({
      observedList: [{ displayName: "You", isSelf: true }],
      headerCount: 1,
      peoplePanelOpen: false,
      virtualizationDetected: false,
      currentTimeIso: "2026-11-13T12:00:00.000Z",
    });

    expect(Object.keys(engine.getData().participants).length).toBe(1);
    expect(Object.values(engine.getData().participants)[0].displayName).toBe("You");

    // 2. Next frame: The ARK joins, user's real name "Akiode Timothy" is resolved
    engine.reconcileObservations({
      observedList: [
        { displayName: "Akiode Timothy", isSelf: true },
        { displayName: "The ARK", isSelf: false },
      ],
      headerCount: 2,
      peoplePanelOpen: false,
      virtualizationDetected: false,
      currentTimeIso: "2026-11-13T12:01:00.000Z",
    });

    // Should NOT have 3 attendees! Exactly 2 attendees: "Akiode Timothy" and "The ARK"
    const participants = Object.values(engine.getData().participants);
    expect(participants.length).toBe(2);

    const timothy = participants.find((p) => p.displayName === "Akiode Timothy");
    const ark = participants.find((p) => p.displayName === "The ARK");
    expect(timothy).toBeDefined();
    expect(ark).toBeDefined();

    // Timothy's firstJoinedAt should be the original 12:00:00 start
    expect(timothy?.firstJoinedAt).toBe("2026-11-13T12:00:00.000Z");

    // 3. The ARK leaves: missing for 3 consecutive reconciliation cycles
    // Cycle 1 missing
    engine.reconcileObservations({
      observedList: [{ displayName: "Akiode Timothy", isSelf: true }],
      headerCount: 1,
      peoplePanelOpen: false,
      virtualizationDetected: false,
      currentTimeIso: "2026-11-13T12:02:00.000Z",
    });
    // Cycle 2 missing
    engine.reconcileObservations({
      observedList: [{ displayName: "Akiode Timothy", isSelf: true }],
      headerCount: 1,
      peoplePanelOpen: false,
      virtualizationDetected: false,
      currentTimeIso: "2026-11-13T12:02:02.000Z",
    });
    // Cycle 3 missing (threshold reached at 12:02:04)
    engine.reconcileObservations({
      observedList: [{ displayName: "Akiode Timothy", isSelf: true }],
      headerCount: 1,
      peoplePanelOpen: false,
      virtualizationDetected: false,
      currentTimeIso: "2026-11-13T12:02:04.000Z",
    });

    const updatedArk = engine.getData().participants[ark!.id];
    // ARK must be marked 'left'
    expect(updatedArk.status).toBe("left");
    expect(updatedArk.lastLeftAt).toBe("2026-11-13T12:02:04.000Z");

    // ARK's active session must be closed, duration locked at 64 seconds
    expect(updatedArk.sessions[0].leftAt).toBe("2026-11-13T12:02:04.000Z");
    expect(updatedArk.totalDurationMs).toBe(64 * 1000);

    // Summary stats
    const stats = engine.getSummaryStats();
    expect(stats.totalUnique).toBe(2);
    expect(stats.currentlyPresent).toBe(1);
    expect(stats.confirmedDeparted).toBe(1);
  });
});
