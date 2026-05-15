// src/tracker/client.ts
import type { Platform } from '../types.js';

export interface FetchTrackerInput {
  platform: Platform;
  trackerId: string;
}

export async function fetchTrackerProfile({ platform, trackerId }: FetchTrackerInput): Promise<string> {
  const key = process.env.TRACKER_API_KEY;
  if (!key) throw new Error('TRACKER_API_KEY env var is required');

  const url = `https://public-api.tracker.gg/v2/rocket-league/standard/profile/${platform}/${encodeURIComponent(trackerId)}`;
  const res = await fetch(url, {
    headers: {
      'TRN-Api-Key': key,
      'Accept': 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`tracker API returned ${res.status} for ${platform}/${trackerId}`);
  }
  return await res.text();
}

export function jitterMs(): number {
  // 1-3s between players — TRN API rate limit is ~60/min so this is generous
  return 1_000 + Math.floor(Math.random() * 2_000);
}
