# COM-008C – Complete Commerce Synchronization (Final Phase)

**Status:** COMPLETE  
**Sprint:** SPRINT-000  
**Completed:** 2026-06-24  
**Depends on:** COM-008A (engine), COM-008B (audit + bug fixes)

---

## 1. Executive Summary

COM-008C delivers the final production-ready synchronization architecture between ECOS-ERP and WooCommerce. It extends the existing engine (COM-008A) with full bidirectional coverage for all entity types: products, customers, and orders. All webhook routes are designed for public production deployment (no localhost-specific logic). The `WebhookManagerService` manages all 7 WooCommerce topics in a single lifecycle service, replacing the narrower `WooCommerceWebhookRegistrar`. Channel health monitoring is now tracked via four new database columns with a computed `healthStatus()` method. The retry system now supports both inbound and outbound retries for all entity types.

---

## 2. Objectives Completed

| # | Objective | Status |
|---|-----------|--------|
| 1 | New webhook routes for products and customers | ✅ DONE |
| 2 | Inbound product events (created/updated/deleted) with WC→ECOS upsert | ✅ DONE |
| 3 | Inbound customer events (created/updated) with WC→ECOS upsert | ✅ DONE |
| 4 | Order events verified — circular sync guard added | ✅ DONE |
| 5 | Outbound ERP→WC order status sync via `OrderStatusSyncJob` | ✅ DONE |
| 6 | `WebhookManagerService` managing all 7 topics | ✅ DONE |
| 7 | Channel health monitoring (4 new DB columns + computed status) | ✅ DONE |
| 8 | Sync logs complete for all flows | ✅ DONE |
| 9 | Retry/recovery extended for inbound events | ✅ DONE |
| 10 | Engineering validation — all 7 flows traced | ✅ DONE |

---

## 3. Files Created

### Migrations

| File | Change |
|------|--------|
| `Modules/Commerce/Channels/Infrastructure/Database/Migrations/2026_06_24_700000_add_product_customer_webhook_ids_to_channels.php` | Adds 5 new webhook ID columns for product and customer topics |
| `Modules/Commerce/Channels/Infrastructure/Database/Migrations/2026_06_24_710000_add_health_columns_to_channels.php` | Adds `last_webhook_received_at`, `last_successful_sync_at`, `last_error_at`, `last_error_message` |

### Enums

| File | Description |
|------|-------------|
| `Modules/Commerce/Channels/Domain/Enums/ChannelHealthStatus.php` | `healthy` / `warning` / `error` |

### Services

| File | Description |
|------|-------------|
| `Modules/Commerce/Synchronization/Application/Services/WebhookManagerService.php` | Manages all 7 WooCommerce webhook topics — `registerAll()` and `deregisterAll()` |
| `Modules/Commerce/Synchronization/Application/Services/WooCommerceProductSyncer.php` | Handles inbound product.created/updated/deleted: SKU match, field update, deactivation |
| `Modules/Commerce/Synchronization/Application/Services/WooCommerceCustomerSyncer.php` | Handles inbound customer.created/updated: email match, create/update with `withoutEvents()` |

### Jobs

| File | Description |
|------|-------------|
| `Modules/Commerce/Synchronization/Application/Jobs/ProcessProductWebhookJob.php` | Inbound — dispatches to `WooCommerceProductSyncer` based on topic |
| `Modules/Commerce/Synchronization/Application/Jobs/ProcessCustomerWebhookJob.php` | Inbound — dispatches to `WooCommerceCustomerSyncer` |
| `Modules/Commerce/Synchronization/Application/Jobs/OrderStatusSyncJob.php` | Outbound — pushes ECOS order status change to WooCommerce |

### Observers

| File | Description |
|------|-------------|
| `Modules/Commerce/Synchronization/Application/Observers/OrderObserver.php` | Fires on `Order::updated`, dispatches `OrderStatusSyncJob` when status changes on externally-linked orders |

---

## 4. Files Modified

