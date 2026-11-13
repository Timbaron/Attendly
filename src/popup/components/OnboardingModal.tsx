import React, { useState } from "react";
import { ChevronRight, Shield, Users, Download, Play } from "lucide-react";

interface OnboardingModalProps {
  isOpen: boolean;
  onComplete: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onComplete,
}) => {
  const [step, setStep] = useState(0);

  if (!isOpen) return null;

  const steps = [
    {
      icon: <Users className="w-8 h-8 text-attendly-teal dark:text-attendly-mint" />,
      title: "Welcome to Attendly",
      tagline: "Every Presence Counts.",
      desc: "Attendly is a privacy-first, local Chrome extension designed to effortlessly track attendance during your Google Meet sessions.",
    },
    {
      icon: <Play className="w-8 h-8 text-attendly-teal dark:text-attendly-mint" />,
      title: "One-Click Attendance Tracking",
      tagline: "Seamless in-meeting detection",
      desc: "Join any Google Meet call and click 'Start Tracking'. Attendly records join/leave timestamps, detects reconnections, and calculates total time.",
    },
    {
      icon: <Users className="w-8 h-8 text-attendly-teal dark:text-attendly-mint" />,
      title: "Keep the People Tab Open",
      tagline: "High-accuracy observation",
      desc: "For meetings with many participants, keep Google Meet's 'People' tab open so Attendly can observe all attendees without missing virtualized rows.",
    },
    {
      icon: <Download className="w-8 h-8 text-attendly-teal dark:text-attendly-mint" />,
      title: "Download Instant Reports",
      tagline: "Excel, CSV & PDF",
      desc: "Stop tracking at any point and export professional, multi-sheet Excel workbooks, standard CSVs, or branded PDF attendance summaries.",
    },
    {
      icon: <Shield className="w-8 h-8 text-attendly-teal dark:text-attendly-mint" />,
      title: "100% Private & Local",
      tagline: "No servers. No database. No tracking.",
      desc: "All calculations run exclusively in your browser. No participant names, meeting titles, or timestamps ever leave your machine.",
    },
  ];

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white dark:bg-attendly-card-dark rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 p-5 flex flex-col text-center">
        {/* Step icon */}
        <div className="w-14 h-14 mx-auto rounded-2xl bg-attendly-teal/10 dark:bg-attendly-mint/10 flex items-center justify-center mb-3">
          {current.icon}
        </div>

        <h3 className="text-base font-bold text-attendly-text-primary dark:text-attendly-text-darkPrimary">
          {current.title}
        </h3>
        <p className="text-xs font-semibold text-attendly-teal dark:text-attendly-mint mt-0.5">
          {current.tagline}
        </p>

        <p className="text-xs text-attendly-text-secondary dark:text-attendly-text-darkSecondary mt-2 leading-relaxed">
          {current.desc}
        </p>

        {/* Dots */}
        <div className="flex items-center justify-center gap-1.5 my-4">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step
                  ? "w-5 bg-attendly-teal dark:bg-attendly-mint"
                  : "w-1.5 bg-gray-200 dark:bg-gray-700"
              }`}
            />
          ))}
        </div>

        {/* Action Button */}
        <button
          onClick={() => {
            if (isLast) {
              onComplete();
            } else {
              setStep((s) => s + 1);
            }
          }}
          className="w-full py-2 px-4 rounded-xl bg-attendly-teal text-attendly-mint font-semibold text-xs flex items-center justify-center gap-1 hover:bg-attendly-teal-600 active:scale-[0.99] transition-all shadow-sm"
        >
          {isLast ? "Get Started" : "Continue"}
          {!isLast && <ChevronRight className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};
