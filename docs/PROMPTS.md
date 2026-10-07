# Prompts for Claude Code — Pirate Battle

How to use:

1. Already done: spec in `docs/CHALLENGE.md`, asset inventory in `docs/ASSETS.md`,
   `CLAUDE.md` at the root.
2. Run the **Kickoff** prompt in plan mode. Review the plan and the estimate
   (the spec requires sending the estimate before starting).
3. Run one **Phase** prompt per session. Use `/clear` between phases — the plan
   and docs in the repo carry the context.
4. Finish with the **Review** prompt, then do the deploy yourself.

---

## 0. Kickoff (plan only — no code)

```
Read CLAUDE.md, docs/CHALLENGE.md and docs/ASSETS.md in full, and look at the
mockups assets/sample*.png and docs/reference/*.png. Verify the asset
inventory against the files (e.g. enemy health bar metadata in ui_sheet.json)
and note any gaps or corrections.

Do NOT write application code yet. Produce docs/PLAN.md containing:

1. Requirements checklist: every requirement in the spec as a checkbox, grouped
   by spec section, each mapped to the phase that delivers it and to the
   Playwright spec / unit test that proves it.
2. Architecture: folder structure, module responsibilities, dependency rules,
   the simulation loop (fixed timestep), entity/system model, collision approach
   (shapes for ships, islands and projectiles), game→React bridge, asset
   pipeline, lifecycle/teardown strategy, Strict Mode handling.
3. API & mocks design: typed contracts for ranking and match history, query
   keys, idempotent submission (client-generated matchId as idempotency key),
   persisted pending-submission queue, out-of-order response protection,
   ranking grouped by config with deterministic tie-break, MSW scenario model
   and how it is selected/reset (dev panel + query param), production worker.
4. Test strategy: seed + clock control, test hooks, Playwright projects
   (Chromium desktop + mobile), visual regression baselines and how to keep
   them stable across OSes (pin the Playwright Docker image).
5. Decisions to make explicit: supported mobile orientation, keyboard and touch
   mappings, spawn interval limits, session time bounds, default balancing,
   Chaser/Shooter spawn distribution, damage-state thresholds.
6. Phases (0–9 below or your refinement), each with scope, exit criteria and
   an hour estimate; plus a total estimate with risk buffer.
7. Risks and open questions for me.

Phases to refine:
0 Scaffold & tooling · 1 Config + pure simulation core · 2 Assets & PixiJS
rendering · 3 Input, pause & session lifecycle · 4 React screens & a11y ·
5 API layer (Axios + TanStack Query) · 6 MSW scenarios · 7 Playwright suite ·
8 Performance profiling & docs · 9 Deploy preparation (stop before deploying).

Stop after writing docs/PLAN.md and wait for my approval.
```

---

## Phase prompt (reuse for every phase)

```
Read CLAUDE.md, docs/PLAN.md and the "Phase N" section. Implement Phase N only.

- Start in plan mode: list the files you will create/change and why.
- Follow the architecture rules in CLAUDE.md strictly; if you need to deviate,
  explain why and record it in docs/DECISIONS.md.
- Write unit tests for every pure rule you add.
- Before finishing: run typecheck, lint, unit tests and any Playwright specs
  relevant to this phase; fix everything.
- Update ARCHITECTURE.md / README.md sections affected, and tick the
  delivered items in docs/PLAN.md.
- Commit with Conventional Commits.
- End with: what was done, what is pending, any spec requirement at risk.
```

### Extra notes per phase (append to the prompt above)

**Phase 0 – Scaffold**

```
Vite + React + TS strict, ESLint (typescript-eslint strict, import boundaries
between layers), Prettier, Vitest, Playwright (Chromium desktop + mobile
projects, HTML report, trace on failure), MSW initialized with the worker in
public/. Scripts: dev, build, preview, lint, typecheck, test, test:e2e,
test:e2e:update. Use pnpm and commit the lockfile.
```

**Phase 1 – Core simulation**

