#!/usr/bin/env bash
# Shared emitters for certification check scripts.
#
# emit_finding SEVERITY CATEGORY FILE LINE EXPLANATION FIX
#   Emits a tab-separated FINDING record consumed by certification.sh
#
# emit_metric  NAME VALUE
#   Emits a METRIC record (name\tvalue) for the JSON/markdown report

emit_finding() {
  local sev="${1:-INFO}" cat="${2:-general}" file="${3:--}" line="${4:-0}"
  local expl="${5:-}" fix="${6:-}"
  expl="${expl//$'\t'/ }"
  fix="${fix//$'\t'/ }"
  printf 'FINDING\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$sev" "$cat" "$file" "$line" "$expl" "$fix"
}

emit_metric() {
  local name="${1:-unknown}" value="${2:-0}"
  printf 'METRIC\t%s\t%s\n' "$name" "$value"
}
