# ECOS ERP — Procurement Intelligence Specification

**Document:** PROCUREMENT-INTELLIGENCE-SPEC  
**Version:** 1.0  
**Task:** TASK-MFG-SPEC-001  
**Status:** Draft — Awaiting Approval  
**Date:** 2026-06-29  
**Scope:** Procurement Queue, Net Requirement, Scheduler, Purchase Request, Purchase Order workflow, Goods Receipt integration

---

## Overview

Procurement Intelligence is the mechanism by which ECOS ERP converts material shortages — discovered during manufacturing — into consolidated, accurate purchase documents. It is the antithesis of traditional ERP procurement: instead of one purchase request per order, the system maintains a living net requirement and generates purchase documents only after full recalculation.

**Core Principle:** Never generate a purchase document from stale data. Always recalculate.

---

## 1. Procurement Queue

### 1.1 Definition

The Procurement Queue is a **live materialized state** representing the system's current net requirement for each product. It is not a document. It has no approval workflow. It is not shown to users as a list of items to action — it is an internal system calculation that feeds the Scheduler.

The Queue answers one question at any moment: *"How much of each product does the system need to purchase right now, net of all known sources?"*

### 1.2 Queue Entry

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | |
| `product_id` | UUID | One row per product. Primary key behavior. |
| `net_required_quantity` | Decimal | Current net requirement. Can be 0 (satisfied). Never negative. |
| `unit_id` | UUID | The product's unit |
| `last_recalculated_at` | Timestamp | When this entry was last recomputed |
| `is_satisfied` | Boolean | True when net_required_quantity ≤ 0 |
| `contributing_sources` | JSON array | List of {type, id, quantity} — orders/returns/shortfalls driving the need |

### 1.3 Net Requirement Formula

The formula is **always calculated from current state** at the moment of recalculation (RC-9). It never accumulates shortages from history — it reads live data every time.

```
net_required_quantity(product_id, company_id) =
    gross_demand(product_id, company_id)
  - available_inventory(product_id, company_id)
  - in_transit_quantity(product_id, company_id)

where:
  gross_demand =
      SUM(required_raw_material_qty for all unfulfilled manufacturing demands)
    + SUM(direct_purchase_demand for non-manufactured products with shortfall)
    // Sources: open orders in 'preparing' state where manufacturing failed,
    //          and any manually registered demand

  available_inventory =
      SUM(InventoryItem.on_hand_qty - InventoryItem.reserved_qty)
      across all warehouses in company_id
    // This ALREADY includes all posted GRs and all completed disassembly recoveries.
    // There is no separate 'recovered_quantity' term — recoveries are part of on_hand_qty
    // the moment they are posted to inventory.

  in_transit_quantity =
      SUM(open PO line quantities not yet received)
    // Open PO = status NOT IN ('received', 'cancelled')

  result = max(0, gross_demand - available_inventory - in_transit_quantity)
```

If `result ≤ 0`: entry is marked `is_satisfied = true`.

**Why no separate `recovered_quantity` term:** Disassembly recoveries and Goods Receipts both post to inventory immediately when executed. Their quantities appear in `InventoryItem.on_hand_qty` within the same transaction. Subtracting them again as a separate `recovered_quantity` field would double-count them. The formula uses `available_inventory` as the single source of truth for what is currently on hand.

**Recalculation triggers:** The queue entry for a product is recalculated (this formula run fresh) when:
- Manufacturing fails with FAIL_STOCK_SHORTAGE or MANUFACTURE_WITH_SHORTAGE (adds to gross_demand picture)
- Goods Receipt posted for this product (increases available_inventory → may clear requirement)
- Purchase Order created for this product (increases in_transit_quantity → reduces net requirement)
- Disassembly completed for a recipe that uses this product as a component (increases available_inventory)
- Order cancelled that was in 'preparing' state (reduces gross_demand)

### 1.4 Queue Update Triggers

The queue is recalculated for the relevant product(s) whenever any of these events occur:

