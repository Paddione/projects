#!/usr/bin/env node
// Lightweight E2E environment sanity check to reduce flakiness
import fs from 'fs';
import path from 'path';
import net from 'net';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

function log(level, msg) {
  const icons = { info: 'ℹ️ ', ok: '✅', warn: '⚠️ ', err: '❌' };
  console.log(`${icons[level] || ''} ${msg}`);
}

function checkNodeVersion() {
  const major = parseInt(process.versions.node.split('.')[0], 10);
  if (major < 18) {
    log('warn', `Node ${process.versions.node} detected. Node >= 18 recommended for Playwright.`);
  } else {
    log('ok', `Node version OK (${process.versions.node}).`);
  }
}

function checkDir(p, label) {
  if (fs.existsSync(p)) {
    log('ok', `${label} present: ${p}`);
    return true;
  }
  log('warn', `${label} missing: ${p}`);
  return false;
}

function checkPlaywrightInstalled() {
  try {
    const cwd = path.join(process.cwd(), 'frontend', 'e2e');
    const resolved = require.resolve('@playwright/test', { paths: [cwd] });
    if (resolved) {
      log('ok', 'Playwright is installed in frontend/e2e.');
      return true;
    }
  } catch (_) {}
  log('warn', 'Playwright not found. Run: cd frontend && npx --yes playwright install --with-deps');
  return false;
}

async function portAvailable(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '127.0.0.1');
  });
}

async function checkPorts() {
  const ports = [3000, 3001];
  const results = await Promise.all(ports.map(portAvailable));
  let ok = true;
  results.forEach((avail, i) => {
    const port = ports[i];
    if (avail) log('ok', `Port ${port} available`);
    else { log('warn', `Port ${port} in use. E2E may reuse or fail.`); ok = false; }
  });
  return ok;
}

function checkEnvFiles() {
  const candidates = ['.env.test', '.env.dev', '.env.development'];
  const found = candidates.some(f => fs.existsSync(path.join(process.cwd(), f)));
  if (found) {
    log('ok', 'Env file present (.env.test/.env.dev/.env.development).');
  } else {
    log('warn', 'No env file found (.env.test/.env.dev/.env.development). Defaults will be used.');
  }
  return found;
}

async function main() {
  checkNodeVersion();
  const hasFront = checkDir(path.join(process.cwd(), 'frontend'), 'Frontend');
  const hasE2E = checkDir(path.join(process.cwd(), 'frontend', 'e2e'), 'Frontend E2E');
  const hasBack = checkDir(path.join(process.cwd(), 'backend'), 'Backend');
  const pw = checkPlaywrightInstalled();
  const portsOk = await checkPorts();
  const envOk = checkEnvFiles();

  // Gate condition: only block if clearly not ready
  const ready = hasFront && hasE2E && hasBack && pw;
  if (!ready) {
    log('err', 'E2E environment not ready.');
    process.exit(1);
  }
  // Warn-only conditions shouldn't fail the run
  if (!portsOk || !envOk) {
    log('warn', 'E2E may be flaky due to ports/env. Proceeding.');
  }
}

main().catch((e) => {
  log('err', `E2E env check failed: ${e?.message || e}`);
  process.exit(1);
});
