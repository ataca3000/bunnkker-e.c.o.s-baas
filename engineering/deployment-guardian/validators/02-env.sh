#!/usr/bin/env bash
# NAME: Environment Config
# Validates backend/.env has all required variables set and non-empty.
# Warns about development-only values that must change for production.
set -euo pipefail

PROJECT_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
ENV_FILE="$PROJECT_ROOT/backend/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "backend/.env not found — copy backend/.env.example and fill in values"
  exit 1
fi

# ── Helper: get value from .env ──────────────────────────────────────────────
env_get() {
  grep -E "^${1}=" "$ENV_FILE" | head -1 | cut -d= -f2- | tr -d '\r'
}

env_set() {
  local val
  val=$(env_get "$1")
  [[ -n "$val" ]]
}

FAILURES=0
WARNINGS=0

fail() { echo "FAIL: $*"; FAILURES=$((FAILURES + 1)); }
warn() { echo "WARN: $*"; WARNINGS=$((WARNINGS + 1)); }
ok()   { echo "  OK: $*"; }

# ── Required variables ────────────────────────────────────────────────────────
REQUIRED_VARS=(
  APP_NAME APP_ENV APP_KEY APP_URL APP_DEBUG
  DB_CONNECTION DB_HOST DB_PORT DB_DATABASE DB_USERNAME DB_PASSWORD
  QUEUE_CONNECTION
  REDIS_HOST REDIS_PORT
  CACHE_STORE SESSION_DRIVER
  LOG_CHANNEL
)

for var in "${REQUIRED_VARS[@]}"; do
  if env_set "$var"; then
    ok "$var is set"
  else
    fail "$var is not set or is empty"
  fi
done

# ── APP_KEY: must be a valid base64 key ──────────────────────────────────────
APP_KEY=$(env_get APP_KEY)
if [[ "$APP_KEY" != base64:* ]] || [[ ${#APP_KEY} -lt 40 ]]; then
  fail "APP_KEY is invalid — run: php artisan key:generate"
else
  ok "APP_KEY looks valid (base64, ${#APP_KEY} chars)"
fi

# ── APP_DEBUG must be false in production ────────────────────────────────────
APP_DEBUG=$(env_get APP_DEBUG)
APP_ENV_VAL=$(env_get APP_ENV)

if [[ "$APP_ENV_VAL" == "production" ]] && [[ "$APP_DEBUG" == "true" ]]; then
  fail "APP_DEBUG=true in production — this exposes stack traces publicly"
elif [[ "$APP_DEBUG" == "true" ]]; then
  warn "APP_DEBUG=true — set to false before deploying to production"
else
  ok "APP_DEBUG=$APP_DEBUG"
fi

# ── APP_URL must not be localhost in production ───────────────────────────────
APP_URL=$(env_get APP_URL)
if [[ "$APP_ENV_VAL" == "production" ]] && echo "$APP_URL" | grep -qiE 'localhost|127\.0\.0\.1'; then
  fail "APP_URL='$APP_URL' contains localhost — set to the production domain"
elif echo "$APP_URL" | grep -qiE 'localhost|127\.0\.0\.1'; then
  warn "APP_URL='$APP_URL' — update to the production domain before deploying"
else
  ok "APP_URL=$APP_URL"
fi

# ── DB connection matches docker-compose ─────────────────────────────────────
DB_HOST=$(env_get DB_HOST)
DB_PASS=$(env_get DB_PASSWORD)
if [[ "$DB_HOST" == "mysql" ]]; then
  ok "DB_HOST=mysql (matches Docker service name)"
else
  warn "DB_HOST='$DB_HOST' — expected 'mysql' to match the Docker service name"
fi
if [[ -z "$DB_PASS" ]]; then
  fail "DB_PASSWORD is empty — database requires a password"
else
  ok "DB_PASSWORD is set"
fi

# ── Redis ────────────────────────────────────────────────────────────────────
REDIS_HOST=$(env_get REDIS_HOST)
if [[ "$REDIS_HOST" == "redis" ]]; then
  ok "REDIS_HOST=redis (matches Docker service name)"
else
  warn "REDIS_HOST='$REDIS_HOST' — expected 'redis' to match the Docker service name"
fi

# ── Queue must be redis (not sync) in production ─────────────────────────────
QUEUE_CONN=$(env_get QUEUE_CONNECTION)
if [[ "$APP_ENV_VAL" == "production" ]] && [[ "$QUEUE_CONN" == "sync" ]]; then
  fail "QUEUE_CONNECTION=sync in production — set to 'redis' for async processing"
elif [[ "$QUEUE_CONN" == "redis" ]]; then
  ok "QUEUE_CONNECTION=redis"
else
  warn "QUEUE_CONNECTION=$QUEUE_CONN — 'redis' is recommended for production"
fi

# ── Cache / session must not use file driver in production ────────────────────
CACHE_STORE=$(env_get CACHE_STORE)
SESSION_DRV=$(env_get SESSION_DRIVER)

if [[ "$APP_ENV_VAL" == "production" ]]; then
  if [[ "$CACHE_STORE" == "file" ]]; then
    warn "CACHE_STORE=file — use 'redis' for better performance in production"
  fi
  if [[ "$SESSION_DRV" == "file" ]]; then
    warn "SESSION_DRIVER=file — use 'redis' or 'database' for multi-instance deployments"
  fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────
printf '\nEnvironment: %s | Debug: %s | URL: %s\n' \
  "${APP_ENV_VAL:-?}" "${APP_DEBUG:-?}" "${APP_URL:-?}"

if [[ $FAILURES -gt 0 ]]; then
  printf '%d failure(s), %d warning(s)\n' "$FAILURES" "$WARNINGS"
  exit 1
fi

if [[ $WARNINGS -gt 0 ]]; then
  printf '0 failures, %d warning(s) — review before production deploy\n' "$WARNINGS"
fi

exit 0
