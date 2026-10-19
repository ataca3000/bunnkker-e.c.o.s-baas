#!/usr/bin/env node
/**
 * ECOS Measurement Hygiene Library (TASK-PF-M2-001 · L2 Provenance / L3 Validation)
 *
 * Shared foundation for every ECOS benchmark, profiling session and engineering
 * experiment. Tool-agnostic: adapters (tsc, ESLint, PHPStan, …) supply metrics;
 * this module supplies provenance, environment capture and validation.
 *
 * Design rule that governs everything here — metrics live in tiers:
 *
 *   T1 deterministic      identical for identical input, independent of machine
 *                         state (instantiations, types, symbols, files, errors)
 *                         → may support causal claims on n=1
 *   T2 quasi-deterministic stable within a narrow band (peak memory, bytes)
 *   T3 non-deterministic   functions of load/GC/IO (every timing)
 *                         → NEVER supports a causal claim on its own
 *
 * The Coupling Rule: a T3 movement unaccompanied by a T1/T2 movement is
 * classified Environmental. Milestone 1 recorded checkSec -16.03% against
 * instantiations -0.05% from the same run pair; without this rule that run
 * would have been reported as a 16% win from a change that did nothing.
 */
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/* ── metric tiers ────────────────────────────────────────────────────────── */
export const TIER = {
  T1: ['files', 'types', 'instantiations', 'symbols', 'identifiers', 'errors'],
  T2: ['memoryKB'],
  T3: [
    'wallSec', 'totalSec', 'checkSec', 'programSec', 'parseSec',
    'bindSec', 'ioReadSec', 'resolveModuleSec', 'emitSec',
  ],
};

export const tierOf = (metric) =>
  Object.keys(TIER).find((t) => TIER[t].includes(metric)) ?? 'untiered';

/* ── git state ───────────────────────────────────────────────────────────── */
/**
 * Recorded as context, NOT as the comparability key.
 *
 * Milestone 1's two runs shared an identical HEAD, branch and 2,790-file index
 * while compiling codebases that differed by 13 files. Any provenance model
 * keyed on commit identity would have certified that comparison as sound.
 * The comparability key is the input fingerprint below.
 */
