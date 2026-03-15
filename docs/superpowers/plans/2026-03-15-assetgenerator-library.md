# Assetgenerator Audio & Visual Library Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Assetgenerator with shared Audio and Visual asset libraries on NAS, replacing per-project audio management and adding a full visual pipeline UI (concept → 3D → render → pack).

**Architecture:** The existing single-file server.js (~360 lines) gets extended with new route groups for audio library and visual library CRUD/assign/sync/import. Two new JSON catalogs (library.json, visual-library.json) live alongside existing project configs. Visual pipeline phases use the same adapter pattern as audio (export async function generate()), with 6 new adapters. The single-page index.html gains a tab toggle (Audio | Visual) replacing the old Review-only view.

**Tech Stack:** Express, vanilla JS SPA, ffmpeg (audio processing), Blender (sprite rendering), Python (ComfyUI/SDXL/TripoSR), free-tex-packer-core (atlas packing), SSE for progress streaming.

**Spec:** `docs/superpowers/specs/2026-03-15-assetgenerator-library-design.md`

---

## Chunk 1: Foundation — Config, Dependencies, Data Layer

### Task 1: Add dependencies and config files

**Files:**
- Modify: `Assetgenerator/package.json`
- Create: `Assetgenerator/config/library-config.json`
- Create: `Assetgenerator/config/visual-config.json`
- Create: `Assetgenerator/library.json`
- Create: `Assetgenerator/visual-library.json`

- [ ] **Step 1: Add tsx dependency to package.json**

`tsx` is needed for running the TypeScript packer script (`pack_sprites.ts`). Add it as a dependency:

```json
{
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.21.0",
    "open": "^10.1.0",
    "tsx": "^4.7.0"
  }
}
```

Run: `cd Assetgenerator && npm install`

- [ ] **Step 2: Create audio library config**

Create `Assetgenerator/config/library-config.json` with the exact content from spec Part 1:

```json
{
  "libraryRoot": "/mnt/pve3a/audio-library",
  "loudness": { "sfx": -16, "music": -20 },
  "categories": {
    "sfx": ["weapons", "footsteps", "impacts", "ui", "environment"],
    "music": ["battle", "ambient", "stings"]
  },
  "defaultTags": ["arena", "l2p", "sci-fi", "retro", "ui", "ambient"]
}
```

- [ ] **Step 3: Create visual library config**

Create `Assetgenerator/config/visual-config.json` with the exact content from spec Part 2:

```json
{
  "libraryRoot": "/mnt/pve3a/visual-library",
  "blenderPath": "blender",
  "categories": {
    "characters": {
      "directions": 8,
      "defaultPoses": ["stand", "gun", "machine", "reload", "hold", "silencer"],
      "size": 64,
      "conceptResolution": 1024,
      "has3D": true
    },
    "weapons": {
      "directions": 1,
      "defaultPoses": ["idle"],
      "size": 32,
      "animated": true,
      "has3D": true
    },
    "items": {
      "directions": 1,
      "defaultPoses": ["idle"],
      "size": 32,
      "has3D": true
    },
    "tiles": {
      "directions": 1,
      "defaultPoses": ["idle"],
      "size": 32,
      "has3D": false,
      "conceptResolution": 512
    },
    "cover": {
      "directions": 1,
      "defaultPoses": ["idle"],
      "size": 32,
      "has3D": true
    },
    "ui": {
      "directions": 1,
      "defaultPoses": ["idle"],
      "size": 16,
      "has3D": false,
      "conceptResolution": 512
    }
  },
  "render": {
    "engine": "EEVEE",
    "resolution": 256,
    "format": "PNG"
  },
  "atlas": {
    "maxSize": 2048,
    "padding": 2,
    "powerOfTwo": true
  },
  "tags": ["arena", "fantasy", "sci-fi", "medieval", "modern", "nature"]
}
```

- [ ] **Step 4: Create empty catalog files**

Create `Assetgenerator/library.json`:
```json
{ "version": 1, "sounds": {} }
```

Create `Assetgenerator/visual-library.json`:
```json
{ "version": 1, "assets": {} }
```

- [ ] **Step 5: Commit**

```bash
git add Assetgenerator/package.json Assetgenerator/package-lock.json Assetgenerator/config/library-config.json Assetgenerator/config/visual-config.json Assetgenerator/library.json Assetgenerator/visual-library.json
git commit -m "feat(assetgenerator): add library config and empty catalog files"
```

### Task 2: Add library data layer to server.js

**Files:**
- Modify: `Assetgenerator/server.js` — add library load/save helpers, config loading

Add after the existing `saveProject` function (around line 92), before the Scan section:

- [ ] **Step 1: Add config and library loading functions**

Add these functions after `saveProject()`:

```javascript
// =============================================================================
// Library state management
// =============================================================================

const LIBRARY_PATH = join(__dirname, 'library.json');
const VISUAL_LIBRARY_PATH = join(__dirname, 'visual-library.json');
const LIBRARY_CONFIG_PATH = join(__dirname, 'config', 'library-config.json');
const VISUAL_CONFIG_PATH = join(__dirname, 'config', 'visual-config.json');

function loadLibrary() {
  if (!existsSync(LIBRARY_PATH)) return { version: 1, sounds: {} };
  return JSON.parse(readFileSync(LIBRARY_PATH, 'utf-8'));
}

function saveLibrary(library) {
  writeFileSync(LIBRARY_PATH, JSON.stringify(library, null, 2));
}

function loadVisualLibrary() {
  if (!existsSync(VISUAL_LIBRARY_PATH)) return { version: 1, assets: {} };
  return JSON.parse(readFileSync(VISUAL_LIBRARY_PATH, 'utf-8'));
}

function saveVisualLibrary(library) {
  writeFileSync(VISUAL_LIBRARY_PATH, JSON.stringify(library, null, 2));
}

function loadLibraryConfig() {
  return JSON.parse(readFileSync(LIBRARY_CONFIG_PATH, 'utf-8'));
}

function loadVisualConfig() {
  return JSON.parse(readFileSync(VISUAL_CONFIG_PATH, 'utf-8'));
}
```

- [ ] **Step 2: Add ffmpeg processing helper**

Add inline ffmpeg processing function (replaces process_audio.sh for library use):

```javascript
function processAudioFile(wavPath, outputDir, id, type) {
  const config = loadLibraryConfig();
  const lufs = type.startsWith('music') ? config.loudness.music : config.loudness.sfx;

  const af = `silenceremove=start_periods=1:start_silence=0.1:start_threshold=-50dB,loudnorm=I=${lufs}:TP=-1.5:LRA=11`;

  // OGG (Opus @ 96kbps)
  const oggPath = join(outputDir, `${id}.ogg`);
  execFileSync('ffmpeg', [
    '-y', '-i', wavPath,
    '-af', af,
    '-ar', '44100', '-ac', '1',
    '-c:a', 'libopus', '-b:a', '96k',
    oggPath
  ], { stdio: 'pipe' });

  // MP3 (LAME @ 128kbps)
  const mp3Path = join(outputDir, `${id}.mp3`);
  execFileSync('ffmpeg', [
    '-y', '-i', wavPath,
    '-af', af,
    '-ar', '44100', '-ac', '1',
    '-c:a', 'libmp3lame', '-b:a', '128k',
    mp3Path
  ], { stdio: 'pipe' });

  return { oggPath, mp3Path };
}
```

- [ ] **Step 3: Verify server starts**

Run: `cd Assetgenerator && node server.js --project arena`
Expected: Server starts on port 5200, no errors from new code

- [ ] **Step 4: Commit**

```bash
git add Assetgenerator/server.js
git commit -m "feat(assetgenerator): add library data layer and ffmpeg processing"
```

---

## Chunk 2: Audio Library API Routes

### Task 3: Audio library CRUD routes

**Files:**
- Modify: `Assetgenerator/server.js` — add audio library route group

Add a new route section after the existing regeneration SSE block (after line 330):

- [ ] **Step 1: Add GET /api/library**

```javascript
// =============================================================================
// Audio Library Routes
// =============================================================================

app.get('/api/library', (req, res) => {
  res.json(loadLibrary());
});
```

- [ ] **Step 2: Add GET /api/library/:id/audio**

Stream audio file from NAS for preview. Supports `?format=wav|ogg|mp3` query param (default: wav).

```javascript
app.get('/api/library/:id/audio', (req, res) => {
  const library = loadLibrary();
  const sound = library.sounds[req.params.id];
  if (!sound) return res.status(404).json({ error: 'Sound not found' });

  const config = loadLibraryConfig();
  const format = req.query.format || 'wav';
  let filePath;

  if (format === 'wav') {
    filePath = join(config.libraryRoot, sound.filePath);
  } else {
    const base = sound.filePath.replace(/\.wav$/, '');
    filePath = join(config.libraryRoot, `${base}.${format}`);
  }

  if (!existsSync(filePath)) return res.status(404).json({ error: 'Audio file not found' });
  res.sendFile(filePath);
});
```

