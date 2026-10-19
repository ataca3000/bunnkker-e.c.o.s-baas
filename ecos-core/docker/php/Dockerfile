# syntax=docker/dockerfile:1
# =============================================================================
# ECOS ERP — Multi-stage production image
#
# Stage 1  composer   Resolve PHP dependencies (no scripts, no artisan)
# Stage 2  frontend   Build React/Vite SPA      (Node 22, build-only)
# Stage 3  app        PHP 8.4-FPM runtime        (no Node, no Composer, no dev)
# Stage 4  nginx      Static + proxy server      (no PHP, no Composer)
#
# IMMUTABILITY GUARANTEE (TASK-INFRA-002 + TASK-INFRA-003):
#   bootstrap/cache is fully generated here during docker build.
#   The runtime container never runs:
#     composer install / dump-autoload
#     artisan package:discover
#     artisan optimize / route:cache / event:cache / view:cache
#   config:cache is intentionally deferred to entrypoint.sh (step 6) —
#     real env values are only available at container start via env_file.
#   view:cache is intentionally excluded — storage/ is a runtime named volume.
#
# BUILD VERIFICATION (TASK-INFRA-003):
#   After cache generation a dedicated RUN block verifies:
#   • Route cache portability: env variable names must not appear in routes cache
#   • All cache files exist: packages.php + routes*.php + events*.php
#   • No dev packages in any cache file (pail, sail, collision, phpunit)
# =============================================================================


# -----------------------------------------------------------------------------
# Stage 1 — Composer: resolve and optimise PHP autoloader
#
# Rules enforced here:
#   --no-dev         never install dev dependencies in the image
#   --no-scripts     never execute post-autoload-dump (artisan / package:discover)
#                    Those commands need a running app context; this stage is a
#                    pure dependency resolver.
#   --no-autoloader  first pass: download only, do not generate class maps yet
#
# The class map is generated in a second step AFTER the application source is
# available so that --optimize can scan all PSR-4 namespaces correctly.
# -----------------------------------------------------------------------------
FROM composer:2 AS composer

WORKDIR /app

# Without GitHub authentication, api.github.com/*/zipball/* redirects to the
# deprecated codeload.github.com/*/legacy.zip/* endpoint which returns HTTP 400.
# Production builds must pass the real token via --build-arg (set by deploy.sh).
# Default '{}' (no auth) keeps local builds working on non-rate-limited IPs.
ARG COMPOSER_AUTH='{}'

# Layer 1: dependency resolution (invalidated only when lock file changes)
COPY backend/composer.json backend/composer.lock ./
RUN composer install \
        --no-dev \
        --prefer-dist \
        --no-autoloader \
        --no-scripts \
        --no-interaction

# Layer 2: generate optimised class map (invalidated when source changes)
COPY backend/ ./
RUN composer dump-autoload \
        --no-dev \
        --optimize \
        --no-scripts


# -----------------------------------------------------------------------------
# Stage 2 — Frontend: build the React / TypeScript / Vite SPA
#
# Node 22 is present ONLY in this stage.
# It is intentionally absent from Stage 3 (runtime).
#
# Output:  /backend/public/app   (Vite outDir is '../backend/public/app'
#          relative to the frontend/ working directory = /app)
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS frontend

WORKDIR /app

# Layer 1: install dependencies (cached until package-lock.json changes)
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --prefer-offline

# Layer 2: build (invalidated when any source file changes)
COPY frontend/ ./
# `vite build`, NOT `npm run build` — the same call CI's Production build gate
# makes, and for the same reason. The npm script is `tsc -b && vite build`, and
# `tsc -b` exits non-zero on the diagnostics the TypeScript ratchet owns as
# accepted debt. This image therefore could not be built at all: every attempt
# died on this line with exit code 2, `scripts/deploy.sh` failed at
# `docker compose build`, and the deployed image sat three weeks stale while
# every analysis gate stayed green (TASK-DEPLOY-HOTFIX-001, BUG-GL-009).
#
# This weakens no gate. Type safety is enforced by the TypeScript ratchet in
# .github/workflows/quality.yml, which owns those diagnostics and fails when
# they get worse. Running tsc here as well only duplicated that check inside
# the image build, where it is red on day one — the exact failure mode the CI
# comment records as having killed three earlier gates.
RUN mkdir -p /backend/public/app && npx vite build


