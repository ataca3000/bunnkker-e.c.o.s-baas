#!/usr/bin/env node
/**
 * ECOS Engineering Guardian — ratchet engine.
 *
 * One place that answers a single question for every quality gate:
 *
 *     "Is this worse than the certified baseline?"
 *
 * The project's engineering policy is *ratchet, never cliff*: a gate blocks NEW
 * debt and never fails on the approved baseline. Three earlier gates were
 * abandoned for ignoring that, and a fourth (pre-push Pint + TypeScript) was
 * blocking every push on 628 legacy files and 24 historical diagnostics that the
 * commits being pushed neither introduced nor touched — see
 * docs/verification/TASK-GUARDIAN-PREPUSH-RCA-001.md.
 *
 * Baselines live in engineering/baselines/ and may only ever shrink. Regenerating
 * one upward is how a ratchet silently becomes a rubber stamp, so `record` refuses
 * to do it unless --allow-growth is passed explicitly.
 *
 * Subcommands:
 *   compare-pint    <baseline.json> <current.json> [changed-files-list]
 *   compare-tsc     <baseline.json> <current.json> [changed-files-list]
 *   compare-count   <baseline.json> <current-count> <label>
 *   record-pint     <baseline.json> <current.json> [--allow-growth]
 *   record-tsc      <baseline.json> <current.json> [--allow-growth]
 *   record-count    <baseline.json> <current-count> <label> [--allow-growth]
 *
 * Exit codes: 0 = at or below baseline, 1 = regression (block), 2 = usage error.
 */

'use strict';

const fs = require('fs');

const EXIT_OK = 0;
const EXIT_REGRESSION = 1;
const EXIT_USAGE = 2;

function readJson(path, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(path, value) {
  fs.writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

/** Newline-delimited path list → Set. Absent file means "scope unknown". */
function readList(path) {
  if (!path) return null;
  try {
    return new Set(
      fs.readFileSync(path, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean),
    );
  } catch {
    return null;
  }
}

/* ── Pint ─────────────────────────────────────────────────────────────────── */

/**
 * Read a Pint --test report file → { path: [fixers] }, paths forward-slashed.
 *
 * The file may hold SEVERAL concatenated JSON objects: 04-pint.sh batches its
 * invocations to stay inside the OS argument-length limit, and each batch emits
 * its own report. Every object is parsed and the results are merged, so a file
 * flagged in any batch is present exactly once.
 */
function pintMap(raw) {
  const out = {};
  const text = String(raw);

  // Scan for balanced top-level {...} blocks. Simpler than a full parser and
  // sufficient: Pint emits one flat object per invocation.
  let depth = 0;
  let start = -1;
  const blocks = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === '{') { if (depth === 0) start = i; depth++; }
    else if (ch === '}') {
      depth--;
      if (depth === 0 && start >= 0) { blocks.push(text.slice(start, i + 1)); start = -1; }
    }
  }

  for (const block of blocks) {
    let parsed;
    try { parsed = JSON.parse(block); } catch { continue; }
    for (const f of parsed.files || []) {
      out[`backend/${String(f.path).split('\\').join('/')}`] = [...(f.fixers || [])].sort();
    }
  }

  return out;
}