- [ ] **Step 3: Add POST /api/library (create)**

```javascript
app.post('/api/library', (req, res) => {
  const { id, name, category, tags, prompt, seed, duration, backend } = req.body;
  if (!id || !name || !category) return res.status(400).json({ error: 'id, name, category required' });

  const library = loadLibrary();
  if (library.sounds[id]) return res.status(409).json({ error: 'Sound already exists' });

  library.sounds[id] = {
    id,
    name,
    category,
    tags: tags || [],
    prompt: prompt || '',
    seed: seed || null,
    duration: duration || null,
    backend: backend || 'audiocraft',
    filePath: `${category}/${id}.wav`,
    createdAt: new Date().toISOString(),
    assignedTo: {},
  };

  saveLibrary(library);
  res.status(201).json(library.sounds[id]);
});
```

- [ ] **Step 4: Add PUT /api/library/:id (update metadata)**

```javascript
app.put('/api/library/:id', (req, res) => {
  const library = loadLibrary();
  const sound = library.sounds[req.params.id];
  if (!sound) return res.status(404).json({ error: 'Sound not found' });

  const allowed = ['name', 'category', 'tags', 'prompt', 'seed', 'duration', 'backend'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) sound[key] = req.body[key];
  }

  saveLibrary(library);
  res.json(sound);
});
```

- [ ] **Step 5: Add DELETE /api/library/:id**

```javascript
app.delete('/api/library/:id', (req, res) => {
  const library = loadLibrary();
  const sound = library.sounds[req.params.id];
  if (!sound) return res.status(404).json({ error: 'Sound not found' });

  const config = loadLibraryConfig();
  // Delete files from NAS
  const basePath = join(config.libraryRoot, sound.filePath.replace(/\.wav$/, ''));
  for (const ext of ['.wav', '.ogg', '.mp3']) {
    const f = basePath + ext;
    if (existsSync(f)) unlinkSync(f);
  }

  delete library.sounds[req.params.id];
  saveLibrary(library);
  res.json({ deleted: req.params.id });
});
```

- [ ] **Step 6: Commit**

```bash
git add Assetgenerator/server.js
git commit -m "feat(assetgenerator): add audio library CRUD routes"
```

### Task 4: Audio library assign/unassign/sync routes

**Files:**
- Modify: `Assetgenerator/server.js`

- [ ] **Step 1: Add POST /api/library/:id/assign**

```javascript
app.post('/api/library/:id/assign', (req, res) => {
  const { project, targetPath } = req.body;
  if (!project || !targetPath) return res.status(400).json({ error: 'project and targetPath required' });

  const library = loadLibrary();
  const sound = library.sounds[req.params.id];
  if (!sound) return res.status(404).json({ error: 'Sound not found' });

  const config = loadLibraryConfig();
  const wavPath = join(config.libraryRoot, sound.filePath);
  if (!existsSync(wavPath)) return res.status(404).json({ error: 'WAV file not found on NAS' });

  // Ensure processed files exist on NAS
  const nasDir = dirname(wavPath);
  const baseName = sound.filePath.replace(/\.wav$/, '');
  const oggNas = join(config.libraryRoot, `${baseName}.ogg`);
  const mp3Nas = join(config.libraryRoot, `${baseName}.mp3`);

  if (!existsSync(oggNas) || !existsSync(mp3Nas)) {
    try {
      processAudioFile(wavPath, nasDir, req.params.id, sound.category);
    } catch (err) {
      return res.status(500).json({ error: `Processing failed: ${err.message}` });
    }
  }

  // Copy to project output dir
  const proj = loadProject(project);
  if (!proj) return res.status(404).json({ error: `Project ${project} not found` });

  const outputRoot = resolve(__dirname, proj.outputRoot);
  for (const ext of ['.ogg', '.mp3']) {
    const src = join(config.libraryRoot, `${baseName}${ext}`);
    const dest = join(outputRoot, `${targetPath}${ext}`);
    const destDir = dirname(dest);
    if (!existsSync(destDir)) {
      const { mkdirSync } = await import('node:fs');
      mkdirSync(destDir, { recursive: true });
    }
    copyFileSync(src, dest);
  }

  // Record assignment
  if (!sound.assignedTo) sound.assignedTo = {};
  sound.assignedTo[project] = {
    targetPath,
    syncedAt: new Date().toISOString(),
  };

  saveLibrary(library);
  res.json(sound);
});
```

Note: `copyFileSync` must be imported. Add it to the existing import at the top of server.js:
```javascript
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, unlinkSync, copyFileSync, mkdirSync } from 'node:fs';
```

- [ ] **Step 2: Add POST /api/library/:id/unassign**

```javascript
app.post('/api/library/:id/unassign', (req, res) => {
  const { project } = req.body;
  if (!project) return res.status(400).json({ error: 'project required' });

  const library = loadLibrary();
  const sound = library.sounds[req.params.id];
  if (!sound) return res.status(404).json({ error: 'Sound not found' });

  if (sound.assignedTo?.[project]) {
    delete sound.assignedTo[project];
    saveLibrary(library);
  }

  res.json(sound);
});
```

- [ ] **Step 3: Add POST /api/projects/:name/sync (audio sync)**

```javascript
app.post('/api/projects/:name/sync', (req, res) => {
  const project = loadProject(req.params.name);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const library = loadLibrary();
  const config = loadLibraryConfig();
  const synced = [];

  for (const [id, sound] of Object.entries(library.sounds)) {
    const assignment = sound.assignedTo?.[req.params.name];
    if (!assignment) continue;

    // Check if stale: createdAt > syncedAt
    if (sound.createdAt && assignment.syncedAt && new Date(sound.createdAt) <= new Date(assignment.syncedAt)) {
      continue;
    }

    // Re-copy processed files
    const baseName = sound.filePath.replace(/\.wav$/, '');
    const outputRoot = resolve(__dirname, project.outputRoot);

    for (const ext of ['.ogg', '.mp3']) {
      const src = join(config.libraryRoot, `${baseName}${ext}`);
      const dest = join(outputRoot, `${assignment.targetPath}${ext}`);
      if (existsSync(src)) {
        const destDir = dirname(dest);
        if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
        copyFileSync(src, dest);
      }
    }

    assignment.syncedAt = new Date().toISOString();
    synced.push(id);
  }

  saveLibrary(library);
  res.json({ synced, count: synced.length });
});
```

- [ ] **Step 4: Add POST /api/library/:id/generate**

```javascript
let audioGenerationInProgress = false;

app.post('/api/library/:id/generate', async (req, res) => {
  if (audioGenerationInProgress) return res.status(409).json({ error: 'Audio generation in progress' });

  const library = loadLibrary();
  const sound = library.sounds[req.params.id];
  if (!sound) return res.status(404).json({ error: 'Sound not found' });

  const config = loadLibraryConfig();
  audioGenerationInProgress = true;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  try {
    const backendKey = sound.backend || 'audiocraft';
    const backends = loadBackends();
    const adapterName = backends[backendKey]?.adapter || backendKey;
    const adapterPath = join(__dirname, 'adapters', `${adapterName}.js`);
    const adapter = await import(adapterPath);

    const wavDir = join(config.libraryRoot, dirname(sound.filePath));
    if (!existsSync(wavDir)) mkdirSync(wavDir, { recursive: true });
    const wavPath = join(config.libraryRoot, sound.filePath);

    res.write(`event: progress\ndata: ${JSON.stringify({ sound: req.params.id, status: 'generating', backend: backendKey })}\n\n`);

    // Use default project config for adapter (needs pythonPath, generateScript)
    const defaultProj = defaultProject ? loadProject(defaultProject) : null;
    const result = await adapter.generate({
      id: req.params.id,
      type: sound.category.startsWith('music') ? 'music' : 'sfx',
      prompt: sound.prompt,
      seed: sound.seed,
      duration: sound.duration,
      outputPath: wavPath,
      projectConfig: defaultProj || { _basePath: __dirname },
    });

    // Process to OGG/MP3
    res.write(`event: progress\ndata: ${JSON.stringify({ sound: req.params.id, status: 'processing' })}\n\n`);
    processAudioFile(wavPath, wavDir, req.params.id, sound.category);

    // Update library
    sound.seed = result.seed;
    sound.createdAt = new Date().toISOString();
    saveLibrary(library);

    res.write(`event: done\ndata: ${JSON.stringify({ sound: req.params.id, seed: result.seed })}\n\n`);
  } catch (err) {
    res.write(`event: error\ndata: ${JSON.stringify({ sound: req.params.id, error: err.message })}\n\n`);
  }

  res.write(`event: complete\ndata: ${JSON.stringify({ sound: req.params.id })}\n\n`);
  res.end();
  audioGenerationInProgress = false;
});
```

