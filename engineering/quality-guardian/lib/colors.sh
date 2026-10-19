#!/usr/bin/env bash
# ANSI color helpers. Disabled when NO_COLOR is set or TERM=dumb.

if [[ -z "${NO_COLOR:-}" ]] && [[ "${TERM:-}" != "dumb" ]]; then
  C_RED=$'\033[0;31m'
  C_GREEN=$'\033[0;32m'
  C_YELLOW=$'\033[1;33m'
  C_DIM=$'\033[2m'
  C_BOLD=$'\033[1m'
  C_RESET=$'\033[0m'
  ICO_PASS="✓"
  ICO_FAIL="✗"
  ICO_SKIP="○"
  ICO_WARN="⚠"
else
  C_RED='' C_GREEN='' C_YELLOW='' C_DIM='' C_BOLD='' C_RESET=''
  ICO_PASS="[PASS]"
  ICO_FAIL="[FAIL]"
  ICO_SKIP="[SKIP]"
  ICO_WARN="[WARN]"
fi
