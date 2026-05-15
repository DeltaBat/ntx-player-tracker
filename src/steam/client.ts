// src/steam/client.ts
// Thin wrapper around Steam Web API endpoints we need.
// Steam Web API: https://steamcommunity.com/dev — free, 100k calls/day, no Cloudflare blocks.

export interface OwnedGame {
  appid: number;
  playtime_forever: number;   // minutes
  playtime_2weeks: number;    // minutes (Steam omits the field if 0; we normalize to 0)
}

export interface PlayerSummary {
  steamid: string;
  communityvisibilitystate: number;  // 1=private, 2=friends only, 3=public
  loccountrycode?: string;
  timecreated?: number;              // unix seconds
}

export interface PlayerBansRaw {
  SteamId: string;
  NumberOfVACBans: number;
  CommunityBanned: boolean;
  VACBanned: boolean;
}

interface SteamCall {
  apiKey: string;
  steamId: string;
}

async function steamGet<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) {
    throw new Error(`Steam API ${res.status} for ${url.split('?')[0]}`);
  }
  return (await res.json()) as T;
}

export async function fetchOwnedGames(
  { apiKey, steamId, appIds }: SteamCall & { appIds: number[] }
): Promise<OwnedGame[]> {
  const url =
    `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/` +
    `?key=${encodeURIComponent(apiKey)}` +
    `&steamid=${encodeURIComponent(steamId)}` +
    `&include_played_free_games=1` +
    `&include_appinfo=0`;
  const body = await steamGet<{ response?: { games?: Array<Partial<OwnedGame>> } }>(url);
  const all = body.response?.games ?? [];
  const watchlist = new Set(appIds);
  const out: OwnedGame[] = [];
  for (const g of all) {
    if (typeof g.appid !== 'number') continue;
    if (!watchlist.has(g.appid)) continue;
    out.push({
      appid: g.appid,
      playtime_forever: typeof g.playtime_forever === 'number' ? g.playtime_forever : 0,
      playtime_2weeks: typeof g.playtime_2weeks === 'number' ? g.playtime_2weeks : 0,
    });
  }
  return out;
}

export async function fetchPlayerSummary(
  { apiKey, steamId }: SteamCall
): Promise<PlayerSummary | null> {
  const url =
    `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/` +
    `?key=${encodeURIComponent(apiKey)}` +
    `&steamids=${encodeURIComponent(steamId)}`;
  const body = await steamGet<{ response?: { players?: PlayerSummary[] } }>(url);
  const player = body.response?.players?.[0];
  return player ?? null;
}

export async function fetchPlayerBans(
  { apiKey, steamId }: SteamCall
): Promise<PlayerBansRaw | null> {
  const url =
    `https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/` +
    `?key=${encodeURIComponent(apiKey)}` +
    `&steamids=${encodeURIComponent(steamId)}`;
  const body = await steamGet<{ players?: PlayerBansRaw[] }>(url);
  const player = body.players?.[0];
  return player ?? null;
}