- [ ] **Step 5: Commit**

```bash
git add Assetgenerator/server.js
git commit -m "feat(assetgenerator): add audio library assign/sync/generate routes"
```

### Task 5: Audio library import route

**Files:**
- Modify: `Assetgenerator/server.js`

- [ ] **Step 1: Add POST /api/library/import**

This imports existing project sounds into the library. Arena import reads arena.json state + manifest for prompt/seed/duration data. L2P import scans the audio directory.

```javascript
app.post('/api/library/import', async (req, res) => {
  const { project } = req.body;
  if (!project) return res.status(400).json({ error: 'project required' });

  const proj = loadProject(project);
  if (!proj) return res.status(404).json({ error: `Project ${project} not found` });

  const library = loadLibrary();
  const config = loadLibraryConfig();
  const imported = [];

  // Subcategory mapping for arena
  const subcategoryMap = {
    gunshot: 'sfx/weapons', gunshot_new: 'sfx/weapons', melee_swing: 'sfx/weapons',
    grenade_launch: 'sfx/weapons', grenade_explode: 'sfx/weapons',
    footstep_walk: 'sfx/footsteps', footstep_sprint: 'sfx/footsteps',
    bullet_impact: 'sfx/impacts', player_hit: 'sfx/impacts', player_death: 'sfx/impacts',
    health_pickup: 'sfx/ui', armor_pickup: 'sfx/ui',
    match_victory: 'sfx/ui', match_defeat: 'sfx/ui',
    round_start: 'sfx/ui', round_end: 'sfx/ui',
    zone_warning: 'sfx/environment', zone_tick: 'sfx/environment',
    battle: 'music/battle', lobby: 'music/ambient',
    victory: 'music/stings', defeat: 'music/stings', respectisevt: 'music/stings',
  };

  const audioRoot = resolve(__dirname, proj.audioRoot);

  for (const [id, sound] of Object.entries(proj.sounds || {})) {
    if (library.sounds[id]) continue; // Skip already imported

    const category = subcategoryMap[id] || (sound.type === 'music' ? 'music/ambient' : 'sfx/ui');
    const wavSrc = join(audioRoot, sound.filePath);

    if (existsSync(wavSrc)) {
      // Copy WAV to NAS
      const nasDir = join(config.libraryRoot, category);
      if (!existsSync(nasDir)) mkdirSync(nasDir, { recursive: true });
      const nasDest = join(nasDir, `${id}.wav`);
      copyFileSync(wavSrc, nasDest);

      library.sounds[id] = {
        id,
        name: id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        category,
        tags: [project],
        prompt: sound.prompt || '',
        seed: sound.seed || null,
        duration: sound.duration || null,
        backend: sound.backend === 'default' ? 'audiocraft' : (sound.backend || 'audiocraft'),
        filePath: `${category}/${id}.wav`,
        createdAt: sound.lastGeneratedAt || new Date().toISOString(),
        assignedTo: {
          [project]: {
            targetPath: `${sound.type}/${id}`,
            syncedAt: new Date().toISOString(),
          },
        },
      };

      imported.push(id);
    }
  }

  saveLibrary(library);
  res.json({ imported, count: imported.length });
});
```

- [ ] **Step 2: Verify import works**

Run the server, then test:
```bash
curl -X POST http://localhost:5200/api/library/import \
  -H 'Content-Type: application/json' \
  -d '{"project":"arena"}'
```

Expected: JSON with `imported` array listing all arena sound IDs.

- [ ] **Step 3: Commit**

```bash
git add Assetgenerator/server.js
git commit -m "feat(assetgenerator): add audio library import route"
```

---

## Chunk 3: Visual Library API Routes

### Task 6: Visual library CRUD routes

**Files:**
- Modify: `Assetgenerator/server.js`

- [ ] **Step 1: Add visual library CRUD routes**

Add after the audio library routes:

```javascript
// =============================================================================
// Visual Library Routes
// =============================================================================

app.get('/api/visual-library', (req, res) => {
  res.json(loadVisualLibrary());
});

app.get('/api/visual-library/:id', (req, res) => {
  const library = loadVisualLibrary();
  const asset = library.assets[req.params.id];
  if (!asset) return res.status(404).json({ error: 'Asset not found' });
  res.json(asset);
});

app.post('/api/visual-library', (req, res) => {
  const { id, name, category, tags, prompt, poses, directions, size, color } = req.body;
  if (!id || !name || !category) return res.status(400).json({ error: 'id, name, category required' });

  const library = loadVisualLibrary();
  if (library.assets[id]) return res.status(409).json({ error: 'Asset already exists' });

  const vConfig = loadVisualConfig();
  const catConfig = vConfig.categories[category] || {};

  library.assets[id] = {
    id,
    name,
    category,
    tags: tags || [],
    prompt: prompt || '',
    poses: poses || catConfig.defaultPoses || ['idle'],
    directions: directions || catConfig.directions || 1,
    size: size || catConfig.size || 32,
    color: color || '#ffffff',
    pipeline: {
      concept: { status: 'pending' },
      model: catConfig.has3D !== false ? { status: 'pending' } : undefined,
      render: { status: 'pending' },
      pack: { status: 'pending' },
    },
    assignedTo: {},
  };

  // Remove model phase for non-3D categories
  if (catConfig.has3D === false) {
    delete library.assets[id].pipeline.model;
  }

  saveVisualLibrary(library);
  res.status(201).json(library.assets[id]);
});

app.put('/api/visual-library/:id', (req, res) => {
  const library = loadVisualLibrary();
  const asset = library.assets[req.params.id];
  if (!asset) return res.status(404).json({ error: 'Asset not found' });

  const allowed = ['name', 'category', 'tags', 'prompt', 'poses', 'directions', 'size', 'color'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) asset[key] = req.body[key];
  }

  saveVisualLibrary(library);
  res.json(asset);
});

app.delete('/api/visual-library/:id', (req, res) => {
  const library = loadVisualLibrary();
  const asset = library.assets[req.params.id];
  if (!asset) return res.status(404).json({ error: 'Asset not found' });

  // Delete NAS files
  const vConfig = loadVisualConfig();
  const dirs = ['concepts', 'models', 'renders'];
  for (const dir of dirs) {
    const path = join(vConfig.libraryRoot, dir, asset.category, asset.id);
    if (existsSync(path)) {
      const { rmSync } = await import('node:fs');
      rmSync(path, { recursive: true });
    }
  }

  delete library.assets[req.params.id];
  saveVisualLibrary(library);
  res.json({ deleted: req.params.id });
});
```

- [ ] **Step 2: Commit**

```bash
git add Assetgenerator/server.js
git commit -m "feat(assetgenerator): add visual library CRUD routes"
```

### Task 7: Visual library file streaming routes

**Files:**
- Modify: `Assetgenerator/server.js`

- [ ] **Step 1: Add visual file streaming endpoints**

```javascript
app.get('/api/visual-library/:id/concept', (req, res) => {
  const library = loadVisualLibrary();
  const asset = library.assets[req.params.id];
  if (!asset) return res.status(404).json({ error: 'Asset not found' });
  if (!asset.pipeline.concept?.path) return res.status(404).json({ error: 'No concept generated' });

  const vConfig = loadVisualConfig();
  const filePath = join(vConfig.libraryRoot, asset.pipeline.concept.path);
  if (!existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.sendFile(filePath);
});

app.get('/api/visual-library/:id/model', (req, res) => {
  const library = loadVisualLibrary();
  const asset = library.assets[req.params.id];
  if (!asset) return res.status(404).json({ error: 'Asset not found' });
  if (!asset.pipeline.model?.path) return res.status(404).json({ error: 'No model generated' });

  const vConfig = loadVisualConfig();
  const filePath = join(vConfig.libraryRoot, asset.pipeline.model.path);
  if (!existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.sendFile(filePath);
});

app.get('/api/visual-library/:id/render/:pose/:direction', (req, res) => {
  const library = loadVisualLibrary();
  const asset = library.assets[req.params.id];
  if (!asset) return res.status(404).json({ error: 'Asset not found' });

  const vConfig = loadVisualConfig();
  const filePath = join(vConfig.libraryRoot, 'renders', asset.category, asset.id,
    `${asset.id}-${req.params.pose}-${req.params.direction}.png`);
  if (!existsSync(filePath)) return res.status(404).json({ error: 'Render not found' });
  res.sendFile(filePath);
});

app.get('/api/visual-library/:id/atlas', (req, res) => {
  const library = loadVisualLibrary();
  const asset = library.assets[req.params.id];
  if (!asset) return res.status(404).json({ error: 'Asset not found' });

  const vConfig = loadVisualConfig();
  const filePath = join(vConfig.libraryRoot, 'sprites', `${asset.category}.png`);
  if (!existsSync(filePath)) return res.status(404).json({ error: 'Atlas not found' });
  res.sendFile(filePath);
});
```

