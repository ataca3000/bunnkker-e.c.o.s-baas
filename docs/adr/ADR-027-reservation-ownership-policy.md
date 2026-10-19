# ADR-027: Reservation Ownership Policy — v1.1

**Status:** Approved  
**Version:** v1.1  
**Date:** 2026-07-21  
**Author:** Engineering Architecture Review  
**Inputs:** TASK-RESERVATION-POLICY-AUDIT-001, TASK-RESERVATION-RUNTIME-TRACE-002, CTO Review  
**Supersedes:** ADR-027 v1.0 (2026-07-21)

---

## Revisions from v1.0 to v1.1

| Section | Change |
|---|---|
| Section 2 | Business Decision / Execution Requirement separated; architecture flowchart added |
| Section 4 | "Reservation ends at Preparing" removed; reservation now persists through Shipment |
| Section 5 | Preparation allocates (Reserved→Allocated→Picked); consumption belongs to Logistics |
| Section 8 | Three new states: Allocated, Picked, Loaded |
| Section 9 | Status matrix: reservation sub-state column; Logistics ownership row |
| Section 13 | P16 added; P06 updated |
| Section 14 | P06 → PARTIAL; P16 → PARTIAL; summary updated |

---

## Context

Two completed runtime investigations exposed structural inconsistencies in ECOS ERP's reservation system:

- **AUDIT-001** — Reservation logic fragmented across four modules with no formal ownership boundaries.
- **TRACE-002** — Runtime evidence of 9+ legacy orders in active status with no reservation and no warehouse; two production-level bugs confirmed in `DirectIssueStockAction` and `AnalyzeMaterialsAction`.
- **CTO Review** — Two conceptual clarifications: (1) the business decision to reserve precedes the ability to execute it; (2) reservation must survive the full operational pipeline until inventory physically leaves the warehouse.

This ADR is the single authoritative policy governing all inventory reservation decisions. Where any existing code conflicts with this ADR, the code must be refactored to comply.

---

## Section 1 — Reservation Ownership

**Decision: The Orders Module is the sole owner of all reservation lifecycle decisions.**

| Responsibility | Owner | Class / Table |
|---|---|---|
| Decide when to reserve (Business Decision) | Orders Module | Triggered by order entering active status |
| Decide whether to reserve (Execution) | Orders Module | `ReserveOrderInventoryAction` (3-case logic) |
| Execute stock mutation | Inventory Module | `ReserveStockAction` → `stock_ledger_entries` |
| Track reservation state | Orders Module | `orders.reservation_status`, `order_reservation_audits` |
| Track line-level reserved qty | Orders Module | `order_lines.reserved_qty` |
| Allocate reservation to wave | Preparation Module | Transitions Reserved → Allocated |
| Progress through picking and loading | Preparation / Logistics | Transitions Allocated → Picked → Loaded |
| Consume reservation at shipment | Logistics / Inventory | Inventory exits warehouse → Consumed |
| Release reservation (cancel) | Orders Module | `ReleaseOrderInventoryAction` |

The Inventory Module is a **pure executor**: it applies mutations, writes ledger entries, emits events. It never evaluates business policy.

The Manufacturing Module has **no reservation authority**. It responds to the reservation that Orders has already committed.

---

## Section 2 — Reservation Start Point

**Decision: The Business Decision to reserve is separate from the Execution Requirement. The decision is immediate; the execution is conditional.**

### Business Decision

The system makes the reservation decision the moment an order enters any active commercial state:

- Pending
- Awaiting Payment
- Confirmed
- Processing

The business decision is: *"This order should reserve inventory."* This decision is recorded immediately. It is not contingent on warehouse availability.

### Execution Requirement

Reservation can only be physically executed when `assigned_warehouse_id` is present. If warehouse is missing at the moment of the decision:

- Reservation Decision: **active** (intent recorded)
- Reservation Execution: **postponed**
- `reservation_status` remains `pending` — meaning: *decision made, execution pending*

As soon as a `WarehouseAssigned` event fires for the order, execution must automatically retry.

### Architecture Flow

