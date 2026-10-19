#!/usr/bin/env node
/**
 * ECOS Frontend Architecture Analyzer (EPIC-2 · Platform Architecture)
 *
 * Measures the frontend dependency graph so architectural claims are evidence,
 * not assertion. Read-only: parses imports, writes nothing.
 *
 * Reports:
 *   • layer violations — a shared layer importing from features/ (illegal:
 *     shared layers must be feature-agnostic to be extractable)
 *   • cross-feature edges and their weight
 *   • strongly connected components (Tarjan) — a cycle between features makes
 *     TypeScript project references impossible, since they require a DAG
 *   • the minimum feedback vertex set (greedy) — which features, if their
 *     shared surface were extracted, would make the graph acyclic
 *
 * Usage:
 *   node scripts/analyze-architecture.mjs            # summary
 *   node scripts/analyze-architecture.mjs --json     # machine-readable
 *   node scripts/analyze-architecture.mjs --edges    # every cross-feature edge
 *   node scripts/analyze-architecture.mjs --check    # ratchet: fail on regression
 *   node scripts/analyze-architecture.mjs --accept   # record current as baseline
 *
 * Gating model — a RATCHET, not a cliff. The graph currently carries real debt
 * (a 23-feature cycle, layer violations). Failing outright would block every
 * commit and the gate would be disabled within a day, which is how the i18n
 * lint rules ended up permanently red. Instead `--check` fails only when a
 * metric gets WORSE than the recorded baseline, so debt can only shrink.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SRC = path.join(ROOT, 'src');
const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const showEdges = argv.includes('--edges');

/** Layers that must never depend on a feature, ordered by tier. */
const SHARED_LAYERS = [
  'lib', 'utils', 'types', 'config', 'store', 'services', 'i18n',
  'components', 'hooks', 'providers', 'layouts',
];
/** Composition root — legitimately depends on features. */
const COMPOSITION = ['app', 'router', 'main.tsx'];

const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });

const rel = (p) => path.relative(SRC, p).split(path.sep).join('/');

