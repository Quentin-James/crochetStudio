# Crochet Studio

A personal digital crochet studio: design a garment, calculate its complete crochet pattern from
your own gauge, and inspect the result in interactive 3D. Single user, local data, works offline.

> **Status: Phases 1–4 complete.**
> Phase 1 — architecture, design system, domain model, local database schema, responsive shell.
> Phase 2 — dashboard, project creation, library with search and filters, project editing with
> autosave, duplicate/delete, and backup export/restore.
> Phase 3 — the gauge calculation engine with a visible derivation trail, pattern generation for
> dresses / bags / accessories, the row-by-row editor, sizes XS–XXL plus custom profiles, and
> recalculation that preserves hand-edited rows.
> Phase 4 — the interactive 3D studio: geometry built round-by-round from the pattern, yarn
> material with stitch relief, 360° orbit with preset views, and thumbnail capture.
> Phase 5 — installable offline app (service worker, manifest, generated icons, opt-in updates)
> and the workspace redesign of both studios, plus a free colour palette that can be placed per
> section, per row or as stripes — and shows up on the 3D model.
> Depuis : les mailles sont de vrais volumes en 3D (géométrie instanciée, une couleur par maille),
> un plan de couleurs maille par maille dans l'atelier de motifs, et l'application de bureau
> Windows (Tauri).
> See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/DEPLOIEMENT.md](docs/DEPLOIEMENT.md).
>
> **The interface is in French; the code and docs are in English** — see ARCHITECTURE.md §4.

## Running it

```bash
npm install
npm run dev          # http://localhost:5180
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on this machine |
| `npm run dev:lan` | Dev server exposed on the local network — use this to open the app on an iPad |
| `npm run build` | Typecheck, then build static files into `dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Vitest run (the calculation engine's tests live here) |
| `npm run desktop` | Windows desktop window (Tauri) in dev mode |
| `npm run desktop:build` | Builds the desktop app and an installer into `src-tauri/target/release/` |
| `npm run icons` | Regenerates the web and desktop icons |

## Using it on an iPad

1. On the desktop, run `npm run dev:lan` and note the `Network:` URL it prints (e.g.
   `http://192.168.1.20:5180`).
2. Open that URL in Safari on the iPad, on the same Wi-Fi.
3. **Share → Add to Home Screen.** This matters for more than convenience: it launches fullscreen
   *and* gives the app WebKit's persistent-storage treatment, so iPadOS won't clear your projects.

A native iPad binary is not buildable from a Windows machine (iOS code signing requires macOS), so
the installable web app is the delivery route. The architecture stays compatible with a native wrap
later if a Mac becomes available — see ARCHITECTURE.md §2.

Desktop and iPad keep **separate local databases**; there is no server to sync through. Projects
move between devices via backup export/import (Phase 2).

## Using it on this computer

`npm run dev` in a browser is the quickest route. For a real application window:

```bash
npm run desktop         # dev window, hot reload included
npm run desktop:build   # installer in src-tauri/target/release/bundle/
```

The desktop shell is **Tauri, and deliberately thin**: a window around the same web build, with no
Rust-side state and no plugins. Your projects live in the webview's IndexedDB exactly as they do in
the browser — one implementation of the persistence, not two. Note that this means **the desktop
app and the browser each keep their own library**; move work between them with a backup export.

The first `desktop` run compiles a few hundred Rust crates and takes several minutes; afterwards it
starts in seconds.

## Layout

```
docs/ARCHITECTURE.md   decisions, trade-offs, database schema, roadmap
src/core/              pure crochet domain: types, units, stitches, gauge, sizing, patterns
src/data/              Dexie/IndexedDB schema and repositories
src/design/            design tokens and reusable UI primitives
src/app/               shell, navigation, routes
src/features/          dashboard, projects, pattern-studio, studio3d, settings
```

`src/core` imports nothing from the UI, the database or Three.js — the crochet maths is a pure,
unit-tested library the rest of the app calls.
