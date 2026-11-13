import ExcelJS from "exceljs";
import { MeetingAttendanceData } from "../types/attendance";
import { formatDuration, formatTime, formatDate } from "../utils/time";
import { buildReportFilename, sanitizeSpreadsheetField } from "../utils/sanitize";
import { computeSummaryStats } from "../attendance/attendance-calculator";

export async function generateExcelWorkbook(data: MeetingAttendanceData): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Attendly (Every Presence Counts)";
  workbook.lastModifiedBy = "Attendly";
  workbook.created = new Date();
  workbook.modified = new Date();

  const stats = computeSummaryStats(
    data.participants,
    data.trackingStartedAt,
    data.trackingStoppedAt,
    data.totalPausedDurationMs,
    new Date().toISOString()
  );

  const headerFill: ExcelJS.Fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF173D37" }, // Deep Teal
  };

  const headerFont: Partial<ExcelJS.Font> = {
    name: "Calibri",
    size: 11,
    bold: true,
    color: { argb: "FFFFFFFF" }, // White
  };

  // ----------------------------------------------------
  // SHEET 1: Meeting Summary
  // ----------------------------------------------------
  const summarySheet = workbook.addWorksheet("Meeting Summary", {
    views: [{ showGridLines: true }],
  });

  summarySheet.columns = [
    { header: "Metric", key: "metric", width: 28 },
    { header: "Value", key: "value", width: 40 },
  ];

  const summaryData = [
    ["Meeting Title", data.meeting.title || "Google Meet Session"],
    ["Meeting Code", data.meeting.meetingCode],
    ["Meeting URL", data.meeting.url],
    ["Date", formatDate(data.trackingStartedAt)],
    ["Tracking Started", formatTime(data.trackingStartedAt, data.config.timeFormat)],
    ["Tracking Ended", formatTime(data.trackingStoppedAt, data.config.timeFormat)],
    ["Elapsed Tracking Duration", formatDuration(stats.elapsedTrackingMs)],
    ["Paused Duration", formatDuration(data.totalPausedDurationMs)],
    ["Total Participants Observed", stats.totalUnique],
    ["Currently Present", stats.currentlyPresent],
    ["Confirmed Departed", stats.confirmedDeparted],
    ["Late Arrivals", stats.lateArrivals],
    ["Early Departures", stats.earlyDepartures],
    ["Average Recorded Duration", formatDuration(stats.averageDurationMs)],
    ["Monitoring Limitations", data.virtualizationDetected ? "List virtualization detected during session" : "None detected"],
  ];

  summaryData.forEach(([metric, val]) => {
    summarySheet.addRow({
      metric: sanitizeSpreadsheetField(metric),
      value: sanitizeSpreadsheetField(val),
    });
  });

  summarySheet.getRow(1).eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
  });

  // ----------------------------------------------------
  // SHEET 2: Attendance
  // ----------------------------------------------------
  const attendanceSheet = workbook.addWorksheet("Attendance", {
    views: [{ showGridLines: true }],
  });

  attendanceSheet.columns = [
    { header: "Participant", key: "name", width: 28 },
    { header: "Status", key: "status", width: 14 },
    { header: "First Join", key: "firstJoin", width: 16 },
    { header: "Last Leave", key: "lastLeave", width: 16 },
    { header: "Total Duration", key: "totalDuration", width: 16 },
    { header: "Rejoins", key: "rejoins", width: 12 },
    { header: "Attendance %", key: "attendancePct", width: 16 },
    { header: "Late Arrival", key: "isLate", width: 14 },
    { header: "Early Departure", key: "leftEarly", width: 16 },
    { header: "Data Confidence", key: "confidence", width: 16 },
  ];

  attendanceSheet.getRow(1).eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
  });

  Object.values(data.participants).forEach((p) => {
    attendanceSheet.addRow({
      name: sanitizeSpreadsheetField(p.displayName),
      status: p.status.toUpperCase(),
      firstJoin: formatTime(p.firstJoinedAt, data.config.timeFormat),
      lastLeave: p.lastLeftAt ? formatTime(p.lastLeftAt, data.config.timeFormat) : "—",
      totalDuration: formatDuration(p.totalDurationMs),
      rejoins: Math.max(0, p.sessions.length - 1),
      attendancePct: p.attendancePercentage !== null ? `${p.attendancePercentage}%` : "N/A",
      isLate: p.isLate ? "Yes" : "No",
      leftEarly: p.leftEarly ? "Yes" : "No",
      confidence: p.identityConfidence.toUpperCase(),
    });
  });

  // ----------------------------------------------------
  // SHEET 3: Attendance Sessions
  // ----------------------------------------------------
  const sessionsSheet = workbook.addWorksheet("Attendance Sessions", {
    views: [{ showGridLines: true }],
  });

  sessionsSheet.columns = [
    { header: "Participant", key: "name", width: 28 },
    { header: "Session #", key: "sessionNum", width: 12 },
    { header: "Join Timestamp", key: "joinedAt", width: 24 },
    { header: "Leave Timestamp", key: "leftAt", width: 24 },
    { header: "Duration", key: "duration", width: 18 },
    { header: "Observation Confidence", key: "confidence", width: 24 },
  ];

  sessionsSheet.getRow(1).eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
  });

  Object.values(data.participants).forEach((p) => {
    p.sessions.forEach((sess, idx) => {
      sessionsSheet.addRow({
        name: sanitizeSpreadsheetField(p.displayName),
        sessionNum: idx + 1,
        joinedAt: formatTime(sess.joinedAt, data.config.timeFormat),
        leftAt: sess.leftAt ? formatTime(sess.leftAt, data.config.timeFormat) : "Active at close",
        duration: formatDuration(sess.durationMs),
        confidence: sess.confidence.toUpperCase(),
      });
    });
  });

  // ----------------------------------------------------
  // SHEET 4: Tracking Diagnostics
  // ----------------------------------------------------
  const diagSheet = workbook.addWorksheet("Tracking Diagnostics", {
    views: [{ showGridLines: true }],
  });

  diagSheet.columns = [
    { header: "Timestamp", key: "timestamp", width: 22 },
    { header: "Severity", key: "severity", width: 14 },
    { header: "Code", key: "code", width: 24 },
    { header: "Message", key: "message", width: 45 },
    { header: "Details", key: "details", width: 35 },
  ];

  diagSheet.getRow(1).eachCell((cell) => {
    cell.fill = headerFill;
    cell.font = headerFont;
  });

  data.diagnostics.forEach((d) => {
    diagSheet.addRow({
      timestamp: formatTime(d.timestamp, data.config.timeFormat),
      severity: d.severity.toUpperCase(),
      code: d.code,
      message: d.message,
      details: d.details ? JSON.stringify(d.details) : "",
    });
  });

  return workbook;
}

export async function downloadExcelReport(data: MeetingAttendanceData): Promise<string> {
  const workbook = await generateExcelWorkbook(data);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  const filename = buildReportFilename(
    data.meeting.meetingCode,
    "xlsx",
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
