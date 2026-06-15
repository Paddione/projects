# VideoVault Split — Mediaviewer-Widget + Bibliothek — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** VideoVault in `~/projects/` in drei Einheiten zerlegen — ein geteiltes, source-only Player-Package, eine props-driven Widget-App und die bestehende App als Bibliothek — ohne die bestehende Test-Suite zu brechen.

**Architecture:** Der Player (Playback-State + UI) wird aus `video-player-modal.tsx` in das neue Package `packages/videovault-player` extrahiert (per Vite-Alias `@videovault-player` konsumiert, analog zum bestehenden `@shared`). Die Bibliothek baut ihr Modal zur dünnen `<VideoPlayer>`-Hülle um und injiziert Scrub-Preview via `captureFrame`-Prop. Die neue Widget-App umhüllt `VideoPlayer` mit einem `HelpVideoPicker` und exponiert ein imperatives `MediaviewerHandle` (Companion-Schnittstelle). FFmpeg-Schneiden wird hinter einem `VideoSplitterBackend`-Interface reaktiviert.

**Tech Stack:** React 18 + TypeScript 5.6, Vite 7, Vitest 4 (jsdom + Testing Library), `@ffmpeg/ffmpeg`/`@ffmpeg/core` 0.12 (single-thread WASM). Source-only lokales Package via Vite-Alias (kein Build-Schritt), Muster wie `packages/error-handling`.

**Spec:** `docs/superpowers/specs/2026-06-15-videovault-split-design.md`

**Konventionen (verifiziert):**
- VideoVault-Root: `/home/patrick/projects/VideoVault`. Vite-`root` ist `client/`. Aliase: `@`→`client/src`, `@shared`→`shared/videovault`.
- Tests: `cd /home/patrick/projects/VideoVault && npx vitest run <pfad>` (Pfad relativ zu `client/`, z.B. `src/services/foo.test.ts`). Named imports aus `vitest` (`describe, it, expect`). `createMockVideo(overrides)`-Factory-Muster.
- vitest nutzt `pool: 'threads'` + `maxWorkers: 1`, `bail: 1`. Enhanced-Service-Stubs laufen über `resolve.alias`-Array.
- Package-Tests: `cd /home/patrick/projects/packages/videovault-player && npx vitest run`.
- Commits klein halten, je Task ≥1 Commit. Branch: `feature/videovault-split`.

---

## Status & Design-Update (Stand 2026-06-15)

> Dieser Block ist der **autoritative IST-Stand**. Wo Code-Blöcke weiter unten abweichen, gilt dieser Abschnitt (die unteren Blöcke sind die ursprüngliche Plan-Absicht und teils überholt).

### Fortschritt

| Task | Stand | Anmerkung |
|---|---|---|
| 1 Player-Package scaffolden + Aliase | ✅ erledigt | committet |
| 2 `useVideoPlayer` extrahieren | ✅ erledigt | committet (TDD) |
| 3 `defaultCaptureFrame` + `VideoPlayer` | ✅ erledigt | committet; **danach restyled** (s. Task D) |
| 4 Bibliotheks-Modal → `<VideoPlayer>`-Hülle | ⬜ offen | Kontrakt-IST beachten (s. u.) |
| 5 FFmpeg-Schneiden reaktivieren | ⬜ offen | unverändert gültig |
| 6 `mediaviewer-widget` scaffolden | ✅ erledigt | Dual-Build steht |
| 7 `MediaviewerWidget` + `HelpVideoPicker` | ✅ erledigt | **mit Abweichung** (s. u.) + restyled (Task D) |
| 8 Root-Scripts + Learnings-Log | ⬜ offen | `dev:widget` fehlt noch |
| **D Design-System & Player-Chrome** | ✅ **erledigt** | **neu — siehe unten** |

### Kontrakt-IST (weicht von den Plan-Code-Blöcken ab — für Task 4/5 maßgeblich)

- `PlayerState` ist ein **String-Union** `'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error'` (NICHT das geplante Objekt). Der beobachtbare Zahlen-State (`currentTime`, `duration`, `volume` …) lebt in `useVideoPlayer`s Rückgabe, nicht in `PlayerState`.
- `VideoSource` = `{ id, url, title, poster?, duration, tags? }` — Felder heißen **`poster`/`duration`** (nicht `posterUrl`/`durationSec`); `spriteUrl` existiert nicht. `tags?: string[]` wurde ergänzt (read-only Anzeige).
- `MediaviewerHandle.getState()` liefert `{ current: VideoSource | null; state: PlayerState; currentTime: number }`.
- `VideoPlayerProps` hat zusätzlich **`onStateChange?(state: PlayerState)`** (treibt die Live-Overlays im Widget).
- **Bekannte Abweichung (Task 7):** Das Widget teilt **nicht** einen einzigen `useVideoPlayer` mit `VideoPlayer` (das geplante `player`-Prop-Durchreichen wurde nicht umgesetzt). Folge: im Widget-Handle sind `play()/pause()` aktuell No-ops und `seek()` speichert nur lokal die Zeit. **Reconciliation-Schritt offen**, falls der Companion echte imperative Steuerung braucht — sonst als bewusste YAGNI-Vereinfachung dokumentieren.

### Task D: Design-System & Player-Chrome ✅ (erledigt, via frontend-design)

Ästhetik **„Editing-Suite Control Surface"**: präzise, ruhig, filmischer Signal-Amber-Akzent, Mono-Timecodes; token-getrieben, dark-first + Light-Theme, gescoped unter `.mv-root`/`.mv-player` (kein CSS-Bleed). Brief: `docs/superpowers/specs/2026-06-15-mediaviewer-widget-design-brief.md`. Previews: `docs/design-previews/mediaviewer-{dark,light,player-chrome}.png`.

Erstellt/geändert:
- `packages/videovault-player/src/icons.tsx` *(neu)* — Play/Pause/Prev/Next/Volume/Mute/Fullscreen/PiP (currentColor-SVG).
- `packages/videovault-player/src/player.css` *(neu)* — Player-Styling, gescoped `.mv-player`, `--mv-*`-Tokens mit Fallbacks (auch standalone nutzbar).
- `packages/videovault-player/src/VideoPlayer.tsx` — Tailwind-Soup → semantische Klassen + Icons; **Scrubber** (Buffered- + Played-Bar, Frame-Preview-Tooltip); **Fullscreen + PiP ergänzt**; `onStateChange` emittiert.
- `mediaviewer-widget/src/styles/mediaviewer.css` *(neu)* — Token-System auf `:root` (host-injizierbar) + `[data-theme="light"]`, Panel-Chrome, Picker-Grid, States, Poster-Platzhalter, Spinner.
- `mediaviewer-widget/src/icons.tsx`, `src/MediaviewerState.tsx` *(neu)* — States `empty/idle/loading/buffering/error` + Retry.
- `mediaviewer-widget/src/HelpVideoPicker.tsx`, `src/MediaviewerWidget.tsx` — restyled (Grid mit Poster/Dauer/Tags/Active; Header, Stage mit Idle/Loading/Error-Overlays; **kein Auto-Play** — Idle-Prompt bis Auswahl).
- `mediaviewer-widget/src/lib-entry.ts` — importiert beide CSS-Dateien (Lib-Build bündelt `dist/lib/index.css`), exportiert `MediaviewerState`.
- `mediaviewer-widget/src/vite-env.d.ts` *(neu)* — `declare module '*.css'`.
- Dev-Harness (`index.html`, `src/dev/{App,main}.tsx`, `src/dev/dev.css`) — k8s-Host-Frame mit Theme-Toggle, `handle.playVideo()`-Demo, State-Galerie; distinctive Fonts (Bricolage/Hanken/JetBrains-Mono) **nur im Dev-Harness** (Lib bleibt host-neutral/offline via `--mv-host-font`).

Verifiziert: Player 13/13 + Widget 5/5 Tests grün, Typecheck beide Pakete sauber, Lib-Build erzeugt `index.css` (≈14.8 kB) + `index.js`; dark & light im Browser geprüft.

**Themebarkeit (Brief-Kern):** Default-Tokens liegen bewusst auf `:root` (inert), Light-Overrides auf `[data-theme="light"]` — so kann ein **Host die Tokens auf einem Vorfahren injizieren** und das Widget übernimmt sie. (Tokens auf `.mv-root` zu definieren hätte genau das blockiert.)

---

## File Structure

**Neu — `packages/videovault-player/` (source-only, eigene Test-Toolchain):**
- `package.json` — `@korczewski/videovault-player`, `private`, `main`/`types`→`src/index.ts`, eigene vitest-devDeps.
- `tsconfig.json`, `vitest.config.ts`, `src/test/setup.ts`
- `src/types.ts` — `VideoSource`, `PlayerState`, `MediaviewerHandle`, `MediaviewerWidgetProps`, `VideoPlayerProps`, `UseVideoPlayerOptions`, `UseVideoPlayerReturn`
- `src/capture-frame.ts` — `defaultCaptureFrame(src, timeSec)` (reine Canvas-Impl)
- `src/useVideoPlayer.ts` — Playback-State-Maschine (aus Modal extrahiert)
- `src/VideoPlayer.tsx` — Präsentations-Player (aus Modal extrahiert)
- `src/index.ts` — Barrel-Export