export function captureGit(repoRoot) {
  const git = (...args) => {
    try {
      return execFileSync('git', ['-C', repoRoot, ...args], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    } catch {
      return null;
    }
  };
  const porcelain = git('status', '--porcelain') ?? '';
  const lines = porcelain ? porcelain.split('\n') : [];
  return {
    head: git('rev-parse', 'HEAD'),
    branch: git('rev-parse', '--abbrev-ref', 'HEAD'),
    stagedCount: lines.filter((l) => /^[MADRC]/.test(l)).length,
    dirtyTracked: lines.filter((l) => /^.[MD]/.test(l)).length,
    untracked: lines.filter((l) => l.startsWith('??')).length,
  };
}

/* ── input fingerprint — the comparability key ───────────────────────────── */
/**
 * Fingerprints the program's REAL input set, sourced from the compiler itself
 * rather than inferred from `include` globs. Content-hashed, so mtime churn and
 * touched-but-unchanged files do not invalidate a baseline, while a single
 * changed byte in any compiled file does.
 *
 * Cost measured at ~5s against a ~31min type-check (≈0.3% overhead).
 */
export function computeFingerprint({ tsc, configs, cwd }) {
  const files = new Set();

  for (const config of configs) {
    let out;
    try {
      out = execFileSync(process.execPath, [tsc, '-p', config, '--listFilesOnly'], {
        cwd,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch (e) {
      // --listFilesOnly still lists files when the project has diagnostics.
      out = e.stdout ?? '';
    }
    for (const line of out.split('\n')) {
      const p = line.trim();
      if (p) files.add(p);
    }
  }

  const sorted = [...files].sort();
  const agg = crypto.createHash('sha256');
  let hashed = 0;
  let missing = 0;

  for (const file of sorted) {
    let content;
    try {
      content = fs.readFileSync(file);
      hashed += 1;
    } catch {
      missing += 1;
      continue;
    }
    agg.update(file);
    agg.update(crypto.createHash('sha256').update(content).digest());
  }

  return {
    fingerprint: agg.digest('hex').slice(0, 16),
    inputFileCount: sorted.length,
    hashedFiles: hashed,
    missingFiles: missing,
  };
}

/* ── environment snapshot ────────────────────────────────────────────────── */
const COMPETING = /^(node|vite|esbuild|php|phpunit|eslint)/i;

export function captureEnvironment(cwd) {
  const cpus = os.cpus();
  const pkg = (name) => {
    try {
      return JSON.parse(
        fs.readFileSync(path.join(cwd, 'node_modules', name, 'package.json'), 'utf8'),
      ).version;
    } catch {
      return null;
    }
  };

  return {
    machine: {
      host: os.hostname(),
      platform: `${os.platform()} ${os.release()}`,
      cpuModel: cpus[0]?.model ?? null,
      cores: cpus.length,
      totalMemGB: Number((os.totalmem() / 1024 ** 3).toFixed(2)),
      freeMemGB: Number((os.freemem() / 1024 ** 3).toFixed(2)),
      loadAvg1: Number(os.loadavg()[0].toFixed(2)),
    },
    runtime: {
      node: process.version,
      nodeOptions: process.env.NODE_OPTIONS?.trim() || null,
    },
    // Library type-machinery is a first-order cost driver, so a dependency bump
    // that silently changes check cost must be attributable after the fact.
    toolchain: {
      typescript: pkg('typescript'),
      i18next: pkg('i18next'),
      reactI18next: pkg('react-i18next'),
      react: pkg('react'),
      tanstackQuery: pkg('@tanstack/react-query'),
      zod: pkg('zod'),
      vite: pkg('vite'),
    },
  };
}

/** Non-blocking locally, blocking for adjudicated baselines — caller decides. */
export function checkQuiescence() {
  let competing = [];
  try {
    const raw = execFileSync(
      'powershell.exe',
      ['-NoProfile', '-Command',
       "Get-CimInstance Win32_Process | Select-Object Name,ProcessId,CommandLine | ConvertTo-Json -Compress"],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const procs = JSON.parse(raw);
    competing = procs
      .filter((p) => p.Name && COMPETING.test(p.Name))
      .filter((p) => p.ProcessId !== process.pid)
      // The measurement's own tsc child and this harness are not competition.
      .filter((p) => !/measure-typecheck|attribute-typecheck/.test(p.CommandLine ?? ''))
      .map((p) => ({ name: p.Name, pid: p.ProcessId }));
  } catch {
    return { checked: false, competing: [], pass: null };
  }
  return { checked: true, competing, pass: competing.length === 0 };
}

/* ── record IO ───────────────────────────────────────────────────────────── */
export function appendRecord(logPath, record) {
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.appendFileSync(logPath, `${JSON.stringify(record)}\n`, 'utf8');
}

export function readRecords(logPath) {
  if (!fs.existsSync(logPath)) return [];
  return fs
    .readFileSync(logPath, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

/* ── L3 validation / L4 adjudication ─────────────────────────────────────── */
/**
 * Comparability gate. Refuses comparison rather than silently producing a
 * misleading delta — the failure this framework exists to prevent.
 */
export function validateComparability(a, b) {
  const blocking = [];
  const warnings = [];

  if (a.provenance?.fingerprint !== b.provenance?.fingerprint) {
    blocking.push(
      `input fingerprint mismatch (${a.provenance?.fingerprint} → ${b.provenance?.fingerprint}): ` +
      'the two runs did not analyse the same code',
    );
  }
  if (a.mode !== b.mode) blocking.push(`mode mismatch (${a.mode} → ${b.mode})`);
  if (a.environment?.machine?.host !== b.environment?.machine?.host) {
    blocking.push('machine mismatch — T3 metrics are not portable across hosts');
  }
  for (const [k, v] of Object.entries(a.environment?.toolchain ?? {})) {
    const w = b.environment?.toolchain?.[k];
    if (v !== w) blocking.push(`toolchain drift: ${k} ${v} → ${w}`);
  }
  for (const r of [a, b]) {
    if (r.validity?.fingerprintStable === false) {
      blocking.push(`${r.label}: tree mutated mid-run (fingerprintPre ≠ fingerprintPost)`);
    }
    if (r.validity?.quiescence?.pass === false) {
      warnings.push(
        `${r.label}: quiescence violated — ${r.validity.quiescence.competing
          .map((c) => c.name).join(', ')}`,
      );
    }
  }
  return { comparable: blocking.length === 0, blocking, warnings };
}

/**
 * The Coupling Rule, mechanised. Returns a per-metric verdict plus an overall
 * classification of whether any observed T3 movement is attributable at all.
 */
export function adjudicate(before, after, { t1Threshold = 1.0 } = {}) {
  const delta = (k) => {
    const x = before.metrics?.[k], y = after.metrics?.[k];
    if (typeof x !== 'number' || typeof y !== 'number' || x === 0) return null;
    return ((y - x) / x) * 100;
  };

  const t1Moves = TIER.T1
    .map((k) => ({ metric: k, pct: delta(k) }))
    .filter((m) => m.pct !== null && Math.abs(m.pct) >= t1Threshold);
  const t3Moves = TIER.T3
    .map((k) => ({ metric: k, pct: delta(k) }))
    .filter((m) => m.pct !== null && Math.abs(m.pct) >= 5);

  const semanticWorkChanged = t1Moves.length > 0;

  return {
    semanticWorkChanged,
    t1Moves,
    t3Moves,
    verdict: semanticWorkChanged
      ? 'ATTRIBUTABLE — T1 movement present; T3 change may be causal'
      : t3Moves.length > 0
        ? 'ENVIRONMENTAL — T3 moved without T1; not attributable to the intervention'
        : 'NULL — no material movement in any tier',
  };
}
