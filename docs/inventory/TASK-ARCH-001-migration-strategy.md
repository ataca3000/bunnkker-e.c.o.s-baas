# TASK-ARCH-001 — Migration Strategy

**Date:** 2026-07-06

All refactoring items are **additive only** except REF-001 (deletion of dead code). No breaking migrations are required. This document specifies the safe execution order.

---

## Guiding Principles

1. **No breaking migrations.** Every schema change either adds a column with a default, adds a new table, or drops a table confirmed empty.
2. **No behavior changes to working paths.** The new reservation registry does not replace the counter — it augments it. Existing callers continue to work until they are updated.
3. **Each refactoring item is independently deployable.** There are no circular dependencies between items.
4. **Test before and after each item.** The existing test suite (2,250+ tests) must pass at every step.

---

## Phase 1 — P0 Items (Critical Fixes, Deploy Immediately)

### Step 1.1 — REF-001: Delete the Dual Ledger

**Pre-condition:** Confirm `stock_movements` table is empty.

```bash
php artisan tinker --execute="echo DB::table('stock_movements')->count();"
```

If count is 0, proceed.

**Actions:**
1. Delete the 6 files listed in ADR-INV-003.
2. Create migration: `php artisan make:migration drop_stock_movements_table`
3. Run `php artisan migrate`.
4. Run full test suite. Expected: zero failures.

**Rollback:** `php artisan migrate:rollback` (recreates empty table). No data loss — table was empty.

---

### Step 1.2 — REF-002: DirectIssued Event

**Pre-condition:** None.

**Actions:**
1. Create `InventoryStockDirectlyIssued.php` event class.
2. Inject `DomainEventBus` into `DirectIssueStockAction`.
3. Add `$this->eventBus->publish(...)` call.
4. Register listener in `DomainEventServiceProvider`.
5. Write feature test.
6. Run test suite. Expected: 1 new test passes, no regressions.

**Rollback:** Revert 4 files. No migration involved.

---

## Phase 2 — P1 Items (Before Multi-Module Expansion)

Deploy in the order below. Each step is independent.

### Step 2.1 — REF-005: Warehouse Type Taxonomy (Fastest Win)

**Pre-condition:** None.

**Actions:**
1. Create migration: `php artisan make:migration add_warehouse_type_to_warehouses`.
2. Add `warehouse_type VARCHAR(30) DEFAULT 'standard'`.
3. Add `WarehouseType` PHP enum.
4. Update `Warehouse` model with cast.
5. Run migration. All existing warehouses become `standard`.
6. Update warehouse creation/edit forms to include type selection (default: standard).
7. Run test suite.

---

### Step 2.2 — REF-004: TransferStockAction

**Pre-condition:** REF-005 (warehouse types must exist to define transfer policies).

**Actions:**
1. Create `StockTransferCompleted` domain event.
2. Create `TransferStockAction` with atomic debit/credit.
3. Register event listener.
4. Write feature tests (successful transfer, insufficient stock guard, cross-company guard).
5. Run test suite.

---

### Step 2.3 — REF-003: Per-Order Reservation Registry

**Pre-condition:** None (can be deployed before or after Transfer).

**Actions:**
1. Create `inventory_reservations` migration.
2. Create `InventoryReservation` Eloquent model.
3. Update `ReserveStockAction` to also insert registry row (if `reserver_type` provided).
4. Update `ReleaseStockAction` to accept and update registry row.
5. Update `ShipStockAction` to mark registry row consumed.
6. Create expiration command.
7. Register command in schedule.
8. Write feature tests (selective release, expiration, counter consistency).
9. Run test suite.

**Gradual caller migration:** After registry is live, update each calling module (Commerce, POS, Manufacturing, Preparation OS) to pass `reserver_type`/`reserver_id` on their next sprint. Not blocking.

---

### Step 2.4 — REF-006: FIFOLayersConsumed Event

**Pre-condition:** None.

**Actions:**
1. Create `FIFOLayersConsumed` domain event.
2. Add publish call in `ShipStockAction` (after `consume()` returns) or in `InventoryLayerConsumptionService`.
3. Register listener.
4. Write test.
5. Run test suite.

---

## Phase 3 — P2 Items (Before Phase B / Demand Planning)

### Step 3.1 — REF-007: PendingDomainEvents Collector

**Pre-condition:** All P0 and P1 items complete.

Deploy before activating Phase B channel synchronization (live WooCommerce sync). This prevents the nested-transaction event timing bug from causing stock desync on the live channel.

---

### Step 3.2 — REF-008: incoming_qty on InventoryItem

**Pre-condition:** `PurchaseOrderApproved` event must exist (confirm with Purchasing module).

```php
$table->decimal('incoming_qty', 15, 4)->default(0)->after('reserved_qty');
```

All existing rows default to 0 (correct — incoming status is not retroactively calculable).

---

### Step 3.3 — REF-009: Composite Ledger Index

```php
$table->index(['company_id', 'product_id', 'created_at'], 'sle_company_product_date_idx');
```

Can be added during a low-traffic window. Concurrent index creation not needed at current table size.

---

## Phase 4 — P3 Items (Long-Term Planning)

### REF-010: Ledger Partitioning

No action until `stock_ledger_entries` approaches 10M rows. At that point:
1. Create new partitioned version of the table.
2. Migrate existing data by batch into partitioned table.
3. Swap table names in a zero-downtime deployment.
4. Update all queries that reference the table by name.

This is a significant operation and should be planned as a dedicated engineering sprint.

---

## Summary Schedule

| Phase | Items | Pre-condition | Timeline |
|-------|-------|---------------|----------|
| Phase 1 | REF-001, REF-002 | None | Immediately (this sprint) |
| Phase 2 | REF-003, REF-004, REF-005, REF-006 | Phase 1 done | Before Manufacturing/POS/Loading OS expansion |
| Phase 3 | REF-007, REF-008, REF-009 | Phase 2 done | Before Phase B channel sync goes live |
| Phase 4 | REF-010 | 10M row threshold | Year 2+ |
