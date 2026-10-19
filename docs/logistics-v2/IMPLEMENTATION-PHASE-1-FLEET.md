# Implementation — Phase 1: Fleet Operations

**EPIC-LOG-V2-001**, architecture approved. Scope items 1–4 and 14.
Module: `backend/Modules/Logistics/Fleet` · Frontend:
`frontend/src/features/logistics/fleet` · API prefix: `/api/logistics/fleet`

---

## 1. What Fleet owns

LOG-003 owns vehicle **identity**: plate, VIN, capacity, type, fuel type,
`VehicleStatus`, documents and completed maintenance records. None of that
changes.

Fleet owns vehicle **condition**:

| Fleet owns | Stays in V1 |
|---|---|
| Lifecycle (commercial state) | `VehicleStatus` (operational state) — LOG-003 |
| Maintenance **plan** (what is due) | Maintenance **record** (what was done) — LOG-003 |
| Inspections, defects | Vehicle documents — LOG-003 |
| Odometer as a governed series | Plate, VIN, capacity, type — LOG-003 |
| Fuel transactions, efficiency | Driver↔vehicle pairing — LOG-002 |
| Operational cost ledger | Financial ledger — Accounting (D8) |

`FleetUnit` is 1:1 with `logistics_vehicles`, enforced by a unique constraint,
and holds **no vehicle attribute**. It exists rather than hanging health off the
vehicle row because the alternative means V2 columns on a V1 table, which
Directive 1 forbids.

---

## 2. Directive compliance

| # | Directive | How |
|---|---|---|
| 1 | V1 frozen | Zero V1 files modified. The only V1 touch is D1 — two nullable columns on `logistics_cities`, in the Network module's migration |
| 2 | Reuse aggregates, no duplicate master data | `fleet_units` has no plate/VIN/capacity/type/status column, asserted by `test_fleet_tables_duplicate_no_vehicle_master_data`. Company is **inherited** from the vehicle, not re-entered |
| 3 | Fleet independent of Delivery Execution | `FleetReadinessService` imports neither namespace — asserted by a source-level test. Fleet writes no `distribution_*` or `delivery_*` row |
| D2 | Don't modify `Vehicle::canBeDispatched()` | Untouched. Readiness stays at the Dispatch layer via `FleetReadinessQueryInterface`, asserted by `test_vehicle_can_be_dispatched_was_not_modified` |
| D3 | Telemetry deferred | `MaintenanceTrigger::EngineHours` exists but a plan whose *only* rule is engine hours is **rejected at configuration time** — it could never be evaluated. `OdometerSource::Telemetry` is the least-trusted source |
| D8 | Fleet owns operational cost only | `fleet_cost_entries` is an expense ledger posted onward to Accounting. Nothing touches `distribution_trip_settlements` or `distribution_payment_collections` |

### The readiness seam

`FleetReadinessQueryInterface` is declared and implemented by Fleet and will be
consumed by **Dispatch** (Phase 4). Delivery and Distribution do not bind to it —
they keep using LOG-003's `Vehicle::canBeDispatched()` exactly as today.

When a vehicle becomes unfit, Fleet publishes `VehicleBecameUnfit`. That is a
**fact**, not an instruction: Fleet never cancels a trip. Dispatch will subscribe
and decide what the fact means, and V1 commits any resulting change.

A vehicle with no `FleetUnit` returns `FitnessVerdict::noOpinion()` rather than
"unfit", so a partially onboarded fleet cannot stall dispatch.

---

## 3. Database — 16 tables + permission seed

