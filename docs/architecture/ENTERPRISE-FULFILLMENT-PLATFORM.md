# ECOS Enterprise Fulfillment Platform — Complete Specification

**Document:** ENTERPRISE-FULFILLMENT-PLATFORM  
**Version:** 1.0  
**Status:** APPROVED  
**Date:** 2026-07-04  
**Task:** TASK-FULFILLMENT-ARCH-001  
**ADR Reference:** ADR-015

---

## 1. Platform Overview

The ECOS Enterprise Fulfillment Platform converts confirmed sales orders into delivered products through a pipeline of distinct Operating Systems (OS), each with a bounded responsibility, defined inputs, and defined outputs.

The platform is not a single monolithic system. It is a sequence of specialized engines connected by explicit inventory handoff points.

### Design Principles

1. **Every stage has exactly one responsibility** — no stage bleeds into the next
2. **Inventory is always quantified** — at every stage, the exact quantity of every product is known
3. **Handoffs are explicit** — every transfer between stages creates an auditable inventory event
4. **Workflows are configurable** — the Channel determines which stages execute and in what order
5. **Exceptions are first-class** — every stage has defined exception types; none are swallowed silently
6. **AI is embedded** — every stage transition generates signals for prediction and optimization
7. **Vehicles are warehouses** — a loaded vehicle carries traceable inventory, not an anonymous delivery
8. **No hardcoded workflows** — every fulfillment decision is driven by configuration and policy, not code

---

## 2. Platform Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────┐
│                     COMMERCE LAYER                                   │
│  WooCommerce │ Shopify │ Wholesale │ Manual │ B2B Portal             │
└───────────────────────────┬──────────────────────────────────────────┘
                            │ Confirmed Orders
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   RESERVATION ENGINE                                 │
│  Recipe Expansion · Material Reservation · Shortage Identification   │
└───────────────────────────┬──────────────────────────────────────────┘
                            │ Reserved Orders → Preparation Queue
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│             GEOGRAPHY & COVERAGE ENGINE                              │
│  Governorate / Zone Grouping · Coverage Map Matching                 │
│  Shipping Company Auto-Selection · Channel Rule Enforcement          │
└───────────────────────────┬──────────────────────────────────────────┘
                            │ GeographyGroups (zone + company + orders)
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     PREPARATION OS                                   │
│  Preparation Waves · Product Aggregation · Material Analysis        │
│  Shortage Analysis · Negative Stock Analysis · Product Preparation  │
│  Prepared Quantity Recording                                         │
└───────────────────────────┬──────────────────────────────────────────┘
                            │ Prepared Products
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  PREPARED PRODUCTS POOL                              │
│  Traceable · Quantified · Quality Checked · Reservable               │
│  Reallocatable · Auditable                                           │
└───────────────────────────┬──────────────────────────────────────────┘
                            │ Products Reserved for Shipping Wave
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│               VEHICLE PLANNING ENGINE                                │
│  Vehicle Count Calculation · Order Distribution · Capacity Checks   │
│  Planner Review · Manual Adjustments · Replanning Support           │
└───────────────────────────┬──────────────────────────────────────────┘
                            │ VehiclePlans → ShippingWaves
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│               LOADING & ALLOCATION OS                                │
│  Shipping Wave Planning · Vehicle Assignment · Loading Sessions      │
│  Vehicle Inventory · Partial Loading · Reallocation · Exceptions    │
└───────────────────────────┬──────────────────────────────────────────┘
                            │ Loaded Vehicles
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│                VEHICLE MOBILE WAREHOUSE                              │
│  Vehicle Inventory · Capacity · Driver · Route · Timeline           │
│  Inventory Movements · Inventory History                             │
└───────────────────────────┬──────────────────────────────────────────┘
                            │ Vehicle Inventory → Allocation
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│               PRODUCT ALLOCATION ENGINE                              │
│  Order Priority Policy · Allocation Modes · Dispatcher Override      │
│  Driver Override · Immutable Decision Chain · Partial Rules          │
└───────────────────────────┬──────────────────────────────────────────┘
                            │ OrderAllocations → Delivery Manifests
                            ▼
┌──────────────────────────────────────────────────────────────────────┐
│              CHANNEL FULFILLMENT ENGINE                              │
│  Fulfillment Profile Execution · Stage Routing · Exception Handling │
│  Re-routing · Dynamic Workflow · AI Integration                      │
└───────────────────────────┬──────────────────────────────────────────┘
                            │ Profile-Dependent Stage Execution
                    ┌───────┴────────────────────────┐
                    ▼                                ▼
        ┌─────────────────┐              ┌──────────────────┐
        │   PACKING OS    │              │  ORDER BUILDING  │
        │  (if required   │              │  (Future module) │
        │   by profile)   │              └────────┬─────────┘
        └────────┬────────┘                       │
                 └──────────────┬─────────────────┘
                                ▼
                    ┌──────────────────────┐
                    │     LOGISTICS OS     │
                    │  Route · Dispatch   │
                    │  Delivery · POD     │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │      DELIVERY        │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │      RETURNS         │
                    └──────────────────────┘
