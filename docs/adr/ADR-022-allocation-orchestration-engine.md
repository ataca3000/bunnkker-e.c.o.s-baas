# ADR-022: Allocation Orchestration Engine

**Status:** Accepted  
**Date:** 2026-07-11  
**Authors:** Platform Engineering  
**Scope:** Operations / Loading module  
**Related:** ADR-015 (Enterprise Fulfillment), ADR-011 (Event-Driven)

---

## Context

ADR-015 defines the canonical fulfillment lifecycle:

```
Order → Reservation → Preparation → PreparedPool → AllocationRecord → Loading → Dispatch → Delivered
```

The `PreparedPool` (produced by `CompleteWaveAction`) and the `AllocationRecord` (consumed by `LoadVehicleWorkflow` for dispatch) are two separate domain objects. Before this ADR, nothing automatically created `AllocationRecord` rows from pool data. The gap meant:

- `LoadVehicleWorkflow` queried `AllocationRecord` to find which orders to dispatch — finding nothing.
- Dispatch silently shipped zero orders.
- Multi-vehicle sessions had no mechanism to partition orders by vehicle.
- Partial fulfillment (not enough stock for all lines) was unhandled.

The fix must be **automatic**, **policy-driven**, **idempotent**, and support **multi-vehicle** and **multi-company** scenarios without any manual operator step.

---

## Decision

When a `LoadingSession` transitions from `loading_complete → allocating`, the system automatically generates one `AllocationRecord` per `(VehicleAssignment, OrderLine)` pair — deriving the orders from the preparation wave(s) that supplied the vehicle's physical load.

### Three-Layer Architecture

```
StartAllocationAction
  └─▶ AllocatePoolToSessionAction   (orchestrator)
        └─▶ AutoAllocationService   (core engine)
              ├─▶ AllocationPolicyService     (read-only policy decisions)
              ├─▶ AllocationDecisionChainService  (audit trail)
              └─▶ VehicleInventoryService     (quantity earmarking)
```

#### `AllocationPolicyService`

Read-only. Consults feature flags and `configuration_versions` for company-specific overrides:

| Policy | Default | Override |
|---|---|---|
| `allowsPartialAllocation` | `true` | feature flag `loading.strict_allocation` |
| `maxPartialTolerancePct` | `1.0` (100 %) | config `loading.allocation.max_partial_pct` |
| `useVehiclePlanSlots` | `false` | feature flag `loading.use_vehicle_plan_slots` |
| `priorityAllocationEnabled` | `true` | feature flag `loading.disable_priority_allocation` |
| `defaultMode` | `AllocationMode::FullAuto` | config `loading.allocation.default_mode` |

#### `AutoAllocationService` — Algorithm

Per `VehicleAssignment`:

1. Query `VehicleInventoryItem` for products with `quantity_unallocated > 0`.
2. Derive preparation wave IDs from `LoadingTask.preparation_wave_id` (the critical bridge).
3. Resolve eligible orders:
   - **Slot mode** (policy flag + `vehicle_plan_slot_id` set): `VehiclePlanSlotOrder` rows for the slot, ordered by `stop_sequence`.
   - **Wave mode** (default): `PreparationWaveOrder` rows for the wave(s), ordered by `preparation_priority` (ASC = highest priority).
4. For each order × each matching `OrderLine`:
   - Skip if `AllocationRecord` already exists for `(vehicle_assignment_id, order_line_id)` — idempotent.
   - `lockForUpdate()` on `VehicleInventoryItem` — thread-safe.
   - Compute `qty_allocated = min(qty_requested, qty_unallocated)`.
   - If partial and not allowed → skip.
   - If partial shortage > tolerance → skip.
   - Create `AllocationRecord` with `allocation_mode = PartialAuto | FullAuto`.
   - Call `AllocationDecisionChainService.recordSystemAllocation()` — creates `AllocationDecision` with `revision_number=1, actor_type=system`.
   - Call `VehicleInventoryService.allocate()` — deducts `quantity_unallocated`, appends `VehicleInventoryMovement`.

All writes for one `VehicleAssignment` run inside a single `DB::transaction()`.

---

## Order Resolution Strategy

| Scenario | Strategy |
|---|---|
| `vehicle_plan_slot_id IS NULL` | Wave-mode: all wave orders, sorted by `preparation_priority` |
| `vehicle_plan_slot_id` set + flag off | Wave-mode (flag wins) |
| `vehicle_plan_slot_id` set + flag on | Slot-mode: only `VehiclePlanSlotOrder` for the slot |

