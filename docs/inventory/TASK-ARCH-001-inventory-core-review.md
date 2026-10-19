# TASK-ARCH-001 — Enterprise Inventory Core Architecture Review

**Status:** Final  
**Date:** 2026-07-06  
**Reviewer:** CTO / Engineering Lead  
**Scope:** Complete Inventory module as of commit `af89f6e`

---

## Executive Summary

The ECOS Inventory Core is **structurally sound** with a correct foundation: pessimistic locking, an append-only immutable ledger, FIFO costing layers, and an event-driven domain model. No module bypasses the posting engine via raw SQL.

However, the review identified **ten architectural gaps** — three of which are high-risk blockers for the planned expansion into Manufacturing, POS, Logistics, and Accounting. These are:

1. A legacy dual-ledger system that still exists in the codebase.
2. Missing domain events on `DirectIssueStockAction`.
3. A reservation engine with no per-order tracking, making it incompatible with multi-module ERP workflows.

None of these require breaking migrations. All can be addressed additively with clear migration paths.

---

## Part 1 — Product Model

### What Was Reviewed
`Modules/Inventory/Products/Domain/Models/Product.php`, `$fillable`, relationships, type flags.

### Findings

**Ownership:** Products are owned by `brand_id`. The `company_id` column exists in the database but is **not in `$fillable`**; it is accessed exclusively through `brand.company_id`. This is correct by design per the ADR-011 brand ownership architecture and must be preserved.

**Product Type Discriminator:** `product_type` field distinguishes Raw Material, Finished Product, Packaging Material, etc. Constants are defined as class constants, not a PHP enum — acceptable but could be hardened.

**Multi-Cost Fields:** Products carry `last_purchase_cost`, `average_cost`, `current_fifo_cost`, `material_cost`, `product_cost`, and `unit_cost`. These are updated by the Purchasing and Cost Cascade pipelines. The semantics are correct, with `material_cost` being the official cost per TASK-ARCH-PRICE-001.

**Manufacturing Flags:** `can_manufacture`, `can_disassemble`, `allow_negative_stock` are boolean flags. `allow_negative_stock` is evaluated at consumption time (raw materials in production). This is correct.

**Product Variants/Bundles:** The model is **flat** — no `parent_product_id`, no variant dimension tables, no bundle/kit support. This is an accepted limitation for the current scope. The architecture must accommodate this in the future without breaking the inventory engine.

### Assessment: ✅ Correct — Minor gaps
- No breaking issues.
- Variants, bundles, and kits will require a separate expansion ADR when the time comes.
- Product type as constants (vs. enum) is a low-priority cleanup.

---

## Part 2 — Warehouse Architecture

### What Was Reviewed
`Modules/MasterData/Warehouses/Domain/Models/Warehouse.php`, schema fields, relationships.

### Findings

**Hierarchy:** Warehouses belong directly to `company_id`. There is no Branch intermediate entity at the warehouse level. This is consistent with the Org OS architecture where warehouses are assigned to a company and managed contextually.

**Multi-Warehouse Isolation:** Stock isolation is enforced via the `UNIQUE(warehouse_id, product_id)` constraint on `inventory_items`. Every InventoryItem is warehouse-scoped. All queries require `warehouse_id`. This is correct.

**Warehouse Type: MISSING.** The `warehouses` table has no `warehouse_type` column. The `LedgerMovementType` enum already defines `TransferIn` and `TransferOut`, but there is no concept of:
- **Transit warehouse** (stock in transit between locations)
- **Vehicle warehouse** (stock loaded onto a delivery vehicle — required by Loading OS)
- **Virtual/staging warehouse** (returns processing, damage holding)

This gap blocks Loading OS implementation, which requires a vehicle warehouse as a stock location when stock is loaded onto a delivery vehicle.

**Transfer Actions: MISSING.** `TransferIn` and `TransferOut` movement types are defined in the enum but there are no corresponding `TransferStockAction` classes. Cross-warehouse transfers have no first-class posting path.

### Assessment: ⚠️ Gap — Required for Loading OS
- Warehouse type taxonomy must be added before Loading OS implementation.
- `TransferStockAction` (atomic cross-warehouse transfer) must be implemented.
- See **ADR-INV-002**.

---

## Part 3 — Stock Ledger

