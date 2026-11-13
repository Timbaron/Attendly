import {
  AttendanceSession,
  ParticipantAttendance,
  ParticipantSummaryStats,
} from "../types/attendance";

/**
 * Calculates duration in milliseconds for an attendance interval.
 * Uses currentTimeIso if session.leftAt is null (session still open).
 */
export function calculateSessionDuration(
  session: AttendanceSession,
  currentTimeIso: string
): number {
  const start = new Date(session.joinedAt).getTime();
  const end = session.leftAt
    ? new Date(session.leftAt).getTime()
    : new Date(currentTimeIso).getTime();

  if (isNaN(start) || isNaN(end) || end < start) {
    return 0;
  }
  return end - start;
}

/**
 * Calculates the total attendance duration by summing all individual valid sessions.
 * Never calculates total duration as (lastLeftAt - firstJoinedAt).
 */
export function calculateTotalParticipantDuration(
  sessions: AttendanceSession[],
  currentTimeIso: string
): number {
  return sessions.reduce((total, session) => {
    return total + calculateSessionDuration(session, currentTimeIso);
  }, 0);
}

/**
 * Checks if a participant arrived late based on meeting tracking start and grace period.
 */
export function evaluateLateArrival(
  firstJoinedAtIso: string,
  trackingStartedAtIso: string | null,
  gracePeriodMinutes: number
): boolean {
  if (!trackingStartedAtIso) return false;
  const startMs = new Date(trackingStartedAtIso).getTime();
  const joinMs = new Date(firstJoinedAtIso).getTime();

  if (isNaN(startMs) || isNaN(joinMs)) return false;

  const graceMs = Math.max(0, gracePeriodMinutes) * 60 * 1000;
  return joinMs > startMs + graceMs;
}

/**
 * Checks if a participant departed early.
 * Only evaluated when an expected meeting duration or end time is available
 * and the participant is confirmed to have left.
 */
export function evaluateEarlyDeparture(
  lastLeftAtIso: string | null,
  status: "present" | "left" | "unknown",
  trackingStartedAtIso: string | null,
  expectedDurationMinutes: number | null,
  earlyDepartureThresholdMinutes: number
): boolean {
  if (
    status !== "left" ||
    !lastLeftAtIso ||
    !trackingStartedAtIso ||
    !expectedDurationMinutes ||
    expectedDurationMinutes <= 0
  ) {
    return false;
  }

  const startMs = new Date(trackingStartedAtIso).getTime();
  const leftMs = new Date(lastLeftAtIso).getTime();
  if (isNaN(startMs) || isNaN(leftMs)) return false;

  const expectedEndMs = startMs + expectedDurationMinutes * 60 * 1000;
  const thresholdMs = Math.max(0, earlyDepartureThresholdMinutes) * 60 * 1000;

  return leftMs < expectedEndMs - thresholdMs;
}

/**
 * Calculates attendance percentage:
 * (Total Attended Duration / Meeting Duration) * 100
 * Capped at 100%. Returns null if reference duration is unavailable or 0.
 */
export function calculateAttendancePercentage(
  totalDurationMs: number,
  referenceMeetingDurationMs: number
): number | null {
  if (
    isNaN(totalDurationMs) ||
    isNaN(referenceMeetingDurationMs) ||
    referenceMeetingDurationMs <= 0
  ) {
    return null;
  }
  const pct = (totalDurationMs / referenceMeetingDurationMs) * 100;
  return Math.min(100, Math.max(0, Math.round(pct * 10) / 10));
}

/**
 * Computes high-level attendance summary statistics across all participants.
 */
export function computeSummaryStats(
  participants: Record<string, ParticipantAttendance>,
  trackingStartedAtIso: string | null,
  trackingStoppedAtIso: string | null,
  totalPausedDurationMs: number,
  currentTimeIso: string
): ParticipantSummaryStats {
  const list = Object.values(participants);
  const totalUnique = list.length;

  let currentlyPresent = 0;
  let confirmedDeparted = 0;
  let unknownStatus = 0;
  let lateArrivals = 0;
  let earlyDepartures = 0;
  let totalRecordedDurationMs = 0;

  for (const p of list) {
    if (p.status === "present") currentlyPresent++;
    else if (p.status === "left") confirmedDeparted++;
    else unknownStatus++;

    if (p.isLate) lateArrivals++;
    if (p.leftEarly) earlyDepartures++;

    totalRecordedDurationMs += p.totalDurationMs;
  }

  const averageDurationMs =
    totalUnique > 0 ? Math.round(totalRecordedDurationMs / totalUnique) : 0;

  let elapsedTrackingMs = 0;
  if (trackingStartedAtIso) {
    const startMs = new Date(trackingStartedAtIso).getTime();
    const endMs = trackingStoppedAtIso
      ? new Date(trackingStoppedAtIso).getTime()
      : new Date(currentTimeIso).getTime();
    if (!isNaN(startMs) && !isNaN(endMs) && endMs > startMs) {
      elapsedTrackingMs = Math.max(0, endMs - startMs - totalPausedDurationMs);
    }
  }

  return {
    totalUnique,
    currentlyPresent,
    confirmedDeparted,
    unknownStatus,
    lateArrivals,
    earlyDepartures,
    averageDurationMs,
    elapsedTrackingMs,
  };
}
