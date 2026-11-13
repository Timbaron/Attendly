# Attendly — Privacy Policy & Architecture Disclosure

**Effective Date:** November 13, 2026
**Product:** Attendly Chrome Extension
**Tagline:** Every Presence Counts.

---

## 1. Core Privacy Commitments

Attendly is built from the ground up on the principle of **absolute local privacy**:

1. **Zero External Data Transmission:** Attendly does not transmit, upload, or sync attendance records, participant names, meeting titles, or timestamps to any external server, cloud database, or third-party service.
2. **No User Accounts or Registration:** Users do not register, create profiles, or sign in to use Attendly.
3. **No Audio or Video Recording:** Attendly does not access, process, or record audio, video, camera, microphone, or screen sharing feeds.
4. **No Third-Party Analytics or Advertising:** Attendly contains zero analytics SDKs (no Google Analytics, Mixpanel, Segment, etc.) and zero tracking pixels or advertising libraries.
5. **Narrowly Scoped Host Permissions:** Attendly operates exclusively on `https://meet.google.com/*`. It has zero access to any other website, tab, or browsing history.

---

## 2. What Information Attendly Processes Locally

During an active Google Meet tracking session, Attendly temporarily processes:
- **Participant Display Names & Avatar URLs:** Observed strictly from Google Meet's DOM interface to identify attendees.
- **Join and Leave Timestamps:** Recorded locally in browser memory when an attendee is detected joining or departing.
- **Meeting Metadata:** Meeting title, meeting code (e.g., `abc-defg-hij`), and tracking start/end times.
- **User Configuration:** User-defined settings such as grace period, time format (12h/24h), and UI theme.

---

## 3. Data Storage & Retention Lifecycle

1. **Active Tracking (Browser Memory):** While a meeting is in progress, attendee records reside in memory within the content script and `chrome.storage.session`.
2. **Popup Closure Resilience:** `chrome.storage.session` preserves the live meeting state so closing and opening the extension popup does not interrupt tracking.
3. **Crash Recovery Draft:** A single local draft of the most recent session is stored in `chrome.storage.local` to allow users to recover their report if the meeting tab is accidentally closed.
4. **Session Erasure:** Clicking **Discard Session** immediately purges all attendance records for that meeting.
5. **No Cloud Persistence:** When Google Chrome is closed or the user clears browser data, session memory is cleared.

---

## 4. Responsible Use & Compliance Notice

Meeting hosts using Attendly to track attendance are responsible for complying with applicable privacy laws, institutional guidelines, and organizational policies (such as GDPR, FERPA, or local employment regulations). Hosts should inform participants that meeting attendance is being tracked.

---

## 5. Chrome Web Store Single Purpose Disclosure

- **Primary Purpose:** Attendly tracks attendance during Google Meet sessions and generates downloadable reports.
- **Justification for `storage`:** Used strictly to persist temporary meeting session state and user preferences locally on the user's machine.
- **Justification for `tabs`:** Used strictly to determine the meeting code of the active Google Meet tab and coordinate badge counter updates.