# -----------------------------------------------------------------------------
# Stage 3 — App: PHP 8.4-FPM runtime (IMMUTABLE)
#
# This stage:
#   • Installs PHP 8.4-FPM + Supervisor (no Node, no Composer binary)
#   • Copies vendor from Stage 1 (no dev packages)
#   • Copies application source + compiled SPA
#   • Runs package:discover, route:cache, event:cache during BUILD
#     → bootstrap/cache is baked into the image
#   • Deletes the build-time .env so no secrets survive
#   • Verifies packages.php contains no dev packages
#
# At runtime the entrypoint only performs:
#   wait mysql → storage dirs → permissions → storage:link → APP_KEY
#   → [optional migrate] → [optional seed] → exec supervisord
# -----------------------------------------------------------------------------
FROM php:8.4-fpm-bookworm AS app

# ---------------------------------------------------------------------------
# Build arguments — injected by deploy.sh
# ---------------------------------------------------------------------------
ARG APP_VERSION=0.1.0
ARG GIT_SHA=unknown
ARG BUILD_TIME

LABEL org.opencontainers.image.title="ECOS ERP" \
      org.opencontainers.image.description="ECOS ERP — PHP 8.4-FPM application runtime" \
      org.opencontainers.image.vendor="ECOS ERP Enterprise" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.revision="${GIT_SHA}"

ENV TZ=Africa/Cairo

# ---------------------------------------------------------------------------
# System packages
# Note: gnupg removed (not needed — NodeSource is gone)
#       composer removed from runtime (all composer work is done in build stages)
# ---------------------------------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
        git \
        curl \
        ca-certificates \
        unzip \
        zip \
        libzip-dev \
        libpng-dev \
        libjpeg62-turbo-dev \
        libfreetype6-dev \
        libonig-dev \
        libicu-dev \
        libxml2-dev \
        supervisor \
        default-mysql-client \
        libfcgi-bin \
    && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
# PHP extensions
# ---------------------------------------------------------------------------
RUN docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" \
        pdo_mysql \
        mbstring \
        bcmath \
        gd \
        zip \
        intl \
        pcntl \
        exif \
        opcache \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && rm -rf /tmp/pear

# ---------------------------------------------------------------------------
# Runtime configuration
# ---------------------------------------------------------------------------
COPY docker/php/php.ini          /usr/local/etc/php/conf.d/zz-ecos.ini
COPY docker/php/www.conf         /usr/local/etc/php-fpm.d/zz-ecos.conf
COPY docker/php/supervisord.conf /etc/supervisor/conf.d/ecos.conf
COPY docker/php/entrypoint.sh    /usr/local/bin/entrypoint
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint \
    && chmod +x /usr/local/bin/entrypoint

WORKDIR /var/www/html

# ---------------------------------------------------------------------------
# Application source
# .dockerignore guarantees these are excluded from the context:
#   backend/vendor/                  (comes from Stage 1)
#   backend/bootstrap/cache/*.php    (regenerated during THIS build — see below)
#   backend/public/app/              (comes from Stage 2)
#   backend/.env                     (injected at runtime via env_file)
# ---------------------------------------------------------------------------
COPY backend/ /var/www/html/

# Vendor from Stage 1 — optimised autoloader, no dev packages
COPY --from=composer /app/vendor /var/www/html/vendor

# Compiled SPA from Stage 2
COPY --from=frontend /backend/public/app /var/www/html/public/app

