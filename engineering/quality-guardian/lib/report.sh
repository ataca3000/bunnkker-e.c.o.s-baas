#!/usr/bin/env bash
# Report state storage and failure output printer.
# Sourced by guardian.sh — do not run directly.

declare -a REPORT_NAMES=()
declare -a REPORT_STATUSES=()
declare -a REPORT_DURATIONS=()
declare -a REPORT_OUTPUTS=()

_report_add() {
  local name="$1" status="$2" duration="$3" output="$4"
  REPORT_NAMES+=("$name")
  REPORT_STATUSES+=("$status")
  REPORT_DURATIONS+=("$duration")
  REPORT_OUTPUTS+=("$output")
}

_print_failures() {
  local i
  for ((i = 0; i < ${#REPORT_NAMES[@]}; i++)); do
    if [[ "${REPORT_STATUSES[$i]}" == "fail" ]] && [[ -n "${REPORT_OUTPUTS[$i]}" ]]; then
      printf '\n  %s─ %s ────────────────────────────────────────%s\n' \
        "$C_DIM" "${REPORT_NAMES[$i]}" "$C_RESET"
      # head -60 closes its stdin after 60 lines, sending SIGPIPE to printf.
      # The || true prevents pipefail from propagating that as a fatal error.
      { printf '%s\n' "${REPORT_OUTPUTS[$i]}" | head -60 | sed 's/^/  /'; } || true
    fi
  done
}
