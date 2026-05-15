# NTX Player Tracker — Design

**Status:** Approved · 2026-05-15
**Owner:** NTX Esports

## Goal

A cloud-hosted Google Sheet that auto-fills hourly with each NTX player's Rocket League grind, Steam activity, and replay-based mechanics. Plus on-demand tryout lookups. Open the sheet on phone every morning and instantly see who's grinding, who's missing, who's tilting, who needs a coaching session.

## Success criteria

- One-glance morning view: 1s/2s/3s rank+MMR+Δ24h, hours 24h/7d/14d, sparkline, status emoji per player.
- Tilt alert, late-night flag, peak-vs-current, ballchasing coverage % visible on the Today card.
- Paste a tracker.gg URL into the Tryouts tab → row auto-populates with profile basics, ranks, vetting checklist within an hour.
- Coaching session log and per-player goals visible alongside live stats.
- Zero local infrastructure. Coach's PC can be off; the system keeps running.

## Architecture overview

Two halves:

1. **Scraper repo** (GitHub, public) — three GitHub Actions workflows + one assembler. Each provider runs on its own cron and writes raw snapshot rows to the sheet via a Google service account.
2. **Sheet** — 8 tabs. Apps Script assembler running every 5 minutes derives the 16 metrics from raw snapshots, refreshes Today/Trends/Tryouts, handles paste-URL triggers.

### Providers and cadence

| Provider | Cron | Rationale |
|---|---|---|
| `tracker-scraper.yml` | hourly | Drives time-of-day heatmap and live MMR. tracker.gg scrape is the primary data source. |
| `steam-collector.yml` | every 6h | Steam playtime barely moves; over-polling wastes API budget. |
| `ballchasing-collector.yml` | every 2h | Players upload replays sporadically. 2h is a reasonable balance between freshness and politeness. |
| `assemble` (Apps Script, in-sheet) | every 5min | Re-renders Today/Trends from latest snapshots. Owns presentation. |

### Cloud-only infrastructure

- **GitHub Actions** runners (free for public repo) execute the scrapers.
- **Google Drive** hosts the sheet.
- **Google Cloud service account** authenticates GitHub Actions to the sheet. Sheet shared with service account email only.
- **Secrets** stored in GitHub repo settings: `GOOGLE_SERVICE_ACCOUNT_JSON`, `STEAM_API_KEY`, `BALLCHASING_TOKEN`, `SHEET_ID`.

No machine in the coach's home is required to be on.

## Sheet schema

### Tabs

| Tab | Purpose | Visibility |
|---|---|---|
| **Today** | One card per rostered player. 1s/2s/3s rank+MMR+Δ24h, hours 24h/7d/14d, sparkline, status emoji, win streak, late-night %, peak gap, ballchasing coverage %. | Visible |
| **Trends** | 30/90-day MMR charts per player + per-playlist. Synergy matrix. Peer leaderboards. | Visible |
| **Tryouts** | Paste tracker.gg URL → row auto-fills: profile basics, ranks, vetting checklist, verdict dropdown. | Visible |
| **Sessions** | Coach-entered log: date, player, focus area (rotations / mechanics / mental), VOD link, follow-up. Today pulls "last reviewed" from here. Stale > 21d = yellow flag. | Visible |
| **Goals** | Per-player goals: target playlist, target MMR/rank, deadline, start value. Today card progress bar = `(current − start) / (target − start)`. | Visible |
| **Roster** | Source of truth: name, Epic/Steam/PSN platform + ID, ballchasing username, watchlist Steam app IDs, active flag. | Visible |
| **Snapshots_Tracker** | Raw append-only history from tracker scraper. | Hidden |
| **Snapshots_Steam** | Raw append-only history from Steam collector. | Hidden |
| **Snapshots_Ballchasing** | Raw append-only history from ballchasing collector. | Hidden |
| **Config** | Thresholds (tilt, late-night, coverage), watchlist Steam app IDs, refresh timestamps per provider, provider health cells. | Visible |
| **run_log** | Append-only log from all providers + assembler. Capped at 10k rows (auto-trimmed). | Hidden |

### Snapshot row schemas

**Snapshots_Tracker** (one row per player per playlist per scrape):
`timestamp_utc | player_id | platform | playlist | rank | division | mmr | games_played_season | wins_season | win_streak | recent_match_ids_json`

`recent_match_ids_json` is a JSON array of the most recent 20 matches: `[{id, ts, result, mmr_delta, playlist}, ...]`. Stored as a string in the cell. Drives tilt detection, time-of-day heatmap, and per-match metric trends without re-scraping.

**Snapshots_Steam** (one row per player per scrape):
`timestamp_utc | player_id | steam_id | profile_visibility | account_created | country | vac_ban_count | community_banned | watchlist_playtime_json`

