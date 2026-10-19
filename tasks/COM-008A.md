# COM-008A – WooCommerce Synchronization Engine

**Status:** COMPLETE (implementation delivered; bugs patched in COM-008B)  
**Sprint:** SPRINT-000  
**Completed:** 2026-06-23

---

## Overview

Designed and delivered a full bidirectional synchronization engine between ECOS-ERP and WooCommerce stores. The engine operates automatically via Eloquent model observers and a Redis-backed queue, with no polling loops or cron jobs. All sync operations are logged to a central `sync_logs` table.

---

## 1. Files Created

### Synchronization Module
`backend/Modules/Commerce/Synchronization/`

| File | Description |
|------|-------------|
| `Domain/Models/SyncLog.php` | Central audit model for all sync operations |
| `Domain/Enums/SyncDirection.php` | `inbound` / `outbound` |
| `Domain/Enums/SyncEntityType.php` | `product` / `inventory` / `order` / `customer` / `price` |
| `Domain/Enums/SyncStatus.php` | `pending` / `processing` / `success` / `failed` / `skipped` |
| `Domain/Contracts/SyncLogRepositoryInterface.php` | Repository contract |
| `Application/Services/SyncLogService.php` | createLog / markSuccess / markFailed / createSkippedLog |
| `Application/Services/WooCommerceWebhookRegistrar.php` | Registers order.created and order.updated webhooks on WC store |
| `Application/Jobs/ProductSyncJob.php` | Outbound — syncs product name/sku/description to WC |
| `Application/Jobs/PriceSyncJob.php` | Outbound — syncs regular_price/sale_price to WC |
| `Application/Jobs/InventorySyncJob.php` | Outbound — syncs stock quantity to WC |
| `Application/Jobs/CustomerSyncJob.php` | Outbound — creates or updates customer on WC by email lookup |
| `Application/Jobs/ProcessOrderWebhookJob.php` | Inbound — imports or updates order from WC webhook payload |
| `Application/Observers/ProductObserver.php` | Fires on Product::updated, dispatches Product/PriceSyncJob |
| `Application/Observers/StockMovementObserver.php` | Fires on StockMovement::created, dispatches InventorySyncJob |
| `Application/Observers/CustomerObserver.php` | Fires on Customer::created/updated, dispatches CustomerSyncJob |
| `Application/Actions/ListSyncLogsAction.php` | Paginated sync log listing with filters |
| `Application/Actions/RetrySyncLogAction.php` | Re-dispatches a failed sync job by entity type |
| `Infrastructure/Database/Migrations/2026_06_23_500000_create_sync_logs_table.php` | sync_logs table |
| `Infrastructure/Providers/SynchronizationServiceProvider.php` | Registers observers and DI bindings |
| `Infrastructure/Repositories/EloquentSyncLogRepository.php` | paginate / findById |
| `Presentation/Http/Controllers/SynchronizationController.php` | index / retry endpoints |
| `Presentation/Http/Controllers/WooCommerceWebhookController.php` | handleOrder endpoint |
| `Presentation/Http/Resources/SyncLogResource.php` | JSON resource for sync log |

### StockSync Module
`backend/Modules/Commerce/StockSync/`

| File | Description |
|------|-------------|
| `Domain/Models/StockSyncLog.php` | Stock-specific audit model |
| `Domain/Enums/StockSyncStatus.php` | `pending` / `success` / `error` |
| `Application/Services/WooCommerceStockSyncer.php` | HTTP PUT stock quantity utility |
| `Application/Actions/SyncStockAction.php` | Manual bulk stock sync for a channel |
| `Application/Actions/ListStockSyncLogsAction.php` | Paginated stock sync log listing |
| `Infrastructure/Database/Migrations/2026_06_23_400000_create_stock_sync_logs_table.php` | stock_sync_logs table |
| `Infrastructure/Providers/StockSyncServiceProvider.php` | Loads migrations |
| `Presentation/Http/Controllers/StockSyncController.php` | index / syncStock endpoints |
| `Presentation/Http/Resources/StockSyncLogResource.php` | JSON resource |

