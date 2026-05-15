// src/types.ts

export type Platform = 'epic' | 'steam' | 'psn' | 'xbl' | 'switch';
export type Playlist = '1s' | '2s' | '3s';

export interface PlayerRoster {
  playerId: string;       // internal slug, e.g. "fade"
  displayName: string;    // e.g. "fade"
  trackerPlatform: Platform;
  trackerId: string;      // platform-specific id used in tracker.gg URL
  steamId?: string;       // SteamID64 (string of digits)
  ballchasingName?: string;
  active: boolean;
}

export interface PlaylistStats {
  playlist: Playlist;
  rank: string | null;        // e.g. "Supersonic Legend"
  division: string | null;    // e.g. "I"
  mmr: number | null;
  gamesPlayedSeason: number | null;
  winsSeason: number | null;
  winStreak: number | null;
}

export interface RecentMatch {
  id: string;
  ts: string;               // ISO 8601 UTC
  result: 'W' | 'L';
  mmrDelta: number;
  playlist: Playlist;
}

export interface TrackerSnapshot {
  timestampUtc: string;       // ISO 8601 UTC, when we scraped
  playerId: string;
  platform: Platform;
  playlists: PlaylistStats[];
  recentMatches: RecentMatch[];
}

export interface RunLogEntry {
  timestampUtc: string;
  provider: 'tracker' | 'steam' | 'ballchasing' | 'assembler';
  playerId: string | null;
  status: 'ok' | 'error' | 'skip';
  durationMs: number;
  errorSummary: string | null;
}

export class ParseError extends Error {
  constructor(message: string, public html?: string) {
    super(message);
    this.name = 'ParseError';
  }
}
