#!/usr/bin/env node
/**
 * ECOS Instantiation Attribution Probe (EPIC-1 · Milestone 2)
 *
 * Answers "where do the ~175.6M instantiations originate?" by measuring the
 * MARGINAL instantiation cost of a subsystem, using the deterministic (T1)
 * instantiation counter.
 *
 * Method — differential measurement, not tracing:
 *   Build otherwise-identical programs that differ only in how many call sites
 *   of the subsystem under test they contain (K = 0, k1, k2 …). Because
 *   instantiations are deterministic, the slope (Δinstantiations / ΔK) is the
 *   per-call-site cost, and slope × (real call-site count) is that subsystem's
 *   attributable share. No hypothesis is tested; a number is produced.
 *
 * Chosen over `tsc --generateTrace` because types.json for 6.5M types would
 * risk exhausting the 5.7GB of free disk on this host, and because a slope
 * measured from a deterministic counter is stronger evidence than per-file
 * timings, which are T3.
 *
 * Probes are generated under frontend/.measurement-probes/ (gitignored) and
 * removed afterwards. No file under src/ is created, modified or deleted, so
 * the measurement baseline's input fingerprint is unaffected.
 *
 * Usage:
 *   node scripts/probe-instantiations.mjs --subject i18n --counts 0,25,100,200
 *   node scripts/probe-instantiations.mjs --subject react-query --counts 0,25,100
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const TSC = path.join(ROOT, 'node_modules/typescript/bin/tsc');
const PROBE_DIR = path.join(ROOT, '.measurement-probes');

const argv = process.argv.slice(2);
const value = (n, d) => {
  const i = argv.indexOf(n);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : d;
};
const subject = value('--subject', 'i18n');
const counts = value('--counts', '0,25,100,200').split(',').map(Number);
const keep = argv.includes('--keep');

/* ── real translation keys ───────────────────────────────────────────────── */
/**
 * Probes must use REAL keys. A bogus key still instantiates the union but adds
 * an error path, changing what is measured. Keys are drawn from the actual
 * locale files so the probe exercises the same resolution the app does.
 */
function realKeys(ns, n) {
  const file = path.join(ROOT, 'src/i18n/locales/en', `${ns}.json`);
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const flat = (o, p = '') =>
    Object.entries(o).flatMap(([k, v]) =>
      v && typeof v === 'object' && !Array.isArray(v)
        ? flat(v, `${p}${k}.`)
        : [`${p}${k}`]);
  const all = flat(json);
  if (!all.length) throw new Error(`no keys in namespace ${ns}`);
  return Array.from({ length: n }, (_, i) => all[i % all.length]);
}

/* ── subject definitions ─────────────────────────────────────────────────── */
const SUBJECTS = {
  /** i18next `t()` call sites — the ECOS app has 6,774. */
  i18n: {
    realCallSites: 6774,
    header:
      "import { useTranslation } from 'react-i18next';\n" +
      "import '../src/i18n/types';\n",
    body(k) {
      const keys = realKeys('orders', k);
      return keys
        .map((key, i) =>
          `export function P${i}() {\n` +
          `  const { t } = useTranslation('orders');\n` +
          `  return t('${key}');\n}\n`)
        .join('');
    },
  },

  /**
   * One call site in each of K DISTINCT namespaces. Isolates the per-namespace
   * fixed cost (ParseKeys union construction), which the `i18n` subject cannot
   * separate because it holds the namespace constant.
   */
  'i18n-namespaces': {
    realCallSites: null,
    header:
      "import { useTranslation } from 'react-i18next';\n" +
      "import '../src/i18n/types';\n",
    body(k) {
      // Only namespaces actually augmented in CustomTypeOptions carry a union;
      // the rest fall back to `string` and would measure nothing.
      const typed = fs.readFileSync(path.join(ROOT, 'src/i18n/types.ts'), 'utf8')
        .split('resources: {')[1]
        .split('};')[0]
        .split('\n')
        .map((l) => l.match(/^\s*'?([a-z-]+)'?\s*:/))
        .filter(Boolean)
        .map((m) => m[1]);
      return typed.slice(0, k).map((ns, i) => {
        const key = realKeys(ns, 1)[0];
        return `export function N${i}() {\n` +
               `  const { t } = useTranslation('${ns}');\n` +
               `  return t('${key}');\n}\n`;
      }).join('');
    },
  },

  /** TanStack Query generic inference at hook call sites. */
  'react-query': {
    realCallSites: null,
    header:
      "import { useQuery } from '@tanstack/react-query';\n",
    body(k) {
      return Array.from({ length: k }, (_, i) =>
        `export function Q${i}() {\n` +
        `  return useQuery({ queryKey: ['k${i}'], queryFn: async () => ({ a: ${i}, b: 's' }) });\n}\n`)
        .join('');
    },
  },

  /** Plain React component declarations — the control subject. */
  react: {
    realCallSites: null,
    header: "import { useState, useMemo } from 'react';\n",
    body(k) {
      return Array.from({ length: k }, (_, i) =>
        `export function R${i}() {\n` +
        `  const [v, setV] = useState({ n: ${i} });\n` +
        `  const m = useMemo(() => v.n + 1, [v]);\n` +
        `  return { m, setV };\n}\n`)
        .join('');
    },
  },
};

