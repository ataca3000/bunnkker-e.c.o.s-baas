# §7 — Logistics Operations Center

*Scope items 15, 16, 18.*

---

## 7.1 Principle: exception-driven, not inventory-driven

ECOS already committed to this in ADR-006 and proved it in LOG-005's Delivery
Command Center: the default view hides what is fine and leads with what is
failing. The Operations Center extends the same stance to the whole logistics
operation.

A dashboard that lists 1,200 healthy trips is a dashboard nobody reads. The design
target is that **an operator's screen is empty when the operation is healthy**.

## 7.2 Principle: this context owns no business state

`OperationsCenter` is projections, queues and alert rules over facts owned
elsewhere (ADR-024). It owns exactly one lifecycle of its own: an alert's
*acknowledgement*. Everything else is read.

Consequences:
- No screen here is authoritative. Acting on something navigates into the owning
  module's own surface, or calls the owning module's service.
- A projection can be dropped and rebuilt at any time.
- Nothing here may be the reason a fact is true.

---

## 7.3 The four surfaces

| Surface | Audience | Question answered |
|---|---|---|
| **Operations Dashboard** | Operations manager | Is the whole operation healthy today? |
| **Dispatch Command Center** | Dispatcher | What must I release, and what is blocking it? |
| **Fleet Dashboard** | Fleet supervisor | Which vehicles need me? |
| **Live Map** | Everyone, during execution | Where is everything right now? |

---

## 7.4 Operations Dashboard

Structured as: *headline health → open exceptions → queues*.

**Headline strip** — six numbers, each clickable into a filtered queue:

| Metric | Source | Alarm condition |
|---|---|---|
| Trips dispatched / planned | Distribution | Behind schedule at a time-of-day threshold |
| Stops completed / total | Distribution + Delivery | Completion rate below curve |
| First-attempt success rate | Delivery | Below target |
| SLA at risk | Routing `EtaBreachPredicted` | Any |
| Vehicles unfit | Fleet | Above threshold |
| Carrier shipments in exception | Carriers | Any |

The "SLA at risk" number is the one that changes behaviour: it is *predictive*,
sourced from the ETA engine, so operations can act before a breach rather than
report one after.

**Exception feed** — a single merged, deduplicated, severity-ordered stream across
Fleet, Dispatch, Routing, Delivery, Carriers and Telemetry. One operator, one
queue, regardless of which subsystem produced the problem.

**Operational queues** — saved, filtered views that constitute the day's work:

| Queue | Contents |
|---|---|
| Awaiting dispatch | Trips planned but not released |
| Blocked dispatch | Trips with an unresolved blocker |
| SLA at risk | Deliveries predicted to breach |
| Failed, retry pending | Delivery `awaiting_retry` (LOG-005) |
| Manual review | Deliveries with ≥3 failures (LOG-005 BR-27) |
| Unfit vehicles | Fleet `unfit` verdicts |
| Maintenance overdue | Fleet |
| Carrier exceptions | Carriers |
| Unmapped carrier statuses | Carriers — integration gaps |
| Assets dark | Telemetry, *if enabled* |

A queue is configuration, not data. Operators may save their own.

---

## 7.5 Dispatch Command Center

The dispatcher's working surface, organised around one board per (origin, date).

```
┌─ Board: Cairo Main · 29 Jul ──────────── 14 trips · 3 blocked ─┐
│                                                                 │
│  ┌── Trip TRP-014 ─────────────────────────────────────────┐   │
│  │ 38 stops · Zone: Nasr City · ETA close 16:20            │   │
│  │ Vehicle  [VEH-021 ▾]  fit                               │   │
│  │ Driver   [DRV-104 ▾]  licence ok                        │   │
│  │ Route    optimised · 96 km · 2 windows at risk          │   │
│  │                                    [Review] [Release]   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌── Trip TRP-017 ── BLOCKED ──────────────────────────────┐   │
│  │ • Vehicle VEH-033 unfit: brake inspection lapsed 3d     │   │
│  │ • No substitute of this capacity in pool                │   │
│  │                       [Find substitute] [Split trip]    │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

Design rules:

1. **Blockers are always stated in full.** Never "cannot dispatch" — always the
   ordered reason list from `FitnessVerdict` / `AssignmentBlocker`. This is the
   LOG-005 `retryBlockers()` pattern applied to dispatch.
2. **Every blocker has an adjacent action.** An unfit vehicle offers "find
   substitute"; an over-capacity trip offers "split".
3. **Release is explicit.** Auto-assignment proposes; a human releases, unless
   policy enables auto-release for a trusted class of board.
4. **Release calls V1.** `DispatchReleaseService` → `DriverVehicleAssignmentService`
   (LOG-002) and `TripService` (LOG-004B). If V1 refuses, the release fails and
   says why.
5. **Bulk where it is safe.** Release-all-clean is a legitimate action; bulk
   override of blockers is not.

---

## 7.6 Fleet Dashboard

Deliberately separate from the dispatch surface, because Directive 3 says Fleet
Operations is independent of Delivery Execution — and because a fleet supervisor
and a dispatcher have different days.

**Fitness board** — every vehicle as a card grouped by verdict:

```
FIT (31)            FIT WITH WARNINGS (6)        UNFIT (3)
                    service due in 380 km        brake inspection lapsed
                    document expires in 9 days   critical defect open
                                                 FleetUnit suspended
