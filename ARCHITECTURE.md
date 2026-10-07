# Architecture

Living document; sections are filled as each phase lands (see [docs/PLAN.md](docs/PLAN.md)).

## Layers and dependency rules

```
src/
  shared/        pure utilities (rng, math, emitter, assertNever) — no browser APIs
  platform/      browser adapters (storage, visibility, uuid, …)
  config/        typed gameplay config, defaults, validation (pure)
  game/core/     deterministic simulation (pure TypeScript)
    testing/     scripted bots + test helpers (test-only layer, never bundled)
  game/input/    keyboard/touch → abstract InputState
  game/render/   PixiJS views, effects, asset registry, viewport
  game/runtime/  GameSession: wires core + input + render + clock; lifecycle
  game/bridge/   external store with low-frequency snapshots for React
  api/           contracts, Axios client, query keys, TanStack Query hooks
  mocks/         MSW handlers, fixtures, scenarios, persistence
  ui/            React screens, components, a11y helpers
  main.tsx       composition root (may import anything; nothing imports it)
```

| Layer             | May import                                                                          | Packages allowed (of react, react-dom, react-router, pixi.js, axios, @tanstack, msw) |
| ----------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| shared            | —                                                                                   | none                                                                                 |
| platform          | shared                                                                              | none                                                                                 |
| config            | shared                                                                              | none                                                                                 |
| game/core         | config, shared                                                                      | none                                                                                 |
| game/core/testing | core, config, shared (**test-only**: importable only by `*.test.ts` and `scripts/`) | none                                                                                 |
| game/input        | core, config, shared, platform                                                      | none                                                                                 |
| game/render       | core, config, shared, platform                                                      | pixi.js                                                                              |
| game/bridge       | core, shared                                                                        | none                                                                                 |
| game/runtime      | core, input, render, bridge, config, shared, platform                               | pixi.js                                                                              |
| api               | config, shared, platform                                                            | react, axios, @tanstack                                                              |
| mocks             | api, shared, platform                                                               | msw                                                                                  |
| ui                | runtime, bridge, api, config, shared, platform                                      | react, react-dom, react-router, @tanstack                                            |

`shared` is strictly pure so the core can use it; anything touching `window`,
`document`, `localStorage`, `crypto` etc. lives in `platform`, which the core and config
can never reach.

### Enforcement

1. **ESLint rule `local/layer-boundaries`** ([eslint/rules/layer-boundaries.js](eslint/rules/layer-boundaries.js)),
   configured from the single table in [eslint/boundaries.js](eslint/boundaries.js). It
   resolves relative specifiers by path arithmetic (no module resolver), so it also
   covers static/dynamic imports and re-exports of files that do not exist yet.
2. **`tsconfig.core.json`** typechecks `game/core` and `config` with `lib: ["ES2022"]`
   and no ambient types: any DOM/Node global used there, or in a `shared` module they
   import, fails `pnpm typecheck`.
3. **[tests/tooling/boundaries.test.ts](tests/tooling/boundaries.test.ts)** lints probe
   sources against the rule (e.g. core → `pixi.js`, core → `platform`, ui → core) so a
   config regression fails the unit suite.

## Asset pipeline

`pnpm assets:build` ([scripts/build-atlases.mjs](scripts/build-atlases.mjs)) writes
`public/assets/` from `assets/`; it runs automatically before `dev`, `build` and the
e2e server, and its output is git-ignored.

| Output                         | Source                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| `ships/ships_sheet.{json,png}` | Sparrow XML → Pixi JSON (102 frames, `.png` suffix dropped)                                 |
| `ships/ships_sheet@2x.*`       | 2× vector raster re-packed into the sheet layout via a committed frame map (DECISIONS R1)   |
| `tiles/tiles_sheet{,@2x}.*`    | 16×6 grid → `tile_1..96` row-major, re-packed with 2 px (4 px) edge extrusion against seams |
| `ui/ui_sheet{,@2x}.*`          | copied (already Pixi JSON, `ui` layout metadata kept)                                       |
| `manifest.json`                | Pixi asset bundle `combat` (ships, tiles, ui) + the result of the vector check              |
| `sounds/*.wav`, `branding/*`   | copied                                                                                      |

