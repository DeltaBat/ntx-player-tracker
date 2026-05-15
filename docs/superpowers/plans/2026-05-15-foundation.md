# NTX Player Tracker — Plan 1: Foundation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cloud-hosted hourly tracker.gg scraper writes raw RL stats to a Google Sheet; an Apps Script assembler renders a Today tab with one card per player (1s/2s/3s rank, MMR, MMR Δ24h, sparkline, status emoji). End state: open the sheet on your phone and see live grind for every NTX player.

**Architecture:** TypeScript Node app runs as a GitHub Actions hourly cron, scrapes the JSON embedded in tracker.gg's `__NEXT_DATA__` script tag, writes append-only rows to `Snapshots_Tracker`. Apps Script time trigger runs every 5 minutes inside the sheet, reads the snapshot history, and renders Today cards. No machine in the coach's home needs to be on.

**Tech Stack:** Node 20, TypeScript 5, vitest, cheerio, googleapis (Sheets v4), GitHub Actions, Google Apps Script.

---

## File structure

```
ntx-player-tracker/
├── .github/workflows/
│   ├── ci.yml                       # tests + typecheck on PR
│   └── tracker-scrape.yml           # hourly cron
├── docs/
│   ├── superpowers/specs/2026-05-15-ntx-player-tracker-design.md   (exists)
│   ├── superpowers/plans/2026-05-15-foundation.md                  (this file)
│   └── setup/
│       ├── 01-google-cloud.md       # service account walkthrough
│       ├── 02-sheet-init.md         # run bootstrap script
│       ├── 03-github-secrets.md     # exact secret names
│       └── 04-apps-script.md        # deploy assembler
├── src/
│   ├── index.ts                     # entry: orchestrates one scrape run
│   ├── config.ts                    # env var loader
│   ├── types.ts                     # shared types
│   ├── tracker/
│   │   ├── client.ts                # HTTP client + headers + jitter
│   │   └── parser.ts                # extract from __NEXT_DATA__
│   └── sheet/
│       ├── client.ts                # Sheets API wrapper (auth + append + retry)
│       ├── roster.ts                # read Roster tab
│       ├── snapshots.ts             # append to Snapshots_Tracker
│       └── run-log.ts               # append to run_log
├── tests/
│   ├── fixtures/
│   │   ├── tracker-epic-ssl.html    # real saved page (committed)
│   │   └── tracker-malformed.html   # missing __NEXT_DATA__
│   ├── tracker-parser.test.ts
│   ├── tracker-client.test.ts
│   ├── sheet-snapshots.test.ts
│   └── sheet-roster.test.ts
├── google-apps-script/
│   ├── appsscript.json
│   ├── sheet-bootstrap.gs           # one-time: creates all tabs with headers
│   └── assembler.gs                 # 5-min trigger: builds Today tab
├── .gitignore                       (exists, extend)
├── .env.example
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

Each `src/*` file has one responsibility. `index.ts` is the only orchestrator; everything else is a pure-ish function or class.

---

## Task 1: Initialize Node + TypeScript project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "ntx-player-tracker",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "tsx src/index.ts",
    "dev:tracker": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "cheerio": "1.0.0-rc.12",
    "googleapis": "144.0.0"
  },
  "devDependencies": {
    "@types/node": "20.14.10",
    "tsx": "4.19.1",
    "typescript": "5.6.2",
    "vitest": "2.1.1"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "noUncheckedIndexedAccess": true,
    "outDir": "./dist"
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globals: false,
  },
});
```

- [ ] **Step 4: Create `.env.example`**

```
GOOGLE_SERVICE_ACCOUNT_JSON=
SHEET_ID=
```

`GOOGLE_SERVICE_ACCOUNT_JSON` holds the *contents* of the service account key JSON file as a single-line string. `SHEET_ID` is the string between `/d/` and `/edit` in the sheet URL.

- [ ] **Step 5: Extend `.gitignore`**

Append these lines (if not already present from the spec commit):

```
node_modules/
dist/
.env
.env.local
*.local.json
```

- [ ] **Step 6: Install and verify**

Run: `npm install`
Expected: succeeds, creates `node_modules/` and `package-lock.json`.

Run: `npm run typecheck`
Expected: passes (no source files yet means nothing to fail).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .env.example .gitignore
git commit -m "chore: init Node + TypeScript project with vitest"
```

---

## Task 2: Add CI workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create CI workflow**

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: run typecheck and tests on PR + main"
```

---

## Task 3: Shared types

**Files:**
- Create: `src/types.ts`
- Test: `tests/types.test.ts` (compile-time only — no runtime tests needed)

- [ ] **Step 1: Create types**

```ts
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
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat(types): add core types for roster + tracker snapshots"
```

---

## Task 4: Tracker parser — failing test against real fixture

**Files:**
- Create: `tests/fixtures/tracker-epic-ssl.html`
- Create: `tests/tracker-parser.test.ts`

- [ ] **Step 1: Save a real tracker.gg HTML page as fixture**

Pick a public profile that has played **all three playlists (1s, 2s, 3s) this season** so the parser test exercises every code path. Examples vary by season — browse the tracker.gg leaderboards for a current public profile if needed.

Visit `https://tracker.gg/rocket-league/profile/epic/<id>/overview` in a browser, view source, save the full HTML to `tests/fixtures/tracker-epic-ssl.html`.

`curl` fallback: `curl -L -A "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130.0.0.0" "https://tracker.gg/rocket-league/profile/epic/<id>/overview" -o tests/fixtures/tracker-epic-ssl.html`. If Cloudflare returns a challenge page, save from a real browser instead.

**Verify the parser strategy is viable:** grep the saved file for `__NEXT_DATA__`:

```bash
grep -o '__NEXT_DATA__' tests/fixtures/tracker-epic-ssl.html | head -1
```

Expected output: `__NEXT_DATA__`. If empty, tracker.gg has moved off Next.js or is rendering client-side. In that case, before continuing to Task 5, search the fixture for `<script[^>]*>` blocks containing JSON and update the parser to extract from whichever script tag holds the profile data. The rest of the plan still applies — only the selector in `parser.ts` changes.

- [ ] **Step 2: Write failing parser test**

```ts
// tests/tracker-parser.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseTrackerProfile } from '../src/tracker/parser.js';

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
```

- [ ] **Step 3: Run test, verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../src/tracker/parser.js'`.

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/tracker-epic-ssl.html tests/tracker-parser.test.ts
git commit -m "test(tracker-parser): add failing test against real fixture"
```

---

## Task 5: Tracker parser — implementation

**Files:**
- Create: `src/tracker/parser.ts`

- [ ] **Step 1: Implement parser**

```ts
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
```

- [ ] **Step 2: Run test, verify it passes**

Run: `npm test -- tests/tracker-parser.test.ts`
Expected: PASS. If the fixture has unexpected shape, adjust the parser keys to match the actual `__NEXT_DATA__` you saved — this is the most likely point of friction.

- [ ] **Step 3: Commit**

```bash
git add src/tracker/parser.ts
git commit -m "feat(tracker-parser): extract playlists + recent matches from __NEXT_DATA__"
```

---

## Task 6: Tracker parser — malformed input handling

**Files:**
- Create: `tests/fixtures/tracker-malformed.html`
- Modify: `tests/tracker-parser.test.ts`

- [ ] **Step 1: Create malformed fixture**

```html
<!-- tests/fixtures/tracker-malformed.html -->
<!doctype html>
<html><head><title>Just A Page</title></head><body>
<p>This page has no __NEXT_DATA__ tag.</p>
</body></html>
```

- [ ] **Step 2: Add failing test for ParseError**

Append to `tests/tracker-parser.test.ts`:

```ts
import { ParseError } from '../src/types.js';

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
```

- [ ] **Step 3: Run tests, verify they pass**

Run: `npm test`
Expected: 4 tests pass. ParseError handling already wired in Task 5.

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/tracker-malformed.html tests/tracker-parser.test.ts
git commit -m "test(tracker-parser): cover malformed HTML and bad JSON"
```

---

## Task 7: Tracker HTTP client

**Files:**
- Create: `src/tracker/client.ts`
- Create: `tests/tracker-client.test.ts`

- [ ] **Step 1: Write failing test for client behavior**

```ts
// tests/tracker-client.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchTrackerProfile } from '../src/tracker/client.js';

describe('fetchTrackerProfile', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('sends a realistic Chrome User-Agent', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html></html>', { status: 200 })
    );

    await fetchTrackerProfile({ platform: 'epic', trackerId: 'Squishy' });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const init = fetchSpy.mock.calls[0]![1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers['User-Agent']).toMatch(/Chrome\/\d+/);
    expect(headers['Accept-Language']).toBe('en-US,en;q=0.9');
  });

  it('throws on Cloudflare 403', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('blocked', { status: 403 }));
    await expect(
      fetchTrackerProfile({ platform: 'epic', trackerId: 'Squishy' })
    ).rejects.toThrow(/403/);
  });

  it('returns response body on 200', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html>profile</html>', { status: 200 })
    );
    const body = await fetchTrackerProfile({ platform: 'epic', trackerId: 'Squishy' });
    expect(body).toContain('profile');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- tests/tracker-client.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement client**

```ts
// src/tracker/client.ts
import type { Platform } from '../types.js';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
];

export interface FetchTrackerInput {
  platform: Platform;
  trackerId: string;
}

export async function fetchTrackerProfile({ platform, trackerId }: FetchTrackerInput): Promise<string> {
  const ua = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]!;
  const url = `https://tracker.gg/rocket-league/profile/${platform}/${encodeURIComponent(trackerId)}/overview`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': ua,
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Sec-Ch-Ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
    },
  });
  if (!res.ok) throw new Error(`tracker.gg returned ${res.status} for ${platform}/${trackerId}`);
  return await res.text();
}

export function jitterMs(): number {
  // 30–120s between players
  return 30_000 + Math.floor(Math.random() * 90_000);
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/tracker/client.ts tests/tracker-client.test.ts
git commit -m "feat(tracker-client): HTTP client with realistic Chrome headers + jitter helper"
```

---

## Task 8: Config loader

**Files:**
- Create: `src/config.ts`
- Create: `tests/config.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/config.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../src/config.js';

const ENV_KEYS = ['GOOGLE_SERVICE_ACCOUNT_JSON', 'SHEET_ID'];

describe('loadConfig', () => {
  const originalEnv: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of ENV_KEYS) {
      originalEnv[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (originalEnv[k] === undefined) delete process.env[k];
      else process.env[k] = originalEnv[k];
    }
  });

  it('returns parsed config when all env vars present', () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = '{"client_email":"x@y.iam.gserviceaccount.com","private_key":"-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n"}';
    process.env.SHEET_ID = '1abc';
    const cfg = loadConfig();
    expect(cfg.sheetId).toBe('1abc');
    expect(cfg.serviceAccount.client_email).toBe('x@y.iam.gserviceaccount.com');
  });

  it('throws when SHEET_ID missing', () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = '{"client_email":"x","private_key":"y"}';
    expect(() => loadConfig()).toThrow(/SHEET_ID/);
  });

  it('throws when service account JSON malformed', () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = 'not json';
    process.env.SHEET_ID = '1abc';
    expect(() => loadConfig()).toThrow(/GOOGLE_SERVICE_ACCOUNT_JSON/);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- tests/config.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement config**

```ts
// src/config.ts

export interface ServiceAccount {
  client_email: string;
  private_key: string;
}

export interface Config {
  sheetId: string;
  serviceAccount: ServiceAccount;
}

export function loadConfig(): Config {
  const sheetId = process.env.SHEET_ID;
  if (!sheetId) throw new Error('SHEET_ID env var is required');

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON env var is required');

  let serviceAccount: ServiceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch (e) {
    throw new Error(`GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON: ${(e as Error).message}`);
  }
  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON missing client_email or private_key');
  }
  return { sheetId, serviceAccount };
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/config.ts tests/config.test.ts
git commit -m "feat(config): env-driven loader with clear errors"
```

---

## Task 9: Sheet client — append rows

**Files:**
- Create: `src/sheet/client.ts`
- Create: `tests/sheet-client.test.ts`

- [ ] **Step 1: Write failing test using a mocked sheets API**

```ts
// tests/sheet-client.test.ts
import { describe, it, expect, vi } from 'vitest';
import { SheetClient } from '../src/sheet/client.js';

describe('SheetClient.appendRows', () => {
  it('calls sheets.values.append with correct args', async () => {
    const appendMock = vi.fn().mockResolvedValue({ data: { updates: { updatedRows: 1 } } });
    const sheets = { spreadsheets: { values: { append: appendMock } } };
    const client = new SheetClient('sheet-id', sheets as any);

    await client.appendRows('Snapshots_Tracker', [['a', 'b', 'c']]);

    expect(appendMock).toHaveBeenCalledOnce();
    expect(appendMock.mock.calls[0]![0]).toMatchObject({
      spreadsheetId: 'sheet-id',
      range: 'Snapshots_Tracker',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [['a', 'b', 'c']] },
    });
  });

  it('retries on 429 with exponential backoff', async () => {
    const err: any = new Error('rate limited');
    err.code = 429;
    const appendMock = vi
      .fn()
      .mockRejectedValueOnce(err)
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce({ data: { updates: { updatedRows: 1 } } });
    const sheets = { spreadsheets: { values: { append: appendMock } } };
    const client = new SheetClient('sheet-id', sheets as any, { backoffMs: 1 });

    await client.appendRows('Snapshots_Tracker', [['a']]);
    expect(appendMock).toHaveBeenCalledTimes(3);
  });

  it('gives up after 3 retries', async () => {
    const err: any = new Error('rate limited');
    err.code = 429;
    const appendMock = vi.fn().mockRejectedValue(err);
    const sheets = { spreadsheets: { values: { append: appendMock } } };
    const client = new SheetClient('sheet-id', sheets as any, { backoffMs: 1 });

    await expect(client.appendRows('Snapshots_Tracker', [['a']])).rejects.toThrow(/rate limited/);
    expect(appendMock).toHaveBeenCalledTimes(4); // initial + 3 retries
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- tests/sheet-client.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement SheetClient**

```ts
// src/sheet/client.ts
import { google, sheets_v4 } from 'googleapis';
import type { ServiceAccount } from '../config.js';

export interface SheetClientOptions {
  backoffMs?: number;
  maxRetries?: number;
}

export class SheetClient {
  constructor(
    public readonly sheetId: string,
    private readonly sheets: sheets_v4.Sheets,
    private readonly opts: SheetClientOptions = {}
  ) {}

  static async fromServiceAccount(sheetId: string, sa: ServiceAccount): Promise<SheetClient> {
    const auth = new google.auth.JWT({
      email: sa.client_email,
      key: sa.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    await auth.authorize();
    const sheets = google.sheets({ version: 'v4', auth });
    return new SheetClient(sheetId, sheets);
  }

  async appendRows(range: string, values: (string | number | null)[][]): Promise<void> {
    const backoffMs = this.opts.backoffMs ?? 500;
    const maxRetries = this.opts.maxRetries ?? 3;
    let attempt = 0;
    while (true) {
      try {
        await this.sheets.spreadsheets.values.append({
          spreadsheetId: this.sheetId,
          range,
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values },
        });
        return;
      } catch (e: any) {
        const retryable = e?.code === 429 || e?.code === 503;
        if (!retryable || attempt >= maxRetries) throw e;
        const delay = backoffMs * 2 ** attempt;
        await new Promise(r => setTimeout(r, delay));
        attempt++;
      }
    }
  }

  async readRange(range: string): Promise<string[][]> {
    const res = await this.sheets.spreadsheets.values.get({
      spreadsheetId: this.sheetId,
      range,
    });
    return (res.data.values ?? []) as string[][];
  }
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/sheet/client.ts tests/sheet-client.test.ts
git commit -m "feat(sheet-client): auth + append with exponential backoff"
```

---

## Task 10: Roster reader

**Files:**
- Create: `src/sheet/roster.ts`
- Create: `tests/sheet-roster.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/sheet-roster.test.ts
import { describe, it, expect, vi } from 'vitest';
import { readRoster } from '../src/sheet/roster.js';
import { SheetClient } from '../src/sheet/client.js';

describe('readRoster', () => {
  it('parses active rows from the Roster tab', async () => {
    const client = new SheetClient('id', { spreadsheets: { values: { get: vi.fn() } } } as any);
    vi.spyOn(client, 'readRange').mockResolvedValue([
      ['playerId', 'displayName', 'trackerPlatform', 'trackerId', 'steamId', 'ballchasingName', 'active'],
      ['fade', 'fade', 'epic', 'Squishy', '76561198000000000', 'fade', 'TRUE'],
      ['jaxx', 'jaxx', 'epic', 'JaxxRL', '', '', 'TRUE'],
      ['old-player', 'old', 'epic', 'old-id', '', '', 'FALSE'],
    ]);

    const roster = await readRoster(client);
    expect(roster).toHaveLength(2);
    expect(roster[0]).toMatchObject({
      playerId: 'fade',
      trackerPlatform: 'epic',
      trackerId: 'Squishy',
      steamId: '76561198000000000',
      ballchasingName: 'fade',
      active: true,
    });
    expect(roster[1]?.steamId).toBeUndefined();
  });

  it('throws when header row is missing required columns', async () => {
    const client = new SheetClient('id', { spreadsheets: { values: { get: vi.fn() } } } as any);
    vi.spyOn(client, 'readRange').mockResolvedValue([['displayName', 'trackerId']]);
    await expect(readRoster(client)).rejects.toThrow(/missing column/);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- tests/sheet-roster.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement roster reader**

```ts
// src/sheet/roster.ts
import type { PlayerRoster, Platform } from '../types.js';
import { SheetClient } from './client.js';

const REQUIRED = ['playerId', 'displayName', 'trackerPlatform', 'trackerId', 'active'] as const;
const VALID_PLATFORMS: Platform[] = ['epic', 'steam', 'psn', 'xbl', 'switch'];

export async function readRoster(client: SheetClient): Promise<PlayerRoster[]> {
  const rows = await client.readRange('Roster!A1:Z1000');
  if (rows.length === 0) return [];
  const header = rows[0]!;
  for (const col of REQUIRED) {
    if (!header.includes(col)) throw new Error(`Roster tab missing column: ${col}`);
  }
  const idx = (col: string) => header.indexOf(col);

  const out: PlayerRoster[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]!;
    if (row.length === 0) continue;
    const activeRaw = (row[idx('active')] ?? '').toUpperCase();
    if (activeRaw !== 'TRUE') continue;

    const platform = row[idx('trackerPlatform')] as Platform;
    if (!VALID_PLATFORMS.includes(platform)) continue;

    const steamId = row[idx('steamId')] || undefined;
    const ballchasingName = row[idx('ballchasingName')] || undefined;

    out.push({
      playerId: row[idx('playerId')]!,
      displayName: row[idx('displayName')]!,
      trackerPlatform: platform,
      trackerId: row[idx('trackerId')]!,
      steamId,
      ballchasingName,
      active: true,
    });
  }
  return out;
}
```

Note: the test's mock setup has `steamId` and `ballchasingName` columns in the header. The current implementation calls `idx('steamId')` which will be `-1` if the column is absent. Add a guard:

```ts
const safeGet = (row: string[], col: string) => {
  const i = header.indexOf(col);
  return i >= 0 ? row[i] : undefined;
};
```

Then replace `row[idx('steamId')] || undefined` with `safeGet(row, 'steamId') || undefined` and same for ballchasingName.

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/sheet/roster.ts tests/sheet-roster.test.ts
git commit -m "feat(sheet-roster): read active players from Roster tab"
```

---

## Task 11: Snapshots appender

**Files:**
- Create: `src/sheet/snapshots.ts`
- Create: `tests/sheet-snapshots.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/sheet-snapshots.test.ts
import { describe, it, expect, vi } from 'vitest';
import { appendTrackerSnapshot } from '../src/sheet/snapshots.js';
import { SheetClient } from '../src/sheet/client.js';
import type { TrackerSnapshot } from '../src/types.js';

describe('appendTrackerSnapshot', () => {
  it('writes one row per playlist', async () => {
    const client = new SheetClient('id', { spreadsheets: { values: { append: vi.fn() } } } as any);
    const appendSpy = vi.spyOn(client, 'appendRows').mockResolvedValue();

    const snap: TrackerSnapshot = {
      timestampUtc: '2026-05-15T03:00:00Z',
      playerId: 'fade',
      platform: 'epic',
      playlists: [
        { playlist: '1s', rank: 'GC3', division: 'I', mmr: 1612, gamesPlayedSeason: 80, winsSeason: 50, winStreak: 2 },
        { playlist: '2s', rank: 'SSL', division: null, mmr: 1820, gamesPlayedSeason: 200, winsSeason: 120, winStreak: 4 },
      ],
      recentMatches: [
        { id: 'm1', ts: '2026-05-15T02:50:00Z', result: 'W', mmrDelta: 12, playlist: '2s' },
      ],
    };

    await appendTrackerSnapshot(client, snap);
    expect(appendSpy).toHaveBeenCalledOnce();
    const [range, values] = appendSpy.mock.calls[0]!;
    expect(range).toBe('Snapshots_Tracker');
    expect(values).toHaveLength(2);
    expect(values[0]![3]).toBe('1s');
    expect(values[1]![3]).toBe('2s');
    expect(values[0]![10]).toContain('m1'); // recent matches JSON in column 10
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- tests/sheet-snapshots.test.ts`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement appender**

```ts
// src/sheet/snapshots.ts
import { SheetClient } from './client.js';
import type { TrackerSnapshot } from '../types.js';

export async function appendTrackerSnapshot(
  client: SheetClient,
  snap: TrackerSnapshot
): Promise<void> {
  const matchesJson = JSON.stringify(snap.recentMatches);
  const rows = snap.playlists.map(p => [
    snap.timestampUtc,
    snap.playerId,
    snap.platform,
    p.playlist,
    p.rank ?? '',
    p.division ?? '',
    p.mmr ?? '',
    p.gamesPlayedSeason ?? '',
    p.winsSeason ?? '',
    p.winStreak ?? '',
    matchesJson,
  ]);
  await client.appendRows('Snapshots_Tracker', rows);
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/sheet/snapshots.ts tests/sheet-snapshots.test.ts
git commit -m "feat(sheet-snapshots): append one row per playlist to Snapshots_Tracker"
```

---

## Task 12: Run-log appender

**Files:**
- Create: `src/sheet/run-log.ts`
- Create: `tests/sheet-run-log.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/sheet-run-log.test.ts
import { describe, it, expect, vi } from 'vitest';
import { appendRunLog } from '../src/sheet/run-log.js';
import { SheetClient } from '../src/sheet/client.js';

describe('appendRunLog', () => {
  it('writes a single row with provider + status + duration', async () => {
    const client = new SheetClient('id', { spreadsheets: { values: { append: vi.fn() } } } as any);
    const spy = vi.spyOn(client, 'appendRows').mockResolvedValue();
    await appendRunLog(client, {
      timestampUtc: '2026-05-15T03:00:00Z',
      provider: 'tracker',
      playerId: 'fade',
      status: 'ok',
      durationMs: 1234,
      errorSummary: null,
    });
    expect(spy).toHaveBeenCalledOnce();
    const [range, values] = spy.mock.calls[0]!;
    expect(range).toBe('run_log');
    expect(values[0]).toEqual([
      '2026-05-15T03:00:00Z',
      'tracker',
      'fade',
      'ok',
      1234,
      '',
    ]);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npm test -- tests/sheet-run-log.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/sheet/run-log.ts
import { SheetClient } from './client.js';
import type { RunLogEntry } from '../types.js';

export async function appendRunLog(client: SheetClient, entry: RunLogEntry): Promise<void> {
  await client.appendRows('run_log', [[
    entry.timestampUtc,
    entry.provider,
    entry.playerId ?? '',
    entry.status,
    entry.durationMs,
    entry.errorSummary ?? '',
  ]]);
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/sheet/run-log.ts tests/sheet-run-log.test.ts
git commit -m "feat(sheet-run-log): append observability rows"
```

---

## Task 13: Orchestrator entry point

**Files:**
- Create: `src/index.ts`

This is the only non-TDD code task — it's pure glue. Verify it manually via local dev run in Task 14.

- [ ] **Step 1: Implement entry point**

```ts
// src/index.ts
import { loadConfig } from './config.js';
import { SheetClient } from './sheet/client.js';
import { readRoster } from './sheet/roster.js';
import { appendTrackerSnapshot } from './sheet/snapshots.js';
import { appendRunLog } from './sheet/run-log.js';
import { fetchTrackerProfile, jitterMs } from './tracker/client.js';
import { parseTrackerProfile } from './tracker/parser.js';
import type { TrackerSnapshot } from './types.js';

async function main() {
  const cfg = loadConfig();
  const client = await SheetClient.fromServiceAccount(cfg.sheetId, cfg.serviceAccount);
  const roster = await readRoster(client);
  console.log(`[tracker] starting run, ${roster.length} active players`);

  for (let i = 0; i < roster.length; i++) {
    const p = roster[i]!;
    const startedAt = Date.now();
    const nowUtc = new Date().toISOString();
    try {
      const html = await fetchTrackerProfile({ platform: p.trackerPlatform, trackerId: p.trackerId });
      const parsed = parseTrackerProfile(html);
      const snap: TrackerSnapshot = {
        timestampUtc: nowUtc,
        playerId: p.playerId,
        platform: parsed.platform,
        playlists: parsed.playlists,
        recentMatches: parsed.recentMatches,
      };
      await appendTrackerSnapshot(client, snap);
      await appendRunLog(client, {
        timestampUtc: nowUtc,
        provider: 'tracker',
        playerId: p.playerId,
        status: 'ok',
        durationMs: Date.now() - startedAt,
        errorSummary: null,
      });
      console.log(`[tracker] ok ${p.playerId} in ${Date.now() - startedAt}ms`);
    } catch (e) {
      const msg = (e as Error).message.slice(0, 200);
      await appendRunLog(client, {
        timestampUtc: nowUtc,
        provider: 'tracker',
        playerId: p.playerId,
        status: 'error',
        durationMs: Date.now() - startedAt,
        errorSummary: msg,
      }).catch(() => { /* don't block the run on log failure */ });
      console.error(`[tracker] error ${p.playerId}: ${msg}`);
    }

    if (i < roster.length - 1) {
      const wait = jitterMs();
      console.log(`[tracker] jitter sleep ${wait}ms before next player`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: orchestrate one tracker scrape run with per-player error boundary"
```

---

## Task 14: Google Cloud + Sheets setup docs

**Files:**
- Create: `docs/setup/01-google-cloud.md`
- Create: `docs/setup/02-sheet-init.md`
- Create: `docs/setup/03-github-secrets.md`

- [ ] **Step 1: Write `01-google-cloud.md`**

```markdown
# 01 · Google Cloud service account

The GitHub Actions cron writes to your sheet via a Google service account. This is a one-time setup.

## Steps

1. Open https://console.cloud.google.com/projectcreate. Create a project called `ntx-player-tracker`. (If you already have a Google Cloud project, you can reuse it.)
2. With that project selected, open https://console.cloud.google.com/apis/library/sheets.googleapis.com and click **Enable**.
3. Open https://console.cloud.google.com/iam-admin/serviceaccounts and click **Create service account**:
   - Service account name: `ntx-sheet-writer`
   - Service account ID: leave default
   - Click **Create and continue**, skip role assignment (we'll grant access at the sheet level), click **Done**.
4. Click into the newly created service account → **Keys** tab → **Add key** → **Create new key** → **JSON**. Download the file. **Treat this like a password — it grants edit access to whatever sheet you share with it.**
5. Open the file. Confirm it has `client_email` and `private_key`. Save it for Task 03.

## Sharing the sheet with the service account

After Task 02 (sheet creation):
1. Open the sheet in Google Sheets.
2. Click **Share** (top right).
3. Paste the `client_email` value from the JSON file (looks like `ntx-sheet-writer@ntx-player-tracker.iam.gserviceaccount.com`).
4. Set permission to **Editor**.
5. Uncheck "Notify people" and click **Share**.
```

- [ ] **Step 2: Write `02-sheet-init.md`**

```markdown
# 02 · Create the Google Sheet

1. Go to https://sheets.new — this opens a fresh blank sheet.
2. Rename the file to `NTX Player Tracker`.
3. Copy the sheet ID from the URL — it's the long string between `/d/` and `/edit`. Save it for Task 03.
4. Open **Extensions → Apps Script**. A new tab opens.
5. Delete the placeholder code. Paste the entire contents of `google-apps-script/sheet-bootstrap.gs` from this repo.
6. Click **Save** (disk icon), then **Run**. Authorize the script when prompted (it needs permission to modify the sheet you opened it from).
7. Return to the sheet. You should see 11 tabs: `Today`, `Trends`, `Tryouts`, `Sessions`, `Goals`, `Roster`, `Snapshots_Tracker`, `Snapshots_Steam`, `Snapshots_Ballchasing`, `Config`, `run_log`. (Steam/Ballchasing tabs are empty placeholders for later plans.)
8. Click into `Roster`. Add yourself a row to test:

   `fade | fade | epic | Squishy | (steamID64 optional) | (ballchasing optional) | TRUE`

9. Share the sheet with the service account email (see Task 01, "Sharing the sheet").
```

- [ ] **Step 3: Write `03-github-secrets.md`**

```markdown
# 03 · GitHub Actions secrets

After the repo is pushed to GitHub:

1. Go to **Settings → Secrets and variables → Actions**.
2. Click **New repository secret** for each:

| Name | Value |
|---|---|
| `SHEET_ID` | The long ID from the sheet URL (between `/d/` and `/edit`) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | The entire contents of the service account JSON file. Paste the raw JSON text including braces and newlines — GitHub stores it as-is. |

To verify: open the Actions tab and click **Run workflow** on `Tracker scrape` after the workflow is added (Task 16). Watch the run log.
```

- [ ] **Step 4: Commit**

```bash
git add docs/setup/01-google-cloud.md docs/setup/02-sheet-init.md docs/setup/03-github-secrets.md
git commit -m "docs(setup): Google Cloud + sheet + GitHub secrets walkthroughs"
```

---

## Task 15: Apps Script — sheet bootstrap

**Files:**
- Create: `google-apps-script/appsscript.json`
- Create: `google-apps-script/sheet-bootstrap.gs`

- [ ] **Step 1: Create `appsscript.json`**

```json
{
  "timeZone": "America/Chicago",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8"
}
```

- [ ] **Step 2: Create bootstrap script**

```javascript
// google-apps-script/sheet-bootstrap.gs
// Run once from the Apps Script editor. Idempotent — safe to re-run.

var TABS = {
  'Today': [['Card rendering happens here. Don\'t edit by hand.']],
  'Trends': [['Trend charts (filled in a later plan).']],
  'Tryouts': [['Paste tracker.gg URL', 'Display Name', 'Platform', 'Rank 2s', 'MMR 2s', 'VAC bans', 'Account age', 'Public profile', 'Verdict']],
  'Sessions': [['Date', 'Player', 'Focus area', 'VOD link', 'Follow-up']],
  'Goals': [['Player', 'Playlist', 'Target', 'Deadline', 'Start value', 'Notes']],
  'Roster': [['playerId', 'displayName', 'trackerPlatform', 'trackerId', 'steamId', 'ballchasingName', 'active']],
  'Snapshots_Tracker': [['timestamp_utc', 'player_id', 'platform', 'playlist', 'rank', 'division', 'mmr', 'games_played_season', 'wins_season', 'win_streak', 'recent_matches_json']],
  'Snapshots_Steam': [['timestamp_utc', 'player_id', 'steam_id', 'profile_visibility', 'account_created', 'country', 'vac_ban_count', 'community_banned', 'watchlist_playtime_json']],
  'Snapshots_Ballchasing': [['timestamp_utc', 'player_id', 'replays_in_window', 'window_start', 'window_end', 'aggregate_stats_json', 'teammate_counts_json']],
  'Config': [['key', 'value', 'description'],
             ['tilt_losses_threshold', '4', 'In last 10 games, losses count for tilt'],
             ['tilt_mmr_threshold', '-40', 'MMR delta in last 10 games for tilt'],
             ['late_night_hour', '23', 'Local hour after which counts as late-night'],
             ['coverage_red_pct', '30', 'Ballchasing coverage % below this is red'],
             ['minutes_per_game', '6', 'Used to estimate hours from games delta'],
             ['session_stale_days', '21', 'Sessions older than this turn yellow on Today'],
             ['tracker_last_run_utc', '', 'Auto-set'],
             ['steam_last_run_utc', '', 'Auto-set'],
             ['ballchasing_last_run_utc', '', 'Auto-set']],
  'run_log': [['timestamp_utc', 'provider', 'player_id', 'status', 'duration_ms', 'error_summary']],
};

function bootstrap() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TABS).forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getLastRow() === 0) {
      var rows = TABS[name];
      sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
      sheet.setFrozenRows(1);
    }
  });
  // Delete the default "Sheet1" if it's still empty
  var sheet1 = ss.getSheetByName('Sheet1');
  if (sheet1 && sheet1.getLastRow() <= 1 && sheet1.getLastColumn() <= 1) ss.deleteSheet(sheet1);
}
```

- [ ] **Step 3: Commit**

```bash
git add google-apps-script/appsscript.json google-apps-script/sheet-bootstrap.gs
git commit -m "feat(apps-script): one-shot sheet bootstrap creating all 11 tabs with headers"
```

---

## Task 16: GitHub Actions — hourly tracker workflow

**Files:**
- Create: `.github/workflows/tracker-scrape.yml`

- [ ] **Step 1: Create workflow**

```yaml
name: Tracker scrape

