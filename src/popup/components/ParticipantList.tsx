import React, { useState } from "react";
import { ParticipantAttendance } from "../../types/attendance";
import { formatDuration, formatTime } from "../../utils/time";
import { Search } from "lucide-react";

interface ParticipantListProps {
  participants: Record<string, ParticipantAttendance>;
  timeFormat: "12h" | "24h";
}

export const ParticipantList: React.FC<ParticipantListProps> = ({
  participants,
  timeFormat,
}) => {
  const [search, setSearch] = useState("");

  const list = Object.values(participants).filter((p) =>
    p.displayName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 px-4 pb-3">
      {/* Search Header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-attendly-text-muted dark:text-attendly-text-darkMuted">
          Attendees ({list.length})
        </h3>
      </div>

      <div className="relative mb-2">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Filter attendees..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-attendly-card-dark border border-gray-200 dark:border-gray-800 rounded-lg text-xs text-attendly-text-primary dark:text-attendly-text-darkPrimary placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-attendly-teal dark:focus:ring-attendly-mint"
        />
      </div>

      {/* Scrollable List */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
        {list.length === 0 ? (
          <div className="py-6 text-center text-xs text-attendly-text-muted dark:text-attendly-text-darkMuted">
            {search ? "No matching attendees found." : "No attendees observed yet."}
          </div>
        ) : (
          list.map((p) => {
            const isPresent = p.status === "present";
            const isLeft = p.status === "left";

            return (
              <div
                key={p.id}
                className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-attendly-card-dark border border-gray-100 dark:border-gray-800 shadow-2xs hover:border-attendly-teal/20 transition-all text-xs"
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  {p.avatarUrl ? (
                    <img
                      src={p.avatarUrl}
                      alt={p.displayName}
                      className="w-6 h-6 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-attendly-teal/10 dark:bg-attendly-mint/20 text-attendly-teal dark:text-attendly-mint flex items-center justify-center font-bold text-[10px] shrink-0">
                      {p.displayName.charAt(0).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-attendly-text-primary dark:text-attendly-text-darkPrimary truncate">
                        {p.displayName}
                      </span>
                      {p.isLate && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 font-semibold">
                          Late
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-attendly-text-muted dark:text-attendly-text-darkMuted">
                      Joined {formatTime(p.firstJoinedAt, timeFormat)}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="font-semibold text-attendly-text-primary dark:text-attendly-text-darkPrimary">
                    {formatDuration(p.totalDurationMs)}
                  </div>
                  <span
                    className={`inline-block text-[9px] font-medium px-1.5 py-0.2 rounded-full ${
                      isPresent
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : isLeft
                        ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                    }`}
                  >
                    {p.status}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
