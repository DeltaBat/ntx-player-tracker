// tests/sheet-roster.test.ts
import { describe, it, expect, vi } from 'vitest';
import { readRoster } from '../src/sheet/roster.js';
import { SheetClient } from '../src/sheet/client.js';

describe('readRoster', () => {
  it('parses active rows from the Roster tab', async () => {
    const client = new SheetClient('id', { spreadsheets: { values: { get: vi.fn() } } } as any);
    vi.spyOn(client, 'readRange').mockResolvedValue([
      ['playerId', 'displayName', 'trackerPlatform', 'trackerId', 'steamId', 'ballchasingName', 'active'],
      ['fade', 'fade', 'epic', 'Squishy', '76561198000000000', 'fade', 'TRUE'],
      ['jaxx', 'jaxx', 'epic', 'JaxxRL', '', '', 'TRUE'],
      ['old-player', 'old', 'epic', 'old-id', '', '', 'FALSE'],
    ]);

    const roster = await readRoster(client);
    expect(roster).toHaveLength(2);
    expect(roster[0]).toMatchObject({
      playerId: 'fade',
      trackerPlatform: 'epic',
      trackerId: 'Squishy',
      steamId: '76561198000000000',
      ballchasingName: 'fade',
      active: true,
    });
    expect(roster[1]?.steamId).toBeUndefined();
  });

  it('throws when header row is missing required columns', async () => {
    const client = new SheetClient('id', { spreadsheets: { values: { get: vi.fn() } } } as any);
    vi.spyOn(client, 'readRange').mockResolvedValue([['displayName', 'trackerId']]);
    await expect(readRoster(client)).rejects.toThrow(/missing column/);
  });
});
