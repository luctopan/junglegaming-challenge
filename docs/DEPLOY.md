# Deployment

The game is a static single-page app; the ranking/history backend is Mock Service Worker
running in the visitor's browser, so no server, database or secret is needed.
Live: <https://junglegaming-challenge.vercel.app/> (Vercel, redeployed on every push to
`main`). Deployments are done by a human; nothing in this repository calls the Vercel CLI.

## Configuration ([vercel.json](../vercel.json))

| Setting                 | Value                                                  | Why                                                               |
| ----------------------- | ------------------------------------------------------ | ----------------------------------------------------------------- |
| Install                 | `pnpm install --frozen-lockfile`                       | Exactly the committed lockfile                                    |
| Build                   | `pnpm build`                                           | Assets, typecheck, bundle, and the dev-code check (`verify-dist`) |
| Output                  | `dist`                                                 | Vite output (contains `mockServiceWorker.js`)                     |
| Rewrite                 | every path without a dot → `/index.html`               | Deep links and reloads (`/records/history`, `/result`) work       |
| `/mockServiceWorker.js` | `Cache-Control: no-cache`, `Service-Worker-Allowed: /` | A new worker is picked up at once; it controls the whole site     |

No environment variables are required. `VITE_API_TIMEOUT_MS` (default 8000) is optional.
Node ≥ 22.18 and pnpm 10 (from `packageManager`) are used by the build.

## Checklist (before and after a deploy)

Before pushing to `main`:

- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm format:check`, `pnpm test` pass.
- [ ] `pnpm test:e2e` passes (visual specs in Docker: `pnpm test:e2e:docker`).
- [ ] `pnpm build` ends with `dist/ is free of dev-only code`.

After Vercel reports the deployment ready (smoke test on the live URL):

- [ ] `/` loads with no console errors; the menu shows Play, Options, Ranking, Match history.
- [ ] Reload on `/records/ranking`, `/records/history`, `/options` and `/result` → the app
      opens (no 404); `/play` returns to the menu (an interrupted match is abandoned).
- [ ] DevTools → Application → Service Workers: `mockServiceWorker.js` is activated;
      Network shows `/api/ranking…` answered "from ServiceWorker".
- [ ] Ranking lists fixture captains (3 pages for 120 s / 3 s).
- [ ] Play a 60 s match: Result shows _Saved_; the match is in Ranking (`YOU`) and Match
      History; it is still there after a reload.
- [ ] `/?dev=1` opens the Mock backend panel; `unavailable-then-recover` → Pending →
      Retry → Saved; Reset clears the records.
- [ ] The page source references the same `static/index-<hash>.js` as a local
      `pnpm build` of the deployed commit (deployed code = delivered code).
- [ ] A phone in landscape: touch controls work; portrait shows the rotate overlay.

## Clean-clone verification (2026-10-08, commit `ff8bed4`)

Run on the reference machine (Windows 11, Node 24.12, pnpm 10.34.6) from a fresh
`git clone` of the GitHub repository into an empty folder:

| Step                                 | Result                                                                                               |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`     | OK, 9 s (no lockfile changes)                                                                        |
| `pnpm build`                         | OK, `dist/ is free of dev-only code (102 files checked)`                                             |
| `vite preview` + HTTP probes         | `/`, `/records/history`, `/options` → 200 HTML; `/mockServiceWorker.js` → 200 JS                     |
| Playwright against the clone's build | smoke, records, submission, network-resilience, navigation, result: **54 passed** (desktop + mobile) |

Live deployment check (same day, read-only HTTP requests):

| Check                                                   | Result                                                 |
| ------------------------------------------------------- | ------------------------------------------------------ |
| `/`, `/records/ranking`, `/result`, `/play`, `/options` | 200 (SPA rewrite active)                               |
| `/mockServiceWorker.js` headers                         | `Cache-Control: no-cache`, `Service-Worker-Allowed: /` |
| Bundle served vs local build of `main`                  | identical (`static/index-CmSBE2XH.js`)                 |

Note: a clone inside a folder whose path the OS reports with mixed casing (for example a
temp folder reached through a lower-case alias) makes `tsc` fail with TS1149 (same file,
different casing; `forceConsistentCasingInFileNames`). Clone into a normal path.
