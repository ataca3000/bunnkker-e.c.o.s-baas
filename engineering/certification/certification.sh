#!/usr/bin/env bash
# ECOS Engineering Certification Engine
#
# Combines Quality Guardian, Architecture Guardian, and Deployment Guardian
# into a single pre-release certification with an overall quality score.
#
# Usage:
#   ./certification.sh [options]
#
# Options:
#   --fast         Skip slow checks: TypeScript (65s), PHPStan, Pint
#   --no-deploy    Skip deployment validators (useful in CI without Docker)
#   --json-only    Write JSON report only; suppress console progress output
#   --report-dir   Custom directory for report output (default: ./reports)
#
# Exit codes:
#   0   Certification complete — release ready
#   1   Certification complete — NOT release ready (blockers exist)
#   2   Certification could not run (missing dependencies)
set -uo pipefail

CERT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$CERT_DIR/../.." && pwd)"

source "$CERT_DIR/lib/colors.sh"

# ── Guardian locations ─────────────────────────────────────────────────────────
QG="$CERT_DIR/../quality-guardian"
AG="$CERT_DIR/../architecture-guardian"
DG="$CERT_DIR/../deployment-guardian"

# ── Parse arguments ───────────────────────────────────────────────────────────
FAST=0
NO_DEPLOY=0
JSON_ONLY=0
REPORT_DIR="$CERT_DIR/reports"

for arg in "$@"; do
  case "$arg" in
    --fast)       FAST=1 ;;
    --no-deploy)  NO_DEPLOY=1 ;;
    --json-only)  JSON_ONLY=1 ;;
    --report-dir=*) REPORT_DIR="${arg#--report-dir=}" ;;
    *) printf 'Unknown option: %s\n' "$arg" >&2; exit 2 ;;
  esac
done

mkdir -p "$REPORT_DIR"
TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
REPORT_JSON="$REPORT_DIR/cert-${TIMESTAMP}.json"
REPORT_MD="$REPORT_DIR/cert-${TIMESTAMP}.md"

# ── Category result storage (parallel arrays) ─────────────────────────────────
declare -a CAT_KEYS=()       # machine key: "php", "laravel", etc.
declare -a CAT_LABELS=()     # display label: "PHP", "Laravel", etc.
declare -a CAT_SCORES=()     # 0..100
declare -a CAT_STATUSES=()   # PASS | WARN | FAIL | SKIP
declare -a CAT_WEIGHTS=()    # contribution to overall score
declare -a CAT_DETAILS=()    # failure/warning detail text

# Global metrics dict (key=value pairs, later written to JSON)
declare -A METRICS=()

# Blocker list for release readiness verdict
declare -a BLOCKERS=()

# Individual findings for JSON output (Engineering OS import)
declare -a CERT_FINDINGS_JSON=()

# ── Helpers ───────────────────────────────────────────────────────────────────

# Print a category result line to console (skipped in --json-only mode)
print_line() {
  [[ $JSON_ONLY -eq 1 ]] && return
  local label="$1" score="$2" status="$3"
  local icon col
  case "$status" in
    PASS) icon="$ICO_PASS" col="$C_GREEN" ;;
    WARN) icon="$ICO_WARN" col="$C_YELLOW" ;;
    FAIL) icon="$ICO_FAIL" col="$C_RED" ;;
    SKIP) icon="$ICO_SKIP" col="$C_DIM" ;;
    *)    icon="?" col="$C_DIM" ;;
  esac
  printf '  %-34s  %s%s %s%s   %s%3d/100%s\n' \
    "${label}." "$col" "$icon" "$status" "$C_RESET" "$C_DIM" "$score" "$C_RESET"
}

# Add category result to parallel arrays
add_cat() {
  local key="$1" label="$2" score="$3" status="$4" weight="$5" detail="${6:-}"
  CAT_KEYS+=("$key")
  CAT_LABELS+=("$label")
  CAT_SCORES+=("$score")
  CAT_STATUSES+=("$status")
  CAT_WEIGHTS+=("$weight")
  CAT_DETAILS+=("$detail")
  print_line "$label" "$score" "$status"
}

# Run a single quality/deployment validator script
# Sets: _EC (exit code), _OUT (output text)
run_validator() {
  local script="$1"
  _OUT=$(bash "$script" "$PROJECT_ROOT" 2>&1) && _EC=0 || _EC=$?
}

