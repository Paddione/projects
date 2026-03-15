import { spawn } from 'node:child_process';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = resolve(__dirname, '..', 'scripts');

export async function generate({ id, asset, config, libraryRoot }) {
  const scriptPath = join(SCRIPTS_DIR, 'generate_concepts.py');
  const outputDir = join(libraryRoot, 'concepts', asset.category);

  const args = [
    scriptPath,
    '--id', id,
    '--category', asset.category,
    '--backend', 'diffusers',
  ];

  if (asset.prompt) args.push('--prompt', asset.prompt);
  args.push('--output', outputDir);

  return new Promise((resolvePromise, reject) => {
    const proc = spawn('python3', args, {
      cwd: resolve(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    proc.on('close', code => {
      if (code !== 0) return reject(new Error(`generate_concepts.py (diffusers) exited ${code}: ${stderr}`));
      resolvePromise({
        status: 'done',
        path: `concepts/${asset.category}/${id}.png`,
        backend: 'diffusers',
      });
    });
  });
}
