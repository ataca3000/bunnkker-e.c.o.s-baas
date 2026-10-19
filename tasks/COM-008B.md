# COM-008B – Synchronization Validation Audit

**Date:** 2026-06-24  
**Status:** COMPLETE – all bugs fixed  
**Auditor:** Claude (automated audit)

---

## 1. Executive Summary

COM-008A was reported complete, but operational testing revealed that automatic synchronization was not triggering reliably. This audit traced all five sync workflows end-to-end, identified five confirmed bugs (one critical, one high, three medium/low), applied fixes to all affected files, and validated the execution path for each workflow.

**Root cause summary:** The most operationally impactful bug was `StockMovementObserver` passing single-warehouse stock `balance_after` instead of the aggregate across all warehouses. A secondary structural bug dispatched `InventorySyncJob` inside an uncommitted database transaction without `$afterCommit = true`. Additional bugs caused circular customer sync on order import and unnecessary product sync on non-sync-relevant field changes.

---

## 2. Audit Scope

Five workflows audited:

| # | Workflow | Direction |
|---|---------|-----------|
| 1 | ECOS → WooCommerce Product Sync | Outbound |
| 2 | ECOS → WooCommerce Price Sync | Outbound |
| 3 | ECOS → WooCommerce Inventory Sync | Outbound |
| 4 | ECOS → WooCommerce Customer Sync | Outbound |
| 5 | WooCommerce → ECOS Order Import via Webhook | Inbound |

---

## 3. Infrastructure Validation

| Component | Status | Notes |
|-----------|--------|-------|
| `SynchronizationServiceProvider` registered | ✅ PASS | Present in `bootstrap/providers.php` line 28 |
| Queue driver | ✅ PASS | `QUEUE_CONNECTION=redis`, Redis running on port 6379 |
| Queue worker | ✅ PASS | Supervisor `[program:laravel-queue]` with `autorestart=true` |
| Scheduler | ✅ PASS | Supervisor `[program:laravel-schedule]` running |
| `sync_logs` migration | ✅ PASS | `2026_06_23_500000_create_sync_logs_table.php` |
| `sync_customers` migration | ✅ PASS | `2026_06_23_600000_add_sync_customers_and_webhook_ids_to_channels.php` |
| `connection_status` migration | ✅ PASS | `2026_06_23_190000_add_connection_status_to_channels_table.php` (Connectors module) |
| Webhook route registered | ✅ PASS | `POST /api/webhooks/woocommerce/{channel}/orders` |
| Webhook registration trigger | ✅ PASS | `WooCommerceWebhookRegistrar` called from `TestConnectionAction` |
| CSRF exemption (webhook) | ✅ PASS | Route in `api.php`, no CSRF middleware on API group |

---

## 4. Workflow Execution Traces

### Workflow 1 – Product Sync (ECOS → WooCommerce)

```
Product::update() called
  → ProductObserver::updated() fires
  → [BUG-004 FIX] Check $product->wasChanged(['name','sku','description','short_description'])
  → Query ProductMapping for this product
  → For each active channel with sync_products=true
  → ProductSyncJob::dispatch($channel, $product)
  → Redis queue
  → Queue worker: ProductSyncJob::handle()
  → SyncLogService::createLog() [status=processing]
  → Query ProductMapping for external_product_id
  → HTTP PUT /wp-json/wc/v3/products/{external_id}
  → On success: SyncLogService::markSuccess() + channel->last_sync_at updated
  → On failure: SyncLogService::markFailed() + job retried (max 3 attempts)
```

**Pre-fix issues:** Observer fired on ANY product field change (including `stock_status`), causing redundant API calls.  
**Post-fix:** Observer checks `wasChanged()` before dispatching.

---

### Workflow 2 – Price Sync (ECOS → WooCommerce)

```
Product::update() called (regular_price or sale_price changed)
  → ProductObserver::updated() fires
  → [BUG-004 FIX] Check $product->wasChanged(['regular_price','sale_price'])
  → Query ProductMapping for this product
  → For each active channel with sync_prices=true
  → PriceSyncJob::dispatch($channel, $product)
  → Redis queue
  → Queue worker: PriceSyncJob::handle()
  → SyncLogService::createLog() [status=processing]
  → Build price payload {regular_price, sale_price}
  → HTTP PUT /wp-json/wc/v3/products/{external_id}
  → On success: SyncLogService::markSuccess() + channel->last_sync_at updated
  → On failure: SyncLogService::markFailed() + job retried
```

