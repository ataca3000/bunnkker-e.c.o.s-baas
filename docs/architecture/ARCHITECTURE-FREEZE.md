# ARCHITECTURE FREEZE — Manufacturing & Procurement Domain

**Freeze Date:** 2026-06-29
**Frozen By:** TASK-ARCH-FIX-001 (post CTO Review TASK-ARCH-REVIEW-MFG-001)
**Status:** ✅ FROZEN — Implementation may begin

---

## 1. Freeze Declaration

The Manufacturing & Procurement architecture is hereby **frozen**. All architectural decisions recorded in this document and the five referenced specification documents are final. No implementation detail, schema column, event type, rule identifier, or cost strategy may be changed without going through the Change Control process defined in §6.

Any team member who identifies a conflict, gap, or required change during implementation must raise it through the ADR process — **not** resolve it unilaterally in code.

---

## 2. Frozen Document Set

| Document | Purpose | Version at Freeze |
|----------|---------|-------------------|
| [MANUFACTURING-PROCUREMENT-SPEC.md](MANUFACTURING-PROCUREMENT-SPEC.md) | Core domain specification: decision flow, execution engine, cost model, disassembly | Post RC-1 through RC-10 |
| [DECISION-ENGINE-SPEC.md](DECISION-ENGINE-SPEC.md) | Decision routing, rule table, idempotency, DecisionLog schema | Post RC-4, RC-6, RC-10 |
| [PROCUREMENT-INTELLIGENCE-SPEC.md](PROCUREMENT-INTELLIGENCE-SPEC.md) | Demand analysis, net requirement formula, procurement queue | Post RC-8, RC-9 |
| [MANUFACTURING-DATABASE-DESIGN.md](MANUFACTURING-DATABASE-DESIGN.md) | Full table catalog (C-01 through C-14), indexes, constraints | Post RC-6, RC-9, RC-10 |
| [MIGRATION-STRATEGY-MFG.md](MIGRATION-STRATEGY-MFG.md) | 18 ordered migrations, rollback procedures, risk matrix | As written — no structural changes required |
| [AI-DATA-ARCHITECTURE.md](AI-DATA-ARCHITECTURE.md) | AI/ML analytical datasets, event stream, entry points | As written — no structural changes required |

---

## 3. Final Architectural Decisions

### 3.1 Manufacturing Trigger Model
- Manufacturing is triggered **exclusively** by the `ORDER_PREPARING` event (one trigger per order line).
- The Decision Engine is the **sole** entry point — no direct service-to-service calls.
- All decisions are logged to `decision_logs` before execution begins (log-before-execute invariant).

### 3.2 Partial Manufacturing (RC-1 Final Decision)
```
shortage_qty = max(0, ordered_qty - available_finished_goods)
```
- The system checks finished goods stock at the **order's warehouse** before any manufacturing decision.
- If `shortage_qty = 0` → decision is `SKIP_STOCK_SUFFICIENT` (no manufacturing, no resource consumption).
- If `shortage_qty > 0` → manufacture exactly `shortage_qty` units, not the full `ordered_qty`.
- Raw material requirements scale to `shortage_qty` only.

### 3.3 Negative Stock Policy (RC-2 Final Decision)
- `allow_negative_stock` is a **product-level flag** evaluated against each **raw material** at consumption time.
- **Finished goods are never produced into negative inventory.** The partial manufacturing check (§3.2) prevents this.
- Rule MFG-007: If a raw material shortfall exists AND `raw_material.allow_negative_stock = true` → `MANUFACTURE_WITH_SHORTAGE`.
- Rule MFG-008: If a raw material shortfall exists AND `raw_material.allow_negative_stock = false` → `FAIL_STOCK_SHORTAGE`.

### 3.4 Cost Strategy (RC-3 + RC-5 Final Decision)
- Manufacturing consumption cost = **FIFO weighted average** of actual FIFO layers consumed.
- Fallback to `product.current_cost` only when no FIFO layers exist for the component.
- **Hybrid cost** is a runtime strategy — no dedicated columns. Both purchase receipts and recipe recalculations write to `product_cost_histories`. The most recent cost history entry wins.
- `cost_source` field distinguishes `'purchase_invoice'` from `'recipe'` updates in history.

