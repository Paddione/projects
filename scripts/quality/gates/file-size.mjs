import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const LIMITS = {
  '.ts': 600,
  '.tsx': 600,
  '.js': 500,
  '.yml': 300,
  '.yaml': 300,
  '.sh': 300,
  '.md': 500,
};

const SCAN_DIRS = ['arena', 'l2p', 'auth', 'shop', 'VideoVault', 'SOS', 'Assetgenerator', 'k8s', 'packages', 'mediaviewer-widget'];

const violations = [];
const gitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();

for (const dir of SCAN_DIRS) {
  const fullPath = `${gitRoot}/${dir}`;
  if (!existsSync(fullPath)) continue;
  const files = execSync(`find "${fullPath}" -type f ${Object.keys(LIMITS).map(e => `-name "*${e}"`).join(' -o ')} 2>/dev/null`, { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  for (const file of files) {
    const ext = Object.keys(LIMITS).find(e => file.endsWith(e));
    if (!ext) continue;
    const limit = LIMITS[ext];
    const lines = readFileSync(file, 'utf8').split('\n').length;
    if (lines > limit) {
      violations.push({ file: file.replace(`${gitRoot}/`, ''), lines, limit });
    }
  }
}

if (violations.length > 0) {
  console.log('S1 — File Size Violations:');
  for (const v of violations) {
    console.log(`  S1:${v.file}  (${v.lines} lines, limit ${v.limit})`);
  }
  process.exitCode = 1;
} else {
  console.log('S1 — File Size: OK');
}
