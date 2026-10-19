# ADR-INV-003 — Dual Ledger Retirement (stock_movements → stock_ledger_entries)

**Status:** Accepted  
**Date:** 2026-07-06  
**Context:** TASK-ARCH-001 — Inventory Core Architecture Review  
**Risk Resolved:** RISK-INV-001

---

## Context

Two parallel ledger systems exist in the codebase:

**System A (Legacy — `stock_movements` table):**
- Model: `Modules/Inventory/StockLedger/Domain/Models/StockMovement.php`
- Action: `Modules/Inventory/StockLedger/Application/Actions/AddManualStockAction.php`
- Controller: `Modules/Inventory/StockLedger/Presentation/Http/Controllers/StockMovementController.php`
- Enum: `Modules/Inventory/StockLedger/Domain/Enums/MovementType.php` (6 types)
- Schema: `stock_movements` table (balance_before, balance_after only — no on_hand/reserved split)
- Status: **NOT registered in `routes/api.php`** — completely dead

**System B (Current — `stock_ledger_entries` table):**
- Model: `Modules/Inventory/InventoryItems/Domain/Models/StockLedgerEntry.php`
- Actions: All 7 posting Actions in `InventoryItems/Application/Actions/`
- Enum: `LedgerMovementType` (13 types, full vocabulary)
- Schema: Immutable, append-only, on_hand/reserved before/after, denormalized warehouse/product/company IDs
- Status: **Active — correct implementation**

System A does not update `inventory_items.on_hand_qty`. System A does not publish domain events. System A's `MovementType` enum has only 6 types vs System B's 13. System A is architecturally incompatible with the current inventory engine.

The risk is not that System A is currently causing harm (the route is unregistered), but that it exists as a trap: a future developer could inadvertently activate it, bypassing the entire posting engine and silently corrupting the balance snapshot.

---

## Decision

**Retire System A entirely.** Delete all classes, drop the table, remove all references.

`stock_ledger_entries` is the **sole, immutable ledger** for all inventory movements in ECOS ERP. No module may write stock transactions to any other table.

---

## Deletion Scope

### Files to Delete

```
Modules/Inventory/StockLedger/Application/Actions/AddManualStockAction.php
Modules/Inventory/StockLedger/Presentation/Http/Controllers/StockMovementController.php
Modules/Inventory/StockLedger/Domain/Models/StockMovement.php
Modules/Inventory/StockLedger/Domain/Enums/MovementType.php
Modules/Inventory/StockLedger/Domain/Contracts/StockMovementRepositoryInterface.php
Modules/Inventory/StockLedger/Infrastructure/Repositories/EloquentStockMovementRepository.php
```

Confirm the `StockLedger` module namespace has no other files after deletion. If the module folder is empty, remove it.

### Service Provider Cleanup

Check `Modules/Inventory/StockLedger/Providers/StockLedgerServiceProvider.php` (if it exists). Remove the binding for `StockMovementRepositoryInterface`. If the provider is now empty, delete it and unregister from the application's module manifest.

### Database Migration

```php
Schema::dropIfExists('stock_movements');
```

Confirm the table is empty before dropping. If it contains data from early development/testing, those records are not reconcilable with the new ledger (different schema) and should be discarded.

---

## Invariants Preserved After Retirement

1. Manual stock adjustments must go through `AdjustmentInAction` or `AdjustmentOutAction` — both write to `stock_ledger_entries` and publish events.
2. There is exactly one ledger: `stock_ledger_entries`. No module may create another.
3. The `StockLedger` module namespace, if retained as a directory, must contain only read-side query services that read from `stock_ledger_entries`.

---

## Pre-Deletion Checklist

- [ ] Grep for `AddManualStockAction` — must appear only in its own file (zero callers).
- [ ] Grep for `StockMovement` (model) — must appear only in its own file and the repository.
- [ ] Grep for `MovementType` (old enum) — must appear only in its own file.
- [ ] Confirm `StockMovementController` is not in `routes/api.php`.
- [ ] Run `SELECT COUNT(*) FROM stock_movements` — confirm empty.
- [ ] Run full test suite before and after deletion — zero regressions expected.

---

## Consequences

**Benefits:**
- Eliminates a critical latent bug that would bypass the entire inventory posting engine.
- Reduces codebase surface area by ~6 files.
- Removes conceptual confusion: one ledger, one truth.
- Future developers cannot accidentally call the wrong action.

**Risks:**
- None. The code is dead. The route was never registered. The table is empty.
