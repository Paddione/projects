import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const PATTERNS = [
  /\.korczewski\.de/g,
  /\.paddione\.de/g,
];

const SCAN_DIRS = ['k8s', 'arena', 'l2p', 'auth', 'shop', 'VideoVault', 'SOS'];
const SKIP_FILES = [/node_modules/, /\.git/, /\.env/, /baseline\.json/, /CLAUDE\.md/];

const violations = [];
const gitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();

for (const dir of SCAN_DIRS) {
  const fullPath = `${gitRoot}/${dir}`;
  if (!existsSync(fullPath)) continue;
  const files = execSync(`find "${fullPath}" -type f 2>/dev/null`, { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  for (const file of files) {
    const rel = file.replace(`${gitRoot}/`, '');
    if (SKIP_FILES.some(s => s.test(rel))) continue;
    const content = readFileSync(file, 'utf8');
    for (const pattern of PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        violations.push({ file: rel, pattern: pattern.source, count: matches.length });
      }
    }
  }
}

const allowed = ['k8s/secrets/', 'environments/', 'env/'];
const realViolations = violations.filter(v => !allowed.some(a => v.file.startsWith(a)));

if (realViolations.length > 0) {
  console.log('S3 — Hardcoded Hostname Violations:');
  for (const v of realViolations) {
    console.log(`  S3:${v.file}:${v.pattern}  (${v.count}x)`);
  }
  process.exitCode = 1;
} else {
  console.log('S3 — Hardcoded Hostnames: OK');
}
