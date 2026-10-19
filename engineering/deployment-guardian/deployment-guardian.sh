#!/usr/bin/env bash
# ECOS Deployment Guardian — Pre-Deployment Readiness Validator
#
# Simulates the production deployment sequence locally and validates
# every service, configuration, and health check before pushing to GitHub Actions.
#
# Usage:
#   ./deployment-guardian.sh [mode]
#
# Modes:
#   fast     Only static checks (env, compose, config)           — no Docker (~10s)
#   full     All checks including live Docker service validation  — default (~3min)
#
# Exit codes:
#   0   all checks passed
#   1   one or more checks failed
set -euo pipefail

GUARDIAN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$GUARDIAN_DIR/../.." && pwd)"
VALIDATOR_DIR="$GUARDIAN_DIR/validators"
REPORTS_DIR="$GUARDIAN_DIR/reports"

source "$GUARDIAN_DIR/lib/colors.sh"

MODE="${1:-full}"
TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
mkdir -p "$REPORTS_DIR"
REPORT_FILE="$REPORTS_DIR/deploy-report-${TIMESTAMP}.md"

case "$MODE" in
  fast)
    VALIDATORS=(01-compose 02-env 08-laravel-caches)
    ;;
  full)
    VALIDATORS=(01-compose 02-env 03-images 04-services 05-health-endpoint 06-ssl 07-storage 08-laravel-caches)
    ;;
  *)
    printf 'Usage: %s [fast|full]\n' "$0" >&2
    exit 1
    ;;
esac

declare -a RESULT_NAMES=()
declare -a RESULT_STATUSES=()
declare -a RESULT_OUTPUTS=()
declare -a RESULT_DURATIONS=()
FAILED_COUNT=0

# ── Header ───────────────────────────────────────────────────────────────────
printf '\n'
printf '%s━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n' "$C_BOLD" "$C_RESET"
printf '  %sECOS Deployment Guardian%s  %smode: %s  %s%s\n' \
  "$C_BOLD" "$C_RESET" "$C_DIM" "$MODE" "$(date '+%H:%M:%S')" "$C_RESET"
printf '%s━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n' "$C_BOLD" "$C_RESET"
printf '\n'

# ── Run validators ─────────────────────────────────────────────────────────────
for validator in "${VALIDATORS[@]}"; do
  script="$VALIDATOR_DIR/${validator}.sh"

  if [[ ! -f "$script" ]]; then
    printf '  %s%s%s  %-28s not found\n' "$C_YELLOW" "$ICO_WARN" "$C_RESET" "$validator"
    continue
  fi

  name=$(grep -m1 '^# NAME:' "$script" 2>/dev/null | sed 's/^# NAME: *//')
  name="${name:-$validator}"

  printf '  %-32s' "$name"

  START=$SECONDS
  output=$(bash "$script" "$PROJECT_ROOT" 2>&1) && exit_code=0 || exit_code=$?
  ELAPSED=$((SECONDS - START))

  case "$exit_code" in
    0)
      printf '%s%s PASS%s  %s%ds%s\n' "$C_GREEN" "$ICO_PASS" "$C_RESET" "$C_DIM" "$ELAPSED" "$C_RESET"
      RESULT_STATUSES+=("pass")
      ;;
    2)
      printf '%s%s SKIP%s  %s%ds%s\n' "$C_DIM" "$ICO_SKIP" "$C_RESET" "$C_DIM" "$ELAPSED" "$C_RESET"
      RESULT_STATUSES+=("skip")
      ;;
    *)
      printf '%s%s FAIL%s  %s%ds%s\n' "$C_RED" "$ICO_FAIL" "$C_RESET" "$C_DIM" "$ELAPSED" "$C_RESET"
      RESULT_STATUSES+=("fail")
      FAILED_COUNT=$((FAILED_COUNT + 1))
      ;;
  esac

  RESULT_NAMES+=("$name")
  RESULT_OUTPUTS+=("$output")
  RESULT_DURATIONS+=("$ELAPSED")
done