`watchlist_playtime_json` = `{appid: {playtime_forever, playtime_2weeks}}` per watchlisted Steam app.

**Snapshots_Ballchasing** (one row per player per scrape):
`timestamp_utc | player_id | replays_in_window | window_start | window_end | aggregate_stats_json | teammate_counts_json`

`aggregate_stats_json` includes avg boost stats, supersonic %, ground %, position score. `teammate_counts_json` powers the synergy matrix: `{teammate_player_id: {games, wins}}`.

### Retention

Snapshots kept indefinitely. ~50k tracker rows/year fits comfortably under the 10M-cell Sheets limit. If we ever approach the ceiling, archive >180-day rows to a `Snapshots_Archive` tab. No action needed at v1.

## Data providers

### tracker-scraper

- TypeScript on `node:lts` GitHub runner.
- Reads roster from `Roster` tab.
- For each active player: `GET https://tracker.gg/rocket-league/profile/{platform}/{id}/overview`.
- Headers: rotating realistic User-Agent, `Accept-Language: en-US,en;q=0.9`, `Sec-Ch-Ua` matching a current Chrome on Windows.
- Random jitter: 30–120s sleep between players.
- Parser: `cheerio` extracts the JSON inside `<script id="__NEXT_DATA__">` (more stable than rendered DOM). Asserts expected key shape; missing keys → `PARSE_ERROR` in `run_log`.
- Writes one row per (player × playlist) to `Snapshots_Tracker`.
- Cloudflare 403 → log + skip player + retry next hour. Three consecutive 403s for same player → email alert.

### steam-collector

- TypeScript, same runner.
- Reads Steam IDs + watchlist app IDs from `Roster` and `Config`.
- Calls:
  - `IPlayerService/GetOwnedGames` → `playtime_forever`, `playtime_2weeks` per app.
  - `ISteamUser/GetPlayerSummaries` → avatar, level, country, profile visibility, account creation.
  - `ISteamUser/GetPlayerBans` → VAC and community ban status.
- Free Steam Web API key. Players must have profile + game details public for hours to show; private → log "private" status and flag player as 🔒 on Today.

### ballchasing-collector

- TypeScript, same runner.
- For each ballchasing username: `GET /replays?player-name={name}&count=50&sort-by=replay-date&sort-dir=desc`.
- For each new replay (not yet in snapshots): `GET /replays/{id}` for boost stats, avg speed, supersonic %, ground/low-air/high-air %, demos, position score.
- ~1 req/sec, well under ballchasing's 1000/hour limit.
- Tracks replay coverage = `replays_uploaded_in_window / games_played_in_window` (from tracker data). Drives the coverage % cell on Today.

### assembler (Apps Script, in-sheet)

- 5-min time-driven trigger.
- Reads latest snapshots, computes derived metrics, updates Today/Trends/Tryouts cells.
- Owns conditional formatting + sparkline-string generation.
- Owns the `onEdit` trigger that fires when a tracker.gg URL is pasted into Tryouts col A.

Apps Script handles work that has to be inside the sheet: cell-level formatting, onEdit triggers, sparkline cells. GitHub providers stay single-responsibility (collect → write raw row).

## Metrics derivation

### Tracker-driven

| Metric | Computation |
|---|---|
| **MMR Δ24h** per playlist | `latest_mmr − mmr(closest snapshot ≥24h before now)` for same `player_id+playlist`. If no snapshot ≥24h old exists yet (new player), display `—`. |
| **Games 7d / 14d** per playlist | `games_played_season(latest) − games_played_season(7d/14d ago)` |
| **Hours 24h/7d/14d** | `(games_delta_window) × 6 min/game ÷ 60`, summed across playlists. 6-min average is configurable in `Config`. |
| **Win streak** | Last consecutive same-result entries in `recent_match_ids_json` for most recent playlist played |
| **Tilt alert** | `losses_in_last_10 ≥ 4` AND `mmr_delta_last_10 ≤ −40` on any playlist → flag red |
| **MMR volatility (14d)** | stddev of daily MMR Δ values over last 14 days per playlist |
| **Peak vs current gap** | `max(mmr across all snapshots, player_id, playlist) − current_mmr` |
| **Playlist mix %** | For last 7d: `games_played(playlist) / total_games_played` per player |
| **Time-of-day heatmap** | For each match timestamp in last 14d, bucket into 24 hours (player local time from Steam country). % games after 23:00 local → late-night flag. |
| **Days since last game** | `now() − max(match.timestamp)` per playlist |
| **Goals/Saves/Shots per game** | `(stat_total_now − stat_total_7d_ago) / games_in_window` |
| **Peer rank** | Within roster: leaderboards by games_7d, MMR Δ 7d, win % — rendered on Trends |

