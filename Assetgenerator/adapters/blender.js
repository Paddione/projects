import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getWorker } from '../worker-manager.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = process.env.ASSETGENERATOR_ROOT || resolve(__dirname, '..');

const TEMPLATE_MAP = {
  characters: 'character.blend',
  weapons: 'weapon.blend',
  items: 'item.blend',
  cover: 'cover.blend',
  tiles: 'tile.blend',
  ui: 'ui.blend',
};

export async function generate({ id, asset, config, libraryRoot }) {
  // Paths resolved for the worker machine
  const workerScript = join(PROJECT_ROOT, 'scripts', 'render_sprites.py');
  const modelPath = join(libraryRoot, 'models', asset.category, `${id}.glb`);
  const templatePath = join(libraryRoot, 'blend', TEMPLATE_MAP[asset.category] || 'character.blend');
  const outputDir = join(libraryRoot, 'renders');
  const blenderPath = config.blenderPath || 'blender';

  const args = [
    '--background',
    '--python', workerScript,
    '--',
    '--id', id,
    '--category', asset.category,
    '--model', modelPath,
    '--template', templatePath,
    '--output', outputDir,
  ];

  const worker = getWorker();
  if (worker) {
    const result = await worker.exec({ cmd: blenderPath, args, cwd: PROJECT_ROOT, env: {} });
    if (result.code !== 0) throw new Error(`Blender render exited ${result.code}: ${result.stderr.slice(-500)}`);

    const frameMatch = result.stdout.match(/FRAMES:(\d+)|Rendered (\d+) frames/i);
    const frameCount = frameMatch ? parseInt(frameMatch[1] || frameMatch[2], 10) : 0;

    if (frameCount === 0) {
      throw new Error(`Blender rendered 0 frames for "${id}". Check model exists at ${modelPath}`);
    }

    return { status: 'done', frameCount, backend: 'blender' };
  }

  throw new Error('No GPU worker connected. Select a cloud backend or start the worker.');
}
