# Pirate Battle — Implementation Plan

Status legend: `[ ]` todo · `[x]` delivered. Phase numbers refer to §6.
Test ids: `e2e:<file>` = `tests/e2e/<file>.spec.ts`; `unit:<file>` = `src/**/<file>.test.ts`.

## 0. Asset inventory verification (corrections to docs/ASSETS.md)

Checked `ui_sheet*.json`, `ships_miscellaneous_sheet*.xml`, `tilesheets.txt`, the
folder tree and the mockups.

| #   | Finding                                                                                                                                                                                                                                       | Impact                                                                                                                                                                                                                                                                                          |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | **Enemy health bar confirmed**: `enemy_health_frame` / `enemy_health_fill_{green,red}` are 160×40, `fill_rect` = (24,12,112,15), `clip_axis: x`, `clip_origin: left`, frame→fill. **No amber fill for enemies** (player has green/amber/red). | Enemy bar uses 2 colour states; bar is wider than a ship (66 px) → render at ~0.45 scale in world.                                                                                                                                                                                              |
| A2  | Individual UI PNGs live in `png/{default,retina}/ui/{menu,controls,hud}/`, not flat in `ui/`. Atlas `ui.image` paths are relative to the JSON and point at those subfolders; retina JSON points at `png/retina/...`.                          | Asset registry paths.                                                                                                                                                                                                                                                                           |
| A3  | All 36 frame names identical in both atlases; retina `meta.scale = "2"`, frames doubled, but **`borders` (32/40/32/40) and all `ui.layout` rects stay in 1× logical units** in the retina JSON.                                               | 9-slice in CSS `border-image` must slice 64/80 px for the retina PNG; in Pixi verify v8 interprets `borders` in texture (logical) units.                                                                                                                                                        |
| A4  | Missing UI states: no `button_secondary_{hover,disabled}`, no `button_round_disabled`, no focus states.                                                                                                                                       | Derive hover/disabled/focus via CSS (filter/outline). Visible focus ring is ours.                                                                                                                                                                                                               |
| A5  | Missing icons: no mute/sound, help/controls, or ranking star other than `icon_score`.                                                                                                                                                         | Mute + help use small inline SVGs styled to match; record in DECISIONS.md.                                                                                                                                                                                                                      |
| A6  | Retina ship XML confirmed byte-identical coordinates to default (e.g. `ship_1` 66×113, `cannon_ball` 10×10, `explosion_1` 74×75).                                                                                                             | No real 2× ships/effects. **Build script rasterizes `assets/vector/ships_miscellaneous_vector.svg` into a 2× ships/effects atlas** (falls back to 1× PNGs if the vector does not match the raster frames; result recorded in DECISIONS.md). Tiles and UI: pick 1× / 2× by effective resolution. |
| A7  | Tile atlas has no JSON (only "64×64, no margin"). Ship atlas is Sparrow XML.                                                                                                                                                                  | Build-time node script generates Pixi JSON for both (spec allows conversion); output committed to `public/assets/`.                                                                                                                                                                             |
| A8  | Mockup scale: arena ≈ 14 tiles across; ships ≈ 1/6 of screen height.                                                                                                                                                                          | World = **1024×576 units (16×9 tiles of 64)**, ships at native size.                                                                                                                                                                                                                            |
| A9  | Sounds: 27 WAV, 5.8 MB; no font; logo is a third-party brand SVG.                                                                                                                                                                             | WAV kept, loaded lazily after first gesture (non-blocking). Self-hosted OFL font. Licenses recorded in README.                                                                                                                                                                                  |

ASSETS.md was patched with A1–A7 in Phase 0. A6: the SVG is rasterized in Phase 2; the
vector uses the preview layout, so frames were located by template matching and a 2× sheet is built (DECISIONS R1). A7: generated JSON is git-ignored and rebuilt by `pnpm assets:build` (DECISIONS T2).

## 1. Requirements checklist

### 1 Stack

- [x] React for menus/forms/panels/dialogs — P4 — e2e:navigation
- [x] TypeScript `strict` — P0 — `pnpm typecheck` in CI
- [x] PixiJS for arena, ships, projectiles, effects, over-ship bars — P2 — e2e:visual (arena)
- [ ] TanStack Query for ranking/history reads + submission — P5 — e2e:records, e2e:submission
- [ ] Axios client — P5 — unit:apiClient
- [ ] MSW mocks (dev, test, prod) — P6 — e2e:network-resilience
- [ ] Playwright E2E + visual regression — P7 — CI report
- [ ] Single-player, fully in-browser; gameplay/config local — P1/P4

### 2 Gameplay — Player

- [x] Forward movement + rotate both ways — P1 — unit:movement, e2e:movement
- [x] Front shot, 1 projectile — P1 — unit:weapons, e2e:combat
- [x] Side shots, 3 parallel projectiles, separate left/right commands — P1 — unit:weapons, e2e:combat
- [x] Limited HP, reduced by enemy projectiles and Chaser impact — P1 — unit:damage, e2e:enemies
- [x] Restricted to visible arena, cannot cross islands — P1 — unit:collision, e2e:movement
- [x] Keyboard + touch controls for move/rotate/attacks — P3 — e2e:touch, e2e:combat
- [x] Move and fire simultaneously — P3 — e2e:combat
- [x] Controls shown in UI (menu help + on-screen) — P4 — e2e:navigation

### 2 Gameplay — Enemies

