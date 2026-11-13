import {
  ObservedParticipantRaw,
  ParticipantAttendance,
  IdentityConfidence,
} from "../types/attendance";

/**
 * Creates a normalized key for participant lookup while respecting collisions.
 */
export function normalizeDisplayName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/**
 * Generates an ID based on available identifiers.
 * If rawId or avatar exists, we incorporate it.
 * Otherwise, if there is a collision with an existing participant having the same name
 * but different distinct identity, we create a disambiguated ID.
 */
export function resolveParticipantIdentity(
  raw: ObservedParticipantRaw,
  existingParticipants: Record<string, ParticipantAttendance>
): {
  id: string;
  displayName: string;
  identityConfidence: IdentityConfidence;
  isExisting: boolean;
  collisionWarning?: string;
} {
  const cleanName = normalizeDisplayName(raw.displayName || "Unknown Participant");

  // 1. If this raw entry represents the self user, unify with any existing "You" or self record!
  if (raw.isSelf) {
    const existingSelf = Object.values(existingParticipants).find(
      (p) => p.isSelf || normalizeDisplayName(p.displayName).toLowerCase() === "you"
    );
    if (existingSelf) {
      return {
        id: existingSelf.id,
        displayName: cleanName.toLowerCase() !== "you" ? cleanName : existingSelf.displayName,
        identityConfidence: "high",
        isExisting: true,
      };
    }
  }

  // 2. If a raw participant ID from Google Meet is present
  if (raw.rawId) {
    const existing = existingParticipants[raw.rawId];
    if (existing) {
      return {
        id: raw.rawId,
        displayName: existing.displayName,
        identityConfidence: "high",
        isExisting: true,
      };
    }
  }

  // 3. Look for existing participant by name and avatar (if available)
  const matches = Object.values(existingParticipants).filter(
    (p) => normalizeDisplayName(p.displayName).toLowerCase() === cleanName.toLowerCase()
  );

  if (matches.length === 0) {
    // New unique participant
    const generatedId = raw.rawId || `p_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    return {
      id: generatedId,
      displayName: cleanName,
      identityConfidence: "high",
      isExisting: false,
    };
  }

  // If exactly one match exists:
  if (matches.length === 1) {
    const match = matches[0];
    // Check if avatar matches or is compatible
    if (
      !raw.avatarUrl ||
      !match.avatarUrl ||
      raw.avatarUrl === match.avatarUrl
    ) {
      return {
        id: match.id,
        displayName: match.displayName,
        identityConfidence: match.identityConfidence,
        isExisting: true,
      };
    }
  }

  // If we reach here, we have multiple participants with the same display name
  // or a participant with the same name but clearly conflicting avatar!
  // Do NOT silently merge them. Create a disambiguated record.
  const disambiguatedIndex = matches.length + 1;
  const newId = `p_ambiguous_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  return {
    id: newId,
    displayName: `${cleanName} (${disambiguatedIndex})`,
    identityConfidence: "low",
    isExisting: false,
    collisionWarning: `Multiple participants detected with the name "${cleanName}". Disambiguated as "${cleanName} (${disambiguatedIndex})".`,
  };
}