```

---

## 2B. Geography & Coverage Engine — Summary

> Full specification: `GEOGRAPHY-COVERAGE-ENGINE.md`

### Position
Runs after orders are confirmed, before vehicle planning. Groups all orders by geographic zone and assigns each group to an appropriate shipping company.

### Geographic Hierarchy
```
Country → Governorate → Zone → Sub-Zone (optional) → Orders
```

### Key Entities
- **Governorate / Zone** — enterprise master data; assigned per order via address resolution
- **ShippingCompany** — internal fleet or third-party carrier; each owns a Coverage Map
- **ShippingCoverage** — explicit mapping of which zones a company serves
- **ChannelShippingRule** — defines which companies a channel allows, with priority order
- **GeographyGroup** — output: one group per (zone + shipping_company) with assigned orders

### Auto-Selection Algorithm
1. Get companies allowed by this channel (ChannelShippingRule, ordered by priority)
2. Filter by geographic coverage (company must serve the order's zone)
3. Filter by daily capacity (company not at its daily order cap)
4. Select highest-priority (lowest priority number) remaining company

### Business Rules
- Geographic grouping always starts with Governorate, then Zone
- Shipping company selection is automatic; manual override allowed with reason
- Orders with unresolvable addresses are blocked until manually resolved
- Selection result is stored on the order; never recalculated mid-fulfillment

---

## 2C. Vehicle Planning Engine — Summary

> Full specification: `VEHICLE-PLANNING-ENGINE.md`

### Position
Runs after geography grouping, before Loading Sessions. Calculates how many vehicles are needed per geography group and distributes orders across vehicle slots.

### Flow
```
GeographyGroup (zone + shipping_company + orders)
    ↓ Vehicle count calculation
VehiclePlan (proposed slots)
    ↓ Planner review + vehicle assignment
ShippingWave (input to Loading & Allocation OS)
```

### Vehicle Count Formula
```
required_vehicles = MAX(
    CEIL(total_orders  / max_orders_per_vehicle),
    CEIL(total_weight  / max_weight_per_vehicle),
    CEIL(total_volume  / max_volume_per_vehicle),
    CEIL(total_stops   / max_stops_per_vehicle)
)
```

### Manual Adjustments (planner may)
- Merge Vehicles — combine under-filled slots
- Split Vehicle — divide an overloaded slot
- Move Order — transfer an order between slots
- Create Extra Vehicle — add a new slot
- Delete Vehicle — remove an empty slot

### Replanning Support
Vehicle breakdown · Driver change · Late orders · Rush orders · Route change · Manual replan · AI-suggested replan

---

## 3. Preparation OS — Bounded Specification

### 3.1 Scope

Preparation OS transforms reserved inventory into prepared products and places them into the Prepared Products Pool. It has no awareness of what happens after the pool.

### 3.2 Modules

| Module | Purpose |
|---|---|
| **Preparation Waves** | Group orders into manageable preparation units; schedule execution |
| **Product Aggregation** | Sum product quantities across all orders in a wave; create consolidated preparation list |
| **Material Availability Analysis** | Check raw material stock against recipe requirements before preparation begins |
| **Shortage Analysis** | Identify and surface material shortages; generate alerts; trigger procurement requests |
| **Negative Stock Analysis** | Detect products or materials where negative stock is possible; flag for supervisor decision |
| **Product Preparation** | Execute the preparation work: mixing, assembling, portioning — per recipe |
| **Prepared Quantity Recording** | Record actual prepared quantities (vs. planned); track variance |
| **Prepared Products Pool** | Write completed prepared quantities into the Pool with traceability |

### 3.3 Preparation Wave Lifecycle

```
Draft
  ↓
Planned (material analysis complete)
  ↓
Shortage Blocked (if materials insufficient) ──→ Resolved ──┐
  ↓                                                          │
Preparing (active preparation in progress)   ◄──────────────┘
  ↓