| Trigger | Affected Products | Action |
|---------|-----------------|--------|
| Manufacturing fails with FAIL_STOCK_SHORTAGE | Raw material product(s) with shortfall | Increase net requirement |
| Manufacturing executes with MANUFACTURE_WITH_SHORTAGE | Raw material product(s) with shortfall | Increase net requirement for the shortfall |
| Goods Receipt posted | Received product | Decrease net requirement |
| Purchase Order created | Ordered product | Decrease net requirement (in-transit) |
| Order cancelled (was in preparing state) | All raw material products for that order's recipe | Decrease gross demand |
| Disassembly completed | Recovered raw material products | Decrease net requirement |
| Manufacturing completed successfully | Raw material products used | Net requirement already satisfied (consumed from stock) |

### 1.5 Queue Aggregation

The Procurement Queue always shows the **total requirement across all unfulfilled demands**, not per-order requirements.

**Example:**

```
Order #1001: needs 2 Kg Raw Honey (manufacturing failed — shortage)
Order #1002: needs 3 Kg Raw Honey (manufacturing failed — shortage)
Order #1003: needs 1 Kg Raw Honey (manufacturing failed — shortage)

Current on_hand inventory: 0.5 Kg Raw Honey
Open PO: 2 Kg Raw Honey (in transit)

Queue Entry for Raw Honey:
  gross_demand         = 6 Kg
  available_inventory  = 0.5 Kg
  in_transit           = 2 Kg
  recovered            = 0 Kg
  net_required         = max(0, 6 - 0.5 - 2 - 0) = 3.5 Kg

contributing_sources = [
  {type: "order", id: "1001", quantity: 2},
  {type: "order", id: "1002", quantity: 3},
  {type: "order", id: "1003", quantity: 1}
]
```

### 1.6 Queue Upsert Rules

The Queue maintains **one entry per product per company**. When any triggering event occurs, the full net requirement is recalculated from scratch (not accumulated).

```
recalculate(product_id, company_id, trigger_source):

  // Compute all three inputs from live data
  gross   = computeGrossDemand(product_id, company_id)
  avail   = computeAvailableInventory(product_id, company_id)
  transit = computeInTransit(product_id, company_id)
  net_qty = max(0, gross - avail - transit)

  existing = ProcurementQueue.findByProduct(product_id, company_id)

  if existing:
    existing.gross_demand_quantity  = gross
    existing.available_quantity     = avail
    existing.in_transit_quantity    = transit
    existing.net_required_quantity  = net_qty
    existing.is_satisfied           = (net_qty <= 0)
    existing.last_recalculated_at   = now()
    existing.save()
  else if net_qty > 0:
    ProcurementQueue.create(product_id, company_id, gross, avail, transit, net_qty)
  // If net_qty = 0 and no existing entry: no-op (nothing to add)
```

The `contributing_sources` JSONB field is maintained as a capped audit reference (max 200 entries). It is informational only — the actual net requirement comes from the formula above, not from summing contributing sources.

### 1.7 Queue Cleanup

An entry is marked `is_satisfied = true` when net_required_quantity ≤ 0. It is **not deleted**. Satisfied entries are excluded from the next Scheduler run.

Entries are permanently removed only when:
- The product is deleted/archived (cascade delete)
- An admin manually resets the queue (emergency operation, logged)

---

## 2. Procurement Scheduler

### 2.1 Definition

The Procurement Scheduler is a background service that runs at company-defined time slots. Its job is to take a full snapshot of current procurement state, perform a complete recalculation of net requirements, and generate Purchase Requests for items that still have unmet demand.

**The Scheduler never creates Purchase Requests from the live queue directly.** It always recalculates from scratch at run time.

### 2.2 Schedule Configuration

Each company configures its own schedule:

| Field | Type | Description |
|-------|------|-------------|
| `company_id` | UUID | One active schedule per company |
| `run_times` | Array of HH:MM | When to run (e.g. ["10:00", "15:00", "20:00"]) |
| `timezone` | String | IANA timezone (e.g. "Asia/Cairo") |
| `is_active` | Boolean | Can be suspended |
| `last_run_at` | Timestamp | |
| `next_run_at` | Timestamp | Computed after each run |

### 2.3 Scheduler Execution Algorithm