**Neu — `mediaviewer-widget/` (Vite-App, Dual-Build):**
- `package.json`, `vite.config.ts`, `tsconfig.json`, `vitest.config.ts`, `src/test/setup.ts`, `index.html`
- `src/MediaviewerWidget.tsx` — öffentl. Kontrakt: Props + `forwardRef`-Handle
- `src/HelpVideoPicker.tsx` — Auswahl-UI aus `props.videos`
- `src/lib-entry.ts` — Library-Build-Einstieg (Embed)
- `src/dev/main.tsx`, `src/dev/App.tsx` — Dev-Harness

**Modifiziert — `VideoVault/`:**
- `vite.config.ts`, `vitest.config.ts`, `tsconfig.json` — Alias `@videovault-player`
- `client/src/components/video/video-player-modal.tsx` — wird dünne Hülle um `<VideoPlayer>`
- `client/src/services/video-splitter.ts` — `getFFmpeg` reaktiviert, `VideoSplitterBackend`-Interface
- `client/src/services/video-splitter-backend.ts` *(neu)* — Interface + WASM-Impl-Bindung
- `client/src/lib/split-form-mapping.ts` *(neu)* — `SplitVideoFormValues`→`SplitVideoOptions`
- `client/src/pages/home.tsx` — `as`-Cast durch Mapper ersetzen
- `scripts/copy-ffmpeg-core.mjs` *(neu)* — Core nach `client/public/ffmpeg/`
- `package.json` — `predev`/`prebuild`-Hook, `optimizeDeps.exclude`
- `client/src/services/video-splitter.test.ts` *(neu)*

**Modifiziert — Monorepo-Root:**
- `package.json` — `dev:widget` + Aufnahme in `dev:all`

**Neu — Doku:**
- `docs/superpowers/specs/2026-06-15-videovault-migration-learnings.md`

---

## Task 1: Player-Package scaffolden + Aliase verdrahten

**Files:**
- Create: `packages/videovault-player/package.json`
- Create: `packages/videovault-player/tsconfig.json`
- Create: `packages/videovault-player/vitest.config.ts`
- Create: `packages/videovault-player/src/test/setup.ts`
- Create: `packages/videovault-player/src/types.ts`
- Create: `packages/videovault-player/src/index.ts`
- Modify: `VideoVault/vite.config.ts` (resolve.alias)
- Modify: `VideoVault/vitest.config.ts` (resolve.alias-Array)
- Modify: `VideoVault/tsconfig.json` (paths)

- [ ] **Step 1: package.json anlegen**

`packages/videovault-player/package.json`:
```json
{
  "name": "@korczewski/videovault-player",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "description": "Reusable, server-free video player (component + hook) for VideoVault library and embeddable widget",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.4",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^5.1.2",
    "jsdom": "^25.0.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "typescript": "5.6.3",
    "vitest": "^4.0.16"
  }
}
```

- [ ] **Step 2: tsconfig.json + vitest.config.ts + setup.ts anlegen**

`packages/videovault-player/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "noEmit": true
  },
  "include": ["src/**/*"]
}
```

`packages/videovault-player/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
  },
});
```

`packages/videovault-player/src/test/setup.ts`:
```typescript
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

class ResizeObserverPolyfill {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
  (globalThis as unknown as { ResizeObserver?: unknown }).ResizeObserver || ResizeObserverPolyfill;

const u = globalThis.URL as typeof URL & {
  createObjectURL?: (b: Blob) => string;
  revokeObjectURL?: (s: string) => void;
};
u.createObjectURL = u.createObjectURL || vi.fn(() => 'blob:mock');
u.revokeObjectURL = u.revokeObjectURL || vi.fn();

afterEach(() => cleanup());
```

- [ ] **Step 3: types.ts anlegen (der zentrale Kontrakt)**

`packages/videovault-player/src/types.ts`:
```typescript
import type { RefObject } from 'react';

/** Host-/Companion-seitiger Vertrag: eine abspielbare Quelle. */
export interface VideoSource {
  id: string;
  url: string;
  title: string;
  posterUrl?: string;
  spriteUrl?: string;
  durationSec?: number;
  tags?: string[];
}

/** Beobachtbarer Playback-Zustand. */
export interface PlayerState {
  currentId: string | null;
  timeSec: number;
  durationSec: number;
  playing: boolean;
  volume: number;
  muted: boolean;
  rate: number;
  buffered: number;
}

/** Imperatives API (via ref) — DIE Companion-Schnittstelle. */
export interface MediaviewerHandle {
  playVideo(id: string): void;
  setPlaylist(videos: VideoSource[]): void;
  play(): void;
  pause(): void;
  seek(sec: number): void;
  getState(): PlayerState;
}

export type CaptureFrameFn = (src: string, timeSec: number) => Promise<string>;

export interface UseVideoPlayerOptions {
  playlist: VideoSource[];
  initialVideoId?: string;
  onSelect?(id: string): void;
  onProgress?(sec: number): void;
  onEnded?(id: string): void;
  onError?(err: Error): void;
}

export interface UseVideoPlayerReturn {
  videoRef: RefObject<HTMLVideoElement>;
  current: VideoSource | null;
  state: PlayerState;
  controls: {
    play(): void;
    pause(): void;
    toggle(): void;
    seek(sec: number): void;
    setVolume(v: number): void;
    toggleMute(): void;
    setRate(r: number): void;
    next(): void;
    prev(): void;
    playVideo(id: string): void;
    setPlaylist(videos: VideoSource[]): void;
  };
  /** Handler-Bündel zum Spread auf das <video>-Element. */
  videoHandlers: {
    onTimeUpdate(): void;
    onLoadedMetadata(): void;
    onProgress(): void;
    onPlay(): void;
    onPause(): void;
    onEnded(): void;
    onError(): void;
  };
}

export interface VideoPlayerProps {
  source: VideoSource | null;
  playlist?: VideoSource[];
  initialVideoId?: string;
  /** Optional vorgebauter Player-State (z.B. vom Widget gehoben). Wenn gesetzt, nutzt VideoPlayer DIESEN statt eines eigenen. */
  player?: UseVideoPlayerReturn;
  captureFrame?: CaptureFrameFn;
  showControls?: boolean;
  onSelect?(id: string): void;
  onProgress?(sec: number): void;
  onEnded?(id: string): void;
  onError?(err: Error): void;
  onPrev?(): void;
  onNext?(): void;
}

export interface MediaviewerWidgetProps {
  videos: VideoSource[];
  initialVideoId?: string;
  showPicker?: boolean;
  captureFrame?: CaptureFrameFn;
  onSelect?(id: string): void;
  onProgress?(sec: number): void;
  onEnded?(id: string): void;
  onError?(err: Error): void;
}
```

- [ ] **Step 4: index.ts Barrel anlegen (vorerst nur Typen)**

`packages/videovault-player/src/index.ts`:
```typescript
export type {
  VideoSource,
  PlayerState,
  MediaviewerHandle,
  CaptureFrameFn,
  UseVideoPlayerOptions,
  UseVideoPlayerReturn,
  VideoPlayerProps,
  MediaviewerWidgetProps,
} from './types';
```

- [ ] **Step 5: Package-Dependencies installieren**

Run: `cd /home/patrick/projects/packages/videovault-player && npm install`
Expected: `node_modules/` entsteht, kein Fehler.

- [ ] **Step 6: Alias in VideoVault verdrahten**

In `VideoVault/vite.config.ts` im `resolve.alias`-Objekt ergänzen (nach der `@design-system`-Zeile):
```typescript
      "@videovault-player": path.resolve(import.meta.dirname, "..", "packages", "videovault-player", "src"),
```

In `VideoVault/vitest.config.ts` im `resolve.alias`-Array als erstes Element ergänzen:
```typescript
      { find: '@videovault-player', replacement: path.resolve(__dirname, '..', 'packages', 'videovault-player', 'src') },
```

In `VideoVault/tsconfig.json` im `paths`-Objekt ergänzen:
```jsonc
    "@videovault-player": ["../packages/videovault-player/src"],
    "@videovault-player/*": ["../packages/videovault-player/src/*"]
```

- [ ] **Step 7: Typecheck beider Seiten**

Run: `cd /home/patrick/projects/packages/videovault-player && npx tsc --noEmit`
Expected: kein Fehler.
Run: `cd /home/patrick/projects/VideoVault && npx tsc`
Expected: kein NEUER Fehler durch die Alias-Änderung (vorbestehende Fehler unverändert).

- [ ] **Step 8: Commit**

