#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const gitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
const manifestPath = `${gitRoot}/.freshness.json`;

if (!existsSync(manifestPath)) {
  console.log('Freshness manifest not found. Run: node scripts/freshness/regenerate.mjs');
  process.exit(1);
}

execSync(`node "${gitRoot}/scripts/freshness/regenerate.mjs"`, { encoding: 'utf8' });

const diff = execSync(`git diff --name-only "${manifestPath}" 2>/dev/null`, { encoding: 'utf8' }).trim();
if (diff) {
  console.log(`Freshness check FAILED: ${diff}`);
  console.log('Run: node scripts/freshness/regenerate.mjs && git add .freshness.json && git commit -m "chore: update freshness manifest"');
  process.exit(1);
} else {
  console.log('Freshness check: OK');
}
