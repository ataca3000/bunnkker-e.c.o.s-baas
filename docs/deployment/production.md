# ECOS ERP — Production Deployment Guide

## Architecture

```
Build pipeline (docker build — runs once per deploy)
  Stage 1  composer   composer install --no-dev --optimize-autoloader
                      composer dump-autoload --no-dev --optimize
  Stage 2  frontend   npm ci && npm run build → /backend/public/app
  Stage 3  app        php:8.4-fpm-bookworm + vendor + SPA + metadata
                      artisan package:discover + route:cache + event:cache
                      → image: ecos-erp/app:latest
  Stage 4  nginx      nginx:1.27-alpine + SPA + build-info
                      → image: ecos-erp/nginx:latest

Runtime containers (docker compose up)
  ecos-app    ← ecos-erp/app    PHP-FPM (port 9000) + Supervisor
                                 Supervisor manages: php-fpm, queue:work, schedule:work
  ecos-nginx  ← ecos-erp/nginx  Nginx static server + PHP-FPM proxy (port 80)
  ecos-mysql  ← mysql:8.4       Database
  ecos-redis  ← redis:7-alpine  Queue backend + cache + sessions
  ecos-mailpit ← axllent/mailpit SMTP sink — replace with real MTA before go-live

Named volumes (runtime-mutable data only)
  app-storage  → /var/www/html/storage     uploads, sessions, logs, compiled views
  mysql-data   → /var/lib/mysql
  redis-data   → /data                     AOF persistence
```

### Immutability guarantee

The runtime container **never** runs `composer install`, `npm build`, `artisan optimize`,
`artisan config:cache`, or `artisan route:cache`. All of these are executed inside
`docker build` (Stages 1–3) and baked into the image.

`config:cache` is intentionally excluded — it would bake env values into the image.
`view:cache` is intentionally excluded — views compile into `storage/framework/views/`
on the runtime volume, not into the image layer.

---

## Environment Configuration

### Required variables (must be set before first deploy)

| Variable | Description | Example |
|---|---|---|
| `APP_ENV` | Must be `staging` or `production` | `staging` |
| `APP_DEBUG` | Must be `false` | `false` |
| `APP_URL` | Full public URL including scheme | `https://staging.ecos-erp.com` |
| `APP_KEY` | 32-byte random key, base64-encoded | `base64:abc123...` |
| `DB_HOST` | MySQL Docker service name | `mysql` |
| `DB_DATABASE` | Database name | `ecos_erp` |
| `DB_USERNAME` | Database user | `ecos` |
| `DB_PASSWORD` | Strong password — not `secret` | `Xk8#mP...` |
| `REDIS_HOST` | Redis Docker service name | `redis` |
| `REDIS_PORT` | Redis port | `6379` |
| `SANCTUM_STATEFUL_DOMAINS` | SPA domain for cookie auth | `staging.ecos-erp.com` |
| `QUEUE_CONNECTION` | Must be `redis` | `redis` |
| `SESSION_DRIVER` | Must be `redis` | `redis` |
| `CACHE_STORE` | Must be `redis` | `redis` |

### Recommended security settings

| Variable | Recommended | Notes |
|---|---|---|
| `SESSION_ENCRYPT` | `true` | Encrypts session data in Redis |
| `SESSION_SECURE_COOKIE` | `true` | Requires HTTPS |
| `SESSION_SAME_SITE` | `lax` | Default; fine for SPA |
| `LOG_LEVEL` | `warning` | Avoid `debug` in production |
| `TRUSTED_PROXIES` | `*` (Docker) or CIDRs (bare-metal) | See below |

### TRUSTED_PROXIES

`TRUSTED_PROXIES` controls which IP addresses Laravel trusts to supply
`X-Forwarded-*` headers (client IP, protocol, port).

```
TRUSTED_PROXIES=*
```

`*` (trust all) is **safe in Docker** because PHP-FPM (port 9000) is only reachable
from inside the Docker bridge network — no external client can directly send
fabricated headers. External traffic always passes through `ecos-nginx`.

For bare-metal or mixed deployments where PHP-FPM might be reachable from
untrusted networks, use specific CIDRs:

```
TRUSTED_PROXIES=10.0.0.0/8,172.16.0.0/12
```

### Generating APP_KEY (new install only)

```bash
docker run --rm php:8.4-cli \
    php -r "echo 'base64:'.base64_encode(random_bytes(32)).PHP_EOL;"
```

Paste the output into `backend/.env` as `APP_KEY=base64:...`.

---

## First Deployment