```

**Panels**

| Panel | Content |
|---|---|
| Maintenance calendar | Due, overdue, scheduled; by vehicle and type |
| Defects | Open defects by severity and age |
| Fuel | Efficiency by vehicle, anomalies flagged |
| Cost | Cost per km / per order, trended, outliers surfaced |
| Utilisation | Vehicle-days used vs. available; idle vehicles named |
| Documents | Expiring within 30/60/90 days — **read from V1** |

The utilisation panel is where BO-1 lives: an idle vehicle that nobody noticed is
pure loss, and it is invisible in V1.

---

## 7.7 Live Map

**Only meaningful if Telemetry is deployed — and must remain usable when it is not.**

| Layer | Source | Behaviour without Telemetry |
|---|---|---|
| Vehicle positions | `PositionSnapshot` | Layer absent; a banner explains why |
| Freshness ring | `PositionFreshness` | n/a |
| Planned routes | Routing | **Unchanged — still shown** |
| Stops with status | Distribution + Delivery | **Unchanged — still shown** |
| Geofences | Telemetry | Layer absent |
| Service areas | Network | **Unchanged** |

So without GPS the map is still a *plan and progress* map, driven by driver
check-ins — degraded, not gone.

**Non-negotiable rendering rule:** a position is never drawn without its freshness
state. Live is solid; stale is hollow with an age label; dark is a last-known
marker explicitly labelled as such. An operator must never mistake a two-hour-old
dot for a live one — that mistake is how wrong dispatch decisions get made.

**Performance:** the map reads only `PositionSnapshot` (one row per asset),
clusters at low zoom, and streams deltas over a websocket rather than polling full
state.

---

## 7.8 Alerts

### Rules, not hardcoded conditions

`AlertRule` is named, versioned and per-company:

```
name         "SLA breach predicted"
source       routing.eta_breach_predicted
severity     warning → critical when < 30 min to promised time
dedup_key    delivery_uuid
suppress     while the delivery is in manual review
route_to     operations_manager, zone_supervisor
escalate     unacknowledged for 15 min → operations_director
```

### Deduplication is mandatory

Every alert carries an `AlertKey`. A carrier outage that produces 400 identical
alerts has produced zero usable information. Repeat occurrences increment a count
on the existing alert; they do not create new rows.

### Alert lifecycle

```
raised ──▶ acknowledged ──▶ resolved
   │            │
   │            └──▶ escalated ──▶ acknowledged
   └──▶ suppressed (by rule) ──▶ auto-resolved when the condition clears
```

Alerts **auto-resolve** when their underlying condition clears. An alert list that
only grows is one operators learn to ignore.

### Catalogue

| Source | Alert | Default severity |
|---|---|---|
| Fleet | Vehicle became unfit | warning |
| Fleet | Maintenance overdue | warning → critical with age |
| Fleet | Critical defect raised | critical |
| Fleet | Fuel anomaly | info |
| Dispatch | Trip blocked | warning |
| Dispatch | Board not released by cutoff | critical |
| Routing | SLA breach predicted | warning → critical |
| Routing | Optimisation failed | warning |
| Delivery | Third failure, manual review | warning |
| Delivery | Retry exhausted | warning |
| Network | Capacity threshold breached | warning |
| Network | Capacity exhausted | critical |
| Carriers | Carrier health degraded | warning |
| Carriers | Unmapped status received | info |
| Carriers | Reconciliation drift | warning |
| Telemetry | Asset went dark | info *(never critical — Directive 5)* |

That last row is the design stated as data: losing GPS is never a critical
operational alert, because operations do not depend on GPS.

---

## 7.9 Real-time delivery

| Mechanism | Used for |
|---|---|
| Websocket | Live map positions, alert raises, board changes |
| Polling (30 s) | Dashboard headline metrics |
| On-demand | Everything else |

Projections are updated by event listeners, then broadcast. Nothing in the
Operations Center performs an expensive aggregate query on a user's request path —
if a number is expensive, it is projected in advance and the projection's freshness
is shown.

---

## 7.10 Integration with the existing dashboard (ADR-025)

The executive Dashboard API, its KPI services and `ExecutiveInsightEngine` are
**frozen**. ADR-025 specifies that new modules integrate additively through the
`KpiService` → `InsightEngine` pattern.

V2 therefore:

- adds a `LogisticsOperationsKpiService` following the existing KPI-service shape;
- registers its thresholds with `InsightThresholds`;
- lets `ExecutiveInsightEngine` consume them like every other module's;
- **does not** modify the dashboard controller, its response shape, or any
  existing KPI service.

The Operations Center is a *logistics* surface. The executive dashboard remains
the executive surface and is not reopened.
