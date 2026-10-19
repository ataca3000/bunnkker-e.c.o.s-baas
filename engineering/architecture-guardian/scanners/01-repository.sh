#!/usr/bin/env bash
# NAME: Repository Scanner
# Detects dead files, unused components, unused hooks, and unused services
# in both the frontend (TypeScript) and backend (PHP) codebases.
set -euo pipefail

PROJECT_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
FRONTEND="$PROJECT_ROOT/frontend/src"
BACKEND="$PROJECT_ROOT/backend"

source "$(dirname "${BASH_SOURCE[0]}")/../lib/emit.sh"

if ! command -v node &>/dev/null; then
  echo "node not in PATH" >&2
  exit 2
fi

# ── Frontend: Dead File Detection ─────────────────────────────────────────────
# Build an import graph from all TS/TSX files. Files that are never imported
# and are not entry points are candidates for removal.

node -e "
const fs   = require('fs');
const path = require('path');

const ROOT = process.argv[1];

// ── Entry points that are intentionally never imported ───────────────────────
const ENTRY_PATTERNS = [
  /main\\.tsx?\$/,
  /App\\.tsx?\$/,
  /router\\.tsx?\$/,
  /routes\\.tsx?\$/,
  /index\\.ts\$/,          // barrel exports
  /\\.test\\.(ts|tsx)\$/,
  /\\.spec\\.(ts|tsx)\$/,
  /\\.d\\.ts\$/,
  /types?\\/index\\.ts\$/,
  /types?\\.ts\$/,
  /\\/i18n\\//,
  /\\/store\\//,
  /\\/config\\//,
  /\\/constants\\//,
  /\\/lib\\//,
  /\\/utils\\//,
];

function isEntryPoint(rel) {
  return ENTRY_PATTERNS.some(p => p.test(rel));
}

// ── Collect all TS/TSX source files ──────────────────────────────────────────
function walk(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!['node_modules', 'dist', '.git', 'coverage'].includes(e.name)) walk(full, files);
    } else if (/\\.(ts|tsx)\$/.test(e.name) && !e.name.endsWith('.d.ts')) {
      files.push(full);
    }
  }
  return files;
}

const allFiles = walk(ROOT);
const allRels  = new Set(allFiles.map(f => path.relative(ROOT, f)));

// ── Parse imports from each file ──────────────────────────────────────────────
// Handles: import '...', import {...} from '...', export * from '...', dynamic import()
const IMPORT_RE = /(?:import|export)\s+(?:[^'\"]*from\s+)?['\"](\.\.?\/[^'\"]+)['\"]|import\s*\(['\"](\.\.?\/[^'\"]+)['"]\)/g;

const imported = new Set();

for (const file of allFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const dir     = path.dirname(file);
  let m;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(content)) !== null) {
    const raw = m[1] || m[2];
    if (!raw) continue;
    const abs  = path.resolve(dir, raw);
    const exts = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];
    for (const ext of exts) {
      const candidate = abs + ext;
      const rel = path.relative(ROOT, candidate);
      if (allRels.has(rel)) { imported.add(rel); break; }
    }
  }
}

// ── Report files never imported ───────────────────────────────────────────────
const dead = [];
for (const rel of allRels) {
  if (!imported.has(rel) && !isEntryPoint(rel)) dead.push(rel);
}

for (const rel of dead.sort()) {
  const ext = path.extname(rel);
  let category = 'dead-file';
  if (rel.includes('/hooks/'))      category = 'dead-hook';
  else if (rel.includes('/services/')) category = 'dead-service';
  else if (rel.includes('/components/')) category = 'dead-component';
  else if (rel.includes('/pages/'))  category = 'dead-page';

  process.stdout.write(
    'FINDING\tLOW\t' + category + '\tfrontend/src/' + rel + '\t0\t' +
    'File is never imported by any other module' + '\t' +
    'Verify whether the file is still needed; remove it or add an import in the appropriate parent' +
    '\n'
  );
}
" "$FRONTEND"

# ── Backend: Dead PHP Classes ─────────────────────────────────────────────────
# Find PHP classes in app/ and Modules/ whose short class name never appears
# in any other PHP file's source. This catches truly orphaned classes.

node -e "
const fs   = require('fs');
const path = require('path');

const BACKEND = process.argv[1];

function walkPhp(dir, files = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return files; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!['vendor', 'storage', 'bootstrap'].includes(e.name)) walkPhp(full, files);
    } else if (e.name.endsWith('.php')) {
      files.push(full);
    }
  }
  return files;
}

const phpFiles = walkPhp(path.join(BACKEND, 'app'))
  .concat(walkPhp(path.join(BACKEND, 'Modules')));

// Build class → file map
const classMap = new Map();
for (const file of phpFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const m = content.match(/^class\s+(\w+)/m);
  if (m) classMap.set(m[1], { file, content });
}

// Build a big blob of all PHP source to search for usages
const allSource = phpFiles.map(f => fs.readFileSync(f, 'utf8')).join('\n');

// Classes that are never referenced elsewhere
const SKIP_CLASSES = [
  /Controller\$/, /Request\$/, /Resource\$/, /Seeder\$/,
  /Factory\$/, /Migration\$/, /ServiceProvider\$/, /Command\$/,
  /Test\$/, /Middleware\$/
];

for (const [className, { file }] of classMap) {
  if (SKIP_CLASSES.some(p => p.test(className))) continue;
  // Count occurrences; subtract 1 for the declaration itself
  const re = new RegExp('\\\\b' + className + '\\\\b', 'g');
  const count = (allSource.match(re) || []).length;
  if (count <= 1) {
    const rel = path.relative(BACKEND, file).replace(/\\\\/g, '/');
    process.stdout.write(
      'FINDING\tMEDIUM\tdead-class\tbackend/' + rel + '\t0\t' +
      'Class ' + className + ' is never referenced outside its own file' + '\t' +
      'Verify this class is not loaded via string reference or config; remove if unused' +
      '\n'
    );
  }
}
" "$BACKEND"