```
ProcurementScheduler.execute(company_id):

  STEP 1 — Acquire concurrency lock
    lock = acquireLock('procurement_scheduler', company_id, ttl: 30m)
    if lock failed:
      log Decision: SKIP_CONCURRENT_RUN
      return

  STEP 2 — Create SchedulerRun record
    run = SchedulerRun.create({
      schedule_id:  schedule.id,
      started_at:   now(),
      status:       'running'
    })

  STEP 3 — Snapshot current state
    run.inventory_snapshot     = InventoryEngine.getAllStockLevels(company_id)
    run.open_po_snapshot       = PurchasingEngine.getOpenPOQuantities(company_id)
    run.queue_snapshot         = ProcurementQueue.getAll(company_id)
    run.save()

  STEP 4 — Recalculate net requirements per product
    requirements = []
    for each product with on_hand < 0 OR in procurement queue:
      net_qty = calculateNetRequirement(product_id, run.snapshot)
      if net_qty > 0:
        requirements.add({ product_id, net_qty, contributing_sources })

  STEP 5 — Merge by product
    (requirements are already one entry per product — no additional merging)

  STEP 6 — Generate Purchase Requests
    purchase_requests = []
    for each requirement in requirements:
      pr = PurchaseRequest.create({
        scheduler_run_id:    run.id,
        product_id:          requirement.product_id,
        required_quantity:   requirement.net_qty,
        unit_id:             requirement.unit_id,
        suggested_supplier_id: Product.getDefaultSupplier(requirement.product_id),
        period_start:        schedule.last_run_at,
        period_end:          now(),
        affected_order_count: requirement.contributing_sources.count,
        reason_summary:      buildReason(requirement),
        status:              'pending'
      })
      purchase_requests.add(pr)

  STEP 7 — Finalize run
    run.completed_at             = now()
    run.status                   = 'completed'
    run.purchase_requests_created = purchase_requests.count
    run.requirements_cleared      = (requirements with net_qty = 0).count
    run.save()

  STEP 8 — Release lock
    releaseLock(lock)
```

### 2.4 Scheduler Safety Rules

| Rule | Description |
|------|-------------|
| **No partial execution** | If Step 6 fails for any product, the entire run is rolled back. `status = failed`. No PRs are created. |
| **No duplicate PRs** | Before creating a PR, check: does a `pending` PR already exist for this product within the same period? If yes, update the quantity rather than creating a new PR. |
| **No action on zero net requirement** | If net_required_quantity = 0 for all products, no PRs are created. The SchedulerRun record is still written. |
| **Snapshot isolation** | The scheduler uses the snapshot from Step 3. Late-arriving events (e.g., a goods receipt posted during the run) do not affect this run — they are picked up in the next run. |
| **Concurrency lock** | Only one scheduler run per company at a time. |

### 2.5 SchedulerRun Record

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | |
| `schedule_id` | UUID | |
| `started_at` | Timestamp | |
| `completed_at` | Timestamp\|null | |
| `status` | Enum | `running` / `completed` / `failed` |
| `inventory_snapshot` | JSON | Stock levels at run time |
| `open_po_snapshot` | JSON | Open PO quantities at run time |
| `queue_snapshot` | JSON | Procurement queue state at run time |
| `purchase_requests_created` | Integer | |
| `requirements_cleared` | Integer | Products with net = 0 |
| `error_message` | Text\|null | Set if status = failed |

---

## 3. Purchase Request

### 3.1 Definition

A Purchase Request is a system-generated document created by the Procurement Scheduler. It represents the recommendation to purchase a specific quantity of a product.

Purchase Requests are **not** created by users or by individual orders. They are the consolidated output of the Scheduler's analysis.

### 3.2 Purchase Request Attributes

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | |
| `pr_number` | String | Auto-generated, human-readable (e.g. PR-2026-001) |
| `scheduler_run_id` | UUID | Which scheduler run created this |
| `product_id` | UUID | |
| `unit_id` | UUID | |
| `required_quantity` | Decimal | Net requirement as calculated by scheduler |
| `suggested_supplier_id` | UUID\|null | Product's default supplier, if any |
| `period_start` | Timestamp | Start of demand period (previous scheduler run) |
| `period_end` | Timestamp | End of demand period (this scheduler run) |
| `affected_order_count` | Integer | Number of orders driving this demand |
| `reason_summary` | Text | Human-readable summary (e.g. "28 orders require 35 Kg Raw Honey") |
| `status` | Enum | `pending` / `converted_to_po` / `cancelled` |
| `converted_po_id` | UUID\|null | Set when converted to PO |
| `cancelled_reason` | Text\|null | Required when status = cancelled |
| `created_at` | Timestamp | |

