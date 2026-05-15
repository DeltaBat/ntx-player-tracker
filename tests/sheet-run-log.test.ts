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
