# §1 — Business Analysis

---

## 1.1 The problem V2 solves

V1 made every individual delivery *correct*. It cannot yet make the operation
*efficient*, and it has no answer at all to four questions a logistics director
asks daily:

1. **Readiness** — "Which of my 40 vehicles can actually go out tomorrow morning?"
   V1 knows a vehicle's `status` and its maintenance *history*. It does not know
   whether a service is due, an inspection has lapsed, or the vehicle is
   accumulating faults.

2. **Capacity** — "Can I accept 600 orders in Giza tomorrow?" V1 knows a trip's
   `capacity` and a vehicle's `capacity_orders`. It has no notion of *aggregate
   capacity by region by day*, so overselling is invisible until dispatch morning.

3. **Cost** — "What does it cost me to deliver in Alexandria versus Cairo?" V1
   records maintenance cost per record. Fuel is not recorded at all. Cost per
   kilometre, per order, per vehicle and per zone are all unanswerable.

4. **Control** — "What is going wrong right now?" V1 has a Delivery Command Center
   for *order exceptions*. There is no equivalent for *fleet and dispatch
   exceptions*, and no live picture of where vehicles are.

---

## 1.2 Business objectives

| # | Objective | Measured by |
|---|---|---|
| BO-1 | Increase vehicle utilisation | Orders per vehicle-day; idle-vehicle hours |
| BO-2 | Reduce cost per delivered order | Total logistics cost ÷ delivered orders |
| BO-3 | Eliminate preventable breakdowns | Unplanned downtime hours; overdue-service count |
| BO-4 | Shorten dispatch cycle time | Minutes from plan-open to last-vehicle-departed |
| BO-5 | Raise first-attempt delivery rate | Successful first attempts ÷ total deliveries |
| BO-6 | Make external carriers measurable and swappable | On-time % and cost per carrier; time-to-onboard a new carrier |
| BO-7 | Give operations a single control surface | Mean time to detect and to resolve an operational exception |
| BO-8 | Make capacity commitments truthful | Promised-vs-served ratio by zone by day |

Note that BO-5 is a *V1 metric improved by V2 means*: better routing and better
zone/time-window matching raise first-attempt success without changing a single
line of the Delivery module.

---

## 1.3 Operational goals

**Daily rhythm the platform must support**

| Phase | Time | Who | What V2 provides |
|---|---|---|---|
| Capacity commitment | T-1 day | Sales / Ops | Zone capacity remaining; accept-or-defer signal |
| Planning | T-1 evening | Dispatcher | Proposed trips, routes and loads from the optimiser |
| Readiness | T-0 05:00 | Fleet supervisor | Vehicle fitness board; blockers with reasons |
| Dispatch | T-0 06:00–08:00 | Dispatcher | Command centre: assign, confirm, release |
| Execution | T-0 all day | Driver / Ops | Mobile task list; live map; exception queue |
| Recovery | T-0 continuous | Ops | Reroute, reassign, escalate to carrier |
| Close | T-0 evening | Ops / Finance | Utilisation, cost, performance, settlement handover |

**Scale targets** (design must not preclude these; they are sizing inputs, not commitments)