function comparePint(baselinePath, currentPath, changedPath) {
  const baseline = readJson(baselinePath, { files: {} }).files || {};
  const current = pintMap(fs.readFileSync(currentPath, 'utf8'));
  const changed = readList(changedPath);

  const newlyDirty = [];   // not in the baseline at all → a brand-new violation
  const regressed = [];    // in the baseline but carrying a fixer it did not have

  for (const [file, fixers] of Object.entries(current)) {
    const before = baseline[file];

    if (before === undefined) {
      newlyDirty.push({ file, fixers });
      continue;
    }

    const added = fixers.filter((fx) => !before.includes(fx));
    if (added.length > 0) regressed.push({ file, added });
  }

  // Improvements are reported, never punished.
  //
  // When the scan was scoped to a push range, `current` only covers the files
  // that were actually scanned — every other baseline file is simply absent, not
  // fixed. Counting those as "fixed" would be a lie that grows with scope, so
  // improvements are only counted among files we genuinely looked at.
  const scanned = changed ?? new Set(Object.keys(baseline));
  const cleaned = Object.keys(baseline)
    .filter((f) => scanned.has(f) && !(f in current));

  const blocking = [...newlyDirty, ...regressed];

  console.log(`baseline files      : ${Object.keys(baseline).length}`);
  console.log(`violating in scope  : ${Object.keys(current).length}`);
  console.log(`fixed since baseline: ${cleaned.length}`);

  if (blocking.length === 0) {
    console.log('\nNo new Pint violations. Legacy baseline files are allowed and unchanged.');
    if (cleaned.length > 0) {
      console.log(`${cleaned.length} baseline file(s) are now clean — run the record command to shrink the baseline.`);
    }
    return EXIT_OK;
  }

  console.log('');
  if (newlyDirty.length > 0) {
    console.log(`NEW Pint violations in ${newlyDirty.length} file(s) not in the baseline:`);
    for (const { file, fixers } of newlyDirty) {
      const inPush = changed && changed.has(file) ? '  [changed in this push]' : '';
      console.log(`  ${file}${inPush}`);
      console.log(`      fixers: ${fixers.join(', ')}`);
    }
  }
  if (regressed.length > 0) {
    console.log(`\nREGRESSED — baseline file(s) gained a violation they did not have:`);
    for (const { file, added } of regressed) {
      const inPush = changed && changed.has(file) ? '  [changed in this push]' : '';
      console.log(`  ${file}${inPush}`);
      console.log(`      new fixers: ${added.join(', ')}`);
    }
  }
  console.log('\nFix with:  cd backend && php vendor/bin/pint <file>');
  return EXIT_REGRESSION;
}

/* ── TypeScript ───────────────────────────────────────────────────────────── */

/**
 * tsc output → { total, byFile: {path: count}, byCode: {code: count} }.
 * Matches the standard diagnostic form:  path(line,col): error TSxxxx: message
 */
function tscMap(text) {
  const byFile = {};
  const byCode = {};
  let total = 0;

  for (const line of String(text).split('\n')) {
    const m = line.match(/^(.*?)\((\d+),(\d+)\):\s+error\s+(TS\d+):/);
    if (!m) continue;
    const file = m[1].trim().split('\\').join('/');
    byFile[file] = (byFile[file] || 0) + 1;
    byCode[m[4]] = (byCode[m[4]] || 0) + 1;
    total += 1;
  }

  return { total, byFile, byCode };
}

function compareTsc(baselinePath, currentPath, changedPath) {
  const baseline = readJson(baselinePath, { total: 0, byFile: {} });
  const current = tscMap(fs.readFileSync(currentPath, 'utf8'));
  const changed = readList(changedPath);

  const baseTotal = Number(baseline.total || 0);
  const baseByFile = baseline.byFile || {};

  console.log(`baseline errors : ${baseTotal}`);
  console.log(`current errors  : ${current.total}`);

  const failures = [];

  // Rule 1 — the total may never grow.
  if (current.total > baseTotal) {
    failures.push(`total error count rose ${baseTotal} → ${current.total} (+${current.total - baseTotal})`);
  }

  // Rule 2 — a file may never gain errors, even if the total falls elsewhere.
  // Without this a new error can hide behind an unrelated fix at equal count.
  const worsened = [];
  for (const [file, count] of Object.entries(current.byFile)) {
    const before = Number(baseByFile[file] || 0);
    if (count > before) worsened.push({ file, before, count });
  }

  // Every worsened file blocks. Being in the push is reported, not required —
  // a changed file that breaks a different file must still be caught.
  if (worsened.length > 0) {
    failures.push(`${worsened.length} file(s) gained TypeScript errors`);
  }

  const improved = Object.entries(baseByFile)
    .filter(([f, n]) => Number(n) > Number(current.byFile[f] || 0)).length;
  if (improved > 0) console.log(`files improved  : ${improved}`);

  if (failures.length === 0) {
    console.log('\nAt or below the certified TypeScript baseline.');
    if (current.total < baseTotal) {
      console.log(`Baseline can shrink ${baseTotal} → ${current.total} — run the record command.`);
    }
    return EXIT_OK;
  }

  console.log('');
  for (const f of failures) console.log(`REGRESSION: ${f}`);

  if (worsened.length > 0) {
    console.log('\nFiles that gained errors:');
    for (const { file, before, count } of worsened) {
      const inPush = changed && changed.has(`frontend/${file}`) ? '  [changed in this push]' : '';
      console.log(`  ${file}: ${before} → ${count}${inPush}`);
    }
  }
  return EXIT_REGRESSION;
}

/* ── Simple counted baselines (ESLint suppressions) ───────────────────────── */