- [x] Chaser pursues, damages on contact, explodes on impact — P1 — unit:chaser, e2e:enemies
- [x] Shooter approaches, fires when in range — P1 — unit:shooter, e2e:enemies
- [x] Both move, rotate, take damage, respect islands — P1 — unit:collision, unit:steering
- [x] Both types appear in a default match — P1 — unit:spawner (distribution guarantee)
- [x] Spawn every configured interval until match end (no silently skipped intervals) — P1 — unit:spawner, e2e:enemies
- [x] Spawn points obstacle-free and far from player — P1 — unit:spawner

### 2 Arena, collisions, combat

- [x] Water + ≥1 island blocking ships and projectiles — P1/P2 — unit:collision, e2e:movement
- [x] Projectiles: direction, speed, damage, range/lifetime — P1 — unit:projectiles
- [x] Player shots hit enemies; enemy shots hit player (no friendly fire) — P1 — unit:damage
- [x] Damage applied once; removed on hit/obstacle/expire/out-of-arena — P1 — unit:projectiles
- [x] Per-weapon cooldown — P1 — unit:weapons, e2e:combat
- [x] Destroyed enemies stop damaging, firing, colliding — P1 — unit:damage

### 2 Match rules

- [x] Duration configurable 60–180 s of active play — P1/P4 — unit:config, e2e:options
- [x] +1 per enemy destroyed by player; Chaser self-destruct = 0 — P1 — unit:match, e2e:combat
- [x] Ends on time up or HP 0 — P1 — unit:match, e2e:match-end
- [x] End freezes movement, attacks, damage, spawns, scoring — P1 — unit:match, e2e:match-end
- [x] Restart = fresh HP/score/timer/entities — P3 — e2e:match-end
- [x] HP above player and each enemy; HUD score + time remaining — P2/P4 — e2e:visual (P2: HP bars over every ship done; HUD in P4)
- [x] Manual pause + auto-pause on blur/hidden — P3 — e2e:pause
- [x] Pause suspends timer, cooldowns, simulation — P1/P3 — unit:stepper, e2e:pause
- [x] Resume requires player action; no accumulated movement/shots — P3 — unit:inputState, e2e:pause

### 2 Animations & feedback

- [x] Muzzle effects, destruction explosion — P2 — e2e:visual (manual check)
- [x] Ship visual deterioration by HP (4 stages) — P2 — unit:damageStage
- [x] Perceptible feedback for attacks/hits/damage (flash, shake-lite, sound) — P2
- [x] Arena stays readable (effects pooled, short, under HUD) — P2

### 3 Screens & config

- [x] Main menu: Play, Options, control instructions, Ranking + Match History tabs — P4 — e2e:navigation
- [x] Options: session time + spawn interval, validation, save, persist after refresh — P4 — e2e:options
- [x] Game screen: Pixi arena, HUD, controls, pause — P2–P4 — e2e:visual
- [ ] Result: score, time played, end reason, submission status, Play Again, Main Menu — P4/P5 — e2e:result (P4: screen, persistence and the status slot done; online submission states in P5)
- [ ] Ranking: rank, player identity, score, pagination — P4/P5 — e2e:records (P4: UI with pagination/loading/empty/error on the typed contracts, temporary local data; P5 wires the API)
- [ ] Ranking config selector: defaults to current Options config, lists configs that have records; subtitle as in mockup — P4/P5/P6 — e2e:records (P4: selector UI defaulting to Options, configs from the temporary source)
- [ ] Match History: date, score, duration, end reason, pagination — P4/P5 — e2e:records (P4: UI done on the temporary source)
- [x] Typed central gameplay config (all listed params) — P1 — unit:config
- [x] Balancing changes need no system logic changes — P1 — review
- [x] Spawn interval positive with documented limits — P1 — unit:config, README
- [x] Config snapshot frozen at match start — P1 — unit:match
- [x] Changing Options from the pause menu affects only the next match — P4 — e2e:options
- [x] Reload / leaving combat ends match — P3 — e2e:navigation
- [x] Persist options + last completed result — P4 — e2e:options, e2e:result
- [ ] Abandoned match never recorded — P3/P5 — e2e:navigation (P3: abandon = destroy before `matchEnded`, e2e:navigation asserts no write; P5 records only on `matchEnded`)
- [ ] English UI/identifiers/docs; menu identity coherent with assets — all

### 4 PixiJS & architecture

- [ ] Separation: rules / render / input / UI state (lint-enforced) — P0/P1 — `pnpm lint` (P0: enforcement in place + tested)
- [x] Time-based simulation, frame-rate independent — P1 — unit:stepper (30/60/144 Hz parity)
- [x] UI sync without per-frame React renders — P3 — unit:bridge, e2e (render counter in test mode)
- [x] Texture load once + reuse; failure handling before combat — P2 — e2e:assets
- [x] Canvas fits screen + DPR, preserves aspect, input coords, arena bounds — P2 — e2e:touch (resize)
- [x] Release listeners, ticker, timers, entities, GPU resources — P2/P3 — e2e:lifecycle, PERFORMANCE.md (P2: session resources released + counted, e2e:lifecycle green; input listeners in P3) (P3: input/pause listeners counted; play/exit cycles back to baseline)
- [x] Correct init/teardown under Strict Mode — P2 — dev runs in StrictMode + e2e:lifecycle
- [x] Continuous combat state lives in simulation — P1
- [ ] ARCHITECTURE.md — P8

### 5 Ranking & history

