# Attendly — Google Meet Attendance Tracker

> **Every Presence Counts.**
> A lightweight, privacy-first Chrome Extension that tracks attendance during Google Meet meetings, calculates true time spent, detects reconnections, and exports downloadable Excel, CSV, and PDF reports — 100% locally in your browser.

---

## 1. Features at a Glance

- **Automated Participant Observation:** Observes participants joining and departing Google Meet calls in real time.
- **Accurate Duration Calculation:** Computes true attendance time by summing discrete attendance sessions, correctly accounting for drop-offs and reconnections.
- **Late Arrival & Early Departure Flags:** Configure a custom grace period and expected meeting duration to automatically highlight late arrivals and early departures.
- **Pause & Resume Tracking:** Pause monitoring during breaks or confidential sessions; unobserved intervals are never credited to attendees.
- **Professional Reports:**
  - **Excel (.xlsx):** Multi-sheet workbook including Meeting Summary, Attendee Table, Session Intervals, and Tracking Diagnostics.
  - **CSV (.csv):** Standard RFC 4180 format with spreadsheet formula injection protection.
  - **PDF (.pdf):** Styled, branded, multi-page vector PDF report with summary blocks and attendee records.
- **Full Tab Dashboard:** In addition to the compact 390px extension popup, launch the comprehensive local dashboard (`dashboard.html`) in a full Chrome tab.
- **100% Local & Private:** No backend, no external database, no accounts, no cloud sync, and zero third-party analytics.

---

## 2. Supported Platforms

- **Currently Supported:** Google Meet (`https://meet.google.com/*`)
- **Planned Future Support:** Zoom Web Client and Microsoft Teams Web

---

## 3. Quick Start & Manual Installation

For full step-by-step instructions with troubleshooting, see [MANUAL_INSTALLATION.md](docs/MANUAL_INSTALLATION.md).

1. Download the versioned beta release: `attendly-v0.1.0-beta.zip`.
2. Extract the ZIP into a permanent folder on your computer.
3. Open Google Chrome and go to `chrome://extensions`.
4. Turn on **Developer mode** in the top-right corner.
5. Click **Load unpacked** in the top-left corner and select the extracted folder containing `manifest.json`.
6. Pin Attendly to your Chrome toolbar.
7. Open [meet.google.com](https://meet.google.com), join a meeting, and click **Start Tracking**!

---

## 4. Development Setup

### Prerequisites
- Node.js `v18.0.0` or newer (Tested on Node `v24.22.1`)
- npm `v9.0.0` or newer

### Installation
```bash
# Clone or navigate to the project directory
cd Attendly

# Install dependencies
npm install
```

### Development Commands
```bash
# Run local Vite development server
npm run dev

# Run TypeScript type check
npm run typecheck

# Run unit and export test suite with Vitest
npm run test

# Run tests in watch mode
npm run test:watch

# Build production Chrome Extension into dist/
npm run build

# Package production extension into release/attendly-v0.1.0-beta.zip for testers
npm run package:test
```

---

## 5. How Attendance Tracking Works

1. **Lifecycle Detection:** Attendly detects whether you are on the Google Meet homepage, in the lobby/green room ("Ready to join?"), actively in a call, or on the post-call exit screen.
2. **Observation Cascade:**
   - **Primary:** Google Meet's **People** panel (`div[role='tabpanel']`) reads attendee names, avatars, and host badges.
   - **Secondary:** Visible video grid tiles (`[data-requested-participant-id]`, `[data-self-name]`) provide fallback detection when the People panel is closed.
   - **Counter Correlation:** Compares observed DOM items against the total attendee count badge in Meet to detect DOM list virtualization.
3. **Controlled Reconciliation:** Attendly uses a 2-second reconciliation interval combined with a `MutationObserver`. Departures are debounced across multiple cycles so temporary DOM recycling does not trigger false leaves.
4. **Reconnection Handling:** If an attendee disconnects and reconnects, Attendly opens a new discrete `AttendanceSession`. Total attendance duration is strictly calculated as the sum of valid session intervals:
   $$\text{Total Duration} = \sum_{i=1}^n (\text{LeftAt}_i - \text{JoinedAt}_i)$$
   Attendly never calculates attendance duration as $(\text{LastLeft} - \text{FirstJoin})$.

---

## 6. Security and Privacy Guarantee

- **No Remote Transmission:** Attendance data never leaves your computer.
- **No Video/Audio Access:** Attendly does not request microphone, camera, or screen recording permissions.
- **Formula Injection Protection:** All exported CSV and Excel values are sanitized to neutralize formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`).
- **Scoped Host Permissions:** Narrowly scoped to `https://meet.google.com/*`.

For complete privacy documentation, see [PRIVACY.md](docs/PRIVACY.md).

---

## 7. Project Structure

```text
Attendly/
├── public/
│   └── icons/                 # Extension PNG icons (16, 32, 48, 128)
├── src/
│   ├── background/
│   │   └── service-worker.ts  # MV3 Service Worker (badging, tabs)
│   ├── content/
│   │   ├── meeting-detector.ts # Page state recognition (lobby, in-call, left)
│   │   ├── meet-adapter.ts     # Resilient selector cascade & virtualization check
│   │   ├── meet-observer.ts    # MutationObserver & throttled reconciliation ticker
│   │   └── content-script.ts   # In-page controller & messaging
│   ├── attendance/
│   │   ├── attendance-engine.ts     # State machine (Start, Pause, Resume, Stop)
│   │   ├── session-manager.ts       # Discrete interval manager & departure debouncer
│   │   ├── attendance-calculator.ts # Duration, late arrival, early leave math
│   │   └── participant-identity.ts  # Disambiguation & duplicate name handling
│   ├── popup/
│   │   ├── App.tsx             # 390px extension popup application
│   │   ├── index.tsx
│   │   └── components/         # Header, StatusCard, Controls, ParticipantList
│   ├── dashboard/
│   │   ├── App.tsx             # Full tab dashboard application
│   │   └── index.tsx
│   ├── exports/
│   │   ├── excel-export.ts     # ExcelJS 4-sheet workbook generator
│   │   ├── csv-export.ts       # RFC 4180 CSV with formula sanitization
│   │   └── pdf-export.ts       # jsPDF + AutoTable branded reports
│   ├── storage/
│   │   └── session-storage.ts  # chrome.storage.session & local draft persistence
│   ├── types/
│   ├── utils/
│   └── styles/
├── tests/
│   ├── setup.ts
│   ├── attendance-engine.test.ts # State machine and interval tests
│   └── exports.test.ts           # Excel, CSV, PDF, and sanitization tests
├── scripts/
│   ├── generate-icons.cjs      # Pure Node PNG icon generator
│   └── package-test.cjs        # Production tester ZIP packager
├── docs/
│   ├── ARCHITECTURE.md
│   ├── TESTING.md
│   ├── MANUAL_INSTALLATION.md
│   ├── PRIVACY.md
│   └── CHROME_STORE_RELEASE.md
├── manifest.json
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

---

## 8. License

Private / Proprietary. All rights reserved.
