# Preparation OS — Business Workflow

**Document:** BUSINESS-WORKFLOW  
**Version:** 1.0  
**Status:** APPROVED — Engineering Design Phase  
**Date:** 2026-07-05  
**Task:** TASK-PREP-001  
**Parent:** PREPARATION-OS-BLUEPRINT.md

---

## 1. Complete Preparation Workflow

```
COMMERCE LAYER
  Orders confirmed + reserved
       │
       ▼
┌──────────────────────────────────────────────────────────────────────┐
│  STEP 1: WAVE CREATION                                               │
│  Actor: Planner / Preparation Supervisor                             │
│                                                                      │
│  1a. Select orders to include (filter by date, zone, channel)        │
│  1b. Validate: each order must be in `reserved` status               │
│  1c. Validate: no order already in an active wave                    │
│  1d. Set planning_date, warehouse, notes                             │
│  1e. System creates wave with status = 'draft'                       │
│  1f. System publishes: preparation.wave.created                      │
│  1g. System writes Timeline entry: "Wave created with N orders"      │
└──────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────────┐
│  STEP 2: PRODUCT DEMAND GENERATION                                   │
│  Actor: Planner (or automatic on wave creation if policy configured) │
│                                                                      │
│  2a. For each order in the wave → explode order lines                │
│  2b. Group by product_id; sum quantities                             │
│  2c. Create WaveItem per product: quantity_required = sum            │
│  2d. Update wave: products_count, total_units_required               │
│  2e. Wave status transitions: draft → planning                       │
│  2f. System writes Timeline entry: "Demand generated: N products"   │
└──────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────────┐
│  STEP 3: MATERIAL REQUIREMENTS ANALYSIS (MRP)                        │
│  Actor: System (triggered by planner or automatic post-demand)       │
│                                                                      │
│  For each WaveItem (product):                                        │
│  3a. Load active Recipe for product                                  │
│  3b. If no active Recipe → create exception type='missing_recipe'    │
│  3c. Multiply RecipeLine.quantity × WaveItem.quantity_required       │
│       (accounting for waste percentage)                              │
│  3d. Sum across all products per raw material                        │
│  3e. Compare against current available stock (live query)            │
│  3f. Calculate shortage_amount = max(0, required - available)        │
│  3g. Create MaterialRequirement records                              │
│  3h. If ANY shortage → set wave.shortage_detected = true             │
│  3i. If shortage → wave status: planning → shortage_blocked          │
│  3j. If no shortage → wave remains in planning; ready to start       │
│  3k. System publishes: preparation.shortage.detected (if shortage)   │
└──────────────────────────────────────────────────────────────────────┘
       │                              │
       │ No shortage                  │ Shortage detected
       │                              ▼
       │              ┌───────────────────────────────────────────────┐
       │              │  STEP 3A: SHORTAGE RESOLUTION                  │
       │              │  Actor: Planner + Procurement team             │
       │              │                                                │
       │              │  Option A: Create Purchase Request             │
       │              │    → Procurement creates and fulfills MR/PO   │
       │              │    → Stock arrives → Shortage resolved         │
       │              │                                                │
       │              │  Option B: Supervisor override (partial wave) │
       │              │    → Planner acknowledges shortage             │
       │              │    → Notes which products will be short        │
       │              │    → Marks shortage as resolved                │
       │              │    → Wave unblocked; preparation proceeds      │
       │              │    → Short items handled in Step 5             │
       │              │                                                │
       │              │  Once resolved:                                │
       │              │  → MaterialRequirement.resolved = true         │
       │              │  → Wave status: shortage_blocked → planning    │
       └──────────────►                                                │
                      └───────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────────┐
│  STEP 4: PRODUCTION REQUIREMENTS PLANNING (PRP)                      │
│  Actor: System (concurrent with MRP)                                 │
│                                                                      │
│  For each WaveItem (product):                                        │
│  4a. Check finished goods stock for this product                     │
│  4b. quantity_to_manufacture = max(0, required - available_finished) │
│  4c. Create ProductionRequirement record                             │
│  4d. If quantity_to_manufacture > 0:                                 │
│       → Create manufacturing job request (sent to Manufacturing OS)  │
│       → Link manufacturing_job_id to ProductionRequirement           │
│  4e. System publishes: manufacturing.job.requested (if required)     │
└──────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────────┐
│  STEP 5: SUPERVISOR APPROVAL (Optional per configuration)            │
│  Actor: Preparation Supervisor                                       │
│                                                                      │
│  5a. Supervisor reviews: material requirements, shortages, PRP       │
│  5b. Reviews assigned workers and stations                           │
│  5c. Approves wave (wave.approved_by, wave.approved_at set)          │
│  5d. If ManufacturingPolicy.require_wave_approval = false, skip      │
└──────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────────┐
│  STEP 6: START PREPARATION                                           │
│  Actor: Preparation Supervisor                                       │
│                                                                      │
│  6a. Assign workers and stations (optional at this point)            │
│  6b. System generates PickList with all WaveItems                    │
│  6c. PickListItems include: product, qty, zone, shelf location       │
│  6d. Wave status: planning → preparing                               │
│  6e. Wave.started_at, Wave.started_by set                            │
│  6f. PickList status: pending                                         │
│  6g. System publishes: preparation.wave.started                      │
│  6h. System writes Timeline: "Preparation started by {name}"         │
│  6i. EPS-04 notifies: Creator + assigned workers                     │
└──────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────────┐
│  STEP 7: WAREHOUSE EXECUTION (PICKING)                               │
│  Actor: Warehouse Operator (floor)                                   │
│                                                                      │
│  The warehouse team works the PickList as a unit — not order by order│
│                                                                      │
│  7a. Operator accesses PickList on mobile/tablet                     │
│  7b. For each product on the PickList:                               │
│       → Navigate to zone + shelf location                            │
│       → Collect required quantity                                    │
│       → Record picked quantity (quantity_picked)                     │
│  7c. System updates WaveItem.quantity_prepared in real-time          │
│  7d. WaveItem status changes:                                         │
│       → pending → in_progress (first unit recorded)                  │
│       → in_progress → prepared (quantity_picked = quantity_required) │
│       → in_progress → short (picker confirms cannot complete)        │
│  7e. PickListItem status mirrors WaveItem status                     │
└──────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────────┐
│  STEP 8: QUALITY CHECK (Optional per configuration)                  │
│  Actor: Quality Checker                                              │
│                                                                      │
│  8a. Quality checker reviews prepared products at QC station         │
│  8b. Marks each product: passed / failed                             │
│  8c. If failed: PreparedProductsPool.quality_status = 'failed'       │
│       → Exception raised: type = 'quality_failed'                    │
│       → Supervisor notified; must re-prepare or approve exception    │
└──────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────────┐
│  STEP 9: COMPLETE WAVE                                               │
│  Actor: Preparation Supervisor                                       │
│                                                                      │
│  Pre-conditions checked by system:                                   │
│  9a. All WaveItems are in 'prepared' or 'short' status (none pending)│
│  9b. No WaveItems in 'blocked' status                                │
│                                                                      │
│  On completion:                                                       │
│  9c. For each WaveItem with quantity_prepared > 0:                   │
│       → Create PreparedProductsPool entry (idempotent)               │
│       → quantity_available = quantity_prepared                        │
│       → quality_status = 'pending_review' (default)                  │
│       → prepared_at = now()                                           │
│       → Create PoolMovement: type = 'created'                        │
│  9d. Wave.status → completed                                         │
│  9e. Wave.completed_at, Wave.completed_by set                        │
│  9f. System publishes: preparation.wave.completed                    │
│  9g. System publishes: preparation.pool.updated (per product)        │
│  9h. Timeline: "Wave completed. N products in Prepared Pool."        │
│  9i. Loading OS is notified via event                                │
└──────────────────────────────────────────────────────────────────────┘
       │
       ▼
 Prepared Products Pool
 (Loading & Allocation OS reads from here)
```

