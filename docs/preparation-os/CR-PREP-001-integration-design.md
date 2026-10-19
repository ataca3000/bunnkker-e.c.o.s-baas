# CR-PREP-001 — Integration Design

## Integration Points

### 1. Order Module → Warehouse Assignment Engine

**Trigger points** (call `WarehouseAssignmentEngine::assign()`):

| Event | Location | Notes |
|-------|----------|-------|
| Order created (manual) | `CreateManualOrderAction` after commit | sync |
| Order imported (WooCommerce) | `WooCommerceProductImporter` or order sync job | sync |
| Order channel changed | `UpdateOrderChannelAction` (future) | sync |
| Order governorate changed | `UpdateOrderAddressAction` | sync |

The engine is invoked synchronously so the order record has its `assigned_warehouse_id` populated before the HTTP response returns.

### 2. WarehouseAssigned → DailyPreparationSessionManager

An application listener bridges the two services. When `WarehouseAssigned` fires, the listener:

1. Calls `DailyPreparationSessionManager::todaySession($warehouseId)`
2. If an active session exists → calls `attachOrder()`
3. If no active session → the order will be picked up at the next scheduler run OR when a supervisor manually creates a session

This listener runs **synchronously** (added to the sync driver) to ensure the session attachment is visible immediately.

**Listener location:** `Modules/Operations/Preparation/Application/Listeners/WarehouseAssignedListener.php`

### 3. Order Cancelled / Completed → Session Detach

When an order's status changes to `cancelled` or `delivered`, the order must be detached from any active preparation session:

**Listener:** `OrderStatusChangedListener` (to be implemented in Order module or Preparation module as an inbound listener)

```php
if (in_array($event->newStatus, ['cancelled', 'delivered'])) {
    $sessionOrder = PreparationSessionOrder::query()
        ->where('order_id', $event->orderId)
        ->whereNull('detached_at')
        ->first();

    if ($sessionOrder) {
        $manager->detachOrder($sessionOrder, "Order status changed to {$event->newStatus}");
    }
}
```

### 4. Loading OS → Preparation Sessions

ADR-015 specifies that the Loading OS consumes Preparation Sessions (not raw order lists). Integration:

- `PreparationSession` (status=completed) → becomes input to Loading Pool creation
- Loading OS queries `preparation_session_orders` to get the order set for vehicle loading
- This is a read-only integration from Loading OS's perspective — it does not modify sessions

### 5. Scheduler Registration

In the Laravel Console Kernel (`app/Console/Kernel.php`), add:

```php
$schedule->command('preparation:create-daily-sessions')
         ->dailyAt('06:00')
         ->withoutOverlapping()
         ->runInBackground()
         ->onFailure(function () {
             // Notify operations team via Notification service
         });
```

The `withoutOverlapping()` guard prevents double-execution if the command takes longer than expected. The command is idempotent regardless, but the guard avoids redundant DB queries.

---

## Data Flow Diagram

```
[WooCommerce / Manual Order]
          │
          ▼
    Order Created
          │
          ▼
WarehouseAssignmentEngine
          │
    ┌─────┴──────┐
  Matched    Not Matched
    │               │
    ▼               ▼
orders.assigned_warehouse_id  orders.source = 'unassigned'
orders.source = 'auto_policy'     │
    │                        [Unassigned Queue]
    ▼                         Supervisor Override
WarehouseAssigned event            │
    │                              ▼
    ▼                    WarehouseAssigned event
WarehouseAssignedListener               │
    │                                   │
    ▼                                   │
todaySession(warehouseId)  ◄────────────┘
    │
  ┌─┴────────────┐
Session exists  No session
    │               │
    ▼               ▼
attachOrder()   (attached at 06:00 next run)


[Scheduler 06:00]
    │
    ▼
CreateDailyPreparationSessionsCommand
    │
    ▼
DailyPreparationSessionManager.ensureSessionExists()
    │
    ▼ (auto_attach_orders=true)
attachEligibleOrders()
    │
    ▼
Session: orders_count=N, products_count=M
    │
[Supervisor: "Start Preparation"]
    │
    ▼
PreparationSession status='active'
    │
[Loading OS reads completed sessions]
```

---

## Backward Compatibility

| Existing feature | Impact |
|-----------------|--------|
| Manual wave creation | Waves still work internally for pick-list batching; supervisors no longer create them from the UI |
| Existing `preparation_wave_orders` | Not deleted; old waves remain queryable; new sessions use `preparation_session_orders` |
| Order `assigned_warehouse_id` column | Was already on the orders table; CR-PREP-001 only adds `warehouse_assigned_at` and `warehouse_assignment_source` |
| Existing preparation session CRUD | All existing endpoints still work; auto-created sessions are indistinguishable from manual ones except `auto_created=true` |
