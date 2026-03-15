# Assetgenerator: Audio Review & Recreation Service

**Date**: 2026-03-15
**Status**: Approved
**Project**: Assetgenerator (new top-level service in monorepo)

## Summary

A standalone web-based service for reviewing, flagging, and regenerating audio assets across projects. Provides a browser UI for listening to sounds, editing generation prompts, and triggering regeneration via pluggable backends (AudioCraft local AI, ElevenLabs API, extensible).

## Problem

The current audio pipeline (`generate_audio.py` → `process_audio.sh`) generates all sounds in bulk with no human review gate. There's no way to:
- Listen to each sound and flag ones that need improvement
- Edit the generation prompt per sound and iterate
- Track which prompt/seed produced which output
- Choose different generation backends per sound

## Architecture

### Service Overview

```
Assetgenerator/          # New top-level monorepo project
├── package.json         # express, cors, open
├── server.js            # Express server (API + static serving), port 5200
├── index.html           # Single-page review UI (vanilla HTML/CSS/JS)
├── config/
│   └── backends.json    # Backend registry (extensible)
├── projects/            # Per-project state files
│   └── arena.json       # Arena audio state (prompts, seeds, flags, settings)
└── adapters/
    ├── audiocraft.js    # Adapter: spawns project's generate_audio.py
    └── elevenlabs.js    # Adapter: calls ElevenLabs SFX API directly
```

### Data Flow

```
                    ┌──────────────┐
                    │  Review UI   │  project selector in top bar
                    │  (browser)   │
                    └──────┬───────┘
                           │ HTTP / SSE
                    ┌──────▼───────┐
                    │ Assetgenerator│ port 5200
                    │   (Express)  │
                    └──┬───┬───┬───┘
                       │   │   │
          ┌────────────┘   │   └────────────┐
          ▼                ▼                 ▼
  projects/<name>.json  adapters/        target project
  (state per project)   (pluggable       (WAV files,
                         backends)        process scripts)
```

## Project Config (`projects/arena.json`)

Each project has a state file that stores both configuration and per-sound metadata:

```json
{
  "name": "arena",
  "audioRoot": "../arena/assets/audio",
  "outputRoot": "../arena/frontend/public/assets",
  "processScript": "../arena/scripts/process_audio.sh",
  "generateScript": "../arena/scripts/generate_audio.py",
  "manifestPath": "../arena/assets/manifest.json",
  "sounds": {
    "gunshot": {
      "type": "sfx",
      "prompt": "heavy metallic gunshot, close range, reverberant",
      "seed": 42,
      "duration": 0.8,
      "backend": "default",
      "flagged": false,
      "lastGeneratedAt": "2026-03-10T12:00:00Z",
      "filePath": "sfx/gunshot.wav"
    },
    "lobby": {
      "type": "music",
      "prompt": "dark ambient electronic battle royale lobby, tense, looping",
      "seed": 1337,
      "duration": 60,
      "loop": true,
      "backend": "default",
      "flagged": true,
      "lastGeneratedAt": "2026-03-08T09:00:00Z",
      "filePath": "music/lobby.wav"
    }
  }
}
```

- `backend: "default"` resolves to AudioCraft (local AI)
- `flagged: true` means queued for regeneration on next run
- `seed` is recorded after each generation for reproducibility
- `duration` is auto-detected from the file via ffprobe on first scan, editable in UI
- `prompt` is pre-filled from the project's manifest on first scan, editable in UI
- `filePath` is relative to `audioRoot` and always includes the type subdirectory prefix (e.g., `sfx/gunshot.wav`, `music/lobby.wav`)
- `loop` is imported from the manifest's `music[].loop` field during scan. It is metadata only — the Assetgenerator does not use it for generation, but preserves it so the state file is a complete record of each sound's properties. Displayed read-only in the UI card for music entries

## Backend Registry (`config/backends.json`)

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

Adding a new backend:
1. Add entry to `backends.json`
2. Create `adapters/<name>.js` implementing the adapter interface
3. UI dropdown auto-populates

## Adapter Interface