const def = SUBJECTS[subject];
if (!def) {
  console.error(`probe-instantiations: unknown subject '${subject}'. ` +
    `Known: ${Object.keys(SUBJECTS).join(', ')}`);
  process.exit(2);
}

/* ── measure ─────────────────────────────────────────────────────────────── */
function measure(k) {
  fs.mkdirSync(PROBE_DIR, { recursive: true });
  const probeFile = path.join(PROBE_DIR, `probe-${subject}-${k}.ts`);
  const configFile = path.join(ROOT, `tsconfig.probe-${subject}-${k}.json`);

  fs.writeFileSync(probeFile, def.header + def.body(k), 'utf8');
  fs.writeFileSync(configFile, JSON.stringify({
    extends: './tsconfig.app.json',
    // `include` MUST be cleared: tsconfig.app.json includes "src", which would
    // drag the whole application into every probe and destroy the measurement.
    compilerOptions: { composite: false, incremental: false, noEmit: true },
    include: [],
    files: [path.relative(ROOT, probeFile).split(path.sep).join('/')],
  }, null, 2), 'utf8');

  let out;
  try {
    out = execFileSync(process.execPath,
      [TSC, '-p', configFile, '--noEmit', '--extendedDiagnostics'],
      { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  } catch (e) {
    out = `${e.stdout ?? ''}${e.stderr ?? ''}`;
  }

  const num = (re) => {
    const m = out.match(re);
    return m ? Number(m[1]) : null;
  };
  const result = {
    k,
    instantiations: num(/^Instantiations:\s+(\d+)/m),
    types: num(/^Types:\s+(\d+)/m),
    files: num(/^Files:\s+(\d+)/m),
    checkSec: num(/^Check time:\s+([\d.]+)s/m),
    errors: (out.match(/error TS\d+:/g) ?? []).length,
  };

  if (!keep) {
    fs.rmSync(probeFile, { force: true });
    fs.rmSync(configFile, { force: true });
  }
  return result;
}

const rows = [];
for (const k of counts) {
  process.stderr.write(`  measuring ${subject} k=${k}… `);
  const r = measure(k);
  process.stderr.write(`${r.instantiations?.toLocaleString('en-US') ?? 'n/a'} instantiations\n`);
  rows.push(r);
}

if (!keep) fs.rmSync(PROBE_DIR, { recursive: true, force: true });

/* ── slope & extrapolation ───────────────────────────────────────────────── */
/**
 * Cost has two components and they must not be conflated:
 *
 *   FIXED     one-time work triggered by the first use — e.g. materialising a
 *             ParseKeys union for a namespace. Paid once per scope, not per site.
 *   MARGINAL  incremental cost of one additional call site, measured from the
 *             two largest k values so the fixed component is already amortised.
 *
 * Taking the naive (last-first)/(Δk) slope through k=0 spreads the fixed cost
 * across the probe's call sites and inflates the per-site figure by orders of
 * magnitude — for i18n it reported 6,882/site against a true marginal of ~193.
 */
const base = rows[0];
const last = rows[rows.length - 1];
const prev = rows.length >= 2 ? rows[rows.length - 2] : null;

const marginal =
  prev && last.k !== prev.k && last.instantiations != null && prev.instantiations != null
    ? (last.instantiations - prev.instantiations) / (last.k - prev.k)
    : null;

const fixed =
  marginal != null && rows[1]?.instantiations != null
    ? Math.max(0, rows[1].instantiations - (base.instantiations ?? 0) - marginal * (rows[1].k - base.k))
    : null;

console.log(`\n  ECOS instantiation attribution — subject: ${subject}`);
console.log(`  ${'═'.repeat(70)}`);
console.log(`  ${'k'.padStart(6)} ${'files'.padStart(7)} ${'instantiations'.padStart(16)} ` +
            `${'types'.padStart(12)} ${'errors'.padStart(7)} ${'checkSec'.padStart(9)}`);
for (const r of rows) {
  console.log(`  ${String(r.k).padStart(6)} ${String(r.files ?? '—').padStart(7)} ` +
    `${(r.instantiations ?? 0).toLocaleString('en-US').padStart(16)} ` +
    `${(r.types ?? 0).toLocaleString('en-US').padStart(12)} ` +
    `${String(r.errors).padStart(7)} ${String(r.checkSec ?? '—').padStart(9)}`);
}
console.log(`  ${'─'.repeat(70)}`);
if (marginal != null) {
  console.log(`  fixed cost         ${Math.round(fixed ?? 0).toLocaleString('en-US')} instantiations (one-time, per scope)`);
  console.log(`  marginal cost      ${Math.round(marginal).toLocaleString('en-US')} instantiations / call site`);
  if (def.realCallSites) {
    const projected = (fixed ?? 0) + marginal * def.realCallSites;
    console.log(`  real call sites    ${def.realCallSites.toLocaleString('en-US')}`);
    console.log(`  projected total    ${Math.round(projected).toLocaleString('en-US')} instantiations`);
    console.log(`  vs app baseline    ${(projected / 175_605_474 * 100).toFixed(2)}% of 175,605,474`);
    console.log('  NOTE: fixed cost is per scope. Multiply by the number of distinct');
    console.log('        namespace scopes in the real app to project total fixed cost.');
  }
}
console.log('');
