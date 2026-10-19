# Vehicle Architecture — Mobile Warehouse Specification

**Document:** VEHICLE-ARCHITECTURE-SPEC  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-04  
**Task:** TASK-FULFILLMENT-ARCH-001  
**ADR Reference:** ADR-015

---

## 1. Core Principle

> Every vehicle that participates in a loading operation is a **Mobile Warehouse**.

A vehicle is not merely a transportation object. Once loaded, a vehicle carries enterprise inventory that is:

- Tracked by product and quantity
- Traceable to its origin (which preparation wave, which pool entry)
- Updated in real time as deliveries are confirmed
- Reconciled at end of shift with no unaccounted variance

This means the ECOS inventory traceability chain does not end at the loading dock. It extends to the customer's door.

---

## 2. Vehicle Entity Design

```
Vehicle
├── id                            uuid
├── company_id                    → Company
├── warehouse_id                  → Warehouse (home warehouse)
├── registration_number           string (plate number)
├── vehicle_type                  enum: van | truck | motorcycle | refrigerated_van | refrigerated_truck | other
├── make                          string (optional)
├── model                         string (optional)
├── year                          int (optional)
│
├── capacity_weight_kg            decimal(10,2)   — maximum load weight
├── capacity_volume_m3            decimal(10,4)   — maximum load volume
├── refrigerated                  bool            — temperature-controlled capability
│
├── status                        enum:
│                                   available     — not assigned to any current wave
│                                   loading       — Loading Session open
│                                   in_transit    — dispatched, on route
│                                   returning     — heading back to warehouse
│                                   maintenance   — unavailable for operations
│                                   inactive      — decommissioned
│
├── assigned_driver_id            → User (nullable — changes per trip)
│
└── is_active                     bool
```

---

## 3. Vehicle Inventory Model

Each vehicle has its own inventory ledger. This ledger is initialized when loading begins and closed when the vehicle is reconciled at end of shift.

### VehicleInventoryItem (current state)

```
VehicleInventoryItem
├── id
├── vehicle_id                    → Vehicle
├── trip_date                     date       — operational day this inventory belongs to
├── product_id                    → Product
├── quantity_loaded               decimal(18,4)   — total loaded today
├── quantity_delivered            decimal(18,4)   — confirmed delivered today
├── quantity_returned             decimal(18,4)   — physically returned to warehouse today
├── quantity_on_hand              decimal(18,4)   — computed: loaded - delivered - returned
├── last_updated_at               timestamp
└── loading_session_id            → LoadingSession (most recent session that loaded this product)
```

`quantity_on_hand` is always computed — never stored directly. Any attempt to set it directly is a bug.

### VehicleInventoryMovement (immutable log)

```
VehicleInventoryMovement
├── id
├── vehicle_id                    → Vehicle
├── product_id                    → Product
├── trip_date                     date
├── movement_type                 enum:
│                                   loaded      — product added to vehicle from pool
│                                   delivered   — product removed from vehicle (delivery confirmed)
│                                   returned    — product removed from vehicle (returned to warehouse)
│                                   adjusted    — supervisor correction (rare; requires reason)
├── quantity                      decimal(18,4)   — always positive; direction given by movement_type
├── reference_type                enum: loading_session | order | return | adjustment
├── reference_id                  uuid
├── actor_id                      → User
├── recorded_at                   timestamp
└── notes                         string (nullable; required for 'adjusted' type)
```

**Immutability guarantee:** VehicleInventoryMovements are never deleted or modified after creation.  
An incorrect movement is corrected by creating an `adjusted` counter-movement with a documented reason.

---

## 4. Inventory Flow Through the Vehicle

```
PREPARED PRODUCTS POOL
        │
        │  LoadingSession transfers products
        │  PreparedPoolMovement(movement_type: loaded) created
        │  VehicleInventoryMovement(movement_type: loaded) created
        │  VehicleInventoryItem.quantity_loaded += qty
        ▼
VEHICLE INVENTORY
        │
        │  Product Allocation Engine runs (see PRODUCT-ALLOCATION-ENGINE.md)
        │  OrderAllocation records created: vehicle inventory → order manifests
        │
   ┌────┴─────────────────────────────────────┐
   │                                          │
   │ (delivery confirmed)                     │ (end of shift — not delivered)
   │  VehicleInventoryMovement                │  VehicleInventoryMovement
   │  (movement_type: delivered)              │  (movement_type: returned)
   │  VehicleInventoryItem                    │  VehicleInventoryItem
   │  .quantity_delivered += qty              │  .quantity_returned += qty
   │  OrderAllocation                         │
   │  .quantity_delivered += qty              │
   ▼                                          ▼
CUSTOMER RECEIVED                     WAREHOUSE STOCK (returned)
```

### Allocation Quantities on VehicleInventoryItem

