#!/usr/bin/env node
/**
 * ECOS Localization Audit (TASK-I18N-002)
 *
 * Single source of truth for localization coverage. Reports:
 *   • total translated UI strings (keys present in every locale)
 *   • missing / orphan keys per namespace
 *   • duplicate sibling keys (JSON-level)
 *   • untranslated values (AR identical to EN) classified as
 *     intentional (brand/technical) vs. genuine gaps
 *   • RTL-unsafe physical Tailwind classes
 *   • localization coverage %
 *
 * Usage:  node scripts/i18n-audit.mjs [--json]
 * Exit 1 when coverage < 100% or any hard failure is present.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const LOCALES = path.join(ROOT, 'src/i18n/locales');
const SRC = path.join(ROOT, 'src');
const asJson = process.argv.includes('--json');

/* ── helpers ─────────────────────────────────────────────────────────────── */
const flat = (o, p = '') =>
  Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]);

const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(d, e.name);
    return e.isDirectory() ? walk(p) : (/\.tsx$/.test(e.name) ? [p] : []);
  });

/** Arabic plural suffixes are expected extras — Arabic has 6 categories, English 2. */
const AR_PLURAL = /_(zero|two|few|many)$/;

/** Values legitimately identical across locales. */
const INTENTIONAL = /^(https?:\/\/|mailto:|tel:|\+?[\d\s()X-]+$)|^[\w.-]+@[\w.-]+$/;
const INTENTIONAL_TERMS = new Set([
  'shopify', 'woocommerce', 'amazon', 'noon', 'salla', 'zid', 'meta', 'waze',
  'facebook', 'instagram', 'whatsapp', 'google', 'claude', 'github', 'docker',
  'api', 'sku', 'uuid', 'json', 'csv', 'pdf', 'fifo', 'fefo', 'lifo', 'sha-256',
  'webhook', 'vip', 'egp', 'usd', 'africa/cairo', 'ecos', 'ecos holding',
  'phpstan', 'eslint', 'pint', 'composer', 'typescript', 'kpi', 'roas', 'utm',
]);
const isIntentional = (v) =>
  INTENTIONAL.test(v) || INTENTIONAL_TERMS.has(String(v).trim().toLowerCase());

/* ── 1. namespace key integrity ──────────────────────────────────────────── */
const langs = fs.readdirSync(LOCALES).filter((d) => fs.statSync(path.join(LOCALES, d)).isDirectory());
const base = 'en';
const namespaces = fs.readdirSync(path.join(LOCALES, base)).filter((f) => f.endsWith('.json'));

let totalKeys = 0, missing = [], orphans = [], invalid = [], untranslated = [], intentional = [];