Completed (all products in Prepared Products Pool)
```

### 3.4 Hard Boundaries

Preparation OS **must not** contain code that references:
- `vehicles`, `drivers`, `routes`
- `packing_sessions`, `packing_items`
- `order_allocation`, `order_handover`
- `logistics`, `shipping_carriers`

Any feature request touching these areas from within Preparation OS is a boundary violation and must be rejected.

### 3.5 Inventory Events Generated

| Event | Trigger | Effect |
|---|---|---|
| `preparation.wave.created` | Wave planned | No inventory change |
| `preparation.shortage.detected` | Material check | No inventory change; alert generated |
| `preparation.started` | Wave begins | No inventory change yet |
| `preparation.product.prepared` | Quantity recorded | No inventory change; pool entry created |
| `preparation.wave.completed` | All products prepared | Pool totals finalized |

---

## 4. Prepared Products Pool — Full Specification

### 4.1 Purpose

The Prepared Products Pool is the official enterprise inventory buffer between Preparation and Loading. It is not a staging area. It is a first-class inventory location with full traceability.

### 4.2 Entity Design

```
PreparedProductsPool
├── id
├── company_id                → Company
├── warehouse_id              → Warehouse
├── product_id                → Product
├── preparation_wave_id       → PreparationWave (origin)
├── preparation_batch_id      → PreparationBatch (origin, nullable)
├── quantity_available        decimal(18,4)  — ready for loading
├── quantity_reserved         decimal(18,4)  — reserved for a shipping wave
├── quantity_loaded           decimal(18,4)  — already transferred to vehicle
├── quality_status            enum: passed | failed | pending_review
├── quality_checked_by        → User (nullable)
├── quality_checked_at        timestamp (nullable)
├── prepared_at               timestamp
├── reserved_for_wave_id      → ShippingWave (nullable)
└── notes
```

### 4.3 Pool Movement Rules

| Action | Source | Destination | quantity_available | quantity_reserved | quantity_loaded |
|---|---|---|---|---|---|
| Preparation Completes | — | Pool entry created | + qty | 0 | 0 |
| Wave Reserves Products | Pool | Wave | no change | + qty | no change |
| Wave Reservation Released | Pool | Pool | no change | - qty | no change |
| Loading Session Loads | Pool | Vehicle Inventory | - qty | - qty | + qty |
| Reallocation | Wave A | Wave B | no change | no change | no change |

### 4.4 Quality Check

Before products can be reserved for a shipping wave, quality status must be `passed`.  
Quality check is optional per business configuration but the status field is always present.  
`failed` pool entries trigger a Preparation OS alert and cannot be loaded.

### 4.5 Audit Trail

Every movement in the Prepared Products Pool generates a `PreparedPoolMovement` record:

```
PreparedPoolMovement
├── id
├── pool_entry_id         → PreparedProductsPool
├── movement_type         enum: created | reserved | reservation_released | loaded | quality_failed | reallocated
├── quantity_moved
├── from_wave_id          → ShippingWave (nullable)
├── to_wave_id            → ShippingWave (nullable)
├── vehicle_id            → Vehicle (nullable)
├── actor_id              → User
└── recorded_at
```

---

## 5. Loading & Allocation OS — Full Specification

### 5.1 Mission

Convert Prepared Products Pool inventory into Vehicle Inventory through structured, auditable Loading Sessions.

### 5.2 Module Architecture

| Module | Responsibility |
|---|---|
| **Shipping Wave Planning** | Create and manage shipping waves; assign orders and vehicles |
| **Vehicle Assignment** | Match vehicles to waves based on capacity, area, and route requirements |
| **Vehicle Requirement Calculation** | Calculate total volume, weight, and SKU count needed per vehicle per wave |
| **Loading Sessions** | Manage the physical loading process as a formal, tracked session |
| **Vehicle Inventory** | Maintain vehicle-level inventory: what is on each vehicle at any point |
| **Partial Loading** | Support loading vehicles with less than full allocation; track what remains in pool |
| **Reallocation** | Move reserved pool products between waves or vehicles |
| **Loading Exceptions** | Capture, classify, and escalate loading problems |

### 5.3 Shipping Wave Entity

```
ShippingWave
├── id
├── company_id                    → Company
├── warehouse_id                  → Warehouse
├── wave_number                   string (e.g. WAVE-2026-00001)
├── operational_day_id            → OperationalDay
├── orders[]                      → Order[]
├── vehicles[]                    → Vehicle[]
├── priority                      enum: critical | high | standard | low
├── region                        string (governorate / city / zone)
├── sla_deadline                  timestamp
├── loading_status                enum: planning | in_progress | completed | exceptions
├── completion_status             enum: pending | partial | completed
├── total_products_required       int
├── total_products_loaded         int
├── planned_at                    timestamp
├── planned_by                    → User
├── loading_started_at            timestamp (nullable)
├── loading_completed_at          timestamp (nullable)
└── ActivityEvents[]
```

**Supported Wave Operations:**
- **Merge** — combine two waves into one (requires matching warehouse + day)
- **Split** — divide a wave into two separate waves
- **Pause** — pause loading for a wave (generates blocking reason)
- **Replan** — modify vehicle/order assignments before loading begins
- **Auto-Planning** — AI-driven wave construction from order pool (future capability)

### 5.4 Loading Session Entity

```
LoadingSession
├── id
├── shipping_wave_id              → ShippingWave
├── vehicle_id                    → Vehicle
├── operator_id                   → User
├── started_at                    timestamp
├── finished_at                   timestamp (nullable)
├── status                        enum: open | completed | closed_with_exceptions
├── products_loaded[]
│   ├── product_id                → Product
│   ├── quantity_loaded           decimal(18,4)
│   └── pool_entry_id             → PreparedProductsPool
├── required_products[]
│   ├── product_id                → Product
│   └── quantity_required         decimal(18,4)
├── missing_products[]
│   ├── product_id                → Product
│   ├── quantity_missing          decimal(18,4)
│   └── reason                    string
├── duration_minutes              int (computed)
└── exceptions[]                  → LoadingException[]
```

**Rule:** No loading is permitted outside a Loading Session.  
Every product that moves from the Prepared Products Pool to a Vehicle must be associated with a LoadingSession record.

### 5.5 Vehicle Requirement Calculation

Before a Loading Session opens, the system calculates:

```
VehicleRequirement
├── wave_id          → ShippingWave
├── vehicle_id       → Vehicle
├── products[]
│   ├── product_id
│   ├── quantity_required
│   ├── weight_kg         (product unit weight × quantity)
│   └── volume_m3         (product unit volume × quantity)
├── total_weight_kg
├── total_volume_m3
├── vehicle_capacity_weight_kg
├── vehicle_capacity_volume_m3
├── capacity_utilization_pct
└── is_overloaded         bool
```

If `is_overloaded = true`, the system blocks the Loading Session from opening and requires supervisor reallocation.

### 5.6 Loading Exceptions

| Exception Type | Description | Severity | Required Action |
|---|---|---|---|
| `vehicle_full` | Vehicle capacity reached before all products loaded | Blocking | Reallocation or additional vehicle |
| `product_missing` | Required product not in Prepared Products Pool | Blocking | Preparation re-run or manual exception approval |
| `short_loading` | Products loaded < required quantity (within tolerance) | Warning | Supervisor approval to proceed |
| `over_loading` | Products loaded > vehicle capacity | Blocking | Reallocation required |
| `driver_missing` | Assigned driver not present or unavailable | Blocking | Driver substitution or wave pause |
| `vehicle_change` | Vehicle swap during loading session | Informational | New vehicle inventory initialized |
| `route_change` | Delivery area changed after wave creation | Warning | Order reallocation review |
| `loading_delay` | Session duration exceeds planned time | Warning | Supervisor notification |

---

## 6. Vehicle as Mobile Warehouse — Architecture

### 6.1 Core Principle

Every vehicle that participates in loading becomes a Mobile Warehouse. The vehicle does not merely transport products — it carries traceable inventory.

A vehicle's inventory is:
- **Loaded** from the Prepared Products Pool via a Loading Session
- **Consumed** when deliveries are confirmed (tied to specific orders)
- **Returned** when undelivered products come back at end of shift

### 6.2 Vehicle Entity

```
Vehicle
├── id
├── company_id                → Company
├── registration_number
├── vehicle_type              enum: van | truck | motorcycle | refrigerated | other
├── capacity_weight_kg        decimal(10,2)
├── capacity_volume_m3        decimal(10,2)
├── status                    enum: available | loading | in_transit | maintenance | inactive
│
├── Inventory
│   └── VehicleInventoryItem[]
│       ├── vehicle_id        → Vehicle
│       ├── product_id        → Product
│       ├── quantity_loaded   decimal(18,4)  — total loaded
│       ├── quantity_delivered decimal(18,4) — confirmed delivered
│       ├── quantity_returned  decimal(18,4) — returned at end of shift
│       └── quantity_on_hand   decimal(18,4) — computed: loaded - delivered - returned
│
├── LoadingSessions[]         → LoadingSession[]
├── AssignedOrders[]          → Order[]
│
├── InventoryMovements[]
│   └── VehicleInventoryMovement
│       ├── vehicle_id
│       ├── product_id
│       ├── movement_type     enum: loaded | delivered | returned | adjusted
│       ├── quantity
│       ├── reference_type    enum: loading_session | order | return
│       ├── reference_id
│       ├── actor_id          → User
│       └── recorded_at
│
├── Driver                    → User (nullable, assigned per trip)
├── Route                     (defined by Logistics OS)
└── Timeline                  (operational log for the day)
```

### 6.3 Inventory Traceability Chain

```
Warehouse Stock
    ↓ (Preparation OS prepares)
