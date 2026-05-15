// src/index.ts
import { loadConfig } from './config.js';
import { SheetClient } from './sheet/client.js';
import { readRoster } from './sheet/roster.js';
import { appendTrackerSnapshot } from './sheet/snapshots.js';
import { appendSteamSnapshot } from './sheet/steam-snapshots.js';
import { appendRunLog } from './sheet/run-log.js';
import { fetchTrackerProfile, jitterMs } from './tracker/client.js';
import { parseTrackerProfile } from './tracker/parser.js';
import { collectSteamSnapshot } from './steam/collector.js';
import { WATCHLIST_APP_IDS } from './steam/watchlist.js';
import type { TrackerSnapshot } from './types.js';

async function main() {
  const cfg = loadConfig();
  const client = await SheetClient.fromServiceAccount(cfg.sheetId, cfg.serviceAccount);
  const roster = await readRoster(client);
  console.log(`[run] starting, ${roster.length} active players`);

  for (let i = 0; i < roster.length; i++) {
    const p = roster[i]!;

    // --- Tracker pass ---
    {
      const startedAt = Date.now();
      const nowUtc = new Date().toISOString();
      try {
        const json = await fetchTrackerProfile({ platform: p.trackerPlatform, trackerId: p.trackerId });
        const parsed = parseTrackerProfile(json);
        const snap: TrackerSnapshot = {
          timestampUtc: nowUtc,
          playerId: p.playerId,
          platform: parsed.platform,
          playlists: parsed.playlists,
          recentMatches: parsed.recentMatches,
        };
        await appendTrackerSnapshot(client, snap);
        await appendRunLog(client, {
          timestampUtc: nowUtc,
          provider: 'tracker',
          playerId: p.playerId,
          status: 'ok',
          durationMs: Date.now() - startedAt,
          errorSummary: null,
        });
        console.log(`[tracker] ok ${p.playerId} in ${Date.now() - startedAt}ms`);
      } catch (e) {
        const msg = (e as Error).message.slice(0, 200);
        await appendRunLog(client, {
          timestampUtc: nowUtc,
          provider: 'tracker',
          playerId: p.playerId,
          status: 'error',
          durationMs: Date.now() - startedAt,
          errorSummary: msg,
        }).catch(() => {});
        console.error(`[tracker] error ${p.playerId}: ${msg}`);
      }
    }

    // --- Steam pass (only if both player has steamId AND key is configured) ---
    if (p.steamId && cfg.steamApiKey) {
      const startedAt = Date.now();
      const nowUtc = new Date().toISOString();
      try {
        const snap = await collectSteamSnapshot({
          apiKey: cfg.steamApiKey,
          playerId: p.playerId,
          steamId: p.steamId,
          appIds: WATCHLIST_APP_IDS,
        });
        await appendSteamSnapshot(client, snap);
        await appendRunLog(client, {
          timestampUtc: nowUtc,
          provider: 'steam',
          playerId: p.playerId,
          status: 'ok',
          durationMs: Date.now() - startedAt,
          errorSummary: null,
        });
        console.log(`[steam] ok ${p.playerId} in ${Date.now() - startedAt}ms`);
      } catch (e) {
        const msg = (e as Error).message.slice(0, 200);
        await appendRunLog(client, {
          timestampUtc: nowUtc,
          provider: 'steam',
          playerId: p.playerId,
          status: 'error',
          durationMs: Date.now() - startedAt,
          errorSummary: msg,
        }).catch(() => {});
        console.error(`[steam] error ${p.playerId}: ${msg}`);
      }
    } else if (p.steamId && !cfg.steamApiKey) {
      console.log(`[steam] skip ${p.playerId}: STEAM_API_KEY not set`);
    }

    if (i < roster.length - 1) {
      const wait = jitterMs();
      console.log(`[run] jitter sleep ${wait}ms before next player`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
