# ECOS ERP — Deployment Guide

## Overview

Every merge to `main` automatically deploys to **production**.
Every merge to `staging` automatically deploys to **staging**.
Any environment can also be deployed manually via GitHub Actions → Run workflow.

```
Developer  →  git push  →  GitHub Actions  →  SSH  →  Remote Server
                                                          git pull
                                                          composer install --no-dev
                                                          php artisan migrate --force
                                                          vite build (node:22-alpine container)
                                                          docker compose up -d --wait
                                                          php artisan optimize
                                                          php artisan queue:restart
                                                          healthcheck.sh
                                                          Deployment report
```

---

## Architecture

| Component | Technology | Notes |
|---|---|---|
| Runtime | PHP 8.4-FPM + Supervisor | Queue worker + scheduler in one container |
| Web server | Nginx 1.27 | Serves `/app/*` static, proxies `/api/*` to PHP-FPM |
| Frontend | React + Vite | Built into `backend/public/app/` |
| Database | MySQL 8.4 | Named volume, persists across deployments |
| Queue | Redis | Named volume, persists across deployments |
| Container orchestration | Docker Compose v2 | Single-host |

The deployment script uses **bind-mount mode**: the project is cloned on the host and `backend/` is mounted into the containers. Static file changes (CSS, JS) are visible to Nginx immediately without a container restart because Nginx reads from the bind-mounted `backend/public/`.

---

## One-Time Server Setup

Perform this once per server before the first automated deployment.

### 1. Install prerequisites

```bash
# Docker Engine + Compose plugin
curl -fsSL https://get.docker.com | bash
apt-get install -y rsync git

# Add your deploy user to the docker group
usermod -aG docker $DEPLOY_USER
```

### 2. Clone the repository

```bash
cd /srv                          # or wherever you want the project
git clone git@github.com:<org>/ecos-erp.git ecos-erp
cd ecos-erp
```

### 3. Configure environment

```bash
cp backend/.env.example backend/.env
# Edit backend/.env — set APP_KEY, DB_*, REDIS_*, QUEUE_CONNECTION=redis, etc.
php -r "echo 'base64:'.base64_encode(random_bytes(32)).PHP_EOL;"   # generate APP_KEY
```

### 4. Generate an SSH deploy key

On your **local machine**:

```bash
ssh-keygen -t ed25519 -C "ecos-erp-deploy" -f ~/.ssh/ecos_deploy -N ""
cat ~/.ssh/ecos_deploy.pub   # add this to the server's ~/.ssh/authorized_keys
cat ~/.ssh/ecos_deploy       # copy this — it becomes the SSH_PRIVATE_KEY secret
```

On the **server**:

```bash
echo "<paste public key here>" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

### 5. First manual start

```bash
cd /srv/ecos-erp
docker compose up -d
```

The container entrypoint runs migrations and seeds on first start automatically.

---

## GitHub Secrets

Configure the following secrets in **GitHub → Settings → Environments** for each environment (`production`, `staging`, `development`).

| Secret | Example | Description |
|---|---|---|
| `SSH_PRIVATE_KEY` | `-----BEGIN OPENSSH PRIVATE KEY-----…` | Ed25519 private key with server access |
| `DEPLOY_HOST` | `76.13.49.162` | Server IP or hostname |
| `DEPLOY_USER` | `ubuntu` | SSH login user |
| `DEPLOY_PATH` | `/srv/ecos-erp` | Absolute path to the project root on the server |
| `DEPLOY_PORT` | `22` | SSH port (optional — defaults to 22) |

**GitHub Environments also allow:**
- **Required reviewers** — require a human to approve before a production deployment proceeds
- **Wait timer** — add a delay (e.g., 10 minutes) so the staging deploy can be validated first
- **Deployment branches** — restrict which branches can deploy to production

---

## Deployment Pipeline

### Automatic triggers

| Branch push | Target environment |
|---|---|
| `main` | production |
| `staging` | staging |

### Manual trigger

GitHub → Actions → **Deploy** → **Run workflow** → select environment.

### What the pipeline does

```
GitHub Actions (ubuntu-latest runner)
│
├── Checkout source code
├── Write SSH private key
├── Add server to known_hosts
├── rsync scripts/ → server (always latest before running)
│
└── SSH into server → deploy.sh
    │
    ├── 1. git pull                           (host)
    ├── 2. composer install --no-dev          (docker compose exec app)
    ├── 3. php artisan migrate --force        (docker compose exec app)
    ├── 4. npm ci + vite build                (docker run node:22-alpine)
    ├── 5. docker compose up -d --wait        (host — waits for healthchecks)
    ├── 6. php artisan optimize               (docker compose exec app)
    ├── 7. php artisan queue:restart          (docker compose exec app)
    └── 8. healthcheck.sh                     (curl /healthz + /api + /app)