```bash
# 1. Clone the repository
git clone <repo-url> /opt/ecos-erp
cd /opt/ecos-erp

# 2. Create .env
cp backend/.env.example backend/.env

# 3. Fill in all required variables
#    (APP_KEY, DB_PASSWORD, SANCTUM_STATEFUL_DOMAINS are the most common omissions)
nano backend/.env

# 4. Confirm docker-compose.override.yml does NOT exist
ls docker-compose.override.yml   # must show "No such file or directory"

# 5. First deploy — always pass --migrate on a new install
./deploy.sh --migrate

# 6. Seed geography data (once only — idempotent)
docker compose -f docker-compose.yml exec app \
    php artisan db:seed --class=EgyptMasterGeographySeeder --force

# 7. Verify all health fields are true
curl http://localhost/api/health | python3 -m json.tool
```

Expected `/api/health` response after a healthy first deploy:

```json
{
  "status": "ok",
  "environment": "staging",
  "version": "v1.0.0-rc1",
  "git_sha": "1bc457d",
  "built_at": "2026-07-10T08:00:00Z",
  "database": true,
  "redis": true,
  "queue": true,
  "storage": true,
  "scheduler": true,
  "disk_free": "42.3 GB",
  "memory": "32.4 MB / 256M",
  "timestamp": "2026-07-10T11:00:00+03:00"
}
```

---

## Upgrade Deployment

### Code change only (no schema changes)

```bash
cd /opt/ecos-erp
./deploy.sh
```

### Code change with schema migrations

```bash
cd /opt/ecos-erp
./deploy.sh --migrate
```

The `--migrate` flag is an **explicit operator decision**. Always confirm the
migration is safe before passing this flag. `deploy.sh` will:

1. Show pending migrations before applying them
2. Take a gzip DB snapshot to `/tmp/ecos-premigrate-<timestamp>.sql.gz`
3. Run `migrate --force`
4. Print the snapshot restore command if migration fails

---

## What deploy.sh Does (Full Flow)

```
 1. Validate backend/.env
    ✓ docker-compose.yml exists
    ✓ backend/.env exists
    ✗ docker-compose.override.yml must NOT exist
    ✓ APP_ENV is 'staging' or 'production'
    ✓ APP_DEBUG is false
    ✓ APP_KEY is set and has base64:<key> format
    ✓ DB_PASSWORD is not the default 'secret'
    ✓ SANCTUM_STATEFUL_DOMAINS is set

 2. Security audit (warnings, does not abort)
    ⚠ SESSION_ENCRYPT should be true
    ⚠ SESSION_SECURE_COOKIE should be true (HTTPS)
    ⚠ LOG_LEVEL should not be 'debug'

 3. Tag current images as :rollback

 4. git pull origin main

 5. docker compose build --pull
    (composer install + npm build + artisan cache baked into image)

 6. Image self-test
    ✓ php artisan --version runs without composer
    ✓ No dev packages in bootstrap/cache/packages.php

 7. docker compose up -d --remove-orphans

 8. Wait for ecos-app PHP-FPM healthcheck (200 s timeout)

 9. [--migrate only]
    - Show pending migrations
    - Create DB snapshot → /tmp/ecos-premigrate-<ts>.sql.gz
    - php artisan migrate --force

10. Deployment verification
    - php artisan about (Laravel environment check)
    - php artisan route:list (route count from cache)
    - php artisan queue:restart (signal workers to reload)
    - supervisorctl status (PHP-FPM + queue + scheduler running)

11. Endpoint verification (all must return HTTP 200)
    GET /healthz          nginx infrastructure check
    GET /build-info       static build metadata
    GET /app/             React SPA
    GET /api/health       Laravel + DB + Redis + Queue full-stack check
    File checks: public/app/index.html in both containers

12. Deployment validation (PASS/FAIL table)
    ✓ PASS  Laravel boot
    ✓ PASS  MySQL
    ✓ PASS  Redis
    ✓ PASS  Queue
    ✓ PASS  Storage
    ✓ PASS  Scheduler
    ✓ PASS  Storage symlink

13. docker image prune -f
```

If **any step fails after containers were updated**, the ERR trap automatically:
- Tags `:rollback` images back to `:latest`
- Runs `docker compose up -d --no-build` with the previous images
- Prints the DB snapshot restore command (if `--migrate` was used)

---

## Rollback Procedure

### Automatic (via deploy.sh ERR trap)

Any failure after Step 7 automatically restores the previous images and restarts.
No operator action required.

### Manual instant rollback (no rebuild)

