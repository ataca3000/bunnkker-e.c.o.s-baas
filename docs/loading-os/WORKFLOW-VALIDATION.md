# Loading & Allocation OS — Business Workflow Validation

**Document:** WORKFLOW-VALIDATION  
**Version:** 1.0  
**Status:** APPROVED — Engineering Design Phase  
**Date:** 2026-07-05  
**Task:** TASK-LOAD-001  
**Parent:** BLUEPRINT.md  
**ADR Reference:** ADR-015

---

## 1. Full Workflow Overview

```
Preparation OS (completes wave)
        │
        ▼
Prepared Products Pool
  (prepared_products_pool rows — status: available)
        │
        ▼
Loading Session Created
  (company + warehouse + planning_date)
        │
        ▼
Geography Engine (already built — TASK-FULFILLMENT-ARCH-002)
  ├── Groups orders by Governorate → Zone → Sub-Zone
  ├── Matches zones to Shipping Companies via coverage rules
  └── Produces: GeographyGroups[]
        │
        ▼
Shipping Company Selection
  ├── Channel rules enforced (preferred shipping company per channel)
  ├── Coverage map checked (company serves that zone?)
  ├── Capacity constraints checked
  └── Auto-assigns or flags for manual dispatch selection
        │
        ▼
Vehicle Planning Engine (already built — TASK-FULFILLMENT-ARCH-002)
  ├── Input: GeographyGroup (zone + shipping_company + orders[])
  ├── Calculates: how many vehicles needed per group
  ├── Produces: VehiclePlan with ordered vehicle slots
  └── Status: draft → planner_review → approved
        │
        ▼
Vehicle Assignment
  ├── Each VehiclePlan slot linked to actual Vehicle record
  ├── Driver assigned to vehicle
  ├── Capacity verified (weight + volume + units)
  └── Status: unassigned → assigned → loading → loaded → released
        │
        ▼
Vehicle Loading
  ├── Products pulled from Prepared Products Pool
  ├── Pool entry status: available → loading → loaded
  ├── Vehicle Inventory record created per product per vehicle
  ├── Loading Tasks generated (which warehouse worker loads what)
  └── Loading verified (quantity scanned vs expected)
        │
        ▼
Product Allocation
  ├── Vehicle Inventory → Orders
  ├── Allocation mode per Fulfillment Profile (full_auto / manual / ai_suggested / etc.)
  ├── Priority order: Paid → COD → Deferred → Others
  ├── Produces: AllocationRecord per order per product
  └── Status: pending → allocated → partial → approved
        │
        ▼
Allocation Approval
  ├── Dispatcher reviews allocation
  ├── Partial allocations flagged
  ├── Adjustments allowed (move qty between orders)
  └── Produces approved AllocationDecision records
        │
        ▼
Vehicle Release
  ├── Route plan finalized
  ├── Driver briefed
  ├── Physical release recorded
  └── Status: loaded → released
        │
        ▼
Packing OS (optional) / Logistics OS
        │
        ▼
Delivery
```

---

## 2. Loading Session Lifecycle

### 2.1 Status Machine

```
draft ──────────────────────────────────────────► cancelled
  │
  ▼
planning  (geography engine + vehicle planning running)
  │                                              ▲
  │                              replanning ─────┤
  ▼
vehicle_assignment (vehicles assigned, loading not started)
  │
  ▼
loading (one or more vehicles in loading state)
  │
  ▼
loaded (all vehicles loaded; awaiting allocation approval)
  │
  ▼
allocation_review (allocations generated, under review)
  │
  ▼
approved (all allocations approved)
  │
  ▼
released (all vehicles released to route)
  │
  ▼
closed (session archived; manifests finalized)
```

### 2.2 Status Transition Rules

| From | To | Trigger | Guard |
|---|---|---|---|
| `draft` | `planning` | CreateLoadingSession | Pool has available products |
| `planning` | `vehicle_assignment` | All vehicle plans approved | Every GeographyGroup has a VehiclePlan |
| `vehicle_assignment` | `loading` | First vehicle begins loading | At least one VehicleAssignment in `loading` |
| `loading` | `loaded` | All vehicles loaded | All VehicleAssignments in `loaded` state |
| `loaded` | `allocation_review` | Allocate Products command | All LoadingTasks completed |
| `allocation_review` | `approved` | Approve Allocation command | Zero partial allocations OR explicit override |
| `approved` | `released` | Release Vehicle (all) | All VehicleAssignments released |
| `released` | `closed` | Close Loading Session | No open exceptions |
| `any` | `cancelled` | Cancel Loading Session | Not in `released` or `closed` state |
| `vehicle_assignment` | `planning` | Recalculate Vehicle Plan | Dispatcher-initiated |

---

## 3. Vehicle Assignment Lifecycle