- [ ] **Step 2: Commit**

```bash
git add Assetgenerator/server.js
git commit -m "feat(assetgenerator): add visual library file streaming routes"
```

### Task 8: Visual pipeline generation route with SSE

**Files:**
- Modify: `Assetgenerator/server.js`

- [ ] **Step 1: Add staleness propagation helper**

```javascript
function markDownstreamStale(asset, fromPhase) {
  const phases = ['concept', 'model', 'render', 'pack'];
  const startIdx = phases.indexOf(fromPhase) + 1;
  for (let i = startIdx; i < phases.length; i++) {
    if (asset.pipeline[phases[i]]) {
      asset.pipeline[phases[i]].status = 'pending';
    }
  }
}
```

- [ ] **Step 2: Add POST /api/visual-library/:id/generate/:phase**

```javascript
let visualGenerationInProgress = false;

app.post('/api/visual-library/:id/generate/:phase', async (req, res) => {
  if (visualGenerationInProgress) return res.status(409).json({ error: 'Visual generation in progress' });

  const library = loadVisualLibrary();
  const asset = library.assets[req.params.id];
  if (!asset) return res.status(404).json({ error: 'Asset not found' });

  const phase = req.params.phase;
  const validPhases = ['concept', 'model', 'render', 'pack', 'full'];
  if (!validPhases.includes(phase)) return res.status(400).json({ error: `Invalid phase: ${phase}` });

  visualGenerationInProgress = true;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const vConfig = loadVisualConfig();
  const phasesToRun = phase === 'full'
    ? ['concept', 'model', 'render', 'pack'].filter(p => asset.pipeline[p]?.status !== 'done')
    : [phase];

  // Skip model phase for non-3D categories
  const catConfig = vConfig.categories[asset.category] || {};
  const filteredPhases = phasesToRun.filter(p => !(p === 'model' && catConfig.has3D === false));

  for (const p of filteredPhases) {
    try {
      res.write(`event: progress\ndata: ${JSON.stringify({ asset: asset.id, phase: p, status: 'generating' })}\n\n`);

      asset.pipeline[p] = asset.pipeline[p] || {};
      asset.pipeline[p].status = 'generating';

      const adapterMap = { concept: 'comfyui', model: 'triposr', render: 'blender', pack: 'packer' };
      const adapterName = adapterMap[p];
      const adapterPath = join(__dirname, 'adapters', `${adapterName}.js`);

      if (!existsSync(adapterPath)) {
        throw new Error(`Adapter not found: ${adapterPath}`);
      }

      const adapter = await import(adapterPath);
      const result = await adapter.generate({
        id: asset.id,
        asset,
        config: vConfig,
        libraryRoot: vConfig.libraryRoot,
      });

      asset.pipeline[p].status = 'done';
      asset.pipeline[p].generatedAt = new Date().toISOString();
      if (result.path) asset.pipeline[p].path = result.path;
      if (result.frameCount) asset.pipeline[p].frameCount = result.frameCount;
      if (result.backend) asset.pipeline[p].backend = result.backend;

      // Mark downstream stale
      markDownstreamStale(asset, p);

      saveVisualLibrary(library);

      res.write(`event: done\ndata: ${JSON.stringify({ asset: asset.id, phase: p, ...result })}\n\n`);
    } catch (err) {
      asset.pipeline[p].status = 'error';
      saveVisualLibrary(library);
      res.write(`event: error\ndata: ${JSON.stringify({ asset: asset.id, phase: p, error: err.message })}\n\n`);
      break; // Stop pipeline on error
    }
  }

  res.write(`event: complete\ndata: ${JSON.stringify({ asset: asset.id })}\n\n`);
  res.end();
  visualGenerationInProgress = false;
});
```

- [ ] **Step 3: Add batch generation route**

```javascript
app.post('/api/visual-library/batch/generate', async (req, res) => {
  if (visualGenerationInProgress) return res.status(409).json({ error: 'Visual generation in progress' });

  const { ids, fromPhase } = req.body;
  if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'ids array required' });

  visualGenerationInProgress = true;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const library = loadVisualLibrary();
  const vConfig = loadVisualConfig();
  let succeeded = 0;
  let failed = 0;

  for (const id of ids) {
    const asset = library.assets[id];
    if (!asset) {
      res.write(`event: error\ndata: ${JSON.stringify({ asset: id, error: 'Not found' })}\n\n`);
      failed++;
      continue;
    }

    const phases = ['concept', 'model', 'render', 'pack'];
    const startIdx = fromPhase ? phases.indexOf(fromPhase) : 0;
    const catConfig = vConfig.categories[asset.category] || {};
    const phasesToRun = phases.slice(startIdx >= 0 ? startIdx : 0)
      .filter(p => !(p === 'model' && catConfig.has3D === false));

    let assetFailed = false;
    for (const p of phasesToRun) {
      try {
        res.write(`event: progress\ndata: ${JSON.stringify({ asset: id, phase: p, status: 'generating' })}\n\n`);

        const adapterMap = { concept: 'comfyui', model: 'triposr', render: 'blender', pack: 'packer' };
        const adapterPath = join(__dirname, 'adapters', `${adapterMap[p]}.js`);
        if (!existsSync(adapterPath)) throw new Error(`Adapter ${adapterMap[p]} not found`);

        const adapter = await import(adapterPath);
        const result = await adapter.generate({ id, asset, config: vConfig, libraryRoot: vConfig.libraryRoot });

        asset.pipeline[p] = { status: 'done', generatedAt: new Date().toISOString(), ...result };
        saveVisualLibrary(library);

        res.write(`event: done\ndata: ${JSON.stringify({ asset: id, phase: p, ...result })}\n\n`);
      } catch (err) {
        asset.pipeline[p] = { status: 'error' };
        saveVisualLibrary(library);
        res.write(`event: error\ndata: ${JSON.stringify({ asset: id, phase: p, error: err.message })}\n\n`);
        assetFailed = true;
        break;
      }
    }

    if (assetFailed) failed++;
    else succeeded++;
  }

  res.write(`event: complete\ndata: ${JSON.stringify({ total: ids.length, succeeded, failed })}\n\n`);
  res.end();
  visualGenerationInProgress = false;
});
```

- [ ] **Step 4: Commit**

```bash
git add Assetgenerator/server.js
git commit -m "feat(assetgenerator): add visual pipeline generation routes with SSE"
```

### Task 9: Visual library assign/sync/import routes

**Files:**
- Modify: `Assetgenerator/server.js`

- [ ] **Step 1: Add assign/unassign routes**

```javascript
app.post('/api/visual-library/:id/assign', (req, res) => {
  const { project, atlas } = req.body;
  if (!project || !atlas) return res.status(400).json({ error: 'project and atlas required' });

  const library = loadVisualLibrary();
  const asset = library.assets[req.params.id];
  if (!asset) return res.status(404).json({ error: 'Asset not found' });

  const vConfig = loadVisualConfig();
  const proj = loadProject(project);
  if (!proj) return res.status(404).json({ error: `Project ${project} not found` });

  // Copy atlas PNG + JSON to project
  const outputRoot = resolve(__dirname, proj.outputRoot);
  const spritesDir = join(outputRoot, 'sprites');
  if (!existsSync(spritesDir)) mkdirSync(spritesDir, { recursive: true });

  for (const ext of ['.png', '.json']) {
    const src = join(vConfig.libraryRoot, 'sprites', `${asset.category}${ext}`);
    if (existsSync(src)) {
      copyFileSync(src, join(spritesDir, `${asset.category}${ext}`));
    }
  }

  if (!asset.assignedTo) asset.assignedTo = {};
  asset.assignedTo[project] = {
    atlas,
    syncedAt: new Date().toISOString(),
  };

  saveVisualLibrary(library);
  res.json(asset);
});

app.post('/api/visual-library/:id/unassign', (req, res) => {
  const { project } = req.body;
  if (!project) return res.status(400).json({ error: 'project required' });

  const library = loadVisualLibrary();
  const asset = library.assets[req.params.id];
  if (!asset) return res.status(404).json({ error: 'Asset not found' });

  if (asset.assignedTo?.[project]) {
    delete asset.assignedTo[project];
    saveVisualLibrary(library);
  }

  res.json(asset);
});
```

- [ ] **Step 2: Add visual sync route**

