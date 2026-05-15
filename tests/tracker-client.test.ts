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
