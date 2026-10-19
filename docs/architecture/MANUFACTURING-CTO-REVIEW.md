# ECOS ERP — CTO Architecture Review: Manufacturing & Procurement

**Document:** MANUFACTURING-CTO-REVIEW  
**Version:** 1.0  
**Task:** TASK-ARCH-REVIEW-MFG-001  
**Date:** 2026-06-29  
**Review Scope:** All 5 architecture documents treated as one unified design  
**Reviewed Documents:**
- `MANUFACTURING-PROCUREMENT-SPEC.md`
- `DECISION-ENGINE-SPEC.md`
- `RECIPE-ENGINE-SPEC.md`
- `PROCUREMENT-INTELLIGENCE-SPEC.md`
- `DATABASE-AUDIT-MFG.md`
- `MANUFACTURING-DATABASE-DESIGN.md`
- `MIGRATION-STRATEGY-MFG.md`
- `AI-DATA-ARCHITECTURE.md`

---

## Scorecard

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Architecture Score** | 72 / 100 | Solid foundation, 6 critical gaps |
| **Maintainability** | 76 / 100 | Clean boundaries, but engine coupling ambiguity |
| **Scalability** | 65 / 100 | Synchronous execution, unbounded JSONB growth |
| **Performance** | 63 / 100 | Hot-path synchronous cascade is dangerous |
| **AI Readiness** | 81 / 100 | Best designed aspect; one structural gap |
| **Security / Auditability** | 84 / 100 | Immutability design is excellent |

---

## Overall Verdict

```
╔══════════════════════════════════════════════╗
║   APPROVED                                   ║
╚══════════════════════════════════════════════╝
```

*Updated: 2026-06-29. All 10 Required Changes resolved via TASK-ARCH-FIX-001.*

The architectural foundation is sound and all critical issues have been resolved. The demand-driven model, event-sourced decision log, FIFO reuse, partial manufacturing logic, and append-only immutability strategy are production-ready. Implementation may begin per the Implementation Roadmap.

---

## 1. Domain Review

### 1.1 Aggregates — Assessment

| Aggregate | Boundary | Assessment |
|-----------|----------|------------|
| Product (products) | Clear | ✓ Correct. Single entity, flags drive behavior. |
| Recipe (bills_of_materials + lines) | Clear | ✓ Correct. Copy-on-write versioning is the right model. |
| Manufacturing Transaction | Clear | ✓ Correct. Transaction + Consumptions as one aggregate root. |
| Disassembly Transaction | Clear | ✓ Correct. Mirrors manufacturing correctly. |
| Decision Log | Clear | ✓ Correct. Append-only log, not an aggregate — correctly treated as infrastructure. |
| Procurement Queue Entry | Acceptable | ✓ One entry per product per company is correct. |
| Purchase Request | Clear | ✓ Correct lifecycle. |
| Scheduler Run | Clear | ✓ Correct. |

### 1.2 Missing Bounded Context — CRITICAL

**The Returns Module does not exist in this architecture.**

The `GOODS_RECEIPT_POSTED` event's housing module (Purchasing BC) is audited and clear. But the `ORDER_RETURNED` event is attributed to "Returns BC" throughout the spec, and the disassembly execution references:

```
return_item.product_id
return.warehouse_id
return_id (implicitly needed)
```

None of the following are addressed anywhere in the 5 documents:
- What table stores return records?
- What is the returns table schema?
- How does a return get from "customer requests" to "goods physically received"?
- Where is the `return_id` that should be stored on `disassembly_transactions`?

The `disassembly_transactions` table has `order_id` (the original order) but no `return_id`. This means disassembly transactions have no traceable link to the return document that triggered them.

**Impact:** The entire ORDER_RETURNED event chain cannot be implemented without a defined Returns domain.

**Required Change:** Before implementation, define the Returns bounded context: its table(s), status lifecycle, and how it emits `ORDER_RETURNED`. At minimum, add `return_id UUID NULL` to `disassembly_transactions`.

---

### 1.3 Missing Business Concept — Attention Queue

The Decision Engine spec (Section 3.1) states for `MFG-002` and `MFG-003`:
```
Action: "Log, add product to attention queue"
```

No "attention queue" entity exists anywhere in the database design. This is referenced as the mechanism by which operations teams see products needing configuration (no recipe, inactive recipe). It is not the `procurement_queue_entries` table — it is a separate notification mechanism.

**Options:**
1. The "attention queue" is just the filtered `decision_logs` view (outcome = 'failed') — no new table needed, the Operations UI reads from decision_logs. This is the simplest interpretation.
2. A separate `system_alerts` table is required.

**Required Change:** Define explicitly what "attention queue" means in the implementation context. Recommended: it IS the decision_logs table filtered by `outcome = 'failed'`. Remove the phrase "attention queue" from the spec and replace with "visible in the Operations Dashboard via decision_logs."

---

### 1.4 Hidden Coupling — Cost Engine Boundary

The "Cost Engine" is listed as a "NEW BC" in Appendix A of the spec. However:
- The Cost Engine's rules are defined inside the Decision Engine spec (Section 3.3, 3.4)
- The Cost Engine's outputs are stored in `product_cost_histories` (a separate table)
- The Cost Engine is called BY the Decision Engine

The boundary between "Decision Engine" and "Cost Engine" is blurred. The Decision Engine evaluates COST-001 through COST-007 rules AND dispatches to the Cost Engine. Is the Cost Engine a service called by the Decision Engine, or is it a separate listener that receives events?

**Required Change:** Clarify whether Cost Engine is a service dependency of Decision Engine (synchronous call) or an independent event listener. Recommendation: Cost Engine is a domain service called by the Decision Engine's dispatcher — not an independent event listener. This preserves the single-routing-point principle while keeping the cost logic in its own class.

---

### 1.5 Circular Update Risk — Component Cost Cascade

Rule COST-007 says: "When component product cost changes, recalculate parent recipe costs." But COST-005 says: "When recipe is updated, recalculate product cost." If a product is both a manufactured product AND a component in other products' recipes, a recipe update triggers COST-005 (update its own cost) which triggers COST-007 (update parents' costs) which could theoretically trigger COST-005 again on parents if they in turn are components in other recipes.