- [ ] Typed contracts; ranking paginated by score — P5 — unit:contracts, e2e:records
- [ ] Register completed match; paginated player history — P5 — e2e:submission
- [ ] Record fields: matchId, playerId, date, score, effective duration, end reason, config — P5 — unit:contracts
- [ ] Ranking compares same-config matches; deterministic tie-break — P6 — unit:ranking
- [ ] Other players = fixtures — P6
- [ ] Loading / empty / error / background refresh / cache / invalidation / retries — P5 — e2e:records
- [ ] Both tabs refresh after submit and on re-show — P5 — e2e:submission
- [ ] Stale responses don't overwrite newer data — P5/P6 — e2e:network-resilience
- [ ] One record + one ranking entry per match; resends recover existing — P5/P6 — e2e:network-resilience
- [ ] Pending records survive failure/refresh; manual retry — P5 — e2e:submission
- [ ] `playedAt` fixed at match end → resubmissions byte-identical (no 409 on retry) — P5 — unit:pendingQueue
- [ ] Last result and pending queue in separate storage keys — P4/P5 — unit:storage
- [ ] One ranking entry per match (a captain may appear several times; documented) — P6 — unit:ranking
- [ ] Can start a new match while a record is pending — P5 — e2e:submission
- [ ] API failures never block game/options/combat — P5 — e2e:network-resilience

### 6 MSW

- [ ] Network-level mocks; contracts/fixtures/handlers shared dev/test/demo — P6
- [ ] Confirmed records appear in later queries, consistent across tabs — P6 — e2e:submission
- [ ] Scenarios: success, empty, multi-page — P6 — e2e:records
- [ ] Slow, variable latency, out-of-order — P6 — e2e:network-resilience
- [ ] Timeout, connection failure, 4xx/5xx — P6 — e2e:network-resilience
- [ ] Ranking/history read failure — P6 — e2e:records
- [ ] Timeout after successful write → recovery w/o duplication — P6 — e2e:network-resilience
- [ ] Unavailable at match end → register after recovery — P6 — e2e:submission
- [ ] Scenario selection + reset (dev panel via `?dev=1` + discreet footer link on main menu; documented in README) — P6 — e2e:network-resilience
- [ ] Seeded randomness/latency in tests — P6
- [ ] Works in published build — P6/P9 — `pnpm build && pnpm preview` smoke
- [ ] Local persistence of confirmed + pending — P5/P6

### 7 UI, assets, a11y

- [ ] Provided assets as visual base; conversions + licenses documented — P2/P8
- [x] Desktop + mobile, usable touch, no clipped arena/HUD — P2/P4 — e2e mobile project
- [ ] Supported mobile orientation defined; layout adapts on resize, rules unchanged — P2 — e2e:touch (P4: portrait overlay + auto-pause, e2e:layout)
- [x] Portrait shows rotate overlay + auto-pause during gameplay; menus usable in portrait — P4 — e2e:touch
- [x] Visible asset loading progress — P2 — e2e:assets
- [x] Keyboard nav, visible focus, dialog focus control, labels, contrast, accessible errors — P4 — e2e:a11y
- [x] Semantic score/time/state, no per-frame announcements — P4 — e2e:a11y
- [x] Game keys captured only during active gameplay — P3 — e2e:a11y (e2e:keyboard)

### 8 Playwright (each bullet = spec item)

- [x] Options navigation/validation/persistence — e2e:options
- [x] Asset loading, failure, retry — e2e:assets
- [x] Start, movement, rotation, arena bounds, island collision — e2e:movement
- [ ] Front/side fire, damage, cooldown, score without duplication — e2e:combat (P3: fire + cooldown in e2e:combat; damage/score in P7)
- [ ] Chaser/Shooter behaviour + spawn interval — e2e:enemies
- [ ] End by time/death, simulation stop, clean restart — e2e:match-end
- [x] Pause, blur, resume without timer drift — e2e:pause
- [x] Result display + persistence after refresh — e2e:result
- [x] Abandon, repeated navigation, touch controls — e2e:navigation, e2e:touch, e2e:lifecycle
- [ ] Ranking/History query + pagination incl. loading/empty/error — e2e:records
- [ ] Submit, both tabs updated, pending recovery after refresh — e2e:submission
- [ ] Resend after timeout w/o duplication; late responses don't overwrite — e2e:network-resilience
- [x] Chromium desktop + mobile — playwright.config
- [ ] Visual regression: menu, stable arena, result; versioned baselines — e2e:visual
- [ ] Seed + simulation time control; real inputs in combat tests — test hook (P3: test hook done)
- [ ] Isolated state per test; HTML report + traces on failure — playwright.config (P0: report + traces done; isolation fixture completed in P7)

### 9 Performance

- [ ] Optimized build, 60 FPS target on documented reference machine — P8
- [ ] FPS, p95 frame time, entity count over a 3-min match — P8 — PERFORMANCE.md
- [ ] Memory after 5 start/play/exit cycles; no continuous growth — P8
- [ ] Evidence: hardware, browser, resolution, config, limitations — P8

### 11 Delivery

- [ ] Repo with source, lockfile, assets, mocks, fixtures, tests — P0..P9
- [ ] Public deploy running mocks, works on open + reload — P9 (human deploys)
- [ ] README: setup, env vars, controls, gameplay config, scenarios, commands, reproduce failures — P8
- [x] Scripts: dev, build, preview, lint, typecheck, Playwright — P0
- [ ] ARCHITECTURE.md: React/Pixi, sim loop, collisions, resources, persistence, API/cache/pending recovery, limitations, balancing — P8
- [ ] Test + profiling reports included — P7/P8
- [ ] Runs from clean checkout, no private services — P9

### Product decisions from CLAUDE.md

