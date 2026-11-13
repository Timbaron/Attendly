import React, { useEffect, useState, useMemo } from "react";
import {
  MeetingAttendanceData,
  ParticipantAttendance,
  TrackingSessionConfig,
} from "../types/attendance";
import { DEFAULT_CONFIG } from "../attendance/attendance-engine";
import { StorageService } from "../storage/session-storage";
import { computeSummaryStats } from "../attendance/attendance-calculator";
import { formatDuration, formatTime, formatDate } from "../utils/time";
import { downloadExcelReport } from "../exports/excel-export";
import { downloadCsvReport } from "../exports/csv-export";
import { downloadPdfReport } from "../exports/pdf-export";
import {
  Users,
  Clock,
  UserCheck,
  UserX,
  Search,
  ArrowUpDown,
  FileSpreadsheet,
  FileCode,
  FileText,
  Activity,
  Moon,
  Sun,
  ChevronRight,
} from "lucide-react";

export const DashboardApp: React.FC = () => {
  const [data, setData] = useState<MeetingAttendanceData | null>(null);
  const [config, setConfig] = useState<TrackingSessionConfig>(DEFAULT_CONFIG);
  const [isDark, setIsDark] = useState(false);
  const [activeTab, setActiveTab] = useState<"participants" | "sessions" | "diagnostics">("participants");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<keyof ParticipantAttendance>("displayName");
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    // 1. Theme and Preferences
    StorageService.getPreferences().then((prefs) => {
      setConfig(prefs);
      if (prefs.theme === "dark") {
        setIsDark(true);
        document.documentElement.classList.add("dark");
      } else if (prefs.theme === "light") {
        setIsDark(false);
        document.documentElement.classList.remove("dark");
      } else {
        const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        setIsDark(prefersDark);
        document.documentElement.classList.toggle("dark", prefersDark);
      }
    });

    // 2. Discover active session or latest draft
    const loadSession = async () => {
      chrome.tabs.query({ url: "https://meet.google.com/*" }, async (meetTabs) => {
        if (meetTabs[0]?.id) {
          chrome.tabs.sendMessage(
            meetTabs[0].id,
            { type: "GET_MEETING_STATE" },
            (resp) => {
              if (resp?.data) {
                setData(resp.data);
              }
            }
          );
        } else {
          const draft = await StorageService.getLastSessionDraft();
          if (draft) {
            setData(draft);
          }
        }
      });
    };

    loadSession();

    // Listen for live updates
    const listener = (msg: any) => {
      if (msg.type === "MEETING_STATE_UPDATE" && msg.data) {
        setData(msg.data);
      }
    };
    chrome.runtime.onMessage.addListener(listener);

    const ticker = setInterval(() => {
      setData((prev) => (prev ? { ...prev } : null));
    }, 2000);

    return () => {
      chrome.runtime.onMessage.removeListener(listener);
      clearInterval(ticker);
    };
  }, []);

  const stats = useMemo(() => {
    return computeSummaryStats(
      data?.participants || {},
      data?.trackingStartedAt || null,
      data?.trackingStoppedAt || null,
      data?.totalPausedDurationMs || 0,
      new Date().toISOString()
    );
  }, [data]);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
    StorageService.savePreferences({ theme: nextDark ? "dark" : "light" });
  };

  const filteredParticipants = useMemo(() => {
    if (!data) return [];
    let list = Object.values(data.participants);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((p) => p.displayName.toLowerCase().includes(q));
    }

    if (statusFilter !== "all") {
      list = list.filter((p) => p.status === statusFilter);
    }

    list.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (typeof aVal === "string") {
        return sortAsc
          ? (aVal as string).localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal as string);
      }
      if (typeof aVal === "number") {
        return sortAsc
          ? (aVal as number) - (bVal as number)
          : (bVal as number) - (aVal as number);
      }
      return 0;
    });

    return list;
  }, [data, searchQuery, statusFilter, sortField, sortAsc]);

  const handleSort = (field: keyof ParticipantAttendance) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const selectedParticipant = useMemo(() => {
    if (!data || !selectedParticipantId) return null;
    return data.participants[selectedParticipantId] || null;
  }, [data, selectedParticipantId]);

  return (
    <div className="min-h-screen flex flex-col bg-attendly-bg-light dark:bg-attendly-bg-dark text-attendly-text-primary dark:text-attendly-text-darkPrimary">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-attendly-teal text-white border-b border-attendly-teal-600 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-attendly-mint flex items-center justify-center shadow-inner">
              <svg
                className="w-5 h-5 text-attendly-teal"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <polyline points="16 11 18 13 22 9" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg tracking-tight">Attendly</span>
                <span className="text-[11px] font-semibold bg-attendly-mint/20 text-attendly-mint px-2 py-0.5 rounded-full">
                  Dashboard
                </span>
              </div>
              <p className="text-xs text-attendly-mint/80">Every Presence Counts.</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Quick Export Buttons */}
            {data && (
              <div className="hidden sm:flex items-center gap-1.5 mr-2">
                <button
                  onClick={() => downloadExcelReport(data)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs font-semibold transition-all shadow-xs"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Excel
                </button>
                <button
                  onClick={() => downloadCsvReport(data)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-white text-xs font-semibold transition-all shadow-xs"
                >
                  <FileCode className="w-3.5 h-3.5" />
                  CSV
                </button>
                <button
                  onClick={() => downloadPdfReport(data)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white text-xs font-semibold transition-all shadow-xs"
                >
                  <FileText className="w-3.5 h-3.5" />
                  PDF
                </button>
              </div>
            )}

            <button
              onClick={toggleTheme}
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              className="p-2 rounded-lg bg-attendly-teal-600 hover:bg-attendly-teal-500 text-attendly-mint transition-colors"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Meeting Header Banner */}
        <div className="p-6 bg-white dark:bg-attendly-card-dark rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-attendly-text-secondary dark:text-attendly-text-darkSecondary font-semibold">
                {data?.meeting.meetingCode || "NO ACTIVE CALL"}
              </span>
              <span className="text-xs text-attendly-text-muted dark:text-attendly-text-darkMuted">
                • {formatDate(data?.trackingStartedAt)}
              </span>
            </div>
            <h1 className="text-2xl font-bold text-attendly-text-primary dark:text-attendly-text-darkPrimary">
              {data?.meeting.title || "Google Meet Attendance Session"}
            </h1>
            <p className="text-xs text-attendly-text-muted dark:text-attendly-text-darkMuted mt-1">
              Started at {formatTime(data?.trackingStartedAt, config.timeFormat)}
              {data?.trackingStoppedAt && ` • Stopped at ${formatTime(data.trackingStoppedAt, config.timeFormat)}`}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <span className="text-xs text-attendly-text-muted dark:text-attendly-text-darkMuted uppercase tracking-wider font-semibold">
                Elapsed Monitoring
              </span>
              <div className="text-2xl font-bold text-attendly-teal dark:text-attendly-mint">
                {formatDuration(stats.elapsedTrackingMs)}
              </div>
            </div>
          </div>
        </div>

        {/* Overview KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          <div className="p-4 bg-white dark:bg-attendly-card-dark rounded-xl border border-gray-100 dark:border-gray-800 shadow-xs">
            <div className="flex items-center justify-between text-attendly-text-muted dark:text-attendly-text-darkMuted mb-2">
              <span className="text-xs font-semibold uppercase">Total Observed</span>
              <Users className="w-4 h-4 text-attendly-teal dark:text-attendly-mint" />
            </div>
            <div className="text-2xl font-bold text-attendly-text-primary dark:text-attendly-text-darkPrimary">
              {stats.totalUnique}
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-attendly-card-dark rounded-xl border border-gray-100 dark:border-gray-800 shadow-xs">
            <div className="flex items-center justify-between text-attendly-text-muted dark:text-attendly-text-darkMuted mb-2">
              <span className="text-xs font-semibold uppercase">Present Now</span>
              <UserCheck className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {stats.currentlyPresent}
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-attendly-card-dark rounded-xl border border-gray-100 dark:border-gray-800 shadow-xs">
            <div className="flex items-center justify-between text-attendly-text-muted dark:text-attendly-text-darkMuted mb-2">
              <span className="text-xs font-semibold uppercase">Departed</span>
              <UserX className="w-4 h-4 text-gray-400" />
            </div>
            <div className="text-2xl font-bold text-gray-500 dark:text-gray-400">
              {stats.confirmedDeparted}
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-attendly-card-dark rounded-xl border border-gray-100 dark:border-gray-800 shadow-xs">
            <div className="flex items-center justify-between text-attendly-text-muted dark:text-attendly-text-darkMuted mb-2">
              <span className="text-xs font-semibold uppercase">Late Arrivals</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {stats.lateArrivals}
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-attendly-card-dark rounded-xl border border-gray-100 dark:border-gray-800 shadow-xs col-span-2 md:col-span-1">
            <div className="flex items-center justify-between text-attendly-text-muted dark:text-attendly-text-darkMuted mb-2">
              <span className="text-xs font-semibold uppercase">Avg Duration</span>
              <Activity className="w-4 h-4 text-attendly-teal dark:text-attendly-mint" />
            </div>
            <div className="text-2xl font-bold text-attendly-teal dark:text-attendly-mint">
              {formatDuration(stats.averageDurationMs)}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("participants")}
              className={`pb-3 text-sm font-semibold border-b-2 transition-all ${
                activeTab === "participants"
                  ? "border-attendly-teal text-attendly-teal dark:border-attendly-mint dark:text-attendly-mint"
                  : "border-transparent text-attendly-text-muted dark:text-attendly-text-darkMuted hover:text-attendly-text-primary"
              }`}
            >
              All Attendees ({stats.totalUnique})
            </button>

            <button
              onClick={() => setActiveTab("sessions")}
              className={`pb-3 text-sm font-semibold border-b-2 transition-all ${
                activeTab === "sessions"
                  ? "border-attendly-teal text-attendly-teal dark:border-attendly-mint dark:text-attendly-mint"
                  : "border-transparent text-attendly-text-muted dark:text-attendly-text-darkMuted hover:text-attendly-text-primary"
              }`}
            >
              Session Intervals
            </button>

            <button
              onClick={() => setActiveTab("diagnostics")}
              className={`pb-3 text-sm font-semibold border-b-2 flex items-center gap-1.5 transition-all ${
                activeTab === "diagnostics"
                  ? "border-attendly-teal text-attendly-teal dark:border-attendly-mint dark:text-attendly-mint"
                  : "border-transparent text-attendly-text-muted dark:text-attendly-text-darkMuted hover:text-attendly-text-primary"
              }`}
            >
              <span>Diagnostics</span>
              {data && data.diagnostics.length > 0 && (
                <span className="text-[10px] bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 px-1.5 py-0.2 rounded-full font-bold">
                  {data.diagnostics.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tab 1: All Participants Table */}
        {activeTab === "participants" && (
          <div className="bg-white dark:bg-attendly-card-dark rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden flex flex-col">
            {/* Filter Bar */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search attendee by name..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/60 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <span className="text-xs text-attendly-text-muted dark:text-attendly-text-darkMuted font-medium">
                  Filter:
                </span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700/60 rounded-lg text-xs text-attendly-text-primary dark:text-attendly-text-darkPrimary"
                >
                  <option value="all">All Statuses</option>
                  <option value="present">Present</option>
                  <option value="left">Departed</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-gray-800/40 text-attendly-text-secondary dark:text-attendly-text-darkSecondary font-semibold border-b border-gray-100 dark:border-gray-800">
                  <tr>
                    <th className="py-3 px-4 cursor-pointer" onClick={() => handleSort("displayName")}>
                      <div className="flex items-center gap-1">
                        Attendee <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="py-3 px-4 cursor-pointer" onClick={() => handleSort("status")}>
                      Status
                    </th>
                    <th className="py-3 px-4">First Join</th>
                    <th className="py-3 px-4">Last Leave</th>
                    <th className="py-3 px-4 cursor-pointer" onClick={() => handleSort("totalDurationMs")}>
                      <div className="flex items-center gap-1">
                        Duration <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="py-3 px-4">Rejoins</th>
                    <th className="py-3 px-4 cursor-pointer" onClick={() => handleSort("attendancePercentage")}>
                      <div className="flex items-center gap-1">
                        Attendance % <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="py-3 px-4">Arrival</th>
                    <th className="py-3 px-4">Confidence</th>
                    <th className="py-3 px-4 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/60">
                  {filteredParticipants.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-attendly-text-muted">
                        No attendees match the criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredParticipants.map((p) => (
                      <tr
                        key={p.id}
                        className="hover:bg-attendly-teal/5 dark:hover:bg-attendly-mint/5 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {p.avatarUrl ? (
                              <img
                                src={p.avatarUrl}
                                alt={p.displayName}
                                className="w-7 h-7 rounded-full object-cover shrink-0"
                              />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-attendly-teal/10 dark:bg-attendly-mint/20 text-attendly-teal dark:text-attendly-mint flex items-center justify-center font-bold text-xs shrink-0">
                                {p.displayName.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <span className="font-semibold text-attendly-text-primary dark:text-attendly-text-darkPrimary">
                              {p.displayName}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              p.status === "present"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                                : p.status === "left"
                                ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                            }`}
                          >
                            {p.status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-attendly-text-secondary dark:text-attendly-text-darkSecondary">
                          {formatTime(p.firstJoinedAt, config.timeFormat)}
                        </td>
                        <td className="py-3 px-4 text-attendly-text-secondary dark:text-attendly-text-darkSecondary">
                          {p.lastLeftAt ? formatTime(p.lastLeftAt, config.timeFormat) : "—"}
                        </td>
                        <td className="py-3 px-4 font-bold text-attendly-text-primary dark:text-attendly-text-darkPrimary">
                          {formatDuration(p.totalDurationMs)}
                        </td>
                        <td className="py-3 px-4 text-attendly-text-secondary dark:text-attendly-text-darkSecondary">
                          {Math.max(0, p.sessions.length - 1)}
                        </td>
                        <td className="py-3 px-4 font-semibold text-attendly-teal dark:text-attendly-mint">
                          {p.attendancePercentage !== null ? `${p.attendancePercentage}%` : "N/A"}
                        </td>
                        <td className="py-3 px-4">
                          {p.isLate ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-semibold">
                              Late
                            </span>
                          ) : (
                            <span className="text-gray-400">On time</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`text-[10px] font-medium uppercase ${
                              p.identityConfidence === "high"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {p.identityConfidence}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedParticipantId(p.id);
                              setActiveTab("sessions");
                            }}
                            className="p-1 rounded text-attendly-teal dark:text-attendly-mint hover:bg-attendly-teal/10"
                            title="Inspect discrete attendance intervals"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: Sessions Drilldown */}
        {activeTab === "sessions" && (
          <div className="bg-white dark:bg-attendly-card-dark rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-attendly-text-primary dark:text-attendly-text-darkPrimary">
                  Participant Session Drilldown
                </h3>
                <p className="text-xs text-attendly-text-muted dark:text-attendly-text-darkMuted">
                  Detailed inspection of discrete join and departure intervals.
                </p>
              </div>

              {/* Selector */}
              <select
                value={selectedParticipantId || ""}
                onChange={(e) => setSelectedParticipantId(e.target.value)}
                className="px-3 py-1.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-xs"
              >
                <option value="">Choose Attendee...</option>
                {Object.values(data?.participants || {}).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName} ({p.sessions.length} sessions)
                  </option>
                ))}
              </select>
            </div>

            {selectedParticipant ? (
              <div className="space-y-3 pt-2">
                <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-attendly-text-primary dark:text-attendly-text-darkPrimary">
                      {selectedParticipant.displayName}
                    </h4>
                    <span className="text-xs text-attendly-text-muted">
                      Total Attended Duration:{" "}
                      <strong className="text-attendly-teal dark:text-attendly-mint">
                        {formatDuration(selectedParticipant.totalDurationMs)}
                      </strong>
                    </span>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-attendly-teal/10 dark:bg-attendly-mint/20 text-attendly-teal dark:text-attendly-mint">
                    {selectedParticipant.sessions.length} Distinct Session(s)
                  </span>
                </div>

                <div className="space-y-2">
                  {selectedParticipant.sessions.map((sess, idx) => (
                    <div
                      key={sess.id}
                      className="p-3 rounded-lg border border-gray-100 dark:border-gray-800/80 bg-white dark:bg-attendly-card-dark flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full bg-attendly-teal/10 dark:bg-attendly-mint/10 font-bold text-attendly-teal dark:text-attendly-mint flex items-center justify-center text-[10px]">
                          {idx + 1}
                        </span>
                        <div>
                          <div className="font-semibold text-attendly-text-primary dark:text-attendly-text-darkPrimary">
                            {formatTime(sess.joinedAt, config.timeFormat)} →{" "}
                            {sess.leftAt ? formatTime(sess.leftAt, config.timeFormat) : "Active at close"}
                          </div>
                          <span className="text-[10px] text-attendly-text-muted">
                            Confidence: {sess.confidence}
                          </span>
                        </div>
                      </div>
                      <div className="font-bold text-attendly-teal dark:text-attendly-mint">
                        {formatDuration(sess.durationMs)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-attendly-text-muted">
                Select an attendee from the dropdown or click the details arrow in the attendee table.
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Diagnostics */}
        {activeTab === "diagnostics" && (
          <div className="bg-white dark:bg-attendly-card-dark rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-attendly-text-primary dark:text-attendly-text-darkPrimary">
                Tracking Diagnostics & Audit Log
              </h3>
              <p className="text-xs text-attendly-text-muted dark:text-attendly-text-darkMuted">
                Events recorded during attendance monitoring (list virtualization, identity collisions, pauses).
              </p>
            </div>

            {data && data.diagnostics.length > 0 ? (
              <div className="space-y-2">
                {data.diagnostics.map((d) => (
                  <div
                    key={d.id}
                    className="p-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/30 flex items-start justify-between text-xs gap-3"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                            d.severity === "warning"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                              : d.severity === "error"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                          }`}
                        >
                          {d.severity}
                        </span>
                        <span className="font-semibold text-attendly-text-primary dark:text-attendly-text-darkPrimary">
                          {d.code}
                        </span>
                      </div>
                      <p className="text-attendly-text-secondary dark:text-attendly-text-darkSecondary">
                        {d.message}
                      </p>
                    </div>
                    <span className="text-[10px] text-attendly-text-muted shrink-0">
                      {formatTime(d.timestamp, config.timeFormat)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-attendly-text-muted">
                No diagnostic issues or anomalies recorded during this meeting.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
