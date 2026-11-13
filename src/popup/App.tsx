import React, { useEffect, useState, useMemo } from "react";
import { Header } from "./components/Header";
import { StatusCard } from "./components/StatusCard";
import { Controls } from "./components/Controls";
import { ParticipantList } from "./components/ParticipantList";
import { SettingsModal } from "./components/SettingsModal";
import { OnboardingModal } from "./components/OnboardingModal";
import { MeetingAttendanceData, TrackingSessionConfig } from "../types/attendance";
import { computeSummaryStats } from "../attendance/attendance-calculator";
import { DEFAULT_CONFIG } from "../attendance/attendance-engine";
import { StorageService } from "../storage/session-storage";
import { downloadExcelReport } from "../exports/excel-export";
import { downloadCsvReport } from "../exports/csv-export";
import { downloadPdfReport } from "../exports/pdf-export";

export const App: React.FC = () => {
  const [data, setData] = useState<MeetingAttendanceData | null>(null);
  const [config, setConfig] = useState<TrackingSessionConfig>(DEFAULT_CONFIG);
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // 1. Initial setup and tab discovery
  useEffect(() => {
    // Check onboarding status
    chrome.storage.local.get("attendly_onboarding_completed", (res) => {
      if (!res.attendly_onboarding_completed) {
        setShowOnboarding(true);
      }
    });

    // Load saved preferences
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

    // Query active Google Meet tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab?.id && tab.url?.includes("meet.google.com")) {
        setActiveTabId(tab.id);
        fetchMeetingState(tab.id);
      } else {
        // Check if there is any other open Meet tab
        chrome.tabs.query({ url: "https://meet.google.com/*" }, (meetTabs) => {
          if (meetTabs[0]?.id) {
            setActiveTabId(meetTabs[0].id);
            fetchMeetingState(meetTabs[0].id);
          } else {
            // Check if there is a saved recent draft
            StorageService.getLastSessionDraft().then((draft) => {
              if (draft) {
                setData(draft);
              }
            });
          }
        });
      }
    });

    // Listen for live updates from content script
    const messageListener = (msg: any) => {
      if (msg.type === "MEETING_STATE_UPDATE" && msg.data) {
        setData(msg.data);
      }
    };
    chrome.runtime.onMessage.addListener(messageListener);

    // Refresh ticker for elapsed time
    const ticker = setInterval(() => {
      setData((prev) => (prev ? { ...prev } : null));
    }, 1000);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
      clearInterval(ticker);
    };
  }, []);

  const fetchMeetingState = (tabId: number) => {
    chrome.tabs.sendMessage(tabId, { type: "GET_MEETING_STATE" }, (response) => {
      if (chrome.runtime.lastError) {
        return;
      }
      if (response?.data) {
        setData(response.data);
      }
    });
  };

  const sendTabMessage = (msg: any) => {
    if (!activeTabId) return;
    chrome.tabs.sendMessage(activeTabId, msg, (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.data) {
        setData(response.data);
      }
    });
  };

  const handleStart = () => sendTabMessage({ type: "START_TRACKING", config });
  const handlePause = () => sendTabMessage({ type: "PAUSE_TRACKING" });
  const handleResume = () => sendTabMessage({ type: "RESUME_TRACKING" });
  const handleStop = () => sendTabMessage({ type: "STOP_TRACKING" });
  const handleDiscard = () => sendTabMessage({ type: "DISCARD_SESSION" });

  const handleOpenDashboard = () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("dashboard.html") });
  };

  const handleToggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    document.documentElement.classList.toggle("dark", nextDark);
    const newTheme = nextDark ? "dark" : "light";
    StorageService.savePreferences({ theme: newTheme });
  };

  const handleSaveSettings = (updated: Partial<TrackingSessionConfig>) => {
    const newConfig = { ...config, ...updated };
    setConfig(newConfig);
    StorageService.savePreferences(updated);
    if (activeTabId) {
      sendTabMessage({ type: "UPDATE_CONFIG", config: updated });
    }
  };

  const handleCompleteOnboarding = () => {
    chrome.storage.local.set({ attendly_onboarding_completed: true });
    setShowOnboarding(false);
  };

  const handleExport = (format: "xlsx" | "csv" | "pdf") => {
    if (!data) return;
    if (format === "xlsx") {
      downloadExcelReport(data);
    } else if (format === "csv") {
      downloadCsvReport(data);
    } else if (format === "pdf") {
      downloadPdfReport(data);
    }
  };

  const stats = useMemo(() => {
    return computeSummaryStats(
      data?.participants || {},
      data?.trackingStartedAt || null,
      data?.trackingStoppedAt || null,
      data?.totalPausedDurationMs || 0,
      new Date().toISOString()
    );
  }, [data]);

  const hasParticipants = Boolean(
    data && Object.keys(data.participants).length > 0
  );

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-attendly-bg-light dark:bg-attendly-bg-dark">
      <Header
        onOpenSettings={() => setShowSettings(true)}
        onOpenDashboard={handleOpenDashboard}
        isDark={isDark}
        onToggleTheme={handleToggleTheme}
      />

      <StatusCard data={data} stats={stats} />

      <Controls
        trackingState={data?.trackingState || "not_in_meeting"}
        hasParticipants={hasParticipants}
        onStart={handleStart}
        onPause={handlePause}
        onResume={handleResume}
        onStop={handleStop}
        onDiscard={handleDiscard}
        onExport={handleExport}
      />

      <ParticipantList
        participants={data?.participants || {}}
        timeFormat={config.timeFormat}
      />

      <SettingsModal
        config={config}
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onSave={handleSaveSettings}
      />

      <OnboardingModal
        isOpen={showOnboarding}
        onComplete={handleCompleteOnboarding}
      />
    </div>
  );
};
