# Attendly — Tester Guide & Test Protocol

## 1. Overview & Beta Testing Objectives

Attendly is designed to provide automated, local-only attendance tracking for Google Meet meetings without any server backend or cloud storage.

This guide provides testers with instructions on how to evaluate:
- Detection accuracy across different meeting sizes
- Participant join, departure, and reconnection handling
- Paused intervals and late arrival flags
- Export generation across Excel (.xlsx), CSV (.csv), and PDF (.pdf) formats

---

## 2. Test Environment Matrix

| Requirement | Minimum Supported | Recommended |
| :--- | :--- | :--- |
| **Browser** | Chrome 116+ | Chrome Latest Stable |
| **OS** | Windows 10+, macOS 12+, Linux | macOS / Windows 11 |
| **Google Meet Account** | Free Google account or Google Workspace | Google Workspace |
| **Display** | 1280x720 minimum | 1920x1080 or larger |

---

## 3. Manual Test Scenarios

Testers should execute the following scenarios and record observations against manual ground truth:

### Scenario 1: Standard 2-5 Participant Meeting
1. Open Google Meet with 2 to 5 participants.
2. Click **Start Tracking**.
3. Verify that all attendee names are correctly recognized in the attendee list.
4. Have 1 participant leave after 5 minutes.
5. Verify status changes to **Departed** with accurate duration.
6. Click **Stop** and download the Excel report.
7. Verify that total duration equals the sum of attended minutes.

### Scenario 2: Participant Disconnection & Reconnection
1. Participant joins at 0:00.
2. Participant disconnects at 0:10 (duration: 10m).
3. Participant reconnects at 0:20 and remains until 0:40 (duration: 20m).
4. **Expected Attendance:** Exactly 30 minutes total (not 40 minutes).
5. Verify in the Dashboard that 2 discrete sessions are logged for this participant.

### Scenario 3: Late Arrival Grace Period
1. Configure Grace Period to 5 minutes in Attendly Settings.
2. Start tracking at 10:00 AM.
3. Have participant A join at 10:02 AM (expect: on time).
4. Have participant B join at 10:08 AM (expect: marked **Late**).
5. Verify the **Late** badge in popup, dashboard, and export reports.

### Scenario 4: Paused Monitoring Interval
1. Start tracking.
2. Track for 5 minutes.
3. Click **Pause**.
4. Wait 3 minutes while the meeting continues.
5. Click **Resume**.
6. Track for another 5 minutes.
7. Verify that participants were **not** credited for the 3 paused minutes.

### Scenario 5: Large Meeting & List Virtualization (20+ Participants)
1. In a meeting with 20+ participants, open the **People** tab in Google Meet.
2. Observe if Attendly displays an advisory: *"Meet is virtualizing the participant list"*.
3. Scroll slowly from the top of the People tab to the bottom.
4. Verify that Attendly captures participants revealed by scrolling without losing earlier attendees.

### Scenario 6: Name Collision / Duplicate Names
1. Two participants join with identical names (e.g. "John Smith").
2. Verify Attendly disambiguates them (e.g., "John Smith (2)") with `identityConfidence: low` instead of silently merging them.

---

## 4. Known Technical Limitations

1. **DOM Virtualization in Google Meet:**
   Google Meet does not render 100+ DOM elements at once. In large meetings, un-scrolled rows are recycled. Attendly detects this and prompts the host to scroll through the People tab.
2. **Minimized or Hidden Google Meet Tabs:**
   Chrome may throttle JavaScript execution on inactive background tabs. For best tracking fidelity, keep the Google Meet window visible on screen.
3. **Session Loss on Browser Force-Quit:**
   Because Attendly runs locally in browser session memory, force-quitting Google Chrome before downloading your report may discard active session data. Always click **Stop** and download your report when your meeting finishes.

---

## 5. Troubleshooting Common Issues

| Issue | Cause | Solution |
| :--- | :--- | :--- |
| **"No Google Meet tab detected"** | Active tab is not `meet.google.com` | Ensure you are on an active Google Meet meeting tab. |
| **Participants not appearing** | People panel is closed or user is in lobby | Open the People panel in Google Meet and join the meeting. |
| **Download button disabled** | No participants have been observed yet | Start tracking and ensure at least one attendee is present. |
| **Extension popup closed during meeting** | Normal Chrome behavior | Click the Attendly icon again; tracking continues unaffected in the background. |

---

## 6. How to Report Bugs

When reporting an issue, please provide:
1. Google Chrome version (`chrome://settings/help`)
2. Operating System
3. Number of participants in the meeting
4. Whether the People tab was open or closed
5. Exact error message or diagnostic entry from the **Diagnostics** tab in the Dashboard.
