#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';

const gitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();
const artifacts = {};

function sha256(path) {
  try {
    if (!existsSync(path)) return null;
    return execSync(`sha256sum "${path}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).split(' ')[0];
  } catch { return null; }
}

// Track project package.json checksums
const projects = ['arena/frontend', 'arena/backend', 'l2p/frontend', 'l2p/backend', 'auth', 'shop', 'VideoVault', 'SOS', 'Assetgenerator', 'mediaviewer-widget', 'packages/videovault-player', 'packages/error-handling'];
for (const proj of projects) {
  const pkgPath = `${gitRoot}/${proj}/package.json`;
  if (existsSync(pkgPath)) {
    const hash = sha256(pkgPath);
    if (hash) artifacts[`${proj}/package.json`] = hash;
  }
}

// Track lockfiles
for (const proj of ['arena', 'l2p', 'auth', 'shop', 'VideoVault', 'SOS', 'Assetgenerator', 'mediaviewer-widget', 'packages/videovault-player', 'packages/error-handling']) {
  const lf = `${gitRoot}/${proj}/package-lock.json`;
  if (existsSync(lf)) {
    const hash = sha256(lf);
    if (hash) artifacts[`${proj}/package-lock.json`] = hash;
  }
}

// Quality baseline
const bl = `${gitRoot}/scripts/quality/baseline.json`;
if (existsSync(bl)) {
  const hash = sha256(bl);
  if (hash) artifacts['scripts/quality/baseline.json'] = hash;
}

writeFileSync(`${gitRoot}/.freshness.json`, JSON.stringify(artifacts, null, 2) + '\n');
console.log(`Freshness manifest regenerated (${Object.keys(artifacts).length} artifacts).`);
