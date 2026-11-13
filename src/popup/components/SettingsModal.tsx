import React from "react";
import { X, ShieldCheck } from "lucide-react";
import { TrackingSessionConfig } from "../../types/attendance";

interface SettingsModalProps {
  config: TrackingSessionConfig;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: Partial<TrackingSessionConfig>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  config,
  isOpen,
  onClose,
  onSave,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white dark:bg-attendly-card-dark rounded-xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-bold text-attendly-text-primary dark:text-attendly-text-darkPrimary">
            Attendly Settings
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto text-xs">
          {/* Grace Period */}
          <div>
            <label className="block font-medium text-attendly-text-primary dark:text-attendly-text-darkPrimary mb-1">
              Late Arrival Grace Period (minutes)
            </label>
            <input
              type="number"
              min="0"
              max="120"
              value={config.gracePeriodMinutes}
              onChange={(e) =>
                onSave({ gracePeriodMinutes: Math.max(0, parseInt(e.target.value, 10) || 0) })
              }
              className="w-full px-3 py-1.5 border border-gray-200 dark:border-gray-800 rounded-lg bg-transparent text-attendly-text-primary dark:text-attendly-text-darkPrimary"
            />
            <p className="text-[10px] text-attendly-text-muted dark:text-attendly-text-darkMuted mt-1">
              Attendees joining after this threshold from tracking start are marked late.
            </p>
          </div>

          {/* Expected Meeting Duration */}
          <div>
            <label className="block font-medium text-attendly-text-primary dark:text-attendly-text-darkPrimary mb-1">
              Expected Duration (minutes)
            </label>
            <input
              type="number"
              min="1"
              max="600"
              value={config.expectedDurationMinutes || 60}
              onChange={(e) =>
                onSave({
                  expectedDurationMinutes: Math.max(1, parseInt(e.target.value, 10) || 60),
                })
              }
              className="w-full px-3 py-1.5 border border-gray-200 dark:border-gray-800 rounded-lg bg-transparent text-attendly-text-primary dark:text-attendly-text-darkPrimary"
            />
          </div>

          {/* Early Departure Threshold */}
          <div>
            <label className="block font-medium text-attendly-text-primary dark:text-attendly-text-darkPrimary mb-1">
              Early Departure Threshold (minutes)
            </label>
            <input
              type="number"
              min="0"
              max="60"
              value={config.earlyDepartureThresholdMinutes}
              onChange={(e) =>
                onSave({
                  earlyDepartureThresholdMinutes: Math.max(0, parseInt(e.target.value, 10) || 0),
                })
              }
              className="w-full px-3 py-1.5 border border-gray-200 dark:border-gray-800 rounded-lg bg-transparent text-attendly-text-primary dark:text-attendly-text-darkPrimary"
            />
          </div>

          {/* Time Format */}
          <div>
            <label className="block font-medium text-attendly-text-primary dark:text-attendly-text-darkPrimary mb-1">
              Time Format
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => onSave({ timeFormat: "12h" })}
                className={`flex-1 py-1.5 rounded-lg border text-center font-medium ${
                  config.timeFormat === "12h"
                    ? "border-attendly-teal bg-attendly-teal/10 text-attendly-teal dark:border-attendly-mint dark:bg-attendly-mint/10 dark:text-attendly-mint"
                    : "border-gray-200 dark:border-gray-800 text-gray-500"
                }`}
              >
                12-Hour (AM/PM)
              </button>
              <button
                onClick={() => onSave({ timeFormat: "24h" })}
                className={`flex-1 py-1.5 rounded-lg border text-center font-medium ${
                  config.timeFormat === "24h"
                    ? "border-attendly-teal bg-attendly-teal/10 text-attendly-teal dark:border-attendly-mint dark:bg-attendly-mint/10 dark:text-attendly-mint"
                    : "border-gray-200 dark:border-gray-800 text-gray-500"
                }`}
              >
                24-Hour
              </button>
            </div>
          </div>

          {/* Exclude Host */}
          <div className="flex items-center justify-between pt-1">
            <span className="font-medium text-attendly-text-primary dark:text-attendly-text-darkPrimary">
              Exclude Meeting Host from Report
            </span>
            <input
              type="checkbox"
              checked={config.excludeHost}
              onChange={(e) => onSave({ excludeHost: e.target.checked })}
              className="w-4 h-4 accent-attendly-teal rounded"
            />
          </div>

          {/* Privacy Notice */}
          <div className="p-3 bg-attendly-teal/5 dark:bg-attendly-mint/5 rounded-lg border border-attendly-teal/10 dark:border-attendly-mint/10 flex items-start gap-2 text-[11px] text-attendly-teal-700 dark:text-attendly-mint">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Local-Only Processing</p>
              <p className="opacity-90 mt-0.5">
                Attendly has no backend or external database. All attendance processing occurs exclusively within your Chrome browser.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 text-right">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-attendly-teal text-attendly-mint font-semibold text-xs hover:bg-attendly-teal-600"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