| File | Change |
|------|--------|
| `Modules/Commerce/Channels/Domain/Models/Channel.php` | Added 5 webhook ID properties, 4 health columns to fillable/casts, `ChannelHealthStatus` import, computed `healthStatus()` method |
| `Modules/Commerce/Synchronization/Application/Services/SyncLogService.php` | Added optional `?Channel $channel` parameter to `markSuccess()` and `markFailed()` — stamps `last_successful_sync_at` or `last_error_at`/`last_error_message` |
| `Modules/Commerce/Synchronization/Application/Actions/RetrySyncLogAction.php` | Fully rewritten — now handles both inbound (Product/Customer/Order) and outbound (Product/Price/Inventory/Customer/Order) retries |
| `Modules/Commerce/Synchronization/Presentation/Http/Controllers/WooCommerceWebhookController.php` | Added `handleProduct()` and `handleCustomer()` methods; all handlers stamp `last_webhook_received_at`; `logRejection()` now accepts `SyncEntityType` param |
| `Modules/Commerce/Synchronization/Infrastructure/Providers/SynchronizationServiceProvider.php` | Registered `Order::observe(OrderObserver::class)` |
| `Modules/Commerce/Connectors/Application/Actions/TestConnectionAction.php` | Replaced `WooCommerceWebhookRegistrar` with `WebhookManagerService::registerAll()` |
| `backend/routes/api.php` | Added `POST webhooks/woocommerce/{channel}/products` and `POST webhooks/woocommerce/{channel}/customers` |
| `Modules/Commerce/Synchronization/Application/Jobs/ProductSyncJob.php` | Updated `markSuccess`/`markFailed` calls to pass `$this->channel` for health tracking; removed manual `last_sync_at` update |
| `Modules/Commerce/Synchronization/Application/Jobs/PriceSyncJob.php` | Same as above |
| `Modules/Commerce/Synchronization/Application/Jobs/InventorySyncJob.php` | Same as above |
| `Modules/Commerce/Synchronization/Application/Jobs/CustomerSyncJob.php` | Same as above |
| `Modules/Commerce/Synchronization/Application/Jobs/ProcessOrderWebhookJob.php` | Added `Order::withoutEvents()` guard on status update (prevents circular OrderObserver dispatch); updated `markSuccess`/`markFailed` with channel; removed manual `last_sync_at` update |

---

## 5. Database Changes

### Columns Added to `channels`

```
external_webhook_product_created_id  (string, nullable)   — WooCommerce webhook ID for product.created
external_webhook_product_updated_id  (string, nullable)   — WooCommerce webhook ID for product.updated
external_webhook_product_deleted_id  (string, nullable)   — WooCommerce webhook ID for product.deleted
external_webhook_customer_created_id (string, nullable)   — WooCommerce webhook ID for customer.created
external_webhook_customer_updated_id (string, nullable)   — WooCommerce webhook ID for customer.updated
last_webhook_received_at  (timestamp, nullable)           — last inbound webhook received on any topic
last_successful_sync_at   (timestamp, nullable)           — last markSuccess() call with channel
last_error_at             (timestamp, nullable)           — last markFailed() call with channel
last_error_message        (text, nullable)                — last error message, truncated to 1000 chars
```

### Health Status Logic (computed, no stored column)

`Channel::healthStatus()` returns `ChannelHealthStatus::Error | Warning | Healthy` based on:

1. **Error** — `last_error_at` is more recent than `last_successful_sync_at` (or `last_sync_at` as fallback)
2. **Warning** — last successful sync was >24 hours ago, or `connection_status !== connected`
3. **Healthy** — all other cases

---

## 6. Queue Changes

### New Jobs

| Job | tries | backoff | Direction |
|-----|-------|---------|-----------|
| `ProcessProductWebhookJob` | 3 | 30s | Inbound |
| `ProcessCustomerWebhookJob` | 3 | 30s | Inbound |
| `OrderStatusSyncJob` | 3 | 60s | Outbound |

### Complete Job Inventory (all 8 sync jobs)

