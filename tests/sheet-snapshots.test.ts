// tests/sheet-snapshots.test.ts
import { describe, it, expect, vi } from 'vitest';
import { appendTrackerSnapshot } from '../src/sheet/snapshots.js';
import { SheetClient } from '../src/sheet/client.js';
import type { TrackerSnapshot } from '../src/types.js';

describe('appendTrackerSnapshot', () => {
  it('writes one row per playlist', async () => {
    const client = new SheetClient('id', { spreadsheets: { values: { append: vi.fn() } } } as any);
    const appendSpy = vi.spyOn(client, 'appendRows').mockResolvedValue();

    const snap: TrackerSnapshot = {
      timestampUtc: '2026-05-15T03:00:00Z',
      playerId: 'fade',
      platform: 'epic',
      playlists: [
        { playlist: '1s', rank: 'GC3', division: 'I', mmr: 1612, gamesPlayedSeason: 80, winsSeason: 50, winStreak: 2 },
        { playlist: '2s', rank: 'SSL', division: null, mmr: 1820, gamesPlayedSeason: 200, winsSeason: 120, winStreak: 4 },
      ],
      recentMatches: [
        { id: 'm1', ts: '2026-05-15T02:50:00Z', result: 'W', mmrDelta: 12, playlist: '2s' },
      ],
    };

    await appendTrackerSnapshot(client, snap);
    expect(appendSpy).toHaveBeenCalledOnce();
    const [range, values] = appendSpy.mock.calls[0]!;
    expect(range).toBe('Snapshots_Tracker');
    expect(values).toHaveLength(2);
    expect(values[0]![3]).toBe('1s');
    expect(values[1]![3]).toBe('2s');
    expect(values[0]![10]).toContain('m1'); // recent matches JSON in column 10
  });
});