```bash
cd /home/patrick/projects
git add -f packages/videovault-player VideoVault/vite.config.ts VideoVault/vitest.config.ts VideoVault/tsconfig.json
git commit -m "feat(videovault): scaffold videovault-player package + wire @videovault-player alias"
```

---

## Task 2: `useVideoPlayer`-Hook extrahieren (TDD)

Lift des lokalen Playback-States aus `video-player-modal.tsx` in einen wiederverwendbaren Hook. localStorage-Keys aus dem Modal beibehalten (`vv.player.volume`, `vv.player.speed`), damit Nutzer-Prefs erhalten bleiben.

**Files:**
- Create: `packages/videovault-player/src/useVideoPlayer.ts`
- Test: `packages/videovault-player/src/useVideoPlayer.test.ts`
- Modify: `packages/videovault-player/src/index.ts`

- [ ] **Step 1: Failing test schreiben**

`packages/videovault-player/src/useVideoPlayer.test.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useVideoPlayer } from './useVideoPlayer';
import type { VideoSource } from './types';

const PLAYLIST: VideoSource[] = [
  { id: 'a', url: 'blob:a', title: 'A' },
  { id: 'b', url: 'blob:b', title: 'B' },
  { id: 'c', url: 'blob:c', title: 'C' },
];

beforeEach(() => localStorage.clear());

describe('useVideoPlayer', () => {
  it('startet beim ersten Eintrag, wenn kein initialVideoId gesetzt ist', () => {
    const { result } = renderHook(() => useVideoPlayer({ playlist: PLAYLIST }));
    expect(result.current.current?.id).toBe('a');
    expect(result.current.state.currentId).toBe('a');
    expect(result.current.state.playing).toBe(false);
  });

  it('respektiert initialVideoId', () => {
    const { result } = renderHook(() =>
      useVideoPlayer({ playlist: PLAYLIST, initialVideoId: 'b' }),
    );
    expect(result.current.current?.id).toBe('b');
  });

  it('playVideo wählt aus der Playlist und feuert onSelect', () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() => useVideoPlayer({ playlist: PLAYLIST, onSelect }));
    act(() => result.current.controls.playVideo('c'));
    expect(result.current.current?.id).toBe('c');
    expect(onSelect).toHaveBeenCalledWith('c');
  });

  it('playVideo ignoriert unbekannte IDs', () => {
    const onSelect = vi.fn();
    const { result } = renderHook(() => useVideoPlayer({ playlist: PLAYLIST, onSelect }));
    act(() => result.current.controls.playVideo('zzz'));
    expect(result.current.current?.id).toBe('a');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('next/prev navigieren in der Playlist', () => {
    const { result } = renderHook(() => useVideoPlayer({ playlist: PLAYLIST }));
    act(() => result.current.controls.next());
    expect(result.current.current?.id).toBe('b');
    act(() => result.current.controls.prev());
    expect(result.current.current?.id).toBe('a');
  });

  it('persistiert Volume und Rate in localStorage', () => {
    const { result } = renderHook(() => useVideoPlayer({ playlist: PLAYLIST }));
    act(() => result.current.controls.setVolume(0.5));
    act(() => result.current.controls.setRate(1.5));
    expect(localStorage.getItem('vv.player.volume')).toBe('0.5');
    expect(localStorage.getItem('vv.player.speed')).toBe('1.5');
  });

  it('onEnded feuert mit der aktuellen ID beim Ende', () => {
    const onEnded = vi.fn();
    const { result } = renderHook(() => useVideoPlayer({ playlist: PLAYLIST, onEnded }));
    act(() => result.current.videoHandlers.onEnded());
    expect(onEnded).toHaveBeenCalledWith('a');
  });

  it('setPlaylist tauscht die Liste und hält die aktuelle ID, wenn noch vorhanden', () => {
    const { result } = renderHook(() => useVideoPlayer({ playlist: PLAYLIST }));
    act(() => result.current.controls.playVideo('b'));
    act(() =>
      result.current.controls.setPlaylist([
        { id: 'b', url: 'blob:b2', title: 'B2' },
        { id: 'x', url: 'blob:x', title: 'X' },
      ]),
    );
    expect(result.current.current?.id).toBe('b');
    expect(result.current.current?.title).toBe('B2');
  });
});
```

- [ ] **Step 2: Test laufen lassen → muss fehlschlagen**

Run: `cd /home/patrick/projects/packages/videovault-player && npx vitest run src/useVideoPlayer.test.ts`
Expected: FAIL — `Failed to resolve import "./useVideoPlayer"` bzw. „useVideoPlayer is not a function".

- [ ] **Step 3: Hook implementieren**

`packages/videovault-player/src/useVideoPlayer.ts`:
```typescript
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  PlayerState,
  UseVideoPlayerOptions,
  UseVideoPlayerReturn,
  VideoSource,
} from './types';

const KEY_VOLUME = 'vv.player.volume';
const KEY_SPEED = 'vv.player.speed';

function loadNum(key: string, fallback: number): number {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

export function useVideoPlayer(opts: UseVideoPlayerOptions): UseVideoPlayerReturn {
  const { onSelect, onProgress, onEnded, onError } = opts;
  const videoRef = useRef<HTMLVideoElement>(null);

  const [playlist, setPlaylistState] = useState<VideoSource[]>(opts.playlist);
  const [currentId, setCurrentId] = useState<string | null>(
    opts.initialVideoId ?? opts.playlist[0]?.id ?? null,
  );
  const [playing, setPlaying] = useState(false);
  const [timeSec, setTimeSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [volume, setVolumeState] = useState(() => loadNum(KEY_VOLUME, 1));
  const [muted, setMuted] = useState(false);
  const [rate, setRateState] = useState(() => loadNum(KEY_SPEED, 1));
  const [buffered, setBuffered] = useState(0);

  const current = playlist.find((v) => v.id === currentId) ?? null;
  const currentIndex = playlist.findIndex((v) => v.id === currentId);

  // Persist + an <video> spiegeln
  useEffect(() => {
    try {
      localStorage.setItem(KEY_VOLUME, String(volume));
    } catch {
      /* ignore */
    }
    if (videoRef.current) videoRef.current.volume = volume;
  }, [volume]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY_SPEED, String(rate));
    } catch {
      /* ignore */
    }
    if (videoRef.current) videoRef.current.playbackRate = rate;
  }, [rate]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  const playVideo = useCallback(
    (id: string) => {
      setPlaylistState((list) => {
        if (list.some((v) => v.id === id)) {
          setCurrentId(id);
          onSelect?.(id);
        }
        return list;
      });
    },
    [onSelect],
  );

  const setPlaylist = useCallback((videos: VideoSource[]) => {
    setPlaylistState(videos);
    setCurrentId((prev) => (prev && videos.some((v) => v.id === prev) ? prev : (videos[0]?.id ?? null)));
  }, []);

  const next = useCallback(() => {
    if (currentIndex >= 0 && currentIndex < playlist.length - 1) {
      const id = playlist[currentIndex + 1].id;
      setCurrentId(id);
      onSelect?.(id);
    }
  }, [currentIndex, playlist, onSelect]);

  const prev = useCallback(() => {
    if (currentIndex > 0) {
      const id = playlist[currentIndex - 1].id;
      setCurrentId(id);
      onSelect?.(id);
    }
  }, [currentIndex, playlist, onSelect]);

  const play = useCallback(() => {
    void videoRef.current?.play().catch((e) => onError?.(e instanceof Error ? e : new Error(String(e))));
  }, [onError]);
  const pause = useCallback(() => videoRef.current?.pause(), []);
  const toggle = useCallback(() => (playing ? pause() : play()), [playing, play, pause]);
  const seek = useCallback((sec: number) => {
    if (videoRef.current) videoRef.current.currentTime = sec;
    setTimeSec(sec);
  }, []);
  const setVolume = useCallback((v: number) => setVolumeState(Math.min(1, Math.max(0, v))), []);
  const toggleMute = useCallback(() => setMuted((m) => !m), []);
  const setRate = useCallback((r: number) => setRateState(r), []);

  const videoHandlers = {
    onTimeUpdate: () => {
      const t = videoRef.current?.currentTime ?? 0;
      setTimeSec(t);
      onProgress?.(t);
    },
    onLoadedMetadata: () => setDurationSec(videoRef.current?.duration ?? 0),
    onProgress: () => {
      const v = videoRef.current;
      if (v && v.buffered.length > 0) setBuffered(v.buffered.end(v.buffered.length - 1));
    },
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onEnded: () => {
      setPlaying(false);
      if (currentId) onEnded?.(currentId);
    },
    onError: () => onError?.(new Error('Video playback error')),
  };

  const state: PlayerState = { currentId, timeSec, durationSec, playing, volume, muted, rate, buffered };

  return {
    videoRef,
    current,
    state,
    controls: { play, pause, toggle, seek, setVolume, toggleMute, setRate, next, prev, playVideo, setPlaylist },
    videoHandlers,
  };
}
```

