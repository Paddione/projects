import { build } from 'esbuild';
import { readFile } from 'fs/promises';
import path from 'path';

import { existsSync } from 'fs';

const pkg = JSON.parse(await readFile('./package.json', 'utf8'));
const external = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
].filter(dep => dep !== '@shared');

// Robust shared path resolution for local and Docker environments
let sharedPath = path.resolve(import.meta.dirname, '../../shared-infrastructure/shared/videovault');
if (!existsSync(sharedPath)) {
    sharedPath = path.resolve(import.meta.dirname, '../shared-infrastructure/shared/videovault');
}

console.log(`Using shared path: ${sharedPath}`);

await build({
    entryPoints: ['server/index.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outdir: 'dist',
    external,
    sourcemap: true,
    alias: {
        '@shared': sharedPath
    }
});
