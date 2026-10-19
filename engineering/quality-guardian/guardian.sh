#!/usr/bin/env bash
# ECOS Engineering Guardian — main runner
#
# Usage:
#   ./guardian.sh [mode]
#
# Modes:
#   pre-commit   PHP syntax, Composer, ESLint, TypeScript
#   pre-push     + Laravel bootstrap, Pint, PHPStan, Vite build
#   ci | full    + Docker production build
#
# Durations are deliberately not quoted here. They are measured per commit and
# recorded by frontend/scripts/measure-typecheck.mjs; the TypeScript validator
# currently dominates every mode (TASK-PLATFORM-FOUNDATION-002).
#
# Exit codes:
#   0   all checks passed
#   1   one or more checks failed
set -euo pipefail

GUARDIAN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Validate the tree the commit is actually happening in.
#
# Linked worktrees share the main repository's .git/hooks, so GUARDIAN_DIR always
# resolves to the main checkout. Deriving PROJECT_ROOT from it meant a commit made
# in a worktree was validated against the main working tree's files while git
# handed the validators the worktree's staged file list — every validator read the
# wrong source tree. Git runs hooks with the cwd at the top of the invoking working
# tree, so ask git rather than infer from the script's own location.
#
# The previous location-based path remains the fallback for invocations from
# outside a work tree (CI checkouts without .git, manual runs from elsewhere), so
# behaviour is unchanged there. No validator semantics change: each still receives
# PROJECT_ROOT as $1 and runs exactly the checks it ran before, on the correct tree.
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -n "$PROJECT_ROOT" && -d "$PROJECT_ROOT" ]] || PROJECT_ROOT="$(cd "$GUARDIAN_DIR/../.." && pwd)"

# Load the validators belonging to the tree being validated, for the same reason
# PROJECT_ROOT is resolved above. GUARDIAN_DIR always points at the MAIN checkout
# (shared .git/hooks), so binding VALIDATOR_DIR to it meant a worktree's files
# were checked with whatever validator revision the main checkout happened to
# have on disk — correct data, wrong rules. Measured: pre-push ran the
# pre-ratchet validators from platform-foundation f4b427ed against develop
# d5f2b7e5, and none of the baselines were even reachable
# (TASK-GUARDIAN-RATCHET-002). Falls back to GUARDIAN_DIR when the tree carries
# no validators of its own, so CI checkouts and standalone runs are unchanged.
VALIDATOR_DIR="$PROJECT_ROOT/engineering/quality-guardian/validators"
[[ -d "$VALIDATOR_DIR" ]] || VALIDATOR_DIR="$GUARDIAN_DIR/validators"

source "$GUARDIAN_DIR/lib/colors.sh"
source "$GUARDIAN_DIR/lib/report.sh"
source "$GUARDIAN_DIR/config.sh"

MODE="${1:-full}"

case "$MODE" in
  pre-commit)
    VALIDATORS=(01-php-syntax 02-composer 06-eslint 07-typescript)
    ;;
  pre-push)
    VALIDATORS=(01-php-syntax 02-composer 03-laravel 04-pint 05-phpstan 06-eslint 07-typescript 08-vite-build)
    ;;
  ci|full)
    VALIDATORS=(01-php-syntax 02-composer 03-laravel 04-pint 05-phpstan 06-eslint 07-typescript 08-vite-build 09-docker)
    ;;
  *)
    printf 'Usage: %s [pre-commit|pre-push|ci|full]\n' "$0" >&2
    exit 1
    ;;
esac

STARTED_AT=$(date '+%H:%M:%S')
FAILED_COUNT=0

# ─── Header ──────────────────────────────────────────────────────────────────
printf '\n'
printf '%s━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n' "$C_BOLD" "$C_RESET"
printf '  %sECOS Engineering Guardian%s  %smode: %s  %s%s\n' \
  "$C_BOLD" "$C_RESET" "$C_DIM" "$MODE" "$STARTED_AT" "$C_RESET"
printf '%s━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n' "$C_BOLD" "$C_RESET"
printf '\n'

# ─── Run validators ──────────────────────────────────────────────────────────
for validator in "${VALIDATORS[@]}"; do
  script="$VALIDATOR_DIR/${validator}.sh"

  if [[ ! -f "$script" ]]; then
    printf '  %s%s%s  %-30s not found\n' "$C_YELLOW" "$ICO_WARN" "$C_RESET" "$validator"
    continue
  fi

  name=$(grep -m1 '^# NAME:' "$script" 2>/dev/null | sed 's/^# NAME: *//')
  name="${name:-$validator}"

  printf '  %-30s' "$name"

  START_TIME=$SECONDS
  # Pass MODE as $2 so mode-aware validators (e.g. ESLint) can scope their work
  # to the staged set at pre-commit while still running full-project in
  # pre-push/ci/full. Validators that don't need it simply ignore the argument.
  #
  # Output is captured rather than streamed so _report_add can attach it to the
  # failure report and so the PASS/FAIL table stays aligned. Capturing alone
  # makes a multi-minute validator indistinguishable from a hang, so emit a
  # heartbeat dot every 5s while it works.
  # Poll at 0.5s so a fast validator is not padded to the heartbeat interval,
  # but only emit a dot every 5s so the table stays readable.
  validator_log=$(mktemp)
  bash "$script" "$PROJECT_ROOT" "$MODE" >"$validator_log" 2>&1 &
  validator_pid=$!
  ticks=0
  while kill -0 "$validator_pid" 2>/dev/null; do
    sleep 0.5
    ticks=$((ticks + 1))
    if (( ticks % 10 == 0 )) && kill -0 "$validator_pid" 2>/dev/null; then
      printf '.'
    fi
  done
  wait "$validator_pid" && exit_code=0 || exit_code=$?
  output=$(cat "$validator_log")
  rm -f "$validator_log"
  DURATION=$((SECONDS - START_TIME))

  case "$exit_code" in
    0)
      printf '%s%s PASS%s  %s%ds%s\n' "$C_GREEN" "$ICO_PASS" "$C_RESET" "$C_DIM" "$DURATION" "$C_RESET"
      _report_add "$name" "pass" "$DURATION" ""
      ;;
    2)
      printf '%s%s SKIP  %ds%s\n' "$C_DIM" "$ICO_SKIP" "$DURATION" "$C_RESET"
      _report_add "$name" "skip" "$DURATION" ""
      ;;
    *)
      printf '%s%s FAIL%s  %s%ds%s\n' "$C_RED" "$ICO_FAIL" "$C_RESET" "$C_DIM" "$DURATION" "$C_RESET"
      _report_add "$name" "fail" "$DURATION" "$output"
      FAILED_COUNT=$((FAILED_COUNT + 1))
      ;;
  esac
done

# ─── Failure details ─────────────────────────────────────────────────────────
_print_failures

# ─── Footer ──────────────────────────────────────────────────────────────────
printf '\n'
printf '%s━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n' "$C_BOLD" "$C_RESET"
if [[ "$FAILED_COUNT" -eq 0 ]]; then
  printf '  %s%sAll checks passed.%s\n' "$C_GREEN" "$C_BOLD" "$C_RESET"
else
  printf '  %s%s%d check(s) failed — commit/push blocked.%s\n' \
    "$C_RED" "$C_BOLD" "$FAILED_COUNT" "$C_RESET"
fi
printf '%s━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n' "$C_BOLD" "$C_RESET"
printf '\n'

[[ "$FAILED_COUNT" -eq 0 ]] && exit 0 || exit 1
