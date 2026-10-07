# Architecture

Living document; sections are filled as each phase lands (see [docs/PLAN.md](docs/PLAN.md)).

## Layers and dependency rules

```
src/
  shared/        pure utilities (rng, math, emitter, assertNever) — no browser APIs
  platform/      browser adapters (storage, visibility, uuid, …)
  config/        typed gameplay config, defaults, validation (pure)
  game/core/     deterministic simulation (pure TypeScript)
  game/input/    keyboard/touch → abstract InputState
  game/render/   PixiJS views, effects, asset registry, viewport
  game/runtime/  GameSession: wires core + input + render + clock; lifecycle
  game/bridge/   external store with low-frequency snapshots for React
  api/           contracts, Axios client, query keys, TanStack Query hooks
  mocks/         MSW handlers, fixtures, scenarios, persistence
  ui/            React screens, components, a11y helpers
  main.tsx       composition root (may import anything; nothing imports it)
```

| Layer        | May import                                            | Packages allowed (of react, react-dom, react-router, pixi.js, axios, @tanstack, msw) |
| ------------ | ----------------------------------------------------- | ------------------------------------------------------------------------------------ |
| shared       | —                                                     | none                                                                                 |
| platform     | shared                                                | none                                                                                 |
| config       | shared                                                | none                                                                                 |
| game/core    | config, shared                                        | none                                                                                 |
| game/input   | core, config, shared, platform                        | none                                                                                 |
| game/render  | core, config, shared, platform                        | pixi.js                                                                              |
| game/bridge  | core, shared                                          | none                                                                                 |
| game/runtime | core, input, render, bridge, config, shared, platform | pixi.js                                                                              |
| api          | config, shared, platform                              | react, axios, @tanstack                                                              |
| mocks        | api, shared, platform                                 | msw                                                                                  |
| ui           | runtime, bridge, api, config, shared, platform        | react, react-dom, react-router, @tanstack                                            |

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

| Output                          | Source                                                                  |
| ------------------------------- | ----------------------------------------------------------------------- |
| `ships/ships_sheet.{json,png}`  | Sparrow XML → Pixi JSON (102 frames, `.png` suffix dropped)             |
| `tiles/tiles_sheet{,_retina}.*` | 16×6 grid → `tile_1..96` row-major (64 px / 128 px, `meta.scale` 1 / 2) |
| `ui/ui_sheet{,_retina}.*`       | copied (already Pixi JSON)                                              |
| `sounds/*.wav`, `branding/*`    | copied                                                                  |

Pure conversion helpers live in [scripts/lib/atlas.mjs](scripts/lib/atlas.mjs); a test
checks every generated tile frame is pixel-identical to the delivered `tile_N.png`.
Vite emits its hashed bundles to `dist/static/` so they never mix with `dist/assets/`.

## Mock backend bootstrap

`main.tsx` lazily imports `src/mocks/browser.ts` and awaits `worker.start()` before the
first render in every build (dev, e2e, production demo). The worker script
`public/mockServiceWorker.js` is generated by `msw init` and versioned. Once the
worker is active `<html data-msw="ready">` is set; e2e fixtures wait for it. If the
worker fails to start, a visible startup error is rendered and the error is logged.

## React ↔ PixiJS integration

_Phase 2–3._

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
  sides that face water (no gaps where two rects of one island meet). `validateMap` enforces
  2×2-composable islands, channels ≥ 2 tiles, no diagonal-only contacts and connected water.
- **Ships**: two overlapping circles along the hull axis (r 24 at ±18 u; validation requires
  offset < radius so there is no gap amidships). Ship vs island: closest-point push-out per
  circle (ships slide along shores); arena: circles clamped inside. Ship vs ship: pairwise
  circle separation, except Chaser–player contact, which is a ram. Several relaxation passes,
  static geometry last.
- **Projectiles**: points with radius, moved with a swept segment test against padded island
  rects and enemy-team hull circles; the earliest contact wins and the ball dies in the same
  step, so damage is applied exactly once. Balls only hit the other team (enemy balls pass
  through enemy ships). They expire at max range or when leaving the arena. Destroyed ships
  become non-colliding wrecks for `damage.wreckSeconds`.
- Broadphase: brute force (≤ ~25 ships, ≤ ~100 balls). Revisit in Phase 8 if profiling says so.

## Resource management and lifecycle

_Phase 2–3._

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
- [docs/BALANCE.md](docs/BALANCE.md) (`pnpm balance`) plays 50 seeded headless matches with a
  scripted bot. With the current defaults the bot is defeated in every match after ~34 s
  (score ≈ 6): the defaults are on the hard side; to be tuned with human play once rendering and
  input exist (Phase 3–4).
- Enemy AI is deliberately simple: no strafing, no prediction of the player's motion, and
  enemies only avoid each other through physical separation.
- Spawn backlog is unbounded by design (a due spawn is never dropped); with the 25-enemy cap it
  only builds up if the player leaves enemies alive for a long time.
