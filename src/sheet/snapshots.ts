// src/sheet/snapshots.ts
import { SheetClient } from './client.js';
import type { TrackerSnapshot } from '../types.js';

export async function appendTrackerSnapshot(
  client: SheetClient,
  snap: TrackerSnapshot
): Promise<void> {
  const matchesJson = JSON.stringify(snap.recentMatches);
  const rows = snap.playlists.map(p => [
    snap.timestampUtc,
    snap.playerId,
    snap.platform,
    p.playlist,
    p.rank ?? '',
    p.division ?? '',
    p.mmr ?? '',
    p.gamesPlayedSeason ?? '',
    p.winsSeason ?? '',
    p.winStreak ?? '',
    matchesJson,
  ]);
  await client.appendRows('Snapshots_Tracker', rows);
}
