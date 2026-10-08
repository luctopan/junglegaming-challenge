# Pirate Battle

Single-player naval arena game built with React, TypeScript, PixiJS, TanStack Query,
Axios and MSW, tested with Vitest and Playwright. Everything runs in the browser; the
ranking and match-history backend is mocked at network level by MSW in every build,
including the public demo.

## For reviewers

**Live demo: <https://junglegaming-challenge.vercel.app/>** (desktop, or a phone in
landscape; the mock backend runs in the browser, so reloads and deep links work).

### 5-minute evaluation path

1. **Play** a match: enter a captain name, sail with `W`/`A`/`D` (or the arrows), fire
   with `Space` (front) and `Q`/`E` (broadsides), pause with `Esc`/`P`. Shorten the battle
   in **Options** (60 s) if you like.
2. On the **Result** screen the record status goes _Saving… → Saved_. Open **Ranking**
   (your row has a `YOU` badge, ranked among matches with the same settings) and **Match
   history** (your battles, newest first).
3. Open <https://junglegaming-challenge.vercel.app/?dev=1> (or the discreet **Mock
   backend** link at the bottom of the main menu) and pick a failure scenario, then play
   or open the Captain's Log:
   - `write-timeout-after-commit`: the first save is stored but its answer is lost; the
     client times out, resends the byte-identical record and the server recognises it
     (one row, no duplicate).
   - `unavailable-then-recover`: saves get 503; the Result shows _Pending_ with Retry; the
     record survives a refresh and is sent on the next start, on Retry or after Recover.
   - `slow`, `empty`, `ranking-fail`, `out-of-order`: loading, empty, error and
     late-response handling of the Captain's Log. **Reset** clears everything.

### Requirement map (`docs/CHALLENGE.md`)