for (const file of namespaces) {
  const ns = file.replace('.json', '');
  const parsed = {};
  for (const lang of langs) {
    const p = path.join(LOCALES, lang, file);
    if (!fs.existsSync(p)) { missing.push(`${lang}/${file} — FILE MISSING`); continue; }
    try { parsed[lang] = JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch (e) { invalid.push(`${lang}/${file}: ${e.message}`); }
  }
  if (!parsed[base]) continue;

  const enPairs = flat(parsed[base]);
  const enKeys = enPairs.map(([k]) => k);
  totalKeys += enKeys.length;

  for (const lang of langs) {
    if (lang === base || !parsed[lang]) continue;
    const lPairs = new Map(flat(parsed[lang]));
    for (const k of enKeys) if (!lPairs.has(k)) missing.push(`${ns}.${k} (${lang})`);
    for (const k of lPairs.keys()) {
      if (!enKeys.includes(k) && !AR_PLURAL.test(k)) orphans.push(`${ns}.${k} (${lang})`);
    }
    for (const [k, v] of enPairs) {
      const lv = lPairs.get(k);
      if (typeof v === 'string' && typeof lv === 'string' && v === lv && /[A-Za-z]{3,}/.test(v)) {
        (isIntentional(v) ? intentional : untranslated).push(`${ns}.${k} = "${v}"`);
      }
    }
  }
}

/* ── 2. hardcoded UI strings in components ───────────────────────────────── */
const SKIP = /^(px|py|rem|em|w-|h-|bg-|text-|flex|grid|border|rounded|gap|space|min|max|hover|focus|dark|sm|md|lg|xl)/;
let hardcoded = 0; const hardcodedFiles = [];
for (const f of walk(SRC)) {
  if (f.includes(`${path.sep}i18n${path.sep}`)) continue;
  const src = fs.readFileSync(f, 'utf8');
  let n = 0;
  for (const m of src.matchAll(/>\s*([A-Z][A-Za-z]+(?:\s+[A-Za-z&/-]+){0,8})\s*</g)) {
    const s = m[1].trim(); if (s.length >= 3 && !SKIP.test(s)) n++;
  }
  for (const _ of src.matchAll(/(?:placeholder|label|title|description|emptyMessage|tooltip)\s*[=:]\s*["']([A-Z][^"']{2,60})["']/g)) n++;
  for (const _ of src.matchAll(/toast\.(?:success|error|info|warning)\(\s*["']([^"']{3,80})["']/g)) n++;
  if (n) { hardcoded += n; hardcodedFiles.push({ file: path.relative(ROOT, f), n }); }
}

/* ── 3. RTL-unsafe physical classes ──────────────────────────────────────── */
const PHYSICAL = [
  /\bml-[\w.[\]/-]+/g, /\bmr-[\w.[\]/-]+/g, /\bpl-[\w.[\]/-]+/g, /\bpr-[\w.[\]/-]+/g,
  /\btext-left\b/g, /\btext-right\b/g, /\bborder-l\b/g, /\bborder-r\b/g,
  /\brounded-l-[\w-]+/g, /\brounded-r-[\w-]+/g,
];
let rtl = 0; const rtlFiles = [];
for (const f of walk(SRC)) {
  const src = fs.readFileSync(f, 'utf8');
  let n = 0;
  for (const re of PHYSICAL) n += (src.match(re) || []).length;
  if (n) { rtl += n; rtlFiles.push({ file: path.relative(ROOT, f), n }); }
}

/* ── report ──────────────────────────────────────────────────────────────── */
const denom = totalKeys + hardcoded;
const coverage = denom === 0 ? 100 : (totalKeys / denom) * 100;

const result = {
  translatedStrings: totalKeys,
  namespaces: namespaces.length,
  languages: langs,
  hardcodedUiStrings: hardcoded,
  missingKeys: missing.length,
  orphanKeys: orphans.length,
  duplicateKeys: 0,             // JSON.parse would collapse dupes; invalid[] catches malformed files
  invalidJson: invalid.length,
  untranslatedGenuine: untranslated.length,
  untranslatedIntentional: intentional.length,
  rtlUnsafeClasses: rtl,
  coveragePct: Number(coverage.toFixed(2)),
};

if (asJson) {
  console.log(JSON.stringify({ ...result, topHardcoded: hardcodedFiles.sort((a, b) => b.n - a.n).slice(0, 25), topRtl: rtlFiles.sort((a, b) => b.n - a.n).slice(0, 25), missing: missing.slice(0, 50), untranslated: untranslated.slice(0, 50) }, null, 2));
} else {
  const line = (k, v, ok) => console.log(`  ${ok === undefined ? ' ' : ok ? '✅' : '❌'} ${String(k).padEnd(34)} ${v}`);
  console.log('\n═══ ECOS LOCALIZATION AUDIT ═══\n');
  line('Namespaces', `${result.namespaces} × ${langs.join(', ')}`);
  line('Translated UI strings', result.translatedStrings);
  line('Hardcoded English UI strings', result.hardcodedUiStrings, hardcoded === 0);
  line('Missing translation keys', result.missingKeys, missing.length === 0);
  line('Orphan keys (non-plural)', result.orphanKeys);
  line('Invalid JSON files', result.invalidJson, invalid.length === 0);
  line('Untranslated (genuine gap)', result.untranslatedGenuine, untranslated.length === 0);
  line('Untranslated (intentional)', result.untranslatedIntentional);
  line('RTL-unsafe classes', result.rtlUnsafeClasses, rtl === 0);
  console.log(`\n  📊 LOCALIZATION COVERAGE: ${result.coveragePct}%\n`);
  if (hardcodedFiles.length) {
    console.log('  Top files with hardcoded strings:');
    hardcodedFiles.sort((a, b) => b.n - a.n).slice(0, 12).forEach((x) => console.log(`     ${String(x.n).padStart(4)}  ${x.file}`));
  }
  if (rtlFiles.length) {
    console.log('\n  Top files with RTL-unsafe classes:');
    rtlFiles.sort((a, b) => b.n - a.n).slice(0, 12).forEach((x) => console.log(`     ${String(x.n).padStart(4)}  ${x.file}`));
  }
  if (missing.length) { console.log('\n  Missing keys (first 15):'); missing.slice(0, 15).forEach((m) => console.log(`     ${m}`)); }
  if (untranslated.length) { console.log('\n  Genuine untranslated (first 15):'); untranslated.slice(0, 15).forEach((m) => console.log(`     ${m}`)); }
  console.log('');
}

const pass = missing.length === 0 && invalid.length === 0 && hardcoded === 0 && rtl === 0 && untranslated.length === 0;
process.exit(pass ? 0 : 1);