### What Was Reviewed
`stock_ledger_entries` table, `StockLedgerEntry` model, `LedgerMovementType` enum, `stock_movements` table, `StockMovement` model, `MovementType` enum (old), `AddManualStockAction`, `StockMovementController`.

### Findings

**The Correct Ledger (`stock_ledger_entries`):** Immutable, append-only, `UPDATED_AT = null`. Every mutation creates one entry with `on_hand_before`, `on_hand_after`, `reserved_before`, `reserved_after`, `movement_type`, and a `reference_type/reference_id` link to the originating document. Denormalized with `warehouse_id`, `product_id`, `company_id` for fast hot-path queries. This design is correct and production-ready.

**The Legacy Ledger (`stock_movements`): CRITICAL.**  
A second, older ledger system (`stock_movements` table, `StockMovement` model, `MovementType` enum with only 6 types) still exists. `AddManualStockAction` still writes to this old table. Critically, it does **not** update `inventory_items.on_hand_qty` and does not write to `stock_ledger_entries`. The `StockMovementController` that would expose this is not registered in routes — so no API call currently triggers it — but the code is live and dangerous.

**Impact:** If this code were ever accidentally exposed (e.g., a future developer adds the route), manual stock adjustments would corrupt inventory state silently.

**LedgerMovementType Enum:** 13 types correctly covering the full movement vocabulary. The old `MovementType` enum has 6 types and is attached only to the legacy system.

### Assessment: ⛔ Critical — Must retire dual ledger
- `AddManualStockAction`, `StockMovementController`, `StockMovement`, `StockMovementRepository`, and the `stock_movements` table must be retired.
- This is **not** a breaking change if done correctly — the route was never active.
- See **ADR-INV-003** and the Migration Strategy section.

---

## Part 4 — Current Balance Strategy

### What Was Reviewed
`InventoryItem.php`, `EloquentInventoryItemRepository.php`, `availableQty()` accessor, mutation flow in all Actions.

### Findings

**Strategy:** Balance Snapshot + Ledger. `inventory_items` holds `on_hand_qty` and `reserved_qty` as the authoritative live snapshot. Every Action updates these values atomically within the same DB transaction that writes the ledger entry. The ledger is a complete audit trail; the snapshot is the fast read path.

**Availability Calculation:** `available_qty = on_hand_qty - reserved_qty` is computed in-memory as an Eloquent accessor. It is not stored in the database. This is correct — it never drifts from the two source fields.

**Pessimistic Locking:** All mutations use `lockForUpdate()` inside `DB::transaction()`. This prevents lost-update race conditions. Correct.

**`incoming_qty` is MISSING.** Stock approved in Purchase Orders but not yet received does not appear in `InventoryItem`. Demand planning, reorder point engines, and manufacturing schedulers cannot see stock in transit. This is a gap rather than a bug — the current system is consistent, just incomplete.

### Assessment: ✅ Correct strategy — One gap
- The Snapshot + Ledger pattern is the right choice for ECOS at this scale.
- `incoming_qty` should be added in a future sprint to enable demand planning. It does not break anything in its absence.

---

## Part 5 — Reservation Engine

### What Was Reviewed
`ReserveStockAction.php`, `ReleaseStockAction.php`, `ShipStockAction.php`, `InventoryItem.reserved_qty`.

### Findings

**Current Design:** The reservation engine is a **counter only**. `ReserveStockAction` increments `reserved_qty`. `ReleaseStockAction` decrements it. `ShipStockAction` decrements both `on_hand_qty` and `reserved_qty` simultaneously.

**Critical Gap: No Per-Order Reservation Registry.**  
There is no table recording which order holds which reservation for which quantity. This means:
- You cannot selectively release one order's reservation without affecting others.
- You cannot expire a reservation that was held too long.
- You cannot report "what orders have stock held?"
- You cannot prevent a order from having its reservation double-counted.
- When Manufacturing, POS, Preparation OS, and Commerce all call `ReserveStockAction`, the counter becomes a black box.

**Preparation OS Workaround:** The Preparation OS implemented its own `SoftReservationService` and `PreparationInventoryReservation` table as a workaround. This proves the gap is real and actively being worked around.

**Expiration:** No TTL or expiry on reservations. A reservation held indefinitely blocks stock permanently.