on:
  schedule:
    - cron: '17 * * * *'   # every hour at :17 to avoid the rush
  workflow_dispatch:        # manual trigger from Actions tab

permissions:
  contents: read

jobs:
  scrape:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Run tracker scraper
        env:
          GOOGLE_SERVICE_ACCOUNT_JSON: ${{ secrets.GOOGLE_SERVICE_ACCOUNT_JSON }}
          SHEET_ID: ${{ secrets.SHEET_ID }}
        run: npm start
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/tracker-scrape.yml
git commit -m "ci: hourly tracker scrape cron workflow"
```

---

## Task 17: Apps Script — assembler v1 (Today cards)

**Files:**
- Create: `google-apps-script/assembler.gs`
- Create: `docs/setup/04-apps-script.md`

- [ ] **Step 1: Create assembler**

```javascript
// google-apps-script/assembler.gs
// Reads latest Snapshots_Tracker rows and renders one card block per player onto Today.
// Install a 5-minute time-driven trigger pointing at `assemble`.

var PLAYLIST_ORDER = ['1s', '2s', '3s'];

function assemble() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var snapshots = ss.getSheetByName('Snapshots_Tracker');
  var roster = ss.getSheetByName('Roster');
  var today = ss.getSheetByName('Today');
  var config = ss.getSheetByName('Config');
  if (!snapshots || !roster || !today || !config) return;

  var rosterRows = roster.getDataRange().getValues();
  var snapRows = snapshots.getDataRange().getValues();
  if (snapRows.length < 2) return;

  var rosterHeader = rosterRows[0];
  var snapHeader = snapRows[0];

  var rosterIdx = headerMap(rosterHeader);
  var snapIdx = headerMap(snapHeader);

  // Group snapshots by (playerId, playlist), keep the two most recent (latest + ≥24h prior)
  var grouped = {};
  for (var i = 1; i < snapRows.length; i++) {
    var r = snapRows[i];
    var key = r[snapIdx.player_id] + '|' + r[snapIdx.playlist];
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push({
      ts: new Date(r[snapIdx.timestamp_utc]),
      rank: r[snapIdx.rank],
      division: r[snapIdx.division],
      mmr: Number(r[snapIdx.mmr]),
      games: Number(r[snapIdx.games_played_season]),
      wins: Number(r[snapIdx.wins_season]),
      winStreak: Number(r[snapIdx.win_streak]),
      matchesJson: r[snapIdx.recent_matches_json],
    });
  }
  Object.keys(grouped).forEach(function (k) {
    grouped[k].sort(function (a, b) { return b.ts.getTime() - a.ts.getTime(); });
  });

  today.clearContents();
  today.getRange(1, 1).setValue('NTX Player Grind · last refresh ' + new Date().toISOString());

  var row = 3;
  for (var ri = 1; ri < rosterRows.length; ri++) {
    var rr = rosterRows[ri];
    if (String(rr[rosterIdx.active]).toUpperCase() !== 'TRUE') continue;
    var playerId = rr[rosterIdx.playerId];
    var displayName = rr[rosterIdx.displayName];

    var card = [['Player', displayName, '', '', '', '']];
    for (var pi = 0; pi < PLAYLIST_ORDER.length; pi++) {
      var pl = PLAYLIST_ORDER[pi];
      var data = grouped[playerId + '|' + pl] || [];
      var latest = data[0];
      if (!latest) {
        card.push([pl, '—', '—', '—', '—', '—']);
        continue;
      }
      var prior24h = findSnapshotBefore(data, latest.ts.getTime() - 24 * 3600 * 1000);
      var delta24 = (prior24h && !isNaN(prior24h.mmr)) ? (latest.mmr - prior24h.mmr) : null;
      var rankCell = latest.rank + (latest.division ? ' ' + latest.division : '');
      card.push([pl, rankCell, latest.mmr, formatDelta(delta24), latest.games || 0, statusEmoji(latest, delta24)]);
    }
    today.getRange(row, 1, card.length, 6).setValues(card);
    row += card.length + 1;
  }

  setConfig(config, 'tracker_last_run_utc', new Date().toISOString());
}

