# 02 · Create the Google Sheet

1. Go to https://sheets.new — this opens a fresh blank sheet.
2. Rename the file to `NTX Player Tracker`.
3. Copy the sheet ID from the URL — it's the long string between `/d/` and `/edit`. Save it for Task 03.
4. Open **Extensions → Apps Script**. A new tab opens.
5. Delete the placeholder code. Paste the entire contents of `google-apps-script/sheet-bootstrap.gs` from this repo.
6. Click **Save** (disk icon), then **Run**. Authorize the script when prompted (it needs permission to modify the sheet you opened it from).
7. Return to the sheet. You should see 11 tabs: `Today`, `Trends`, `Tryouts`, `Sessions`, `Goals`, `Roster`, `Snapshots_Tracker`, `Snapshots_Steam`, `Snapshots_Ballchasing`, `Config`, `run_log`. (Steam/Ballchasing tabs are empty placeholders for later plans.)
8. Click into `Roster`. Add yourself a row to test:

   `fade | fade | epic | Squishy | (steamID64 optional) | (ballchasing optional) | TRUE`

9. Share the sheet with the service account email (see Task 01, "Sharing the sheet").
