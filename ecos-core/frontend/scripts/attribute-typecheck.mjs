#!/usr/bin/env node
/**
 * ECOS Type-Check Attribution (EPIC-1 · Milestone 2)
 *
 * Answers one question with evidence and nothing else:
 *   "Where do the remaining ~175M type instantiations actually originate?"
 *
 * Pure measurement. Modifies no source, tests no hypothesis, proposes no fix.
 *
 * Instruments, in order of evidential strength:
 *
 *   types.json  → every type the checker created, with the source position of
 *                 its first declaration. Counting types by originating file is
 *                 DETERMINISTIC (T1): identical input yields identical counts
 *                 regardless of machine state. This is the primary evidence.
 *
 *   trace.json  → `checkSourceFile` spans give per-file check duration. Absolute
 *                 durations are T3 and not portable, but RELATIVE shares within
 *                 a single run are robust, since load affects all files in that
 *                 run alike. Used as corroboration, never alone.
 *
 * Both files are produced by `tsc --generateTrace <dir>` and are large
 * (hundreds of MB), so both are parsed as a line stream rather than JSON.parse.
 *
 * Usage:
 *   node scripts/attribute-typecheck.mjs --trace-dir <dir> [--top 25] [--json]
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const argv = process.argv.slice(2);
const value = (n, d) => {
  const i = argv.indexOf(n);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : d;
};
const traceDir = value('--trace-dir', null);
const top = Number(value('--top', 25));
const asJson = argv.includes('--json');

if (!traceDir) {
  console.error('attribute-typecheck: --trace-dir <dir> is required.');
  process.exit(2);
}

/* ── subsystem mapping ───────────────────────────────────────────────────── */
/**
 * Buckets are deliberately coarse at the top (app vs library) and fine within
 * the app, because the open question is which SUBSYSTEM dominates — not which
 * individual file.
 */
function subsystemOf(file) {
  const p = file.replace(/\\/g, '/');

  const nm = p.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/);
  if (nm) {
    const pkg = nm[1];
    if (pkg === 'typescript') return 'lib:typescript(lib.d.ts)';
    return `lib:${pkg}`;
  }

  const src = p.match(/\/src\/(.+)$/);
  if (!src) return 'other';
  const rel = src[1];

  if (rel.startsWith('i18n/locales/')) return 'app:i18n-locales';
  if (rel.startsWith('i18n/')) return 'app:i18n';
  if (rel.startsWith('components/')) return `app:components/${rel.split('/')[1] ?? ''}`;
  if (rel.startsWith('features/')) return `app:features/${rel.split('/')[1] ?? ''}`;
  const seg = rel.split('/')[0];
  return `app:${seg}`;
}

const add = (map, key, n = 1) => map.set(key, (map.get(key) ?? 0) + n);

/**
 * Streams a `tsc --generateTrace` artifact. Both files are emitted as a JSON
 * array with one record per line; parsing per line keeps memory flat where
 * JSON.parse of a multi-hundred-MB file would not.
 */
async function streamRecords(file, onRecord) {
  if (!fs.existsSync(file)) return 0;
  const rl = readline.createInterface({
    input: fs.createReadStream(file, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  let count = 0;
  for await (const raw of rl) {
    const line = raw.trim().replace(/,$/, '');
    if (!line || line === '[' || line === ']') continue;
    let rec;
    try {
      rec = JSON.parse(line);
    } catch {
      continue; // partial trailing line on an interrupted run
    }
    onRecord(rec);
    count += 1;
  }
  return count;
}

/* ── primary evidence: type origins (T1, deterministic) ──────────────────── */
const typesByFile = new Map();
const typesBySubsystem = new Map();
let totalTypes = 0;
let typesWithoutOrigin = 0;

const typesPath = path.join(traceDir, 'types.json');
await streamRecords(typesPath, (t) => {
  totalTypes += 1;
  const decl = t.firstDeclaration ?? t.symbolDeclaration ?? null;
  const file = decl?.path ?? null;
  if (!file) {
    typesWithoutOrigin += 1;
    return;
  }
  add(typesByFile, file);
  add(typesBySubsystem, subsystemOf(file));
});

/* ── corroboration: per-file check duration (T3, relative use only) ──────── */
const checkMsByFile = new Map();
const checkMsBySubsystem = new Map();
let totalCheckMs = 0;
const openSpans = new Map();

const tracePath = path.join(traceDir, 'trace.json');
await streamRecords(tracePath, (e) => {
  if (e.name !== 'checkSourceFile') return;
  const file = e.args?.path ?? e.args?.fileName;
  if (!file) return;

  if (e.ph === 'X' && typeof e.dur === 'number') {
    const ms = e.dur / 1000;
    add(checkMsByFile, file, ms);
    add(checkMsBySubsystem, subsystemOf(file), ms);
    totalCheckMs += ms;
  } else if (e.ph === 'B') {
    openSpans.set(file, e.ts);
  } else if (e.ph === 'E') {
    const start = openSpans.get(file);
    if (start != null) {
      const ms = (e.ts - start) / 1000;
      add(checkMsByFile, file, ms);
      add(checkMsBySubsystem, subsystemOf(file), ms);
      totalCheckMs += ms;
      openSpans.delete(file);
    }
  }
});

/* ── report ──────────────────────────────────────────────────────────────── */
const rank = (map, total) =>
  [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([key, v]) => ({ key, value: Math.round(v), pct: total ? (v / total) * 100 : 0 }));

const bySubsystem = rank(typesBySubsystem, totalTypes);
const byFile = rank(typesByFile, totalTypes);
const checkSubsystem = rank(checkMsBySubsystem, totalCheckMs);
const checkFile = rank(checkMsByFile, totalCheckMs);

const payload = {
  totals: { totalTypes, typesWithoutOrigin, totalCheckMs: Math.round(totalCheckMs) },
  typesBySubsystem: bySubsystem,
  typesByFile: byFile.slice(0, top),
  checkTimeBySubsystem: checkSubsystem,
  checkTimeByFile: checkFile.slice(0, top),
};

if (asJson) {
  console.log(JSON.stringify(payload, null, 2));
} else {
  const table = (title, rows, unit, limit) => {
    console.log(`\n  ${title}`);
    console.log(`  ${'─'.repeat(74)}`);
    for (const r of rows.slice(0, limit)) {
      console.log(
        `  ${String(r.value).padStart(10)} ${unit.padEnd(4)} ${r.pct.toFixed(1).padStart(5)}%  ${r.key}`,
      );
    }
  };
  console.log(`
  ECOS type-check attribution
  ${'═'.repeat(74)}
  types recorded          ${totalTypes.toLocaleString('en-US')}
  without origin          ${typesWithoutOrigin.toLocaleString('en-US')}
  check spans total       ${Math.round(totalCheckMs).toLocaleString('en-US')} ms`);

  table('TYPE ORIGINS BY SUBSYSTEM  (T1 — deterministic, primary evidence)', bySubsystem, 'types', top);
  table('TYPE ORIGINS BY FILE', byFile, 'types', top);
  table('CHECK TIME BY SUBSYSTEM  (T3 — relative shares only)', checkSubsystem, 'ms', top);
  table('CHECK TIME BY FILE  (T3 — relative shares only)', checkFile, 'ms', top);
  console.log('');
}
