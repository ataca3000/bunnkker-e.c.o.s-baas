#!/usr/bin/env bash
# NAME: Laravel Caches
# Verifies that all Laravel optimization caches are baked into the Docker image.
# In production (immutable images), these must be present in bootstrap/cache/
# at image build time — not on a named volume that would shadow them.
#
# Checks:
#   - config cache (bootstrap/cache/config.php)
#   - route cache  (bootstrap/cache/routes-v7.php or similar)
#   - event cache  (bootstrap/cache/events.php)
#   - package manifest (bootstrap/cache/packages.php)
#   - services cache (bootstrap/cache/services.php)
#   - No volume shadow on bootstrap/cache/
set -euo pipefail

PROJECT_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
BACKEND="$PROJECT_ROOT/backend"

FAILURES=0
WARNINGS=0

fail() { echo "FAIL: $*"; FAILURES=$((FAILURES + 1)); }
warn() { echo "WARN: $*"; WARNINGS=$((WARNINGS + 1)); }
ok()   { echo "  OK: $*"; }
info() { echo "INFO: $*"; }

CACHE_DIR="bootstrap/cache"

# ── Strategy: check inside Docker container (authoritative) ──────────────────
use_docker=0
if command -v docker &>/dev/null && docker info &>/dev/null 2>&1 && \
   docker inspect ecos-app &>/dev/null 2>&1; then
  state=$(docker inspect --format '{{.State.Status}}' ecos-app 2>/dev/null)
  if [[ "$state" == "running" ]]; then
    use_docker=1
  fi
fi

check_cache_file() {
  local name="$1" pattern="$2"

  if [[ $use_docker -eq 1 ]]; then
    result=$(docker exec ecos-app bash -c \
      "ls /var/www/html/$CACHE_DIR/$pattern 2>/dev/null | head -1 || echo ''" 2>/dev/null)
    if [[ -n "$result" ]]; then
      size=$(docker exec ecos-app bash -c "wc -c < '$result' 2>/dev/null || echo '?'" 2>/dev/null)
      ok "$name: present in container ($result, ${size} bytes)"
      return 0
    else
      return 1
    fi
  else
    local found
    found=$(ls "$BACKEND/$CACHE_DIR/"$pattern 2>/dev/null | head -1 || true)
    if [[ -n "$found" ]]; then
      ok "$name: present locally (${found#$BACKEND/})"
      return 0
    else
      return 1
    fi
  fi
}

# ── Check bootstrap/cache/ is NOT a Docker volume ────────────────────────────
if [[ $use_docker -eq 1 ]]; then
  mounts=$(docker inspect ecos-app --format \
    '{{range .Mounts}}{{.Destination}}{{"\n"}}{{end}}' 2>/dev/null)
  if echo "$mounts" | grep -qE "^/var/www/html/bootstrap/cache"; then
    fail "bootstrap/cache/ is mounted as a volume — this shadows the baked-in cache"
    info "Remove the bootstrap/cache volume from docker-compose.yml; caches must be baked in"
  else
    ok "bootstrap/cache/ is NOT a named volume (correct — caches are baked into the image)"
  fi
fi

# ── Required cache files ──────────────────────────────────────────────────────
check_cache_file "Config cache"    "config.php"    || fail "Config cache missing — run: php artisan config:cache"
check_cache_file "Route cache"     "routes-*.php"  || fail "Route cache missing — run: php artisan route:cache"
check_cache_file "Events cache"    "events.php"    || warn "Events cache missing — run: php artisan event:cache (non-critical)"
check_cache_file "Package manifest" "packages.php" || fail "Package manifest missing — run: php artisan package:discover"
check_cache_file "Services cache"  "services.php"  || fail "Services cache missing — run: php artisan package:discover"

# ── Verify Laravel can boot with cached config ────────────────────────────────
if [[ $use_docker -eq 1 ]]; then
  version=$(docker exec ecos-app php artisan --version 2>/dev/null || echo "FAILED")
  if echo "$version" | grep -qiE "Laravel Framework"; then
    ok "Laravel bootstrap: $version"
  else
    fail "Laravel failed to boot inside container: $version"
  fi

  # Check environment
  env_val=$(docker exec ecos-app php artisan env 2>/dev/null | grep -oE "Current application environment: \S+" | cut -d' ' -f4 || echo "unknown")
  ok "Application environment: ${env_val:-unknown}"

  # Spot-check: try config:show (requires config cache to work properly)
  config_check=$(docker exec ecos-app php artisan config:show --format=json app.name 2>/dev/null | head -1 || echo "FAILED")
  if echo "$config_check" | grep -qv "FAILED"; then
    ok "Config cache is readable (app.name resolved)"
  else
    warn "Could not read config via artisan config:show — cache may be stale"
  fi
else
  # Local check: verify artisan is runnable
  info "Docker not running — checking local artisan availability"
  if command -v php &>/dev/null && [[ -f "$BACKEND/artisan" ]]; then
    php "$BACKEND/artisan" --version 2>/dev/null && ok "php artisan --version: OK" || warn "artisan failed locally (DB/Redis needed)"
  else
    info "php not in PATH or artisan not found — skipping local check"
  fi

  # Check cache files locally
  local_cache="$BACKEND/$CACHE_DIR"
  if [[ -d "$local_cache" ]]; then
    cache_count=$(ls "$local_cache"/*.php 2>/dev/null | wc -l)
    ok "$cache_count PHP cache file(s) in local $CACHE_DIR/"
    if [[ $cache_count -eq 0 ]]; then
      warn "No cache files locally — run: php artisan optimize inside the container before deploying"
    fi
  fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────
if [[ $FAILURES -gt 0 ]]; then
  printf '%d cache failure(s), %d warning(s)\n' "$FAILURES" "$WARNINGS"
  exit 1
fi

exit 0
