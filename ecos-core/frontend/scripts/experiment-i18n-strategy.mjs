#!/usr/bin/env node
/**
 * ECOS i18n Type Strategy Experiment (EPIC-1 · Platform Foundation, final)
 *
 * Measurement only. Determines what Option A2 and Option A4 actually cost on
 * the REAL application, before committing to either.
 *
 * Attribution established that src/i18n/types.ts accounts for 99.21% of type
 * instantiations and 96.9% of check time. Two arms remain, and they are not
 * interchangeable:
 *
 *   A2  enableSelector: "optimize"   i18next's documented escape hatch for
 *                                    large translation sets. Scale-independent.
 *                                    Call sites unchanged in this arm — so the
 *                                    error count also reveals whether existing
 *                                    string-key call sites still type-check,
 *                                    and therefore whether key SAFETY survives
 *                                    without a 6,774-site migration.
 *
 *   A4  flat generated key union     `resources` typed as flat interfaces of
 *                                    dotted keys instead of `typeof <json>`.
 *                                    Removes the recursive KeysBuilder walk
 *                                    while keeping `t('key')` syntax. Cost
 *                                    scales linearly with key count.
 *
 * Reference points already measured on this host:
 *   current   175,605,474 instantiations / 1,617.09s   (M2-baseline-clean)
 *   floor       1,385,950 instantiations /    49.68s   (augmentation absent)
 *
 * Every arm restores src/i18n/types.ts in a finally block. The file is under
 * version control, so `git restore` is the ground truth if this process dies.
 *
 * Usage:  node scripts/experiment-i18n-strategy.mjs [--timeout 900]
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const TSC = path.join(ROOT, 'node_modules/typescript/bin/tsc');
const TYPES = path.join(ROOT, 'src/i18n/types.ts');
const LOCALES = path.join(ROOT, 'src/i18n/locales/en');
const GENERATED = path.join(ROOT, 'src/i18n/__generated-keys.d.ts');

const argv = process.argv.slice(2);
const timeoutSec = Number((argv[argv.indexOf('--timeout') + 1]) || 900);

const ORIGINAL = fs.readFileSync(TYPES, 'utf8');

/** Namespaces actually augmented today — the arms must cover the same set. */
const typedNamespaces = ORIGINAL
  .split('resources: {')[1].split('};')[0].split('\n')
  .map((l) => l.match(/^\s*'?([a-z0-9-]+)'?\s*:/))
  .filter(Boolean).map((m) => m[1]);

const flatKeys = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? flatKeys(v, `${prefix}${k}.`)
      : [`${prefix}${k}`]);

