/**
 * Security and sanitization utilities for Attendly.
 * Prevents CSV / Excel formula injection (CSV Injection / CWE-1236)
 * and ensures safe file naming.
 */

const FORMULA_TRIGGERS = new Set(["=", "+", "-", "@", "\t", "\r"]);

/**
 * Sanitizes a field string against spreadsheet formula injection.
 * If the string starts with an injection character, it is safely prefixed with a single quote (').
 */
export function sanitizeSpreadsheetField(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value).trim();
  if (str.length === 0) {
    return "";
  }
  const firstChar = str.charAt(0);
  if (FORMULA_TRIGGERS.has(firstChar)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Sanitizes a filename to prevent path traversal or invalid filesystem characters.
 * Replaces illegal characters (< > : " / \ | ? *) with an underscore.
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 120);
}

/**
 * Builds the canonical Attendly export filename:
 * Attendly_{MeetingCode}_{YYYY-MM-DD}.{ext}
 */
export function buildReportFilename(
  meetingCode: string,
  extension: "xlsx" | "csv" | "pdf",
  dateIso?: string
): string {
  const cleanCode = sanitizeFilename(meetingCode || "meeting");
  const d = dateIso ? new Date(dateIso) : new Date();
  const year = d.getFullYear();
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `Attendly_${cleanCode}_${year}-${month}-${day}.${extension}`;
}
