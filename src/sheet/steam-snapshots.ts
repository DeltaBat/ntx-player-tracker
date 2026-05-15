// src/sheet/steam-snapshots.ts
import { SheetClient } from './client.js';
import type { SteamSnapshot } from '../types.js';

export async function appendSteamSnapshot(
  client: SheetClient,
  snap: SteamSnapshot
): Promise<void> {
  const watchlistJson = JSON.stringify(snap.watchlist);
  const row = [
    snap.timestampUtc,
    snap.playerId,
    snap.steamId,
    snap.profile.visibility,
    snap.profile.accountCreatedUtc ?? '',
    snap.profile.countryCode ?? '',
    snap.bans.vacBanCount,
    snap.bans.communityBanned ? 'TRUE' : 'FALSE',
    watchlistJson,
  ];
  await client.appendRows('Snapshots_Steam', [row]);
}
