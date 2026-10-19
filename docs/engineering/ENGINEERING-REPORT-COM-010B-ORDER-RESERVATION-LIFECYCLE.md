# Engineering Report — COM-010B Order Reservation Lifecycle

**Date:** 2026-06-25  
**Ticket:** COM-010B  
**Test results:** 11/11 passing (32 assertions)

---

## Deliverables Completed

### 1. Migration

`2026_06_25_240000_add_inventory_lifecycle_to_orders_table.php`

Added three nullable timestamps to `orders`:
- `inventory_reserved_at` — set when stock is reserved for the order
- `inventory_shipped_at` — set when stock is permanently deducted (order fulfilled)
- `inventory_released_at` — set when a reservation is cancelled

### 2. Domain Exceptions

Four new exceptions in `Modules/Commerce/Orders/Domain/Exceptions/`:

| Class | HTTP | Condition |
|---|---|---|
| `OrderAlreadyReservedException` | 422 | Reserve called on already-reserved order |
| `OrderAlreadyReleasedException` | 422 | Release called on already-released order |
| `OrderAlreadyShippedException` | 422 | Ship called on already-shipped order |
| `OrderWarehouseNotAssignedException` | 422 | Inventory action without assigned warehouse |

All extend `UnprocessableEntityHttpException`.

### 3. Order-Level Actions

**`ReserveOrderInventoryAction`** — reserves stock for all order lines in a DB transaction:
- Guards: not already reserved, warehouse assigned
- Calls `ReserveStockAction` per line with `reference_type='sales_order'`
- Stamps `inventory_reserved_at` on success

**`ReleaseOrderInventoryAction`** — releases reserved stock in a DB transaction:
- Guards: not already released, warehouse assigned
- If `inventory_reserved_at` is null (never reserved): stamps `inventory_released_at` and returns; no stock ops
- Otherwise: calls `ReleaseStockAction` per line, then stamps timestamp

**`ShipOrderInventoryAction`** — permanently deducts stock in a DB transaction:
- Guards: not already shipped, warehouse assigned, **must be reserved first** (throws 422 if not)
- Calls `ShipStockAction` per line (decrements both `on_hand_qty` and `reserved_qty`)
- Calls `InventoryLayerConsumptionService::consume()` (FIFO no-op hook)
- Stamps `inventory_shipped_at`

### 4. FIFO Stub

`Modules/Inventory/ReceiptLayers/Application/Services/InventoryLayerConsumptionService`

Empty `consume(Order $order): void` method. When FIFO is implemented, it will decrement `remaining_qty` on `InventoryReceiptLayer` records chronologically. No wiring changes needed in `ShipOrderInventoryAction`.

### 5. Query

`GetOrderInventoryStatusQuery` returns boolean flags and ISO 8601 timestamps for all three lifecycle milestones.

### 6. WooCommerce Integration

**`WooCommerceOrderImporter`** — after creating a new order:
- If WooCommerce status is `processing` or `on-hold`: calls `ReserveOrderInventoryAction`
- Failure is non-fatal (swallowed in `importSingle`, captured in error log for bulk `import`)
- `pending` orders are NOT reserved on import

**`ProcessOrderWebhookJob`** — after updating order status from webhook:
- `processing` / `on-hold` → reserve
- `completed` → ship
- `cancelled` / `refunded` / `failed` → release
- `pending` → no inventory action
- Idempotency exceptions silently swallowed; other errors reported but non-fatal

### 7. Model & Resource Updates

- `Order.$fillable` — added inventory timestamp fields
- `Order.casts` — all three as `'datetime'`
- `OrderResource` — exposes all three timestamps as ISO 8601 strings (null if not set)

### 8. Tests

`tests/Feature/Commerce/OrderReservationLifecycleTest.php` — 11 tests, 32 assertions, all passing.

Coverage:
- Reservation happy path (stock changes verified)
- Release happy path (stock changes verified)
- Ship happy path (on_hand_qty and reserved_qty verified)
- Idempotency × 3 (reserve, release, ship each throw correctly on second call)
- Missing warehouse guard
- Insufficient stock (propagated from `ReserveStockAction`)
- Release without prior reservation (no stock ops, only timestamp stamped)
- Ship requires prior reservation guard
- Full lifecycle query test

---

## Design Decisions

### Non-fatal inventory failures in webhook/import

Inventory reservation failure does not abort order creation or webhook processing. The order is always saved to ECOS. Inventory failure is logged (bulk import error array) or reported (webhook job via `report()`). This avoids a scenario where a stock mismatch blocks all incoming WooCommerce orders.

### Idempotency via timestamps, not status enum

Rather than adding a separate `inventory_status` enum (which would create a state machine), three independent timestamps encode the lifecycle. This allows observing overlapping states (e.g., reserved AND released but not shipped) and makes webhook retry behavior safe: the idempotency exceptions prevent double-reservation on redelivered webhooks.

### Ship requires prior reservation

`ShipOrderInventoryAction` explicitly checks `inventory_reserved_at !== null` before proceeding. This ensures `ShipStockAction`'s internal guard ("Cannot ship unreserved stock") is never relied upon at the order level — the order-level guard provides a clearer error message and avoids partial-line failures mid-transaction.

### Release without prior reservation is valid

The `ReleaseOrderInventoryAction` accepts orders that were never reserved. This handles the `pending → cancelled` path (WooCommerce `pending` does not trigger reservation, so when it transitions to `cancelled`, there is no stock to release). Only the timestamp is set; no stock operations are performed.

### assigned_warehouse_id as the single source of truth

All stock operations use `orders.assigned_warehouse_id`. The channel's `default_warehouse_id` is only used at order creation time (already handled by the importer). No inventory operation ever reads from `channel_id` directly.

---

## Tech Debt

| ID | Item | Priority |
|---|---|---|
| TD-005 | FIFO layer consumption not implemented | Future |
| TD-006 | No HTTP endpoint to manually trigger inventory actions | Low |
| TD-007 | Partial shipments not supported (all-or-nothing per order) | Future |
| TD-008 | Reservations have no TTL — unpaid orders hold stock indefinitely | Low |