### 3.5 Returns Decoupling (RC-4 Final Decision)
- No Returns domain is defined or assumed in this architecture.
- The `ORDER_RETURNED` event is **replaced** by `INVENTORY_RETURN` — a generic event decoupled from any specific return source.
- `INVENTORY_RETURN` carries `return_source_type` and `return_source_id` for traceability.
- The Disassembly Engine is agnostic to the return origin.

### 3.6 Idempotency (RC-6 Final Decision)
- Every `DecisionLog` row carries a `decision_key` (UNIQUE where not NULL).
- Key format: `"{event_type}:{trigger_source_type}:{trigger_source_id}:{subject_type}:{subject_id}"`
- Duplicate events with the same key are silently skipped if outcome is `'executed'` or `'skipped'`.
- `trigger_version` allows intentional retry after explicit operator action (increment required).

### 3.7 Execution Model (RC-7 Final Decision)
- **Business-synchronous**: from the order's perspective, manufacturing completes before the order advances.
- **Implementation-async**: dispatched as a Laravel `ManufacturingJob` on the queue.
- The order lifecycle awaits `inventory_manufacturing_at` timestamp before proceeding.
- The user never observes a partial manufacturing state.

### 3.8 Transaction Isolation (RC-8 Final Decision)
```
SCOPE 1: Inventory Transaction (atomic)
  BEGIN TRANSACTION
    create DisassemblyTransaction
    consume finished goods (debit inventory)
    add recovered raw materials (credit inventory)
  COMMIT

SCOPE 2: Post-commit (best-effort)
  ProcurementQueueService.recalculate(...)
  // Failure here: log warning only. Disassembly is NOT rolled back.
```
- Inventory operations NEVER rollback because a queue update fails.
- Procurement queue recalculation always runs AFTER inventory transaction commits.

### 3.9 Net Requirement Formula (RC-9 Final Decision)
```
net_required_quantity = max(0, gross_demand - available_inventory - in_transit_quantity)
```
- `available_inventory` already includes GR receipts and disassembly recoveries (via `on_hand_qty` updates).
- No `recovered_quantity` deduction — that was double-counting. Term removed permanently.
- Always a full recalculation from current state. No incremental accumulation.

### 3.10 Manufacturing Uniqueness (RC-10 Final Decision)
```sql
CREATE UNIQUE INDEX uq_mfg_txn_business_key
    ON manufacturing_transactions (order_line_id, bom_id, bom_version_number)
    WHERE status != 'failed';
```
- At most one non-failed manufacturing transaction per (order line, BOM, BOM version) tuple.
- BOM versioning is copy-on-write: a new BOM row is created when an in-use BOM is modified.
- Failed transactions are excluded from the unique constraint to allow retry.

---

## 4. Frozen Scope — Phase 1 Implementation

The following capabilities are **in scope** for the initial implementation:

| Capability | Description |
|-----------|-------------|
| Decision Engine | Single routing layer: ORDER_PREPARING → rules MFG-001 through MFG-008 |
| Partial Manufacturing | Manufacture only shortage_qty (finished goods check first) |
| FIFO Cost in Consumptions | Use actual FIFO layer cost; fallback to current_cost |
| Manufacturing Transactions | Full lifecycle: pending → in_progress → completed / failed |
| BOM Management | Single-level recipe with copy-on-write versioning |
| Disassembly Engine | Finished goods → raw material recovery with 2-scope transaction |
| INVENTORY_RETURN event | Generic decoupled return handling → triggers disassembly |
| Procurement Queue | Net requirement = gross - available - in_transit |
| Decision Log | Idempotency key, trigger_version, append-only audit |
| Hybrid Cost Strategy | Purchase invoice + recipe updates write to cost_history; most recent wins |
| ManufacturingJob | Async execution, order awaits inventory_manufacturing_at |

---

## 5. Deferred Features — Explicitly Out of Scope for Phase 1

The following were considered during architecture design and **deliberately deferred**. They must NOT be pre-built or scaffolded during Phase 1 implementation.

