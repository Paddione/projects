# VideoVault Split — Mediaviewer-Widget + Bibliothek — Design Spec

**Date:** 2026-06-15
**Status:** Draft — pending user review
**Repo:** `~/projects/` (Branch `feature/videovault-split`)
**Service:** VideoVault

## Context

`projects/VideoVault` ist heute eine einzelne React/TypeScript/Vite-App (Client + optionaler Express-Server), die Video-**Wiedergabe**, **Kategorisierung/Tagging**, **Schneiden (Cutting/Split)**, **Scanning**, **Bulk-Operationen** und **Filterung** in einem Frontend bündelt. Die gesamte Orchestrierung läuft über einen einzigen Hook `client/src/hooks/use-video-manager.ts` (**1762 Zeilen**), der Scan, Playback, Editing, Bulk, Filter und Persistenz vermischt.

Patrick will VideoVault in **zwei Apps** zerlegen und beide anschließend in die Kubernetes-Workspace-Plattform (`~/Bachelorprojekt/`) übernehmen. Aus den Learnings soll ein wiederverwendbares Skill zur Migration von Fremdcode entstehen.

Dieses Dokument spezifiziert **nur Sub-Projekt 1: den Split innerhalb von `~/projects/`**. Migration (Sub-Projekt 2) und Migrations-Skill (Sub-Projekt 3) erhalten eigene Spec→Plan→Umsetzungs-Zyklen (siehe [Out of Scope](#out-of-scope)).

## Gesamtvorhaben (Decomposition)

| # | Sub-Projekt | Repo | Status |
|---|---|---|---|
| **1** | VideoVault in Mediaviewer-Widget (Player) + Bibliothek (Schneiden/Kategorisieren) zerlegen | `~/projects/` | **dieser Spec** |
| 2 | Beide Apps ins Bachelorprojekt übernehmen (Container, Kustomize, Ingress, Keycloak-Auth) | `~/projects/` → `~/Bachelorprojekt/` | später |
| 3 | Fremdcode-Migrations-Skill aus den Learnings | `~/Bachelorprojekt/.claude/skills/` | später |

Abhängigkeit: **1 → 2 → 3**. Reihenfolge bewusst: erst in-place gegen die bestehende Vitest/Playwright-Suite stabilisieren, dann migrieren — die Migration wird so ein sauberer „nimm zwei fertige Apps"-Schritt, und Sub-Projekt 1 + 2 liefern den Stoff fürs Skill.

## Bestätigte Entscheidungen (aus dem Brainstorming)

1. **Einbettungsziel:** Companion-Panel im Bachelorprojekt-Workspace → das Widget wird ein **eigenständig deploybares, statisches Frontend** (kein Server). Auth ist Sache des Hosts (Keycloak/oauth2-proxy), erst in Sub-Projekt 2 relevant.
2. **Reihenfolge:** Erst Split in `projects/`, dann migrieren.
3. **Widget-Scope:** Reiner Player „erstmal", **aber** mit (a) Auswahl-UI für Hilfsvideos und (b) expliziter Schnittstelle für einen späteren „Brainstorm-Companion".
4. **Daten-Kontrakt:** **Props + imperatives API.** Host/Companion besitzt die Video-Liste und steuert per `ref`-Handle. Widget bleibt zustandslos, kein eigener Datenzugriff.
5. **FFmpeg-Fix:** **In Scope** (Begründung in [§ Server & FFmpeg](#server--ffmpeg-fix)). Im Review-Gate umkehrbar.

## Goals

- VideoVault in drei klar abgegrenzte Einheiten zerlegen: ein geteiltes **Player-Package**, eine **Widget-App**, die bestehende App als **Bibliothek**.
- Den 1762-Zeilen-`useVideoManager` in drei fokussierte Hooks auflösen (`useVideoPlayer`, `useVideoLibrary`, `useVideoDatabase`).
- Ein props-driven Mediaviewer-Widget mit imperativem `MediaviewerHandle`-API als zukünftige Companion-Schnittstelle.
- Das aktuell deaktivierte FFmpeg-Schneiden wieder funktionsfähig machen.
- Bestehende Test-Suite grün halten; neue Grenzen per TDD absichern; Verhalten via Characterization-Tests vor dem Refactor einfrieren.
- Ein laufendes Learnings-Log als Rohmaterial für das spätere Migrations-Skill.

## Non-Goals (YAGNI)

- **Kein** Brainstorm-Companion bauen — nur die Schnittstelle (`MediaviewerHandle` + Events) bereitstellen.
- **Kein** Schneiden/Kategorisieren im Widget.
- **Keine** Persistenz/kein File System Access/**kein** Server im Widget.
- **Keine** Migration ins Bachelorprojekt in diesem Sub-Projekt.
- **Kein** Rename des `VideoVault/`-Verzeichnisses (bleibt = Bibliothek), um bestehende Deploy-Scripts/CI nicht zu brechen.
- Keine neuen Features in der Bibliothek über den FFmpeg-Fix hinaus.

## Architecture — drei Einheiten

Saubere Trennung über ein geteiltes Player-Package nach dem etablierten `file:packages/*`-Idiom (`shared-3d`, `error-handling`):

```
projects/
├── packages/
│   ├── error-handling/                  # bestehend
│   └── videovault-player/      ← NEU    # reiner Browser-Player, KEIN Server
│       ├── src/
│       │   ├── VideoPlayer.tsx          # aus video-player-modal.tsx (781 Z., de-modalisiert)
│       │   ├── useVideoPlayer.ts        # Playback-State (aus useVideoManager extrahiert)
│       │   ├── services/                # video-thumbnail, thumbnail-generator, adaptive-*,
│       │   │                            #   thumbnail-cache, webcodecs-*, video-url-registry,
│       │   │                            #   sprite-cache, workers/thumbnail-worker
│       │   └── types.ts                 # VideoSource, PlayerState, MediaviewerHandle
│       └── package.json                 # build → dist/ (wie shared-3d), prebuild-Guard
│
├── mediaviewer-widget/         ← NEU    # die Widget-App (props-driven, statisch)
│   ├── src/
│   │   ├── MediaviewerWidget.tsx        # öffentl. Kontrakt: Props + forwardRef-Handle
│   │   ├── HelpVideoPicker.tsx          # Auswahl-UI, rendert aus props.videos
│   │   └── dev/App.tsx                  # Dev-Harness zum lokalen Ausprobieren
│   ├── vite.config.ts                   # 2 Targets: App (dev) + Library (embed/dist)
│   └── package.json                     # "videovault-player": "file:../packages/videovault-player"
│
└── VideoVault/                 ← bleibt = die BIBLIOTHEK
    ├── client/  → konsumiert videovault-player für die eigene Wiedergabe
    │            → behält Scan, Categorize, Cut (FFmpeg gefixt), Bulk, Filter, Persistence
    └── server/  → bleibt vollständig bei der Bibliothek (Widget braucht keinen Server)
```

**Trade-off — geteiltes Package statt Player duplizieren:** Beide Apps brauchen Player + Thumbnail-Generierung. Duplizieren erzeugt Drift und doppelte Pflege. Das geteilte Package hält eine Wahrheit für die Wiedergabe und macht den sauberen Reuse zum Vorzeige-Learning fürs Migrations-Skill. Kosten: ein `prebuild`-Schritt — exakt das Muster, das `shared-3d` bereits verwendet (`test -d packages/shared-3d/dist || npm --prefix packages/shared-3d run build`).

**Warum das Widget serverlos wird:** Der gesamte Server-Bedarf (Persistence, Processing, Tags, Duplicates, Thumbnails-on-demand) gehört zur Bibliothek. Das Widget erhält Video-URLs über Props und generiert Thumbnails/Sprites client-seitig (WebCodecs/Canvas, bereits isolierte Services). Resultat: ein rein statisches Frontend → in Sub-Projekt 2 ein winziges `static-web-server`-Image.

## Der Widget-Kontrakt

Das Herzstück (Entscheidung: Props + imperatives API). Der Companion wird **nie** als Datenabhängigkeit verdrahtet, sondern erhält eine explizite Kontroll-Schnittstelle:

```ts
// videovault-player/src/types.ts
interface VideoSource {
  id: string;
  url: string;              // Host liefert die abspielbare URL (Auth ist Host-Sache)
  title: string;
  posterUrl?: string;       // optional; sonst client-seitig generiert
  spriteUrl?: string;       // optional, für Scrubbing-Preview
  durationSec?: number;
  tags?: string[];          // read-only Anzeige; später vom Companion gefüllt
}

interface MediaviewerHandle {            // imperatives API (via ref) — DIE Companion-Schnittstelle
  playVideo(id: string): void;
  setPlaylist(videos: VideoSource[]): void;
  play(): void;
  pause(): void;
  seek(sec: number): void;
  getState(): { currentId: string | null; timeSec: number; playing: boolean };
}

interface MediaviewerWidgetProps {
  videos: VideoSource[];          // die (Hilf-)Video-Liste → speist HelpVideoPicker
  initialVideoId?: string;
  showPicker?: boolean;           // Auswahl-UI an/aus
  onSelect?(id: string): void;
  onProgress?(sec: number): void;
  onEnded?(id: string): void;
  onError?(err: Error): void;
}
```

Design-Move: Heute füllt der Host `videos` mit Hilfsvideos; morgen ruft ein Brainstorm-Companion `handle.playVideo("intro-feature-x")` zur passenden Stelle auf. Wir bauen den Companion nicht — wir bauen nur die Steckdose. YAGNI-konform und zukunftssicher.

## Player-Extraktion (Korrektur nach Code-Analyse)

**Befund:** `useVideoManager` (1762 Z.) enthält **keinen** Playback-State — der gesamte echte Playback-Zustand (`isPlaying`, `currentTime`, `volume`, `playbackRate`, `isFullscreen`, `isPip`, `buffered`, Scrub/Hover, MediaSession) lebt **lokal in `video-player-modal.tsx` (781 Z.)** über `useState`/`useRef`. `useVideoManager` hält nur `currentVideo`/`pinnedVideoId` und ist sonst reine Library/Persistence-Orchestrierung.

**Konsequenz (YAGNI):** Der ursprünglich geplante 3-fach-Split von `useVideoManager` entfällt — er ist für den Widget/Library-Split nicht nötig. `useVideoManager` bleibt unverändert in der Bibliothek. Die einzige Extraktion ist der **Player aus dem Modal**:

| Neu (im Player-Package) | Quelle | Verantwortung |
|---|---|---|
| `useVideoPlayer` | lokaler State aus `video-player-modal.tsx` | Playback-State-Maschine: source, time, playing, volume, rate (localStorage-persistiert), buffered, scrub, fullscreen/PiP, Playlist-Nav |
| `VideoPlayer.tsx` | Player-Markup aus `video-player-modal.tsx` | Präsentations-Player (video-Element, Controls, Scrub-Bar, MediaSession) — props-driven |

`video-player-modal.tsx` wird in der Bibliothek zu einer **dünnen Hülle**: `<Dialog>`-Chrome + `<VideoPlayer>` + die Library-Side-Panels (Tags-Editor, Splitter). Die playback-fremden Props (`onSplitVideo`, `onUpdateVideo`, `onRemoveCategory`, `onFocusMode`, `availableCategories`, `onRescan`) bleiben am Modal, nicht am `VideoPlayer`.

**Scrub-Preview per Dependency-Injection:** `VideoPlayer` erhält eine optionale `captureFrame?(src, timeSec): Promise<string>`-Prop. Das Package liefert eine minimale, reine Canvas-Default-Implementierung (`defaultCaptureFrame`); die Bibliothek injiziert ihre reichere `VideoThumbnailService.captureFrameAtTime`. So bleibt das Player-Package **frei vom Thumbnail-/Server-/FSAA-Stack** — der bleibt vollständig in der Bibliothek.

## Server & FFmpeg-Fix

- **Server bleibt vollständig bei der Bibliothek.** Widget = serverlos.
- **FFmpeg-Fix** (`client/src/services/video-splitter.ts`): Aktuell wirft `getFFmpeg()` hart `Error('FFmpeg loading is temporarily disabled due to build issues.')`. Ursache laut Stub-Kommentar: fehlende `"./dist/umd/ffmpeg-core.js"`-Spezifizierung in `@ffmpeg/core` unter Vite. Der echte Loader nutzt bereits `new URL('@ffmpeg/core/dist/umd/ffmpeg-core.js', import.meta.url)`.
  - **Lösung (korrigiert):** Die installierte Variante ist `@ffmpeg/core@0.12` (**Single-Thread**), die **kein** `SharedArrayBuffer` und damit **kein COOP/COEP** braucht (Helmet setzt COEP in `server/middleware/security.ts` bewusst auf `false` — das bleibt so). Der eigentliche Fehler ist die `new URL('@ffmpeg/core/dist/umd/…', import.meta.url)`-Auflösung, die am `exports`-Feld von `@ffmpeg/core` scheitert. Fix: ein `scripts/copy-ffmpeg-core.mjs` kopiert `ffmpeg-core.js` + `ffmpeg-core.wasm` aus `node_modules/@ffmpeg/core/dist/umd/` nach `client/public/ffmpeg/` (wired als `predev`/`prebuild`, keine neue Dependency), und `getFFmpeg` lädt per `toBlobURL('/ffmpeg/ffmpeg-core.js', 'text/javascript')` + `toBlobURL('/ffmpeg/ffmpeg-core.wasm', 'application/wasm')`. Zusätzlich `@ffmpeg/core` + `@ffmpeg/ffmpeg` in `optimizeDeps.exclude`. Offline-/k8s-tauglich (kein CDN).
  - **Warum in Scope:** „Schneiden" ist ein Kern-Feature der Bibliothek. Eine Bibliothek mit kaputtem Schneiden ist kein sauberer Migrations-Input. Risiko früh in vertrauter CI klären — die COEP-Anforderung schlägt zudem bis ins k8s-Ingress (Sub-Projekt 2) durch und ist dort besser bekannt als überraschend.
  - **Backend-Abstraktion (wegen GPU-Worker):** `video-splitter.ts` wird hinter ein schmales `VideoSplitterBackend`-Interface gelegt (`split(source, cuts) → Segment[]`). Die WASM-Variante ist die erste Implementierung. Hintergrund: Auf dem GPU-Worker des Bachelorprojekts existiert bereits ein natives `ffmpeg`-Binary (serverseitig, hardware-beschleunigt, kein `SharedArrayBuffer`/COEP). In Sub-Projekt 2 kann das Schneide-Backend dadurch auf einen Server-Endpoint umgestellt werden, der das native ffmpeg nutzt, **ohne die Bibliotheks-UI zu berühren**. Das Interface ist die einzige Zusatzinvestition in Sub-Projekt 1; der serverseitige Backend selbst ist Out of Scope.

## Datenfluss

**Widget (Sub-Projekt 1, lokal über Dev-Harness verifiziert):**
```
Host/Dev-Harness reicht videos[] + ref ein
  → MediaviewerWidget rendert HelpVideoPicker (aus props.videos)
  → User wählt / Companion ruft handle.playVideo(id)
    → useVideoPlayer setzt current source
    → VideoPlayer spielt url; Thumbnails/Sprites client-seitig
    → Events: onSelect / onProgress / onEnded an Host
```

**Bibliothek (unverändert in der Logik, Player via geteiltes Package):**
```
Scan → useVideoLibrary füllt videos[]
  → Filter/Sort/Bulk/Categorize über useVideoLibrary
  → Playback über useVideoPlayer (jetzt aus videovault-player)
  → Cut über video-splitter.ts (FFmpeg gefixt)
  → Persistenz über useVideoDatabase (localStorage + Server-API)
```

## Error Handling

- **Widget:** Fehler (nicht ladbare URL, Decode-Fehler) werden gefangen und über `onError(err)` an den Host gemeldet; das Widget zeigt einen nicht-blockierenden Fehlerzustand und bleibt bedienbar (nächstes Video wählbar). Keine Exceptions über die Komponenten-Grenze.
- **FFmpeg:** Statt hartem Reject ein definierter Fehlerpfad — Lade-/Verarbeitungsfehler werden geloggt und der Bibliotheks-Toast-Mechanismus meldet sie; kein stiller Fallback, der ein Scheitern als Erfolg tarnt.
- Bestehende Server-Middleware (errorHandler, async-error-handler) bleibt unangetastet.

## Testing Strategy

1. **TDD an den neuen Grenzen zuerst:** `useVideoPlayer` (Playback-State-Maschine) wird per TDD aufgebaut, bevor der Player aus dem Modal gezogen wird — der Player ist heute ungetestet, also ist der neue Hook-Test das Sicherheitsnetz für die Extraktion.
2. **TDD weiter:** `<VideoPlayer>` (Controls, Scrub, Events), `<MediaviewerWidget>` (Props rendern Picker; `playVideo`/`seek` über Handle; Events feuern; `onError`-Pfad).
3. **Bibliothek grün halten:** bestehende Vitest- + Playwright-Suite muss nach dem Umbau des Modals zur `VideoPlayer`-Hülle durchlaufen — das ist der Regressions-Guard; Per-File-Coverage-Schwellen (filter-engine 90/95 etc.) bleiben erhalten.
4. **FFmpeg-Integrationstest:** „Split erzeugt 2 Segmente mit erwarteten Dauern".
5. Test-Runner unverändert: `npx vitest run`, single-threaded, Stubs aus `vitest.config.ts`.

## Migration-Learnings-Instrumentierung

Ab Sub-Projekt 1 wird ein knappes Learnings-Log geführt (`docs/superpowers/specs/2026-06-15-videovault-migration-learnings.md`): jede nicht-offensichtliche Entscheidung + jeder Stolperstein (FFmpeg-wasm + COEP, Characterization-vor-Refactor, props-driven Grenze, `file:`-Package-Build-Reihenfolge). Dieses Log wird in Sub-Projekt 3 zum Runbook des `external-app-migration`-Skills destilliert.

## Risks & Mitigations

| Risiko | Schwere | Mitigation |
|---|---|---|
| `useVideoManager`-Split bricht subtiles Verhalten | hoch | Characterization-Tests **vor** dem Refactor; in kleinen Schritten, Suite nach jedem Schritt grün |
| FFmpeg-wasm + COOP/COEP zickt unter Vite | mittel | Früh isoliert angehen; Integrationstest; COEP-Anforderung dokumentieren für k8s |
| Geteiltes Package erzeugt Build-Reihenfolge-Probleme | niedrig | `prebuild`-Guard wie bei `shared-3d` übernehmen |
| „Sweeping refactor" widerspricht Change-Discipline | mittel | Phasen + Test-Gates; jede Phase eigenständig grün und committbar |
| Doppelte Thumbnail-Services (Drift Widget↔Bibliothek) | mittel | Services leben ausschließlich im geteilten Package; beide importieren von dort |

## Build Sequence (grob — Detailplan folgt via writing-plans)

1. `packages/videovault-player` scaffolden (source-only Package wie `error-handling`); Aliase in vite/vitest/tsconfig verdrahten.
2. `useVideoPlayer` per TDD extrahieren (aus Modal-State).
3. `VideoPlayer.tsx` + `defaultCaptureFrame` extrahieren; Tests.
4. Bibliotheks-Modal zur `<VideoPlayer>`-Hülle umbauen (captureFrame injizieren); volle Suite grün.
5. FFmpeg-Fix hinter `VideoSplitterBackend`-Interface (WASM-Impl, `toBlobURL` + Core-Copy) + Integrationstest; expliziten `SplitVideoFormValues→SplitVideoOptions`-Mapper statt `as`-Cast.
6. `mediaviewer-widget`-App scaffolden (Vite, Dual-Build App+Library).
7. `MediaviewerWidget` (Props + `forwardRef`-Handle) + `HelpVideoPicker` per TDD; Dev-Harness.
8. Root-Scripts (`dev:widget`) + Learnings-Log finalisieren.

## Out of Scope

- **Sub-Projekt 2 (Migration):** Dockerfile(s), `k3d/<app>.yaml`-Manifeste, Ingress, SealedSecrets, Keycloak/oauth2-proxy-Auth, Taskfile-Deploy-Tasks, Companion-Panel-Einbettung. **Inklusive Umstellung des Schneide-Backends auf serverseitiges ffmpeg am GPU-Worker** (zweite Implementierung von `VideoSplitterBackend`). Eigener Spec→Plan-Zyklus.
- **Sub-Projekt 3 (Skill):** `external-app-migration/SKILL.md` mit Frontmatter + Runbook. Eigener Zyklus, gespeist aus dem Learnings-Log.