Prepared Products Pool
    ↓ (Loading Session transfers)
Vehicle Inventory
    ↓ (Delivery confirmed)
Customer Received
    OR
    ↓ (Not delivered, end of shift)
Return to Warehouse
```

Each arrow creates an immutable inventory movement record.

### 6.4 End-of-Shift Reconciliation

At shift end, every vehicle must be reconciled:

```
VehicleShiftReconciliation
├── vehicle_id                → Vehicle
├── shift_date
├── operator_id               → User
├── products[]
│   ├── product_id
│   ├── quantity_loaded
│   ├── quantity_delivered    (from confirmed deliveries)
│   ├── quantity_returned     (physically returned to warehouse)
│   └── quantity_variance     (loaded - delivered - returned; must be 0)
├── variance_approved_by      → User (nullable)
├── variance_notes
└── reconciled_at
```

---

## 6B. Product Allocation Engine — Summary

> Full specification: `PRODUCT-ALLOCATION-ENGINE.md`

### Position
Runs after vehicle loading, before dispatch. Allocates vehicle inventory to the specific orders on that vehicle, producing a delivery manifest per order.

### Critical Distinction
Product Allocation does **not** touch warehouse inventory. It operates on `VehicleInventoryItem` records only. Allocation happens after the vehicle is loaded.

### Allocation Modes
`full_auto` · `partial_auto` · `manual` · `ai_suggested` · `priority` · `fifo` · `custom_policy`

The active mode is configured in the channel's Fulfillment Profile. It is never hardcoded.

### Default Priority Policy (configurable)
```
Priority 1: Paid Orders
Priority 2: COD Orders
Priority 3: Deferred Orders
Priority 4: Others
```

### Decision Hierarchy (immutable chain)
```
System Recommendation → Dispatcher Override → Driver Override → Final Allocation
```
All decisions are stored permanently. Nothing is overwritten. Every non-system override requires a reason.

### Driver Authority
Configured per Fulfillment Profile. Drivers may increase, decrease, split, or delay allocations — within limits defined by the profile config. Reason is mandatory for every driver override.

### Key Tracked Quantities (per OrderAllocation)
`quantity_requested` · `quantity_allocated` · `quantity_loaded` · `quantity_delivered` · `quantity_remaining`

---

## 7. Channel Fulfillment Engine — Specification

### 7.1 Purpose

The Channel Fulfillment Engine executes the Fulfillment Profile for each channel. It is the orchestration layer that moves orders between fulfillment stages.

### 7.2 Responsibilities

| Responsibility | Description |
|---|---|
| **Execute Fulfillment Profiles** | Load the active profile for each channel; route orders through its stages |
| **Move Orders Between Stages** | Trigger stage entry and exit events; update order status |
| **Handle Exceptions** | Catch stage-level failures; apply configured exception policies |
| **Support Re-routing** | Allow supervisor override to skip or repeat stages |
| **Support Dynamic Workflow** | Apply different profile to an order in-flight if business requires |
| **Integrate with AI Platform** | Consume AI predictions to optimize stage sequencing |

### 7.3 Fulfillment Profiles

A Fulfillment Profile is a JSON-configured ordered list of stages. No fulfillment stage is hardcoded. New stages can be added by extending the stage registry — no engine changes required.

**Stage Registry (all available stages):**

| Stage Key | Description | Module |
|---|---|---|
| `reservation` | Reserve inventory | Reservation Engine |
| `preparation` | Prepare products | Preparation OS |
| `vehicle_allocation` | Assign to vehicle | Loading & Allocation OS |
| `loading` | Load vehicle | Loading & Allocation OS |
| `packing` | Pack orders | Packing OS |
| `order_building` | Build per-order packs | Future module |
| `pallet_building` | Build pallets | Packing OS |
| `invoice_verification` | Verify invoices | Finance integration |
| `order_handover` | Hand over to driver | Future module |
| `delivery` | Execute delivery | Logistics OS |
| `returns` | Process returns | Returns module |

**Profile A — Bulk Distribution:**
```json
{
  "name": "Bulk Distribution",
  "stages": [
    { "type": "reservation",        "sequence": 1 },
    { "type": "preparation",        "sequence": 2 },
    { "type": "vehicle_allocation", "sequence": 3 },
    { "type": "loading",            "sequence": 4 },
    { "type": "packing",            "sequence": 5 },
    { "type": "delivery",           "sequence": 6 }
  ]
}
```

**Profile B — Per-Order Handover:**
```json
{
  "name": "Per-Order Handover",
  "stages": [
    { "type": "reservation",        "sequence": 1 },
    { "type": "preparation",        "sequence": 2 },
    { "type": "vehicle_allocation", "sequence": 3 },
    { "type": "loading",            "sequence": 4 },
    { "type": "order_building",     "sequence": 5 },
    { "type": "order_handover",     "sequence": 6 },
    { "type": "delivery",           "sequence": 7 }
  ]
}
```

**Profile C — Wholesale Pallet:**
```json
{
  "name": "Wholesale Pallet",
  "stages": [
    { "type": "reservation",        "sequence": 1 },
    { "type": "preparation",        "sequence": 2 },
    { "type": "vehicle_allocation", "sequence": 3 },
    { "type": "loading",            "sequence": 4 },
    { "type": "pallet_building",    "sequence": 5 },
    { "type": "invoice_verification","sequence": 6 },
    { "type": "delivery",           "sequence": 7 }
  ]
}
```

---

## 8. Packing OS — Updated Specification

### 8.1 Critical Architecture Change

Packing is **no longer mandatory for every channel**.  
Packing is **no longer part of Preparation OS**.  
Packing is a **workflow-dependent stage** activated only when the channel's Fulfillment Profile includes a `packing` or `pallet_building` stage.

### 8.2 Packing Position in Flow

```
Loading & Allocation OS
     ↓