The spec acknowledges "detect by tracking visited product IDs" in the error table (Section 8.4), but no implementation mechanism for tracking visited IDs is specified.

**Required Change:** Document the cost cascade algorithm explicitly — a visited set passed through recursive calls, with maximum depth = 1 for Phase 1 as a hard guard.

---

## 2. Database Review

### 2.1 Critical: Finished Product Stock Check Missing

**This is the most significant logic gap in the entire specification.**

The Decision Flow (Chapter 5.2) triggers manufacturing for every order line where `can_manufacture = true` when the order enters "preparing." Steps 7-10 check for **raw material shortfall**. But the flow never checks whether the **finished product is already in stock**.

Current logic:
```
ORDER_PREPARING → can_manufacture = true? → check raw materials → MANUFACTURE
```

Correct logic:
```
ORDER_PREPARING → can_manufacture = true? → check finished product stock → 
  if sufficient stock: SKIP_ALREADY_IN_STOCK (use reservation)
  else: check raw materials → MANUFACTURE
```

Without this check, the system will **manufacture products that are already in stock**, consuming raw materials unnecessarily. For example:
- Customer orders 5 units of Honey 500g
- Warehouse has 10 units of Honey 500g in stock
- Order enters "preparing"
- System manufactures 5 more units, consuming raw honey

**Impact:** Incorrect inventory behavior. This will cause resource waste and stock overcounting.

**Required Change:** Add `MFG-000` rule (highest priority) to the Decision Engine ORDER_PREPARING rules:

| Priority | Rule ID | Condition | Decision | Action |
|----------|---------|-----------|----------|--------|
| 0 | `MFG-000` | `can_manufacture = true` AND `available_finished_product_stock >= order_line.quantity` | `SKIP_STOCK_SUFFICIENT` | Log only. Existing reservation satisfies demand. |

Add this check BEFORE MFG-001 through MFG-006.

---

### 2.2 Critical: `allow_negative_stock` Flag Contradiction

Two chapters say two different things about which product's `allow_negative_stock` flag governs manufacturing:

**Chapter 2.3 (Product Rules):**
> "This flag applies to the **output product** (the finished good being manufactured). Whether the raw material products allow negative stock is determined by those products' own allow_negative_stock flag."

**Chapter 7.4 (Inventory Rules):**
> "Check `allow_negative_stock` on the **raw material being consumed**. If false and consumption would go negative: block this manufacturing run."

**Chapter 5.2 (Decision Flow, steps 8-10):**
Uses `product.allow_negative_stock` where `product` is the finished good being manufactured.

These are fundamentally different behaviors:

- **If the rule is on the OUTPUT product:** One flag controls whether manufacturing proceeds when any raw material is short.
- **If the rule is on the RAW MATERIAL:** Each raw material independently controls whether it can go negative. Manufacturing might partially proceed for some lines but not others.

**Required Change:** Decide on ONE authoritative interpretation. Recommended: The flag lives on the **output product** (as stated in Chapter 2.3 and demonstrated in the Decision Flow). Chapter 7.4 is misleading and must be corrected to read: "If `finished_product.allow_negative_stock = false` and any raw material consumption would go negative, block manufacturing." Optionally, add `allow_negative_stock` to raw material products as an independent safeguard for future use.

---

### 2.3 Critical: FIFO Layer Cost vs. Current Cost Contradiction

The manufacturing consumption cost is defined inconsistently across the specification:

**Chapter 5.3 (Manufacturing Execution pseudocode):**
```
unit_cost = item.product.current_cost  // snapshot at execution
```

**Chapter 7.5 (FIFO Integration):**
> "The `unit_cost` of the consumed layer is the cost used in the RawMaterialConsumption record."

**Database Design (manufacturing_consumptions comment):**
```sql
unit_cost DECIMAL(15,4) NOT NULL, -- current_cost at execution time — FIFO layer cost
```
The comment says both things simultaneously, revealing the contradiction.

These produce different values:
- `current_cost` = the product's configured current cost (a single value per product)
- FIFO layer cost = the actual cost of the specific receipt batch being consumed (varies per batch)

**Accounting impact:** FIFO layer cost is the correct cost for accurate COGS. Using `current_cost` is simpler but less accurate and inconsistent with how sales COGS are calculated (which use FIFO layer costs via `inventory_layer_consumptions.unit_cost`).

**Required Change:** Standardize on **FIFO layer cost** for manufacturing consumptions. The `manufacturing_consumptions.unit_cost` must be populated from `inventory_receipt_layers.landed_unit_cost` of the specific FIFO layer consumed — exactly as sales consumptions work. Update Chapter 5.3 pseudocode to reflect this.

---

### 2.4 Critical: Hybrid Cost Data Model Incomplete

Chapter 3 defines the "hybrid" cost source as:
> "Two cost components are tracked: `purchase_cost` and `recipe_cost`. The `current_cost` reflects the most recently updated source."

But the `products` table extension (MFG-M001) only adds ONE new cost field: `current_cost DECIMAL(15,4)`. There are no `hybrid_purchase_cost` or `hybrid_recipe_cost` columns anywhere in the design.

Without these two fields:
- The hybrid logic has nowhere to store the `purchase_cost` component
- When a GR is posted for a hybrid product, the system can't know what the recipe component was (and vice versa)
- The "most recently updated source" logic has no state to compare

**Required Change:** Add to the products table:
```sql
ADD COLUMN hybrid_purchase_cost DECIMAL(15,4) NULL  -- populated from GR landed_unit_cost
ADD COLUMN hybrid_recipe_cost   DECIMAL(15,4) NULL  -- populated from recipe calculation
```
Both are NULL for non-hybrid products. For hybrid products, `current_cost` = whichever was most recently updated.

---

### 2.5 Critical: Event Idempotency Key Missing

The Decision Engine spec (Section 10 Constraints) states:
> "Event processing guarantee: At-least-once (idempotency key on event_id)"

But `decision_logs` has no `event_id` or `idempotency_key` column. Without this, if an `ORDER_PREPARING` event is delivered twice (queue retry, network issue), manufacturing will run twice for the same order line — consuming double the raw materials and producing double the finished goods.

