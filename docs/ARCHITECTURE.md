# Crochet Studio — Architecture

> Phase 1 deliverable. This document is the contract the rest of the build follows.
> Status: decided and implemented for the app shell; sections marked **Planned** are
> designed but not yet coded.

---

## 1. Hard constraints discovered before choosing the stack

These were verified on the development machine, not assumed.

| Constraint | Consequence |
| --- | --- |
| Development machine is **Windows 11** | iOS/iPadOS binaries can only be compiled and code-signed on macOS with Xcode. A native iPad app (Tauri iOS, Capacitor, React Native) **cannot be produced from this machine at all.** |
| Target is **one user, two device classes** (desktop + iPad) | Two codebases are not justified. One web codebase, two delivery shells. |
| **No account, no cloud, offline-capable** | Persistence must live on-device. No server component of any kind. |
| iPad means **Safari / WebKit** | WebGL2 is available (so Three.js is fine). WebGPU is not dependable. Storage is subject to WebKit eviction rules (see §5). |
| 3D must be **real-time and interactive** | Rules out server-side or offline pre-rendering. Rules out heavyweight physics-based yarn simulation on an iPad GPU. |

**The decisive trade-off:** the spec invites Tauri, but Tauri only solves the *Windows desktop*
half. It cannot ship to the iPad from a Windows box. Choosing Tauri as the primary target would
mean the iPad — half the product requirement — stays unbuildable. So the architecture is
**web-first (installable PWA)**, with Tauri as an *optional* later packaging step for Windows only.
The application code is identical in both; nothing in `src/` knows which shell it runs in.

---

## 2. Technology decisions

| Layer | Choice | Why this, and what was rejected |
| --- | --- | --- |
| Language | **TypeScript 7** (strict) | Non-negotiable for a calculation engine whose numbers must be trustworthy. Strict mode + no implicit any. |
| UI framework | **React 19** | Vastly better ecosystem fit for Three.js and for an iPad-grade touch UI than Angular; smaller conceptual surface for a single-developer project. Angular's DI/NgModule weight buys nothing here. |
| Build | **Vite 8** | Instant dev server, native ESM, first-class PWA and worker support, trivial static output that any shell can host. |
| Routing | **react-router 7** (hash-free, `BrowserRouter`) | Static-host friendly; file-less route config kept in one place. |
| Styling | **Hand-authored CSS with design tokens** (CSS custom properties) + per-component stylesheets | The spec demands a bespoke, warm, non-"dashboard" identity. A utility framework (Tailwind) pushes toward generic layouts and makes a *cozy* custom look harder, not easier. Tokens in one file give one source of truth with zero runtime cost. |
| Typography | **@fontsource-variable/fraunces** (headings) + **@fontsource-variable/inter** (UI) | Self-hosted and bundled — a Google Fonts `<link>` would break the offline requirement. Fraunces is a soft, high-contrast serif: elegant and warm rather than corporate. |
| Local database | **IndexedDB via Dexie 4** + `dexie-react-hooks` | See §5 for the SQLite comparison. Reactive queries mean the UI re-renders from the database, so there is only ever one copy of the truth. |
| 3D | **Three.js** over **WebGL2** (**Planned**, Phase 4) | The only mature option that works identically in Chrome, Edge and iPad Safari. Procedural geometry built by our own mesh generators — not imported art assets. |
| Testing | **Vitest** | Runs the pure-TS engine with no browser. The calculation engine is the part that must be provably correct. |
| Desktop shell | **Tauri (optional, Windows only, Phase 5+)** | Rust toolchain is already present on this machine. Adds native file dialogs for backup/restore and a real app window. Deliberately *not* on the critical path. |

### iPad delivery strategy (the part the spec asked to be explained, not assumed)

The app is an installable **PWA**. On the iPad, the user opens it in Safari once and chooses
*Share → Add to Home Screen*. From then on it launches fullscreen with no browser chrome, runs
offline from the service-worker cache, and — critically — **receives WebKit's persistent storage
treatment instead of the 7-day eviction rule applied to ordinary websites.**

Three ways to get the files onto the iPad, in order of preference:

