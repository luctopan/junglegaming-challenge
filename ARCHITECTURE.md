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

_Phase 1_ (fixed timestep 1/60 s, accumulator, max-frame clamp; see PLAN §2.2).

## Collisions

_Phase 1._

## Resource management and lifecycle

_Phase 2–3._

## Local persistence

_Phase 4–5._

## Ranking and history integration (contracts, cache, pending recovery)

_Phase 5–6._

## Testing infrastructure

- Vitest (node environment) for pure modules and tooling.
- Playwright against the production bundle (`pnpm e2e:serve` on port 4173),
  projects `desktop-chromium` and `mobile-chromium`; shared fixture
  ([tests/e2e/fixtures/test.ts](tests/e2e/fixtures/test.ts)) fails any test that logs a
  console error and waits for the mock backend.
- Visual baselines: pinned image `mcr.microsoft.com/playwright:v<version>-noble`,
  no platform suffix in snapshot paths; CI runs in the same image
  ([.github/workflows/ci.yml](.github/workflows/ci.yml)).

## Limitations and balancing

_Phase 1 / 8._
