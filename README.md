# Pirate Battle

Single-player naval arena game built with React, TypeScript, PixiJS, TanStack Query,
Axios and MSW, tested with Vitest and Playwright. Everything runs in the browser; the
ranking and match-history backend is mocked at network level by MSW in every build,
including the public demo.

> Status: **Phase 4 (React screens and accessibility) complete.** Menu, Options, captain
> name, HUD, touch controls, pause, Result and the Captain's Log (Ranking / Match History)
> follow the mockups. The Captain's Log still reads a temporary in-memory source; the
> Axios + TanStack Query API layer over MSW comes in Phase 5.
> See [docs/PLAN.md](docs/PLAN.md) for the requirement checklist and phase status.

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

| Command                | What it does                                                          |
| ---------------------- | --------------------------------------------------------------------- |
| `pnpm dev`             | Build runtime assets, start the Vite dev server                       |
| `pnpm build`           | Build runtime assets, typecheck, bundle `dist/`, verify no dev code   |
| `pnpm preview`         | Serve `dist/` locally                                                 |
| `pnpm typecheck`       | `tsc -b` over app, simulation core (no DOM) and tooling projects      |
| `pnpm lint`            | ESLint (type-checked rules, a11y, React hooks, layer boundaries)      |
| `pnpm format`          | Prettier write (`format:check` verifies only)                         |
| `pnpm test`            | Vitest unit tests + coverage (fails below 90 % lines on core)         |
| `pnpm test:watch`      | Vitest in watch mode (no coverage)                                    |
| `pnpm balance`         | 50 headless seeded matches → [docs/BALANCE.md](docs/BALANCE.md)       |
| `pnpm sandbox:shots`   | Visual-review screenshots of the render sandbox (see below)           |
| `pnpm ui:shots`        | Screenshots of every screen → `docs/screenshots/phase4/`              |
| `pnpm test:e2e`        | Playwright: production bundle (desktop + mobile) and dev server       |
| `pnpm test:e2e:docker` | Same suite inside the pinned Playwright Linux image (`--cpus=2` = CI) |
| `pnpm test:e2e:update` | Regenerate visual baselines inside the pinned image                   |
| `pnpm assets:build`    | Regenerate `public/assets/` (Pixi atlases, sounds, branding)          |

## Testing

- **Unit** (`pnpm test`): pure modules under `src/**` plus tooling checks in
  `tests/tooling/` (atlas generation, layer boundaries, CI image version).
- **E2E** (`pnpm test:e2e`): Playwright builds and serves the production bundle on port
  4173, then runs `desktop-chromium` (1280×720) and `mobile-chromium` (Pixel 7
  landscape, touch). The `dev-strict-mode` project runs `tests/e2e/dev/` against a Vite
  dev server on port 5174, because React Strict Mode only double-mounts in development.
  Any console error fails a test (tests declare the ones they provoke on purpose). HTML
  report in `playwright-report/` (`pnpm exec playwright show-report`); traces are kept on
  failure.
- **Test hook**: with `?test=1` the app exposes `window.__PIRATE_TEST__`; it is absent
  otherwise. It controls _when_ time passes and observes, but cannot change rules or state
  (combat tests press real keys and touch real controls):
  - `setSeed(n)` / `?seed=n`: seed of the next match; `useManualClock()` /
    `?clock=manual`: simulation time only moves with `advance(ms)`, which runs the
    simulation in 60 Hz frames and then renders exactly one frame (no continuous
    rendering under the manual clock).
  - `snapshot()`: JSON state of the live match (phase, pause reason, time, score, player
    pose/HP/cooldowns, enemies, projectiles, whether any input is held).
  - `resources()`: live apps, canvases, ticker callbacks, listeners, observers, dynamic
    textures, display objects, cached textures. `hudCommits()`: HUD React commits (it must
    follow the bridge store, ≈ 1 per second, never the frame rate). `framesRendered()`:
    frames drawn so far (none while paused).
- **Workers**: 4 locally, 2 in CI. Every game page renders WebGL on the CPU in headless
  Chromium, and more parallel pages starve each other into start-up timeouts.
- **Visual baselines** are generated only inside
  `mcr.microsoft.com/playwright:v<installed version>-noble` so they match CI on any host
  OS: run `pnpm test:e2e:update` (needs Docker running). CI uses the same image.

## Render sandbox (dev only)