```mermaid
flowchart TD
  A["Order Enters Active Status
  Pending / Awaiting Payment
  Confirmed / Processing"] --> B{"Business Decision
  This order SHOULD reserve"}
  B --> C{"Execution Requirement
  Warehouse Assigned?"}
  C -->|YES| D["Reserve Inventory
  reservation_status = reserved"]
  C -->|NO| E["Pending Reservation
  reservation_status = pending
  Decision active — execution postponed"]
  E --> F["WarehouseAssigned Event
  Automatic Retry"]
  F --> C
  D --> G["Wave Allocation
  sub_status = allocated"]
  G --> H["Picking
  sub_status = picked"]
  H --> I["Loading
  sub_status = loaded"]
  I --> J["Shipment
  Inventory Exits Warehouse"]
  J --> K["Consumed — TERMINAL"]
  D -->|"Order Cancelled"| L["Released — TERMINAL"]
  G -->|"Order Cancelled"| L
  H -->|"Order Cancelled"| L
  I -->|"Order Cancelled"| L
```

### Trigger Events

| # | Trigger | Current State | Required Action |
|---|---|---|---|
| 1 | Order creation — warehouse already assigned | **Exists** | Auto-reserve in `CreateManualOrderAction` |
| 2 | Warehouse assignment resolves for existing order | **Missing** | New: `WarehouseAssigned` event → reservation retry listener |
| 3 | New stock arrives for product with `awaiting_stock` orders | **Missing** | New: `StockReceived` event → reservation retry queue job |

Reservation is **non-blocking**. It never prevents order progression. If stock is unavailable, the order transitions to `awaiting_stock` and the status pipeline continues.

| Order Status | Business Decision | Execution Condition |
|---|---|---|
| Pending | YES — reserve intent active | On warehouse assignment |
| Awaiting Payment | YES | On warehouse assignment |
| Confirmed | YES | On warehouse assignment or at confirmation workflow |
| Processing | YES | On warehouse assignment or at processing workflow |
| Preparing | Inherited | Reservation already executed; lifecycle continues |
| Ready / Shipped / Delivered | N/A | Post-reservation stages |
| Cancelled | N/A | Release, not reserve |

---

## Section 3 — Reservation Dependency

**Decision: Reservation depends ONLY on Finished Good (FG) availability. Raw material availability is irrelevant at reservation time.**

Reservation is a commercial commitment. Manufacturing is the operational mechanism that delivers on it. These are separate concerns.

**FG Availability Formula (universal, non-negotiable):**

```
available = on_hand_qty − reserved_qty
```

**Reservation Decision Tree:**

| Condition | Case | Reservation Action | Physical Lock |
|---|---|---|---|
| `available ≥ requested_qty` | Case 1 — Standard | Physical reservation via `ReserveStockAction` | YES |
| `can_manufacture = true` | Case 2 — Manufacturing | Logical commit — full qty reserved, zero physical lock | NO |
| `allow_negative_stock = true` AND `available = 0` | Case 3 — Negative Stock | Logical commit — OH will go negative at shipment | NO |
| None of the above | Case 4 — Awaiting | `reservation_status = awaiting_stock` | NO |

---

## Section 4 — Manufacturing Responsibility

**Manufacturing starts at:** `MoveToPreparationWorkflow` → `PrepareOrderManufacturingAction`

**Reservation persists through the entire operational pipeline.** It is not consumed when an order enters Preparing status, nor when manufacturing begins. Reservation is consumed exclusively when inventory physically exits the warehouse at shipment.

| Layer | Module | Class | Responsibility |
|---|---|---|---|
| Decision | Commerce/Orders | `ReserveOrderInventoryAction` | Decides whether and how to reserve |
| Execution | Inventory | `ReserveStockAction` | Applies the stock mutation |
| Execution | Inventory | `DirectIssueStockAction` | Decrements OH at shipment (consumes reservation) |
| Audit | Inventory | `stock_ledger_entries` | Immutable mutation log |
| Trigger | Operations/Preparation | `PrepareOrderManufacturingAction` | Decides if production is needed |
| RM Analysis | Operations/Preparation | `AnalyzeMaterialsAction` | Evaluates RM availability (must use OH − RES) |

Manufacturing **never** modifies `orders.reservation_status`. It reads the reservation as given and produces finished goods against the committed quantity.

