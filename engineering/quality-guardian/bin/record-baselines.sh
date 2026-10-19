#!/usr/bin/env bash
# ECOS Engineering Guardian — baseline recorder.
#
# Records the certified quality baselines the ratchet gates compare against.
#
#   record-baselines.sh                    record every baseline
#   record-baselines.sh pint               Pint only
#   record-baselines.sh typescript         TypeScript only
#   record-baselines.sh eslint [--prune]   ESLint suppressions (optionally prune first)
#
# A baseline may only ever SHRINK. lib/ratchet.js refuses to write a larger one
# unless --allow-growth is passed, which exists solely so an approved, deliberate
# increase can be recorded — never as a way to make a red gate green. Regenerating
# a baseline upward is how a ratchet quietly becomes a rubber stamp; that is the
# failure mode this script is built to prevent.
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# Resolve from git first so this works from any worktree; fall back to the path
# relative to this script. Grouped explicitly — `A || B && C` parses as
# `(A || B) && C`, which would append pwd's output to a successful git result.
PROJECT_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null)"
if [[ -z "$PROJECT_ROOT" || ! -d "$PROJECT_ROOT" ]]; then
  PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
fi
GUARDIAN="$PROJECT_ROOT/engineering/quality-guardian"
BASELINES="$PROJECT_ROOT/engineering/baselines"
RATCHET="$GUARDIAN/lib/ratchet.js"

WHAT="${1:-all}"
PRUNE=0
ALLOW_GROWTH=""
for arg in "$@"; do
  [[ "$arg" == "--prune" ]] && PRUNE=1
  [[ "$arg" == "--allow-growth" ]] && ALLOW_GROWTH="--allow-growth"
done

mkdir -p "$BASELINES"
rc=0

record_pint() {
  echo "── Pint ─────────────────────────────────────────────"
  local tmp; tmp="$(mktemp)"
  ( cd "$PROJECT_ROOT/backend" && php vendor/bin/pint --test > "$tmp" 2>/dev/null )
  node "$RATCHET" record-pint "$BASELINES/pint-baseline.json" "$tmp" $ALLOW_GROWTH || rc=1
  rm -f "$tmp"
}

record_typescript() {
  echo "── TypeScript ───────────────────────────────────────"
  local tmp; tmp="$(mktemp)"
  ( cd "$PROJECT_ROOT/frontend" \
      && NODE_OPTIONS="${NODE_OPTIONS:-} --max-old-space-size=8192" \
         node_modules/.bin/tsc -b --force > "$tmp" 2>&1 )
  node "$RATCHET" record-tsc "$BASELINES/typescript-diagnostics.json" "$tmp" $ALLOW_GROWTH || rc=1
  rm -f "$tmp"
}

record_eslint() {
  echo "── ESLint suppressions ──────────────────────────────"
  local fe="$PROJECT_ROOT/frontend"

  if [[ $PRUNE -eq 1 ]]; then
    echo "pruning suppressions that no longer occur..."
    # --prune-suppressions removes ONLY entries whose violation is gone. It cannot
    # hide a live violation: anything still occurring stays suppressed and anything
    # unsuppressed still errors.
    ( cd "$fe" && node_modules/.bin/eslint . --prune-suppressions >/dev/null 2>&1 ) || true
  fi

  local count
  count="$(
    node -e '
      const fs = require("fs");
      let total = 0;
      try {
        const s = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
        for (const f of Object.keys(s))
          for (const r of Object.keys(s[f]))
            total += Number(s[f][r].count ?? s[f][r] ?? 0);
      } catch { total = -1; }
      console.log(total);
    ' "$fe/eslint-suppressions.json"
  )"

  node "$RATCHET" record-count "$BASELINES/eslint-suppressions-baseline.json" "$count" "suppressions" $ALLOW_GROWTH || rc=1
}

case "$WHAT" in
  pint)        record_pint ;;
  typescript)  record_typescript ;;
  eslint)      record_eslint ;;
  all|--*)     record_pint; echo; record_typescript; echo; record_eslint ;;
  *)
    echo "usage: record-baselines.sh [all|pint|typescript|eslint] [--prune] [--allow-growth]" >&2
    exit 2 ;;
esac

echo
if [[ $rc -eq 0 ]]; then
  echo "Baselines recorded. Review the diff before committing — a baseline should never grow."
else
  echo "One or more baselines were NOT recorded (growth refused). Nothing was silently widened."
fi
exit $rc