- [x] Captain name dialog on first Play; UUID `playerId`; validation 2–20, `[A-Za-z0-9 '-]`, trimmed — P4 — unit:captainName, e2e:navigation
- [x] Rename from Options without breaking ownership — P4 — e2e:options
- [ ] Records store `playerId` + name-at-match-time — P5
- [ ] `YOU` badge by `playerId`; History subtitle `<NAME> · YOUR RECENT BATTLES` — P4/P5 — e2e:records (P4: badge and History subtitle done; P5 for real records)
- [ ] Fixture captains never collide with player identity — P6 — unit:fixtures
- [x] `window.__PIRATE_TEST__` only in test mode — P3 — e2e:lifecycle (absent without `?test=1`)

## 2. Architecture

### 2.1 Folders and dependency rules

```
src/
  config/      gameConfig.ts (types), defaults.ts, validate.ts, options.ts (user-facing subset + bounds)
  shared/      PURE only: rng.ts (mulberry32), math/vec2.ts, angle.ts, emitter.ts, assertNever.ts
  platform/    browser adapters: storage.ts (typed, versioned, try/catch), uuid.ts, visibility.ts
  game/core/   world.ts (state), entities.ts, systems/{movement,steering,weapons,projectiles,
               collision,damage,spawner,match}.ts, map/{arenaMap.ts,islands.ts}, geometry.ts,
               events.ts, step.ts, createMatch.ts
  game/input/  inputState.ts (pure), keyboardSource.ts, touchSource.ts, keymap.ts
  game/render/ assetRegistry.ts, stage/{arenaView,shipView,projectileView,hpBarView}.ts,
               effects/{pool.ts,explosion.ts,muzzle.ts,hitFlash.ts}, viewport.ts, audio.ts
  game/runtime/ gameSession.ts, clock.ts (real + manual), loop.ts (accumulator), testHook.ts
  game/bridge/ gameStore.ts (external store), selectors.ts
  api/         contracts.ts, client.ts (axios), errors.ts, queryKeys.ts, queries.ts,
               submission/{pendingQueue.ts,useSubmitMatch.ts,flush.ts}
  mocks/       browser.ts, handlers/{ranking,matches}.ts, db.ts (persisted), fixtures.ts,
               scenarios.ts, latency.ts, ranking.ts (sort/tie-break, pure)
  ui/          app/{App,Router,providers}.tsx, screens/{Menu,Options,Game,Result,Records}/,
               components/{Button,RoundButton,Panel,Dialog,Stepper,Table,Pagination,Hud,
               TouchControls,LiveRegion,LoadingBar,DevPanel}/, a11y/{focusTrap,useLiveAnnouncer}.ts,
               profile/{captainProfile.ts,CaptainNameDialog.tsx}
tests/e2e/     *.spec.ts, fixtures/test.ts (extended fixture: fresh storage, scenario, hook), helpers/
scripts/       build-atlases.mjs, e2e-docker.mjs, lib/{atlas,playwright-image}.mjs
eslint/        boundaries.js (layer table), rules/layer-boundaries.js
```

Allowed imports, enforced by the local ESLint rule `local/layer-boundaries` (single table in
`eslint/boundaries.js`, unit-tested in `tests/tooling/boundaries.test.ts`) plus
`tsconfig.core.json` (no DOM lib). See ARCHITECTURE.md for the package allow-list per layer.

| Layer        | May import                                                                               |
| ------------ | ---------------------------------------------------------------------------------------- |
| shared       | — (pure: no browser APIs)                                                                |
| platform     | shared (browser adapters; forbidden for game/core and config)                            |
| config       | shared                                                                                   |
| game/core    | config, shared (no pixi, react, DOM types: separate tsconfig `lib: ["ES2022"]` for core) |
| game/input   | core (types only), config, shared, platform                                              |
| game/render  | core (read-only types), config, shared, platform, pixi.js                                |
| game/runtime | core, input, render, bridge, config, shared, platform                                    |
| game/bridge  | core (types), shared                                                                     |
| api          | config (types), shared, platform                                                         |
| mocks        | api (contracts), shared, platform                                                        |
| ui           | runtime, bridge, api, config, shared, platform (never core/render directly)              |

### 2.2 Simulation loop

- Phase 1: the accumulator lives in `game/core/stepper.ts` (pure, injected clock; DECISIONS S3);
  runtime wires it to the Pixi ticker.
- `loop.ts`: `frame(nowMs)` → `dt = min(now - last, MAX_FRAME = 0.25 s)`; `acc += dt`;
  `while (acc >= STEP && steps < MAX_STEPS=8) { step(world, input.sample(), STEP); acc -= STEP }`;
  render with `alpha = acc / STEP` (position interpolation for smoothness at 120/144 Hz).
- `STEP = 1/60 s`, all rates in units/s, rad/s, seconds. Driven by Pixi `Ticker` in production;
  the clock is injected (`RealClock` = `performance.now`, `ManualClock` in test mode where the
  ticker step is a no-op and `advance(ms)` runs the same loop).
- Pause = loop stops consuming time; on resume `last` is reset so the gap never enters `acc`.
- `step()` is pure in effect: mutates only the `World` passed in, uses `world.rng`, returns
  `DomainEvent[]` (discriminated union: `shotFired`, `projectileHit`, `projectileBlocked`,
  `shipDamaged`, `shipDestroyed`, `chaserRammed`, `enemySpawned`, `scoreChanged`, `matchEnded`).