```javascript
app.post('/api/projects/:name/sync-visual', (req, res) => {
  const project = loadProject(req.params.name);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const library = loadVisualLibrary();
  const vConfig = loadVisualConfig();
  const synced = [];

  for (const [id, asset] of Object.entries(library.assets)) {
    const assignment = asset.assignedTo?.[req.params.name];
    if (!assignment) continue;

    const packGen = asset.pipeline.pack?.generatedAt;
    if (packGen && assignment.syncedAt && new Date(packGen) <= new Date(assignment.syncedAt)) {
      continue;
    }

    // Re-copy atlas files
    const outputRoot = resolve(__dirname, project.outputRoot);
    const spritesDir = join(outputRoot, 'sprites');
    if (!existsSync(spritesDir)) mkdirSync(spritesDir, { recursive: true });

    for (const ext of ['.png', '.json']) {
      const src = join(vConfig.libraryRoot, 'sprites', `${asset.category}${ext}`);
      if (existsSync(src)) {
        copyFileSync(src, join(spritesDir, `${asset.category}${ext}`));
      }
    }

    assignment.syncedAt = new Date().toISOString();
    synced.push(id);
  }

  saveVisualLibrary(library);
  res.json({ synced, count: synced.length });
});
```

- [ ] **Step 3: Add visual import route**

```javascript
app.post('/api/visual-library/import', (req, res) => {
  const { project } = req.body;
  if (!project) return res.status(400).json({ error: 'project required' });

  const proj = loadProject(project);
  if (!proj) return res.status(404).json({ error: `Project ${project} not found` });

  const library = loadVisualLibrary();
  const vConfig = loadVisualConfig();

  // Read arena manifest
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(resolve(__dirname, proj.manifestPath), 'utf-8'));
  } catch {
    return res.status(400).json({ error: 'Cannot read manifest' });
  }

  const imported = [];
  const arenaRoot = resolve(__dirname, proj.audioRoot, '..'); // arena/assets/

  const categoryAssets = {
    characters: manifest.characters || [],
    weapons: manifest.weapons || [],
    items: manifest.items || [],
    tiles: manifest.tiles || [],
    cover: manifest.cover || [],
    ui: manifest.ui || [],
  };

  for (const [category, assets] of Object.entries(categoryAssets)) {
    const catConfig = vConfig.categories[category] || {};

    for (const asset of assets) {
      const id = asset.id;
      if (library.assets[id]) continue;

      // Copy files from arena to NAS (if they exist)
      const copyDirs = [
        { from: join(arenaRoot, 'concepts', category), to: join(vConfig.libraryRoot, 'concepts', category), ext: '.png' },
        { from: join(arenaRoot, 'models', category), to: join(vConfig.libraryRoot, 'models', category), ext: '.glb' },
      ];

      const pipeline = {};

      // Concept
      const conceptSrc = join(arenaRoot, 'concepts', category, `${id}.png`);
      if (existsSync(conceptSrc)) {
        const conceptDest = join(vConfig.libraryRoot, 'concepts', category);
        if (!existsSync(conceptDest)) mkdirSync(conceptDest, { recursive: true });
        copyFileSync(conceptSrc, join(conceptDest, `${id}.png`));
        pipeline.concept = { status: 'done', path: `concepts/${category}/${id}.png`, generatedAt: new Date().toISOString() };
      } else {
        pipeline.concept = { status: 'pending' };
      }

      // Model (only for 3D categories)
      if (catConfig.has3D !== false) {
        const modelSrc = join(arenaRoot, 'models', category, `${id}.glb`);
        if (existsSync(modelSrc)) {
          const modelDest = join(vConfig.libraryRoot, 'models', category);
          if (!existsSync(modelDest)) mkdirSync(modelDest, { recursive: true });
          copyFileSync(modelSrc, join(modelDest, `${id}.glb`));
          pipeline.model = { status: 'done', path: `models/${category}/${id}.glb`, generatedAt: new Date().toISOString() };
        } else {
          pipeline.model = { status: 'pending' };
        }
      }

      // Renders
      const renderSrc = join(arenaRoot, 'renders', category, id);
      if (existsSync(renderSrc)) {
        const renderDest = join(vConfig.libraryRoot, 'renders', category, id);
        if (!existsSync(renderDest)) mkdirSync(renderDest, { recursive: true });
        for (const f of readdirSync(renderSrc)) {
          copyFileSync(join(renderSrc, f), join(renderDest, f));
        }
        const frameCount = readdirSync(renderSrc).filter(f => f.endsWith('.png')).length;
        pipeline.render = { status: 'done', frameCount, generatedAt: new Date().toISOString() };
      } else {
        pipeline.render = { status: 'pending' };
      }

      // Pack status (check if atlas exists)
      const atlasSrc = join(arenaRoot, '..', 'frontend', 'public', 'assets', 'sprites', `${category}.png`);
      if (existsSync(atlasSrc)) {
        // Copy atlas to NAS
        const spritesDest = join(vConfig.libraryRoot, 'sprites');
        if (!existsSync(spritesDest)) mkdirSync(spritesDest, { recursive: true });
        for (const ext of ['.png', '.json']) {
          const src = join(arenaRoot, '..', 'frontend', 'public', 'assets', 'sprites', `${category}${ext}`);
          if (existsSync(src)) copyFileSync(src, join(spritesDest, `${category}${ext}`));
        }
        pipeline.pack = { status: 'done', generatedAt: new Date().toISOString() };
      } else {
        pipeline.pack = { status: 'pending' };
      }

      library.assets[id] = {
        id,
        name: asset.name || id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        category,
        tags: [project],
        prompt: asset.prompt || '',
        poses: asset.poses || catConfig.defaultPoses || ['idle'],
        directions: catConfig.directions || 1,
        size: asset.size || catConfig.size || 32,
        color: asset.color || '#ffffff',
        pipeline,
        assignedTo: {
          [project]: { atlas: category, syncedAt: new Date().toISOString() },
        },
      };

      imported.push(id);
    }
  }

  // Copy Blender templates
  const blendSrc = join(arenaRoot, 'blend');
  if (existsSync(blendSrc)) {
    const blendDest = join(vConfig.libraryRoot, 'blend');
    if (!existsSync(blendDest)) mkdirSync(blendDest, { recursive: true });
    for (const f of readdirSync(blendSrc, { recursive: true })) {
      const src = join(blendSrc, f.toString());
      const dest = join(blendDest, f.toString());
      if (statSync(src).isFile()) {
        const destDir = dirname(dest);
        if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
        copyFileSync(src, dest);
      }
    }
  }

  saveVisualLibrary(library);
  res.json({ imported, count: imported.length });
});
```

- [ ] **Step 4: Commit**

```bash
git add Assetgenerator/server.js
git commit -m "feat(assetgenerator): add visual library assign/sync/import routes"
```

---

## Chunk 4: Visual Pipeline Adapters

### Task 10: Create visual pipeline adapters

**Files:**
- Create: `Assetgenerator/adapters/comfyui.js`
- Create: `Assetgenerator/adapters/diffusers.js`
- Create: `Assetgenerator/adapters/triposr.js`
- Create: `Assetgenerator/adapters/meshy.js`
- Create: `Assetgenerator/adapters/blender.js`
- Create: `Assetgenerator/adapters/packer.js`

Each adapter exports `generate({ id, asset, config, libraryRoot })` and spawns the appropriate Python/Node process.

- [ ] **Step 1: Create comfyui.js adapter**

```javascript
// Assetgenerator/adapters/comfyui.js
import { spawn } from 'node:child_process';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = resolve(__dirname, '..', 'scripts');

export async function generate({ id, asset, config, libraryRoot }) {
  const scriptPath = join(SCRIPTS_DIR, 'generate_concepts.py');
  const outputDir = join(libraryRoot, 'concepts', asset.category);
  const catConfig = config.categories[asset.category] || {};
  const resolution = catConfig.conceptResolution || 1024;

  const args = [
    scriptPath,
    '--id', id,
    '--category', asset.category,
    '--backend', 'auto',
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
      if (code !== 0) return reject(new Error(`generate_concepts.py exited ${code}: ${stderr}`));
      resolvePromise({
        status: 'done',
        path: `concepts/${asset.category}/${id}.png`,
        backend: 'comfyui',
      });
    });
  });
}
```

- [ ] **Step 2: Create diffusers.js adapter**

Same pattern as comfyui.js but passes `--backend diffusers`:

```javascript
// Assetgenerator/adapters/diffusers.js
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
```

- [ ] **Step 3: Create triposr.js adapter**

```javascript
// Assetgenerator/adapters/triposr.js
import { spawn } from 'node:child_process';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = resolve(__dirname, '..', 'scripts');

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
      if (code !== 0) return reject(new Error(`generate_3d.py exited ${code}: ${stderr}`));
      resolvePromise({
        status: 'done',
        path: `models/${asset.category}/${id}.glb`,
        backend: 'triposr',
      });
    });
  });
}
```

- [ ] **Step 4: Create meshy.js adapter**

