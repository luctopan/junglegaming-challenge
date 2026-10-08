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
  game/input/    keyboard/touch → abstract InputState (pure keymap + held state, thin DOM sources)
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

`main.tsx` lazily imports `src/mocks/browser.ts` and awaits `worker.start()` (with the page
query, for `?scenario=` and `?seed=`) before the first render in every build (dev, e2e, production demo). The worker script
`public/mockServiceWorker.js` is generated by `msw init` and versioned. Once the
worker is active `<html data-msw="ready">` is set; e2e fixtures wait for it. If the
worker fails to start, a visible startup error is rendered and the error is logged.

## React ↔ PixiJS integration

React owns screens and overlays; Pixi owns one canvas per game screen. They meet in three
places only:

1. **`useGameSession(containerRef, controlsRef, { config, muted })`** ([src/ui/game/](src/ui/game/)) creates a
   `GameSession` ([src/game/runtime/gameSession.ts](src/game/runtime/gameSession.ts)) in an
   effect and destroys it in the cleanup. The game screen is lazy-loaded, so Pixi and the
   runtime are not part of the menu's initial bundle.
2. **Bridge store** ([src/game/bridge/gameStore.ts](src/game/bridge/gameStore.ts)): the runtime
   publishes every frame, but subscribers are notified only when a displayed value changes
   (loading in whole percent, whole seconds left, HP points, score, phase, pause reason),
   read with `useSyncExternalStore`. React never renders per frame: the memoised HUD gets a
   new match object only when one of its values changed, and the e2e suite counts its
   commits through the test hook (≈ 1 per second, never per frame).
3. **Commands** from React to the session (`retryAssets`, `pause`, `resume`,
   `restart(config)`, `setMuted`) are plain method calls, stable across renders. The on-screen controls are plain buttons tagged with
   `data-game-action`; the runtime listens to their pointer events by delegation, so React
   holds no input state.

## UI layer (React)

- **Routes** ([src/ui/app/App.tsx](src/ui/app/App.tsx), React Router): menu routes (`/`,
  `/options`, `/records/:tab`) share a shell with the dimmed scene backdrop and the brand
  logo. `/play` and `/result` share one layout route
  ([MatchLayout.tsx](src/ui/app/MatchLayout.tsx)), so when a match ends the URL becomes
  `/result` while the arena and its session stay mounted, and Play again reuses the canvas.
  A match starts only from an in-app Play (an in-memory flag): a reload or a history entry
  on `/play` goes to the menu (abandoned, never recorded); `/result` opened directly shows
  the stored last result. Navigation keeps the query string (`?test=1`, `?seed=`…).
- **State**: game state only through the bridge store; UI settings through small persistent
  external stores ([src/ui/state/](src/ui/state/)) read with `useSyncExternalStore`. No
  global state library.
- **Components** ([src/ui/components/](src/ui/components/)) draw the UI atlas with CSS: the
  panel is a 9-slice `border-image` of `panel_menu` (slices in percent, so the 1× and 2×
  PNGs of the `image-set()` cut alike); menu buttons are a horizontal 3-slice with the
  atlas normal/hover/pressed/disabled art (missing secondary states derived with filters);
  round buttons and icons likewise. The focus ring is ours (`:focus-visible`, cream ring
  with a dark halo), never an atlas state. Text colours are tokens in
  [tokens.css](src/ui/styles/tokens.css); a tooling test samples the atlas PNGs and checks
  every text token at ≥ 4.5:1 against the art it sits on.
- **HUD** ([Hud.tsx](src/ui/game/Hud.tsx)): `health_frame` with the fill clipped by
  `clip-path` from `ui.layout.fill_rect` (same green/amber/red bands as the in-world bar,
  published by the bridge as `hpTone`), score/time counters, sound and pause buttons.
- **Accessibility**: modal dialogs ([Dialog.tsx](src/ui/components/Dialog.tsx)) with initial
  focus, a Tab trap, Escape where it makes sense and focus returned to the opener; Options as
  ARIA spinbuttons; Ranking/Match History as ARIA tabs; errors linked with
  `aria-describedby` and announced. A polite live region
  ([MatchAnnouncer.tsx](src/ui/game/MatchAnnouncer.tsx)) follows the ~1 Hz bridge snapshot:
  state changes, score (coalesced, one per second), time at 30 s marks and at 10 s left,
  hull damage bands; it writes its text directly, without React renders. Game keys are
  captured only while a match runs.
