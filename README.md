# NTX Player Tracker

Cloud-hosted Google Sheet that tracks each NTX player's Rocket League grind hourly. No local infrastructure required.

## What it does (Plan 1 · Foundation)

- Hourly GitHub Actions cron scrapes tracker.gg for each rostered player.
- Writes raw snapshot rows to `Snapshots_Tracker` in your sheet.
- Apps Script assembler runs every 5 minutes, renders a `Today` tab with one card per player (1s/2s/3s rank, MMR, MMR Δ24h, status emoji).

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