1. **LAN dev/preview server** (`npm run dev -- --host`) — zero infrastructure, the iPad loads it
   from the desktop over Wi-Fi, then runs offline from cache. Best for development and for a
   single-user setup where both devices are in the same home.
2. **Any static host** (a local folder served by the Tauri shell, a NAS, GitHub Pages) — the build
   output is plain static files; one visit is enough to install.
3. **Native iOS build** — possible *only* if a Mac becomes available. The architecture is already
   compatible (Tauri v2 and Capacitor both wrap this exact web build), so this stays open as a
   future option with no rewrite.

**Honest limitation to accept:** projects on the iPad and projects on the desktop are separate
local databases. There is no sync, because sync requires a server and the spec forbids a mandatory
one. Moving work between devices is done through explicit **backup export / import** (§5), which is
a first-class feature rather than an afterthought.

---

## 3. Module architecture

The rule that shapes everything: **the crochet calculation engine is pure TypeScript and imports
nothing from React, the DOM, Dexie or Three.js.** It is a library the UI happens to call. That makes
it unit-testable, and it means a wrong number is always traceable to one pure function.

```
src/
├─ core/                 ← pure domain logic. ZERO UI/DB/3D imports. Fully unit-tested.
│  ├─ types/             ← the domain vocabulary (project, gauge, stitch, pattern, size)
│  ├─ units/             ← cm ⇄ inch conversion, formatting, rounding policy
│  ├─ stitches/          ← the stitch catalogue: height ratio, yarn consumption, abbreviations
│  ├─ gauge/             ← gauge → stitches/rows maths, the single source of every count
│  ├─ sizing/            ← standard size tables, custom profiles, measurement derivation
│  └─ patterns/          ← generators (dress, bag, accessory) + shaping/increase/decrease solver
│
├─ data/                 ← persistence only. Knows core types; knows nothing about screens.
│  ├─ db.ts              ← Dexie schema + versioned migrations
│  ├─ repositories/      ← typed CRUD + duplicate/delete; the only code that writes to the DB
│  └─ backup/            ← whole-database export/import as a single JSON document
│
├─ design/               ← the design system
│  ├─ tokens.css         ← colour, spacing, radius, shadow, type scale. One source of truth.
│  ├─ base.css           ← reset, typography, touch/pointer rules
│  └─ components/        ← reusable primitives (Button, Card, Field, Stepper, Tag, …)
│
├─ app/                  ← composition root: shell, navigation, routes, global providers
│
├─ features/             ← one folder per product section; may import core, data, design
│  ├─ dashboard/
│  ├─ projects/
│  ├─ pattern-studio/
│  ├─ studio3d/
│  └─ settings/
│
└─ three/                ← Pattern → geometry. Imports core types only.
   ├─ model/silhouette   ← pure maths: pattern rounds → rings (no Three.js, unit-tested)
   ├─ model/buildMesh    ← rings → BufferGeometry, base disc, panel, strap
   ├─ materials/yarn     ← procedural stitch texture + yarn material
   └─ scene/Viewport     ← renderer, camera, orbit controls, lighting, capture
```

**Dependency direction is one-way and enforced by review:**
`features → {core, data, design, three}`, `data → core`, `three → core`, and `core → nothing`.
`core` never imports from any other folder.

---

## 4. The calculation engine (implemented — `core/gauge`, `core/shaping`, `core/patterns`)

Every stitch count in the app comes from one place, and every number is shown with its derivation.

**Base conversion.** Given gauge *g* measured over a swatch (default 10 cm):

```
stitches = round( width_cm  × (g.stitches / g.swatchWidth_cm) )
rows     = round( height_cm × (g.rows     / g.swatchHeight_cm) )
```

The worked example from the spec is the engine's first unit test:
20 st / 10 cm and 15 rows / 10 cm at 40 × 30 cm → **80 stitches, 45 rows**.

**On top of the base conversion the engine must apply, in this order:**

1. **Pattern repeat constraint** — round the raw count to a multiple of the stitch pattern's repeat
   (plus any edge stitches), never silently; the adjustment is reported.
2. **Symmetry** — front/back and left/right panels must resolve to counts that can actually be
   seamed, so paired panels are solved together.