- **Orientation**: on touch devices gameplay is landscape-only; in portrait an overlay
  covers the game and pauses it with reason `portrait` (menus work in both).

## Input and pause

- **Mapping** ([src/game/input/keymap.ts](src/game/input/keymap.ts), pure): keys by
  `KeyboardEvent.code` (layout and Caps Lock independent). `interpretKeyDown(event, active)`
  decides per keydown: ignore (not a game key, Ctrl/Alt/Meta shortcuts, or gameplay not
  running), swallow (auto-repeat: prevented but never acts), press a held action, or an edge
  command (pause).
- **Held state** ([inputState.ts](src/game/input/inputState.ts), pure): each action is held by
  a set of sources (`key:KeyW`, `pointer:3`), so two keys or two fingers on one action, and
  steering with one finger while firing with another, just work. A press is latched until
  the next simulation sample, so a tap shorter than a step still acts once. `clear()` drops
  everything.
- **DOM sources** (thin): the keyboard source listens on `window`, prevents the default of
  game keys only while the match runs (no scroll on Space/arrows, no button activation), and
  also prevents the keyup of a key whose keydown it captured, so releasing Space after
  pausing cannot click the focused Resume button. It ignores events the UI already handled
  (`defaultPrevented`). The touch source uses pointer events with pointer capture on the
  pressed control; `pointerup`, `pointercancel` and `lostpointercapture` release that
  pointer; `contextmenu` is prevented on controls, whose CSS sets `touch-action: none` and
  disables selection and the long-press callout.
- **Match driver** ([src/game/runtime/matchDriver.ts](src/game/runtime/matchDriver.ts), no
  DOM/Pixi, unit-tested): world + fixed stepper + `InputState` + pause state. While paused
  the stepper is not ticked, so the timer, cooldowns, AI and spawns stand still. Pausing and
  resuming both clear held input; resuming resets the stepper baseline, so paused wall-clock
  time never enters the accumulator (the first frame after Resume only sets the baseline).
- **Pause sources**: the Pause button or `Esc`/`P` (manual), window `blur`, and
  `visibilitychange` to hidden (also checked when the match starts). Resume needs an explicit
  action: the dialog's Resume button or a fresh `Esc`/`P` (auto-repeat ignored). Effects,
  water and camera shake freeze with the match; audio is silenced through the output gain.
- **Rendering only when a frame can change** ([renderPolicy.ts](src/game/runtime/renderPolicy.ts)):
  a pause renders one final frame and stops the Pixi ticker until Resume; under the test
  manual clock the ticker never runs and `advance(ms)` renders once at its end. A resize
  redraws once while the ticker is stopped. This keeps paused games and the e2e suite off
  the CPU (DECISIONS I15).
- **Abandon**: a match ends without a result when its session is destroyed (Main menu,
  leaving the screen, reload); only `matchEnded` can produce a record (Phase 5), so an
  abandoned match can never be recorded.

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
wreck, HP bar kept fully inside the arena: above the ship, or below it when there is no
room, then clamped to the edges — `placeHpBar`, unit-tested), `ProjectileLayer` (ball + trail), `EffectLayer` (muzzle, hit, puff,
explosion, splash, debris). Ship views, balls, effects and HP bars are pooled and keyed by
entity id; a restart releases them for reuse. HP bars clip the fill sprite's private texture
frame to `fill_rect.x + ratio × fill_rect.w` (the atlas `ui.layout`), updated only when the
visible width changes, so all bars still batch (no masks).

**Arena art from the collision grid.** `shoreShape` (core) classifies every solid cell as
fill / edge / outer corner / inner corner; `validateMap` rejects any layout with a cell no tile
can draw, so a valid map is always drawable (a property test checks random valid maps). The
grass-island tiles are one painted 4×4 island, so each island cell takes the tile at its
position along its row and column runs; the map only uses 4×4 islands, the one size the art
draws seamlessly, and the build heals the small colour steps left inside the painting
(DECISIONS R14). The dilated mask around the islands uses the shallow-water set by shape.
Decoration (a hand-placed fort, seeded plants and rocks) sits only on land and never collides.

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
- **Restart** (`session.restart`, the Play again button) builds a new `MatchDriver`: a fresh
  world from the frozen config, stepper, input state and pause state, with no pending events;
  all entity views go back to their pools. Arena art, the Pixi app and textures are reused
  (PLAN §2.8), so Play again needs no WebGL start-up. Leaving the screen destroys the whole
  session; e2e checks that repeated play/exit cycles return every counter to baseline.

