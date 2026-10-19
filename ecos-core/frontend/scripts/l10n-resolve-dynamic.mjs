#!/usr/bin/env node
/**
 * ECOS Dynamic-Key Resolver (EPIC-L10N-001)
 *
 * Resolves localization roots that are indexed by a TypeScript union
 * (`t($ => $.vehicles.documentType[d.type])`). The member names live in the
 * type system, not the source text, so they are obtained from the compiler
 * rather than inferred.
 *
 *   --scaffold  write each missing root as {} (TRANSIENT — never a result)
 *   --fill      read compiler output and replace {} with the exact members
 *
 * With an empty root, TypeScript reports the index union verbatim:
 *   Type '"registration" | "insurance"' is not assignable to type 'never'
 * That message is the single source of truth for the member list.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const LOCALES = path.join(ROOT, 'src/i18n/locales');
const PLACEHOLDER = 'TODO';
const argv = process.argv.slice(2);

/** ns -> [dotted root paths] — derived from l10n-missing-keys.mjs --json */
function dynamicRoots() {
  const raw = JSON.parse(
    fs.readFileSync(path.join(ROOT, '.l10n-dynamic.json'), 'utf8'));
  const out = new Map();
  for (const d of raw.dynamicPaths) {
    if (!d.staticPrefix?.length) continue;
    const segs = d.staticPrefix.map((s) => s.k);
    if (!out.has(d.ns)) out.set(d.ns, new Set());
    out.get(d.ns).add(segs.join('.'));
  }
  return out;
}

const langs = fs.readdirSync(LOCALES).filter((d) =>
  fs.statSync(path.join(LOCALES, d)).isDirectory());

function ensure(obj, segs, value) {
  let cur = obj;
  for (let i = 0; i < segs.length - 1; i += 1) {
    const k = segs[i];
    if (cur[k] === undefined) cur[k] = {};
    else if (typeof cur[k] !== 'object' || Array.isArray(cur[k])) return false;
    cur = cur[k];
  }
  const leaf = segs[segs.length - 1];
  if (cur[leaf] === undefined) { cur[leaf] = value; return true; }
  return false;
}

if (argv.includes('--scaffold')) {
  let n = 0;
  for (const [ns, roots] of dynamicRoots()) {
    for (const lang of langs) {
      const p = path.join(LOCALES, lang, `${ns}.json`);
      if (!fs.existsSync(p)) continue;
      const obj = JSON.parse(fs.readFileSync(p, 'utf8'));
      let changed = 0;
      for (const r of roots) if (ensure(obj, r.split('.'), {})) changed += 1;
      if (changed) {
        fs.writeFileSync(p, `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
        n += changed;
      }
    }
  }
  console.log(`scaffolded ${n} transient empty roots`);
}

if (argv.includes('--fill')) {
  const diag = fs.readFileSync(argv[argv.indexOf('--fill') + 1], 'utf8');
  // Type '"a" | "b"' is not assignable to type 'never'.
  const re = /^(src\/[^(]+)\((\d+),\d+\): error TS2345: Argument of type '([^']*)' is not assignable to parameter of type 'never'/gm;
  const alt = /^(src\/[^(]+)\((\d+),\d+\): error TS2820[^\n]*|^(src\/[^(]+)\((\d+),\d+\): error TS7053[^\n]*/gm;

  // Collect every "X is not assignable to ... 'never'" union, keyed by file:line
  const unions = new Map();
  for (const m of diag.matchAll(/^(src\/[^(]+)\((\d+),(\d+)\): error TS\d+: [^\n]*?type '([^']*?)' is not assignable to (?:parameter of )?type 'never'/gm)) {
    unions.set(`${m[1]}:${m[2]}`, m[4]);
  }
  console.log(`compiler reported ${unions.size} index unions`);
  fs.writeFileSync(path.join(ROOT, '.l10n-unions.json'),
    JSON.stringify([...unions.entries()], null, 2));
  for (const [loc, u] of unions) console.log(`  ${loc}  ${u}`);
  void re; void alt;
}