After the Product Allocation Engine runs, each `VehicleInventoryItem` has a corresponding set of `OrderAllocation` records:

```
VehicleInventoryItem.quantity_loaded
  = SUM of OrderAllocation.quantity_allocated for this product
  + unallocated remainder (if any — only if partial allocation allowed)
```

`quantity_delivered` is updated by Logistics OS as each delivery is confirmed.

---

## 5. Capacity Model

### Weight Constraint

```
current_load_weight = Σ (product.weight_per_unit × VehicleInventoryItem.quantity_on_hand)
remaining_weight_capacity = vehicle.capacity_weight_kg - current_load_weight
is_overweight = current_load_weight > vehicle.capacity_weight_kg
```

### Volume Constraint

```
current_load_volume = Σ (product.volume_per_unit_m3 × VehicleInventoryItem.quantity_on_hand)
remaining_volume_capacity = vehicle.capacity_volume_m3 - current_load_volume
is_over_volume = current_load_volume > vehicle.capacity_volume_m3
```

The Loading & Allocation OS checks both constraints before approving a vehicle assignment and before confirming each product load in a Loading Session.

### Temperature Constraint

For temperature-sensitive products:
- Product must have `requires_refrigeration = true`
- Vehicle must have `refrigerated = true`
- If constraint not met, vehicle assignment is blocked with exception type `vehicle_incompatible`

---

## 6. Driver Assignment

A driver is assigned to a vehicle per trip (not permanently). The driver link is through the loading session and shipping wave — not on the vehicle record itself.

```
VehicleTrip (conceptual — part of ShippingWave)
├── wave_id                       → ShippingWave
├── vehicle_id                    → Vehicle
├── driver_id                     → User
├── trip_date                     date
├── departure_time_planned        timestamp
├── departure_time_actual         timestamp (nullable)
├── return_time_actual            timestamp (nullable)
└── status                        enum: assigned | loading | dispatched | returned | reconciled
```

A vehicle cannot be dispatched without a confirmed driver assignment.  
If the assigned driver is unavailable at loading time, exception type `driver_missing` is raised.

---

## 7. Route Assignment

Vehicle routes are managed by Logistics OS. From the vehicle perspective:

```
VehicleRoute (owned by Logistics OS)
├── vehicle_id                    → Vehicle
├── wave_id                       → ShippingWave
├── trip_date                     date
├── stops[]                       → DeliveryStop[]
│   ├── order_id                  → Order
│   ├── address                   (snapshot from order)
│   ├── sequence                  int
│   ├── planned_arrival           timestamp
│   ├── actual_arrival            timestamp (nullable)
│   └── status                    enum: pending | arrived | completed | failed
├── total_distance_km             decimal(8,2)
├── estimated_duration_minutes    int
└── status                        enum: planned | in_progress | completed | abandoned
```

Vehicle knows which route is assigned. Logistics OS owns route execution.

---

## 8. End-of-Shift Reconciliation

At end of shift, every vehicle's inventory must balance to zero variance.

### Reconciliation Process

1. Driver returns to warehouse with vehicle
2. Loading & Allocation OS opens a Reconciliation session
3. Warehouse team physically counts returned products
4. System compares:
   - `quantity_loaded` (what went out)
   - `quantity_delivered` (what was confirmed delivered during the day)
   - `quantity_returned` (what came back physically)
