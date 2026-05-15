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
