# CR-PREP-001 — Events Catalog

## New Domain Events

All events follow the ADR-011 schema: immutable, actor-stamped, dispatched via `Dispatchable`.

---

### `WarehouseAssigned`

**Namespace:** `Modules\Operations\Preparation\Domain\Events`

**Fired when:** An order's warehouse assignment is set or changed (by policy or manual override).

| Property | Type | Notes |
|----------|------|-------|
| orderId | string | UUID |
| warehouseId | string | UUID of assigned warehouse |
| previousWarehouseId | string\|null | null if first assignment |
| source | WarehouseAssignmentSource | AutoPolicy \| ManualOverride \| ChannelDefault \| Unassigned |
| policyId | string\|null | UUID of matching policy; null for manual override |
| occurredAt | string | ISO-8601 |

**Consumers:**
- `DailyPreparationSessionManager` — attaches order to today's active session
- Timeline service — records assignment event on order timeline
- Notification service — alerts if source = Unassigned

---

### `OrderAttachedToPreparationSession`

**Namespace:** `Modules\Operations\Preparation\Domain\Events`

**Fired when:** An order is attached to a preparation session (auto or manual).

| Property | Type | Notes |
|----------|------|-------|
| sessionId | string | UUID |
| orderId | string | UUID |
| warehouseId | string | UUID |
| source | string | auto \| manual_supervisor \| system_recovery |
| occurredAt | string | ISO-8601 |

**Consumers:**
- Timeline service — records on both order and session timelines

---

### `OrderDetachedFromPreparationSession`

**Namespace:** `Modules\Operations\Preparation\Domain\Events`

**Fired when:** An order is detached from a session (cancellation, manual removal).

| Property | Type | Notes |
|----------|------|-------|
| sessionId | string | UUID |
| orderId | string | UUID |
| warehouseId | string | UUID |
| reason | string | |
| detachedBy | string\|null | null = system action |
| occurredAt | string | ISO-8601 |

**Consumers:**
- Timeline service
- Demand recalculation (triggered by `DailyPreparationSessionManager.detachOrder()`)

---

### `PreparationDemandRecalculated`

**Namespace:** `Modules\Operations\Preparation\Domain\Events`

**Fired when:** `DailyPreparationSessionManager.recalculateDemand()` completes.

| Property | Type | Notes |
|----------|------|-------|
| sessionId | string | UUID |
| warehouseId | string | UUID |
| ordersCount | int | active orders count |
| productsCount | int | distinct SKUs count |
| occurredAt | string | ISO-8601 |

**Consumers:**
- WebSocket broadcast — live update for the Today's Preparation dashboard
- No DB write needed (session already updated before event dispatch)

---

### `PreparationSessionAutoCreated`

**Namespace:** `Modules\Operations\Preparation\Domain\Events`

**Fired when:** `DailyPreparationSessionManager.ensureSessionExists()` creates a new session (not when returning existing).

| Property | Type | Notes |
|----------|------|-------|
| sessionId | string | UUID |
| warehouseId | string | UUID |
| companyId | string | UUID |
| businessDate | string | Y-m-d |
| policyId | string\|null | UUID of applied policy; null if no policy configured |
| occurredAt | string | ISO-8601 |

**Consumers:**
- Timeline service
- Notification service — "Today's preparation session has been created for Cairo Warehouse" push notification to supervisors

---

## Existing Events — New Consumers

### `InventoryStockReceived` (from Inventory module)

**New consumer in Preparation:** `StockAddedListener` (already registered) — unchanged.

---

## Event → Listener Registration

Registered in `PreparationServiceProvider::boot()`:

```php
// CR-PREP-001 events are outbound — no listeners in this module needed yet.
// External modules subscribe by listening to the events above.
// WebSocket broadcast handled by Echo/Pusher via standard BroadcastEvent wrapper.
```

The events are pure data objects; the firing module does not need to know about consumers. Consumers register their own listeners.

---

## Queue Strategy

| Event | Queue | Reason |
|-------|-------|--------|
| WarehouseAssigned | sync | Must complete before response returns to caller |
| OrderAttachedToPreparationSession | async (default) | Non-blocking; timeline + notifications |
| OrderDetachedFromPreparationSession | async (default) | Non-blocking |
| PreparationDemandRecalculated | async (broadcast) | WebSocket push |
| PreparationSessionAutoCreated | async (default) | Notifications; not time-critical |
