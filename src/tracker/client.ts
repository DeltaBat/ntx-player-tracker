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
