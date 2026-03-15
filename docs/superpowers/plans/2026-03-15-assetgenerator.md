# Assetgenerator Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local web-based audio review and regeneration tool that lets the developer listen to each arena sound, flag unfit ones, edit prompts, and regenerate flagged sounds via AudioCraft (local GPU) or ElevenLabs (API).

**Architecture:** Express server (`Assetgenerator/server.js`) serves a vanilla HTML/JS review UI on port 5200. State is persisted in `projects/arena.json`. Pluggable adapter pattern for generation backends. Integrates with existing `arena/scripts/generate_audio.py` and `process_audio.sh`. Runs locally only — needs direct GPU access for AudioCraft.

**Tech Stack:** Node.js, Express, vanilla HTML/CSS/JS, Web Audio API (waveform rendering), SSE (regeneration progress), Python (AudioCraft via existing script), ffmpeg.

**Spec:** `docs/superpowers/specs/2026-03-15-assetgenerator-audio-review-design.md`

**Security note:** This is a local-only developer tool (localhost:5200). All data comes from local JSON state files and the local filesystem. The UI uses DOM creation methods (`createElement`, `textContent`) instead of `innerHTML` to avoid XSS patterns. Shell commands use `execFileSync`/`spawn` with argument arrays (never string interpolation via `exec`).

---

## File Structure

### New files (Assetgenerator/)

| File | Responsibility |
|------|---------------|
| `Assetgenerator/package.json` | Dependencies (express, cors, open), scripts |
| `Assetgenerator/server.js` | Express server: API endpoints, static serving, SSE, prerequisites check |
| `Assetgenerator/index.html` | Single-page review UI: cards, waveforms, playback, flags, regeneration log |
| `Assetgenerator/config/backends.json` | Backend registry (audiocraft, elevenlabs) |
| `Assetgenerator/projects/arena.json` | Arena project config + per-sound state (created on first scan) |
| `Assetgenerator/adapters/audiocraft.js` | Adapter: spawns generate_audio.py with override flags |
| `Assetgenerator/adapters/elevenlabs.js` | Adapter: calls ElevenLabs API via generate_audio.py |

### Modified files

| File | Change |
|------|--------|
| `arena/scripts/generate_audio.py` | Add `--prompt`, `--seed`, `--duration`, `--force` flags; seed tracking; ElevenLabs WAV fix |
| `package.json` (root) | Add `dev:assetgenerator` script |

---

## Chunk 1: Foundation — State, Config, and generate_audio.py Extensions

### Task 1: Scaffold Assetgenerator project

**Files:**
- Create: `Assetgenerator/package.json`
- Create: `Assetgenerator/config/backends.json`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "assetgenerator",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "description": "Audio asset review and regeneration tool",
  "scripts": {
    "start": "node server.js --project arena",
    "dev": "node server.js --project arena"
  },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.21.0",
    "open": "^10.1.0"
  }
}
```

- [ ] **Step 2: Create backends.json**

```json
{
  "audiocraft": {
    "label": "AudioCraft (Local)",
    "enabled": true,
    "adapter": "audiocraft"
  },
  "elevenlabs": {
    "label": "ElevenLabs (API)",
    "enabled": true,
    "adapter": "elevenlabs",
    "requiresEnv": "ELEVENLABS_API_KEY"
  }
}
```

- [ ] **Step 3: Create projects directory with .gitkeep**

```bash
mkdir -p Assetgenerator/projects
touch Assetgenerator/projects/.gitkeep
```

- [ ] **Step 4: Install dependencies**

```bash
cd Assetgenerator && npm install
```

- [ ] **Step 5: Add root package.json script**

Add to root `package.json` scripts:
```json
"dev:assetgenerator": "cd Assetgenerator && node server.js --project arena"
```

- [ ] **Step 6: Commit**

```bash
git add Assetgenerator/package.json Assetgenerator/package-lock.json Assetgenerator/config/backends.json Assetgenerator/projects/.gitkeep package.json
git commit -m "feat(assetgenerator): scaffold project with config and dependencies"
```

---

### Task 2: Extend generate_audio.py with override flags

**Files:**
- Modify: `arena/scripts/generate_audio.py`

This task adds `--prompt`, `--seed`, `--duration`, and `--force` flags to the existing script. The existing `--id`, `--backend`, and `--type` flags are unchanged.

- [ ] **Step 1: Add new argparse flags**

In `main()`, after the existing `parser.add_argument("--id", ...)` line (line 219), add:

```python
parser.add_argument("--prompt", help="Override manifest prompt (requires --id)")
parser.add_argument("--seed", type=int, help="Random seed for reproducibility (requires --id)")
parser.add_argument("--duration", type=float, help="Override manifest duration in seconds (requires --id)")
parser.add_argument("--force", action="store_true", help="Regenerate even if file exists")
```

- [ ] **Step 2: Add seed application at the top of main(), after parsing args**

Add `import random` to the top-level import block (after line 24, `import time`). Then after `args = parser.parse_args()` (line 220), add:

```python
# Apply seed for reproducibility
if args.seed is not None:
    seed = args.seed