```javascript
// Assetgenerator/adapters/meshy.js
import { spawn } from 'node:child_process';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = resolve(__dirname, '..', 'scripts');

export async function generate({ id, asset, config, libraryRoot }) {
  const scriptPath = join(SCRIPTS_DIR, 'generate_3d.py');
  const conceptPath = join(libraryRoot, 'concepts', asset.category, `${id}.png`);
  const outputDir = join(libraryRoot, 'models', asset.category);

  const args = [
    scriptPath,
    '--id', id,
    '--backend', 'meshy',
    '--input', conceptPath,
    '--output', outputDir,
  ];

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
      if (code !== 0) return reject(new Error(`generate_3d.py (meshy) exited ${code}: ${stderr}`));
      resolvePromise({
        status: 'done',
        path: `models/${asset.category}/${id}.glb`,
        backend: 'meshy',
      });
    });
  });
}
```

- [ ] **Step 5: Create blender.js adapter**

```javascript
// Assetgenerator/adapters/blender.js
import { spawn } from 'node:child_process';
import { resolve, join, dirname, basename } from 'node:path';
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

      // Count rendered frames
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
```

- [ ] **Step 6: Create packer.js adapter**

```javascript
// Assetgenerator/adapters/packer.js
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
    scriptPath,
    '--category', asset.category,
    '--input', inputDir,
    '--output', outputDir,
  ];

  return new Promise((resolvePromise, reject) => {
    const proc = spawn('npx', ['tsx', ...args], {
      cwd: resolve(__dirname, '..'),
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    proc.on('close', code => {
      if (code !== 0) return reject(new Error(`pack_sprites.ts exited ${code}: ${stderr}`));

      // Check output size
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
```

- [ ] **Step 7: Commit**

```bash
git add Assetgenerator/adapters/comfyui.js Assetgenerator/adapters/diffusers.js Assetgenerator/adapters/triposr.js Assetgenerator/adapters/meshy.js Assetgenerator/adapters/blender.js Assetgenerator/adapters/packer.js
git commit -m "feat(assetgenerator): add 6 visual pipeline adapters"
```

---

## Chunk 5: Script Migration

### Task 11: Copy and extend arena scripts

**Files:**
- Create: `Assetgenerator/scripts/generate_concepts.py` (copy from arena, add `--output` and `--prompt` flags)
- Create: `Assetgenerator/scripts/generate_3d.py` (copy from arena, add `--input` and `--output` flags)
- Create: `Assetgenerator/scripts/render_sprites.py` (copy from arena, add `--model`, `--template`, `--output` flags)
- Create: `Assetgenerator/scripts/pack_sprites.ts` (copy from arena, add `--input` and `--output` flags)
- Create: `Assetgenerator/scripts/create_blender_templates.py` (copy from arena, add `--output` flag)
- Create: `Assetgenerator/scripts/import_sprite_pack.ts` (copy from arena, add `--output` flag)

- [ ] **Step 1: Copy and modify generate_concepts.py**

Copy `arena/scripts/generate_concepts.py` to `Assetgenerator/scripts/generate_concepts.py`.

Modifications to `main()`:
1. Add `--output` argument: `parser.add_argument("--output", help="Output directory (overrides default)")`
2. Add `--prompt` argument: `parser.add_argument("--prompt", help="Override manifest prompt")`
3. In `main()`, if `args.output`: `OUTPUT_BASE = Path(args.output)` (replace the module-level constant)
4. In `generate_asset()` and `generate_character_concepts()`, if a `--prompt` arg is provided, use it instead of `asset["prompt"]`
5. Make `MANIFEST_PATH` optional — if it doesn't exist and `--id` + `--prompt` + `--output` are all provided, generate without manifest
6. Keep the module-level `MANIFEST_PATH` and `OUTPUT_BASE` as defaults but allow CLI override

Key changes to `main()`:
```python
def main():
    parser = argparse.ArgumentParser(description="Generate concept art")
    parser.add_argument("--comfyui-url", default="http://127.0.0.1:8188")
    parser.add_argument("--category", help="Only generate this category")
    parser.add_argument("--id", help="Only generate this asset ID")
    parser.add_argument("--backend", choices=["comfyui", "diffusers", "auto"], default="auto")
    parser.add_argument("--output", help="Output base directory (overrides default)")
    parser.add_argument("--prompt", help="Override prompt for single asset generation")
    args = parser.parse_args()

    global OUTPUT_BASE
    if args.output:
        OUTPUT_BASE = Path(args.output)

    # If --id and --prompt provided without manifest, generate single asset
    if args.id and args.prompt and not MANIFEST_PATH.exists():
        # ... direct generation without manifest
```

- [ ] **Step 2: Copy and modify generate_3d.py**

Copy `arena/scripts/generate_3d.py` to `Assetgenerator/scripts/generate_3d.py`.

Add to argparse:
```python
parser.add_argument("--input", help="Input concept image path (overrides default)")
parser.add_argument("--output", help="Output directory (overrides default)")
```

In `main()`:
```python
global OUTPUT_BASE, CONCEPTS_DIR
if args.output:
    OUTPUT_BASE = Path(args.output)
if args.input:
    CONCEPTS_DIR = Path(args.input).parent  # Or handle single-file case
```

- [ ] **Step 3: Copy and modify render_sprites.py**

Copy `arena/scripts/render_sprites.py` to `Assetgenerator/scripts/render_sprites.py`.

Add to argparse:
```python
parser.add_argument("--model", help="Model path (overrides default)")
parser.add_argument("--template", help="Template .blend path (overrides default)")
parser.add_argument("--output", help="Output directory (overrides default)")
```

In `render_character()` and `render_static()`: accept optional `template_path` parameter. When provided, use it instead of calling `get_template_path()`.

In `main()`: when `--model` is provided, use it directly instead of constructing from `MODELS_DIR + category + id`. When `--template` is provided, pass it through. When `--output` is provided, override `OUTPUT_BASE`.

- [ ] **Step 4: Copy and modify pack_sprites.ts**

Copy `arena/scripts/pack_sprites.ts` to `Assetgenerator/scripts/pack_sprites.ts`.

Add CLI flag parsing:
```typescript
const inputIdx = args.indexOf('--input');
const outputIdx = args.indexOf('--output');
const inputDir = inputIdx >= 0 ? args[inputIdx + 1] : RENDERS_DIR;
const outputDir = outputIdx >= 0 ? args[outputIdx + 1] : OUTPUT_DIR;
```

Replace `RENDERS_DIR` and `OUTPUT_DIR` usage with the resolved values.

- [ ] **Step 5: Copy remaining scripts**

Copy `arena/scripts/create_blender_templates.py` → `Assetgenerator/scripts/create_blender_templates.py`
- Add `--output` flag, override `BLEND_DIR` when provided

Copy `arena/scripts/import_sprite_pack.ts` → `Assetgenerator/scripts/import_sprite_pack.ts`
- Add `--output` flag, override `RENDERS_DIR` when provided

- [ ] **Step 6: Commit**

```bash
git add Assetgenerator/scripts/
git commit -m "feat(assetgenerator): migrate visual pipeline scripts from arena"
```

---

## Chunk 6: UI — Audio Tab + Visual Tab

### Task 12: Restructure index.html with tab toggle

**Files:**
- Modify: `Assetgenerator/index.html`

This is the largest single change. The existing index.html (1017 lines) needs:
1. Header: Add `[Audio | Visual]` tab toggle between logo and project selector
2. Filter bar: Adapt per-tab (Audio shows SFX/Music/Flagged, Visual shows category dropdown)
3. Main container: Two containers (`#audio-container`, `#visual-container`), toggle visibility
4. Audio tab: Absorbs old Review view + adds assign/sync UI
5. Visual tab: Pipeline cards with phase indicators + regen buttons
6. Log panel: Shared, with phase labels for visual events

- [ ] **Step 1: Add CSS for tab toggle and visual cards**

Add these styles to the existing `<style>` block:

```css
/* Tab toggle */
.tab-toggle {
  display: flex;
  gap: 0;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.tab-btn {
  background: transparent;
  border: none;
  border-radius: 0;
  color: var(--text-dim);
  padding: 0.35rem 0.8rem;
  font-size: 0.78rem;
  text-transform: uppercase;
}

.tab-btn:hover { color: var(--text); }

.tab-btn.active {
  background: var(--cyan-dim);
  color: var(--cyan);
}

/* Pipeline indicator */
.pipeline {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin: 0.5rem 0;
  font-family: var(--font-mono);
  font-size: 0.75rem;
}

.pipeline-phase {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  border: 1px solid var(--border);
}

.pipeline-phase.done { border-color: var(--green); color: var(--green); }
.pipeline-phase.pending { border-color: var(--text-muted); color: var(--text-muted); }
.pipeline-phase.generating { border-color: var(--cyan); color: var(--cyan); animation: pulse-flag 1.5s infinite; }
.pipeline-phase.error { border-color: var(--red); color: var(--red); }

.pipeline-arrow { color: var(--text-muted); font-size: 0.65rem; }

/* Assignment badges */
.assign-info {
  font-family: var(--font-mono);
  font-size: 0.72rem;
  color: var(--text-dim);
  margin: 0.3rem 0;
}

/* Visual preview row */
.preview-row {
  display: flex;
  gap: 0.75rem;
  margin: 0.5rem 0;
  overflow-x: auto;
}

.preview-thumb {
  width: 80px;
  height: 80px;
  border-radius: 4px;
  border: 1px solid var(--border);
  object-fit: contain;
  background: var(--bg-deep);
}

/* Tag input */
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin: 0.25rem 0;
}

.tag {
  font-family: var(--font-mono);
  font-size: 0.65rem;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  background: var(--bg-deep);
  color: var(--text-dim);
  border: 1px solid var(--border);
}
```