- System order per step: input→player intent · AI steering · movement+island/bounds resolution ·
  weapons (cooldowns, spawn projectiles) · projectile integration + collisions · ship contacts
  (Chaser ram) · damage resolution · cleanup (dead, expired) · spawner · match clock/end check.
  Once `phase === 'ended'` the step returns immediately (freezes everything).

### 2.3 Entity / system model

Plain data in typed arrays-of-structs with numeric ids (no ECS lib):
`Ship { id, kind: 'player'|'chaser'|'shooter', pos, heading, speed, hp, maxHp, radius,
weapons: Record<WeaponId, {cooldownLeft}>, alive, state }`; `Projectile { id, ownerId, team,
pos, vel, damage, distanceLeft, alive }`. Systems are functions `(world, cfg, dt, events)`.
Config is a frozen deep snapshot inside `world.cfg`.

### 2.4 Collision approach

- **Islands**: authored tile map (16×9 grid, data in `arenaMap.ts`); blocking cells merged into
  axis-aligned rectangles at match creation (greedy row merge). Visual tiles come from the same grid,
  so art and collision match.
- **Ships**: two circles along the hull axis (bow/stern, r≈24) — fits the 66×113 sprite better
  than one circle and handles rotation cheaply. Ship vs rect: closest-point push-out (slides along
  walls); ship vs arena bounds: clamp circles inside. Ship vs ship: circle pairs; Chaser contact
  triggers ram; enemies softly separate from each other.
- **Projectiles**: point (r=5) with swept segment test per step (segment vs rect slab test,
  segment vs ship circles) → no tunnelling at high speed. First hit wins; projectile is marked
  dead in the same step → damage exactly once.
- Broadphase: entity counts are small (<~20 ships, <~80 projectiles) → brute force, documented;
  uniform grid is a P8 fallback if profiling demands it.

### 2.5 AI

- Steering: seek target heading, rotate at max turn rate, forward thrust scaled by alignment;
  obstacle avoidance via 3 feeler rays against island rects.
- Chaser: seek player; on contact → deal `ramDamage`, die (`chaserRammed`, no score).
- Shooter: seek until `distance ≤ attackRange`; then keep standoff (slow/strafe) facing the
  player; fire front cannon when within range, within `aimTolerance`, and cooldown ready.

### 2.6 Game → React bridge

`GameStore` (external store) holds `HudSnapshot { phase, pauseReason, score, secondsLeft (int),
hp, maxHp, hpBucket, endReason, loading: {progress, error} }`. Runtime calls
`store.update(partial)` every step but `emit()` only if a field changed (ints/buckets ⇒ ~1 Hz).
React uses `useSyncExternalStore(store.subscribe, store.getSnapshot)` with selector hooks.
Live region announcer throttles: score/state immediately (debounced 1 s), time every 30 s and
last 10 s.

### 2.7 Asset pipeline

- `scripts/build-atlases.mjs` (`pnpm assets:build`, invoked explicitly by `dev`, `build` and
  `e2e:serve`; no pre/post hooks): tiles grid → Pixi JSON; ships Sparrow XML → Pixi JSON; copies
  used assets to `public/assets/` (git-ignored; deterministic and idempotent).
- `assetRegistry.ts`: one Pixi `Assets` bundle `combat` (ui atlas, tiles atlas, ships atlas);
  resolution chosen by `devicePixelRatio × viewport scale` (1× vs 2× for tiles/UI). Exposes
  progress → bridge; on failure → `loading.error`, Retry button calls `Assets.unload` of the failed
  bundle and loads again. Combat never starts until loaded. Textures are global singletons, never
  destroyed between matches (they are cached), only on app teardown.
- Audio: `HTMLAudio`/WebAudio wrapper, unlocked on first gesture, lazy WAV loading, mute persisted.

### 2.8 Lifecycle & Strict Mode

- `GameSession.create(container, opts, signal)` is async and abort-aware: every await checks
  `signal.aborted` and cleans up what it created. React `useEffect` creates an `AbortController`;
  cleanup aborts + `session.destroy()`. Double mount ⇒ first session is aborted/destroyed before
  the second attaches (idempotent `destroy`).
- `destroy()`: remove ticker callback, keyboard/touch/visibility/blur/resize listeners
  (all registered through one `DisposableStack`-like helper), clear timers, release pooled
  views, `app.destroy({ removeView: true }, { children: true, texture: false })`, stop audio,
  unregister test hook.
- Restart = destroy world + views, create a fresh world from a new config snapshot; Pixi app reused.

### 2.9 Viewport, input coordinates, orientation

World is fixed 1024×576; the stage is letterboxed (contain) into the container with
`resolution = min(devicePixelRatio, 2)`, `autoDensity`. Water fills the letterbox. ResizeObserver
recomputes scale only (rules untouched). Touch controls are DOM buttons (no coordinate mapping
needed); any pointer→world mapping uses the inverse stage transform. Mobile: **landscape**
supported; portrait shows "Rotate your device" overlay and auto-pauses the match.

## 3. API & mocks design

### 3.1 Contracts (`api/contracts.ts`)

```ts
type EndReason = 'time_up' | 'defeated';
interface MatchConfigRef {
  sessionSeconds: number;
  spawnIntervalSeconds: number;
}
type ConfigKey = `${number}s-${number}s`; // e.g. "120s-3s"
interface MatchSubmission {
  matchId: string;
  playerId: string;
  playerName: string;
  playedAt: string /*ISO*/;
  score: number;
  durationMs: number;
  endReason: EndReason;
  config: MatchConfigRef;
}
interface MatchRecord extends MatchSubmission {
  configKey: ConfigKey;
  recordedAt: string;
}
interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  revision: number;
}
interface RankingEntry {
  rank: number;
  matchId: string;
  playerId: string;
  playerName: string;
  score: number;
  durationMs: number;
  playedAt: string;
}
```

