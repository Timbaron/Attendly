import {
  AttendanceSession,
  DiagnosticRecord,
  MeetingAttendanceData,
  ObservedParticipantRaw,
  ParticipantAttendance,
} from "../types/attendance";
import { getCurrentIso } from "../utils/time";
import { resolveParticipantIdentity } from "./participant-identity";
import {
  calculateTotalParticipantDuration,
  evaluateEarlyDeparture,
  evaluateLateArrival,
  calculateAttendancePercentage,
} from "./attendance-calculator";

export interface ReconcileOptions {
  observedList: ObservedParticipantRaw[];
  headerCount: number | null;
  peoplePanelOpen: boolean;
  virtualizationDetected: boolean;
  currentTimeIso?: string;
}

export class SessionManager {
  // Map of participant ID -> consecutive missed observation counts
  private missedCounts: Map<string, number> = new Map();

  // Threshold of missed cycles before marking a participant departed (default 3 cycles = ~6 seconds)
  private readonly MISSED_CYCLES_THRESHOLD = 3;

  /**
   * Reconciles observed participants from Google Meet against the active session state.
   */
  public reconcile(
    data: MeetingAttendanceData,
    options: ReconcileOptions
  ): {
    updatedData: MeetingAttendanceData;
    newDiagnostics: DiagnosticRecord[];
  } {
    if (data.trackingState !== "tracking") {
      return { updatedData: data, newDiagnostics: [] };
    }

    const nowIso = options.currentTimeIso || getCurrentIso();
    const newDiagnostics: DiagnosticRecord[] = [];
    const participants: Record<string, ParticipantAttendance> = {
      ...data.participants,
    };

    // Pre-pass: Unify any duplicate "You" records with the self participant
    const youEntry = Object.values(participants).find(
      (p) => p.displayName.trim().toLowerCase() === "you"
    );
    const selfEntry = Object.values(participants).find(
      (p) =>
        p.isSelf ||
        (youEntry &&
          p.id !== youEntry.id &&
          options.observedList.some(
            (r) => r.isSelf && r.displayName.toLowerCase() === p.displayName.toLowerCase()
          ))
    );

    if (youEntry && selfEntry && youEntry.id !== selfEntry.id) {
      selfEntry.firstJoinedAt =
        new Date(youEntry.firstJoinedAt) < new Date(selfEntry.firstJoinedAt)
          ? youEntry.firstJoinedAt
          : selfEntry.firstJoinedAt;

      selfEntry.sessions = [...youEntry.sessions, ...selfEntry.sessions].sort(
        (a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
      );
      selfEntry.isSelf = true;
      delete participants[youEntry.id];
      this.missedCounts.delete(youEntry.id);
    }

    const seenIdsInThisCycle = new Set<string>();

    // 1. Process all currently observed participants
    for (const raw of options.observedList) {
      if (data.config.excludeHost && raw.isHost) {
        continue;
      }

      const {
        id,
        displayName,
        identityConfidence,
        collisionWarning,
      } = resolveParticipantIdentity(raw, participants);

      seenIdsInThisCycle.add(id);
      this.missedCounts.set(id, 0);

      if (collisionWarning) {
        newDiagnostics.push({
          id: `diag_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          timestamp: nowIso,
          severity: "warning",
          code: "IDENTITY_COLLISION",
          message: collisionWarning,
          details: { rawName: raw.displayName, assignedId: id },
        });
      }

      const existingRecord = participants[id];

      if (!existingRecord) {
        // Brand new participant joined
        const isLate = evaluateLateArrival(
          nowIso,
          data.trackingStartedAt,
          data.config.gracePeriodMinutes
        );

        const newSession: AttendanceSession = {
          id: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          joinedAt: nowIso,
          leftAt: null,
          durationMs: 0,
          confidence: options.peoplePanelOpen ? "observed" : "estimated",
        };

        const newRecord: ParticipantAttendance = {
          id,
          displayName,
          avatarUrl: raw.avatarUrl,
          firstJoinedAt: nowIso,
          lastLeftAt: null,
          totalDurationMs: 0,
          sessions: [newSession],
          status: "present",
          isLate,
          leftEarly: false,
          attendancePercentage: null,
          identityConfidence,
          isSelf: raw.isSelf,
        };

        participants[id] = newRecord;
      } else {
        // Existing participant
        if (existingRecord.status !== "present") {
          // Reconnection! Reopened attendance session
          const newSession: AttendanceSession = {
            id: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            joinedAt: nowIso,
            leftAt: null,
            durationMs: 0,
            confidence: options.peoplePanelOpen ? "observed" : "estimated",
          };

          existingRecord.status = "present";
          existingRecord.lastLeftAt = null;
          existingRecord.sessions = [...existingRecord.sessions, newSession];
        }

        // If previously named "You", upgrade to real display name
        if (
          existingRecord.displayName.toLowerCase() === "you" &&
          displayName.toLowerCase() !== "you"
        ) {
          existingRecord.displayName = displayName;
        }

        if (raw.isSelf) {
          existingRecord.isSelf = true;
        }

        // Update avatar if newly discovered
        if (raw.avatarUrl && !existingRecord.avatarUrl) {
          existingRecord.avatarUrl = raw.avatarUrl;
        }
      }
    }

    // 2. Process participants not seen in this cycle
    const allParticipantIds = Object.keys(participants);
    for (const id of allParticipantIds) {
      if (seenIdsInThisCycle.has(id)) continue;

      const p = participants[id];
      if (p.status !== "present") continue;

      const currentMissed = (this.missedCounts.get(id) || 0) + 1;
      this.missedCounts.set(id, currentMissed);

      // Confirm departure when missed for threshold cycles
      if (currentMissed >= this.MISSED_CYCLES_THRESHOLD) {
        p.status = "left";
        p.lastLeftAt = nowIso;

        // CRITICAL: Close active session so duration stops accumulating!
        const activeSession = p.sessions[p.sessions.length - 1];
        if (activeSession && activeSession.leftAt === null) {
          activeSession.leftAt = nowIso;
          activeSession.durationMs = Math.max(
            0,
            new Date(nowIso).getTime() - new Date(activeSession.joinedAt).getTime()
          );
        }

        // Evaluate early departure
        p.leftEarly = evaluateEarlyDeparture(
          p.lastLeftAt,
          p.status,
          data.trackingStartedAt,
          data.config.expectedDurationMinutes,
          data.config.earlyDepartureThresholdMinutes
        );
      }
    }

    // 3. Recompute durations and attendance percentages
    const referenceDurationMs = this.calculateReferenceDuration(data, nowIso);

    for (const id of Object.keys(participants)) {
      const p = participants[id];
      p.totalDurationMs = calculateTotalParticipantDuration(p.sessions, nowIso);
      p.attendancePercentage = calculateAttendancePercentage(
        p.totalDurationMs,
        referenceDurationMs
      );
    }

    // 4. Check for virtualization diagnostic
    if (options.virtualizationDetected && !data.virtualizationDetected) {
      newDiagnostics.push({
        id: `diag_virt_${Date.now()}`,
        timestamp: nowIso,
        severity: "warning",
        code: "LIST_VIRTUALIZED",
        message:
          "Google Meet is virtualizing the participant list. Please keep the People panel open and scroll to ensure all participants are captured.",
        details: {
          observedCount: options.observedList.length,
          headerCount: options.headerCount,
        },
      });
    }

    return {
      updatedData: {
        ...data,
        participants,
        lastObservedCount: options.observedList.length,
        virtualizationDetected: options.virtualizationDetected,
        peoplePanelOpen: options.peoplePanelOpen,
        diagnostics: [...data.diagnostics, ...newDiagnostics],
      },
      newDiagnostics,
    };
  }

  /**
   * Closes all active sessions when tracking is stopped or paused.
   */
  public closeAllOpenSessions(
    data: MeetingAttendanceData,
    nowIso: string,
    reason: "paused" | "stopped"
  ): MeetingAttendanceData {
    const participants: Record<string, ParticipantAttendance> = {};
    const referenceDurationMs = this.calculateReferenceDuration(data, nowIso);

    for (const [id, p] of Object.entries(data.participants)) {
      const updatedSessions = p.sessions.map((sess) => {
        if (sess.leftAt === null) {
          const duration =
            new Date(nowIso).getTime() - new Date(sess.joinedAt).getTime();
          return {
            ...sess,
            leftAt: nowIso,
            durationMs: Math.max(0, duration),
          };
        }
        return sess;
      });

      const totalDurationMs = calculateTotalParticipantDuration(
        updatedSessions,
        nowIso
      );

      participants[id] = {
        ...p,
        status: reason === "stopped" ? "left" : p.status,
        lastLeftAt: reason === "stopped" ? nowIso : p.lastLeftAt,
        sessions: updatedSessions,
        totalDurationMs,
        attendancePercentage: calculateAttendancePercentage(
          totalDurationMs,
          referenceDurationMs
        ),
      };
    }

    return {
      ...data,
      participants,
    };
  }

  /**
   * Resumes active sessions for participants present before pause.
   */
  public resumeOpenSessions(
    data: MeetingAttendanceData,
    resumedAtIso: string
  ): MeetingAttendanceData {
    const participants: Record<string, ParticipantAttendance> = {};

    for (const [id, p] of Object.entries(data.participants)) {
      if (p.status === "present") {
        const newSession: AttendanceSession = {
          id: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          joinedAt: resumedAtIso,
          leftAt: null,
          durationMs: 0,
          confidence: data.peoplePanelOpen ? "observed" : "estimated",
        };

        participants[id] = {
          ...p,
          sessions: [...p.sessions, newSession],
        };
      } else {
        participants[id] = p;
      }
    }

    return {
      ...data,
      participants,
    };
  }

  private calculateReferenceDuration(
    data: MeetingAttendanceData,
    nowIso: string
  ): number {
    if (data.config.expectedDurationMinutes) {
      return data.config.expectedDurationMinutes * 60 * 1000;
    }

    if (!data.trackingStartedAt) return 0;

    const startMs = new Date(data.trackingStartedAt).getTime();
    const endMs = data.trackingStoppedAt
      ? new Date(data.trackingStoppedAt).getTime()
      : new Date(nowIso).getTime();

    if (isNaN(startMs) || isNaN(endMs) || endMs < startMs) {
      return 0;
    }

    return Math.max(0, endMs - startMs - data.totalPausedDurationMs);
  }
}