3. **Shaping** — increases/decreases are computed as an even distribution problem: to go from
   *a* to *b* stitches over *n* rows, the engine returns the explicit per-row schedule, not a
   vague "decrease evenly".
4. **Rounding policy** — a single documented policy (round-half-up on counts, never below a
   structural minimum such as a magic-ring start), applied centrally so two screens can never
   disagree.

**Transparency requirement.** Generators return not just numbers but a `derivation`: the inputs
used, the formula applied, the raw result, and each adjustment with its reason. The UI renders this
so the user can see *why* it says 80, and can override it.

**Manual-edit preservation.** Rows the user has edited are flagged `locked` — and editing a count
or a stitch in the row editor sets that flag automatically, because a hand edit *is* the user taking
the row over. `recalculatePattern` re-derives unlocked rows, keeps locked ones (including rows that
fall past the new end, which are appended rather than deleted), never touches sections the user
created by hand, and returns a typed `PatternConflict` for every locked row that no longer agrees
with the new geometry.

**When recalculation happens.** Automatically whenever nothing of the user's is at stake — no locked
rows means no possible loss. As soon as any row is locked, the studio stops and asks, showing what
would change. That satisfies both halves of spec §7: the pattern follows the measurements, but the
user stays in control of the final pattern.

---

### Language

The **interface is French**; the **code is English** (identifiers, comments, commit messages, this
document). That split is deliberate: the user is French-speaking, and crochet terminology differs
enough between systems that translating it matters — a French *bride* is a US *double crochet*, not
a US *treble*, so `StitchDefinition` carries a `usEquivalent` field for patterns found online.

There is **no i18n framework**: with one user and one language, a lookup layer would add
indirection without buying anything. French strings live where they are used, including the written
row instructions generated by `core/patterns/rows.ts`. Introducing a second language later means
extracting those strings — a mechanical change, and a cost worth paying only if it is ever needed.

## 5. Local persistence

### IndexedDB vs SQLite — the comparison the spec asked for

| | IndexedDB (Dexie) | SQLite (WASM + OPFS) |
| --- | --- | --- |
| iPad Safari | Native, fully supported | Works, but OPFS on WebKit is fragile and needs COOP/COEP headers |
| Offline | Yes | Yes |
| Extra payload | ~25 KB | ~1 MB WASM |
| Query power | Indexes only, no joins | Full SQL |
| Fit for this data | Projects are **documents**: one project = one nested object graph read and written whole | SQL's strength is relational queries this app never issues |
| Reactive UI | `useLiveQuery` out of the box | Hand-rolled |

**Decision: IndexedDB via Dexie.** There is no relational query in the requirements — the access
pattern is "load this project", "list projects by date". Paying 1 MB of WASM and WebKit's OPFS
instability to buy SQL joins that will never be written is the wrong trade. Dexie's typed tables
plus versioned migrations cover the data-integrity requirement.

### Schema (Dexie v1)

```
projects      id (pk), name, category, createdAt, updatedAt, *tags
sizeProfiles  id (pk), name, basedOn
appSettings   key (pk)
```

A **project record** is one document holding everything the spec requires:

