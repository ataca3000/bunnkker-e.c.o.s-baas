# Vehicle Planning Engine — Specification

**Document:** VEHICLE-PLANNING-ENGINE  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-FULFILLMENT-ARCH-002  
**ADR Reference:** ADR-015  
**Position in Platform:** After Geography Grouping — before Loading Sessions

---

## 1. Mission

> Automatically calculate the optimal number and assignment of vehicles for each geographic group, with full manual adjustment support.

The Vehicle Planning Engine takes the output of the Geography & Coverage Engine (a set of GeographyGroups, each with a zone, shipping company, and list of orders) and produces VehiclePlans — which orders go on which vehicle, ensuring no vehicle exceeds its capacity constraints.

---

## 2. Position in the Flow

```
Geography & Coverage Engine
  (output: GeographyGroups)
          ↓
Vehicle Planning Engine        ← THIS MODULE
  (output: VehiclePlans)
          ↓
Loading & Allocation OS
  (Loading Sessions, Vehicle Inventory)
```

---

## 3. Calculation Flow

```
Governorate
    ↓
Zone
    ↓
Shipping Company
    ↓
Vehicle Planning (calculate required vehicles)
    ↓
Vehicle Assignment (link to actual Vehicle records)
```

### Step-by-Step

1. **Input:** GeographyGroup (zone + shipping_company + orders[])
2. **Fetch limits:** ShippingCompany capacity constraints for this company type
3. **Split orders into vehicle slots:** distribute orders across vehicles, respecting all limits
4. **Propose VehiclePlan:** ordered list of slots, each representing one vehicle load
5. **Planner review:** planner may accept, merge, split, move orders, or create/delete slots
6. **Vehicle Assignment:** link each slot to an actual Vehicle record from the fleet
7. **Output:** Approved VehiclePlan → enters Loading & Allocation OS as ShippingWave

---

## 4. Capacity Constraints

Vehicle Planning checks **all five constraints** simultaneously. A slot violates capacity if it exceeds **any** of the five limits.

### Constraint Set

| Constraint | Source | Unit |
|---|---|---|
| `max_orders_per_vehicle` | ShippingCompany | count |
| `max_weight_per_vehicle` | ShippingCompany + Vehicle | kg |
| `max_volume_per_vehicle` | ShippingCompany + Vehicle | m³ |
| `max_stops_per_vehicle` | ShippingCompany | count |
| `max_working_hours` | ShippingCompany + Shift | hours |

**Precedence:** The most restrictive constraint determines the vehicle count. If orders = 145, max_orders = 40, but weight would only fill 3 vehicles — the order count constraint wins and 4 vehicles are required.

### Constraint Resolution Formula

```
required_by_orders  = CEIL(total_orders / max_orders_per_vehicle)
required_by_weight  = CEIL(total_weight / max_weight_per_vehicle)
required_by_volume  = CEIL(total_volume / max_volume_per_vehicle)
required_by_stops   = CEIL(total_stops / max_stops_per_vehicle)

required_vehicles   = MAX(required_by_orders, required_by_weight,
                          required_by_volume, required_by_stops)
```

### Worked Example

```
Geography Group: Cairo / Nasr City / Bosta

Orders: 145
Total Weight: 320 kg
Total Volume: 4.2 m³

Bosta Limits:
  max_orders_per_vehicle: 40
  max_weight_per_vehicle: 150 kg
  max_volume_per_vehicle: 3.0 m³
  max_stops_per_vehicle: 45
  max_working_hours: 10

Calculation:
  required_by_orders:  CEIL(145 / 40) = 4
  required_by_weight:  CEIL(320 / 150) = 3
  required_by_volume:  CEIL(4.2 / 3.0) = 2
  required_by_stops:   CEIL(145 / 45) = 4

Result: 4 vehicles required (orders + stops constraint wins)

Distribution:
  Vehicle 1: 40 orders
  Vehicle 2: 40 orders
  Vehicle 3: 40 orders
  Vehicle 4: 25 orders

Planner review required for uneven distribution (last vehicle at 63% utilization)
```

---

## 5. VehiclePlan Entity

```
VehiclePlan
├── id                    uuid
├── company_id            → Company
├── operational_day       date
├── geography_group_id    → GeographyGroup
├── shipping_company_id   → ShippingCompany
├── zone_id               → Zone
├── governorate_id        → Governorate
├── status                enum:
│                           calculating   — engine is computing
│                           proposed      — ready for planner review
│                           approved      — planner accepted
│                           dispatched    — vehicles on route
│                           completed     — all deliveries done
│                           cancelled     — plan abandoned
├── created_at            timestamp
├── approved_by           → User (nullable)
├── approved_at           timestamp (nullable)
└── slots[]               → VehiclePlanSlot[]
```

