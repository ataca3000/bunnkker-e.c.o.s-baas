#!/usr/bin/env node
/**
 * ECOS Type-Check Measurement Harness (TASK-PLATFORM-FOUNDATION-002 · Phase 1,
 * upgraded to the Measurement Hygiene architecture in TASK-PF-M2-001)
 *
 * Single source of truth for TypeScript build-cost measurement. Every Platform
 * Foundation decision is judged against the records this harness produces.
 *
 * The decisive metric is `instantiations` (T1, deterministic). Timings are T3
 * and cannot carry a causal claim on their own — see lib/measurement.mjs.
 *
 * Usage:
 *   node scripts/measure-typecheck.mjs --label baseline
 *   node scripts/measure-typecheck.mjs --label post-x --warm
 *   node scripts/measure-typecheck.mjs --label y --require-quiet
 *
 * Flags:
 *   --label <name>    Record label (required).
 *   --warm            Allow incremental reuse. Default is cold (--force);
 *                     only same-mode runs are comparable.
 *   --require-quiet   Abort if competing processes are detected. Use for any
 *                     baseline or adjudicated experiment.
 *   --no-fingerprint  Skip provenance fingerprinting (diagnostic use only —
 *                     produces a record that cannot be compared).
 *   --json            Emit the record as JSON instead of a summary.
 *   --no-record       Print only; do not append to the measurement log.
 *
 * Exit code mirrors tsc: 0 clean, non-zero when diagnostics are present.
 * A failing type-check is a valid measurement.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';

import {
  appendRecord, captureEnvironment, captureGit, checkQuiescence,
  computeFingerprint, tierOf, TIER,
} from './lib/measurement.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const REPO = path.resolve(ROOT, '..');
const LOG = path.join(REPO, 'engineering/baselines/typecheck.jsonl');
// Spawn the compiler entry point with the current Node binary rather than the
// .bin shim. The shim is a shell script on Windows, which would force
// `shell: true` — that concatenates rather than escapes argv (DEP0190).
const TSC = path.join(ROOT, 'node_modules/typescript/bin/tsc');
const CONFIGS = ['tsconfig.app.json', 'tsconfig.node.json'];

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const value = (n, d) => {
  const i = argv.indexOf(n);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : d;
};

const label = value('--label', null);
const warm = flag('--warm');
const asJson = flag('--json');
const record = !flag('--no-record');
const fingerprinting = !flag('--no-fingerprint');
const requireQuiet = flag('--require-quiet');

if (!label) {
  console.error('measure-typecheck: --label <name> is required.');
  process.exit(2);
}

/* ── diagnostic parsing ──────────────────────────────────────────────────── */
const COUNTERS = {
  files: /^Files:\s+(\d+)/m,
  linesOfLibrary: /^Lines of Library:\s+(\d+)/m,
  linesOfDefinitions: /^Lines of Definitions:\s+(\d+)/m,
  linesOfTypeScript: /^Lines of TypeScript:\s+(\d+)/m,
  identifiers: /^Identifiers:\s+(\d+)/m,
  symbols: /^Symbols:\s+(\d+)/m,
  types: /^Types:\s+(\d+)/m,
  instantiations: /^Instantiations:\s+(\d+)/m,
  memoryKB: /^Memory used:\s+(\d+)K/m,
};
const TIMINGS = {
  ioReadSec: /^I\/O Read time:\s+([\d.]+)s/m,
  parseSec: /^Parse time:\s+([\d.]+)s/m,
  resolveModuleSec: /^ResolveModule time:\s+([\d.]+)s/m,
  programSec: /^Program time:\s+([\d.]+)s/m,
  bindSec: /^Bind time:\s+([\d.]+)s/m,
  checkSec: /^Check time:\s+([\d.]+)s/m,
  emitSec: /^Emit time:\s+([\d.]+)s/m,
  totalSec: /^Total time:\s+([\d.]+)s/m,
};
const extract = (text, table) =>
  Object.fromEntries(
    Object.entries(table).map(([k, re]) => {
      const m = text.match(re);
      return [k, m ? Number(m[1]) : null];
    }),
  );

