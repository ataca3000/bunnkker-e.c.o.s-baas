# §16 — Implementation Roadmap

Sequencing rules applied:

1. **Every phase delivers standalone value.** The roadmap can stop after any phase
   without leaving a half-built system.
2. **Foundations before consumers.** A context ships before the contexts that read
   it.
3. **Cheap and certain before expensive and uncertain.**
4. **Telemetry last**, because Directive 5 says everything must work without it —
   and building it last is how that gets proven rather than asserted.

---

## Phase 0 — Foundations *(prerequisite, small)*

**Purpose:** make the boundaries mechanically enforceable before any V2 code
depends on them.

| Deliverable | Note |
|---|---|
| Architecture tests in CI | The assertions in §3.10, §12.10 and §15.4 |
| Module scaffolding | Nine context skeletons following the V1 template |
| Permission seed pattern | One migration per context, LOG-005's idempotent shape |
| Decision on **V1-EXT-1** (coordinates) | Blocks Routing — decide now |
| Decision on **V1-EXT-2** (fitness in `canBeDispatched`) | Optional; default is no |

**Why first.** AR-1 (boundary erosion) is the highest-likelihood architecture risk.
Tests written after the fact never get written. This phase is days, not weeks, and
it is what makes every later claim about boundaries verifiable.

---

## Phase 1 — Fleet Operations *(largest single value step)*

**Scope items 1–4, 14. Context: `Fleet`.**

| Deliverable |
|---|
| Fleet hierarchy, `FleetUnit` 1:1 with V1 vehicles, `FleetUnitFactory` |
| Maintenance plans, intervals, work orders → V1 record via `VehicleMaintenanceService` |
| Inspections: versioned templates, execution, approval, defects |
| Governed odometer series with `OdometerService` as the single writer |
| Fuel transactions, validation, anomaly detection, reconciliation |
| Cost ledger and derived cost metrics |
| `FleetReadinessService` and `FitnessVerdict` |
| Fleet Dashboard, Maintenance Workspace, tablet inspection screen |
| 16 tables, 10 permissions, ~34 routes |

**Standalone value:** cost visibility and breakdown prevention with nothing else
built. Directly serves BO-2 and BO-3. Independently useful even if V2 stops here —
which is exactly what Directive 3's independence requirement makes possible.

**Depends on:** Phase 0. Nothing else.

**Risks addressed early:** OR-1 (data decay) — onboarding imports existing V1
maintenance history so plans start populated, and odometer capture is mandatory
from the first fuel transaction.

---

## Phase 2 — Network & Capacity

**Scope items 12, 13. Context: `Network`.**

| Deliverable |
|---|
| `ServiceArea` as a **composition** of existing zones and cities |
| Service levels and coverage rules |
| Capacity plans, slots, commitments with TTL |
| `CoverageResolverService`, `CapacityLedgerService` |
| Advisory capacity API for Orders |
| Service Areas and Capacity Planning UI |
| 7 tables, 4 permissions, ~18 routes |

**Standalone value:** truthful capacity commitments; prevents overselling (BO-8).

**Depends on:** Phase 0. Independent of Fleet.

**Why before Routing:** Routing needs service-area boundaries as constraints, and
Dispatch needs capacity to plan against.

---

## Phase 3 — Routing & ETA

**Scope item 7. Context: `Routing`.**

| Deliverable |
|---|
| `RoutingStrategyInterface` and the resolver |
| `SequentialZoneStrategy` (default), `NearestNeighbourStrategy`, `TimeWindowStrategy` |
| `RouteRequest` snapshot, `OptimizationRun` audit |
| ETA engine at L0–L2 *(no Telemetry, by design)* |
| `HistoricalTrafficProfile` from ECOS's own completed legs |
| `EtaBreachPredicted` |
| Route sequence UI, plan comparison |
| 5 tables, 3 permissions, ~11 routes |

**Standalone value:** shorter routes and predictive SLA warnings. Serves BO-4 and
BO-5.

**Depends on:** Phase 2 (constraints), V1-EXT-1 or the geocoding fallback.

**Note:** ETA reaches L2 — plan, departure and progress adjusted — using only V1
facts. L3 arrives with Telemetry in Phase 7, or never, and nothing breaks.

