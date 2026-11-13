import React from "react";
import { Settings, ExternalLink, Moon, Sun } from "lucide-react";

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenDashboard: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSettings,
  onOpenDashboard,
  isDark,
  onToggleTheme,
}) => {
  return (
    <header className="flex items-center justify-between px-4 py-3 bg-attendly-teal text-white border-b border-attendly-teal-600 shadow-sm">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-attendly-mint flex items-center justify-center shadow-inner">
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
          <div className="flex items-center gap-1.5">
            <h1 className="font-bold text-base tracking-tight leading-none">Attendly</h1>
            <span className="text-[10px] font-medium bg-attendly-mint/20 text-attendly-mint px-1.5 py-0.5 rounded-full">
              BETA
            </span>
          </div>
          <p className="text-[11px] text-attendly-mint/80 font-normal leading-tight mt-0.5">
            Every Presence Counts.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={onToggleTheme}
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          className="p-1.5 rounded-md hover:bg-attendly-teal-600 text-attendly-mint/90 hover:text-white transition-colors"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          onClick={onOpenDashboard}
          title="Open Full Dashboard in new tab"
          className="p-1.5 rounded-md hover:bg-attendly-teal-600 text-attendly-mint/90 hover:text-white transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
        </button>

        <button
          onClick={onOpenSettings}
          title="Settings"
          className="p-1.5 rounded-md hover:bg-attendly-teal-600 text-attendly-mint/90 hover:text-white transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