---

## Section 5 — Preparation Responsibility

**Preparation allocates reservations to waves and tracks picking progress. It does not consume or release reservations. Consumption belongs to Logistics at shipment.**

**Preparation OWNS:**
- Wave lifecycle (planning → allocation → picking → pooling → loading)
- RM availability analysis via `AnalyzeMaterialsAction` (must read `on_hand − reserved`)
- Manufacturing triggers
- Transitioning reservation: `Reserved → Allocated` when wave is assigned
- Transitioning reservation: `Allocated → Picked` when items are physically collected
- Pick list generation against reserved/allocated stock

**Preparation MUST NEVER:**
- Call `ReserveOrderInventoryAction` or `ReserveStockAction`
- Consume or release reservations (`reserved_qty` decrement belongs to Logistics/Shipment)
- Include orders with `reservation_status = pending` in a wave
- Bypass the Orders reservation state machine

---

## Section 6 — Negative Stock Policy

**Decision: For `allow_negative_stock = true` products, the system must execute every stage including issuance that takes `on_hand_qty` below zero.**

| Stage | Current Behaviour | Official Policy | Gap |
|---|---|---|---|
| Reservation (avail > 0) | Physical reservation | APPROVED | None |
| Reservation (avail = 0, allow_neg) | Case 3: logical commit | APPROVED | None |
| Shipment (DirectIssue) | Throws `InsufficientStockException` | Must proceed; OH goes negative | **CRITICAL BUG** |
| Inventory (OH) | Blocked before negative | `on_hand_qty` may be negative | **CRITICAL BUG** |
| Ledger | No entry (blocked) | Ledger entry with negative qty | **CRITICAL BUG** |

**Approved flow for allow_negative_stock=true:**

```
Reservation: reserved_qty += qty, on_hand UNCHANGED, reservation_status = reserved
  ↓ [Allocation] → [Picking] → [Loading] → reservation_status stays 'reserved'
  ↓
At Shipment (DirectIssueStockAction):
  Check products.allow_negative_stock
  If TRUE  → proceed; on_hand_qty -= qty (may go negative); ledger entry written; reservation consumed
  If FALSE → throw InsufficientStockException (existing behaviour, correct)
```

---

## Section 7 — Inventory Quantities

| Quantity | Definition | Column | Changes When |
|---|---|---|---|
| On Hand | Physical units confirmed present in warehouse | `inventory_items.on_hand_qty` | Receiving (+), Issuing (−), Adjustment (±) |
| Reserved | Units committed to unfulfilled orders | `inventory_items.reserved_qty` | Reservation (+), Release (−), Consumed at shipment (−) |
| Available | What can be promised to new orders | *Computed — no column* | Derived: `on_hand_qty − reserved_qty` |
| Allocated | Reserved units assigned to a specific wave | Wave allocation tables | Wave assignment (+), completion/cancel (−) |
| In Production | Units in open manufacturing orders | Production tables | Production open (+), completed (→ OH) |
| In Transit | Units on open inbound POs | PO tables | PO issued (+), received (→ OH) |

**Mathematical relationships:**

```
available        = on_hand_qty − reserved_qty
net_available    = available + in_transit_qty + in_production_qty
soft_committed   = reserved_qty         (all unfulfilled orders)
hard_committed   = allocated_qty        (wave-assigned subset)
uncommitted      = available − allocated_qty
```

---

## Section 8 — Reservation States

**Ten states (seven reservation states + three operational sub-states). Two terminal. No backward transitions. Every change requires an audit entry.**

> Note: Allocated, Picked, and Loaded are operational sub-states within the broader `reserved` ownership. The `inventory_items.reserved_qty` does not change during these transitions — only the operational tracking state changes.

