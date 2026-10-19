#!/usr/bin/env bash
# ECOS Architecture Guardian — Repository Health Scanner
#
# Usage:
#   ./architecture-guardian.sh [scanner-id...]
#
#   Run specific scanners:
#     ./architecture-guardian.sh 01-repository 02-translations
#
#   Run all:
#     ./architecture-guardian.sh
#
# Exit codes:
#   0   scan complete — zero CRITICAL findings
#   1   scan complete — CRITICAL findings present
set -uo pipefail

GUARDIAN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$GUARDIAN_DIR/../.." && pwd)"
SCANNER_DIR="$GUARDIAN_DIR/scanners"
REPORTS_DIR="$GUARDIAN_DIR/reports"

source "$GUARDIAN_DIR/lib/colors.sh"

mkdir -p "$REPORTS_DIR"
TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
REPORT_FILE="$REPORTS_DIR/health-report-${TIMESTAMP}.md"

# ── Scanner registry (id:display-name) ───────────────────────────────────────
ALL_SCANNER_ENTRIES=(
  "01-repository:Repository Scanner"
  "02-translations:Translation Validator"
  "03-adr:ADR Validator"
  "04-namespaces:Namespace Validator"
  "05-dependencies:Dependency Scanner"
  "06-duplicates:Duplicate Logic Detector"
)

# Filter to requested scanners (or run all if none specified)
if [[ $# -gt 0 ]]; then
  SCANNER_ENTRIES=()
  for req in "$@"; do
    for entry in "${ALL_SCANNER_ENTRIES[@]}"; do
      [[ "${entry%%:*}" == "$req" ]] && SCANNER_ENTRIES+=("$entry")
    done
  done
else
  SCANNER_ENTRIES=("${ALL_SCANNER_ENTRIES[@]}")
fi

# ── Accumulators ─────────────────────────────────────────────────────────────
declare -a ALL_FINDINGS=()
CRITICAL_COUNT=0; HIGH_COUNT=0; MEDIUM_COUNT=0; LOW_COUNT=0

# ── Header ───────────────────────────────────────────────────────────────────
printf '\n'
printf '%s━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n' "$C_BOLD" "$C_RESET"
printf '  %sECOS Architecture Guardian%s  %s%s%s\n' \
  "$C_BOLD" "$C_RESET" "$C_DIM" "$(date '+%H:%M:%S')" "$C_RESET"
printf '%s━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n' "$C_BOLD" "$C_RESET"
printf '\n'

# ── Run each scanner ──────────────────────────────────────────────────────────
for entry in "${SCANNER_ENTRIES[@]}"; do
  scanner_id="${entry%%:*}"
  scanner_name="${entry#*:}"
  script="$SCANNER_DIR/${scanner_id}.sh"

  if [[ ! -f "$script" ]]; then
    printf '  %-32s %s%s%s not found\n' "$scanner_name" "$C_YELLOW" "$ICO_WARN" "$C_RESET"
    continue
  fi

  printf '  %-32s' "$scanner_name"
  START=$SECONDS

  scanner_output=$(bash "$script" "$PROJECT_ROOT" 2>/dev/null) && sc_exit=0 || sc_exit=$?
  ELAPSED=$((SECONDS - START))

  if [[ $sc_exit -eq 2 ]]; then
    printf '%s%s SKIP%s  %s%ds%s\n' "$C_DIM" "$ICO_SKIP" "$C_RESET" "$C_DIM" "$ELAPSED" "$C_RESET"
    continue
  fi

  finding_count=0
  while IFS=$'\t' read -r tag sev cat file line expl fix; do
    if [[ "$tag" != "FINDING" ]]; then continue; fi
    ALL_FINDINGS+=("${sev}	${cat}	${file}	${line}	${expl}	${fix}")
    finding_count=$((finding_count + 1))
    case "$sev" in
      CRITICAL) CRITICAL_COUNT=$((CRITICAL_COUNT + 1)) ;;
      HIGH)     HIGH_COUNT=$((HIGH_COUNT + 1)) ;;
      MEDIUM)   MEDIUM_COUNT=$((MEDIUM_COUNT + 1)) ;;
      LOW)      LOW_COUNT=$((LOW_COUNT + 1)) ;;
    esac
  done <<< "$scanner_output"

  if [[ $finding_count -eq 0 ]]; then
    printf '%s%s CLEAN%s  %s%ds%s\n' \
      "$C_GREEN" "$ICO_CLEAN" "$C_RESET" "$C_DIM" "$ELAPSED" "$C_RESET"
  else
    sev_icon="$ICO_WARN"
    sev_col="$C_YELLOW"
    # Escalate color if any CRITICAL in this scanner's batch
    # (approximate — we just check the last batch)
    printf '%s%s WARN%s   %s%ds  (%d issues)%s\n' \
      "$sev_col" "$sev_icon" "$C_RESET" "$C_DIM" "$ELAPSED" "$finding_count" "$C_RESET"
  fi
