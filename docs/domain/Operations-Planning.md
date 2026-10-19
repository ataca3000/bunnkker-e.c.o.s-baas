# Operations Planning Engine

**Status:** Updated — ADR-015 Adopted  
**Layer:** Operations Planning  
**Last Updated:** 2026-07-04 (TASK-FULFILLMENT-ARCH-001 — reflects Enterprise Fulfillment Platform)

---

## 1. Core Principle

The Operations Planning Engine is the **operational brain** that transforms customer orders into executable warehouse operations.

It is NOT:
- Inventory management (separate layer)
- Manufacturing management (separate layer)
- Shipping management (separate layer)
- Vehicle Loading (owned by Loading & Allocation OS — see ADR-015)
- Packing (owned by Packing OS — workflow-dependent, see ADR-015)

It IS:
- The planning layer that bridges Commerce (Orders) and Execution (Warehouse)
- The system that converts individual orders into efficient batch operations
- The engine that calculates materials, production, and preparation requirements

### The Fundamental Shift

> Warehouse teams never work directly on individual orders.
> Warehouse teams work on **Preparation Waves**.

This is the most important operational decision in the system.

---

## 2. Enterprise Fulfillment Flow

> **Note:** This document covers the Planning and Preparation stages.  
> Geography grouping, vehicle planning, loading, allocation, and delivery are owned by separate modules.  
> See `docs/architecture/ADR-015-enterprise-fulfillment-architecture.md` for the full platform.

```
Sales Orders (from Commerce layer)
    ↓
Reservation Engine                ← Inventory Module
    ↓
Geography & Coverage Engine       ← groups orders by zone, assigns shipping company
    ↓
[Operations Planning — THIS DOC]
    ↓
Material Requirements Planning (MRP)
    ↓
Production Requirements Planning (PRP)
    ↓
Wave Picking / Preparation OS
    ↓
Prepared Products Pool            ← formal inventory handoff point
    ↓
Vehicle Planning Engine           ← calculates vehicle count, distributes orders
    ↓
Loading & Allocation OS           ← separate module (ADR-015)
    ↓
Vehicle Mobile Warehouse          ← loading output
    ↓
Product Allocation Engine         ← allocates vehicle inventory to orders
    ↓
Channel Fulfillment Engine        ← configurable per channel (Fulfillment Profiles)
    ↓
Packing OS (if profile requires)  ← workflow-dependent
    ↓
Logistics OS
    ↓
Delivery
    ↓
Returns
```

---

## 3. Fulfillment Batch / Preparation Wave

The **Preparation Wave** is the primary operational unit in the warehouse preparation stage.

> Prior terminology: "FulfillmentBatch". New terminology aligns with Enterprise Fulfillment Platform (ADR-015).  
> The wave covers preparation only — it does NOT include loading, packing, or shipping.

### Definition

A Preparation Wave groups multiple orders into a single executable warehouse preparation operation. The warehouse team works the wave as a unit — not order by order. The wave ends when products are placed into the **Prepared Products Pool**.

### Wave Fields

```
PreparationWave (formerly FulfillmentBatch)
├── id
├── wave_number (e.g. WAVE-2025-001234)
├── warehouse_id → Warehouse
├── planning_date
├── status: WaveStatus
├── stats
│   ├── orders_count
│   ├── products_count
│   ├── lines_count
├── requirements
│   ├── required_products[] → { product_id, quantity_needed, quantity_available, shortage }
│   └── required_materials[] → { material_id, quantity_needed, quantity_available, shortage }
├── assignment
│   ├── areas[] → WarehouseArea
│   └── users[] → User
├── notes
├── created_by → User
├── created_at
├── approved_by → User
├── approved_at
└── ActivityEvents[]
```

> Vehicles are no longer assigned at the wave level. Vehicle assignment is managed entirely by **Loading & Allocation OS** (ADR-015).

### Wave Lifecycle

```
Draft
  ↓
Planning (MRP + PRP calculated)
  ↓
Waiting Materials (if shortage exists)
  ↓
Manufacturing (if production required)
  ↓
Ready For Picking
  ↓
Picking
  ↓
Prepared (products placed in Prepared Products Pool)
  ↓
Completed

Dead ends:
Cancelled
```

> Removed states from old batch lifecycle: `Distribution`, `Loading`.  
> These stages now belong to Loading & Allocation OS and Channel Fulfillment Engine respectively.

---

## 4. Wave Builder

### Step 1 — Select Orders

Operator selects orders to include in the wave using filters:

| Filter | Examples |
|--------|---------|
| Today's Orders | All orders created today |
| By Status | Confirmed orders ready for preparation |
| By Channel | WooCommerce orders only |
| By Area | Governorate / city filters |
| By Warehouse | Specific warehouse scope |

Manual selection is also supported (individual order checkboxes).

### Step 2 — Calculate Requirements

The system automatically calculates:

- **Products Required**: sum of all order line quantities, per product
- **Raw Materials Required**: Bill-of-Materials explosion for each product
- **Manufacturing Requirements**: products not in stock that must be produced
- **Purchase Requirements**: raw materials not in stock that must be purchased

