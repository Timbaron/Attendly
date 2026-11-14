import {
  AttendanceSession,
  DiagnosticRecord,
  MeetingAttendanceData,
  ObservedParticipantRaw,
  ParticipantAttendance,
} from "../types/attendance";
import { getCurrentIso } from "../utils/time";
import {
  CANONICAL_LOCAL_USER_ID,
  consolidateAttendanceSessions,
  resolveParticipantIdentity,
} from "./participant-identity";
import {
  calculateTotalParticipantDuration,
  evaluateEarlyDeparture,
  evaluateLateArrival,
  calculateAttendancePercentage,
} from "./attendance-calculator";
import { AttendlyLogger } from "../utils/logger";

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

  // Threshold of missed cycles before confirming departure (default 3 cycles = ~6 seconds)
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

    const canonicalLocalId = data.localUserCanonicalId || CANONICAL_LOCAL_USER_ID;

    // =========================================================================
    // PRE-PASS: Consolidate any duplicate local user records
    // =========================================================================
    const localUserRecords = Object.values(participants).filter(
      (p) =>
        p.isLocalUser ||
        p.id === canonicalLocalId ||
        p.displayName.trim().toLowerCase() === "you"
    );

    if (localUserRecords.length > 1) {
      // Prefer record with real name, or canonical ID
      const primary =
        localUserRecords.find((p) => p.displayName.trim().toLowerCase() !== "you") ||
        localUserRecords.find((p) => p.id === canonicalLocalId) ||
        localUserRecords[0];

      for (const other of localUserRecords) {
        if (other.id === primary.id) continue;

        primary.firstJoinedAt =
          new Date(other.firstJoinedAt) < new Date(primary.firstJoinedAt)
            ? other.firstJoinedAt
            : primary.firstJoinedAt;

        if (other.presentAtTrackingStart) {
          primary.presentAtTrackingStart = true;
        }

        primary.sessions = consolidateAttendanceSessions(
          [...primary.sessions, ...other.sessions],
          nowIso
        );

        delete participants[other.id];
        this.missedCounts.delete(other.id);
      }
      primary.isLocalUser = true;
    }

    const seenIdsInThisCycle = new Set<string>();

    // Determine if this cycle is right around tracking start
    const isAtTrackingStart =
      data.trackingStartedAt &&
      Math.abs(new Date(nowIso).getTime() - new Date(data.trackingStartedAt).getTime()) < 10000;

    // =========================================================================
    // 1. Process all currently observed participants
    // =========================================================================
    for (const raw of options.observedList) {
      if (data.config.excludeHost && raw.isHost) {
        continue;
      }

      const {
        id,
        displayName,
        identityConfidence,
        collisionWarning,
        isLocalUser,
      } = resolveParticipantIdentity(raw, participants, canonicalLocalId);

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
        // Brand new participant
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
          firstObservedAt: nowIso,
          lastObservedAt: nowIso,
          lastLeftAt: null,
          confirmedLeftAt: null,
          totalDurationMs: 0,
          sessions: [newSession],
          status: "present",
          isLate,
          leftEarly: false,
          attendancePercentage: null,
          identityConfidence,
          isLocalUser,
          isSelf: isLocalUser,
          presentAtTrackingStart: Boolean(isAtTrackingStart),
        };

        participants[id] = newRecord;
        AttendlyLogger.logStateTransition(id, displayName, "NONE", "PRESENT", "New participant joined");
      } else {
        // Existing participant
        existingRecord.lastObservedAt = nowIso;

        if (existingRecord.status !== "present") {
          // Reconnection! Reopened attendance session
          const newSession: AttendanceSession = {
            id: `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            joinedAt: nowIso,
            leftAt: null,
            durationMs: 0,
            confidence: options.peoplePanelOpen ? "observed" : "estimated",
          };

          const prevStatus = existingRecord.status;
          existingRecord.status = "present";
          existingRecord.lastLeftAt = null;
          existingRecord.confirmedLeftAt = null;
          existingRecord.sessions = consolidateAttendanceSessions(
            [...existingRecord.sessions, newSession],
            nowIso
          );

          AttendlyLogger.logStateTransition(
            id,
            existingRecord.displayName,
            prevStatus,
            "PRESENT",
            "Reconnection"
          );
        }

        // If previously named "You", upgrade to real display name
        if (
          existingRecord.displayName.toLowerCase() === "you" &&
          displayName.toLowerCase() !== "you"
        ) {
          existingRecord.displayName = displayName;
        }

        if (isLocalUser) {
          existingRecord.isLocalUser = true;
          existingRecord.isSelf = true;
        }

        // Update avatar if newly discovered
        if (raw.avatarUrl && !existingRecord.avatarUrl) {
          existingRecord.avatarUrl = raw.avatarUrl;
        }
      }
    }

    // =========================================================================
    // 2. Process participants not seen in this cycle
    // =========================================================================
    const currentlyPresentCount = Object.values(participants).filter(
      (p) => p.status === "present"
    ).length;

    const allParticipantIds = Object.keys(participants);
    for (const id of allParticipantIds) {
      if (seenIdsInThisCycle.has(id)) continue;

      const p = participants[id];
      if (p.status !== "present") continue;

      const currentMissed = (this.missedCounts.get(id) || 0) + 1;
      this.missedCounts.set(id, currentMissed);

      // Evaluate departure:
      // Case A: People panel is open (full roster visible) and participant missing for threshold cycles
      // Case B: People panel is closed BUT official headerCount indicates a drop below current present count
      const isConfirmedDeparture =
        (options.peoplePanelOpen && !options.virtualizationDetected && currentMissed >= this.MISSED_CYCLES_THRESHOLD) ||
        (!options.peoplePanelOpen &&
          options.headerCount !== null &&
          options.headerCount < currentlyPresentCount &&
          currentMissed >= this.MISSED_CYCLES_THRESHOLD);

      if (isConfirmedDeparture) {
        const prevStatus = p.status;
        p.status = "left";
        p.lastLeftAt = nowIso;
        p.confirmedLeftAt = nowIso;

        // Close active session
        const activeSession = p.sessions[p.sessions.length - 1];
        if (activeSession && activeSession.leftAt === null) {
          activeSession.leftAt = nowIso;
          activeSession.confidence = "observed";
          activeSession.durationMs = Math.max(
            0,
            new Date(nowIso).getTime() - new Date(activeSession.joinedAt).getTime()
          );
        }

        p.leftEarly = evaluateEarlyDeparture(
          p.lastLeftAt,
          p.status,
          data.trackingStartedAt,
          data.config.expectedDurationMinutes,
          data.config.earlyDepartureThresholdMinutes
        );

        AttendlyLogger.logStateTransition(
          p.id,
          p.displayName,
          prevStatus,
          "LEFT",
          options.peoplePanelOpen ? "People panel verified absence" : "Header count drop confirmed departure"
        );
      } else if (!options.peoplePanelOpen && currentMissed >= this.MISSED_CYCLES_THRESHOLD * 2) {
        // Missing from video grid while People panel is closed and header count did NOT drop.
        // DO NOT fabricate departure! Mark status as "unknown" and close active session with "estimated"
        const prevStatus = p.status;
        p.status = "unknown";
        p.lastLeftAt = nowIso;

        const activeSession = p.sessions[p.sessions.length - 1];
        if (activeSession && activeSession.leftAt === null) {
          activeSession.leftAt = nowIso;
          activeSession.confidence = "estimated";
          activeSession.durationMs = Math.max(
            0,
            new Date(nowIso).getTime() - new Date(activeSession.joinedAt).getTime()
          );
        }

        AttendlyLogger.logStateTransition(
          p.id,
          p.displayName,
          prevStatus,
          "UNKNOWN",
          "Off-screen grid tile while People panel closed"
        );
      }
    }

    // =========================================================================
    // 3. Recompute durations and attendance percentages
    // =========================================================================
    const referenceDurationMs = this.calculateReferenceDuration(data, nowIso);

    for (const id of Object.keys(participants)) {
      const p = participants[id];
      p.totalDurationMs = calculateTotalParticipantDuration(p.sessions, nowIso);
      p.attendancePercentage = calculateAttendancePercentage(
        p.totalDurationMs,
        referenceDurationMs
      );
    }

    // =========================================================================
    // 4. Check for virtualization diagnostic
    // =========================================================================
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
        localUserCanonicalId: canonicalLocalId,
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
        confirmedLeftAt: reason === "stopped" ? nowIso : p.confirmedLeftAt,
        sessions: consolidateAttendanceSessions(updatedSessions, nowIso),
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
          sessions: consolidateAttendanceSessions([...p.sessions, newSession], resumedAtIso),
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
