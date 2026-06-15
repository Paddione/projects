# VideoVault-Migration — Learnings Log

## Phase 2d — Mediaviewer-Companion-Panel (2026-06-15)

**PR:** https://github.com/Paddione/Bachelorprojekt/pull/1729

### Portal-Origin ≠ Apex
Apex redirectet auf `web.<domain>` → die Widget-Allowlist musste auf den echten Portal-Origin korrigiert werden (postMessage-Origin-Check verwirft sonst still). Die `VITE_ALLOWED_PARENT_ORIGINS` im Widget-Build referenzierte die Apex-Domains (`mentolder.de`, `korczewski.de`), aber das Portal läuft unter `web.mentolder.de` / `web.korczewski.de`. Ohne Fix bleibt das Mediaviewer-Panel leer, weil die Widget-Bridge `setVideos` aus einem nicht gelisteten Origin verwirft.

### Host besitzt die Bridge-Hälfte
Pures `mediaviewer-bridge.ts` (Protokoll-Guard) + Origin-/Source-Validierung in der Komponente — symmetrisch zum Widget; DI-tauglich/testbar ohne echtes iframe. Der Host validiert `event.origin` selbst, da das Widget an `'*'` posted.

### VideoSource-Drift Spec↔Code
Vendored Package (`videovault-player`) nutzt `poster`/`duration`, nicht `posterUrl`/`durationSec` — Manifest-Schema gegen den Code, nicht die Spec geschrieben. Der Zod-Loader validiert gegen das tatsächliche `VideoSource`-Interface (siehe `packages/videovault-player/src/types.ts`).

### iframe-SSO-Fragilität
oauth2-proxy/Keycloak-Redirect im iframe braucht `frame-ancestors`-Freigabe oder Session-Vorwärmen — relevant für jedes künftige Companion-Panel. Das Widget liegt hinter `oauth2-proxy-mediaviewer`, was im iframe zu blockierten Keycloak-Redirects führen kann, wenn `X-Frame-Options`/`frame-ancestors` nicht entsprechend konfiguriert sind.

### Statisches Manifest statt API
YAGNI — kein neuer Endpoint; die „Companion-Steckdose" wird nur verdrahtet, nicht der Companion gebaut. `help-videos.json` ist ein versioniertes, statisches Manifest im Frontend-Repo. URLs zeigen auf den VideoVault-Service; echte Medien-URLs sind ein Folge-Task.

### Widget-Rebuild nach Allowlist-Änderung
Die Änderung an `.github/workflows/build-mediaviewer-widget.yml` triggert den Widget-Rebuild nur bei Push auf `main` — für manuelles Triggern wurde `workflow_dispatch` ergänzt (PR #1730).
