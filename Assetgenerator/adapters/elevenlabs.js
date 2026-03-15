import { spawn } from 'node:child_process';
import { resolve, join } from 'node:path';
import { existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * ElevenLabs adapter — spawns the project's generate_audio.py with elevenlabs backend.
 * The WAV conversion fix is handled in the Python script.
 * After generation, copies the WAV to outputPath (NAS) if provided.
 */
export async function generate({ id, type, prompt, seed, duration, outputPath, projectConfig }) {
  const scriptPath = resolve(projectConfig._basePath, projectConfig.generateScript);
  const pythonPath = projectConfig.pythonPath
    ? resolve(projectConfig._basePath, projectConfig.pythonPath)
    : 'python3';
  const projectDir = resolve(projectConfig._basePath, projectConfig.audioRoot, '..', '..');

  const args = [
    scriptPath,
    '--id', id,
    '--type', type,
    '--backend', 'elevenlabs',
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
        return reject(new Error(`generate_audio.py (elevenlabs) exited ${code}: ${stderr}`));
      }

      // Copy generated WAV to NAS outputPath if provided
      if (outputPath) {
        const audioRoot = resolve(projectConfig._basePath, projectConfig.audioRoot);
        const subdir = type === 'music' ? 'music' : 'sfx';
        const projectWav = join(audioRoot, subdir, `${id}.wav`);
        if (existsSync(projectWav)) {
          const destDir = dirname(outputPath);
          if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
          copyFileSync(projectWav, outputPath);
        }
      }

      const seedMatch = stdout.match(/SEED:(\d+)/);
      const actualSeed = seedMatch ? parseInt(seedMatch[1], 10) : seed;

      resolvePromise({ seed: actualSeed, stdout, stderr });
    });
  });
}
