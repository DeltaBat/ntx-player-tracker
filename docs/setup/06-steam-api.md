# 06 · Steam Web API key

The tracker reads each player's Steam playtime + profile + VAC ban status via the Steam Web API. Free, 100k calls/day. Anyone with a Steam account can grab a key in 5 minutes.

## Get a key

1. Open https://steamcommunity.com/dev/apikey
2. Sign in with any Steam account.
3. **Domain name**: enter anything plausible — `ntx-esports.local` works. (This field is informational; Steam doesn't validate it.)
4. Accept the terms → **Register**.
5. Copy the **Key** field — a 32-character hex string.

## Wire it in

**Local PC run (your current setup):** edit `C:\Users\beaus\ntx-player-tracker\.env.local` and add this line:

```
STEAM_API_KEY=your-32-char-hex-key
```

Re-run `scripts\run-tracker.bat` and watch `logs\run-tracker.log` for `[steam] ok <playerId>` lines.

**Future cloud run (after TRN API approval):** add a GitHub repo secret named `STEAM_API_KEY` with the same value.

## Player setup

Each player must have:
1. Their **SteamID64** filled into the `Roster` tab's `steamId` column (the long 17-digit number, e.g. `76561198000000000`). Use https://steamid.io/ to convert from a custom URL.
2. Their Steam profile set to **Public** with **Game details: Public** (so playtime is visible to the API).

If `steamId` is blank, the Steam pass is skipped for that player (no error).
If the profile is private, the snapshot still gets written with `profile_visibility=private` — Today shows 🔒 next to their Steam row.

## What gets tracked

- Total playtime for: Rocket League (252950), Kovaak's (824270), Aim Lab (714010).
- Last 2 weeks of playtime for those apps.
- Profile visibility, country code, account-created date.
- VAC ban count, community ban flag.

The watchlist is hardcoded in `src/steam/watchlist.ts` — edit there to add other apps.