# Run an architecture scanner and accumulate finding counts
# Sets: _CRITICAL _HIGH _MEDIUM _LOW _DETAIL (from FINDING lines)
# Also accumulates METRIC lines into METRICS[] and CERT_FINDINGS_JSON[]
run_scanner() {
  local script="$1"
  _CRITICAL=0; _HIGH=0; _MEDIUM=0; _LOW=0; _DETAIL=""
  local raw
  raw=$(bash "$script" "$PROJECT_ROOT" 2>/dev/null) || true
  while IFS=$'\t' read -r tag f1 f2 f3 f4 f5 f6; do
    case "$tag" in
      FINDING)
        case "$f1" in
          CRITICAL) _CRITICAL=$((_CRITICAL+1)) ;;
          HIGH)     _HIGH=$((_HIGH+1)) ;;
          MEDIUM)   _MEDIUM=$((_MEDIUM+1)) ;;
          LOW)      _LOW=$((_LOW+1)) ;;
        esac
        if [[ "$f1" == "CRITICAL" ]] || [[ "$f1" == "HIGH" ]]; then
          _DETAIL+="${f1} [${f2}] ${f3}${f4:+:${f4}} — ${f5}"$'\n'
        fi
        # Collect for JSON findings array
        local safe_title="${f5//\"/\\\"}" safe_fix="${f6//\"/\\\"}"
        CERT_FINDINGS_JSON+=("{\"severity\":\"${f1}\",\"category\":\"${f2}\",\"file\":\"${f3}\",\"line\":${f4:-0},\"title\":\"${safe_title:0:200}\",\"description\":\"${safe_title}\",\"fix\":\"${safe_fix}\"}")
        ;;
      METRIC)
        METRICS["$f1"]="$f2"
        ;;
    esac
  done <<< "$raw"
}

# Run a certification check script
# Sets: _CRITICAL _HIGH _MEDIUM _LOW _DETAIL (from FINDING lines)
# Also accumulates METRIC lines into METRICS[] and CERT_FINDINGS_JSON[]
run_check() {
  local script="$1"
  _CRITICAL=0; _HIGH=0; _MEDIUM=0; _LOW=0; _DETAIL=""
  local raw
  raw=$(bash "$script" "$PROJECT_ROOT" 2>&1) || true
  while IFS=$'\t' read -r tag f1 f2 f3 f4 f5 f6; do
    case "$tag" in
      FINDING)
        case "$f1" in
          CRITICAL) _CRITICAL=$((_CRITICAL+1)) ;;
          HIGH)     _HIGH=$((_HIGH+1)) ;;
          MEDIUM)   _MEDIUM=$((_MEDIUM+1)) ;;
          LOW)      _LOW=$((_LOW+1)) ;;
        esac
        _DETAIL+="${f1} [${f2}] ${f5}"$'\n'
        # Collect for JSON findings array
        local safe_title="${f5//\"/\\\"}" safe_fix="${f6//\"/\\\"}"
        CERT_FINDINGS_JSON+=("{\"severity\":\"${f1}\",\"category\":\"${f2}\",\"file\":\"${f3}\",\"line\":${f4:-0},\"title\":\"${safe_title:0:200}\",\"description\":\"${safe_title}\",\"fix\":\"${safe_fix}\"}")
        ;;
      METRIC)
        METRICS["$f1"]="$f2"
        ;;
    esac
  done <<< "$raw"
}

# Score from finding counts with caps to prevent one noisy scanner tanking everything
score_from_findings() {
  local crit="$1" high="$2" med="$3"
  local high_pen med_pen
  high_pen=$(( high > 30 ? 30 : high ))
  med_pen=$(( med / 3 > 15 ? 15 : med / 3 ))
  local s=$(( 100 - crit * 20 - high_pen - med_pen ))
  [[ $s -lt 0 ]] && s=0
  printf '%d' "$s"
}

# Determine PASS/WARN/FAIL from a 0-100 score
status_from_score() {
  local score="$1"
  if   [[ $score -eq 100 ]]; then printf 'PASS'
  elif [[ $score -ge 80  ]]; then printf 'WARN'
  else                             printf 'FAIL'
  fi
}

