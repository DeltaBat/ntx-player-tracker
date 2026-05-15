# 05 · Run hourly from your PC (bridge until TRN API approves)

This setup runs the tracker scraper from your home PC using Windows Task Scheduler. Your residential IP bypasses Cloudflare so no proxy is needed. Drop this once the TRN API approves and switch back to GitHub Actions.

## One-time setup

### 1. Place the service account JSON

Save your service account JSON file at `C:\Users\beaus\ntx-player-tracker\.gcp-key.json`.

`.gcp-key.json` is gitignored — it will not be committed. **Don't move it elsewhere; the script expects this exact name.**

### 2. Create `.env.local`

In the project root, copy `.env.local.example` to `.env.local`:

```
copy .env.local.example .env.local
```

Edit `.env.local` and replace the `SHEET_ID` value with the long string from your sheet URL (between `/d/` and `/edit`). Leave `GOOGLE_SERVICE_ACCOUNT_PATH` as `.gcp-key.json`.

### 3. Test it once manually

From the project root:

```
scripts\run-tracker.bat
```

Watch `logs\run-tracker.log` (the script appends each run there). On success you'll see lines like:

```
[tracker] starting run, 1 active players
[tracker] ok fade in 1200ms
Exit code: 0
```

If you see `[tracker] starting run, 0 active players`, your Roster tab has no rows with `active = TRUE`. Fix the sheet and re-run.

### 4. Schedule it hourly with Task Scheduler

1. Open **Task Scheduler** (Win+R → `taskschd.msc`).
2. Right side → **Create Basic Task...**
3. Name: `NTX Player Tracker — hourly scrape`. Click **Next**.
4. Trigger: **Daily**. Click **Next**.
5. Start: pick today and any time (e.g., 12:00 AM). Recur every: 1 days. Click **Next**.
6. Action: **Start a program**. Click **Next**.
7. Program/script: `C:\Users\beaus\ntx-player-tracker\scripts\run-tracker.bat`
   Start in: `C:\Users\beaus\ntx-player-tracker`
   Click **Next** → **Finish**.
8. Find the task in the library, right-click → **Properties**:
   - **Triggers** tab → edit your daily trigger → check **Repeat task every: 1 hour** → for a duration of: **1 day** → OK.
   - **Settings** tab → check **Run task as soon as possible after a scheduled start is missed** (so it catches up after sleep/restart).
   - OK.

Your machine now runs the scraper every hour while logged in. The Apps Script trigger on the Sheet side fires every 5 minutes and renders the `Today` tab.

## Switching back to cloud when TRN approves

1. Add `TRACKER_API_KEY` as a GitHub secret.
2. Cherry-pick or revert the revert commit (`git revert 1f5465d`) to bring back the API path.
3. Push → GitHub Actions takes over on its hourly cron.
4. Disable the Windows Task Scheduler task (right-click → Disable).

## Troubleshooting

- **`Exit code: 1` in the log**: open the log file, scroll to the latest run, read the error.
- **403 from tracker.network**: rare on home IPs, but if it happens, you can opt-in to ScraperAPI by adding `SCRAPERAPI_KEY=your-key` to `.env.local`.
- **Task didn't run while PC was asleep**: that's expected. The "Run task as soon as possible after a scheduled start is missed" setting handles it on wake-up.
