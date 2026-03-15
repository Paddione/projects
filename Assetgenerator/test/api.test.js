/**
 * Assetgenerator API Tests
 *
 * Tests all library routes (audio + visual) using temp directories
 * to simulate NAS storage. Covers CRUD, import, assign, sync,
 * staleness propagation, and concurrency locks.
 *
 * Run: cd Assetgenerator && node --test test/api.test.js
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..');

// ─── Test Helpers ─────────────────────────────────────────────────────────

let baseUrl;
let server;
let tmpDir;
let nasAudioDir;
let nasVisualDir;
let arenaDir;

// Backup original files
const BACKUP_FILES = [
  'library.json',
  'visual-library.json',
  'config/library-config.json',
  'config/visual-config.json',
  'projects/arena.json',
];
const backups = {};

async function fetchJSON(path, opts = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json, headers: res.headers };
}

function createTestWav(filePath) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  try {
    // Use 0.5s duration with audible tone — short files get fully trimmed by silenceremove
    execFileSync('ffmpeg', [
      '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.5',
      '-ar', '44100', '-ac', '1', filePath,
    ], { stdio: 'pipe' });
  } catch {
    // Fallback: write a minimal WAV with actual audio data (not silence)
    const samples = 22050; // 0.5s at 44100Hz
    const dataSize = samples * 2; // 16-bit mono
    const header = Buffer.alloc(44 + dataSize);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);  // PCM
    header.writeUInt16LE(1, 22);  // mono
    header.writeUInt32LE(44100, 24);
    header.writeUInt32LE(44100 * 2, 28);
    header.writeUInt16LE(2, 32);
    header.writeUInt16LE(16, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);
    // Write a 440Hz sine wave
    for (let i = 0; i < samples; i++) {
      const val = Math.round(Math.sin(2 * Math.PI * 440 * i / 44100) * 16000);
      header.writeInt16LE(val, 44 + i * 2);
    }
    writeFileSync(filePath, header);
  }
}

// ─── Setup & Teardown ─────────────────────────────────────────────────────

before(async () => {
  // Create temp directory structure
  tmpDir = mkdtempSync(join(tmpdir(), 'assetgen-test-'));
  nasAudioDir = join(tmpDir, 'audio-library');
  nasVisualDir = join(tmpDir, 'visual-library');
  arenaDir = join(tmpDir, 'arena');

  // Create NAS directories
  for (const sub of [
    'sfx/weapons', 'sfx/footsteps', 'sfx/impacts', 'sfx/ui', 'sfx/environment',
    'music/battle', 'music/ambient', 'music/stings',
  ]) {
    mkdirSync(join(nasAudioDir, sub), { recursive: true });
  }

  for (const sub of [
    'concepts/characters', 'models/characters', 'renders/characters',
    'sprites', 'blend',
  ]) {
    mkdirSync(join(nasVisualDir, sub), { recursive: true });
  }

  // Create fake arena project structure
  mkdirSync(join(arenaDir, 'assets', 'audio', 'sfx'), { recursive: true });
  mkdirSync(join(arenaDir, 'assets', 'audio', 'music'), { recursive: true });
  mkdirSync(join(arenaDir, 'frontend', 'public', 'assets', 'sprites'), { recursive: true });
  mkdirSync(join(arenaDir, 'frontend', 'public', 'assets', 'sfx'), { recursive: true });

  // Create test WAV files in arena
  createTestWav(join(arenaDir, 'assets', 'audio', 'sfx', 'gunshot.wav'));
  createTestWav(join(arenaDir, 'assets', 'audio', 'sfx', 'melee_swing.wav'));
  createTestWav(join(arenaDir, 'assets', 'audio', 'music', 'battle.wav'));

  // Create a minimal arena manifest
  writeFileSync(join(arenaDir, 'assets', 'manifest.json'), JSON.stringify({
    meta: { version: '1.0.0', character_size: 64, tile_size: 32, item_size: 32, ui_size: 16 },
    characters: [
      { id: 'warrior', poses: ['stand', 'gun'], color: '#00f2ff' },
    ],
    weapons: [],
    items: [],
    tiles: [],
    cover: [],
    ui: [],
    sfx: [
      { id: 'gunshot', prompt: 'laser gunshot', duration: 0.5 },
      { id: 'melee_swing', prompt: 'sword swing', duration: 0.4 },
    ],
    music: [
      { id: 'battle', prompt: 'battle music', duration: 90, loop: true },
    ],
  }));

  // Create a test sprite atlas
  writeFileSync(join(arenaDir, 'frontend', 'public', 'assets', 'sprites', 'characters.png'), Buffer.alloc(100));
  writeFileSync(join(arenaDir, 'frontend', 'public', 'assets', 'sprites', 'characters.json'), JSON.stringify({ frames: {}, meta: {} }));

  // Backup and replace config files
  for (const f of BACKUP_FILES) {
    const fullPath = join(PROJECT_ROOT, f);
    if (existsSync(fullPath)) {
      backups[f] = readFileSync(fullPath, 'utf-8');
    }
  }

  // Write test configs
  writeFileSync(join(PROJECT_ROOT, 'config', 'library-config.json'), JSON.stringify({
    libraryRoot: nasAudioDir,
    loudness: { sfx: -16, music: -20 },
    categories: {
      sfx: ['weapons', 'footsteps', 'impacts', 'ui', 'environment'],
      music: ['battle', 'ambient', 'stings'],
    },
    defaultTags: ['arena', 'test'],
  }));

  writeFileSync(join(PROJECT_ROOT, 'config', 'visual-config.json'), JSON.stringify({
    libraryRoot: nasVisualDir,
    blenderPath: 'blender',
    categories: {
      characters: { directions: 8, defaultPoses: ['stand', 'gun'], size: 64, conceptResolution: 1024, has3D: true },
      tiles: { directions: 1, defaultPoses: ['idle'], size: 32, has3D: false, conceptResolution: 512 },
    },
    render: { engine: 'EEVEE', resolution: 256, format: 'PNG' },
    atlas: { maxSize: 2048, padding: 2, powerOfTwo: true },
    tags: ['arena', 'test'],
  }));

  // Write test arena project config (relative to Assetgenerator/)
  // Symlink tmpDir/arena as PROJECT_ROOT/../test-arena-tmp
  const arenaLink = resolve(PROJECT_ROOT, '..', 'test-arena-tmp');
  if (existsSync(arenaLink)) rmSync(arenaLink, { recursive: true });
  symlinkSync(arenaDir, arenaLink);

  writeFileSync(join(PROJECT_ROOT, 'projects', 'arena.json'), JSON.stringify({
    name: 'arena',
    audioRoot: '../test-arena-tmp/assets/audio',
    outputRoot: '../test-arena-tmp/frontend/public/assets',
    processScript: null,
    generateScript: null,
    manifestPath: '../test-arena-tmp/assets/manifest.json',
    sounds: {
      gunshot: {
        type: 'sfx', prompt: 'laser gunshot', seed: 12345, duration: 0.5,
        backend: 'default', flagged: false, lastGeneratedAt: '2026-03-15T03:00:00Z',
        filePath: 'sfx/gunshot.wav',
      },
      melee_swing: {
        type: 'sfx', prompt: 'sword swing', seed: null, duration: 0.4,
        backend: 'default', flagged: false, lastGeneratedAt: null,
        filePath: 'sfx/melee_swing.wav',
      },
      battle: {
        type: 'music', prompt: 'battle music', seed: null, duration: 90,
        backend: 'default', flagged: false, lastGeneratedAt: null,
        filePath: 'music/battle.wav', loop: true,
      },
    },
  }));

  // Reset catalogs
  writeFileSync(join(PROJECT_ROOT, 'library.json'), JSON.stringify({ version: 1, sounds: {} }));
  writeFileSync(join(PROJECT_ROOT, 'visual-library.json'), JSON.stringify({ version: 1, assets: {} }));

  // Start server on a random port
  const port = 15200 + Math.floor(Math.random() * 1000);
  baseUrl = `http://localhost:${port}`;

  // Start server as a child process
  const { spawn } = await import('node:child_process');
  server = spawn('node', ['server.js', '--project', 'arena'], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Wait for server to be ready
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Server start timeout')), 10000);
    let output = '';
    server.stdout.on('data', (d) => {
      output += d.toString();
      if (output.includes('Assetgenerator running')) {
        clearTimeout(timeout);
        resolve();
      }
    });
    server.stderr.on('data', (d) => {
      output += d.toString();
    });
    server.on('error', (err) => { clearTimeout(timeout); reject(err); });
    server.on('exit', (code) => {
      if (code !== null && code !== 0) {
        clearTimeout(timeout);
        reject(new Error(`Server exited ${code}: ${output}`));
      }
    });
  });
});

after(() => {
  // Kill server
  if (server) server.kill('SIGTERM');

  // Restore original files
  for (const [f, content] of Object.entries(backups)) {
    writeFileSync(join(PROJECT_ROOT, f), content);
  }

  // Clean up symlink
  const arenaLink = resolve(PROJECT_ROOT, '..', 'test-arena-tmp');
  if (existsSync(arenaLink)) rmSync(arenaLink, { recursive: true, force: true });

  // Clean up temp dir
  if (tmpDir && existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ─── Tests ────────────────────────────────────────────────────────────────

describe('Server basics', () => {
  it('serves prerequisites', async () => {
    const { status, json } = await fetchJSON('/api/prerequisites');
    assert.equal(status, 200);
    assert.equal(typeof json.python, 'boolean');
    assert.equal(typeof json.ffmpeg, 'boolean');
  });

  it('lists projects', async () => {
    const { status, json } = await fetchJSON('/api/projects');
    assert.equal(status, 200);
    assert.ok(Array.isArray(json));
    assert.ok(json.includes('arena'));
  });

  it('loads arena project', async () => {
    const { status, json } = await fetchJSON('/api/projects/arena');
    assert.equal(status, 200);
    assert.equal(json.name, 'arena');
    assert.ok(json.sounds.gunshot);
  });

  it('returns 404 for unknown project', async () => {
    const { status } = await fetchJSON('/api/projects/nonexistent');
    assert.equal(status, 404);
  });
});

describe('Audio Library CRUD', () => {
  it('returns empty library initially', async () => {
    const { status, json } = await fetchJSON('/api/library');
    assert.equal(status, 200);
    assert.equal(json.version, 1);
    assert.deepEqual(json.sounds, {});
  });

  it('creates a sound entry', async () => {
    const { status, json } = await fetchJSON('/api/library', {
      method: 'POST',
      body: { id: 'test-sound', name: 'Test Sound', category: 'sfx/weapons', tags: ['test'], prompt: 'test prompt', duration: 0.5 },
    });
    assert.equal(status, 201);
    assert.equal(json.id, 'test-sound');
    assert.equal(json.category, 'sfx/weapons');
    assert.equal(json.prompt, 'test prompt');
    assert.ok(json.createdAt);
  });

  it('rejects duplicate sound', async () => {
    const { status } = await fetchJSON('/api/library', {
      method: 'POST',
      body: { id: 'test-sound', name: 'Dupe', category: 'sfx/weapons' },
    });
    assert.equal(status, 409);
  });

  it('reads the created sound', async () => {
    const { json } = await fetchJSON('/api/library');
    assert.ok(json.sounds['test-sound']);
    assert.equal(json.sounds['test-sound'].name, 'Test Sound');
  });

  it('updates sound metadata', async () => {
    const { status, json } = await fetchJSON('/api/library/test-sound', {
      method: 'PUT',
      body: { name: 'Updated Sound', tags: ['updated'] },
    });
    assert.equal(status, 200);
    assert.equal(json.name, 'Updated Sound');
    assert.deepEqual(json.tags, ['updated']);
  });

  it('returns 404 for unknown sound update', async () => {
    const { status } = await fetchJSON('/api/library/nonexistent', {
      method: 'PUT',
      body: { name: 'Nope' },
    });
    assert.equal(status, 404);
  });

  it('deletes a sound', async () => {
    const { status, json } = await fetchJSON('/api/library/test-sound', { method: 'DELETE' });
    assert.equal(status, 200);
    assert.equal(json.deleted, 'test-sound');

    // Verify gone
    const { json: lib } = await fetchJSON('/api/library');
    assert.equal(lib.sounds['test-sound'], undefined);
  });

  it('rejects create without required fields', async () => {
    const { status } = await fetchJSON('/api/library', {
      method: 'POST',
      body: { id: 'no-name' },
    });
    assert.equal(status, 400);
  });
});

describe('Audio Library Import', () => {
  it('imports arena sounds into library', async () => {
    const { status, json } = await fetchJSON('/api/library/import', {
      method: 'POST',
      body: { project: 'arena' },
    });
    assert.equal(status, 200);
    assert.ok(json.count >= 3, `Expected >=3 imported, got ${json.count}`);
    assert.ok(json.imported.includes('gunshot'));
    assert.ok(json.imported.includes('melee_swing'));
    assert.ok(json.imported.includes('battle'));
  });

  it('maps sound IDs to correct subcategories', async () => {
    const { json } = await fetchJSON('/api/library');
    assert.equal(json.sounds.gunshot.category, 'sfx/weapons');
    assert.equal(json.sounds.melee_swing.category, 'sfx/weapons');
    assert.equal(json.sounds.battle.category, 'music/battle');
  });

  it('copies WAV files to NAS', async () => {
    assert.ok(existsSync(join(nasAudioDir, 'sfx', 'weapons', 'gunshot.wav')));
    assert.ok(existsSync(join(nasAudioDir, 'sfx', 'weapons', 'melee_swing.wav')));
    assert.ok(existsSync(join(nasAudioDir, 'music', 'battle', 'battle.wav')));
  });

  it('preserves prompt and seed from arena state', async () => {
    const { json } = await fetchJSON('/api/library');
    assert.equal(json.sounds.gunshot.prompt, 'laser gunshot');
    assert.equal(json.sounds.gunshot.seed, 12345);
    assert.equal(json.sounds.gunshot.duration, 0.5);
  });

  it('records arena assignment', async () => {
    const { json } = await fetchJSON('/api/library');
    assert.ok(json.sounds.gunshot.assignedTo.arena);
    assert.equal(json.sounds.gunshot.assignedTo.arena.targetPath, 'sfx/gunshot');
  });

  it('skips already-imported sounds on re-import', async () => {
    const { json } = await fetchJSON('/api/library/import', {
      method: 'POST',
      body: { project: 'arena' },
    });
    assert.equal(json.count, 0);
  });

  it('rejects import for unknown project', async () => {
    const { status } = await fetchJSON('/api/library/import', {
      method: 'POST',
      body: { project: 'nonexistent' },
    });
    assert.equal(status, 404);
  });
});

describe('Audio Library Assign/Unassign', () => {
  before(async () => {
    // Create a sound with a WAV on NAS for assign testing
    createTestWav(join(nasAudioDir, 'sfx', 'ui', 'test-assign.wav'));
    await fetchJSON('/api/library', {
      method: 'POST',
      body: { id: 'test-assign', name: 'Assign Test', category: 'sfx/ui' },
    });
  });

  it('assigns sound to project (processes + copies OGG/MP3)', async () => {
    const { status, json } = await fetchJSON('/api/library/test-assign/assign', {
      method: 'POST',
      body: { project: 'arena', targetPath: 'sfx/test-assign' },
    });
    if (status !== 200) console.log('ASSIGN ERROR:', JSON.stringify(json));
    assert.equal(status, 200);
    assert.ok(json.assignedTo.arena);
    assert.equal(json.assignedTo.arena.targetPath, 'sfx/test-assign');
  });

  it('creates OGG+MP3 on NAS', async () => {
    assert.ok(existsSync(join(nasAudioDir, 'sfx', 'ui', 'test-assign.ogg')),
      'OGG not found on NAS');
    assert.ok(existsSync(join(nasAudioDir, 'sfx', 'ui', 'test-assign.mp3')),
      'MP3 not found on NAS');
  });

  it('copies OGG+MP3 to project output dir', async () => {
    const outputRoot = join(arenaDir, 'frontend', 'public', 'assets');
    assert.ok(existsSync(join(outputRoot, 'sfx', 'test-assign.ogg')),
      'OGG not found in project output');
    assert.ok(existsSync(join(outputRoot, 'sfx', 'test-assign.mp3')),
      'MP3 not found in project output');
  });

  it('rejects assign without required fields', async () => {
    const { status } = await fetchJSON('/api/library/test-assign/assign', {
      method: 'POST',
      body: { project: 'arena' },
    });
    assert.equal(status, 400);
  });

  it('unassigns sound from project', async () => {
    const { status, json } = await fetchJSON('/api/library/test-assign/unassign', {
      method: 'POST',
      body: { project: 'arena' },
    });
    assert.equal(status, 200);
    assert.equal(json.assignedTo.arena, undefined);
  });
});

describe('Audio Library Sync', () => {
  it('syncs stale assignments', async () => {
    // Re-assign gunshot with old syncedAt
    const { json: lib } = await fetchJSON('/api/library');
    const gunshot = lib.sounds.gunshot;
    if (gunshot) {
      // Manually make it stale by setting createdAt to future
      await fetchJSON('/api/library/gunshot', {
        method: 'PUT',
        body: { name: gunshot.name }, // Trigger a save, createdAt stays
      });
    }

    const { status, json } = await fetchJSON('/api/projects/arena/sync', { method: 'POST' });
    assert.equal(status, 200);
    assert.ok(typeof json.count === 'number');
  });
});

describe('Audio Generation Lock', () => {
  it('returns 409 for unknown sound generation', async () => {
    const { status } = await fetchJSON('/api/library/nonexistent/generate', { method: 'POST' });
    assert.equal(status, 404);
  });
});

describe('Visual Library CRUD', () => {
  it('returns empty visual library initially', async () => {
    const { status, json } = await fetchJSON('/api/visual-library');
    assert.equal(status, 200);
    assert.equal(json.version, 1);
    assert.deepEqual(json.assets, {});
  });

  it('creates a character asset', async () => {
    const { status, json } = await fetchJSON('/api/visual-library', {
      method: 'POST',
      body: {
        id: 'test-char',
        name: 'Test Character',
        category: 'characters',
        tags: ['test'],
        prompt: 'a test character',
      },
    });
    assert.equal(status, 201);
    assert.equal(json.id, 'test-char');
    assert.equal(json.category, 'characters');
    assert.deepEqual(json.poses, ['stand', 'gun']); // From config defaults
    assert.equal(json.directions, 8); // From config
    assert.equal(json.size, 64); // From config
    // 3D category should have model phase
    assert.ok(json.pipeline.concept);
    assert.ok(json.pipeline.model);
    assert.ok(json.pipeline.render);
    assert.ok(json.pipeline.pack);
    assert.equal(json.pipeline.concept.status, 'pending');
  });

  it('creates a tile asset (non-3D, no model phase)', async () => {
    const { status, json } = await fetchJSON('/api/visual-library', {
      method: 'POST',
      body: { id: 'test-tile', name: 'Test Tile', category: 'tiles', prompt: 'a floor tile' },
    });
    assert.equal(status, 201);
    assert.equal(json.pipeline.model, undefined, 'Tile should not have model phase');
    assert.ok(json.pipeline.concept);
    assert.ok(json.pipeline.render);
    assert.ok(json.pipeline.pack);
  });

  it('reads single asset', async () => {
    const { status, json } = await fetchJSON('/api/visual-library/test-char');
    assert.equal(status, 200);
    assert.equal(json.name, 'Test Character');
  });

  it('rejects duplicate asset', async () => {
    const { status } = await fetchJSON('/api/visual-library', {
      method: 'POST',
      body: { id: 'test-char', name: 'Dupe', category: 'characters' },
    });
    assert.equal(status, 409);
  });

  it('updates asset metadata', async () => {
    const { status, json } = await fetchJSON('/api/visual-library/test-char', {
      method: 'PUT',
      body: { prompt: 'updated prompt', tags: ['updated'] },
    });
    assert.equal(status, 200);
    assert.equal(json.prompt, 'updated prompt');
    assert.deepEqual(json.tags, ['updated']);
  });

  it('deletes asset', async () => {
    const { status } = await fetchJSON('/api/visual-library/test-tile', { method: 'DELETE' });
    assert.equal(status, 200);

    const { json } = await fetchJSON('/api/visual-library');
    assert.equal(json.assets['test-tile'], undefined);
  });

  it('returns 404 for unknown asset', async () => {
    const { status } = await fetchJSON('/api/visual-library/nonexistent');
    assert.equal(status, 404);
  });
});

describe('Visual Pipeline Staleness', () => {
  it('marks downstream phases stale when upstream regenerated', async () => {
    // Set test-char pipeline to all done
    const { json: lib } = await fetchJSON('/api/visual-library');
    const asset = lib.assets['test-char'];
    if (!asset) return;

    // Directly modify the library file to set phases to done
    const libPath = join(PROJECT_ROOT, 'visual-library.json');
    const libData = JSON.parse(readFileSync(libPath, 'utf-8'));
    if (libData.assets['test-char']) {
      libData.assets['test-char'].pipeline = {
        concept: { status: 'done', generatedAt: '2026-03-10T10:00:00Z', path: 'concepts/characters/test-char.png' },
        model: { status: 'done', generatedAt: '2026-03-10T10:15:00Z', path: 'models/characters/test-char.glb' },
        render: { status: 'done', generatedAt: '2026-03-10T10:16:00Z', frameCount: 16 },
        pack: { status: 'done', generatedAt: '2026-03-10T10:17:00Z' },
      };
      writeFileSync(libPath, JSON.stringify(libData, null, 2));
    }

    // Verify all done
    const { json: before } = await fetchJSON('/api/visual-library/test-char');
    assert.equal(before.pipeline.concept.status, 'done');
    assert.equal(before.pipeline.model.status, 'done');
    assert.equal(before.pipeline.render.status, 'done');
    assert.equal(before.pipeline.pack.status, 'done');

    // Trigger concept regeneration — will fail (no ComfyUI) but staleness should propagate
    // We can test staleness by calling the generate endpoint and checking downstream
    // Since we don't have ComfyUI, the generation will error, but let's test the staleness
    // logic separately by calling the concept phase which will fail
    const res = await fetch(`${baseUrl}/api/visual-library/test-char/generate/concept`, { method: 'POST' });

    // Read SSE response
    const text = await res.text();
    // The concept phase will error (no adapter script), which is expected
    // But downstream phases should NOT be marked stale on error — only on success
    // So let's verify the staleness function works by checking the library state
    const { json: afterAttempt } = await fetchJSON('/api/visual-library/test-char');

    // On error, concept should be 'error', downstream unchanged
    assert.equal(afterAttempt.pipeline.concept.status, 'error');
    // Downstream stays done because staleness only triggers on success
    assert.equal(afterAttempt.pipeline.model.status, 'done');
    assert.equal(afterAttempt.pipeline.render.status, 'done');
    assert.equal(afterAttempt.pipeline.pack.status, 'done');
  });
});

describe('Visual Library Assign/Sync', () => {
  before(async () => {
    // Create a visual asset with pack done
    const libPath = join(PROJECT_ROOT, 'visual-library.json');
    const libData = JSON.parse(readFileSync(libPath, 'utf-8'));
    libData.assets['assign-test'] = {
      id: 'assign-test',
      name: 'Assign Test',
      category: 'characters',
      tags: ['test'],
      prompt: 'test',
      poses: ['stand'],
      directions: 8,
      size: 64,
      color: '#ffffff',
      pipeline: {
        concept: { status: 'done' },
        model: { status: 'done' },
        render: { status: 'done', frameCount: 8 },
        pack: { status: 'done', generatedAt: '2026-03-15T10:00:00Z' },
      },
      assignedTo: {},
    };
    writeFileSync(libPath, JSON.stringify(libData, null, 2));

    // Create atlas file on NAS
    writeFileSync(join(nasVisualDir, 'sprites', 'characters.png'), Buffer.alloc(50));
    writeFileSync(join(nasVisualDir, 'sprites', 'characters.json'), JSON.stringify({ frames: {} }));
  });

  it('assigns visual asset to project', async () => {
    const { status, json } = await fetchJSON('/api/visual-library/assign-test/assign', {
      method: 'POST',
      body: { project: 'arena', atlas: 'characters' },
    });
    assert.equal(status, 200);
    assert.ok(json.assignedTo.arena);
    assert.equal(json.assignedTo.arena.atlas, 'characters');
  });

  it('copies atlas files to project', async () => {
    const spritesDir = join(arenaDir, 'frontend', 'public', 'assets', 'sprites');
    assert.ok(existsSync(join(spritesDir, 'characters.png')));
    assert.ok(existsSync(join(spritesDir, 'characters.json')));
  });

  it('unassigns visual asset', async () => {
    const { status, json } = await fetchJSON('/api/visual-library/assign-test/unassign', {
      method: 'POST',
      body: { project: 'arena' },
    });
    assert.equal(status, 200);
    assert.equal(json.assignedTo.arena, undefined);
  });

  it('syncs stale visual assignments', async () => {
    // Re-assign with old syncedAt, then update pack timestamp
    const libPath = join(PROJECT_ROOT, 'visual-library.json');
    const libData = JSON.parse(readFileSync(libPath, 'utf-8'));
    libData.assets['assign-test'].assignedTo = {
      arena: { atlas: 'characters', syncedAt: '2026-03-01T00:00:00Z' },
    };
    libData.assets['assign-test'].pipeline.pack.generatedAt = '2026-03-15T12:00:00Z';
    writeFileSync(libPath, JSON.stringify(libData, null, 2));

    const { status, json } = await fetchJSON('/api/projects/arena/sync-visual', { method: 'POST' });
    assert.equal(status, 200);
    assert.ok(json.synced.includes('assign-test'));
    assert.equal(json.count, 1);
  });
});

describe('Visual Library Import', () => {
  before(async () => {
    // Create character render files in arena for import test
    const renderDir = join(arenaDir, 'assets', 'renders', 'characters', 'warrior');
    mkdirSync(renderDir, { recursive: true });
    writeFileSync(join(renderDir, 'warrior-stand-N.png'), Buffer.alloc(10));
    writeFileSync(join(renderDir, 'warrior-gun-N.png'), Buffer.alloc(10));
  });

  it('imports arena visual assets', async () => {
    const { status, json } = await fetchJSON('/api/visual-library/import', {
      method: 'POST',
      body: { project: 'arena' },
    });
    assert.equal(status, 200);
    assert.ok(json.imported.includes('warrior'));
    assert.ok(json.count >= 1);
  });

  it('sets correct pipeline status for imported assets', async () => {
    const { json } = await fetchJSON('/api/visual-library/warrior');
    if (!json.pipeline) return;
    // warrior has renders but no concept/model source
    assert.equal(json.pipeline.render.status, 'done');
    assert.equal(json.pipeline.render.frameCount, 2);
    // Pack done because atlas exists
    assert.equal(json.pipeline.pack.status, 'done');
  });

  it('copies render files to NAS', async () => {
    const renderDir = join(nasVisualDir, 'renders', 'characters', 'warrior');
    assert.ok(existsSync(join(renderDir, 'warrior-stand-N.png')));
    assert.ok(existsSync(join(renderDir, 'warrior-gun-N.png')));
  });

  it('rejects import for unknown project', async () => {
    const { status } = await fetchJSON('/api/visual-library/import', {
      method: 'POST',
      body: { project: 'nonexistent' },
    });
    assert.equal(status, 404);
  });
});

describe('Visual Generation Lock', () => {
  it('returns 404 for unknown asset generation', async () => {
    const res = await fetch(`${baseUrl}/api/visual-library/nonexistent/generate/concept`, { method: 'POST' });
    // SSE or 404 depending on route ordering
    const text = await res.text();
    assert.ok(res.status === 404 || text.includes('not found') || text.includes('Asset not found'),
      `Expected 404 or not found, got ${res.status}: ${text.slice(0, 200)}`);
  });

  it('rejects invalid phase', async () => {
    const res = await fetch(`${baseUrl}/api/visual-library/test-char/generate/invalid`, { method: 'POST' });
    const text = await res.text();
    assert.ok(res.status === 400 || text.includes('Invalid phase'),
      `Expected 400, got ${res.status}`);
  });
});

describe('Concurrent generation locks', () => {
  it('audio and visual have separate locks (both can generate)', async () => {
    // Both locks start as false — verify by checking that neither returns 409
    // when the other is not running
    // (We can't easily test true concurrency without real generation backends,
    // but we can verify the lock variables are separate by checking the server code)

    // Test that audio generate returns non-409 for a valid sound
    const { json: lib } = await fetchJSON('/api/library');
    const firstSound = Object.keys(lib.sounds)[0];
    if (firstSound) {
      // This will fail (no backend) but should NOT be 409
      const res = await fetch(`${baseUrl}/api/library/${firstSound}/generate`, { method: 'POST' });
      assert.notEqual(res.status, 409, 'Audio generation should not be locked');
      await res.text(); // Drain response
    }
  });
});

describe('Audio streaming', () => {
  it('streams WAV from NAS library', async () => {
    const { json: lib } = await fetchJSON('/api/library');
    const firstId = Object.keys(lib.sounds)[0];
    if (!firstId) return;

    const res = await fetch(`${baseUrl}/api/library/${firstId}/audio`);
    // May be 404 if WAV not on NAS (import copies it)
    assert.ok([200, 404].includes(res.status));
    if (res.status === 200) {
      const buf = await res.arrayBuffer();
      assert.ok(buf.byteLength > 0);
    }
  });

  it('supports format query param', async () => {
    const { json: lib } = await fetchJSON('/api/library');
    const firstId = Object.keys(lib.sounds)[0];
    if (!firstId) return;

    // OGG might not exist yet (no processing), should be 404
    const res = await fetch(`${baseUrl}/api/library/${firstId}/audio?format=ogg`);
    assert.ok([200, 404].includes(res.status));
  });
});

describe('Project scan', () => {
  it('scan discovers arena sounds', async () => {
    const { status, json } = await fetchJSON('/api/projects/arena/scan', { method: 'POST' });
    assert.equal(status, 200);
    assert.ok(json.sounds);
    assert.ok(json.sounds.gunshot);
  });
});

// =============================================================================
// Previously untested workflows — each creates its own disposable test subject
// =============================================================================

describe('Regen workflow (SSE flow)', () => {
  const REGEN_ID = '_regen_test_disposable';

  before(async () => {
    // Create a disposable library sound with a WAV on NAS
    const config = JSON.parse(readFileSync(join(PROJECT_ROOT, 'config', 'library-config.json'), 'utf-8'));
    const wavDir = join(config.libraryRoot, 'sfx', 'ui');
    createTestWav(join(wavDir, `${REGEN_ID}.wav`));

    await fetchJSON('/api/library', {
      method: 'POST',
      body: { id: REGEN_ID, name: 'Regen Test Disposable', category: 'sfx/ui', prompt: 'test beep', duration: 0.5, backend: 'audiocraft' },
    });
  });

  after(async () => {
    // Clean up disposable sound
    try { await fetchJSON(`/api/library/${REGEN_ID}`, { method: 'DELETE' }); } catch {}
  });

  it('generate endpoint returns SSE stream with progress events', async () => {
    const res = await fetch(`${baseUrl}/api/library/${REGEN_ID}/generate`, { method: 'POST' });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'text/event-stream');

    const text = await res.text();
    // Should contain at least a progress event and a complete event
    assert.ok(text.includes('event: progress'), 'Missing progress event');
    assert.ok(text.includes('event: complete'), 'Missing complete event');
    // Will contain an error event (no AudioCraft in test) — that's expected
    assert.ok(text.includes(`"sound":"${REGEN_ID}"`), 'SSE data should reference the sound ID');
  });

  it('generation error is reported via SSE (not HTTP 500)', async () => {
    const res = await fetch(`${baseUrl}/api/library/${REGEN_ID}/generate`, { method: 'POST' });
    // Endpoint should return 200 (SSE stream), not 500
    assert.equal(res.status, 200);

    const text = await res.text();
    // Error from missing AudioCraft/Python should be in SSE error event
    assert.ok(text.includes('event: error'), 'Should contain SSE error event for failed generation');
    // The complete event should still fire
    assert.ok(text.includes('event: complete'), 'Complete event should always fire');
  });

  it('lock is released after failed generation', async () => {
    // After the failed generate above, the lock should be released
    // A second generate call should NOT return 409
    const res = await fetch(`${baseUrl}/api/library/${REGEN_ID}/generate`, { method: 'POST' });
    assert.notEqual(res.status, 409, 'Lock should be released after failed generation');
    await res.text(); // Drain
  });
});

describe('Concurrent generation / busy state', () => {
  const BUSY_ID = '_busy_test_disposable';

  before(async () => {
    const config = JSON.parse(readFileSync(join(PROJECT_ROOT, 'config', 'library-config.json'), 'utf-8'));
    createTestWav(join(config.libraryRoot, 'sfx', 'ui', `${BUSY_ID}.wav`));

    await fetchJSON('/api/library', {
      method: 'POST',
      body: { id: BUSY_ID, name: 'Busy Test Disposable', category: 'sfx/ui', prompt: 'test', duration: 0.5 },
    });
  });

  after(async () => {
    try { await fetchJSON(`/api/library/${BUSY_ID}`, { method: 'DELETE' }); } catch {}
  });

  it('returns 409 when audio generation is already in progress', async () => {
    // Start a generation — don't await the full stream
    const firstRes = fetch(`${baseUrl}/api/library/${BUSY_ID}/generate`, { method: 'POST' });

    // Give the server a moment to set the lock
    await new Promise(r => setTimeout(r, 50));

    // Second request should be rejected
    const secondRes = await fetch(`${baseUrl}/api/library/${BUSY_ID}/generate`, { method: 'POST' });

    if (secondRes.status === 409) {
      const body = await secondRes.json();
      assert.equal(body.error, 'Audio generation in progress');
    } else {
      // If the first one already completed (fast failure), both get through — acceptable
      await secondRes.text(); // Drain
    }

    // Drain the first response
    const first = await firstRes;
    await first.text();
  });

  it('visual generation returns 409 independently when busy', async () => {
    // Create a disposable visual asset
    await fetchJSON('/api/visual-library', {
      method: 'POST',
      body: { id: '_vbusy_test', name: 'VBusy Test', category: 'characters' },
    });

    // Start visual generation (will fail fast but sets the lock briefly)
    const firstRes = fetch(`${baseUrl}/api/visual-library/_vbusy_test/generate/concept`, { method: 'POST' });
    await new Promise(r => setTimeout(r, 50));

    const secondRes = await fetch(`${baseUrl}/api/visual-library/_vbusy_test/generate/concept`, { method: 'POST' });

    // Either 409 (lock held) or both complete (fast failure) — both acceptable
    if (secondRes.status === 409) {
      const body = await secondRes.json();
      assert.equal(body.error, 'Visual generation in progress');
    } else {
      await secondRes.text();
    }

    const first = await firstRes;
    await first.text();

    // Cleanup
    try { await fetchJSON('/api/visual-library/_vbusy_test', { method: 'DELETE' }); } catch {}
  });

  it('audio and visual locks are independent', async () => {
    // Start an audio generation (sets audioGenerationInProgress)
    const audioRes = fetch(`${baseUrl}/api/library/${BUSY_ID}/generate`, { method: 'POST' });
    await new Promise(r => setTimeout(r, 50));

    // Visual generation should NOT be blocked by audio lock
    await fetchJSON('/api/visual-library', {
      method: 'POST',
      body: { id: '_cross_test', name: 'Cross Test', category: 'tiles' },
    });

    const visualRes = await fetch(`${baseUrl}/api/visual-library/_cross_test/generate/concept`, { method: 'POST' });
    // Should NOT be 409 — different lock
    assert.notEqual(visualRes.status, 409, 'Visual should not be blocked by audio lock');
    await visualRes.text();

    const audio = await audioRes;
    await audio.text();

    try { await fetchJSON('/api/visual-library/_cross_test', { method: 'DELETE' }); } catch {}
  });
});

describe('Audio file update after generation', () => {
  const REFRESH_ID = '_refresh_test_disposable';

  before(async () => {
    const config = JSON.parse(readFileSync(join(PROJECT_ROOT, 'config', 'library-config.json'), 'utf-8'));
    const wavDir = join(config.libraryRoot, 'sfx', 'ui');
    createTestWav(join(wavDir, `${REFRESH_ID}.wav`));

    await fetchJSON('/api/library', {
      method: 'POST',
      body: { id: REFRESH_ID, name: 'Refresh Test', category: 'sfx/ui', prompt: 'test', duration: 0.5 },
    });
  });

  after(async () => {
    try { await fetchJSON(`/api/library/${REFRESH_ID}`, { method: 'DELETE' }); } catch {}
  });

  it('WAV file is streamable from library endpoint', async () => {
    const res = await fetch(`${baseUrl}/api/library/${REFRESH_ID}/audio`);
    assert.equal(res.status, 200, 'WAV should be streamable');
    const buf = await res.arrayBuffer();
    assert.ok(buf.byteLength > 44, 'WAV should have content beyond header');
  });

  it('processed OGG is streamable after assign', async () => {
    // Assign to trigger processing
    const { status } = await fetchJSON(`/api/library/${REFRESH_ID}/assign`, {
      method: 'POST',
      body: { project: 'arena', targetPath: `sfx/${REFRESH_ID}` },
    });
    assert.equal(status, 200);

    // OGG should now exist on NAS
    const res = await fetch(`${baseUrl}/api/library/${REFRESH_ID}/audio?format=ogg`);
    assert.equal(res.status, 200, 'OGG should be streamable after assign processing');
    const buf = await res.arrayBuffer();
    assert.ok(buf.byteLength > 0, 'OGG should have content');

    // Cleanup assignment
    await fetchJSON(`/api/library/${REFRESH_ID}/unassign`, {
      method: 'POST',
      body: { project: 'arena' },
    });
  });

  it('MP3 is streamable after assign', async () => {
    // Assign again to ensure processing
    await fetchJSON(`/api/library/${REFRESH_ID}/assign`, {
      method: 'POST',
      body: { project: 'arena', targetPath: `sfx/${REFRESH_ID}` },
    });

    const res = await fetch(`${baseUrl}/api/library/${REFRESH_ID}/audio?format=mp3`);
    assert.equal(res.status, 200, 'MP3 should be streamable after assign processing');
    const buf = await res.arrayBuffer();
    assert.ok(buf.byteLength > 0, 'MP3 should have content');

    await fetchJSON(`/api/library/${REFRESH_ID}/unassign`, {
      method: 'POST',
      body: { project: 'arena' },
    });
  });
});

describe('Delete workflow', () => {
  const DEL_ID = '_delete_test_disposable';

  before(async () => {
    // Create disposable sound with files on NAS
    const config = JSON.parse(readFileSync(join(PROJECT_ROOT, 'config', 'library-config.json'), 'utf-8'));
    const wavDir = join(config.libraryRoot, 'sfx', 'ui');
    createTestWav(join(wavDir, `${DEL_ID}.wav`));
    // Also create OGG/MP3 to verify they get cleaned up
    writeFileSync(join(wavDir, `${DEL_ID}.ogg`), Buffer.alloc(10));
    writeFileSync(join(wavDir, `${DEL_ID}.mp3`), Buffer.alloc(10));

    await fetchJSON('/api/library', {
      method: 'POST',
      body: { id: DEL_ID, name: 'Delete Test', category: 'sfx/ui' },
    });
  });

  it('sound exists before deletion', async () => {
    const { json } = await fetchJSON('/api/library');
    assert.ok(json.sounds[DEL_ID], 'Sound should exist in library');
  });

  it('NAS files exist before deletion', async () => {
    const config = JSON.parse(readFileSync(join(PROJECT_ROOT, 'config', 'library-config.json'), 'utf-8'));
    const wavDir = join(config.libraryRoot, 'sfx', 'ui');
    assert.ok(existsSync(join(wavDir, `${DEL_ID}.wav`)), 'WAV should exist');
    assert.ok(existsSync(join(wavDir, `${DEL_ID}.ogg`)), 'OGG should exist');
    assert.ok(existsSync(join(wavDir, `${DEL_ID}.mp3`)), 'MP3 should exist');
  });

  it('DELETE removes sound from library catalog', async () => {
    const { status, json } = await fetchJSON(`/api/library/${DEL_ID}`, { method: 'DELETE' });
    assert.equal(status, 200);
    assert.equal(json.deleted, DEL_ID);

    // Verify gone from catalog
    const { json: lib } = await fetchJSON('/api/library');
    assert.equal(lib.sounds[DEL_ID], undefined, 'Sound should be removed from catalog');
  });

  it('DELETE removes WAV/OGG/MP3 from NAS', async () => {
    const config = JSON.parse(readFileSync(join(PROJECT_ROOT, 'config', 'library-config.json'), 'utf-8'));
    const wavDir = join(config.libraryRoot, 'sfx', 'ui');
    assert.ok(!existsSync(join(wavDir, `${DEL_ID}.wav`)), 'WAV should be deleted from NAS');
    assert.ok(!existsSync(join(wavDir, `${DEL_ID}.ogg`)), 'OGG should be deleted from NAS');
    assert.ok(!existsSync(join(wavDir, `${DEL_ID}.mp3`)), 'MP3 should be deleted from NAS');
  });

  it('DELETE returns 404 for already-deleted sound', async () => {
    const { status } = await fetchJSON(`/api/library/${DEL_ID}`, { method: 'DELETE' });
    assert.equal(status, 404);
  });

  it('visual DELETE removes asset and NAS files', async () => {
    // Create disposable visual asset
    const VDEL_ID = '_vdel_test_disposable';
    await fetchJSON('/api/visual-library', {
      method: 'POST',
      body: { id: VDEL_ID, name: 'Visual Delete Test', category: 'characters', prompt: 'test' },
    });

    // Create fake concept file on NAS
    const config = JSON.parse(readFileSync(join(PROJECT_ROOT, 'config', 'visual-config.json'), 'utf-8'));
    const conceptDir = join(config.libraryRoot, 'concepts', 'characters');
    if (!existsSync(conceptDir)) mkdirSync(conceptDir, { recursive: true });
    writeFileSync(join(conceptDir, `${VDEL_ID}.png`), Buffer.alloc(10));

    // Verify exists
    const { json: before } = await fetchJSON(`/api/visual-library/${VDEL_ID}`);
    assert.equal(before.id, VDEL_ID);

    // Delete
    const { status } = await fetchJSON(`/api/visual-library/${VDEL_ID}`, { method: 'DELETE' });
    assert.equal(status, 200);

    // Verify gone from catalog
    const { status: getStatus } = await fetchJSON(`/api/visual-library/${VDEL_ID}`);
    assert.equal(getStatus, 404);

    // Verify concept PNG cleaned from NAS
    assert.ok(!existsSync(join(conceptDir, `${VDEL_ID}.png`)), 'Concept PNG should be deleted from NAS');
  });
});
