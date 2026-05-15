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
