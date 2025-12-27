#!/usr/bin/env node

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Available project directories with package.json
const PROJECTS = {
  root: rootDir,
  frontend: path.join(rootDir, 'frontend'),
  backend: path.join(rootDir, 'backend'),
  shared: path.join(rootDir, 'shared')
};

// Helper to find the nearest package.json
function findNearestPackageDir(currentDir = process.cwd()) {
  let dir = path.resolve(currentDir);
  
  while (dir !== path.parse(dir).root) {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return null;
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Error: No script specified');
    console.log('Usage: npx run-script <project> <script> [args...]');
    console.log('Projects:', Object.keys(PROJECTS).join(', '));
    process.exit(1);
  }

  let project = 'root';
  let scriptAndArgs = [...args];
  
  // If first argument is a known project, use it
  if (PROJECTS[args[0]]) {
    project = args[0];
    scriptAndArgs = args.slice(1);
  } else {
    // Try to detect project from current directory
    const currentDir = findNearestPackageDir();
    if (currentDir) {
      const relPath = path.relative(rootDir, currentDir).split(path.sep)[0];
      if (relPath && PROJECTS[relPath]) {
        project = relPath;
      }
    }
  }

  if (scriptAndArgs.length === 0) {
    console.error('Error: No script specified');
    console.log(`Usage: npx run-script ${project} <script> [args...]`);
    process.exit(1);
  }

  const projectDir = PROJECTS[project];
  const script = scriptAndArgs[0];
  const scriptArgs = scriptAndArgs.slice(1);
  const fullCommand = `npm run ${script} ${scriptArgs.join(' ')}`;

  console.log(`Running in ${project}: ${fullCommand}`);
  
  try {
    execSync(fullCommand, { 
      stdio: 'inherit',
      cwd: projectDir,
      env: { ...process.env, FORCE_COLOR: '1' }
    });
  } catch (error) {
    process.exit(error.status || 1);
  }
}

main().catch(console.error);