**Required Change:** Add to `decision_logs`:
```sql
ADD COLUMN idempotency_key VARCHAR(128) NULL UNIQUE
```
The idempotency key format: `{event_type}:{trigger_source_id}:{subject_id}` (e.g., `ORDER_PREPARING:order-uuid:order-line-uuid`). Before processing any event, check if a decision_log entry exists with this key. If yes, skip.

Alternatively, a dedicated `processed_events` table is cleaner:
```sql
CREATE TABLE processed_events (
    event_id VARCHAR(128) PRIMARY KEY,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

### 2.6 Missing: Manufacturing Transaction Uniqueness Constraint

The `manufacturing_transactions` table has no constraint preventing two manufacturing runs for the same order line. If two concurrent `ORDER_PREPARING` events arrive (retry race condition), both could create separate manufacturing transactions for the same `order_line_id`.

**Required Change:** Add a unique constraint:
```sql
ALTER TABLE manufacturing_transactions 
ADD CONSTRAINT uq_mfg_txn_order_line 
UNIQUE (order_line_id) WHERE status != 'failed';
```
This allows a failed transaction to be retried (new row for same order_line_id) while preventing concurrent duplicates.

---

### 2.7 Database Design Issues (Non-Critical)

**Advisory lock integer conversion undefined:**
`pg_try_advisory_lock(company_id_hash)` is specified but the conversion from UUID company_id to the bigint required by the PostgreSQL advisory lock function is not defined.

**Recommended approach:**
```sql
SELECT pg_try_advisory_lock(('x' || substr(md5(company_id::text), 1, 16))::bit(64)::bigint);
```
This must be standardized before implementation.

**Procurement Queue JSONB growth:**
`contributing_sources` JSONB in `procurement_queue_entries` accumulates order references indefinitely. When an entry has been accumulating for months, this array could contain thousands of entries. Cleanup strategy: When an order is cancelled or completed, its contribution should be removed from the JSONB. A MAX cap of 500 contributing sources is recommended with a summary counter for overflow.

**Scheduler run snapshot size:**
`scheduler_runs.inventory_snapshot`, `open_po_snapshot`, and `queue_snapshot` are uncapped JSONB fields. For a company with 5,000 SKUs and 500 open PO lines, each scheduler run could write multiple MB to the database. Recommendation: Move snapshots to a separate `scheduler_run_snapshots` table with individual rows per product, or apply compression.

**purchase_requests uniqueness:**
No constraint enforces "one PR per product per scheduler run." Add:
```sql
ALTER TABLE purchase_requests 
ADD CONSTRAINT uq_pr_run_product UNIQUE (scheduler_run_id, product_id);
```

---

## 3. Engine Review

### 3.1 Decision Engine

**Strengths:**
- Single routing point — correct and clean
- Log-before-execute pattern — excellent
- Stateless rule evaluation — well-designed

**Issues:**
- **Delivery mechanism undefined:** Is the Decision Engine called synchronously from each BC (function call), or does it listen to a Laravel event bus? The spec shows it as a "receives events" model (diagram in Section 1.1) suggesting an event bus. But synchronous function call is implied by the manufacturing execution flow (no async gap between order entering "preparing" and manufacturing completing). This must be specified. **Recommended: Laravel event listeners (synchronous in Phase 1, dispatchable to queue in Phase 2).**
- **Rule evaluation order for GOODS_RECEIPT_POSTED:** PROC-001 (RECALCULATE_QUEUE) is marked `*(always)*` — it fires for every GR line regardless of other rules. But the cost rules (COST-001 through COST-004) are evaluated first. If COST-001 through COST-004 throw an exception, does PROC-001 still fire? The "always" designation needs exception handling clarification.

### 3.2 Recipe Engine

**Strengths:**
- Clean API contract (Section 8)
- Cyclic dependency detection is correct
- Copy-on-write versioning is the right model

**Issues:**
- **Version history vs. copy-on-write contradiction:** Section 2.2 says "Version history is NOT stored as separate rows." Section F-04 of the database design says: when a used BOM is updated, a NEW BOM ROW is created (copy-on-write). These are contradictory. New rows ARE created. The correct statement is: "Version history is preserved through copy-on-write rows. Each version is a separate BOM row with a unique ID." Clarify this in the spec.
- **`bom_version_snapshot` vs `bom_version_number`:** `manufacturing_transactions` stores both `bom_version_snapshot VARCHAR(20)` (the string version like "1.0") and `bom_version_number INTEGER`. Since copy-on-write creates a new BOM row for each version, the `bom_id` FK alone provides full traceability to the exact recipe. The separate version fields are useful for display but create potential inconsistency if populated incorrectly. Ensure both are populated atomically.

### 3.3 Cost Engine

**Strengths:**
- Cost history as append-only log is correct
- Four cost sources cover real-world scenarios

**Issues:**
- **Cascade path duplication:** Two separate code paths trigger parent recipe cost recalculation:
  1. `RECIPE_UPDATED` event → COST-007 (explicit rule)
  2. Component product cost changes (Recipe Engine Section 6.3 `onComponentCostChanged`)

  Both paths must recalculate the same parent products. If both fire for the same event (e.g., a recipe update changes which components are used), double-calculation occurs. A deduplication mechanism or a single canonical path is needed.
  
- **Cascade boundary:** Phase 1 cascades one level. A product A that costs 10 EGP has its cost updated to 12 EGP. Product B (which uses A) gets recalculated. Product C (which uses B) does NOT get recalculated in Phase 1. This is an accepted limitation but it means `product_cost_histories` for C will show a stale cost that doesn't reflect the true A→B→C cascade. Operations team must be aware.

### 3.4 Procurement Engine

**Strengths:**
- "Recalculate before generate" principle is excellent
- Snapshot isolation is correctly designed
- One PR per product per run is the right model

**Issues:**
- **Net Requirement formula double-counts:** The formula includes `recovered_quantity` as a deduction:
  ```
  net_required = gross_demand - available_inventory - in_transit - recovered_quantity
  ```
  But `recovered_quantity` is described as "disassembly recoveries + recent GRs since last scheduler run." Recent GRs should ALREADY be reflected in `available_inventory` (they increase on_hand_qty). Including them in both `available_inventory` AND `recovered_quantity` double-deducts from net requirement.
  
  **Required Change:** `recovered_quantity` should only count disassembly recoveries that have not yet been reflected in inventory (i.e., in-flight recoveries), or remove it entirely and rely on `available_inventory` being up-to-date.

---

## 4. Workflow Review

### 4.1 Order → Decision → Manufacturing → Inventory

**FAIL — Missing check.** See Section 2.1: Finished product stock is not checked before triggering manufacturing.

### 4.2 Manufacturing → Disassembly Queue Recalculation

Chapter 6.3 (Disassembly Execution) includes this inside the transaction:
```
STEP 6: ProcurementQueueService.recalculate(affected product_ids)
COMMIT TRANSACTION
```

If the queue recalculation fails (e.g., deadlock on `procurement_queue_entries`), the ENTIRE disassembly is rolled back — the finished product reappears in stock and the recovered raw materials disappear. This is too aggressive. A disassembly failure due to a queue update problem is worse than an incomplete queue.

**Required Change:** Move queue recalculation OUTSIDE the disassembly transaction:
```
BEGIN TRANSACTION
  [disassembly steps 1-5]
