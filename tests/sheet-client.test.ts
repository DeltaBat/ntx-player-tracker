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
