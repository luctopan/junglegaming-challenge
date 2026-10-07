// @ts-check
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { boundariesConfig } from './eslint/boundaries.js';

export default defineConfig(
  globalIgnores([
    'dist',
    'coverage',
    'playwright-report',
    'test-results',
    'public/mockServiceWorker.js',
    'public/assets',
  ]),

  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-expect-error': 'allow-with-description', 'ts-ignore': true, 'ts-nocheck': true },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      eqeqeq: ['error', 'always'],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },

  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['src/**/*.tsx'],
    extends: [
      reactHooks.configs.flat['recommended-latest'],
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.strict,
    ],
  },
  ...boundariesConfig,

  {
    files: ['*.{js,ts}', 'eslint/**/*.js', 'scripts/**/*.mjs', 'tests/**/*.ts'],
    languageOptions: { globals: globals.node },
    rules: { 'no-console': 'off' },
  },
  {
    // Plain JS tooling is type-checked through JSDoc (`// @ts-check`), where
    // values coming from JSON/XML are legitimately loose.
    files: ['**/*.{js,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  prettier,
);
