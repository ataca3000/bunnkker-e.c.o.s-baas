# TASK-ARCH-001 — Required Refactoring List

**Date:** 2026-07-06  
**Order:** Priority P0 → P3

---

## P0 — Critical (Do Before Any Module Expansion)

### REF-001: Retire the Dual Ledger

**Risk Resolved:** RISK-INV-001  
**Effort:** Small (delete + migration)  
**Breaking Changes:** None (dead code, unrouted)

**Files to Delete:**
- `Modules/Inventory/StockLedger/Application/Actions/AddManualStockAction.php`
- `Modules/Inventory/StockLedger/Presentation/Http/Controllers/StockMovementController.php`
- `Modules/Inventory/StockLedger/Domain/Models/StockMovement.php`
- `Modules/Inventory/StockLedger/Domain/Enums/MovementType.php`
- `Modules/Inventory/StockLedger/Domain/Contracts/StockMovementRepositoryInterface.php`
- `Modules/Inventory/StockLedger/Infrastructure/Repositories/EloquentStockMovementRepository.php`

**Migration:**
```php
// Drop the legacy table (confirm it is empty first)
Schema::dropIfExists('stock_movements');
```

**Verification:**
- Grep entire codebase for `stock_movements`, `StockMovement`, `AddManualStockAction`, `MovementType` — all must return zero results after deletion.
- Run full test suite — zero failures expected since the route was never active.

---

### REF-002: Add `InventoryStockDirectlyIssued` Event

**Risk Resolved:** RISK-INV-002  
**Effort:** Small (30-minute change)  
**Breaking Changes:** None (additive)

**Steps:**

1. Create event class:
```
Modules/Inventory/InventoryItems/Domain/Events/InventoryStockDirectlyIssued.php
```
Fields: `inventoryItemId`, `warehouseId`, `productId`, `companyId`, `quantityIssued`, `onHandBefore`, `onHandAfter`, `referenceType`, `referenceId`.  
Follow the same pattern as `InventoryStockReceived`.

2. Inject `DomainEventBus` into `DirectIssueStockAction` constructor.

3. Add post-commit publish call at the end of `execute()`:
```php
$this->eventBus->publish(new InventoryStockDirectlyIssued(...));
```

4. Register listener in `DomainEventServiceProvider`:
```php
$events->listen(InventoryStockDirectlyIssued::class, InventoryChannelSynchronizationListener::class);
```

5. Write one feature test: DirectIssueStockAction publishes `InventoryStockDirectlyIssued`.

---

## P1 — High Priority (Before Multi-Module Expansion)

### REF-003: Per-Order Reservation Registry

**Risk Resolved:** RISK-INV-003  
**Effort:** Medium (new table + modified Actions)  
**Breaking Changes:** None (additive; counter retained)  
**ADR:** ADR-INV-001

**Migration:** Create `inventory_reservations` table:
```php
Schema::create('inventory_reservations', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->uuid('company_id');
    $table->uuid('warehouse_id');
    $table->uuid('product_id');
    $table->uuid('inventory_item_id');
    $table->string('reserver_type');    // 'sales_order', 'pos_order', 'prep_wave', etc.
    $table->uuid('reserver_id');        // FK to the reserving entity
    $table->decimal('quantity', 15, 4);
    $table->string('status')->default('active');  // active | released | consumed | expired
    $table->timestamp('expires_at')->nullable();
    $table->timestamp('released_at')->nullable();
    $table->string('released_by')->nullable();
    $table->timestamp('consumed_at')->nullable();
    $table->string('consumed_by')->nullable();
    $table->timestamps();
    $table->index(['company_id', 'product_id', 'warehouse_id', 'status']);
    $table->index(['reserver_type', 'reserver_id']);
});
```

**Action Changes:**
- `ReserveStockAction` — also insert a row into `inventory_reservations` (same transaction).
- `ReleaseStockAction` — accept optional `reserver_type`/`reserver_id`; update matching reservation to `released`; if not provided, decrement counter (backward compat).
- `ShipStockAction` — accept optional `reserver_type`/`reserver_id`; mark reservation `consumed`.

**Expiration Job:**
- Scheduled job: expire reservations past `expires_at`, call `ReleaseStockAction` for each.

---

### REF-004: Implement `TransferStockAction`

**Risk Resolved:** RISK-INV-008  
**Effort:** Medium  
**Breaking Changes:** None (new Action)

**Location:** `Modules/Inventory/InventoryItems/Application/Actions/TransferStockAction.php`

**Flow** (single `DB::transaction()`):
1. Lock source InventoryItem for update.
2. Lock destination InventoryItem for update (findOrCreate).
3. Guard: source `on_hand_qty - reserved_qty >= quantity`.
4. Decrement source `on_hand_qty`.
5. Increment destination `on_hand_qty`.
6. Write two `StockLedgerEntry` records: `TransferOut` on source, `TransferIn` on destination. Both carry the same `reference_id` (a transfer batch UUID) for correlation.
7. Post-commit: publish `StockTransferCompleted` event.

**New Event:** `StockTransferCompleted` — fields: `batchId`, `sourceWarehouseId`, `destinationWarehouseId`, `productId`, `companyId`, `quantity`.

---

