import { MeetingAttendanceData } from "../types/attendance";
import { formatDuration, formatTime } from "../utils/time";
import { buildReportFilename, sanitizeSpreadsheetField } from "../utils/sanitize";

export function generateCsvContent(data: MeetingAttendanceData): string {
  const headers = [
    "Participant Name",
    "Status",
    "First Joined",
    "Present at Start",
    "Last Left",
    "Total Duration",
    "Sessions Count",
    "Attendance %",
    "Late Arrival",
    "Early Departure",
    "Observation Confidence",
    "Identity Confidence",
  ];

  const escapeCell = (val: unknown): string => {
    const sanitized = sanitizeSpreadsheetField(val);
    if (sanitized.includes(",") || sanitized.includes('"') || sanitized.includes("\n")) {
      return `"${sanitized.replace(/"/g, '""')}"`;
    }
    return sanitized;
  };

  const rows: string[] = [];
  rows.push(headers.map(escapeCell).join(","));

  const participants = Object.values(data.participants);

  for (const p of participants) {
    const isEstimated = p.sessions.some((s) => s.confidence === "estimated");
    const row = [
      p.displayName,
      p.status.toUpperCase(),
      formatTime(p.firstJoinedAt, data.config.timeFormat),
      p.presentAtTrackingStart ? "Yes" : "No",
      p.lastLeftAt ? formatTime(p.lastLeftAt, data.config.timeFormat) : "—",
      formatDuration(p.totalDurationMs),
      String(p.sessions.length),
      p.attendancePercentage !== null ? `${p.attendancePercentage}%` : "N/A",
      p.isLate ? "Yes" : "No",
      p.leftEarly ? "Yes" : "No",
      isEstimated ? "ESTIMATED" : "CONFIRMED",
      p.identityConfidence.toUpperCase(),
    ];
    rows.push(row.map(escapeCell).join(","));
  }

  // Add UTF-8 Byte Order Mark for Excel UTF-8 compatibility
  return "\uFEFF" + rows.join("\r\n");
}

export function downloadCsvReport(data: MeetingAttendanceData): string {
  const csv = generateCsvContent(data);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const filename = buildReportFilename(
    data.meeting.meetingCode,
    "csv",
    data.trackingStartedAt || undefined
  );

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return filename;
}