**Pre-fix issues:** Price sync dispatched even when price fields did not change.  
**Post-fix:** Dispatched only when `regular_price` or `sale_price` changed.

---

### Workflow 3 – Inventory Sync (ECOS → WooCommerce)

```
GoodsReceipt posted → PostGoodsReceiptAction::execute()
  → DB::transaction() begins
  → StockBalance updated for warehouse
  → StockMovementRepository::record() → StockMovement::create()
  → StockMovementObserver::created() fires (inside transaction)
  → [BUG-001 FIX] Query StockBalance::sum('quantity') for TOTAL across all warehouses
  → Query ProductMapping for this product
  → For each active channel with sync_stock=true
  → InventorySyncJob::dispatch($channel, $product, $totalStock)
  → [BUG-002 FIX] $afterCommit=true: job only runs after transaction commits
  → Redis queue (held until commit)
  → Queue worker: InventorySyncJob::handle()
  → SyncLogService::createLog() [status=processing]
  → WooCommerceStockSyncer::updateStock()
  → HTTP PUT /wp-json/wc/v3/products/{external_id} {stock_quantity, manage_stock=true}
  → On success: SyncLogService::markSuccess() + channel->last_sync_at updated
  → On failure: SyncLogService::markFailed() + job retried
```

**Pre-fix issues (CRITICAL):**
1. `$movement->balance_after` is a single-warehouse balance. Multi-warehouse setups caused incorrect stock counts in WooCommerce.
2. `InventorySyncJob` dispatched inside `DB::transaction()` without `$afterCommit=true` — job could run before transaction committed or after a rollback.

**Post-fix:** Total stock calculated via `StockBalance::sum('quantity')` across all warehouses. Job marked `$afterCommit = true`.

---

### Workflow 4 – Customer Sync (ECOS → WooCommerce)

```
Customer created/updated via CustomerController
  → CustomerObserver::created() or ::updated() fires
  → Query all active channels with sync_customers=true
  → For each channel: CustomerSyncJob::dispatch($channel, $customer)
  → Redis queue
  → Queue worker: CustomerSyncJob::handle()
  → SyncLogService::createLog() [status=processing]
  → Query WooCommerce for customer by email (GET /wp-json/wc/v3/customers?email=...)
  → If found: HTTP PUT /wp-json/wc/v3/customers/{wc_id} (update)
  → If not found: HTTP POST /wp-json/wc/v3/customers (create)
  → On success: SyncLogService::markSuccess() + channel->last_sync_at updated
  → On failure: SyncLogService::markFailed() + job retried
```

**No issues in the outbound path itself.**  
**Related fix (BUG-003):** When customers are created during inbound order import, `withoutEvents()` now prevents `CustomerSyncJob` from being dispatched back to WooCommerce.

---

### Workflow 5 – Order Webhook (WooCommerce → ECOS)

```
WooCommerce posts order.created or order.updated event
  → POST /api/webhooks/woocommerce/{channel}/orders
  → WooCommerceWebhookController::handleOrder()
  → Verify X-WC-Webhook-Signature via HMAC-SHA256 with consumer_secret
  → If invalid: SyncLog [skipped/signature_rejected] + return 401
  → Check duplicate (5-min cache key: {channel_id}:{order_id}:{topic})
  → If duplicate: SyncLogService::createSkippedLog() + return 200
  → ProcessOrderWebhookJob::dispatch($channel, $payload, $topic)
  → Redis queue (backoff=30s, tries=3)
  → Queue worker: ProcessOrderWebhookJob::handle()
  → SyncLogService::createLog() [status=processing]
  → Check if order exists by external_order_id + channel_id
  → If exists: update order status + [BUG-005 FIX] channel->last_sync_at updated
  → If new: WooCommerceOrderImporter::importSingle()
    → resolveCustomer() [finds or creates customer, [BUG-003 FIX] withoutEvents]
    → buildOrder() [map WC fields to ECOS order schema]
    → OrderRepository::create() with line items
    → If order has fees: Order::fees()->createMany()
    → If order has coupons: Order::coupons()->createMany()
    → [BUG-005 FIX] channel->last_sync_at updated
  → SyncLogService::markSuccess() or markFailed()
```