Endpoints:

- `GET /api/ranking?configKey&page&pageSize` → `Page<RankingEntry>`
- `GET /api/ranking/configs` → `MatchConfigRef[]` with record counts (feeds the Ranking config selector)
- `GET /api/players/:playerId/matches?page&pageSize` → `Page<MatchRecord>` (newest first)
- `PUT /api/matches/:matchId` → `201` created / `200` existing identical / `409` same id, different
  payload / `422` validation. PUT on a client UUID is naturally idempotent.

### 3.2 Client & queries

- Axios instance: `baseURL: '/api'`, `timeout: 8000` (env `VITE_API_TIMEOUT_MS`; overridable in test mode via `?apiTimeout=<ms>` / test hook so timeout scenarios run fast — scenario latencies scale with it), error
  normaliser → `ApiError { kind: 'timeout'|'network'|'http'|'invalid'; status? }`; response
  validation with small hand-written type guards (no zod; avoids a dep).
- Query keys: `ranking.page(configKey, page)`, `history.page(playerId, page)`, roots for
  invalidation.
- Policy: `staleTime 15 s`, `gcTime 5 min`, `placeholderData: keepPreviousData`,
  `refetchOnWindowFocus`, `refetchOnMount: 'always'` for tab panels (re-show refresh),
  retry ≤2 with exponential backoff only for `timeout|network|5xx|429`. AbortSignal forwarded to Axios.
- **Out-of-order protection**: primary mechanism is TanStack cancellation (`cancelRefetch` on
  invalidate) with the AbortSignal forwarded to Axios, so superseded requests never write to the
  cache. Secondary guard: server `revision` in every page; the queryFn keeps the cached page if
  the response revision is older. The revision is **monotonic across mock resets** (persisted
  separately, or `epoch:counter`), and Reset also clears the TanStack Query cache, so the guard
  can never lock out fresh data. Covered by the `out-of-order` scenario.

### 3.3 Submission & pending queue

- On `matchEnded` the runtime builds a `MatchSubmission` (matchId = UUID generated at match
  start; `playedAt` fixed at match end, so every resubmission is byte-identical) and **persists it
  to `pirate.pending.v1` before any request**. The last result is stored separately in
  `pirate.lastResult.v1` and survives confirmation.
- `useSubmitMatch` (`useMutation`, `mutationKey: ['submitMatch', matchId]`, retry 2 for retryable
  errors). Success → remove from queue, mark confirmed, invalidate `ranking` + `history` roots.
- Flush triggers: app start, Result "Retry" button, `online` event, after any successful submit.
  Single-flight per matchId (in-memory set) prevents parallel duplicates; server idempotency
  covers cross-tab/refresh races.
- Status shown on Result: `Saving… / Saved / Pending — will retry / Failed — Retry`. Never blocks
  Play Again.

### 3.4 MSW

- `mocks/db.ts`: records in `localStorage` `pirate.mockdb.v1` (+ `revision`); fixtures seeded on
  first load/reset: ~40 fixture captains across 3 config keys (incl. 120s-3s with 3 pages),
  playerIds prefixed `fixture-` (never a UUID v4 → no collision with real player). Fixture dates
  are **fixed constants** (never `Date.now()`), so ranking/history snapshots are stable.
- `mocks/ranking.ts` (pure): filter by `configKey`, sort `score desc → durationMs asc →
playedAt asc → matchId asc`; deterministic. History: `playedAt desc → matchId`.
- Scenarios (`ScenarioName` union): `success, empty, multi-page, slow, variable-latency,
out-of-order, timeout, network-error, http-400, http-500, ranking-fail, history-fail,
write-timeout-after-commit, unavailable-then-recover`. Latency from seeded RNG
  (`?seed=`). `unavailable-then-recover`: writes return 503 until the dev panel "Recover" toggle
  or N attempts.
- Selection: `?scenario=<name>` (stored in sessionStorage) and a **Dev panel** (toggle with
  `?dev=1` or Shift+D on the menu; also available in production for the demo). "Reset" clears
  mock db, pending queue, scenario, last result.
- Worker: `public/mockServiceWorker.js` (MSW CLI); `main.tsx` awaits
  `worker.start({ onUnhandledRequest: 'bypass', quiet: prod })` before `createRoot().render`
  in **all** builds.

## 4. Test strategy

- **Unit (Vitest, node env)**: all core systems via `createMatch(cfg, seed)` + `step` with
  scripted inputs; stepper parity at different frame rates; config validation; ranking sort;
  pending queue; bridge emit-on-change; captain name validation.
- **Test hook** (`?test=1` only): `__PIRATE_TEST__ = { setSeed, useManualClock, advance(ms),
snapshot(): SerializableState, setScenario, reset }`. `advance` runs the real loop; inputs
  still come from real keyboard/touch events dispatched by Playwright. No setters for HP,
  positions, score.
- **Playwright**: projects `desktop-chromium` (1280×720) and `mobile-chromium` (Pixel 7
  landscape, `hasTouch`). Shared fixture: new context per test (fresh storage), `goto('/?test=1&
seed=42&scenario=success')`, waits for MSW ready flag. `trace: 'retain-on-failure'`,
  `reporter: [['html'], ['list']]`, webServer = `pnpm build && pnpm preview` (tests the prod
  bundle). Optional `@axe-core/playwright` for a11y smoke (justified: automated contrast/label
  checks).
