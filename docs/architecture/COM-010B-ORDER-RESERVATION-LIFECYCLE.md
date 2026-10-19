# COM-010B — Order Reservation Lifecycle

**Status:** Complete  
**Date:** 2026-06-25  
**Scope:** Inventory reservation, release, and ship lifecycle for sales orders

---

## Overview

COM-010B wires the inventory system into the order lifecycle. When a WooCommerce order arrives, ECOS now automatically reserves, ships, or releases inventory based on the order's status — using the existing `ReserveStockAction`, `ReleaseStockAction`, and `ShipStockAction` primitives from the Inventory module.

### Architecture Constraint

This feature is **strictly stock-level**. There is no:
- FIFO layer consumption (hook exists, not implemented)
- Pick lists, shipment carriers, or fulfillment routing
- Accounting or accounts receivable entries
- Allocation engine

---

## Lifecycle State Machine

```
                    ┌─────────────────────────────┐
                    │         Order Created         │
                    └──────────────┬───────────────┘
                                   │
                     WooStatus = processing / on-hold
                                   │
                                   ▼
                        ┌─────────────────┐
                        │    RESERVED     │◄── inventory_reserved_at set
                        └────────┬────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
             WooStatus=completed      WooStatus=cancelled
                    │                 /refunded/failed
                    ▼                         ▼
          ┌──────────────┐          ┌──────────────────┐
          │   SHIPPED    │          │    RELEASED      │
          │ (permanent)  │          │  (reservation    │
          └──────────────┘          │   cancelled)     │
     inventory_shipped_at set       └──────────────────┘
                                  inventory_released_at set
```

An order can also go directly to RELEASED if it was never reserved (e.g., WooCommerce `pending` → `cancelled` transition).

---

## WooCommerce Status → Inventory Action Mapping

| WooCommerce Status | Internal Status | Inventory Action    |
|---|---|---|
| `processing`       | processing      | Reserve             |
| `on-hold`          | pending         | Reserve             |
| `completed`        | completed       | Ship (requires prior reserve) |
| `cancelled`        | cancelled       | Release             |
| `refunded`         | cancelled       | Release             |
| `failed`           | cancelled       | Release             |
| `pending`          | pending         | None                |

---

## Database

### Migration

`2026_06_25_240000_add_inventory_lifecycle_to_orders_table.php`

Three nullable timestamp columns added to `orders`:

| Column | Type | Set by |
|---|---|---|
| `inventory_reserved_at` | `timestamp nullable` | `ReserveOrderInventoryAction` |
| `inventory_shipped_at` | `timestamp nullable` | `ShipOrderInventoryAction` |
| `inventory_released_at` | `timestamp nullable` | `ReleaseOrderInventoryAction` |

All three are `null` on order creation. Setting them is idempotent — each action throws if its timestamp is already set.

---

## Domain Exceptions

| Exception | HTTP | When thrown |
|---|---|---|
| `OrderAlreadyReservedException` | 422 | Reserve called when `inventory_reserved_at` is already set |
| `OrderAlreadyReleasedException` | 422 | Release called when `inventory_released_at` is already set |
| `OrderAlreadyShippedException` | 422 | Ship called when `inventory_shipped_at` is already set |
| `OrderWarehouseNotAssignedException` | 422 | Any inventory action called with no `assigned_warehouse_id` |

All extend `UnprocessableEntityHttpException`.

---

## Order-Level Actions

### ReserveOrderInventoryAction

**Location:** `Modules/Commerce/Orders/Application/Actions/ReserveOrderInventoryAction.php`

**Preconditions:**
- `inventory_reserved_at` must be `null` (throws `OrderAlreadyReservedException` otherwise)
- `assigned_warehouse_id` must be set (throws `OrderWarehouseNotAssignedException` otherwise)

**Effect:** Iterates `order.lines`, calls `ReserveStockAction` for each line, then stamps `inventory_reserved_at`.

**Reference fields:** Passed as `reference_type='sales_order'`, `reference_id=order.id` to the ledger movement.

**Transaction:** All line reservations + timestamp update in a single DB transaction.

---

### ReleaseOrderInventoryAction

**Location:** `Modules/Commerce/Orders/Application/Actions/ReleaseOrderInventoryAction.php`

**Preconditions:**
- `inventory_released_at` must be `null` (throws `OrderAlreadyReleasedException` otherwise)
- `assigned_warehouse_id` must be set

**Special case:** If `inventory_reserved_at` is `null` (order was never reserved), no stock operations are performed. Only `inventory_released_at` is stamped. This handles the `pending → cancelled` transition cleanly.

**Transaction:** All line releases + timestamp update in a single DB transaction (when stock ops are needed).

---

### ShipOrderInventoryAction

**Location:** `Modules/Commerce/Orders/Application/Actions/ShipOrderInventoryAction.php`

**Preconditions:**
- `inventory_shipped_at` must be `null` (throws `OrderAlreadyShippedException` otherwise)
- `assigned_warehouse_id` must be set
- `inventory_reserved_at` must NOT be `null` (throws 422 if not previously reserved — **no bypass**)

**Effect:** Iterates lines, calls `ShipStockAction` for each (decrements both `on_hand_qty` and `reserved_qty`), then calls `InventoryLayerConsumptionService::consume()` (FIFO hook, currently no-op), then stamps `inventory_shipped_at`.

**Transaction:** All ship ops + FIFO hook + timestamp update in a single DB transaction.

---

## FIFO Stub

