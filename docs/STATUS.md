# Delivery status

Snapshot of what is done and what is not, against [CHALLENGE.md](CHALLENGE.md) and the
phase plan ([PLAN.md](PLAN.md)). Live demo: <https://junglegaming-challenge.vercel.app/>
(deployed by Vercel on every push to `main`).

## Done

- **Gameplay (§2)**: pure, deterministic simulation (fixed 1/60 s step, seeded RNG),
  player movement/rotation, front and broadside cannons with cooldowns, islands and
  arena bounds, Chaser (ram) and Shooter (standoff + fire) AI, spawner, damage stages,
  time-up and defeat endings, pause/blur/hidden handling.
- **Screens and config (§3)**: menu, options (validated, persisted), captain name, HUD,
  touch controls, pause, Result (status of the record), Captain's Log with Ranking and
  Match History tabs, matching the mockups.
- **PixiJS and architecture (§4)**: layered code with lint-enforced boundaries, asset
  registry with progress/failure/retry, pooled views and effects, explicit lifecycle
  (Strict Mode safe, counters back to zero after every exit).
- **Ranking and history (§5)**: Axios client with timeout and normalised errors, TanStack
  Query (pagination, cache, background refetch, retries, cancellation, revision guard),
  idempotent PUT, persisted pending queue flushed on start/online/Retry/after success.
- **MSW (§6)**: persisted mock db, fixed-date fixtures, deterministic ranking, all 14
  scenarios via `?scenario=` and the dev panel (`?dev=1` or the menu footer link), Reset;
  the worker runs in the production build.
- **UI and accessibility (§7)**: keyboard navigation, focus traps, live region, axe
  checks, contrast checks, portrait overlay on phones.
- **Playwright (§8)**: every bullet mapped to specs (table in the
  [README](../README.md#playwright-coverage-spec-8)); desktop + mobile Chromium; visual
  baselines for menu, arena and result generated in the pinned Linux image.
  Last full local run: 184 passed, 12 skipped (visual specs are Linux-only, and
  desktop-only touch/portrait specs).
- **Performance (§9)**: `pnpm perf` and [PERFORMANCE.md](PERFORMANCE.md): 74.9 FPS
  average (vsync-capped at 75 Hz), p95 frame time 13.6 ms over a 3-minute real-clock
  match; 5 cycles with every resource counter back to zero.
- **Docs (§11)**: README (reviewer guide, setup, env vars, controls, config, scenarios,
  commands, failure reproduction, licenses), ARCHITECTURE.md, DECISIONS.md.

## Not done / partial

- Memory: the heap grows by 0.66 MB over cycles 2–5 while every resource counter returns
  to zero; a longer run with heap-snapshot comparison was not done
  ([PERFORMANCE.md](PERFORMANCE.md#results--memory-over-5-cycles)).
- Phase 9 deploy checklist (`DEPLOY.md`) and a scripted clean-clone verification were not
  written; the Vercel deployment itself is live and redeploys on push.
- Performance was measured on one machine (discrete GPU); no phone measurements.

## Known limitations

See [README → Known limitations](../README.md#known-limitations) and
[ARCHITECTURE.md → Limitations and balancing](../ARCHITECTURE.md#limitations-and-balancing).

## CI

CI (GitHub Actions, pinned Playwright image) runs typecheck, lint, format, unit tests
and the full e2e suite on every push. Result of the last pushed commit: see the end of
this file.
