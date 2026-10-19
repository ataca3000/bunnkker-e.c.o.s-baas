#!/usr/bin/env bash
###############################################################################
# ECOS ERP — Server-side deployment script
#
# Called by GitHub Actions via SSH after the repository has been updated to the
# target commit. Never performs git pull — the caller (GitHub Actions) is
# responsible for the source update. This prevents the script from overwriting
# itself while it is executing.
#
# For manual runs the caller must update the repository before invoking:
#   git fetch --all && git checkout <branch> && git reset --hard <sha>
#   bash scripts/deploy.sh [GIT_SHA [GIT_BRANCH [GIT_ACTOR]]] [--migrate]
#
# Deployment flow:
#   1.  Validate environment
#   2.  Save rollback point (git SHA + image tags)
#   3.  Verify source (confirm HEAD matches the requested commit)
#   4.  docker compose build   ← frontend + backend compiled inside Dockerfile:
#                                  Stage 1 (composer:2):    composer install --no-dev
#                                  Stage 2 (node:22):       cd frontend && npm ci && npx vite build
#                                  Stage 3 (php:8.4-fpm):  bakes vendor + public/app + bootstrap/cache
#                                  Stage 4 (nginx:alpine):  bakes public/app + build-info
#   5.  Image self-test
#   6.  docker compose up -d
#   7.  Wait for containers to become healthy
#   8.  [--migrate] php artisan migrate --force
#   9.  Health check
#  10.  Deployment summary
#
# Requirements on the server: git  docker (Engine 24+)  docker compose v2  curl
###############################################################################
set -euo pipefail

# ── Arguments ─────────────────────────────────────────────────────────────────
GIT_SHA="${1:-HEAD}"
GIT_BRANCH="${2:-main}"
GIT_ACTOR="${3:-manual}"
RUN_MIGRATIONS=false
for arg in "$@"; do [ "$arg" = "--migrate" ] && RUN_MIGRATIONS=true; done

# ── Path resolution ────────────────────────────────────────────────────────────
# BASH_SOURCE[0] is the path of this script file (scripts/deploy.sh).
# Its parent is scripts/. The parent of that is the project root.
# This resolves correctly whether called as:
#   bash scripts/deploy.sh           (from project root — GitHub Actions)
#   bash /abs/path/scripts/deploy.sh (from anywhere — manual run)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

LOG_DIR="$PROJECT_ROOT/storage/logs"
DEPLOY_LOG="$LOG_DIR/deploy-$(date +%Y%m%d_%H%M%S).log"
ROLLBACK_FILE="$PROJECT_ROOT/.deploy_rollback"

mkdir -p "$LOG_DIR"
cd "$PROJECT_ROOT"

# ── Helpers ────────────────────────────────────────────────────────────────────
log()     { local msg; msg="[$(date '+%H:%M:%S')] $*"; printf '%s\n' "$msg"; printf '%s\n' "$msg" >> "$DEPLOY_LOG"; }
section() { log ""; log "━━━ $* ━━━"; }
ok()      { log "    ✓  $*"; }
fail()    { log ""; log "✗ FAILED: $*" >&2; exit 1; }

# Explicit -f prevents auto-merging docker-compose.override.yml on the server.
COMPOSE="docker compose -f $PROJECT_ROOT/docker-compose.yml"

log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log " ECOS ERP Deployment"
log "   SHA      : $GIT_SHA"
log "   Branch   : $GIT_BRANCH"
log "   Actor    : $GIT_ACTOR"
log "   Migrate  : $RUN_MIGRATIONS"
log "   Root     : $PROJECT_ROOT"
log "   Log      : $DEPLOY_LOG"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. Validate environment ────────────────────────────────────────────────────
section "1/9  Environment validation"

[ -f "$PROJECT_ROOT/docker-compose.yml" ] \
    || fail "docker-compose.yml not found at $PROJECT_ROOT — is the repository cloned here?"

[ -f "$PROJECT_ROOT/backend/.env" ] \
    || fail "backend/.env not found at $PROJECT_ROOT/backend/.env — create it from backend/.env.example"

if [ -f "$PROJECT_ROOT/docker-compose.override.yml" ]; then
    fail "docker-compose.override.yml found at $PROJECT_ROOT
  This file is for LOCAL DEVELOPMENT ONLY and must not exist on the production server.
  Remove it:  rm $PROJECT_ROOT/docker-compose.override.yml"
fi

if grep -qE '^APP_DEBUG[[:space:]]*=[[:space:]]*true' "$PROJECT_ROOT/backend/.env" 2>/dev/null; then
    fail "APP_DEBUG=true detected in $PROJECT_ROOT/backend/.env
  Set it to false before deploying:
    sed -i 's/^APP_DEBUG=.*/APP_DEBUG=false/' $PROJECT_ROOT/backend/.env"