---

## Partial Allocation Handling

| Condition | Outcome |
|---|---|
| `qty_available >= qty_requested` | Full allocation; `is_partial = false`; `mode = FullAuto` |
| `qty_available < qty_requested` AND `allowsPartial = true` AND shortage ≤ tolerance | Partial; `is_partial = true`; `mode = PartialAuto`; `partial_reason` recorded |
| `qty_available < qty_requested` AND partial not allowed | Skip line; `skipped_count++` |
| `qty_available < qty_requested` AND shortage > tolerance | Skip line; `skipped_count++` |
| `qty_available = 0` on vehicle | Skip line; `skipped_count++` |

---

## Multi-Vehicle Support

`allocateSession()` iterates every `VehicleAssignment` in the session independently. Each assignment locks and modifies only its own `VehicleInventoryItem` rows. Orders can appear on multiple assignments (partial multi-vehicle fulfillment) — the unique constraint is `(vehicle_assignment_id, order_line_id)`, not `(session_id, order_line_id)`.

---

## Idempotency

Re-invoking `AutoAllocationService.allocateSession()` on a session that already has `AllocationRecord` rows is safe:
- Inner `AllocationRecord::where(...)->exists()` check skips existing `(assignment, order_line)` pairs.
- `VehicleInventoryItem.quantity_unallocated` is already 0 after the first run → outer product-filter short-circuits.
- Result: `records_created = 0`, `skipped_count = 0`.

---

## Integration Point with Dispatch

`LoadVehicleWorkflow` derives the order set for dispatch via:
```php
AllocationRecord::where('vehicle_assignment_id', $assignment->id)
    ->distinct()
    ->pluck('order_id');
```

This query now returns data from the first allocation run — closing the gap that caused zero-order dispatches.

---

## Files Changed

| File | Change |
|---|---|
| `Modules/Operations/Loading/Application/Services/AllocationPolicyService.php` | **New** — policy decisions |
| `Modules/Operations/Loading/Application/Services/AutoAllocationService.php` | **New** — core allocation engine |
| `Modules/Operations/Loading/Application/Actions/AllocatePoolToSessionAction.php` | **New** — thin orchestrator |
| `Modules/Operations/Loading/Application/Actions/StartAllocationAction.php` | **Modified** — injects and calls `AllocatePoolToSessionAction` |
| `Modules/Operations/Loading/Infrastructure/Providers/LoadingServiceProvider.php` | **Modified** — registers 3 new singletons |

---

## Validation Results

E2E test (`e2e_alloc.php`) — 16/16 assertions passed:

| Check | Result |
|---|---|
| Session → `allocating` after `StartAllocationAction` | PASS |
| 1 `AllocationRecord` created | PASS |
| `order_id` correct | PASS |
| `product_id` matches order line | PASS |
| `quantity_requested` = line quantity (5) | PASS |
| `quantity_allocated` = full (no shortage) | PASS |
| `quantity_remaining` = allocated | PASS |
| `is_partial` = false | PASS |
| `allocation_mode` = `full_auto` | PASS |
| `status` = `allocated` | PASS |
| `allocated_by` = `system` | PASS |
| `AllocationDecision` created (actor=system) | PASS |
| `VehicleInventoryItem.quantity_unallocated` = 0 | PASS |
| `VehicleInventoryItem.quantity_allocated` = 5 | PASS |
| Idempotency: re-run creates 0 records | PASS |
| Session → `allocated` after `CompleteAllocationAction` | PASS |

---

## Consequences

**Positive:**
- The PreparedPool → AllocationRecord gap is permanently closed.
- Dispatch (`LoadVehicleWorkflow`) now finds orders on every session without manual data entry.
- Partial fulfillment, multi-vehicle, and priority ordering are all handled automatically.
- Fully idempotent — safe to re-trigger on retry or crash recovery.
- Multi-company isolation via `company_id` scoping on every query.

**Constraints:**
- `AllocationRecord` rows are created by `StartAllocationAction` — they do not exist before that transition.
- Manual overrides (human operator reassigning a line to a different vehicle) require a new `AllocationDecision` via `AllocationDecisionChainService.recordManualOverride()` — not handled by this engine.
- Feature flags are company-scoped; changing a flag does not retroactively alter existing `AllocationRecord` rows.
