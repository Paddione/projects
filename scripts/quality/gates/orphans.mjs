import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const gitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();

const REFERENCE_FILES = [
  'k8s/skaffold.yaml',
  'k8s/services/*/*.yaml',
  'k8s/infrastructure/*/*.yaml',
  'k8s/overlays/*/kustomization.yaml',
];

const SCAN_DIRS = [
  { dir: 'k8s/services', pattern: /\.yaml$/ },
  { dir: 'k8s/infrastructure', pattern: /\.yaml$/ },
  { dir: 'k8s/scripts', pattern: /\.sh$/ },
];

const referenced = new Set();
for (const pattern of REFERENCE_FILES) {
  const files = execSync(`find "${gitRoot}/${pattern.replace('*', '')}" -name "${pattern.split('/').pop()}" -type f 2>/dev/null || true`, { encoding: 'utf8' }).trim();
  if (files) {
    files.split('\n').forEach(f => execSync(`grep -oP '"k8s/[^"]+"' "${f}" 2>/dev/null || true`, { encoding: 'utf8' }).trim().split('\n').filter(Boolean).forEach(x => referenced.add(x.replace(/^"|"$/g, ''))));
  }
}

const violations = [];
for (const { dir, pattern } of SCAN_DIRS) {
  const full = `${gitRoot}/${dir}`;
  if (!existsSync(full)) continue;
  const files = execSync(`find "${full}" -type f 2>/dev/null`, { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  for (const file of files) {
    const rel = file.replace(`${gitRoot}/`, '');
    if (rel.endsWith('/kustomization.yaml') || rel.endsWith('/kustomization.yml')) continue;
    if (!referenced.has(rel)) {
      violations.push(rel);
    }
  }
}

if (violations.length > 0) {
  console.log('S4 — Orphan File Violations:');
  for (const v of violations) {
    console.log(`  S4:${v}`);
  }
  process.exitCode = 1;
} else {
  console.log('S4 — Orphan Files: OK');
}