| Migration | Table | Note |
|---|---|---|
| `100000` | `fleet_fleets` | Ownership boundary; nullable `shipping_company_id` → LOG-001 |
| `100001` | `fleet_groups` | Capability cohort |
| `100002` | `fleet_units` | **1:1 with `logistics_vehicles`**, unique on `vehicle_id` |
| `100003` | `fleet_unit_group_history` | Versioned membership, so historical cost attributes correctly |
| `100004` | `fleet_maintenance_plans` | One open plan per (unit, type) via nullable `active_flag` |
| `100005` | `fleet_maintenance_schedule_rules` | Distance / time / engine-hours |
| `100006` | `fleet_work_orders` | Carries `v1_maintenance_record_id` — the boundary receipt |
| `100007` | `fleet_inspection_templates` + `_items` | Versioned; `failure_severity` per item |
| `100008` | `fleet_inspections` + `_results` | Immutable once submitted; template version snapshotted |
| `100009` | `fleet_defects` | Critical = fitness blocker |
| `100010` | `fleet_odometer_readings` | Governed series; rejected readings retained |
| `100011` | `fleet_fuel_cards` + `fleet_fuel_transactions` | Odometer mandatory |
| `100012` | `fleet_cost_entries` | Append-only; corrections are reversals |
| `100013` | *(seed)* 10 `fleet.*` permissions | Idempotent, name-keyed |

Plus `Network/2026_07_30_000000_add_coordinates_to_logistics_cities.php` — **D1**,
nullable `latitude`/`longitude`, additive only.

**MySQL compatibility.** Schema Builder only; no partial indexes (emulated with a
nullable `active_flag`, the LOG-002 pattern); no raw UUID functions; every index
name under 64 characters.

---

## 4. Business rules

| Rule | Enforcement |
|---|---|
| BR-F1 One FleetUnit per vehicle | Unique constraint + `FleetUnitService::register` |
| BR-F2 Activation requires an approved inspection | `assertCommissioningComplete` |
| BR-F3 An open critical defect makes a vehicle unfit | `FleetReadinessService` |
| BR-F4 Overdue maintenance (past grace) blocks; merely due warns | `MaintenancePlan::isOverdue` vs `isDue` |
| BR-F5 A lapsed mandatory inspection blocks | `appendInspectionFindings` |
| BR-F6 An expired vehicle document blocks | Reads **V1** `logistics_vehicle_documents.expires_at` |
| BR-F7 A plan needs ≥1 non-telemetry rule | `MaintenanceSchedulingService::createPlan` (D3) |
| BR-F8 An inspection is immutable once submitted | `InspectionStatus::isImmutable` |
| BR-F9 A critical failure cannot be approved by its performer | `Inspection::canBeApprovedBy` |
| BR-F10 Dismissing a critical defect requires override + reason | `DefectService::dismiss` |
| BR-F11 The odometer is monotonic; rollbacks recorded not accepted | `OdometerService` (single writer) |
| BR-F12 Fuel requires an odometer reading | `FuelReconciliationService::capture` |
| BR-F13 Anomalies flag, they do not reject | Same |
| BR-F14 Completing work writes the V1 record via `VehicleMaintenanceService` | `MaintenanceSchedulingService::complete` |
| BR-F15 Cost entries are append-only; corrections are reversals | `VehicleCostService::reverse` |
| BR-F16 Retirement requires no open work orders or defects | `assertRetirable` |

Two decisions worth naming:

**Anomalies are signals, not rejections.** Most unusual fuel purchases are real.
Auto-rejecting them teaches operators to ignore the flag, which is worse than
having no flag. Only a structurally impossible transaction (no odometer) is
refused outright.

**Derived metrics return `null`, never `0`, when the input is missing.**
`cost_per_km` with unknown distance is `null` — a silent zero reads as "this
vehicle is free to run", which is exactly the confidently-wrong number that
destroys trust in a cost report.

---

## 5. API — 43 routes

All behind `auth:sanctum` plus a `permission:` gate. UUID is the public `id`.
Domain violations return **422** with a human-readable message.

| Group | Permission | Routes |
|---|---|---|
| Reference + stats | `fleet.view` | 2 |
| Units read, plans, inspections, defects, fuel, templates | `fleet.view` | 15 |
| Unit lifecycle, group, defect workflow | `fleet.manage` | 6 |
| Maintenance planning and work-order flow | `fleet.maintenance.schedule` | 6 |
| Work-order completion | `fleet.maintenance.complete` | 1 |
| Inspection perform / submit / defect report | `fleet.inspection.perform` | 3 |
| Inspection approve / reject | `fleet.inspection.approve` | 2 |
| Defect dismiss | `fleet.manage` (+ override for critical) | 1 |
| Fuel capture, odometer | `fleet.fuel.record` | 2 |
| Fuel reconcile / dispute / write-off / reject | `fleet.fuel.reconcile` | 4 |
| Cost summary | `fleet.cost.view` | 1 |

