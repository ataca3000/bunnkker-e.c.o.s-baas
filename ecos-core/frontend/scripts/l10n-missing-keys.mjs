#!/usr/bin/env node
/**
 * ECOS Localization Key Generator (EPIC-L10N-001)
 *
 * Finds translation keys referenced in code but absent from the locale files,
 * and generates placeholder entries preserving the full object hierarchy.
 *
 * Keys are derived from the selector call sites themselves — `t($ => $.a.b.c)` —
 * not from TS2339 text, because a diagnostic names only the missing property
 * ("Property 'fleet' does not exist"), never the complete path.
 *
 * Namespace resolution mirrors the runtime binding:
 *   const { t } = useTranslation('orders')        → t      → orders
 *   const { t: tCommon } = useTranslation('common') → tCommon → common
 *   useTranslation()                              → common (defaultNS)
 *
 * Dynamic segments (`$.movementTypes[type]`) cannot be resolved statically —
 * the concrete member names live in a TypeScript union. Those paths are
 * reported separately rather than guessed at.
 *
 * Usage:
 *   node scripts/l10n-missing-keys.mjs                 # report only
 *   node scripts/l10n-missing-keys.mjs --write         # generate placeholders
 *   node scripts/l10n-missing-keys.mjs --json
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');
const LOCALES = path.join(ROOT, 'src/i18n/locales');
const PLACEHOLDER = 'TODO';

const argv = process.argv.slice(2);
const write = argv.includes('--write');
const asJson = argv.includes('--json');

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(d, e.name);
  return e.isDirectory() ? walk(p) : (/\.tsx?$/.test(e.name) ? [p] : []);
});

/** Maps each translation function name in a file to the namespace it is bound to. */
function bindings(text) {
  const map = new Map();
  // const { t } = useTranslation('ns')  |  const { t: tX } = useTranslation('ns')
  const re = /\{\s*t(?:\s*:\s*(t[A-Za-z0-9_]*))?\s*[,}][^=]*=\s*useTranslation\(\s*(?:'([^']+)'|"([^"]+)")?\s*\)/g;
  for (const m of text.matchAll(re)) {
    const fn = m[1] ?? 't';
    const ns = m[2] ?? m[3] ?? 'common';   // no argument → defaultNS
    map.set(fn, ns);
  }
  return map;
}

/** Extracts the selector path segments from one `t($ => $…)` occurrence. */
function parsePath(chain) {
  const segs = [];
  const re = /\.([A-Za-z_$][\w$]*)|\[\s*'([^']+)'\s*\]|\[\s*"([^"]+)"\s*\]|\[([^\]]+)\]/g;
  for (const m of chain.matchAll(re)) {
    if (m[1] !== undefined) segs.push({ k: m[1], dynamic: false });
    else if (m[2] !== undefined) segs.push({ k: m[2], dynamic: false });
    else if (m[3] !== undefined) segs.push({ k: m[3], dynamic: false });
    else segs.push({ k: m[4].trim(), dynamic: true });
  }
  return segs;
}

const get = (obj, segs) => segs.reduce((o, s) => (o && typeof o === 'object' ? o[s.k] : undefined), obj);

/* ── collect ─────────────────────────────────────────────────────────────── */
const byNs = new Map();      // ns -> Map(dottedPath -> {segs, files:Set})
const dynamicPaths = [];     // unresolvable, reported not generated
let totalRefs = 0;

