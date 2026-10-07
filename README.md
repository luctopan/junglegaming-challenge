# Pirate Battle

Single-player naval arena game built with React, TypeScript, PixiJS, TanStack Query,
Axios and MSW, tested with Vitest and Playwright. Everything runs in the browser; the
ranking and match-history backend is mocked at network level by MSW in every build,
including the public demo.

> Status: **Phase 1 (config + deterministic simulation core) complete.** Rendering, input and
> screens arrive in later phases; see [docs/PLAN.md](docs/PLAN.md) for the requirement
> checklist and phase status.

## Requirements

- Node.js ≥ 22.18 (developed on 24, see `.nvmrc`)
- pnpm 10 (pinned through `packageManager`; `corepack enable` or `npm i -g pnpm@10`)
- Docker (only for visual-regression baselines, see [Testing](#testing))

## Setup

```bash
pnpm install
pnpm exec playwright install chromium
pnpm dev
```

`pnpm dev` and `pnpm build` first run `pnpm assets:build`, which generates the runtime
assets in `public/assets/` (git-ignored) from the delivered `assets/` folder.

## Scripts

| Command                | What it does                                                     |
| ---------------------- | ---------------------------------------------------------------- |
| `pnpm dev`             | Build runtime assets, start the Vite dev server                  |
| `pnpm build`           | Build runtime assets, typecheck, production bundle in `dist/`    |
| `pnpm preview`         | Serve `dist/` locally                                            |
| `pnpm typecheck`       | `tsc -b` over app, simulation core (no DOM) and tooling projects |
| `pnpm lint`            | ESLint (type-checked rules, a11y, React hooks, layer boundaries) |
| `pnpm format`          | Prettier write (`format:check` verifies only)                    |
| `pnpm test`            | Vitest unit tests + coverage (fails below 90 % lines on core)    |
| `pnpm test:watch`      | Vitest in watch mode (no coverage)                               |
| `pnpm balance`         | 50 headless seeded matches → [docs/BALANCE.md](docs/BALANCE.md)  |
| `pnpm test:e2e`        | Playwright on the production bundle, desktop + mobile Chromium   |
| `pnpm test:e2e:docker` | Same suite inside the pinned Playwright Linux image              |
| `pnpm test:e2e:update` | Regenerate visual baselines inside the pinned image              |
| `pnpm assets:build`    | Regenerate `public/assets/` (Pixi atlases, sounds, branding)     |

## Testing

- **Unit** (`pnpm test`): pure modules under `src/**` plus tooling checks in
  `tests/tooling/` (atlas generation, layer boundaries, CI image version).
- **E2E** (`pnpm test:e2e`): Playwright builds and serves the production bundle on port
  4173, then runs `desktop-chromium` (1280×720) and `mobile-chromium` (Pixel 7
  landscape, touch). Any console error fails a test. HTML report in
  `playwright-report/` (`pnpm exec playwright show-report`); traces are kept on failure.
- **Visual baselines** are generated only inside
  `mcr.microsoft.com/playwright:v<installed version>-noble` so they match CI on any host
  OS: run `pnpm test:e2e:update` (needs Docker running). CI uses the same image.

## Project layout

```
src/
  config/   shared/   platform/          pure config · pure utilities · browser adapters
  game/{core,input,render,runtime,bridge} simulation → input → Pixi views → lifecycle → UI sync
  api/      mocks/    ui/                contracts + queries · MSW backend · React screens
tests/e2e/  tests/tooling/  scripts/
```

Layer rules and their enforcement are described in [ARCHITECTURE.md](ARCHITECTURE.md);
decisions and assumptions are recorded in [docs/DECISIONS.md](docs/DECISIONS.md).

## Controls

_Phase 3/4._ Planned mapping in [docs/DECISIONS.md](docs/DECISIONS.md).

## Gameplay configuration

Every gameplay parameter lives in one typed object: [src/config/gameConfig.ts](src/config/gameConfig.ts)
(type, with units documented per field) and [src/config/defaults.ts](src/config/defaults.ts)
(values). It is validated by [src/config/validate.ts](src/config/validate.ts) and frozen into each
match at start, so balancing never requires changes to system code. Units: world units (the
arena is 1024×576, 16×9 tiles of 64), seconds, degrees.

The Options screen exposes two parameters ([src/config/options.ts](src/config/options.ts)):

| Option            | Range        | Step  | Default |
| ----------------- | ------------ | ----- | ------- |
| Game session time | 60 – 180 s   | 10 s  | 120 s   |
| Enemy spawn time  | 1.0 – 10.0 s | 0.5 s | 3 s     |

The spawn interval is always positive; a due spawn is never skipped (it waits while the
25-enemy safety cap is reached or no clear spawn point exists). Default balancing and its
rationale: [docs/DECISIONS.md](docs/DECISIONS.md); measured outcomes:
[docs/BALANCE.md](docs/BALANCE.md).

## Environment variables

_Phase 5_ (`VITE_API_TIMEOUT_MS`). None are required to run the app.

## Network scenarios (MSW)

_Phase 6_ (`?scenario=<name>`, dev panel via `?dev=1`, reset).

## Reproducing failures

_Phase 6/7._

## Asset sources and licenses

_Phase 8._ Art based on the Kenney “Pirate Pack” (CC0) plus the provided “Pirate Battle
UI asset pack”; see [docs/ASSETS.md](docs/ASSETS.md).
