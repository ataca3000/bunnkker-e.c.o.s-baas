# EPIC-LOG-V2-001 — Enterprise Logistics Operations Platform

**Status:** Architecture & Design — awaiting CTO Architecture Review
**Authorization:** Design only. No implementation, no migrations, no code.
**Extends:** Logistics V1 (LOG-001 → LOG-005), which is complete and frozen.

---

## How to read this document set

| # | Document | Deliverable section |
|---|---|---|
| — | `README.md` | Index, principles, ownership map |
| 01 | [Business Analysis](01-BUSINESS-ANALYSIS.md) | §1 |
| 02 | [Domain Architecture](02-DOMAIN-ARCHITECTURE.md) | §2 |
| 03 | [Fleet Architecture](03-FLEET-ARCHITECTURE.md) | §3 |
| 04 | [Route Optimization](04-ROUTE-OPTIMIZATION.md) | §4 |
| 05 | [Driver Mobile Platform & GPS](05-DRIVER-MOBILE-PLATFORM.md) | §5 |
| 06 | [External Carrier Platform](06-EXTERNAL-CARRIER-PLATFORM.md) | §6 |
| 07 | [Logistics Operations Center](07-OPERATIONS-CENTER.md) | §7 |
| 08 | [Database Design](08-DATABASE-DESIGN.md) | §8 |
| 09 | [State Machines](09-STATE-MACHINES.md) | §9 |
| 10 | [API Architecture](10-API-ARCHITECTURE.md) | §10 |
| 11 | [UI / UX](11-UI-UX.md) | §11 |
| 12 | [Integrations](12-INTEGRATIONS.md) | §12 |
| 13 | [Security](13-SECURITY.md) | §13 |
| 14 | [Reporting](14-REPORTING.md) | §14 |
| 15 | [Risks](15-RISKS.md) | §15 |
| 16 | [Implementation Roadmap](16-ROADMAP.md) | §16 |

---

## What V1 already is

V1 answered *"who delivers, on what, to whom, and did it arrive?"* It is complete
and must not be reopened.

| Module | Owns | Tables |
|---|---|---|
| **LOG-001** Shipping Companies | Carrier master data, contracts, ECOS-company mapping | `logistics_shipping_companies`, `logistics_shipping_contracts`, `logistics_shipping_company_mappings` |
| **LOG-002** Drivers | Driver master data, licences, documents, **driver↔vehicle pairing** | `logistics_drivers`, `logistics_driver_documents`, `logistics_driver_vehicle_assignments` |
| **LOG-003** Vehicles | Vehicle master data, maintenance records, documents | `logistics_vehicles`, `logistics_vehicle_maintenance_records`, `logistics_vehicle_documents` |
| **LOG-004B** Distribution | Trip as operational unit, stops, custody, **cash settlement** | 12 `distribution_*` tables |
| **LOG-005** Delivery & Tracking | Order's journey, attempts, POD, failures, retry, returns | 9 `delivery_*` tables |

V1 also established three boundaries that V2 inherits verbatim:

1. **Distribution is the Single Cash Authority.** Nothing else computes settlement.
2. **Drivers owns the driver↔vehicle pairing.** Nothing else pairs them.
3. **Delivery consumes `DeliveryStop` read-only.** Nothing writes across that line.

> **Historical note.** `Modules/Operations/Distribution` once held duplicate
> `FleetVehicle`, `FleetDriver` and `ExternalCarrier` classes. All 70 files were
> deleted in TASK-LOG-004B. V2 introduces a `Fleet` context — it must **not**
> resurrect those names or their tables. Fleet in V2 is *health and cost*, never
> *identity*.

---

## What V2 is

V2 answers a different question: *"can we run this at scale, profitably, tomorrow
as well as today?"*

V1 is **transactional**. V2 is **operational**: it is about readiness, capacity,
utilisation, cost and control across many warehouses, fleets, regions and carriers.

The distinction matters because it decides where every new concept lands. A rule of
thumb used throughout this design:

> If it answers *"what happened to this order?"* it belongs to V1.
> If it answers *"is the operation healthy and what should we do next?"* it belongs to V2.

---

## Nine new bounded contexts

V2 adds nine contexts under `backend/Modules/Logistics/`. **No V1 table is
redesigned.** Where V2 needs a V1 fact it holds a foreign key and reads it.