---

## Phase 4 — Dispatch

**Scope items 8, 16. Context: `Dispatch`.**

| Deliverable |
|---|
| Dispatch boards per (origin, date) |
| Resource pool consuming Fleet's `FitnessVerdict` |
| Proposal generation, scoring, blockers |
| `DispatchReleaseService` → `TripService` + `DriverVehicleAssignmentService` |
| `partially_released` handling |
| Dispatch Command Center |
| 6 tables, 4 permissions, ~13 routes |

**Standalone value:** the morning dispatch bottleneck disappears. Serves BO-1 and
BO-4.

**Depends on:** Phases 1 (fitness), 2 (capacity), 3 (routes). **This is the
integration phase** — where V2 first commits changes back into V1, and therefore
where the boundary tests earn their keep.

---

## Phase 5 — Driver Mobile

**Scope item 5. Contexts: `DriverApp`, plus `DriverOps` foundations.**

| Deliverable |
|---|
| Device registration, sessions, revocation |
| **Single `POST /sync` write surface**, idempotent by `IntentKey` |
| `IntentReplayService` replaying through V1 domain services |
| Offline store, task cache, reference catalogue versioning |
| Media tickets and resumable upload |
| Native navigation hand-off |
| Mobile app: shift start, task list, stop detail, POD, failure, COD, fuel, defects |
| 4 tables, 1 permission, ~9 routes |

**Standalone value:** drivers stop using paper and phone calls. Improves data
quality for every KPI in Phase 6.

**Depends on:** Phases 1 and 4. **No Telemetry dependency** — the app ships fully
functional with GPS off.

**Risk to watch:** OR-4 (sync conflicts). `server_wins` and visible-pending state
must be right in the first release; retrofitting trust is expensive.

---

## Phase 6 — Operations Center & Driver Performance

**Scope items 15, 17, 18. Contexts: `OperationsCenter`, `DriverOps`.**

| Deliverable |
|---|
| Alert rules, deduplication, escalation, auto-resolution |
| Merged exception feed across all contexts |
| Operational queues |
| Operations Dashboard |
| Driver scorecards with sample size and customer-fault separation |
| `LogisticsOperationsKpiService` → `InsightThresholds` (ADR-025, additive) |
| Live map **without** the position layer |
| 7 tables, 5 permissions, ~19 routes |

**Standalone value:** single control surface. Serves BO-7.

**Depends on:** Phases 1–5 for content. Deliberately late — an operations centre
over two contexts is not worth building.

---

## Phase 7 — External Carriers

**Scope items 10, 11. Context: `Carriers`.**

| Deliverable |
|---|
| `CarrierAdapterInterface`, capability declaration, adapter conformance suite |
| 2–3 initial adapters plus `CsvManifestAdapter` |
| Provider Platform reuse for credentials, rotation, health |
| Shipment lifecycle, tendering, rate shopping, failover |
| Webhook ingestion: verify → persist raw → 200 → queue |
| Polling and nightly reconciliation, drift detection |
| Carrier Workspace with the unmapped-status queue |
| 8 tables, 4 permissions, ~19 routes |

**Standalone value:** overflow capacity and carrier comparability. Serves BO-6.

**Depends on:** Phase 0 and the Provider Platform. **Technically independent of
1–6** — it could move earlier if commercial priority demands, at the cost of
Delivery integration testing without a mature operations surface.

---

## Phase 8 — Telemetry & Live Tracking *(optional)*

**Scope items 6, 9. Context: `Telemetry`.**

| Deliverable |
|---|
| Sources, tracked assets, batched idempotent ingestion |
| Hot/cold split; snapshots as the only user-facing read |
| Partitioning and tiered retention |
| Geofences and events |
| Degradation ladder and freshness |
| ETA refinement to L3 |
| Live map position layer |
| Privacy controls: shift-bound collection, separately permissioned history, audit |
| 6 tables, 4 permissions, ~11 routes |

**Standalone value:** live visibility and better ETAs.

**Deliberately last.** Building Telemetry after everything else *proves* Directive
5 rather than asserting it: phases 1–7 shipped and ran without it. If it is never
built, the platform is complete.

