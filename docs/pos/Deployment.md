# ECOS POS — Deployment Guide

**Version:** 1.0.0  
**Audience:** DevOps engineers, system administrators

---

## Table of Contents

1. [Backend Requirements](#backend-requirements)
2. [Frontend Requirements](#frontend-requirements)
3. [Environment Variables](#environment-variables)
4. [Database Migration Order](#database-migration-order)
5. [Cache](#cache)
6. [Queues](#queues)
7. [Storage](#storage)
8. [Production Build](#production-build)
9. [Rollback](#rollback)
10. [Health Checks](#health-checks)

---

## Backend Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| PHP | 8.2 | 8.3+ |
| Laravel | 11.x | 11.x |
| PostgreSQL | 15 | 16 |
| Redis | 6 | 7 |
| PHP extensions | `pdo_pgsql`, `bcmath`, `uuid`, `json`, `mbstring` | — |

### PHP Extensions

Ensure the following PHP extensions are enabled:
- `pdo_pgsql` — PostgreSQL driver
- `bcmath` — Required for all monetary calculations (Money VO uses BCMath)
- `json` — JSONB column handling
- `mbstring` — String handling
- `uuid` — UUID generation (Cart, Sale, etc. use UUID v4 primary keys)

---

## Frontend Requirements

| Requirement | Version |
|-------------|---------|
| Node.js | 20+ |
| npm | 10+ |
| Browser | Chrome 120+, Firefox 120+, Safari 17+, Edge 120+ |

> The POS frontend is a React 19 single-page application built with Vite. It requires a modern browser with ES2022 support.

---

## Environment Variables

### Backend (`backend/.env`)

```env
# Application
APP_ENV=production
APP_KEY=base64:...
APP_URL=https://your-domain.com

# Database (PostgreSQL required — the POS uses JSONB and partial unique indexes)
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=ecos_production
DB_USERNAME=ecos
DB_PASSWORD=...

# Cache & Session
CACHE_DRIVER=redis
SESSION_DRIVER=redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# Queue
QUEUE_CONNECTION=redis

# POS Module
POS_HELD_CART_EXPIRY_HOURS=8
POS_CART_MAX_ITEMS=500

POS_ALLOW_PARTIAL_PAYMENT=true
POS_CASH_ROUNDING_METHOD=nearest
POS_CASH_ROUNDING_UNIT=0.25
POS_STORE_CREDIT_ENABLED=true

POS_MAX_ITEM_DISCOUNT_PCT=100
POS_MAX_ORDER_DISCOUNT_PCT=100
POS_MANAGER_APPROVAL_PCT=20

POS_CASH_VARIANCE_TOLERANCE_PCT=5
POS_MAX_CASH_OUT_AMOUNT=5000
POS_REQUIRE_OPENING_COUNT=true

POS_RETURN_WINDOW_DAYS=30
POS_RETURN_WITHOUT_RECEIPT=false
POS_RETURN_REQUIRE_REASON=true
POS_RETURN_RESTOCK_BY_DEFAULT=true

POS_ALLOW_NEGATIVE_STOCK=false
POS_USE_OFFLINE_INVENTORY=true
POS_OFFLINE_SYNC_INTERVAL=300

POS_OFFLINE_ENABLED=true
POS_OFFLINE_MAX_QUEUE=1000
POS_OFFLINE_ENCRYPTION=AES-256-GCM
POS_OFFLINE_CONFLICT_STRATEGY=server_wins

POS_HAL_AGENT_URL=ws://localhost:8765
POS_HAL_AGENT_TIMEOUT_MS=3000

POS_LOYALTY_ENABLED=true
POS_POINTS_PER_CURRENCY=1
POS_CURRENCY_PER_POINT=0.01

POS_DEFAULT_CURRENCY=EGP
POS_PRICING_PREFER_SALE_PRICE=true

POS_RECEIPT_FORMAT=thermal_80mm
POS_RECEIPT_AUTO_PRINT=true
POS_RECEIPT_AUTO_EMAIL=false
```

### Frontend (`frontend/.env.production`)

```env
VITE_API_BASE_URL=https://your-domain.com/api
```

---

## Database Migration Order

The POS module migrations have strict ordering requirements due to foreign key references (advisory — no hard FK constraints per ADR-POS-001, but logical ordering is required):

```bash
php artisan migrate
```

POS-specific migrations run in this order (controlled by timestamp prefix `2026_07_01_000XXX`):

1. `000001_create_pos_sessions_table` — Sessions (no dependencies)
2. `000002_create_pos_shifts_table` — Shifts (references sessions logically)
3. `000003_create_pos_cash_drawers_table` — Cash drawers
4. `000004_create_pos_carts_table` — Carts with JSONB lines; partial unique index on paying status
5. `000005_create_pos_sales_table` — Sales
6. `000006_create_pos_receipts_table` — Receipts
7. `000007_create_pos_returns_table` — Returns
8. `000008_create_pos_exchanges_table` — Exchanges
9. `000009_create_pos_payments_table` — Payments

### Critical Index

The following partial unique index is created on `pos_carts`:

```sql
CREATE UNIQUE INDEX pos_carts_one_paying_per_session
    ON pos_carts (session_id)
    WHERE status = 'paying';
```

This prevents duplicate payment processing for the same cart. It requires PostgreSQL (not MySQL or SQLite).

---

## Cache

The POS module uses the application cache for:
- Receipt numbering sequences (atomic increments via Redis locks)
- Session validation caching

**Required:** Redis cache driver. The `file` cache driver is not suitable for production as it does not support atomic operations.

```env
CACHE_DRIVER=redis
```

Clear cache on deployment:

```bash
php artisan cache:clear
php artisan config:cache
php artisan route:cache
```

---

## Queues

Domain events are published after DB transactions commit. Event listeners may dispatch to queues.

Run queue workers:

```bash
php artisan queue:work redis --queue=default,pos --tries=3 --backoff=5
```

For production, use a process manager (Supervisor, systemd):

```ini
[program:ecos-worker]
command=php /var/www/artisan queue:work redis --queue=default,pos --tries=3 --backoff=5
autostart=true
autorestart=true
numprocs=2
redirect_stderr=true
```

---

## Storage

The POS module does not use file storage directly. Receipts and transaction data are stored in PostgreSQL.

**Required disk space:** Estimate ~1 KB per transaction (receipt JSON). For 1M transactions/year, approximately 1 GB of receipt data.

---

## Production Build

### Backend

```bash
cd backend
composer install --no-dev --optimize-autoloader
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan migrate --force
```

### Frontend

```bash
cd frontend
npm ci
npm run build
```

The built assets are placed in `frontend/dist/`. Serve this directory from Nginx or any static file server.

### Nginx Configuration (example)

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    # Frontend SPA
    root /var/www/ecos/frontend/dist;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Sanctum CSRF cookie (if using web auth)
    location /sanctum/ {
        proxy_pass http://127.0.0.1:8000;
    }
}
```

---

## Rollback

### Database Rollback

```bash
php artisan migrate:rollback --step=9
```

This rolls back only the 9 POS-specific migrations. Earlier migrations are unaffected.

### Code Rollback

Tag each deployment:

```bash
git tag -a v1.0.0 -m "ECOS POS v1.0.0"
git push origin v1.0.0
```

To roll back:

```bash
git checkout v1.0.0
php artisan migrate:rollback  # if schema changed
composer install --no-dev
cd frontend && npm ci && npm run build
```

---

## Health Checks

The application exposes a health check endpoint:

```
GET /api/health
```

Response includes:
- Database connectivity
- Redis connectivity
- Queue worker status
- Build metadata

### Docker Compose Health Check

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/api/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### POS-specific Checks

After deployment, verify:

1. `GET /api/pos/sessions` returns 200 (authenticated)
2. `POST /api/pos/sessions` creates a session successfully
3. `GET /api/products` returns the product catalog
4. `GET /api/categories` returns product categories

Run the integration test suite:

```bash
cd backend
php artisan test --filter=POS
```
