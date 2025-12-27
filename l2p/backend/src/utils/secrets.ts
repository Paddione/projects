import fs from 'fs';
import path from 'path';

/**
 * Utility functions for reading Docker secrets
 */

const SECRETS_PATH = '/run/secrets';

/**
 * Read a secret from Docker secrets or fall back to environment variable
 * @param secretName - Name of the secret file
 * @param envVarName - Name of the environment variable fallback
 * @returns The secret value
 */
export function readSecret(secretName: string, envVarName: string): string {
  const secretPath = path.join(SECRETS_PATH, secretName);
  
  try {
    // Try to read from Docker secret first
    if (fs.existsSync(secretPath)) {
      const secret = fs.readFileSync(secretPath, 'utf8').trim();
      if (secret) {
        console.log(`✅ Successfully read secret from ${secretPath}`);
        return secret;
      }
    } else {
      console.log(`⚠️  Secret file ${secretPath} does not exist, falling back to environment variable`);
    }
  } catch (error) {
    console.warn(`Failed to read secret from ${secretPath}:`, error);
  }
  
  // Fall back to environment variable
  const envValue = process.env[envVarName];
  if (!envValue) {
    throw new Error(`Secret '${secretName}' not found in Docker secrets and environment variable '${envVarName}' is not set`);
  }
  
  console.log(`✅ Using environment variable ${envVarName} as fallback`);
  return envValue;
}

/**
 * Read all application secrets
 */
export function getSecrets() {
  return {
    jwtSecret: readSecret('jwt_secret', 'JWT_SECRET'),
    jwtRefreshSecret: readSecret('jwt_refresh_secret', 'JWT_REFRESH_SECRET'),
    postgresPassword: readSecret('postgres_password', 'POSTGRES_PASSWORD'),
    smtpPassword: readSecret('smtp_password', 'SMTP_PASS'),
    geminiApiKey: readSecret('gemini_api_key', 'GEMINI_API_KEY'),
  };
}

/**
 * Build database URL with secret password
 */
export function buildDatabaseUrl(): string {
  const secrets = getSecrets();
  const dbHost = process.env['DB_HOST'] || 'postgres';
  const dbPort = process.env['DB_PORT'] || '5432';
  const dbName = process.env['POSTGRES_DB'] || 'learn2play';
  const dbUser = process.env['POSTGRES_USER'] || 'l2p_user';
  
  return `postgresql://${dbUser}:${secrets.postgresPassword}@${dbHost}:${dbPort}/${dbName}`;
}
