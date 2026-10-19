# §2 — Domain Architecture

Every context follows the layout V1 already uses:

```
backend/Modules/Logistics/<Context>/
  Domain/          Contracts, Enums, Events, Exceptions, Models, Policies,
                   Services, Specifications, ValueObjects, Factories
  Infrastructure/  Database/Migrations, Repositories, Providers, Adapters
  Presentation/    Http/Controllers, Http/Resources, Policies
```

`Domain` has no dependency on Eloquent-specific behaviour beyond the base model,
no HTTP, and no knowledge of other contexts' infrastructure.

---

## 2.1 Context map

```
                    ┌──────────────────────────────────────────┐
                    │        LOGISTICS V1 (frozen)             │
                    │  ShippingCompanies · Drivers · Vehicles  │
                    │      Distribution · Delivery             │
                    └──────────────────────────────────────────┘
                       ▲ FK + service calls      │ domain events
                       │ (V2 → V1, synchronous)  ▼ (V1 → V2, async)
   ┌───────────────────┴─────────────────────────────────────────────┐
   │                        LOGISTICS V2                             │
   │                                                                 │
   │   Network ──capacity──▶ Routing ──plan──▶ Dispatch ──▶ (V1)     │
   │      │                     ▲                  ▲                 │
   │      │                     │                  │ fitness         │
   │      │                  Telemetry           Fleet               │
   │      │                 (optional)             │                 │
   │      │                     │                  │                 │
   │      └──────────────┬──────┴──────────┬───────┘                 │
   │                     ▼                 ▼                         │
   │              OperationsCenter    DriverOps                      │
   │              (read models only)                                 │
   │                                                                 │
   │   Carriers ◀──adapters──▶ external      DriverApp (BFF)         │
   └─────────────────────────────────────────────────────────────────┘
```

**Relationship types**

| From → To | Type | Rule |
|---|---|---|
| V2 → V1 | Customer/Supplier | V2 reads V1 by ID and calls V1 *services*. Never writes a V1 table. |
| V1 → V2 | Published Language | V1 domain events. V1 has no compile-time knowledge of V2. |
| Fleet → Dispatch | Published Language | Fitness is published; Dispatch subscribes. **Never** the reverse (Directive 3). |
| Telemetry → anything | Open Host, optional | Consumers must tolerate total absence (Directive 5). |
| Carriers → external | Anticorruption Layer | Adapters are the only place foreign vocabulary exists (Directive 6). |
| → OperationsCenter | Conformist projection | Read-only; never authoritative. |

**Forbidden dependencies** (should be enforced by a CI architecture test):

- `Fleet` may not reference `Distribution` or `Delivery` namespaces.
- `Telemetry` may not be referenced from any readiness gate or state machine guard.
- No context outside `Carriers/Infrastructure/Adapters` may name a carrier.
- No context may write `distribution_*` or `delivery_*` tables.

---

## 2.2 Context: `Fleet`

*Scope items 1, 2, 3, 4, 14. Answers: is this vehicle fit, serviced, fuelled, and what does it cost?*

### Aggregates

| Aggregate | Root identity | Invariants |
|---|---|---|
| **FleetUnit** | `uuid`; 1:1 with `logistics_vehicles.id` | Exactly one FleetUnit per vehicle. Holds condition, never identity. |
| **MaintenancePlan** | `uuid` | Per vehicle per maintenance type; at most one *open* schedule per (vehicle, type). |
| **Inspection** | `uuid` | Immutable once submitted. A failed item forces a defect. |
| **FuelTransaction** | `uuid` | Odometer must be monotonic per vehicle. Immutable once reconciled. |
| **VehicleCostEntry** | `id` | Append-only ledger line. Never updated, only reversed. |

### Entities

`MaintenanceScheduleRule`, `InspectionItem`, `InspectionDefect`, `FleetUnitHealthSnapshot`, `FuelCard`.

### Value Objects