for (const file of walk(SRC)) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes('useTranslation(')) continue;
  const binds = bindings(text);
  if (!binds.size) continue;

  const names = [...binds.keys()].sort((a, b) => b.length - a.length);
  const callRe = new RegExp(
    `\\b(${names.join('|')})\\(\\s*\\(?\\s*\\$\\s*\\)?\\s*=>\\s*\\$((?:\\.[A-Za-z_$][\\w$]*|\\[[^\\]]+\\])+)`, 'g');

  for (const m of text.matchAll(callRe)) {
    const ns = binds.get(m[1]);
    if (!ns) continue;
    totalRefs += 1;
    const segs = parsePath(m[2]);
    if (!segs.length) continue;

    const dynIdx = segs.findIndex((s) => s.dynamic);
    if (dynIdx !== -1) {
      dynamicPaths.push({
        ns, file: path.relative(SRC, file),
        path: segs.map((s) => (s.dynamic ? `[${s.k}]` : s.k)).join('.'),
        staticPrefix: segs.slice(0, dynIdx),
      });
      continue;
    }
    if (!byNs.has(ns)) byNs.set(ns, new Map());
    const key = segs.map((s) => s.k).join('.');
    const entry = byNs.get(ns).get(key) ?? { segs, files: new Set() };
    entry.files.add(path.relative(SRC, file));
    byNs.get(ns).set(key, entry);
  }
}

/* ── diff against locale files ───────────────────────────────────────────── */
const langs = fs.readdirSync(LOCALES).filter((d) => fs.statSync(path.join(LOCALES, d)).isDirectory());
const report = [];
let totalMissing = 0, totalExisting = 0;

for (const [ns, keys] of [...byNs.entries()].sort()) {
  const enPath = path.join(LOCALES, 'en', `${ns}.json`);
  const en = fs.existsSync(enPath) ? JSON.parse(fs.readFileSync(enPath, 'utf8')) : null;
  const missing = [];
  for (const [key, { segs }] of keys) {
    const v = en ? get(en, segs) : undefined;
    if (v === undefined) missing.push({ key, segs });
    else totalExisting += 1;
  }
  totalMissing += missing.length;
  report.push({ ns, namespaceExists: en !== null, referenced: keys.size, missing: missing.length, keys: missing });
}

/* ── generate ────────────────────────────────────────────────────────────── */
let written = 0, filesTouched = 0;
if (write) {
  for (const { ns, keys } of report) {
    if (!keys.length) continue;
    for (const lang of langs) {
      const p = path.join(LOCALES, lang, `${ns}.json`);
      const obj = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
      let changed = 0;
      for (const { segs } of keys) {
        let cur = obj;
        for (let i = 0; i < segs.length - 1; i += 1) {
          const k = segs[i].k;
          // Never overwrite an existing leaf with an object — that would
          // silently destroy a translation. Skip the whole path instead.
          if (cur[k] === undefined) cur[k] = {};
          else if (typeof cur[k] !== 'object' || Array.isArray(cur[k])) { cur = null; break; }
          cur = cur[k];
        }
        if (!cur) continue;
        const leaf = segs[segs.length - 1].k;
        if (cur[leaf] === undefined) { cur[leaf] = PLACEHOLDER; changed += 1; }
      }
      if (changed) {
        fs.writeFileSync(p, `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
        written += changed; filesTouched += 1;
      }
    }
  }
}

/* ── output ──────────────────────────────────────────────────────────────── */
if (asJson) {
  console.log(JSON.stringify({ totalRefs, totalExisting, totalMissing, report, dynamicPaths }, null, 2));
} else {
  console.log(`\n  ECOS localization — missing key report${write ? ' (WRITTEN)' : ''}`);
  console.log(`  ${'═'.repeat(66)}`);
  console.log(`  selector references scanned   ${totalRefs}`);
  console.log(`  resolved & present            ${totalExisting}`);
  console.log(`  missing (static paths)        ${totalMissing}`);
  console.log(`  dynamic paths (not generated) ${dynamicPaths.length}`);
  console.log(`  languages                     ${langs.join(', ')}`);
  console.log(`\n  ${'namespace'.padEnd(26)}${'exists'.padStart(7)}${'refs'.padStart(7)}${'missing'.padStart(9)}`);
  console.log(`  ${'─'.repeat(66)}`);
  for (const r of report.filter((x) => x.missing > 0).sort((a, b) => b.missing - a.missing)) {
    console.log(`  ${r.ns.padEnd(26)}${(r.namespaceExists ? 'yes' : 'NO').padStart(7)}` +
      `${String(r.referenced).padStart(7)}${String(r.missing).padStart(9)}`);
  }
  if (write) console.log(`\n  placeholders written  ${written}  across ${filesTouched} files`);
  console.log('');
}