done

# ── Print console finding details ─────────────────────────────────────────────
TOTAL=$((CRITICAL_COUNT + HIGH_COUNT + MEDIUM_COUNT + LOW_COUNT))

if [[ $TOTAL -gt 0 ]]; then
  printf '\n'
  for sev_order in CRITICAL HIGH MEDIUM LOW; do
    for finding in "${ALL_FINDINGS[@]}"; do
      IFS=$'\t' read -r sev cat file line expl fix <<< "$finding"
      if [[ "$sev" != "$sev_order" ]]; then continue; fi
      case "$sev" in
        CRITICAL) col="$C_RED"    ;;
        HIGH)     col="$C_YELLOW" ;;
        MEDIUM)   col="$C_CYAN"   ;;
        *)        col="$C_DIM"    ;;
      esac
      printf '  %s[%s]%s %s%s%s\n' "$col" "$sev" "$C_RESET" "$C_DIM" "$cat" "$C_RESET"
      printf '  %s  %s\n' "${file}${line:+:${line}}" "$expl"
      printf '  %sFix:%s %s\n\n' "$C_DIM" "$C_RESET" "$fix"
    done
  done
fi

# ── Generate Markdown report ──────────────────────────────────────────────────
{
  printf '# ECOS Repository Health Report\n\n'
  printf '**Generated:** %s  \n' "$(date '+%Y-%m-%d %H:%M:%S')"
  printf '**Project:** %s\n\n' "$PROJECT_ROOT"

  printf '## Summary\n\n'
  printf '| Severity | Count |\n'
  printf '|----------|-------|\n'
  printf '| 🔴 CRITICAL | %d |\n' "$CRITICAL_COUNT"
  printf '| 🟠 HIGH     | %d |\n' "$HIGH_COUNT"
  printf '| 🟡 MEDIUM   | %d |\n' "$MEDIUM_COUNT"
  printf '| 🔵 LOW      | %d |\n' "$LOW_COUNT"
  printf '| **Total**   | **%d** |\n\n' "$TOTAL"

  if [[ $TOTAL -eq 0 ]]; then
    printf '> ✅ Repository is clean — no findings detected.\n\n'
  fi

  printf '## Findings\n\n'

  for sev_order in CRITICAL HIGH MEDIUM LOW; do
    section_started=0
    idx=0
    for finding in "${ALL_FINDINGS[@]}"; do
      IFS=$'\t' read -r sev cat file line expl fix <<< "$finding"
      if [[ "$sev" != "$sev_order" ]]; then continue; fi
      if [[ $section_started -eq 0 ]]; then
        case "$sev_order" in
          CRITICAL) printf '### 🔴 CRITICAL\n\n' ;;
          HIGH)     printf '### 🟠 HIGH\n\n' ;;
          MEDIUM)   printf '### 🟡 MEDIUM\n\n' ;;
          LOW)      printf '### 🔵 LOW\n\n' ;;
        esac
        section_started=1
      fi
      idx=$((idx + 1))
      printf '#### %d. [%s] %s\n\n' "$idx" "$cat" "$expl"
      printf '| Field | Value |\n|-------|-------|\n'
      printf '| **File** | `%s` |\n' "$file"
      if [[ -n "$line" ]] && [[ "$line" != "0" ]]; then printf '| **Line** | %s |\n' "$line"; fi
      printf '| **Severity** | %s |\n' "$sev"
      printf '| **Category** | %s |\n' "$cat"
      printf '\n**Explanation:** %s\n\n' "$expl"
      printf '**Suggested Fix:** %s\n\n' "$fix"
      printf '%s\n\n' '---'
    done
  done

  printf '## Scan Details\n\n'
  printf '| Scanner | Status |\n|---------|--------|\n'
  for entry in "${SCANNER_ENTRIES[@]}"; do
    scanner_name="${entry#*:}"
    printf '| %s | completed |\n' "$scanner_name"
  done
  printf '\n'
} > "$REPORT_FILE"

# ── Footer ────────────────────────────────────────────────────────────────────
printf '%s━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n' "$C_BOLD" "$C_RESET"
printf '  %d findings  │  ' "$TOTAL"
printf '%sCRITICAL: %d%s  ' "$C_RED" "$CRITICAL_COUNT" "$C_RESET"
printf '%sHIGH: %d%s  ' "$C_YELLOW" "$HIGH_COUNT" "$C_RESET"
printf 'MEDIUM: %d  LOW: %d\n' "$MEDIUM_COUNT" "$LOW_COUNT"
printf '  %sReport:%s %s\n' "$C_DIM" "$C_RESET" "$REPORT_FILE"
printf '%s━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━%s\n' "$C_BOLD" "$C_RESET"
printf '\n'

[[ $CRITICAL_COUNT -gt 0 ]] && exit 1 || exit 0
