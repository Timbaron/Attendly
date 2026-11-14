import {
  AttendanceSession,
  IdentityConfidence,
  ObservedParticipantRaw,
  ParticipantAttendance,
} from "../types/attendance";
import { AttendlyLogger } from "../utils/logger";

export const CANONICAL_LOCAL_USER_ID = "canonical_local_user";

/**
 * Normalizes display name by trimming and collapsing multiple spaces.
 */
export function normalizeDisplayName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/**
 * Analyzes a raw participant label to extract the cleaned human name
 * and determine if there is explicit evidence that this represents the local user.
 */
export function extractParticipantIdentityInfo(rawName: string): {
  cleanName: string;
  isExplicitLocalUser: boolean;
} {
  const normalized = normalizeDisplayName(rawName || "Unknown Participant");

  // Check for explicit local user patterns:
  // "You"
  // "Timothy Akiode (You)"
  // "Timothy Akiode (Host, You)"
  // "Timothy Akiode (You, Presentation)"
  const youPattern = /\s*\((?:you|host,\s*you|you,\s*presentation|presentation,\s*you)\)\s*$/i;

  if (/^you$/i.test(normalized)) {
    return {
      cleanName: "You",
      isExplicitLocalUser: true,
    };
  }

  if (youPattern.test(normalized)) {
    const stripped = normalized.replace(youPattern, "").trim();
    return {
      cleanName: stripped || "You",
      isExplicitLocalUser: true,
    };
  }

  return {
    cleanName: normalized,
    isExplicitLocalUser: false,
  };
}

/**
 * Consolidates an array of attendance sessions by sorting them chronologically
 * and merging any overlapping intervals to strictly prevent double-counting.
 */
export function consolidateAttendanceSessions(
  sessions: AttendanceSession[],
  currentTimeIso?: string
): AttendanceSession[] {
  if (sessions.length <= 1) return [...sessions];

  // Sort sessions by start time
  const sorted = [...sessions].sort(
    (a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
  );

  const consolidated: AttendanceSession[] = [];
  let current = { ...sorted[0] };

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];

    const currentStartMs = new Date(current.joinedAt).getTime();
    const currentEndMs = current.leftAt
      ? new Date(current.leftAt).getTime()
      : currentTimeIso
      ? new Date(currentTimeIso).getTime()
      : Infinity;

    const nextStartMs = new Date(next.joinedAt).getTime();
    const nextEndMs = next.leftAt
      ? new Date(next.leftAt).getTime()
      : currentTimeIso
      ? new Date(currentTimeIso).getTime()
      : Infinity;

    // Check for overlap: next starts before current ends
    if (nextStartMs <= currentEndMs) {
      // Overlapping or contiguous interval: merge
      const newEndMs = Math.max(currentEndMs, nextEndMs);
      const isStillOpen = current.leftAt === null || next.leftAt === null;

      current.leftAt = isStillOpen ? null : new Date(newEndMs).toISOString();
      current.durationMs = isStillOpen
        ? 0
        : Math.max(0, newEndMs - currentStartMs);
      // Prefer observed over estimated confidence
      if (next.confidence === "observed") {
        current.confidence = "observed";
      }
    } else {
      // No overlap: push current and move to next
      consolidated.push(current);
      current = { ...next };
    }
  }

  consolidated.push(current);
  return consolidated;
}

/**
 * Resolves an observed participant into a stable internal participant identity.
 * Enforces canonical local-user alias resolution and avoids merging unrelated participants.
 */
