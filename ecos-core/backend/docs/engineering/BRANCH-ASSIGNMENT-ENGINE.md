# Branch Assignment Engine — Architecture Report
**TASK-BRANCH-ASSIGNMENT-ENGINE-001 | 2026-07-21 | COMPLETE**

---

## Summary

Replaces the static `WarehouseAssignmentPolicy` table with an intelligent Branch Assignment Engine that resolves the correct fulfillment branch — and therefore warehouse — from the customer's delivery address. The pipeline is:

```
Order → Customer Address (governorate + area) → CoverageResolutionService
      → Candidate Branches → selectNearest (Haversine / priority fallback)
      → BranchWarehouseResolver → assigned_warehouse_id
      → ProcessOrderWorkflow → ReserveOrderInventoryAction → Preparing
```

---

## Root Cause Fixed

`WarehouseAssignmentEngine.assign()` required `WarehouseAssignmentPolicy` records in the database. Zero records meant `assigned_warehouse_id` stayed null. `ProcessOrderWorkflow` (line 98) checked for null warehouse and immediately set `status = AwaitingStock`, bypassing `ReserveOrderInventoryAction` entirely.

---

## Architecture

### Coverage Resolution

`BranchCoverageArea` table defines which governorates/zones each branch serves.

| `master_zone_id` | Meaning |
|---|---|
| `NULL` | Branch covers the entire governorate |
| `<uuid>` | Branch covers only that specific zone |

**Priority rule:** zone-specific matches have absolute priority over governorate-wide matches. Within the same tier, lower `priority` value wins. Candidates are sorted `priority ASC` before distance evaluation.

### Branch Selection

When multiple branches qualify for a delivery area:

1. If `order.google_maps_lat / google_maps_lng` are set AND at least one candidate has `latitude / longitude` — use Haversine formula to select the nearest branch.
2. Otherwise fall back to the first candidate (already sorted by priority ASC).

### Warehouse Resolution

`BranchWarehouseResolver` resolves a warehouse from a branch:
1. Return `branch.default_warehouse_id` if that warehouse is active.
2. Fallback: first active warehouse with the same `company_id` by created_at.
3. If no warehouse found → mark no-coverage (same signal as no branch found).

### No-Coverage Signal

When no branch covers the delivery area (or no warehouse is available after branch selection), `BranchAssignmentEngine.markNoCoverage()` sets:

```
warehouse_assignment_source       = no_branch_coverage
warehouse_assignment_failure_reason = "No Branch Covers Destination"
warehouse_assigned_at             = now()
```

**`order.status` is NOT changed.** This is an Operations triage signal, not an Inventory problem. The order stays at its current status and appears in the Operations Command Center for manual intervention.

---

## Files Delivered

### New Files

| File | Purpose |
|---|---|
| `Modules/Organization/Branches/Domain/Models/BranchCoverageArea.php` | Eloquent model for branch coverage areas |
| `Modules/Operations/Preparation/Domain/Events/BranchAssigned.php` | Domain event fired after successful assignment |
| `Modules/Operations/Preparation/Application/Services/CoverageResolutionService.php` | Resolves candidate branches from address components |
| `Modules/Operations/Preparation/Application/Services/BranchWarehouseResolver.php` | Resolves warehouse from a branch |
| `Modules/Operations/Preparation/Application/Services/BranchAssignmentEngine.php` | Orchestrates the full assignment pipeline |
| `Modules/Organization/Branches/Infrastructure/Database/Migrations/2026_07_21_100000_*.php` | Adds `default_warehouse_id`, `latitude`, `longitude` to `branches` |
| `Modules/Organization/Branches/Infrastructure/Database/Migrations/2026_07_21_100001_*.php` | Creates `branch_coverage_areas` table |
| `Modules/Operations/Preparation/Infrastructure/Database/Migrations/2026_07_21_100002_*.php` | Adds `assigned_branch_id`, `warehouse_assignment_failure_reason` to `orders`; extends CHECK constraint |
| `tests/Feature/Operations/BranchAssignmentEngineTest.php` | 4 integration scenarios (A/B/C/D) |

### Modified Files

| File | Change |
|---|---|
| `Modules/Organization/Branches/Domain/Models/Branch.php` | Added `default_warehouse_id`, `latitude`, `longitude` to fillable/casts; added `defaultWarehouse()` and `coverageAreas()` relations |
| `Modules/Commerce/Orders/Domain/Models/Order.php` | Added `assigned_branch_id`, `warehouse_assignment_failure_reason` to fillable |
| `Modules/Operations/Preparation/Domain/Enums/WarehouseAssignmentSource.php` | Added `BranchCoverage` and `NoBranchCoverage` cases; updated `label()`, `isAuto()`, added `isFailure()` |
| `Modules/Commerce/Orders/Application/Actions/CreateManualOrderAction.php` | Replaced `WarehouseAssignmentEngine` injection with `BranchAssignmentEngine` |

---

## Migrations Applied

All three migrations applied to both `ecos_erp` (production) and `ecos_erp_test` (testing):

```
2026_07_21_100000_add_location_and_default_warehouse_to_branches_table  OK
2026_07_21_100001_create_branch_coverage_areas_table                     OK
2026_07_21_100002_add_branch_assignment_to_orders_table                  OK
```

---

## Integration Tests — 4 / 4 PASS

```
PHPUnit 11.5.55  |  PHP 8.4.23  |  4 tests, 16 assertions  |  OK
```

| Scenario | Description | Result |
|---|---|---|
| **A** | Single branch covers governorate → branch + warehouse assigned, source = `branch_coverage` | **PASS** |
| **B** | Two branches both cover same area, order has GPS → nearest branch selected by Haversine | **PASS** |
| **C** | No branch covers area → `no_branch_coverage` signal, order status unchanged (NOT `awaiting_stock`) | **PASS** |
| **D** | After assignment, `ReserveOrderInventoryAction::execute()` → `ReservationStatus::Reserved` | **PASS** |

---

## Constraints Honored

- `ReserveOrderInventoryAction` — NOT modified
- `InventoryAvailabilityEngine` — NOT modified
- `ProcessOrderWorkflow` — NOT modified
- Manufacturing domain — NOT touched
- "No coverage" = Operations signal only; order status never set to `awaiting_stock` by this engine

---

## Future Compatibility

- `branch_coverage_areas` table accepts any future zone granularity (zone FK is soft — no formal FK to avoid cross-module coupling)
- `latitude / longitude` on branches enables distance-based routing for Logistics OS and Route Planning
- `WarehouseAssignmentSource::BranchCoverage` and `NoBranchCoverage` are stable enum values compatible with existing `warehouse_assignment_source` CHECK constraint
- `BranchAssigned` domain event is published on every successful assignment for future listener integration
