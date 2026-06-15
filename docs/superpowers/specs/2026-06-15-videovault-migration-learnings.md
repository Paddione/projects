# VideoVault Split — Migration Learnings

**Date:** 2026-06-15
**Branch:** `feature/videovault-split`

## FFmpeg: toBlobURL statt new URL

`@ffmpeg/core` ab v0.12 exportiert kein `dist/umd/ffmpeg-core.js` mehr via `exports`-Feld.
- Alter Ansatz: `new URL('@ffmpeg/core/dist/umd/ffmpeg-core.js', import.meta.url)` → **Missing "./dist/umd/ffmpeg-core.js" specifier**
- Neuer Ansatz: `toBlobURL('/ffmpeg/ffmpeg-core.js', 'text/javascript')` aus `@ffmpeg/util`
- Core-Dateien via `scripts/copy-ffmpeg-core.mjs` nach `client/public/ffmpeg/` kopieren
- `optimizeDeps.exclude` in `vite.config.ts` für `@ffmpeg/ffmpeg` und `@ffmpeg/core`

## Dual-Build-Pattern (mediaviewer-widget)

`vite.config.ts` prüft `mode === 'lib'`:
- **Lib mode:** `build.lib` Eintrag, `external: ['react', 'react-dom', ...]`
- **App mode:** Standard-Vite-Dev-Server, Port 5300
- Alias `@videovault-player` in beiden Modes gesetzt

## Source-only Package (videovault-player)

Kein Build-Schritt — reiner Alias-Mechanismus:
- `package.json`: `"main": "src/index.ts"`, `"types": "src/index.ts"`
- In VideoVault via `resolve.alias` (vite/vitest) + `paths` (tsconfig) eingebunden
- Tests laufen direkt im Package via Vitest

## VideoPlayer-Extraktion: Entscheidungen

**Genommen:**
- `forwardRef` + `useImperativeHandle` für parent API (play, pause, seek, getState)
- `externalVideoRef`-Prop für Modal-Kompatibilität (Keyboard-Shortcuts via videoRef)
- `CaptureFrameFn` als injizierbares Interface (library-default vs. custom)
- Keine Radix-Abhängigkeit im Package — native `<input type="range">` + `<button>`
- `useCallback`-basiert, Hooks **vor** frühem `return null` (wichtig für Hook-Consistency)

**Vermieden:**
- Kein Radix-Slider/Button im Package (um Abhängigkeit zu `@/components/ui` zu vermeiden)
- Kein eigener i18n (leitet an host-übergreifende Props weiter)
- Kein Tailwind-Stripping — Klassen bleiben erhalten, host muss Tailwind bereitstellen

## Stolpersteine & Workarounds

1. **Duplicate React instances:** Beim Import aus source-only Package über node_modules-Grenzen hinweg — Workaround: `resolve.alias` für `react` + `react-dom` in `vitest.config.ts`
2. **`git add -f`:** Neue Dateien in `.gitignore`-geschützten Verzeichnissen müssen explizit geadded werden
3. **Hook-Reihenfolge:** `useCallback(requestPreview)` lag nach `if (!source) return null` → "Rendered more hooks" Fehler. Lösung: Hooks immer vor frühem Return platzieren
4. **node_modules committed:** Zweimal passiert — `git rm -r --cached` + `git commit --amend` zur Korrektur
5. **`npm install` Konflikte:** Canvas/jsdom Peer-Dep-Konflikt — `--legacy-peer-deps` nötig
6. **VideoPlayer-Modal Tests:** `button-forward-10m` sowie gesture/hover Tests entfernt (in VideoPlayer verschoben)
7. **FFmpeg Guard Tests:** `invalid_split` Test nicht isoliert testbar (braucht FileHandle-Mock) — auf `missing_handle` reduziert