### 3.3 Purchase Request Lifecycle

```
[Scheduler creates PR]
        │
        ▼
   ┌─────────┐
   │ pending │ ◄── Default state after creation
   └────┬────┘
        │
   ┌────┴────────────────┐
   │                     │
   ▼                     ▼
┌──────────────┐    ┌───────────┐
│converted_to  │    │cancelled  │
│     _po      │    │           │
└──────────────┘    └───────────┘
```

### 3.4 Purchase Request Display

The Purchase Department sees Purchase Requests grouped by:
1. Product
2. Urgency (based on number of affected orders and period)
3. Suggested supplier

From the PR list, the purchasing team creates Purchase Orders with one click per request (or selects multiple PRs for the same supplier and creates one PO).

---

## 4. Purchase Order Workflow

The Purchase Order workflow is **not changed** by this specification. The existing Purchasing module handles PO → GoodsReceipt. Procurement Intelligence integrates at the entry point:

```
Purchase Request (NEW — Procurement Intelligence)
    ↓ Purchasing team: "Create PO" (one click)
Purchase Order (EXISTING — Purchasing module)
    ↓ Supplier delivers
Goods Receipt — draft (EXISTING)
    ↓ Receiving team posts receipt
Goods Receipt — posted (EXISTING)
    ↓ Triggers:
    ├── Inventory update (EXISTING)
    ├── Cost Engine update (NEW — via Decision Engine)
    └── Procurement Queue recalculation (NEW)
```

### 4.1 PR → PO Conversion

When a Purchase Request is converted to a Purchase Order:
1. `PurchaseRequest.status → converted_to_po`
2. `PurchaseRequest.converted_po_id = new_po.id`
3. PO is created with line item for the PR product and quantity
4. Suggested supplier is pre-filled if available

The PR is **not deleted** after conversion — it remains as the justification document.

---

## 5. Goods Receipt Integration

### 5.1 On GoodsReceipt Posted

When a GoodsReceipt changes status to `posted`:

```
For each GoodsReceiptLine:
  1. InventoryEngine.receiveStock(product_id, quantity, warehouse_id, landed_unit_cost)
     → Creates FIFO receipt layer
     → Updates InventoryItem.on_hand_qty
  
  2. Decision Engine receives GOODS_RECEIPT_POSTED event
     → Applies Cost Engine rules (see DECISION-ENGINE-SPEC §3.3)
  
  3. ProcurementQueueService.recalculate(product_id)
     → Reduces net requirement by received quantity
     → Marks entry satisfied if net ≤ 0
```

### 5.2 In-Transit Tracking

When a Purchase Order is created:
```
ProcurementQueueService.addInTransit(product_id, po_quantity)
  → Reduces net_required_quantity immediately
  → This prevents the next scheduler run from generating duplicate PRs
```

When a GoodsReceipt is posted against that PO:
```
ProcurementQueueService.removeInTransit(product_id, received_quantity)
ProcurementQueueService.addReceived(product_id, received_quantity)
  → In-transit drops
  → On-hand increases
  → Net requirement recalculated from scratch
```

---

## 6. Cost Update on Goods Receipt

Described in detail in the Decision Engine spec (Section 3.3). Summary:

| Product Cost Source | Action on GR Posted |
|--------------------|---------------------|
| `manual` | No cost update |
| `purchase_invoice` | Update `current_cost` to `landed_unit_cost` from GR line |
| `recipe` | No cost update (cost comes from recipe only) |
| `hybrid` | Update `hybrid_purchase_cost` component |

Cost history is always written regardless of whether current_cost changes.

---

## 7. Error Scenarios

| Scenario | Detection Point | Response |
|----------|----------------|----------|
| Scheduler runs concurrently | Step 1 (lock acquisition) | Skip run, log SKIP_CONCURRENT_RUN |
| Scheduler fails mid-execution | Any step | Roll back all PRs created in this run. Set status = failed. Release lock. |
| No supplier available for PR | PR creation | Create PR without supplier. Flag as `needs_supplier`. |
| PR product no longer exists | PR creation | Skip product. Log warning. |
| Net requirement negative after recalculation | Step 4 | Treat as 0 (satisfied). Do not create PR. |
| Duplicate pending PR exists for same product+period | Step 6 | Update existing PR quantity instead of creating new one |
| GoodsReceipt posted for non-queue product | Cost Engine trigger | Process cost update normally. Skip queue update (no entry to update). |