| VO | Purpose |
|---|---|
| `OdometerReading` | Kilometres + source (`manual`, `fuel_stop`, `telemetry`) + timestamp; enforces monotonicity |
| `ServiceInterval` | Whichever comes first: distance, time, or engine-hours |
| `HealthScore` | 0–100 with contributing factors; **derived, never stored as truth** |
| `FitnessVerdict` | `fit` \| `fit_with_warnings` \| `unfit` + ordered list of human-readable blockers |
| `Money` | Amount + currency (matches V1's `cost`/`currency` pairing) |
| `FuelEfficiency` | Litres per 100 km over a window |

`FitnessVerdict` deliberately mirrors the shape of `Delivery::retryBlockers()` from
LOG-005 — a boolean plus the reasons it is false. That pattern proved its worth:
the UI can always explain a refusal without a second call.

### Domain Services

| Service | Responsibility |
|---|---|
| `FleetReadinessService` | Computes `FitnessVerdict` for a vehicle at a moment |
| `MaintenanceSchedulingService` | Projects next-due from `ServiceInterval` + odometer; opens work |
| `InspectionService` | Runs checklists, converts failures into defects |
| `FuelReconciliationService` | Matches fuel transactions to vehicles, detects anomalies |
| `VehicleCostService` | Posts cost entries; computes cost per km / per order |
| `OdometerService` | Single writer of odometer; resolves conflicting sources |

### Domain Events

`FleetUnitRegistered`, `VehicleBecameFit`, `VehicleBecameUnfit`, `MaintenanceDue`,
`MaintenanceOverdue`, `MaintenanceScheduled`, `MaintenanceCompleted`,
`InspectionPassed`, `InspectionFailed`, `DefectRaised`, `DefectCleared`,
`FuelTransactionRecorded`, `FuelAnomalyDetected`, `OdometerRolledBack`,
`VehicleCostPosted`.

### Repositories

`FleetUnitRepositoryInterface`, `MaintenancePlanRepositoryInterface`,
`InspectionRepositoryInterface`, `FuelTransactionRepositoryInterface`,
`VehicleCostRepositoryInterface`.

### Factories

`FleetUnitFactory` — creates a FleetUnit from a `logistics_vehicles` row, seeding
default maintenance plans from the vehicle's `type` and `fuel_type`. This is the
only place the V1→V2 projection happens.

### Policies

`fleet.view`, `fleet.manage`, `fleet.maintenance.schedule`,
`fleet.maintenance.complete`, `fleet.inspection.perform`,
`fleet.inspection.approve`, `fleet.fuel.record`, `fleet.fuel.reconcile`,
`fleet.cost.view`, `fleet.health.override`.

Note the capture/approve split on inspections and the record/reconcile split on
fuel — the same separation-of-duties principle LOG-005 applied to POD capture
versus validation.

### Specifications

| Specification | Used by |
|---|---|
| `VehicleIsRoadworthy` | Readiness gate |
| `MaintenanceIsOverdue` | Scheduling, alerts |
| `InspectionHasLapsed` | Readiness gate |
| `HasOpenCriticalDefect` | Readiness gate |
| `FuelConsumptionIsAnomalous` | Fuel reconciliation |
| `DocumentHasExpired` | Reads LOG-003 `logistics_vehicle_documents.expires_at` |

`DocumentHasExpired` is a good illustration of P2: the *data* stays in V1's
documents table; only the *judgement* is V2's.

---

## 2.3 Context: `Network`

*Scope items 12, 13. Answers: where do we serve, and how much can we absorb?*

### The zone problem

V1 already has two zone-like concepts:

- `distribution_zones` — an operational grouping used to plan trips (LOG-004B)
- `logistics_governorates` / `logistics_cities` — the geographic master (Geography)

V2 needs a third *idea* — a commercial service area with coverage rules, SLAs and
capacity — but must not create a third *master*. **Decision:** `ServiceArea` is a
**composition**, not a new geography. It references existing `distribution_zones`
and/or `logistics_cities` through a link table and adds only the commercial and
capacity attributes. No place name is ever stored twice.

### Aggregates

| Aggregate | Invariants |
|---|---|
| **ServiceArea** | Composed of ≥1 existing zone or city; a given city may belong to at most one *active* service area per company |
| **CapacityPlan** | Per (service area, date); committed ≤ available |
| **CoverageRule** | Cutoff, lead time and surcharge for a service area × service level |

### Entities

`ServiceAreaMember` (the link to zone/city), `CapacitySlot` (area × date × time window), `CapacityCommitment`, `ServiceLevel`.

### Value Objects

`CapacityUnit` (orders, weight, volume, stops — capacity is multi-dimensional and
the binding constraint differs by product), `TimeWindow`, `CutoffPolicy`,
`CapacityUtilisation` (committed ÷ available, derived).

### Domain Services

`CoverageResolverService` (address → service area), `CapacityLedgerService`
(reserve / release / commit against a slot), `CapacityForecastService`,
`ServiceLevelResolverService`.

### Domain Events

`ServiceAreaOpened`, `ServiceAreaClosed`, `CapacityPlanPublished`,
`CapacityCommitted`, `CapacityReleased`, `CapacityThresholdBreached`,
`CapacityExhausted`, `CoverageGapDetected`.

### Interaction with Orders

Strictly advisory. Network exposes a *query* — "what capacity remains for this
area on this date?" — and a *soft reservation* with a TTL. Orders decides. This
mirrors how `BranchAssignmentEngine` (TASK-BRANCH-ASSIGNMENT-001) already treats a
no-coverage result as an Ops signal rather than a rejection.

---

## 2.4 Context: `Routing`

*Scope item 7. Answers: in what order, and by which path?*

### Aggregates

| Aggregate | Invariants |
|---|---|
| **RoutePlan** | Belongs to exactly one trip; supersedes at most one prior plan; a stop already attempted may not be reordered |
| **OptimizationRun** | Immutable audit of input snapshot, strategy, parameters, output and duration |

### Entities

`RouteLeg` (from → to, distance, duration, sequence), `RouteStopRef` (points at
`distribution_delivery_stops.id`), `EtaProjection`, `RouteConstraintViolation`.

### Value Objects

`GeoPoint` (lat/lng + accuracy), `Distance`, `Duration`, `RouteConstraints`
(time windows, capacity, driver hours, vehicle restrictions), `TrafficProfile`,
`OptimizationObjective` (weights over distance / time / cost / SLA).

### Domain Services & the strategy seam (Directive 7)

```
RoutingStrategyInterface
    optimize(RouteRequest $request): RouteProposal
    supports(RouteConstraints $constraints): bool
    name(): string
```

`RouteRequest` is an **immutable snapshot** — stops, constraints, objective,
traffic profile. `RouteProposal` is pure data. The strategy touches no repository
and no clock. This is what makes runs replayable and a future AI strategy a drop-in.

Planned implementations, none privileged in code:

| Strategy | Character |
|---|---|
| `SequentialZoneStrategy` | Baseline: order by zone then postcode. Always available, no dependencies. |
| `NearestNeighbourStrategy` | Local heuristic with 2-opt improvement. |
| `TimeWindowStrategy` | Respects promised windows first, distance second. |
| `ExternalProviderStrategy` | Delegates to a routing provider through an adapter. |
| `AiOptimizationStrategy` | *Future.* Same interface, no redesign. |

`RoutingStrategyResolver` picks a strategy from policy (per company / service area
/ trip type), never from a hardcoded branch. `EtaEngine`, `ReroutingService` and
`TrafficProfileProvider` complete the context.

### Domain Events

`RoutePlanned`, `RoutePlanSuperseded`, `RouteOptimizationFailed`,
`RouteDeviationDetected`, `EtaRevised`, `EtaBreachPredicted`.

`EtaBreachPredicted` is the highest-value event in V2: it converts Delivery's
*after-the-fact* SLA breach into a *before-the-fact* warning, without changing
Delivery at all.

---

## 2.5 Context: `Dispatch`

*Scope items 8, 16. Answers: which trip gets which resources, now?*

### Aggregates

| Aggregate | Invariants |
|---|---|
| **DispatchBoard** | One per (origin, date); the unit of a dispatcher's work |
| **DispatchProposal** | Immutable once accepted or rejected; records why each assignment was chosen |
| **DispatchPolicy** | Named, versioned rule set governing automatic assignment |

### Entities

`ProposedAssignment` (trip ⇄ vehicle ⇄ driver), `AssignmentBlocker`, `DispatchDecision`, `ReleaseRecord`.

### Value Objects

`ResourcePool` (fit vehicles × available drivers at a moment),
`AssignmentScore` (weighted fit), `DispatchWindow`, `BlockerReason`.

### Domain Services

`DispatchProposalService`, `ResourcePoolService`, `AssignmentScoringService`,
`DispatchReleaseService`.

### The critical boundary

`DispatchReleaseService` is where V2 hands back to V1. It **must**:

- call `Modules\Logistics\Drivers\...\DriverVehicleAssignmentService::assign()` to
  pair driver and vehicle — never insert into `logistics_driver_vehicle_assignments`;
- call `Modules\Logistics\Distribution\...\TripService` to create or update the
  trip and drive its status — never write `distribution_trips`.

If either call fails its own domain rules, the dispatch proposal is refused. V1
remains the authority; V2 does not get a second opinion.

### Domain Events

`DispatchBoardOpened`, `DispatchProposalGenerated`, `DispatchProposalAccepted`,
`DispatchProposalRejected`, `ResourceAssigned`, `ResourceReleased`,
`DispatchBlocked`, `DispatchCompleted`.

---

## 2.6 Context: `Telemetry` *(optional — Directive 5)*

*Scope items 6, 9. Answers: where is the vehicle?*

### Aggregates

| Aggregate | Invariants |
|---|---|
| **TrackedAsset** | One per vehicle *that has a source*; absence is normal, not an error |
| **Geofence** | Closed polygon or circle bound to a service area, warehouse or customer address |

### Entities

`PositionPing` (high volume, append-only, partitioned), `PositionSnapshot`
(latest per asset — the hot read), `GeofenceEvent`, `TelemetrySource`.

### Value Objects

| VO | Note |
|---|---|
| `GeoPoint` | Shared vocabulary with Routing |
| `PositionFreshness` | `live` \| `stale` \| `unknown` — **always rendered**, never hidden |
| `Heading`, `Speed` | |
| `TelemetryQuality` | Ping rate, gap count, accuracy over a window |

`PositionFreshness` is the mechanism that makes Directive 5 real in the UI. A
position without a freshness verdict must be impossible to render.

### Domain Services

`PositionIngestionService` (idempotent, batch, back-pressure aware),
`GeofenceEvaluationService`, `TelemetryDegradationService`, `PositionQueryService`.

### Domain Events

`AssetPositionUpdated`, `GeofenceEntered`, `GeofenceExited`,
`TelemetrySourceDegraded`, `TelemetrySourceRestored`, `AssetWentDark`.

### The optionality contract

Every consumer of Telemetry must satisfy: *given no Telemetry data at all, does my
behaviour remain correct?* Concretely —

- ETA falls back to plan-based projection.
- Arrival detection falls back to the driver's manual "I've arrived", which is
  what LOG-005's `AttemptStatus::Arrived` already is.
- The live map shows last-known with staleness, or an explicit "no signal" state.
- Geofence-derived automation is *convenience only*; a manual equivalent always exists.

---

## 2.7 Context: `Carriers`

*Scope items 10, 11. Answers: how do we talk to carriers we don't own?*

### Reuse before build

ECOS already has a **Provider Platform** (TASK-PROVIDER-PLATFORM-001) with
`ProviderRegistry`, `ProviderCapabilityEngine`, `ProviderCredentialService`,
`ProviderCredentialContext` (queue isolation), `ProviderHealthMonitor`, secret
rotation and a 20-event audit catalogue — built for Meta but deliberately generic.

**Decision:** `Carriers` *reuses* that platform for registry, credentials, health
and rotation rather than building a parallel one. It adds only what is
carrier-specific: shipment lifecycle, label handling, tendering and rate shopping.
This is P2 applied to infrastructure, not just master data.

### Aggregates

| Aggregate | Invariants |
|---|---|
| **CarrierAccount** | 1:N with `logistics_shipping_companies.id`; a company may hold several accounts (regions, contracts) |
| **CarrierShipment** | 1:1 with a `delivery_deliveries` row when tendered; carries the carrier's tracking number |
| **CarrierWebhookEvent** | Append-only, deduplicated by carrier event id, replayable |

### Entities

`CarrierCapability`, `CarrierServiceMapping` (carrier service code ⇄ ECOS service
level), `CarrierRate`, `CarrierLabel`, `TenderAttempt`.

### Value Objects

`CarrierCode`, `TrackingNumber`, `CarrierStatusMapping`, `RateQuote`,
`CarrierHealthVerdict`, `TenderDecision`.

### The adapter seam (Directive 6)

```
CarrierAdapterInterface
    capabilities(): CarrierCapabilitySet
    quote(RateRequest): RateQuote[]
    tender(TenderRequest): TenderResult
    label(CarrierShipment): CarrierLabel
    track(TrackingNumber): CarrierTrackingSnapshot
    cancel(CarrierShipment): CancellationResult
    parseWebhook(RawWebhookPayload): NormalizedCarrierEvent
```

Rules that make the anticorruption layer real:

1. `NormalizedCarrierEvent` uses **ECOS** vocabulary — `DeliveryStatus`,
   `FailureReason` — never the carrier's strings. Translation happens inside the
   adapter, and an unmappable status becomes an explicit
   `CarrierStatusUnmapped` exception rather than a silent pass-through.
2. Not every carrier does everything. `capabilities()` is declarative and the
   core asks before it calls; a missing capability is a normal answer, not an
   error.
3. No adapter may write a `delivery_*` row. It emits a normalized event; a
   listener calls Delivery's own services.
4. Adapters live only in `Carriers/Infrastructure/Adapters/<CarrierName>/`.

### Domain Events

`CarrierAccountConnected`, `CarrierAccountDisabled`, `ShipmentTendered`,
`ShipmentAccepted`, `ShipmentRejected`, `LabelGenerated`,
`CarrierStatusReceived`, `CarrierStatusUnmapped`, `CarrierWebhookReceived`,
`CarrierHealthDegraded`, `CarrierReconciliationDrift`.

---

## 2.8 Context: `DriverApp`

*Scope item 5. Answers: how does the phone talk to the server?*

This is a **backend-for-frontend**, intentionally thin. Directive 4: it holds no
business rules.

### Aggregates

| Aggregate | Invariants |
|---|---|
| **DeviceSession** | One active session per driver; device-bound, revocable |
| **SyncEnvelope** | Idempotent by client-generated key; exactly-once effect under retry |

### Entities

`DeviceRegistration`, `PendingIntent`, `SyncCursor`, `MediaUploadTicket`.

### Value Objects

`DeviceFingerprint`, `IntentKey` (client UUID + monotonic sequence),
`SyncWatermark`, `ConflictResolution` (**always `server_wins`** — stated as a type,
not a convention).

### Domain Services

`DeviceSessionService`, `IntentReplayService`, `TaskProjectionService` (builds the
driver's read model), `MediaIngestionService`.

`IntentReplayService` is the heart of Directive 4: it takes a queued intent and
**re-executes it against the real domain services** — Delivery's
`DeliveryExecutionService`, Fleet's `InspectionService`. It never shortcuts. An
intent that the domain refuses comes back as a refusal the driver can read, even
if the phone had optimistically shown success.

### Domain Events

`DeviceRegistered`, `DeviceRevoked`, `SyncBatchReceived`, `IntentAccepted`,
`IntentRejected`, `IntentConflicted`, `MediaUploaded`.

---

## 2.9 Context: `DriverOps`

*Scope item 17. Answers: how well is this driver performing?*

### Aggregates

| Aggregate | Invariants |
|---|---|
| **DriverScorecard** | Per (driver, period); **derived from Delivery outcomes, never re-deriving them** |
| **PerformanceIncident** | Immutable once acknowledged; always linked to its source fact |

### Entities

`ScorecardMetric`, `CoachingNote`, `PerformanceThreshold`.

### Value Objects

`PerformanceWindow`, `MetricValue` (value + sample size + confidence — a 100%
success rate over 3 deliveries is not a 100% success rate), `ScoreBand`, `Trend`.

### Domain Services

`ScorecardProjectionService`, `IncidentDetectionService`, `PeerComparisonService`.

Sample size is part of the value object on purpose: performance management that
acts on statistically meaningless samples is the fastest way to lose driver trust
in the system.

### Domain Events

`ScorecardPublished`, `PerformanceThresholdBreached`, `PerformanceIncidentRaised`,
`CoachingNoteAdded`, `DriverRankingChanged`.

---

## 2.10 Context: `OperationsCenter`

*Scope items 15, 16, 18. Answers: what needs a human right now?*

**This context owns no business state.** It is projections, queues and alert rules
over facts owned elsewhere (ADR-024).

### Aggregates

| Aggregate | Note |
|---|---|
| **OperationalAlert** | Owns only its *acknowledgement* lifecycle; the underlying fact belongs to its source |
| **AlertRule** | Named, versioned, per company |
| **OperationalQueue** | A saved, ordered, filtered view — configuration, not data |

### Entities

`AlertSubscription`, `QueueItemProjection`, `DashboardWidgetConfig`.

### Value Objects

`Severity` (`info` \| `warning` \| `critical`), `AlertKey` (dedup identity),
`QueueFilter`, `SlaCountdown`.

### Domain Services

`AlertEvaluationService`, `AlertDeduplicationService`, `QueueProjectionService`,
`LiveMapProjectionService`.

Alerts must deduplicate by `AlertKey`. An operation that generates 400 identical
alerts has generated zero usable information.

### Domain Events

`AlertRaised`, `AlertAcknowledged`, `AlertResolved`, `AlertEscalated`,
`AlertSuppressed`.

---

## 2.11 Cross-cutting patterns

**Verdict objects.** `FitnessVerdict`, `TenderDecision`, `CarrierHealthVerdict`
and `AssignmentBlocker` all follow LOG-005's `retryBlockers()` shape: a boolean
plus ordered, human-readable reasons. Any refusal in V2 must be explainable in the
same response that refuses it.

**Derived, never stored as truth.** `HealthScore`, `CapacityUtilisation`,
`PositionFreshness`, `MetricValue` and `SlaCountdown` are computed on read. Where
performance demands a materialised copy it lives in an explicitly named projection
table with the source recorded — never in the aggregate.

**Snapshot-in, proposal-out.** Routing and Dispatch both take an immutable
snapshot and return a proposal. Nothing commits inside an optimiser. This makes
every decision reproducible and every regression debuggable.

**UUID as the public identifier.** Every V2 aggregate carries BIGINT PK + `uuid`,
with the UUID exposed as the API `id`. This is the convention set by Trip in
LOG-004B and followed by Delivery in LOG-005.

**Events are facts, not commands.** Past tense, immutable, actor-stamped
(ADR-011). `VehicleBecameUnfit` states a fact; it does not instruct Dispatch to
cancel anything. Dispatch decides what an unfit vehicle means to it.