## Local persistence

All local data goes through [src/platform/storage.ts](src/platform/storage.ts) (typed
JSON, never throws: missing, blocked or full storage and corrupted values are reported, not
raised). Each key has one validating parser; an invalid stored value falls back to the
default and is flagged `recovered` (Options shows an accessible message until the next save).

| Key                    | Content                                                          |
| ---------------------- | ---------------------------------------------------------------- |
| `pirate.options.v1`    | Session time and spawn interval (validated against their bounds) |
| `pirate.profile.v1`    | `{ playerId (UUID v4), name }`                                   |
| `pirate.lastResult.v1` | Last completed match as a `MatchSubmission` (fixed `playedAt`)   |
| `pirate.audio.v1`      | `{ muted }`                                                      |

The last result is written once per `matchId` when the match ends, so a re-render or a
refresh never records twice.

The API layer adds `pirate.pending.v1` (matches not yet confirmed, see below), the mock
backend `pirate.mockdb.v1` + `pirate.mockdb.revision.v1` (its records), and the scenario
lives in `sessionStorage` (`pirate.scenario.v1`, per tab).

## Ranking and history integration (contracts, cache, pending recovery)

```
UI (records panels, Result)         src/ui
   │ useRankingPage / useHistoryPage / useRankedConfigs / useSubmissionStatus
   ▼
TanStack Query cache + SubmissionService (MutationObserver)    src/api
   │ ApiClient (Axios, timeout, AbortSignal, response guards, ApiError)
   ▼
fetch → Mock Service Worker → handlers (scenario plan → mock db)   src/mocks
```

**Contracts** ([src/api/contracts.ts](src/api/contracts.ts)), shared by client and mock:

| Endpoint                                           | Answer                                                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `GET /api/ranking?configKey&page&pageSize`         | `Page<RankingEntry>`; only matches with the same `configKey` (e.g. `120s-3s`)                     |
| `GET /api/ranking/configs`                         | `RankedConfig[]` (configs with records, for the settings selector)                                |
| `GET /api/players/:playerId/matches?page&pageSize` | `Page<MatchRecord>`, newest first                                                                 |
| `PUT /api/matches/:matchId`                        | `201` created · `200` identical record already stored · `409` same id, other data · `422` invalid |

`Page<T>` carries `page`, `pageSize`, `totalItems`, `totalPages` and the server
`revision`. A `MatchSubmission` holds `matchId` (UUID generated at match start),
`playerId`, `playerName` at the time, `playedAt` (fixed at match end), `score`,
`durationMs` (effective, unpaused), `endReason` and the two-option `config`. Ranking order
is deterministic: score desc → duration asc → `playedAt` asc → `matchId` asc; one entry
per match (a captain can appear several times).

**Client** ([client.ts](src/api/client.ts)): one Axios instance, `baseURL /api`, timeout
`VITE_API_TIMEOUT_MS` (8 s; `?apiTimeout=` in test mode). Every body is validated by
hand-written guards ([guards.ts](src/api/guards.ts)); every failure is normalised to
`ApiError { kind: timeout | network | http | invalid, status }`
([errors.ts](src/api/errors.ts)), and only `timeout`, `network`, 5xx and 429 are retryable.

**Cache policy** ([queryClient.ts](src/api/queryClient.ts), [hooks.ts](src/api/hooks.ts)):
keys `['ranking','page',configKey,page]`, `['ranking','configs']`,
`['history',playerId,page]` ([queryKeys.ts](src/api/queryKeys.ts)); `staleTime` 15 s,
`gcTime` 5 min, `refetchOnWindowFocus`, `refetchOnMount: 'always'` (showing a tab again
refreshes it in the background while the cached rows stay), `keepPreviousData` while the
next page loads, ≤ 2 retries with 0.5 s / 1 s backoff. The panels render loading
(skeleton + status), empty, error with Retry, and "could not refresh, showing saved data"
when a background refetch fails over cached rows.

**Stale and out-of-order responses**: the query's `AbortSignal` is passed to Axios, so a
request that is superseded (another page, unmount, invalidation with `cancelRefetch`) is
aborted and can never write to the cache. As a second guard, a page whose `revision` is
older than the cached page of the same key is ignored; the mock's revision is persisted
apart from its data and only grows, so a Reset (which also clears the query cache) can
never lock fresh data out.

