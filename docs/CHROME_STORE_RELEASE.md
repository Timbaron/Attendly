# Attendly — Chrome Web Store Release Guide

> [!IMPORTANT]
> **Do not submit Attendly to the Chrome Web Store without explicit user approval.**
> This guide outlines the store listing requirements, metadata, and review criteria prepared for eventual publication.

---

## 1. Store Listing Metadata

| Field | Content |
| :--- | :--- |
| **Extension Name** | Attendly — Google Meet Attendance Tracker |
| **Short Name** | Attendly |
| **Tagline** | Every Presence Counts. |
| **Category** | Productivity / Education |
| **Version** | `0.1.0` (Numeric format required by Chrome Web Store) |
| **Short Description** | Privacy-first attendance tracker for Google Meet. Track join/leave times, duration, and download Excel, CSV, and PDF reports. (128 chars) |

---

## 2. Detailed Description (for Store Listing)

```text
Attendly — Every Presence Counts.

Attendly is a lightweight, privacy-focused Chrome extension designed to track attendance during Google Meet meetings effortlessly. 

Built for teachers, educators, corporate team leads, fellowship organizers, and workshop facilitators, Attendly runs 100% locally in your browser. No accounts, no servers, no databases, and no cloud storage.

KEY FEATURES:
• Automated Participant Detection: Observes attendees joining and leaving Google Meet calls in real time.
• Accurate Attendance Duration: Accurately calculates true time spent in the meeting across reconnections and temporary drop-offs.
• Late Arrival & Early Departure Indicators: Set a custom grace period and easily spot attendees who joined late or left early.
• Pause & Resume: Pause observation during breaks or private discussions without distorting attendance metrics.
• Professional Report Generation: Download formatted reports instantly in Excel (.xlsx), CSV (.csv), or branded PDF format.
• Full Tab Dashboard: Open the comprehensive local dashboard for detailed session drilldowns and audit diagnostics.
• Light & Dark Themes: Modern, accessible interface designed with clean typography and intuitive controls.

100% PRIVACY GUARANTEE:
• Zero External Data Transmission: Attendance information never leaves your browser.
• No Registration: No accounts, emails, or sign-ins required.
• No Audio or Video Recording: Attendly does not access your microphone, camera, or video stream.
• No External Trackers: Completely free of analytics SDKs, advertising scripts, or third-party cookies.

HOW TO USE:
1. Join any Google Meet meeting (https://meet.google.com).
2. Click the Attendly icon in your browser toolbar.
3. Click "Start Tracking".
4. Keep Google Meet's "People" tab open for optimal participant visibility.
5. Click "Stop" and download your Excel, CSV, or PDF attendance report.
```

---

## 3. Visual Asset Specifications

1. **Extension Icons:**
   - `16x16`: Toolbar & favicon (generated in `public/icons/icon16.png`)
   - `32x32`: Windows high-DPI displays (`public/icons/icon32.png`)
   - `48x48`: Chrome extensions management page (`public/icons/icon48.png`)
   - `128x128`: Chrome Web Store listing & installation prompt (`public/icons/icon128.png`)
2. **Store Screenshots:**
   - Dimensions: `1280x800` pixels (or `640x400` pixels).
   - Format: JPEG or 24-bit PNG without transparency.
   - Recommended Screens:
     1. Attendly Popup tracking live meeting in Google Meet.
     2. Full Dashboard with Attendee Table and Session Drilldown.
     3. Sample multi-sheet Excel (.xlsx) and PDF report preview.
     4. Settings and Privacy reassurance drawer.

---

## 4. Permissions Justification (For Chrome Web Store Reviewers)

| Permission | Review Justification |
| :--- | :--- |
| `storage` | Required to temporarily store active attendance session data (`chrome.storage.session`) so tracking persists across popup opens/closes, and to store user preferences (theme, grace period) locally (`chrome.storage.local`). No data is sent off-device. |
| `tabs` | Required to read the URL and meeting code of the active Google Meet tab to prevent mixing attendance across different meetings, and to update the participant counter badge on the extension icon. |
| Host: `https://meet.google.com/*` | Strictly scoped to Google Meet meeting URLs. Required for the content script to observe participant names and join/leave events. Attendly requests zero access to any other website. |

---

## 5. Pre-Submission Quality Checklist

- [ ] `npm run typecheck` passes with zero errors.
- [ ] `npm run test` passes 100% of unit and export tests.
- [ ] `npm run build` succeeds cleanly.
- [ ] Production ZIP created with `manifest.json` at root (via `npm run package:test`).
- [ ] Tested unpacked installation in Chrome Developer Mode.
- [ ] Verified that no remote scripts, eval(), or external CDNs are referenced in the bundle.
- [ ] Verified that no attendance data is transmitted over the network.