Each adapter exports a single `generate` function:

```js
export async function generate({ prompt, seed, duration, outputPath, projectConfig }) {
  // Generate audio, write to outputPath
  // Return { seed: <actualSeed>, filePath: <writtenPath> }
}
```

### AudioCraft Adapter
- Spawns the project's `generateScript` with flags: `--id <id> --prompt "..." --seed <n> --duration <d> --backend audiocraft --force`
- The `--id` flag matches the existing CLI argument in `generate_audio.py`
- The `--force` flag is new — bypasses the "skip if exists" guard so regeneration replaces the current file
- The `--prompt` flag overrides the manifest prompt; `--seed` calls `torch.manual_seed(seed)` before generation; `--duration` overrides the manifest duration
- When no seed is provided, the adapter generates a random seed, calls `torch.manual_seed()` with it, and returns it so the state file records what was used
- Falls back to local AudioCraft if no project-specific script exists

### ElevenLabs Adapter
- Calls `POST https://api.elevenlabs.io/v1/sound-generation` directly
- Reads API key from `ELEVENLABS_API_KEY` env var
- ElevenLabs returns MP3 data; the adapter converts to WAV via `ffmpeg -i input.mp3 -ar 32000 -ac 1 output.wav` for consistency with AudioCraft output
- Note: the existing `generate_audio.py` ElevenLabs path has a latent bug — it writes raw MP3 bytes to a `.wav` path without conversion. The `--force` mode should also apply this ffmpeg fix when `--backend elevenlabs` is used

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/` | Serves review UI |
| `GET` | `/api/projects` | Lists available projects from `projects/` dir |
| `GET` | `/api/projects/:name` | Returns project state + auto-detected file metadata |
| `POST` | `/api/projects` | Creates a new project config (name + paths) |
| `POST` | `/api/projects/:name/scan` | Scans audioRoot for files, merges into state with defaults |
| `PUT` | `/api/projects/:name/sounds/:id` | Updates sound settings (prompt, seed, duration, backend, flagged) |
| `GET` | `/api/projects/:name/sounds/:id/audio` | Streams the WAV file from `audioRoot/{sound.filePath}` for review playback |
| `POST` | `/api/projects/:name/regenerate` | Regenerates all flagged sounds via adapters, SSE progress. Rejects with 409 if a regeneration is already in progress (GPU-heavy, no concurrent runs) |
| `GET` | `/api/backends` | Returns available backends from registry |
| `POST` | `/api/backends` | Adds a new backend entry. Body: `{ "id": "suno", "label": "Suno (API)", "adapter": "suno", "requiresEnv": "SUNO_API_KEY" }` |

## Review UI

Single HTML page, vanilla JS, dark theme. No framework dependencies.

### Layout

```
┌─────────────────────────────────────────────────────┐
│  Assetgenerator    Project: [Arena ▾]  [Scan] [Regen]│
├─────────────────────────────────────────────────────┤
│  Filter: [All] [SFX] [Music] [Flagged Only]         │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ── SFX ──────────────────────────────────────────── │
│                                                      │
│  ┌ gunshot ─────────────────────────────────────┐    │
│  │ ▶ ████▓▓██▓███▓▓██░░░░░░  0.8s  19KB       │    │
│  │                                              │    │
│  │ Prompt: [heavy metallic gunshot, close______]│    │
│  │ Duration: [0.8]s  Seed: [42]                 │    │
│  │ Backend: [AudioCraft (Local) ▾]              │    │
│  │                              [Save] [Flag]   │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ── Music ────────────────────────────────────────── │
│                                                      │
│  ┌ lobby ────────────────── FLAGGED ────────────┐    │
│  │ ▶ ████▓▓██▓███▓▓██▓███▓▓  60s  67MB        │    │
│  │ ...                                          │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  ── Regeneration Log ─────────────────────────────── │
│  │ [14:30:01] Generating gunshot via AudioCraft │    │
│  │ [14:30:03] OK gunshot (0.8s)                 │    │
│  │ [14:30:03] Processing gunshot → OGG + MP3    │    │
│  │ [14:30:04] OK gunshot processed              │    │
│  └──────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