### Assessment: ⚠️ High Risk — Refactoring required before multi-module expansion
- The counter-only reservation model is not compatible with a multi-module ERP where Procurement, Manufacturing, POS, Preparation OS, and Logistics all hold reservations simultaneously.
- A per-order reservation registry must be added.
- The counter (`reserved_qty`) is retained as the fast-path balance check; the registry table provides auditability and selectivity.
- See **ADR-INV-001**.

---

## Part 6 — Posting Engine

### What Was Reviewed
All 7 Action classes: `ReceiveStockAction`, `ReserveStockAction`, `ShipStockAction`, `ReleaseStockAction`, `AdjustmentInAction`, `AdjustmentOutAction`, `DirectIssueStockAction`. `EloquentInventoryItemRepository.recordEntry()`.

### Findings

**Core Pattern is Correct.** Every Action follows:
1. Validate inputs
2. `DB::transaction()`
3. `findOrCreate` + `lockForUpdate`
4. Compute before/after values
5. Update InventoryItem fields
6. `recordEntry(...)` → immutable StockLedgerEntry
7. After transaction commits → `DomainEventBus->publish(event)`

This is the correct posting engine pattern. No direct raw SQL on inventory tables. No bypass via `->increment()` or `DB::table()`. The engine is the single chokepoint for all stock mutations.

**`DirectIssueStockAction` Missing Event: HIGH.**  
`DirectIssueStockAction` decrements `on_hand_qty` but does **not** publish a `DomainEvent`. Every other action publishes its event post-commit. This means:
- Manufacturing write-offs are invisible to the event stream.
- POS samples/damage are invisible.
- Accounting cost entries cannot be triggered.
- Channel sync cannot react to inventory changes via direct issue.

**`InventoryLayerConsumptionService` Bypasses Event Bus: HIGH.**  
This service calls `$layer->save()` directly. No domain event is published when FIFO layers are consumed. The cost event stream is incomplete — you cannot reconstruct cost history from events alone.

**`PostGoodsReceiptAction` Calls `ReceiveStockAction` Correctly.** The integration between Purchasing and Inventory is clean: `PostGoodsReceiptAction` calls `ReceiveStockAction` inside its own DB transaction, then calls `CreateReceiptLayersAction` at the end to set up FIFO layers. The pattern is correct.

**Nested Transaction Event Timing (Phase B concern):** `AdjustmentInAction` is called from within `ApproveCountSessionAction` (which has its own `DB::transaction()`). The event from `AdjustmentInAction` fires after the inner transaction commits, not after the outer one. If the outer transaction rolls back, the event has already been dispatched. This is acceptable in Phase A (shadow mode logging only), but must be resolved before Phase B (live WooCommerce sync).

### Assessment: ✅ Sound architecture — Two bugs to fix
- Add `InventoryStockDirectlyIssued` event to `DirectIssueStockAction`.
- Add `FIFOLayersConsumed` event to `InventoryLayerConsumptionService`.
- Phase B: implement `PendingDomainEvents` collector to defer all events until outer transaction commits.

---

## Part 7 — Events

### What Was Reviewed
All 6 event classes, `DomainEvent` interface, `LaravelDomainEventBus`, `DomainEventServiceProvider`, `InventoryChannelSynchronizationListener`.

### Findings

**Canonical Events (Correct):**
| Event | Trigger | Payload Complete? |
|-------|---------|-------------------|
| `InventoryStockReceived` | `ReceiveStockAction` | ✅ Yes |
| `InventoryStockReserved` | `ReserveStockAction` | ✅ Yes |
| `InventoryStockReleased` | `ReleaseStockAction` | ✅ Yes |
| `InventoryStockShipped` | `ShipStockAction` | ✅ Yes |
| `InventoryStockAdjusted` | `AdjustmentInAction` / `AdjustmentOutAction` | ✅ Yes |
| `InventoryCountApproved` | `ApproveCountSessionAction` | ✅ Yes |

**Missing Events:**
| Missing Event | Cause | Risk |
|---------------|-------|------|
| `InventoryStockDirectlyIssued` | `DirectIssueStockAction` has no publish call | High |
| `FIFOLayersConsumed` | `InventoryLayerConsumptionService` has no publish call | High |
| `StockTransferCompleted` | No `TransferStockAction` exists | Medium |