# ── Print failure details ──────────────────────────────────────────────────────
for ((i = 0; i < ${#RESULT_NAMES[@]}; i++)); do
  if [[ "${RESULT_STATUSES[$i]}" == "fail" ]] && [[ -n "${RESULT_OUTPUTS[$i]}" ]]; then
    printf '\n  %s─ %s ────────────────────────────────────────%s\n' \
      "$C_DIM" "${RESULT_NAMES[$i]}" "$C_RESET"
    { printf '%s\n' "${RESULT_OUTPUTS[$i]}" | head -40 | sed 's/^/  /'; } || true
  fi
done

# ── Generate Markdown report ──────────────────────────────────────────────────
{
  printf '# ECOS Deployment Readiness Report\n\n'
  printf '**Generated:** %s  \n' "$(date '+%Y-%m-%d %H:%M:%S')"
  printf '**Mode:** %s  \n' "$MODE"
  printf '**Project:** %s\n\n' "$PROJECT_ROOT"

  TOTAL_V=${#RESULT_NAMES[@]}
  PASS_V=0; FAIL_V=0; SKIP_V=0
  for s in "${RESULT_STATUSES[@]}"; do
    case "$s" in
      pass) PASS_V=$((PASS_V+1)) ;;
      fail) FAIL_V=$((FAIL_V+1)) ;;
      skip) SKIP_V=$((SKIP_V+1)) ;;
    esac
  done

  printf '## Summary\n\n'
  printf '| | Count |\n|-|-------|\n'
  printf '| ✅ Passed | %d |\n' "$PASS_V"
  printf '| ❌ Failed | %d |\n' "$FAIL_V"
  printf '| ⏭ Skipped | %d |\n\n' "$SKIP_V"

  if [[ $FAIL_V -eq 0 ]]; then
    printf '> ✅ **Deployment Readiness: GO** — all checks passed.\n\n'
  else
    printf '> ❌ **Deployment Readiness: NO-GO** — %d check(s) failed.\n\n' "$FAIL_V"
  fi

  printf '## Validator Results\n\n'
  printf '| Validator | Status | Duration |\n|-----------|--------|----------|\n'
  for ((i = 0; i < ${#RESULT_NAMES[@]}; i++)); do
    case "${RESULT_STATUSES[$i]}" in
      pass) icon='✅' ;;
      fail) icon='❌' ;;
      skip) icon='⏭' ;;
      *)    icon='?' ;;
    esac
    printf '| %s | %s %s | %ds |\n' \
      "${RESULT_NAMES[$i]}" "$icon" "${RESULT_STATUSES[$i]}" "${RESULT_DURATIONS[$i]}"
  done

  printf '\n## Failure Details\n\n'
  local_fail=0
  for ((i = 0; i < ${#RESULT_NAMES[@]}; i++)); do
    if [[ "${RESULT_STATUSES[$i]}" == "fail" ]]; then
      local_fail=1
      printf '### ❌ %s\n\n```\n%s\n```\n\n' \
        "${RESULT_NAMES[$i]}" "${RESULT_OUTPUTS[$i]}"
    fi
  done
  [[ $local_fail -eq 0 ]] && printf '_No failures._\n\n'

  printf '%s\n' '---'
  printf '_Generated by ECOS Deployment Guardian_\n'
} > "$REPORT_FILE"

# ── Footer ─────────────────────────────────────────────────────────────────────
printf '\n'
printf '%s━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n' "$C_BOLD" "$C_RESET"
if [[ $FAILED_COUNT -eq 0 ]]; then
  printf '  %s%sDeployment Readiness: GO%s\n' "$C_GREEN" "$C_BOLD" "$C_RESET"
else
  printf '  %s%s%d check(s) failed — NOT ready to deploy%s\n' \
    "$C_RED" "$C_BOLD" "$FAILED_COUNT" "$C_RESET"
fi
printf '  %sReport:%s %s\n' "$C_DIM" "$C_RESET" "$REPORT_FILE"
printf '%s━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n' "$C_BOLD" "$C_RESET"
printf '\n'

[[ $FAILED_COUNT -eq 0 ]] && exit 0 || exit 1