Vehicle Mobile Warehouse (inventory available)
     ↓
[Channel Fulfillment Engine routes here if profile includes packing]
     ↓
Packing OS
     ↓
Logistics OS
```

### 8.3 Packing Modes

| Mode | Trigger | Process |
|---|---|---|
| **Order Packing** | Profile includes `packing` stage | Each order packed individually; label per order |
| **Pallet Building** | Profile includes `pallet_building` stage | Orders grouped onto pallets by area/route |
| **Pack During Loading** | Profile config: `pack_during_loading: true` | Packing happens at the vehicle during loading |
| **Pre-packed** | Products shipped ready | No packing stage required; products pre-labeled |

### 8.4 Packing Session Entity

```
PackingSession
├── id
├── shipping_wave_id          → ShippingWave
├── vehicle_id                → Vehicle
├── packer_id                 → User
├── started_at
├── completed_at
├── mode                      enum: order_packing | pallet_building | pack_during_loading
├── items_packed[]
│   ├── order_id              → Order
│   ├── product_id            → Product
│   ├── quantity_packed
│   └── label_printed         bool
└── exceptions[]
```

---

## 9. Logistics OS — Updated Specification

### 9.1 Critical Architecture Change

Logistics OS now starts **after Loading & Allocation OS** completes.  
Previous documentation incorrectly placed Logistics after Preparation.

### 9.2 Correct Input

Logistics OS receives loaded vehicles, not preparation batches.  
A vehicle must have a completed (or at-minimum open) Loading Session before Logistics OS can begin route execution.

### 9.3 Responsibilities

| Responsibility | Owner |
|---|---|
| Route planning | Logistics OS |
| Route optimization | Logistics OS (+ AI) |
| Driver dispatch | Logistics OS |
| Delivery confirmation | Logistics OS |
| Proof of delivery (POD) | Logistics OS |
| ETA tracking | Logistics OS |
| Delivery exceptions | Logistics OS |
| End-of-shift vehicle reconciliation | Logistics OS → Loading & Allocation OS |

---

## 10. AI Integration — Fulfillment Platform

### 10.1 Entry Points

The Enterprise Fulfillment Platform generates rich operational data at every stage transition. These are the primary AI entry points.

| Entry Point | Location | Signal | AI Opportunity |
|---|---|---|---|
| **EP-F1** | Preparation Wave Planning | Wave size, product mix, material availability | Predict preparation duration; surface bottlenecks before they occur |
| **EP-F2** | Shortage Analysis | Material shortage frequency per product + supplier | Predict shortage risk; trigger pre-emptive procurement |
| **EP-F3** | Prepared Products Pool | Pool utilization vs shipping wave demand | Predict pool overflow or underflow; optimize preparation scheduling |
| **EP-F4** | Loading Session | Loading duration vs. planned; exception frequency | Predict loading delays; recommend vehicle pre-assignment |
| **EP-F5** | Vehicle Requirement Calculation | Capacity utilization per wave | Optimize vehicle assignment; minimize empty capacity |
| **EP-F6** | Shipping Wave Construction | Order mix, region density, SLA deadlines | Auto-plan shipping waves; group orders by delivery efficiency |
| **EP-F7** | End-of-Shift Reconciliation | Delivered vs loaded per product per vehicle | Detect systematic delivery variances; alert on driver performance |
| **EP-F8** | Packing Session | Packing time per order / per packer | Predict packing completion time; balance packer workload |

### 10.2 Future AI Capabilities

| Capability | Description |
|---|---|
| **Preparation Bottleneck Prediction** | Predict which preparation waves will run late based on material availability and team capacity |
| **Loading Delay Prediction** | Score each planned loading session for delay risk based on historical session durations |
| **Vehicle Optimization** | Recommend vehicle assignments that minimize total empty space and maximize SLA compliance |
| **Auto Vehicle Assignment** | Automatically assign vehicles to shipping waves based on region, capacity, and priority |
| **Shipping Wave Optimization** | Auto-construct shipping waves that minimize route overlap and delivery time |
| **Product Reallocation** | Recommend reallocation of prepared products when a vehicle change or wave modification occurs |
| **ETA Prediction** | Predict delivery time for each order given vehicle position, route, and traffic |
| **Workload Balancing** | Balance preparation waves across teams to prevent preparation bottlenecks |

### 10.3 Training Datasets (Fulfillment Layer)

| Dataset | Source Tables | AI Use |
|---|---|---|
| **DS-F1 Preparation Performance** | `preparation_waves`, `preparation_batches`, `prepared_products_pool` | Duration forecasting, bottleneck detection |
| **DS-F2 Loading Efficiency** | `loading_sessions`, `loading_exceptions`, `vehicle_requirements` | Delay prediction, exception classification |
| **DS-F3 Vehicle Utilization** | `vehicle_inventory_items`, `vehicle_inventory_movements` | Capacity optimization, route matching |
| **DS-F4 Wave Performance** | `shipping_waves`, `loading_sessions`, `vehicle_reconciliations` | Wave planning optimization |
| **DS-F5 Delivery Outcomes** | `logistics_deliveries`, `vehicle_reconciliations`, `orders` | ETA prediction, variance detection |

---

## 11. Domain Model

### 11.1 Aggregate Boundaries

| Aggregate Root | Owned Entities | Module |
|---|---|---|
| `Order` | OrderLines, inventory timestamps | Commerce |
| `PreparationWave` | PreparationBatchLines | Preparation OS |
| `PreparedProductsPool` | PreparedPoolMovements | Preparation OS / Loading OS |
| `ShippingWave` | Wave orders, vehicles | Loading & Allocation OS |
| `LoadingSession` | LoadedProducts, MissingProducts, Exceptions | Loading & Allocation OS |
| `Vehicle` | VehicleInventory, VehicleMovements, LoadingSessions | Loading & Allocation OS |
| `PackingSession` | PackedItems | Packing OS |
| `FulfillmentProfile` | FulfillmentStages | Channel Fulfillment Engine |

### 11.2 Cross-Aggregate References (IDs only, no eager loading across boundaries)

```
Order ──────────────────────────→ PreparationWave (preparation_wave_id)
PreparationWave ────────────────→ PreparedProductsPool (wave_id)
PreparedProductsPool ───────────→ ShippingWave (reserved_for_wave_id)
ShippingWave ───────────────────→ Vehicle[] (via wave_vehicles join)
LoadingSession ─────────────────→ Vehicle (vehicle_id)
LoadingSession ─────────────────→ PreparedProductsPool (pool_entry_id per line)
Vehicle ────────────────────────→ VehicleInventoryItem[]
VehicleInventoryItem ───────────→ Product (product_id)
Channel ────────────────────────→ FulfillmentProfile (profile_id)
```

---

## 12. Sequence Diagram — Standard Fulfillment (Profile A)

```
Commerce       Reservation      Preparation    Pool       Loading OS    Vehicle     Logistics
   │                │               │            │              │           │           │
   │ Order.confirmed│               │            │              │           │           │
   │───────────────►│               │            │              │           │           │
   │                │ Reserve stock │            │              │           │           │
   │                │───────────────►            │              │           │           │
   │                │               │            │              │           │           │
   │                │ Queue entry   │            │              │           │           │
   │                │◄──────────────│            │              │           │           │
   │                │               │            │              │           │           │
   │                │  Wave planned │            │              │           │           │
   │                │  Prepare qty  │            │              │           │           │
   │                │───────────────►            │              │           │           │
   │                │               │  Pool entry│              │           │           │
   │                │               │───────────►│              │           │           │
   │                │               │            │ Wave created │           │           │
   │                │               │            │─────────────►│           │           │
   │                │               │            │ Pool reserved│           │           │
   │                │               │            │◄─────────────│           │           │
   │                │               │            │              │           │           │
   │                │               │            │ Loading      │           │           │
   │                │               │            │ Session open │           │           │
   │                │               │            │─────────────►│           │           │
   │                │               │            │ Products     │Vehicle    │           │
   │                │               │            │ transferred  │Inventory  │           │
   │                │               │            │─────────────►│◄──────────│           │
   │                │               │            │              │           │           │
   │                │               │            │              │ Dispatch  │           │
   │                │               │            │              │──────────►│           │
   │                │               │            │              │           │ Deliver   │
   │                │               │            │              │           │──────────►│
