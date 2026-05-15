// src/config.ts

export interface ServiceAccount {
  client_email: string;
  private_key: string;
}

export interface Config {
  sheetId: string;
  serviceAccount: ServiceAccount;
}

export function loadConfig(): Config {
  const sheetId = process.env.SHEET_ID;
  if (!sheetId) throw new Error('SHEET_ID env var is required');

  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON env var is required');

  let serviceAccount: ServiceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch (e) {
    throw new Error(`GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON: ${(e as Error).message}`);
  }
  if (!serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON missing client_email or private_key');
  }
  return { sheetId, serviceAccount };
}