`@2x` names let Pixi's resolver pick the resolution: the registry asks for 2× art once one
world unit covers more than one device pixel (`devicePixelRatio × viewport scale > 1`).
The 2× ship sheet rasterizes `assets/vector/ships_miscellaneous_vector.svg` with
`@resvg/resvg-js` and crops each frame at the position found once by
[scripts/locate-vector-frames.mjs](scripts/locate-vector-frames.mjs) (the vector uses the
preview layout and has no sprite ids); it ships only if every frame, box-filtered back to
1×, matches the raster sheet ([scripts/lib/vectorAtlas.mjs](scripts/lib/vectorAtlas.mjs), tested in
[tests/tooling/vectorAtlas.test.ts](tests/tooling/vectorAtlas.test.ts)).

Pure conversion helpers live in [scripts/lib/atlas.mjs](scripts/lib/atlas.mjs); a test
checks every generated tile frame is pixel-identical to the delivered `tile_N.png`.
Vite emits its hashed bundles to `dist/static/` so they never mix with `dist/assets/`;
[scripts/verify-dist.mjs](scripts/verify-dist.mjs) (run by `pnpm build` and the e2e server)
fails if dev-only code (`src/dev/`, the scripted bots, `sandbox.html`) reaches `dist/`.

## Mock backend bootstrap

`main.tsx` lazily imports `src/mocks/browser.ts` and awaits `worker.start()` before the
first render in every build (dev, e2e, production demo). The worker script
`public/mockServiceWorker.js` is generated by `msw init` and versioned. Once the
worker is active `<html data-msw="ready">` is set; e2e fixtures wait for it. If the
worker fails to start, a visible startup error is rendered and the error is logged.

## React ↔ PixiJS integration

React owns screens and overlays; Pixi owns one canvas per game screen. They meet in three
places only:

1. **`useGameSession(containerRef, config)`** ([src/ui/game/](src/ui/game/)) creates a
   `GameSession` ([src/game/runtime/gameSession.ts](src/game/runtime/gameSession.ts)) in an
   effect and destroys it in the cleanup. The game screen is lazy-loaded, so Pixi and the
   runtime are not part of the menu's initial bundle.
2. **Bridge store** ([src/game/bridge/gameStore.ts](src/game/bridge/gameStore.ts)): the runtime
   publishes every frame, but subscribers are notified only when a displayed value changes
   (loading in whole percent, whole seconds left, HP points, score, phase), read with
   `useSyncExternalStore`. React never renders per frame.
3. **Commands** from React to the session (`retryAssets`, later pause/resume) are plain
   method calls.

Each Pixi ticker frame: the fixed stepper consumes clock time in 1/60 s steps (domain events
are collected), the renderer plays the events (effects, flashes, camera shake) and the audio
engine plays cues, cosmetic animations advance by the frame's clock time, then
`WorldRenderer.sync(world, alpha)` mirrors the world into the views, interpolating between
the last two steps. A manual or scaled clock therefore freezes or speeds up everything alike.

**Render reads, never decides.** Views receive a `WorldView` (`DeepReadonly<World>`), so any
write is a compile error; [WorldRenderer.test.ts](src/game/render/WorldRenderer.test.ts)
renders a deep-frozen world after 20 s of combat (Node, fake atlases) and checks it is
unchanged. Event → effect and event → sound mappings are pure functions with their own
tests. Renderer randomness (debris) uses its own seeded RNG, never the simulation's.

**Views** ([src/game/render/](src/game/render/)): `ArenaLayer` (built once per screen from the
collision grid: drifting deep water, shallow ring, autotiled islands, decoration, dimmed
letterbox), `ShipView` (hull frame by damage stage, fire at stage ≥ 1, hit flash, sinking
wreck, HP bar), `ProjectileLayer` (ball + trail), `EffectLayer` (muzzle, hit, puff,
explosion, splash, debris). Ship views, balls, effects and HP bars are pooled and keyed by
entity id; a restart releases them for reuse. HP bars clip the fill sprite's private texture
frame to `fill_rect.x + ratio × fill_rect.w` (the atlas `ui.layout`), updated only when the
visible width changes, so all bars still batch (no masks).

