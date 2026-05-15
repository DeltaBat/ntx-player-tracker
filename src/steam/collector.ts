// src/steam/collector.ts
import type {
  SteamSnapshot,
  SteamProfile,
  SteamBans,
  SteamVisibility,
  SteamWatchlistEntry,
} from '../types.js';
import type { OwnedGame, PlayerSummary, PlayerBansRaw } from './client.js';
import {
  fetchOwnedGames as defaultFetchOwnedGames,
  fetchPlayerSummary as defaultFetchPlayerSummary,
  fetchPlayerBans as defaultFetchPlayerBans,
} from './client.js';

export interface CollectSteamInput {
  apiKey: string;
  playerId: string;
  steamId: string;
  appIds: number[];
  now?: () => Date;
}

export interface CollectSteamDeps {
  fetchOwnedGames: (args: { apiKey: string; steamId: string; appIds: number[] }) => Promise<OwnedGame[]>;
  fetchPlayerSummary: (args: { apiKey: string; steamId: string }) => Promise<PlayerSummary | null>;
  fetchPlayerBans: (args: { apiKey: string; steamId: string }) => Promise<PlayerBansRaw | null>;
}

const defaultDeps: CollectSteamDeps = {
  fetchOwnedGames: defaultFetchOwnedGames,
  fetchPlayerSummary: defaultFetchPlayerSummary,
  fetchPlayerBans: defaultFetchPlayerBans,
};

function mapVisibility(state: number | undefined): SteamVisibility {
  if (state === 1) return 'private';
  if (state === 2) return 'friends_only';
  if (state === 3) return 'public';
  return 'unknown';
}

export async function collectSteamSnapshot(
  input: CollectSteamInput,
  deps: CollectSteamDeps = defaultDeps
): Promise<SteamSnapshot> {
  const { apiKey, playerId, steamId, appIds } = input;
  const now = (input.now ?? (() => new Date()))();

  const [games, summary, bansRaw] = await Promise.all([
    deps.fetchOwnedGames({ apiKey, steamId, appIds }),
    deps.fetchPlayerSummary({ apiKey, steamId }),
    deps.fetchPlayerBans({ apiKey, steamId }),
  ]);

  const profile: SteamProfile = {
    steamId,
    visibility: mapVisibility(summary?.communityvisibilitystate),
    countryCode: summary?.loccountrycode ?? null,
    accountCreatedUtc:
      typeof summary?.timecreated === 'number'
        ? new Date(summary.timecreated * 1000).toISOString()
        : null,
  };

  const bans: SteamBans = {
    vacBanCount: bansRaw?.NumberOfVACBans ?? 0,
    communityBanned: bansRaw?.CommunityBanned ?? false,
  };

  // Build watchlist in the configured order. Apps the player doesn't own get 0/0.
  const byApp = new Map<number, OwnedGame>();
  for (const g of games) byApp.set(g.appid, g);
  const watchlist: SteamWatchlistEntry[] = appIds.map(appId => {
    const g = byApp.get(appId);
    return {
      appId,
      playtimeForeverMin: g?.playtime_forever ?? 0,
      playtimeTwoWeeksMin: g?.playtime_2weeks ?? 0,
    };
  });

  return {
    timestampUtc: now.toISOString(),
    playerId,
    steamId,
    profile,
    bans,
    watchlist,
  };
}