`Modules/Inventory/ReceiptLayers/Application/Services/InventoryLayerConsumptionService::consume(Order $order)`

No-op placeholder. When FIFO is implemented:
1. Load `InventoryReceiptLayer` records for the order's products and warehouse, ordered by `receipt_date ASC`
2. Decrement `remaining_qty` chronologically until the shipment quantity is consumed

The `remaining_qty` field on layers (established in COM-010C) is the consumption hook.

---

## Query

### GetOrderInventoryStatusQuery

**Location:** `Modules/Commerce/Orders/Application/Queries/GetOrderInventoryStatusQuery.php`

```php
$status = app(GetOrderInventoryStatusQuery::class)->execute($orderId);
// Returns:
// [
//   'reserved'              => bool,
//   'shipped'               => bool,
//   'released'              => bool,
//   'inventory_reserved_at' => ?string (ISO 8601),
//   'inventory_shipped_at'  => ?string (ISO 8601),
//   'inventory_released_at' => ?string (ISO 8601),
// ]
```

---

## Integration Points

### WooCommerceOrderImporter

On `importSingle()` and bulk `import()`, after order creation:
- If WooCommerce status is `processing` or `on-hold` → call `ReserveOrderInventoryAction`
- Reservation failure is **non-fatal**: the order is saved, the error is captured in the import result's error log (bulk) or silently swallowed (single import)

### ProcessOrderWebhookJob

After updating an existing order's status, the job applies the matching inventory action:

```
woo_status → inventory action
processing / on-hold → ReserveOrderInventoryAction
completed            → ShipOrderInventoryAction
cancelled / refunded / failed → ReleaseOrderInventoryAction
pending / unknown    → (no action)
```

Idempotency exceptions (`OrderAlreadyReserved/Shipped/Released`) are silently swallowed. Other inventory failures are reported via `report()` but do not fail the webhook job (the order status update has already been persisted).

---

## API

`OrderResource` now exposes:

```json
{
  "inventory_reserved_at": "2026-06-25T14:30:00+00:00",
  "inventory_shipped_at": null,
  "inventory_released_at": null
}
```

All three fields are `null` until set by the respective action.

---

## Tests

`tests/Feature/Commerce/OrderReservationLifecycleTest.php` — 11 tests, 32 assertions

| Test | Covers |
|---|---|
| `reserve_action_stamps_timestamp_and_decrements_available_qty` | Happy path reservation |
| `reserve_idempotency_throws_already_reserved_exception` | Idempotency guard |
| `reserve_throws_when_no_warehouse_assigned` | Missing warehouse guard |
| `reserve_throws_on_insufficient_stock` | Stock guard (propagated from ReserveStockAction) |
| `cancellation_releases_reservation_and_stamps_released_at` | Release happy path |
| `release_idempotency_throws_already_released_exception` | Release idempotency |
| `release_without_prior_reservation_stamps_released_at_with_no_stock_op` | Pending→cancelled edge case |
| `completion_ships_inventory_and_stamps_shipped_at` | Ship happy path |
| `ship_idempotency_throws_already_shipped_exception` | Ship idempotency |
| `ship_throws_when_inventory_not_reserved` | Ship requires prior reserve |
| `inventory_status_query_reflects_lifecycle_state` | Query through full lifecycle |

---

## Tech Debt / Future Work

| Item | Note |
|---|---|
| FIFO layer consumption | `InventoryLayerConsumptionService::consume()` is a no-op; implement when ready |
| Manual inventory operations API | No HTTP endpoint to manually trigger reserve/release/ship; currently driven by webhook only |
| Partial shipments | One ship action ships all lines; partial fulfillment not supported |
| Reservation expiry | No TTL on reservations; unpaid orders hold stock indefinitely |

---

## File Manifest

### Backend (new)
- `Modules/Commerce/Orders/Infrastructure/Database/Migrations/2026_06_25_240000_add_inventory_lifecycle_to_orders_table.php`
- `Modules/Commerce/Orders/Domain/Exceptions/OrderAlreadyReservedException.php`
- `Modules/Commerce/Orders/Domain/Exceptions/OrderAlreadyReleasedException.php`
- `Modules/Commerce/Orders/Domain/Exceptions/OrderAlreadyShippedException.php`
- `Modules/Commerce/Orders/Domain/Exceptions/OrderWarehouseNotAssignedException.php`
- `Modules/Commerce/Orders/Application/Actions/ReserveOrderInventoryAction.php`
- `Modules/Commerce/Orders/Application/Actions/ReleaseOrderInventoryAction.php`
- `Modules/Commerce/Orders/Application/Actions/ShipOrderInventoryAction.php`
- `Modules/Commerce/Orders/Application/Queries/GetOrderInventoryStatusQuery.php`
- `Modules/Inventory/ReceiptLayers/Application/Services/InventoryLayerConsumptionService.php`
- `tests/Feature/Commerce/OrderReservationLifecycleTest.php`

### Backend (modified)
- `Modules/Commerce/Orders/Domain/Models/Order.php` — inventory timestamps in fillable, casts, docblock
- `Modules/Commerce/Orders/Presentation/Http/Resources/OrderResource.php` — exposes inventory timestamps
- `Modules/Commerce/OrderImport/Application/Services/WooCommerceOrderImporter.php` — triggers reserve on processing/on-hold orders
- `Modules/Commerce/Synchronization/Application/Jobs/ProcessOrderWebhookJob.php` — triggers inventory lifecycle on status update
