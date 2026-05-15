// src/tracker/client.ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Platform } from '../types.js';

const execFileAsync = promisify(execFile);

export interface FetchTrackerInput {
  platform: Platform;
  trackerId: string;
}

// Cloudflare fingerprints Node's TLS handshake and blocks fetch().
// Curl's TLS fingerprint passes, so we shell out to the system curl binary.
// Hits api.tracker.gg (the public unauthenticated endpoint their own frontend uses).

export type CurlRunner = (args: string[]) => Promise<{ stdout: string }>;

const defaultRunner: CurlRunner = async (args) => {
  const { stdout } = await execFileAsync('curl', args, { maxBuffer: 10 * 1024 * 1024 });
  return { stdout: stdout.toString() };
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

export async function fetchTrackerProfile(
  { platform, trackerId }: FetchTrackerInput,
  runner: CurlRunner = defaultRunner
): Promise<string> {
  const url = `https://api.tracker.gg/api/v2/rocket-league/standard/profile/${platform}/${encodeURIComponent(trackerId)}`;
  const args = [
    '-s',
    '--fail-with-body',
    '-A', UA,
    '-H', 'Origin: https://rocketleague.tracker.network',
    '-H', 'Referer: https://rocketleague.tracker.network/',
    '-H', 'Accept: application/json',
    url,
  ];

  try {
    const { stdout } = await runner(args);
    return stdout;
  } catch (e: any) {
    const body = (e?.stdout ?? '').toString().slice(0, 200);
    const code = e?.code ?? 'unknown';
    throw new Error(`curl tracker fetch failed for ${platform}/${trackerId} (exit ${code}): ${body}`);
  }
}

export function jitterMs(): number {
  // 1-3s between players — api.tracker.gg is permissive but no need to hammer
  return 1_000 + Math.floor(Math.random() * 2_000);
}