```bash
# Restore previous image tags
docker tag ecos-erp/app:rollback   ecos-erp/app:latest
docker tag ecos-erp/nginx:rollback ecos-erp/nginx:latest

# Restart from previous images (no build, takes ~10 s)
docker compose -f docker-compose.yml up -d --no-build

# Verify
curl http://localhost/api/health
curl http://localhost/build-info
```

### Schema rollback after a failed migration

> **Warning:** Schema rollback is never performed automatically.
> Data written after a migration ran may be lost if the schema is reverted.

If `deploy.sh` printed a snapshot path on rollback:

```bash
# Restore DB from the pre-migration snapshot
zcat /tmp/ecos-premigrate-<timestamp>.sql.gz \
    | docker compose -f docker-compose.yml exec -T \
        -e MYSQL_PWD=<DB_PASSWORD> \
        mysql mysql -u<DB_USERNAME> <DB_DATABASE>

# Then rollback the images
docker tag ecos-erp/app:rollback   ecos-erp/app:latest
docker tag ecos-erp/nginx:rollback ecos-erp/nginx:latest
docker compose -f docker-compose.yml up -d --no-build
```

### Git revert + redeploy

```bash
git revert HEAD
git push origin main
./deploy.sh           # add --migrate only if the revert includes a down() migration
```

---

## Recovery Procedure

Use this when the application is down and a standard rollback failed.

### Step 1 — Assess the failure

```bash
# Container health
docker compose -f docker-compose.yml ps
docker inspect --format='{{json .State.Health}}' ecos-app

# Recent logs
docker logs ecos-app  --tail 50
docker logs ecos-nginx --tail 20

# Laravel health (if PHP-FPM is up)
docker compose -f docker-compose.yml exec app php artisan about
```

### Step 2 — Quick restart (no rebuild)

```bash
docker compose -f docker-compose.yml restart app
docker compose -f docker-compose.yml restart nginx
```

### Step 3 — Restore previous images

```bash
docker tag ecos-erp/app:rollback   ecos-erp/app:latest
docker tag ecos-erp/nginx:rollback ecos-erp/nginx:latest
docker compose -f docker-compose.yml up -d --no-build
```

### Step 4 — Restore DB from snapshot (if schema is broken)

```bash
# List available snapshots
ls -lh /tmp/ecos-premigrate-*.sql.gz

# Restore
zcat /tmp/ecos-premigrate-<timestamp>.sql.gz \
    | docker compose -f docker-compose.yml exec -T \
        -e MYSQL_PWD=<DB_PASSWORD> \
        mysql mysql -u<DB_USERNAME> <DB_DATABASE>
```

### Step 5 — Wipe storage volume (only if storage is corrupt)

```bash
# ⚠️ This deletes all uploaded files, sessions, and logs.
# Only use as last resort when the storage volume itself is corrupted.
docker compose -f docker-compose.yml down
docker volume rm ecos-erp_app-storage
docker compose -f docker-compose.yml up -d
```

### Step 6 — Full wipe and redeploy

```bash
docker compose -f docker-compose.yml down -v   # destroys all volumes including DB
# Restore DB from a full database backup taken before the incident
./deploy.sh --migrate
```

---

## Health Endpoints

| Endpoint | Owner | What it checks | Healthcheck used by |
|---|---|---|---|
| `GET /healthz` | Nginx static return | nginx is alive | n/a (manual) |
| `GET /build-info` | Static JSON in nginx image | Version / SHA / build time | n/a |
| `GET /api/health` | Laravel HealthController | DB + Redis + Queue + Storage + Scheduler | Docker nginx healthcheck |
| `GET /up` | Laravel framework default | Laravel can boot | n/a |

`/api/health` response schema:

```json
{
  "status":      "ok | degraded",
  "environment": "staging | production",
  "version":     "v1.0.0-rc1",
  "git_sha":     "1bc457d",
  "built_at":    "2026-07-10T08:00:00Z",
  "database":    true,
  "redis":       true,
  "queue":       true,
  "storage":     true,
  "scheduler":   true,
  "disk_free":   "42.3 GB",
  "memory":      "32.4 MB / 256M",
  "timestamp":   "2026-07-10T11:00:00+03:00"
}
```

HTTP 200 when `database && redis && queue` are all true.
HTTP 503 when any core dependency is unreachable.
`storage` and `scheduler` are informational — they do not affect the status code.

---

## Operational Commands

