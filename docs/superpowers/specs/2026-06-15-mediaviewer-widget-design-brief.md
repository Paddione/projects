# VideoVault — Mediaviewer-Widget · Design-Brief

**Date:** 2026-06-15
**Status:** Ready for frontend-design
**Repo:** `github.com/Paddione/projects` @ `feature/videovault-split`
**Bezug:** [VideoVault Split — Design Spec](./2026-06-15-videovault-split-design.md) (§ Widget-Kontrakt)

> Dieses Ticket ist der Auftrag an die `frontend-design`-Skill: Es liefert Brand, Scope,
> Ästhetik-Direktive, Constraints und Code-Links für die visuellen Assets des Widgets.

---

## 1. Brand & Blurb

**VideoVault** — der aus der gleichnamigen Bibliothek extrahierte, eigenständig deploybare
**Mediaviewer**. Ein reiner Browser-Player mit Hilfsvideo-Auswahl, der als **Companion-Panel**
in eine fremde Host-Oberfläche (die Kubernetes-Workspace-Plattform) eingebettet wird. Kein
Server, kein eigener Datenzugriff — der Host besitzt die Videos, das Widget zeigt und spielt.

## 2. Was zu designen ist

| Einheit | Inhalt |
|---|---|
| **VideoPlayer** | Controls, Scrub-Bar **mit Frame-Preview** beim Hover/Scrub, Play/Pause, Volume + Mute, Playback-Rate, Fullscreen + Picture-in-Picture, Playlist-Navigation (Prev/Next), MediaSession-fähige Metadaten-Darstellung |
| **HelpVideoPicker** | Auswahl-UI, gerendert aus `props.videos`. Liste/Grid mit Poster, Titel, optionaler Dauer und **read-only Tags**. Aktiver/ausgewählter Zustand klar erkennbar. Per `showPicker` ein-/ausblendbar |
| **Grafiken & States** | Poster-Platzhalter (wenn `posterUrl` fehlt), Empty (keine Videos), Loading, Buffering, Error, Scrub-Preview-Optik, kohärentes Icon-Set für die Controls |

## 3. Ästhetik-Direktive — „Workspace-Host neutral"

- **Token-agnostisch & themebar:** vollständig über CSS-Variablen steuerbar, **kein
  hartkodiertes Branding**. Der Host injiziert seine Theme-Tokens; das Widget übernimmt sie.
- **Schlankes, unaufdringliches Panel:** das Widget ist Gast in einer fremden UI, nicht der
  Star der Seite. Ruhige Flächen, klare Hierarchie, dezente Akzente.
- **Dark-first, light-fähig:** Default dunkel (wie die Bibliothek), aber ohne Annahme — beide
  Modi müssen über Tokens funktionieren.
- **Kein CSS-Bleed:** Styles sind nach innen gekapselt (scoped) und lecken weder in den Host
  noch nehmen sie unkontrolliert globale Host-Styles an.
- **Responsiv im Panel-Kontext:** funktioniert von schmaler Companion-Spalte bis breitem Panel,
  nicht nur als Vollbild-Seite.

## 4. Constraints

- **Serverless / statisch** — rein clientseitiges Frontend, keine Server-Roundtrips.
- **Props-driven & zustandslos** — der Host besitzt die Video-Liste und steuert per `ref`-Handle.
  Das Widget hält keinen Daten-State und keine eigene Persistenz.
- **Clientseitige Thumbnails/Sprites** — Frame-Previews werden via WebCodecs/Canvas erzeugt
  (injizierte `captureFrame`-Funktion); kein Server, kein Download on demand.
- **Accessibility & Tastatur** — vollständige Tastaturbedienung (Space/Pfeile/F/M), sichtbare
  Fokus-States, ARIA-Rollen für Controls und Slider, ausreichender Kontrast in beiden Modi.

## 5. Code-Links

- **Repo / Branch:** `https://github.com/Paddione/projects/tree/feature/videovault-split`
- **Widget-App (neu):** `mediaviewer-widget/`
- **Geteiltes Player-Package:** `packages/videovault-player/` (Single Source of Truth für Player + Thumbnails)
- **Kontrakt:** `MediaviewerWidgetProps` / `MediaviewerHandle` / `VideoSource` — siehe
  [Spec § Widget-Kontrakt](./2026-06-15-videovault-split-design.md). Auszug:

```ts
interface MediaviewerWidgetProps {
  videos: VideoSource[];          // (Hilf-)Video-Liste → speist HelpVideoPicker
  initialVideoId?: string;
  showPicker?: boolean;           // Auswahl-UI an/aus
  onSelect?(id: string): void;
  onProgress?(sec: number): void;
  onEnded?(id: string): void;
  onError?(err: Error): void;
}

interface VideoSource {
  id: string; url: string; title: string;
  posterUrl?: string; spriteUrl?: string; durationSec?: number;
  tags?: string[];                // read-only Anzeige
}
```

## 6. Notes

- **Companion-Steckdose, nicht Companion:** Das imperative `MediaviewerHandle`-API ist die
  Schnittstelle für einen späteren „Brainstorm-Companion". Es wird **nur vorgehalten**, nicht
  gebaut — kein Companion-UI in diesem Brief.
- **Reuse vor Duplikat:** Der Player stammt aus `videovault-player`; das Widget-Design darf den
  Player nicht forken, sondern stylt/komponiert das Package.
- **Kein Schneiden/Kategorisieren/Scannen** — diese Bibliotheks-Features sind explizit out of
  scope fürs Widget.
