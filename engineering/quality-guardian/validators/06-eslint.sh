#!/usr/bin/env bash
# NAME: ESLint
#
# Mode-aware scope (the runner passes MODE as $2):
#   pre-commit          → lint ONLY the files staged in this commit
#   pre-push|ci|full    → lint the ENTIRE repository (unchanged behaviour)
#
# Guarantees preserved in BOTH scopes:
#   • The exact same eslint.config.js is used — every rule stays at its
#     configured severity (ERROR remains ERROR). Nothing is disabled.
#   • No file is added to any ignore list; at pre-commit we simply lint the
#     files that belong to the commit instead of the whole tree.
#   • A staged file that introduces a new violation still fails the commit;
#     historical debt in files outside the commit no longer blocks it.
set -euo pipefail

PROJECT_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
MODE="${2:-full}"
FRONTEND="$PROJECT_ROOT/frontend"

if ! command -v node &>/dev/null; then
  echo "node not in PATH — install Node.js 22+"
  exit 2
fi

if [[ ! -d "$FRONTEND/node_modules" ]]; then
  echo "frontend/node_modules not found — run: cd frontend && npm install"
  exit 2
fi

cd "$FRONTEND"
ESLINT="node_modules/.bin/eslint"

if [[ "$MODE" == "pre-commit" ]]; then
  # ── Staged-scope lint ──────────────────────────────────────────────────────
  # Collect the JS/TS files staged for this commit (Added/Copied/Modified/Renamed),
  # normalise their paths to be relative to the frontend/ project root.
  mapfile -t STAGED < <(
    git -C "$PROJECT_ROOT" diff --cached --name-only --diff-filter=ACMR \
      | grep -E '^frontend/.*\.(ts|tsx|js|jsx|cjs|mjs)$' \
      | sed 's|^frontend/||' \
      || true
  )

  # Keep only paths that still exist on disk (a rename can leave a stale entry).
  FILES=()
  for f in "${STAGED[@]:-}"; do
    [[ -n "$f" && -f "$f" ]] && FILES+=("$f")
  done

  if [[ ${#FILES[@]} -eq 0 ]]; then
    echo "no staged frontend JS/TS files — nothing to lint"
    exit 2   # SKIP
  fi

  echo "Linting ${#FILES[@]} staged file(s) with the full ruleset:"
  printf '  %s\n' "${FILES[@]}"
  echo
  # Same config, same rules. eslint exits non-zero on any error → commit blocked.
  "$ESLINT" "${FILES[@]}"
else
  # ── Full-repository lint, ratcheted ────────────────────────────────────────
  #
  # The lint itself is unchanged: the whole repository, the same eslint.config.js,
  # every rule at its configured severity. Nothing is disabled or ignored.
  #
  # Two things changed, and they pull in opposite directions on purpose.
  #
  # 1. STALE SUPPRESSIONS NO LONGER FAIL THE BUILD.
  #    ESLint's bulk-suppression ratchet treats *unused* entries in
  #    eslint-suppressions.json as a failure. That meant the gate failed with
  #    "0 errors, 6 warnings" — exit 2 — purely because violations had been
  #    FIXED and their suppressions left behind. A ratchet that punishes an
  #    improvement is backwards, so --pass-on-unpruned-suppressions is now
  #    passed and staleness is reported instead of blocking.
  #
  # 2. NEW SUPPRESSIONS DO FAIL THE BUILD.
  #    Ignoring staleness on its own would let the file grow unchecked, so the
  #    total suppression count is ratcheted against
  #    engineering/baselines/eslint-suppressions-baseline.json. The count may
  #    shrink freely; any growth blocks, because adding a suppression is a
  #    deliberate act that needs approval, not a side effect of a push.
  #
  # Net effect: strictly stricter than before for new debt, and no longer
  # blocking on debt that was removed. See TASK-GUARDIAN-PREPUSH-RCA-001.
  #
  # NOTE ON AUTOMATIC PRUNING: pruning rewrites frontend/eslint-suppressions.json,
  # a tracked file. Doing that inside a pre-push hook would leave the working tree
  # dirty and push a commit that does not contain the prune it just performed, so
  # it is deliberately NOT done here. Pruning is a one-command maintenance step:
  #     engineering/quality-guardian/bin/record-baselines.sh eslint --prune
  SUPPRESSIONS="$FRONTEND/eslint-suppressions.json"
  BASELINE="$PROJECT_ROOT/engineering/baselines/eslint-suppressions-baseline.json"
  GUARDIAN="$PROJECT_ROOT/engineering/quality-guardian"

  set +e
  OUT="$("$ESLINT" . --pass-on-unpruned-suppressions 2>&1)"
  LINT_EC=$?
  set -e

  printf '%s\n' "$OUT"

  # A real lint error (or an unsuppressed violation) still fails outright.
  if [[ $LINT_EC -ne 0 ]]; then
    echo ""
    echo "ESLint reported violations that are not suppressed — fix them before pushing."
    exit 1
  fi

  # Ratchet the suppression inventory.
  if [[ ! -f "$BASELINE" ]]; then
    echo "ESLint suppression baseline missing: $BASELINE"
    echo "Record it with: engineering/quality-guardian/bin/record-baselines.sh eslint"
    exit 2
  fi

  CURRENT_COUNT="$(
    node -e '
      const fs = require("fs");
      let total = 0;
      try {
        const s = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
        for (const file of Object.keys(s)) {
          for (const rule of Object.keys(s[file])) {
            total += Number(s[file][rule].count ?? s[file][rule] ?? 0);
          }
        }
      } catch { total = -1; }
      console.log(total);
    ' "$SUPPRESSIONS"
  )"

  echo ""
  node "$GUARDIAN/lib/ratchet.js" compare-count "$BASELINE" "$CURRENT_COUNT" "suppressions"
  exit $?
fi