| Feature | Reason Deferred | Notes |
|---------|----------------|-------|
| Returns Bounded Context | Requires separate domain design | `INVENTORY_RETURN` event provides decoupling hook |
| Multi-level BOM (sub-assemblies) | Increases complexity significantly | Phase 1 supports single-level recipe only |
| Batch Tracking / Lot Numbers | Separate compliance domain | DB has `batch_number` column reserved; logic not implemented |
| Expiry Date Management | Tied to batch tracking domain | Deferred with batch tracking |
| Labor Cost Tracking | Requires HR/payroll integration | `labor_cost_per_unit` reserved in DB; not calculated |
| Quality Control (QC) Hold | Requires QC domain design | `requires_qc` flag reserved; not enforced in Phase 1 |
| Safety Stock Calculation | Requires historical demand analysis (Phase 2 AI) | Queue can hold null safety_stock_qty |
| Minimum Order Quantity (MOQ) | Requires supplier agreement domain | `minimum_order_quantity` column reserved; not enforced |
| Lead Time Modeling | Requires supplier performance data | `lead_time_days` reserved; not used in scheduling |
| Multi-stage Manufacturing | Requires workflow engine | Single transaction per order line only |
| Cost Cascade (multi-level) | Deferred — CASCADE_COST queued async in Phase 1 | Only immediate product cost update in Phase 1 |
| AI Demand Forecasting | Requires 6+ months of transaction data | Dataset schema defined in AI-DATA-ARCHITECTURE.md |

---

## 6. Change Control Process

The architecture is frozen. Any change to a decision in §3, a table schema in MANUFACTURING-DATABASE-DESIGN.md, a rule in DECISION-ENGINE-SPEC.md, or a formula in PROCUREMENT-INTELLIGENCE-SPEC.md **requires an Architecture Decision Record (ADR)**.

### Trigger Conditions Requiring an ADR
- Adding, removing, or renaming a column in any manufacturing/procurement table
- Changing the net requirement formula
- Adding a new event type to the Decision Engine
- Changing rule priorities or conditions in the rule table
- Modifying the transaction isolation boundaries
- Changing cost source logic for hybrid products
- Promoting any deferred feature into active scope

### ADR Process
1. Author writes ADR: context, decision, consequences, alternatives considered
2. ADR is reviewed by at least one other senior engineer
3. ADR is linked from the affected specification document
4. Architecture freeze document is updated to reflect the new decision

### Minor Clarifications (No ADR Required)
- Fixing a typo or ambiguous sentence in a specification
- Adding an index that the spec recommends but did not name
- Clarifying a comment in migration SQL
- Adding a new AI/analytical dataset to AI-DATA-ARCHITECTURE.md (additive only)

---

## 7. Implementation Packages — Recommended Order

Derived from MANUFACTURING-CTO-REVIEW.md §7.2. Ordered to minimize dependency risk.

| Package | Content | Depends On |
|---------|---------|-----------|
| PKG-01 | Database migrations MFG-M001 to MFG-M004 (products, BOM, recipes) | — |
| PKG-02 | Database migrations MFG-M005 to MFG-M007 (manufacturing transactions, consumptions, outputs) | PKG-01 |
| PKG-03 | Database migrations MFG-M008 to MFG-M011 (decision logs, procurement queue, supplier products, purchase orders) | PKG-02 |
| PKG-04 | Database migrations MFG-M012 to MFG-M018 (GR, disassembly, cost history, advisory locks, AI tables, immutability) | PKG-03 |
| PKG-05 | BOM Repository + BOM Service (copy-on-write versioning) | PKG-01 |
| PKG-06 | Decision Engine core: event intake, rule evaluation, DecisionLog (idempotency) | PKG-02, PKG-03 |
| PKG-07 | ManufacturingService: FIFO cost, shortage_qty, ManufacturingJob | PKG-05, PKG-06 |
| PKG-08 | ProcurementQueueService: net requirement formula, queue recalculation | PKG-03, PKG-07 |
| PKG-09 | Disassembly Engine: 2-scope transaction, INVENTORY_RETURN handler | PKG-07, PKG-08 |
| PKG-10 | Hybrid cost strategy: cost_history write path, cascade trigger (async) | PKG-07 |
| PKG-11 | Frontend: BOM management UI, manufacturing status, procurement queue review | PKG-07, PKG-08 |

---

## 8. Architecture Freeze Acknowledgment

This document certifies that:

1. All 10 Required Changes from MANUFACTURING-CTO-REVIEW.md have been resolved.
2. The five architecture specification documents have been updated accordingly.
3. The frozen decisions in §3 are consistent across all documents.
4. Implementation may begin with Package PKG-01.

**Architecture Status:** ✅ FROZEN
**Implementation Status:** ✅ APPROVED TO BEGIN
**Change Process:** ADR required for any architectural modification
