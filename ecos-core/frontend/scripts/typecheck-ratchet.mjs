#!/usr/bin/env node
/**
 * ECOS TypeScript Diagnostic Ratchet (PROGRAM-E · Enterprise CI Foundation)
 *
 * The codebase carries 309 pre-existing TypeScript diagnostics. Gating CI on
 * `tsc -b` exiting 0 would be red from day one and switched off within a week —
 * the exact failure mode that left the i18n lint rules and certification.sh
 * permanently bypassed before "ratchet, never cliff" was adopted.
 *
 * So this ratchets instead: it counts diagnostics per error code and fails only
 * when a count gets WORSE than the recorded baseline. Debt can only shrink.
 *
 * Per-code rather than a single total, because a total hides a regression that
 * is offset by an improvement elsewhere — which is precisely how three
 * migration regressions survived a net-favourable count during EPIC-1.
 *
 * Usage:
 *   node scripts/typecheck-ratchet.mjs --check    # CI gate
 *   node scripts/typecheck-ratchet.mjs --accept   # record current as baseline
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const TSC = path.join(ROOT, 'node_modules/typescript/bin/tsc');
const BASELINE = path.resolve(ROOT, '../engineering/baselines/typescript-diagnostics.json');

const argv = process.argv.slice(2);
const accept = argv.includes('--accept');

const run = spawnSync(process.execPath, [TSC, '-b'], {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
  env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=8192' },
});
const out = `${run.stdout ?? ''}${run.stderr ?? ''}`;

const byCode = {};
for (const m of out.matchAll(/error (TS\d+):/g)) {
  byCode[m[1]] = (byCode[m[1]] ?? 0) + 1;
}
const total = Object.values(byCode).reduce((a, b) => a + b, 0);

if (accept) {
  fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
  fs.writeFileSync(BASELINE, `${JSON.stringify({ total, byCode }, null, 2)}\n`, 'utf8');
  console.log(`  baseline recorded: ${total} diagnostics`);
  for (const [c, n] of Object.entries(byCode).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(n).padStart(5)}  ${c}`);
  }
  process.exit(0);
}

if (!fs.existsSync(BASELINE)) {
  console.error('  no TypeScript baseline — run with --accept first.');
  process.exit(2);
}

const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
const regressions = [];
const improvements = [];

for (const code of new Set([...Object.keys(byCode), ...Object.keys(base.byCode)])) {
  const now = byCode[code] ?? 0;
  const was = base.byCode[code] ?? 0;
  if (now > was) regressions.push(`${code}: ${was} → ${now}`);
  else if (now < was) improvements.push(`${code}: ${was} → ${now}`);
}

console.log(`  TypeScript diagnostics: ${total} (baseline ${base.total})`);

if (regressions.length) {
  console.error(`\n  TYPESCRIPT REGRESSION\n  ${'─'.repeat(56)}`);
  for (const r of regressions) console.error(`    ${r}`);
  console.error(
    '\n  A new type error was introduced. Fix it — do not add a suppression\n' +
    '  or an `any`. If the increase is intentional and approved, re-record\n' +
    '  the baseline with --accept.\n');
  process.exit(1);
}

if (improvements.length) {
  console.log('  improved — re-record with --accept:');
  for (const i of improvements) console.log(`    ${i}`);
}
process.exit(0);
