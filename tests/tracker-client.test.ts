// tests/tracker-client.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchTrackerProfile } from '../src/tracker/client.js';

describe('fetchTrackerProfile', () => {
  const originalKey = process.env.TRACKER_API_KEY;
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.TRACKER_API_KEY = 'test-key-abc';
  });
  afterEach(() => {
    if (originalKey === undefined) delete process.env.TRACKER_API_KEY;
    else process.env.TRACKER_API_KEY = originalKey;
  });

  it('sends TRN-Api-Key header and hits the public API URL', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"data":{}}', { status: 200 })
    );

    await fetchTrackerProfile({ platform: 'epic', trackerId: 'fade.シ' });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toContain('https://public-api.tracker.gg/v2/rocket-league/standard/profile/epic/');
    expect(String(url)).toContain(encodeURIComponent('fade.シ'));
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['TRN-Api-Key']).toBe('test-key-abc');
    expect(headers['Accept']).toBe('application/json');
  });

  it('throws when TRACKER_API_KEY is missing', async () => {
    delete process.env.TRACKER_API_KEY;
    await expect(
      fetchTrackerProfile({ platform: 'epic', trackerId: 'x' })
    ).rejects.toThrow(/TRACKER_API_KEY/);
  });

  it('throws on non-200 (e.g., 403/429)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('blocked', { status: 403 }));
    await expect(
      fetchTrackerProfile({ platform: 'epic', trackerId: 'x' })
    ).rejects.toThrow(/403/);
  });

  it('returns response body on 200', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"data":{"platformInfo":{}}}', { status: 200 })
    );
    const body = await fetchTrackerProfile({ platform: 'epic', trackerId: 'x' });
    expect(body).toContain('platformInfo');
  });
});