### REF-005: Add Warehouse Type Taxonomy

**Risk Resolved:** RISK-INV-005  
**Effort:** Small (migration + enum)  
**Breaking Changes:** None (additive column, default `standard`)  
**ADR:** ADR-INV-002

**Migration:**
```php
Schema::table('warehouses', function (Blueprint $table) {
    $table->string('warehouse_type', 30)->default('standard')->after('is_active');
});
```

**Enum (PHP):**
```php
enum WarehouseType: string
{
    case Standard = 'standard';   // Normal storage warehouse
    case Transit  = 'transit';    // In-transit between Standard warehouses
    case Vehicle  = 'vehicle';    // Stock loaded onto a delivery vehicle
    case Virtual  = 'virtual';    // Staging area: returns, damage, quarantine
}
```

**Policy Enforcement:**
- Only Loading OS can transfer stock into a `vehicle` warehouse.
- Only Receiving/Returns can transfer stock into a `virtual` warehouse.
- All existing warehouses default to `standard`.

---

### REF-006: `FIFOLayersConsumed` Event

**Risk Resolved:** RISK-INV-004  
**Effort:** Small  
**Breaking Changes:** None (additive)

**Option A (preferred):** Publish from the calling Action (e.g. `ShipStockAction`, `ApproveCountSessionAction`) after `InventoryLayerConsumptionService::consume()` returns. Include `ConsumptionResult` fields in the event payload.

**Option B:** Publish from inside `InventoryLayerConsumptionService::consume()` by injecting `DomainEventBus`.

**New Event:** `FIFOLayersConsumed` — fields: `inventoryItemId`, `productId`, `warehouseId`, `companyId`, `totalQuantity`, `totalCost`, `weightedUnitCost`, `referenceType`, `referenceId`.

---

## P2 — Medium Priority (Before Phase B / Demand Planning)

### REF-007: `PendingDomainEvents` Collector (Nested Transaction Fix)

**Risk Resolved:** RISK-INV-006  
**Effort:** Medium

**Design:** A `PendingDomainEvents` service (request-scoped singleton) collects events during a transaction. A `DB::afterCommit()` hook (Laravel 9+) or a custom outer-transaction wrapper publishes all collected events only after the outermost commit completes.

```php
// Pseudo-code
class PendingDomainEvents
{
    private array $pending = [];

    public function collect(DomainEvent $event): void
    {
        $this->pending[] = $event;
    }

    public function publishAll(DomainEventBus $bus): void
    {
        foreach ($this->pending as $event) {
            $bus->publish($event);
        }
        $this->pending = [];
    }
}
```

In Actions: replace `$this->eventBus->publish(...)` with `$this->pendingEvents->collect(...)`. In the outermost Action's `DB::transaction()` after-commit callback: call `$this->pendingEvents->publishAll($this->eventBus)`.

---

### REF-008: Add `incoming_qty` to `InventoryItem`

**Risk Resolved:** RISK-INV-007  
**Effort:** Small migration + listener

**Migration:**
```php
$table->decimal('incoming_qty', 15, 4)->default(0)->after('reserved_qty');
```

**Lifecycle:**
- Increment when `PurchaseOrderApproved` event is received (per PO line, per warehouse).
- Decrement when `GoodsReceiptPosted` (or `InventoryStockReceived`) event is received.

**New Computed Accessor:**
```php
public function projectedAvailableQty(): float
{
    return max(0.0, $this->on_hand_qty - $this->reserved_qty + $this->incoming_qty);
}
```

---

### REF-009: Add Composite Index on Stock Ledger

**Risk Resolved:** RISK-INV-009  
**Effort:** Trivial (one migration)

```php
Schema::table('stock_ledger_entries', function (Blueprint $table) {
    $table->index(['company_id', 'product_id', 'created_at'], 'sle_company_product_date_idx');
});
```

---

## P3 — Long-Term (Planning Only)

### REF-010: Ledger Partitioning Strategy

**Risk Resolved:** RISK-INV-010  
**Timeline:** Before `stock_ledger_entries` reaches 10M rows (~Year 2)

**Plan:**
- Range partition by `DATE_TRUNC('month', created_at)`.
- Each partition covers one calendar month.
- Detach and archive partitions older than 24 months to cold storage (separate schema).
- Retain current year + previous year in hot storage.
- Implement reconciliation view spanning all partitions.

---

## Refactoring Summary

| Ref | Description | Priority | Breaking? | ADR |
|-----|-------------|----------|-----------|-----|
| REF-001 | Delete dual ledger (stock_movements + dead code) | P0 | No | ADR-INV-003 |
| REF-002 | Add DirectIssued domain event | P0 | No | — |
| REF-003 | Per-order reservation registry | P1 | No | ADR-INV-001 |
| REF-004 | TransferStockAction | P1 | No | — |
| REF-005 | Warehouse type taxonomy | P1 | No | ADR-INV-002 |
| REF-006 | FIFOLayersConsumed event | P1 | No | — |
| REF-007 | PendingDomainEvents collector | P2 | No | — |
| REF-008 | incoming_qty on InventoryItem | P2 | No | — |
| REF-009 | Composite ledger index | P2 | No | — |
| REF-010 | Ledger partitioning (plan) | P3 | No | — |
