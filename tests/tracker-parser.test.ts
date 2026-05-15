// tests/tracker-parser.test.ts
import { describe, it, expect } from 'vitest';
import { parseTrackerProfile } from '../src/tracker/parser.js';
import { ParseError } from '../src/types.js';

const sample = JSON.stringify({
  data: {
    platformInfo: { platformSlug: 'epic', platformUserIdentifier: 'fade' },
    segments: [
      { type: 'overview', stats: { score: { value: 100 } } },
      {
        type: 'playlist',
        metadata: { name: 'Ranked Duel 1v1' },
        stats: {
          tier: { value: 22, displayValue: '22', metadata: { name: 'Supersonic Legend' } },
          division: { value: 0, displayValue: '0', metadata: { name: 'Division I' } },
          rating: { value: 1356 },
          matchesPlayed: { value: 73 },
          winStreak: { value: 1 },
        },
      },
      {
        type: 'playlist',
        metadata: { name: 'Ranked Doubles 2v2' },
        stats: {
          tier: { value: 22, displayValue: '22', metadata: { name: 'Supersonic Legend' } },
          division: { value: 0, displayValue: '0', metadata: { name: 'Division I' } },
          rating: { value: 2021 },
          matchesPlayed: { value: 452 },
          winStreak: { value: 8 },
        },
      },
      {
        type: 'playlist',
        metadata: { name: 'Ranked Standard 3v3' },
        stats: {
          tier: { value: 20, displayValue: '20', metadata: { name: 'Grand Champion III' } },
          division: { value: 2, displayValue: '2', metadata: { name: 'Division III' } },
          rating: { value: 1665 },
          matchesPlayed: { value: 13 },
          winStreak: { value: 5 },
        },
      },
      // Non-ranked playlists should be filtered out.
      {
        type: 'playlist',
        metadata: { name: 'Hoops' },
        stats: { tier: { value: 16, metadata: { name: 'Champion II' } } },
      },
    ],
  },
});

describe('parseTrackerProfile', () => {
  it('extracts 1s/2s/3s playlist stats from an api.tracker.gg profile response', () => {
    const result = parseTrackerProfile(sample);

    expect(result.platform).toBe('epic');
    expect(result.playlists).toHaveLength(3);
    const playlists = Object.fromEntries(result.playlists.map(p => [p.playlist, p]));
    expect(playlists['1s']?.mmr).toBe(1356);
    expect(playlists['2s']?.mmr).toBe(2021);
    expect(playlists['3s']?.mmr).toBe(1665);
    expect(playlists['2s']?.rank).toBe('Supersonic Legend');
    expect(playlists['3s']?.rank).toBe('Grand Champion III');
    expect(playlists['2s']?.division).toBe('Division I');
    expect(playlists['2s']?.gamesPlayedSeason).toBe(452);
    expect(playlists['2s']?.winStreak).toBe(8);
    expect(playlists['1s']?.winsSeason).toBeNull();
  });

  it('returns empty recentMatches (separate /matches API call, deferred)', () => {
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
