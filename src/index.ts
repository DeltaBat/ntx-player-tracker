// src/index.ts
import { loadConfig } from './config.js';
import { SheetClient } from './sheet/client.js';
import { readRoster } from './sheet/roster.js';
import { appendTrackerSnapshot } from './sheet/snapshots.js';
import { appendRunLog } from './sheet/run-log.js';
import { fetchTrackerProfile, jitterMs } from './tracker/client.js';
import { parseTrackerProfile } from './tracker/parser.js';
import type { TrackerSnapshot } from './types.js';

async function main() {
  const cfg = loadConfig();
  const client = await SheetClient.fromServiceAccount(cfg.sheetId, cfg.serviceAccount);
  const roster = await readRoster(client);
  console.log(`[tracker] starting run, ${roster.length} active players`);

  for (let i = 0; i < roster.length; i++) {
    const p = roster[i]!;
    const startedAt = Date.now();
    const nowUtc = new Date().toISOString();
    try {
      const html = await fetchTrackerProfile({ platform: p.trackerPlatform, trackerId: p.trackerId });
      const parsed = parseTrackerProfile(html);
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
      }).catch(() => { /* don't block the run on log failure */ });
      console.error(`[tracker] error ${p.playerId}: ${msg}`);
    }

    if (i < roster.length - 1) {
      const wait = jitterMs();
      console.log(`[tracker] jitter sleep ${wait}ms before next player`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
