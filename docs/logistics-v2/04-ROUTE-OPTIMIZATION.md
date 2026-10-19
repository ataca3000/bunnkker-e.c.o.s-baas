# §4 — Route Optimization

**Directive 7 governs this document:** optimisation sits behind a strategy
interface so a future AI optimiser is a new implementation, not a redesign.

---

## 4.1 What Routing is, and what it is not

Routing decides **sequence and path**. It does not decide *whether* a stop exists —
Distribution owns stops — and it does not decide *whether* a delivery succeeded —
Delivery owns outcomes.

| Routing decides | Owner elsewhere |
|---|---|
| The order stops are visited in | Which orders are on the trip (Distribution) |
| The path between stops | Whether the trip may depart (Distribution) |
| Estimated arrival per stop | Actual arrival (Delivery `DeliveryAttempt.arrived_at`) |
| Whether to re-plan the remainder | Whether to retry a failed delivery (Delivery) |

---

## 4.2 The three engines

```
   Planning Engine          Optimization Engine            ETA Engine
   ──────────────           ───────────────────            ──────────
   Gathers a frozen    ──▶  Applies a strategy to     ──▶  Projects arrival
   snapshot of what         produce a proposal             times and detects
   must be routed           (pure, replayable)             predicted breaches
```

Splitting them is what makes the whole thing testable: the planning engine has all
the I/O, the optimisation engine has none, and the ETA engine is a projection that
can run repeatedly over a plan that never changes.

### Planning engine

Builds an immutable `RouteRequest` from:

- the trip's stops (`distribution_delivery_stops`, read-only)
- the origin (warehouse or branch coordinates)
- vehicle capability from V1: `capacity_orders`, `capacity_weight_kg`, `capacity_volume_m3`
- promised time windows from Delivery (`delivery_deliveries.promised_at`) and service-level windows from Network
- driver constraints (shift limits, working hours)
- a `TrafficProfile` for the planning horizon
- an `OptimizationObjective`

Two rules make the snapshot honest:

1. **Already-attempted stops are frozen.** A stop with a `DeliveryAttempt` is
   included as history with a fixed position; the optimiser may not move it.
2. **The snapshot is stored with the run.** Reproducing a decision six weeks later
   must not depend on today's data.

### Optimization engine

```
RoutingStrategyInterface
    optimize(RouteRequest $request): RouteProposal
    supports(RouteConstraints $constraints): bool
    name(): string
    version(): string
```

**Purity contract** — a strategy may not:
- read a repository, a cache, or the clock
- emit an event or write anything
- depend on the identity of the caller

Everything it needs is in `RouteRequest`. This is what allows the same input to be
replayed against a new strategy and compared fairly.

`RouteProposal` carries the sequenced legs, total distance and duration, per-stop
ETA, any `RouteConstraintViolation`s, and a confidence indicator. A proposal that
violates a hard constraint is still returned — with the violation attached — so a
dispatcher can see *why* no clean answer exists rather than receiving nothing.

### ETA engine

ETA is computed from the plan, then progressively refined:

| Refinement level | Input | Available when |
|---|---|---|
| L0 — planned | Leg durations from the strategy | Always |
| L1 — departure-adjusted | Actual departure time from Distribution | Trip dispatched |
| L2 — progress-adjusted | Completed stops and real dwell times from Delivery attempts | During execution |
| L3 — position-adjusted | Live position and speed | **Only if Telemetry is available** |

L0–L2 use nothing but V1 facts. L3 is a bonus. This is Directive 5 expressed as a
ladder rather than a switch: ETA quality degrades, ETA availability does not.

`EtaBreachPredicted` fires when a projected arrival exceeds
`promised_at + sla_grace_minutes` — reusing exactly the fields LOG-005 already
defined. V2 does not invent a second SLA definition.

---

## 4.3 Strategy catalogue

None of these is privileged in code; all are resolved through
`RoutingStrategyResolver`.

| Strategy | Approach | When it wins | Dependencies |
|---|---|---|---|
| `SequentialZoneStrategy` | Sort by zone, then postcode, then address | Dense urban routes where drivers know the area; the always-available fallback | None |
| `NearestNeighbourStrategy` | Greedy nearest + 2-opt improvement | Sparse routes, few constraints | Coordinates |
| `TimeWindowStrategy` | Windows first, distance second | Promised-slot deliveries | Windows |
| `CapacityAwareStrategy` | Multi-vehicle assignment with capacity | Planning several trips at once | Capacity data |
| `ExternalProviderStrategy` | Delegates to a routing provider via adapter | Complex multi-constraint problems | Network access |
| `AiOptimizationStrategy` | *Future.* Learned from historical outcomes | Predictive dwell and traffic | AI Platform |

### Resolution

```
RoutingStrategyResolver
    resolve(RouteRequest): RoutingStrategyInterface
```