fi

# api.github.com/*/zipball/* returns HTTP 400 for unauthenticated requests —
# GitHub redirects them to codeload.github.com/*/legacy.zip/* (deprecated).
# Authenticated requests get a working modern archive URL instead.
if [ -z "${COMPOSER_GITHUB_TOKEN:-}" ]; then
    fail "COMPOSER_GITHUB_TOKEN is not set.
  Composer downloads packages from api.github.com, which returns HTTP 400 for
  unauthenticated CI/Docker requests (deprecated codeload redirect).

  Set it in the deployment user's environment:
    echo 'export COMPOSER_GITHUB_TOKEN=<personal-access-token>' >> ~/.profile
    source ~/.profile

  The token requires no scopes — public repo read access is sufficient."
fi
COMPOSER_AUTH_JSON="{\"github-oauth\":{\"github.com\":\"$COMPOSER_GITHUB_TOKEN\"}}"

ok "Environment valid."

# ── 2. Rollback snapshot ───────────────────────────────────────────────────────
section "2/9  Rollback snapshot"

PREV_SHA="$(git rev-parse HEAD 2>/dev/null || echo '')"
if [ -n "$PREV_SHA" ]; then
    echo "$PREV_SHA" > "$ROLLBACK_FILE"
    ok "Git rollback point saved: $PREV_SHA"
fi

if docker image inspect ecos-erp/app:latest >/dev/null 2>&1; then
    docker tag ecos-erp/app:latest ecos-erp/app:rollback
    ok "ecos-erp/app:latest → ecos-erp/app:rollback"
fi
if docker image inspect ecos-erp/nginx:latest >/dev/null 2>&1; then
    docker tag ecos-erp/nginx:latest ecos-erp/nginx:rollback
    ok "ecos-erp/nginx:latest → ecos-erp/nginx:rollback"
fi

# ── 3. Verify source ──────────────────────────────────────────────────────────
# Git update is the caller's responsibility. GitHub Actions runs:
#   git fetch --all --tags --prune
#   git checkout $GIT_BRANCH && git reset --hard $GIT_SHA
# before invoking this script, so the codebase is already at the target commit
# and this script itself is the version from that commit.
section "3/9  Source verification"

CURRENT_SHA="$(git rev-parse HEAD)"

if [ "$GIT_SHA" != "HEAD" ] && [ "$GIT_SHA" != "$CURRENT_SHA" ]; then
    fail "Repository is at $CURRENT_SHA but deployment targets $GIT_SHA.
  Update the repository before invoking deploy.sh, or use the GitHub Actions
  workflow which performs the update automatically."
fi

GIT_MSG="$(git log -1 --pretty=format:"%s" 2>/dev/null || echo 'unknown')"
APP_VERSION="$(git describe --tags --exact-match 2>/dev/null \
               || git describe --tags 2>/dev/null \
               || echo "$CURRENT_SHA")"
BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

ok "HEAD: $CURRENT_SHA"
log "    Message : $GIT_MSG"
log "    Version : $APP_VERSION"
log "    Built   : $BUILD_TIME"

# ── 4. Build images ────────────────────────────────────────────────────────────
# The multi-stage Dockerfile compiles everything inside the image:
#
#   Stage 1 (composer:2)
#     WORKDIR /app
#     composer install --no-dev --no-scripts --optimize-autoloader
#
#   Stage 2 (node:22-bookworm-slim)
#     WORKDIR /app  (= $PROJECT_ROOT/frontend inside the build context)
#     npm ci
#     npx vite build  → output: /backend/public/app  (baked into Stage 3+4)
#     NOT `npm run build` — that script is `tsc -b && vite build`, and tsc -b
#     exits non-zero on the ratchet's accepted diagnostics, which made every
#     image build fail here (BUG-GL-009). Types are gated by the ratchet in CI.
#
#   Stage 3 (php:8.4-fpm)
#     Copies vendor from Stage 1, public/app from Stage 2.
#     Runs: package:discover, route:cache, event:cache
#     Bakes bootstrap/cache into the image.
#
#   Stage 4 (nginx:1.27-alpine)
#     Copies public/app from Stage 2 + build-info from Stage 3.
#
# Neither Node.js nor PHP/Composer must be installed on the production host.
# The runtime container never runs composer, npm, or artisan cache commands.
section "4/9  Image build"