### VehiclePlanSlot Entity

```
VehiclePlanSlot
├── id                    uuid
├── vehicle_plan_id       → VehiclePlan
├── slot_number           int           — 1-indexed (Vehicle 1, Vehicle 2, ...)
├── vehicle_id            → Vehicle (nullable until assignment step)
├── driver_id             → User (nullable until assignment step)
├── orders[]              → Order[]
├── order_count           int           — computed
├── total_weight_kg       decimal(10,2) — computed
├── total_volume_m3       decimal(10,4) — computed
├── utilization_pct       decimal(5,2)  — computed: max(weight_pct, order_pct, volume_pct)
├── is_overloaded         bool          — computed: any constraint exceeded
└── notes                 string (nullable)
```

---

## 6. Order Distribution Algorithm

The engine distributes orders across vehicle slots using the **Round-Robin with Weight Balance** algorithm by default:

```
function distributeOrders(orders, vehicle_count, constraints):

    slots = create_empty_slots(vehicle_count)
    orders_sorted = orders.sortBy(weight DESC)   // heaviest first for balance

    for order in orders_sorted:
        // Find slot with most remaining capacity that can accept this order
        best_slot = slots
            .filter(slot => slot.can_accept(order, constraints))
            .minBy(slot => slot.utilization_pct)

        if best_slot is null:
            // Capacity violation — add a new slot
            new_slot = slots.add_slot()
            new_slot.add(order)
        else:
            best_slot.add(order)

    return slots
```

### Distribution Policy (configurable)

| Policy | Description | Best For |
|---|---|---|
| `round_robin_weight` | Heaviest first, fill lowest-utilization slot | Default — balanced loads |
| `geographic_proximity` | Group closest delivery addresses together | Route efficiency |
| `order_priority` | High-priority orders to first vehicle | SLA-critical channels |
| `fifo` | First-in first-out by order creation time | Standard channels |

Distribution policy is configurable per ShippingCompany.

---

## 7. Manual Planner Adjustments

After the engine proposes a VehiclePlan, the planner may make manual adjustments before approving.

### Supported Operations

| Operation | Description | Trigger |
|---|---|---|
| **Merge Vehicles** | Combine two under-filled slots into one | Two slots both below 70% utilization |
| **Split Vehicle** | Divide an overloaded slot into two | Slot exceeds any constraint |
| **Move Order** | Transfer a specific order from one slot to another | Route optimization, special handling |
| **Create Extra Vehicle** | Add a new slot manually | Rush orders, unexpected additions |
| **Delete Vehicle** | Remove an empty slot | After merging left an empty slot |
| **Assign Vehicle** | Link a slot to a specific Vehicle record | After manual selection |
| **Assign Driver** | Link a slot to a specific Driver | Before loading session opens |

**All manual adjustments are logged** with: planner_id, action_type, before_state, after_state, reason, timestamp.

---

## 8. Replanning

The Vehicle Planning Engine supports replanning at any stage before dispatch.

### Replanning Triggers

| Trigger | Description | Mode |
|---|---|---|
| `vehicle_breakdown` | Assigned vehicle becomes unavailable | Automatic + manual review |
| `driver_change` | Assigned driver becomes unavailable | Manual assignment |
| `extra_vehicle` | Additional vehicle becomes available mid-planning | Manual merge opportunity |
| `late_orders` | New orders added after plan was proposed | Re-calculate from scratch or append |
| `rush_orders` | High-priority orders arrive needing immediate assignment | Priority insertion |
| `route_change` | Geographic zone assignment changed for some orders | Re-run geography grouping |
| `manual_replan` | Planner decides to restart planning for a group | Full recalculation |
| `automatic_replan` | AI detects a better plan and suggests it | Notification + supervisor approval |

### Replanning Rules

1. Replanning always creates a new VehiclePlan version — it never overwrites the original
2. The previous VehiclePlan is archived (status → `superseded`)
3. Orders already loaded onto a vehicle **cannot** be replanned without creating a LoadingException
4. Replanning after dispatch requires explicit supervisor override with mandatory reason

---

## 9. Vehicle Assignment Step

After the planner approves the plan, each slot must be linked to an actual Vehicle record.

### Assignment Matching

The engine suggests available vehicles based on:
1. Vehicle is `available` status (not assigned to another active plan)
2. Vehicle's `capacity_weight_kg` ≥ slot's `total_weight_kg`
3. Vehicle's `capacity_volume_m3` ≥ slot's `total_volume_m3`
4. Vehicle's `vehicle_type` matches ShippingCompany's compatible types
5. If temperature-sensitive products in slot: vehicle must have `refrigerated = true`

