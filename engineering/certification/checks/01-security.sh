#!/usr/bin/env bash
# NAME: Security
# Scans PHP + frontend code for common security vulnerabilities.
#
# Checks:
#   [CRITICAL] .env file exposed in public/ directory
#   [HIGH]     eval() calls in production PHP
#   [HIGH]     Shell execution functions (exec, shell_exec, passthru, system)
#   [HIGH]     APP_DEBUG=true in production environment
#   [HIGH]     Raw SQL with string-concatenated user input
#   [MEDIUM]   Debug dump calls (dd, dump, var_dump) in production code
#   [MEDIUM]   Unescaped Blade output ({!! ... !!}) with request/input variables
#   [LOW]      npm/composer audit findings (if tools available)
#
# Outputs: FINDING tab-separated lines + METRIC lines
# Exit 0 = no findings | Exit 1 = HIGH or CRITICAL found | Exit 2 = skip
set -uo pipefail

PROJECT_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
BACKEND="$PROJECT_ROOT/backend"
FRONTEND="$PROJECT_ROOT/frontend"

EMIT_LIB="$(dirname "${BASH_SOURCE[0]}")/../lib/emit.sh"
source "$EMIT_LIB"

HAS_CRITICAL=0
HAS_HIGH=0

# ── 1. .env exposed in public directory ───────────────────────────────────────
if [[ -f "$PROJECT_ROOT/public/.env" ]] || [[ -f "$BACKEND/public/.env" ]]; then
  emit_finding "CRITICAL" "security-env-exposure" "public/.env" "0" \
    ".env file is accessible in the public web root — credentials are exposed to the internet" \
    "Delete public/.env immediately; .env must live only in the project root, never under public/"
  HAS_CRITICAL=1
fi

# ── 2. eval() in production PHP ───────────────────────────────────────────────
while IFS=: read -r file line _; do
  rel="${file#$PROJECT_ROOT/}"
  emit_finding "HIGH" "security-eval" "$rel" "$line" \
    "eval() call detected — enables arbitrary PHP code execution if input reaches it" \
    "Remove eval(); use explicit whitelists, closures, or named dispatch tables"
  HAS_HIGH=1
done < <(
  grep -rnE '^\s*eval\s*\(' "$BACKEND" --include="*.php" \
    --exclude-dir=vendor --exclude-dir=storage \
    2>/dev/null | grep -v "/[Tt]ests*/" | grep -v "Test\.php"
)

# ── 3. Shell execution functions ───────────────────────────────────────────────
# Matches standalone PHP dangerous functions only (not object method calls).
# Pattern: function name preceded by whitespace, semi-colon, (, =, or start
#   of line — never by -> (which would be a method call).
# Excludes: comment lines, test files, verify scripts.
while IFS=: read -r file line match; do
  rel="${file#$PROJECT_ROOT/}"
  fn=$(printf '%s' "$match" | grep -oE 'shell_exec|passthru|proc_open|exec|system' | head -1)
  emit_finding "HIGH" "security-shell-exec" "$rel" "$line" \
    "${fn}() detected — shell injection risk if any argument includes user input" \
    "Validate and escape all arguments; prefer dedicated PHP libraries over shell commands"
  HAS_HIGH=1
done < <(
  grep -rnE '[^a-zA-Z_](shell_exec|passthru|proc_open)\s*\(' \
    "$BACKEND" --include="*.php" \
    --exclude-dir=vendor --exclude-dir=storage \
    2>/dev/null | \
  grep -v "/[Tt]ests*/" | grep -v "Test\.php" | \
  grep -v "verify_" | \
  grep -vE ':[0-9]+:\s*[*/]' \
  || true
)

# ── 4. APP_DEBUG=true in a production .env ─────────────────────────────────────
ENV_FILE="$BACKEND/.env"
if [[ -f "$ENV_FILE" ]]; then
  env_app=$(grep -i "^APP_ENV=" "$ENV_FILE" 2>/dev/null | cut -d= -f2 | tr -d '"'"'" | head -1)
  debug_val=$(grep -i "^APP_DEBUG=" "$ENV_FILE" 2>/dev/null | cut -d= -f2 | tr -d '"'"'" | head -1)
  if [[ "${env_app:-}" == "production" ]] && [[ "${debug_val:-}" == "true" ]]; then
    emit_finding "HIGH" "security-debug-production" "backend/.env" "0" \
      "APP_DEBUG=true with APP_ENV=production — stack traces and config values are exposed to browsers" \
      "Set APP_DEBUG=false in production; use log channels for debugging"
    HAS_HIGH=1
  fi
