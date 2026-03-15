import express from 'express';
import cors from 'cors';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, unlinkSync, copyFileSync, mkdirSync } from 'node:fs';
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
const prerequisites = { python: false, ffmpeg: false, cuda: false, pythonPath: 'python3' };

function checkPrerequisites(projectPythonPath) {
  // Use project's venv python if available, fall back to system python3
  const pythonCandidates = projectPythonPath
    ? [projectPythonPath, 'python3']
    : ['python3'];

  for (const py of pythonCandidates) {
    try {
      execFileSync(py, ['--version'], { stdio: 'pipe' });
      prerequisites.python = true;
      prerequisites.pythonPath = py;
      try {
        const result = execFileSync(py, ['-c', 'import torch; print(torch.cuda.is_available())'], { stdio: 'pipe' });
        prerequisites.cuda = result.toString().trim() === 'True';
      } catch { prerequisites.cuda = false; }
      break;
    } catch { /* try next candidate */ }
  }

  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'pipe' });
    prerequisites.ffmpeg = true;
  } catch { prerequisites.ffmpeg = false; }
}

// Initial check with system python (will re-check with project venv on scan)
checkPrerequisites();

// =============================================================================
// Project state management
// =============================================================================

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

function processAudioFile(wavPath, outputDir, id, type) {
  const config = loadLibraryConfig();
  const lufs = type.startsWith('music') ? config.loudness.music : config.loudness.sfx;
  const af = `silenceremove=start_periods=1:start_silence=0.1:start_threshold=-50dB,loudnorm=I=${lufs}:TP=-1.5:LRA=11`;

  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const baseName = id;
  const oggPath = join(outputDir, `${baseName}.ogg`);
  execFileSync('ffmpeg', [
    '-y', '-i', wavPath,
    '-af', af,
    '-ar', '44100', '-ac', '1',
    '-c:a', 'libopus', '-b:a', '96k',
    oggPath
  ], { stdio: 'pipe' });

  const mp3Path = join(outputDir, `${baseName}.mp3`);
  execFileSync('ffmpeg', [
    '-y', '-i', wavPath,
    '-af', af,
    '-ar', '44100', '-ac', '1',
    '-c:a', 'libmp3lame', '-b:a', '128k',
    mp3Path
  ], { stdio: 'pipe' });

  return { oggPath, mp3Path };
}

// =============================================================================
// Scan
// =============================================================================

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

// =============================================================================
// API Routes
// =============================================================================

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

// =============================================================================
// Regeneration with SSE
// =============================================================================

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

// =============================================================================
// Audio Library Routes
// =============================================================================

app.get('/api/library', (req, res) => {
  res.json(loadLibrary());
});

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

app.post('/api/library', (req, res) => {
  const { id, name, category, tags, prompt, seed, duration, backend } = req.body;
  if (!id || !name || !category) return res.status(400).json({ error: 'id, name, category required' });
  const library = loadLibrary();
  if (library.sounds[id]) return res.status(409).json({ error: 'Sound already exists' });
  library.sounds[id] = {
    id, name, category,
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

app.delete('/api/library/:id', (req, res) => {
  const library = loadLibrary();
  const sound = library.sounds[req.params.id];
  if (!sound) return res.status(404).json({ error: 'Sound not found' });
  const config = loadLibraryConfig();
  const basePath = join(config.libraryRoot, sound.filePath.replace(/\.wav$/, ''));
  for (const ext of ['.wav', '.ogg', '.mp3']) {
    const f = basePath + ext;
    if (existsSync(f)) unlinkSync(f);
  }
  delete library.sounds[req.params.id];
  saveLibrary(library);
  res.json({ deleted: req.params.id });
});

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
      processAudioFile(wavPath, nasDir, sound.id, sound.category);
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
    if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
    copyFileSync(src, dest);
  }

  if (!sound.assignedTo) sound.assignedTo = {};
  sound.assignedTo[project] = { targetPath, syncedAt: new Date().toISOString() };
  saveLibrary(library);
  res.json(sound);
});

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

app.post('/api/projects/:name/sync', (req, res) => {
  const project = loadProject(req.params.name);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const library = loadLibrary();
  const config = loadLibraryConfig();
  const synced = [];
  for (const [id, sound] of Object.entries(library.sounds)) {
    const assignment = sound.assignedTo?.[req.params.name];
    if (!assignment) continue;
    if (sound.createdAt && assignment.syncedAt && new Date(sound.createdAt) <= new Date(assignment.syncedAt)) continue;
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

let audioGenerationInProgress = false;

app.post('/api/library/:id/generate', async (req, res) => {
  if (audioGenerationInProgress) return res.status(409).json({ error: 'Audio generation in progress' });
  const library = loadLibrary();
  const sound = library.sounds[req.params.id];
  if (!sound) return res.status(404).json({ error: 'Sound not found' });
  const config = loadLibraryConfig();
  audioGenerationInProgress = true;

  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });

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

    res.write(`event: progress\ndata: ${JSON.stringify({ sound: req.params.id, status: 'processing' })}\n\n`);
    processAudioFile(wavPath, wavDir, req.params.id, sound.category);

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

app.post('/api/library/import', (req, res) => {
  const { project } = req.body;
  if (!project) return res.status(400).json({ error: 'project required' });
  const proj = loadProject(project);
  if (!proj) return res.status(404).json({ error: `Project ${project} not found` });
  const library = loadLibrary();
  const config = loadLibraryConfig();
  const imported = [];

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
    if (library.sounds[id]) continue;
    const category = subcategoryMap[id] || (sound.type === 'music' ? 'music/ambient' : 'sfx/ui');
    const wavSrc = join(audioRoot, sound.filePath);

    if (existsSync(wavSrc)) {
      const nasDir = join(config.libraryRoot, category);
      if (!existsSync(nasDir)) mkdirSync(nasDir, { recursive: true });
      copyFileSync(wavSrc, join(nasDir, `${id}.wav`));

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
          [project]: { targetPath: `${sound.type}/${id}`, syncedAt: new Date().toISOString() },
        },
      };
      imported.push(id);
    }
  }

  saveLibrary(library);
  res.json({ imported, count: imported.length });
});

// =============================================================================
// Static serving & startup
// =============================================================================

app.use(express.static(__dirname));

app.listen(PORT, async () => {
  console.log(`\n  Assetgenerator running at http://localhost:${PORT}`);
  console.log(`  Prerequisites: python=${prerequisites.python} ffmpeg=${prerequisites.ffmpeg} cuda=${prerequisites.cuda}\n`);

  if (defaultProject) {
    const project = loadProject(defaultProject);
    if (project) {
      // Re-check prerequisites with project's venv python
      if (project.pythonPath) {
        const resolvedPy = resolve(__dirname, project.pythonPath);
        checkPrerequisites(resolvedPy);
        console.log(`  Prerequisites (with venv): python=${prerequisites.python} ffmpeg=${prerequisites.ffmpeg} cuda=${prerequisites.cuda}`);
        console.log(`  Python: ${prerequisites.pythonPath}`);
      }
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
