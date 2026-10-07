import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    // Only index.html is an input: sandbox.html and src/dev/** exist for the dev server alone
    // (checked after every build by scripts/verify-dist.mjs).
    rollupOptions: { input: 'index.html' },
    // public/assets/ holds the runtime game assets; keep hashed bundles apart.
    assetsDir: 'static',
    sourcemap: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'tests/tooling/**/*.test.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.test-support.ts',
        'src/game/core/testing/**',
        'src/dev/**',
        'src/main.tsx',
        'src/vite-env.d.ts',
      ],
      reporter: ['text-summary', 'html'],
      // `pnpm test` runs with coverage, so dropping below this fails the run (and CI).
      thresholds: {
        'src/game/core/**/*.ts': { lines: 90 },
      },
    },
  },
});