| Field | Holds |
| --- | --- |
| `id`, `name`, `category`, `createdAt`, `updatedAt`, `tags` | metadata (indexed for the library's search/filter/sort) |
| `dimensions` | per-section measurements in **centimetres, always** — the canonical unit |
| `gauge` | swatch counts, swatch size, hook size, yarn weight, stitch used |
| `pattern` | sections → rows → stitch, count, shaping, note, `locked` flag |
| `sizing` | active size, standard size overrides, reference to a custom profile |
| `yarn` | colour, weight, fibre, thickness used by both the pattern and the 3D material |
| `three` | camera pose, display options, yarn render settings |
| `notes`, `progress` | free text; completed-rows counter driving dashboard progress |
| `schemaVersion` | per-document version so a migration can upgrade documents lazily |

**Unit discipline:** every length is stored in **cm**. Imperial is a display-time conversion only.
This removes an entire class of rounding bug, at the cost of converting at the edges.

### Saving, backup, integrity

- **Autosave** — debounced write (~600 ms) after any mutation, plus a flush on page hide. The
  database is the single source of truth; the UI reads back through `useLiveQuery`.
- **Manual save** — explicit command that flushes immediately and stamps `updatedAt`, for the user
  who wants to feel in control.
- **Backup / restore** — the whole database exported as one versioned JSON file the user can store
  anywhere, with a validating importer. This is also the only way to move a project between the
  desktop and the iPad, so it is a core feature.
- **Safari eviction** — mitigated by installing to the Home Screen, calling
  `navigator.storage.persist()`, and nudging the user to take a backup after meaningful work.

---

## 5b. The 3D model (Phase 4)

**The model is derived, never decorative.** `buildModelSpec` walks the pattern and emits one ring
per round: the ring's radius is that round's stitch count ÷ gauge ÷ 2π, and its height is the row's
stitch height (a single-crochet edging round is half the height of a double-crochet round, so
edgings no longer stretch the model). Change one stitch count and the silhouette moves.

| Decision | Why |
| --- | --- |
| **Surface geometry + procedural stitch texture**, not one mesh per stitch | A dress is 184 stitches × 150 rows ≈ 27 600 stitches. That much geometry is not something an iPad GPU should orbit. The relief is a generated bump/roughness tile whose *repeat is set from the real stitch and row counts*, so the visible grain matches the pattern. `ModelSpec` already carries per-round counts, so an instanced-stitch renderer can be added later without touching anything upstream. |
| **Render on demand**, no permanent `requestAnimationFrame` loop | A static model being inspected should not burn battery. Damping is off, so a frame is drawn when the user actually moves, resizes, or changes a setting. |
| **1 world unit = 1 cm** | The camera distances and the measurements the user types are the same numbers; no conversion layer to get wrong. |
| **Three.js loaded lazily** (`React.lazy` on the `/3d` route) | Three.js is ~590 kB of the build. Browsing projects should not download a renderer. First load stays ~144 kB gzipped; the 3D chunk (~147 kB gzipped) arrives when the studio is opened. |
| **Shape per category from the pattern's own sections** | `bag/base` rounds grow outwards (a flat, slightly domed base), `bag/strap` becomes an arc, flat sections become a hanging panel, everything else stacks upwards. A dress is read top-down because that is how it is worked; a bag bottom-up. |
| **Graceful degradation** | No WebGL means a plain explanation and a still-working page, not a blank canvas. Verified by a test, since jsdom has no WebGL. |

**Capture** renders the current view at thumbnail size and stores it in `project.thumbnail`, which
the project cards already prefer over the drawn silhouette — the Phase 2 placeholder resolves itself.

## 6. Design system

Palette, used as semantic tokens rather than raw hex at call sites:

| Token | Value | Role |
| --- | --- | --- |
| warm ivory | `#F8F4EE` | app background |
| cream | `#F1E8DC` | raised surfaces, cards |
| beige | `#E5D5C3` | borders, inactive states |
| dusty pink | `#D9B6B0` | the single accent — selection, progress, primary action |
| muted brown | `#8B7464` | secondary text, icons |
| dark warm brown | `#44382F` | primary text, headings |

Rules: generous spacing on an 8 px rhythm, large radii (10–28 px), soft low-opacity brown-tinted
shadows instead of grey, one accent colour only, and no gradient doing more than suggesting
light. Hit targets are ≥ 44 px so a single component set serves both mouse and finger.

**Responsive strategy** — three layouts from one component tree:

| Breakpoint | Navigation |
| --- | --- |
| ≥ 1180 px (desktop) | full sidebar with labels |
| 760–1179 px (iPad landscape) | icon rail with compact labels under each icon |
| < 760 px (iPad portrait, narrow) | bottom tab bar, thumb-reachable |

---

## 7. Roadmap and definition of done

| Phase | Scope | Done when |
| --- | --- | --- |
| **1. Architecture & shell** ✅ | Stack decided, module boundaries, DB schema, design tokens, navigation, responsive layout | App builds, runs, navigates on all three layouts |
| **2. Project management** ✅ | Dashboard, project creation, library with search/filter, autosave, duplicate/delete, backup | A project survives a full browser restart |
| **3. Pattern Studio** ✅ | Manual editor, stitch management, gauge config, calculation engine + tests, sizes, dimension editing | Spec's 80 st / 45 rows example passes as a unit test; editing a dimension updates the pattern and preserves manual rows |
| **4. 3D Studio** ✅ | Scene, orbit/zoom/360°, yarn material, dress & bag mesh generators driven by the pattern | Changing a dimension visibly changes the model |
| **5. Polish** | iPad/desktop passes, PWA + offline, performance; Tauri shell still optional and not built | Works with the network disabled; usable on the iPad |

## 8. Offline and installation (Phase 5)

| Decision | Why |
| --- | --- |
| **Hand-written service worker** (`scripts/sw-template.js` + `build-sw.mjs`) rather than `vite-plugin-pwa` | The caching story is one paragraph — precache the build, serve it first, keep working offline. The plugin brought ~200 build-time dependencies and four advisories (workbox → deepmerge/glob) for that. `npm audit` is back to zero. |
| **Precache list generated from the build output** | Vite's filenames are hashed, so the list cannot be static. The script walks `dist/`, injects the names, and reports what is cached (20 files, ~1.45 MB, including the 3D chunk and the fonts). |
| **Updates never apply themselves** | A new worker waits; the page offers to reload. Nobody wants the app to change under them mid-row. |
| **Icons generated by a script** (`scripts/generate-icons.mjs`, raw zlib PNG) | iOS will not accept an SVG for the Home Screen, and the mark had to match the palette exactly. ~150 lines beats an image pipeline. |

A bug worth remembering: `String.replace` with a *string* pattern replaces only the **first**
occurrence — and the first occurrence of each placeholder was in the template's own doc comment, so
the comment got substituted while the code kept `__PRECACHE__`. The build script now uses
`replaceAll` and **throws if any placeholder survives**. Verify the artefact; don't assume the
substitution worked.

## 9. Colour (post-Phase-5)

A project has one main colour plus a **palette** of named colours. Sections and rows reference them
by id, which is what makes stripes and colour blocks possible. The same resolution — row colour,
else section colour, else main yarn colour — is read by the pattern editor *and* by the 3D model,
so the model always shows what the written pattern says.

In the renderer this is **vertex colours**: each ring carries the colour of the round it came from,
so a single mesh and a single material show a striped piece. Changing a colour therefore rebuilds
the geometry (cheap at these sizes) rather than tweaking a material uniform.

Deleting a palette entry also clears every section and row that referenced it — a pattern must
never point at a colour that no longer exists.

**Document migration** (`core/migrate.ts`) is lazy and total: projects are upgraded on read, so a
library written by schema v1 opens, gains its palette, colour references, construction constraints
and viewport options, and is written back in the new shape on the next save. It must never throw —
the alternative is a library that refuses to open.

## 10. Workspace layout (post-Phase-5 redesign)

Both studios moved from "a page of cards" to **a workspace**: a header that states what is being
worked on, then the work itself.

- **3D studio** — the viewport takes all the room it can and the properties sit in a scrolling
  column beside it (360 px desktop, 320 px iPad landscape, stacked below 1024 px where a column
  would be too narrow to be useful). The toolbar sits under the canvas: views, zoom, fit, grid,
  wireframe, reset. Measurements are editable *here*, through the same recalculation rules as the
  pattern editor.
- **Pattern editor** — seven steps (gauge → measurements → size → constraints → generation →
  calculations → pattern) instead of one long column of competing panels. A summary bar under the
  steps keeps the totals and the primary action visible wherever you are.
- **Calculations** became a scannable table — calculation, section, result, status — with the
  formula, inputs and every adjustment opening on demand.

New shared primitives: `Tabs` (tabs and numbered steps), `Panel` (collapsible section),
`Toolbar`/`ToolbarButton`, `StatusPill`, `Switch`, `Slider`.

## 11. The desktop shell (Tauri, Windows)

`src-tauri/` is about forty lines of Rust: `tauri::Builder::default().run(...)`, a window, and
nothing else. No commands, no plugins, no Rust-side state.

That thinness is the point. The studio's persistence lives in IndexedDB inside the webview, so the
desktop app runs the *same* storage code as the browser — there is one implementation to trust
rather than two that can disagree. Adding a Rust-side database would have meant maintaining a
second one for the web, which is how a single-user app ends up with sync bugs it never needed.

| Decision | Why |
| --- | --- |
| **Hash routing inside Tauri only** (`app/runtime.ts` → `isTauri()`) | Tauri serves the built files over its own protocol and does not rewrite unknown paths to `index.html`, so reloading on `/pattern` would 404. The desktop window has no address bar, so hash URLs cost nothing there — and the web build keeps clean URLs. |
| **No service worker in the desktop shell** | The files are already on disk; caching a custom protocol buys nothing. |
| **`strictPort` on the dev server** | Tauri's dev window points at port 5180 exactly; letting Vite drift to 5181 would leave it staring at an empty window. |
| **Icons from the same generator** | `npm run icons` writes the web PNGs *and* the Tauri set, including a hand-encoded multi-size `.ico` — one source for the mark, no image pipeline. |
| **NSIS installer only** | MSI needs WiX; NSIS is what Tauri can produce on a clean Windows machine. |

**Consequence to be aware of:** the desktop app and the browser each keep their own IndexedDB, so
they have separate libraries. Backup export/import moves work between them — the same route already
used between desktop and iPad.

## 11b. Seeing the stitches, and colouring them

**Stitches as geometry.** `three/model/stitches.ts` places one small mesh per stitch — position
from its angle around the round, size from that round's own stitch width, orientation from the
surface normal of the (possibly oval) cross-section. It is a single `InstancedMesh`, so twenty
thousand stitches are one draw call; the cost is vertices, not draw calls, which is why there is a
cap of 40 000 instances. Above it the field is **thinned evenly, never truncated** — a half-covered
model would be a lie about where the stitches are — and the studio reports the real count next to
the drawn one.

The shaded-texture mode is still there and is one segmented control away: it costs almost nothing
and remains the right choice on a weak device.

**Per-stitch colour.** `PatternRow.stitchColors` is a *sparse* map from stitch index to palette id,
null when the row is plain — a fully painted dress would otherwise carry 27 000 entries. The
resolution order is one function, `resolveStitchColor`: stitch → row → section → main yarn. The
chart, the written pattern and the 3D model all call it, which is why they cannot disagree.

**The chart** (`features/pattern-studio/ChartEditor.tsx`) is a canvas, not a grid of DOM nodes: a
dress is 20 000 cells. A drag paints onto the canvas immediately for feel, accumulates the cells,
and commits **one** change to the pattern on pointer-up — one write, one undo step, instead of
forty. Row 1 is at the bottom, as a crochet chart is read.

Two bugs worth remembering from this work:

- **Double colour conversion made every model nearly black.** `THREE.Color.set()` already converts
  sRGB into the renderer's working space; calling `convertSRGBToLinear()` afterwards converted it
  twice, and a dark brown came out at a twentieth of its brightness. `buildMesh.test.ts` now pins
  the numeric value of a vertex colour.
- **`setPointerCapture` must never be allowed to abort a stroke.** It is an optimisation for
  dragging off-canvas; wrapped in `try`, because an environment without it should still paint.

## 12. Measurements are the interface to the model

Anything the 3D model should respond to belongs in `CATEGORY_DEFINITIONS`, not in a renderer
option. Adding the bag's strap width was: one key on `DimensionKey`, one entry in `BAG_DIMENSIONS`,
one fallback in the generator. The measurement then appears automatically in the creation dialog,
the project sheet, the pattern editor *and* the 3D studio's measurements panel, flows through the
pattern (16 stitches across the band at the project's gauge), and reaches the mesh — because the
strap's geometry already came from its pattern section rather than from a constant.

That is the test for where a new control belongs: if it changes the finished piece, it is a
measurement; if it only changes how the piece is displayed, it is a viewport option.

**Rules held throughout:** no fake controls, no hardcoded demo data standing in for real
functionality, and any screen not yet implemented says so plainly instead of pretending.
