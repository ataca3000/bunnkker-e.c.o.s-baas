#!/usr/bin/env bash
# NAME: Health Endpoint
# Verifies the application health endpoint returns HTTP 200 with status:ok.
#
# Tests both the direct nginx path and the Docker internal path.
# Endpoint: GET /api/health  → {"status":"ok", "database":true, "redis":true, ...}
# Endpoint: GET /healthz     → checked as alias if present
set -euo pipefail

PROJECT_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"

FAILURES=0

fail() { echo "FAIL: $*"; FAILURES=$((FAILURES + 1)); }
ok()   { echo "  OK: $*"; }
info() { echo "INFO: $*"; }

# ── Determine which host:port to test ────────────────────────────────────────
# Try HTTPS on localhost:443, then HTTP on localhost:80, then docker internal
try_url() {
  local url="$1"
  local response http_code body

  response=$(curl -sk --max-time 10 -w '\n__HTTP_CODE__%{http_code}' "$url" 2>/dev/null || echo "__HTTP_CODE__000")
  http_code=$(echo "$response" | grep -oE '__HTTP_CODE__[0-9]+' | grep -oE '[0-9]+')
  body=$(echo "$response" | sed '/__HTTP_CODE__/d')

  echo "$http_code|$body"
}

check_health_response() {
  local url="$1"
  local result http_code body

  result=$(try_url "$url")
  http_code="${result%%|*}"
  body="${result#*|}"

  if [[ "$http_code" == "000" ]]; then
    return 1  # connection refused / timeout
  fi

  info "GET $url → HTTP $http_code"

  if [[ "$http_code" != "200" ]]; then
    fail "Health endpoint returned HTTP $http_code (expected 200)"
    [[ -n "$body" ]] && echo "  Response: $(echo "$body" | head -c 200)"
    return 0
  fi

  ok "HTTP 200 received"

  # Parse JSON fields
  status=$(echo "$body" | grep -oE '"status":"[^"]+"' | cut -d'"' -f4)
  database=$(echo "$body" | grep -oE '"database":(true|false)' | cut -d: -f2)
  redis=$(echo "$body" | grep -oE '"redis":(true|false)' | cut -d: -f2)
  queue=$(echo "$body" | grep -oE '"queue":(true|false)' | cut -d: -f2)
  storage=$(echo "$body" | grep -oE '"storage":(true|false)' | cut -d: -f2)

  if [[ "$status" == "ok" ]]; then
    ok "Application status: ok"
  else
    fail "Application status is '$status' (expected 'ok') — one or more dependencies are down"
  fi

  [[ "$database" == "true" ]]  && ok "Database: connected"  || fail "Database: NOT connected"
  [[ "$redis" == "true" ]]     && ok "Redis: connected"     || fail "Redis: NOT connected"
  [[ "$queue" == "true" ]]     && ok "Queue: healthy"       || fail "Queue: NOT healthy"
  [[ "$storage" == "true" ]]   && ok "Storage: writable"    || info "Storage: not writable (non-fatal)"

  # Print full response summary
  printf '\n  Response: %s\n' "$body"
  return 0
}

# ── Try HTTPS first (production path) ────────────────────────────────────────
if check_health_response "https://localhost/api/health"; then
  :
# ── Fall back to HTTP ─────────────────────────────────────────────────────────
elif check_health_response "http://localhost/api/health"; then
  :
# ── Try docker exec (containers might not expose port 80 locally) ─────────────
elif command -v docker &>/dev/null && docker info &>/dev/null 2>&1 && \
     docker inspect ecos-nginx &>/dev/null 2>&1; then
  info "Trying health check via docker exec on ecos-nginx container"
  result=$(docker exec ecos-nginx wget --no-check-certificate -q -O- \
    https://127.0.0.1/api/health 2>/dev/null || echo "EXEC_FAILED")

  if [[ "$result" == "EXEC_FAILED" ]]; then
    fail "Cannot reach /api/health — nginx container is not responding internally"
  else
    info "Got response from docker exec"
    status=$(echo "$result" | grep -oE '"status":"[^"]+"' | cut -d'"' -f4)
    if [[ "$status" == "ok" ]]; then
      ok "Application status: ok (via docker exec)"
    else
      fail "Application status is '$status' — service degraded"
    fi
  fi
else
  fail "Cannot reach /api/health on https://localhost, http://localhost, or via docker exec"
  info "Ensure containers are running: docker compose up -d"
fi

# ── Check /healthz alias (if nginx routes it) ─────────────────────────────────
NGINX_CONF="$PROJECT_ROOT/docker/nginx/default.conf"
if [[ -f "$NGINX_CONF" ]] && grep -q "healthz" "$NGINX_CONF"; then
  result=$(try_url "https://localhost/healthz")
  http_code="${result%%|*}"
  if [[ "$http_code" == "200" ]]; then
    ok "GET /healthz → HTTP 200"
  elif [[ "$http_code" != "000" ]]; then
    info "GET /healthz → HTTP $http_code (optional alias)"
  fi
fi

if [[ $FAILURES -gt 0 ]]; then
  exit 1
fi

exit 0