# ── Header ────────────────────────────────────────────────────────────────────
BRANCH=$(git -C "$PROJECT_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
COMMIT=$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || echo "unknown")
GENERATED=$(date '+%Y-%m-%d %H:%M:%S')

if [[ $JSON_ONLY -eq 0 ]]; then
  printf '\n'
  printf '%s══════════════════════════════════════════════════════════════%s\n' "$C_BOLD" "$C_RESET"
  printf '  %sECOS ENGINEERING CERTIFICATION%s\n' "$C_BOLD" "$C_RESET"
  printf '  %sBranch:%s %-20s %sCommit:%s %s\n' "$C_DIM" "$C_RESET" "$BRANCH" "$C_DIM" "$C_RESET" "$COMMIT"
  printf '  %s%s%s\n' "$C_DIM" "$GENERATED" "$C_RESET"
  printf '%s══════════════════════════════════════════════════════════════%s\n' "$C_BOLD" "$C_RESET"
  printf '\n'
fi

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 1 — PHP Quality
# Validators: 01-php-syntax, 04-pint, 05-phpstan
# ══════════════════════════════════════════════════════════════════════════════
PHP_PASS=0 PHP_FAIL=0 PHP_DETAIL=""

run_validator "$QG/validators/01-php-syntax.sh"
if [[ $_EC -eq 0 ]]; then PHP_PASS=$((PHP_PASS+1))
elif [[ $_EC -ne 2 ]]; then PHP_FAIL=$((PHP_FAIL+1)); PHP_DETAIL+="PHP Syntax: $_OUT"$'\n'; fi

if [[ $FAST -eq 0 ]]; then
  run_validator "$QG/validators/04-pint.sh"
  if [[ $_EC -eq 0 ]]; then PHP_PASS=$((PHP_PASS+1))
  elif [[ $_EC -ne 2 ]]; then PHP_FAIL=$((PHP_FAIL+1)); PHP_DETAIL+="Pint: $(echo "$_OUT" | tail -5)"$'\n'; fi

  run_validator "$QG/validators/05-phpstan.sh"
  if [[ $_EC -eq 0 ]]; then PHP_PASS=$((PHP_PASS+1))
  elif [[ $_EC -ne 2 ]]; then PHP_FAIL=$((PHP_FAIL+1)); PHP_DETAIL+="PHPStan: $(echo "$_OUT" | tail -5)"$'\n'; fi
fi

if [[ $PHP_FAIL -eq 0 ]]; then
  PHP_SCORE=100; PHP_STATUS="PASS"
else
  PHP_SCORE=$(( PHP_PASS * 100 / (PHP_PASS + PHP_FAIL) ))
  PHP_STATUS="FAIL"
  BLOCKERS+=("PHP: code quality checks failed (fix Pint/PHPStan/syntax errors)")
fi
add_cat "php" "PHP" "$PHP_SCORE" "$PHP_STATUS" 12 "$PHP_DETAIL"

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 2 — Laravel Bootstrap
# ══════════════════════════════════════════════════════════════════════════════
run_validator "$QG/validators/03-laravel.sh"
case "$_EC" in
  0) add_cat "laravel" "Laravel" 100 "PASS" 6 "" ;;
  2) add_cat "laravel" "Laravel" 100 "SKIP" 6 "" ;;
  *) add_cat "laravel" "Laravel" 0 "FAIL" 6 "$(echo "$_OUT" | tail -10)"
     BLOCKERS+=("Laravel: bootstrap failed — check .env and DB connectivity") ;;
esac

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 3 — TypeScript
# ══════════════════════════════════════════════════════════════════════════════
if [[ $FAST -eq 1 ]]; then
  add_cat "typescript" "TypeScript" 100 "SKIP" 12 ""
else
  run_validator "$QG/validators/07-typescript.sh"
  case "$_EC" in
    0) add_cat "typescript" "TypeScript" 100 "PASS" 12 "" ;;
    2) add_cat "typescript" "TypeScript" 100 "SKIP" 12 "" ;;
    *) add_cat "typescript" "TypeScript" 0 "FAIL" 12 "$(echo "$_OUT" | grep "error TS" | head -10)"
       BLOCKERS+=("TypeScript: type errors found — run 'tsc -b' and fix all errors") ;;
  esac
