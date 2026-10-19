# ECOS Deployment Guardian

Simulates the production deployment sequence and validates every service,
configuration, and health check before pushing to GitHub Actions.

## Usage

```bash
# Full validation (requires Docker running with containers up)
bash engineering/deployment-guardian/deployment-guardian.sh

# Fast mode — static checks only, no Docker required (~10s)
bash engineering/deployment-guardian/deployment-guardian.sh fast
```

## Validators

| ID | Name | Checks |
|----|------|--------|
| 01-compose | Docker Compose | YAML validity, required services, healthchecks, volumes |
| 02-env | Environment Config | Required vars, APP_KEY, APP_URL, DB/Redis config |
| 03-images | Docker Images | Image existence, Dockerfile targets, nginx config |
| 04-services | Services Health | Container state, healthcheck status, queue worker, scheduler |
| 05-health-endpoint | Health Endpoint | HTTP 200 from /api/health, database/redis/queue status |
| 06-ssl | SSL / TLS | Certificate existence, expiry, domain match |
| 07-storage | Storage Permissions | Volume mount, directory structure, write permissions |
| 08-laravel-caches | Laravel Caches | Config/route/event/package caches baked into image |

## Modes

| Mode | Validators | Use When |
|------|------------|----------|
| `fast` | 01-compose, 02-env, 08-laravel-caches | Quick pre-push static check |
| `full` | All 8 | Before any production deploy (requires Docker + containers running) |

## Prerequisites

**fast mode:**
- No extra requirements

**full mode:**
- Docker Desktop running
- Containers started: `docker compose up -d`
- Wait for healthy state: `docker compose ps`

## Health Endpoint

The application exposes `GET /api/health` which returns:

```json
{
  "status": "ok",
  "database": true,
  "redis": true,
  "queue": true,
  "storage": true,
  "scheduler": true
}
```

HTTP 200 = all core dependencies healthy  
HTTP 503 = one or more dependencies are down

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All checks passed — Deployment Readiness: GO |
| 1 | One or more checks failed — NOT ready to deploy |
