// tests/tracker-parser.test.ts
import { describe, it, expect } from 'vitest';
import { parseTrackerProfile } from '../src/tracker/parser.js';
import { ParseError } from '../src/types.js';

const sample = JSON.stringify({
  data: {
    platformInfo: { platformSlug: 'epic', platformUserIdentifier: 'fade' },
    segments: [
      {
        type: 'overview',
        stats: { score: { value: 100 } },
      },
      {
        type: 'playlist',
        metadata: { name: 'Ranked Duel 1v1' },
        stats: {
          tier: { displayValue: 'Grand Champion III' },
          division: { displayValue: 'II' },
          rating: { value: 1612 },
          matchesPlayed: { value: 80 },
          wins: { value: 50 },
          winStreak: { value: 2 },
        },
      },
      {
        type: 'playlist',
        metadata: { name: 'Ranked Doubles 2v2' },
        stats: {
          tier: { displayValue: 'Supersonic Legend' },
          rating: { value: 1820 },
          matchesPlayed: { value: 200 },
          wins: { value: 120 },
          winStreak: { value: 4 },
        },
      },
      {
        type: 'playlist',
        metadata: { name: 'Ranked Standard 3v3' },
        stats: {
          tier: { displayValue: 'Supersonic Legend' },
          rating: { value: 1745 },
          matchesPlayed: { value: 150 },
          wins: { value: 90 },
          winStreak: { value: 1 },
        },
      },
    ],
  },
});

describe('parseTrackerProfile', () => {
  it('extracts 1s/2s/3s playlist stats from a profile response', () => {
    const result = parseTrackerProfile(sample);

    expect(result.platform).toBe('epic');
    expect(result.playlists).toHaveLength(3);
    const playlists = Object.fromEntries(result.playlists.map(p => [p.playlist, p]));
    expect(playlists['1s']?.mmr).toBe(1612);
    expect(playlists['2s']?.mmr).toBe(1820);
    expect(playlists['3s']?.mmr).toBe(1745);
    expect(playlists['2s']?.rank).toBe('Supersonic Legend');
    expect(playlists['2s']?.gamesPlayedSeason).toBe(200);
    expect(playlists['1s']?.winStreak).toBe(2);
  });

  it('returns an empty recentMatches array (separate /matches API call, deferred to Plan 2)', () => {
    const result = parseTrackerProfile(sample);
    expect(result.recentMatches).toEqual([]);
  });
});

describe('parseTrackerProfile error handling', () => {
  it('throws ParseError when response is not valid JSON', () => {
    expect(() => parseTrackerProfile('{not json')).toThrow(ParseError);
    expect(() => parseTrackerProfile('{not json')).toThrow(/not valid JSON/);
  });

  it('throws ParseError when data block is missing', () => {
    expect(() => parseTrackerProfile('{}')).toThrow(/data missing/);
  });

  it('throws ParseError when platformSlug is missing', () => {
    const noPlatform = JSON.stringify({ data: { platformInfo: {} } });
    expect(() => parseTrackerProfile(noPlatform)).toThrow(/platformSlug/);
  });
});