```

**Why run `php artisan optimize` after `docker compose up -d`?**
The container entrypoint (`docker/php/entrypoint.sh`) runs `config:clear`, `route:clear`, and `view:clear` on startup. If the container was recreated by `up -d`, those clears happen after step 2's composer install. Running `optimize` in step 6 — after `up -d` — guarantees the cache is built on top of the freshly started container.

### Concurrency

Deployments to the same branch are serialized (`cancel-in-progress: false`). A second push while a deployment is in flight will wait in the queue — it will never be cancelled mid-deploy, which could leave the server in a broken state.

---

## Environments

### Production (`main` branch)

- Domain: `http://aseelhoneyeg.com/app/` (DNS not yet pointed — parked on Hostinger)
- Server IP: `76.13.49.162` (direct access while domain is unpropagated)
- **DNS action required**: set the Hostinger A record for `aseelhoneyeg.com` → `76.13.49.162`
- Configure `required reviewers` in the GitHub Environment for extra safety.

### Staging (`staging` branch)

- URL: configure `DEPLOY_HOST` in the `staging` GitHub Environment.
- Recommended: run on the same Docker Compose stack with a different `.env`.

### Development

- Deployed manually only (workflow_dispatch).
- Typically the developer's local machine — `localhost`.

---

## Manual Deployment

If GitHub Actions is unavailable, deploy directly from the server:

```bash
ssh ubuntu@76.13.49.162        # until DNS propagates
# ssh ubuntu@aseelhoneyeg.com  # use once A record is live
cd /srv/ecos-erp

bash scripts/deploy.sh <git-sha> main your-name
```

Or to deploy the current HEAD of a branch:

```bash
bash scripts/deploy.sh HEAD main manual
```

---

## Rollback

### Automatic rollback

The deploy script saves the previous commit SHA to `.deploy_rollback` at the start of every deployment. If the health check fails, the deploy script exits with an error — **it does not automatically revert**.

Roll back immediately after a failed deploy:

```bash
ssh ubuntu@aseelhoneyeg.com   # or: ssh ubuntu@76.13.49.162
cd /srv/ecos-erp
bash scripts/rollback.sh
```

### Roll back to a specific commit

```bash
bash scripts/rollback.sh <previous-git-sha>
```

### What rollback.sh does

1. `git reset --hard <target-sha>` — reverts application code
2. `composer install --no-dev` — restores PHP dependencies for that commit
3. `npm ci + vite build` — rebuilds frontend assets for that commit
4. `docker compose up -d --wait` — restarts containers
5. `php artisan optimize` — rebuilds caches
6. `php artisan queue:restart` — restarts queue workers
7. `healthcheck.sh` — verifies the rollback succeeded

### Database migrations

**Rollback.sh does NOT reverse migrations.** This is intentional — reverting migrations on a live database can cause data loss.

If the rolled-back commit had schema changes and you need to reverse them:

```bash
# Identify how many migrations to roll back
docker compose exec app php artisan migrate:status

# Reverse one step
docker compose exec app php artisan migrate:rollback

# Reverse N steps
docker compose exec app php artisan migrate:rollback --step=N
```

Consult the DBA before reversing migrations on production.

### Rollback strategy summary

