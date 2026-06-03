import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';

const sourceDir = dirname(fileURLToPath(import.meta.url));
export const serverRoot = resolve(sourceDir, '..', '..');
export const repoRoot = resolve(serverRoot, '..');

type EnvMap = Record<string, string>;

function readEnvFile(path: string): EnvMap {
  if (!existsSync(path)) {
    return {};
  }
  return parse(readFileSync(path));
}

function mergeProcessEnv(base: EnvMap): EnvMap {
  const merged = { ...base };
  for (const [key, value] of Object.entries(process.env)) {
    if (value != null && value.trim() !== '') {
      merged[key] = value;
    }
  }
  return merged;
}

function boolValue(value: string | undefined, fallback: boolean): boolean {
  if (value == null || value.trim() === '') {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function parseOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isLocalDatabase(databaseUrl: string): boolean {
  try {
    const host = new URL(databaseUrl).hostname;
    return ['localhost', '127.0.0.1', '::1'].includes(host);
  } catch {
    return false;
  }
}

function sslEnabled(databaseUrl: string, value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase() ?? 'auto';
  if (normalized === 'auto') {
    return !isLocalDatabase(databaseUrl);
  }
  return boolValue(normalized, false);
}

const layeredEnv = mergeProcessEnv({
  ...readEnvFile(resolve(repoRoot, '.env')),
  ...readEnvFile(resolve(serverRoot, '.env')),
});

function required(name: string): string {
  const value = layeredEnv[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required. Put it in server/.env or the root .env file.`);
  }
  return value;
}

const nodeEnv = required('NODE_ENV');
const isProduction = nodeEnv === 'production';
const databaseUrl = required('DATABASE_URL');
const auth0Domain = required('AUTH0_DOMAIN');
const auth0Audience = required('AUTH0_AUDIENCE');
const port = Number(required('PORT'));
const databasePoolMax = Number(layeredEnv.DATABASE_POOL_MAX ?? 5);

if (!Number.isInteger(port) || port <= 0) {
  throw new Error('PORT must be a positive integer.');
}

if (!Number.isInteger(databasePoolMax) || databasePoolMax <= 0) {
  throw new Error('DATABASE_POOL_MAX must be a positive integer.');
}

export const env = {
  nodeEnv,
  isProduction,
  port,
  host: required('HOST'),
  corsOrigins: parseOrigins(layeredEnv.CORS_ORIGINS),
  databaseUrl,
  databaseSsl: sslEnabled(databaseUrl, layeredEnv.DATABASE_SSL),
  databasePoolMax,
  auth0Domain,
  auth0Audience,
  auth0Issuer: `https://${auth0Domain.replace(/^https?:\/\//, '').replace(/\/$/, '')}/`,
  blobReadWriteToken: layeredEnv.BLOB_READ_WRITE_TOKEN?.trim() || null,
} as const;
