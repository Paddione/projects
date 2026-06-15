#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE_FILE = join(__dirname, 'baseline.json');

const gates = ['file-size.mjs', 'hardcoded-hostnames.mjs', 'orphans.mjs'];
let allViolations = [];

for (const script of gates) {
  const gatePath = join(__dirname, 'gates', script);
  if (!existsSync(gatePath)) continue;
  try {
    execSync(`node "${gatePath}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) {
    const lines = e.stdout?.split('\n').filter(l => l.startsWith('  ')) || [];
    allViolations = allViolations.concat(lines.map(l => l.trim()));
  }
}

const baseline = {};
for (const v of allViolations) {
  const key = v.split('  ')[0];
  baseline[key] = true;
}

writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2) + '\n');
console.log(`Baseline updated: ${Object.keys(baseline).length} violations.`);
