import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * AudioCraft adapter — spawns the project's generate_audio.py with override flags.
 * Captures SEED:<n> from stdout for state tracking.
 */
export async function generate({ id, type, prompt, seed, duration, projectConfig }) {
  const scriptPath = resolve(projectConfig._basePath, projectConfig.generateScript);
  const pythonPath = projectConfig.pythonPath
    ? resolve(projectConfig._basePath, projectConfig.pythonPath)
    : 'python3';
  const projectDir = resolve(projectConfig._basePath, projectConfig.audioRoot, '..', '..');

  const args = [
    scriptPath,
    '--id', id,
    '--type', type,
    '--backend', 'audiocraft',
    '--force',
  ];

  if (prompt) args.push('--prompt', prompt);
  if (seed != null) args.push('--seed', String(seed));
  if (duration != null) args.push('--duration', String(duration));

  return new Promise((resolvePromise, reject) => {
    const proc = spawn(pythonPath, args, {
      cwd: projectDir,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`generate_audio.py exited ${code}: ${stderr}`));
      }

      const seedMatch = stdout.match(/SEED:(\d+)/);
      const actualSeed = seedMatch ? parseInt(seedMatch[1], 10) : seed;

      resolvePromise({ seed: actualSeed, stdout, stderr });
    });
  });
}