### 3.1 Status Machine

```
unassigned → assigned → loading → loaded → released
                                          ↓
                                       cancelled  (only before loading)
```

### 3.2 Transition Rules

| From | To | Trigger | Guard |
|---|---|---|---|
| `unassigned` | `assigned` | Vehicle + Driver linked to slot | Vehicle available; driver available |
| `assigned` | `loading` | Load Vehicle command | Loading Session in `vehicle_assignment` or `loading` |
| `loading` | `loaded` | All LoadingTasks completed | Loaded qty = expected qty (or override applied) |
| `loaded` | `released` | Release Vehicle command | AllocationRecord for this vehicle approved |
| `assigned` | `cancelled` | Cancel assignment | No loading has started |

---

## 4. Automatic Planning Flow

### 4.1 Trigger

Automatic planning initiates when `CreateLoadingSession` is executed with `auto_plan: true`.

### 4.2 Steps

```
1. Fetch all available entries from prepared_products_pool
   (status='available', company_id match, planning_date match)

2. Resolve orders behind each pool entry
   (via order_id on pool entries)

3. Run Geography Engine
   → Group orders by zone + shipping company
   → Produce GeographyGroups[]

4. For each GeographyGroup:
   Run Vehicle Planning Engine
   → Calculate vehicle slots
   → Produce VehiclePlan (status='draft')

5. Auto-approve VehiclePlan if Fulfillment Profile has auto_approve_vehicle_plans=true
   Otherwise status stays 'planner_review' awaiting dispatcher

6. Publish: VehiclePlanned event per plan
```

### 4.3 Failure Modes

| Scenario | Handling |
|---|---|
| No products in pool | Session blocked; exception raised `NO_POOL_ENTRIES` |
| Geography Engine cannot classify an order | Order flagged as `geography_unresolved`; session continues without it |
| No shipping company covers a zone | Zone flagged as `coverage_gap`; dispatcher must resolve manually |
| Vehicle planning produces more vehicles than available | Excess slots remain `unassigned`; dispatcher must resolve |

---

## 5. Manual Override Flow

The system allows full manual override at every planning step.

### 5.1 Dispatcher Override Points

| Stage | Override Action | Result |
|---|---|---|
| Vehicle Plan | Merge two vehicle slots | Fewer vehicles, higher load per vehicle |
| Vehicle Plan | Split one slot | More vehicles, lower load |
| Vehicle Plan | Move an order | Order reassigned to different slot/vehicle |
| Vehicle Plan | Delete a slot | Orders redistributed or flagged |
| Vehicle Assignment | Replace vehicle | Different physical vehicle assigned |
| Vehicle Assignment | Replace driver | Different driver assigned |
| Loading | Override loaded qty | Qty discrepancy recorded with reason |
| Allocation | Override allocation | Dispatcher manually assigns qty per order |
| Allocation | Move qty between orders | Inter-order adjustment recorded |

### 5.2 Audit Requirements for Overrides

Every manual override must record:
- Actor ID (who did it)
- Reason (free text, required for qty overrides)
- Before state (snapshot)
- After state (snapshot)
- Timestamp

All overrides are written to both the Audit Log and the Timeline.

---

## 6. Replanning Flow

Replanning is triggered when pool entries change after initial planning (additional preparation wave completes, or orders cancelled).

### 6.1 Replanning Scope

- Only allowed while Loading Session is in `planning` or `vehicle_assignment` state
- Not allowed once any vehicle is in `loading` state or later

### 6.2 Replanning Steps

```
1. Dispatcher issues: POST /api/v1/loading/vehicle-plans/{id}/recalculate

2. System fetches current pool state (additions/removals since last plan)

3. Re-runs Vehicle Planning Engine for the affected GeographyGroup

4. Produces new VehiclePlan (previous plan soft-deleted; new plan draft)

5. All unstarted VehicleAssignments for the recalculated plan are reset to 'unassigned'

6. Publishes: VehiclePlanRecalculated event

7. Planner reviews new plan
```

### 6.3 Replanning Constraints

- Vehicle slots that are already in `loading` or later are immutable
- Only slots in `unassigned` or `assigned` state can be reset
- If an order was removed from a slot that is in `loading`, a `LoadingException` is raised for manual resolution

---

## 7. Partial Allocation Handling

### 7.1 What Causes Partial Allocation

Partial allocation occurs when:
- Vehicle inventory for a product is less than the total ordered quantity across all orders on that vehicle
- An order requires a product that is not present on the vehicle at all

### 7.2 Resolution Options