**Submission and pending recovery** ([submissions.ts](src/api/submissions.ts),
[pendingQueue.ts](src/api/pendingQueue.ts)):

1. When a match ends the Result is stored (`pirate.lastResult.v1`) and the submission is
   **written to `pirate.pending.v1` before any request** — a crash, a closed tab or a
   refresh cannot lose it, and the stored payload is the byte-identical one every resend
   uses.
2. `SubmissionService.send` runs a TanStack `MutationObserver`
   (`mutationKey ['submitMatch', matchId]`, same retry policy). Single flight per
   `matchId` (in-memory map) prevents parallel duplicates; the idempotent PUT covers
   other tabs and refreshes (a resend after a lost answer gets `200`, never a second row).
3. Success → removed from the queue, status `saved`, `ranking` and `history` roots
   invalidated (both tabs refresh), and the rest of the queue is flushed.
   Retryable failure → `pending` (kept, resent automatically); 4xx → `failed` (kept,
   resent only by Retry).
4. Flush triggers: app start (before the first screen), the `online` event, the Result's
   Retry button, the dev panel, and after any success.

The Result screen shows `Saving… / Saved / Not saved yet (Retry) / Could not save
(Retry)` in a polite live region; nothing here ever blocks Play again, Options or the
game.

**Mock backend** ([src/mocks](src/mocks)): `db.ts` (records in `pirate.mockdb.v1`,
idempotent `put`, monotonic revision), `fixtures.ts` (fixed dates, `fixture-` ids that
can never equal a player UUID), `ranking.ts` (pure sort/paginate/configs, unit-tested),
`scenario.ts` (per-request plan: latency from a seeded RNG, failure, hang-after-commit)
and `handlers/records.ts`. The dev panel ([MockPanel.tsx](src/ui/network/MockPanel.tsx))
controls it through `/api/__mock/{status,scenario,recover,reset}`, which scenarios never
affect, so the UI never imports the mock layer.

## Testing infrastructure

- Vitest (node environment) for pure modules and tooling. `pnpm test` runs with v8 coverage
  and **fails below 90 % line coverage on `src/game/core`** (threshold in
  [vite.config.ts](vite.config.ts)). Core tests drive `createMatch` + `step` with scripted
  inputs; helpers live in `src/game/core/testing/` (excluded from coverage and from the
  magic-number rule).
- Playwright against the production bundle (`pnpm e2e:serve` on port 4173),
  projects `desktop-chromium` and `mobile-chromium` (touch specs use CDP multi-touch, so
  Chromium produces real touch pointer events); shared fixture
  ([tests/e2e/fixtures/test.ts](tests/e2e/fixtures/test.ts)) fails any test that logs a
  console error and waits for the mock backend.
- Test hook (`?test=1` only, [testHook.ts](src/game/runtime/testHook.ts)): seed and manual
  clock for the next sessions (`?seed=`, `?clock=manual`), `advance(ms)` running the real
  frame function in 60 Hz frames, a JSON `snapshot()`, resource and HUD-commit counters. It
  has no setter for game state: combat tests press real keys and touch real controls.
- Dev-only balance overrides (`?cfg.<path>=<value>`,
  [configOverrides.ts](src/config/configOverrides.ts)) are applied only when
  `import.meta.env.DEV`; Rollup drops the module from production, and
  [verify-dist](scripts/verify-dist.mjs) fails the build if it or its log text appears.
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
  time_up 0 % → 6 %; after the Phase 2 maps and rounded corners 112.3 s / 26 %: the time_up
  share is now inside the target, the median 2.3 s above it (DECISIONS R15). Full table:
  [docs/DECISIONS.md](docs/DECISIONS.md) S17–S18. **Final tuning will be validated by manual
  play in Phases 3–4.**
- Enemy AI is deliberately simple: no strafing, no prediction of the player's motion, and
  enemies only avoid each other through physical separation.
- Island art: the delivered grass-island tiles only tile seamlessly as one 4×4 island, so
  every island is 4×4 (DECISIONS R14); larger or irregular islands like the mockup's would need
  new art. The crew and pole frames (unused) are upscaled 1× art inside the 2× ship sheet
  (DECISIONS R1).
- Spawn backlog is unbounded by design (a due spawn is never dropped); with the 25-enemy cap it
  only builds up if the player leaves enemies alive for a long time.