5. System calculates: `variance = quantity_loaded - quantity_delivered - quantity_returned`
6. If `variance = 0`: Reconciliation auto-approved
7. If `variance ≠ 0`: Supervisor must investigate and either:
   - Record a late delivery confirmation (delivery happened but wasn't confirmed in real time)
   - Record a written-off loss (with reason and approver)
   - Flag for investigation

### Reconciliation Entity

```
VehicleShiftReconciliation
├── id
├── vehicle_id                    → Vehicle
├── wave_id                       → ShippingWave
├── trip_date                     date
├── reconciled_by                 → User
├── approved_by                   → User (nullable — required if variance ≠ 0)
├── products[]
│   ├── product_id
│   ├── quantity_loaded
│   ├── quantity_delivered
│   ├── quantity_returned
│   ├── variance                  (computed)
│   └── variance_resolution       enum: balanced | late_confirmed | written_off | under_investigation
├── has_variance                  bool (computed)
├── variance_notes                text (nullable)
└── reconciled_at                 timestamp
```

---

## 9. Multi-Load Support

A vehicle may receive multiple loading sessions in a single operational day (e.g., a second trip after the first reconciliation). Each Loading Session is independent:

- A vehicle may have many `VehicleInventoryItem` rows per day (one per trip)
- `VehicleInventoryMovement` rows are all linked to the same vehicle but to different loading sessions
- Each reconciliation covers one specific wave/trip combination

---

## 10. Timeline View

The Vehicle Timeline provides a chronological audit of a vehicle's operational day:

```
Vehicle Timeline (ordered by timestamp)

06:00  Vehicle status → loading
06:00  Loading Session #001 opened (operator: Ahmed)
06:05  Loaded: Honey 500g × 420 units
06:08  Loaded: Coffee Blend × 180 units
06:10  Loaded: Medjool Dates × 95 units
06:11  Exception raised: short_loading for Honey 500g (required 450, loaded 420)
06:12  Exception resolved: supervisor approved short load
06:15  Loading Session #001 completed
06:20  Driver assigned: Khaled
06:21  Vehicle status → in_transit
06:21  ShippingWave #WAVE-2026-00045 → dispatched
08:30  Delivery confirmed: Order #ORD-00234 (stop 1)
09:15  Delivery confirmed: Order #ORD-00235 (stop 2)
       ... (more deliveries)
17:30  Vehicle status → returning
18:00  Vehicle status → available
18:05  End-of-shift reconciliation opened
18:20  Reconciliation completed (0 variance)
18:21  Vehicle status → available
```

---

## 11. Integration with Other Modules

| Module | Interaction | Direction |
|---|---|---|
| **Loading & Allocation OS** | Creates vehicle inventory via Loading Sessions | OS → Vehicle |
| **Logistics OS** | Reads vehicle inventory; confirms deliveries; writes VehicleInventoryMovements | Bidirectional |
| **Preparation OS** | Reads vehicle type for capacity planning | Read-only |
| **Channel Fulfillment Engine** | Reads vehicle inventory status for profile stage decisions | Read-only |
| **Packing OS** | Some profiles pack at the vehicle (pack_during_loading mode) | Packing OS → Vehicle |

---

## 12. Vehicle Module: DDD Structure

```
Modules/
└── Operations/
    └── Vehicles/
        ├── Domain/
        │   ├── Models/
        │   │   ├── Vehicle.php
        │   │   ├── VehicleInventoryItem.php
        │   │   └── VehicleInventoryMovement.php
        │   ├── Enums/
        │   │   ├── VehicleStatus.php
        │   │   ├── VehicleType.php
        │   │   └── InventoryMovementType.php
        │   └── Exceptions/
        │       ├── VehicleCapacityExceededException.php
        │       ├── VehicleNotAvailableException.php
        │       └── VehicleInventoryVarianceException.php
        ├── Application/
        │   ├── Services/
        │   │   ├── LoadVehicleInventoryService.php      (called by Loading Session)
        │   │   ├── ConfirmDeliveryService.php           (called by Logistics OS)
        │   │   ├── ReturnVehicleInventoryService.php    (called at end of shift)
        │   │   └── ReconcileVehicleService.php
        │   └── Queries/
        │       ├── GetVehicleInventoryQuery.php
        │       ├── GetVehicleTimelineQuery.php
        │       └── GetVehicleCapacityStatusQuery.php
        ├── Infrastructure/
        └── Presentation/
```

---

## 12B. Configuration Platform Dependency (TASK-CONFIGURATION-ARCH-001)

The Vehicle module is governed by `VehiclePolicy` resolved from the Enterprise Configuration Platform. Capacity limits, partial-loading permissions, and reconciliation tolerance are all policy-driven — never hardcoded.

### Policy Consumed: `VehiclePolicy`

```php
$policy = $policyEngine->resolve(VehiclePolicy::class, 'company', $companyId);
$result = $ruleEngine->evaluate($policy, [
    'vehicle'     => $vehicle,
    'wave'        => $wave,
    'loaded_weight_kg' => $totalWeightKg,
], 'vehicle_capacity_check');
// Returns: { decision: { is_overloaded: false, utilization_pct: 87.4 }, reason: "Within capacity limits", ... }
```

### Configuration Settings

| Setting Key | Description |
|---|---|
| `fulfillment.vehicle.default_capacity_weight_kg` | Default capacity when vehicle record has no override |
| `fulfillment.vehicle.default_capacity_volume_m3` | Default volume capacity |
| `fulfillment.vehicle.allow_partial_loading` | Whether vehicles may depart without full load |
| `fulfillment.vehicle.reconciliation_variance_tolerance_pct` | Auto-approve reconciliation if variance is within this threshold |
| `fulfillment.vehicle.require_driver_before_dispatch` | Block dispatch if no driver assigned |

### Feature Flag

```
modules.vehicle_warehouse   — must be enabled for vehicle inventory tracking to run
```

### Audit

Every `VehicleInventoryMovement` (loaded / delivered / returned / adjusted) and every `VehicleShiftReconciliation` reference the `PolicyEvaluationAudit` record for the VehiclePolicy in effect. The `config_version_id` is stored on the reconciliation to enable point-in-time variance review.
