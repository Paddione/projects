#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, '..');
const errors = [];

const requiredDirs = [
  'frontend/src/components',
  'frontend/src/pages',
  'frontend/src/__tests__',
  'backend/src/routes',
  'backend/src/services',
  'backend/src/repositories',
  'backend/src/__tests__',
  'docs'
];

for (const relPath of requiredDirs) {
  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) {
    errors.push(`Missing required directory: ${relPath}`);
  }
}

const requiredDocs = ['docs/PROJECT_STRUCTURE.md', 'docs/architecture-diagram.svg', 'docs/CONTRIBUTING.md'];
for (const relPath of requiredDocs) {
  const fullPath = path.join(rootDir, relPath);
  if (!fs.existsSync(fullPath)) {
    errors.push(`Missing required doc: ${relPath}`);
  }
}

const skipDirs = new Set(['node_modules', 'dist', 'build', 'coverage', '.git', '.idea']);
const testRegex = /\.test\.(t|j)sx?$/;

function walkDir(startDir, onFile) {
  if (!fs.existsSync(startDir)) return;
  const stack = [startDir];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (!skipDirs.has(entry.name)) {
          stack.push(full);
        }
      } else if (entry.isFile()) {
        onFile(full);
      }
    }
  }
}

function enforceTestPlacement(baseDir) {
  walkDir(path.join(rootDir, baseDir), filePath => {
    if (testRegex.test(filePath)) {
      const relative = path.relative(rootDir, filePath);
      if (!relative.includes('__tests__')) {
        errors.push(`Test file must live in a __tests__ folder: ${relative}`);
      }
    }
  });
}

enforceTestPlacement('frontend/src');
enforceTestPlacement('backend/src');

const sharedDir = path.join(rootDir, 'shared');
const sharedPackageAllowlist = new Set(['test-utils']);
if (fs.existsSync(sharedDir)) {
  const sharedPackages = fs.readdirSync(sharedDir, { withFileTypes: true }).filter(d => d.isDirectory());
  for (const dirent of sharedPackages) {
    if (sharedPackageAllowlist.has(dirent.name)) {
      continue;
    }
    const packageJsonPath = path.join(sharedDir, dirent.name, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      errors.push(`Shared package missing package.json: shared/${dirent.name}`);
    }
  }
}

if (errors.length) {
  console.error('✖ Structure verification failed:');
  for (const err of errors) {
    console.error(`  • ${err}`);
  }
  process.exit(1);
}

console.log('✓ Repository structure verified.');