COMMIT TRANSACTION

// After commit, best-effort queue update:
ProcurementQueueService.recalculate(affected product_ids)
// If this fails: log warning, do NOT roll back disassembly
```

### 4.3 Goods Receipt → Cost Update → Queue Recalculation

Well-specified. The sequence (GR posted → Decision Engine → Cost Engine + Queue) is correct.

**One gap:** The spec says PROC-001 fires "always" on every GR line. But if the GR line product has `is_satisfied = true` in the queue (no pending demand), calling `recalculate()` for that product is wasted work. The queue service should be a no-op for satisfied products. This is a performance optimization but should be documented.

### 4.4 Scheduler → Purchase Request → PO

Well-specified. The lifecycle is clean.

**One gap:** When a PR is converted to a PO, the `in_transit_quantity` in `procurement_queue_entries` should increase immediately (the PO now represents ordered stock). The spec describes this in Section 5.2 of the Procurement Intelligence spec (`ProcurementQueueService.addInTransit(product_id, po_quantity)`). But this call is not wired into the PR-to-PO conversion workflow in that same section (4.1). Ensure the `addInTransit` call is part of the PR conversion service.

### 4.5 Negative Inventory Scenario

When `allow_negative_stock = true` on the output product, manufacturing proceeds and raw material goes negative. The shortfall is added to the Procurement Queue. But: what happens when the GR arrives later and raw material stock becomes positive? The negative stock was consumed (it's an inventory_receipt_layer with negative quantity). How is the negative layer resolved when new stock arrives? This FIFO edge case for negative layers is not addressed.

**Required Change:** Document the negative FIFO layer resolution strategy:
- Option A: Negative layer is "absorbed" by the next incoming GR layer (incoming qty nets against negative balance).
- Option B: Negative layer stays until explicitly reconciled.

The existing FIFO engine's behavior here must be confirmed and documented.

---

## 5. Performance Review

### 5.1 Hot Paths

| Path | Volume Estimate | Risk |
|------|----------------|------|
| ORDER_PREPARING processing | Up to 500/hour peak | HIGH — synchronous manufacturing |
| Cost cascade on GR | Per product × parent count | HIGH — can freeze GR posting |
| Procurement Queue update | Multiple events/minute | MEDIUM — serialized via SELECT FOR UPDATE |
| Recipe cyclic check on save | Once per save | LOW |
| Scheduler run | 2-3x/day | LOW if run off-peak |

### 5.2 Synchronous Manufacturing — Severe Risk

The spec describes manufacturing as synchronous inside the order status change:
```
Order → preparing → ORDER_PREPARING event → Decision Engine → Manufacturing (per line) → COMMIT
```

For an order with 5 manufactured items, each requiring FIFO consumption across multiple layers:
- 5 decision evaluations
- 5 recipe lookups
- 5 × N FIFO layer reads
- 5 × N FIFO consumption writes
- 5 inventory addition writes
- 5 cost updates

This is a 30-50 database operation chain inside a synchronous HTTP request. Under load (50 concurrent orders entering "preparing"), this creates severe database contention.

**Required Decision (before any implementation):** Manufacturing MUST be executed asynchronously via a Laravel Queue job.

The flow should be:
```
Order → preparing → dispatch ManufacturingJob(order_id) to queue → return immediately
ManufacturingJob executes in background → records manufacturing_transaction → updates inventory
```

The `inventory_manufacturing_at` timestamp on orders (which the design already includes) is the marker for when the background job completes. This is already a good signal — it just needs to be used properly.

This is the single most important architectural decision for system scalability.

### 5.3 Cost Cascade Performance

When Raw Honey (a component in 50 products' recipes) receives a GR that updates its cost:

**Synchronous path (current spec):**
1. GR posted → Decision Engine → CostEngine.updateFromGoodsReceipt(raw_honey)
2. `product_cost_histories` entry created
3. For each of 50 parent products:
   - Load recipe
   - Recalculate cost
   - Update `products.current_cost`
   - Write `product_cost_histories` entry
4. GR posting request waits for all 50 updates

Total: 1 + 50 DB writes before the GR HTTP response returns.

**Required Change:** Queue cost cascade events:
```
GR posted → update raw_honey cost synchronously → 
dispatch CostCascadeJob(raw_honey_id) to queue →
GR response returns immediately →
Background: CostCascadeJob updates 50 parent products
```

### 5.4 Procurement Queue Contention

Two simultaneous orders failing stock check for the same raw material both attempt:
```sql
BEGIN;
SELECT * FROM procurement_queue_entries WHERE product_id = ? FOR UPDATE;
UPDATE procurement_queue_entries SET net_required_quantity = ... WHERE ...;
COMMIT;
```

This serializes concurrent manufacturing failures, creating a bottleneck. Acceptable for Phase 1 volumes (< 100 orders/hour) but problematic at scale.

**Phase 1 mitigation:** Application-level debounce — recalculate queue at most once per 30 seconds per product.

### 5.5 Scheduler Run Snapshot Size

For a company with 2,000 products and 300 open PO lines, each scheduler run writes approximately 3 JSONB fields totaling ~500 KB to 2 MB. At 3 runs/day × 365 days, this is 500 MB–2 GB per year in `scheduler_runs` alone.

**Required Change:** Move the 3 snapshot fields to a separate `scheduler_run_snapshots` table (one row per product per run) instead of monolithic JSONB. This enables efficient querying for AI/analytics and prevents table bloat.

### 5.6 Decision Log Growth

At 500 orders/day × 5 items/order × 1 decision per item = 2,500 decision log entries/day. Over 3 years: ~2.75M rows. With appropriate indexes this is fine for PostgreSQL. No action needed for Phase 1. A time-based partition strategy (partition by decided_at month) should be implemented before reaching 10M rows.

---

## 6. AI Readiness Review

The AI data architecture is the strongest aspect of this design. The 8 analytical datasets are well-identified and the event payload approach (JSONB metadata on decision_logs) is excellent for ML feature extraction.

### 6.1 Issues

**DS-007 (Procurement Queue Evolution) structural problem:**

The AI data architecture describes tracking how the queue changes over time:
> "One row per scheduler run per queue entry"

But `procurement_queue_entries` is a mutable table (one row per product, continuously overwritten). The only historical record is `scheduler_runs.queue_snapshot` (JSONB).

To enable DS-007 as described, either:
- Option A: Parse the JSONB `queue_snapshot` from each `scheduler_run` at query time — works but is slow and not indexable.
- Option B: Create a dedicated `scheduler_run_queue_snapshots` table (one row per product per run) — enables direct SQL analytics.

**Recommended Change:** If the scheduler_runs snapshot JSONB fields are replaced with a proper table (see Section 5.5 above), DS-007 analytics become directly queryable. This is a two-for-one fix.

**Event payload schema not defined:**

The `decision_logs.metadata` JSONB is the primary ML feature store. The specification provides example entries (Section 4.3 of Decision Engine spec) but doesn't formally define the schema per event type. Without a formal contract, different developers will populate this JSONB differently, making ML training data inconsistent.

**Required Change:** Define a formal payload schema per event type as part of the implementation contracts. Example:
```json
// ORDER_PREPARING + MANUFACTURE decision
{
  "product_id": "uuid",
  "order_quantity": 5.0,
  "available_raw_material_stock": { "component-uuid": 10.0 },
  "recipe_version": 3,
  "manufacturing_cost_estimate": 24.50,
  "shortfall_quantities": {}
}
```

**DS-003 Supplier Performance references unconfirmed field:**

DS-003 references `purchase_orders.expected_delivery_date`, but this column was not audited in the existing schema (the audit only covered manufacturing-relevant tables). Confirm this field exists before implementing DS-003.

---

## 7. Security Review

### 7.1 Strengths

- REVOKE UPDATE, DELETE on immutable tables — excellent
- `row_security_policy` for extra protection on decision_logs — excellent
- Transaction rollback on manufacturing failure — correct
- No external API calls during manufacturing execution — correct

### 7.2 Issues

**Single database role assumption:**

The immutability enforcement relies on a dual-role PostgreSQL setup:
- `admin_user` (migration role) — has full access
- `app_user` (application role) — REVOKE'd from UPDATE/DELETE on immutable tables

But if the Laravel application uses a single database connection user for both migrations AND runtime, the REVOKE has no effect. The migration runner and the application must use different database users.

**Required Change:** Implement a dual DB user setup:
- `ecos_migrator` — used by `artisan migrate` only
- `ecos_app` — used by application runtime with limited permissions
- Document this as a deployment requirement.

**Input validation for event payloads:**

Events passed to the Decision Engine carry payloads (order_id, product_id, quantities). If an event is malformed or tampered with (e.g., negative quantities injected via a compromised internal service), the Decision Engine could trigger manufacturing with negative quantities. Validate all event payload fields at the Decision Engine entry point before evaluation.

**Audit actor capture:**

`decision_logs.actor_id` is NULL for system actions. For user-triggered actions (manual scheduler run, manual retry), the actor is captured. But `manufacturing_transactions` has no actor field — the actor is only available by JOINing to `decision_logs`. This is acceptable but must be documented as the canonical way to get actor information for a manufacturing run.

---

## 8. Future Expansion Review

| Capability | Current Design Readiness | Notes |
|-----------|--------------------------|-------|
| Multiple Factories | Medium | `warehouse_id` serves as factory. No `factory_type` distinction. Works for Phase 1. |
| Warehouse Transfers | Ready | Existing transfer movement types. Not impacted. |
| Production Planning | Not Ready | Requires capacity model, WIP tracking, scheduling UI. Not designed. |
| Batch Tracking / Lot Numbers | Not Ready | FIFO assumes fungible stock. Requires `lot_id` on receipt layers. Major Phase 2 design. |
| Expiry Dates / FEFO | Not Ready | Requires `expiry_date` on receipt layers and FEFO consumption logic. |
| Quality Control | Not Ready | No QC hold, inspection, or rejection flow designed. |
| Machine Integration | Not Ready | Would require machine event types in the Decision Engine catalog. |
| Labor Cost | Not Ready | `manufacturing_cost` only includes raw materials. Labor cost not captured. |
| Multi-stage Manufacturing | Not Ready | Single atomic transaction model. WIP between stages not supported. |
| Multiple Companies / Multi-tenancy | Ready | `company_id` is present on all key tables. |

**Architecture verdict on expansion:** The foundation does not preclude any of these capabilities. The event-driven Decision Engine can absorb new event types without structural change. The FIFO engine can be extended for FEFO. The manufacturing transaction model can grow to support multi-stage with WIP. **The architecture is expansion-ready at the pattern level, even though the specific capabilities are not designed.**

---

## 9. Risk Matrix

### Critical Risks

| # | Risk | Impact | Probability | Mitigation |
|---|------|--------|-------------|-----------|
| C-1 | Manufacturing triggers even when finished product is in stock | Over-manufacturing, wasted materials, incorrect inventory | CERTAIN if unresolved | Add MFG-000 stock sufficiency check before all MFG rules |
| C-2 | `allow_negative_stock` flag ambiguity causes inconsistent behavior across modules | Manufacturing blocks or proceeds unexpectedly | HIGH | Define flag semantics on output product; remove contradicting Chapter 7.4 text |
| C-3 | FIFO cost vs current_cost contradiction in manufacturing consumptions | Incorrect COGS tracking for manufactured products | CERTAIN if unresolved | Standardize on FIFO layer cost; update pseudocode |
| C-4 | Returns Module undefined — ORDER_RETURNED event has no housing BC | Disassembly cannot be implemented | CERTAIN if unresolved | Define Returns BC before Package 06 implementation |
| C-5 | Hybrid cost has no storage for two components | Hybrid cost source cannot work | CERTAIN if unresolved | Add hybrid_purchase_cost + hybrid_recipe_cost columns |
| C-6 | No event idempotency key — duplicate events cause double manufacturing | Double raw material consumption, doubled finished goods output | HIGH in production | Add idempotency_key to decision_logs or create processed_events table |

### High Risks

| # | Risk | Impact | Probability | Mitigation |
|---|------|--------|-------------|-----------|
| H-1 | Synchronous manufacturing blocks HTTP request | Timeout / poor UX under load | CERTAIN at scale | Mandate async queue-based execution before implementation |
| H-2 | Cost cascade synchronous on GR posting | GR posting freezes under heavy catalog | HIGH | Queue cost cascade events |
| H-3 | Disassembly rolls back if queue update fails | Silent disassembly failure, lost recovery | MEDIUM | Move queue recalculation outside transaction |
| H-4 | Procurement Queue net requirement formula double-counts recovered quantity | Over-estimation of demand, duplicate purchase requests | HIGH | Remove double-counting from formula |
| H-5 | No uniqueness constraint on manufacturing_transactions per order_line | Duplicate manufacturing from retry race condition | MEDIUM | Add unique constraint on order_line_id WHERE status != 'failed' |

### Medium Risks

| # | Risk | Impact | Probability | Mitigation |
|---|------|--------|-------------|-----------|
| M-1 | Attention queue undefined | Operations team has no way to see failed decisions | CERTAIN | Define as decision_logs filtered by outcome='failed' |
| M-2 | Advisory lock UUID-to-bigint conversion undefined | Concurrent scheduler runs if conversion is inconsistent | MEDIUM | Standardize conversion function |
| M-3 | scheduler_runs JSONB snapshots unbounded growth | Table bloat, slow queries at scale | HIGH at 1+ year | Replace JSONB snapshots with relational table |
| M-4 | contributing_sources JSONB grows unbounded | Large JSONB field, slow updates | MEDIUM | Add cleanup on order completion; cap at 500 sources |
| M-5 | Phase 1 cost cascade only 1 level deep | Grandparent product costs become stale | HIGH (always) | Document clearly; communicate to operations team |
| M-6 | purchase_requests lacks uniqueness per run + product | Duplicate PRs possible from scheduler bugs | MEDIUM | Add UNIQUE constraint |
| M-7 | stock_movements vs stock_ledger_entries — manufacturing entries in one, not the other | Reporting inconsistency | MEDIUM | Audit stock_movements usage; add manufacturing types if needed |
| M-8 | Single DB user makes REVOKE enforcement ineffective | Immutable tables can be modified by app | MEDIUM | Implement dual DB user setup |

### Low Risks

| # | Risk | Impact | Probability | Mitigation |
|---|------|--------|-------------|-----------|
| L-1 | Disassembly_transactions missing return_id | Incomplete traceability | LOW for Phase 1 | Add return_id when Returns module is defined |
| L-2 | Negative FIFO layer resolution not documented | Edge case incorrect behavior | LOW | Document resolution strategy |
| L-3 | Decision log grows to 10M+ rows over 5 years | Slow queries without partitioning | LOW for now | Plan partition strategy before Year 3 |
| L-4 | DS-003 references unconfirmed purchase_orders.expected_delivery_date | AI dataset broken | MEDIUM | Confirm field exists in audit |
| L-5 | product_type business logic audit not enforced | Classification leak into business rules | MEDIUM | Run grep audit before implementation |

---

## 10. Improvement Opportunities

These improvements should be made BEFORE implementation:

**1. Add MFG-000 rule (Finished Product Stock Check)**
One new rule added to the Decision Engine that prevents over-manufacturing. Pure spec change, no schema change needed.

**2. Standardize event delivery mechanism**
Specify "Laravel synchronous event listeners in Phase 1, dispatchable to queue in Phase 2" as the canonical delivery pattern. This answers the coupling question definitively.

**3. Replace JSONB scheduler snapshots with a proper table**
`scheduler_run_snapshots` table: `(scheduler_run_id, product_id, on_hand_qty, in_transit_qty, net_req_qty)`. Fixes both the snapshot bloat issue and DS-007 AI analytics gap.

**4. Formalize event payload schemas**
Define a per-event-type JSON schema for `decision_logs.metadata`. Generates consistent ML training data and prevents developer freestyle.

**5. Split hybrid cost into two fields on products**
`hybrid_purchase_cost` + `hybrid_recipe_cost` columns. Enables the hybrid cost source to work correctly. Small migration addition.

**6. Add return_id placeholder to disassembly_transactions**
Add `return_id UUID NULL` now, even before the Returns module is defined. Leaving it out means a schema change when Returns is implemented.

**7. Document the negative FIFO layer resolution strategy**
One paragraph in the spec. Prevents ambiguity during implementation.

**8. Define the dual database user setup as a deployment requirement**
One paragraph in the deployment documentation. Enables actual immutability enforcement.

---

## Required Changes — Resolution Status

All 10 Required Changes have been resolved in TASK-ARCH-FIX-001.

| # | Required Change | Resolution | Documents Updated |
|---|----------------|-----------|-------------------|
| RC-1 | Manufacture only the shortage (partial manufacturing) | Added MFG-005 (SKIP_STOCK_SUFFICIENT) rule. Decision flow now checks finished goods availability first and manufactures only `shortage_qty`. | SPEC §5.2, DECISION-ENGINE §3.1 + §9 |
| RC-2 | `allow_negative_stock` evaluated on raw materials only | Clarified: flag lives on product being consumed (raw material). Finished goods never go negative. Chapter 7.4 rewritten. | SPEC §2.3, §7.4 |
| RC-3 | FIFO layer cost in manufacturing consumptions | Standardized on FIFO weighted average cost. `current_cost` is fallback only. Pseudocode in §5.3 updated. DB C-04 comment corrected. | SPEC §5.3, DB C-04 |
| RC-4 | Returns domain decoupled | `ORDER_RETURNED` replaced with generic `INVENTORY_RETURN` event. Disassembly engine is source-agnostic. | SPEC §6, DECISION-ENGINE §2.2, §3.2, §9 |
| RC-5 | Hybrid cost as runtime strategy | Hybrid cost uses `product_cost_histories` as the source of truth. No new columns on products. Both GR and recipe updates write cost history — most recent wins. | SPEC §3.1 |
| RC-6 | Idempotency via decision_key | Added `decision_key VARCHAR(256) UNIQUE` and `trigger_version INTEGER` to `decision_logs`. Idempotency enforcement documented in Decision Engine §4.3. Metadata schema formalized in §4.4. | DECISION-ENGINE §4.1, DB C-01 |
| RC-7 | Queue recalculation outside transaction | Disassembly §6.3 now has explicit two-scope structure: inventory transaction commits first; queue recalculation is post-commit best-effort. | SPEC §6.3 |
| RC-8 | Net requirement formula fixed | `recovered_quantity` removed from formula. GRs and disassembly recoveries are already in `available_inventory` (on_hand_qty). Formula is now `max(0, gross - available - in_transit)`. | PROC-INTELLIGENCE §1.3, §1.6, DB C-07 |
| RC-9 | Async execution with business-synchronous semantics | ManufacturingJob dispatched to queue worker. `inventory_manufacturing_at` timestamp signals completion. User never sees partial manufacturing. | SPEC §5.3 |
| RC-10 | Unique constraint prevents duplicate manufacturing | `UNIQUE INDEX uq_mfg_txn_business_key ON (order_line_id, bom_id, bom_version_number) WHERE status != 'failed'` added. | DB C-03 |

---

## Implementation Roadmap

Once all Required Changes are resolved and confirmed, implementation proceeds in these packages. Each package is independently testable with its own migrations, models, services, and tests.

---

### Package 01 — Product & BOM Foundation
**Scope:** Database migrations only. No services.
- Extend `products`: can_manufacture, can_disassemble, allow_negative_stock, cost_source, current_cost, **hybrid_purchase_cost, hybrid_recipe_cost** (RC-5)
- Extend `bills_of_materials`: version_number + partial unique index
- Extend `bill_of_material_lines`: input_product_id, sort_order, unit_id_snapshot
- Extend `orders`: preparing status + inventory_manufacturing_at
- Extend `inventory_receipt_layers`: source_type, manufacturing_transaction_id placeholder
- Extend `inventory_layer_consumptions`: consumption_type, transaction FKs
- Extend `stock_ledger_entries`: add disassembly movement types
- **Data migrations:** Populate version_number=1, input_product_id=raw_material_id, unit_id_snapshot, cost_source='manual', current_cost from existing cost fields

**Test:** All existing tests still pass. All new columns have correct defaults.
**Independent:** Yes. No new services depend on this.

---

### Package 02 — Recipe Engine (Pure Domain)
**Scope:** PHP service classes only. No new migrations.
- `RecipeEngine` service: resolveRecipe, hasActiveRecipe, getInputRequirements, calculateManufacturingCost, getRecoveredMaterials, validateRecipe, detectCyclicDependency, findRecipesContainingProduct
- `RecipeValidator` with all 12 validation rules
- Cyclic dependency detection (DFS)
- Copy-on-write versioning logic
- Unit validation (unit_id must match component product unit_id)

**Test:** 30+ unit tests. All pure PHP — no database required for most tests.
**Independent:** Depends on Package 01 (BOM schema).

---

### Package 03 — Cost Engine
**Scope:** New table + service.
- Migration: Create `product_cost_histories` table
- `CostEngine` service: updateFromGoodsReceipt, recalculateFromRecipe, cascadeRecipeCost, updateHybridCost
- All 4 cost sources + hybrid (RC-5 hybrid fields enable this)
- Cost cascade with visited-set protection (one level, Phase 1)
- Write to product_cost_histories on every cost change

**Test:** Unit tests for each cost source behavior. Integration test: GR posted → cost history entry created.
**Independent:** Depends on Package 01. Can run without Decision Engine.

---

### Package 04 — Decision Engine Infrastructure
**Scope:** New table + service scaffold.
- Migration: Create `decision_logs` table with `idempotency_key` (RC-6)
- `DecisionEngine` service: evaluate, log, dispatch
- `DecisionRule` interface
- Event value objects: OrderPreparingEvent, OrderReturnedEvent, GoodsReceiptPostedEvent, RecipeUpdatedEvent, ProcurementSchedulerTriggeredEvent
- Idempotency checking
- Rules for ORDER_PREPARING (MFG-000 through MFG-006) — manufacturing service is stubbed/mocked
- Rules for GOODS_RECEIPT_POSTED (COST-001 through COST-004 + PROC-001) — cost engine and queue service called directly
- Rules for RECIPE_UPDATED (COST-005 through COST-007)

**Test:** Unit tests for every rule in the decision matrix. Mock all downstream services. Integration test: event dispatched → decision log created with correct rule_id.
**Independent:** Depends on Packages 01, 02, 03.

---

### Package 05 — Manufacturing Engine
**Scope:** New tables + service.
- Migration: Create `manufacturing_transactions`, `manufacturing_consumptions`
- Apply UNIQUE constraint on manufacturing_transactions(order_line_id) WHERE status != 'failed' (RC-10)
- Apply deferred FKs to inventory_receipt_layers, inventory_layer_consumptions
- `ManufacturingService`: execute manufacturing transaction
- FIFO consumption using existing InventoryEngine (using FIFO layer costs — RC-3)
- Inventory receipt layer creation for finished product output
- Stock ledger entries for production_consumption, production_output

**Test:** Integration test requires real database (FIFO layers, inventory updates). Test complete flow: recipe → consumptions → output layer → cost.
**Independent:** Depends on Packages 01, 02, 04. Recipe Engine and Decision Engine must exist.

---

### Package 06 — Order → Manufacturing Integration
**Scope:** Wiring existing Orders module to Decision Engine.
- Add `preparing` status to `OrderStatus` enum
- Emit `ORDER_PREPARING` Laravel event when order status changes to preparing
- Decision Engine listener routes to ManufacturingService
- Queue job: `ProcessManufacturingJob` — wraps ManufacturingService for async execution (RC-9)
- Update `orders.inventory_manufacturing_at` on manufacturing completion

**Test:** End-to-end: Create order → set status to preparing → verify manufacturing_transaction created → verify inventory updated.
**Integration point:** First end-to-end test of the complete pipeline.

---

### Package 07 — Procurement Queue
**Scope:** New table + service.
- Migration: Create `procurement_queue_entries` with corrected net requirement formula (RC-7)
- `ProcurementQueueService`: recalculate, addShortfall, addInTransit, removeInTransit, markSatisfied
- Wire to: manufacturing failure → queue, GR posted → queue (via Decision Engine PROC-001)
- Debounce: recalculate at most once per 30 seconds per product (Phase 1 optimization)

**Test:** Integration test: manufacturing fails → queue entry created. GR posted → queue entry decremented.
**Independent:** Depends on Packages 01, 04, 05.

---

### Package 08 — Disassembly Engine
**Scope:** New tables + service + Returns integration stub.
- Migration: Create `disassembly_transactions`, `disassembly_recoveries`
- Add `return_id UUID NULL` to `disassembly_transactions` (RC-4 placeholder)
- Add `disassembly_consumption`, `disassembly_output` to stock_ledger_entries
- `DisassemblyService`: execute disassembly
- Procurement queue recalculation OUTSIDE transaction (RC-8)
- Decision Engine rules DIS-001 through DIS-004 wired to DisassemblyService
- Stub `ORDER_RETURNED` event emission from a test harness (full Returns BC integration deferred)

**Test:** Integration test: fire ORDER_RETURNED event → disassembly_transaction created → raw materials restored in inventory.
**Independent:** Depends on Packages 01, 02, 04, 07.

---

### Package 09 — Procurement Scheduler
**Scope:** New tables + service + cron.
- Migration: Create `procurement_schedules`, `scheduler_runs`, `purchase_requests`
- **Replace JSONB snapshots with `scheduler_run_snapshots` table** (improvement from Section 10)
- Add UNIQUE constraint on purchase_requests(scheduler_run_id, product_id)
- `ProcurementSchedulerService`: full 8-step algorithm with snapshot isolation
- Advisory lock (with documented UUID→bigint conversion)
- Concurrency guard (PROC-010)
- Laravel scheduled command (runs every minute, checks run_times from procurement_schedules)

**Test:** Integration test: create schedule → trigger scheduler → verify scheduler_run created → verify purchase_requests created per product.
**Independent:** Depends on Packages 01, 07.

---

### Package 10 — GR → Cost + Queue Integration
**Scope:** Wiring existing Goods Receipt module to Decision Engine.
- Emit `GOODS_RECEIPT_POSTED` Laravel event when GR status changes to 'posted'
- Decision Engine listener routes to Cost Engine (COST-001 through COST-004)
- Decision Engine listener routes to Procurement Queue (PROC-001)
- Queue cost cascade job: `CostCascadeJob` dispatched after synchronous own-product cost update (RC-9 principle applied to cascade)
- addInTransit call when Purchase Order is created (wire to PO creation event)

**Test:** End-to-end: Post GR → verify product cost updated → verify cost_history entry created → verify queue recalculated.
**Independent:** Depends on Packages 01, 03, 04, 07.

---

### Package 11 — Returns Integration (Pending Returns BC Definition)
**Scope:** Blocked until Returns bounded context is designed (RC-4).
- Define Returns module schema
- Emit ORDER_RETURNED event from Returns module
- Wire ORDER_RETURNED to DisassemblyService (Package 08 already has the DisassemblyService)
- Integration test: complete return flow → disassembly

**Independent:** Depends on Package 08 and Returns BC definition.

---

## Implementation Package Summary

```
Package 01   Product & BOM Foundation       ← Start immediately after RC-1 through RC-10 resolved
Package 02   Recipe Engine                  ← Parallel with Package 01 (pure PHP)
Package 03   Cost Engine                    ← After Package 01
Package 04   Decision Engine Infrastructure ← After Packages 01, 02, 03
Package 05   Manufacturing Engine           ← After Package 04
Package 06   Order → Manufacturing Wire-up  ← After Package 05
Package 07   Procurement Queue              ← After Packages 01, 04, 05
Package 08   Disassembly Engine             ← After Packages 01, 04, 07
Package 09   Procurement Scheduler          ← After Packages 01, 07
Package 10   GR → Cost + Queue Wire-up      ← After Packages 01, 03, 04, 07
Package 11   Returns Integration            ← Blocked on Returns BC definition
```

**Dependency graph:**
```
01 ──────────┬────────────────────────────────────────────────────────────
             │
02 (parallel)┤
             │
             ▼
03 (Cost Engine)
             │
             ▼
04 (Decision Engine)
             │
        ┌────┴────────────────┐
        ▼                     ▼
05 (Mfg Engine)          07 (Queue)
        │                     │
        ▼                     │
06 (Order→Mfg Wire)    ───────┤
                               │
                       ┌───────┴──────┐
                       ▼              ▼
                  08 (Disasm)    09 (Scheduler)
                       │
                       ▼
                  10 (GR Wire)
                       │
                       ▼
                  11 (Returns) ← Blocked
```

---

## STOP

Architecture review complete.

**Decision: APPROVED WITH REQUIRED CHANGES**

10 Required Changes are listed above (RC-1 through RC-10). All 10 must be resolved in the architecture documents before Package 01 implementation begins.

The implementation packages define the complete implementation order. Each package is independently testable.

**Do not begin implementation until approval is received.**
