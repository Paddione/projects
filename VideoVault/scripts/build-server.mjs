import { build } from 'esbuild';
import { readFile } from 'fs/promises';
import path from 'path';

const pkg = JSON.parse(await readFile('./package.json', 'utf8'));
const external = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
].filter(dep => dep !== '@shared');

await build({
    entryPoints: ['server/index.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    outdir: 'dist',
    external,
    sourcemap: true,
    alias: {
        '@shared': path.resolve(import.meta.dirname, '../../shared-infrastructure/shared/videovault')
    }
});