### Assignment States

```
Slot:  no vehicle assigned
  ↓ planner assigns vehicle
Slot: vehicle proposed
  ↓ planner confirms
Slot: vehicle confirmed  →  enters Loading & Allocation OS
```

---

## 10. VehiclePlan → ShippingWave Handoff

Once a VehiclePlan is fully assigned (all slots have vehicles + drivers), it becomes the input for a ShippingWave in Loading & Allocation OS.

```
VehiclePlan (approved, fully assigned)
    → Creates ShippingWave
        ├── wave_id
        ├── vehicles = plan.slots[].vehicle_id
        ├── orders  = plan.slots[].orders[]
        ├── zone    = plan.zone_id
        └── sla_deadline = calculated from channel SLA + order created_at
```

---

## 11. Key Metrics

| Metric | Formula | Target |
|---|---|---|
| Fleet Utilization | avg(slot.utilization_pct) | > 80% |
| Overloaded Slots | count(slots where is_overloaded) | 0 |
| Planning Acceptance Rate | plans approved without modification / total plans | > 70% |
| Replanning Rate | plans replanned / total plans | < 10% |
| Slot Imbalance | max(slot.order_count) - min(slot.order_count) | < max_orders × 20% |

---

## 12. AI Integration (Future)

| Entry Point | Capability |
|---|---|
| EP-V1 | Predict optimal vehicle count before calculation (fewer iterations) |
| EP-V2 | Suggest merge candidates when utilization < threshold |
| EP-V3 | Predict breakdown probability per vehicle per trip |
| EP-V4 | Dynamic replan: detect better distribution mid-loading |
| EP-V5 | Route-aware distribution (cluster orders by geographic proximity) |

---

## 12B. Configuration Platform Dependency (TASK-CONFIGURATION-ARCH-001)

The Vehicle Planning Engine does not contain hardcoded capacity rules. All limits and distribution behavior are governed by `VehiclePolicy`.

### Policy Consumed: `VehiclePolicy`

```php
$policy = $policyEngine->resolve(VehiclePolicy::class, 'company', $companyId);
$limits = $policy->getCapacityLimits($shippingCompanyId);
// returns: max_orders, max_weight_kg, max_volume_m3, max_stops, max_working_hours
```

### Configuration Settings Governing This Engine

| Setting Key | Description |
|---|---|
| `fulfillment.vehicle.max_orders_per_vehicle` | Default maximum orders per vehicle |
| `fulfillment.vehicle.max_weight_kg` | Default weight limit |
| `fulfillment.vehicle.max_volume_m3` | Default volume limit |
| `fulfillment.vehicle.max_stops` | Default stop limit |
| `fulfillment.vehicle.distribution_algorithm` | Default distribution algorithm |
| `fulfillment.vehicle.allow_partial_loading` | Partial loading permitted |

> ShippingCompany-specific limits override these defaults. ShippingCompany limits are stored as ShippingCompany entity fields, but they are resolved through the VehiclePolicy (not hardcoded in the engine).

### Feature Flag

```
modules.vehicle_planning   — must be enabled for this engine to run
```

### Audit

Every vehicle count calculation produces a `PolicyEvaluationAudit` record. Planner adjustments (merge/split/move) each produce additional records with `actor_type = 'supervisor'`.

---

## 13. DDD Module Structure

```
Modules/
└── Operations/
    └── VehiclePlanning/
        ├── Domain/
        │   ├── Models/
        │   │   ├── VehiclePlan.php
        │   │   └── VehiclePlanSlot.php
        │   ├── Enums/
        │   │   ├── VehiclePlanStatus.php
        │   │   ├── DistributionPolicy.php
        │   │   └── ReplanTrigger.php
        │   ├── Services/
        │   │   ├── VehicleCountCalculationService.php
        │   │   └── OrderDistributionService.php
        │   └── Exceptions/
        │       ├── VehicleCapacityViolationException.php
        │       └── InsufficientVehiclesException.php
        ├── Application/
        │   ├── Services/
        │   │   ├── PlanVehiclesForGroupService.php
        │   │   ├── ApprovePlanService.php
        │   │   ├── ReplanVehiclesService.php
        │   │   └── AssignVehicleToSlotService.php
        │   └── Queries/
        │       ├── GetVehiclePlanQuery.php
        │       └── GetAvailableVehiclesQuery.php
        ├── Infrastructure/
        └── Presentation/
```