| Scenario | Action |
|---|---|
| Bad code, no schema change | `rollback.sh` — safe, instant |
| Bad code + new migration (data-safe) | `rollback.sh` then `migrate:rollback` |
| Bad code + destructive migration | Restore from database backup first |
| Container will not start | `git reset --hard` + `docker compose up -d` manually |

---

## Health Checks

### Automated (after every deployment)

`scripts/healthcheck.sh` runs three checks:

| Check | Expected | Meaning |
|---|---|---|
| `GET /healthz` | `200 OK` text `ok` | Nginx is up |
| `GET /api/auth/me` | `200` or `401` | PHP-FPM + Laravel are responding |
| `GET /app/index.html` | `200`, body contains `src="/app/assets/…"` | Frontend is built and served |

Default timeout: 60 seconds, polling every 5 seconds.

### On-demand

```bash
bash scripts/healthcheck.sh                              # checks http://localhost
bash scripts/healthcheck.sh http://aseelhoneyeg.com      # checks production (after DNS)
bash scripts/healthcheck.sh http://76.13.49.162          # checks production (by IP, always)
bash scripts/healthcheck.sh http://localhost 120         # custom 120-second timeout
```

### Container-level health checks

Both `app` and `nginx` have Docker healthchecks in `docker-compose.yml`. The deployment step `docker compose up -d --wait` blocks until all healthchecks pass, so `healthcheck.sh` runs only after the containers are fully ready.

```bash
# Check container health manually
docker compose ps
docker inspect ecos-app  | jq '.[].State.Health'
docker inspect ecos-nginx | jq '.[].State.Health'
```

---

## Deployment Logs

Every deployment and rollback writes a timestamped log to `storage/logs/`:

```
backend/storage/logs/deploy-20260626_083100.log
backend/storage/logs/rollback-20260626_092000.log
```

These are on the server in the project directory and are excluded from git.

---

## Troubleshooting

### Deployment is stuck at `docker compose up -d --wait`

The `--wait` flag blocks until all healthchecks pass. Check container status:

```bash
docker compose ps
docker compose logs --tail=50 app
docker compose logs --tail=50 nginx
```

If the `app` container is unhealthy, check the entrypoint log for DB connection errors:

```bash
docker compose logs app | grep 'entrypoint\|MySQL\|ERROR'
```

### `composer install` fails

The `app` container must be running before `composer install` can be exec'd into it:

```bash
docker compose ps app   # must be "running" or "healthy"
docker compose start app
```

### Frontend build fails

The `node:22-alpine` image must be pullable. On an offline server:

```bash
docker pull node:22-alpine   # run on a machine with internet access, then save/load
docker save node:22-alpine | ssh user@server docker load
```

### PHP-FPM not picking up new code

The `backend/` bind mount means PHP-FPM reads files directly from disk. There is no opcode cache concern for development, but in production check OPcache:

```bash
docker compose exec app php artisan opcache:clear 2>/dev/null || true
# or
docker compose exec app php -r "opcache_reset();"
```

OPcache is configured to revalidate every 60 seconds. `php artisan optimize` also regenerates the classmap, so new classes are found immediately.

### Queue workers running old code

`php artisan queue:restart` sets a flag in Redis. Workers finish their current job and then exit; Supervisor restarts them with new code within a few seconds. If workers are not restarting:

```bash
docker compose exec app php artisan queue:monitor redis:default
docker compose logs --follow app | grep queue
```

---

## Files Reference

| File | Purpose |
|---|---|
| `.github/workflows/deploy.yml` | GitHub Actions pipeline definition |
| `scripts/deploy.sh` | Server-side deployment — all 8 steps |
| `scripts/rollback.sh` | Server-side rollback to a previous commit |
| `scripts/healthcheck.sh` | HTTP health probe used by deploy and rollback |
| `scripts/setup.sh` | One-shot local environment bootstrap (not for production) |
| `docker-compose.yml` | Service definitions (used in all environments) |
| `docker/nginx/default.conf` | Nginx virtual host with cache strategy |
| `docker/php/entrypoint.sh` | Container startup: migrations, key gen, symlinks |