```mermaid
stateDiagram-v2
  [*] --> Pending : Order Created\n(no warehouse / active status)
  Pending --> Reserved : WH Assigned\n+ Stock Available
  Pending --> PartialReserved : WH Assigned\n+ Partial Stock
  Pending --> AwaitingStock : WH Assigned\n+ No Stock
  Reserved --> Allocated : Wave Assigned\n(Preparation Module)
  Allocated --> Picked : Items Collected\n(Preparation Module)
  Picked --> Loaded : Loaded to Vehicle\n(Logistics Module)
  Loaded --> Consumed : Inventory Exits\nWarehouse
  Consumed --> [*]
  PartialReserved --> Reserved : Remaining Stock Arrives
  PartialReserved --> Released : Order Cancelled
  AwaitingStock --> Reserved : New Stock Arrives
  AwaitingStock --> PartialReserved : Partial Stock Arrives
  AwaitingStock --> Released : Order Cancelled
  Reserved --> Transferred : Warehouse Reassignment
  Transferred --> Reserved : Confirmed in New Warehouse
  Reserved --> Released : Order Cancelled
  Allocated --> Released : Order Cancelled
  Picked --> Released : Order Cancelled
  Loaded --> Released : Order Cancelled
  Released --> [*]
```

**State Reference:**

| State | Business Meaning | Owner | Entry Rule | Exit Rule |
|---|---|---|---|---|
| **Pending** | Decision made; execution postponed (no warehouse) | Orders Module | Initial state; warehouse not assigned | WH assigned → retry execution |
| **Reserved** | Commercial commitment; stock physically locked | Orders Module | All lines: `reserved_qty = quantity` | Wave → Allocated; Cancel → Released |
| **Partial Reserved** | Some lines or partial qty reserved | Orders Module | ≥1 line with `reserved_qty < quantity` | Stock arrives → Reserved; Cancel → Released |
| **Awaiting Stock** | Reservation attempted; stock insufficient | Orders Module | available < requested AND no override | New stock → Reserved; Cancel → Released |
| **Allocated** | Reservation assigned to a wave | Preparation Module | Wave assignment confirmed | Picking starts → Picked; Cancel → Released |
| **Picked** | Items physically collected from warehouse | Preparation Module | Pick list completed | Loading begins → Loaded; Cancel → Released |
| **Loaded** | Items on vehicle, awaiting departure | Logistics Module | Loaded to vehicle | Inventory exits warehouse → Consumed; Cancel → Released |
| **Transferred** | Reservation moved to different warehouse | Orders Module | Warehouse reassignment | Confirmed in new WH → Reserved |
| **Released** | Stock returned to available pool (terminal) | Orders Module | Order cancelled or explicit release | Terminal |
| **Consumed** | Reservation fulfilled; inventory has left warehouse (terminal) | Logistics / Inventory | `DirectIssueStockAction` executed at shipment | Terminal |

---

## Section 9 — Status Matrix

**Decision: One matrix governs which operations are permitted and which reservation sub-state applies at each order status. This matrix is the law.**

| Order Status | Reservation Sub-state | Reserve Inventory | Allocate | Pick | Load | Consume (Ship) | Release | Primary Owner |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| Pending | Pending | On WH assign | ✗ | ✗ | ✗ | ✗ | ✗ | Orders |
| Awaiting Payment | Pending | On WH assign | ✗ | ✗ | ✗ | ✗ | ✗ | Orders |
| Confirmed | Pending / Reserved | On WH assign | ✗ | ✗ | ✗ | ✗ | ✗ | Orders |
| Processing | Reserved | Auto-reserved | ✗ | ✗ | ✗ | ✗ | ✗ | Orders |
| Preparing | Reserved → Allocated → Picked | Inherited | **OWNS** | **OWNS** | ✗ | ✗ | ✗ | Preparation |
| Ready | Loaded | Inherited | ✗ | ✗ | **OWNS** | ✗ | ✗ | Logistics |
| Out For Delivery | Loaded | Inherited | ✗ | ✗ | — | ✗ | ✗ | Logistics |
| Delivered | Consumed | ✗ | ✗ | ✗ | ✗ | **OWNS** | ✗ | Logistics / Inventory |
| Cancelled | Released | ✗ | ✗ | ✗ | ✗ | ✗ | **OWNS** | Orders |

**Key:** `On WH assign` = fires when warehouse is assigned (execution phase); `Inherited` = reservation carried over from prior status; `OWNS` = this module owns this operation; `—` = already complete.

---

## Section 10 — Warehouse Assignment