| Context | Answers | Scope items |
|---|---|---|
| `Fleet` | Is this vehicle fit, serviced, fuelled, and what does it cost? | 1, 2, 3, 4, 14 |
| `Network` | Where do we serve, and how much can we absorb? | 12, 13 |
| `Routing` | In what order and by which path? | 7 |
| `Dispatch` | Which trip gets which resources, now? | 8, 16 |
| `Telemetry` | Where is the vehicle? *(optional — see Directive 5)* | 6, 9 |
| `Carriers` | How do we talk to carriers we don't own? | 10, 11 |
| `DriverApp` | How does the phone talk to the server? | 5 |
| `DriverOps` | How well is this driver performing? | 17 |
| `OperationsCenter` | What needs a human right now? | 15, 16, 18 |

---

## Design principles (binding, from the CTO directives)

**P1 — Extend, never redesign.** V2 modules depend on V1 aggregates by ID.
Every V1 table stays as it is. The design proposes exactly **two** additive V1
extensions ([§8.9](08-DATABASE-DESIGN.md#89-additive-v1-extensions-requiring-approval));
both are flagged for explicit approval and neither changes existing semantics.

**P2 — No duplicate master data.** There is one `Vehicle`, one `Driver`, one
`ShippingCompany`, and they live in V1. Fleet does not own vehicle identity; it
owns *vehicle condition*. Carriers does not own carrier identity; it owns
*carrier connectivity*.

**P3 — Fleet Operations is independent of Delivery Execution.** Fleet must be
runnable with Distribution and Delivery switched off entirely. Traffic between
them is one-way and asynchronous: Distribution and Delivery **publish**, Fleet
**subscribes**. Fleet never calls into Delivery, and never writes a
`distribution_*` or `delivery_*` row. The single point of contact in the other
direction is a read-only capability query described in
[§3.4](03-FLEET-ARCHITECTURE.md#34-the-readiness-seam).

**P4 — The driver's phone decides nothing.** The device submits *intents*; the
server evaluates them against the domain and returns the resulting state. Every
business rule already enforced in V1 stays server-side. The device may render a
prediction, but the server's answer always wins.

**P5 — GPS is optional and only ever additive.** No state machine transition,
readiness gate, or settlement may depend on a GPS fact. If telemetry is
unavailable, the platform degrades to manual check-in and then to time-based
inference — with the degradation visible to operators, never silent.

**P6 — Carriers are adapters.** The core domain speaks only
`CarrierAdapterInterface`. No carrier name, endpoint, field mapping or quirk
appears outside its adapter. Adding a carrier is a new class plus configuration,
never a change to a service.

**P7 — Routing is a strategy.** Route optimisation is a pure function from an
immutable snapshot to a proposed plan, behind `RoutingStrategyInterface`. A future
AI optimiser is a new strategy, not a redesign. Every run is recorded and
replayable.

**P8 — Single source of truth (ADR-024).** Every entity has one canonical home and
one canonical cache key. Read models in `OperationsCenter` are projections and are
explicitly marked as such; they are never written to directly and never treated as
authority.

**P9 — Clean architecture.** `Domain` knows nothing of HTTP, Eloquent or
providers. `Infrastructure` implements `Domain` contracts. `Presentation` is thin.
This is the layout every V1 module already uses.

---

## Governing ADRs

| ADR | Relevance to V2 |
|---|---|
| ADR-011 Event-Driven | All cross-context communication is events; immutable and actor-stamped |
| ADR-015 Enterprise Fulfillment | V2 sits alongside the Orders→…→Delivery chain, never inside it |
| ADR-024 Single Source of Truth | Canonical cache keys; mutations invalidate the broad prefix |
| ADR-025 Dashboard Freeze | V2 KPIs integrate additively via `KpiService` → `InsightEngine`; the dashboard API is not reopened |
| ADR-027 Reservation Ownership | Unchanged; V2 never touches reservations |

---

## Explicit non-goals

- No redesign of Orders, Inventory, Manufacturing, Procurement, CRM or Accounting.
- No redesign of any V1 Logistics module.
- No replacement of Distribution's trip model. V2 **plans and monitors** trips;
  Distribution still **executes** them.
- No new cash authority. Fuel and cost ledgers in Fleet are *expense records*, not
  settlement, and are reconciled into Accounting, never into trip cash.