else:
    seed = random.randint(0, 2**31 - 1)

try:
    import torch
    torch.manual_seed(seed)
except ImportError:
    pass

if args.id:
    print(f"SEED:{seed}")
```

- [ ] **Step 3: Modify SFX generation loop to support overrides**

Replace the skip guard and prompt/duration lines in the SFX loop (lines 253-263 only — preserve the backend dispatch block at lines 265-276 unchanged):

```python
for sfx in sfx_list:
    if args.id and sfx["id"] != args.id:
        continue

    out_path = OUTPUT_SFX / f"{sfx['id']}.wav"
    if out_path.exists() and not args.force:
        print(f"  [SKIP] {sfx['id']}.wav — already exists")
        continue

    duration = args.duration if (args.duration and args.id) else sfx.get("duration", 1.0)
    prompt = args.prompt if (args.prompt and args.id) else sfx["prompt"]
    print(f"  [GEN] {sfx['id']} ({duration}s)")
```

- [ ] **Step 4: Apply same override pattern to music loop**

Replace the skip guard and prompt/duration lines in the music loop (lines 286-296 only — preserve the backend dispatch block at lines 298-306 unchanged):

```python
for track in music_list:
    if args.id and track["id"] != args.id:
        continue

    out_path = OUTPUT_MUSIC / f"{track['id']}.wav"
    if out_path.exists() and not args.force:
        print(f"  [SKIP] {track['id']}.wav — already exists")
        continue

    duration = args.duration if (args.duration and args.id) else track.get("duration", 30)
    prompt = args.prompt if (args.prompt and args.id) else track["prompt"]
    print(f"  [GEN] {track['id']} ({duration}s)")
```

- [ ] **Step 5: Fix ElevenLabs WAV conversion**

Replace `elevenlabs_generate_sfx` function body (lines 168-193). After receiving API response, convert MP3 to WAV via ffmpeg subprocess instead of writing raw bytes:

```python
def elevenlabs_generate_sfx(prompt: str, duration: float, output_path: Path) -> bool:
    """Generate SFX using ElevenLabs Sound Effects API."""
    import subprocess
    import tempfile

    api_key = os.environ.get("ELEVENLABS_API_KEY", "")

    payload = json.dumps({
        "text": prompt,
        "duration_seconds": duration,
    }).encode()

    req = urllib.request.Request(
        "https://api.elevenlabs.io/v1/sound-generation",
        data=payload,
        headers={
            "xi-api-key": api_key,
            "Content-Type": "application/json",
        },
    )

    try:
        resp = urllib.request.urlopen(req, timeout=60)
        audio_data = resp.read()

        # ElevenLabs returns MP3 — convert to WAV for consistency
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp:
            tmp.write(audio_data)
            tmp_path = tmp.name

        result = subprocess.run(
            ["ffmpeg", "-y", "-i", tmp_path, "-ar", str(SAMPLE_RATE), "-ac", "1", str(output_path)],
            capture_output=True, text=True
        )
        os.unlink(tmp_path)

        if result.returncode != 0:
            print(f"  [ERROR] ffmpeg conversion failed: {result.stderr}")
            return False
        return True
    except Exception as e:
        print(f"  [ERROR] ElevenLabs SFX failed: {e}")
        return False
```

- [ ] **Step 6: Test the new flags manually**

```bash
cd arena && python3 scripts/generate_audio.py --id gunshot --backend placeholder --force --prompt "test sound" --seed 123 --duration 0.5
```

Expected: prints `SEED:123`, generates `assets/audio/sfx/gunshot.wav` (silent placeholder), no skip.

- [ ] **Step 7: Commit**

```bash
git add arena/scripts/generate_audio.py
git commit -m "feat(arena): add prompt/seed/duration/force override flags to generate_audio.py

