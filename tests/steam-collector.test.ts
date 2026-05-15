// tests/steam-collector.test.ts
import { describe, it, expect, vi } from 'vitest';
import { collectSteamSnapshot } from '../src/steam/collector.js';

describe('collectSteamSnapshot', () => {
  it('combines games + summary + bans into a SteamSnapshot', async () => {
    const deps = {
      fetchOwnedGames: vi.fn().mockResolvedValue([
        { appid: 252950, playtime_forever: 1200, playtime_2weeks: 90 },
        { appid: 824270, playtime_forever: 300, playtime_2weeks: 0 },
      ]),
      fetchPlayerSummary: vi.fn().mockResolvedValue({
        steamid: '76561198000000000',
        communityvisibilitystate: 3,
        loccountrycode: 'US',
        timecreated: 1356998400,
      }),
      fetchPlayerBans: vi.fn().mockResolvedValue({
        SteamId: '76561198000000000',
        NumberOfVACBans: 0,
        CommunityBanned: false,
        VACBanned: false,
      }),
    };

    const snap = await collectSteamSnapshot({
      apiKey: 'KEY',
      playerId: 'fade',
      steamId: '76561198000000000',
      appIds: [252950, 824270, 714010],
      now: () => new Date('2026-05-15T03:00:00Z'),
    }, deps);

    expect(snap.timestampUtc).toBe('2026-05-15T03:00:00.000Z');
    expect(snap.playerId).toBe('fade');
    expect(snap.steamId).toBe('76561198000000000');
    expect(snap.profile.visibility).toBe('public');
    expect(snap.profile.countryCode).toBe('US');
    expect(snap.profile.accountCreatedUtc).toBe('2013-01-01T00:00:00.000Z');
    expect(snap.bans.vacBanCount).toBe(0);
    expect(snap.bans.communityBanned).toBe(false);
    expect(snap.watchlist).toHaveLength(3); // includes all watched app IDs even if 0 playtime
    const rl = snap.watchlist.find(w => w.appId === 252950)!;
    expect(rl.playtimeForeverMin).toBe(1200);
    expect(rl.playtimeTwoWeeksMin).toBe(90);
    const aim = snap.watchlist.find(w => w.appId === 714010)!;
    expect(aim.playtimeForeverMin).toBe(0); // owned games didn't include this app
  });

  it('maps visibility codes correctly', async () => {
    const make = (state: number) => ({
      fetchOwnedGames: vi.fn().mockResolvedValue([]),
      fetchPlayerSummary: vi.fn().mockResolvedValue({
        steamid: '1', communityvisibilitystate: state,
      }),
      fetchPlayerBans: vi.fn().mockResolvedValue({
        SteamId: '1', NumberOfVACBans: 0, CommunityBanned: false, VACBanned: false,
      }),
    });
    const base = { apiKey: 'K', playerId: 'p', steamId: '1', appIds: [], now: () => new Date(0) };
    expect((await collectSteamSnapshot(base, make(1))).profile.visibility).toBe('private');
    expect((await collectSteamSnapshot(base, make(2))).profile.visibility).toBe('friends_only');
    expect((await collectSteamSnapshot(base, make(3))).profile.visibility).toBe('public');
    expect((await collectSteamSnapshot(base, make(99))).profile.visibility).toBe('unknown');
  });

  it('handles missing summary gracefully (private/deleted account)', async () => {
    const deps = {
      fetchOwnedGames: vi.fn().mockResolvedValue([]),
      fetchPlayerSummary: vi.fn().mockResolvedValue(null),
      fetchPlayerBans: vi.fn().mockResolvedValue(null),
    };
    const snap = await collectSteamSnapshot({
      apiKey: 'K', playerId: 'p', steamId: '1', appIds: [],
      now: () => new Date('2026-05-15T03:00:00Z'),
    }, deps);
    expect(snap.profile.visibility).toBe('unknown');
    expect(snap.profile.countryCode).toBeNull();
    expect(snap.profile.accountCreatedUtc).toBeNull();
    expect(snap.bans.vacBanCount).toBe(0);
  });
});
