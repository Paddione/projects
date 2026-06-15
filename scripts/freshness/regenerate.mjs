#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const gitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();

const artifacts = {};

// Dependency lockfiles freshness
const projects = ['arena/frontend', 'arena/backend', 'l2p/frontend', 'l2p/backend', 'auth', 'shop', 'VideoVault', 'SOS', 'Assetgenerator', 'mediaviewer-widget', 'packages/videovault-player'];
for (const proj of projects) {
  const pkgPath = `${gitRoot}/${proj}/package.json`;
  try {
    execSync(`ls "${pkgPath}" 2>/dev/null`, { encoding: 'utf8' });
    artifacts[`${proj}/package.json`] = execSync(`sha256sum "${pkgPath}"`, { encoding: 'utf8' }).split(' ')[0];
  } catch {}
}

// Root lockfile
try {
  artifacts['package-lock.json'] = execSync(`sha256sum "${gitRoot}/package-lock.json"`, { encoding: 'utf8' }).split(' ')[0];
} catch {}

// Quality baseline checksum
try {
  const baseline = execSync(`sha256sum "${gitRoot}/scripts/quality/baseline.json"`, { encoding: 'utf8' }).split(' '')[0];
  artifacts['scripts/quality/baseline.json'] = baseline;
} catch {}

writeFileSync(`${gitRoot}/.freshness.json`, JSON.stringify(artifacts, null, 2) + '\n');
console.log('Freshness manifest regenerated.');
