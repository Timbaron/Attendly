/**
 * Development-only structured diagnostics logger for Attendly.
 * Logs locally to the browser console.
 * Strictly avoids transmitting logs externally and avoids logging full PII.
 */

const IS_DEV = true; // Enabled in dev / beta builds

export class AttendlyLogger {
  private static sanitizeName(name: string): string {
    if (!name) return "Unknown";
    // For privacy, mask middle characters if long, but keep readable for debugging
    const parts = name.trim().split(" ");
    if (parts.length > 1) {
      return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
    }
    return name;
  }

  public static logDetection(
    source: "grid" | "people_panel" | "header_badge",
    count: number,
    isPanelOpen: boolean
  ): void {
    if (!IS_DEV) return;
    console.debug(`[Attendly:Detection] Source: ${source} | Count: ${count} | PanelOpen: ${isPanelOpen}`);
  }

  public static logAliasResolution(
    originalLabel: string,
    canonicalName: string,
    canonicalId: string
  ): void {
    if (!IS_DEV) return;
    console.info(
      `[Attendly:Alias] Resolved alias "${this.sanitizeName(originalLabel)}" -> Canonical "${this.sanitizeName(
        canonicalName
      )}" (${canonicalId})`
    );
  }

  public static logIdentityMatching(
    displayName: string,
    assignedId: string,
    isExisting: boolean,
    confidence: "high" | "low"
  ): void {
    if (!IS_DEV) return;
    console.debug(
      `[Attendly:Identity] "${this.sanitizeName(displayName)}" -> ID: ${assignedId} | Existing: ${isExisting} | Confidence: ${confidence}`
    );
  }

  public static logStateTransition(
    participantId: string,
    displayName: string,
    fromState: string,
    toState: string,
    reason?: string
  ): void {
    if (!IS_DEV) return;
    console.info(
      `[Attendly:State] "${this.sanitizeName(displayName)}" (${participantId}): ${fromState} -> ${toState}${
        reason ? ` (${reason})` : ""
      }`
    );
  }

  public static logPanelToggle(isOpen: boolean): void {
    if (!IS_DEV) return;
    console.info(`[Attendly:Panel] People panel visibility: ${isOpen ? "OPEN" : "CLOSED"}`);
  }

  public static logReconciliation(
    observedCount: number,
    activePresent: number,
    departed: number,
    headerCount: number | null
  ): void {
    if (!IS_DEV) return;
    console.debug(
      `[Attendly:Reconcile] Observed: ${observedCount} | Active: ${activePresent} | Departed: ${departed} | HeaderCount: ${headerCount ?? "N/A"}`
    );
  }

  public static logInterruption(reason: string, details?: Record<string, unknown>): void {
    if (!IS_DEV) return;
    console.warn(`[Attendly:Interruption] Monitoring warning: ${reason}`, details ?? "");
  }
}