**Decision: Warehouse assignment is the Execution Requirement, not the Business Decision trigger.**

| Scenario | Policy |
|---|---|
| Warehouse resolved at creation | Auto-reserve fires within `CreateManualOrderAction` |
| Warehouse resolved later | `WarehouseAssigned` event must trigger reservation retry (missing — must be added as H3) |
| No coverage for governorate | `warehouse_assignment_source = 'unassigned'` + `reservation_status = pending` — Command Center signal, not an error |
| Multi-warehouse order | Not permitted. Multi-warehouse fulfilment requires order splitting. Each order has one warehouse and one complete reservation. |

---

## Section 11 — Raw Materials

**Decision: Raw Material reservations do not exist in the ECOS Orders reservation system.**

| Question | Answer | Rationale |
|---|---|---|
| Should RM reservations exist in Orders system? | **NO** | Multiple BOMs may apply; production scheduler selects. Orders cannot know. |
| Does current Case 2 (can_manufacture) inspect RM? | **CORRECT (PASS)** | `ReserveOrderInventoryAction` Case 2 does not query RM inventory — approved. |
| Can RM products be ordered directly? | YES — as a product | RM-WOOD-001 confirmed reservable (TRACE-002). Its `reserved_qty` must be excluded from `AnalyzeMaterialsAction` availability. |
| What formula must `AnalyzeMaterialsAction` use? | `SUM(on_hand) − SUM(reserved)` | Current: `SUM(on_hand_qty)` only — ignores direct RM order reservations. **HIGH BUG.** |

**RM Ownership by Stage:**

| Stage | RM Owner | RM Action |
|---|---|---|
| Reservation | None | RM is invisible to the reservation system |
| Preparation / Wave Planning | Preparation Module | `AnalyzeMaterialsAction` evaluates RM availability (OH − RES) |
| Manufacturing | Manufacturing Module | RM consumed via production process |
| RM Shortage | Command Center (ADR-010) | Signal raised, procurement triggered |

---

## Section 12 — Legacy Data Policy

**Decision: Legacy orders must be reprocessed via a supervised background job.**

**Definition:** Orders in status `processing`, `confirmed`, or `preparing` where `assigned_warehouse_id IS NULL` AND `reservation_status = 'pending'` with no audit trail. Confirmed: ORD-00023, ORD-00024.

| Condition | Required Action |
|---|---|
| Active status, WH=null, never shipped | Run `BranchAssignmentEngine` → if WH resolved, attempt reservation |
| Active status, WH=null, WH unresolvable | Flag in Command Center as "No Coverage Exception" |
| Active status, WH assigned, `reservation_status = pending` | Immediate reservation retry |
| Active status, order already waved without reservation | Check `wave_assignments` first — prevent double-allocation. If already waved: mark consumed retroactively, write audit entry. |
| Terminal status (delivered, cancelled) | Mark as historical record. Write retroactive audit noting legacy status. |

---

## Section 13 — Architecture Principles

