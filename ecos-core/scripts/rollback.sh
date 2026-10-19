#!/usr/bin/env bash
###############################################################################
# ECOS ERP — Rollback script
#
# Reverts the running application to a previous Git commit and rebuilds
# the Docker images from that commit's source.
#
# Usage:
#   bash scripts/rollback.sh              # reverts to last saved rollback point
#   bash scripts/rollback.sh <git-sha>    # reverts to a specific commit
#
# IMPORTANT — Database migrations are NOT automatically reversed.
# If the previous commit had schema changes that were applied, run:
#   docker compose exec app php artisan migrate:rollback
# after this script completes.
###############################################################################
set -euo pipefail

TARGET_SHA="${1:-}"

# ── Path resolution ────────────────────────────────────────────────────────────
# BASH_SOURCE[0] is scripts/rollback.sh.
# dirname → scripts/
# parent  → project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

ROLLBACK_FILE="$PROJECT_ROOT/.deploy_rollback"
LOG_DIR="$PROJECT_ROOT/storage/logs"
ROLLBACK_LOG="$LOG_DIR/rollback-$(date +%Y%m%d_%H%M%S).log"

mkdir -p "$LOG_DIR"
cd "$PROJECT_ROOT"

# ── Helpers ────────────────────────────────────────────────────────────────────
log()  { local msg; msg="[$(date '+%H:%M:%S')] $*"; printf '%s\n' "$msg"; printf '%s\n' "$msg" >> "$ROLLBACK_LOG"; }
ok()   { log "    ✓  $*"; }
fail() { log ""; log "✗ FAILED: $*" >&2; exit 1; }

# Explicit -f prevents auto-merging docker-compose.override.yml on the server.
COMPOSE="docker compose -f $PROJECT_ROOT/docker-compose.yml"

# Rebuilding images requires Composer auth (same HTTP 400 failure path as deploy).
if [ -z "${COMPOSER_GITHUB_TOKEN:-}" ]; then
    fail "COMPOSER_GITHUB_TOKEN is not set — required for docker compose build.
  Set it in the deployment user's environment:
    echo 'export COMPOSER_GITHUB_TOKEN=<personal-access-token>' >> ~/.profile
    source ~/.profile"
fi
COMPOSER_AUTH_JSON="{\"github-oauth\":{\"github.com\":\"$COMPOSER_GITHUB_TOKEN\"}}"

# ── Resolve target SHA ─────────────────────────────────────────────────────────
if [ -z "$TARGET_SHA" ]; then
    if [ -f "$ROLLBACK_FILE" ]; then
        TARGET_SHA="$(cat "$ROLLBACK_FILE")"
        log "Using saved rollback point: $TARGET_SHA"
    else
        fail "No rollback point found at $ROLLBACK_FILE.
  Provide a SHA explicitly: bash scripts/rollback.sh <git-sha>"
    fi
fi

CURRENT_SHA="$(git rev-parse HEAD)"

if [ "$TARGET_SHA" = "$CURRENT_SHA" ]; then
    log "Already at $TARGET_SHA — nothing to roll back."
    exit 0
fi

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log " ECOS ERP Rollback"
log "   From : $CURRENT_SHA"
log "   To   : $TARGET_SHA"
log "   Root : $PROJECT_ROOT"
log "   Log  : $ROLLBACK_LOG"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Save the current SHA so a re-rollback can get back here.
echo "$CURRENT_SHA" > "$ROLLBACK_FILE"

# ── 1. Reset to target commit ──────────────────────────────────────────────────
log ""
log "==> [1/5] Resetting to $TARGET_SHA"
git fetch --all --tags
git reset --hard "$TARGET_SHA" \
    || fail "git reset --hard $TARGET_SHA failed"
ok "HEAD is now: $(git rev-parse HEAD)"

# ── 2. Rebuild images from rolled-back source ──────────────────────────────────
# The multi-stage Dockerfile compiles everything inside the image:
#
#   Stage 1 (composer:2)
#     composer install --no-dev --optimize-autoloader
#     (from $PROJECT_ROOT/backend/ inside the build context)
#
#   Stage 2 (node:22-bookworm-slim)
#     npm ci && npx vite build
#     (from $PROJECT_ROOT/frontend/ → output to public/app/)
#
#   Stage 3 (php:8.4-fpm)
#     Copies vendor from Stage 1, public/app from Stage 2.
#     Bakes bootstrap/cache into the image.
#
#   Stage 4 (nginx:1.27-alpine)
#     Copies public/app from Stage 2.
#
# No host-level Node.js, PHP, or Composer is required.
log ""
log "==> [2/5] Rebuilding images from source at $TARGET_SHA"
$COMPOSE build \
    --build-arg "COMPOSER_AUTH=$COMPOSER_AUTH_JSON" \
    || fail "docker compose build failed during rollback"
ok "Images rebuilt."

# ── 3. Restart containers ──────────────────────────────────────────────────────
log ""
log "==> [3/5] Restarting containers"
$COMPOSE up -d --remove-orphans \
    || fail "docker compose up failed during rollback"
ok "Containers started."
$COMPOSE ps

# ── 4. Wait for healthy ────────────────────────────────────────────────────────
log ""
log "==> [4/5] Waiting for ecos-app to become healthy (up to 200 s)"
ATTEMPTS=0
until [ "$(docker inspect --format='{{.State.Health.Status}}' ecos-app 2>/dev/null)" = "healthy" ]; do
    ATTEMPTS=$((ATTEMPTS + 1))
    if [ "$ATTEMPTS" -ge 40 ]; then
        fail "ecos-app did not become healthy within 200 s.
  Diagnose:
    docker logs ecos-app
    docker inspect --format '{{json .State.Health}}' ecos-app"
    fi
    printf '.'
    sleep 5
done
printf '\n'
ok "ecos-app healthy after $((ATTEMPTS * 5)) s."

# ── 5. Health check ────────────────────────────────────────────────────────────
log ""
log "==> [5/5] Running health check"
bash "$SCRIPT_DIR/healthcheck.sh" "http://localhost" \
    || fail "Health check failed after rollback"

# ── Summary ────────────────────────────────────────────────────────────────────
log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log " Rollback SUCCESSFUL"
log "   Running SHA : $(git rev-parse HEAD)"
log "   Log         : $ROLLBACK_LOG"
log ""
log " NOTE: Database migrations were NOT reversed."
log " To reverse schema changes:"
log "   docker compose exec app php artisan migrate:rollback"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
