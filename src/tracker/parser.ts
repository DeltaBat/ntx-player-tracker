// src/tracker/parser.ts
import * as cheerio from 'cheerio';
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

interface NextDataShape {
  props?: {
    pageProps?: {
      profile?: {
        platformInfo?: { platformSlug?: string; platformUserIdentifier?: string };
        segments?: Array<{
          type: string;
          attributes?: { playlist?: string };
          metadata?: { name?: string };
          stats?: Record<string, { value?: number; displayValue?: string }>;
        }>;
        recentMatches?: Array<{
          id?: string;
          timestamp?: string;
          playlist?: string;
          result?: string;
          mmrDelta?: number;
        }>;
      };
    };
  };
}

export function parseTrackerProfile(html: string): Omit<TrackerSnapshot, 'timestampUtc' | 'playerId'> {
  const $ = cheerio.load(html);
  const raw = $('#__NEXT_DATA__').first().text();
  if (!raw) throw new ParseError('missing __NEXT_DATA__ script tag', html.slice(0, 500));

  let data: NextDataShape;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    throw new ParseError(`__NEXT_DATA__ not valid JSON: ${(e as Error).message}`);
  }

  const profile = data.props?.pageProps?.profile;
  if (!profile) throw new ParseError('profile missing from __NEXT_DATA__');

  const platformSlug = profile.platformInfo?.platformSlug;
  if (!platformSlug) throw new ParseError('platformSlug missing');

  const playlists: PlaylistStats[] = [];
  for (const seg of profile.segments ?? []) {
    if (seg.type !== 'playlist') continue;
    const label = seg.metadata?.name ?? seg.attributes?.playlist ?? '';
    const playlist = PLAYLIST_LABELS[label];
    if (!playlist) continue;
    playlists.push({
      playlist,
      rank: seg.stats?.tier?.displayValue ?? null,
      division: seg.stats?.division?.displayValue ?? null,
      mmr: typeof seg.stats?.rating?.value === 'number' ? seg.stats.rating.value : null,
      gamesPlayedSeason:
        typeof seg.stats?.matchesPlayed?.value === 'number' ? seg.stats.matchesPlayed.value : null,
      winsSeason: typeof seg.stats?.wins?.value === 'number' ? seg.stats.wins.value : null,
      winStreak:
        typeof seg.stats?.winStreak?.value === 'number' ? seg.stats.winStreak.value : null,
    });
  }

  const recentMatches: RecentMatch[] = [];
  for (const m of profile.recentMatches ?? []) {
    if (!m.id || !m.timestamp || !m.playlist) continue;
    const playlist = PLAYLIST_LABELS[m.playlist];
    if (!playlist) continue;
    const result = m.result === 'win' ? 'W' : m.result === 'loss' ? 'L' : null;
    if (!result) continue;
    recentMatches.push({
      id: m.id,
      ts: m.timestamp,
      result,
      mmrDelta: typeof m.mmrDelta === 'number' ? m.mmrDelta : 0,
      playlist,
    });
  }

  return {
    platform: platformSlug as Platform,
    playlists,
    recentMatches,
  };
}