function compareCount(baselinePath, currentRaw, label) {
  const baseline = readJson(baselinePath, { total: 0 });
  const baseTotal = Number(baseline.total || 0);
  const current = Number(currentRaw);

  if (!Number.isFinite(current)) {
    console.log(`could not read a current ${label} count`);
    return EXIT_USAGE;
  }

  console.log(`baseline ${label} : ${baseTotal}`);
  console.log(`current  ${label} : ${current}`);

  if (current > baseTotal) {
    console.log(`\nREGRESSION: ${label} rose ${baseTotal} → ${current} (+${current - baseTotal}).`);
    console.log('New suppressions require approval. Fix the violation, or have the baseline raised deliberately.');
    return EXIT_REGRESSION;
  }

  if (current < baseTotal) {
    console.log(`\n${baseTotal - current} suppression(s) no longer needed — the baseline can shrink.`);
  } else {
    console.log('\nAt the certified baseline.');
  }
  return EXIT_OK;
}

/* ── Recording ────────────────────────────────────────────────────────────── */

function guardGrowth(before, after, allowGrowth, label) {
  if (after > before && !allowGrowth) {
    console.log(`refusing to record: ${label} would grow ${before} → ${after}.`);
    console.log('A baseline may only shrink. Pass --allow-growth only with explicit approval.');
    return false;
  }
  return true;
}

function recordPint(baselinePath, currentPath, allowGrowth) {
  const before = Object.keys(readJson(baselinePath, { files: {} }).files || {}).length;
  const files = pintMap(fs.readFileSync(currentPath, 'utf8'));
  const after = Object.keys(files).length;

  if (!guardGrowth(before, after, allowGrowth, 'Pint baseline')) return EXIT_REGRESSION;

  writeJson(baselinePath, {
    _comment: 'Guardian Pint ratchet baseline. May only shrink. See engineering/quality-guardian/README.md.',
    total: after,
    files,
  });
  console.log(`recorded Pint baseline: ${before} → ${after} file(s)`);
  return EXIT_OK;
}

function recordTsc(baselinePath, currentPath, allowGrowth) {
  const before = Number(readJson(baselinePath, { total: 0 }).total || 0);
  const current = tscMap(fs.readFileSync(currentPath, 'utf8'));

  if (!guardGrowth(before, current.total, allowGrowth, 'TypeScript baseline')) return EXIT_REGRESSION;

  writeJson(baselinePath, {
    _comment: 'Guardian TypeScript ratchet baseline. May only shrink. See engineering/quality-guardian/README.md.',
    total: current.total,
    byCode: current.byCode,
    byFile: current.byFile,
  });
  console.log(`recorded TypeScript baseline: ${before} → ${current.total} error(s)`);
  return EXIT_OK;
}

function recordCount(baselinePath, currentRaw, label, allowGrowth) {
  const before = Number(readJson(baselinePath, { total: 0 }).total || 0);
  const after = Number(currentRaw);

  if (!Number.isFinite(after)) {
    console.log(`could not read a current ${label} count`);
    return EXIT_USAGE;
  }
  if (!guardGrowth(before, after, allowGrowth, `${label} baseline`)) return EXIT_REGRESSION;

  writeJson(baselinePath, {
    _comment: `Guardian ${label} ratchet baseline. May only shrink. See engineering/quality-guardian/README.md.`,
    total: after,
  });
  console.log(`recorded ${label} baseline: ${before} → ${after}`);
  return EXIT_OK;
}

/* ── Dispatch ─────────────────────────────────────────────────────────────── */

function main(argv) {
  const [cmd, ...rest] = argv;
  const allowGrowth = rest.includes('--allow-growth');
  const args = rest.filter((a) => a !== '--allow-growth');

  switch (cmd) {
    case 'compare-pint':  return comparePint(args[0], args[1], args[2]);
    case 'compare-tsc':   return compareTsc(args[0], args[1], args[2]);
    case 'compare-count': return compareCount(args[0], args[1], args[2] || 'items');
    case 'record-pint':   return recordPint(args[0], args[1], allowGrowth);
    case 'record-tsc':    return recordTsc(args[0], args[1], allowGrowth);
    case 'record-count':  return recordCount(args[0], args[1], args[2] || 'items', allowGrowth);
    default:
      console.log('usage: ratchet.js <compare-pint|compare-tsc|compare-count|record-pint|record-tsc|record-count> ...');
      return EXIT_USAGE;
  }
}

process.exit(main(process.argv.slice(2)));