| Dimension | Design target |
|---|---|
| Warehouses / dispatch origins | 25 |
| Vehicles in fleet | 500 |
| Drivers | 800 |
| Trips per day | 1,200 |
| Delivery stops per day | 40,000 |
| GPS pings per day (if enabled) | ~7M (500 vehicles × 1 ping/5s × 10h — see [§5.6](05-DRIVER-MOBILE-PLATFORM.md#56-telemetry-volume-and-retention)) |
| External carriers integrated | 15 |
| Concurrent operations-centre users | 50 |

The GPS figure is the single largest write volume in the platform and is the main
reason Telemetry is a separate, optional context with its own retention policy.

---

## 1.4 Enterprise scenarios

These are the scenarios the architecture is validated against. Each names the
contexts involved and the boundary it exercises.

**ES-1 — Multi-warehouse morning dispatch.**
1,200 orders across 3 warehouses and 12 zones. The optimiser proposes trips per
origin; the dispatcher reviews and releases. *Exercises:* Network → Routing →
Dispatch → Distribution. *Boundary tested:* Dispatch proposes, Distribution
creates the trip — V2 never writes `distribution_trips` directly, it calls
Distribution's `TripService`.

**ES-2 — Vehicle fails readiness at 05:30.**
A van's brake inspection lapsed overnight. Fleet marks it unfit; Dispatch finds
the reassignment; the trip departs on a substitute with its load re-verified.
*Exercises:* Fleet → Dispatch → Distribution. *Boundary tested:* Fleet publishes
`VehicleBecameUnfit`; it does not cancel the trip itself.

**ES-3 — Mid-route reroute.**
A road closure invalidates a route. The optimiser re-plans the remaining stops
only; already-attempted stops are immutable. *Exercises:* Routing → Dispatch →
Delivery. *Boundary tested:* Routing may not reorder a stop that already has a
`DeliveryAttempt`.

**ES-4 — GPS provider outage.**
Telemetry goes dark for four hours. Operations continues on driver check-ins;
the live map shows *last known + staleness*, never a stale position presented as
current. *Exercises:* Telemetry degradation ladder. *Boundary tested:* no
transition anywhere blocked by missing GPS.

**ES-5 — Carrier hand-off and webhook reconciliation.**
Overflow volume is tendered to an external carrier. The carrier's webhooks drive
status; a nightly reconciliation catches anything the webhook missed.
*Exercises:* Carriers → Delivery. *Boundary tested:* the carrier adapter
translates carrier vocabulary into ECOS `DeliveryStatus`; no carrier string
reaches the core.

**ES-6 — Zone oversell prevention.**
Sales attempts to promise 700 orders into a zone with 550 remaining capacity.
Network returns the shortfall before the promise is made. *Exercises:* Network
capacity ledger. *Boundary tested:* Network advises; Orders decides. V2 never
rejects an order.

**ES-7 — Month-end cost attribution.**
Fuel, maintenance, depreciation and driver cost roll up per vehicle, per zone,
per order. *Exercises:* Fleet cost ledger → Accounting. *Boundary tested:* Fleet
posts expense facts; Accounting owns the ledger of record.

**ES-8 — Driver performance review.**
A driver's first-attempt rate falls below threshold across a rolling window.
DriverOps raises a coaching flag. *Exercises:* DriverOps projections. *Boundary
tested:* DriverOps reads Delivery's outcomes; it never re-derives delivery truth.

---

## 1.5 Business boundaries

**What V2 decides**

- Whether a vehicle is fit to be dispatched (Fleet)
- What a good route looks like (Routing)
- Which resources a trip should get (Dispatch, as a *proposal*)
- Where we serve and how much we can absorb (Network)
- Which carrier to tender overflow to (Carriers, as a *proposal*)
- What the operation should be worried about (OperationsCenter)

**What V2 never decides**

| Decision | Owner | V2's role |
|---|---|---|
| Whether an order is accepted | Orders | Supplies capacity advice only |
| Whether stock is reserved | Inventory / ADR-027 | None |
| Whether a trip exists and its status | Distribution | Proposes; calls `TripService` |
| Whether cash reconciles | Distribution (Single Cash Authority) | Posts fuel/maintenance expense to Accounting, never to trip cash |
| Whether a delivery succeeded | Delivery | Consumes the outcome |
| Which driver is paired to which vehicle | Drivers (LOG-002) | Proposes; calls `DriverVehicleAssignmentService` |
| Whether a driver may deliver | Drivers (`canStartDeliveries`) | Contributes a *vehicle* verdict only |

The recurring pattern: **V2 computes and proposes; V1 commits.** This is what makes
"extend, never redesign" enforceable rather than aspirational.

---

## 1.6 Ownership

### Data ownership

| Concept | Owner | V2 relationship |
|---|---|---|
| Vehicle identity, plate, capacity | **LOG-003 Vehicles** | FK reference |
| Vehicle *condition, fitness, cost* | **V2 Fleet** | New |
| Maintenance *record* (what was done) | **LOG-003 Vehicles** | FK reference — Fleet reads history |
| Maintenance *plan* (what is due) | **V2 Fleet** | New |
| Driver identity, licence, documents | **LOG-002 Drivers** | FK reference |
| Driver *performance* | **V2 DriverOps** | New |
| Driver↔vehicle pairing | **LOG-002 Drivers** | Calls the service |
| Carrier identity, contract | **LOG-001 Shipping Companies** | FK reference |
| Carrier *connectivity, credentials, health* | **V2 Carriers** | New — reuses the existing Provider Platform |
| Trip, stop, custody, settlement | **LOG-004B Distribution** | FK reference; calls services |
| Delivery, attempt, POD, retry | **LOG-005 Delivery** | FK reference; consumes events |
| Zone (operational grouping) | **LOG-004B Distribution** | FK reference |
| Governorate, city | **Logistics Geography** | FK reference |
| Service area, coverage, capacity | **V2 Network** | New, *composed from* the two above |
| Route plan, ETA | **V2 Routing** | New |
| Vehicle position | **V2 Telemetry** | New, optional |

### Organisational ownership

| Role | Owns operationally | Primary V2 surface |
|---|---|---|
| Fleet Supervisor | Vehicle fitness, maintenance, fuel | Fleet Dashboard, Maintenance Workspace |
| Dispatcher | Daily plan, assignments, releases | Dispatch Command Center |
| Operations Manager | Exceptions, escalations, SLA | Logistics Operations Center |
| Carrier Manager | Carrier mix, tendering, carrier SLA | Carrier Workspace |
| Driver | Own task list only | Driver Mobile |
| Finance | Cost of logistics | Reporting (via Accounting) |

---

## 1.7 Why nine contexts and not one module

A single "Logistics V2" module would be simpler to start and impossible to
operate. The split is driven by three forces that pull in genuinely different
directions:

- **Write volume.** Telemetry writes millions of rows a day; Fleet writes
  hundreds. Sharing a module means sharing a retention and indexing strategy that
  suits neither.
- **Availability.** Directive 5 requires the platform to keep working when GPS
  is gone. That is only structurally true if Telemetry is separable.
- **Rate of change.** Carrier adapters change whenever a partner changes their
  API. Fleet's maintenance rules change once a year. Coupling them means
  redeploying stable code to ship volatile code.

Directive 3 adds a fourth, decisive force: Fleet Operations must be independent of
Delivery Execution. Independence that is merely a naming convention inside one
module is not independence — it has to be a boundary the compiler and the
dependency graph can see.