| Code | Principle | Detail |
|---|---|---|
| P01 | Reservation belongs to Orders Module | Only `Modules\Commerce\Orders` may initiate, track, and terminate reservations. |
| P02 | Inventory executes, never decides | `ReserveStockAction`, `DirectIssueStockAction`, and all inventory mutations are pure executors — no business policy evaluation. |
| P03 | Warehouse first (execution requirement) | Warehouse assignment is required for execution, not for the business decision. The decision is made at order creation; the execution fires when warehouse resolves. |
| P04 | FG only — manufacturing responds | Reservation never inspects BOM, raw material inventory, or production schedules. RM is evaluated at Preparation stage. |
| P05 | Manufacturing never blocks reservation | For `can_manufacture = true`, the order is committed as Reserved regardless of FG available quantity. Zero FG is a manufacturing trigger, not an inventory exception. |
| P06 | Preparation allocates; never consumes | Preparation transitions reservation through Allocated → Picked. It never decrements `reserved_qty` and never calls `ReserveStockAction` or triggers consumption. Consumption belongs to Logistics at shipment. |
| P07 | Negative stock is a business policy | `allow_negative_stock = true` must be honoured at every stage: reservation, shipment (DirectIssue must proceed), and ledger. |
| P08 | Available = OH − Reserved, everywhere | No screen, service, query, or document may display "available" using any other formula. Applies to inventory screens, wave planning, demand analysis, and API responses equally. |
| P09 | Reservation is non-blocking | Inability to reserve does not block order progression. `awaiting_stock` is an operational signal, not a system error. |
| P10 | State machine has no backward transitions | Once Reserved, cannot return to Pending. Released and Consumed are terminal. Warehouse changes produce Transferred (lateral), not a revert. |
| P11 | Every mutation has a ledger entry | Every change to `on_hand_qty` or `reserved_qty` must produce exactly one `stock_ledger_entries` row in the same transaction. |
| P12 | Every state change has an audit entry | Every change to `orders.reservation_status` must produce one row in `order_reservation_audits` with `from_status`, `to_status`, actor, and timestamp. |
| P13 | RM reservations are invisible to Orders | RM `reserved_qty` from direct orders must be excluded from `AnalyzeMaterialsAction`'s available quantity computation. |
| P14 | Legacy orders are a data debt | Orders with WH=null and reservation_status=pending in active statuses must not be silently included in operational waves. Must be flagged and resolved. |
| P15 | Reservation is owned end-to-end per order | No split-warehouse reservations. Multi-warehouse fulfilment requires order splitting. |
| P16 | Reservation survives until physical inventory leaves its owning warehouse | Reservation must never be destroyed because a wave was created, Preparation started, or picking began. Allocation, Picking, and Loading are operational sub-states within an active reservation — they do not end it. Reservation ends ONLY when inventory physically exits the warehouse through shipment or an approved consumption operation. |

---

## Section 14 — Compliance Review

**Result: 11 PASS / 4 FAIL / 2 PARTIAL (17 rules checked)**

| Principle | Rule | Evidence | Status |
|---|---|---|---|
| P01 | Reservation belongs to Orders Module | `ReserveOrderInventoryAction` in `Modules\Commerce\Orders` | ✅ PASS |
| P02 | Inventory executes, never decides | `ReserveStockAction` applies mutation; no business rules inside | ✅ PASS |
| P03a | Warehouse as execution requirement (not trigger) | 3-gate check at creation correct; framing now aligned | ✅ PASS |
| P03b | Post-assign reservation retry trigger exists | No `WarehouseAssigned` → reservation retry listener found | ❌ FAIL |
| P04 | Reservation is FG-only | No RM query in `ReserveOrderInventoryAction` | ✅ PASS |
| P05 | Manufacturing never blocks reservation | Case 2 logical commit confirmed at runtime | ✅ PASS |
| P06 | Preparation allocates; never consumes | Reservation survives to preparing (PASS); Allocated/Picked sub-states not tracked (PARTIAL) | 🔶 PARTIAL |
| P07 | Negative stock honoured at shipment | `DirectIssueStockAction` throws regardless of `allow_negative_stock` | ❌ CRITICAL FAIL |
| P08 | Available = OH − RES everywhere | `AnalyzeMaterialsAction` reads `SUM(on_hand_qty)` only | ❌ FAIL |
| P09 | Reservation is non-blocking | `awaiting_stock` path exists; order continues | ✅ PASS |
| P10 | No backward transitions | No code path found reverting Reserved → Pending | ✅ PASS |
| P11 | Every mutation has a ledger entry | TRACE-002: reservation wrote 1 ledger row | ✅ PASS |
| P12 | Every state change has an audit entry | TRACE-002: ORD-00055 wrote 1 audit entry | ✅ PASS |
| P13 | RM invisible to Orders reservation | Orders never queries RM in reservation flow | ✅ PASS |
| P14 | Legacy orders flagged and resolved | ORD-00023, ORD-00024 in active status with no reservation | ❌ FAIL |
| P15 | Single warehouse per order | No split-warehouse reservation patterns found | ✅ PASS |
| P16 | Reservation survives until physical inventory exits | reservation_status stays 'reserved' through Preparing (PASS); Allocated/Picked/Loaded sub-states not tracked (PARTIAL) | 🔶 PARTIAL |

---

## Section 15 — Required Refactoring Roadmap