### Connectors Module (partial)
`backend/Modules/Commerce/Connectors/`

| File | Description |
|------|-------------|
| `Application/Actions/TestConnectionAction.php` | Tests WC API credentials and registers webhooks |
| `Application/Services/WooCommerceConnector.php` | HTTP connection test utility |
| `Infrastructure/Database/Migrations/2026_06_23_190000_add_connection_status_to_channels_table.php` | Adds connection_status column |

### Channels Module (extended)
`backend/Modules/Commerce/Channels/`

| File | Description |
|------|-------------|
| `Infrastructure/Database/Migrations/2026_06_23_600000_add_sync_customers_and_webhook_ids_to_channels.php` | Adds sync_customers, external_webhook_order_created_id, external_webhook_order_updated_id |

---

## 2. Files Modified

| File | Change |
|------|--------|
| `backend/routes/api.php` | Added sync-logs endpoints and WooCommerce webhook route |
| `backend/bootstrap/providers.php` | Registered `SynchronizationServiceProvider` and `StockSyncServiceProvider` |
| `backend/Modules/Commerce/Channels/Domain/Models/Channel.php` | Added `sync_customers`, `external_webhook_order_created_id`, `external_webhook_order_updated_id`, `connection_status` to fillable and casts |
| `backend/Modules/Commerce/Channels/Application/DTO/ChannelDTO.php` | Added `sync_customers`, `consumer_key`, `consumer_secret` fields |
| `backend/Modules/Commerce/Channels/Presentation/Http/Requests/StoreChannelRequest.php` | Added validation rules for new channel fields |

---

## 3. Database Changes

### New Tables

**`sync_logs`**
```
id (uuid PK)
channel_id (uuid FK → channels, nullable, nullOnDelete)
entity_type (string 50) — product/inventory/order/customer/price
entity_id (string 100, nullable)
direction (string 20) — inbound/outbound
action (string 100, nullable)
status (string 20) — pending/processing/success/failed/skipped
request_payload (json, nullable)
response_payload (json, nullable)
error_message (text, nullable)
synced_at (timestamp, nullable)
created_at / updated_at
INDEX: (channel_id, entity_type, status)
INDEX: synced_at
```

**`stock_sync_logs`**
```
id (uuid PK)
channel_id (uuid FK → channels, cascadeOnDelete)
product_id (uuid FK → products, cascadeOnDelete)
product_mapping_id (uuid FK → product_channel_mappings, cascadeOnDelete)
stock_quantity (decimal 15,4)
sync_status (string) — pending/success/error
response_message (text, nullable)
synced_at (timestamp, nullable)
created_at / updated_at
INDEX: (channel_id, sync_status)
INDEX: product_id
INDEX: synced_at
```

### Columns Added to `channels`

```
connection_status (string, default='disconnected') — disconnected/connected/error
sync_customers (boolean, default=true)
external_webhook_order_created_id (string, nullable)
external_webhook_order_updated_id (string, nullable)
```

---

## 4. Queue Changes

All sync jobs implement `ShouldQueue` and are dispatched to the **Redis** queue:

| Job | tries | backoff |
|-----|-------|---------|
| `ProductSyncJob` | 3 | 60s |
| `PriceSyncJob` | 3 | 60s |
| `InventorySyncJob` | 3 | 60s |
| `CustomerSyncJob` | 3 | 60s |
| `ProcessOrderWebhookJob` | 3 | 30s |

Queue worker is managed by **Supervisor** (`docker/php/supervisord.conf`):
```
command=php /var/www/html/artisan queue:work redis --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
```

Failed jobs land in `failed_jobs` table (driver: `database-uuids`).

Observer → Job dispatch flow:
```
Product::updated     → ProductObserver  → ProductSyncJob + PriceSyncJob
StockMovement::created → StockMovementObserver → InventorySyncJob
Customer::created/updated → CustomerObserver → CustomerSyncJob
```

---

## 5. Webhook Changes