`pnpm dev`, then open <http://localhost:5173/sandbox.html>: a full match rendered with
Pixi where the scripted skilled bot steers the player, with seed, speed (pause … 8×),
restart, collision overlay and sound controls. Query parameters make a frame
reproducible: `seed`, `speed`, `stopAt=<sim seconds>`, `pauseOnExplosion=1`,
`pauseOnFight=1`, `spawn=x,y,headingDeg`, `pilot=forward`, `overlay=1`, `ui=0`.
`pnpm sandbox:shots [dir]` captures the phase screenshots
([docs/screenshots/phase2/](docs/screenshots/phase2/)). The sandbox is not a build input
and `pnpm build` fails if any of its code reaches `dist/`.

## Project layout

```
src/
  config/   shared/   platform/          pure config · pure utilities · browser adapters
  game/{core,input,render,runtime,bridge} simulation → input → Pixi views → lifecycle → UI sync
  api/      mocks/    ui/                contracts + queries · MSW backend · React screens
  dev/                                   dev-server-only render sandbox (never bundled)
tests/e2e/  tests/tooling/  scripts/
```

Layer rules and their enforcement are described in [ARCHITECTURE.md](ARCHITECTURE.md);
decisions and assumptions are recorded in [docs/DECISIONS.md](docs/DECISIONS.md).

## Controls

Keys are matched by physical position (`KeyboardEvent.code`), so they work the same on
QWERTY, AZERTY or ABNT layouts and with Caps Lock on. They are captured only while a match
is running; menus, dialogs and page scrolling keep their normal keys.

| Action               | Keyboard           | Touch (on-screen)              |
| -------------------- | ------------------ | ------------------------------ |
| Sail forward         | `W` or `↑`         | Up arrow (bottom left, raised) |
| Turn left / right    | `A` `D` or `←` `→` | Curved arrows (bottom left)    |
| Fire front cannon    | `Space` or `K`     | Middle button (bottom right)   |
| Fire left broadside  | `Q` or `J`         | Left button (bottom right)     |
| Fire right broadside | `E` or `L`         | Right button (bottom right)    |
| Pause / resume       | `Esc` or `P`       | Pause (top right) / Resume     |

The main menu always shows a one-line summary (touch wording on touch devices) and a
**Controls** button with the full table, generated from the game's own key map. The
on-screen controls appear where touch is the primary input; on touch devices gameplay is
landscape-only: turning to portrait covers the screen and pauses the match.

Hold a control to keep acting (weapons fire again as soon as their cooldown allows); move
and fire at the same time with several keys or fingers. The match also pauses by itself
when the window loses focus or the tab is hidden; it only resumes on an explicit Resume
(button, or a fresh `Esc`/`P` press), and nothing held before the pause acts again until
it is pressed again. Leaving the game screen or reloading abandons the match (it is never
recorded).

### Balance overrides (dev server only)

For manual balancing on `pnpm dev`, any number or boolean of the gameplay config can be
overridden from the URL with `cfg.<path>=<value>`, e.g.

```
http://localhost:5173/?cfg.ships.player.maxHp=150&cfg.weapons.shooterCannon.projectileSpeed=300
```

Paths follow [src/config/gameConfig.ts](src/config/gameConfig.ts) (array entries by index,
e.g. `cfg.damage.stageThresholds.1=0.25`). Each override is applied in order and must keep
the whole config valid; unknown paths, non-numbers and invalid values are ignored with a
`[dev config]` console warning, and the active overrides are listed in the console. The
production build ignores them: the parser is not even bundled (`pnpm build` fails if it
is, see `scripts/verify-dist.mjs`).

## Screens

| Route              | Screen                                                                       |
| ------------------ | ---------------------------------------------------------------------------- |
| `/`                | Main menu: Play, Options, Ranking, Match history, controls, sound toggle     |
| `/options`         | Session time and spawn interval (spinbuttons, saved on change), captain name |
| `/play`            | The match (opened only from Play; a reload or history entry goes to `/`)     |
| `/result`          | Result of the last completed match (kept after a refresh)                    |
| `/records/ranking` | Captain's Log, Ranking tab (per battle settings, `YOU` badge)                |
| `/records/history` | Captain's Log, Match History tab                                             |

On the first Play the game asks for a **captain name** (2–20 letters, digits, spaces,
`'` or `-`); it can be changed in Options. The player is identified by a random
`playerId` stored with it, so renaming never loses ranking or history rows. Saved locally:
`pirate.options.v1`, `pirate.profile.v1`, `pirate.lastResult.v1`, `pirate.audio.v1`
(corrupted values fall back to defaults, with a message on Options).

Until Phase 5 the Captain's Log reads in-memory fixtures plus your last result. On the dev
server or with `?test=1`, `?records=demo|loading|empty|error` forces its states.

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
UI font: **Archivo** (Omnibus-Type, SIL Open Font License 1.1), self-hosted through
`@fontsource-variable/archivo`. Icons the atlas lacks (sound, help) are small inline SVGs
drawn for this project.
