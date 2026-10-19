#!/usr/bin/env bash
# NAME: Storage Permissions
# Verifies storage directory structure and write permissions inside the container.
# Checks:
#   - Docker volume mount is attached
#   - All required storage subdirectories exist
#   - Subdirectories are writable by www-data (the php-fpm user)
#   - Symlink storage/app/public → public/storage exists
set -euo pipefail

PROJECT_ROOT="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)}"
BACKEND="$PROJECT_ROOT/backend"

FAILURES=0
WARNINGS=0

fail() { echo "FAIL: $*"; FAILURES=$((FAILURES + 1)); }
warn() { echo "WARN: $*"; WARNINGS=$((WARNINGS + 1)); }
ok()   { echo "  OK: $*"; }
info() { echo "INFO: $*"; }

REQUIRED_DIRS=(
  "storage/logs"
  "storage/framework/cache"
  "storage/framework/cache/data"
  "storage/framework/sessions"
  "storage/framework/views"
  "storage/app/public"
)

# ── Check Docker container is running ────────────────────────────────────────
use_docker=0
if command -v docker &>/dev/null && docker info &>/dev/null 2>&1 && \
   docker inspect ecos-app &>/dev/null 2>&1; then
  state=$(docker inspect --format '{{.State.Status}}' ecos-app 2>/dev/null)
  if [[ "$state" == "running" ]]; then
    use_docker=1
    info "Checking storage via docker exec on ecos-app"
  fi
fi

if [[ $use_docker -eq 1 ]]; then
  # ── Check inside container ──────────────────────────────────────────────────
  STORAGE_PATH="/var/www/html/storage"

  for dir in "${REQUIRED_DIRS[@]}"; do
    full_path="$STORAGE_PATH/$dir"
    # Use bash -c to chain test commands
    result=$(docker exec ecos-app bash -c \
      "test -d '$full_path' && echo exists || echo missing" 2>/dev/null || echo "exec-failed")

    if [[ "$result" == "missing" ]]; then
      fail "Directory missing inside container: $full_path"
    elif [[ "$result" == "exec-failed" ]]; then
      warn "Cannot exec into ecos-app to check $dir"
    else
      # Check writable
      write_result=$(docker exec ecos-app bash -c \
        "test -w '$full_path' && echo writable || echo readonly" 2>/dev/null || echo "unknown")
      if [[ "$write_result" == "writable" ]]; then
        ok "$dir: exists and writable"
      else
        fail "$dir: exists but NOT writable (php-fpm needs write access)"
      fi
    fi
  done

  # ── Check storage symlink ────────────────────────────────────────────────────
  symlink=$(docker exec ecos-app bash -c \
    "test -L '/var/www/html/public/storage' && echo ok || echo missing" 2>/dev/null || echo "unknown")
  if [[ "$symlink" == "ok" ]]; then
    ok "public/storage symlink exists"
  elif [[ "$symlink" == "missing" ]]; then
    fail "public/storage symlink missing — run: php artisan storage:link"
  fi

  # ── Check log file is writable ────────────────────────────────────────────────
  log_result=$(docker exec ecos-app bash -c \
    "touch /var/www/html/storage/logs/.write-test 2>/dev/null && rm /var/www/html/storage/logs/.write-test && echo ok || echo fail" \
    2>/dev/null || echo "exec-failed")
  if [[ "$log_result" == "ok" ]]; then
    ok "storage/logs is writable"
  elif [[ "$log_result" == "fail" ]]; then
    fail "storage/logs is not writable by the container user"
  fi

  # ── Docker volume mount check ─────────────────────────────────────────────────
  mounts=$(docker inspect ecos-app --format '{{range .Mounts}}{{.Name}} → {{.Destination}}{{"\n"}}{{end}}' 2>/dev/null)
  if echo "$mounts" | grep -q "app-storage"; then
    ok "Named volume 'app-storage' is mounted"
    echo "$mounts" | grep "app-storage" | sed 's/^/       /'
  else
    fail "Named volume 'app-storage' is NOT mounted — storage data will not persist"
  fi

else
  # ── Local directory check (no Docker) ────────────────────────────────────────
  info "Docker not available — checking local backend/storage directory"

  for dir in "${REQUIRED_DIRS[@]}"; do
    full_path="$BACKEND/$dir"
    if [[ -d "$full_path" ]]; then
      if [[ -w "$full_path" ]]; then
        ok "$dir: exists and writable"
      else
        warn "$dir: exists but not writable locally (may be fine inside Docker)"
      fi
    else
      warn "$dir: directory not found locally (will be created by artisan storage:link)"
    fi
  done

  # Check symlink locally
  if [[ -L "$BACKEND/../public/storage" ]] || [[ -L "$BACKEND/public/storage" ]]; then
    ok "public/storage symlink exists locally"
  else
    warn "public/storage symlink not found — run: php artisan storage:link"
  fi
fi

# ── Summary ───────────────────────────────────────────────────────────────────
if [[ $FAILURES -gt 0 ]]; then
  printf '%d storage failure(s), %d warning(s)\n' "$FAILURES" "$WARNINGS"
  exit 1
fi

exit 0