Enables single-sound regeneration with custom parameters for the
Assetgenerator review tool. Also fixes ElevenLabs MP3-as-WAV bug."
```

---

### Task 3: AudioCraft adapter

**Files:**
- Create: `Assetgenerator/adapters/audiocraft.js`

- [ ] **Step 1: Create the adapter**

The adapter spawns the project's `generate_audio.py` as a child process using `spawn` (not `exec`) with explicit argument array to avoid shell injection. It captures the `SEED:<n>` line from stdout.

```js
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * AudioCraft adapter — spawns the project's generate_audio.py with override flags.
 * Captures SEED:<n> from stdout for state tracking.
 */
export async function generate({ id, type, prompt, seed, duration, projectConfig }) {
  const scriptPath = resolve(projectConfig._basePath, projectConfig.generateScript);
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
    const proc = spawn('python3', args, {
      cwd: resolve(projectConfig._basePath, '..', 'arena'),
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
```

- [ ] **Step 2: Commit**

```bash
git add Assetgenerator/adapters/audiocraft.js
git commit -m "feat(assetgenerator): add AudioCraft adapter for generate_audio.py"
```

---

### Task 4: ElevenLabs adapter

**Files:**
- Create: `Assetgenerator/adapters/elevenlabs.js`

- [ ] **Step 1: Create the adapter**

Uses the same `spawn` pattern as AudioCraft but passes `--backend elevenlabs`. The WAV conversion fix is in the Python script itself.

```js
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * ElevenLabs adapter — spawns the project's generate_audio.py with elevenlabs backend.
 * The WAV conversion fix is handled in the Python script.
 */
export async function generate({ id, type, prompt, seed, duration, projectConfig }) {
  const scriptPath = resolve(projectConfig._basePath, projectConfig.generateScript);
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
    const proc = spawn('python3', args, {
      cwd: resolve(projectConfig._basePath, '..', 'arena'),
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

      const seedMatch = stdout.match(/SEED:(\d+)/);
      const actualSeed = seedMatch ? parseInt(seedMatch[1], 10) : seed;

      resolvePromise({ seed: actualSeed, stdout, stderr });
    });
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add Assetgenerator/adapters/elevenlabs.js
git commit -m "feat(assetgenerator): add ElevenLabs adapter"
```

---

## Chunk 2: Express Server — API Endpoints

### Task 5: Server core with project loading and scanning

**Files:**
- Create: `Assetgenerator/server.js`

This is the largest single file. It handles: CLI args, prerequisites check, project state management, scanning, and all API endpoints. Uses `execFileSync` with argument arrays (never `exec` with string interpolation) for shell safety.

- [ ] **Step 1: Create server.js with imports, CLI parsing, and prerequisites check**

```js
import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(cors());
app.use(express.json());

const PORT = 5200;

// CLI args
const cliArgs = process.argv.slice(2);
const projectFlagIdx = cliArgs.indexOf('--project');
const defaultProject = projectFlagIdx !== -1 ? cliArgs[projectFlagIdx + 1] : null;

// Prerequisites check
const prerequisites = { python: false, ffmpeg: false, cuda: false };

function checkPrerequisites() {
  try {
    execFileSync('python3', ['--version'], { stdio: 'pipe' });
    prerequisites.python = true;
    try {
      const result = execFileSync('python3', ['-c', 'import torch; print(torch.cuda.is_available())'], { stdio: 'pipe' });
      prerequisites.cuda = result.toString().trim() === 'True';
    } catch { prerequisites.cuda = false; }
  } catch { prerequisites.python = false; }

  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'pipe' });
    prerequisites.ffmpeg = true;
  } catch { prerequisites.ffmpeg = false; }
}

checkPrerequisites();
```

- [ ] **Step 2: Add project state management functions**

```js
const PROJECTS_DIR = join(__dirname, 'projects');
const BACKENDS_PATH = join(__dirname, 'config', 'backends.json');

function loadBackends() {
  return JSON.parse(readFileSync(BACKENDS_PATH, 'utf-8'));
}

function saveBackends(data) {
  writeFileSync(BACKENDS_PATH, JSON.stringify(data, null, 2));
}

function listProjects() {
  return readdirSync(PROJECTS_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

function loadProject(name) {
  const filePath = join(PROJECTS_DIR, `${name}.json`);
  if (!existsSync(filePath)) return null;
  const project = JSON.parse(readFileSync(filePath, 'utf-8'));
  project._basePath = __dirname;
  return project;
}

function saveProject(project) {
  const name = project.name;
  const toSave = { ...project };
  delete toSave._basePath;
  // Strip transient computed fields from each sound entry
  if (toSave.sounds) {
    for (const sound of Object.values(toSave.sounds)) {
      delete sound._fileSize;
      delete sound._fileDuration;
    }
  }
  writeFileSync(join(PROJECTS_DIR, `${name}.json`), JSON.stringify(toSave, null, 2));
}
```

- [ ] **Step 3: Add scan function**

Uses `execFileSync('ffprobe', [...args])` with explicit argument array for safe subprocess execution.

```js
function getAudioDuration(audioFilePath) {
  try {
    const result = execFileSync(
      'ffprobe',
      ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', audioFilePath],
      { stdio: 'pipe' }
    );
    return parseFloat(result.toString().trim());
  } catch {
    return null;
  }
}

function getFileSize(filePath) {
  try { return statSync(filePath).size; } catch { return 0; }
}

function scanProject(project) {
  const audioRoot = resolve(__dirname, project.audioRoot);
  if (!existsSync(audioRoot)) return project;

  // Load manifest for prompt pre-fill
  let manifestSfx = [];
  let manifestMusic = [];
  if (project.manifestPath) {
    try {
      const manifest = JSON.parse(readFileSync(resolve(__dirname, project.manifestPath), 'utf-8'));
      manifestSfx = manifest.sfx || [];
      manifestMusic = manifest.music || [];
    } catch { /* no manifest */ }
  }

  const manifestMap = {};
  for (const s of manifestSfx) manifestMap[s.id] = { ...s, type: 'sfx' };
  for (const m of manifestMusic) manifestMap[m.id] = { ...m, type: 'music' };

  if (!project.sounds) project.sounds = {};

  for (const type of ['sfx', 'music']) {
    const dir = join(audioRoot, type);
    if (!existsSync(dir)) continue;

    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.wav')) continue;
      const id = file.replace('.wav', '');
      const relPath = `${type}/${file}`;
      const fullPath = join(audioRoot, relPath);

      if (project.sounds[id]) {
        project.sounds[id].filePath = relPath;
        project.sounds[id]._fileSize = getFileSize(fullPath);
        project.sounds[id]._fileDuration = getAudioDuration(fullPath);
        continue;
      }

      const manifestEntry = manifestMap[id];
      project.sounds[id] = {
        type,
        prompt: manifestEntry?.prompt || '',
        seed: null,
        duration: manifestEntry?.duration || getAudioDuration(fullPath) || 1.0,
        backend: 'default',
        flagged: false,
        lastGeneratedAt: null,
        filePath: relPath,
        _fileSize: getFileSize(fullPath),
        _fileDuration: getAudioDuration(fullPath),
      };
      if (type === 'music' && manifestEntry?.loop !== undefined) {
        project.sounds[id].loop = manifestEntry.loop;
      }
    }
  }

  saveProject(project);
  return project;
}
```

- [ ] **Step 4: Add API routes for projects, sounds, and backends**

```js
// Prerequisites
app.get('/api/prerequisites', (req, res) => res.json(prerequisites));

// Backends
app.get('/api/backends', (req, res) => res.json(loadBackends()));

app.post('/api/backends', (req, res) => {
  const { id, label, adapter, requiresEnv } = req.body;
  if (!id || !label || !adapter) return res.status(400).json({ error: 'id, label, adapter required' });
  const backends = loadBackends();
  backends[id] = { label, enabled: true, adapter, ...(requiresEnv && { requiresEnv }) };
  saveBackends(backends);
  res.json(backends);
});

// Projects
app.get('/api/projects', (req, res) => res.json(listProjects()));

app.get('/api/projects/:name', (req, res) => {
  const project = loadProject(req.params.name);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
});

app.post('/api/projects', (req, res) => {
  const { name, audioRoot, outputRoot, processScript, generateScript, manifestPath } = req.body;
  if (!name || !audioRoot) return res.status(400).json({ error: 'name and audioRoot required' });
  const project = { name, audioRoot, outputRoot, processScript, generateScript, manifestPath, sounds: {} };
  saveProject(project);
  res.json(project);
});

// Scan
app.post('/api/projects/:name/scan', (req, res) => {
  const project = loadProject(req.params.name);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(scanProject(project));
});

// Sounds
app.put('/api/projects/:name/sounds/:id', (req, res) => {
  const project = loadProject(req.params.name);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (!project.sounds[req.params.id]) return res.status(404).json({ error: 'Sound not found' });
  const allowed = ['prompt', 'seed', 'duration', 'backend', 'flagged'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) project.sounds[req.params.id][key] = req.body[key];
  }
  saveProject(project);
  res.json(project.sounds[req.params.id]);
});

// Audio streaming
app.get('/api/projects/:name/sounds/:id/audio', (req, res) => {
  const project = loadProject(req.params.name);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const sound = project.sounds[req.params.id];
  if (!sound) return res.status(404).json({ error: 'Sound not found' });
  const audioRoot = resolve(__dirname, project.audioRoot);
  const audioFilePath = join(audioRoot, sound.filePath);
  if (!existsSync(audioFilePath)) return res.status(404).json({ error: 'Audio file not found' });
  res.sendFile(audioFilePath);
});
```

- [ ] **Step 5: Add regeneration endpoint with SSE and concurrency guard**

Uses `execFileSync('bash', [processPath, '--type', sound.type])` for safe process script invocation. Adapter loading uses dynamic `import()`.

```js
let regenerationInProgress = false;

app.post('/api/projects/:name/regenerate', async (req, res) => {
  if (regenerationInProgress) return res.status(409).json({ error: 'Regeneration already in progress' });

  const project = loadProject(req.params.name);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const flagged = Object.entries(project.sounds).filter(([, s]) => s.flagged);
  if (flagged.length === 0) return res.status(400).json({ error: 'No flagged sounds' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  regenerationInProgress = true;
  const backends = loadBackends();
  let succeeded = 0;
  let failed = 0;

  for (let i = 0; i < flagged.length; i++) {
    const [id, sound] = flagged[i];
    const backendKey = sound.backend === 'default' ? 'audiocraft' : sound.backend;
    const index = i + 1;
    const total = flagged.length;

    res.write(`event: progress\ndata: ${JSON.stringify({ sound: id, status: 'generating', backend: backendKey, index, total })}\n\n`);

    try {
      const adapterName = backends[backendKey]?.adapter || backendKey;
      const adapterPath = join(__dirname, 'adapters', `${adapterName}.js`);
      const adapter = await import(adapterPath);

      const audioRoot = resolve(__dirname, project.audioRoot);
      const outputPath = join(audioRoot, sound.filePath);

      const result = await adapter.generate({
        id, type: sound.type, prompt: sound.prompt,
        seed: sound.seed, duration: sound.duration,
        outputPath, projectConfig: project,
      });

      // Delete existing OGG/MP3 to clear process_audio.sh skip-guard
      if (project.outputRoot) {
        const outputRoot = resolve(__dirname, project.outputRoot);
        for (const ext of ['.ogg', '.mp3']) {
          const outFile = join(outputRoot, sound.type, id + ext);
          if (existsSync(outFile)) unlinkSync(outFile);
        }
      }

      res.write(`event: progress\ndata: ${JSON.stringify({ sound: id, status: 'processing', index, total })}\n\n`);

      if (project.processScript) {
        const processPath = resolve(__dirname, project.processScript);
        try {
          execFileSync('bash', [processPath, '--type', sound.type], { stdio: 'pipe', timeout: 120000 });
        } catch (procErr) {
          console.error(`process_audio.sh warning: ${procErr.message}`);
        }
      }

      // Update state
      const updatedProject = loadProject(project.name);
      updatedProject.sounds[id].seed = result.seed;
      updatedProject.sounds[id].lastGeneratedAt = new Date().toISOString();
      updatedProject.sounds[id].flagged = false;
      saveProject(updatedProject);

      succeeded++;
      res.write(`event: done\ndata: ${JSON.stringify({ sound: id, seed: result.seed, duration: sound.duration, index, total })}\n\n`);
    } catch (err) {
      failed++;
      res.write(`event: error\ndata: ${JSON.stringify({ sound: id, error: err.message, index, total })}\n\n`);
    }
  }

  res.write(`event: complete\ndata: ${JSON.stringify({ total: flagged.length, succeeded, failed })}\n\n`);
  res.end();
  regenerationInProgress = false;
});
```

- [ ] **Step 6: Add static serving and startup**

```js
app.use(express.static(__dirname));

app.listen(PORT, async () => {
  console.log(`\n  Assetgenerator running at http://localhost:${PORT}`);
  console.log(`  Prerequisites: python=${prerequisites.python} ffmpeg=${prerequisites.ffmpeg} cuda=${prerequisites.cuda}\n`);

  if (defaultProject) {
    const project = loadProject(defaultProject);
    if (project) {
      console.log(`  Auto-scanning project: ${defaultProject}`);
      scanProject(project);
    } else {
      console.log(`  Warning: project "${defaultProject}" not found in projects/`);
    }
  }

  try {
    const openModule = await import('open');
    openModule.default(`http://localhost:${PORT}`);
  } catch { /* silent */ }
});
```

- [ ] **Step 7: Test server starts**

```bash
cd Assetgenerator && node server.js --project arena
```

Expected: Server starts on 5200, prints prerequisites, auto-scans arena audio files, opens browser.

- [ ] **Step 8: Commit**

```bash
git add Assetgenerator/server.js
git commit -m "feat(assetgenerator): add Express server with full API, SSE regeneration, project scanning"
```

---

## Chunk 3: Review UI

### Task 6: Create the review UI (index.html)

**Files:**
- Create: `Assetgenerator/index.html`

Single self-contained HTML file with inline CSS and JS. Uses DOM creation methods (`createElement`, `textContent`, `appendChild`) instead of `innerHTML` to avoid XSS patterns — even though this is a local-only tool with trusted data.

- [ ] **Step 1: Create index.html with HTML structure and CSS**

HTML structure:
- Header bar: title, project `<select>`, Scan button, Regenerate button
- Prerequisites warning `<div>` (hidden when all ok)
- Filter button row: All / SFX / Music / Flagged Only
- `<div id="sounds-container">` — cards inserted here via DOM
- Regeneration log panel: collapsible `<div>` at bottom with monospace output

CSS: Dark theme — `#0f0f1a` background, `#00f2ff` cyan accents, `#1a1a2e` card background, `#2a2a4e` borders. Flagged cards: `#ff6b35` orange border. Cards use flexbox layout, rounded corners, padding. Waveform canvas: 500x60px. Log panel: fixed bottom, monospace font, scrollable, max-height 200px.

- [ ] **Step 2: Add JavaScript — state management and API calls**

Core state variables and fetch wrapper. All API calls go through `fetchJSON()` which throws on non-OK responses.

Functions: `loadProjects()`, `loadProjectData()`, `checkPrerequisites()`, `scanProject()`, `saveSound(id, fields)`.

- [ ] **Step 3: Add JavaScript — waveform rendering and audio playback**

Uses Web Audio API `decodeAudioData` to draw waveform on canvas. No external library. Stores decoded `AudioBuffer` on the canvas element for playback. Play/stop toggle per sound using `AudioBufferSourceNode`.

Functions: `renderWaveform(canvas, soundId)`, `playSound(canvas, soundId)`.

Error handling: if audio fails to load, draw "Failed to load audio" text on canvas in orange.

- [ ] **Step 4: Add JavaScript — card rendering using DOM creation**

Build each card using `document.createElement()` and `textContent` assignments. No `innerHTML` with interpolated data.

Helper function `createCard(id, sound)` returns a DOM element:
1. Create outer `div.card` (add `.flagged` class if flagged)
2. Create header row: sound name (`span.sound-name`), type badge, loop badge (music only), file info, flagged badge
3. Create waveform row: play `button` + `canvas` element (width=500, height=60)
4. Create controls: prompt `textarea`, duration/seed `input[type=number]`, backend `select` populated from `backends` object
5. Create actions row: Save `button` + Flag `button`
6. Wire event listeners directly on the DOM elements

`renderSounds()` clears container, creates section headers (`h2`), creates and appends cards, then calls `renderWaveform()` for each canvas.

`handleSave(id)` reads values from the card's input elements, calls `saveSound()`, flashes green border.

`handleFlag(id, newState)` calls `saveSound()` with `{ flagged: newState }`, reloads data.

- [ ] **Step 5: Add JavaScript — regeneration with SSE stream reader and event wiring**

Uses `fetch()` with `res.body.getReader()` to read the SSE stream from the POST endpoint (can't use `EventSource` since it only supports GET).

`startRegeneration()`:
1. Show log panel, disable Regenerate button
2. `fetch('/api/projects/.../regenerate', { method: 'POST' })`
3. Handle 409 (already running) and 400 (no flagged) before reading stream
4. Read stream with `TextDecoder`, parse SSE `event:` / `data:` lines
5. For each event, call `handleSSEEvent(type, data)`
6. On stream end, re-enable button, call `loadProjectData()` to refresh all cards

`handleSSEEvent(type, data)` appends a `<div>` to the log panel using `createElement` and `textContent`:
- `progress` → `[1/3] generating gunshot via audiocraft`
- `done` → `OK gunshot (seed: 42, 0.8s)`
- `error` → `FAIL melee_swing: AudioCraft CUDA OOM` (styled red)
- `complete` → `Complete: 2 ok, 1 failed`

Event wiring at bottom of script:
- `project-select` change → `loadProjectData()`
- `scan-btn` click → `scanProject()`
- `regen-btn` click → `startRegeneration()`
- `log-toggle` click → toggle log content visibility
- Filter buttons → set `activeFilter`, call `renderSounds()`
- Init: `loadProjects()` on DOMContentLoaded

- [ ] **Step 6: Test the full UI end-to-end**

```bash
cd Assetgenerator && node server.js --project arena
```

Open `http://localhost:5200` in browser. Verify:
1. Project dropdown shows "arena"
2. Sound cards appear with waveforms after scan
3. Play buttons work
4. Prompt/duration/seed/backend fields are editable
5. Save button confirms with green border flash
6. Flag/unflag toggles card highlight
7. Filter tabs work (All/SFX/Music/Flagged)

- [ ] **Step 7: Commit**

```bash
git add Assetgenerator/index.html
git commit -m "feat(assetgenerator): add review UI with waveform playback, editing, and SSE regeneration log"
```

---

## Chunk 4: Arena Project Config and Integration

### Task 7: Create arena project config

**Files:**
- Create: `Assetgenerator/projects/arena.json`

- [ ] **Step 1: Create the initial arena config**

```json
{
  "name": "arena",
  "audioRoot": "../arena/assets/audio",
  "outputRoot": "../arena/frontend/public/assets",
  "processScript": "../arena/scripts/process_audio.sh",
  "generateScript": "../arena/scripts/generate_audio.py",
  "manifestPath": "../arena/assets/manifest.json",
  "sounds": {}
}
```

The `sounds` object will be populated on first scan from the WAV files + manifest prompts.

- [ ] **Step 2: Commit**

```bash
git add Assetgenerator/projects/arena.json
git commit -m "feat(assetgenerator): add arena project config"
```

---

### Task 8: Full integration test

- [ ] **Step 1: Start the server and verify the full flow**

```bash
cd Assetgenerator && node server.js --project arena
```

1. Verify auto-scan populates `projects/arena.json` with all 17 SFX + 4-5 music entries
2. Verify prompts are pre-filled from `arena/assets/manifest.json`
3. Verify durations are detected via ffprobe
4. Flag one sound (e.g., `gunshot`)
5. Click Regenerate — verify SSE log streams progress, processes, completes
6. Verify the flagged sound is now unflagged in state
7. Verify the regenerated WAV file was reprocessed to OGG/MP3

- [ ] **Step 2: Commit the populated state file**

```bash
git add Assetgenerator/projects/arena.json
git commit -m "feat(assetgenerator): populate arena project with scanned audio state"
```

---

### Task 9: Final cleanup and docs

- [ ] **Step 1: Verify root package.json has the dev:assetgenerator script**

Should already be there from Task 1. Verify:

```bash
npm run dev:assetgenerator
```

- [ ] **Step 2: Update arena CLAUDE.md with Assetgenerator reference**

Add to the Asset Pipeline section of `arena/CLAUDE.md`, after the existing audio generation docs:

```markdown
#### Audio Review Tool

The Assetgenerator (`Assetgenerator/`) provides a web UI for reviewing and regenerating audio assets:

\`\`\`bash
npm run dev:assetgenerator    # Opens http://localhost:5200
\`\`\`

- Listen to each sound, edit prompts, flag for regeneration
- Supports AudioCraft (local GPU) and ElevenLabs (API) backends
- State persisted in `Assetgenerator/projects/arena.json`
```

- [ ] **Step 3: Final commit**

```bash
git add arena/CLAUDE.md package.json
git commit -m "docs: add Assetgenerator references to arena CLAUDE.md and root scripts"
```
