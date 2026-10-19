# Loading & Allocation OS — Module Specification

**Document:** LOADING-ALLOCATION-OS-SPEC  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-04  
**Task:** TASK-FULFILLMENT-ARCH-001  
**ADR Reference:** ADR-015  
**Position in Platform:** Prepared Products Pool → Loading & Allocation OS → Vehicle Mobile Warehouse

---

## 1. Mission

Loading & Allocation OS converts products from the Prepared Products Pool into Vehicle Inventory through structured, auditable Loading Sessions.

It is the **operational bridge** between warehouse preparation and vehicle dispatch.

---

## 2. Why This OS Exists

Before this module existed, vehicle loading was either:
- An afterthought at the end of a batch lifecycle
- Embedded in logistics without inventory controls

This creates problems:
- No traceable handoff between warehouse and vehicle
- No formal record of what was actually loaded vs. what was required
- Exceptions (missing products, vehicle changes) are informal
- Vehicle inventory is unknown until post-delivery reconciliation

Loading & Allocation OS solves all of these.

---

## 3. Module Decomposition

### 3.1 Shipping Wave Planning

**Purpose:** Create the master plan for a dispatch cycle — which orders go on which vehicles, targeting which regions.

**Key operations:**
- Create new shipping wave
- Add orders to wave
- Assign vehicles to wave
- Calculate vehicle requirements per wave
- Approve wave for loading
- Pause, replan, or cancel wave

**Inputs:** Orders (from Commerce), Available vehicles, Prepared Products Pool (quantities available)  
**Outputs:** Approved ShippingWave with vehicle assignments and product allocations

**Auto-planning trigger:** When AI is integrated, the system can propose a ShippingWave automatically from today's orders grouped by region and vehicle capacity.

---

### 3.1B Vehicle Planning Engine (prerequisite)

> The Vehicle Planning Engine runs before Loading & Allocation OS receives a ShippingWave.  
> See `VEHICLE-PLANNING-ENGINE.md` for full specification.

The Vehicle Planning Engine converts a GeographyGroup (zone + shipping_company + orders) into a VehiclePlan. A VehiclePlan contains one or more vehicle slots, each with a defined order list. When the planner approves the VehiclePlan and assigns vehicles, it becomes a ShippingWave — which is then the input to Loading & Allocation OS.

**What Loading & Allocation OS receives from Vehicle Planning Engine:**
- Approved ShippingWave with vehicles assigned (from VehiclePlan)
- Each vehicle slot has a defined list of orders
- Vehicle capacity constraints already validated

---

### 3.2 Vehicle Assignment

**Purpose:** Match the right vehicle to the right orders given capacity and area constraints.

> Vehicle assignment is performed by the Vehicle Planning Engine (see 3.1B). By the time Loading & Allocation OS receives a ShippingWave, vehicle assignment is already done. This module confirms the assignment and manages loading execution.

**Assignment criteria (validated by Vehicle Planning Engine):**
- Geographic match: vehicle covers the delivery region (from Geography & Coverage Engine)
- Capacity match: vehicle can carry required weight and volume
- Availability: vehicle is not committed to another wave at the same time
- Driver assignment: a driver must be linked to the vehicle before loading can begin

**Vehicle assignment states in Loading & Allocation OS:**
```
Confirmed (from Vehicle Planning Engine)
    → Loading (Loading Session opened)
    → Dispatched (Loading Session completed, wave dispatched)
    → Returned (vehicle back at warehouse)
```

**Vehicle requirement calculation:**
```
For each (wave, vehicle) pair:
  total_weight_kg     = Σ (product_weight × quantity) for all orders on vehicle
  total_volume_m3     = Σ (product_volume × quantity) for all orders on vehicle
  utilization_pct     = total_weight / capacity_weight × 100
  is_overloaded       = total_weight > capacity_weight OR total_volume > capacity_volume
```

---

### 3.3 Loading Sessions

**Purpose:** Provide a formal, tracked container for every loading operation.

**Rules:**
1. No product may move from the Prepared Products Pool to a Vehicle outside a Loading Session
2. A Loading Session must reference a specific Vehicle and a specific Shipping Wave
3. A Loading Session must have an assigned Operator (the person physically overseeing loading)
4. A Loading Session cannot be opened unless the vehicle is in `confirmed` assignment state
5. A Loading Session records both required products (from wave plan) and actually loaded products