### Per-Sound Card

- **Waveform**: Web Audio API `decodeAudioData` → canvas rendering (no library)
- **Inline playback**: Click play or waveform, playhead tracks position
- **Prompt**: Textarea, pre-filled from manifest or previous generation
- **Duration**: Number input, auto-detected from file on scan
- **Seed**: Number input, stored after generation
- **Backend dropdown**: Populated from `/api/backends`, "default" = AudioCraft
- **Flag toggle**: Highlights card when flagged, auto-saves on toggle
- **Save button**: PUTs changed fields to API

### Top Bar

- **Project selector**: Dropdown populated from `/api/projects`
- **Scan button**: Triggers `/api/projects/:name/scan` to discover new files
- **Regenerate button**: Triggers `/api/projects/:name/regenerate` for all flagged sounds
- **Filter tabs**: All / SFX / Music / Flagged Only

### Regeneration Log

- Collapsible panel at bottom, auto-opens on regeneration start
- Fed via SSE from the regenerate endpoint
- Per-sound status: generating → processing → done/error
- After completion, affected cards auto-refresh with new waveform + metadata

## Regeneration Flow

1. User flags sounds + edits prompts/settings in UI → saved to project state file
2. User clicks "Regenerate" → server reads all flagged entries
3. For each flagged sound:
   a. Resolve backend (default → audiocraft)
   b. Load adapter for that backend
   c. Call `adapter.generate({ prompt, seed, duration, outputPath, projectConfig })`
   d. On success, delete existing OGG/MP3 in `outputRoot` for this sound. The delete path is computed as `outputRoot/{type}/{id}.ogg` and `outputRoot/{type}/{id}.mp3` (where `type` is `sfx` or `music` from the sound entry, and `id` is the sound name). This removes the skip-guard so `processScript` will reprocess the new WAV.
   e. Run project's `processScript --type <sfx|music>`. Note: if another sound has a partial output (e.g., OGG exists but MP3 doesn't from a previous failed run), it will also be processed as a side effect — this is acceptable behavior and equivalent to a "repair" pass.
   f. Update state: new seed (actual seed used, including auto-generated ones), new timestamp, `flagged: false`
4. SSE streams progress to UI in real-time (see SSE Event Schema below)
5. UI cards refresh with new file data

### SSE Event Schema

The `POST /api/projects/:name/regenerate` endpoint returns `Content-Type: text/event-stream`. The 409 rejection for concurrent runs is returned as a normal HTTP 409 response *before* SSE headers are sent.

Event types:

```
event: progress
data: {"sound":"gunshot","status":"generating","backend":"audiocraft","index":1,"total":3}

event: progress
data: {"sound":"gunshot","status":"processing","index":1,"total":3}

event: done
data: {"sound":"gunshot","seed":42,"duration":0.8,"index":1,"total":3}

event: error
data: {"sound":"melee_swing","error":"AudioCraft CUDA OOM","index":2,"total":3}

event: complete
data: {"total":3,"succeeded":2,"failed":1}
```

- `progress` — emitted at each stage transition (generating, processing) per sound
- `done` — emitted when a sound completes successfully, includes the actual seed used
- `error` — emitted when a sound fails, includes the error message; processing continues with the next sound
- `complete` — emitted once after all sounds are processed; SSE connection closes after this event
- The UI uses `done` events to auto-refresh the affected card's waveform and metadata

## Startup Flow

1. `npm run dev:assetgenerator` (or `node Assetgenerator/server.js --project arena`)
2. Server starts on port 5200
3. Auto-scans project's `audioRoot` → merges with state file
4. New sounds get defaults: duration from ffprobe, prompt from manifest if available, backend "default", unflagged
5. Opens browser to `http://localhost:5200`

## Integration with Existing Pipeline

### Changes to `arena/scripts/generate_audio.py`

The existing script already has `--id`, `--backend`, and `--type` flags. New flags to add:

