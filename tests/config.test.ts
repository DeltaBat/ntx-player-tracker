// tests/config.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../src/config.js';

const ENV_KEYS = ['GOOGLE_SERVICE_ACCOUNT_JSON', 'GOOGLE_SERVICE_ACCOUNT_PATH', 'SHEET_ID', 'STEAM_API_KEY'];

describe('loadConfig', () => {
  const originalEnv: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const k of ENV_KEYS) {
      originalEnv[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (originalEnv[k] === undefined) delete process.env[k];
      else process.env[k] = originalEnv[k];
    }
  });

  it('returns parsed config when all env vars present', () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = '{"client_email":"x@y.iam.gserviceaccount.com","private_key":"-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n"}';
    process.env.SHEET_ID = '1abc';
    const cfg = loadConfig();
    expect(cfg.sheetId).toBe('1abc');
    expect(cfg.serviceAccount.client_email).toBe('x@y.iam.gserviceaccount.com');
  });

  it('throws when SHEET_ID missing', () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = '{"client_email":"x","private_key":"y"}';
    expect(() => loadConfig()).toThrow(/SHEET_ID/);
  });

  it('throws when service account JSON malformed', () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = 'not json';
    process.env.SHEET_ID = '1abc';
    expect(() => loadConfig()).toThrow(/not valid JSON/);
  });

  it('exposes STEAM_API_KEY when present, null otherwise', () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = '{"client_email":"x","private_key":"y"}';
    process.env.SHEET_ID = '1abc';

    let cfg = loadConfig();
    expect(cfg.steamApiKey).toBeNull();

    process.env.STEAM_API_KEY = 'STEAM-KEY-123';
    cfg = loadConfig();
    expect(cfg.steamApiKey).toBe('STEAM-KEY-123');
  });
});