- [ ] **Step 4: Test laufen lassen → muss bestehen**

Run: `cd /home/patrick/projects/packages/videovault-player && npx vitest run src/useVideoPlayer.test.ts`
Expected: PASS (8 Tests grün).

- [ ] **Step 5: Barrel-Export ergänzen**

In `packages/videovault-player/src/index.ts` ergänzen:
```typescript
export { useVideoPlayer } from './useVideoPlayer';
```

- [ ] **Step 6: Commit**

```bash
cd /home/patrick/projects
git add -f packages/videovault-player/src
git commit -m "feat(videovault-player): extract useVideoPlayer playback state machine (TDD)"
```

---

## Task 3: `defaultCaptureFrame` + `VideoPlayer`-Komponente

`VideoPlayer` rendert das `<video>`-Element samt Controls/Scrub-Bar und wird von `useVideoPlayer` getrieben. Scrub-Preview via injizierter `captureFrame`-Prop; Package liefert reine Canvas-Default-Impl.

**Files:**
- Create: `packages/videovault-player/src/capture-frame.ts`
- Test: `packages/videovault-player/src/capture-frame.test.ts`
- Create: `packages/videovault-player/src/VideoPlayer.tsx`
- Test: `packages/videovault-player/src/VideoPlayer.test.tsx`
- Modify: `packages/videovault-player/src/index.ts`

- [ ] **Step 1: Failing test für defaultCaptureFrame**

`packages/videovault-player/src/capture-frame.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { defaultCaptureFrame } from './capture-frame';

describe('defaultCaptureFrame', () => {
  it('ist eine Funktion mit (src, timeSec)-Signatur', () => {
    expect(typeof defaultCaptureFrame).toBe('function');
    expect(defaultCaptureFrame.length).toBe(2);
  });

  it('rejected, wenn das Video nicht laden kann (kein src)', async () => {
    await expect(defaultCaptureFrame('', 1)).rejects.toBeInstanceOf(Error);
  });
});
```

- [ ] **Step 2: Test laufen → FAIL**

Run: `cd /home/patrick/projects/packages/videovault-player && npx vitest run src/capture-frame.test.ts`
Expected: FAIL — `Failed to resolve import "./capture-frame"`.

- [ ] **Step 3: defaultCaptureFrame implementieren**

`packages/videovault-player/src/capture-frame.ts`:
```typescript
import type { CaptureFrameFn } from './types';

/**
 * Minimale, reine Browser-Implementierung: lädt das Video versteckt,
 * springt zu timeSec, zeichnet einen Frame auf ein Canvas und gibt eine dataURL zurück.
 * Die Bibliothek kann stattdessen ihren reicheren VideoThumbnailService injizieren.
 */
export const defaultCaptureFrame: CaptureFrameFn = (src, timeSec) =>
  new Promise<string>((resolve, reject) => {
    if (!src) {
      reject(new Error('captureFrame: empty src'));
      return;
    }
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'auto';
    video.src = src;

    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
    };

    video.addEventListener('error', () => {
      cleanup();
      reject(new Error('captureFrame: video failed to load'));
    });

    video.addEventListener('loadeddata', () => {
      video.currentTime = Math.max(0, timeSec);
    });

    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 160;
        canvas.height = video.videoHeight || 90;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('captureFrame: no 2d context');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        cleanup();
        resolve(dataUrl);
      } catch (e) {
        cleanup();
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    });
  });
```

- [ ] **Step 4: Test laufen → PASS**

Run: `cd /home/patrick/projects/packages/videovault-player && npx vitest run src/capture-frame.test.ts`
Expected: PASS. (In jsdom feuert `<video>` `error` für leere/ungültige src → der reject-Pfad greift.)

- [ ] **Step 5: Failing test für VideoPlayer**

`packages/videovault-player/src/VideoPlayer.test.tsx`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VideoPlayer } from './VideoPlayer';
import type { VideoSource } from './types';

const SRC: VideoSource = { id: 'a', url: 'blob:a', title: 'Clip A' };

beforeEach(() => localStorage.clear());

describe('VideoPlayer', () => {
  it('rendert ein <video> mit der Quellen-URL', () => {
    render(<VideoPlayer source={SRC} />);
    const video = document.querySelector('video');
    expect(video).not.toBeNull();
    expect(video?.getAttribute('src')).toBe('blob:a');
  });

  it('zeigt den Titel der aktuellen Quelle an', () => {
    render(<VideoPlayer source={SRC} />);
    expect(screen.getByText('Clip A')).toBeInTheDocument();
  });

  it('meldet Wiedergabe-Fortschritt über onProgress', () => {
    const onProgress = vi.fn();
    render(<VideoPlayer source={SRC} onProgress={onProgress} />);
    const video = document.querySelector('video') as HTMLVideoElement;
    Object.defineProperty(video, 'currentTime', { value: 12, configurable: true });
    fireEvent.timeUpdate(video);
    expect(onProgress).toHaveBeenCalledWith(12);
  });

  it('rendert nichts Abspielbares, wenn source null ist', () => {
    render(<VideoPlayer source={null} />);
    expect(document.querySelector('video')).toBeNull();
  });
});
```

- [ ] **Step 6: Test laufen → FAIL**

Run: `cd /home/patrick/projects/packages/videovault-player && npx vitest run src/VideoPlayer.test.tsx`
Expected: FAIL — `Failed to resolve import "./VideoPlayer"`.

- [ ] **Step 7: VideoPlayer implementieren (Player-Markup aus dem Modal portieren)**

Quelle der Portierung: `VideoVault/client/src/components/video/video-player-modal.tsx`. Übernimm in `VideoPlayer.tsx` **nur den reinen Player-Teil** — NICHT das `<Dialog>`-Chrome, NICHT die Side-Panels (`sidePanel`-State, `VideoTagsEditor`, `VideoSplitter`), NICHT die playback-fremden Props.

Zu portierende Bausteine aus dem Modal:
- Das `<video ref={videoRef}>`-Element samt `onTimeUpdate/onLoadedMetadata/onProgress/onPlay/onPause/onEnded/onError` (jetzt aus `videoHandlers`).
- Die Controls-Leiste: Play/Pause, Volume/Mute, Scrub-`<Slider>`, Buffered-Anzeige, Fullscreen, PiP, Speed-Dropdown, SkipBack/SkipForward (→ `onPrev`/`onNext`).
- Scrub-Hover-Preview: nutzt jetzt `captureFrame ?? defaultCaptureFrame`.
- MediaSession-API-Effekt (next/previoustrack → `onNext`/`onPrev`).

Mindest-Gerüst (Controls-Detailmarkup aus dem Modal 1:1 übernehmen, lucide-Icons direkt importieren — keine `@/`-Aliase im Package):
```tsx
import { useEffect } from 'react';
import { useVideoPlayer } from './useVideoPlayer';
import { defaultCaptureFrame } from './capture-frame';
import type { VideoPlayerProps } from './types';

