# TASK-ARCH-001 — Inventory Core Risk Assessment

**Date:** 2026-07-06

---

## Risk Register

### CRITICAL Risks

---

#### RISK-INV-001 — Dual Ledger Corruption (Legacy `stock_movements` table)

**Risk Level:** CRITICAL  
**Probability:** Low (currently no route triggers it)  
**Impact:** CATASTROPHIC (silent inventory corruption, unreported stock changes)

**Description:**  
`AddManualStockAction` and `StockMovementController` write to the legacy `stock_movements` table. This action does NOT update `inventory_items.on_hand_qty` and does NOT write to `stock_ledger_entries`. If a developer unknowingly adds this route back or calls the action directly, manual stock adjustments would silently diverge the balance snapshot from the ledger — undetectable without a full audit reconciliation.

**Trigger scenario:**  
A developer adds manual stock adjustment functionality for operations staff. They find `StockMovementController` and assume it is the correct implementation. They register the route. Every manual adjustment now writes to the wrong table, corrupts `on_hand_qty`, and emits no event.

**Current Mitigation:** No API route registered. Code is dead but present.  
**Required Mitigation:** Delete `AddManualStockAction`, `StockMovementController`, `StockMovement`, `StockMovementRepository`, `MovementType` enum, and all references. Drop `stock_movements` table in migration.

---

#### RISK-INV-002 — Silent DirectIssue (Missing Event)

**Risk Level:** HIGH  
**Probability:** Certain (already deployed)  
**Impact:** HIGH (Manufacturing, POS, and Accounting cannot observe direct issues)

**Description:**  
`DirectIssueStockAction` decrements `on_hand_qty` and writes a ledger entry but publishes no domain event. Every downstream system that depends on the event stream — channel sync, cost accounting, analytics, demand planning — is blind to direct issue transactions.

**Trigger scenario:**  
A warehouse manager writes off 50 units of damaged packaging material via DirectIssue. The WooCommerce channel is not updated. The accounting module does not log a cost expense. The demand analysis engine does not reduce expected supply. The AI platform's inventory model diverges from reality.

**Current Mitigation:** None. The event simply does not exist.  
**Required Mitigation:** Add `InventoryStockDirectlyIssued` event class, publish it in `DirectIssueStockAction` post-commit, register listener in `DomainEventServiceProvider`.

---

### HIGH Risks

---

#### RISK-INV-003 — Reservation Counter Collision (Multi-Module Expansion)

**Risk Level:** HIGH  
**Probability:** Certain if expansion proceeds without fix  
**Impact:** HIGH (incorrect available stock, over-selling, reservation leaks)

**Description:**  
`reserved_qty` on `InventoryItem` is a single integer counter shared by all callers — Commerce, POS, Manufacturing, Preparation OS, and Logistics. There is no record of which order holds which reservation. This creates three failure modes:

1. **Selective Release Impossible:** If a POS order is cancelled after stock was reserved, you must decrement `reserved_qty` by the exact amount. If the decrement is wrong (bug or race), the counter drifts permanently.
2. **Reservation Leaks:** If a caller reserves stock but crashes before releasing (e.g. a queued job that times out), the reservation leaks and stock is permanently locked.
3. **No Expiration:** A reservation held indefinitely blocks stock from other orders with no automated reclaim.

**Trigger scenario:**  
Commerce reserves 10 units of a product. POS reserves 5 units of the same product. The Commerce order is cancelled. `ReleaseStockAction` is called to release 10 units. But a bug in the cancellation handler releases 15 instead of 10. `reserved_qty` goes negative (blocked by `NegativeInventoryException`) — or worse, if `allow_negative_stock` is enabled, silently goes negative.

**Required Mitigation:** Implement `inventory_reservations` per-order registry. See **ADR-INV-001**.

---

#### RISK-INV-004 — FIFO Consumption Without Events

**Risk Level:** HIGH  
**Probability:** Certain (already deployed)  
**Impact:** HIGH (cost accounting event stream incomplete; Accounting module cannot reconstruct COGS)

**Description:**  
`InventoryLayerConsumptionService` decrements `remaining_qty` on `InventoryReceiptLayer` records using direct `$layer->save()`. No domain event is published. This means:

1. Cost Accounting cannot receive a COGS event when goods are shipped.
2. Financial reconciliation between Inventory and Accounting must query tables directly rather than consuming an event stream.
3. The FIFO audit trail exists in the database but is invisible to the event system.

**Required Mitigation:** Publish `FIFOLayersConsumed` event from `InventoryLayerConsumptionService` (or the calling Action) after the transaction commits.

---

#### RISK-INV-005 — No Warehouse Types (Blocks Loading OS)

**Risk Level:** HIGH  
**Probability:** Certain if Loading OS is implemented  
**Impact:** HIGH (Loading OS cannot represent vehicle stock locations)

**Description:**  
The Loading OS architecture (ADR-015) requires vehicle warehouses — stock locations that represent inventory loaded onto a delivery vehicle. Without a `warehouse_type` discriminator, the system cannot:
- Prevent a vehicle warehouse from appearing in standard picking/receiving flows.
- Enforce that only Loading OS can transfer stock into a vehicle warehouse.
- Distinguish transit stock (in-vehicle) from warehouse stock in reporting.

