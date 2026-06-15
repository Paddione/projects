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

## useVideoManager-Refactor

Der 1762-Zeilen-Hook wird in drei fokussierte Einheiten zerlegt:

| Neu | Verantwortung | Ablageort |
|---|---|---|
| `useVideoPlayer` | Playback-State: current source, time, playing, volume, speed, Playlist-Navigation | **Player-Package** (Widget + Bibliothek) |
| `useVideoLibrary` | Scan, Filter, Bulk, Categorize, Sort, Presets | **Bibliothek** (schlanker Rest von useVideoManager) |
| `useVideoDatabase` | CRUD/Persistenz (localStorage + API) | **Bibliothek** |

Das Widget nutzt **nur** `useVideoPlayer` + Props — kein `useVideoManager`. `video-player-modal.tsx` (781 Z.) wird zu `VideoPlayer.tsx` ohne Modal-Hülle und ohne `onSplitVideo`-Prop (Bibliotheks-only).

## Server & FFmpeg-Fix

- **Server bleibt vollständig bei der Bibliothek.** Widget = serverlos.
- **FFmpeg-Fix** (`client/src/services/video-splitter.ts`): Aktuell wirft `getFFmpeg()` hart `Error('FFmpeg loading is temporarily disabled due to build issues.')`. Ursache laut Stub-Kommentar: fehlende `"./dist/umd/ffmpeg-core.js"`-Spezifizierung in `@ffmpeg/core` unter Vite. Der echte Loader nutzt bereits `new URL('@ffmpeg/core/dist/umd/ffmpeg-core.js', import.meta.url)`.
  - **Lösung:** `@ffmpeg/core` aus `optimizeDeps` ausschließen; Core/WASM/Worker per `toBlobURL` + `?url` laden; **COOP/COEP-Header** (`Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Embedder-Policy: require-corp`) im Vite-Dev-Server und in der Bibliotheks-Prod-Auslieferung setzen, da FFmpeg.wasm `SharedArrayBuffer` (Cross-Origin-Isolation) benötigt.
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

1. **Characterization-Tests zuerst** auf `useVideoManager` *vor* dem Schnitt — Golden-Master, der das Ist-Verhalten einfriert und beweist, dass der Split nichts ändert.
2. **TDD an den neuen Grenzen:** `useVideoPlayer` (Playback-State-Maschine), `<MediaviewerWidget>` (Props rendern Picker; `playVideo`/`seek` über Handle; Events feuern; `onError`-Pfad).
3. **Bibliothek grün halten:** bestehende Vitest- + Playwright-Suite muss nach dem Player-Austausch durchlaufen; Per-File-Coverage-Schwellen (filter-engine 90/95 etc.) bleiben erhalten.
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

1. Characterization-Tests auf `useVideoManager`.
2. `packages/videovault-player` anlegen; pure-Browser-Services + `VideoPlayer` + `useVideoPlayer` dorthin extrahieren (mit ihren Tests).
3. Bibliothek (`VideoVault/client`) auf das Package umstellen; Suite grün.
4. FFmpeg-Fix hinter `VideoSplitterBackend`-Interface (WASM-Impl) + Integrationstest.
5. `mediaviewer-widget`-App: `MediaviewerWidget` (Props + Handle) + `HelpVideoPicker` + Dev-Harness; TDD.
6. Vite-Dual-Build (App + Library) fürs Widget.
7. Learnings-Log finalisieren.

## Out of Scope

- **Sub-Projekt 2 (Migration):** Dockerfile(s), `k3d/<app>.yaml`-Manifeste, Ingress, SealedSecrets, Keycloak/oauth2-proxy-Auth, Taskfile-Deploy-Tasks, Companion-Panel-Einbettung. **Inklusive Umstellung des Schneide-Backends auf serverseitiges ffmpeg am GPU-Worker** (zweite Implementierung von `VideoSplitterBackend`). Eigener Spec→Plan-Zyklus.
- **Sub-Projekt 3 (Skill):** `external-app-migration/SKILL.md` mit Frontmatter + Runbook. Eigener Zyklus, gespeist aus dem Learnings-Log.
