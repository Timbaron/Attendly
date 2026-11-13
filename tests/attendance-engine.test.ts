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
});