fi

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 4 — React / ESLint
# ══════════════════════════════════════════════════════════════════════════════
run_validator "$QG/validators/06-eslint.sh"
case "$_EC" in
  0) add_cat "eslint" "React / ESLint" 100 "PASS" 8 "" ;;
  2) add_cat "eslint" "React / ESLint" 100 "SKIP" 8 "" ;;
  *) add_cat "eslint" "React / ESLint" 0 "FAIL" 8 "$(echo "$_OUT" | tail -15)"
     BLOCKERS+=("ESLint: linting errors found — run 'npm run lint' in frontend/") ;;
esac

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 5 — Architecture (ADR + Namespace scanners)
# ══════════════════════════════════════════════════════════════════════════════
ARCH_CRITICAL=0; ARCH_HIGH=0; ARCH_MEDIUM=0; ARCH_LOW=0; ARCH_DETAIL=""

for scanner in 03-adr 04-namespaces; do
  run_scanner "$AG/scanners/${scanner}.sh"
  ARCH_CRITICAL=$((ARCH_CRITICAL + _CRITICAL))
  ARCH_HIGH=$((ARCH_HIGH + _HIGH))
  ARCH_MEDIUM=$((ARCH_MEDIUM + _MEDIUM))
  ARCH_LOW=$((ARCH_LOW + _LOW))
  ARCH_DETAIL+="$_DETAIL"
done

ARCH_SCORE=$(score_from_findings "$ARCH_CRITICAL" "$ARCH_HIGH" "$ARCH_MEDIUM")
ARCH_STATUS=$(status_from_score "$ARCH_SCORE")
[[ $ARCH_CRITICAL -gt 0 ]] && BLOCKERS+=("Architecture: ${ARCH_CRITICAL} CRITICAL violations must be resolved")

add_cat "architecture" "Architecture" "$ARCH_SCORE" "$ARCH_STATUS" 12 \
  "${ARCH_CRITICAL} critical · ${ARCH_HIGH} high · ${ARCH_MEDIUM} medium findings"

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 6 — Repository Health (dead code + duplicate logic)
# ══════════════════════════════════════════════════════════════════════════════
REPO_CRITICAL=0; REPO_HIGH=0; REPO_MEDIUM=0; REPO_LOW=0; REPO_DETAIL=""

for scanner in 01-repository 06-duplicates; do
  run_scanner "$AG/scanners/${scanner}.sh"
  REPO_CRITICAL=$((REPO_CRITICAL + _CRITICAL))
  REPO_HIGH=$((REPO_HIGH + _HIGH))
  REPO_MEDIUM=$((REPO_MEDIUM + _MEDIUM))
  REPO_LOW=$((REPO_LOW + _LOW))
  REPO_DETAIL+="$_DETAIL"
done

DEAD_FILES="${METRICS[dead_frontend_files]:-0}"
REPO_SCORE=$(score_from_findings "$REPO_CRITICAL" "$REPO_HIGH" "$REPO_MEDIUM")
# Dead files are LOW severity — apply a small additional penalty
DEAD_PEN=$(( DEAD_FILES > 20 ? 20 : DEAD_FILES ))
REPO_SCORE=$(( REPO_SCORE - DEAD_PEN ))
[[ $REPO_SCORE -lt 0 ]] && REPO_SCORE=0
REPO_STATUS=$(status_from_score "$REPO_SCORE")

REPO_HEALTH_PCT=100
[[ $DEAD_FILES -gt 0 ]] && REPO_HEALTH_PCT=$(( 100 - DEAD_PEN ))
METRICS["repo_health_pct"]="$REPO_HEALTH_PCT"

add_cat "repository" "Repository" "$REPO_SCORE" "$REPO_STATUS" 8 \
  "${DEAD_FILES} dead files · ${REPO_HIGH} high findings"

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 7 — Translations
# ══════════════════════════════════════════════════════════════════════════════
run_scanner "$AG/scanners/02-translations.sh"
TRANS_SCORE=$(score_from_findings "$_CRITICAL" "$_HIGH" "$_MEDIUM")
# Translations are not release blockers but we penalize missing keys more visibly
TRANS_PENALTY=$(( _HIGH * 3 + _MEDIUM * 1 ))
TRANS_SCORE=$(( 100 - TRANS_PENALTY ))
[[ $TRANS_SCORE -lt 60 ]] && TRANS_SCORE=60
TRANS_STATUS=$(status_from_score "$TRANS_SCORE")