> No code in this section. Architecture guidance only.

### CRITICAL

**C1 — DirectIssueStockAction: Honour allow_negative_stock Flag**  
File: `Modules/Inventory/InventoryItems/Application/Actions/DirectIssueStockAction.php`  
Before throwing `InsufficientStockException`, check `products.allow_negative_stock`. If `true`, proceed. OH will go negative — record in ledger. Reservation is consumed at this point.  
Principle: P07 · Confirmed bug in TRACE-002 Step 10

**C2 — AnalyzeMaterialsAction: Compute Available as OH − Reserved**  
File: `Modules/Operations/Preparation/Application/Actions/AnalyzeMaterialsAction.php`  
Replace `SUM(inventory_items.on_hand_qty)` with `SUM(on_hand_qty) − SUM(reserved_qty)`. May reveal previously hidden material shortages — this is correct behaviour.  
Principle: P08, P13 · Confirmed bug in TRACE-002 Step 8

### HIGH

**H3 — Post-Warehouse-Assignment Reservation Execution Retry**  
New: `Modules/Commerce/Orders/Application/Listeners/ExecuteReservationOnWarehouseAssigned.php`  
Listen to the `WarehouseAssigned` domain event. For the order on that event, if `reservation_status = 'pending'` and order status is in [pending, awaiting_payment, confirmed, processing], enqueue a `RetryReservationJob`. This is the Execution Requirement trigger from Section 2.  
Principle: P03b

**H4 — Legacy Order Reprocessing Job**  
New: `app/Console/Commands/ReprocessLegacyReservations.php`  
Artisan command: `orders:reprocess-legacy-reservations`. Finds orders where `assigned_warehouse_id IS NULL AND reservation_status = 'pending' AND status IN ('processing','confirmed','preparing')`. Runs BranchAssignment, attempts reservation, checks wave state before acting. Must support dry-run mode.  
Principle: P14

### MEDIUM

**M5 — Raw Materials Screen: Display Available as OH − Reserved**  
Inventory module — raw materials controller / resource class.  
Display fix only. Return `on_hand_qty − reserved_qty` as the available figure.  
Principle: P08

**M6 — Reservation Retry on New Stock Arrival**  
New: `Modules/Commerce/Orders/Application/Listeners/RetryReservationOnStockReceived.php`  
Listen to `StockReceived` / `PurchaseOrderReceived` events. Queue `RetryReservationJob` for `awaiting_stock` orders of the received product, FIFO.  
Principle: P09

**M7 — Implement Reservation Sub-states (Allocated, Picked, Loaded)**  
New column: `orders.reservation_sub_status` (or extend `reservation_status` enum).  
Track the operational lifecycle of a reservation through wave assignment, picking, and loading without losing the parent `reservation_status = reserved` ownership. Required for P16 full compliance.  
Principle: P06, P16

### LOW

**L7 — Guard: Preparation Cannot Process Unreserved Orders**  
File: `Modules/Operations/Preparation/Application/Actions/PrepareOrderManufacturingAction.php`  
Add assertion: if `$order->reservation_status === 'pending'` when entering Preparation, throw `PrepareUnreservedOrderException`.  
Principle: P06, P14

**L8 — Integration Test: Ledger Invariant Enforcement**  
New: `tests/Feature/Inventory/ReservationLedgerInvariantTest.php`  
Assert that every call to `ReserveStockAction`, `DirectIssueStockAction`, and `ReleaseStockAction` produces exactly one `stock_ledger_entries` row. Run against PostgreSQL.  
Principle: P11

---

## Decision

This ADR v1.1 is **Approved**. It supersedes ADR-027 v1.0 and all prior informal understandings of reservation behaviour in ECOS ERP.

All future development touching reservation, inventory mutation, manufacturing triggers, or fulfilment preparation must comply with the 16 principles in Section 13 and the matrix in Section 9.

Implementation of roadmap items in Section 15 is required. Priority: Critical → High → Medium → Low.

---

*ADR-027 v1.1 — Reservation Ownership Policy — ECOS ERP*  
*Approved 2026-07-21 | Inputs: AUDIT-001, TRACE-002, CTO Review | No code changes. Architecture only.*
