import React from "react";
import { MeetingAttendanceData, ParticipantSummaryStats } from "../../types/attendance";
import { formatDuration, formatTime } from "../../utils/time";
import { Clock, AlertTriangle, RefreshCw } from "lucide-react";

interface StatusCardProps {
  data: MeetingAttendanceData | null;
  stats: ParticipantSummaryStats;
  detectedMeetingCode?: string | null;
  needsReload?: boolean;
  onReloadTab?: () => void;
}

export const StatusCard: React.FC<StatusCardProps> = ({
  data,
  stats,
  detectedMeetingCode,
  needsReload,
  onReloadTab,
}) => {
  if (!data) {
    if (needsReload) {
      return (
        <div className="p-4 bg-white dark:bg-attendly-card-dark rounded-xl border border-attendly-teal/20 dark:border-attendly-mint/20 shadow-sm mx-4 mt-3 text-center space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Meeting Detected: {detectedMeetingCode || "Google Meet"}
          </div>
          <p className="text-xs text-attendly-text-secondary dark:text-attendly-text-darkSecondary">
            To activate Attendly on this meeting tab, please reload the tab once.
          </p>
          {onReloadTab && (
            <button
              onClick={onReloadTab}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-attendly-teal text-attendly-mint font-semibold text-xs hover:bg-attendly-teal-600 transition-all shadow-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Reload Tab & Connect
            </button>
          )}
        </div>
      );
    }

    if (detectedMeetingCode) {
      return (
        <div className="p-4 bg-white dark:bg-attendly-card-dark rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm mx-4 mt-3 text-center space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            Connecting to {detectedMeetingCode}...
          </div>
          <p className="text-xs text-attendly-text-muted dark:text-attendly-text-darkMuted">
            Synchronizing with Google Meet session...
          </p>
        </div>
      );
    }

    return (
      <div className="p-4 bg-white dark:bg-attendly-card-dark rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm mx-4 mt-3 text-center">
        <p className="text-sm font-medium text-attendly-text-secondary dark:text-attendly-text-darkSecondary">
          No Google Meet tab detected.
        </p>
        <p className="text-xs text-attendly-text-muted dark:text-attendly-text-darkMuted mt-1">
          Open a Google Meet meeting to begin tracking.
        </p>
      </div>
    );
  }

  const { trackingState, meeting, virtualizationDetected, peoplePanelOpen } = data;

  const getStatusBadge = () => {
    switch (trackingState) {
      case "not_in_meeting":
        return {
          label: "Not in Meeting",
          bg: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
          dot: "bg-gray-400",
        };
      case "meeting_detected":
        return {
          label: "In Lobby / Pre-join",
          bg: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
          dot: "bg-amber-500",
        };
      case "ready":
        return {
          label: "Ready to Track",
          bg: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
          dot: "bg-blue-500",
        };
      case "tracking":
        return {
          label: "Live Tracking",
          bg: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
          dot: "bg-emerald-500 animate-pulse",
        };
      case "paused":
        return {
          label: "Tracking Paused",
          bg: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
          dot: "bg-amber-500",
        };
      case "stopped":
        return {
          label: "Report Ready",
          bg: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
          dot: "bg-purple-500",
        };
    }
  };

  const badge = getStatusBadge();

  return (
    <div className="mx-4 mt-3 space-y-2.5">
      {/* Status & Title Card */}
      <div className="p-3 bg-white dark:bg-attendly-card-dark rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm">
        <div className="flex items-center justify-between mb-1.5">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${badge.bg}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
            {badge.label}
          </span>

          <span className="text-[11px] font-mono font-medium text-attendly-text-muted dark:text-attendly-text-darkMuted">
            {meeting.meetingCode}
          </span>
        </div>

        <h2 className="text-sm font-semibold text-attendly-text-primary dark:text-attendly-text-darkPrimary truncate">
          {meeting.title || "Google Meet Session"}
        </h2>

        {data.trackingStartedAt && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-gray-800/80 text-[11px] text-attendly-text-secondary dark:text-attendly-text-darkSecondary">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-attendly-teal-400" />
              Started: {formatTime(data.trackingStartedAt, data.config.timeFormat)}
            </span>
            <span className="font-medium text-attendly-teal-600 dark:text-attendly-mint">
              Elapsed: {formatDuration(stats.elapsedTrackingMs)}
            </span>
          </div>
        )}
      </div>

      {/* Virtualization or Closed Panel Warning */}
      {!peoplePanelOpen && trackingState === "tracking" && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-[11px]">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <p>
            For best accuracy, open Google Meet's <strong>People</strong> panel.
          </p>
        </div>
      )}

      {virtualizationDetected && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-blue-900 dark:text-blue-200 text-[11px]">
          <AlertTriangle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p>
            Meet is virtualizing the participant list. Scroll through the People tab to verify all attendees.
          </p>
        </div>
      )}

      {/* Metric Pills */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-white dark:bg-attendly-card-dark p-2 rounded-lg border border-gray-100 dark:border-gray-800 text-center shadow-xs">
          <div className="text-[10px] text-attendly-text-muted dark:text-attendly-text-darkMuted uppercase tracking-wider font-semibold">
            Total
          </div>
          <div className="text-base font-bold text-attendly-teal dark:text-attendly-mint mt-0.5">
            {stats.totalUnique}
          </div>
        </div>

        <div className="bg-white dark:bg-attendly-card-dark p-2 rounded-lg border border-gray-100 dark:border-gray-800 text-center shadow-xs">
          <div className="text-[10px] text-attendly-text-muted dark:text-attendly-text-darkMuted uppercase tracking-wider font-semibold">
            Present
          </div>
          <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
            {stats.currentlyPresent}
          </div>
        </div>

        <div className="bg-white dark:bg-attendly-card-dark p-2 rounded-lg border border-gray-100 dark:border-gray-800 text-center shadow-xs">
          <div className="text-[10px] text-attendly-text-muted dark:text-attendly-text-darkMuted uppercase tracking-wider font-semibold">
            Departed
          </div>
          <div className="text-base font-bold text-gray-500 dark:text-gray-400 mt-0.5">
            {stats.confirmedDeparted}
          </div>
        </div>

        <div className="bg-white dark:bg-attendly-card-dark p-2 rounded-lg border border-gray-100 dark:border-gray-800 text-center shadow-xs">
          <div className="text-[10px] text-attendly-text-muted dark:text-attendly-text-darkMuted uppercase tracking-wider font-semibold">
            Late
          </div>
          <div className="text-base font-bold text-amber-600 dark:text-amber-400 mt-0.5">
            {stats.lateArrivals}
          </div>
        </div>
      </div>
    </div>
  );
};
