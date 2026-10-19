# §9 — State Machines

Every enum below is a PHP backed enum owning its own transition map
(`allowedTransitions()`, `canTransitionTo()`, `label()`, `values()`, `options()`)
— the pattern V1 established in `TripStatus`, `VehicleStatus`, `DeliveryStatus`
and `AttemptStatus`. An illegal transition is refused by the domain and surfaces
as HTTP 422 with a message naming the allowed next states.

**Two rules apply to every machine in V2:**

1. **No transition guard may read a Telemetry table** (Directive 5).
2. **No V2 machine may drive a V1 machine directly.** V2 calls a V1 *service*,
   which drives V1's own machine.

---

## 9.1 Fleet lifecycle — `FleetUnitLifecycle`

```
draft ──▶ commissioning ──▶ active ⇄ suspended
                              │           │
                              ▼           ▼
                        decommissioning ──▶ retired
```

| From | Allowed to | Guard |
|---|---|---|
| `draft` | `commissioning`, `retired` | Vehicle exists in V1 |
| `commissioning` | `active`, `draft`, `retired` | → `active` requires a passed commissioning inspection and no expired mandatory document |
| `active` | `suspended`, `decommissioning` | Suspension requires a reason |
| `suspended` | `active`, `decommissioning` | → `active` requires re-inspection if suspended > 30 days |
| `decommissioning` | `retired`, `active` | → `retired` requires no open work order and no open assignment |
| `retired` | — | Terminal. Cost history preserved. |

**Relationship to `VehicleStatus` (V1).** These are different axes and both are
correct at once. A vehicle may be `available` (V1 operational) while its FleetUnit
is `suspended` (V2 commercial) — in which case the fitness verdict is `unfit` and
Dispatch will not propose it. Fleet never writes `VehicleStatus`; when a vehicle
must come off the road it calls LOG-003's `VehicleService`.

---

## 9.2 Maintenance — `WorkOrderStatus`

```
planned ──▶ scheduled ──▶ in_progress ──▶ completed
   │            │              │
   └────────────┴──────────────┴──▶ cancelled
```

| From | Allowed to | Guard |
|---|---|---|
| `planned` | `scheduled`, `cancelled` | Scheduling requires a date and a vendor or bay |
| `scheduled` | `in_progress`, `planned`, `cancelled` | Starting requires an odometer reading |
| `in_progress` | `completed`, `cancelled` | Completion requires cost, odometer and a description |
| `completed` | — | Terminal. **Writes the V1 maintenance record via `VehicleMaintenanceService`.** |
| `cancelled` | — | Terminal. Requires a reason. |

Two effects worth stating explicitly:

- Entering `in_progress` for a maintenance type classified as *immobilising* calls
  LOG-003's `VehicleService` to move `VehicleStatus` to `maintenance`.
- `completed` is the only path that creates a V1 maintenance record. There is no
  other writer.

---

## 9.3 Inspection — `InspectionStatus`

```
draft ──▶ submitted ──▶ approved
   │          │
   │          └──▶ rejected
   └──▶ abandoned
```

| From | Allowed to | Guard |
|---|---|---|
| `draft` | `submitted`, `abandoned` | Submission requires every mandatory item answered |
| `submitted` | `approved`, `rejected` | Requires `fleet.inspection.approve`; the approver must differ from the performer when any critical item failed |
| `approved` | — | Terminal, immutable. Failed items open defects. |
| `rejected` | — | Terminal. Requires a reason. A correction is a **new** inspection. |
| `abandoned` | — | Terminal. |

Immutability on `approved`/`rejected` mirrors LOG-005's validated-POD rule, and
the different-approver condition mirrors its capture/validate permission split.

## 9.4 Defect — `DefectStatus`

```
open ──▶ acknowledged ──▶ in_repair ──▶ resolved
  │                                        │
  └──▶ dismissed                           └──▶ reopened ──▶ in_repair
```

`critical` defects block fitness from `open` until `resolved`. Dismissal of a
critical defect requires `fleet.health.override` and records a reason — the same
override discipline used for fitness.

---

## 9.5 Fuel — `FuelTransactionStatus`

```
captured ──▶ validated ──▶ reconciled
    │            │
    │            └──▶ disputed ──▶ reconciled | written_off
    └──▶ rejected
```

| From | Allowed to | Guard |
|---|---|---|
| `captured` | `validated`, `rejected` | Validation runs odometer monotonicity, tank plausibility, efficiency window |
| `validated` | `reconciled`, `disputed` | Reconciliation matches the transaction to a card statement or receipt |
| `disputed` | `reconciled`, `written_off` | Requires `fleet.fuel.reconcile` |
| `reconciled` | — | Terminal, immutable. **Posts a `fleet_cost_entries` row.** |
| `written_off` | — | Terminal. Requires a reason. Also posts a cost entry. |
| `rejected` | — | Terminal. Requires a reason. Posts nothing. |

A failed validation does not auto-reject — it moves to `validated` with an anomaly
flag raised, because most anomalies are real purchases with an unusual pattern, and
auto-rejecting them would teach operators to ignore the flag.

---

## 9.6 Dispatch — `DispatchBoardStatus` and `ProposalStatus`

### Board

```
open ──▶ planning ──▶ proposed ──▶ releasing ──▶ released ──▶ closed
   │                      │                          │
   └──────────────────────┴──▶ cancelled             └──▶ partially_released
```

