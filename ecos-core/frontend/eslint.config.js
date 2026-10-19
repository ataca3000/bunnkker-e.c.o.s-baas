import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';
import ecosI18n from './eslint-rules/index.js';

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    // ── i18n Guard (TASK-I18N-GUARD-001) ──────────────────────────────────
    // Every user-facing string must come from the localization system.
    // CI fails if a new hardcoded UI string is introduced. Brand names,
    // product names, technical identifiers, and API names are exempt — see
    // the allow-lists in eslint-rules/no-hardcoded-ui-strings.js.
    files: ['src/**/*.{ts,tsx}'],
    plugins: { 'ecos-i18n': ecosI18n },
    rules: {
      'ecos-i18n/no-hardcoded-ui-strings': 'error',
      'ecos-i18n/no-arabic-literals': 'error',
    },
  },
  {
    // The i18n layer itself legitimately contains locale strings and the
    // namespace registry; the guard would flag its own scaffolding.
    files: ['src/i18n/**/*.{ts,tsx}'],
    rules: {
      'ecos-i18n/no-hardcoded-ui-strings': 'off',
      'ecos-i18n/no-arabic-literals': 'off',
    },
  },
  {
    // shadcn/ui primitives canonically export their cva variant helpers
    // alongside the component, which is incompatible with the Fast Refresh
    // "only export components" rule. This does not affect runtime behavior.
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
]);
