import { spawn } from 'node:child_process';
import { resolve, join, dirname } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = resolve(__dirname, '..', 'scripts');

const TEMPLATE_MAP = {
  characters: 'character.blend',
  weapons: 'weapon.blend',
  items: 'item.blend',
  cover: 'cover.blend',
  tiles: 'tile.blend',
  ui: 'ui.blend',
};

export async function generate({ id, asset, config, libraryRoot }) {
  const scriptPath = join(SCRIPTS_DIR, 'render_sprites.py');
  const modelPath = join(libraryRoot, 'models', asset.category, `${id}.glb`);
  const templatePath = join(libraryRoot, 'blend', TEMPLATE_MAP[asset.category] || 'character.blend');
  const outputDir = join(libraryRoot, 'renders', asset.category);
  const blenderPath = config.blenderPath || 'blender';

  const args = [
    '--background',
    '--python', scriptPath,
    '--',
    '--id', id,
    '--category', asset.category,
    '--model', modelPath,
    '--template', templatePath,
    '--output', outputDir,
  ];

  return new Promise((resolvePromise, reject) => {
    const proc = spawn(blenderPath, args, {
      cwd: resolve(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    proc.on('close', code => {
      if (code !== 0) return reject(new Error(`Blender render exited ${code}: ${stderr.slice(-500)}`));

      const renderDir = join(outputDir, id);
      let frameCount = 0;
      if (existsSync(renderDir)) {
        frameCount = readdirSync(renderDir).filter(f => f.endsWith('.png')).length;
      }

      resolvePromise({
        status: 'done',
        frameCount,
        backend: 'blender',
      });
    });
  });
}
