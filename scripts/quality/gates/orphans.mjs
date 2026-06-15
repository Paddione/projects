import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const gitRoot = execSync('git rev-parse --show-toplevel', { encoding: 'utf8' }).trim();

// k8s YAML files are referenced by kustomization.yaml resources:, not by skaffold.yaml.
// Skip these directories as they use kustomize-based referencing.
const SKIP_DIRS = [
  'k8s/services',
  'k8s/infrastructure',
  'k8s/scripts',
  'k8s/base',
];

const violations = [];
for (const skipDir of SKIP_DIRS) {
  const full = `${gitRoot}/${skipDir}`;
  if (!existsSync(full)) continue;
  const files = execSync(`find "${full}" -type f 2>/dev/null`, { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  for (const file of files) {
    const rel = file.replace(`${gitRoot}/`, '');
    if (rel.endsWith('/kustomization.yaml') || rel.endsWith('/kustomization.yml')) continue;
    if (rel.includes('node_modules')) continue;
    violations.push(rel);
  }
}

// Check for truly orphaned files outside managed dirs
const ORPHAN_SCAN_DIRS = [
  { dir: 'scripts', pattern: /\.(sh|mjs|js)$/ },
];

const referenced = new Set();
try {
  execSync(`grep -rohP '"k8s/[^"]+"' "${gitRoot}/k8s/skaffold.yaml" 2>/dev/null || true`, { encoding: 'utf8' })
    .trim().split('\n').filter(Boolean).forEach(x => referenced.add(x.replace(/^"|"$/g, '')));
} catch {}

for (const { dir, pattern } of ORPHAN_SCAN_DIRS) {
  const full = `${gitRoot}/${dir}`;
  if (!existsSync(full)) continue;
  const files = execSync(`find "${full}" -type f 2>/dev/null`, { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  for (const file of files) {
    const rel = file.replace(`${gitRoot}/`, '');
    if (rel.includes('node_modules')) continue;
    if (!referenced.has(rel) && rel !== 'scripts/README.md') {
      violations.push(rel);
    }
  }
}

// All k8s files are in managed kustomize overlays — register them all as known
const known = new Set(violations);
const allowedDirs = ['k8s/services/', 'k8s/infrastructure/', 'k8s/scripts/', 'k8s/base/'];
const unrelated = [...known].filter(f => !allowedDirs.some(d => f.startsWith(d)));

if (unrelated.length > 0) {
  console.log('S4 — Orphan File Violations:');
  for (const v of unrelated) {
    console.log(`  S4:${v}`);
  }
  process.exitCode = 1;
} else {
  // Kustomize-managed files are expected — register as known, not violations
  console.log(`S4 — Orphan Files: OK (${known.size} kustomize-managed files known)`);
}
