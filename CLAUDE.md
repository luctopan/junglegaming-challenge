# CLAUDE.md — Pirate Battle

Persistent instructions for Claude Code in this repository. Read this file and
`docs/CHALLENGE.md` before any task.

## Context

This is a technical assessment for a game developer position. The evaluator
will judge gameplay, PixiJS mastery, architecture, data integration, UX,
tests and delivery quality. Code quality and maintainability are first-class
requirements, not polish.

- **Source of truth:** `docs/CHALLENGE.md` (the official spec, in Portuguese).
  When in doubt, the spec wins over this file. Never drop a requirement silently;
  if something is ambiguous, record the assumption in `docs/DECISIONS.md`.
- **Assets:** `assets/` — full inventory, ship/damage mapping, atlas metadata
  and sound mapping in **`docs/ASSETS.md`** (read it before touching rendering
  or UI). Do not invent placeholder art when a provided asset exists.
- **Visual target:** `assets/sample*.png` are the official mockups (game HUD,
  menu, options, pause, result, ranking, history). Match their layout and
  look. Menus are React overlays on top of a dimmed arena/background.
- **Environment:** the developer works on **Windows**. Keep scripts
  cross-platform (no bash-only npm scripts; use node scripts or cross-env),
  enforce LF line endings via `.gitattributes`, and generate Playwright visual
  baselines inside the pinned Playwright Docker image (Linux) so they match CI.
- **Language:** all UI text, identifiers, comments, commits and documentation
  in **English**.

## Product decisions (already made by the developer)

- **Captain name chosen by the player.** On first Play (no stored profile),
  show an accessible "Choose your captain name" dialog before the match
  starts. Generate a stable `playerId` (UUID) on creation; the name is display
  data only, so renaming never breaks history/ranking ownership.
  - Validation: trimmed, 2–20 chars, letters/numbers/spaces/`'`/`-`, no
    leading/trailing spaces; accessible inline error messages.
  - Persist `{ playerId, name }` locally; editable later (e.g. from Options).
  - Each match record stores `playerId` and the name at the time of the match.
  - The current player's rows are highlighted with a `YOU` badge (by
    `playerId`, not by name) in Ranking; Match History subtitle reads
    `<NAME> · YOUR RECENT BATTLES` (see mockups).
  - Fixture captains must not collide with the player's identity.

## Stack (all mandatory, all must be genuinely used)

React · TypeScript (`strict: true`) · PixiJS (v8) · TanStack Query · Axios ·
MSW · Playwright. Build tool: Vite. Unit tests: Vitest. Lint: ESLint + Prettier.

## Architecture rules

Layered, with a strict dependency direction (enforce with ESLint
`no-restricted-imports` / import boundaries):

```
src/
  config/        typed gameplay config + defaults + validation (pure)
  game/
    core/        simulation: entities, systems, rules, collisions, AI, spawner
                 → pure TypeScript. NO imports from pixi.js, react, DOM, window.
    input/       keyboard + touch → abstract `InputState` / commands
    render/      PixiJS views, effects, HP bars, camera/resize, asset registry
    runtime/     GameSession: wires core + input + render + clock; lifecycle
    bridge/      game → UI sync (external store, low-frequency snapshots/events)
  api/           contracts (types), axios client, query keys, hooks
  mocks/         MSW handlers, fixtures, scenarios, persistence (shared dev/test/prod)
  ui/            React screens, components, a11y helpers
  shared/        pure utilities only (rng, math, event emitter) — no DOM/browser APIs
  platform/      browser adapters (storage, etc.) — usable by ui, api, mocks, runtime;
                 forbidden for game/core and config
tests/e2e/       Playwright specs, fixtures, helpers
```

Principles:

1. **Simulation is pure and deterministic.** Fixed timestep (e.g. 1/60 s) with an
   accumulator and a max-frame clamp; all rules expressed in seconds, never in
   frames. Randomness only through an injected seeded RNG. Time only through an
   injected clock.
2. **Render reads, never decides.** Views are synced from simulation state; Pixi
   objects are pooled/reused; textures loaded once via a registry.
3. **React never renders per frame.** The bridge exposes a subscribable store
   (`useSyncExternalStore`) that emits only on meaningful change (score, integer
   seconds, HP buckets, phase changes).
4. **All balancing lives in config.** No magic numbers in systems. Each match
   uses a frozen snapshot of the config taken at start.
5. **Explicit lifecycle.** Every `init` has a matching `destroy` that removes
   listeners, ticker callbacks, timers, entities and GPU resources. Must be
   safe under React Strict Mode double mount (idempotent, abort-aware).
6. **Composition over inheritance**, small focused modules, discriminated unions
   for state/events, exhaustive `switch` with `never` checks.

## Code quality bar

- No `any`, no non-null assertions without a comment justifying it, no
  `@ts-ignore`. Prefer `unknown` + narrowing.
- Functions small and named by intent. Comments explain _why_, not _what_.
- Pure core logic gets Vitest unit tests (collisions, damage-once, cooldowns,
  spawner placement, match end rules, ranking tie-break, config validation).
- Errors are handled, never swallowed. Console must stay free of unhandled
  errors during all expected flows.
- Accessibility: keyboard navigation, visible focus, focus trap in dialogs,
  labels, contrast, accessible error messages, semantic live region for
  score/time/state (throttled, never per frame). Game keys captured only while
  gameplay is active.

## Test instrumentation

Expose `window.__PIRATE_TEST__` **only** when test mode is enabled (e.g.
`?test=1` or a build flag). It may: set seed, pause the real clock, advance
simulation by N ms, read a serializable state snapshot, select MSW scenario.
It must NOT bypass rules: combat tests drive real inputs (keyboard/touch) and
assert effects.

## Workflow

- Work **one phase at a time** (see `docs/PLAN.md` once created). Use plan mode
  for anything non-trivial before editing.
- Before declaring a phase done, run and pass: `pnpm typecheck`, `pnpm lint`,
  `pnpm test` (unit) and the relevant Playwright specs.
- Commit at the end of each phase with Conventional Commits
  (`feat(game): ...`, `test(e2e): ...`). Small, reviewable commits.
- Keep `ARCHITECTURE.md`, `README.md` and `docs/DECISIONS.md` updated as you go,
  not only at the end.
- **Never deploy, never run `vercel`/`netlify` commands, never create accounts
  or touch remote settings.** Deployment is done by the human. Prepare config
  and a checklist, then stop.
- Do not add dependencies without stating why; prefer small, well-known libs.