---

## 2. Wave Cancellation Workflow

```
Any wave status except 'completed'
       │
       ▼ [Cancel command with reason]
┌──────────────────────────────────────────────────────────┐
│  CANCELLATION PROCESS                                    │
│                                                          │
│  1. Validate wave is not completed                       │
│  2. If wave was in 'preparing':                          │
│     → Publish: preparation.wave.cancelled               │
│     → Fulfillment module returns orders to 'reserved'   │
│     → Material reservations released via event           │
│  3. Wave.status → cancelled                             │
│  4. Wave.cancelled_at, Wave.cancelled_by, reason set     │
│  5. Timeline: "Wave cancelled by {name}. Reason: {text}" │
│  6. Workers released from assignment                     │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Shortage Exception Workflow (Detail)

```
MRP detects shortage
       │
       ▼
┌──────────────────────────────────────────────────────────┐
│  1. MaterialRequirement.shortage = true                  │
│  2. MaterialRequirement.shortage_amount set              │
│  3. PreparationException created:                        │
│     type = 'shortage', severity = 'blocking'             │
│  4. Wave.shortage_detected = true                        │
│  5. Wave.status → shortage_blocked                       │
│  6. Notification → Planner + Procurement team            │
│  7. preparation.shortage.detected event published        │
└──────────────────────────────────────────────────────────┘
       │
       ├── Procurement path:
       │   → Purchase Request created
       │   → PO created and fulfilled
       │   → Stock arrives → GoodsReceipt posted
       │   → inventory.raw_material.stock_added event received
       │   → MRP re-run → shortage resolved
       │   → Wave status → planning
       │
       └── Override path (supervisor):
           → Supervisor reviews and approves partial preparation
           → MaterialRequirement.resolved = true
           → Exception.status → resolved
           → Wave.shortage_detected remains true (recorded)
           → Wave.status → planning (unblocked)
           → Preparation continues with known shortage
           → Short products recorded in WaveItems
