// src/config.ts
import { readFileSync } from 'node:fs';

export interface ServiceAccount {
  client_email: string;
  private_key: string;
}

export interface Config {
  sheetId: string;
  serviceAccount: ServiceAccount;
  steamApiKey: string | null;
}

export function loadConfig(): Config {
  const sheetId = process.env.SHEET_ID;
  if (!sheetId) throw new Error('SHEET_ID env var is required');

  const inlineJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const path = process.env.GOOGLE_SERVICE_ACCOUNT_PATH;
  let raw: string;
  if (inlineJson) {
    raw = inlineJson;
  } else if (path) {
    try {
      raw = readFileSync(path, 'utf8');
    } catch (e) {
      throw new Error(`failed to read GOOGLE_SERVICE_ACCOUNT_PATH (${path}): ${(e as Error).message}`);
    }
  } else {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SERVICE_ACCOUNT_PATH env var is required');
  }

  let serviceAccount: ServiceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch (e) {
    throw new Error(`service account JSON is not valid JSON: ${(e as Error).message}`);
  }
  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('service account JSON missing client_email or private_key');
  }

  const steamApiKey = process.env.STEAM_API_KEY?.trim() || null;

  return { sheetId, serviceAccount, steamApiKey };
}
