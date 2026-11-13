import React, { useState } from "react";
import {
  Play,
  Pause,
  Square,
  Download,
  Trash2,
  FileSpreadsheet,
  FileText,
  FileCode,
  ChevronDown,
} from "lucide-react";
import { TrackingState } from "../../types/attendance";

interface ControlsProps {
  trackingState: TrackingState;
  hasParticipants: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onDiscard: () => void;
  onExport: (format: "xlsx" | "csv" | "pdf") => void;
}

export const Controls: React.FC<ControlsProps> = ({
  trackingState,
  hasParticipants,
  onStart,
  onPause,
  onResume,
  onStop,
  onDiscard,
  onExport,
}) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showConfirmDiscard, setShowConfirmDiscard] = useState(false);

  const canStart =
    trackingState === "ready" || trackingState === "stopped" || trackingState === "meeting_detected";
  const isTracking = trackingState === "tracking";
  const isPaused = trackingState === "paused";
  const canExport = hasParticipants;

  return (
    <div className="px-4 py-2 space-y-2">
      <div className="flex items-center gap-2">
        {/* Main Action Button */}
        {canStart && (
          <button
            onClick={onStart}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-attendly-teal hover:bg-attendly-teal-600 active:scale-[0.99] text-attendly-mint font-semibold text-xs transition-all shadow-xs"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            Start Tracking
          </button>
        )}

        {isTracking && (
          <>
            <button
              onClick={onPause}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-white font-semibold text-xs transition-all shadow-xs"
            >
              <Pause className="w-3.5 h-3.5 fill-current" />
              Pause
            </button>
            <button
              onClick={onStop}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-semibold text-xs transition-all shadow-xs"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              Stop
            </button>
          </>
        )}

        {isPaused && (
          <>
            <button
              onClick={onResume}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-semibold text-xs transition-all shadow-xs"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Resume
            </button>
            <button
              onClick={onStop}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-semibold text-xs transition-all shadow-xs"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              Stop
            </button>
          </>
        )}

        {/* Export Dropdown */}
        <div className="relative">
          <button
            disabled={!canExport}
            onClick={() => setShowExportMenu(!showExportMenu)}
            className={`flex items-center gap-1 py-2 px-3 rounded-lg border font-medium text-xs transition-all ${
              canExport
                ? "border-attendly-teal/30 dark:border-attendly-mint/30 text-attendly-teal dark:text-attendly-mint hover:bg-attendly-teal/5 dark:hover:bg-attendly-mint/5"
                : "border-gray-200 dark:border-gray-800 text-gray-400 cursor-not-allowed"
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
            <ChevronDown className="w-3 h-3 ml-0.5 opacity-70" />
          </button>

          {showExportMenu && canExport && (
            <div className="absolute right-0 bottom-full mb-1 w-36 bg-white dark:bg-attendly-card-dark rounded-lg shadow-lg border border-gray-100 dark:border-gray-800 py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
              <button
                onClick={() => {
                  onExport("xlsx");
                  setShowExportMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-attendly-text-primary dark:text-attendly-text-darkPrimary hover:bg-attendly-mint/10 text-left"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                Excel (.xlsx)
              </button>
              <button
                onClick={() => {
                  onExport("csv");
                  setShowExportMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-attendly-text-primary dark:text-attendly-text-darkPrimary hover:bg-attendly-mint/10 text-left"
              >
                <FileCode className="w-3.5 h-3.5 text-blue-600" />
                CSV (.csv)
              </button>
              <button
                onClick={() => {
                  onExport("pdf");
                  setShowExportMenu(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-attendly-text-primary dark:text-attendly-text-darkPrimary hover:bg-attendly-mint/10 text-left"
              >
                <FileText className="w-3.5 h-3.5 text-rose-600" />
                PDF (.pdf)
              </button>
            </div>
          )}
        </div>

        {/* Discard Session Button */}
        {hasParticipants && (
          <button
            onClick={() => setShowConfirmDiscard(true)}
            title="Discard current session"
            className="p-2 rounded-lg text-gray-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Confirmation Modal for Discarding */}
      {showConfirmDiscard && (
        <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-[11px] space-y-2">
          <p className="font-semibold text-rose-900 dark:text-rose-200">
            Discard this attendance session?
          </p>
          <p className="text-rose-700 dark:text-rose-300">
            All unsaved attendance records for this meeting will be permanently cleared.
          </p>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={() => setShowConfirmDiscard(false)}
              className="px-2.5 py-1 rounded bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setShowConfirmDiscard(false);
                onDiscard();
              }}
              className="px-2.5 py-1 rounded bg-rose-600 text-white font-medium hover:bg-rose-700"
            >
              Yes, Discard
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
