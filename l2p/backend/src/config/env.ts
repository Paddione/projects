// Centralized environment loader
// Picks appropriate .env file based on NODE_ENV with sensible fallbacks.
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Allow explicit override via DOTENV_CONFIG_PATH
const explicit = process.env['DOTENV_CONFIG_PATH'];
if (explicit && fs.existsSync(explicit)) {
  // Respect explicit override always
  dotenv.config({ path: explicit });
} else {
  // Detect if running inside a Docker container. In containers we want
  // environment variables provided by the orchestrator to be authoritative
  // and avoid loading local .env files that may contain localhost values.
  const isInDocker = fs.existsSync('/.dockerenv');

  if (!isInDocker) {
    const cwd = process.cwd();
    const candidates: string[] = [];
    const env = process.env['NODE_ENV'];

    // Order matters: environment-specific first, then base .env
    if (env === 'test') {
      candidates.push(path.join(cwd, '.env.test'));
    } else if (env === 'development') {
      candidates.push(path.join(cwd, '.env.dev'));
      candidates.push(path.join(cwd, '.env-dev'));
    } else if (env === 'production') {
      candidates.push(path.join(cwd, '.env.production'));
      candidates.push(path.join(cwd, '.env-prod'));
    }
    candidates.push(path.join(cwd, '.env'));

    // Load the first file that exists
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        dotenv.config({ path: p });
        break;
      }
    }
  }
}