/** Matches `from '@/…'` and bare `import '@/…'` in both static and type form. */
const IMPORT_RE = /(?:from|import)\s*\(?\s*['"]@\/([^'"]+)['"]/g;

const files = walk(SRC);
const layerViolations = [];
const edges = new Map();   // "a->b" -> count
const featureFiles = new Map();

for (const file of files) {
  const r = rel(file);
  const owner = r.startsWith('features/') ? r.split('/')[1] : r.split('/')[0];
  if (r.startsWith('features/')) {
    featureFiles.set(owner, (featureFiles.get(owner) ?? 0) + 1);
  }

  const text = fs.readFileSync(file, 'utf8');
  for (const m of text.matchAll(IMPORT_RE)) {
    const target = m[1];
    if (!target.startsWith('features/')) continue;
    const targetFeature = target.split('/')[1];

    if (SHARED_LAYERS.includes(owner)) {
      layerViolations.push({ file: r, layer: owner, imports: target });
      continue;
    }
    if (COMPOSITION.includes(owner)) continue;
    if (!r.startsWith('features/') || owner === targetFeature) continue;

    const key = `${owner}->${targetFeature}`;
    edges.set(key, (edges.get(key) ?? 0) + 1);
  }
}

/* ── Tarjan SCC ──────────────────────────────────────────────────────────── */
function scc(edgeKeys) {
  const g = {}, nodes = new Set();
  for (const k of edgeKeys) {
    const [a, b] = k.split('->');
    nodes.add(a); nodes.add(b);
    (g[a] ??= []).push(b);
  }
  let idx = 0;
  const I = {}, L = {}, on = {}, st = [], out = [];
  const strong = (v) => {
    I[v] = L[v] = idx++; st.push(v); on[v] = 1;
    for (const w of g[v] ?? []) {
      if (I[w] === undefined) { strong(w); L[v] = Math.min(L[v], L[w]); }
      else if (on[w]) L[v] = Math.min(L[v], I[w]);
    }
    if (L[v] === I[v]) {
      const c = []; let w;
      do { w = st.pop(); on[w] = 0; c.push(w); } while (w !== v);
      out.push(c);
    }
  };
  for (const n of nodes) if (I[n] === undefined) strong(n);
  return { components: out, nodeCount: nodes.size };
}

const edgeKeys = [...edges.keys()];
const { components, nodeCount } = scc(edgeKeys);
const cycles = components.filter((c) => c.length > 1).sort((a, b) => b.length - a.length);

/* ── greedy feedback vertex set ──────────────────────────────────────────── */
/** Which features, if their shared surface were extracted, break every cycle. */
function feedbackSet() {
  const removed = new Set();
  const steps = [];
  for (let i = 0; i < 20; i++) {
    const live = edgeKeys.filter((k) => {
      const [a, b] = k.split('->');
      return !removed.has(a) && !removed.has(b);
    });
    const biggest = scc(live).components.filter((c) => c.length > 1)
      .sort((a, b) => b.length - a.length)[0];
    if (!biggest) break;

    let best = null, bestSize = Infinity;
    for (const cand of biggest) {
      const trial = new Set(removed); trial.add(cand);
      const liveT = edgeKeys.filter((k) => {
        const [a, b] = k.split('->');
        return !trial.has(a) && !trial.has(b);
      });
      const s = scc(liveT).components.filter((c) => c.length > 1)
        .sort((x, y) => y.length - x.length)[0]?.length ?? 1;
      if (s < bestSize) { bestSize = s; best = cand; }
    }
    if (!best) break;
    removed.add(best);
    const inbound = edgeKeys
      .filter((k) => k.endsWith(`->${best}`))
      .reduce((s, k) => s + edges.get(k), 0);
    steps.push({ feature: best, inboundImports: inbound, largestRemainingScc: bestSize });
  }
  return steps;
}
const extractions = cycles.length ? feedbackSet() : [];

/* ── output ──────────────────────────────────────────────────────────────── */
const inboundByFeature = {};
for (const [k, v] of edges) {
  const t = k.split('->')[1];
  inboundByFeature[t] = (inboundByFeature[t] ?? 0) + v;
}

const report = {
  totals: {
    files: files.length,
    features: featureFiles.size,
    crossFeatureEdges: edges.size,
    crossFeatureImports: [...edges.values()].reduce((a, b) => a + b, 0),
    layerViolations: layerViolations.length,
    graphNodes: nodeCount,
    largestCycle: cycles[0]?.length ?? 0,
  },
  layerViolations,
  cycles: cycles.map((c) => c.sort()),
  extractions,
  topCoupling: Object.entries(inboundByFeature)
    .sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([feature, imports]) => ({ feature, imports })),
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const t = report.totals;
  console.log(`
  ECOS frontend architecture
  ${'═'.repeat(66)}
  files                    ${t.files}
  features                 ${t.features}
  cross-feature edges      ${t.crossFeatureEdges}
  cross-feature imports    ${t.crossFeatureImports}
  layer violations         ${t.layerViolations}${t.layerViolations ? '   ← must be 0' : '   ✓'}
  largest cycle            ${t.largestCycle}${t.largestCycle > 1 ? '   ← blocks project references' : '   ✓ acyclic'}`);

  if (layerViolations.length) {
    console.log(`\n  LAYER VIOLATIONS (shared layer importing a feature)`);
    console.log(`  ${'─'.repeat(66)}`);
    for (const v of layerViolations) console.log(`    ${v.file}\n        → @/${v.imports}`);
  }
  if (cycles.length) {
    console.log(`\n  CYCLES`);
    console.log(`  ${'─'.repeat(66)}`);
    for (const c of cycles) console.log(`    size ${c.length}: ${c.join(', ')}`);
    console.log(`\n  MINIMUM EXTRACTIONS TO BREAK ALL CYCLES`);
    console.log(`  ${'─'.repeat(66)}`);
    for (const [i, s] of extractions.entries()) {
      console.log(`    ${i + 1}. ${s.feature.padEnd(20)} ${String(s.inboundImports).padStart(3)} inbound imports` +
        `   → largest remaining cycle ${s.largestRemainingScc}`);
    }
  }
  console.log(`\n  TOP COUPLING (inbound cross-feature imports)`);
  console.log(`  ${'─'.repeat(66)}`);
  for (const c of report.topCoupling) console.log(`    ${String(c.imports).padStart(3)}  ${c.feature}`);
  if (showEdges) {
    console.log(`\n  ALL CROSS-FEATURE EDGES`);
    console.log(`  ${'─'.repeat(66)}`);
    for (const [k, v] of [...edges.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${String(v).padStart(3)}  ${k.replace('->', ' → ')}`);
    }
  }
  console.log('');
}

/* ── ratchet ─────────────────────────────────────────────────────────────── */
const BASELINE = path.resolve(ROOT, '../engineering/baselines/architecture.json');

/** Metrics that may only decrease. Growth is a regression; shrinkage is progress. */
const RATCHETED = [
  'layerViolations', 'crossFeatureEdges', 'crossFeatureImports', 'largestCycle',
];

if (argv.includes('--accept')) {
  fs.mkdirSync(path.dirname(BASELINE), { recursive: true });
  fs.writeFileSync(BASELINE, `${JSON.stringify({ totals: report.totals }, null, 2)}\n`, 'utf8');
  console.log(`  baseline recorded → engineering/baselines/architecture.json\n`);
  process.exit(0);
}

if (argv.includes('--check')) {
  if (!fs.existsSync(BASELINE)) {
    console.error('  no architecture baseline — run with --accept first.');
    process.exit(2);
  }
  const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8')).totals;
  const regressions = RATCHETED
    .filter((k) => report.totals[k] > base[k])
    .map((k) => `${k}: ${base[k]} → ${report.totals[k]}`);
  const improvements = RATCHETED
    .filter((k) => report.totals[k] < base[k])
    .map((k) => `${k}: ${base[k]} → ${report.totals[k]}`);

  if (regressions.length) {
    console.error(`  ARCHITECTURE REGRESSION\n  ${'─'.repeat(66)}`);
    for (const r of regressions) console.error(`    ${r}`);
    console.error(
      '\n  Shared layers must not import features/, and features must not form\n' +
      '  cycles. Route the dependency through a shared contract instead.\n' +
      '  If this increase is intentional and approved, re-record with --accept.\n');
    process.exit(1);
  }
  if (improvements.length) {
    console.log(`  architecture improved — re-record with --accept:`);
    for (const i of improvements) console.log(`    ${i}`);
  } else {
    console.log('  architecture check passed (no regression)');
  }
  process.exit(0);
}

// Default run is informational only; gating happens via --check.
process.exit(0);
