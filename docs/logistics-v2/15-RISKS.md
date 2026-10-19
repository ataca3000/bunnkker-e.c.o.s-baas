# §15 — Risks

Rated by impact × likelihood. Each risk names its mitigation and, where relevant,
the architectural decision already taken to reduce it.

---

## 15.1 Business risks

### BR-1 — Optimisation is rejected by the people who must use it *(High impact, Medium likelihood)*

Dispatchers know their city. An optimiser that produces theoretically shorter but
practically worse routes gets overridden, and overrides become the norm within a
fortnight.

**Mitigation.** `SequentialZoneStrategy` — which mirrors how dispatchers already
think — is the default, not the sophisticated strategy. Auto-acceptance rate is a
tracked KPI ([§14.4](14-REPORTING.md#144-route-and-dispatch-kpis)), so rejection is
visible immediately rather than discovered later. Optimisation uplift is measured
against the baseline so the business case is evidence, not assertion. Roll out per
service area, never fleet-wide.

### BR-2 — Driver resistance to tracking *(High impact, Medium likelihood)*

GPS tracking is often experienced as surveillance. Resistance manifests as phones
left in the cab, disabled location services, or industrial dispute.

**Mitigation.** This is the strongest business argument for Directive 5, and the
architecture honours it: the platform is fully operational without GPS, so
telemetry can be introduced later, gradually, or never. Collection is shift-bound
and enforced server-side. Historical access is separately permissioned and audited
([§13.4](13-SECURITY.md#134-gps-privacy)). Position the capability around ETA
accuracy for customers, not around monitoring drivers.

### BR-3 — Performance management is perceived as unfair *(Medium impact, High likelihood)*

Scorecards that penalise drivers for difficult routes or customer behaviour
destroy trust in the whole system.

**Mitigation.** Sample size is part of the metric value object, not a footnote.
Customer-fault failures are separated using LOG-005's existing
`isCustomerFault()`. Peer comparison is within a cohort, not fleet-wide. Coaching
notes exist alongside metrics so the record is not purely numeric.

### BR-4 — Capacity advice is ignored, then blamed *(Medium impact, Medium likelihood)*

Network advises; Orders decides. When an oversold day fails, the platform gets
blamed for the shortfall it correctly predicted.

**Mitigation.** Every capacity response is recorded with its answer. "Promised vs.
served" is a tracked KPI. The advisory boundary is deliberate — Network rejecting
orders would be a far worse failure mode — but the advice must be auditable.

---

## 15.2 Scaling risks

### SR-1 — Telemetry write volume *(High impact, High likelihood if enabled)*

~7M rows/day at target scale is by far the largest write load in the platform. Done
naively it degrades the whole database.

**Mitigation.** Structural, and the main reason Telemetry is its own context:
separate storage policy; hot/cold split with `position_snapshots` as the only
user-facing read; daily partitioning of `position_pings`; batched ingestion;
back-pressure that sheds the historical write before the snapshot update; tiered
retention. Consider a time-series store if the relational path strains — the
context boundary makes that substitution possible without touching anything else.

### SR-2 — Optimisation compute *(Medium impact, High likelihood)*

Vehicle-routing is NP-hard. A 40,000-stop day cannot be solved synchronously.

**Mitigation.** Chunked by origin — origins are independent, which is both the
natural parallelism boundary and a cap on the blast radius of a bad snapshot.
Queued with a defined performance envelope
([§4.8](04-ROUTE-OPTIMIZATION.md#48-performance-envelope)). Time-boxed strategies
that return the best-so-far. The purity contract means strategies scale
horizontally with no shared state.

### SR-3 — Live map fan-out *(Medium impact, Medium likelihood)*

50 concurrent operators watching 500 moving vehicles is a substantial websocket
load.

**Mitigation.** Snapshot-only reads; server-side clustering at low zoom; delta
streaming rather than full state; viewport-scoped subscriptions.

### SR-4 — Event volume through the Enterprise Event Bus *(Medium impact, Medium likelihood)*

Nine new contexts each publishing and subscribing multiplies traffic on a bus
shared with the rest of ECOS.

**Mitigation.** Coarse-grained events — publish `TripCompleted` once, not one event
per stop. Telemetry position updates are explicitly **not** domain events; they use
a dedicated channel. Async listeners with dedicated queues per context so one slow
consumer cannot block another.

### SR-5 — Cost ledger growth *(Low impact, High likelihood)*

An append-only ledger across 500 vehicles over years grows steadily.

**Mitigation.** Monthly rollup projections for reporting; the detailed ledger is
queried only for drill-down; partition by year if needed.

---

## 15.3 Operational risks

### OR-1 — Fleet data is entered but never maintained *(High impact, High likelihood)*

Maintenance plans configured at go-live and never updated produce false fitness
verdicts. Odometer readings skipped produce meaningless cost metrics. **This is the
most likely way V2 fails in practice** — not through a technical fault but through
data decay.

**Mitigation.** Odometer capture is *mandatory* at fuel stops and maintenance
completion, not optional. Data-quality dependencies are monitored as first-class
metrics ([§14.9](14-REPORTING.md#149-data-quality-dependencies)). Stale-data alerts
— a vehicle with no odometer reading in two weeks raises a warning. Import from
existing V1 maintenance history at onboarding so plans start populated rather than
empty.

### OR-2 — Alert fatigue *(High impact, High likelihood)*

An operations centre that raises hundreds of alerts a day gets ignored, and then a
real incident is missed.

**Mitigation.** Deduplication by `AlertKey` is mandatory, enforced by a unique
index rather than by care. Alerts auto-resolve when their condition clears.
Severity is rule-driven and tunable per company. Suppression rules exist. Losing
GPS is explicitly `info`, never `critical`. Track acknowledgement rate — a rule
whose alerts are never acknowledged is a rule to delete.

### OR-3 — Dispatch becomes a bottleneck *(High impact, Medium likelihood)*

If every trip needs manual review, one dispatcher gates 1,200 trips.

**Mitigation.** `partially_released` is a first-class board state, so blocked trips
never hold up clean ones. "Release all clean" is a supported bulk action. Auto-
release is available per policy for trusted board classes. Blockers always carry an
adjacent remedy.

### OR-4 — Offline sync conflicts confuse drivers *(Medium impact, Medium likelihood)*

A driver records a delivery offline; the office cancels the order meanwhile.

**Mitigation.** `server_wins` is a type, not a convention. The refusal shown is the
domain's own message. The device's `occurred_at` is preserved for dispute
resolution even though server time governs ordering. Pending items are visibly
pending, so the driver never assumes a queued action landed.

### OR-5 — Carrier mapping errors corrupt delivery status *(High impact, Medium likelihood)*

A mis-mapped carrier status silently marks orders delivered that were not.

**Mitigation.** Unmappable statuses raise `CarrierStatusUnmapped` and go to a
visible queue rather than being coerced to a "closest" match. Raw webhook payloads
are retained so a mapping fix can be replayed over the backlog. Nightly
reconciliation detects drift. An adapter conformance suite runs in CI across all
carriers.

### OR-6 — GPS gaps mislead operators *(Medium impact, High likelihood)*

A stale position presented as current produces confident wrong decisions.

**Mitigation.** `PositionFreshness` is required on every position response and every
render — enforced in the TypeScript type so a stale-as-live render is a compile
error. Degradation transitions are published events, so the operations centre *sees*
the degradation.

---

## 15.4 Architecture risks

### AR-1 — Boundary erosion under delivery pressure *(High impact, High likelihood)*

The single greatest architectural risk. Under a deadline, someone will write
directly to `distribution_trips` because calling `TripService` is inconvenient.
Once one boundary is crossed, the rest follow.

**Mitigation.** Make it mechanically checkable rather than a matter of discipline:
the architecture tests in [§12.10](12-INTEGRATIONS.md#1210-integration-compliance-checklist)
and [§3.10](03-FLEET-ARCHITECTURE.md#310-independence-proof) must run in CI from
phase 1, not be added later. `dispatch_releases` records the V1 ids returned by
service calls, so compliance is auditable in the data as well as the code. Code
review of any V2 file that references a V1 namespace.

### AR-2 — Fleet quietly couples to Delivery *(High impact, Medium likelihood)*

Directive 3 is easy to honour on day one and easy to lose in month six — a cost
report "just needs" a delivery count, and a synchronous query appears.

**Mitigation.** A namespace-import architecture test that fails the build. Fleet
accumulates cost attribution from *events*, never from synchronous queries. The
independence proof is a checklist that must stay green.

### AR-3 — Telemetry becomes load-bearing *(High impact, Medium likelihood)*

A feature is built that "requires" GPS, and Directive 5 is silently void.

**Mitigation.** A test asserting no state machine guard, readiness computation or
settlement path reads a `telemetry_*` table. No foreign key points into
`telemetry_*` from any other context — the schema itself resists the coupling.
Every Telemetry-driven automation must ship with its manual equivalent, reviewed as
part of the feature.

### AR-4 — The strategy interface leaks *(Medium impact, Medium likelihood)*

A strategy "just needs" one repository lookup, purity is lost, and replay and AI
comparison stop working.

**Mitigation.** The purity contract is explicit
([§4.2](04-ROUTE-OPTIMIZATION.md#optimization-engine)). Strategies are tested with
no container access. If a strategy needs data, it goes in `RouteRequest` — which
also means it is captured in the snapshot and available for training.

### AR-5 — Carrier logic leaks out of adapters *(Medium impact, Medium likelihood)*

A carrier's quirk gets a special case in a service, and Directive 6 is broken.

**Mitigation.** An architecture test asserting no carrier brand name appears outside
`Carriers/Infrastructure/Adapters/**`. Capabilities are declarative, so "this
carrier can't do X" is expressed as data. The `CsvManifestAdapter` proves the
abstraction holds even for carriers with no API at all.

### AR-6 — Nine contexts is too much surface for the team *(Medium impact, Medium likelihood)*

Nine modules is a lot of scaffolding, and the roadmap could stall half-built.

**Mitigation.** The roadmap ([§16](16-ROADMAP.md)) is explicitly phased so each
phase delivers standalone value and can be stopped after. Phase 1 (Fleet) is useful
with nothing else built. Telemetry is optional and last. Contexts share the V1
module template, so scaffolding is mechanical.

---

## 15.5 Future extensibility

Where the architecture is deliberately open, and what it would take:

| Extension | Readiness | What it needs |
|---|---|---|
| AI route optimisation | **Designed in** | A new `RoutingStrategyInterface` implementation. Training data accumulates from day one. |
| Predictive maintenance | **Designed in** | A model over the odometer/defect/work-order series. No schema change. |
| Dynamic pricing by capacity | Open | Network's capacity ledger is the input; pricing stays in its own domain |
| Crowdsourced / gig drivers | Open | A new driver type in LOG-002; Dispatch pools extend naturally |
| Multi-leg / hub-and-spoke | **Partly open** | `RoutePlan` assumes a single vehicle per trip. Multi-leg would need a new aggregate — the largest identified gap |
| Customer self-service rescheduling | Open | Delivery already owns retry; Network owns capacity. Both exposed. |
| Electric vehicle operations | Open | `FuelType` exists in V1; charging sessions would extend `FuelTransaction`, and range becomes a routing constraint |
| Cross-border shipping | Open | Carriers' adapter model already accommodates it; customs data would be new |
| Warehouse-to-warehouse transfer | Open | Trip type exists in Distribution; Routing applies unchanged |
| Real-time customer tracking page | **Designed in** | LOG-005's redacted `publicTimeline()` plus, optionally, a coarsened position |

**The honest gap:** multi-leg routing. `RoutePlan` is one vehicle, one trip. A
hub-and-spoke or transfer-then-deliver model would need a `RouteNetwork` aggregate
above `RoutePlan`. That is additive rather than a redesign — but it is not designed
in, and it should be flagged now rather than discovered later.