Selection order: an explicit per-trip override, then the service area's policy,
then the company default, then `SequentialZoneStrategy`. A strategy whose
`supports()` returns false for the given constraints is skipped and the fallback
chain continues — so a misconfigured policy degrades rather than fails.

### Adding the AI strategy later

Because the interface is pure and every run is recorded with its snapshot, the AI
strategy can be introduced as follows without touching any existing code:
implement the interface, run it in **shadow mode** against recorded snapshots,
compare its proposals to what was executed, and only then enable it in policy for
one service area. `OptimizationRun` is what makes this possible; it exists from
day one for exactly this reason.

---

## 4.4 Dynamic rerouting

Triggers:

| Trigger | Source | Typical response |
|---|---|---|
| Stop failed, non-retryable | Delivery `DeliveryFailed` | Drop from remainder |
| Stop added mid-trip | Distribution | Insert at best position |
| Customer window changed | Orders / CRM | Re-plan remainder |
| Vehicle became unfit | Fleet `VehicleBecameUnfit` | Escalate to Dispatch |
| Predicted SLA breach | Routing `EtaBreachPredicted` | Re-sequence to protect the at-risk stop |
| Traffic incident | Traffic profile | Re-plan path only |
| Driver deviation | **Telemetry (optional)** | Advisory only |

Rules:

1. **Only the remainder is re-planned.** Completed and attempted stops are
   immutable — a reroute must never rewrite history.
2. **A reroute produces a new `RoutePlan` that supersedes the old one.** Plans are
   never edited in place; the superseded plan remains readable.
3. **Rerouting is proposed, not applied,** unless policy explicitly enables
   auto-apply for a low-risk trigger class. The default is dispatcher confirmation.
4. **Rerouting never triggers on a Telemetry-only signal by default.** Deviation
   detection is advisory (Directive 5).

---

## 4.5 Traffic awareness

Traffic enters only through `TrafficProfile`, a value object inside the snapshot.
This keeps the optimiser pure and traffic sourcing swappable.

| Source | Character | Availability |
|---|---|---|
| `StaticTrafficProfile` | Fixed speed assumptions per road class | Always — the guaranteed fallback |
| `HistoricalTrafficProfile` | Learned from ECOS's own completed legs, by hour and weekday | After sufficient history |
| `ExternalTrafficProfile` | Live third-party traffic feed | When configured and healthy |

`HistoricalTrafficProfile` deserves emphasis: ECOS accumulates real leg durations
from its own operations. Within months this is more accurate for the specific
routes actually driven than a generic external feed, and it costs nothing per call.

Degradation: external → historical → static, with the active profile recorded on
every `OptimizationRun` so a bad estimate can be traced to its source.

---

## 4.6 Future AI extension

The seams that make AI additive rather than disruptive, all present from day one:

| Seam | Purpose |
|---|---|
| `RoutingStrategyInterface` | The AI optimiser is one more implementation |
| `OptimizationRun` with stored snapshot | Training data and replay harness, free |
| `TrafficProfileProvider` | A learned traffic model is a new provider |
| `DwellTimePredictor` (interface, static default) | Predicted service time per stop type/customer |
| `RouteProposal.confidence` | Lets the UI show uncertainty rather than false precision |

Candidate models, in the order they pay off: dwell-time prediction (immediately
useful, low risk), failure-probability prediction per stop (feeds sequencing —
attempt likely-to-fail stops early so a retry is still possible the same day),
then full learned sequencing.

The failure-probability idea composes neatly with LOG-005: Delivery already
records a structured `FailureReason` taxonomy with categories and retryability.
That is a labelled training set accumulating from the day LOG-005 ships.

---

## 4.7 Constraints the optimiser must respect

| Constraint | Type | Source |
|---|---|---|
| Vehicle capacity (orders, weight, volume) | Hard | V1 `logistics_vehicles` |
| Promised time window | Hard when a slot was sold, soft otherwise | Delivery / Network |
| Driver shift and working hours | Hard | Drivers / DriverOps |
| Vehicle access restriction (weight, height, zone) | Hard | Fleet |
| Service area boundary | Hard | Network |
| Cold-chain sequence | Hard | Product attributes |
| Already-attempted stop position | Hard, immutable | Delivery |
| Objective weighting | Soft | `OptimizationObjective` |

Hard violations are reported, never silently relaxed. An optimiser that quietly
drops a constraint to produce a pretty answer is worse than one that reports it
cannot.

---

## 4.8 Performance envelope

| Scenario | Stops | Target |
|---|---|---|
| Single-trip re-sequence | ≤ 60 | < 500 ms, synchronous |
| Multi-trip origin plan | ≤ 1,500 | < 30 s, queued |
| Full-day multi-origin plan | ≤ 40,000 | < 10 min, queued, chunked by origin |

Anything beyond the synchronous tier runs as a job and publishes `RoutePlanned` on
completion. The dispatcher's screen subscribes; it does not block. Runs are
chunked by origin because origins are independent — this is the natural
parallelism boundary and it also caps the blast radius of one bad snapshot.
