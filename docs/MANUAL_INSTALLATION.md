# Attendly — Manual Installation Guide for Testers

Thank you for testing **Attendly** (*Every Presence Counts*). Attendly is distributed as an unpacked Chrome Extension during this beta testing phase before its official release on the Chrome Web Store.

---

## 1. System Requirements

- **Operating System:** macOS, Windows, or Linux
- **Browser:** Google Chrome (Version 116 or newer recommended) or any Chromium-based browser (Brave, Microsoft Edge, Opera).
- **Accounts / Sign-in:** None required. Attendly works 100% locally.

---

## 2. Installation Steps (Step-by-Step)

### Step 1: Obtain the Attendly Beta Package
Download the latest tester distribution ZIP file:
`attendly-v0.1.0-beta.zip`

### Step 2: Extract the ZIP to a Permanent Folder
1. Right-click the downloaded `attendly-v0.1.0-beta.zip` and choose **Extract All** (Windows) or double-click to unzip (macOS).
2. Move the extracted folder to a permanent location on your computer (for example: `Documents/Attendly` or `Applications/Attendly`).

> [!CAUTION]
> **Do not delete or move the extracted folder!**
> Chrome loads unpacked extensions directly from the folder on your hard drive. If you delete or move this folder, Chrome will lose the extension files and report an error.

### Step 3: Open Chrome Extensions Manager
1. Open Google Chrome.
2. In the Chrome address bar, navigate to:
   ```text
   chrome://extensions
   ```
   *(Or click the three vertical dots menu &rarr; **Extensions** &rarr; **Manage Extensions**).*

### Step 4: Enable Developer Mode
In the top-right corner of the Extensions page, toggle the **Developer mode** switch to **ON**.

### Step 5: Load Unpacked Extension
1. Look at the top-left corner of the page and click the **Load unpacked** button.
2. In the file picker dialog, navigate to the extracted folder.
3. Select the folder that contains `manifest.json` directly inside it, then click **Select** (or **Open**).

### Step 6: Verify and Pin Attendly
1. You should now see **Attendly — Google Meet Attendance Tracker (0.1.0-beta)** in your extensions list.
2. Click the puzzle icon (🧩) in the top-right toolbar of Chrome.
3. Find **Attendly** and click the **Pin** icon to pin Attendly to your Chrome toolbar.

---

## 3. How to Use Attendly During a Meeting

1. **Join Google Meet:** Open [meet.google.com](https://meet.google.com) and enter your meeting.
2. **Open Attendly:** Click the Attendly icon in your Chrome toolbar.
3. **Start Tracking:** Click the green **Start Tracking** button.
4. **Accuracy Tip (People Tab):** For meetings with multiple attendees, keep Google Meet's **People** panel open so Attendly can observe all attendee names without DOM virtualization omissions.
5. **Download Reports:** When the meeting concludes, click **Stop**, then click **Export** to download your attendance report as an **Excel workbook (.xlsx)**, **CSV file (.csv)**, or **PDF document (.pdf)**.
6. **Full Dashboard:** Click the external link icon in the top header to view the comprehensive, multi-tab attendance dashboard.

---

## 4. How to Update to a Newer Test Release

When a new beta version (e.g., `v0.1.1-beta`) is provided:
1. Extract the new ZIP file.
2. Replace the contents of your existing Attendly folder with the new files.
3. Go to `chrome://extensions`.
4. Find Attendly and click the **Reload** (circular arrow) icon.

---

## 5. How to Uninstall

1. Go to `chrome://extensions`.
2. Locate **Attendly**.
3. Click **Remove**, then confirm.
4. You may now delete the local extracted folder from your computer.