export function VideoPlayer(props: VideoPlayerProps) {
  const { source, captureFrame, showControls = true, onPrev, onNext } = props;
  const playlist = props.playlist ?? (source ? [source] : []);

  // Hook IMMER aufrufen (Rules of Hooks); externen Player bevorzugen, falls übergeben.
  const internalPlayer = useVideoPlayer({
    playlist,
    initialVideoId: props.initialVideoId ?? source?.id,
    onSelect: props.onSelect,
    onProgress: props.onProgress,
    onEnded: props.onEnded,
    onError: props.onError,
  });
  const player = props.player ?? internalPlayer;

  const current = player.current ?? source;
  const grabFrame = captureFrame ?? defaultCaptureFrame;

  // MediaSession-Verdrahtung (aus dem Modal portiert)
  useEffect(() => {
    if (!('mediaSession' in navigator) || !current) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: current.title });
    navigator.mediaSession.setActionHandler('nexttrack', onNext ?? null);
    navigator.mediaSession.setActionHandler('previoustrack', onPrev ?? null);
    return () => {
      navigator.mediaSession.setActionHandler('nexttrack', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
    };
  }, [current, onNext, onPrev]);

  if (!current) return null;

  return (
    <div className="vv-player" data-testid="video-player">
      <div className="vv-player__title">{current.title}</div>
      <video
        ref={player.videoRef}
        src={current.url}
        poster={current.posterUrl}
        onTimeUpdate={player.videoHandlers.onTimeUpdate}
        onLoadedMetadata={player.videoHandlers.onLoadedMetadata}
        onProgress={player.videoHandlers.onProgress}
        onPlay={player.videoHandlers.onPlay}
        onPause={player.videoHandlers.onPause}
        onEnded={player.videoHandlers.onEnded}
        onError={player.videoHandlers.onError}
      />
      {showControls && (
        <div className="vv-player__controls">
          {/* Play/Pause, Volume, Scrub-Slider (grabFrame für Hover-Preview),
              Speed, Fullscreen, PiP, Prev/Next — Detailmarkup aus
              video-player-modal.tsx portieren, getrieben von player.state/player.controls */}
        </div>
      )}
    </div>
  );
}
```
Hinweis: Falls Radix-`Slider`/`Button` im Modal genutzt wurden, im Package durch native Elemente (`<input type="range">`, `<button>`) ersetzen — das Package soll keine `@/components/ui`-Abhängigkeit haben. **Styling ist NICHT länger Platzhalter:** Das Player-Markup ist inzwischen token-getrieben gestylt (semantische `.mv-player__*`-Klassen, Icons, Scrubber, Fullscreen/PiP) — siehe **Task D**. Die `data-testid`-Hooks dienen als stabile Styling-/Test-Schnittstelle.

- [ ] **Step 8: Test laufen → PASS**

Run: `cd /home/patrick/projects/packages/videovault-player && npx vitest run src/VideoPlayer.test.tsx`
Expected: PASS (4 Tests grün).

- [ ] **Step 9: Barrel-Export ergänzen + voller Package-Testlauf**

In `packages/videovault-player/src/index.ts` ergänzen:
```typescript
export { VideoPlayer } from './VideoPlayer';
export { defaultCaptureFrame } from './capture-frame';
```
Run: `cd /home/patrick/projects/packages/videovault-player && npx vitest run && npx tsc --noEmit`
Expected: alle Tests grün, kein Typfehler.

- [ ] **Step 10: Commit**

```bash
cd /home/patrick/projects
git add -f packages/videovault-player/src
git commit -m "feat(videovault-player): add VideoPlayer component + defaultCaptureFrame (TDD)"
```

---

## Task 4: Bibliotheks-Modal zur `<VideoPlayer>`-Hülle umbauen

`video-player-modal.tsx` behält Dialog-Chrome + Side-Panels (Tags/Split) und delegiert die Wiedergabe an `<VideoPlayer>`. Die Bibliothek injiziert ihren `VideoThumbnailService.captureFrameAtTime` als `captureFrame`. Ziel: DRY (ein Player), Bibliothek bleibt voll funktionsfähig, gesamte Suite grün.

**Files:**
- Modify: `VideoVault/client/src/components/video/video-player-modal.tsx`
- Test: `VideoVault/client/src/components/video/video-player-modal.test.tsx` (falls vorhanden, sonst neu für Smoke)

- [ ] **Step 1: Adapter `VideoSource` aus `Video` bauen**

Im Modal eine kleine reine Funktion ergänzen (oben in der Datei), die das Library-`Video` auf den Package-`VideoSource`-Kontrakt mappt — nutzt die bestehenden `getVideoSrc`/`getThumbnailSrc`/`getSpriteSrc` aus `@/lib/video-urls`:
```typescript
import { getVideoSrc, getThumbnailSrc, getSpriteSrc } from '@/lib/video-urls';
import type { VideoSource } from '@videovault-player';

function toVideoSource(video: Video): VideoSource | null {
  const url = getVideoSrc(video);
  if (!url) return null;
  return {
    id: video.id,
    url,
    title: video.displayName || video.filename,
    posterUrl: getThumbnailSrc(video),
    spriteUrl: getSpriteSrc(video),
    durationSec: video.metadata?.duration,
  };
}
```

- [ ] **Step 2: `captureFrame`-Adapter aus VideoThumbnailService bauen**

Im Modal:
```typescript
import { VideoThumbnailService } from '@/services/video-thumbnail';
import type { CaptureFrameFn } from '@videovault-player';

const libraryCaptureFrame: CaptureFrameFn = (src, timeSec) =>
  VideoThumbnailService.captureFrameAtTime(src, timeSec);
```

- [ ] **Step 3: Player-Markup im Modal durch `<VideoPlayer>` ersetzen**

Im Modal:
- Den lokalen Playback-State (`isPlaying`, `currentTime`, `duration`, `volume`, `isMuted`, `buffered`, `isPip`, `isFullscreen`, `playbackRate`, Scrub/Hover-States) und das `<video>`-Markup samt Controls-Leiste **entfernen**.
- Stattdessen rendern:
```tsx
<VideoPlayer
  source={video ? toVideoSource(video) : null}
  captureFrame={libraryCaptureFrame}
  onPrev={onPrev}
  onNext={onNext}
/>
```
- **Behalten:** `<Dialog>`-Chrome, `sidePanel`-State, die Toolbar-Buttons für Tags/Split/Focus, die Side-Panels (`<VideoTagsEditor>`, `<VideoSplitter>`) und alle playback-fremden Props (`onSplitVideo`, `onUpdateVideo`, `onRemoveCategory`, `onFocusMode`, `availableCategories`, `onRescan`, `shuffleEnabled`, `onToggleShuffle`).
- Den `import { VideoPlayer } from '@videovault-player';` ergänzen. Entferne ungenutzt gewordene Imports (z.B. `Slider`, einzelne lucide-Icons, die nur in der alten Controls-Leiste genutzt wurden) — der Linter zeigt sie an.

- [ ] **Step 4: Lint + Typecheck**

Run: `cd /home/patrick/projects/VideoVault && npx eslint client/src/components/video/video-player-modal.tsx`
Expected: keine Fehler (ggf. ungenutzte Imports entfernen, bis grün).
Run: `cd /home/patrick/projects/VideoVault && npx tsc`
Expected: kein neuer Fehler.

- [ ] **Step 5: Volle Bibliotheks-Unit-Suite — Regressions-Guard**

Run: `cd /home/patrick/projects/VideoVault && npm run test:client`
Expected: PASS — alle bestehenden Tests grün, Coverage-Schwellen eingehalten. Falls ein Test das alte Player-Markup direkt prüfte, auf das `data-testid="video-player"` bzw. das neue Verhalten anpassen (nur Assertions, nicht die Logik).

- [ ] **Step 6: Commit**

```bash
cd /home/patrick/projects
git add -f VideoVault/client/src/components/video/video-player-modal.tsx
git commit -m "refactor(videovault): library player-modal now wraps shared VideoPlayer (DRY)"
```

---

## Task 5: FFmpeg-Schneiden hinter `VideoSplitterBackend` reaktivieren (TDD)

`getFFmpeg` reaktivieren (single-thread Core via `toBlobURL`, Core-Dateien nach `public/` kopieren), Splitter hinter ein Backend-Interface legen (GPU-Worker-Swap in Sub-Projekt 2), den `as`-Cast in `home.tsx` durch einen expliziten Mapper ersetzen. Splitter ist bisher ungetestet → erster Unit-Test.

**Files:**
- Create: `VideoVault/scripts/copy-ffmpeg-core.mjs`
- Modify: `VideoVault/package.json` (predev/prebuild)
- Modify: `VideoVault/vite.config.ts` (optimizeDeps.exclude)
- Modify: `VideoVault/client/src/services/video-splitter.ts` (getFFmpeg)
- Create: `VideoVault/client/src/services/video-splitter-backend.ts`
- Create: `VideoVault/client/src/lib/split-form-mapping.ts`
- Test: `VideoVault/client/src/lib/split-form-mapping.test.ts`
- Modify: `VideoVault/client/src/pages/home.tsx`
- Create: `VideoVault/client/src/services/video-splitter.test.ts`

- [ ] **Step 1: Core-Copy-Script anlegen**

`VideoVault/scripts/copy-ffmpeg-core.mjs`:
```javascript
import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = resolve(root, 'node_modules/@ffmpeg/core/dist/umd');
const outDir = resolve(root, 'client/public/ffmpeg');

const files = ['ffmpeg-core.js', 'ffmpeg-core.wasm'];

mkdirSync(outDir, { recursive: true });
for (const f of files) {
  const from = resolve(srcDir, f);
  if (!existsSync(from)) {
    console.error(`[copy-ffmpeg-core] missing ${from} — is @ffmpeg/core installed?`);
    process.exit(1);
  }
  copyFileSync(from, resolve(outDir, f));
  console.log(`[copy-ffmpeg-core] ${f} -> client/public/ffmpeg/`);
}
```

- [ ] **Step 2: Script verdrahten + optimizeDeps + gitignore**

In `VideoVault/package.json` `scripts` ergänzen:
```json
    "copy:ffmpeg": "node scripts/copy-ffmpeg-core.mjs",
    "predev": "node scripts/copy-ffmpeg-core.mjs",
    "prebuild": "node scripts/copy-ffmpeg-core.mjs",
```
In `VideoVault/vite.config.ts` `optimizeDeps.exclude` erweitern:
```typescript
    exclude: ['@replit/vite-plugin-cartographer', '@ffmpeg/ffmpeg', '@ffmpeg/core']