| Option | Description | Who |
|---|---|---|
| Accept partial | Order receives less than ordered; shortage recorded | Dispatcher |
| Substitute | Different product allocated (requires approval) | Dispatcher |
| Defer order | Order removed from this vehicle; re-queued for next session | Dispatcher |
| Override and proceed | Dispatcher acknowledges shortage and approves anyway | Dispatcher (with reason) |
| Return to pool | Excess pool entries returned; shortage flagged to Preparation OS | System |

### 7.3 Partial Allocation Data Model

```
AllocationRecord.status = 'partial'
AllocationRecord.quantity_requested = 5.0
AllocationRecord.quantity_allocated = 3.0
AllocationRecord.shortage_qty = 2.0
AllocationRecord.partial_resolution = 'accepted' | 'deferred' | 'substituted'
AllocationRecord.partial_notes = "Customer accepted partial per phone"
```

---

## 8. Vehicle Capacity Enforcement

### 8.1 Capacity Dimensions

Every vehicle has capacity limits in three dimensions:

| Dimension | Field | Unit | Enforced at |
|---|---|---|---|
| Max orders | `max_orders_count` | count | Vehicle Planning Engine |
| Max weight | `max_weight_kg` | kilograms | Vehicle Planning Engine + Loading |
| Max volume | `max_volume_m3` | cubic meters | Vehicle Planning Engine + Loading |
| Max SKUs | `max_sku_count` | distinct SKUs | Vehicle Planning Engine |
| Max line items | `max_line_items` | count | Vehicle Planning Engine |
| Min value | `min_order_value` | currency | Vehicle Planning Engine |
| Max value | `max_collection_value` | currency | Vehicle Planning Engine |

### 8.2 Soft vs Hard Limits

| Type | Behaviour |
|---|---|
| Hard limit | Cannot be exceeded; system blocks the operation |
| Soft limit | System warns; dispatcher may override with reason |

Weight and volume are hard limits. Order count and value thresholds are soft limits by default (configurable in Fulfillment Profile).

### 8.3 Capacity Checking

Capacity is checked at:
1. Vehicle Plan generation (at slot level — total per slot must fit)
2. Assign Orders command (per-order addition validates running total)
3. Load Vehicle command (physical loading confirms qty matches plan)

If capacity is exceeded at loading time, a `CapacityException` is raised and loading is paused.

---

## 9. Route Constraints

### 9.1 Constraints Enforced

| Constraint | Source | Applied at |
|---|---|---|
| Zone coverage | ShippingCompany.coverage_zones | Geography Engine |
| Maximum route distance | ShippingCompany.max_route_km | Vehicle Planning |
| Maximum stops | ShippingCompany.max_stops_per_route | Vehicle Planning |
| Time window | Order.delivery_window_start / _end | Route Planning |
| Driver working hours | Driver.shift_end_time | Route Planning |
| Vehicle service area | Vehicle.service_area_ids | Vehicle Assignment |

### 9.2 Route Constraint Violations

If a route constraint violation is detected:
1. The affected order is flagged with `route_constraint_violation`
2. The violation is recorded with constraint type + value + limit
3. The dispatcher is notified via the Exceptions panel
4. The dispatcher may: reassign the order, extend the window (with approval), or defer

---

## 10. Shipping Company Policy Enforcement

### 10.1 Policies Enforced Automatically

| Policy | Description |
|---|---|
| Minimum shipment value | Orders below minimum value blocked from that shipping company |
| Maximum COD value | COD orders above limit refused; must use paid method |
| Restricted SKUs | Certain products cannot ship with certain companies |
| Prohibited zones | Certain zones not served by certain companies |
| Vehicle type requirements | Some products require refrigeration or special vehicles |

### 10.2 Policy Violation Handling

Policy violations raise a `ShippingPolicyException` stored in `loading_exceptions`. The dispatcher must resolve each exception before the session can proceed to `vehicle_assignment` state.

---

## 11. Engineering Validation Checklist

| Validation Point | Status |
|---|---|
| Pool entries consumed atomically (no double-loading) | ✅ Enforced via pool status state machine: available → loading → loaded |
| Vehicle capacity checked at plan + at loading | ✅ Both checkpoints designed |
| Allocation sum ≤ vehicle inventory per product | ✅ Enforced in AllocationEngine |
| No order allocated more than it ordered | ✅ quantity_allocated ≤ quantity_required (hard constraint) |
| Status transitions are one-directional (no rollback to earlier status) | ✅ Except explicit replanning flow |
| Manual overrides audited with actor + reason | ✅ Audit log + Timeline |
| Partial allocations require explicit dispatcher acknowledgement | ✅ Status stays 'partial' until resolved |
| Cancelled sessions release pool entries back to 'available' | ✅ Compensating action in CancelLoadingSessionAction |
| Loading tasks must all complete before 'loaded' status | ✅ Enforced in LoadVehicleAction |
| Driver assignment validated against driver availability | ✅ Checked via DriverAvailabilityService |
