// tests/sheet-steam-snapshots.test.ts
import { describe, it, expect, vi } from 'vitest';
import { appendSteamSnapshot } from '../src/sheet/steam-snapshots.js';
import { SheetClient } from '../src/sheet/client.js';
import type { SteamSnapshot } from '../src/types.js';

describe('appendSteamSnapshot', () => {
  it('writes one row to Snapshots_Steam with JSON-encoded watchlist playtime', async () => {
    const client = new SheetClient('id', { spreadsheets: { values: { append: vi.fn() } } } as any);
    const appendSpy = vi.spyOn(client, 'appendRows').mockResolvedValue();

    const snap: SteamSnapshot = {
      timestampUtc: '2026-05-15T03:00:00.000Z',
      playerId: 'fade',
      steamId: '76561198000000000',
      profile: {
        steamId: '76561198000000000',
        visibility: 'public',
        countryCode: 'US',
        accountCreatedUtc: '2013-01-01T00:00:00.000Z',
      },
      bans: { vacBanCount: 0, communityBanned: false },
      watchlist: [
        { appId: 252950, playtimeForeverMin: 1200, playtimeTwoWeeksMin: 90 },
        { appId: 824270, playtimeForeverMin: 300, playtimeTwoWeeksMin: 0 },
      ],
    };

    await appendSteamSnapshot(client, snap);

    expect(appendSpy).toHaveBeenCalledOnce();
    const [range, values] = appendSpy.mock.calls[0]!;
    expect(range).toBe('Snapshots_Steam');
    expect(values).toHaveLength(1);
    const row = values[0]!;
    expect(row[0]).toBe('2026-05-15T03:00:00.000Z'); // timestamp_utc
    expect(row[1]).toBe('fade');                      // player_id
    expect(row[2]).toBe('76561198000000000');         // steam_id
    expect(row[3]).toBe('public');                    // profile_visibility
    expect(row[4]).toBe('2013-01-01T00:00:00.000Z'); // account_created
    expect(row[5]).toBe('US');                        // country
    expect(row[6]).toBe(0);                           // vac_ban_count
    expect(row[7]).toBe('FALSE');                     // community_banned (sheets-friendly string)
    expect(String(row[8])).toContain('252950');       // watchlist JSON in last column
    expect(String(row[8])).toContain('1200');
  });
});