/* ── measurement ─────────────────────────────────────────────────────────── */
function measure(label) {
  const files = [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.tsx?$/.test(e.name)) files.push(path.relative(ROOT, p).split(path.sep).join('/'));
  });
  walk(path.join(ROOT, 'src'));

  const cfg = path.join(ROOT, 'tsconfig.probe-exp.json');
  fs.writeFileSync(cfg, JSON.stringify({
    extends: './tsconfig.app.json',
    compilerOptions: { composite: false, incremental: false, noEmit: true },
    include: [],
    files,
  }, null, 1), 'utf8');

  const t0 = Date.now();
  const r = spawnSync(process.execPath, [TSC, '-p', cfg, '--noEmit', '--extendedDiagnostics'], {
    cwd: ROOT, encoding: 'utf8', timeout: timeoutSec * 1000, maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=8192' },
  });
  const wallSec = (Date.now() - t0) / 1000;
  fs.rmSync(cfg, { force: true });

  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  const num = (re) => { const m = out.match(re); return m ? Number(m[1]) : null; };

  return {
    label,
    timedOut: r.error?.code === 'ETIMEDOUT' || r.signal === 'SIGTERM',
    wallSec: Number(wallSec.toFixed(2)),
    rootFiles: files.length,
    files: num(/^Files:\s+(\d+)/m),
    types: num(/^Types:\s+(\d+)/m),
    instantiations: num(/^Instantiations:\s+(\d+)/m),
    memoryKB: num(/^Memory used:\s+(\d+)K/m),
    checkSec: num(/^Check time:\s+([\d.]+)s/m),
    totalSec: num(/^Total time:\s+([\d.]+)s/m),
    errors: (out.match(/error TS\d+:/g) ?? []).length,
    // Distinguishing signal: are the errors ABOUT t() call sites? If key typing
    // silently degrades to `string`, existing errors vanish rather than grow.
    i18nKeyErrors: (out.match(/is not assignable to parameter of type '\[key:/g) ?? []).length,
  };
}

/* ── arms ────────────────────────────────────────────────────────────────── */
function armA2() {
  // NOTE: types.ts uses CRLF. An earlier version of this arm matched `\{\n`,
  // which never matched `{\r\n`, so the insertion silently no-opped and the
  // arm re-measured the unmodified baseline. Match the newline explicitly and
  // assert the edit landed — a silently inert arm produces a null result that
  // is indistinguishable from a real one.
  const patched = ORIGINAL.replace(
    /(interface CustomTypeOptions \{\r?\n)/,
    '$1    enableSelector: "optimize";\r\n');
  if (patched === ORIGINAL) {
    throw new Error('A2 arm: failed to insert enableSelector — aborting rather than measuring an inert arm');
  }
  fs.writeFileSync(TYPES, patched, 'utf8');
  return measure('A2 enableSelector:"optimize"');
}

function armA4() {
  const decls = [];
  const members = [];
  for (const ns of typedNamespaces) {
    const file = path.join(LOCALES, `${ns}.json`);
    if (!fs.existsSync(file)) continue;
    const keys = flatKeys(JSON.parse(fs.readFileSync(file, 'utf8')));
    const iface = `ECOS_${ns.replace(/-/g, '_')}`;
    decls.push(
      `interface ${iface} {\n${keys.map((k) => `  ${JSON.stringify(k)}: string;`).join('\n')}\n}`);
    members.push(`      ${JSON.stringify(ns)}: ${iface};`);
  }
  fs.writeFileSync(GENERATED,
    '// GENERATED — experiment arm A4. Not for commit.\n' +
    `${decls.join('\n')}\n\n` +
    "declare module 'i18next' {\n  interface CustomTypeOptions {\n" +
    "    defaultNS: 'common';\n    resources: {\n" +
    `${members.join('\n')}\n    };\n  }\n}\nexport {};\n`, 'utf8');

  // Replace the augmentation entirely; the generated .d.ts supplies it.
  fs.writeFileSync(TYPES,
    '// Experiment arm A4 — augmentation supplied by __generated-keys.d.ts\n' +
    "import './__generated-keys';\nexport {};\n", 'utf8');

  const totalKeys = decls.reduce((s, d) => s + (d.match(/: string;/g) ?? []).length, 0);
  const r = measure('A4 flat generated key union');
  r.generatedKeys = totalKeys;
  return r;
}

/* ── run ─────────────────────────────────────────────────────────────────── */
const results = [];
try {
  console.error(`  namespaces augmented: ${typedNamespaces.length}`);
  console.error('  running A2…');
  results.push(armA2());
  fs.writeFileSync(TYPES, ORIGINAL, 'utf8');

  console.error('  running A4…');
  results.push(armA4());
} finally {
  fs.writeFileSync(TYPES, ORIGINAL, 'utf8');
  fs.rmSync(GENERATED, { force: true });
  fs.rmSync(path.join(ROOT, 'tsconfig.probe-exp.json'), { force: true });
  try {
    const dirty = execFileSync('git', ['-C', path.resolve(ROOT, '..'), 'status', '--porcelain',
      'frontend/src/i18n/types.ts'], { encoding: 'utf8' }).trim();
    console.error(dirty
      ? `  WARNING: types.ts still differs from index:\n    ${dirty}`
      : '  types.ts restored (clean vs index)');
  } catch { /* git unavailable — file already rewritten from ORIGINAL */ }
}

const REF = {
  current: { instantiations: 175_605_474, checkSec: 1617.09, memoryKB: 6_947_596, errors: 1631 },
  floor: { instantiations: 1_385_950, checkSec: 49.68, memoryKB: 1_353_165 },
};

console.log(`\n  ECOS i18n type strategy — A2 vs A4 on the real application`);
console.log(`  ${'═'.repeat(78)}`);
console.log(`  ${'arm'.padEnd(30)}${'instantiations'.padStart(16)}${'checkSec'.padStart(11)}` +
            `${'memGB'.padStart(8)}${'errors'.padStart(8)}`);
console.log(`  ${'─'.repeat(78)}`);
const row = (l, i, c, m, e) =>
  console.log(`  ${l.padEnd(30)}${(i ?? 0).toLocaleString('en-US').padStart(16)}` +
    `${String(c ?? '—').padStart(11)}${String(m ? (m / 1024 / 1024).toFixed(2) : '—').padStart(8)}` +
    `${String(e ?? '—').padStart(8)}`);
row('current (augmentation on)', REF.current.instantiations, REF.current.checkSec, REF.current.memoryKB, REF.current.errors);
row('floor (augmentation absent)', REF.floor.instantiations, REF.floor.checkSec, REF.floor.memoryKB, '—');
for (const r of results) {
  row(r.timedOut ? `${r.label} [TIMEOUT]` : r.label, r.instantiations, r.checkSec, r.memoryKB, r.errors);
}
console.log(`  ${'─'.repeat(78)}`);
for (const r of results) {
  if (r.timedOut) { console.log(`  ${r.label}: exceeded ${timeoutSec}s — no improvement`); continue; }
  const vsCur = ((r.instantiations - REF.current.instantiations) / REF.current.instantiations) * 100;
  console.log(`  ${r.label}`);
  console.log(`     instantiations vs current  ${vsCur.toFixed(2)}%`);
  console.log(`     check time vs current      ${(((r.checkSec - REF.current.checkSec) / REF.current.checkSec) * 100).toFixed(2)}%`);
  console.log(`     diagnostics                ${r.errors} (baseline 1,631)`);
  console.log(`     i18n key-shaped errors     ${r.i18nKeyErrors}`);
  if (r.generatedKeys) console.log(`     generated keys             ${r.generatedKeys.toLocaleString('en-US')}`);
}
console.log('');
