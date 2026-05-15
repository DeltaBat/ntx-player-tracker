// tests/tracker-parser.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseTrackerProfile } from '../src/tracker/parser.js';
import { ParseError } from '../src/types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ssl = readFileSync(join(__dirname, 'fixtures/tracker-epic-ssl.html'), 'utf8');

describe('parseTrackerProfile', () => {
  it('extracts 1s/2s/3s playlist stats from an SSL profile', () => {
    const result = parseTrackerProfile(ssl);

    expect(result.playlists).toHaveLength(3);
    const playlists = Object.fromEntries(result.playlists.map(p => [p.playlist, p]));
    expect(playlists['1s']?.mmr).toBeTypeOf('number');
    expect(playlists['2s']?.mmr).toBeTypeOf('number');
    expect(playlists['3s']?.mmr).toBeTypeOf('number');
    expect(playlists['2s']?.rank).toBeTypeOf('string');
    expect(playlists['2s']?.gamesPlayedSeason).toBeGreaterThanOrEqual(0);
  });

  it('extracts a list of recent matches', () => {
    const result = parseTrackerProfile(ssl);
    expect(result.recentMatches.length).toBeGreaterThan(0);
    const first = result.recentMatches[0]!;
    expect(first.id).toBeTypeOf('string');
    expect(['W', 'L']).toContain(first.result);
    expect(['1s', '2s', '3s']).toContain(first.playlist);
  });
});

describe('parseTrackerProfile error handling', () => {
  it('throws ParseError when __NEXT_DATA__ is missing', () => {
    const html = readFileSync(join(__dirname, 'fixtures/tracker-malformed.html'), 'utf8');
    expect(() => parseTrackerProfile(html)).toThrow(ParseError);
  });

  it('throws ParseError when __NEXT_DATA__ is not valid JSON', () => {
    const html = `<html><script id="__NEXT_DATA__">{not json</script></html>`;
    expect(() => parseTrackerProfile(html)).toThrow(/not valid JSON/);
  });
});
