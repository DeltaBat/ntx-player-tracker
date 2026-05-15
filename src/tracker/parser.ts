// src/tracker/parser.ts
import {
  ParseError,
  type Platform,
  type Playlist,
  type PlaylistStats,
  type RecentMatch,
  type TrackerSnapshot,
} from '../types.js';

const PLAYLIST_LABELS: Record<string, Playlist> = {
  'Ranked Duel 1v1': '1s',
  'Ranked Doubles 2v2': '2s',
  'Ranked Standard 3v3': '3s',
};

interface ApiStat {
  value?: number;
  displayValue?: string;
  metadata?: { name?: string };
}

interface ApiSegment {
  type?: string;
  metadata?: { name?: string };
  stats?: Record<string, ApiStat>;
}

interface ApiResponse {
  data?: {
    platformInfo?: { platformSlug?: string };
    segments?: ApiSegment[];
  };
}

export function parseTrackerProfile(json: string): Omit<TrackerSnapshot, 'timestampUtc' | 'playerId'> {
  let data: ApiResponse;
  try {
    data = JSON.parse(json);
  } catch (e) {
    throw new ParseError(`response not valid JSON: ${(e as Error).message}`);
  }

  const profile = data?.data;
  if (!profile) throw new ParseError('data missing from API response');

  const platformSlug = profile.platformInfo?.platformSlug;
  if (!platformSlug) throw new ParseError('platformSlug missing');

  const playlists: PlaylistStats[] = [];
  for (const seg of profile.segments ?? []) {
    if (seg.type !== 'playlist') continue;
    const label = seg.metadata?.name ?? '';
    const playlist = PLAYLIST_LABELS[label];
    if (!playlist) continue;
    playlists.push({
      playlist,
      // Rank name lives in stats.tier.metadata.name (e.g. "Supersonic Legend").
      // displayValue is just the numeric tier index as a string.
      rank: seg.stats?.tier?.metadata?.name ?? null,
      division: seg.stats?.division?.metadata?.name ?? null,
      mmr: typeof seg.stats?.rating?.value === 'number' ? seg.stats.rating.value : null,
      gamesPlayedSeason:
        typeof seg.stats?.matchesPlayed?.value === 'number' ? seg.stats.matchesPlayed.value : null,
      winsSeason: null, // not exposed by api.tracker.gg /profile endpoint
      winStreak:
        typeof seg.stats?.winStreak?.value === 'number' ? seg.stats.winStreak.value : null,
    });
  }

  // recentMatches requires a separate /matches/{platform}/{id} call — deferred.
  const recentMatches: RecentMatch[] = [];

  return {
    platform: platformSlug as Platform,
    playlists,
    recentMatches,
  };
}
