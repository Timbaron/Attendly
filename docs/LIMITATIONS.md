# Google Meet Technical Limitations & Attendly Mitigation Strategies

Attendly is a local-only, privacy-first Chrome Extension that tracks attendance through observable Google Meet browser interfaces. Google Meet does not provide a public browser extension API or stable DOM contract. This document outlines the inherent platform limitations of Google Meet and the architectural safeguards Attendly implements.

---

## 1. Video Grid Tile Capping (Closed People Panel)

### Google Meet Platform Behavior
- In Google Meet, when the People panel is closed, Google Meet **only renders DOM nodes for participants visible on the active video grid**.
- The default layout renders between 1 and 9 participant tiles (or up to 16/49 depending on user display settings).
- Participants who are not currently rendered on the grid (e.g. attendees on page 2 of a large call, or participants who have not recently spoken) **do not exist anywhere in the page DOM**.

### Attendly Safeguards
1. **Header Count Correlation:** Google Meet always exposes an official participant count badge in the bottom toolbar (`"People (N)"` or `"Show everyone (N)"`), which remains accessible whether the People panel is open or closed.
2. **Small Calls ($\le$ Grid Size):** In meetings where the total attendee count is less than or equal to the visible grid size (e.g. 1 to ~9 participants), Attendly tracks attendance seamlessly without requiring the People panel to be open.
3. **Large Calls ($>$ Grid Size):** When the official count exceeds the visible tiles and the People panel is closed, Attendly:
   - Does **not** fabricate departures for off-screen participants.
   - Marks off-screen participants with state `unknown` / `estimated` rather than assuming they left.
   - Displays a non-intrusive in-app banner: *"For best accuracy, open Google Meet's People panel."*

---

## 2. DOM Virtualization (Large Meetings with Open Panel)

### Google Meet Platform Behavior
- When the People panel is open in meetings exceeding ~30 participants, Google Meet utilizes DOM list virtualization (infinite recycling of `div[role='listitem']` elements).
- Participants scrolled out of view in the panel are recycled and removed from the active DOM.

### Attendly Safeguards
1. **Virtualization Detection:** Attendly compares the number of observed panel list items against the official header count badge. When `isPeoplePanelOpen === true` and `headerCount - observedCount > 2`, `virtualizationDetected` is set to `true`.
2. **User Guidance Banner:** Attendly displays an informative notice prompting the host to scroll through the People panel once during the meeting to capture all attendees.
3. **Registry Persistence:** Once a participant is observed, Attendly retains their record in the registry and will not mark them departed simply because they scrolled out of view.

---

## 3. Local User Representation Variances

### Google Meet Platform Behavior
- Google Meet represents the local user inconsistently across screens:
  - On the video tile: `"Akiode Timothy (You)"` or `"You"` or plain name.
  - In the People panel: `"Akiode Timothy (You)"` or `"You"`.
  - In initial pre-join hydration: sometimes `"You"` before account data loads.

### Attendly Safeguards
1. **Canonical Local User Registry:** Attendly resolves all variations (`"You"`, `"Name (You)"`, `"Name (Host, You)"`) to a single canonical local user ID (`"canonical_local_user"`).
2. **Top-Right Account Extraction:** Attendly reads the user's verified name from the top-right Google Account button (`"Google Account: First Last"`) from the earliest frame.
3. **Retroactive Consolidation & Overlap Prevention:** If `"You"` was observed before the real name was known, Attendly automatically unifies `"You"` into the canonical record, preserving the earliest join timestamp and merging session intervals with zero double-counting.

---

## 4. Join Timestamps Prior to Tracking Start

### Google Meet Platform Behavior
- When a user clicks "Start Tracking" 15 minutes into an ongoing meeting, Google Meet does not expose the historical timestamps of when attendees joined in the past.

### Attendly Safeguards
1. **Transparent Attribution:** Attendly marks participants observed in the initial cycle with `presentAtTrackingStart: true`.
2. **Honest Reporting:** In Excel, CSV, and PDF exports, Attendly identifies these participants with `Present at Start: Yes` rather than claiming to have observed their historical join moment.

---

## 5. Tab Throttling & Background Page State

### Google Meet Platform Behavior
- If Google Meet is moved to an inactive browser tab or minimized, Chrome may throttle timers (`setInterval`) to 1 trigger per minute unless audio/video is playing.

### Attendly Safeguards
1. **Controlled Reconciliation Loop:** Attendly pairs a controlled ticker with a `MutationObserver` on `document.body` to capture DOM additions immediately upon DOM mutation.
2. **Wall-Clock Math:** All duration calculations compute `new Date(now).getTime() - new Date(joinedAt).getTime()`, ensuring elapsed time remains 100% mathematically exact regardless of timer frequency.
