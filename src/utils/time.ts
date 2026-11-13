/**
 * Time utility functions for Attendly.
 * All internal timestamps are ISO 8601 strings.
 * User displays respect local timezone and 12h/24h preferences.
 */

export function getCurrentIso(): string {
  return new Date().toISOString();
}

export function formatTime(
  isoString: string | null | undefined,
  format: "12h" | "24h" = "12h"
): string {
  if (!isoString) return "—";
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "—";

    return date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: format === "12h",
    });
  } catch {
    return "—";
  }
}

export function formatDate(isoString: string | null | undefined): string {
  if (!isoString) return "—";
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export function formatDuration(ms: number): string {
  if (isNaN(ms) || ms <= 0) return "0m 00s";

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");

  if (hours > 0) {
    return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
  }
  return `${minutes}m ${pad(seconds)}s`;
}

export function formatDurationHuman(ms: number): string {
  if (isNaN(ms) || ms <= 0) return "0 min";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes} min`;
  const hrs = (minutes / 60).toFixed(1);
  return `${hrs} hrs`;
}

export function getFileDateStamp(isoString?: string): string {
  const d = isoString ? new Date(isoString) : new Date();
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}
