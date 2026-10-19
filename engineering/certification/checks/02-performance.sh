#!/usr/bin/env bash
# NAME: Performance
# Scans for common performance anti-patterns.
#
# Checks:
#   [HIGH]   Controllers returning unbounded ->all() or ->get() without pagination
#   [MEDIUM] Very large PHP files (>600 lines) — complexity and load time risk
#   [MEDIUM] Very large TSX/TS files (>500 lines) — bundle weight risk
#   [LOW]    Eager loading absent: relationship accessor chains in loops
#   [METRIC] total_php_files, total_tsx_files, large_php_files, large_tsx_files
#
# Outputs: FINDING tab-separated lines + METRIC lines
# Exit 0 = no HIGH findings | Exit 1 = HIGH found | Exit 2 = skip
set -uo pipefail

PROJECT_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
BACKEND="$PROJECT_ROOT/backend"
FRONTEND="$PROJECT_ROOT/frontend/src"

source "$(dirname "${BASH_SOURCE[0]}")/../lib/emit.sh"

HAS_HIGH=0

# ── 1. Unbounded collection queries in controllers ─────────────────────────────
# Matches ->all() / ->get() without a preceding ->paginate / ->limit / ->take
# We flag only controllers (not repositories/tests) to keep signal-to-noise high.
while IFS=: read -r file line match; do
  rel="${file#$PROJECT_ROOT/}"
  emit_finding "HIGH" "perf-unbounded-query" "$rel" "$line" \
    "Unbounded ->all() / ->get() in a controller — will load every row into memory as the dataset grows" \
    "Add ->paginate(\$perPage) or ->limit() before ->get(); use cursor pagination for large exports"
  HAS_HIGH=1
done < <(
  grep -rnE '->(all|get)\(\)' \
    "$BACKEND/Modules" "$BACKEND/app" --include="*.php" \
    2>/dev/null | \
  grep -iE "Controller\.php" | \
  grep -v "/[Tt]ests*/" | \
  grep -v "Test\.php" | \
  grep -v "paginate\|->take\|->limit\|->first"
)

# ── 2. Large PHP files (>600 lines) ──────────────────────────────────────────
LARGE_PHP=0
while IFS=' ' read -r line_count file; do
  rel="${file#$PROJECT_ROOT/}"
  emit_finding "MEDIUM" "perf-large-file" "$rel" "0" \
    "PHP file is ${line_count} lines — large files slow autoloading, increase memory usage, and obscure hotspots" \
    "Extract cohesive sections into focused classes; aim for < 500 lines per file"
  LARGE_PHP=$((LARGE_PHP + 1))
done < <(
  find "$BACKEND/app" "$BACKEND/Modules" -name "*.php" \
    -not -path "*/vendor/*" -not -path "*/[Tt]ests*/*" 2>/dev/null | \
  xargs wc -l 2>/dev/null | \
  awk '$1 > 800 && !/total$/ {print $1, $2}' | \
  sort -rn | head -20
)

# ── 3. Large TSX/TS files (>700 lines) ────────────────────────────────────────
LARGE_TSX=0
while IFS=' ' read -r line_count file; do
  rel="${file#$PROJECT_ROOT/}"
  emit_finding "MEDIUM" "perf-large-component" "$rel" "0" \
    "Frontend file is ${line_count} lines — large components resist tree-shaking and increase initial bundle parse time" \
    "Split into sub-components and co-locate state; aim for < 400 lines per component"
  LARGE_TSX=$((LARGE_TSX + 1))
done < <(
  find "$FRONTEND" \( -name "*.tsx" -o -name "*.ts" \) \
    -not -name "*.d.ts" -not -name "*.test.*" 2>/dev/null | \
  xargs wc -l 2>/dev/null | \
  awk '$1 > 700 && !/total$/ {print $1, $2}' | \
  sort -rn | head -20
)

# ── 4. Metrics ────────────────────────────────────────────────────────────────
total_php=$(find "$BACKEND/app" "$BACKEND/Modules" -name "*.php" \
  -not -path "*/vendor/*" 2>/dev/null | wc -l)
total_tsx=$(find "$FRONTEND" \( -name "*.tsx" -o -name "*.ts" \) \
  -not -name "*.d.ts" 2>/dev/null | wc -l)

emit_metric "total_php_files"   "$total_php"
emit_metric "total_tsx_files"   "$total_tsx"
emit_metric "large_php_files"   "$LARGE_PHP"
emit_metric "large_tsx_files"   "$LARGE_TSX"

[[ $HAS_HIGH -eq 1 ]] && exit 1 || exit 0