**Arena art from the collision grid.** `shoreShape` (core) classifies every solid cell as
fill / edge / outer corner / inner corner; the renderer maps those to the grass-island tile
set and, for the dilated mask around the islands, to the shallow-water set. `validateMap`
rejects any layout with a cell no tile can draw, so a valid map is always drawable (a
property test checks random valid maps). Decoration sits only on land and never collides.

**Viewport.** The 1024×576 world is fitted into the container ("contain") and centred;
renderer resolution = `min(devicePixelRatio, 2)` with `autoDensity`. A `ResizeObserver`
and a re-armed `(resolution: Xdppx)` media query keep size and density current; only the
scale changes, never the rules. `screenToWorld` is the inverse transform for pointer input.

**Assets.** `loadCombatAssets` ([combatAssets.ts](src/game/render/assets/combatAssets.ts))
loads `manifest.json` and the `combat` bundle once per page through Pixi `Assets`, with
progress to the store. Concurrent sessions share one load; a failure is never cached, so
Retry simply loads again. Combat never starts without the art. Textures stay cached across
matches (a second match makes no atlas request, checked in e2e).

**Audio** ([audioEngine.ts](src/game/render/audio/audioEngine.ts)): WebAudio, created and
fetched only after a user gesture (or if the page already had one); WAVs decode in the
background and a cue whose buffer is not ready is skipped. Optional by design: a failure
warns once and the game continues silently.

## Simulation loop

The rules live in `src/game/core` (pure TypeScript, no DOM/Pixi/React; typechecked without the
DOM lib). Public API: [src/game/core/index.ts](src/game/core/index.ts).

- **State**: one plain, serializable `World` (ships, projectiles, score, phase, spawner and
  navigation state, seeded RNG state, frozen config snapshot). `createMatch(config, seed)`
  validates the config, deep-freezes a copy into the world and converts every degree value to
  radians once (`world.angles`), so Options changes only affect later matches. Restart = a new
  `createMatch`.
- **Step**: `step(world, input)` advances exactly `simulation.stepSeconds` (1/60 s) and returns
  `DomainEvent[]` (`shotFired`, `projectileHit`, `projectileBlocked`, `projectileExpired`,
  `shipDamaged`, `shipDestroyed`, `chaserRammed`, `enemySpawned`, `scoreChanged`, `matchEnded`)
  for render, audio and UI. Order: player input → enemy AI → movement → Chaser rams → ship
  separation + island/bounds push-out → weapons (cooldowns) → swept projectiles → cleanup →
  end checks (death before time) → spawner. Once `phase === 'ended'`, `step` is a no-op: movement,
  attacks, damage, spawns and score are frozen.
- **Time**: `elapsedSeconds = stepCount × stepSeconds` (never a running float sum); every rate is
  per second, so outcomes do not depend on the frame rate.
- **Fixed stepper** ([stepper.ts](src/game/core/stepper.ts)): accumulator fed by an injected
  `Clock` (`realClock` in `platform/`, `ManualClock` in `shared/` for tests and the test hook).
  Frames are clamped to `maxFrameSeconds`; past `maxStepsPerFrame` the backlog is dropped (slow
  motion instead of a spiral of death); `alpha` is exposed for render interpolation
  (`prevPos`/`prevHeading` are kept on every entity); `resetBaseline()` makes a pause gap never
  enter the accumulator. A 1e-6 ms tolerance makes frame timestamps such as `i × 1000/144` yield
  exactly the step count of exact arithmetic.
- **Determinism**, proven by tests: 30/60/144 Hz frame sequences with the same seed and scripted
  inputs produce deep-equal worlds and event logs
  ([determinism.test.ts](src/game/core/determinism.test.ts)); a headless 180 s match per seed
  replays identically.