```
In `VideoVault/.gitignore` ergänzen (kopierte Artefakte nicht committen):
```
client/public/ffmpeg/
```
Run: `cd /home/patrick/projects/VideoVault && npm run copy:ffmpeg`
Expected: zwei Zeilen `... -> client/public/ffmpeg/`, Exit 0.

- [ ] **Step 3: `getFFmpeg` reaktivieren**

In `VideoVault/client/src/services/video-splitter.ts` die `getFFmpeg`-Funktion ersetzen:
```typescript
async function getFFmpeg(onProgress?: (stage: string) => void): Promise<FFmpegInstance> {
  if (ffmpegInstance) return ffmpegInstance;
  onProgress?.(FFMPEG_STAGE.LOADING);
  const { FFmpeg } = await import('@ffmpeg/ffmpeg');
  const { toBlobURL } = await import('@ffmpeg/util');
  const ffmpeg = new FFmpeg();
  // Single-thread @ffmpeg/core@0.12 — kein worker, kein SharedArrayBuffer/COEP.
  // Core-Dateien werden via scripts/copy-ffmpeg-core.mjs nach /ffmpeg/ ausgeliefert.
  const coreURL = await toBlobURL('/ffmpeg/ffmpeg-core.js', 'text/javascript');
  const wasmURL = await toBlobURL('/ffmpeg/ffmpeg-core.wasm', 'application/wasm');
  await ffmpeg.load({ coreURL, wasmURL });
  ffmpegInstance = ffmpeg as FFmpegInstance;
  return ffmpegInstance;
}
```
Den alten `Promise.reject`-Stub und den auskommentierten Block entfernen. Sicherstellen, dass `ffmpegInstance` (Modul-Level) deklariert ist und der `eslint-disable no-unused-vars`-Kommentar entfernt wird, da es nun genutzt wird.

- [ ] **Step 4: Failing test für den Form→Options-Mapper**

`VideoVault/client/src/lib/split-form-mapping.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { splitFormToOptions } from './split-form-mapping';
import type { SplitVideoFormValues } from '@/components/video/video-splitter';

describe('splitFormToOptions', () => {
  it('mappt Formularwerte auf SplitVideoOptions mit splitTimeSeconds + zwei Segmenten', () => {
    const form = {
      splitTimeSeconds: 42,
      first: { displayName: 'Teil 1', filename: 'teil1.mp4', categories: {}, customCategories: {} },
      second: { displayName: 'Teil 2', filename: 'teil2.mp4', categories: {}, customCategories: {} },
    } as unknown as SplitVideoFormValues;

    const opts = splitFormToOptions(form);
    expect(opts.splitTimeSeconds).toBe(42);
    expect(opts.first.filename).toBe('teil1.mp4');
    expect(opts.second.displayName).toBe('Teil 2');
  });
});
```
Hinweis: Beim Implementieren zuerst die echten Felder von `SplitVideoFormValues` in `client/src/components/video/video-splitter.tsx` ablesen und das Mapping daran ausrichten (der obige Test deckt die laut Service-Typ erwartete Struktur ab; passe Feldnamen an, falls die Form abweicht).

- [ ] **Step 5: Test laufen → FAIL**

Run: `cd /home/patrick/projects/VideoVault && npx vitest run src/lib/split-form-mapping.test.ts`
Expected: FAIL — `Failed to resolve import "./split-form-mapping"`.

- [ ] **Step 6: Mapper implementieren**

`VideoVault/client/src/lib/split-form-mapping.ts`:
```typescript
import type { SplitVideoFormValues } from '@/components/video/video-splitter';
import type { SplitVideoOptions } from '@/services/video-splitter';

/** Expliziter Mapper UI-Form → Service-Options (ersetzt den `as`-Cast in home.tsx). */
export function splitFormToOptions(
  form: SplitVideoFormValues,
  onProgress?: (stage: string) => void,
): SplitVideoOptions {
  return {
    splitTimeSeconds: form.splitTimeSeconds,
    first: form.first,
    second: form.second,
    onProgress,
  };
}
```
Falls die echten `SplitVideoFormValues`-Felder abweichen (Step 4-Hinweis), Zuordnung hier anpassen, bis der Test grün ist.

- [ ] **Step 7: Test laufen → PASS**

Run: `cd /home/patrick/projects/VideoVault && npx vitest run src/lib/split-form-mapping.test.ts`
Expected: PASS.

- [ ] **Step 8: `home.tsx` auf den Mapper umstellen**

In `VideoVault/client/src/pages/home.tsx` den Aufruf (ca. Zeile 203) ersetzen:
```typescript
// vorher: const res = (await actions.splitVideo(target.id, form)) as SplitVideoResult;
import { splitFormToOptions } from '@/lib/split-form-mapping';
// ...
const res = await actions.splitVideo(target.id, splitFormToOptions(form));
```

- [ ] **Step 9: `VideoSplitterBackend`-Interface + WASM-Bindung**

`VideoVault/client/src/services/video-splitter-backend.ts`:
```typescript
import type { Video } from '@/types/video';
import { VideoSplitter, type SplitVideoOptions, type SplitVideoResult } from '@/services/video-splitter';

/**
 * Schneide-Backend-Abstraktion. WASM ist die erste Implementierung.
 * In Sub-Projekt 2 kann ein ServerFfmpegBackend (GPU-Worker, natives ffmpeg)
 * dieselbe Schnittstelle erfüllen, ohne die Bibliotheks-UI zu berühren.
 */
export interface VideoSplitterBackend {
  readonly kind: 'wasm' | 'server';
  split(video: Video, options: SplitVideoOptions): Promise<SplitVideoResult>;
}

export const wasmSplitterBackend: VideoSplitterBackend = {
  kind: 'wasm',
  split: (video, options) => VideoSplitter.splitVideo(video, options),
};

/** Aktives Backend — Austauschpunkt für Sub-Projekt 2. */
export const activeSplitterBackend: VideoSplitterBackend = wasmSplitterBackend;
```
In `use-video-manager.ts` die `splitVideo`-Action umstellen, statt `VideoSplitter.splitVideo(source, options)` nun `activeSplitterBackend.split(source, options)` aufzurufen (Import ergänzen, alten `VideoSplitter`-Import entfernen falls ungenutzt).

- [ ] **Step 10: Splitter-Unit-Test (Guards, ohne echtes FFmpeg)**

`VideoVault/client/src/services/video-splitter.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { VideoSplitter } from './video-splitter';
import { FileHandleRegistry } from './file-handle-registry';
import type { Video } from '@/types/video';

function mockVideo(overrides: Partial<Video> = {}): Video {
  return {
    id: 'v1', filename: 'clip.mp4', displayName: 'Clip', path: '/Bibliothek/clip.mp4',
    size: 1000, lastModified: '2024-01-01T00:00:00Z',
    categories: { age: [], physical: [], ethnicity: [], relationship: [], acts: [], setting: [], quality: [], performer: [] },
    customCategories: {}, metadata: { duration: 60, width: 1920, height: 1080, bitrate: 1, codec: 'h264', fps: 30, aspectRatio: '16:9' },
    thumbnail: { dataUrl: '', generated: false, timestamp: '' }, rootKey: 'r',
    ...overrides,
  } as Video;
}

const seg = { displayName: 'x', filename: 'x.mp4', categories: mockVideo().categories, customCategories: {} };

describe('VideoSplitter.splitVideo guards', () => {
  beforeEach(() => FileHandleRegistry.clear?.());

  it('schlägt mit missing_handle fehl, wenn kein FileHandle registriert ist', async () => {
    const res = await VideoSplitter.splitVideo(mockVideo(), { splitTimeSeconds: 30, first: seg, second: seg });
    expect(res.success).toBe(false);
    if (!res.success) expect(res.code).toBe('missing_handle');
  });

  it('schlägt mit invalid_split fehl, wenn splitTime außerhalb der Dauer liegt', async () => {
    // (Erst FileHandle/Directory mocken, dann splitTimeSeconds=0 prüfen.
    //  Falls Handle-Mocking zu aufwändig: dieser Fall wird durch missing_handle vorgelagert
    //  abgedeckt; dann diesen it() als it.skip markieren und im Learnings-Log notieren.)
    const res = await VideoSplitter.splitVideo(mockVideo(), { splitTimeSeconds: 0, first: seg, second: seg });
    expect(res.success).toBe(false);
  });
});
```
Hinweis: `FileHandleRegistry.clear?.()` defensiv — falls die Methode anders heißt, an die echte API anpassen. Ziel ist, den ersten Guard-Pfad (`missing_handle`) deterministisch grün zu bekommen; tiefere FFmpeg-Pfade werden in Sub-Projekt 2 mit echtem Core E2E-getestet.

- [ ] **Step 11: Tests + Typecheck + Lint**

Run: `cd /home/patrick/projects/VideoVault && npx vitest run src/services/video-splitter.test.ts src/lib/split-form-mapping.test.ts`
Expected: PASS.
Run: `cd /home/patrick/projects/VideoVault && npm run test:client`
Expected: gesamte Client-Suite grün.
Run: `cd /home/patrick/projects/VideoVault && npx tsc`
Expected: kein neuer Fehler.

- [ ] **Step 12: Commit**

```bash
cd /home/patrick/projects
git add -f VideoVault/scripts/copy-ffmpeg-core.mjs VideoVault/package.json VideoVault/vite.config.ts VideoVault/.gitignore \
  VideoVault/client/src/services/video-splitter.ts VideoVault/client/src/services/video-splitter-backend.ts \
  VideoVault/client/src/services/video-splitter.test.ts VideoVault/client/src/lib/split-form-mapping.ts \
  VideoVault/client/src/lib/split-form-mapping.test.ts VideoVault/client/src/pages/home.tsx \
  VideoVault/client/src/hooks/use-video-manager.ts