- [ ] **Step 2: Update header HTML**

Replace the existing header with tab toggle:

```html
<header>
  <div class="header-left">
    <div class="logo">Asset<span>generator</span></div>
    <div class="tab-toggle">
      <button class="tab-btn active" data-tab="audio">Audio</button>
      <button class="tab-btn" data-tab="visual">Visual</button>
    </div>
    <label style="display:flex;align-items:center;gap:0.4rem;">
      <span style="font-family:var(--font-mono);font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.05em">Project</span>
      <select id="project-select"></select>
    </label>
  </div>
  <div class="header-controls">
    <button id="scan-btn">Scan</button>
    <button id="sync-btn">Sync</button>
    <button id="regen-btn" class="btn-primary">Regenerate Flagged</button>
  </div>
</header>
```

- [ ] **Step 3: Add dual containers**

Replace `<div id="sounds-container"></div>` with:

```html
<div id="audio-container" style="padding:1rem 1.5rem 6rem;max-width:1100px;margin:0 auto;"></div>
<div id="visual-container" style="padding:1rem 1.5rem 6rem;max-width:1100px;margin:0 auto;display:none;"></div>
```

- [ ] **Step 4: Add tab switching JavaScript**

Add to the event wiring section:

```javascript
let activeTab = 'audio';

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeTab = btn.dataset.tab;

    document.getElementById('audio-container').style.display = activeTab === 'audio' ? '' : 'none';
    document.getElementById('visual-container').style.display = activeTab === 'visual' ? '' : 'none';

    // Show/hide tab-specific controls
    document.getElementById('regen-btn').style.display = activeTab === 'audio' ? '' : 'none';
    document.querySelector('.filter-bar').style.display = activeTab === 'audio' ? '' : 'none';

    if (activeTab === 'visual') renderVisualAssets();
  });
});
```

- [ ] **Step 5: Update audio card to include assign/unassign UI**

Modify `createCard()` to add assignment controls. After the existing "Flag for Regen" button, add:

```javascript
// Assign button
const assignBtn = document.createElement('button');
assignBtn.textContent = 'Assign';
assignBtn.addEventListener('click', async () => {
  const project = currentProject;
  const targetPath = prompt(`Target path for ${id} (e.g., sfx/gunshot):`, `${sound.type}/${id}`);
  if (!targetPath) return;
  await fetchJSON(`/api/library/${id}/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project, targetPath }),
  });
  card.classList.add('save-flash');
  setTimeout(() => card.classList.remove('save-flash'), 600);
});
actions.appendChild(assignBtn);
```

- [ ] **Step 6: Add renderVisualAssets() function**

This renders the Visual tab cards with pipeline indicators:

```javascript
async function loadVisualData() {
  visualData = await fetchJSON('/api/visual-library');
}

function renderVisualAssets() {
  const container = document.getElementById('visual-container');
  container.replaceChildren();

  if (!visualData?.assets || Object.keys(visualData.assets).length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = 'No visual assets. Import from project or create new.';
    container.appendChild(empty);
    return;
  }

  // Group by category
  const byCategory = {};
  for (const [id, asset] of Object.entries(visualData.assets)) {
    if (!byCategory[asset.category]) byCategory[asset.category] = [];
    byCategory[asset.category].push([id, asset]);
  }

  for (const [category, assets] of Object.entries(byCategory)) {
    const header = document.createElement('h2');
    header.className = 'section-header';
    header.textContent = `${category} — ${assets.length} assets`;
    container.appendChild(header);

    for (const [id, asset] of assets) {
      container.appendChild(createVisualCard(id, asset));
    }
  }
}

function createVisualCard(id, asset) {
  const card = document.createElement('div');
  card.className = 'card';

  // Header
  const headerRow = document.createElement('div');
  headerRow.className = 'card-header';

  const nameEl = document.createElement('span');
  nameEl.className = 'sound-name';
  nameEl.textContent = asset.name || id;
  headerRow.appendChild(nameEl);

  // Tags
  for (const tag of (asset.tags || [])) {
    const tagEl = document.createElement('span');
    tagEl.className = 'badge badge-type';
    tagEl.textContent = tag;
    headerRow.appendChild(tagEl);
  }
  card.appendChild(headerRow);

  // Pipeline indicator
  const pipeline = document.createElement('div');
  pipeline.className = 'pipeline';

  const phases = ['concept', 'model', 'render', 'pack'];
  for (let i = 0; i < phases.length; i++) {
    const p = phases[i];
    const phaseData = asset.pipeline?.[p];
    if (!phaseData && p === 'model') continue; // Skip model for non-3D

    if (i > 0 && !(p === 'model' && !phaseData)) {
      const arrow = document.createElement('span');
      arrow.className = 'pipeline-arrow';
      arrow.textContent = '→';
      pipeline.appendChild(arrow);
    }

    const phaseEl = document.createElement('span');
    phaseEl.className = `pipeline-phase ${phaseData?.status || 'pending'}`;
    const statusIcon = { done: '●', pending: '○', generating: '◐', error: '✗' };
    const label = p === 'pack' ? 'Pack' : p.charAt(0).toUpperCase() + p.slice(1);
    phaseEl.textContent = `${statusIcon[phaseData?.status] || '○'} ${label}`;
    if (phaseData?.frameCount) phaseEl.textContent += ` ${phaseData.frameCount}fr`;
    pipeline.appendChild(phaseEl);
  }
  card.appendChild(pipeline);

  // Preview row (concept + renders if available)
  const previewRow = document.createElement('div');
  previewRow.className = 'preview-row';

  if (asset.pipeline?.concept?.status === 'done') {
    const img = document.createElement('img');
    img.className = 'preview-thumb';
    img.src = `/api/visual-library/${id}/concept`;
    img.alt = 'Concept';
    previewRow.appendChild(img);
  }

  card.appendChild(previewRow);

  // Controls
  const controls = document.createElement('div');
  controls.className = 'controls';

  const promptLabel = document.createElement('label');
  promptLabel.textContent = 'Prompt';
  const promptInput = document.createElement('textarea');
  promptInput.rows = 2;
  promptInput.value = asset.prompt || '';
  promptInput.id = `vprompt-${id}`;
  controls.appendChild(promptLabel);
  controls.appendChild(promptInput);

  const row = document.createElement('div');
  row.className = 'controls-row';

  const posesLabel = document.createElement('label');
  posesLabel.textContent = 'Poses';
  const posesInput = document.createElement('input');
  posesInput.value = (asset.poses || []).join(', ');
  posesInput.id = `vposes-${id}`;
  posesLabel.appendChild(posesInput);
  row.appendChild(posesLabel);

  controls.appendChild(row);

  // Assignment info
  if (asset.assignedTo && Object.keys(asset.assignedTo).length > 0) {
    const assignInfo = document.createElement('div');
    assignInfo.className = 'assign-info';
    const assignments = Object.entries(asset.assignedTo)
      .map(([proj, info]) => `${proj}/${info.atlas} (synced ${timeAgo(info.syncedAt)})`)
      .join(', ');
    assignInfo.textContent = `Assigned: ${assignments}`;
    controls.appendChild(assignInfo);
  }

  card.appendChild(controls);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'card-actions';

  // Save metadata
  const saveBtn = document.createElement('button');
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', async () => {
    await fetchJSON(`/api/visual-library/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: document.getElementById(`vprompt-${id}`).value,
        poses: document.getElementById(`vposes-${id}`).value.split(',').map(s => s.trim()).filter(Boolean),
      }),
    });
    card.classList.add('save-flash');
    setTimeout(() => card.classList.remove('save-flash'), 600);
  });
  actions.appendChild(saveBtn);

  // Per-phase regen buttons
  for (const phase of ['concept', 'model', 'render', 'pack']) {
    if (phase === 'model' && !asset.pipeline?.model) continue;
    const btn = document.createElement('button');
    btn.textContent = `Regen ${phase.charAt(0).toUpperCase() + phase.slice(1)}`;
    btn.addEventListener('click', () => startVisualGeneration(id, phase));
    actions.appendChild(btn);
  }

  // Full pipeline
  const fullBtn = document.createElement('button');
  fullBtn.className = 'btn-primary';
  fullBtn.textContent = 'Full Pipeline';
  fullBtn.addEventListener('click', () => startVisualGeneration(id, 'full'));
  actions.appendChild(fullBtn);

  // Assign
  const assignBtn = document.createElement('button');
  assignBtn.textContent = 'Assign';
  assignBtn.addEventListener('click', async () => {
    const project = currentProject;
    await fetchJSON(`/api/visual-library/${id}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project, atlas: asset.category }),
    });
    card.classList.add('save-flash');
    setTimeout(() => card.classList.remove('save-flash'), 600);
  });
  actions.appendChild(assignBtn);

  // Delete
  const delBtn = document.createElement('button');
  delBtn.className = 'btn-danger';
  delBtn.textContent = 'Del';
  delBtn.addEventListener('click', async () => {
    if (!confirm(`Delete ${id}?`)) return;
    await fetchJSON(`/api/visual-library/${id}`, { method: 'DELETE' });
    await loadVisualData();
    renderVisualAssets();
  });
  actions.appendChild(delBtn);

  card.appendChild(actions);
  return card;
}
```

- [ ] **Step 7: Add visual generation SSE handler**

```javascript
async function startVisualGeneration(assetId, phase) {
  const logPanel = document.getElementById('regen-log');
  const logContent = document.getElementById('log-content');

  logPanel.hidden = false;
  logPanel.classList.remove('collapsed');

  appendLog(`Starting ${phase} generation for ${assetId}...`, 'dim');

  try {
    const res = await fetch(`/api/visual-library/${assetId}/generate/${phase}`, { method: 'POST' });

    if (res.status === 409) {
      appendLog('Visual generation already in progress', 'error');
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      let eventType = '';
      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.slice(7);
        } else if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
            if (eventType === 'progress') {
              appendLog(`[${data.phase}] ${data.status} ${data.asset}`, 'dim');
            } else if (eventType === 'done') {
              appendLog(`[${data.phase}] ✓ ${data.asset}${data.frameCount ? ` (${data.frameCount} frames)` : ''}`, '');
            } else if (eventType === 'error') {
              appendLog(`[${data.phase}] ✗ ${data.asset}: ${data.error}`, 'error');
            } else if (eventType === 'complete') {
              appendLog(`Pipeline complete for ${data.asset}`, 'success');
            }
          } catch { /* ignore */ }
        }
      }
    }
  } catch (err) {
    appendLog(err.message, 'error');
  }

  await loadVisualData();
  renderVisualAssets();
}

