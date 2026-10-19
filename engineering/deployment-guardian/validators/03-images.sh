#!/usr/bin/env bash
# NAME: Docker Images
# Checks that production Docker images exist locally or can be built.
# Also validates Dockerfile syntax (no build — dry analysis only).
set -euo pipefail

PROJECT_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
DOCKERFILE="$PROJECT_ROOT/docker/php/Dockerfile"

if ! command -v docker &>/dev/null; then
  echo "docker not in PATH"
  exit 2
fi

# ── Check Docker daemon is reachable ──────────────────────────────────────────
if ! docker info &>/dev/null 2>&1; then
  echo "Docker daemon is not running — start Docker Desktop first"
  exit 2
fi

FAILURES=0
WARNINGS=0

fail() { echo "FAIL: $*"; FAILURES=$((FAILURES + 1)); }
warn() { echo "WARN: $*"; WARNINGS=$((WARNINGS + 1)); }
ok()   { echo "  OK: $*"; }

# ── Check Dockerfile exists ───────────────────────────────────────────────────
if [[ ! -f "$DOCKERFILE" ]]; then
  fail "Dockerfile not found at docker/php/Dockerfile"
else
  ok "Dockerfile found at docker/php/Dockerfile"

  # Check required build targets exist
  for target in app nginx; do
    if grep -q "^FROM .* AS ${target}\$\|^FROM .* as ${target}\$" "$DOCKERFILE"; then
      ok "Build target '$target' defined in Dockerfile"
    else
      fail "Build target '$target' not found in Dockerfile — docker-compose.yml references it"
    fi
  done
fi

# ── Check if images are already built locally ─────────────────────────────────
IMAGES=(
  "ecos-erp/app:latest"
  "ecos-erp/nginx:latest"
)

any_missing=0
for img in "${IMAGES[@]}"; do
  if docker image inspect "$img" &>/dev/null 2>&1; then
    created=$(docker image inspect "$img" --format '{{.Created}}' 2>/dev/null | cut -c1-10)
    size=$(docker image inspect "$img" --format '{{.Size}}' 2>/dev/null | \
           awk '{printf "%.0f MB", $1/1048576}')
    ok "Image $img exists (created: $created, size: $size)"
  else
    warn "Image $img not built locally — run: docker compose build $( echo "$img" | cut -d/ -f2 | cut -d: -f1)"
    any_missing=1
    WARNINGS=$((WARNINGS + 1))
  fi
done

# ── Check base images can be pulled ──────────────────────────────────────────
if [[ $any_missing -eq 1 ]]; then
  echo ""
  echo "To build all images:"
  echo "  docker compose -f docker-compose.yml build --parallel"
fi

# ── Validate nginx config (if image exists) ───────────────────────────────────
NGINX_CONF="$PROJECT_ROOT/docker/nginx/default.conf"
if [[ -f "$NGINX_CONF" ]]; then
  ok "nginx config found at docker/nginx/default.conf"
  # Static checks: look for common misconfigurations
  if grep -q "ssl_certificate" "$NGINX_CONF" && ! grep -q "ssl_certificate_key" "$NGINX_CONF"; then
    fail "nginx config has ssl_certificate but no ssl_certificate_key"
  fi
  if grep -qE "listen 80" "$NGINX_CONF"; then
    ok "nginx listens on port 80"
  fi
  if grep -qE "listen 443" "$NGINX_CONF"; then
    ok "nginx listens on port 443 (HTTPS)"
  fi
else
  warn "docker/nginx/default.conf not found"
fi

# ── Check entrypoint script ───────────────────────────────────────────────────
ENTRYPOINT=$(find "$PROJECT_ROOT/docker" -name "entrypoint.sh" 2>/dev/null | head -1)
if [[ -n "$ENTRYPOINT" ]]; then
  ok "Entrypoint script found: ${ENTRYPOINT#$PROJECT_ROOT/}"
  if grep -q "php-fpm" "$ENTRYPOINT" 2>/dev/null; then
    ok "Entrypoint starts php-fpm"
  fi
else
  warn "No entrypoint.sh found in docker/ — verify Dockerfile CMD/ENTRYPOINT"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
if [[ $FAILURES -gt 0 ]]; then
  printf '%d failure(s), %d warning(s)\n' "$FAILURES" "$WARNINGS"
  exit 1
fi

exit 0