- **AI** ([systems/ai.ts](src/game/core/systems/ai.ts)): enemies seek the player directly when a
  hull-wide line of sight exists, otherwise follow a BFS flow field over the 16×9 water grid,
  recomputed only when the player changes cell
  ([navigation/flowField.ts](src/game/core/navigation/flowField.ts)). Three feelers add local
  island avoidance while the target is ahead. Chasers ram (damage, explode, no score). Shooters
  close in to a standoff distance and fire their front cannon only with range, aim tolerance,
  cooldown **and** line of sight.
- **Spawner**: cadence anchored to `n × interval` (first spawn at t = interval). A due spawn that
  cannot be placed (alive cap, no clear point within the per-step attempt budget) stays pending
  and is retried on the next steps; it is never dropped and later spawns are not shifted. Points
  lie on a ring `edgeInset` inside the border, ≥ `minDistanceFromPlayer` away, with a clearance
  circle free of islands and ships. The first two spawns are one of each kind, then weighted.

## Collisions

- **Islands**: the hand-authored grid ([map/arenaMap.ts](src/game/core/map/arenaMap.ts)) is
  merged into axis-aligned rects (row runs, then identical runs downwards). The same grid feeds
  the tile renderer, so art and collision match. `arena.islandCollisionInset` shrinks only rect
  sides that face water (no gaps where two rects of one island meet); it is 0 because the shore
  art reaches the tile edge. Convex shore corners (island cells whose two outer neighbours are
  water: the cells drawn with rounded corner tiles) are rounded with `arena.islandCornerRadius`
  (61 u, within 4 u of the art everywhere, DECISIONS R4); corners where rects of one island
  meet stay square, so no gap opens at a junction. `validateMap` enforces 2×2-composable
  islands drawable with the shore tiles, channels ≥ 2 tiles, no diagonal-only contacts and
  connected water.
- **Ships**: two overlapping circles along the hull axis (r 24 at ±18 u; validation requires
  offset < radius so there is no gap amidships). Ship vs island: closest-point push-out per
  circle (ships slide along shores); inside a rounded corner's quadrant this is circle vs
  circle (corner centre, corner radius + hull radius). Arena: circles clamped inside. Ship vs ship: pairwise
  circle separation, except Chaser–player contact, which is a ram. Several relaxation passes,
  static geometry last.
