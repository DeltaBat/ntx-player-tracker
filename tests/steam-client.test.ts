// tests/steam-client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchOwnedGames,
  fetchPlayerSummary,
  fetchPlayerBans,
} from '../src/steam/client.js';

describe('Steam Web API client', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('fetchOwnedGames hits the right URL with key + steamid + watchlist', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ response: { game_count: 2, games: [
          { appid: 252950, playtime_forever: 1200, playtime_2weeks: 90 },
          { appid: 824270, playtime_forever: 300 },
        ]}}),
        { status: 200 }
      )
    );
    const games = await fetchOwnedGames({
      apiKey: 'KEY',
      steamId: '76561198000000000',
      appIds: [252950, 824270, 714010],
    });
    expect(fetchSpy).toHaveBeenCalledOnce();
    const url = String(fetchSpy.mock.calls[0]![0]);
    expect(url).toContain('IPlayerService/GetOwnedGames');
    expect(url).toContain('key=KEY');
    expect(url).toContain('steamid=76561198000000000');
    expect(url).toContain('include_played_free_games=1');
    expect(games).toHaveLength(2);
    expect(games[0]?.appid).toBe(252950);
    expect(games[0]?.playtime_forever).toBe(1200);
    expect(games[0]?.playtime_2weeks).toBe(90);
    expect(games[1]?.playtime_2weeks).toBe(0); // default when missing
  });

  it('fetchPlayerSummary returns parsed profile fields', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ response: { players: [{
          steamid: '76561198000000000',
          communityvisibilitystate: 3,
          loccountrycode: 'US',
          timecreated: 1356998400,
        }]}}),
        { status: 200 }
      )
    );
    const summary = await fetchPlayerSummary({ apiKey: 'KEY', steamId: '76561198000000000' });
    expect(summary?.steamid).toBe('76561198000000000');
    expect(summary?.communityvisibilitystate).toBe(3);
    expect(summary?.loccountrycode).toBe('US');
    expect(summary?.timecreated).toBe(1356998400);
  });

  it('fetchPlayerSummary returns null when no players returned', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ response: { players: [] }}), { status: 200 })
    );
    const summary = await fetchPlayerSummary({ apiKey: 'KEY', steamId: '76561198000000000' });
    expect(summary).toBeNull();
  });

  it('fetchPlayerBans returns parsed bans', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({ players: [{
          SteamId: '76561198000000000',
          NumberOfVACBans: 0,
          CommunityBanned: false,
          VACBanned: false,
        }]}),
        { status: 200 }
      )
    );
    const bans = await fetchPlayerBans({ apiKey: 'KEY', steamId: '76561198000000000' });
    expect(bans?.NumberOfVACBans).toBe(0);
    expect(bans?.CommunityBanned).toBe(false);
  });

  it('throws on non-2xx', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('forbidden', { status: 403 })
    );
    await expect(
      fetchPlayerSummary({ apiKey: 'BAD', steamId: '1' })
    ).rejects.toThrow(/403/);
  });
});