MISSING_KEYS=$(( _HIGH + _MEDIUM ))
METRICS["missing_translation_keys"]="$MISSING_KEYS"

add_cat "translations" "Translations" "$TRANS_SCORE" "$TRANS_STATUS" 5 \
  "${_CRITICAL} critical · ${_HIGH} high · ${_MEDIUM} medium findings"

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 8 — Docker Compose
# ══════════════════════════════════════════════════════════════════════════════
if [[ $NO_DEPLOY -eq 1 ]]; then
  add_cat "docker" "Docker" 100 "SKIP" 5 ""
else
  run_validator "$DG/validators/01-compose.sh"
  case "$_EC" in
    0) add_cat "docker" "Docker" 100 "PASS" 5 "" ;;
    2) add_cat "docker" "Docker" 100 "SKIP" 5 "" ;;
    *) add_cat "docker" "Docker" 0 "FAIL" 5 "$(echo "$_OUT" | tail -5)"
       BLOCKERS+=("Docker: docker-compose.yml validation failed") ;;
  esac
fi

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 9 — Deployment (env config + Laravel caches)
# ══════════════════════════════════════════════════════════════════════════════
if [[ $NO_DEPLOY -eq 1 ]]; then
  add_cat "deployment" "Deployment" 100 "SKIP" 8 ""
else
  DEPLOY_PASS=0; DEPLOY_FAIL=0; DEPLOY_DETAIL=""
  for v in 02-env 08-laravel-caches; do
    run_validator "$DG/validators/${v}.sh"
    if [[ $_EC -eq 0 ]]; then DEPLOY_PASS=$((DEPLOY_PASS+1))
    elif [[ $_EC -ne 2 ]]; then
      DEPLOY_FAIL=$((DEPLOY_FAIL+1))
      DEPLOY_DETAIL+="$(echo "$_OUT" | grep "FAIL:" | head -3)"$'\n'
    fi
  done

  if [[ $DEPLOY_FAIL -eq 0 ]]; then
    add_cat "deployment" "Deployment" 100 "PASS" 8 ""
  else
    add_cat "deployment" "Deployment" 0 "FAIL" 8 "$DEPLOY_DETAIL"
    BLOCKERS+=("Deployment: ${DEPLOY_FAIL} environment/config check(s) failed — see details above")
  fi
fi

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 10 — Security
# ══════════════════════════════════════════════════════════════════════════════
run_check "$CERT_DIR/checks/01-security.sh"
SEC_SCORE=$(( 100 - _CRITICAL * 50 - _HIGH * 15 - _MEDIUM * 5 ))
[[ $SEC_SCORE -lt 0 ]] && SEC_SCORE=0
SEC_STATUS=$(status_from_score "$SEC_SCORE")

[[ $_CRITICAL -gt 0 ]] && BLOCKERS+=("Security: ${_CRITICAL} CRITICAL vulnerability — must fix before any release")
[[ $_HIGH -gt 0 ]] && BLOCKERS+=("Security: ${_HIGH} HIGH vulnerability — strongly recommended to fix before release")

add_cat "security" "Security" "$SEC_SCORE" "$SEC_STATUS" 14 \
  "${_CRITICAL} critical · ${_HIGH} high · ${_MEDIUM} medium findings"

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 11 — Performance
# ══════════════════════════════════════════════════════════════════════════════
run_check "$CERT_DIR/checks/02-performance.sh"
PERF_MED=$(( _MEDIUM > 5 ? 5 : _MEDIUM ))
PERF_SCORE=$(( 100 - _CRITICAL * 20 - _HIGH * 10 - PERF_MED * 4 ))
[[ $PERF_SCORE -lt 0 ]] && PERF_SCORE=0
[[ $PERF_SCORE -gt 100 ]] && PERF_SCORE=100
PERF_STATUS=$(status_from_score "$PERF_SCORE")

add_cat "performance" "Performance" "$PERF_SCORE" "$PERF_STATUS" 5 \
  "${METRICS[large_php_files]:-0} large PHP files · ${METRICS[large_tsx_files]:-0} large TSX files"

