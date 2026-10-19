#!/usr/bin/env bash
###############################################################################
# ECOS ERP — Health check script
#
# Polls /healthz until it returns HTTP 200 or the timeout is reached.
# Also verifies the API and frontend are reachable.
#
# Usage:
#   bash scripts/healthcheck.sh [base-url] [max-wait-seconds]
#
# Examples:
#   bash scripts/healthcheck.sh                       # http://localhost, 60s
#   bash scripts/healthcheck.sh http://localhost 120
#   bash scripts/healthcheck.sh http://76.13.49.162
###############################################################################
set -euo pipefail

BASE_URL="${1:-http://localhost}"
MAX_WAIT="${2:-60}"

INTERVAL=5
ELAPSED=0

log()  { echo "[healthcheck] $*"; }
pass() { log "OK  — $*"; }
fail() { log "FAIL — $*"; FAILED=1; }

# ── Poll /healthz ─────────────────────────────────────────────────────────────
log "Waiting for $BASE_URL/healthz (timeout: ${MAX_WAIT}s) ..."
until [ "$ELAPSED" -ge "$MAX_WAIT" ]; do
    STATUS="$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$BASE_URL/healthz" 2>/dev/null || echo '000')"
    if [ "$STATUS" = "200" ]; then
        pass "/healthz → $STATUS"
        break
    fi
    log "Not ready yet (HTTP $STATUS, ${ELAPSED}s elapsed) — retrying in ${INTERVAL}s..."
    sleep "$INTERVAL"
    ELAPSED=$((ELAPSED + INTERVAL))
done

if [ "$ELAPSED" -ge "$MAX_WAIT" ] && [ "$STATUS" != "200" ]; then
    log "TIMEOUT: /healthz did not return 200 after ${MAX_WAIT}s (last status: $STATUS)"
    exit 1
fi

# ── Additional checks ─────────────────────────────────────────────────────────
FAILED=0

# Laravel API endpoint
# -L: follow the HTTP→HTTPS redirect (port 80 redirects everything except /healthz)
# -k: skip cert validation (cert is for the domain, not localhost)
API_STATUS="$(curl -skL -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL/api/auth/me" 2>/dev/null || echo '000')"
if [ "$API_STATUS" = "401" ] || [ "$API_STATUS" = "200" ]; then
    pass "/api/auth/me → $API_STATUS (API is responding)"
else
    fail "/api/auth/me returned $API_STATUS (expected 200 or 401)"
fi

# Frontend entry point
SPA_STATUS="$(curl -skL -o /dev/null -w "%{http_code}" --max-time 10 "$BASE_URL/app/index.html" 2>/dev/null || echo '000')"
if [ "$SPA_STATUS" = "200" ]; then
    pass "/app/index.html → $SPA_STATUS"
else
    fail "/app/index.html returned $SPA_STATUS (expected 200)"
fi

# Verify the frontend references a JS bundle (not an empty file)
SPA_BODY="$(curl -skL --max-time 10 "$BASE_URL/app/index.html" 2>/dev/null || echo '')"
if echo "$SPA_BODY" | grep -q 'src="/app/assets/'; then
    BUNDLE="$(echo "$SPA_BODY" | grep -o 'index-[^"]*\.js' | head -1)"
    pass "Frontend bundle referenced: $BUNDLE"
else
    fail "Frontend index.html does not reference a JS bundle"
fi

if [ "$FAILED" -ne 0 ]; then
    log ""
    log "One or more checks failed. Check docker compose logs:"
    log "  docker compose logs --tail=50 app"
    log "  docker compose logs --tail=50 nginx"
    exit 1
fi

log ""
log "All health checks passed — $BASE_URL is healthy."