**Required Mitigation:** Add `warehouse_type` enum to `warehouses` table (`standard`, `transit`, `vehicle`, `virtual`). See **ADR-INV-002**.

---

### MEDIUM Risks

---

#### RISK-INV-006 — Nested Transaction Event Dispatch (Phase B)

**Risk Level:** MEDIUM (Phase B)  
**Probability:** Possible  
**Impact:** MEDIUM (stale WooCommerce stock if outer transaction rolls back)

**Description:**  
`AdjustmentInAction` publishes its event after its inner `DB::transaction()` commits (which is a savepoint inside `ApproveCountSessionAction`'s outer transaction). If the outer transaction rolls back, the event has already been dispatched but the database change was rolled back. In Phase A (shadow logging), this is harmless. In Phase B (live WooCommerce sync), this would update the channel with a stock level that was then rolled back — causing a stock discrepancy.

**Required Mitigation:** Implement `PendingDomainEvents` collector pattern. Collect events during transaction; publish all after the outermost transaction commits.

---

#### RISK-INV-007 — No Incoming Qty (Demand Planning Blind Spot)

**Risk Level:** MEDIUM  
**Probability:** Certain  
**Impact:** MEDIUM (over-ordering, incorrect reorder point calculations)

**Description:**  
`InventoryItem` has no `incoming_qty` field. Stock approved in Purchase Orders but not yet received is invisible to availability calculations. A buyer looking at "available = 2" may create a new PO for 100 units, not knowing there is already a pending PO for 100 units in transit.

**Required Mitigation:** Add `incoming_qty` to `inventory_items`. Increment on `PurchaseOrderApproved` event (per line), decrement when GR is posted.

---

#### RISK-INV-008 — No Cross-Warehouse Transfer Action

**Risk Level:** MEDIUM  
**Probability:** Certain if transfers are needed  
**Impact:** MEDIUM (transfers would be implemented ad-hoc without going through the posting engine)

**Description:**  
`LedgerMovementType` defines `TransferIn` and `TransferOut` but there are no corresponding Actions. Without a first-class `TransferStockAction`, a developer implementing stock transfers might call `AdjustmentOut` + `AdjustmentIn` in sequence — which creates two separate transactions instead of an atomic one, leaving the system in a partially-transferred state if the second transaction fails.

**Required Mitigation:** Implement `TransferStockAction` (atomic: decrement source + increment destination + two ledger entries + one `StockTransferCompleted` event) in a single `DB::transaction()`.

---

### LOW Risks

---

#### RISK-INV-009 — Missing Composite Index on Ledger

**Risk Level:** LOW  
**Probability:** Gradual performance degradation at scale  
**Impact:** LOW (reporting slowness only; no correctness risk)

**Description:**  
The most common reporting pattern — "movements for a product in a company over a date range" — is not served by a composite index. Current separate indexes on `company_id`, `product_id`, and `created_at` require PostgreSQL to intersect them, which degrades at high row counts.

**Required Mitigation:** Add `INDEX(company_id, product_id, created_at)` on `stock_ledger_entries`.

---

#### RISK-INV-010 — Ledger Unbounded Growth (Long-Term)

**Risk Level:** LOW (long-term)  
**Probability:** Certain at production scale  
**Impact:** LOW (query slowness at 20M+ rows; no correctness risk)

**Description:**  
`stock_ledger_entries` is append-only and has no archival or partitioning strategy. At 500+ movements/day per warehouse (realistic for a busy distribution operation), the table reaches 20M rows within 2-3 years.

**Required Mitigation:** Plan range partitioning by `created_at` month before reaching 10M rows. Design archival policy (cold storage after 2 years).

---

## Risk Summary Matrix

| Risk ID | Description | Level | Probability | Current State | Fix Priority |
|---------|-------------|-------|-------------|---------------|--------------|
| RISK-INV-001 | Dual ledger / AddManualStockAction | CRITICAL | Low | Dead code exists | P0 — Delete now |
| RISK-INV-002 | DirectIssue silent (no event) | HIGH | Certain | Deployed | P0 — Fix now |
| RISK-INV-003 | Reservation counter collision | HIGH | Certain at multi-module | Deployed | P1 — Before Manufacturing/POS expand |
| RISK-INV-004 | FIFO consumption no event | HIGH | Certain | Deployed | P1 — Before Accounting |
| RISK-INV-005 | No warehouse types | HIGH | Certain at Loading OS | Missing | P1 — Before Loading OS |
| RISK-INV-006 | Nested txn event dispatch | MEDIUM | Phase B | Phase A only | P2 — Before Phase B |
| RISK-INV-007 | No incoming_qty | MEDIUM | Certain | Missing | P2 — Demand planning sprint |
| RISK-INV-008 | No TransferStockAction | MEDIUM | Certain at transfers | Missing | P1 — Before Loading OS |
| RISK-INV-009 | Missing composite index | LOW | Scale-dependent | Missing | P2 — Next DB sprint |
| RISK-INV-010 | Ledger unbounded growth | LOW | Long-term | No plan | P3 — Plan before Y2 |