| Spec section                   | Code                                                                                                | Tests                                                                                                                                        | Docs                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1 Stack                        | [package.json](package.json), [src/main.tsx](src/main.tsx)                                          | all suites                                                                                                                                   | [ARCHITECTURE](ARCHITECTURE.md#layers-and-dependency-rules)                                      |
| 2 Gameplay                     | [src/game/core](src/game/core) (pure, deterministic), [src/config](src/config)                      | `src/game/core/**/*.test.ts`, [movement](tests/e2e/movement.spec.ts), [combat](tests/e2e/combat.spec.ts)                                     | [ARCHITECTURE](ARCHITECTURE.md#simulation-loop), [BALANCE](docs/BALANCE.md)                      |
| 3 Screens and config           | [src/ui/screens](src/ui/screens), [src/config/options.ts](src/config/options.ts)                    | [options](tests/e2e/options.spec.ts), [result](tests/e2e/result.spec.ts), [navigation](tests/e2e/navigation.spec.ts)                         | [Screens](#screens), [Gameplay configuration](#gameplay-configuration)                           |
| 4 PixiJS and architecture      | [src/game/render](src/game/render), [src/game/runtime](src/game/runtime), [bridge](src/game/bridge) | [lifecycle](tests/e2e/lifecycle.spec.ts), [rendering](tests/e2e/rendering.spec.ts), [strict mode](tests/e2e/dev/strict-mode.spec.ts)         | [ARCHITECTURE](ARCHITECTURE.md#react--pixijs-integration)                                        |
| 5 Ranking and history          | [src/api](src/api) (Axios, TanStack Query, pending queue), [records UI](src/ui/screens/records)     | [records](tests/e2e/records.spec.ts), [submission](tests/e2e/submission.spec.ts), `src/api/*.test.ts`                                        | [ARCHITECTURE](ARCHITECTURE.md#ranking-and-history-integration-contracts-cache-pending-recovery) |
| 6 MSW                          | [src/mocks](src/mocks), [dev panel](src/ui/network/MockPanel.tsx)                                   | [network-resilience](tests/e2e/network-resilience.spec.ts), `src/mocks/*.test.ts`                                                            | [Network scenarios](#network-scenarios-msw)                                                      |
| 7 UI, assets and accessibility | [src/ui](src/ui), [scripts/build-atlases.mjs](scripts/build-atlases.mjs)                            | [a11y](tests/e2e/a11y.spec.ts), [layout](tests/e2e/layout.spec.ts), [touch](tests/e2e/touch.spec.ts), [keyboard](tests/e2e/keyboard.spec.ts) | [ASSETS](docs/ASSETS.md)                                                                         |
| 8 Playwright                   | [tests/e2e](tests/e2e), [playwright.config.ts](playwright.config.ts)                                | [coverage table](#playwright-coverage-spec-8)                                                                                                | [Testing](#testing)                                                                              |
| 9 Performance                  | [scripts/perf.mjs](scripts/perf.mjs)                                                                | `pnpm perf`                                                                                                                                  | [PERFORMANCE](docs/PERFORMANCE.md)                                                               |
| 11 Delivery                    | [vercel.json](vercel.json), [CI workflow](.github/workflows/ci.yml)                                 | CI on every push                                                                                                                             | this README, [ARCHITECTURE](ARCHITECTURE.md), [STATUS](docs/STATUS.md)                           |

### Reports, decisions and limitations

- **Test reports**: every CI run on
  [GitHub Actions](https://github.com/luctopan/junglegaming-challenge/actions) uploads the
  Playwright HTML report and failure traces (artifact `playwright-report`). Locally:
  `pnpm test:e2e`, then `pnpm exec playwright show-report`. Unit tests and coverage:
  `pnpm test`.
- **Performance**: [docs/PERFORMANCE.md](docs/PERFORMANCE.md) (FPS, p95 frame time and
  entity count over a 3-minute match; memory over 5 cycles; raw JSON).
- **Decisions** (gameplay assumptions, balancing, API and mock design):
  [docs/DECISIONS.md](docs/DECISIONS.md). **Known limitations**:
  [below](#known-limitations) and
  [ARCHITECTURE.md](ARCHITECTURE.md#limitations-and-balancing). Delivery status:
  [docs/STATUS.md](docs/STATUS.md).

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

### Playwright coverage (spec §8)

Every flow runs in `desktop-chromium` (1280×720) and `mobile-chromium` (Pixel 7
landscape, touch); each test starts from a fresh browser context (empty storage, default
scenario). Combat specs press real keys or touch real controls and observe through the
test hook.

| §8 requirement                                               | Specs                                                                                                                                                      |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Options: navigation, validation, persistence                 | [options](tests/e2e/options.spec.ts), [captain](tests/e2e/captain.spec.ts)                                                                                 |
| Asset loading, failure and retry                             | [assets](tests/e2e/assets.spec.ts)                                                                                                                         |
| Match start, movement, rotation, arena bounds, islands       | [movement](tests/e2e/movement.spec.ts)                                                                                                                     |
| Front and broadside fire, damage, cooldown, score once       | [combat](tests/e2e/combat.spec.ts), [gameplay](tests/e2e/gameplay.spec.ts) (front shots damage and sink, score stays put)                                  |
| Chaser and Shooter behaviour, spawn interval                 | [gameplay](tests/e2e/gameplay.spec.ts)                                                                                                                     |
| End by time and by death, simulation stops, clean restart    | [gameplay](tests/e2e/gameplay.spec.ts), [navigation](tests/e2e/navigation.spec.ts) (Play again), [result](tests/e2e/result.spec.ts)                        |
| Pause, focus loss, resume without timer drift                | [pause](tests/e2e/pause.spec.ts), [keyboard](tests/e2e/keyboard.spec.ts), [rendering](tests/e2e/rendering.spec.ts)                                         |
| Result display and persistence after refresh                 | [result](tests/e2e/result.spec.ts)                                                                                                                         |
| Abandon, repeated navigation, touch controls                 | [navigation](tests/e2e/navigation.spec.ts), [lifecycle](tests/e2e/lifecycle.spec.ts), [touch](tests/e2e/touch.spec.ts), [layout](tests/e2e/layout.spec.ts) |
| Ranking and history: pagination, loading, empty, error       | [records](tests/e2e/records.spec.ts)                                                                                                                       |
| Registration, both tabs updated, pending recovered on reload | [submission](tests/e2e/submission.spec.ts)                                                                                                                 |
| Resend after timeout without duplicates, late responses      | [network-resilience](tests/e2e/network-resilience.spec.ts)                                                                                                 |
| Visual regression: menu, stable arena, result                | [visual](tests/e2e/visual.spec.ts) (baselines in `tests/e2e/__screenshots__/`, Linux only: skipped on other host OSes, run `pnpm test:e2e:docker`)         |
| Accessibility, Strict Mode lifecycle                         | [a11y](tests/e2e/a11y.spec.ts), [dev/strict-mode](tests/e2e/dev/strict-mode.spec.ts)                                                                       |

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
`pirate.options.v1`, `pirate.profile.v1`, `pirate.lastResult.v1`, `pirate.pending.v1`, `pirate.audio.v1`
(corrupted values fall back to defaults, with a message on Options).

The Captain's Log reads the API over MSW (see [Network scenarios](#network-scenarios-msw)); a
match that is not saved yet waits in `pirate.pending.v1` and is resent automatically.

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

None are required. Build-time (Vite) variables:

| Variable              | Default | Effect                                                         |
| --------------------- | ------- | -------------------------------------------------------------- |
| `VITE_API_TIMEOUT_MS` | `8000`  | Client timeout of every API call (ms; values below 50 ignored) |

URL switches (read at page load and kept while navigating):

| Switch                | Where           | Effect                                                                          |
| --------------------- | --------------- | ------------------------------------------------------------------------------- |
| `?scenario=<name>`    | every build     | Network scenario of the mock backend (see below)                                |
| `?seed=<n>`           | every build     | Seed of the mock latency (and, with `?test=1`, of the next match)               |
| `?dev=1`              | every build     | Opens the mock backend panel with the main menu                                 |
| `?test=1`             | every build     | Exposes `window.__PIRATE_TEST__` (see [Testing](#testing))                      |
| `?apiTimeout=<ms>`    | with `?test=1`  | Overrides the API timeout (fast timeout scenarios in tests)                     |
| `?clock=manual`       | with `?test=1`  | Simulation time only moves with the test hook's `advance(ms)`                   |
| `?cfg.<path>=<value>` | dev server only | Balance overrides (see [Balance overrides](#balance-overrides-dev-server-only)) |

## Network scenarios (MSW)

The mock backend ([src/mocks](src/mocks)) answers `/api/*` from a Mock Service Worker in
every build. Confirmed matches are stored in `localStorage` (`pirate.mockdb.v1`), so they
survive a refresh and are shared by every tab; fixture captains (fixed dates, ids
`fixture-…`) are added at read time.

**Selecting a scenario**: open the app with `?scenario=<name>` (kept for the tab in
`sessionStorage`), or use the **Mock backend** panel (`?dev=1`, or the link at the bottom
of the main menu). **Reset** in the panel clears the mock database, the pending queue,
the last result, the query cache and the scenario (back to `success`).

| Scenario                     | Behaviour                                                                   |
| ---------------------------- | --------------------------------------------------------------------------- |
| `success` (default)          | 40–120 ms latency (seeded), 23 fixture matches over three configs           |
| `empty`                      | No fixture records                                                          |
| `multi-page`                 | 60 extra fixture matches per config (15 ranking pages for 120 s / 3 s)      |
| `slow`                       | Every request takes 2.5 s                                                   |
| `variable-latency`           | 50 ms – 2 s per request, from the seeded RNG                                |
| `out-of-order`               | Every other read takes 1.5 s, the others 30 ms: answers arrive out of order |
| `timeout`                    | Requests never answer (the client times out)                                |
| `network-error`              | Every request fails at network level                                        |
| `http-400` / `http-500`      | Every request answers 400 / 500                                             |
| `ranking-fail`               | Ranking and config reads answer 500                                         |
| `history-fail`               | History reads answer 500                                                    |
| `write-timeout-after-commit` | The first save of each match is stored, then never answered                 |
| `unavailable-then-recover`   | Saves answer 503 for the first 3 attempts, or until **Recover** is pressed  |

## Reproducing failures

All with the production build (`pnpm build && pnpm preview`, then
<http://localhost:4173>) or the live demo:

- **Lost response after a successful write**: `/?scenario=write-timeout-after-commit&test=1&apiTimeout=500`,
  play a 60 s match: _Saving…_ for about a second, then _Saved_; Match History lists it
  once (`pirate.mockdb.v1` holds one record).
- **Backend down at match end, then back**: `/?scenario=http-500` (or `network-error`),
  finish a match: _Not saved yet_ with Retry, and the match is in `pirate.pending.v1`.
  Start another match (allowed), then reload with `/?scenario=success`: the queue is sent on
  start and both tabs show the match.
- **Recovery by Retry**: `/?scenario=unavailable-then-recover`, finish a match (Pending),
  press Retry (or Recover in the panel).
- **Read failures**: `/records/ranking?scenario=ranking-fail` (error with Retry; the
  history tab still works), `history-fail`, `timeout`.
- **Late responses**: `/records/ranking?scenario=out-of-order`, click Next twice quickly:
  page 3 stays on screen when the late page-2 answer arrives.
- **Asset download failure**: block `/assets/` in DevTools → Network request blocking,
  then Play: the loading screen shows Retry and combat never starts.

Every case is automated in [tests/e2e](tests/e2e) (see the [coverage table](#playwright-coverage-spec-8)).

## Known limitations

- The backend is a mock in the browser: records live in this browser's `localStorage`
  (other players are fixtures); there is no server-side validation beyond the contract.
- Visual baselines are produced only in the pinned Linux Docker image; on Windows/macOS,
  run `pnpm test:e2e:docker` for the visual specs.
- See [ARCHITECTURE.md](ARCHITECTURE.md#limitations-and-balancing) for gameplay and art
  limitations and [docs/STATUS.md](docs/STATUS.md) for anything left unfinished.

## Asset sources and licenses

- **Game art**: Kenney "Pirate Pack" (ships, tiles, cannon balls, effects), **CC0 1.0**
  (public domain) — <https://kenney.nl/assets/pirate-pack>. Atlases are generated from the
  delivered files by `pnpm assets:build`; inventory and mapping in
  [docs/ASSETS.md](docs/ASSETS.md).
- **UI**: the "Pirate Battle UI asset pack" provided with the challenge (panels, buttons,
  icons, title art, mockups), used as delivered for this assessment.
- **Sounds**: part of the provided "Pirate Battle UI asset pack" (`assets/sounds/`, 27 WAV), used as delivered.
- **Font**: **Archivo** (Omnibus-Type), **SIL Open Font License 1.1**, self-hosted through
  `@fontsource-variable/archivo`.
- Icons missing from the atlas (sound, help) are small inline SVGs drawn for this project.
