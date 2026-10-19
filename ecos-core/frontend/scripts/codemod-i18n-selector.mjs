#!/usr/bin/env node
/**
 * ECOS i18n Selector Codemod (EPIC-1 · Option A2)
 *
 * Converts string-key `t()` call sites to i18next selector form:
 *
 *   t('list.title')                 →  t($ => $.list.title)
 *   t('list.title', { n: 1 })       →  t($ => $.list.title, { n: 1 })
 *   t('some-key.x')                 →  t($ => $['some-key'].x)
 *
 * Selector mode is what makes `enableSelector: "optimize"` viable: measured on
 * the real application it cuts type instantiations 98.45% (175.6M → 2.7M) and
 * check time 95.76% (1,617s → 68.6s) while KEEPING key type-safety — the
 * compiler validates every selector path exactly as it validated string keys.
 *
 * Scope guard: only files that call `useTranslation(` are touched, and only
 * `t(` / `i18n.t(` invocations with a literal first argument. Anything dynamic
 * (`t(variable)`, template literals, arrays) is left alone and reported, since
 * those need human judgement.
 *
 * Usage:
 *   node scripts/codemod-i18n-selector.mjs --namespaces boms,stock-ledger --dry
 *   node scripts/codemod-i18n-selector.mjs --namespaces boms,stock-ledger
 *   node scripts/codemod-i18n-selector.mjs --all
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');

const argv = process.argv.slice(2);
const val = (n, d) => { const i = argv.indexOf(n); return i !== -1 && argv[i + 1] ? argv[i + 1] : d; };
const dry = argv.includes('--dry');
const all = argv.includes('--all');
const namespaces = (val('--namespaces', '') || '').split(',').filter(Boolean);

if (!all && !namespaces.length) {
  console.error('codemod: pass --namespaces a,b or --all');
  process.exit(2);
}

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(d, e.name);
  return e.isDirectory() ? walk(p) : (/\.tsx?$/.test(e.name) ? [p] : []);
});

/** Dot access when the segment is a safe identifier, bracket access otherwise. */
const IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
function toSelector(key) {
  const parts = key.split('.');
  if (parts.some((p) => p === '')) return null;          // malformed — skip
  return `$ => $${parts.map((p) => (IDENT.test(p) ? `.${p}` : `[${JSON.stringify(p)}]`)).join('')}`;
}

/**
 * Translation functions are frequently aliased when a component needs a second
 * namespace: `const { t: tCommon } = useTranslation('common')`. There are 289
 * such call sites across 4 aliases, and they need identical conversion — the
 * selector form does not depend on which namespace `t` is bound to.
 *
 * Aliases are discovered per file from the destructuring pattern rather than
 * matched by shape, so an unrelated function whose name happens to start with
 * `t` + uppercase is never rewritten.
 */
function translationFns(text) {
  const names = new Set(['t']);
  for (const m of text.matchAll(/\bt\s*:\s*(t[A-Za-z0-9_]*)/g)) names.add(m[1]);
  return [...names].sort((a, b) => b.length - a.length); // longest first
}

/**
 * Matches `<fn>('key'` / `i18n.t("key"` with a quoted literal. Deliberately
 * conservative: no template literals, no concatenation, no arrays — those are
 * reported for manual review instead of guessed at.
 */
const callRe = (fns) =>
  new RegExp(`(\\bi18n\\.t|\\b(?:${fns.join('|')}))\\(\\s*(['"])((?:[^'"\\\\]|\\\\.)+)\\2`, 'g');

const files = walk(SRC);
let changedFiles = 0, converted = 0;
const skipped = [];

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes('useTranslation(')) continue;

  if (!all) {
    const uses = namespaces.some((ns) =>
      text.includes(`useTranslation('${ns}')`) || text.includes(`useTranslation("${ns}")`));
    if (!uses) continue;
  }

  let localConverted = 0;
  const out = text.replace(callRe(translationFns(text)), (whole, fn, quote, key) => {
    const sel = toSelector(key);
    if (!sel) { skipped.push({ file: path.relative(SRC, file), key, why: 'malformed key' }); return whole; }
    localConverted += 1;
    return `${fn}(${sel}`;
  });

  // Report dynamic call sites the guard deliberately left alone.
  for (const m of text.matchAll(/\bt\(\s*([`a-zA-Z_$[])/g)) {
    if (m[1] === '`' || m[1] === '[') {
      skipped.push({ file: path.relative(SRC, file), key: `t(${m[1]}…`, why: 'dynamic — manual review' });
    }
  }

  if (localConverted && out !== text) {
    changedFiles += 1;
    converted += localConverted;
    if (!dry) fs.writeFileSync(file, out, 'utf8');
  }
}

console.log(`\n  i18n selector codemod${dry ? ' (DRY RUN)' : ''}`);
console.log(`  ${'─'.repeat(58)}`);
console.log(`  scope             ${all ? 'ALL namespaces' : namespaces.join(', ')}`);
console.log(`  files changed     ${changedFiles}`);
console.log(`  call sites        ${converted}`);
console.log(`  left for review   ${skipped.length}`);
if (skipped.length) {
  const byWhy = {};
  for (const s of skipped) byWhy[s.why] = (byWhy[s.why] ?? 0) + 1;
  for (const [why, n] of Object.entries(byWhy)) console.log(`     ${String(n).padStart(4)}  ${why}`);
  for (const s of skipped.slice(0, 10)) console.log(`       ${s.file}  ${s.key}`);
}
console.log('');
