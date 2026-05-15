# NTX Player Tracker

Cloud-hosted Google Sheet that tracks each NTX player's Rocket League grind hourly. No local infrastructure required.

## What it does

- Hourly scrape (via local Task Scheduler) hits `api.tracker.gg` for each rostered player's RL stats: 1s/2s/3s rank, MMR, games played, win streak.
- Per-player Steam Web API call pulls playtime (total + last 2 weeks) for Rocket League / Kovaak's / Aim Lab, plus profile visibility and VAC ban status.
- Both write append-only rows to `Snapshots_Tracker` / `Snapshots_Steam`.
- Apps Script assembler runs every 5 minutes and renders the `Today` tab with one card per player: 1s/2s/3s rank/MMR/Δ24h/status, plus a Steam row showing hours + 2-week activity + 🔒 if private.

## Quickstart

1. Walk through `docs/setup/01-google-cloud.md` to create a service account.
2. Walk through `docs/setup/02-sheet-init.md` to create the sheet and run the bootstrap script.
3. Push this repo to a new GitHub repo (public for free Actions minutes).
4. Walk through `docs/setup/03-github-secrets.md` to add `SHEET_ID` and `GOOGLE_SERVICE_ACCOUNT_JSON`.
5. Walk through `docs/setup/04-apps-script.md` to install the assembler trigger.
6. In GitHub → Actions tab → `Tracker scrape` → **Run workflow** to fire the first run manually.
7. After it finishes (~5 min for 6 players), open the sheet's `Today` tab.

## Local dev

```sh
npm install
cp .env.example .env.local
# Fill in SHEET_ID and GOOGLE_SERVICE_ACCOUNT_JSON in .env.local
node --env-file=.env.local --import tsx src/index.ts
```

## What's coming

- Plan 2: Steam integration (hours, profile basics, watchlist apps)
- Plan 3: Ballchasing + replay-based mechanics + coverage indicator
- Plan 4: Manual tabs (Tryouts paste-URL flow, Sessions log, Goals tracker)

See `docs/superpowers/specs/2026-05-15-ntx-player-tracker-design.md` for the full design.
