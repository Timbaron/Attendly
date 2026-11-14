import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { MeetingAttendanceData } from "../types/attendance";
import { formatDuration, formatTime, formatDate } from "../utils/time";
import { buildReportFilename } from "../utils/sanitize";
import { computeSummaryStats } from "../attendance/attendance-calculator";

export function generatePdfDocument(data: MeetingAttendanceData): jsPDF {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const stats = computeSummaryStats(
    data.participants,
    data.trackingStartedAt,
    data.trackingStoppedAt,
    data.totalPausedDurationMs,
    new Date().toISOString()
  );

  // Palette constants
  const TEAL = [23, 61, 55]; // #173D37
  const MINT = [169, 240, 195]; // #A9F0C3
  const GRAY = [100, 116, 114];
  const LIGHT_BG = [248, 250, 249];

  // 1. Header Banner
  doc.setFillColor(TEAL[0], TEAL[1], TEAL[2]);
  doc.rect(0, 0, 210, 28, "F");

  // Title & Tagline
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.text("Attendly", 14, 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(MINT[0], MINT[1], MINT[2]);
  doc.text("Every Presence Counts. — Google Meet Attendance Report", 14, 20);

  // Date on top right
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(formatDate(data.trackingStartedAt), 196, 17, { align: "right" });

  // 2. Meeting Metadata Box
  doc.setFillColor(LIGHT_BG[0], LIGHT_BG[1], LIGHT_BG[2]);
  doc.roundedRect(14, 34, 182, 28, 2, 2, "F");
  doc.setDrawColor(220, 230, 228);
  doc.roundedRect(14, 34, 182, 28, 2, 2, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(TEAL[0], TEAL[1], TEAL[2]);
  doc.text(data.meeting.title || "Google Meet Session", 18, 42);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);
  doc.text(`Meeting Code: ${data.meeting.meetingCode}`, 18, 48);
  doc.text(`Tracking Start: ${formatTime(data.trackingStartedAt, data.config.timeFormat)}`, 18, 54);
  doc.text(`Tracking End: ${formatTime(data.trackingStoppedAt, data.config.timeFormat)}`, 18, 58);

  doc.text(`Elapsed Time: ${formatDuration(stats.elapsedTrackingMs)}`, 105, 48);
  doc.text(`Total Attendees: ${stats.totalUnique}`, 105, 54);
  doc.text(`Average Duration: ${formatDuration(stats.averageDurationMs)}`, 105, 58);

  doc.text(`Currently Present: ${stats.currentlyPresent}`, 155, 48);
  doc.text(`Late Arrivals: ${stats.lateArrivals}`, 155, 54);
  doc.text(`Early Departures: ${stats.earlyDepartures}`, 155, 58);

  // 3. Table of Participants
  const tableData = Object.values(data.participants).map((p) => {
    const isEstimated = p.sessions.some((s) => s.confidence === "estimated");
    return [
      p.displayName,
      p.status.toUpperCase(),
      formatTime(p.firstJoinedAt, data.config.timeFormat) + (p.presentAtTrackingStart ? " (start)" : ""),
      p.lastLeftAt ? formatTime(p.lastLeftAt, data.config.timeFormat) : "—",
      formatDuration(p.totalDurationMs),
      p.attendancePercentage !== null ? `${p.attendancePercentage}%` : "N/A",
      p.isLate ? "Late" : "On-time",
      p.leftEarly ? "Yes" : "No",
      isEstimated ? "ESTIMATED" : p.identityConfidence.toUpperCase(),
    ];
  });

  autoTable(doc, {
    startY: 68,
    head: [[
      "Participant",
      "Status",
      "First Join",
      "Last Leave",
      "Duration",
      "Attendance %",
      "Arrival",
      "Left Early",
      "Confidence",
    ]],
    body: tableData,
    theme: "striped",
    headStyles: {
      fillColor: [TEAL[0], TEAL[1], TEAL[2]],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 8,
      halign: "left",
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2.2,
      textColor: [23, 43, 40],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 249],
    },
    didDrawPage: (dataHook) => {
      // Footer on every page
      const pageCount = (doc as any).internal.getNumberOfPages();
      const currentPage = dataHook.pageNumber;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(GRAY[0], GRAY[1], GRAY[2]);

      const footerText = `Attendly Local Report • Generated on ${new Date().toLocaleString()} • Privacy-first, zero cloud data transfer`;
      doc.text(footerText, 14, 290);
      doc.text(`Page ${currentPage} of ${pageCount}`, 196, 290, { align: "right" });
    },
  });

  return doc;
}

export function downloadPdfReport(data: MeetingAttendanceData): string {
  const doc = generatePdfDocument(data);
  const filename = buildReportFilename(
    data.meeting.meetingCode,
    "pdf",
    data.trackingStartedAt || undefined
  );
  doc.save(filename);
  return filename;
}
