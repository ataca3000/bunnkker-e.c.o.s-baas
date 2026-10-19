# ECOS ERP — Architecture

This document describes the development infrastructure. It intentionally
contains **no ERP business logic** — only the platform the application runs on.

## Components

### app (PHP-FPM 8.4)
Built from `docker/php/Dockerfile`, a three-stage build:

1. **vendor** — `composer:2` resolves PHP dependencies (`--no-dev`, optimized
   autoloader).
2. **frontend** — `node:22` runs `npm ci && npm run build` for the React SPA.
3. **app** — `php:8.4-fpm-bookworm` runtime with the extensions, Node, Composer
   and Supervisor installed. The resolved `vendor/` and the built SPA (`dist/`)
   are copied in from the earlier stages.

**Installed PHP extensions:** `pdo_mysql`, `mbstring`, `bcmath`, `gd`, `zip`,
`intl`, `pcntl`, `exif`, `opcache`, `redis` (PECL).

**Process supervision** (`docker/php/supervisord.conf`):

| Program            | Command                          | Purpose                |
| ------------------ | -------------------------------- | ---------------------- |
| `php-fpm`          | `php-fpm --nodaemonize`          | Serves requests        |
| `laravel-queue`    | `php artisan queue:work redis`   | Background jobs        |
| `laravel-schedule` | `php artisan schedule:work`      | Cron-style scheduler   |

The `entrypoint.sh` script makes startup idempotent: it installs dependencies
if missing, ensures an app key, waits for MySQL, links storage and runs
migrations before handing off to Supervisor.

### nginx (1.27-alpine)
Serves `backend/public` and proxies `*.php` to `app:9000` over FastCGI. Exposes
a `/healthz` endpoint used by the container healthcheck. The compiled SPA is
served under `/app`.

### mysql (8.4)
Persists to the `mysql-data` named volume. Tuned via `docker/mysql/my.cnf`
(utf8mb4, InnoDB buffer pool, `caching_sha2_password`). Credentials:
database `ecos_erp`, user `ecos` / `secret`, root `root`.

### redis (7-alpine)
Append-only persistence to the `redis-data` named volume. Backs Laravel's
cache, session, and queue drivers.

### mailpit
Catches all outbound SMTP on `:1025` and exposes a web inbox on `:8025`.

## Networking

All services attach to the `ecos-network` **bridge** network and address each
other by service name (`mysql`, `redis`, `mailpit`, `app`). Only the necessary
ports are published to the host.

## Health Checks

| Service | Check                                   |
| ------- | --------------------------------------- |
| app     | `cgi-fcgi` ping to PHP-FPM `/fpm-ping`  |
| nginx   | `wget` to `/healthz`                    |
| mysql   | `mysqladmin ping`                       |
| redis   | `redis-cli ping`                        |
| mailpit | `wget` to `/readyz`                     |

`app` waits for `mysql` and `redis` to report **healthy** before starting;
`nginx` waits for `app` to start.

## Data Persistence

| Volume       | Mounted at            | Holds            |
| ------------ | --------------------- | ---------------- |
| `mysql-data` | `/var/lib/mysql`      | Database files   |
| `redis-data` | `/data`               | Redis AOF/RDB    |

Source code is bind-mounted (`./backend`, `./backend/public`) for live editing
in development.

## Configuration Sources

- `backend/.env` — Laravel runtime configuration (loaded via `env_file`).
- `docker/php/*` — PHP, FPM, and Supervisor configuration.
- `docker/nginx/default.conf` — virtual host.
- `docker/mysql/my.cnf` — MySQL server tuning.
- `docker-compose.yml` — service topology, volumes, network, healthchecks.