---

## 8. Sequence Diagrams

### 8.1 Full Procurement Flow — Order to Goods Receipt

```
  Orders BC    Decision Engine   Manufacturing   Proc.Queue    Scheduler    Purchasing BC
      │               │               │               │             │             │
      │ ORDER_PREPARING               │               │             │             │
      │───────────────▶               │               │             │             │
      │               │               │               │             │             │
      │               │ MFG-006       │               │             │             │
      │               │ FAIL_SHORTAGE │               │             │             │
      │               │───────────────────────────────▶             │             │
      │               │               │  addShortfall(product, qty) │             │
      │               │               │               │             │             │
      │               │               │               │ [at 10:00]  │             │
      │               │               │               │─────────────▶             │
      │               │               │               │ snapshot()  │             │
      │               │               │               │◀────────────│             │
      │               │               │               │             │             │
      │               │               │               │             │ recalculate │
      │               │               │               │             │ netReq()    │
      │               │               │               │             │             │
      │               │               │               │             │ createPR()  │
      │               │               │               │             │─────────────▶
      │               │               │               │             │ PR #PR-001  │
      │               │               │               │             │◀────────────│
      │               │               │               │             │             │
      │               │               │               │             │ [user clicks "Create PO"]
      │               │               │               │             │             │
      │               │               │               │             │             │ PO created
      │               │               │               │             │             │──────────┐
      │               │               │               │             │             │          │
      │               │               │               │ addInTransit│             │          │
      │               │               │               │◀────────────────────────────────────│
      │               │               │               │             │             │          │
      │               │               │               │             │             │ [GR posted]
      │               │               │               │             │             │──────────┐
      │               │               │ GOODS_RECEIPT_POSTED event  │             │          │
      │               │◀───────────────────────────────────────────────────────────────────│
      │               │               │               │             │             │          │
      │               │ updateCost()  │               │             │             │          │
      │               │───────────────────────────────────────────▶ │             │          │
      │               │ recalcQueue() │               │             │             │          │
      │               │───────────────────────────────▶             │             │          │
```

### 8.2 Scheduler Execution

```
  Cron/Schedule   Proc.Scheduler   Proc.Queue   Inventory   Purchasing   Proc.Request
       │                │               │             │            │            │
       │ trigger()      │               │             │            │            │
       │───────────────▶│               │             │            │            │
       │                │ acquireLock() │             │            │            │
       │                │               │             │            │            │
       │                │ createRun()   │             │            │            │
       │                │               │             │            │            │
       │                │ snapshot()    │             │            │            │
       │                │───────────────────────────▶ │            │            │
       │                │◀─── stock levels ──────────│            │            │
       │                │────────────────────────────────────────▶ │            │
       │                │◀─── open PO quantities ─────────────────│            │
       │                │───────────────▶             │            │            │
       │                │◀─── queue entries ─────────│            │            │
       │                │               │             │            │            │
       │                │ recalculate net requirements (per product)            │
       │                │               │             │            │            │
       │                │ net_qty > 0?  │             │            │            │
       │                │ YES           │             │            │            │
       │                │─────────────────────────────────────────────────────▶│
       │                │               │             │            │ createPR() │
       │                │               │             │            │            │ PR created
       │                │               │             │            │            │──────────┐
       │                │               │             │            │            │          │
       │                │ finalizeRun() │             │            │            │          │
       │                │ releaseLock() │             │            │            │          │
       │◀───────────────│               │             │            │            │          │
```

---

## 9. Procurement Intelligence Constraints

| Constraint | Value |
|-----------|-------|
| Queue entries per company | One per product (not per order) |
| Scheduler runs per company | Maximum 1 concurrent |
| Scheduler run times per day | Unlimited (company configures) |
| PRs per scheduler run | One per product with net requirement > 0 |
| PR deduplication window | Same product + overlapping period = update existing PR |
| In-transit tracking | Per product per open PO line |
| Cost cascade depth | 1 level (Phase 1) |
| Queue recalculation scope | Per product (not global) |
| Historical PRs | Never deleted. Cancelled instead. |
