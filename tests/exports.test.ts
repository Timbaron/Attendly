import { describe, it, expect } from "vitest";
import { generateCsvContent } from "../src/exports/csv-export";
import { generateExcelWorkbook } from "../src/exports/excel-export";
import { generatePdfDocument } from "../src/exports/pdf-export";
import { buildReportFilename, sanitizeSpreadsheetField, sanitizeFilename } from "../src/utils/sanitize";
import { MeetingAttendanceData } from "../src/types/attendance";
import { DEFAULT_CONFIG } from "../src/attendance/attendance-engine";

describe("Sanitization & Security Utilities", () => {
  it("escapes formula injection triggers safely", () => {
    expect(sanitizeSpreadsheetField("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
    expect(sanitizeSpreadsheetField("+cmd|' /C calc'!A0")).toBe("'+cmd|' /C calc'!A0");
    expect(sanitizeSpreadsheetField("-100")).toBe("'-100");
    expect(sanitizeSpreadsheetField("@something")).toBe("'@something");
    expect(sanitizeSpreadsheetField("Normal Name")).toBe("Normal Name");
  });

  it("sanitizes filenames safely", () => {
    expect(sanitizeFilename("abc/def:ghi*jkl")).toBe("abc_def_ghi_jkl");
    expect(buildReportFilename("abc-defg-hij", "xlsx", "2026-11-13T09:00:00Z")).toBe(
      "Attendly_abc-defg-hij_2026-11-13.xlsx"
    );
  });
});

describe("Export Generators", () => {
  const mockData: MeetingAttendanceData = {
    sessionId: "test_session_1",
    meeting: {
      meetingCode: "abc-defg-hij",
      title: "Team Standup",
      platform: "google-meet",
      url: "https://meet.google.com/abc-defg-hij",
    },
    config: DEFAULT_CONFIG,
    trackingState: "stopped",
    trackingStartedAt: "2026-11-13T09:00:00.000Z",
    trackingPausedAt: null,
    trackingStoppedAt: "2026-11-13T10:00:00.000Z",
    totalPausedDurationMs: 0,
    participants: {
      p1: {
        id: "p1",
        displayName: "=Malicious Formula",
        firstJoinedAt: "2026-11-13T09:02:00.000Z",
        lastLeftAt: "2026-11-13T10:00:00.000Z",
        totalDurationMs: 58 * 60 * 1000,
        sessions: [
          {
            id: "s1",
            joinedAt: "2026-11-13T09:02:00.000Z",
            leftAt: "2026-11-13T10:00:00.000Z",
            durationMs: 58 * 60 * 1000,
            confidence: "observed",
          },
        ],
        status: "left",
        isLate: false,
        leftEarly: false,
        attendancePercentage: 96.7,
        identityConfidence: "high",
      },
    },
    diagnostics: [
      {
        id: "d1",
        timestamp: "2026-11-13T09:00:00.000Z",
        severity: "info",
        code: "TRACKING_STARTED",
        message: "Attendance tracking started.",
      },
    ],
    lastObservedCount: 1,
    virtualizationDetected: false,
    peoplePanelOpen: true,
  };

  it("generates CSV with formula injection protection", () => {
    const csv = generateCsvContent(mockData);
    expect(csv).toContain("Participant Name");
    // "=Malicious Formula" must be sanitized to "'=Malicious Formula"
    expect(csv).toContain("'=Malicious Formula");
    expect(csv).toContain("LEFT");
  });

  it("generates Excel workbook with 4 required sheets", async () => {
    const workbook = await generateExcelWorkbook(mockData);
    expect(workbook.worksheets.length).toBe(4);
    expect(workbook.getWorksheet("Meeting Summary")).toBeDefined();
    expect(workbook.getWorksheet("Attendance")).toBeDefined();
    expect(workbook.getWorksheet("Attendance Sessions")).toBeDefined();
    expect(workbook.getWorksheet("Tracking Diagnostics")).toBeDefined();

    const attendanceSheet = workbook.getWorksheet("Attendance");
    expect(attendanceSheet?.rowCount).toBeGreaterThanOrEqual(2);
  });

  it("generates valid PDF document", () => {
    const pdf = generatePdfDocument(mockData);
    expect(pdf).toBeDefined();
    expect((pdf as any).internal.getNumberOfPages()).toBeGreaterThanOrEqual(1);
  });
});