git commit -m "feat(videovault): reactivate FFmpeg cutting behind VideoSplitterBackend + explicit form mapper"
```

---

## Task 6: `mediaviewer-widget`-App scaffolden (Vite, Dual-Build)

Eigenständige Vite-App: Dev-Build (Harness) + Library-Build (Embed). Konsumiert `@videovault-player` per Alias.

**Files:**
- Create: `mediaviewer-widget/package.json`
- Create: `mediaviewer-widget/tsconfig.json`
- Create: `mediaviewer-widget/vite.config.ts`
- Create: `mediaviewer-widget/vitest.config.ts`
- Create: `mediaviewer-widget/src/test/setup.ts`
- Create: `mediaviewer-widget/index.html`
- Create: `mediaviewer-widget/src/dev/main.tsx`
- Create: `mediaviewer-widget/src/dev/App.tsx`

- [ ] **Step 1: package.json**

`mediaviewer-widget/package.json`:
```json
{
  "name": "@korczewski/mediaviewer-widget",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build && vite build --mode lib",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.4",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/react": "^18.3.11",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^5.1.2",
    "jsdom": "^25.0.1",
    "typescript": "5.6.3",
    "vite": "^7.3.0",
    "vitest": "^4.0.16"
  }
}
```

- [ ] **Step 2: tsconfig.json + vitest.config.ts + setup.ts**

`mediaviewer-widget/tsconfig.json`: identisch zu `packages/videovault-player/tsconfig.json` (Step 1.2), zusätzlich `paths`:
```jsonc
{
  "compilerOptions": {
    "target": "ES2020", "module": "ESNext", "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "moduleResolution": "bundler", "jsx": "react-jsx", "strict": true,
    "esModuleInterop": true, "skipLibCheck": true, "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true, "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@videovault-player": ["../packages/videovault-player/src"],
      "@videovault-player/*": ["../packages/videovault-player/src/*"]
    }
  },
  "include": ["src/**/*"]
}
```
`mediaviewer-widget/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@videovault-player', replacement: path.resolve(__dirname, '..', 'packages', 'videovault-player', 'src') },
    ],
  },
  test: { environment: 'jsdom', globals: true, setupFiles: ['src/test/setup.ts'] },
});
```
`mediaviewer-widget/src/test/setup.ts`: identisch zu `packages/videovault-player/src/test/setup.ts` (Step 1.2).

- [ ] **Step 3: vite.config.ts mit Dual-Build**

`mediaviewer-widget/vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@videovault-player': path.resolve(__dirname, '..', 'packages', 'videovault-player', 'src'),
    },
  },
  build:
    mode === 'lib'
      ? {
          outDir: 'dist/lib',
          lib: {
            entry: path.resolve(__dirname, 'src/lib-entry.ts'),
            name: 'MediaviewerWidget',
            fileName: 'mediaviewer-widget',
            formats: ['es', 'umd'],
          },
          rollupOptions: {
            external: ['react', 'react-dom'],
            output: { globals: { react: 'React', 'react-dom': 'ReactDOM' } },
          },
        }
      : { outDir: 'dist/app' },
  server: { port: 5300 },
}));
```

- [ ] **Step 4: Dev-Harness + index.html**

`mediaviewer-widget/index.html`:
```html
<!doctype html>
<html lang="de">
  <head><meta charset="UTF-8" /><title>Mediaviewer Widget – Dev</title></head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/dev/main.tsx"></script>
  </body>
</html>
```
`mediaviewer-widget/src/dev/main.tsx`:
```tsx
import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<App />);
```
`mediaviewer-widget/src/dev/App.tsx` (Platzhalter bis Task 7):
```tsx
export function App() {
  return <div>Mediaviewer Widget – Dev Harness (Task 7 füllt dies)</div>;
}
```

- [ ] **Step 5: Install + Boot-Smoke**

Run: `cd /home/patrick/projects/mediaviewer-widget && npm install && npx tsc --noEmit`
Expected: kein Fehler.

- [ ] **Step 6: Commit**

```bash
cd /home/patrick/projects
git add -f mediaviewer-widget
git commit -m "feat(mediaviewer-widget): scaffold Vite app with dual (app+lib) build"
```

---

## Task 7: `MediaviewerWidget` + `HelpVideoPicker` (TDD)

Öffentlicher Kontrakt: Props + `forwardRef`-`MediaviewerHandle`. Picker rendert aus `props.videos`, Auswahl/Steuerung lösen Events und imperative Calls aus.

**Files:**
- Create: `mediaviewer-widget/src/HelpVideoPicker.tsx`
- Create: `mediaviewer-widget/src/MediaviewerWidget.tsx`
- Test: `mediaviewer-widget/src/MediaviewerWidget.test.tsx`
- Create: `mediaviewer-widget/src/lib-entry.ts`
- Modify: `mediaviewer-widget/src/dev/App.tsx`

- [ ] **Step 1: Failing test**

`mediaviewer-widget/src/MediaviewerWidget.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRef } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MediaviewerWidget } from './MediaviewerWidget';
import type { MediaviewerHandle, VideoSource } from '@videovault-player';

const VIDEOS: VideoSource[] = [
  { id: 'a', url: 'blob:a', title: 'Hilfe A' },
  { id: 'b', url: 'blob:b', title: 'Hilfe B' },
];

beforeEach(() => localStorage.clear());