export function resolveParticipantIdentity(
  raw: ObservedParticipantRaw,
  existingParticipants: Record<string, ParticipantAttendance>,
  knownLocalCanonicalId: string = CANONICAL_LOCAL_USER_ID
): {
  id: string;
  displayName: string;
  identityConfidence: IdentityConfidence;
  isExisting: boolean;
  isLocalUser: boolean;
  collisionWarning?: string;
} {
  const { cleanName, isExplicitLocalUser } = extractParticipantIdentityInfo(
    raw.displayName || ""
  );

  const isLocal = Boolean(raw.isLocalUser || raw.isSelf || isExplicitLocalUser);

  // =========================================================================
  // 1. LOCAL USER RESOLUTION
  // =========================================================================
  if (isLocal) {
    // Look for existing canonical local user record
    const existingLocal =
      existingParticipants[knownLocalCanonicalId] ||
      Object.values(existingParticipants).find(
        (p) => p.isLocalUser || p.isSelf || p.id === CANONICAL_LOCAL_USER_ID
      ) ||
      // Or an existing record named "You" that is the only local entry
      Object.values(existingParticipants).find(
        (p) => p.displayName.trim().toLowerCase() === "you"
      );

    if (existingLocal) {
      // Upgrade name if we now have a verified real human name instead of "You"
      const resolvedName =
        cleanName.toLowerCase() !== "you" ? cleanName : existingLocal.displayName;

      if (cleanName.toLowerCase() !== "you" && existingLocal.displayName.toLowerCase() === "you") {
        AttendlyLogger.logAliasResolution("You", resolvedName, existingLocal.id);
      }

      return {
        id: existingLocal.id,
        displayName: resolvedName,
        identityConfidence: "high",
        isExisting: true,
        isLocalUser: true,
      };
    }

    // First time seeing local user
    AttendlyLogger.logIdentityMatching(cleanName, knownLocalCanonicalId, false, "high");
    return {
      id: knownLocalCanonicalId,
      displayName: cleanName,
      identityConfidence: "high",
      isExisting: false,
      isLocalUser: true,
    };
  }

  // =========================================================================
  // 2. REMOTE PARTICIPANT WITH STABLE RAW ID
  // =========================================================================
  if (raw.rawId) {
    const existing = existingParticipants[raw.rawId];
    if (existing) {
      return {
        id: raw.rawId,
        displayName: existing.displayName,
        identityConfidence: "high",
        isExisting: true,
        isLocalUser: false,
      };
    }
  }

  // =========================================================================
  // 3. REMOTE PARTICIPANT NAME & AVATAR MATCHING
  // =========================================================================
  // Do NOT match against the local user record when resolving remote participants
  const nonLocalCandidates = Object.values(existingParticipants).filter(
    (p) => !p.isLocalUser && p.id !== knownLocalCanonicalId
  );

  const matches = nonLocalCandidates.filter(
    (p) => normalizeDisplayName(p.displayName).toLowerCase() === cleanName.toLowerCase()
  );

  if (matches.length === 0) {
    // Brand new remote participant
    const generatedId =
      raw.rawId || `p_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    AttendlyLogger.logIdentityMatching(cleanName, generatedId, false, "high");

    return {
      id: generatedId,
      displayName: cleanName,
      identityConfidence: "high",
      isExisting: false,
      isLocalUser: false,
    };
  }

  // Exactly one candidate with this name: verify avatar compatibility
  if (matches.length === 1) {
    const match = matches[0];
    const isAvatarCompatible =
      !raw.avatarUrl || !match.avatarUrl || raw.avatarUrl === match.avatarUrl;

    if (isAvatarCompatible) {
      return {
        id: match.id,
        displayName: match.displayName,
        identityConfidence: match.identityConfidence,
        isExisting: true,
        isLocalUser: false,
      };
    }
  }

  // Multiple participants with same display name or conflicting avatars!
  // Do NOT silently merge unrelated participants.
  const disambiguatedIndex = matches.length + 1;
  const newId = `p_ambiguous_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const disambiguatedName = `${cleanName} (${disambiguatedIndex})`;

  const warning = `Multiple participants detected with name "${cleanName}". Disambiguated as "${disambiguatedName}".`;
  AttendlyLogger.logInterruption(warning, { rawName: raw.displayName, assignedId: newId });

  return {
    id: newId,
    displayName: disambiguatedName,
    identityConfidence: "low",
    isExisting: false,
    isLocalUser: false,
    collisionWarning: warning,
  };
}