**Pre-fix issues:** Customers created during import triggered outbound `CustomerSyncJob` back to WooCommerce (circular). `last_sync_at` never updated.  
**Post-fix:** `Customer::withoutEvents()` wraps creation in importer. `last_sync_at` stamped on every successful inbound sync.

---

## 5. Bugs Found and Fixed

### BUG-001 – CRITICAL: Single-warehouse stock balance sent instead of aggregate

**Severity:** Critical  
**File:** `Modules/Commerce/Synchronization/Application/Observers/StockMovementObserver.php`  
**Root cause:** `$movement->balance_after` represents the balance in ONE warehouse. Multi-warehouse setups produce incorrect WooCommerce stock counts.  
**Fix:** Calculate `StockBalance::query()->where('product_id', ...)->sum('quantity')` to get the aggregate before dispatching `InventorySyncJob`.

---

### BUG-002 – HIGH: InventorySyncJob dispatched inside uncommitted DB transaction

**Severity:** High  
**File:** `Modules/Commerce/Synchronization/Application/Jobs/InventorySyncJob.php`  
**Root cause:** `PostGoodsReceiptAction` wraps stock movements in `DB::transaction()`. The observer fires and dispatches the job inside the transaction. The queue worker could process the job before the transaction commits or after a rollback.  
**Fix:** Added `public bool $afterCommit = true;` to `InventorySyncJob`. The job is held in the queue until the transaction commits.

---

### BUG-003 – MEDIUM: Circular customer sync on order import

**Severity:** Medium  
**File:** `Modules/Commerce/OrderImport/Application/Services/WooCommerceOrderImporter.php`  
**Root cause:** `resolveCustomer()` creates new `Customer` models via `Customer::query()->create()`. This fires `CustomerObserver::created()`, which dispatches `CustomerSyncJob` back to WooCommerce for every customer created during order import — a customer that just came FROM WooCommerce.  
**Fix:** Wrapped `Customer::query()->create()` in `Customer::withoutEvents()` in the order importer.

---

### BUG-004 – MEDIUM: ProductObserver fires on all product field changes

**Severity:** Medium  
**File:** `Modules/Commerce/Synchronization/Application/Observers/ProductObserver.php`  
**Root cause:** Observer dispatched `ProductSyncJob` + `PriceSyncJob` on ANY product `updated` event — including internal changes like `stock_status`, `is_active`, etc. This caused excessive unnecessary WooCommerce API calls.  
**Fix:** Added `$product->wasChanged()` guard — `ProductSyncJob` only dispatches when `name/sku/description/short_description` change; `PriceSyncJob` only dispatches when `regular_price/sale_price` change.

---

### BUG-005 – LOW: Channel `last_sync_at` never updated

**Severity:** Low  
**Files:** All 5 sync jobs (`ProductSyncJob`, `PriceSyncJob`, `InventorySyncJob`, `CustomerSyncJob`, `ProcessOrderWebhookJob`)  
**Root cause:** The `Channel.last_sync_at` column exists and is fillable but was never written to by any sync job. The channel appeared to have never synced.  
**Fix:** Added `$this->channel->update(['last_sync_at' => now()])` in the success path of all outbound sync jobs and the inbound order webhook job.

---

## 6. Files Modified