/* ── pre-flight ──────────────────────────────────────────────────────────── */
const quiescence = checkQuiescence();
if (requireQuiet && quiescence.pass === false) {
  console.error(
    'measure-typecheck: quiescence gate FAILED — competing processes:\n' +
    quiescence.competing.map((c) => `  ${c.name} (pid ${c.pid})`).join('\n') +
    '\nStop them or drop --require-quiet (the run will be marked non-quiescent).',
  );
  process.exit(3);
}

const git = captureGit(REPO);
const environment = captureEnvironment(ROOT);

process.stderr.write(fingerprinting ? 'fingerprinting input set… ' : '');
const fpPre = fingerprinting
  ? computeFingerprint({ tsc: TSC, configs: CONFIGS, cwd: ROOT })
  : null;
process.stderr.write(fingerprinting ? `${fpPre.fingerprint} (${fpPre.inputFileCount} files)\n` : '');

/* ── run ─────────────────────────────────────────────────────────────────── */
const args = ['-b', ...(warm ? [] : ['--force']), '--extendedDiagnostics'];
const env = {
  ...process.env,
  NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --max-old-space-size=8192`.trim(),
};

const startedAt = new Date();
const t0 = process.hrtime.bigint();
const child = spawn(process.execPath, [TSC, ...args], { cwd: ROOT, env });

let out = '';
child.stdout.on('data', (d) => (out += d));
child.stderr.on('data', (d) => (out += d));

child.on('close', (code) => {
  const wallSec = Number((Number(process.hrtime.bigint() - t0) / 1e9).toFixed(2));

  // Re-fingerprint: a mismatch means the tree mutated mid-run. This is the
  // exact confound that invalidated the Milestone 1 comparison, where a new
  // feature module was authored across both measurement windows.
  const fpPost = fingerprinting
    ? computeFingerprint({ tsc: TSC, configs: CONFIGS, cwd: ROOT })
    : null;

  const metrics = { ...extract(out, COUNTERS), ...extract(out, TIMINGS), wallSec };
  metrics.errors = (out.match(/error TS\d+:/g) ?? []).length;

  const result = {
    label,
    startedAt: startedAt.toISOString(),
    mode: warm ? 'warm' : 'cold',
    command: `tsc ${args.join(' ')}`,
    exitCode: code,
    provenance: {
      fingerprint: fpPre?.fingerprint ?? null,
      fingerprintPost: fpPost?.fingerprint ?? null,
      inputFileCount: fpPre?.inputFileCount ?? null,
      git,
    },
    environment,
    metrics,
    validity: {
      quiescence,
      fingerprintStable: fingerprinting ? fpPre.fingerprint === fpPost.fingerprint : null,
    },
  };

  result.metrics.checkSharePct =
    metrics.checkSec && metrics.totalSec
      ? Number(((metrics.checkSec / metrics.totalSec) * 100).toFixed(1))
      : null;

  if (record) appendRecord(LOG, result);

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const n = (v) => (v == null ? '—' : v.toLocaleString('en-US'));
    const row = (k) => `  ${k.padEnd(18)}${String(n(metrics[k])).padStart(16)}   ${tierOf(k)}`;
    console.log(`
  ECOS type-check measurement — ${label} (${result.mode})
  ${'─'.repeat(56)}
  fingerprint        ${result.provenance.fingerprint ?? 'not computed'}
  input files        ${n(result.provenance.inputFileCount)}
  stable during run  ${result.validity.fingerprintStable === null ? 'n/a'
      : result.validity.fingerprintStable ? 'yes' : 'NO — CONFOUNDED'}
  quiescent          ${quiescence.pass === null ? 'unknown'
      : quiescence.pass ? 'yes' : `NO (${quiescence.competing.length} competing)`}
  ${'─'.repeat(56)}
${TIER.T1.map(row).join('\n')}
${TIER.T2.map(row).join('\n')}
${TIER.T3.map(row).join('\n')}
  ${'─'.repeat(56)}
  exit code          ${code}${record ? `\n  recorded → ${path.relative(REPO, LOG)}` : ''}`);
  }

  process.exit(code ?? 0);
});
