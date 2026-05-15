// tests/tracker-client.test.ts
import { describe, it, expect, vi } from 'vitest';
import { fetchTrackerProfile, type CurlRunner } from '../src/tracker/client.js';

describe('fetchTrackerProfile', () => {
  it('invokes runner with the api.tracker.gg URL and required headers', async () => {
    const runner: CurlRunner = vi.fn().mockResolvedValue({
      stdout: '{"data":{"platformInfo":{"platformSlug":"epic"}}}',
    });

    await fetchTrackerProfile({ platform: 'epic', trackerId: 'fade.シ' }, runner);

    expect(runner).toHaveBeenCalledOnce();
    const args = (runner as any).mock.calls[0][0] as string[];
    expect(args.some(a => a.includes('api.tracker.gg/api/v2/rocket-league/standard/profile/epic/'))).toBe(true);
    expect(args.some(a => a.includes(encodeURIComponent('fade.シ')))).toBe(true);
    expect(args).toContain('Origin: https://rocketleague.tracker.network');
    expect(args).toContain('Accept: application/json');
  });

  it('returns runner stdout on success', async () => {
    const runner: CurlRunner = vi.fn().mockResolvedValue({
      stdout: '{"data":{"platformInfo":{}}}',
    });
    const body = await fetchTrackerProfile({ platform: 'epic', trackerId: 'x' }, runner);
    expect(body).toContain('platformInfo');
  });

  it('wraps and rethrows runner failures', async () => {
    const err: any = new Error('curl exit 22');
    err.code = 22;
    err.stdout = 'blocked by cloudflare';
    const runner: CurlRunner = vi.fn().mockRejectedValue(err);
    await expect(
      fetchTrackerProfile({ platform: 'epic', trackerId: 'x' }, runner)
    ).rejects.toThrow(/curl tracker fetch failed/);
  });
});