**Session lifecycle:**
```
Planned (requirements calculated)
  ↓
Open (operator starts session)
  ↓ (products scanned / loaded one by one)
Completed (all products loaded OR session closed with exceptions)
  OR
Closed with Exceptions (loading ended but variances exist)
```

---

### 3.4 Vehicle Inventory

**Purpose:** Maintain accurate, real-time inventory for each vehicle from loading through end-of-shift reconciliation.

**When inventory is created:** When a Loading Session transfers products from the Prepared Products Pool.

**When inventory is consumed:**
- Delivery confirmed (order delivered to customer)
- End-of-shift return (undelivered products physically returned to warehouse)

**Vehicle inventory identity:** A `VehicleInventoryItem` record exists for every (vehicle, product) pair that has ever been loaded onto that vehicle on a given day. It is never deleted — only updated.

**Immutable movement log:** Every inventory change (load, deliver, return) generates a `VehicleInventoryMovement` record that cannot be modified after creation.

---

### 3.5 Partial Loading

**Purpose:** Allow a vehicle to depart with less than its full allocation without blocking the wave.

**When partial loading applies:**
- A product is missing from the Prepared Products Pool
- A vehicle's capacity is exceeded and some products must stay behind
- A loading exception blocks specific products

**Partial loading rules:**
- Partial loading is a supervisor decision, not an automatic action
- Every partial loading case requires a documented reason
- Products not loaded remain in the Prepared Products Pool with status `not_loaded_in_wave_XXXXX`
- Those products are available for reallocation to another wave or vehicle

---

### 3.6 Reallocation

**Purpose:** Move reserved products between shipping waves or between vehicles within the same wave.

**Reallocation triggers:**
- Vehicle change (the originally assigned vehicle becomes unavailable)
- Route change (orders move to a different vehicle/region)
- Capacity rebalancing (one vehicle is overfull; another has spare capacity)
- Wave merge or split

**Reallocation rules:**
- Products can only be reallocated before a Loading Session starts
- Reallocation always creates a `PreparedPoolMovement` audit record
- Reallocation does not affect actual physical inventory — only the reservation mapping

---

### 3.7 Loading Exceptions

See ADR-015 Section 5.6 for full exception type catalog.

**Exception escalation policy:**
- `blocking` severity: Loading Session cannot close; supervisor must resolve
- `warning` severity: Loading Session can close; exception recorded; supervisor notified
- `informational` severity: Recorded; no action required

---

## 4. Entity Relationships

```
OperationalDay
└── ShippingWave[]
    ├── Orders[]
    ├── Vehicles[]
    │   └── VehicleAssignment (wave_id, vehicle_id, status)
    └── LoadingSession[]
        ├── Vehicle
        ├── Operator
        ├── ProductsLoaded[]
        │   └── PreparedProductsPool (pool_entry_id — source)
        ├── RequiredProducts[]
        ├── MissingProducts[]
        └── LoadingExceptions[]

Vehicle
├── VehicleInventoryItem[] (per product)
└── VehicleInventoryMovement[] (immutable audit)
```

---

## 5. Integration Boundaries

### Upstream (reads from)
| Source | What is consumed |
|---|---|
| `PreparedProductsPool` | Products available for loading; reserved quantities |
| `VehiclePlan` (from Vehicle Planning Engine) | Approved vehicle assignments + order-to-slot mapping |
| `GeographyGroup` (from Geography & Coverage Engine) | Zone + shipping company per wave |
| `Commerce Orders` | Order assignments per wave (order IDs, quantities, delivery addresses) |
| `Warehouse` | Vehicle registry, capacity specifications |

### Downstream (writes to)
| Target | What is produced |
|---|---|
| `Vehicle.VehicleInventory` | Products transferred to vehicle |
| `PreparedPoolMovement` | Audit log of every pool transfer |
| `Logistics OS` | Loaded vehicle with inventory — handoff trigger for dispatch |

### Events emitted

| Event | When |
|---|---|
| `shipping_wave.created` | New wave planned |
| `shipping_wave.approved` | Wave approved for loading |
| `vehicle.assigned_to_wave` | Vehicle committed to a wave |
| `loading_session.opened` | Session starts |
| `loading_session.product_loaded` | Each product scan/confirmation |
| `loading_session.exception_raised` | Exception recorded |
| `loading_session.completed` | Session ends |
| `vehicle.inventory.loaded` | Vehicle inventory updated |
| `shipping_wave.loading_complete` | All vehicles in wave loaded |

---

## 6. Access Control