```

---

## 4. Prepared Products Pool Handoff

```
Wave Completed
       │
       ▼
Prepared Products Pool entries created
       │
       ▼
Loading & Allocation OS triggers:
       │
       │ 1. Vehicle Planning Engine calculates vehicles needed
       │ 2. Shipping Wave created
       │ 3. Pool entries reserved (quantity_reserved increases)
       │    → PoolMovement: type = 'reserved'
       │
       ▼
Loading Session opens:
       │ 4. Products physically loaded onto vehicle
       │ 5. Pool entry: quantity_available -, quantity_loaded +
       │    → PoolMovement: type = 'loaded'
       │
       ▼
Vehicle dispatched
(Preparation OS has no further involvement)
```

---

## 5. Exception Workflow (General)

```
Exception Type      | Severity  | Auto-Block Wave? | Required Action
--------------------|-----------|-----------------|-------------------------------
shortage            | blocking  | Yes             | Procurement or supervisor override
quality_failed      | blocking  | No (item only)  | Re-prepare or exception close
missing_recipe      | blocking  | No (item only)  | Engineering: add recipe
worker_unavailable  | warning   | No              | Reassign or proceed with fewer workers
equipment_failure   | blocking  | Yes (if only station) | Repair or alternate station
quantity_variance   | warning   | No              | Supervisor reviews and closes
```

---

## 6. Key Decision Points

| Decision | Who Decides | How |
|---|---|---|
| Which orders to include in a wave | Planner | Manual selection + filters |
| Whether to override a shortage | Preparation Supervisor | Override action with permission |
| Whether to approve a wave before start | Policy (ManufacturingPolicy.require_wave_approval) | Configured; not hardcoded |
| Whether to allow overprepare | Policy (ManufacturingPolicy.allow_overprepare) | Configured tolerance% |
| Quality check required before pool | Policy (FulfillmentPolicy.require_pool_quality_check) | Configured |
| Maximum orders per wave | Configuration (preparation.wave.max_size) | Configured per company |

---

## 7. Validation Invariants

| Invariant | Where Enforced |
|---|---|
| Wave must have ≥ 1 order | Application + DB (orders_count > 0 before status advance) |
| Each order in at most 1 active wave | Application (query check) + DB UNIQUE per wave+order |
| quantity_prepared ≤ quantity_required × (1 + overprepare_tolerance) | Application (from ManufacturingPolicy) |
| Wave completion requires all items complete | Application gate in CompleteWaveAction |
| Pool entry quantity_available ≥ 0 always | DB CHECK constraint |
| Completed wave cannot be cancelled | Application (state machine guard) |
| Pool write is idempotent | Application (UPSERT or check-then-insert) |
