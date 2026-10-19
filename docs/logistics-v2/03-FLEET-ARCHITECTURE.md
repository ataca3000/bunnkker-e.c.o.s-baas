# §3 — Fleet Architecture

**Directive 3 governs this entire document:** Fleet Operations is independent of
Delivery Execution. Fleet must be fully operable with Distribution and Delivery
switched off.

---

## 3.1 What Fleet owns, and what it must not

V1's `logistics_vehicles` already holds identity and static capability: plate,
type, capacity, fuel type, manufacturer, model, year, VIN, `status`, and the
company/branch/shipping-company scope. LOG-003 also owns
`logistics_vehicle_maintenance_records` (what was *done*) and
`logistics_vehicle_documents` (with `expires_at`).

Fleet adds the operational layer on top and nothing else:

| Fleet owns | Fleet must never own |
|---|---|
| Condition, health, defects | Plate, VIN, capacity, type |
| Maintenance *plan* (what is due) | Maintenance *record* (what was done — V1) |
| Inspections and their outcomes | Vehicle documents (V1) |
| Fuel transactions and efficiency | Driver↔vehicle pairing (LOG-002) |
| Odometer as a governed series | Vehicle `status` transitions (LOG-003's `VehicleStatus`) |
| Cost ledger per vehicle | Trip or delivery state |

The last row on the left needs care. LOG-003 owns `VehicleStatus`
(`available` → `assigned` → `in_delivery` → `maintenance` → `out_of_service` →
`archived`) and its transition map. Fleet does **not** get a second status field.
Fleet computes a *fitness verdict*; when that verdict says a vehicle must come off
the road, Fleet calls LOG-003's `VehicleService` to move the status to
`maintenance` or `out_of_service`. One status, one owner.

---

## 3.2 Fleet hierarchy

Enterprise operations group vehicles in ways V1 does not model. Fleet adds a
grouping layer that is purely organisational — it holds no vehicle attributes.

```
Company
└── Fleet                     (e.g. "Cairo Own Fleet", "Delta 3PL Fleet")
    ├── FleetGroup            (e.g. "Refrigerated", "Light Vans")
    │   └── FleetUnit ──1:1──▶ logistics_vehicles   (V1, unchanged)
    └── FleetGroup
```

| Level | Purpose | Notes |
|---|---|---|
| `Fleet` | Ownership + operating model boundary | Own vehicles vs. a carrier's; scoped to company, optionally to `shipping_company_id` |
| `FleetGroup` | Capability cohort | Drives which maintenance template and inspection checklist apply |
| `FleetUnit` | The operational shadow of one vehicle | Exactly one per vehicle; created by `FleetUnitFactory` |

A vehicle belongs to exactly one FleetUnit, and a FleetUnit to exactly one
FleetGroup at a time. Group membership is versioned so historical cost reports
attribute to the group that was in force at the time.

**Why FleetUnit exists at all.** It would be simpler to hang health off the
vehicle row. It would also mean V2 columns on a V1 table, a V1 module that
suddenly needs V2 concepts, and a violation of P1. FleetUnit is the seam that
keeps V1 closed.

---

## 3.3 Fleet lifecycle

```
Draft ──▶ Commissioning ──▶ Active ──▶ Suspended ──▶ Active
                              │            │
                              ▼            ▼
                        Decommissioning ──▶ Retired
```

| State | Meaning | Entry condition |
|---|---|---|
| `draft` | FleetUnit created, not yet operational | Vehicle exists in V1 |
| `commissioning` | Baseline inspection, document check, plan setup | All required documents present and unexpired |
| `active` | Eligible for dispatch, subject to fitness | Commissioning inspection passed |
| `suspended` | Temporarily out (long service, dispute, seasonal) | Manual, with reason |
| `decommissioning` | Being wound down; no new assignments | Manual |
| `retired` | Terminal. Cost history preserved | No open work orders, no open assignments |

Fleet lifecycle is **not** the same as `VehicleStatus`. `VehicleStatus` is a
day-to-day operational state owned by LOG-003; the fleet lifecycle is the
long-horizon commercial state. A vehicle can be `available` (V1) while its
FleetUnit is `suspended` (V2) — and in that case Fleet's verdict is `unfit`, which
is exactly how a suspension takes effect without touching V1's state machine.

---

## 3.4 The readiness seam

This is the most important interface in V2, because it is where Directive 3 is
either honoured or quietly broken.

LOG-003 already exposes `Vehicle::canBeDispatched()` (business rule BR-7 of
TASK-LOG-003), and LOG-005's `DeliveryExecutionService::openAttempt()` already
consults it through the trip's assignment. V2 must contribute a health verdict to
that decision **without** Fleet knowing that Delivery exists.

### How it works

Fleet publishes a **capability query**, not a call:

```
FleetReadinessQueryInterface        (declared in Fleet/Domain/Contracts)
    verdictFor(int $vehicleId): FitnessVerdict
    verdictForMany(array $vehicleIds): array<int, FitnessVerdict>
```

- The interface is declared by Fleet and implemented by Fleet.
- **Dispatch** consumes it directly, because Dispatch is the context that assigns
  resources.
- **Delivery and Distribution do not consume it at all.** They keep using
  `Vehicle::canBeDispatched()` exactly as they do today.

The connection is made at *assignment time*, not at *execution time*: Dispatch
refuses to propose an unfit vehicle, and when Fleet publishes `VehicleBecameUnfit`
for an already-assigned vehicle, Dispatch reacts by proposing a reassignment.

```
Fleet ──publishes──▶ VehicleBecameUnfit
                            │
                            ▼
                        Dispatch  ──▶ proposes reassignment ──▶ dispatcher decides
                                                                      │
                                                                      ▼
                                                    calls V1 TripService / assignment service
```

**Fleet never cancels a trip.** It states a fact about a vehicle. Dispatch decides
what that fact means operationally, and V1 commits the change. This is why the
arrow from Fleet is one-way and asynchronous.

### Optional hardening (requires approval)

If the CTO wants an unfit vehicle to be blocked even when Dispatch is bypassed,
the clean way is to extend LOG-003's `Vehicle::canBeDispatched()` to consult a
nullable, injected `FleetReadinessQueryInterface` — defaulting to "no opinion"
when Fleet is not installed. That is a genuine V1 change and is therefore listed
in [§8.9](08-DATABASE-DESIGN.md#89-additive-v1-extensions-requiring-approval) as
**V1-EXT-2**, not assumed here.

---

## 3.5 Vehicle health

### Health is derived, always

`HealthScore` is computed on read from current facts. It is never a stored column
that can drift from reality.

| Factor | Weight | Source |
|---|---|---|
| Open critical defects | 30% | Fleet inspections |
| Maintenance overdue (distance or time) | 25% | Fleet maintenance plans |
| Inspection currency | 15% | Fleet inspections |
| Document validity | 15% | **V1** `logistics_vehicle_documents.expires_at` |
| Fuel efficiency deviation | 10% | Fleet fuel transactions |
| Unplanned downtime, rolling 90d | 5% | Fleet work orders |

Weights are configuration, not code — a `FleetHealthPolicy` per company, versioned
so a historical score can be explained.

### Fitness verdict

`HealthScore` informs humans. `FitnessVerdict` gates machines. They are separate
on purpose: a score of 61/100 means nothing to a dispatch rule, whereas "brake
inspection lapsed 3 days ago" does.

| Verdict | Meaning | Effect in Dispatch |
|---|---|---|
| `fit` | No blockers | Assignable |
| `fit_with_warnings` | Advisory items only (service due in 400 km) | Assignable; warning shown |
| `unfit` | ≥1 hard blocker | Not proposed; manual override requires `fleet.health.override` and records a reason |

Hard blockers: open critical defect; mandatory inspection lapsed; legally required
document expired; maintenance overdue beyond grace; FleetUnit suspended,
decommissioning or retired.

Every verdict carries its ordered blocker list. A screen that says "unfit" without
saying why is not acceptable.

---

## 3.6 Maintenance

### Plan versus record

- **`logistics_vehicle_maintenance_records` (V1)** — what was done: `performed_on`,
  `type`, `description`, `cost`, `currency`, `vendor`, `next_maintenance_date`,
  `recorded_by`, and an amendment trail. Unchanged.
- **`MaintenancePlan` (V2)** — what is due, and why. The forward-looking half that
  V1 deliberately did not model.

V1 already stores `next_maintenance_date` per record. Fleet reads it as one input
but does not depend on it, because date alone cannot express "every 10,000 km or
6 months, whichever first".

### Scheduling model

`ServiceInterval` supports three independent triggers, whichever fires first:

| Trigger | Example | Requires |
|---|---|---|
| Distance | every 10,000 km | Odometer series |
| Time | every 6 months | Nothing |
| Engine hours | every 500 h | Telemetry *or* manual entry |

Because engine hours may come from Telemetry, and Telemetry is optional
(Directive 5), an engine-hours interval must always be paired with a time or
distance fallback. A plan that can only be evaluated with GPS present is invalid
and must be rejected at configuration time.

### Workflow

```
Plan ──due──▶ WorkOrder(planned) ──▶ scheduled ──▶ in_progress ──▶ completed
                     │                                                  │
                     └────────────▶ cancelled                           │
                                                                        ▼
                                   writes a record into V1 via VehicleMaintenanceService
```

The final step matters: completing a V2 work order **calls LOG-003's
`VehicleMaintenanceService`** to create the V1 maintenance record. Fleet does not
insert into `logistics_vehicle_maintenance_records`. One writer per table.

### Preventive vs. corrective

| Kind | Origin | Effect on fitness |
|---|---|---|
| Preventive | A plan came due | Warning at threshold; blocker past grace |
| Corrective | A defect from an inspection or driver report | Critical defect blocks immediately |
| Statutory | Legal inspection or licence | Blocks on expiry, no grace |

---

## 3.7 Inspection workflow

```
ChecklistTemplate (per FleetGroup)
        │
        ▼
   Inspection(draft) ──submit──▶ submitted ──review──▶ approved
        │                            │                     │
        │                            └──▶ rejected         └──▶ defects opened
        └──▶ abandoned
```

- Templates are versioned; a submitted inspection records the template version so
  a historical inspection can always be read as it was performed.
- An inspection is **immutable once submitted**. A mistake is corrected by a new
  inspection, never by editing the old one — the same immutability rule LOG-005
  applies to a validated POD.
- Any failed item automatically opens an `InspectionDefect` with a severity.
  `critical` defects flip fitness to `unfit` on the spot.
- Perform and approve are separate permissions. A driver may perform a daily
  walk-around; a supervisor approves anything that raises a critical defect.

Inspection types: pre-trip (daily), post-trip, periodic (weekly/monthly),
statutory, and incident-triggered.

**Directive 4 note:** pre-trip inspections are performed on the driver's phone,
but the phone only submits the checklist. Whether the outcome makes the vehicle
unfit is decided by `InspectionService` on the server.

---

## 3.8 Fuel lifecycle

V1 has `FuelType` on the vehicle but records no consumption. This is the largest
functional gap in cost visibility.

```
FuelTransaction: captured ──▶ validated ──▶ reconciled
                     │             │
                     │             └──▶ disputed ──▶ reconciled | written_off
                     └──▶ rejected
```

### Capture sources

| Source | Trust | Notes |
|---|---|---|
| Fuel card feed | High | Bulk import; carries litres, cost, station, timestamp |
| Driver mobile entry | Medium | Photo of the pump receipt; requires odometer |
| Manual back-office | Medium | For cash purchases |
| Telemetry fuel sensor | Advisory only | Never authoritative — Directive 5 |

### Validation rules

1. **Odometer monotonicity.** A reading below the last accepted reading raises
   `OdometerRolledBack` and forces review. This is the single most common source
   of corrupt fuel data.
2. **Tank plausibility.** Litres must not exceed tank capacity plus tolerance.
3. **Efficiency window.** Litres per 100 km outside the vehicle's learned band
   raises `FuelAnomalyDetected` — a signal, not a rejection.
4. **Temporal overlap.** Two fill-ups minutes apart at different stations flags
   possible card misuse.

### Odometer as a governed series

Odometer readings arrive from fuel stops, inspections, maintenance, driver entry
and possibly telemetry. Multiple uncoordinated writers guarantee inconsistency, so
`OdometerService` is the **single writer**. It records every reading with its
source, resolves conflicts by a trust order (maintenance > fuel card > inspection
> driver entry > telemetry), and exposes one canonical current value. Everything
distance-based in Fleet reads that value and nothing else.

### Cash boundary

Fuel spend is an **expense fact**. It is posted to Accounting through the
integration described in [§12](12-INTEGRATIONS.md). It never touches
`distribution_trip_settlements` or `distribution_payment_collections`.
Distribution remains the Single Cash Authority; Fleet is a cost recorder, not a
cash handler.

---

## 3.9 Vehicle cost management

`VehicleCostEntry` is an append-only ledger. Corrections are reversing entries,
never updates — the same discipline the domain already applies to inventory
movements.

| Cost type | Source | Cadence |
|---|---|---|
| Fuel | Fleet fuel transactions | Per transaction |
| Maintenance | V1 maintenance records (cost + currency) | Per record |
| Inspection / statutory fees | Fleet inspections | Per event |
| Insurance, licensing | Manual or scheduled | Periodic |
| Depreciation | Schedule per vehicle | Monthly accrual |
| Driver cost | Payroll integration | Periodic, allocated |
| Third-party carrier cost | Carriers module | Per shipment |

### Derived cost metrics

| Metric | Definition | Enables |
|---|---|---|
| Cost per kilometre | Total cost ÷ distance, window | Vehicle comparison |
| Cost per delivered order | Total cost ÷ delivered orders | BO-2 |
| Cost per stop | Total cost ÷ completed stops | Route density analysis |
| Cost per service area | Allocated by stops served | Zone profitability |
| Total cost of ownership | Lifetime cost ÷ lifetime distance | Replacement decisions |

**Attribution.** Vehicle cost is attributed to a service area by the *stops
actually served*, taken from Distribution's completed stops. This is a read of a
V1 fact, and the direction is important: Fleet subscribes to trip-completed events
and accumulates. Fleet does not query Distribution synchronously during cost
computation, which is what keeps Directive 3 true even for reporting.

---

## 3.10 Independence proof

The design is only compliant with Directive 3 if all of these hold. They should
become architecture tests in CI:

| # | Assertion |
|---|---|
| 1 | No file under `Modules/Logistics/Fleet/Domain/**` imports `Distribution\` or `Delivery\` |
| 2 | Fleet writes no `distribution_*` or `delivery_*` table |
| 3 | Fleet's migrations create no vehicle, driver or carrier master table |
| 4 | Fleet's readiness verdict is computable with Distribution and Delivery uninstalled |
| 5 | Fleet's inbound coupling is limited to V1 domain events and FK reads |
| 6 | Completing a work order calls `VehicleMaintenanceService`; Fleet never inserts a V1 maintenance record |
| 7 | No fitness computation reads a Telemetry table (Directive 5) |
| 8 | Fleet posts no row to any settlement or payment-collection table |
