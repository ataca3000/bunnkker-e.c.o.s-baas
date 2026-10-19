#!/usr/bin/env bash
# NAME: Technical Debt
# Measures accumulated technical debt across the codebase.
#
# Checks:
#   [MEDIUM]  TODO/FIXME/HACK/XXX comment count above threshold (>50)
#   [MEDIUM]  PHPStan baseline issues indicate deferred static analysis debt
#   [LOW]     Large files (>400 lines) as a complexity proxy
#   [LOW]     Deprecated Laravel/PHP patterns
#   [METRIC]  todo_count, phpstan_baseline_issues, large_files_total,
#             deprecated_patterns
#
# Outputs: FINDING tab-separated lines + METRIC lines
# Exit 0 = no MEDIUM+ findings | Exit 1 = MEDIUM+ found | Exit 2 = skip
set -uo pipefail

PROJECT_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
BACKEND="$PROJECT_ROOT/backend"
FRONTEND="$PROJECT_ROOT/frontend/src"

source "$(dirname "${BASH_SOURCE[0]}")/../lib/emit.sh"

HAS_MEDIUM=0

# ── 1. TODO / FIXME / HACK / XXX count ────────────────────────────────────────
TODO_COUNT=0
TODO_COUNT=$(
  grep -rn "TODO\|FIXME\|HACK\|XXX\|@todo" \
    "$BACKEND/app" "$BACKEND/Modules" "$FRONTEND" \
    --include="*.php" --include="*.ts" --include="*.tsx" \
    2>/dev/null | \
  grep -v "/[Tt]ests*/" | \
  grep -v "Test\.php" | \
  wc -l
)

emit_metric "todo_count" "$TODO_COUNT"

if [[ $TODO_COUNT -gt 100 ]]; then
  emit_finding "MEDIUM" "debt-todo-excess" "-" "0" \
    "${TODO_COUNT} TODO/FIXME/HACK markers found — high density indicates planned work that has been indefinitely deferred" \
    "Review and triage: close resolved items, file tickets for real ones, delete stale comments"
  HAS_MEDIUM=1
elif [[ $TODO_COUNT -gt 50 ]]; then
  emit_finding "LOW" "debt-todo-excess" "-" "0" \
    "${TODO_COUNT} TODO/FIXME/HACK markers found — consider scheduled triage to prevent accumulation" \
    "Set a team goal to keep TODO count below 50; assign owners to each marker"
fi

# ── 2. PHPStan baseline (deferred static analysis debt) ───────────────────────
BASELINE_FILE="$BACKEND/phpstan-baseline.neon"
BASELINE_ISSUES=0

if [[ -f "$BASELINE_FILE" ]]; then
  # Count 'message:' lines = one issue per entry
  BASELINE_ISSUES=$(grep -c "message:" "$BASELINE_FILE" 2>/dev/null || echo 0)
  emit_metric "phpstan_baseline_issues" "$BASELINE_ISSUES"

  if [[ $BASELINE_ISSUES -gt 30 ]]; then
    emit_finding "MEDIUM" "debt-phpstan-baseline" "backend/phpstan-baseline.neon" "0" \
      "${BASELINE_ISSUES} PHPStan issues suppressed in the baseline — these are deferred type-safety violations" \
      "Allocate debt-paydown time each sprint; run 'php vendor/bin/phpstan analyse' to see all issues, fix them, then regenerate the baseline"
    HAS_MEDIUM=1
  elif [[ $BASELINE_ISSUES -gt 0 ]]; then
    emit_finding "LOW" "debt-phpstan-baseline" "backend/phpstan-baseline.neon" "0" \
      "${BASELINE_ISSUES} PHPStan issues in baseline — minor deferred type-safety debt" \
      "Fix suppressed issues incrementally and shrink the baseline toward zero"
  fi
else
  emit_metric "phpstan_baseline_issues" "0"
fi

# ── 3. Large files as a complexity proxy ──────────────────────────────────────
LARGE_PHP=0
LARGE_TS=0

LARGE_PHP=$(
  find "$BACKEND/app" "$BACKEND/Modules" -name "*.php" \
    -not -path "*/vendor/*" -not -path "*/[Tt]ests*/*" 2>/dev/null | \
  xargs wc -l 2>/dev/null | \
  awk '$1 > 400 && !/total$/' | \
  wc -l
)

LARGE_TS=$(
  find "$FRONTEND" \( -name "*.ts" -o -name "*.tsx" \) \
    -not -name "*.d.ts" -not -name "*.test.*" 2>/dev/null | \
  xargs wc -l 2>/dev/null | \
  awk '$1 > 350 && !/total$/' | \
  wc -l
)

LARGE_TOTAL=$((LARGE_PHP + LARGE_TS))
emit_metric "large_php_files_400"  "$LARGE_PHP"
emit_metric "large_ts_files_350"   "$LARGE_TS"
emit_metric "large_files_total"    "$LARGE_TOTAL"

if [[ $LARGE_TOTAL -gt 20 ]]; then
  emit_finding "MEDIUM" "debt-large-files" "-" "0" \
    "${LARGE_TOTAL} files exceed complexity thresholds (PHP >400 lines, TS >350 lines) — high cognitive load, harder to test" \
    "Identify the top-10 largest files and plan extraction of cohesive sub-modules"
  HAS_MEDIUM=1
elif [[ $LARGE_TOTAL -gt 5 ]]; then
  emit_finding "LOW" "debt-large-files" "-" "0" \
    "${LARGE_TOTAL} files exceed complexity thresholds — manageable but worth tracking" \
    "Refactor the largest files first during feature work that already touches them"
fi

# ── 4. Deprecated patterns ────────────────────────────────────────────────────
DEPRECATED=0

# Old Laravel 5.x string helpers used as global functions instead of Str::
DEP_HELPERS=$(
  grep -rnE '\b(str_slug|str_limit|str_contains|str_start|snake_case|camel_case|studly_case|kebab_case)\s*\(' \
    "$BACKEND/app" "$BACKEND/Modules" --include="*.php" \
    --exclude-dir=vendor 2>/dev/null | \
  grep -v "/[Tt]ests*/" | wc -l
)

# Old Blade @section/@yield pattern in component contexts (should use slots)
DEP_BLADE=$(
  grep -rn "@section\|@yield" \
    "$BACKEND/resources" --include="*.blade.php" 2>/dev/null | \
  wc -l
)

DEPRECATED=$((DEP_HELPERS + DEP_BLADE))
emit_metric "deprecated_patterns" "$DEPRECATED"

if [[ $DEP_HELPERS -gt 0 ]]; then
  emit_finding "LOW" "debt-deprecated-helpers" "-" "0" \
    "${DEP_HELPERS} deprecated global string helpers (str_slug, snake_case, etc.) — removed in Laravel 9" \
    "Replace with Str:: facade methods: Str::slug(), Str::snake(), etc."
fi

[[ $HAS_MEDIUM -eq 1 ]] && exit 1 || exit 0
