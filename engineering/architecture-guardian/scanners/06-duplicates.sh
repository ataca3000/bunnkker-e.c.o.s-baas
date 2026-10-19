#!/usr/bin/env bash
# NAME: Duplicate Logic Detector
# Finds copy-pasted code and structurally identical files:
#
#   - Identical or near-identical service files (same API call patterns)
#   - Duplicate function signatures across the codebase
#   - Backend PHP files with identical structure (suggest extraction)
set -euo pipefail

PROJECT_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
FRONTEND="$PROJECT_ROOT/frontend/src"
BACKEND="$PROJECT_ROOT/backend"

source "$(dirname "${BASH_SOURCE[0]}")/../lib/emit.sh"

if ! command -v node &>/dev/null; then
  echo "node not in PATH" >&2
  exit 2
fi

# ── Frontend: Duplicate Service Files ────────────────────────────────────────
# Normalize each service file by stripping imports and string literals, then
# compare fingerprints. Files with identical normalized bodies are flagged.

node -e "
const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const FRONTEND = process.argv[1];

function walk(dir, pattern, files = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return files; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!['node_modules','dist','.git'].includes(e.name)) walk(full, pattern, files);
    } else if (pattern.test(e.name)) {
      files.push(full);
    }
  }
  return files;
}

function normalize(content) {
  return content
    .replace(/import[^;]+;/g, '')                       // strip imports
    .replace(/['\"][^'\"]+['\"/]/g, 'STRING')           // normalize strings
    .replace(/\/\/[^\n]*/g, '')                          // strip line comments
    .replace(/\/\*[\s\S]*?\*\//g, '')                   // strip block comments
    .replace(/\s+/g, ' ')                               // collapse whitespace
    .trim();
}

const emit = (sev, cat, file, line, expl, fix) =>
  process.stdout.write('FINDING\t' + [sev,cat,file,line,expl,fix].join('\t') + '\n');

// ── Check service files ───────────────────────────────────────────────────────
const services = walk(FRONTEND, /-service\\.ts\$/);
const fingerprints = new Map();

for (const file of services) {
  const content = fs.readFileSync(file, 'utf8');
  const norm    = normalize(content);
  const hash    = crypto.createHash('md5').update(norm).digest('hex');

  if (fingerprints.has(hash)) {
    const other = fingerprints.get(hash);
    const relA  = 'frontend/src/' + path.relative(FRONTEND, file);
    const relB  = 'frontend/src/' + path.relative(FRONTEND, other);
    emit('MEDIUM', 'duplicate-service', relA, 0,
      'Service file is structurally identical to ' + relB,
      'Extract shared logic into a common base service or utility function'
    );
  } else {
    fingerprints.set(hash, file);
  }
}

// ── Check for copy-pasted function blocks ─────────────────────────────────────
// Find function signatures that appear in 3+ different files
const allTs = walk(FRONTEND, /\\.(ts|tsx)\$/).filter(f => !f.endsWith('.d.ts'));

const sigMap = new Map(); // signature → [files]

const FN_RE = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/g;
const ARROW_RE = /(?:export\s+const\s+)(\w+)\s*=\s*(?:async\s*)?\(/g;

for (const file of allTs) {
  let content;
  try { content = fs.readFileSync(file, 'utf8'); } catch { continue; }
  const rel = 'frontend/src/' + path.relative(FRONTEND, file);

  for (const re of [FN_RE, ARROW_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content)) !== null) {
      const name = m[1];
      // Skip React component names (start with uppercase) and hooks (start with 'use')
      if (/^[A-Z]/.test(name) || name.startsWith('use')) continue;
      if (!sigMap.has(name)) sigMap.set(name, []);
      sigMap.get(name).push(rel);
    }
  }
}

for (const [name, files] of sigMap) {
  if (files.length >= 3) {
    const sample = files.slice(0, 3).join(', ');
    emit('LOW', 'duplicate-function', files[0], 0,
      'Function \"' + name + '\" defined in ' + files.length + ' places: ' + sample + (files.length > 3 ? ' ...' : ''),
      'Extract \"' + name + '\" into a shared utility module (e.g. frontend/src/lib/utils.ts)'
    );
  }
}
" "$FRONTEND"

# ── Backend: Duplicate PHP Class Patterns ────────────────────────────────────
node -e "
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const BACKEND = process.argv[1];

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

function normalizePhp(content) {
  return content
    .replace(/namespace[^;]+;/, '')            // strip namespace
    .replace(/use [^;]+;/g, '')                // strip use statements
    .replace(/\/\/[^\n]*/g, '')                // strip line comments
    .replace(/\/\*[\s\S]*?\*\//g, '')          // strip doc blocks
    .replace(/'[^']*'/g, 'STR')               // normalize strings
    .replace(/\"[^\"]*\"/g, 'STR')
    .replace(/\s+/g, ' ')
    .trim();
}

const emit = (sev, cat, file, line, expl, fix) =>
  process.stdout.write('FINDING\t' + [sev,cat,file,line,expl,fix].join('\t') + '\n');

// Compare Action classes for near-identical implementations
const actions = walkPhp(path.join(BACKEND, 'Modules'))
  .filter(f => f.includes('/Actions/'));

const actionFps = new Map();
for (const file of actions) {
  const content = fs.readFileSync(file, 'utf8');
  const norm    = normalizePhp(content);
  const hash    = crypto.createHash('md5').update(norm).digest('hex');
  const rel     = 'backend/' + path.relative(BACKEND, file).replace(/\\\\/g,'/');

  if (actionFps.has(hash)) {
    const other = actionFps.get(hash);
    emit('MEDIUM', 'duplicate-logic', rel, 0,
      'Action class is structurally identical to ' + other,
      'Extract common logic to a shared service or trait to avoid duplication'
    );
  } else {
    actionFps.set(hash, rel);
  }
}
" "$BACKEND"