```

---

## 13. Module Ownership Summary

| Module | Bounded Context | Status |
|---|---|---|
| Reservation Engine | Inventory / Commerce | Existing (ReserveStockAction) |
| Preparation OS | Operations | Design complete; implementation pending |
| Prepared Products Pool | Operations | **New** — design complete; implementation pending |
| Loading & Allocation OS | Operations | **New** — design complete; implementation pending |
| Vehicle Mobile Warehouse | Operations / Logistics | **New** — design complete; implementation pending |
| Channel Fulfillment Engine | Operations / Commerce | **New** — design complete; implementation pending |
| Packing OS | Operations | Redesigned (workflow-dependent); implementation pending |
| Logistics OS | Logistics | Redesigned (starts after loading); implementation pending |
| Order Building | Operations | **Future** — placeholder only |
| Order Handover | Operations | **Future** — placeholder only |

---

## 14. Responsibility Matrix — Full Platform

| Action | Reservation Engine | Preparation OS | Loading & Allocation OS | Channel Fulfillment Engine | Packing OS | Logistics OS |
|---|---|---|---|---|---|---|
| Reserve material stock | ✓ | | | | | |
| Release reservation | ✓ | | | | | |
| Create preparation waves | | ✓ | | | | |
| Shortage analysis | | ✓ | | | | |
| Record prepared quantities | | ✓ | | | | |
| Write to Prepared Products Pool | | ✓ | | | | |
| Reserve from pool for wave | | | ✓ | | | |
| Create shipping waves | | | ✓ | | | |
| Assign vehicles | | | ✓ | | | |
| Open loading sessions | | | ✓ | | | |
| Transfer pool → vehicle inventory | | | ✓ | | | |
| Handle loading exceptions | | | ✓ | | | |
| Execute fulfillment profiles | | | | ✓ | | |
| Route orders between stages | | | | ✓ | | |
| Pack orders / build pallets | | | | | ✓ | |
| Print labels | | | | | ✓ | |
| Plan routes | | | | | | ✓ |
| Dispatch vehicles | | | | | | ✓ |
| Confirm deliveries | | | | | | ✓ |
| Capture proof of delivery | | | | | | ✓ |
| End-of-shift reconciliation | | | ✓ (vehicle) | | | ✓ (route) |

---

## 14C. Enterprise Platform Services Dependency (TASK-EPS-ARCH-001)

The Enterprise Fulfillment Platform depends on all four Enterprise Platform Services. No Fulfillment OS implements its own event bus, timeline, document store, or notification system.

### EPS Integration per Module

| Module | EPS-01 Events Published | EPS-02 Timeline | EPS-03 Documents | EPS-04 Notifications |
|---|---|---|---|---|
| Preparation OS | `preparation.wave.*`, `preparation.shortage.*`, `preparation.product.prepared` | Wave timeline | Quality reports | Shortage alerts, wave completion |
| Loading & Allocation OS | `loading.session.*`, `loading.product.loaded`, `loading.exception.*` | Order + Wave timeline | — | Loading exceptions, partial load approvals |
| Product Allocation Engine | `allocation.completed`, `allocation.partial`, `allocation.override.*` | Order timeline | — | Partial allocation approvals |
| Packing OS | `packing.session.*`, `packing.order.packed`, `packing.label.printed` | Order timeline | Packing lists, labels | — |
| Logistics OS | `logistics.route.planned`, `logistics.delivery.confirmed`, `logistics.delivery.failed` | Order + Vehicle timeline | Delivery proofs | Delivery confirmations, failure alerts |
| Vehicle Module | `vehicle.inventory.*`, `vehicle.reconciliation.*` | Vehicle timeline | — | Variance alerts |

### Governance (GOV-011 to GOV-016 apply)

All fulfillment modules are bound by the EPS governance rules. In particular:
- `GOV-011`: Cross-module communication via Events only (e.g. Preparation OS → Loading OS via event, not direct call)
- `GOV-012`: Wave, Order, and Vehicle timelines are auto-generated from Events — no manual timeline writes
- `GOV-013`: Delivery proofs and packing lists stored in Document Platform (EPS-03)
- `GOV-014`: All shortage/exception/approval notifications sent via Notification Platform (EPS-04)

---

## 14B. Configuration Platform Dependency (TASK-CONFIGURATION-ARCH-001)

The Enterprise Fulfillment Platform does not make a single hardcoded operational decision. Every engine and stage consumes a Policy, which is resolved from the Configuration Platform at runtime.

### Policy → Engine Mapping

| Engine / Module | Policy Consumed |
|---|---|
| Geography & Coverage Engine | `GeographyPolicy` |
| Vehicle Planning Engine | `VehiclePolicy` |
| Product Allocation Engine | `AllocationPolicy` |
| Partial Fulfillment Rules | `FulfillmentPolicy` |
| Loading & Allocation OS | `VehiclePolicy` + `FulfillmentPolicy` |
| Channel Fulfillment Engine | `FulfillmentPolicy` |
| Packing OS | `PackingPolicy` |
| Logistics OS | `DeliveryPolicy` |

### Configuration Platform Decision Flow

```
Fulfillment Engine
      ↓