| File | Change |
|------|--------|
| `Modules/Commerce/Synchronization/Application/Observers/StockMovementObserver.php` | BUG-001: Use aggregate stock balance instead of single-warehouse `balance_after` |
| `Modules/Commerce/Synchronization/Application/Jobs/InventorySyncJob.php` | BUG-002: Add `$afterCommit = true`; BUG-005: stamp `last_sync_at` on success |
| `Modules/Commerce/OrderImport/Application/Services/WooCommerceOrderImporter.php` | BUG-003: Wrap customer creation in `withoutEvents()` |
| `Modules/Commerce/Synchronization/Application/Observers/ProductObserver.php` | BUG-004: Guard with `wasChanged()` for sync-relevant fields only |
| `Modules/Commerce/Synchronization/Application/Jobs/ProductSyncJob.php` | BUG-005: stamp `last_sync_at` on success |
| `Modules/Commerce/Synchronization/Application/Jobs/PriceSyncJob.php` | BUG-005: stamp `last_sync_at` on success |
| `Modules/Commerce/Synchronization/Application/Jobs/CustomerSyncJob.php` | BUG-005: stamp `last_sync_at` on success |
| `Modules/Commerce/Synchronization/Application/Jobs/ProcessOrderWebhookJob.php` | BUG-005: stamp `last_sync_at` on success |

---

## 7. Verified Working Components (No Fixes Needed)

| Component | Verified |
|-----------|---------|
| `SynchronizationServiceProvider` registered in `bootstrap/providers.php` | ✅ |
| `Product::observe(ProductObserver)` registered in boot() | ✅ |
| `StockMovement::observe(StockMovementObserver)` registered in boot() | ✅ |
| `Customer::observe(CustomerObserver)` registered in boot() | ✅ |
| `StockMovement` model has `product()` BelongsTo relationship | ✅ |
| `Product` model has `regular_price` and `sale_price` fields | ✅ |
| `Customer` model has all fields used by `CustomerSyncJob` | ✅ |
| `SyncLogService` createLog / markSuccess / markFailed complete | ✅ |
| `WooCommerceWebhookRegistrar` called on `TestConnectionAction` | ✅ |
| HMAC-SHA256 webhook signature verification | ✅ |
| Duplicate webhook detection via 5-minute cache | ✅ |
| `SyncLogRepositoryInterface` and `EloquentSyncLogRepository` wired | ✅ |
| `RetrySyncLogAction` dispatches correct job type per entity | ✅ |
| Webhook route exempt from CSRF (defined in api.php) | ✅ |
| Supervisor queue worker with `autorestart=true` | ✅ |
| `connection_status` migration exists in Connectors module | ✅ |
| `sync_customers` and webhook ID columns migration exists | ✅ |

---

## 8. Remaining Risks (Not Fixed — No New Features)

| Risk | Severity | Recommendation |
|------|----------|----------------|
| No rate limiting on outbound sync jobs | Medium | Consider `ShouldBeUniqueUntilProcessing` on `ProductSyncJob` / `PriceSyncJob` to deduplicate rapid successive updates |
| Consumer keys stored in plain text in DB | Medium | Encrypt at rest using Laravel's `$casts = ['consumer_secret' => 'encrypted']` |
| Duplicate webhook detection fragile if Redis is flushed | Low | Acceptable for development; add DB-backed dedup for production |
| Error messages truncated to 500 chars | Low | Increase truncation limit or log full error separately |

---

## 9. Operational Prerequisites

For synchronization to work end-to-end, the following must be in place:

1. **Channel configured** with `is_active=true`, `store_url` set, and `consumer_key`/`consumer_secret` in `channel_credentials`
2. **Product mappings** created in `product_channel_mappings` linking ECOS product IDs to WooCommerce product IDs
3. **Test Connection** run for each channel (registers order webhooks via `WooCommerceWebhookRegistrar`)
4. **Sync flags** set per channel: `sync_products`, `sync_prices`, `sync_stock`, `sync_customers`
5. **Webhook URL accessible** from WooCommerce: `POST {APP_URL}/api/webhooks/woocommerce/{channel_id}/orders`
6. **Queue worker running** (confirmed via Supervisor — `php artisan queue:work redis`)

---

## 10. Conclusion

All five synchronization workflows are architecturally sound. Five bugs were identified and fixed. The most critical fix prevents multi-warehouse inventory counts from being pushed as single-warehouse balances to WooCommerce. The `$afterCommit = true` fix ensures database consistency under concurrent load. The circular customer sync fix eliminates unnecessary outbound API calls during order import.

**All fixes are backward-compatible.** No schema changes, no new features, no API surface changes.

---

*COM-008B generated 2026-06-24*