```bash
# Container status
docker compose -f docker-compose.yml ps

# Tail all logs
docker compose -f docker-compose.yml logs -f

# Shell into app container
docker compose -f docker-compose.yml exec app bash

# Any artisan command
docker compose -f docker-compose.yml exec app php artisan <command>

# Supervisor process status
docker compose -f docker-compose.yml exec app supervisorctl status

# Queue monitor
docker compose -f docker-compose.yml exec app php artisan queue:monitor redis

# Clear Laravel caches (forces regeneration on next request)
docker compose -f docker-compose.yml exec app php artisan optimize:clear

# Force-restart nginx (e.g. after nginx config change)
docker compose -f docker-compose.yml restart nginx

# View /api/health prettily
curl -s http://localhost/api/health | python3 -m json.tool
```

---

## Troubleshooting

### 502 Bad Gateway

```bash
# Is PHP-FPM healthy?
docker inspect --format '{{json .State.Health}}' ecos-app

# FPM ping (manual)
docker exec ecos-app bash -c \
  'SCRIPT_NAME=/fpm-ping SCRIPT_FILENAME=/fpm-ping REQUEST_METHOD=GET \
   cgi-fcgi -bind -connect 127.0.0.1:9000'

# Logs
docker logs ecos-app --tail 50
```

### Client IP shows as proxy IP (rate limiting / logging wrong)

Ensure `TRUSTED_PROXIES` is set in `backend/.env` and the application has been
restarted. The `trustProxies` middleware in `bootstrap/app.php` reads this value.

```bash
# Verify correct IP resolution
docker compose exec app php artisan tinker --execute="echo request()->ip();"
# Should return the real client IP, not the Docker bridge IP.
```

### SPA returns 401 on every API call

`SANCTUM_STATEFUL_DOMAINS` is missing or incorrect.

```bash
# Check the current value in the running container
docker compose exec app php artisan tinker \
    --execute="echo config('sanctum.stateful');"
```

### Session cookie not set as Secure

`SESSION_SECURE_COOKIE=true` requires the app to be behind HTTPS.
`$request->secure()` must return `true`, which requires `TRUSTED_PROXIES` to
trust the `X-Forwarded-Proto: https` header from Nginx.

Verify the chain:

```bash
# Should print "true" when a request arrived via HTTPS
docker compose exec app php artisan tinker \
    --execute="echo app(Illuminate\Http\Request::class)->secure();"
```

### Migration failures

```bash
docker compose -f docker-compose.yml exec app php artisan migrate:status
docker compose -f docker-compose.yml exec app php artisan migrate --force --verbose
```

### Storage permission errors

```bash
docker exec ecos-app bash -c \
  'chown -R www-data:www-data /var/www/html/storage'
```

### GET /build-info returns 404

The `public/build-info` file was not copied into the nginx image (Stage 4).
Rebuild without cache:

```bash
docker compose -f docker-compose.yml build --no-cache nginx
docker compose -f docker-compose.yml up -d nginx
```

---

## Production Readiness Checklist

- [x] Immutable images — no source bind-mounts in production
- [x] Bootstrap cache (package:discover + route:cache + event:cache) baked in
- [x] No dev packages in runtime image
- [x] No Node.js in runtime image
- [x] Build traceability (GIT_SHA, APP_VERSION, BUILD_TIME baked in + exposed at /build-info)
- [x] Storage directories auto-created at container start
- [x] Idempotent entrypoint (safe to restart without side effects)
- [x] Automatic rollback on deploy failure (ERR trap)
- [x] APP_DEBUG guard in deploy.sh (blocks deploy if true)
- [x] APP_ENV guard in deploy.sh (blocks deploy if 'local')
- [x] APP_KEY format guard in deploy.sh
- [x] DB_PASSWORD default guard in deploy.sh
- [x] SANCTUM_STATEFUL_DOMAINS guard in deploy.sh
- [x] Override file guard in deploy.sh (blocks dev override on server)
- [x] Pre-migration DB snapshot with guided restore on failure
- [x] Post-deploy artisan verification (about, route:list, queue:restart)
- [x] 7-point PASS/FAIL validation table after deploy
- [x] /api/health checks DB + Redis + Queue + Storage + Scheduler
- [x] Reverse proxy support (TRUSTED_PROXIES, X-Forwarded-* headers)
- [x] Sanctum SPA auth (SANCTUM_STATEFUL_DOMAINS)
- [ ] TLS / HTTPS (Nginx + certbot or Cloudflare proxy)
- [ ] CORS restricted to specific origins (config/cors.php)
- [ ] Image registry (push to registry for distributed rollback)
- [ ] Secrets manager (Docker Secrets or Vault)
- [ ] Mailpit replaced with real MTA (SES / Mailgun / Postfix)