- **Projectiles**: points with radius, moved with a swept segment test against island shapes
  grown by the ball radius (exact at rounded corners: an entry inside a corner quadrant is
  resolved against that corner's circle, the shape being convex) and enemy-team hull circles; the earliest contact wins and the ball dies in the same
  step, so damage is applied exactly once. Balls only hit the other team (enemy balls pass
  through enemy ships). They expire at max range or when leaving the arena. Destroyed ships
  become non-colliding wrecks for `damage.wreckSeconds`.
- Broadphase: brute force (≤ ~25 ships, ≤ ~100 balls). Revisit in Phase 8 if profiling says so.

## Resource management and lifecycle

- **One owner per resource.** A session owns its Pixi `Application`, ticker callback, DOM
  listeners, resize observer, views, dynamic textures and audio sources; all are registered in
  a `DisposableScope` ([src/platform/disposableScope.ts](src/platform/disposableScope.ts)) that
  releases them in reverse order, exactly once, running every step even if one throws.
- **Abort-aware boot.** `createGameSession` is synchronous; its async boot (assets → Pixi
  `init` → match) checks an `AbortSignal` after every await. Pixi v8's `init` cannot be
  cancelled, so an aborted init destroys the half-made app, and the canvas is attached only
  once nothing can abort anymore. Under Strict Mode (mount → unmount → mount) the first
  session never shows a canvas: exactly one app, canvas and ticker callback remain
  ([tests/e2e/dev/strict-mode.spec.ts](tests/e2e/dev/strict-mode.spec.ts), dev server).
- **Teardown.** `destroy()` aborts the boot, disposes the scope (ticker callback, listeners,
  observer, audio), destroys the renderer (pools, private bar textures, display objects), then
  `app.destroy({ removeView: true }, { children: true, texture: false })`: atlas textures are
  page-wide and cached on purpose, so a second match downloads nothing.
- **Counting.** [src/platform/resourceCounters.ts](src/platform/resourceCounters.ts) counts
  apps, ticker callbacks, listeners, observers, dynamic textures and audio loops; the test hook
  (`?test=1`) adds live sessions, canvases, display objects (stage walk) and cached textures.
  E2E checks that leaving the game returns every count to 0 and that repeated matches do not
  accumulate; Phase 8 reuses it for the memory check.
- **Restart** (`session.restart`) creates a new world from the frozen config and releases all
  entity views to their pools; arena art, app and textures are reused.

## Local persistence

_Phase 4–5._

## Ranking and history integration (contracts, cache, pending recovery)

_Phase 5–6._

## Testing infrastructure

- Vitest (node environment) for pure modules and tooling. `pnpm test` runs with v8 coverage
  and **fails below 90 % line coverage on `src/game/core`** (threshold in
  [vite.config.ts](vite.config.ts)). Core tests drive `createMatch` + `step` with scripted
  inputs; helpers live in `src/game/core/testing/` (excluded from coverage and from the
  magic-number rule).
- Playwright against the production bundle (`pnpm e2e:serve` on port 4173),
  projects `desktop-chromium` and `mobile-chromium`; shared fixture
  ([tests/e2e/fixtures/test.ts](tests/e2e/fixtures/test.ts)) fails any test that logs a
  console error and waits for the mock backend.
- Visual baselines: pinned image `mcr.microsoft.com/playwright:v<version>-noble`,
  no platform suffix in snapshot paths; CI runs in the same image
  ([.github/workflows/ci.yml](.github/workflows/ci.yml)).

## Limitations and balancing

- All balancing lives in [src/config/defaults.ts](src/config/defaults.ts) (typed by
  [gameConfig.ts](src/config/gameConfig.ts), validated by [validate.ts](src/config/validate.ts)).
  `src/game/core` may not contain other numeric literals than 0/1/-1 (ESLint
  `no-magic-numbers`), so balancing never touches system code.
- [docs/BALANCE.md](docs/BALANCE.md) (`pnpm balance`) plays the same 50 seeds with two scripted
  bots ([src/game/core/testing/](src/game/core/testing/), test support only): **naive** (straight
  at the nearest enemy, reacts every step) and **skilled** (0.2 s reaction time, kites Chasers,
  routes around islands with the flow field, fires only when a weapon bears).
- Balancing target for the skilled bot, revised from 60–100 s / 20–50 %: median duration
  60–110 s and 15–50 % time_up. Applied: Chaser speed 125 → 105, spawn mix 60/40 → 50/50, ram
  damage 25 → 20, then fallback variant A (player HP 100 → 200, Shooter dmg 10 → 7, cooldown
  1.8 → 2.5 s). A grid with slower Shooter balls (280/320 u/s) barely moved the numbers,
  because the bots never steer away from incoming balls. Skilled median 36.2 s → 89.4 s,
  time_up 0 % → 6 %; after the Phase 2 map change and rounded corners 93.4 s / 4 %, so
  **the time_up bound is still not met**. Full table:
  [docs/DECISIONS.md](docs/DECISIONS.md) S17–S18. **Final tuning will be validated by manual
  play in Phases 3–4.**
- Enemy AI is deliberately simple: no strafing, no prediction of the player's motion, and
  enemies only avoid each other through physical separation.
- Island art: each Kenney sand tile has its own soft shading, so faint tone steps remain
  visible between tiles (bleeding seams are gone thanks to the padded atlas). The crew and pole
  frames (unused) are upscaled 1× art inside the 2× ship sheet (DECISIONS R1).
- Spawn backlog is unbounded by design (a due spawn is never dropped); with the 25-enemy cap it
  only builds up if the player leaves enemies alive for a long time.
