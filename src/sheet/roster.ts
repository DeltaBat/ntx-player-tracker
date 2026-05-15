// src/sheet/roster.ts
import type { PlayerRoster, Platform } from '../types.js';
import { SheetClient } from './client.js';

const REQUIRED = ['playerId', 'displayName', 'trackerPlatform', 'trackerId', 'active'] as const;
const VALID_PLATFORMS: Platform[] = ['epic', 'steam', 'psn', 'xbl', 'switch'];

export async function readRoster(client: SheetClient): Promise<PlayerRoster[]> {
  const rows = await client.readRange('Roster!A1:Z1000');
  if (rows.length === 0) return [];
  const header = rows[0]!;
  for (const col of REQUIRED) {
    if (!header.includes(col)) throw new Error(`Roster tab missing column: ${col}`);
  }
  const safeGet = (row: string[], col: string): string | undefined => {
    const i = header.indexOf(col);
    return i >= 0 ? row[i] : undefined;
  };

  const out: PlayerRoster[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]!;
    if (row.length === 0) continue;
    const activeRaw = (safeGet(row, 'active') ?? '').toUpperCase();
    if (activeRaw !== 'TRUE') continue;

    const platform = safeGet(row, 'trackerPlatform') as Platform;
    if (!VALID_PLATFORMS.includes(platform)) continue;

    const steamId = safeGet(row, 'steamId') || undefined;
    const ballchasingName = safeGet(row, 'ballchasingName') || undefined;

    out.push({
      playerId: safeGet(row, 'playerId')!,
      displayName: safeGet(row, 'displayName')!,
      trackerPlatform: platform,
      trackerId: safeGet(row, 'trackerId')!,
      steamId,
      ballchasingName,
      active: true,
    });
  }
  return out;
}