| Job | tries | backoff | Direction | Entity |
|-----|-------|---------|-----------|--------|
| `ProductSyncJob` | 3 | 60s | Outbound | Product |
| `PriceSyncJob` | 3 | 60s | Outbound | Price |
| `InventorySyncJob` | 3 | 60s | Outbound | Inventory |
| `CustomerSyncJob` | 3 | 60s | Outbound | Customer |
| `OrderStatusSyncJob` | 3 | 60s | Outbound | Order |
| `ProcessOrderWebhookJob` | 3 | 30s | Inbound | Order |
| `ProcessProductWebhookJob` | 3 | 30s | Inbound | Product |
| `ProcessCustomerWebhookJob` | 3 | 30s | Inbound | Customer |

---

## 7. Webhook Changes

### New Inbound Routes (production-ready delivery URLs)

| Topic | Route | Handler |
|-------|-------|---------|
| `product.created` | `POST /api/webhooks/woocommerce/{channel}/products` | `handleProduct()` |
| `product.updated` | `POST /api/webhooks/woocommerce/{channel}/products` | `handleProduct()` |
| `product.deleted` | `POST /api/webhooks/woocommerce/{channel}/products` | `handleProduct()` |
| `customer.created` | `POST /api/webhooks/woocommerce/{channel}/customers` | `handleCustomer()` |
| `customer.updated` | `POST /api/webhooks/woocommerce/{channel}/customers` | `handleCustomer()` |
| `order.created` | `POST /api/webhooks/woocommerce/{channel}/orders` | `handleOrder()` (existing) |
| `order.updated` | `POST /api/webhooks/woocommerce/{channel}/orders` | `handleOrder()` (existing) |

All routes:
- No auth middleware (WooCommerce cannot send Bearer tokens)
- HMAC-SHA256 signature verification on every request
- 5-minute cache-based duplicate detection per `{channel_id}:{external_id}:{topic}`
- Stamp `last_webhook_received_at` on valid (signature-verified) payloads
- Dispatch to queue; return HTTP 200 immediately

### WebhookManagerService Topic Map

```php
'order.created'    → external_webhook_order_created_id    → /orders
'order.updated'    → external_webhook_order_updated_id    → /orders
'product.created'  → external_webhook_product_created_id  → /products
'product.updated'  → external_webhook_product_updated_id  → /products
'product.deleted'  → external_webhook_product_deleted_id  → /products
'customer.created' → external_webhook_customer_created_id → /customers
'customer.updated' → external_webhook_customer_updated_id → /customers
```

Registration: `TestConnectionAction` calls `WebhookManagerService::registerAll()` after a successful connection test. Webhooks already registered (non-null ID column) are skipped — no double-registration.

---

## 8. Sync Log Coverage

All 7 synchronization flows write to the `sync_logs` table:

| Flow | entity_type | direction | action |
|------|-------------|-----------|--------|
| Product outbound | `product` | `outbound` | `product.sync` |
| Price outbound | `price` | `outbound` | `price.sync` |
| Inventory outbound | `inventory` | `outbound` | `inventory.sync` |
| Customer outbound | `customer` | `outbound` | `customer.sync` |
| Order status outbound | `order` | `outbound` | `order.status_sync` |
| Order inbound (webhook) | `order` | `inbound` | `order.created` / `order.updated` |
| Product inbound (webhook) | `product` | `inbound` | `product.created` / `product.updated` / `product.deleted` |
| Customer inbound (webhook) | `customer` | `inbound` | `customer.created` / `customer.updated` |

Signature rejections and duplicate detections log as `status=skipped` without dispatching jobs.

---

## 9. Retry / Recovery

`RetrySyncLogAction` now handles both directions for all entity types:

### Outbound Retry

| Entity | Job Dispatched |
|--------|----------------|
| `product` | `ProductSyncJob` |
| `price` | `PriceSyncJob` |
| `inventory` | `InventorySyncJob` (re-queries current stock from `StockBalance`) |
| `customer` | `CustomerSyncJob` |
| `order` | `OrderStatusSyncJob` (requires `external_order_id`) |

### Inbound Retry

| Entity | Job Dispatched |
|--------|----------------|
| `product` | `ProcessProductWebhookJob` (re-runs the original payload) |
| `customer` | `ProcessCustomerWebhookJob` |
| `order` | `ProcessOrderWebhookJob` |

---

## 10. Circular Sync Guards

All inbound syncs that create or modify ECOS records use `withoutEvents()` to prevent circular dispatch:

| Scenario | Guard |
|----------|-------|
| `WooCommerceCustomerSyncer` creates/updates Customer | `Customer::withoutEvents()` → prevents `CustomerSyncJob` |
| `WooCommerceProductSyncer` updates Product | `Product::withoutEvents()` → prevents `ProductSyncJob` / `PriceSyncJob` |
| `ProcessOrderWebhookJob` updates order status | `Order::withoutEvents()` → prevents `OrderStatusSyncJob` |
| `WooCommerceOrderImporter` creates Customer | `Customer::withoutEvents()` → (COM-008B fix, retained) |

---

## 11. Engineering Validation — 7 Sync Flow Traces

### Flow 1 — Product Outbound (ECOS → WooCommerce)

```
Product::update(['name' => ...])
  → ProductObserver::updated()
  → $product->wasChanged(['name','sku','description','short_description']) = true
  → ProductMapping found, channel active, sync_products=true
  → ProductSyncJob::dispatch($channel, $product)
  → Queue worker: ProductSyncJob::handle()
  → SyncLogService::createLog(channel, Product, Outbound, 'product.sync', status=Processing)
  → HTTP PUT /wp-json/wc/v3/products/{external_id} {name, sku, description}
  → On success: SyncLogService::markSuccess($log, [...], $channel)
      → sync_logs updated: status=success
      → channels updated: last_sync_at=now(), last_successful_sync_at=now()
  → On failure: SyncLogService::markFailed($log, $error, null, $channel)
      → channels updated: last_error_at=now(), last_error_message=...
      → Job retried (max 3 attempts, 60s backoff) → failed_jobs table
```

### Flow 2 — Price Outbound (ECOS → WooCommerce)

```
Product::update(['regular_price' => 99.99])
  → ProductObserver::updated()
  → $product->wasChanged(['regular_price','sale_price']) = true
  → PriceSyncJob::dispatch($channel, $product)
  → Queue worker: PriceSyncJob::handle()
  → SyncLogService::createLog(channel, Price, Outbound, 'price.sync', status=Processing)
  → HTTP PUT /wp-json/wc/v3/products/{external_id} {regular_price, sale_price}
  → On success: SyncLogService::markSuccess($log, [...], $channel)
  → On failure: SyncLogService::markFailed($log, $error, null, $channel) + retry
```

### Flow 3 — Inventory Outbound (ECOS → WooCommerce)

```
PostGoodsReceiptAction → DB::transaction()
  → StockBalance updated
  → StockMovement::create()
  → StockMovementObserver::created()
  → StockBalance::sum('quantity') across all warehouses = totalStock
  → InventorySyncJob::dispatch($channel, $product, $totalStock)
  → $afterCommit=true: job held until transaction commits
  → Queue worker: InventorySyncJob::handle()
  → SyncLogService::createLog(channel, Inventory, Outbound, 'inventory.sync')
  → WooCommerceStockSyncer::updateStock(store_url, key, secret, external_id, totalStock)
  → HTTP PUT /wp-json/wc/v3/products/{id} {stock_quantity, manage_stock=true}
  → On success: SyncLogService::markSuccess($log, [...], $channel)
  → On failure: SyncLogService::markFailed($log, $error, null, $channel) + retry
```

### Flow 4 — Customer Outbound (ECOS → WooCommerce)

```
Customer::create() or update() via CustomerController
  → CustomerObserver::created() or ::updated()
  → Active channels with sync_customers=true
  → CustomerSyncJob::dispatch($channel, $customer)
  → Queue worker: CustomerSyncJob::handle()
  → SyncLogService::createLog(channel, Customer, Outbound, 'customer.sync')
  → GET /wp-json/wc/v3/customers?email=... (lookup)
  → If found: HTTP PUT /wp-json/wc/v3/customers/{wc_id}
  → If not found: HTTP POST /wp-json/wc/v3/customers
  → On success: SyncLogService::markSuccess($log, [...], $channel)
  → On failure: SyncLogService::markFailed($log, $error, null, $channel) + retry
```

### Flow 5 — Order Status Outbound (ECOS → WooCommerce)  *(new in COM-008C)*