describe('MediaviewerWidget', () => {
  it('rendert den Picker mit allen Hilfsvideo-Titeln', () => {
    render(<MediaviewerWidget videos={VIDEOS} />);
    expect(screen.getByText('Hilfe A')).toBeInTheDocument();
    expect(screen.getByText('Hilfe B')).toBeInTheDocument();
  });

  it('versteckt den Picker bei showPicker={false}', () => {
    render(<MediaviewerWidget videos={VIDEOS} showPicker={false} />);
    expect(screen.queryByTestId('help-video-picker')).toBeNull();
  });

  it('feuert onSelect bei Klick auf einen Picker-Eintrag', () => {
    const onSelect = vi.fn();
    render(<MediaviewerWidget videos={VIDEOS} onSelect={onSelect} />);
    fireEvent.click(screen.getByText('Hilfe B'));
    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('exponiert ein imperatives Handle: playVideo + getState', () => {
    const ref = createRef<MediaviewerHandle>();
    render(<MediaviewerWidget ref={ref} videos={VIDEOS} />);
    expect(ref.current).not.toBeNull();
    ref.current!.playVideo('b');
    expect(ref.current!.getState().currentId).toBe('b');
  });

  it('setPlaylist über das Handle aktualisiert die Auswahl', () => {
    const ref = createRef<MediaviewerHandle>();
    render(<MediaviewerWidget ref={ref} videos={VIDEOS} />);
    ref.current!.setPlaylist([{ id: 'x', url: 'blob:x', title: 'Neu X' }]);
    expect(screen.getByText('Neu X')).toBeInTheDocument();
    expect(ref.current!.getState().currentId).toBe('x');
  });
});
```

- [ ] **Step 2: Test laufen → FAIL**

Run: `cd /home/patrick/projects/mediaviewer-widget && npx vitest run src/MediaviewerWidget.test.tsx`
Expected: FAIL — `Failed to resolve import "./MediaviewerWidget"`.

- [ ] **Step 3: HelpVideoPicker implementieren**

`mediaviewer-widget/src/HelpVideoPicker.tsx`:
```tsx
import type { VideoSource } from '@videovault-player';

interface HelpVideoPickerProps {
  videos: VideoSource[];
  currentId: string | null;
  onPick(id: string): void;
}

export function HelpVideoPicker({ videos, currentId, onPick }: HelpVideoPickerProps) {
  return (
    <ul data-testid="help-video-picker" className="vv-help-picker">
      {videos.map((v) => (
        <li key={v.id}>
          <button
            type="button"
            aria-current={v.id === currentId}
            onClick={() => onPick(v.id)}
          >
            {v.posterUrl && <img src={v.posterUrl} alt="" width={96} />}
            <span>{v.title}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 4: MediaviewerWidget implementieren**

`mediaviewer-widget/src/MediaviewerWidget.tsx`:
```tsx
import { forwardRef, useImperativeHandle, useMemo, useState } from 'react';
import { VideoPlayer, useVideoPlayer } from '@videovault-player';
import type { MediaviewerHandle, MediaviewerWidgetProps, VideoSource } from '@videovault-player';
import { HelpVideoPicker } from './HelpVideoPicker';

export const MediaviewerWidget = forwardRef<MediaviewerHandle, MediaviewerWidgetProps>(
  function MediaviewerWidget(props, ref) {
    const { videos, showPicker = true, captureFrame, onSelect, onProgress, onEnded, onError } = props;
    const [playlist, setPlaylist] = useState<VideoSource[]>(videos);

    const player = useVideoPlayer({
      playlist,
      initialVideoId: props.initialVideoId,
      onSelect,
      onProgress,
      onEnded,
      onError,
    });

    useImperativeHandle(
      ref,
      (): MediaviewerHandle => ({
        playVideo: (id) => player.controls.playVideo(id),
        setPlaylist: (v) => {
          setPlaylist(v);
          player.controls.setPlaylist(v);
        },
        play: () => player.controls.play(),
        pause: () => player.controls.pause(),
        seek: (sec) => player.controls.seek(sec),
        getState: () => player.state,
      }),
      [player],
    );

    const current = player.current;
    const pickerVideos = useMemo(() => playlist, [playlist]);

    return (
      <div className="vv-mediaviewer">
        <VideoPlayer
          source={current}
          player={player}
          captureFrame={captureFrame}
          onPrev={player.controls.prev}
          onNext={player.controls.next}
        />
        {showPicker && (
          <HelpVideoPicker
            videos={pickerVideos}
            currentId={player.state.currentId}
            onPick={(id) => player.controls.playVideo(id)}
          />
        )}
      </div>
    );
  },
);
```
Schlüssel zur Korrektheit: Das Widget baut den `useVideoPlayer` **einmal** und reicht ihn via `player`-Prop an `VideoPlayer` durch. So steuern Picker-Klicks UND das imperative Handle denselben State, der auch das echte `<video>` treibt — kein doppelter State. Callbacks (`onSelect/onProgress/onEnded/onError`) sind bereits am Widget-`useVideoPlayer` gebunden und müssen daher NICHT erneut an `VideoPlayer` übergeben werden.

- [ ] **Step 5: Test laufen → PASS**

Run: `cd /home/patrick/projects/mediaviewer-widget && npx vitest run src/MediaviewerWidget.test.tsx`
Expected: PASS (5 Tests grün). Da `VideoPlayer` den durchgereichten `player` nutzt, steuern Handle und Picker denselben State — der „setPlaylist über Handle"-Test ist grün.

- [ ] **Step 6: lib-entry + Dev-Harness füllen**

`mediaviewer-widget/src/lib-entry.ts`:
```typescript
export { MediaviewerWidget } from './MediaviewerWidget';
export type { MediaviewerHandle, MediaviewerWidgetProps, VideoSource } from '@videovault-player';
```
`mediaviewer-widget/src/dev/App.tsx` ersetzen:
```tsx
import { useRef } from 'react';
import { MediaviewerWidget } from '../MediaviewerWidget';
import type { MediaviewerHandle, VideoSource } from '@videovault-player';

const DEMO: VideoSource[] = [
  { id: 'big-buck', url: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4', title: 'Big Buck Bunny' },
];

export function App() {
  const ref = useRef<MediaviewerHandle>(null);
  return (
    <div style={{ maxWidth: 720, margin: '2rem auto' }}>
      <h1>Mediaviewer Widget – Dev Harness</h1>
      <MediaviewerWidget ref={ref} videos={DEMO} onSelect={(id) => console.log('select', id)} />
      <button onClick={() => ref.current?.play()}>play() via Handle</button>
    </div>
  );
}
```

- [ ] **Step 7: Build-Smoke (beide Targets) + Typecheck**

Run: `cd /home/patrick/projects/mediaviewer-widget && npx tsc --noEmit && npm run build`
Expected: `dist/app` und `dist/lib` werden erzeugt, kein Fehler.

- [ ] **Step 8: Commit**

```bash
cd /home/patrick/projects
git add -f mediaviewer-widget/src
git commit -m "feat(mediaviewer-widget): MediaviewerWidget + HelpVideoPicker with imperative handle (TDD)"
```

---

## Task 8: Root-Scripts + Learnings-Log finalisieren

**Files:**
- Modify: `projects/package.json` (dev:widget + dev:all)
- Create: `docs/superpowers/specs/2026-06-15-videovault-migration-learnings.md`

- [ ] **Step 1: Root-Dev-Script ergänzen**

In `projects/package.json` `scripts` ergänzen:
```json
    "dev:widget": "cd mediaviewer-widget && npm run dev",
```
Und in `dev:all` die `concurrently`-Liste um das Widget erweitern (Label `widget`, Farbe `red`):
```json
    "dev:all": "concurrently -n \"l2p-fe,l2p-be,vault,shop,sos,widget\" -c \"green,blue,yellow,magenta,cyan,red\" \"cd l2p && npm run dev:frontend\" \"cd l2p && npm run dev:backend\" \"cd VideoVault && npm run dev\" \"cd shop && npm run dev\" \"cd SOS && npm run dev\" \"cd mediaviewer-widget && npm run dev\"",
```

- [ ] **Step 2: Learnings-Log schreiben**

`docs/superpowers/specs/2026-06-15-videovault-migration-learnings.md` mit den gesammelten, nicht-offensichtlichen Erkenntnissen:
```markdown
# VideoVault-Split — Migrations-Learnings (Rohmaterial für external-app-migration-Skill)

- **Source-only lokales Package via Vite-Alias** schlägt tsup-Build, wenn alle Konsumenten Vite/Vitest sind — analog `@shared`. Kein `prebuild`-Tanz nötig. Alias an drei Stellen pflegen: vite.config, vitest.config (Array-Form!), tsconfig.paths.
- **Vor dem Extrahieren prüfen, WO der State wirklich liegt.** Hier: gesamter Playback-State im Modal, nicht im 1762-Z.-`useVideoManager` → der geplante Hook-Split war überflüssig (YAGNI).
- **Dependency-Injection statt Stack-Verschiebung:** `captureFrame`-Prop entkoppelte den Player vom Thumbnail-/Server-/FSAA-Stack — Bibliothek blieb unangetastet.
- **FFmpeg.wasm 0.12 single-thread braucht KEIN COEP/SharedArrayBuffer.** Fehler war reine `new URL(...)`-Auflösung gegen `@ffmpeg/core` `exports`. Fix: Core nach `public/` kopieren + `toBlobURL`. Offline-/k8s-tauglich.
- **Backend-Interface (`VideoSplitterBackend`) vor der Migration einziehen**, damit der GPU-Worker-Swap in Sub-Projekt 2 die UI nicht berührt.
- **`as`-Casts an UI↔Service-Grenzen sind Mismatch-Verstecke** (`SplitVideoFormValues` vs `SplitVideoOptions`) — durch expliziten Mapper ersetzt.
- (Während der Umsetzung weiter ergänzen.)
```

- [ ] **Step 3: Volle Verifikation**

Run: `cd /home/patrick/projects/VideoVault && npm run test:client && npx tsc`
Expected: grün.
Run: `cd /home/patrick/projects/packages/videovault-player && npx vitest run && npx tsc --noEmit`
Expected: grün.
Run: `cd /home/patrick/projects/mediaviewer-widget && npx vitest run && npx tsc --noEmit`
Expected: grün.

- [ ] **Step 4: Commit**

```bash
cd /home/patrick/projects
git add -f package.json docs/superpowers/specs/2026-06-15-videovault-migration-learnings.md
git commit -m "chore(videovault): add dev:widget root script + migration learnings log"
```

---

## Definition of Done (Sub-Projekt 1)

- `packages/videovault-player` exportiert `VideoPlayer`, `useVideoPlayer`, `defaultCaptureFrame` + Typen; eigene Tests grün.
- Bibliothek (`VideoVault`) nutzt den geteilten `VideoPlayer`; gesamte bestehende Unit-Suite grün, Coverage-Schwellen gehalten.
- FFmpeg-Schneiden reaktiviert, hinter `VideoSplitterBackend`; Splitter erstmals (Guard-)getestet; `as`-Cast in `home.tsx` ersetzt.
- `mediaviewer-widget` baut App + Library, `MediaviewerWidget` mit Props + imperativem `MediaviewerHandle`, Picker für Hilfsvideos; Tests grün.
- **Design-System (Task D):** token-getriebenes, host-themebares (dark/light) Styling für Player + Widget; Controls inkl. Scrubber/Fullscreen/PiP; States (empty/idle/loading/buffering/error) + Poster-Platzhalter; Lib-Build bündelt `index.css`. ✅
- `dev:widget` im Root, Learnings-Log angelegt.
- **Bewusst NICHT enthalten** (Sub-Projekt 2/3): Containerisierung, k8s-Manifeste, Keycloak-Auth, GPU-Worker-ffmpeg-Backend, Companion-Panel-Einbettung, das Migrations-Skill selbst.