### Steam-driven

| Metric | Computation |
|---|---|
| **Steam total hours** | `playtime_forever / 60` summed across watchlist app IDs |
| **Training-tool watchlist** | Per-app `playtime_2weeks` for Kovaak's, Aim Lab, configured Workshop maps |
| **Profile vetting basics** | Account age (from Steam ID creation), public/private flag, VAC ban count — used in Tryouts |

### Ballchasing-driven

| Metric | Computation |
|---|---|
| **Boost economy** | Avg of `boost_avg_amount`, `bpm`, `time_zero_boost%`, `time_full_boost%` across replays in window |
| **Supersonic & ground %** | Avg `time_supersonic%` and `time_ground%` across replays |
| **Synergy matrix** | For each pair `(playerA, playerB)` co-occurring in replays: `wins / games`. Rendered as a grid on Trends. |
| **Rotation discipline proxy** | Avg `position_score` (% time as last back). Bands: `<15%` = ball-chaser, `30–40%` = balanced, `>55%` = anchoring too hard |
| **Replay coverage %** | `replays_in_window / games_played_in_window`. Red on Today if `<30%`. |

### Manual entry

| Tab | Behavior |
|---|---|
| **Sessions** | Coach types row directly. "Last reviewed" on Today = `MAX(Sessions.date WHERE player=X)`. Stale > 21d = yellow. |
| **Goals** | Coach defines target. Today progress bar = `(current − start) / (target − start)`. |
| **Tryouts vetting** | Auto-filled (VAC ban count, account age, profile visibility) + manual verdict dropdown (✓ / ⚠ / ✗). Note: Steam name history is not exposed by the official Steam Web API and is not included in v1. |

### Status emoji rules (Today card)

- 🔥 grinding: `games_7d ≥ 50` AND `MMR_delta_7d ≥ 0` on main playlist (main playlist = the one with the most `games_played_season` per player; recomputed each assembler run)
- ✓ active: `games_7d ≥ 20` AND no tilt
- 😐 light: `games_7d > 0` AND `games_7d < 20`
- 💤 missing: `days_since_last_game ≥ 5`
- ⚠ tilting: tilt alert true (overrides others)
- 🔒 private: Steam profile private OR tracker.gg unreachable

All thresholds editable in `Config`.

## Error handling

Each provider wraps every external call in try/catch and appends to `run_log`: `timestamp | provider | player_id | status | duration_ms | error_summary`. Failed rows don't block the rest of the run.

| Failure | Behavior |
|---|---|
| Cloudflare 403 on tracker.gg | Log + skip player + retry next hour. 3 consecutive 403s same player → email alert. |
| Steam profile private | Log "private" + 🔒 on Today. No retry until coach updates roster. |
| Ballchasing 404 | Silent. Coverage stays 0%. |
| Service account auth failure | Job fails red. GH Actions email triggers. |
| Sheets write conflict | Exponential backoff, 3 retries. |
| tracker.gg parser breakage | `__NEXT_DATA__` shape changed. Parser asserts keys; missing → `PARSE_ERROR`. Surfaced as red banner on Config. |

## Observability

- **`run_log` tab** — first stop when something looks wrong. Capped at 10k rows.
- **`provider_health` cells on Config** — per provider: last successful run, 24h success rate, current consecutive failures. Red highlight on degradation.
- **GitHub Actions native** — workflow runs in repo Actions tab, default email on failure.
- No external monitoring (Datadog, Sentry).

## Testing

- **Unit tests** for each parser against committed HTML/JSON fixtures (`__fixtures__/tracker-{platform}-{rank}.html`, etc.). Run on every PR.
- **Integration test** for Sheets writer against a dedicated test sheet (`SHEET_ID_TEST` secret). Runs on PR.
- **Smoke test workflow** — manually triggerable. Hits each provider once against a known-good player. Useful when tracker.gg redesigns.
- No browser E2E tests — surface area doesn't justify it.

## Local dev

- `npm run dev:tracker -- --player <id>` invokes a provider one-shot against the real or test sheet. Same code path as the cron, human-triggered.
- Service account JSON committed only as `.example.json`; real one stays in `.env.local` (gitignored).

## Security

- Public repo: anyone can read the code. Secrets only in GH Actions encrypted secrets, never in code.
- Service account scoped to *this sheet only*. Share the sheet with the service account email; grant nothing else.
- No PII in commits or `run_log` beyond what's already public on tracker.gg / Steam.

## Out of scope (v1)

- Mobile app or custom web frontend — the Sheet is the UI.
- Discord bot integration — could be added later as a separate provider that reads the same sheet.
- Real-time push alerts (Slack, Discord webhook on tilt detection) — straightforward to bolt on but not in v1.
- Multi-org / multi-team support — single roster, single sheet.