```
Order::update(['status' => OrderStatus::Completed]) via OrderController
  → OrderObserver::updated()
  → $order->wasChanged('status') = true
  → $order->external_order_id not null, $order->channel_id not null
  → $channel->is_active = true
  → OrderStatusSyncJob::dispatch($channel, $order)
  → Queue worker: OrderStatusSyncJob::handle()
  → SyncLogService::createLog(channel, Order, Outbound, 'order.status_sync')
  → STATUS_MAP['completed'] = 'completed'
  → HTTP PUT /wp-json/wc/v3/orders/{external_order_id} {status: 'completed'}
  → On success: SyncLogService::markSuccess($log, {woo_status, http_status}, $channel)
  → On failure: SyncLogService::markFailed($log, $error, null, $channel) + retry
```

### Flow 6 — Product Inbound (WooCommerce → ECOS)  *(new in COM-008C)*

```
WooCommerce fires product.updated event
  → POST /api/webhooks/woocommerce/{channel_id}/products
  → WooCommerceWebhookController::handleProduct()
  → Verify X-WC-Webhook-Signature (HMAC-SHA256)
  → If invalid: SyncLog[skipped, signature_rejected] + return 401
  → channel->update(['last_webhook_received_at' => now()])
  → Check duplicate (5-min cache: {channel_id}:{external_id}:product.updated)
  → If duplicate: SyncLog[skipped, duplicate_webhook] + return 200
  → ProcessProductWebhookJob::dispatch($channel, $payload, 'product.updated')
  → return 200 immediately

  Queue worker: ProcessProductWebhookJob::handle()
  → SyncLogService::createLog(channel, Product, Inbound, 'product.updated')
  → WooCommerceProductSyncer::syncUpdated($channel, $payload)
      → Match by SKU → Product found
      → Product::withoutEvents(): product->update({name, description, prices})
      → ProductMapping::updateOrCreate({channel_id, product_id}, {external_product_id})
  → SyncLogService::markSuccess($log, {action:'updated', product_id:...}, $channel)
      → last_successful_sync_at stamped

  On failure: SyncLogService::markFailed($log, $error, null, $channel) + retry

  product.created → WooCommerceProductSyncer::syncCreated():
    - If no SKU: action=skipped_no_sku
    - If no ECOS match: action=skipped_no_sku_match (cannot auto-create — needs category_id/unit_id)
    - If match: upsert mapping + update fields

  product.deleted → WooCommerceProductSyncer::syncDeleted():
    - Match by SKU or by ProductMapping external_product_id
    - Product::withoutEvents(): product->update(['is_active' => false])
```

### Flow 7 — Customer Inbound (WooCommerce → ECOS)  *(new in COM-008C)*

```
WooCommerce fires customer.created event
  → POST /api/webhooks/woocommerce/{channel_id}/customers
  → WooCommerceWebhookController::handleCustomer()
  → Verify X-WC-Webhook-Signature + stamp last_webhook_received_at + dedup check
  → ProcessCustomerWebhookJob::dispatch($channel, $payload, 'customer.created')
  → return 200 immediately

  Queue worker: ProcessCustomerWebhookJob::handle()
  → SyncLogService::createLog(channel, Customer, Inbound, 'customer.created')
  → WooCommerceCustomerSyncer::sync($payload)
      → Extract email from billing.email
      → If no email: action=skipped_no_email
      → Customer::query()->where('email', $email)->first()
      → If found: Customer::withoutEvents(): customer->update({name, phone, city, ...})
      → If not found: Customer::withoutEvents(): Customer::create({code, name, email, ...})
          → nextCustomerCode() → 'CUS-001', 'CUS-002', ...
  → SyncLogService::markSuccess($log, {action:'created|updated', customer_id}, $channel)
  → On failure: SyncLogService::markFailed($log, $error, null, $channel) + retry
```

---

## 12. Production Deployment Requirements

The system is designed for production deployment:

1. **`APP_URL`** in `.env` must be a publicly accessible HTTPS URL (e.g., `https://erp.yourdomain.com`) — WooCommerce must reach it to deliver webhooks. Localhost URLs will not work in production.