PolicyEngine.resolve(PolicyType, scope, scopeId)
      ↓
ConfigurationResolver (walks scope chain: Channel → Company → Global)
      ↓
ConfigurationVersion (immutable — active version for this scope)
      ↓
RuleEvaluationEngine.evaluate(policy, context)
      ↓
RuleEvaluationResult { decision, reason, policy_id, config_version_id, evaluated_at }
      ↓
PolicyEvaluationAudit (written automatically)
```

### Platform-Level Feature Flags

```
modules.preparation_os          — Preparation OS enabled
modules.loading_allocation_os   — Loading & Allocation OS enabled
modules.vehicle_warehouse       — Vehicle inventory tracking enabled
modules.packing_os              — Packing OS enabled
modules.product_allocation      — Product Allocation Engine enabled
modules.geography_coverage      — Geography & Coverage Engine enabled
modules.vehicle_planning        — Vehicle Planning Engine enabled
```

### Architecture Governance (GOV-001 to GOV-010)

| Rule | Constraint |
|---|---|
| GOV-001 | No business module may implement business decisions directly |
| GOV-002 | Every Decision Engine must consume policies from the Policy Engine |
| GOV-003 | Every Policy must derive from a versioned ConfigurationVersion |
| GOV-004 | Every configuration change must be versioned; rollback creates a new version copy |
| GOV-005 | Every policy evaluation must produce a PolicyEvaluationAudit record |
| GOV-006 | Scope resolution must walk the full chain (Global → Country → Company → Channel → Warehouse → User) |
| GOV-007 | Feature flags are the only way to enable or disable a module; no environment-specific code |
| GOV-008 | AI recommendations must always declare: Policy Used, Confidence, Explanation, Override Possibility |
| GOV-009 | AI may not bypass the Policy Engine under any circumstances |
| GOV-010 | Every decision must be reproducible using the `config_version_id` stored on its audit record |

> Full specification: `docs/architecture/ENTERPRISE-CONFIGURATION-PLATFORM.md`

---

## 14D. Enterprise UX Architecture Dependency (TASK-UX-ARCH-001)

Every Fulfillment Platform Operating System shares one UX language defined in `docs/ux/`.

| OS | UX Standard Applied |
|---|---|
| Preparation OS | WORKSPACE-FRAMEWORK.md (Standard Operational), DATAGRID-STANDARD.md, DETAIL-DRAWER-STANDARD.md |
| Loading OS | WORKSPACE-FRAMEWORK.md (Planning variant), DATAGRID-STANDARD.md |
| Allocation Engine | AI-UX-STANDARD.md (EP-AI-02, EP-AI-03 for allocation recommendations) |
| Logistics OS | WORKSPACE-FRAMEWORK.md, MOBILE-UX-STANDARD.md (driver mobile interface) |
| Vehicle Planning | WORKSPACE-FRAMEWORK.md (Canvas variant) |

All Fulfillment OS notifications are delivered through `NOTIFICATION-UX-STANDARD.md`.  
All Fulfillment business objects have a Timeline (EPS-02) and Documents (EPS-03) tab via `TIMELINE-UX-STANDARD.md` and `DOCUMENTS-UX-STANDARD.md`.

> Full UX Architecture: `docs/ux/ENTERPRISE-UX-ARCHITECTURE.md`

---

## 15. Future Roadmap — Fulfillment Platform

| Phase | Deliverable | Priority |
|---|---|---|
| **Phase 1** | Preparation OS + Prepared Products Pool | Critical |
| **Phase 2** | Loading & Allocation OS (Shipping Waves + Loading Sessions) | Critical |
| **Phase 3** | Vehicle Mobile Warehouse (inventory on vehicle) | High |
| **Phase 4** | Channel Fulfillment Engine (profile execution) | High |
| **Phase 5** | Packing OS (workflow-dependent, Profile A) | High |
| **Phase 6** | Logistics OS (route execution, delivery confirmation) | High |
| **Phase 7** | Returns Module | Medium |
| **Phase 8** | AI: Bottleneck prediction, loading delay prediction | Medium |
| **Phase 9** | AI: Auto shipping wave construction | Medium |
| **Phase 10** | Order Building Module | Future |
| **Phase 11** | Order Handover Module | Future |
| **Phase 12** | AI: Full optimization suite | Future |
