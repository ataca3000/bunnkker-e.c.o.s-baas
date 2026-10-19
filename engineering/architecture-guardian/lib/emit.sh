#!/usr/bin/env bash
# Finding emitter — source this in each scanner.
#
# Usage:
#   emit_finding SEVERITY CATEGORY FILE LINE EXPLANATION FIX
#
# SEVERITY: CRITICAL | HIGH | MEDIUM | LOW
# Output format: tab-separated FINDING record read by the main runner.

emit_finding() {
  local sev="${1:-INFO}" cat="${2:-general}" file="${3:--}" line="${4:-0}"
  local expl="${5:-}" fix="${6:-}"
  # Strip any embedded tabs from content fields to protect the delimiter
  expl="${expl//$'\t'/ }"
  fix="${fix//$'\t'/ }"
  printf 'FINDING\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$sev" "$cat" "$file" "$line" "$expl" "$fix"
}