2. **Run Test Connection** for each channel after deployment — this calls `WebhookManagerService::registerAll()` and registers all 7 webhooks on the WooCommerce store.

3. **Queue worker** must be running via Supervisor (already configured in `docker/php/supervisord.conf`).

4. **Migrations** must be run: `php artisan migrate` — adds webhook ID and health columns.

5. **Product Mappings** must exist in `product_channel_mappings` for outbound product/price/inventory sync. Inbound product.updated will auto-create/update mappings when SKU matches.

---

## 13. Security

- All inbound webhook routes are public (no Sanctum middleware) — WooCommerce cannot send Bearer tokens.
- HMAC-SHA256 signature verification protects every endpoint. Invalid signatures are rejected with 401 and logged.
- All signature comparisons use `hash_equals()` (timing-safe).
- Duplicate webhook detection (5-minute Redis cache) prevents replay attacks and processing duplicate events.
- `withoutEvents()` prevents circular sync loops on all inbound operations.

---

## 14. Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Cannot create products from WooCommerce `product.created` without SKU match | ECOS requires `category_id` and `unit_id` (ERP-specific, not in WooCommerce payloads). Match by SKU instead; log as skipped if no match. |
| Single route per entity type handles all topics for that entity | WooCommerce sends `X-WC-Webhook-Topic` header; one route serves created/updated/deleted. Reduces route table size. |
| `WebhookManagerService` supersedes `WooCommerceWebhookRegistrar` | Old class only handled 2 topics. New class handles all 7 with a unified interface including `deregisterAll()`. Old class is now unused (can be deleted in a future cleanup). |
| `SyncLogService::markSuccess/markFailed` take optional `?Channel $channel` | Health columns should be updated atomically with the log outcome. Keeping it optional preserves backward compatibility. |
| `$afterCommit = true` on `InventorySyncJob` | Prevents job from running before stock movement transaction commits (COM-008B). |
| `Order::withoutEvents()` in `ProcessOrderWebhookJob` | Prevents `OrderObserver` from re-dispatching `OrderStatusSyncJob` for a status change that originated from WooCommerce. |

---

## 15. Verified Invariants

| Invariant | Verified |
|-----------|---------|
| All 3 webhook routes registered (`php artisan route:list`) | ✅ |
| Application bootstraps with no errors (`php artisan --version`) | ✅ |
| `config:cache` succeeds — all providers resolve cleanly | ✅ |
| PHP syntax valid across all new/modified files (`php -l`) | ✅ |
| `OrderObserver` registered in `SynchronizationServiceProvider::boot()` | ✅ |
| All 8 sync jobs implement `ShouldQueue` + `SerializesModels` | ✅ |
| Inbound jobs use `withoutEvents()` — no circular dispatch | ✅ |
| `markSuccess`/`markFailed` with `?Channel` populate health columns | ✅ |
| `RetrySyncLogAction` handles inbound + outbound for all 5 entity types | ✅ |
| `WebhookManagerService::registerAll()` skips already-registered topics | ✅ |
| Duplicate detection uses 5-min cache keyed on `{channel_id}:{external_id}:{topic}` | ✅ |
| HMAC-SHA256 verified before any DB write or job dispatch | ✅ |

---

## 16. Remaining Risks

| Risk | Severity | Recommendation |
|------|----------|----------------|
| `WooCommerceWebhookRegistrar` is now unused | Low | Delete in next cleanup sprint — `WebhookManagerService` is the successor |
| `ProductMapping` SoftDeletes not restored by `updateOrCreate` | Low | Edge case: soft-deleted mapping + inbound product sync will create a new row; acceptable |
| No rate limiting on outbound jobs (rapid successive product updates) | Medium | Consider `ShouldBeUniqueUntilProcessing` on `ProductSyncJob`/`PriceSyncJob` |
| Consumer secrets stored as plaintext | Medium | Apply `$casts = ['consumer_secret' => 'encrypted']` to `ChannelCredential` |
| Webhook dedup relies on Redis availability | Low | If Redis is flushed, duplicate events may process twice; acceptable in production with stable Redis |

---

*COM-008C generated 2026-06-24*