# ══════════════════════════════════════════════════════════════════════════════
# PHASE 12 — Technical Debt
# ══════════════════════════════════════════════════════════════════════════════
run_check "$CERT_DIR/checks/03-tech-debt.sh"
DEBT_SCORE=$(( 100 - _HIGH * 15 - _MEDIUM * 10 - _LOW * 2 ))
[[ $DEBT_SCORE -lt 50 ]] && DEBT_SCORE=50
[[ $DEBT_SCORE -gt 100 ]] && DEBT_SCORE=100
DEBT_STATUS=$(status_from_score "$DEBT_SCORE")

add_cat "tech_debt" "Technical Debt" "$DEBT_SCORE" "$DEBT_STATUS" 5 \
  "TODO: ${METRICS[todo_count]:-?} · Baseline: ${METRICS[phpstan_baseline_issues]:-0} · Large files: ${METRICS[large_files_total]:-0}"

# ══════════════════════════════════════════════════════════════════════════════
# OVERALL SCORE (weighted average)
# ══════════════════════════════════════════════════════════════════════════════
TOTAL_WEIGHTED=0
TOTAL_WEIGHT=0
for ((i = 0; i < ${#CAT_KEYS[@]}; i++)); do
  s="${CAT_SCORES[$i]}"
  w="${CAT_WEIGHTS[$i]}"
  [[ "${CAT_STATUSES[$i]}" == "SKIP" ]] && continue
  TOTAL_WEIGHTED=$(( TOTAL_WEIGHTED + s * w ))
  TOTAL_WEIGHT=$(( TOTAL_WEIGHT + w ))
done

[[ $TOTAL_WEIGHT -eq 0 ]] && OVERALL_SCORE=0 || OVERALL_SCORE=$(( TOTAL_WEIGHTED / TOTAL_WEIGHT ))

# Release ready: score >= 80 AND no blockers
RELEASE_READY=0
[[ ${#BLOCKERS[@]} -eq 0 ]] && [[ $OVERALL_SCORE -ge 80 ]] && RELEASE_READY=1

# ── Metrics section ───────────────────────────────────────────────────────────
if [[ $JSON_ONLY -eq 0 ]]; then
  printf '\n'
  printf '  %s─ Metrics ──────────────────────────────────────────────────────%s\n' "$C_DIM" "$C_RESET"
  printf '  %-38s  %s\n' "Dead Code Findings." "${DEAD_FILES} file(s)"
  printf '  %-38s  %s\n' "Architecture Findings." \
    "${ARCH_CRITICAL} critical · ${ARCH_HIGH} high · ${ARCH_MEDIUM} med · ${ARCH_LOW} low"
  printf '  %-38s  %s%%\n' "Repository Health." "$REPO_HEALTH_PCT"
  printf '  %-38s  %s\n' "TODO / FIXME Count." "${METRICS[todo_count]:-?}"
  printf '  %-38s  %s\n' "PHPStan Baseline Issues." "${METRICS[phpstan_baseline_issues]:-0}"
  printf '  %-38s  %s\n' "PHP Files." "${METRICS[total_php_files]:-?}"
  printf '  %-38s  %s\n' "TS / TSX Files." "${METRICS[total_tsx_files]:-?}"
  printf '  %-38s  %s\n' "Missing Translation Keys." "${METRICS[missing_translation_keys]:-0}"
fi

# ══════════════════════════════════════════════════════════════════════════════
# JSON REPORT
# ══════════════════════════════════════════════════════════════════════════════
{
  printf '{\n'
  printf '  "ecos_certification": {\n'
  printf '    "generated_at": "%s",\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  printf '    "branch": "%s",\n' "$BRANCH"
  printf '    "commit": "%s",\n' "$COMMIT"
  printf '    "mode": "%s",\n' "$(
    [[ $FAST -eq 1 ]] && echo 'fast' || echo 'full'
  )"
  printf '    "categories": {\n'
  for ((i = 0; i < ${#CAT_KEYS[@]}; i++)); do
    comma=','
    [[ $i -eq $(( ${#CAT_KEYS[@]} - 1 )) ]] && comma=''
    printf '      "%s": { "score": %d, "status": "%s", "weight": %d }%s\n' \
      "${CAT_KEYS[$i]}" "${CAT_SCORES[$i]}" "${CAT_STATUSES[$i]}" "${CAT_WEIGHTS[$i]}" "$comma"
  done
  printf '    },\n'
  printf '    "metrics": {\n'
  printf '      "dead_code_files": %d,\n' "$DEAD_FILES"
  printf '      "arch_critical": %d,\n' "$ARCH_CRITICAL"
  printf '      "arch_high": %d,\n' "$ARCH_HIGH"
  printf '      "arch_medium": %d,\n' "$ARCH_MEDIUM"
  printf '      "arch_low": %d,\n' "$ARCH_LOW"
  printf '      "arch_total": %d,\n' "$(( ARCH_CRITICAL + ARCH_HIGH + ARCH_MEDIUM + ARCH_LOW ))"
  printf '      "repo_health_pct": %d,\n' "$REPO_HEALTH_PCT"
  printf '      "todo_count": %s,\n' "${METRICS[todo_count]:-0}"
  printf '      "phpstan_baseline_issues": %s,\n' "${METRICS[phpstan_baseline_issues]:-0}"
  printf '      "missing_translation_keys": %s,\n' "${METRICS[missing_translation_keys]:-0}"
  printf '      "total_php_files": %s,\n' "${METRICS[total_php_files]:-0}"
  printf '      "total_tsx_files": %s\n' "${METRICS[total_tsx_files]:-0}"
  printf '    },\n'
  printf '    "overall_score": %d,\n' "$OVERALL_SCORE"
  printf '    "release_ready": %s,\n' "$( [[ $RELEASE_READY -eq 1 ]] && echo 'true' || echo 'false' )"
  # Individual findings array for Engineering OS import
  printf '    "findings": ['
  if [[ ${#CERT_FINDINGS_JSON[@]} -eq 0 ]]; then
    printf '],\n'
  else
    printf '\n'
    for ((i = 0; i < ${#CERT_FINDINGS_JSON[@]}; i++)); do
      comma=','
      [[ $i -eq $(( ${#CERT_FINDINGS_JSON[@]} - 1 )) ]] && comma=''
      printf '      %s%s\n' "${CERT_FINDINGS_JSON[$i]}" "$comma"
    done
    printf '    ],\n'
  fi
  printf '    "blockers": ['
  if [[ ${#BLOCKERS[@]} -eq 0 ]]; then
    printf ']'
  else
    printf '\n'
    for ((i = 0; i < ${#BLOCKERS[@]}; i++)); do
      comma=','
      [[ $i -eq $(( ${#BLOCKERS[@]} - 1 )) ]] && comma=''
      # Escape double quotes in blocker text
      safe="${BLOCKERS[$i]//\"/\\\"}"
      printf '      "%s"%s\n' "$safe" "$comma"
    done
    printf '    ]'
  fi
  printf ',\n'
  printf '    "report_files": {\n'
  printf '      "json": "%s",\n' "$REPORT_JSON"
  printf '      "markdown": "%s"\n' "$REPORT_MD"
  printf '    }\n'
  printf '  }\n'
  printf '}\n'
} > "$REPORT_JSON"

# ══════════════════════════════════════════════════════════════════════════════
# MARKDOWN REPORT
# ══════════════════════════════════════════════════════════════════════════════
{
  printf '# ECOS Engineering Certification\n\n'
  printf '**Generated:** %s  \n' "$GENERATED"
  printf '**Branch:** %s  |  **Commit:** %s  \n\n' "$BRANCH" "$COMMIT"

  printf '## Summary\n\n'
  printf '| Category | Score | Status | Weight |\n'
  printf '|----------|-------|--------|--------|\n'
  for ((i = 0; i < ${#CAT_KEYS[@]}; i++)); do
    case "${CAT_STATUSES[$i]}" in
      PASS) icon='✅' ;;
      WARN) icon='⚠️' ;;
      FAIL) icon='❌' ;;
      SKIP) icon='⏭' ;;
      *)    icon='?' ;;
    esac
    printf '| %s | %d/100 | %s %s | %d%% |\n' \
      "${CAT_LABELS[$i]}" "${CAT_SCORES[$i]}" "$icon" "${CAT_STATUSES[$i]}" "${CAT_WEIGHTS[$i]}"
  done

  printf '\n## Overall Score\n\n'
  printf '**%d / 100** — Release Ready: **%s**\n\n' \
    "$OVERALL_SCORE" "$( [[ $RELEASE_READY -eq 1 ]] && echo 'YES ✅' || echo 'NO ❌' )"

  if [[ ${#BLOCKERS[@]} -gt 0 ]]; then
    printf '### Blockers\n\n'
    for b in "${BLOCKERS[@]}"; do printf '%s\n' "- $b"; done
    printf '\n'
  fi

  printf '## Metrics\n\n'
  printf '| Metric | Value |\n|--------|-------|\n'
  printf '| Dead Code Files | %d |\n' "$DEAD_FILES"
  printf '| Architecture Findings | %d total (%d critical, %d high, %d medium, %d low) |\n' \
    "$(( ARCH_CRITICAL+ARCH_HIGH+ARCH_MEDIUM+ARCH_LOW ))" "$ARCH_CRITICAL" "$ARCH_HIGH" "$ARCH_MEDIUM" "$ARCH_LOW"
  printf '| Repository Health | %d%% |\n' "$REPO_HEALTH_PCT"
  printf '| TODO / FIXME Count | %s |\n' "${METRICS[todo_count]:-?}"
  printf '| PHPStan Baseline Issues | %s |\n' "${METRICS[phpstan_baseline_issues]:-0}"
  printf '| Missing Translation Keys | %s |\n' "${METRICS[missing_translation_keys]:-0}"
  printf '| Total PHP Files | %s |\n' "${METRICS[total_php_files]:-?}"
  printf '| Total TS/TSX Files | %s |\n' "${METRICS[total_tsx_files]:-?}"

  printf '\n## Failure Details\n\n'
  any_fail=0
  for ((i = 0; i < ${#CAT_KEYS[@]}; i++)); do
    [[ "${CAT_STATUSES[$i]}" != "FAIL" ]] && [[ "${CAT_STATUSES[$i]}" != "WARN" ]] && continue
    [[ -z "${CAT_DETAILS[$i]}" ]] && continue
    any_fail=1
    printf '### %s (%s)\n\n```\n%s\n```\n\n' \
      "${CAT_LABELS[$i]}" "${CAT_STATUSES[$i]}" "${CAT_DETAILS[$i]}"
  done
  [[ $any_fail -eq 0 ]] && printf '_No failures or warnings with detail._\n\n'

  printf '%s\n' '---'
  printf '_Generated by ECOS Engineering Certification Engine_\n'
} > "$REPORT_MD"

# ══════════════════════════════════════════════════════════════════════════════
# VERDICT
# ══════════════════════════════════════════════════════════════════════════════
if [[ $JSON_ONLY -eq 0 ]]; then
  printf '\n'
  printf '%s══════════════════════════════════════════════════════════════%s\n' "$C_BOLD" "$C_RESET"

  # Quality Score line
  if [[ $OVERALL_SCORE -ge 90 ]]; then
    score_col="$C_GREEN"
  elif [[ $OVERALL_SCORE -ge 70 ]]; then
    score_col="$C_YELLOW"
  else
    score_col="$C_RED"
  fi
  printf '  Quality Score:   %s%s%d / 100%s\n' "$C_BOLD" "$score_col" "$OVERALL_SCORE" "$C_RESET"

  # Release Ready line
  if [[ $RELEASE_READY -eq 1 ]]; then
    printf '  Release Ready:   %s%sYES%s\n' "$C_GREEN" "$C_BOLD" "$C_RESET"
  else
    printf '  Release Ready:   %s%sNO%s\n' "$C_RED" "$C_BOLD" "$C_RESET"
    for b in "${BLOCKERS[@]}"; do
      printf '    %s→%s %s\n' "$C_DIM" "$C_RESET" "$b"
    done
  fi

  printf '\n  %sReports:%s\n' "$C_DIM" "$C_RESET"
  printf '    JSON:      %s\n' "$REPORT_JSON"
  printf '    Markdown:  %s\n' "$REPORT_MD"
  printf '%s══════════════════════════════════════════════════════════════%s\n' "$C_BOLD" "$C_RESET"
  printf '\n'
fi

[[ $RELEASE_READY -eq 1 ]] && exit 0 || exit 1