log "Building ecos-erp/app (Stage 3) and ecos-erp/nginx (Stage 4)..."
$COMPOSE build --pull \
    --build-arg "COMPOSER_AUTH=$COMPOSER_AUTH_JSON" \
    --build-arg "GIT_SHA=$CURRENT_SHA" \
    --build-arg "APP_VERSION=$APP_VERSION" \
    --build-arg "BUILD_TIME=$BUILD_TIME" \
    || fail "docker compose build failed"
ok "Images built."

# ── 5. Image self-test ─────────────────────────────────────────────────────────
section "5/9  Image self-test"

log "Verifying ecos-erp/app:latest is self-contained..."
SELF_TEST_KEY="base64:$(openssl rand -base64 32)"
docker run --rm \
    -e APP_NAME="ECOS-ERP" \
    -e APP_ENV=production \
    -e APP_KEY="$SELF_TEST_KEY" \
    -e APP_DEBUG=false \
    -e APP_URL=http://localhost \
    -e DB_CONNECTION=mysql \
    -e DB_HOST=127.0.0.1 \
    -e DB_DATABASE=ecos_erp \
    -e DB_USERNAME=ecos \
    -e DB_PASSWORD=self-test \
    -e CACHE_STORE=array \
    -e SESSION_DRIVER=array \
    -e QUEUE_CONNECTION=sync \
    -e REDIS_HOST=127.0.0.1 \
    -e MAIL_MAILER=log \
    --entrypoint="" \
    ecos-erp/app:latest \
    php /var/www/html/artisan --version \
    || fail "Image self-test failed: 'php artisan --version' could not run"
ok "artisan --version: OK."

log "Verifying bootstrap/cache has no dev packages..."
if docker run --rm ecos-erp/app:latest \
        grep -qi 'pail\|sail\|collision\|phpunit' \
        /var/www/html/bootstrap/cache/packages.php 2>/dev/null; then
    fail "Image self-test failed: dev packages found in bootstrap/cache/packages.php"
fi
ok "Bootstrap cache clean."

# ── 6. Start containers ────────────────────────────────────────────────────────
section "6/9  Container rollout"

$COMPOSE up -d --remove-orphans \
    || fail "docker compose up failed"
ok "Containers started."
$COMPOSE ps

# ── 7. Wait for healthy ────────────────────────────────────────────────────────
section "7/9  Health wait"

log "Waiting for ecos-app to become healthy (up to 200 s)..."
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

log "Waiting for ecos-nginx to become healthy..."
NGINX_ATTEMPTS=0
until [ "$(docker inspect --format='{{.State.Health.Status}}' ecos-nginx 2>/dev/null)" = "healthy" ]; do
    NGINX_ATTEMPTS=$((NGINX_ATTEMPTS + 1))
    if [ "$NGINX_ATTEMPTS" -ge 20 ]; then
        fail "ecos-nginx did not become healthy within 100 s.
  Diagnose:
    docker logs ecos-nginx"
    fi
    sleep 5
done
ok "ecos-nginx healthy — full stack confirmed (nginx → FPM → DB + Redis)."

# ── 8. Database migrations ─────────────────────────────────────────────────────
section "8/9  Database migrations"

if [ "$RUN_MIGRATIONS" = "true" ]; then
    log "Running: php artisan migrate --force"
    $COMPOSE exec -T app php artisan migrate --force \
        || fail "php artisan migrate --force failed"
    ok "Migrations complete."
else
    log "Skipping migrations."
    log "To apply schema changes: bash $SCRIPT_DIR/deploy.sh --migrate"
fi

# ── 9. Health check ────────────────────────────────────────────────────────────
section "9/9  Health check"

bash "$SCRIPT_DIR/healthcheck.sh" "http://localhost" \
    || fail "Health check failed — deployment may be broken"

# ── Summary ────────────────────────────────────────────────────────────────────
APP_IMAGE_SHA="$(docker inspect --format '{{.Id}}' ecos-erp/app:latest   2>/dev/null | cut -c1-19 || echo 'unknown')"
NGX_IMAGE_SHA="$(docker inspect --format '{{.Id}}' ecos-erp/nginx:latest 2>/dev/null | cut -c1-19 || echo 'unknown')"

log ""
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
log " Deployment SUCCESSFUL"
log ""
log "   Version      : $APP_VERSION"
log "   SHA          : $CURRENT_SHA"
log "   Built at     : $BUILD_TIME"
log "   Message      : $GIT_MSG"
log "   Image (app)  : ${APP_IMAGE_SHA}…"
log "   Image (nginx): ${NGX_IMAGE_SHA}…"
log "   Log          : $DEPLOY_LOG"
log ""
log "   Health       : curl http://localhost/api/health"
log "   Build info   : curl http://localhost/build-info"
log "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