function headerMap(header) {
  var out = {};
  for (var i = 0; i < header.length; i++) out[header[i]] = i;
  return out;
}

function findSnapshotBefore(sorted, beforeMs) {
  for (var i = 0; i < sorted.length; i++) {
    if (sorted[i].ts.getTime() <= beforeMs) return sorted[i];
  }
  return null;
}

function formatDelta(d) {
  if (d === null || isNaN(d)) return '—';
  if (d > 0) return '+' + d;
  return String(d);
}

function statusEmoji(latest, delta24) {
  var streak = latest.winStreak || 0;
  if (streak >= 3) return '🔥';
  if (delta24 !== null && delta24 <= -40) return '⚠';
  if (delta24 === null) return '💤';
  return '✓';
}

function setConfig(config, key, value) {
  var rows = config.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (rows[i][0] === key) {
      config.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
}
```

- [ ] **Step 2: Create `docs/setup/04-apps-script.md`**

```markdown
# 04 · Deploy the Apps Script assembler

1. Open the sheet → **Extensions → Apps Script** (same editor as the bootstrap).
2. Click the **+** next to Files → **Script**. Name it `assembler`.
3. Paste the contents of `google-apps-script/assembler.gs`. Save.
4. In the left sidebar, click **Triggers** (clock icon).
5. Click **Add Trigger**:
   - Function: `assemble`
   - Event source: `Time-driven`
   - Type: `Minutes timer`
   - Interval: `Every 5 minutes`
6. Save. Authorize when prompted.

The trigger fires every 5 minutes from now on. To run it once immediately, return to the script editor, select `assemble` from the dropdown, click **Run**.

## Sanity check

After at least one tracker workflow run has succeeded (check the GitHub Actions tab):

- Open the sheet → `Today` tab. You should see one block per active roster player with 1s/2s/3s rows.
- If a player block shows all `—`, either they haven't been scraped yet or their tracker.gg URL was wrong.
- Open `run_log` to see per-player status from the most recent scrape.
```

- [ ] **Step 3: Commit**

```bash
git add google-apps-script/assembler.gs docs/setup/04-apps-script.md
git commit -m "feat(apps-script): assembler renders Today tab with 1s/2s/3s rows + MMR Δ24h + status"
```

---

## Task 18: README + smoke-test workflow

**Files:**
- Create: `README.md`
- Create: `.github/workflows/smoke-test.yml`

- [ ] **Step 1: Write README**

```markdown
# NTX Player Tracker

Cloud-hosted Google Sheet that tracks each NTX player's Rocket League grind hourly. No local infrastructure required.

## What it does (Plan 1 · Foundation)

- Hourly GitHub Actions cron scrapes tracker.gg for each rostered player.
- Writes raw snapshot rows to `Snapshots_Tracker` in your sheet.
- Apps Script assembler runs every 5 minutes, renders a `Today` tab with one card per player (1s/2s/3s rank, MMR, MMR Δ24h, status emoji).

## Quickstart

1. Walk through `docs/setup/01-google-cloud.md` to create a service account.
2. Walk through `docs/setup/02-sheet-init.md` to create the sheet and run the bootstrap script.
3. Push this repo to a new GitHub repo (public for free Actions minutes).
4. Walk through `docs/setup/03-github-secrets.md` to add `SHEET_ID` and `GOOGLE_SERVICE_ACCOUNT_JSON`.
5. Walk through `docs/setup/04-apps-script.md` to install the assembler trigger.
6. In GitHub → Actions tab → `Tracker scrape` → **Run workflow** to fire the first run manually.
7. After it finishes (~5 min for 6 players), open the sheet's `Today` tab.

## Local dev

```sh
npm install
cp .env.example .env.local
# Fill in SHEET_ID and GOOGLE_SERVICE_ACCOUNT_JSON in .env.local
node --env-file=.env.local --import tsx src/index.ts
```

## What's coming

- Plan 2: Steam integration (hours, profile basics, watchlist apps)
- Plan 3: Ballchasing + replay-based mechanics + coverage indicator
- Plan 4: Manual tabs (Tryouts paste-URL flow, Sessions log, Goals tracker)

See `docs/superpowers/specs/2026-05-15-ntx-player-tracker-design.md` for the full design.
```

- [ ] **Step 2: Add smoke-test workflow**

```yaml
# .github/workflows/smoke-test.yml
name: Smoke test (manual)

on:
  workflow_dispatch:
    inputs:
      tracker_platform:
        description: 'Tracker platform (epic|steam|psn|xbl|switch)'
        required: true
        default: 'epic'
      tracker_id:
        description: 'Tracker ID'
        required: true

jobs:
  smoke:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - name: Fetch and parse one profile
        run: |
          node --import tsx -e "
            import('./src/tracker/client.js').then(async ({ fetchTrackerProfile }) => {
              import('./src/tracker/parser.js').then(({ parseTrackerProfile }) => {
                fetchTrackerProfile({ platform: '${{ inputs.tracker_platform }}', trackerId: '${{ inputs.tracker_id }}' })
                  .then(html => {
                    const parsed = parseTrackerProfile(html);
                    console.log(JSON.stringify(parsed, null, 2));
                  })
                  .catch(e => { console.error(e); process.exit(1); });
              });
            });
          "
```

- [ ] **Step 3: Commit**

```bash
git add README.md .github/workflows/smoke-test.yml
git commit -m "docs: README + manual smoke test workflow"
```

---

## Task 19: End-to-end manual verification

This is not code — it's a checklist for the person running the plan to confirm the foundation works against real data before declaring done.

- [ ] **Step 1: Push repo to GitHub**

```bash
git remote add origin https://github.com/<your-username>/ntx-player-tracker.git
git push -u origin main
```

(Create the repo first via github.com/new — public, no README, no .gitignore. The push delivers everything.)

- [ ] **Step 2: Set GitHub secrets**

Per `docs/setup/03-github-secrets.md`. Set `SHEET_ID` and `GOOGLE_SERVICE_ACCOUNT_JSON`.

- [ ] **Step 3: Add at least one row to Roster tab**

Use a real Rocket League player whose tracker.gg profile is public. Set `active = TRUE`.

- [ ] **Step 4: Trigger the workflow manually**

Actions tab → **Tracker scrape** → **Run workflow** → green button.

Expected:
- Workflow completes green ✅ within ~5 minutes (plus jitter delays between players).
- `Snapshots_Tracker` has new rows (one per playlist per player).
- `run_log` has matching `ok` rows.

If 403s appear: tracker.gg may be blocking GitHub Actions IPs. Re-run; if persistent across 2-3 runs, raise it before starting Plan 2 — we'll add a paid proxy step (ScraperAPI ~$0 free tier covers ~7k req/mo, fits 144×30=4,320 hourly hits) and update the client.

- [ ] **Step 5: Run the assembler once**

Apps Script editor → select `assemble` → **Run**. Authorize if asked.

Expected: `Today` tab fills with one card per player showing 1s/2s/3s rows + MMR + Δ24h ('—' on the first run because no prior snapshot exists yet) + games count + status emoji.

- [ ] **Step 6: Wait for the next hourly cron and confirm Δ24h begins populating**

After ~25 hours of hourly runs, the `MMR Δ24h` column should show real numbers (not `—`) for any playlist a player has touched.

- [ ] **Step 7: Tag the release**

```bash
git tag -a v0.1.0 -m "Foundation complete: hourly tracker scrape + Today card v1"
git push --tags
```

---

## Self-review (run before declaring plan complete)

The brainstorming spec listed the following requirements. Each maps to a Plan 1 task:

| Spec section | Task(s) |
|---|---|
| Hourly tracker.gg scraping with realistic headers + jitter | 7, 13, 16 |
| Cloudflare-aware error handling, per-player try/catch | 13, 12 |
| `__NEXT_DATA__` parser with PARSE_ERROR surfacing | 5, 6, 12 |
| Google service account + sheet auth | 9, 14 |
| 11-tab sheet schema | 15 |
| Snapshots_Tracker schema | 11, 15 |
| Roster tab as source of truth | 10, 15 |
| run_log observability | 12, 13 |
| Today card with 1s/2s/3s + MMR + Δ24h + status emoji | 17 |
| Apps Script assembler on 5-min trigger | 17 |
| Unit tests with fixture HTML | 4, 5, 6 |
| Manual smoke test workflow | 18 |
| Setup docs covering GCP, sheet init, GH secrets, Apps Script | 14, 17 |

**Out of scope for Plan 1 (intentionally deferred):**
- Steam integration (Plan 2)
- Ballchasing integration + coverage (Plan 3)
- Tryouts paste-URL flow, Sessions, Goals, Trends charts, synergy matrix (Plan 4)
- All 16 derived metrics beyond status emoji + MMR Δ24h (Plans 2-4 add the rest)
