#!/usr/bin/env node
// Runs TypeScript diagnostics for backend and logs all issues to the central logger file without failing the build.
// This script always exits with code 0.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(BACKEND_ROOT, '..');

// Import central logger from shared package (built ESM output)
const errorHandlingModulePath = path.resolve(PROJECT_ROOT, 'shared', 'error-handling', 'dist', 'index.js');
const { RequestLogger } = await import(errorHandlingModulePath);

const logger = RequestLogger.getInstance({
  level: 'info',
  service: 'backend',
  environment: process.env['NODE_ENV'] || 'development',
  enableConsole: true,
  enableFile: true,
  filePath: path.resolve(PROJECT_ROOT, 'logs', 'backend', 'error.log')
});

await fs.mkdir(path.dirname(path.resolve(PROJECT_ROOT, 'logs', 'backend', 'error.log')), { recursive: true }).catch(() => {});

function parseTsOutputToEntries(output) {
  return output
    .split(/\r?\n/g)
    .map(l => l.trimEnd())
    .filter(Boolean);
}

async function run() {
  await logger.logInfo('Starting TypeScript diagnostics (non-blocking) for backend');

  const tscBin = path.resolve(BACKEND_ROOT, 'node_modules', '.bin', 'tsc');
  const args = ['--pretty', 'false'];

  const child = spawn(tscBin, args, { cwd: BACKEND_ROOT, stdio: ['ignore', 'pipe', 'pipe'] });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', (d) => { stdout += d.toString(); });
  child.stderr.on('data', (d) => { stderr += d.toString(); });

  const exitCode = await new Promise((resolve) => {
    child.on('close', resolve);
  });

  const combined = `${stdout}\n${stderr}`;
  const lines = parseTsOutputToEntries(combined);

  if (lines.length === 0) {
    await logger.logInfo('TypeScript diagnostics completed: no issues found');
  } else {
    await logger.logWarn(`TypeScript diagnostics reported ${lines.length} line(s)`, { tool: 'tsc', exitCode });
    for (const line of lines) {
      await logger.logError({
        message: line,
        code: 'TS_DIAGNOSTIC',
        category: 'typescript',
        severity: 'error',
        recoverable: true,
        retryable: false,
        context: { tool: 'tsc' },
        metadata: { package: 'backend' },
        stack: undefined
      });
    }
    await logger.logInfo('TypeScript diagnostics logging complete');
  }

  process.exit(0);
}

run().catch(async (e) => {
  try {
    await logger.logCritical('Failed to run backend TypeScript diagnostics logger', { error: e?.message });
  } catch (_) {}
  process.exit(0);
});
