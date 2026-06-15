#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE_FILE = join(__dirname, 'baseline.json');

function runGate(name, script) {
  const gatePath = join(__dirname, 'gates', script);
  if (!existsSync(gatePath)) {
    console.log(`${name}: SKIPPED (gate not found)`);
    return [];
  }
  try {
    const out = execSync(`node "${gatePath}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    console.log(out.trim());
    return [];
  } catch (e) {
    const lines = e.stdout?.split('\n').filter(l => l.startsWith(`  ${name.split(' — ')[0]}:`)) || [];
    return lines.map(l => l.trim());
  }
}

const gates = [
  ['S1 — File Size', 'file-size.mjs'],
  ['S3 — Hardcoded Hostnames', 'hardcoded-hostnames.mjs'],
  ['S4 — Orphan Files', 'orphans.mjs'],
];

let allViolations = [];
for (const [name, script] of gates) {
  const violations = runGate(name, script);
  allViolations = allViolations.concat(violations);
}

const baseline = existsSync(BASELINE_FILE) ? JSON.parse(readFileSync(BASELINE_FILE, 'utf8')) : {};
const baselineKeys = new Set(Object.keys(baseline));
const currentKeys = new Set(allViolations.map(v => v.split('  ')[0]));

const newViolations = allViolations.filter(v => !baselineKeys.has(v));
const fixedViolations = [...baselineKeys].filter(k => !currentKeys.has(k));

if (fixedViolations.length > 0) {
  console.log(`\n✅ Fixed violations (removed from baseline): ${fixedViolations.length}`);
  for (const v of fixedViolations) delete baseline[v];
}

if (newViolations.length > 0) {
  console.log(`\n❌ NEW violations (not in baseline):`);
  for (const v of newViolations) console.log(`  ${v}`);
  console.log(`\nAdd to baseline with: node scripts/quality/update-baseline.mjs`);
  process.exitCode = 1;
}

if (process.exitCode === undefined) {
  console.log(`\n✅ All quality gates pass — ${currentKeys.size} violations in baseline.`);
  writeFileSync(BASELINE_FILE, JSON.stringify(Object.fromEntries([...currentKeys].map(k => [k, true])), null, 2) + '\n');
}
