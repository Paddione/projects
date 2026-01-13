import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const baseEnvPath = join(rootDir, '.env');

if (fs.existsSync(baseEnvPath)) {
  dotenv.config({ path: baseEnvPath });
}

const env = process.env.NODE_ENV ?? process.env.AUTH_NODE_ENV;
let overridePath: string | null = null;

if (env === 'development') {
  overridePath = join(rootDir, '.env-dev');
} else if (env === 'production') {
  overridePath = join(rootDir, '.env-prod');
} else if (env === 'test') {
  overridePath = join(rootDir, '.env-test');
}

if (overridePath && fs.existsSync(overridePath)) {
  dotenv.config({ path: overridePath, override: true });
}

const fallbacks: Record<string, string> = {
  DATABASE_URL: 'AUTH_DATABASE_URL',
  PORT: 'AUTH_PORT',
  NODE_ENV: 'AUTH_NODE_ENV',
  JWT_SECRET: 'AUTH_JWT_SECRET',
  JWT_REFRESH_SECRET: 'AUTH_JWT_REFRESH_SECRET',
  ACCESS_TOKEN_EXPIRY: 'AUTH_ACCESS_TOKEN_EXPIRY',
  REFRESH_TOKEN_EXPIRY: 'AUTH_REFRESH_TOKEN_EXPIRY',
  SESSION_SECRET: 'AUTH_SESSION_SECRET',
  SESSION_MAX_AGE: 'AUTH_SESSION_MAX_AGE',
  ALLOWED_ORIGINS: 'AUTH_ALLOWED_ORIGINS',
  APP_URL: 'AUTH_APP_URL',
  OAUTH_CODE_EXPIRY: 'AUTH_OAUTH_CODE_EXPIRY',
  GOOGLE_CLIENT_ID: 'AUTH_GOOGLE_CLIENT_ID',
  GOOGLE_CLIENT_SECRET: 'AUTH_GOOGLE_CLIENT_SECRET',
  GOOGLE_REDIRECT_URI: 'AUTH_GOOGLE_REDIRECT_URI',
  BCRYPT_ROUNDS: 'AUTH_BCRYPT_ROUNDS',
  MAX_LOGIN_ATTEMPTS: 'AUTH_MAX_LOGIN_ATTEMPTS',
  ACCOUNT_LOCKOUT_DURATION: 'AUTH_ACCOUNT_LOCKOUT_DURATION',
};

for (const [target, source] of Object.entries(fallbacks)) {
  if (!process.env[target] && process.env[source]) {
    process.env[target] = process.env[source];
  }
}
