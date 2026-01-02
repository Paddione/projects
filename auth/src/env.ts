import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

const env = process.env.NODE_ENV;
const candidates: string[] = [];

if (env === 'development') {
  candidates.push(join(rootDir, '.env-dev'));
} else if (env === 'production') {
  candidates.push(join(rootDir, '.env-prod'));
} else if (env === 'test') {
  candidates.push(join(rootDir, '.env-test'));
}

candidates.push(join(rootDir, '.env'));

for (const candidate of candidates) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate });
    break;
  }
}