function timeAgo(isoString) {
  if (!isoString) return 'never';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
```

- [ ] **Step 8: Update loadProjectData to also load library + visual data**

Update the existing `loadProjectData()`:

```javascript
let libraryData = null;
let visualData = null;

async function loadProjectData() {
  projectData = await fetchJSON(`/api/projects/${currentProject}`);
  backends = await fetchJSON('/api/backends');
  libraryData = await fetchJSON('/api/library');
  visualData = await fetchJSON('/api/visual-library');
  await checkPrerequisites();
  renderSounds();
  if (activeTab === 'visual') renderVisualAssets();
}
```

- [ ] **Step 9: Wire sync button**

```javascript
document.getElementById('sync-btn').addEventListener('click', async () => {
  if (activeTab === 'audio') {
    const result = await fetchJSON(`/api/projects/${currentProject}/sync`, { method: 'POST' });
    appendLog(`Audio sync: ${result.count} sounds updated`, result.count > 0 ? 'success' : 'dim');
  } else {
    const result = await fetchJSON(`/api/projects/${currentProject}/sync-visual`, { method: 'POST' });
    appendLog(`Visual sync: ${result.count} assets updated`, result.count > 0 ? 'success' : 'dim');
  }
});
```

- [ ] **Step 10: Update renderSounds() to use #audio-container**

Change `const container = document.getElementById('sounds-container')` to `const container = document.getElementById('audio-container')` in the existing `renderSounds()` function.

- [ ] **Step 11: Verify UI loads**

Run: `cd Assetgenerator && node server.js --project arena`
Open: `http://localhost:5200`
Expected: Tab toggle visible, Audio tab shows existing sounds, Visual tab shows empty state.

- [ ] **Step 12: Commit**

```bash
git add Assetgenerator/index.html
git commit -m "feat(assetgenerator): add Audio + Visual tab UI with pipeline cards"
```

---

## Chunk 7: Arena Cleanup + CLAUDE.md Updates

### Task 13: Update arena.json project config

**Files:**
- Modify: `Assetgenerator/projects/arena.json` — add `deployScript` field

- [ ] **Step 1: Add deployScript to arena.json**

Add to the top-level object:
```json
"deployScript": "../../k8s/scripts/deploy/deploy-arena.sh"
```

- [ ] **Step 2: Commit**

```bash
git add Assetgenerator/projects/arena.json
git commit -m "feat(assetgenerator): add deployScript to arena project config"
```

### Task 14: Update CLAUDE.md files

**Files:**
- Modify: `/home/patrick/projects/CLAUDE.md` — add Assetgenerator to services table
- Modify: `/home/patrick/projects/arena/CLAUDE.md` — update Asset Pipeline section

- [ ] **Step 1: Add Assetgenerator to root CLAUDE.md services table**

Add to the table in the Repository Overview section:
```
| Assetgenerator | Express, Vanilla JS SPA | 5200 |
```

- [ ] **Step 2: Update arena CLAUDE.md asset pipeline section**

Update the "Asset Pipeline" section to note that generation scripts have moved:
- Scripts `generate_concepts.py`, `generate_3d.py`, `render_sprites.py`, `pack_sprites.ts`, `create_blender_templates.py`, `import_sprite_pack.ts` are now in `Assetgenerator/scripts/`
- Arena still has `generate_audio.py` and `process_audio.sh`
- Visual and audio assets are managed via the Assetgenerator UI and copied to arena on assignment
- Arena's `assets/manifest.json` still drives runtime asset loading

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md arena/CLAUDE.md
git commit -m "docs: update CLAUDE.md files for Assetgenerator library"
```

### Task 15: Verify end-to-end

- [ ] **Step 1: Start server**

```bash
cd Assetgenerator && node server.js --project arena
```

- [ ] **Step 2: Manual verification checklist**

Open `http://localhost:5200` and verify:

1. Tab toggle switches between Audio and Visual
2. Audio tab shows all arena sounds
3. Scan button works
4. Import button (needs to add to UI or test via curl):
   ```bash
   curl -X POST http://localhost:5200/api/library/import -H 'Content-Type: application/json' -d '{"project":"arena"}'
   ```
5. Visual import (test via curl):
   ```bash
   curl -X POST http://localhost:5200/api/visual-library/import -H 'Content-Type: application/json' -d '{"project":"arena"}'
   ```
6. Visual tab shows imported assets with pipeline indicators
7. Generation log panel works for both tabs
8. Sync button hits correct endpoint per tab

Note: Full pipeline generation requires NAS mount + GPU + Blender. The import and UI can be verified without these.

---

## Implementation Notes

### Files to create (10):
- `Assetgenerator/config/library-config.json`
- `Assetgenerator/config/visual-config.json`
- `Assetgenerator/library.json`
- `Assetgenerator/visual-library.json`
- `Assetgenerator/adapters/comfyui.js`
- `Assetgenerator/adapters/diffusers.js`
- `Assetgenerator/adapters/triposr.js`
- `Assetgenerator/adapters/meshy.js`
- `Assetgenerator/adapters/blender.js`
- `Assetgenerator/adapters/packer.js`
- `Assetgenerator/scripts/` (6 scripts copied from arena)

### Files to modify (4):
- `Assetgenerator/server.js` (major: ~400 lines of new routes)
- `Assetgenerator/index.html` (major: tab toggle, visual cards, ~300 lines new JS)
- `Assetgenerator/package.json` (add tsx dep)
- `Assetgenerator/projects/arena.json` (add deployScript)

### Files to update docs (2):
- `CLAUDE.md` (services table)
- `arena/CLAUDE.md` (asset pipeline section)

### Arena cleanup (deferred):
The spec mentions removing migrated scripts from arena. This should be done AFTER verifying the Assetgenerator versions work correctly. It's a separate commit:
```bash
git rm arena/scripts/generate_concepts.py arena/scripts/generate_3d.py arena/scripts/render_sprites.py arena/scripts/pack_sprites.ts arena/scripts/create_blender_templates.py arena/scripts/import_sprite_pack.ts arena/scripts/generate_all.sh
git commit -m "chore(arena): remove migrated pipeline scripts (now in Assetgenerator)"
```