**Risks:** SR-1 (volume) and BR-2 (driver resistance) are both highest here, and
both are cheapest to manage when the platform already works without it.

---

## Recommended execution order

```
Phase 0  Foundations              ← blocking, small
   │
   ├──▶ Phase 1  Fleet            ← largest value, fully independent
   │       │
   ├──▶ Phase 2  Network          ← parallel with Phase 1
   │       │
   │       ▼
   │    Phase 3  Routing
   │       │
   └───────┴──▶ Phase 4  Dispatch ← integration point with V1
                   │
                   ├──▶ Phase 5  Driver Mobile
                   │       │
                   │       ▼
                   └──▶ Phase 6  Operations Center

        Phase 7  Carriers         ← independent; schedule on commercial priority
        Phase 8  Telemetry        ← optional, last
```

**Phases 1 and 2 can run in parallel** — different teams, no shared dependency.

**Phase 7 floats.** If external carrier volume is commercially urgent, it can run
alongside phases 1–3 without disturbing the critical path.

**The critical path is 0 → 2 → 3 → 4.** That is the sequence that delivers
optimised dispatch; everything else either feeds it or consumes it.

---

## Effort shape

Relative, not absolute — for sequencing decisions rather than commitments.

| Phase | Tables | Routes | Relative size | Standalone? |
|---|---|---|---|---|
| 0 Foundations | 0 | 0 | XS | prerequisite |
| 1 Fleet | 16 | ~34 | **L** | ✅ |
| 2 Network | 7 | ~18 | M | ✅ |
| 3 Routing | 5 | ~11 | **L** *(algorithmic)* | ✅ |
| 4 Dispatch | 6 | ~13 | M | ⚠️ needs 1–3 |
| 5 Driver Mobile | 4 | ~9 | **L** *(two clients)* | ⚠️ needs 1, 4 |
| 6 Ops Center | 7 | ~19 | M | ⚠️ needs content |
| 7 Carriers | 8 | ~19 | **L** *(per-adapter)* | ✅ |
| 8 Telemetry | 6 | ~11 | M | ✅ optional |
| **Total** | **59** | **~134** | | |

Phase 3 and Phase 7 are larger than their table counts suggest — Routing because
the work is algorithmic rather than CRUD, Carriers because each adapter is its own
integration with its own testing.

---

## Phase gates

Each phase closes only when all of these hold:

| # | Gate |
|---|---|
| 1 | Architecture tests green — no boundary violation |
| 2 | Feature test suite green, including cross-context boundary assertions |
| 3 | Full Logistics suite green — **zero V1 regressions** |
| 4 | Browser-verified against a real dev database |
| 5 | Permissions seeded and the 403 path tested |
| 6 | Documentation updated |
| 7 | CTO review and approval before the next phase |

Gate 3 is the one that matters most: 230 V1 tests currently pass, and every phase
must leave that number intact or higher. A V1 regression is the clearest possible
evidence that "extend, never redesign" has been violated.

---

## Open decisions for CTO review

| # | Decision | Recommendation | Blocks |
|---|---|---|---|
| D1 | **V1-EXT-1** — nullable coordinates on `logistics_cities` | **Approve.** The alternative duplicates geography, which Directive 2 argues against | Phase 3 |
| D2 | **V1-EXT-2** — Fleet verdict inside `Vehicle::canBeDispatched()` | **Defer.** Dispatch-layer enforcement is sufficient; revisit if bypass proves real | Phase 4 (optional) |
| D3 | Telemetry: build, defer, or never | **Defer to Phase 8.** Decide after phases 1–6 prove the operation runs without it | Phase 8 |
| D4 | Initial carrier adapters — which and how many | Business input needed | Phase 7 |
| D5 | Driver mobile: React Native or PWA | Needs a device-fleet and offline-capability assessment | Phase 5 |
| D6 | Multi-leg routing — in scope for V2 or V3? | **V3.** Flagged as the one identified architectural gap ([§15.5](15-RISKS.md#155-future-extensibility)) | — |
| D7 | Phase 7 (Carriers) position in the order | Commercial priority call | — |
