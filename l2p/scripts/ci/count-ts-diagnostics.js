#!/usr/bin/env node
// CI utility: run tests to surface ts-jest diagnostics (warnOnly) and count them.
// Produces a JSON summary and optional GitHub Step Summary markdown.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function runCommand(cmd, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'], ...options });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()))
    child.stderr.on('data', (d) => (stderr += d.toString()))
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function extractDiagnostics(text) {
  const lines = text.split(/\r?\n/);
  const diagLines = [];
  const codeSet = new Set();
  const entrySet = new Set();
  const codeRegex = /\bTS(\d{3,5})\b/;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/ts-jest\[ts-compiler]/i.test(line) || codeRegex.test(line)) {
      const match = line.match(codeRegex);
      const code = match ? `TS${match[1]}` : 'TS?';
      codeSet.add(code);
      // Try to include the next line for context
      const context = lines[i + 1] || '';
      const entry = `${code}::${line.trim()}${context ? ` // ${context.trim()}` : ''}`;
      if (!entrySet.has(entry)) {
        entrySet.add(entry);
        diagLines.push(entry);
      }
    }
  }
  return {
    totalLines: diagLines.length,
    uniqueCodes: Array.from(codeSet).sort(),
    entries: diagLines,
  };
}

async function main() {
  const updateBaseline = process.argv.includes('--update-baseline') || process.env.UPDATE_BASELINE === '1';
  const start = Date.now();
  const env = { ...process.env, CI: '1', FORCE_COLOR: '0', NODE_ENV: 'test', TEST_ENVIRONMENT: 'ci', TEST_TYPE: 'unit' };
  console.log('Running unit tests to collect TS diagnostics...');
  const results = [];
  results.push(await runCommand('npm', ['--prefix', 'frontend', 'run', 'test:unit', '--silent'], { env }));
  results.push(await runCommand('npm', ['--prefix', 'backend', 'run', 'test:unit', '--silent'], { env }));

  const combined = results.map(r => r.stdout + '\n' + r.stderr).join('\n');
  const diags = extractDiagnostics(combined);
  const durationMs = Date.now() - start;

  const outDir = path.join(process.cwd(), 'coverage-reports');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'ts-diagnostics.json');
  const summary = {
    generatedAt: new Date().toISOString(),
    durationMs,
    totalDiagnosticLines: diags.totalLines,
    uniqueCodes: diags.uniqueCodes,
  };
  // Baseline compare (non-failing)
  // Prefer config/ts, fall back to .kiro for backward compatibility
  const configTsDir = path.join(process.cwd(), 'config', 'ts');
  const kiroDir = path.join(process.cwd(), '.kiro');
  let baselinePath = path.join(configTsDir, 'ts-diagnostics-baseline.json');
  if (!fs.existsSync(baselinePath)) {
    const legacy = path.join(kiroDir, 'ts-diagnostics-baseline.json');
    if (fs.existsSync(legacy)) baselinePath = legacy;
  }
  let baseline = null;
  try {
    if (fs.existsSync(baselinePath)) {
      baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    }
  } catch (_) {
    baseline = null;
  }
  if (baseline) {
    const prevCodes = new Set(baseline.uniqueCodes || []);
    const currCodes = new Set(diags.uniqueCodes);
    const addedCodes = diags.uniqueCodes.filter(c => !prevCodes.has(c));
    const removedCodes = (baseline.uniqueCodes || []).filter(c => !currCodes.has(c));
    summary.baseline = {
      totalDiagnosticLines: baseline.totalDiagnosticLines ?? 0,
      uniqueCodes: baseline.uniqueCodes || [],
    };
    summary.delta = {
      totalDiagnosticLines: diags.totalLines - (baseline.totalDiagnosticLines ?? 0),
      addedCodes,
      removedCodes,
    };
  } else {
    summary.baseline = null;
    summary.delta = null;
  }
  // Optionally update baseline file
  if (updateBaseline) {
    if (!fs.existsSync(configTsDir)) fs.mkdirSync(configTsDir, { recursive: true });
    const newBaseline = {
      totalDiagnosticLines: diags.totalLines,
      uniqueCodes: diags.uniqueCodes,
      updatedAt: new Date().toISOString(),
    };
    const newPath = path.join(configTsDir, 'ts-diagnostics-baseline.json');
    fs.writeFileSync(newPath, JSON.stringify(newBaseline, null, 2));
    baselinePath = newPath;
  }
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));

  // Save full log for inspection
  const logPath = path.join(outDir, 'ts-diagnostics.log');
  fs.writeFileSync(logPath, combined);

  console.log(`\nTS Diagnostics Summary`);
  console.log(`- Unique TS codes: ${diags.uniqueCodes.length} (${diags.uniqueCodes.join(', ') || 'none'})`);
  console.log(`- Diagnostic lines: ${diags.totalLines}`);
  console.log(`- Duration: ${(durationMs / 1000).toFixed(1)}s`);
  console.log(`- Saved JSON: ${outPath}`);
  console.log(`- Saved log: ${logPath}`);
  if (summary.baseline) {
    console.log(`- Baseline lines: ${summary.baseline.totalDiagnosticLines}`);
    console.log(`- Delta lines: ${summary.delta.totalDiagnosticLines >= 0 ? '+' : ''}${summary.delta.totalDiagnosticLines}`);
    if (summary.delta.addedCodes.length || summary.delta.removedCodes.length) {
      console.log(`- Codes added: ${summary.delta.addedCodes.join(', ') || 'none'}`);
      console.log(`- Codes removed: ${summary.delta.removedCodes.join(', ') || 'none'}`);
    }
  } else {
    console.log(`- No baseline found (config/ts/ts-diagnostics-baseline.json)`);
  }

  // GitHub Step Summary (if available)
  const stepSummary = process.env.GITHUB_STEP_SUMMARY;
  if (stepSummary) {
    const md = [
      `### TS Diagnostics`,
      `- Unique TS codes: ${diags.uniqueCodes.length}`,
      `- Codes: ${diags.uniqueCodes.join(', ') || 'none'}`,
      `- Diagnostic lines: ${diags.totalLines}`,
      `- Duration: ${(durationMs / 1000).toFixed(1)}s`,
      summary.baseline ? `- Baseline lines: ${summary.baseline.totalDiagnosticLines}` : `- Baseline: none`,
      summary.baseline ? `- Delta lines: ${summary.delta.totalDiagnosticLines >= 0 ? '+' : ''}${summary.delta.totalDiagnosticLines}` : '',
      summary.baseline && summary.delta.addedCodes.length ? `- Codes added: ${summary.delta.addedCodes.join(', ')}` : '',
      summary.baseline && summary.delta.removedCodes.length ? `- Codes removed: ${summary.delta.removedCodes.join(', ')}` : '',
      `- Artifacts: ts-diagnostics.json, ts-diagnostics.log`,
      ''
    ].join('\n');
    fs.appendFileSync(stepSummary, md);
  }
  // Always exit 0 (non-failing)
  process.exit(0);
}

main().catch((e) => {
  console.error('Failed to collect TS diagnostics:', e);
  process.exit(0);
});