### Step 3 — Assign Resources

- Warehouse (from default or manual selection)
- Areas within the warehouse
- Responsible team / users

> Vehicles are NOT assigned at this step. Vehicle assignment happens in Loading & Allocation OS after products are in the Prepared Products Pool.

### Step 4 — Generate Wave

System creates the PreparationWave record with status `Planning`.

### Step 5 — Review & Approve

Planning supervisor reviews:
- Requirements accuracy
- Material availability
- Manufacturing timeline

Approves → wave moves to `Waiting Materials` or `Ready For Picking`.

---

## 5. Material Requirements Planning (MRP)

The MRP engine calculates what raw materials must be procured.

### MRP Calculation

For each wave:
1. Collect all products and quantities
2. Explode Bill-of-Materials for each product
3. Sum total raw material requirements
4. Compare against current stock
5. Calculate shortage per material

### MRP Output

```
PurchaseRequirement
├── wave_id
├── material_id → RawMaterial
├── quantity_required
├── quantity_available (current stock)
├── quantity_to_purchase
└── expected_delivery_date
```

This output is sent to the Purchasing module as a **Purchase Requirements List**.

---

## 6. Production Requirements Planning (PRP)

The PRP engine calculates what finished products must be manufactured.

### PRP Calculation

For each wave:
1. Sum required finished product quantities
2. Compare against available finished goods stock
3. Calculate products to manufacture
4. Assign manufacturing priority (based on wave date)

### PRP Output

```
ManufacturingPlan
├── wave_id
├── product_id → Product
├── quantity_required
├── quantity_available
├── quantity_to_manufacture
└── priority: number
```

This output becomes a **Manufacturing Queue** sent to the Manufacturing module.

---

## 7. Wave Picking

Wave Picking is the warehouse execution method for collecting products.

### Wave Picking Principle

The warehouse does NOT pick products order-by-order.

Instead:
1. Sum ALL products needed across ALL orders in the wave
2. Generate a consolidated pick list
3. Warehouse team picks all quantities at once

### Example

Instead of picking for 125 separate orders:

| Product | Total Required |
|---------|---------------|
| Honey 500g | 420 units |
| Coffee Blend | 180 units |
| Medjool Dates | 95 units |

One warehouse pick operation serves all 125 orders.

### Wave Pick List

```
WavePickList
├── wave_id
├── items[]
│   ├── product_id → Product
│   ├── sku
│   ├── location (warehouse zone / shelf)
│   ├── quantity_to_pick
│   └── quantity_picked (tracked during execution)
└── status: pending | in_progress | completed
```

---

## 8. Prepared Products Pool (Handoff Point)

After Wave Picking, products are placed into the **Prepared Products Pool** — the formal inventory handoff point between Preparation OS and Loading & Allocation OS.

**What Preparation OS contributes to the pool:**
- Exact product quantities, traced to the originating wave
- Quality status per product
- Preparation timestamp

**What happens after the pool:**
- Loading & Allocation OS reads the pool and begins Shipping Wave Planning
- Products are reserved for specific shipping waves
- Loading Sessions move products from the pool to vehicle inventory
- See `LOADING-ALLOCATION-OS-SPEC.md` for details

> Preparation OS ends at the Prepared Products Pool.  
> Preparation OS never allocates products to specific orders.  
> Preparation OS never packs.  
> Preparation OS never loads vehicles.

---

## 9. Channel Fulfillment Profiles

After vehicle loading, product distribution to channels is governed by **Fulfillment Profiles** — not the old "Dispatch Profiles" concept.

> This replaces the previous Section 8 "Channel Distribution" and Section 9 "Vehicle Loading".

**Key changes from old dispatch profiles:**

| Old Concept | New Concept |
|---|---|
| `bulk_distribution` profile | Handled by `vehicle_allocation` + `delivery` stages |
| `pack_during_loading` profile | `packing` stage with `pack_at_vehicle: true` config |
| `pre_packed` profile | `packing` stage with `pack_at_vehicle: false` config |
| Dispatch profiles embedded in Operations Planning | **Fulfillment Profiles** owned by Channel Fulfillment Engine |
| Profiles applied at Distribution step | Profiles applied across all post-loading stages |

**Fulfillment Profiles are configurable per channel and owned by the Channel Fulfillment Engine.**  
See `docs/architecture/FULFILLMENT-PROFILES-SPEC.md` for full specification.

---

## 10. Operations Dashboard

Real-time operational view of today's operations.

### KPI Cards

| KPI | Description |
|-----|-------------|
| Today's Orders | Total orders for today |
| Preparation Waves | Active waves today |
| Products Required | Total SKU count across active waves |
| Raw Materials Required | Materials needed for today's production |
| Manufacturing Jobs | Open manufacturing orders |
| Pool Ready | Products in Prepared Products Pool awaiting loading |
| Active Loading Sessions | Vehicles currently being loaded |
| Vehicles Dispatched | Vehicles in transit today |
| Completed Deliveries | Confirmed deliveries today |

---

## 11. Activity

Every operational action generates an Activity event:

| Event | Trigger |
|-------|---------|
| `wave_created` | Wave builder completes |
| `planning_approved` | Supervisor approves wave plan |
| `materials_calculated` | MRP run completes |
| `manufacturing_started` | Manufacturing job linked to wave |
| `picking_started` | Wave pick list activated |
| `picking_completed` | All products picked |
| `pool_updated` | Products entered Prepared Products Pool |
| `wave_completed` | All products placed in pool |

> Events for loading, vehicle dispatch, and delivery are owned by Loading & Allocation OS and Logistics OS.

---

## 12. Design Principles

1. **Planning before Execution** — plan is always created before warehouse execution begins
2. **Wave before Order** — warehouse team sees waves, not individual orders
3. **Wave Picking before Distribution** — collect all products first, then distribute
4. **Preparation ends at the Pool** — wave is complete when products are in the Prepared Products Pool

---

## 13. Configuration Platform Dependency (TASK-CONFIGURATION-ARCH-001)

Operations Planning consumes `ReservationPolicy` and `ManufacturingPolicy` from the Enterprise Configuration Platform. No planning threshold, shortage rule, or manufacturing trigger is hardcoded.

### Policies Consumed

| Policy | Used For |
|---|---|
| `ReservationPolicy` | Stock reservation rules, shortage tolerance, negative stock behavior |
| `ManufacturingPolicy` | When to trigger manufacturing jobs, batch size rules, priority assignment |
| `InventoryPolicy` | How to calculate available quantity, FIFO rules, warehouse priority |

### Configuration Settings

| Setting Key | Description |
|---|---|
| `preparation.wave.max_size` | Maximum orders per preparation wave |
| `preparation.wave.auto_start` | Auto-start preparation when queue threshold is reached |
| `inventory.reservation.allow_negative_stock` | Whether negative stock is permitted at reservation time |
| `manufacturing.mrp.auto_trigger` | Auto-trigger manufacturing job from MRP shortage output |
| `manufacturing.prp.priority_mode` | How manufacturing priority is assigned (sla_deadline / fifo / manual) |

### Feature Flags

```
modules.preparation_os           — must be enabled for Preparation OS to run
workflow.stages.preparation      — preparation stage enabled in Fulfillment Profiles
```

### Audit

Every Wave creation, MRP calculation, and PRP trigger stores the `config_version_id` of the active `ReservationPolicy` / `ManufacturingPolicy` at the time of planning. This enables point-in-time reconstruction of why a wave was sized the way it was and which rules were applied.

> Full specification: `docs/architecture/ENTERPRISE-CONFIGURATION-PLATFORM.md`
5. **Channel Fulfillment Profiles own post-loading workflow** — not Operations Planning
6. **Vehicle assignment is a Loading & Allocation concern** — never assigned during wave planning
7. **Warehouse operators execute waves** — not orders (customer service executes orders)
8. **Planning is centralized** — done once per wave by an authorized planner
9. **Execution is decentralized** — warehouse team, production team, drivers work independently
10. **Everything generates Activity** — every action creates an audit trail
11. **Everything is auditable** — all decisions can be reviewed and explained

---

## 13. Entity Relationships

```
PreparationWave
├── → Warehouse
├── Orders[] → Order
├── RequiredProducts[] → Product
├── RequiredMaterials[] → RawMaterial
├── ManufacturingJobs[] → ManufacturingJob
├── WavePickList → WavePickList
├── PreparedProductsPool entries[] (output)
└── ActivityEvents[]

[Owned by Loading & Allocation OS — not Operations Planning:]
ShippingWave → Vehicle[] → VehicleInventory → Logistics OS
```

---

## 14. Enterprise UX Architecture

The Operations Planning / Preparation OS follows the Enterprise UX Architecture defined in `docs/ux/`.

| Component | UX Standard |
|---|---|
| Main workspace (waves) | WORKSPACE-FRAMEWORK.md (Standard Operational) |
| Wave DataGrid | DATAGRID-STANDARD.md (grouping by status, AI insights column) |
| Wave Detail Drawer | DETAIL-DRAWER-STANDARD.md (Wide 90% — complex operational object) |
| Timeline tab | TIMELINE-UX-STANDARD.md |
| Documents tab | DOCUMENTS-UX-STANDARD.md |
| AI wave suggestions | AI-UX-STANDARD.md (EP-AI-01: Smart Action Chips; EP-AI-02: Workspace Panel) |
| Exception + SLA alerts | NOTIFICATION-UX-STANDARD.md (Exception, Alert types) |
| Mobile (warehouse floor) | MOBILE-UX-STANDARD.md |

> Full UX Architecture: `docs/ux/ENTERPRISE-UX-ARCHITECTURE.md`

---

## 15. Future Suggestions

- **Dynamic Wave Building** — AI-suggested wave groupings based on area and vehicle capacity
- **Real-time Driver App** — mobile interface for drivers to confirm deliveries
- **Warehouse Navigation** — pick path optimization based on shelf locations
- **Wave Templates** — save wave configurations for recurring daily operations
- **Predictive MRP** — use historical patterns to pre-calculate next-day requirements
