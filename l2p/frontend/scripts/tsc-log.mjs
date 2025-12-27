#!/usr/bin/env node
// Runs TypeScript diagnostics and logs all issues to the central logger file without failing the build.
// This script is safe to run in any environment. It never exits with non-zero.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';

// Resolve paths relative to frontend/
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_ROOT = path.resolve(__dirname, '..');
const PROJECT_ROOT = path.resolve(FRONTEND_ROOT, '..');

// Import central logger from shared package (built ESM output)
const errorHandlingModulePath = path.resolve(PROJECT_ROOT, 'shared', 'error-handling', 'dist', 'index.js');
const { RequestLogger } = await import(errorHandlingModulePath);

const logger = RequestLogger.getInstance({
  level: 'info',
  service: 'frontend',
  environment: process.env['NODE_ENV'] || 'development',
  enableConsole: true,
  enableFile: true,
  filePath: path.resolve(PROJECT_ROOT, 'logs', 'frontend', 'error.log')
});

// Ensure log directory exists
await fs.mkdir(path.dirname(path.resolve(PROJECT_ROOT, 'logs', 'frontend', 'error.log')), { recursive: true }).catch(() => {});

function parseTsOutputToEntries(output) {
  // Very light parsing: split by lines, filter empties. We log each line as an error to keep it simple and centralized.
  return output
    .split(/\r?\n/g)
    .map(l => l.trimEnd())
    .filter(Boolean);
}

async function run() {
  await logger.logInfo('Starting TypeScript diagnostics (non-blocking) for frontend');

  const tscBin = path.resolve(FRONTEND_ROOT, 'node_modules', '.bin', 'tsc');
  const args = ['--pretty', 'false', '--noEmit'];

  const child = spawn(tscBin, args, { cwd: FRONTEND_ROOT, stdio: ['ignore', 'pipe', 'pipe'] });

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
    // Group into a single error entry with context, and also log each line for easier grepping
    await logger.logWarn(`TypeScript diagnostics reported ${lines.length} line(s)`, { tool: 'tsc', exitCode });

    // Log each line as an error so they land in error log file
    for (const line of lines) {
      await logger.logError({
        message: line,
        code: 'TS_DIAGNOSTIC',
        category: 'typescript',
        severity: 'error',
        recoverable: true,
        retryable: false,
        context: { tool: 'tsc' },
        metadata: { package: 'frontend' },
        stack: undefined
      });
    }

    await logger.logInfo('TypeScript diagnostics logging complete');
  }

  // Always zero exit for non-critical behavior
  process.exit(0);
}

run().catch(async (e) => {
  try {
    await logger.logCritical('Failed to run TypeScript diagnostics logger', { error: e?.message });
  } catch (_) {}
  process.exit(0);
});