- **Visual regression**: menu, arena at seed 42 after `advance(2000)` with manual clock,
  result screen. Fonts self-hosted, animations disabled via CSS in test mode, fixed viewport,
  Playwright `timezoneId: 'UTC'` and `locale: 'en-US'`, arena snapshot with an explicit small
  `maxDiffPixelRatio` (WebGL rasterization tolerance).
  Baselines generated only in pinned `mcr.microsoft.com/playwright:v<same as @playwright/test>-noble`
  via `pnpm test:e2e:update` (node script runs docker); `snapshotPathTemplate` without platform
  suffix; on Windows visual tests are run via the same docker script, CI runs on Linux.

## 5. Decisions (to be recorded in docs/DECISIONS.md)

| Topic              | Decision                                                                                                                                                                                                                                                                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile orientation | Landscape only for gameplay; portrait = rotate overlay + auto-pause. Menus usable in both.                                                                                                                                                                                                                        |
| Keyboard           | Forward `W`/`↑` · turn `A`/`←`, `D`/`→` · front fire `Space` (also `K`) · broadside left `Q` (`J`) · right `E` (`L`) · pause `P`/`Esc`. Captured only while phase = running.                                                                                                                                      |
| Touch              | Bottom-left: turn left / forward / turn right; bottom-right: fire left / front / right (mockup); pause top-right. Multi-touch via pointer events, hold-to-act.                                                                                                                                                    |
| Movement           | Forward only (no reverse, per spec); acceleration/deceleration; rotation allowed at any speed.                                                                                                                                                                                                                    |
| Session time       | 60–180 s, step 10 s, default 120 s.                                                                                                                                                                                                                                                                               |
| Spawn interval     | 1.0–10.0 s, step 0.5 s, default 3 s. Safety cap of 25 alive enemies (never reached with defaults; documented as a performance guard). A due spawn is never dropped: if blocked by the cap or by no valid point, it stays pending and is retried on following steps; the cadence stays anchored to `n × interval`. |
| Spawn distribution | 50 % Chaser / 50 % Shooter (seeded); first two spawns forced one of each ⇒ both appear in every default match. Initial spawn at t = interval.                                                                                                                                                                     |
| Spawn points       | Random arena-edge water points; must be ≥ 320 u from player, circle r=70 clear of islands/ships; up to 12 attempts per step, otherwise retry on the next step (see Spawn interval).                                                                                                                               |
| Player             | HP 200 (rebalanced, DECISIONS S17), speed 140 u/s, accel 160 u/s², turn 150°/s.                                                                                                                                                                                                                                   |
| Weapons            | Front: dmg 20, cd 0.5 s. Broadside (each side independent): 3 balls, spacing 28 u, dmg 15 each, cd 1.5 s. Projectile speed 420 u/s, range 380 u.                                                                                                                                                                  |
| Chaser             | HP 30, speed 105 u/s, turn 120°/s, ram damage 20 (rebalanced, DECISIONS S17).                                                                                                                                                                                                                                     |
| Shooter            | HP 50, speed 90 u/s, turn 90°/s, range 300 u, standoff 220 u, dmg 7, cd 2.5 s (rebalanced, DECISIONS S17), aim tolerance 12°.                                                                                                                                                                                     |
| Damage stages      | HP ratio > 2/3 → stage 0; > 1/3 → 1; > 0 → 2; dead → 3 (wreck, 0.8 s sink fade, non-colliding). Fire effect at stage ≥ 1.                                                                                                                                                                                         |
| HP bar colours     | Player: green > 50 %, amber > 25 %, red. Enemy: green > 40 %, red.                                                                                                                                                                                                                                                |
| Ship colours       | Player blue (`ship_5`), Chaser black skull (`ship_2`), Shooter red (`ship_3`).                                                                                                                                                                                                                                    |
| Scoring            | +1 only on `shipDestroyed` with `killer === player`; ram death = 0.                                                                                                                                                                                                                                               |
| Effective duration | Active (unpaused) simulated seconds until end.                                                                                                                                                                                                                                                                    |
| Ranking scope      | One entry per match (not best-per-player); a captain may appear several times. Tab defaults to the current Options config with a selector of configs that have records.                                                                                                                                           |
| Pause → Options    | Allowed (mockup). Changes are saved but only apply to the next match (frozen snapshot).                                                                                                                                                                                                                           |
| Dev panel          | Available in production via `?dev=1` and a discreet footer link on the main menu; documented in README.                                                                                                                                                                                                           |
| Routing            | React Router (library mode): `/`, `/options`, `/play`, `/records/:tab`, `/result`. Reload on `/play` → menu (match abandoned). Justified: deep links + reload behaviour in deploy.                                                                                                                                |
| Styling            | CSS Modules + CSS variables; atlas images via `border-image`/background; self-hosted OFL font (e.g. "Lilita One" display + "Nunito Sans" body).                                                                                                                                                                   |

## 6. Phases

