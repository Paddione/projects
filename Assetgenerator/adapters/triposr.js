import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getWorker } from '../worker-manager.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = resolve(process.env.ASSETGENERATOR_ROOT || resolve(__dirname, '..'), 'scripts');

export async function generate({ id, asset, config, libraryRoot }) {
  const scriptPath = join(SCRIPTS_DIR, 'generate_3d.py');
  const conceptPath = join(libraryRoot, 'concepts', asset.category, `${id}.png`);
  const outputDir = join(libraryRoot, 'models', asset.category);

  const args = [
    scriptPath,
    '--id', id,
    '--backend', 'triposr',
    '--input', conceptPath,
    '--output', outputDir,
  ];

  const worker = getWorker();
  if (worker) {
    const result = await worker.exec({
      cmd: 'python3', args, cwd: process.env.ASSETGENERATOR_ROOT || resolve(__dirname, '..'), env: {},
    });
    if (result.code !== 0) throw new Error(`generate_3d.py exited ${result.code}: ${result.stderr}`);
    return { status: 'done', path: `models/${asset.category}/${id}.glb`, backend: 'triposr' };
  }

  throw new Error('No GPU worker connected. Select a cloud backend or start the worker.');
}