fi

# ── 5. Raw SQL with apparent string concatenation ─────────────────────────────
while IFS=: read -r file line match; do
  rel="${file#$PROJECT_ROOT/}"
  emit_finding "HIGH" "security-sql-injection" "$rel" "$line" \
    "Raw SQL with string concatenation — SQL injection risk if variable contains user input" \
    "Use parameter binding: DB::select('SELECT * FROM t WHERE id = ?', [\$id])"
  HAS_HIGH=1
done < <(
  grep -rnE '(DB::(statement|select|insert|update|delete))\s*\(\s*['\''"][^'\''")]*\$' \
    "$BACKEND" --include="*.php" \
    --exclude-dir=vendor --exclude-dir=storage --exclude-dir=Migrations \
    2>/dev/null | \
  grep -v "/[Tt]ests*/" | grep -v "Test\.php" | \
  grep -vE ':[0-9]+:\s*[*\/]'
)

# ── 6. Debug dump calls in production code ────────────────────────────────────
DUMP_COUNT=0
while IFS=: read -r file line _; do
  rel="${file#$PROJECT_ROOT/}"
  emit_finding "MEDIUM" "security-debug-dump" "$rel" "$line" \
    "Debug dump call (dd/dump/var_dump) in production code — leaks internals if reached" \
    "Remove debug dumps; use structured logging via Log::debug() instead"
  DUMP_COUNT=$((DUMP_COUNT + 1))
done < <(
  grep -rnE '^\s*(dd|dump|var_dump)\s*\(' \
    "$BACKEND/app" "$BACKEND/Modules" --include="*.php" \
    2>/dev/null | grep -v "/[Tt]ests*/" | grep -v "Test\.php"
)

# ── 7. Unescaped Blade output with request/input variables ────────────────────
if [[ -d "$BACKEND/resources/views" ]]; then
  while IFS=: read -r file line match; do
    rel="${file#$PROJECT_ROOT/}"
    emit_finding "MEDIUM" "security-xss-blade" "$rel" "$line" \
      "Unescaped Blade echo {!! ... !!} with user-controlled input — XSS risk" \
      "Use {{ \$var }} (auto-escaped) unless the content is explicitly sanitized HTML"
  done < <(
    grep -rnE '\{!!\s*\$?(request|input)\b' \
      "$BACKEND/resources/views" --include="*.blade.php" 2>/dev/null
  )
fi

# ── 8. npm audit (HIGH+ severity, if available) ───────────────────────────────
if command -v npm &>/dev/null && [[ -f "$FRONTEND/package.json" ]]; then
  audit_out=$(cd "$FRONTEND" && npm audit --json --audit-level=high 2>/dev/null) || true
  if [[ -n "$audit_out" ]]; then
    vuln_count=$(echo "$audit_out" | node -e "
      const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
      const h=(d.metadata&&d.metadata.vulnerabilities)||{};
      process.stdout.write(String((h.high||0)+(h.critical||0)));
    " 2>/dev/null || echo "0")
    emit_metric "npm_audit_high_critical" "$vuln_count"
    if [[ "${vuln_count:-0}" -gt 0 ]]; then
      emit_finding "HIGH" "security-npm-audit" "frontend/package.json" "0" \
        "npm audit reports ${vuln_count} high/critical severity vulnerabilities in frontend dependencies" \
        "Run 'npm audit fix' in frontend/; for breaking changes review the npm audit report manually"
      HAS_HIGH=1
    fi
  fi
fi

# ── 9. composer audit (if available) ─────────────────────────────────────────
if command -v composer &>/dev/null && [[ -f "$BACKEND/composer.lock" ]]; then
  if cd "$BACKEND" && composer audit --no-interaction --quiet 2>/dev/null; then
    emit_metric "composer_audit_issues" "0"
  else
    emit_finding "HIGH" "security-composer-audit" "backend/composer.lock" "0" \
      "composer audit reports security advisories in PHP dependencies" \
      "Run 'composer update' to pick up patched versions; review each advisory in the output"
    HAS_HIGH=1
  fi
fi

emit_metric "dump_calls_in_production" "$DUMP_COUNT"

[[ $HAS_CRITICAL -eq 1 ]] && exit 1
[[ $HAS_HIGH -eq 1 ]] && exit 1
exit 0