- `--prompt "..."` — override the manifest prompt for the specified `--id`
- `--seed <n>` — call `torch.manual_seed(seed)` before generation for reproducibility. When omitted, generate a random seed via `random.randint(0, 2**31)`, apply it, and print it to stdout as `SEED:<n>` so the adapter can capture it
- `--duration <d>` — override the manifest duration for the specified `--id`
- `--force` — bypass the "skip if exists" guard (`if out_path.exists()` check), allowing regeneration of existing sounds

**Implementation detail for prompt/seed/duration override:** When `--id` is used with `--prompt`/`--seed`/`--duration`, the script should construct a synthetic SFX/music entry instead of reading from the manifest. This keeps the manifest untouched (the Assetgenerator state file owns per-sound overrides).

**Implementation detail for ElevenLabs WAV fix:** When `--backend elevenlabs`, the generated output should be piped through `ffmpeg -i pipe:0 -ar 32000 -ac 1 output.wav` to produce a valid WAV file instead of writing raw MP3 bytes with a `.wav` extension (fixing the existing latent bug).

Existing bulk mode (no override flags) remains unchanged.

### Root package.json

```json
"dev:assetgenerator": "node Assetgenerator/server.js --project arena"
```

The `--project arena` default ensures auto-scan runs on startup. The project can be changed in the UI via the project selector dropdown.

### Arena Initial Setup

On first scan, the Assetgenerator reads `manifest.json` (the main asset manifest at `arena/assets/manifest.json`) to pre-fill prompts. It reads `manifest.sfx[].prompt`, `manifest.sfx[].duration`, `manifest.music[].prompt`, and `manifest.music[].duration` entries. Sounds found on disk without manifest entries get empty prompts for the user to fill in.

## Runtime Environment

**This service runs locally only — no Docker, no k8s deployment.** The Assetgenerator is a developer workstation tool that needs direct access to:

- **Local GPU** — AudioCraft (AudioGen/MusicGen) requires CUDA via PyTorch. Runs on the user's graphics card (e.g., RTX 5070 Ti) for ~1s per 5s audio clip. Containerizing would require NVIDIA device plugin or GPU passthrough, which adds complexity for no benefit.
- **Python venv** — The existing `arena/.venv` with `audiocraft`, `torch`, `torchaudio`, `soundfile` installed. The server spawns Python processes that inherit this environment.
- **ffmpeg** — Required for `process_audio.sh` (loudness normalization, format conversion) and ElevenLabs MP3→WAV conversion. Must be installed on the host.
- **Local filesystem** — Reads/writes WAV files directly in the project tree and on the SMB share.

**No Dockerfile, no k8s manifests, no Skaffold profile.** The Assetgenerator is started via `npm run dev:assetgenerator` and accessed at `http://localhost:5200`.

**Prerequisites check:** On startup, the server verifies:
1. `python3` is available and can import `torch` (warns if CUDA unavailable — ElevenLabs still works)
2. `ffmpeg` is installed (required for processing)
3. Project's `audioRoot` directory exists

If any check fails, the server starts but shows warnings in the UI header.

## Port Assignment

| Service | Port |
|---------|------|
| Assetgenerator | 5200 |

No conflict with existing services (arena 3002/3003, l2p 3000/3001, VideoVault 5100/5000, auth 5500).

## Concurrency

Regeneration is single-threaded: only one regeneration run at a time. The server tracks whether a regeneration is in progress and returns HTTP 409 Conflict if a second `POST /api/projects/:name/regenerate` arrives while one is running. The UI disables the Regenerate button during active runs and shows the SSE log.

This avoids GPU contention (AudioCraft models consume full VRAM) and state corruption (seed/timestamp writes mid-run).

## Testing Strategy

- Manual testing via the UI (this is a developer tool, not user-facing)
- Verify: scan discovers all files, state persists across restarts, adapters spawn correctly, SSE streams progress, flagged sounds regenerate and unflag

## Future Extensibility

- **New backends**: Drop adapter file + add backends.json entry
- **New projects**: Create project config pointing to any audio directory
- **Non-audio assets**: The adapter pattern could extend to image/sprite generation (future scope, not designed now)