```
Pure TypeScript, no Pixi/DOM. Typed GameConfig with defaults and validation.
Seeded RNG, injectable clock, fixed-timestep stepper. Player movement/rotation,
arena bounds, island collision for ships and projectiles, front shot (1) and
side shots (3 parallel, left/right), cooldowns, projectile lifetime/range,
damage applied exactly once, Chaser (chase + explode on contact, no score) and
Shooter (approach + fire within range), spawner (interval, distribution, spawn
points clear of obstacles and far from player), match rules (timer, death,
end freezes everything, restart = fresh state). Emit domain events
(shot fired, hit, destroyed, match ended) for render/audio/UI to consume.
```

**Phase 2 – PixiJS rendering**

```
Asset registry with progress, failure handling and retry before combat starts;
textures loaded once and reused. Views for ships (damage states by HP),
projectiles, islands/water tiles, HP bars above every ship, muzzle/explosion/hit
effects (pooled). Resize to container and devicePixelRatio preserving aspect,
input coordinates and arena bounds. Full teardown on exit/restart; safe under
StrictMode. Sounds via the provided WAVs, respecting autoplay rules.
```

**Phase 3 – Input & session**

```
Keyboard + touch (on-screen controls) mapped to abstract commands, simultaneous
move + fire. Keys captured only while gameplay is active. Manual pause and
auto-pause on blur/visibilitychange; resume requires a player action; no time,
cooldown or input accumulation during pause. Leaving the screen or reloading
abandons the match (never recorded).
```

**Phase 4 – React UI**

```
Main menu (Play, Options, controls help, Ranking and Match History tabs),
Options (validated, persisted), Game screen (HUD synced via the bridge,
semantic live region throttled), Result (score, time played, end reason,
submission status, Play Again, Main Menu; last result persisted). Visual
identity built from the UI atlas. Full keyboard navigation, focus management,
dialogs with focus trap, contrast checked.
```

**Phase 5 – API layer**

```
Axios client with timeout; typed contracts; TanStack Query for ranking and
history (pagination with placeholderData, loading/empty/error states,
background refetch, refetch on tab re-show, invalidation after submit,
retries with sensible policy). Submission: idempotent by matchId, persisted
pending queue (localStorage) retried on start and on demand, never blocks
gameplay. Guard against stale/out-of-order responses.
```

**Phase 6 – MSW**

```
Handlers, fixtures and contracts shared by dev, tests and production build.
Scenarios: success, empty, multi-page, slow, variable latency, out-of-order,
timeout, network error, 4xx/5xx, ranking/history read failure, timeout after
a successful write (retry must not duplicate), unavailable at match end then
recovery. Selectable via a dev panel and ?scenario=, with reset. Seeded
latency. Confirmed records persisted locally. Worker must start in production
before rendering.
```

**Phase 7 – Playwright**

```
Cover every item in spec section 8. Isolated state per test (fresh storage,
scenario reset). Combat tests drive real keyboard/touch input and assert via
the test hook snapshot. Desktop and mobile Chromium projects. Visual
regression for menu, a stable arena state (fixed seed, frozen clock) and
result screen, with versioned baselines generated in the pinned Playwright
Docker image. HTML report and traces on failure.
```

**Phase 8 – Performance & docs**

```
Production build profiling: 3-minute match recording FPS, p95 frame time and
entity count (in-game metrics overlay behind a flag + Chrome performance
trace). Memory check after 5 start/play/exit cycles (heap snapshots,
texture/listener counts). Write docs/PERFORMANCE.md with hardware, browser,
resolution, config and limitations. Finalize README.md (setup, env vars,
controls, gameplay config, network scenarios, commands, how to reproduce
failures) and ARCHITECTURE.md (all topics in spec section 11), plus asset
sources/licenses.
```

**Phase 9 – Deploy preparation (no deploy)**

```
Add vercel.json (SPA rewrites, correct headers for mockServiceWorker.js),
verify `pnpm build && pnpm preview` works from a clean clone with MSW active,
reload on deep links works, no console errors. Write docs/DEPLOY.md with a
step-by-step checklist for me to deploy manually and a post-deploy smoke test
list. Do not run any deploy command.
```

---

## Final review

```
Act as the senior engineer evaluating this assessment. Go through
docs/CHALLENGE.md section by section and the scoring table in section 10.
For each requirement: delivered / partial / missing, with file evidence.
Then review code quality: layer violations, magic numbers, dead code, missing
teardown, per-frame React renders, unhandled errors, weak tests. Produce
docs/REVIEW.md with a prioritized fix list, then wait for my go-ahead.
```
