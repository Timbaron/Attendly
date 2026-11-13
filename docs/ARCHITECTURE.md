# Attendly Architecture & Technical Specification

```
Attendly Extension
├── Content Script (meet.google.com isolated context)
│   ├── MeetingDetector: Detects homepage, lobby, in-call, left-call
│   ├── MeetAdapter: Resilient selector cascade, People panel parser, grid tile reader
│   ├── MeetObserver: MutationObserver + 2-second controlled reconciliation ticker
│   └── ContentScriptController: Messaging bridge & lifecycle coordinator
│
├── Pure TypeScript Attendance Engine (Zero DOM dependencies, 100% testable)
│   ├── AttendanceEngine: State machine (IDLE -> READY -> TRACKING -> PAUSED -> STOPPED)
│   ├── SessionManager: Manages discrete session intervals, debounced departures
│   ├── AttendanceCalculator: Discrete duration sum, late arrival, early leave, % math
│   └── ParticipantIdentity: Resolves identities, handles duplicate name disambiguation
│
├── Local State & Persistence
│   ├── Memory: Real-time tracking cache inside content script
│   ├── chrome.storage.session: Preserves state across popup open/close & SW sleep
│   └── chrome.storage.local: User preferences (theme, grace period) & crash draft
│
├── Background Service Worker (Manifest V3)
│   ├── Badge Updater: Renders live participant count ("12") or "PAUSE"
│   ├── Tab Lifecycle: Tracks active Meet tabs and coordinates dashboard tab launch
│   └── Zero cloud network traffic
│
├── User Interfaces (React + Tailwind CSS)
│   ├── Extension Popup: 390px compact panel with live counters, attendee search, controls
│   └── Full Dashboard: Multi-tab responsive report explorer (`dashboard.html`)
│
└── Export Engine
    ├── ExcelJS: 4 worksheets (Summary, Attendance, Sessions, Diagnostics)
    ├── CSV: RFC 4180 with spreadsheet formula injection protection
    └── jsPDF + AutoTable: Styled, branded, multi-page vector PDF reports
```

---

## 1. Google Meet Observation Strategy

Google Meet does not provide a public DOM API. To ensure resilience against obfuscated class names and interface changes, Attendly utilizes a **Prioritized Adapter Cascade**:

1. **Semantic ARIA Attributes:** Queries `role="tabpanel"`, `role="listitem"`, `aria-label*="people"`, and `aria-label*="show everyone"`.
2. **Stable Data Attributes:** Queries `[data-participant-id]`, `[data-requested-participant-id]`, and `[data-self-name]`.
3. **Badge Counter Correlation:** Extracts total attendees from the Meet header badge (e.g. `(24)`) to detect DOM virtualization.

---

## 2. Invariant Attendance Calculation Rules

1. **Sum of Intervals:** Total attendance duration is strictly calculated as:
   $$\text{Total Duration} = \sum_{i=1}^{n} (\text{LeftAt}_i - \text{JoinedAt}_i)$$
   It is never computed as $(\text{LastLeft} - \text{FirstJoin})$.
2. **Paused Intervals:** Paused time is tracked in `totalPausedDurationMs` and deducted from reference duration. Attendees receive no attendance credit for paused periods.
3. **Formula Injection Sanitization:** Any value starting with `=`, `+`, `-`, `@`, `\t`, or `\r` is escaped with a single quote (`'`) to protect spreadsheet users.

---

## 3. Extensibility for Additional Platforms

The core `AttendanceEngine`, `SessionManager`, `AttendanceCalculator`, and export generators have **zero DOM dependencies**.

To support Zoom Web Client or Microsoft Teams in the future, only a new platform adapter implementing the standard observation interface is required:

```typescript
interface PlatformAdapter {
  isMeetingActive(): boolean;
  captureSnapshot(): MeetObservationSnapshot;
}
```
