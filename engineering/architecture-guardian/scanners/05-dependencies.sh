#!/usr/bin/env bash
# NAME: Dependency Scanner
# Detects circular dependencies in both frontend (TypeScript) and backend (PHP).
#
# Frontend: builds a full import graph and runs DFS cycle detection.
# Backend: detects cross-module circular namespace dependencies.
set -euo pipefail

PROJECT_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
FRONTEND="$PROJECT_ROOT/frontend/src"
BACKEND="$PROJECT_ROOT/backend"

source "$(dirname "${BASH_SOURCE[0]}")/../lib/emit.sh"

if ! command -v node &>/dev/null; then
  echo "node not in PATH" >&2
  exit 2
fi

# ── Frontend: Circular Dependency Detection ───────────────────────────────────
node -e "
const fs   = require('fs');
const path = require('path');

const ROOT = process.argv[1];

function walk(dir, files = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return files; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!['node_modules','dist','.git'].includes(e.name)) walk(full, files);
    } else if (/\\.(ts|tsx)\$/.test(e.name) && !e.name.endsWith('.d.ts')) {
      files.push(full);
    }
  }
  return files;
}

const IMPORT_RE = /(?:from|import)\s+['\"](\\.{1,2}\/[^'\"]+)['\"]/g;

const allFiles = walk(ROOT);
// Normalize to short keys
const toKey = f => path.relative(ROOT, f);
const keySet = new Set(allFiles.map(toKey));

// Build adjacency list
const graph = new Map();
for (const file of allFiles) {
  const key  = toKey(file);
  const dir  = path.dirname(file);
  const deps = new Set();
  let m;
  IMPORT_RE.lastIndex = 0;
  const content = fs.readFileSync(file, 'utf8');
  while ((m = IMPORT_RE.exec(content)) !== null) {
    const raw = m[1];
    const abs = path.resolve(dir, raw);
    for (const ext of ['','.ts','.tsx','/index.ts','/index.tsx']) {
      const rel = path.relative(ROOT, abs + ext);
      if (keySet.has(rel) && rel !== key) { deps.add(rel); break; }
    }
  }
  graph.set(key, deps);
}

// DFS cycle detection — report each unique cycle once
const visited = new Set();
const inStack  = new Set();
const cycles   = new Set();

function dfs(node, stack) {
  if (inStack.has(node)) {
    // Found a cycle — extract the cycle path from stack
    const start = stack.indexOf(node);
    const cycle = stack.slice(start).concat(node);
    // Normalize to canonical form (lowest-index node first)
    const min   = cycle.reduce((a, b) => a < b ? a : b);
    const minI  = cycle.indexOf(min);
    const norm  = cycle.slice(minI).concat(cycle.slice(0, minI)).join(' → ');
    cycles.add(norm);
    return;
  }
  if (visited.has(node)) return;
  visited.add(node);
  inStack.add(node);
  stack.push(node);
  for (const dep of (graph.get(node) || [])) {
    dfs(dep, stack);
  }
  stack.pop();
  inStack.delete(node);
}

for (const node of graph.keys()) {
  if (!visited.has(node)) dfs(node, []);
}

function emit(sev, cat, file, line, expl, fix) {
  process.stdout.write('FINDING\t' + [sev,cat,file,line,expl,fix].join('\t') + '\n');
}

for (const cycle of cycles) {
  const parts  = cycle.split(' → ');
  const anchor = 'frontend/src/' + parts[0];
  emit('HIGH', 'circular-dependency', anchor, 0,
    'Circular dependency detected: ' + cycle,
    'Break the cycle by extracting shared types/utilities to a common module, or by restructuring imports'
  );
}
" "$FRONTEND"

# ── Backend: Cross-Module Circular Namespace Dependency ───────────────────────
# Strategy: for each module, collect the set of OTHER modules it imports.
# Then check for A → B → A cycles.

node -e "
const fs   = require('fs');
const path = require('path');

const MODULES_ROOT = process.argv[1];

function walkPhp(dir, files = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return files; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!['vendor','storage','bootstrap'].includes(e.name)) walkPhp(full, files);
    } else if (e.name.endsWith('.php')) {
      files.push(full);
    }
  }
  return files;
}

// Get top-level module names under Modules/
let domains;
try { domains = fs.readdirSync(MODULES_ROOT, { withFileTypes: true })
  .filter(e => e.isDirectory()).map(e => e.name); }
catch { process.exit(0); }

// Build module dependency graph: module → Set<module>
const graph = new Map();
for (const domain of domains) {
  const domainPath = path.join(MODULES_ROOT, domain);
  let subDomains;
  try { subDomains = fs.readdirSync(domainPath, { withFileTypes: true })
    .filter(e => e.isDirectory()).map(e => domain + '/' + e.name); }
  catch { continue; }

  for (const mod of subDomains) {
    const modPath = path.join(MODULES_ROOT, mod);
    const phpFiles = walkPhp(modPath);
    const deps = new Set();

    for (const file of phpFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const useRe = /^use Modules\\\\([A-Za-z]+)\\\\([A-Za-z]+)\\\\/gm;
      let m;
      while ((m = useRe.exec(content)) !== null) {
        const depMod = m[1] + '/' + m[2];
        if (depMod !== mod) deps.add(depMod);
      }
    }
    graph.set(mod, deps);
  }
}

// Check for A → B → A cycles (only check 2-cycles for performance)
function emit(sev, cat, file, line, expl, fix) {
  process.stdout.write('FINDING\t' + [sev,cat,file,line,expl,fix].join('\t') + '\n');
}

const reported = new Set();
for (const [modA, depsA] of graph) {
  for (const modB of depsA) {
    if (modA === modB) continue;
    const depsB = graph.get(modB);
    if (depsB && depsB.has(modA)) {
      const key = [modA, modB].sort().join('|');
      if (!reported.has(key)) {
        reported.add(key);
        emit('HIGH', 'circular-dependency',
          'backend/Modules/' + modA.replace('/', '/'), 0,
          'Circular module dependency: Modules/' + modA + ' ↔ Modules/' + modB,
          'Introduce a shared interface/contract in a Core module that both can depend on'
        );
      }
    }
  }
}
" "$BACKEND/Modules"