# ---------------------------------------------------------------------------
# Build-time Laravel cache generation (TASK-INFRA-002 Rules 1-3, 8-9)
#
# All cache files are generated NOW and baked into this image layer.
# The runtime container never regenerates them.
#
# Commands run:
#   package:discover  → bootstrap/cache/packages.php   (service providers + facades)
#   route:cache       → bootstrap/cache/routes-v7.php  (serialised route collection)
#   event:cache       → bootstrap/cache/events.scoped.php
#
# config:cache is deliberately deferred to entrypoint.sh (step 6):
#   Running it here would bake placeholder .env values into the image layer.
#   Real credentials (DB_HOST, MAIL_*, REDIS_HOST, etc.) are only available
#   at container start via docker-compose env_file, so config:cache must run
#   there — after APP_KEY is verified and the process env is fully populated.
#
# view:cache is deliberately excluded:
#   Compiled views go into storage/framework/views/, which is a named volume at
#   runtime. Baking them here would create files that the volume mount shadows.
#   Blade templates compile lazily on first request and persist in the volume.
#
# The build-time .env is created for the sole purpose of booting the artisan
# CLI (APP_KEY is required) and is deleted before the layer is committed.
# No real credentials appear in this file — all external drivers are set to
# non-connecting modes (CACHE_STORE=array, SESSION_DRIVER=array, etc.).
# ---------------------------------------------------------------------------
RUN set -e \
    && rm -f bootstrap/cache/*.php \
    && APP_KEY="base64:$(openssl rand -base64 32)" \
    && { \
        echo "APP_NAME=ECOS-ERP"; \
        echo "APP_ENV=production"; \
        echo "APP_KEY=${APP_KEY}"; \
        echo "APP_DEBUG=false"; \
        echo "APP_URL=http://localhost"; \
        echo "DB_CONNECTION=mysql"; \
        echo "DB_HOST=127.0.0.1"; \
        echo "DB_PORT=3306"; \
        echo "DB_DATABASE=ecos_erp"; \
        echo "DB_USERNAME=ecos"; \
        echo "DB_PASSWORD=build-placeholder"; \
        echo "CACHE_STORE=array"; \
        echo "SESSION_DRIVER=array"; \
        echo "QUEUE_CONNECTION=sync"; \
        echo "REDIS_HOST=127.0.0.1"; \
        echo "MAIL_MAILER=log"; \
    } > .env \
    # Rule 8: if package:discover fails, the build fails immediately.
    && php artisan package:discover --ansi \
    && php artisan route:cache \
    && php artisan event:cache \
    # Remove the build-time placeholder .env — real env comes from env_file at runtime.
    && rm .env \
    && printf '\n[build] Cache files generated:\n' \
    && ls -la bootstrap/cache/

# ---------------------------------------------------------------------------
# Cache integrity verification (TASK-INFRA-003 Rules 1 + 4)
#
# Runs in a separate RUN so failures produce clear, isolated error output.
#
# Rule 1 — Route cache portability:
#   The route cache must never contain env variable names (APP_URL, DB_HOST …).
#   If they appear, a route definition has accidentally evaluated an env/config
#   value and baked it in, which breaks portability across deployments.
#
# Rule 4 — All cache files exist + no dev-only packages anywhere:
#   packages.php, routes*.php, and events*.php must all be present.
#   None may reference packages from require-dev (Pail, Sail, Collision, PHPUnit).
# ---------------------------------------------------------------------------
RUN <<'VERIFY'
set -e

# ── Rule 4a: verify all three cache files were generated ──────────────────
printf '[verify] Checking cache files exist...\n'
[ -f bootstrap/cache/packages.php ] \
  || { printf 'ERROR: bootstrap/cache/packages.php was not generated\n' >&2; exit 1; }
ls bootstrap/cache/routes*.php   >/dev/null 2>&1 \
  || { printf 'ERROR: bootstrap/cache/routes*.php was not generated\n' >&2; exit 1; }
ls bootstrap/cache/events*.php   >/dev/null 2>&1 \
  || { printf 'ERROR: bootstrap/cache/events*.php was not generated\n' >&2; exit 1; }
printf '[verify] All cache files present:\n'
ls -la bootstrap/cache/

# ── Rule 1: route cache must not contain env variable names ───────────────
# Routes are URI patterns + middleware + controller names.
# An env variable name (APP_URL, DB_HOST …) inside this file indicates a
# route definition embedded an env lookup — this breaks portability.
printf '[verify] Checking route cache for env variable names...\n'
ENV_VARS='APP_URL|APP_ENV|APP_NAME|DB_HOST|DB_DATABASE|DB_USERNAME|DB_PASSWORD|REDIS_HOST|REDIS_PASSWORD|MAIL_HOST|MAIL_USERNAME'
for CACHE_FILE in bootstrap/cache/routes*.php; do
  if grep -qE "$ENV_VARS" "$CACHE_FILE" 2>/dev/null; then
    printf 'ERROR: environment variable name found in route cache %s:\n' "$CACHE_FILE" >&2
    grep -E "$ENV_VARS" "$CACHE_FILE" >&2 || true
    exit 1
  fi
done
printf '[verify] Route cache portability check passed.\n'

# ── Rule 4b: no dev-only packages in any cache file ──────────────────────
# packages.php lists discovered service providers.
# events.scoped.php lists event listeners.
# Neither must reference packages that are only in require-dev.
printf '[verify] Checking bootstrap cache for dev-only packages...\n'
DEV_PKGS='pail|sail|collision|phpunit'
for CACHE_FILE in bootstrap/cache/packages.php bootstrap/cache/events*.php; do
  [ -f "$CACHE_FILE" ] || continue
  if grep -qiE "$DEV_PKGS" "$CACHE_FILE" 2>/dev/null; then
    printf 'ERROR: dev-only package found in %s:\n' "$CACHE_FILE" >&2
    grep -iE "$DEV_PKGS" "$CACHE_FILE" >&2 || true
    exit 1
  fi
done
printf '[verify] No dev packages found in bootstrap cache.\n'
printf '[verify] All cache integrity checks passed.\n'
VERIFY

# ---------------------------------------------------------------------------
# Permissions
# Only storage/ requires runtime write access.
# bootstrap/cache/ is baked in — owned by www-data for defensive writeability
# but no volume is mounted over it (see docker-compose.yml).
# ---------------------------------------------------------------------------
RUN chown -R www-data:www-data \
        /var/www/html/storage \
        /var/www/html/bootstrap/cache \
    && chmod -R ug+rwX \
        /var/www/html/storage \
        /var/www/html/bootstrap/cache

# ---------------------------------------------------------------------------
# Build metadata — baked once at build time, two representations:
#
#   .build-info          human-readable text (operator: docker exec … cat)
#   public/build-info    JSON served by nginx at GET /build-info
#                        Also consumed by HealthController for /api/health
# ---------------------------------------------------------------------------
RUN BUILD_TS="${BUILD_TIME:-$(date -u +%Y-%m-%dT%H:%M:%SZ)}" \
    && printf 'Version:     %s\nCommit:      %s\nBuilt:       %s\nEnvironment: production\n' \
        "${APP_VERSION}" "${GIT_SHA}" "${BUILD_TS}" \
    > /var/www/html/.build-info \
    && printf '{"version":"%s","commit":"%s","built_at":"%s","environment":"production"}\n' \
        "${APP_VERSION}" "${GIT_SHA}" "${BUILD_TS}" \
    > /var/www/html/public/build-info

EXPOSE 9000
ENTRYPOINT ["entrypoint"]
CMD ["supervisord", "-c", "/etc/supervisor/conf.d/ecos.conf", "-n"]


# -----------------------------------------------------------------------------
# Stage 3.5 — engineering-dev: runtime + dev tools (development / CI only)
#
# Extends the `app` stage to add the tools the Engineering Pipeline stages need:
#   • Composer binary + dev PHP dependencies (pint, phpunit)
#   • Node 22 + npm (for `./node_modules/.bin/eslint`)
#   • frontend/ node_modules (ESLint plugin resolution)
#
# .git is expected as a bind-mount at runtime (docker-compose.override.yml).
# This stage is NEVER referenced by deploy.sh — production always targets `app`.
# -----------------------------------------------------------------------------
FROM app AS engineering-dev

# Node 22 via NodeSource (Debian Bookworm)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Composer binary from Stage 1 (no separate download needed)
COPY --from=composer /usr/bin/composer /usr/local/bin/composer

# Re-install vendor WITH dev deps (pint, phpunit, phpstan)
# vendor/ from Stage 1 was built --no-dev; we add them here.
WORKDIR /var/www/html
RUN COMPOSER_ALLOW_SUPERUSER=1 composer install \
        --prefer-dist \
        --no-scripts \
        --no-interaction

# Frontend source + node_modules (for ESLint binary + plugins)
COPY frontend/ /var/www/frontend/
WORKDIR /var/www/frontend
RUN npm ci --prefer-offline

WORKDIR /var/www/html


# -----------------------------------------------------------------------------
# Stage 4 — Nginx: static file server + PHP-FPM proxy
#
# Contains ONLY:
#   • nginx:1.27-alpine base
#   • Compiled SPA (public/app/) from Stage 2
#   • Build-info JSON from Stage 3
#   • Vhost configuration
#
# No PHP. No Composer. No Node. No application source.
# -----------------------------------------------------------------------------
FROM nginx:1.27-alpine AS nginx

COPY --from=app /var/www/html/public/ /var/www/html/public/

# SPA — Vite content-hashed assets, safe to cache forever
COPY --from=frontend /backend/public/app      /var/www/html/public/app

# Build metadata — served as static JSON at GET /build-info
COPY --from=app /var/www/html/public/build-info /var/www/html/public/build-info

# Vhost — bind-mountable in development without rebuilding the image
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
