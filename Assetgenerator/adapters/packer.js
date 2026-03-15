import { spawn } from 'node:child_process';
import { resolve, join, dirname } from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = resolve(__dirname, '..', 'scripts');

export async function generate({ id, asset, config, libraryRoot }) {
  const scriptPath = join(SCRIPTS_DIR, 'pack_sprites.ts');
  const inputDir = join(libraryRoot, 'renders');
  const outputDir = join(libraryRoot, 'sprites');

  const args = [
    'tsx', scriptPath,
    '--category', asset.category,
    '--input', inputDir,
    '--output', outputDir,
  ];

  return new Promise((resolvePromise, reject) => {
    const proc = spawn('npx', args, {
      cwd: resolve(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    proc.on('close', code => {
      if (code !== 0) return reject(new Error(`pack_sprites.ts exited ${code}: ${stderr}`));

      const pngPath = join(outputDir, `${asset.category}.png`);
      const size = existsSync(pngPath) ? statSync(pngPath).size : 0;

      resolvePromise({
        status: 'done',
        backend: 'packer',
        atlasSize: size,
      });
    });
  });
}