**Separation of duties** is the recurring shape — schedule vs. complete, perform
vs. approve, record vs. reconcile — following the LOG-005 POD capture/validate
precedent: evidence should not be self-certified.

---

## 6. Frontend

`/logistics/fleet` — **Fleet Dashboard**, exception-first like LOG-005's Delivery
Command Center. The default view hides retired units and the table's widest
column is *why a vehicle cannot go out*, rendered by a shared `BlockerList`.

Drawer tabs: Overview (fitness verdict + health factor bars), Maintenance (plans
with due/overdue state), Odometer (governed series, with rejected readings
visible), Cost (breakdown, with `cost_per_km` showing "not enough odometer data"
rather than a fake zero).

Mutations invalidate both the `logistics-fleet` and `logistics-vehicles` prefixes
(ADR-024) because completing immobilising work moves `VehicleStatus` through
LOG-003's service.

---

## 7. Tests

`backend/tests/Feature/Logistics/FleetModuleTest.php` — 30 tests.

Boundary coverage worth naming:

- `test_fleet_tables_duplicate_no_vehicle_master_data` — schema-level Directive 2
- `test_fleet_never_writes_distribution_or_delivery_tables` — Directive 3, data-level
- `test_the_readiness_service_does_not_depend_on_delivery_execution` — Directive 3, source-level, also asserts no telemetry read
- `test_vehicle_can_be_dispatched_was_not_modified` — D2
- `test_a_plan_cannot_depend_on_telemetry_alone` — D3
- `test_reconciling_fuel_posts_operational_cost_and_no_trip_cash` — D8
- `test_completing_a_work_order_writes_the_v1_maintenance_record` — one writer per table
- `test_a_critical_failure_cannot_be_approved_by_its_performer` — separation of duties

---

## 8. Performance considerations

| Concern | Approach |
|---|---|
| Fitness verdict on a list | `verdictForMany()` batches; the list eager-loads `maintenancePlans`, `vehicle` and defect counts to avoid N+1 |
| Fitness per row in `FleetUnitResource` | Computed from already-loaded relations; the resource never issues its own query for plans |
| Odometer lookups | Denormalised `current_odometer_km` on `fleet_units`, written only by `OdometerService`; the series stays the source of truth |
| Overdue sweep | Indexed on `(company_id, next_due_date)`; the sweep loads plans once per unit |
| Cost rollups | Indexed on `(fleet_unit_id, cost_type, incurred_on)`; monthly projections are a Phase 6 concern |
| Defect fitness check | Composite index `(fleet_unit_id, severity, status)` |

**Known hot spot.** `FleetReadinessService::verdict()` issues per-unit queries for
defects and inspections. That is fine for a drawer and acceptable for a 20-row
page, but a 500-vehicle dispatch pool will need the defect and inspection lookups
folded into `verdictForMany()`'s batch. Flagged for Phase 4, when Dispatch becomes
the heavy consumer.

---

## 9. Known issues and deviations

**Architectural deviations from the approved architecture: none.**

Two implementation notes:

1. **`fleet_units.company_id` is nullable**, mirroring `logistics_vehicles.company_id`
   which LOG-003 also allows to be null. The architecture document implied
   non-null; matching V1 was the more consistent choice and avoids a registration
   failure for unscoped reference vehicles.

2. **Default maintenance plans are seeded on registration** (routine service, oil
   change, tyre inspection). Not specified in the architecture, added so a newly
   registered unit is immediately useful rather than silently having no plans —
   which is OR-1 (data decay), the risk most likely to make Fleet fail in practice.

**Open item:** the batching hot spot in §8.