| #    | Scope                                                                                                                                                                                                                                                                                                                                                                               | Exit criteria                                                                                                                                                                                                                                  | Est. (h) |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 0 ✅ | Scaffold: Vite+React+TS strict, pnpm, ESLint (ts-eslint strict-type-checked, layer zones), Prettier, Vitest, Playwright (2 projects, report, trace), MSW worker in `public/`, scripts (dev/build/preview/lint/typecheck/test/test:e2e/test:e2e:update), atlas script, `.gitattributes`, CI workflow (GH Actions), docs skeletons (README, ARCHITECTURE, DECISIONS), ASSETS.md fixes | all scripts green on empty app; a smoke e2e passes desktop+mobile; lint fails on a deliberate core→pixi import                                                                                                                                 | 5        |
| 1 ✅ | Config + core: types/defaults/validation, rng, clock, stepper, map + islands, movement, steering, weapons, projectiles, collisions, damage, Chaser, Shooter, spawner, match rules, events                                                                                                                                                                                           | ≥ 90 % line coverage on `game/core`; all unit tests in §1 green; headless 180 s simulated match deterministic per seed                                                                                                                         | 16       |
| 2 ✅ | Assets & Pixi: registry (progress/fail/retry, 1×/2×), arena tile view, ship views + damage stages, projectile pool, HP bars, muzzle/hit/explosion/fire effects (pooled), viewport/DPR/letterbox, audio                                                                                                                                                                              | match renders at 60 FPS on desktop; asset-failure e2e passes; StrictMode no double canvas                                                                                                                                                      | 13       |
| 3 ✅ | Input & session: keyboard/touch → InputState, GameSession lifecycle, pause manual/auto, resume gesture, held-key reset, abandon on leave/reload, bridge store, test hook                                                                                                                                                                                                            | e2e movement/combat/pause/lifecycle green; no listeners left after destroy (test-mode counter)                                                                                                                                                 | 9        |
| 4 ✅ | React UI: menu, options (stepper + validation + persistence), captain dialog, game screen HUD + touch controls + pause dialog + rotate overlay, result (+ persisted last result), records panel (tables, pagination, states), live region, focus management                                                                                                                         | e2e options/navigation/result/a11y green; contrast ≥ 4.5:1 for text                                                                                                                                                                            | 15       |
| 5    | API layer: axios client, contracts, guards, query keys, hooks, submission mutation + pending queue + flush, revision guard                                                                                                                                                                                                                                                          | e2e records/submission green on `success`; unit queue tests; `src/ui/records/temporaryRecords.ts` and the `?records=` override removed, `TEMPORARY_RECORDS_REMOVED = true` in `scripts/lib/devOnly.mjs` (the build then fails on any leftover) | 8        |
| 6    | MSW: db persistence, fixtures, ranking sort, all scenarios, dev panel, reset, prod worker                                                                                                                                                                                                                                                                                           | every scenario reachable via `?scenario=`; e2e network-resilience green                                                                                                                                                                        | 8        |
| 7    | Playwright suite completion + visual baselines in Docker                                                                                                                                                                                                                                                                                                                            | every §8 item has a spec; full suite green on both projects twice in a row (flake check)                                                                                                                                                       | 14       |
| 8    | Performance & docs: metrics overlay (`?metrics=1`), 3-min profile, 5-cycle memory check, PERFORMANCE.md, README, ARCHITECTURE.md, licenses                                                                                                                                                                                                                                          | docs cover every §11 topic; evidence files committed                                                                                                                                                                                           | 7        |
| 9    | Deploy prep: `vercel.json` (SPA rewrite, `Service-Worker-Allowed`/no-cache for worker), clean-clone verification, DEPLOY.md checklist + smoke list. **No deploy.**                                                                                                                                                                                                                  | clean clone `pnpm i && pnpm build && pnpm preview` works with MSW, deep-link reload OK, console clean                                                                                                                                          | 3        |
|      | **Subtotal**                                                                                                                                                                                                                                                                                                                                                                        |                                                                                                                                                                                                                                                | **98**   |
|      | Risk buffer (~20 %): Pixi v8 API surprises, visual-baseline flakiness, mobile touch/orientation, MSW in prod                                                                                                                                                                                                                                                                        |                                                                                                                                                                                                                                                | **20**   |
|      | **Total estimate**                                                                                                                                                                                                                                                                                                                                                                  | ≈ 15 working days at 8 h/day                                                                                                                                                                                                                   | **118**  |

## 7. Risks and open questions

Risks

- R1 Pixi v8 `NineSliceSprite`/atlas `borders` units at resolution 2 (A3) — verify early in P2;
  fallback: HUD/menus in React only (already the plan), Pixi only uses plain sprites.
- R2 Visual baselines across Windows/Linux — mitigated by Docker-only generation.
- R3 MSW service worker on Vercel (scope/caching headers) and first-load race — awaited start + P9 check.
- R4 Autoplay audio policies / iOS Safari — audio is optional, never blocks; mute default persisted.
- R5 Determinism of e2e combat with real input timing — manual clock: input events are applied
  before `advance()`, so timing is step-exact.
- R6 Asset weight (5.8 MB WAV) on mobile — lazy, non-blocking; optional OGG conversion if P8 shows issue.

Resolved questions (developer answers)

1. Arena: fixed hand-authored island map.
2. Mobile: landscape-only gameplay; menus work in portrait; e2e covers the rotate overlay.
3. Routing: React Router approved.
4. Dev/scenario panel in the deployed build behind `?dev=1` + footer link: approved.
5. Audio: keep WAV, lazy-loaded after first gesture; convert only if P8 shows an issue.
6. CI: GitHub Actions workflow approved (typecheck, lint, unit, e2e in the Playwright container).
7. Estimate: kept as in §6; the developer communicates the calendar deadline to the evaluator.
8. Docker Desktop is available on the developer's Windows machine: visual baselines are
   generated/updated locally with `pnpm test:e2e:update` inside the pinned Playwright image;
   CI uses the same image.