### Inbound Webhook Route
```
POST /api/webhooks/woocommerce/{channel}/orders
→ WooCommerceWebhookController::handleOrder()
```
- No auth middleware (WooCommerce cannot send Bearer tokens)
- HMAC-SHA256 signature verification via `X-WC-Webhook-Signature` header
- 5-minute cache-based duplicate detection keyed on `{channel_id}:{order_id}:{topic}`
- Dispatches `ProcessOrderWebhookJob` on valid, non-duplicate payloads

### Outbound Webhook Registration
`WooCommerceWebhookRegistrar::registerOrderWebhooks(Channel $channel)` is called from `TestConnectionAction` (POST `/api/channels/{channel}/test-connection`) after a successful connection test. Registers two webhooks on the WooCommerce store:

| Topic | Delivery URL |
|-------|-------------|
| `order.created` | `{APP_URL}/api/webhooks/woocommerce/{channel_id}/orders` |
| `order.updated` | `{APP_URL}/api/webhooks/woocommerce/{channel_id}/orders` |

Webhook IDs are stored in `channels.external_webhook_order_created_id` and `channels.external_webhook_order_updated_id` to prevent double-registration.

---

## 6. API Endpoints Added

| Method | Route | Controller | Auth |
|--------|-------|------------|------|
| GET | `/api/sync-logs` | `SynchronizationController@index` | sanctum |
| POST | `/api/sync-logs/{syncLog}/retry` | `SynchronizationController@retry` | sanctum |
| GET | `/api/stock-sync-logs` | `StockSyncController@index` | sanctum |
| POST | `/api/channels/{channel}/sync-stock` | `StockSyncController@syncStock` | sanctum |
| POST | `/api/channels/{channel}/test-connection` | `ConnectorController@testConnection` | sanctum |
| POST | `/api/webhooks/woocommerce/{channel}/orders` | `WooCommerceWebhookController@handleOrder` | none |

---

## 7. Testing Results

> **Note:** Operational testing post-delivery revealed 5 bugs in the sync engine. These were diagnosed and fixed in **COM-008B** (2026-06-24). The implementation architecture was sound; the issues were logic-level bugs in observer dispatch and data aggregation.

### Bugs Found During COM-008B Audit

| Bug | Severity | Fixed |
|-----|----------|-------|
| `StockMovementObserver` used single-warehouse `balance_after` instead of total stock | Critical | ✅ |
| `InventorySyncJob` dispatched inside `DB::transaction()` without `$afterCommit=true` | High | ✅ |
| `WooCommerceOrderImporter` triggered circular `CustomerSyncJob` on import | Medium | ✅ |
| `ProductObserver` fired on ALL product changes (not just sync-relevant fields) | Medium | ✅ |
| `Channel.last_sync_at` never stamped after successful sync | Low | ✅ |

### What Was Verified Working (COM-008B)

- `SynchronizationServiceProvider` registered in `bootstrap/providers.php` ✅
- All 3 observers boot and fire correctly ✅
- All 5 jobs implement `ShouldQueue` and serialize models ✅
- `SyncLogService` writes to `sync_logs` on every sync attempt ✅
- HMAC-SHA256 webhook signature verification ✅
- Duplicate webhook detection via 5-minute cache ✅
- `WooCommerceWebhookRegistrar` registers webhooks on `TestConnectionAction` ✅
- Retry action dispatches correct job type per entity ✅
- Supervisor queue worker running with `autorestart=true` ✅

---

## 8. Operational Setup Required

Before sync operates end-to-end:

1. Create a **Channel** with `store_url`, `consumer_key`, `consumer_secret`
2. Run **Test Connection** → registers WC webhooks and sets `connection_status=connected`
3. Create **Product Mappings** (product_channel_mappings) linking ECOS product IDs to WC product IDs
4. Ensure sync flags enabled: `sync_products`, `sync_prices`, `sync_stock`, `sync_customers`
5. Ensure `APP_URL` in `.env` is the publicly accessible URL (WooCommerce must reach it for webhooks)