| From | Allowed to | Guard |
|---|---|---|
| `open` | `planning`, `cancelled` | Trips exist for this origin-date |
| `planning` | `proposed`, `open`, `cancelled` | Optimisation and proposal generation complete |
| `proposed` | `releasing`, `planning`, `cancelled` | Dispatcher has reviewed |
| `releasing` | `released`, `partially_released` | Each release calls V1 services |
| `partially_released` | `releasing`, `closed` | Some assignments blocked |
| `released` | `closed` | All trips released |
| `closed` | — | Terminal, end of day |

`partially_released` is a first-class state rather than an error, because on any
real morning a handful of trips are blocked while the rest must go out. Modelling
it as failure would force dispatchers to work around the system.

### Proposal

```
generated ──▶ accepted | rejected | superseded
```

Immutable once decided. Re-running the optimiser creates a new proposal and marks
the previous one `superseded`.

---

## 9.7 Route — `RoutePlanStatus`

```
draft ──▶ optimizing ──▶ planned ──▶ active ──▶ completed
   │           │            │           │
   │           ▼            │           └──▶ superseded ──▶ (new plan)
   │        failed          │
   └───────────┴────────────┴──▶ cancelled
```

| From | Allowed to | Guard |
|---|---|---|
| `draft` | `optimizing`, `cancelled` | Snapshot assembled |
| `optimizing` | `planned`, `failed` | Strategy returned a proposal |
| `failed` | `optimizing`, `cancelled` | Retry may use a fallback strategy |
| `planned` | `active`, `superseded`, `cancelled` | Becomes `active` when the trip is dispatched |
| `active` | `completed`, `superseded` | |
| `superseded` | — | Terminal. A new plan references it. |
| `completed` | — | Terminal. |

**Reroute invariant:** a plan may only be superseded by one whose already-attempted
stops occupy identical positions. Enforced by a specification, not by convention —
this is the rule that stops a reroute from rewriting history.

---

## 9.8 Carrier shipment — `CarrierShipmentStatus`

```
draft ──▶ tendering ──▶ tendered ──▶ in_transit ──▶ delivered
   │          │            │            │  ▲
   │          ▼            │            │  │
   │       rejected        │            ▼  │
   │          │            │        exception
   │          ▼            │            │
   └──────▶ cancelled ◀────┘            └──▶ returned
```

| From | Allowed to | Guard |
|---|---|---|
| `draft` | `tendering`, `cancelled` | Carrier account healthy and capability present |
| `tendering` | `tendered`, `rejected` | Adapter returned a result |
| `rejected` | `tendering`, `cancelled` | Retry may target a different carrier |
| `tendered` | `in_transit`, `cancelled` | Carrier confirmed pickup |
| `in_transit` | `delivered`, `exception`, `returned` | Driven by normalized carrier events |
| `exception` | `in_transit`, `returned`, `cancelled` | Recoverable |
| `delivered`, `returned`, `cancelled` | — | Terminal |

**Two rules:**
- An out-of-order carrier event never regresses the status. It is recorded, and if
  it contradicts the current state it raises `CarrierReconciliationDrift`.
- Every transition here also drives Delivery **through Delivery's own services**,
  so a carrier-delivered order obeys the same rules as an own-fleet one.

---

## 9.9 Capacity commitment — `CapacityCommitmentStatus`

```
reserved ──▶ committed ──▶ consumed
    │             │
    ▼             ▼
 expired      released
```

| From | Allowed to | Guard |
|---|---|---|
| `reserved` | `committed`, `released`, `expired` | Soft hold with a TTL |
| `committed` | `consumed`, `released` | Order confirmed |
| `consumed` | — | Terminal. The delivery happened. |
| `released` | — | Terminal. Capacity returned to the pool. |
| `expired` | — | Terminal. TTL elapsed; capacity returned automatically. |

`expired` exists so that abandoned checkouts cannot silently consume a day's
capacity — a failure mode that is invisible until a zone mysteriously sells out.

---

## 9.10 Telemetry asset — `TrackedAssetStatus` *(optional)*

```
unregistered ──▶ registered ──▶ live ⇄ stale ──▶ dark
                      │                            │
                      └──▶ disabled ◀──────────────┘
```

| State | Meaning |
|---|---|
| `unregistered` | Normal for most vehicles — tracking is opt-in |
| `registered` | A source is configured, no data yet |
| `live` | Recent pings within the freshness threshold |
| `stale` | Data exists but is older than the threshold |
| `dark` | No data for an extended period |
| `disabled` | Tracking intentionally switched off |

**Nothing outside Telemetry may branch on this enum for a business decision.** It
drives rendering and alerting only. `dark` raises an `info` alert, never a
`critical` one — because an operation that treats losing GPS as critical has made
GPS mandatory, which Directive 5 forbids.

---

## 9.11 Machines V2 deliberately does not own

| Machine | Owner | V2's relationship |
|---|---|---|
| `TripStatus` (13 states) | LOG-004B Distribution | Calls `TripService`; never transitions directly |
| `DeliveryStopStatus` | LOG-004B Distribution | Reads only |
| `SettlementStatus` | LOG-004B Distribution | **Never touched** — Single Cash Authority |
| `VehicleStatus` (6 states) | LOG-003 Vehicles | Calls `VehicleService` when a vehicle must leave the road |
| `DeliveryStatus` (12 states) | LOG-005 Delivery | Calls Delivery services; carrier events route through them |
| `AttemptStatus` (7 states) | LOG-005 Delivery | Driver-app intents replay through `DeliveryExecutionService` |
| `PodStatus`, `CodStatus`, `DeliveryReturnStatus` | LOG-005 Delivery | Read and call only |

This table is the compact statement of Directive 1: everything V1 already decides,
V1 still decides.
