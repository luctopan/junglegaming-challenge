# Performance

Evidence for spec §9: combat performance of the **production build** over a three-minute
match, and memory after five start/play/exit cycles. Produced by `pnpm perf`
([scripts/perf.mjs](../scripts/perf.mjs)); raw data:
[docs/perf/perf-results.json](perf/perf-results.json) (one sample per second of
enemies, projectiles and Pixi display objects, plus every cycle's resource counters).

## Reference environment

| Item         | Value                                                                   |
| ------------ | ----------------------------------------------------------------------- |
| Hardware     | Laptop, Intel Core i7-12700H (20 threads), 16 GB RAM                    |
| GPU          | NVIDIA GeForce RTX 3060 Laptop GPU (ANGLE, Direct3D 11)                 |
| Display      | 75 Hz panel (the browser's rAF rate, hence the ~75 FPS ceiling)         |
| OS           | Windows 11 (10.0.26200)                                                 |
| Browser      | Google Chrome 155.0.8059.40, headed, driven by Playwright               |
| Resolution   | 1280×720 CSS px viewport, device scale factor 1                         |
| Build        | `vite build` (minified), served by `vite preview`, MSW active           |
| Match config | 180 s session, 3 s spawn interval, seed 42, **real clock**, audio muted |

## Method

1. `pnpm perf` builds the app, serves `dist/` and opens `/?test=1&seed=42` (the test hook
   is only used to _read_ snapshots and resource counters; the clock is the real one).
2. A pilot drives the ship with **real keyboard input** for the whole match: `W` held,
   `A` held for 0.6 s every 2.1 s, `Space` every 0.3 s and alternating broadsides every
   1.8 s. If the ship sinks before 180 s of combat, Play again continues the measurement
   (here it survived: one match).
3. Frame times come from a `requestAnimationFrame` probe in the page (time between
   consecutive frames), entity counts from the snapshot once per second.
4. Memory: five cycles of menu → Play → 20 s of piloted combat → Pause → Main menu;
   after each exit a forced GC (`HeapProfiler.collectGarbage` over CDP), then
   `Runtime.getHeapUsage` and the runtime resource counters (`resources()`).

## Results — three-minute match

| Metric                      | Value                                  |
| --------------------------- | -------------------------------------- |
| Duration measured           | 185 s wall time, 180.4 s of combat     |
| Frames                      | 13 888                                 |
| Average FPS                 | **74.9** (target 60; vsync-capped)     |
| Frame time mean / p50       | 13.34 ms / 13.3 ms                     |
| **Frame time p95**          | **13.6 ms** (p99 13.8 ms, max 27.1 ms) |
| Frames over 20 ms           | 8 of 13 888 (0.06 %)                   |
| Enemies alive (max / mean)  | 5 / 2.3                                |
| Projectiles in flight (max) | 5 sampled (pooled sprites)             |
| Pixi display objects (max)  | 228                                    |

The frame time is flat at the display's refresh interval (75 Hz = 13.3 ms) for the
whole match; the few frames above 20 ms are isolated (no stutter clusters). The
simulation is a fixed 1/60 s step with an accumulator, so a faster display does not
speed up the game.

## Results — memory over 5 cycles

| After           | JS heap (after GC) | Pixi apps / canvases / ticker callbacks / listeners / observers / display objects | Cached textures |
| --------------- | ------------------ | --------------------------------------------------------------------------------- | --------------- |
| Menu (baseline) | 6.74 MB            | —                                                                                 | —               |
| Cycle 1         | 8.59 MB            | 0 / 0 / 0 / 0 / 0 / 0                                                             | 234             |
| Cycle 2         | 8.83 MB            | 0 / 0 / 0 / 0 / 0 / 0                                                             | 234             |
| Cycle 3         | 9.00 MB            | 0 / 0 / 0 / 0 / 0 / 0                                                             | 234             |
| Cycle 4         | 9.08 MB            | 0 / 0 / 0 / 0 / 0 / 0                                                             | 234             |
| Cycle 5         | 9.25 MB            | 0 / 0 / 0 / 0 / 0 / 0                                                             | 234             |

- The first match loads the Pixi/game chunk and the atlases (+1.85 MB, expected: the
  texture registry keeps 234 atlas frames for the next match by design).
- Every session-owned resource returns to **zero** after each exit (the same check runs
  in e2e: [lifecycle.spec.ts](../tests/e2e/lifecycle.spec.ts)), and the cached texture
  count stays constant, so nothing is re-uploaded or duplicated per match.
- Cycles 2–5 add 0.08–0.24 MB each (+0.66 MB in total). Likely sources, all bounded:
  TanStack Query's mutation/query cache (kept 5 min), V8 code and inline caches warming up,
  and React's retained fibers for the last screens. Not investigated further within the
  deadline; a longer run (e.g. 20 cycles with heap snapshots compared by constructor) is
  the next step to rule out a slow leak.

## Limitations

- One machine with a discrete GPU; results on integrated GPUs and phones were not
  measured. Headless Chromium (CI, e2e) renders WebGL on the CPU (SwiftShader) and is
  not representative (`node scripts/perf.mjs --headless` measures it if needed).
- The FPS figure is capped by the 75 Hz display; it shows headroom over the 60 FPS target
  but not the maximum throughput.
- The pilot is scripted, not a human: enemy counts stayed moderate (max 5 alive). The
  25-enemy safety cap was not reached in this run.
- Entity counts are sampled once per second, so short-lived projectiles are undercounted.

## Reproducing

```bash
pnpm perf
```

Writes `docs/perf/perf-results.json` (pass another path as the first argument).
Options (with `node scripts/perf.mjs` on an existing build): `--headless`,
`--channel=chromium` (Playwright Chromium instead of the installed Chrome).
Manual alternative: open the production build, start a 180 s match and record a Chrome
DevTools Performance trace (FPS meter + frame timings); for memory, take heap snapshots
on the menu after 1 and 5 play/exit cycles and compare by constructor.
