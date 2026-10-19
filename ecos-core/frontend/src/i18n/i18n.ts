/**
 * ECOS i18n Bootstrap
 *
 * Loading strategy
 * ────────────────
 * • `common` is bundled eagerly — zero flash for navigation labels, buttons,
 *   and form controls that appear on every screen.
 * • Every other namespace is lazy-loaded on demand via Vite code splitting.
 *   When a component calls useTranslation('orders') for the first time,
 *   Vite fetches only the orders chunk for the active language.
 *
 * Adding a new namespace
 * ──────────────────────
 * 1. Add its name to src/i18n/namespaces.ts.
 * 2. Create src/i18n/locales/en/<ns>.json and src/i18n/locales/ar/<ns>.json.
 * No changes here — the glob pattern picks them up automatically.
 */

import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';

import { NAMESPACES } from '@/i18n/namespaces';

// ── Eager bundle — common only ─────────────────────────────────────────────
import enCommon from '@/i18n/locales/en/common.json';
import arCommon from '@/i18n/locales/ar/common.json';

// ── Lazy bundles — all namespaces, all languages ──────────────────────────
// Single glob that matches every locale file in every language directory.
// Vite emits each matched file as a separate chunk, fetched only on demand.
//
// Adding a new language: create src/i18n/locales/<lang>/*.json files,
// add the lang code to supportedLngs below and SUPPORTED in language-provider.
// No changes to this backend are needed.
const localeModules = import.meta.glob<{ default: Record<string, unknown> }>(
  './locales/*/*.json',
  { eager: false },
);

type BackendReadCallback = (
  err: Error | null,
  data: Record<string, unknown> | null,
) => void;

// ── Custom Vite backend ────────────────────────────────────────────────────
const viteBackend = {
  type: 'backend' as const,
  read(language: string, namespace: string, callback: BackendReadCallback): void {
    // common is pre-bundled in resources below; i18next won't call read() for it.
    const path = `./locales/${language}/${namespace}.json`;
    const loader = localeModules[path];
    if (loader === undefined) {
      // Namespace file doesn't exist yet — return empty object so the app
      // degrades gracefully (keys display as-is) instead of throwing.
      callback(null, {});
      return;
    }
    void loader()
      .then(mod => callback(null, mod.default))
      .catch((err: unknown) =>
        callback(err instanceof Error ? err : new Error(String(err)), null),
      );
  },
};

// ── Init ───────────────────────────────────────────────────────────────────
void i18n
  .use(viteBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // common is bundled; all other namespaces are loaded by the backend.
    partialBundledLanguages: true,
    resources: {
      en: { common: enCommon },
      ar: { common: arCommon },
    },
    ns: [...NAMESPACES],
    defaultNS: 'common',
    fallbackLng: 'en',
    supportedLngs: ['en', 'ar'],
    detection: {
      order: ['localStorage'],
      lookupLocalStorage: 'language',
      caches: ['localStorage'],
    },
    interpolation: {
      escapeValue: false, // React already escapes
    },
    react: {
      // false: components render immediately with key-as-fallback, then
      // re-render once the namespace loads. Avoids adding Suspense boundaries
      // to every lazy-namespace consumer during the migration period.
      useSuspense: false,
    },
  });

export default i18n;