| Role | Permissions |
|---|---|
| **Loading Operator** | Open/close loading sessions; scan/confirm products loaded |
| **Wave Planner** | Create/modify shipping waves; assign vehicles and orders |
| **Warehouse Supervisor** | Approve waves; resolve blocking exceptions; authorize partial loading |
| **Operations Manager** | Full read/write; reallocation; wave merge/split |
| **Driver** | Read-only: view own vehicle inventory and assigned orders |

---

## 7. DDD Module Structure

```
Modules/
└── Operations/
    └── LoadingAllocation/
        ├── Domain/
        │   ├── Models/
        │   │   ├── ShippingWave.php
        │   │   ├── VehicleAssignment.php
        │   │   ├── LoadingSession.php
        │   │   ├── LoadingException.php
        │   │   ├── Vehicle.php
        │   │   ├── VehicleInventoryItem.php
        │   │   └── VehicleInventoryMovement.php
        │   ├── Enums/
        │   │   ├── WaveStatus.php
        │   │   ├── LoadingSessionStatus.php
        │   │   ├── LoadingExceptionType.php
        │   │   └── VehicleStatus.php
        │   └── Exceptions/
        │       ├── VehicleCapacityExceededException.php
        │       ├── ProductMissingFromPoolException.php
        │       └── LoadingSessionAlreadyClosedException.php
        ├── Application/
        │   ├── Services/
        │   │   ├── CreateShippingWaveService.php
        │   │   ├── OpenLoadingSessionService.php
        │   │   ├── LoadProductService.php
        │   │   ├── CloseLoadingSessionService.php
        │   │   └── ReconcileVehicleInventoryService.php
        │   └── Queries/
        │       ├── GetWaveLoadingProgressQuery.php
        │       └── GetVehicleInventoryQuery.php
        ├── Infrastructure/
        │   ├── Database/
        │   │   └── Migrations/
        │   └── Repositories/
        └── Presentation/
            └── Http/
                ├── Controllers/
                └── Resources/
```

---

## 7B. Configuration Platform Dependency (TASK-CONFIGURATION-ARCH-001)

Loading & Allocation OS consumes `VehiclePolicy` and `FulfillmentPolicy` from the Policy Engine. It does not hardcode capacity limits or exception policies.

### Policies Consumed

| Policy | Used For |
|---|---|
| `VehiclePolicy` | Capacity limits per vehicle/company, partial loading permission |
| `FulfillmentPolicy` | Exception handling behavior, which stages are active |

### Configuration Settings

| Setting Key | Description |
|---|---|
| `fulfillment.vehicle.allow_partial_loading` | Allow vehicles to depart without full load |
| `fulfillment.vehicle.max_orders_per_vehicle` | Default order limit |
| `fulfillment.vehicle.max_weight_kg` | Default weight limit |

### Feature Flag

```
modules.loading_allocation_os   — must be enabled for this module to run
modules.loading_allocation_os.replanning — must be enabled for wave replanning
```

### Audit

Every Loading Session open/close, every LoadingException raised and resolved, and every product loaded produces a `PolicyEvaluationAudit` record. The `config_version_id` is stored on the LoadingSession to enable point-in-time reconstruction.

---

## 9. Enterprise UX Architecture

The Loading & Allocation OS follows the Enterprise UX Architecture defined in `docs/ux/`.

| Component | UX Standard |
|---|---|
| Main workspace | WORKSPACE-FRAMEWORK.md (Planning Workspace variant) |
| Wave/Session grid | DATAGRID-STANDARD.md |
| Wave/Session drawer | DETAIL-DRAWER-STANDARD.md (Standard size, 70%) |
| Timeline tab | TIMELINE-UX-STANDARD.md |
| Documents tab | DOCUMENTS-UX-STANDARD.md |
| AI loading suggestions | AI-UX-STANDARD.md (EP-AI-02, EP-AI-03) |
| Exception notifications | NOTIFICATION-UX-STANDARD.md (Exception type) |
| Mobile (driver/loader) | MOBILE-UX-STANDARD.md |

> Full UX Architecture: `docs/ux/ENTERPRISE-UX-ARCHITECTURE.md`

---

## 8. What This Module is NOT

| Excluded Responsibility | Belongs To |
|---|---|
| Recipe expansion | Preparation OS |
| Product preparation work | Preparation OS |
| Packing individual orders | Packing OS |
| Route optimization | Logistics OS |
| Proof of delivery | Logistics OS |
| Delivery confirmation | Logistics OS |
| Order status updates post-delivery | Commerce Module |
| Customer notifications | Commerce Module |