**DomainEvent Interface:** Enforces `eventId()`, `eventName()`, `occurredAt()`, `eventVersion()`, `correlationId()`, `toArray()`. All events have `readonly` properties and carry no Eloquent models. This is the correct pattern.

**Bus Registration:** Clean — `LaravelDomainEventBus` wraps `Illuminate\Contracts\Events\Dispatcher`. No queue coupling yet; Phase B will add queued listeners.

### Assessment: ✅ Sound design — Two missing events must be added

---

## Part 8 — Performance

### What Was Reviewed
Database schema indexes (from agent survey), ledger growth characteristics, FIFO query patterns.

### Findings

**Existing Indexes:**
- `inventory_items`: UNIQUE(warehouse_id, product_id), INDEX(company_id), INDEX(product_id)
- `stock_ledger_entries`: INDEX(warehouse_id), INDEX(product_id), INDEX(company_id), INDEX(movement_type), INDEX(created_at), INDEX(reference_type, reference_id), INDEX(inventory_item_id)
- `inventory_receipt_layers`: INDEX(supplier_id, product_id), INDEX(supplier_id, remaining_qty)

**Missing Composite Index:**  
The most common reporting query — "all movements for a product in a company over a date range" — is not served by a composite index. A composite `(company_id, product_id, created_at)` on `stock_ledger_entries` would dramatically improve dashboards and cost accounting queries.

**FIFO Layer Query Growth:**  
`InventoryLayerConsumptionService` loads all open layers for a product+warehouse in order. As a product accrues thousands of receipt layers over years, this query grows without bounds. A **partial index** (`WHERE remaining_qty > 0`) plus pagination in the consumption loop would mitigate this at high volume.

**Ledger Archival:**  
`stock_ledger_entries` is append-only and never pruned. At an estimated 500 movements/day across 1,000 products and 10 warehouses, the table reaches ~5M rows/year. PostgreSQL handles this well, but range partitioning by month should be planned before the table exceeds 20M rows.

**InventoryItem Snapshot Fast Path:**  
Current balance reads hit a single indexed row (UNIQUE key lookup). This is O(1) regardless of ledger size. Correct.

### Assessment: ✅ Acceptable for current scale — Plan needed for growth
- Add composite index `(company_id, product_id, created_at)` on `stock_ledger_entries`.
- Plan partial FIFO index and ledger partitioning before exceeding 10M rows.

---

## Summary Table

| Section | Component | Status | Priority |
|---------|-----------|--------|----------|
| Product Model | Ownership, types, cost fields | ✅ Sound | — |
| Product Model | Variants/bundles | ⚪ Out of scope | Future |
| Warehouse Architecture | Isolation, multi-warehouse | ✅ Sound | — |
| Warehouse Architecture | Warehouse type (transit/vehicle/virtual) | ⚠️ Missing | P1 |
| Warehouse Architecture | TransferStockAction | ⚠️ Missing | P1 |
| Stock Ledger | stock_ledger_entries design | ✅ Sound | — |
| Stock Ledger | Dual ledger (stock_movements legacy) | ⛔ Critical | P0 |
| Balance Strategy | Snapshot + Ledger pattern | ✅ Sound | — |
| Balance Strategy | incoming_qty missing | ⚪ Gap | P2 |
| Reservation Engine | Counter design | ✅ Sound (for single module) | — |
| Reservation Engine | No per-order registry | ⚠️ High Risk | P1 |
| Reservation Engine | No expiration | ⚠️ High Risk | P1 |
| Posting Engine | Core pattern | ✅ Sound | — |
| Posting Engine | DirectIssue missing event | ⛔ Bug | P0 |
| Posting Engine | FIFO consumption no event | ⚠️ High | P1 |
| Posting Engine | Nested transaction event timing | ⚠️ Medium | P2 |
| Events | Canonical 6 events | ✅ Sound | — |
| Events | Missing DirectIssued + FIFO events | ⛔/⚠️ | P0/P1 |
| Events | Missing TransferCompleted | ⚠️ Medium | P1 |
| Performance | Core indexes | ✅ Acceptable | — |
| Performance | Missing composite index | ⚠️ Medium | P2 |
| Performance | Ledger partitioning plan | ⚪ Future | P3 |
