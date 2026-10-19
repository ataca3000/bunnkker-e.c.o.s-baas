#!/usr/bin/env bash
# NAME: Namespace Validator
# Checks:
#   Backend  — PHP PSR-4 namespace must match file path
#   Frontend — Cross-feature imports must use @/ alias; deep relative paths flagged
set -euo pipefail

PROJECT_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
BACKEND="$PROJECT_ROOT/backend"
FRONTEND="$PROJECT_ROOT/frontend/src"

source "$(dirname "${BASH_SOURCE[0]}")/../lib/emit.sh"

# ── Backend: PSR-4 Namespace Check (single Node.js pass — no per-file spawning) ─
if ! command -v node &>/dev/null; then
  echo "node not in PATH" >&2
  exit 2
fi

node -e "
const fs   = require('fs');
const path = require('path');

const BACKEND = process.argv[1];

function walkPhp(dir, files = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return files; }
  for (const e of entries) {
    if (e.isDirectory()) {
      if (!['vendor','storage','bootstrap','node_modules'].includes(e.name))
        walkPhp(path.join(dir, e.name), files);
    } else if (e.name.endsWith('.php')) {
      files.push(path.join(dir, e.name));
    }
  }
  return files;
}

function emit(sev, cat, file, line, expl, fix) {
  process.stdout.write('FINDING\t' + [sev,cat,file,line,expl,fix].join('\t') + '\n');
}

const APP_DIR     = path.join(BACKEND, 'app');
const MODULES_DIR = path.join(BACKEND, 'Modules');

const NS_RE = /^namespace\s+([A-Za-z\\\\]+);/m;

for (const dir of [APP_DIR, MODULES_DIR]) {
  for (const file of walkPhp(dir)) {
    let content;
    try { content = fs.readFileSync(file, 'utf8'); } catch { continue; }

    const m = NS_RE.exec(content);
    if (!m) continue;
    const declared = m[1];

    const rel = path.relative(BACKEND, file).replace(/\\\\/g, '/');

    // PSR-4: namespace = directory structure, NOT including the filename
    const dir = path.dirname(rel);
    let expected;
    if (dir === 'app') {
      expected = 'App';
    } else if (rel.startsWith('app/')) {
      const sub = dir.slice(4).replace(/\\//g, '\\\\');
      expected = 'App\\\\' + sub;
    } else if (rel.startsWith('Modules/')) {
      expected = dir.replace(/\\//g, '\\\\');
    } else {
      continue;
    }

    if (declared !== expected) {
      emit('HIGH', 'psr4-namespace', 'backend/' + rel, 0,
        'Namespace mismatch — declared: ' + declared + ', expected: ' + expected,
        'Change namespace declaration to match the file path per PSR-4'
      );
    }
  }
}
" "$BACKEND"

# ── Frontend: Import Alias Enforcement (single grep pass) ────────────────────
if [[ ! -d "$FRONTEND" ]]; then
  exit 0
fi

# Deep relative imports: 3+ levels up
grep -rnE "from ['\"](\.\./){3,}" \
  "$FRONTEND" --include="*.ts" --include="*.tsx" 2>/dev/null | \
grep -v "node_modules" | \
while IFS=: read -r file line match; do
  rel="${file#$PROJECT_ROOT/}"
  emit_finding "HIGH" "import-alias-violation" "$rel" "$line" \
    "Deep relative import (3+ levels): $match" \
    "Replace with an @/ alias (e.g. '@/components/ui/button')"
done

# Cross-feature relative imports: ../../features/<other-feature>
grep -rnE "from ['\"](\.\./)+features/[^'\"]+['\"]" \
  "$FRONTEND" --include="*.ts" --include="*.tsx" 2>/dev/null | \
grep -v "node_modules" | \
while IFS=: read -r file line match; do
  rel="${file#$PROJECT_ROOT/}"
  src_feat=$(echo "$rel" | grep -oP 'features/\K[^/]+' | head -1)
  dst_feat=$(echo "$match" | grep -oP '(?<=features/)[^/]+' | head -1)
  [[ -z "$src_feat" ]] || [[ -z "$dst_feat" ]] && continue
  [[ "$src_feat" == "$dst_feat" ]] && continue
  emit_finding "HIGH" "import-alias-violation" "$rel" "$line" \
    "Cross-feature relative import to '$dst_feat' from '$src_feat': $match" \
    "Replace with '@/features/$dst_feat/...' to use the TypeScript path alias"
done
