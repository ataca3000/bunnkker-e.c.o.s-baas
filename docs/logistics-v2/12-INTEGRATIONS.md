# §12 — Integrations

Two rules govern every integration in this document:

1. **Inbound to V2 is asynchronous** — V2 subscribes to domain events. The
   publisher has no knowledge of V2.
2. **Outbound from V2 is a service call** — V2 calls the owning module's own
   service, never its tables.

ECOS's **Enterprise Event Platform** (PKG-17) is the transport.
`EventPlatformServiceProvider` overrides `DomainEventBus` with
`EnterpriseEventBus`, so V2 listeners must register through the platform —
`Event::listen()` alone will not capture module events.

---

## 12.1 Orders

| Direction | Interaction | Mechanism |
|---|---|---|
| Orders → V2 | Order confirmed with a delivery date and address | Domain event → Network resolves coverage, reserves capacity |
| Orders → V2 | Order cancelled | Event → Network releases capacity; Dispatch drops it from a proposal |
| Orders → V2 | Delivery window changed | Event → Routing re-plans the remainder |
| V2 → Orders | "Can this area take this volume on this date?" | `GET /network/capacity/availability` |

**The boundary that matters:** Network is *advisory*. It answers with remaining
capacity and a shortfall; it never rejects an order. Orders decides. This is the
same stance `BranchAssignmentEngine` (TASK-BRANCH-ASSIGNMENT-001) already takes —
a no-coverage result is an Ops signal, not a hard stop.

V2 never writes an order, never changes an order status, and never touches
pricing.

---

## 12.2 Distribution (LOG-004B)

The highest-traffic integration and the most carefully bounded.

| Direction | Interaction | Mechanism |
|---|---|---|
| Distribution → V2 | `TripDispatched` | Routing activates the plan; Telemetry begins tracking if enabled |
| Distribution → V2 | Trip status changes | Dispatch board reflects; Operations Center projects |
| Distribution → V2 | Stop completed | Routing refines ETA (L2); Fleet accrues cost attribution |
| Distribution → V2 | Trip closed | Fleet posts trip cost; DriverOps updates the scorecard |
| V2 → Distribution | Create or update a trip | **`TripService`** |
| V2 → Distribution | Change trip status | **`TripService`** |
| V2 → Distribution | Read stops for routing | Read-only query |

**Hard prohibitions:**

- V2 writes no `distribution_*` table. Ever.
- V2 does not touch `distribution_trip_settlements` or
  `distribution_payment_collections` — **Distribution remains the Single Cash
  Authority**, exactly as established for Delivery in LOG-005.
- V2 does not transition `TripStatus` directly; it calls the service and accepts
  the service's refusal.

`dispatch_releases` records the V1 trip id and assignment id returned by those
service calls, which makes compliance auditable after the fact rather than a
matter of trust.

---

## 12.3 Delivery & Tracking (LOG-005)

| Direction | Interaction | Mechanism |
|---|---|---|
| Delivery → V2 | `DeliveryFailed` | Routing drops or re-sequences; DriverOps records; Operations Center alerts |
| Delivery → V2 | `DeliverySucceeded` | Routing refines ETA; DriverOps scores; Fleet attributes cost |
| Delivery → V2 | `DeliveryRetryScheduled` | Dispatch includes it in tomorrow's plan; Network re-reserves capacity |
| Delivery → V2 | `SlaBreached` | Operations Center alert; DriverOps records |
| Delivery → V2 | `CodCollected` | Fleet records the *fact* for reconciliation visibility — **no settlement maths** |
| V2 → Delivery | Driver-app intents | **`DeliveryExecutionService`, `PodValidationService`, `CodCompletionService`, `DeliveryReturnService`** |
| V2 → Delivery | Carrier status updates | Normalized event → the same Delivery services |
| V2 → Delivery | Predicted SLA breach | New Routing event; Delivery is not modified |

Two points of emphasis.

**`EtaBreachPredicted` is additive.** V2 predicts a breach; Delivery continues to
derive actual breach exactly as it does today, from
`promised_at + sla_grace_minutes`. There is one SLA definition, owned by Delivery,
and V2 forecasts against it rather than inventing a second one.

**Carrier deliveries go through Delivery's services, not around them.** A
carrier-delivered order obeys BR-7 and BR-8 like any other. Where a carrier
supplies no POD, that is an explicit configured empty required-artifact set
recorded on the POD — a visible policy decision, never a silent skip.

---

## 12.4 Drivers (LOG-002) and Vehicles (LOG-003)

| Direction | Interaction | Mechanism |
|---|---|---|
| Vehicles → V2 | Vehicle created | `FleetUnitFactory` creates the FleetUnit |
| Vehicles → V2 | `VehicleStatus` changed | Fleet re-evaluates fitness |
| Vehicles → V2 | Document expiring | Fleet fitness input, read from V1 |
| Drivers → V2 | Licence expiring / status changed | Dispatch resource pool updates |
| Drivers → V2 | Assignment created or ended | Dispatch and Telemetry follow |
| V2 → Vehicles | Take a vehicle off the road | **`VehicleService`** |
| V2 → Vehicles | Record completed maintenance | **`VehicleMaintenanceService`** |
| V2 → Drivers | Pair driver and vehicle | **`DriverVehicleAssignmentService`** |

`Driver::canStartDeliveries()` and `Vehicle::canBeDispatched()` remain LOG-002's
and LOG-003's own gates. Fleet contributes a *vehicle health* verdict consumed by
Dispatch — see [§3.4](03-FLEET-ARCHITECTURE.md#34-the-readiness-seam). Fleet never
duplicates or overrides those gates.

---

## 12.5 Inventory

Deliberately thin. V2 does not touch stock, and ADR-027 (reservation ownership) is
untouched.

| Direction | Interaction | Purpose |
|---|---|---|
| Inventory → V2 | Item weight, volume, cold-chain flag | Routing capacity constraints |
| Inventory → V2 | Warehouse locations | Routing origins; Network service-area origins |
| V2 → Inventory | Customer return received (from Delivery) | Already handled by LOG-005; V2 adds nothing |

V2 reserves nothing, moves nothing, and counts nothing.

---

## 12.6 CRM

| Direction | Interaction | Purpose |
|---|---|---|
| CRM → V2 | Customer address and coordinates | Routing, coverage resolution |
| CRM → V2 | Delivery preferences and access notes | Routing constraints; driver stop detail |
| V2 → CRM | Predicted ETA | Proactive customer communication |
| V2 → CRM | Repeated failed access at an address | Data-quality signal for address correction |

The last row closes a loop LOG-005 opened: `FailureReason` already distinguishes
address-category failures and flags `requires_address_correction`. Feeding a
pattern of those failures back to CRM is how the address actually gets fixed
rather than failing again next week.

---

## 12.7 Accounting

| Direction | Interaction | Mechanism |
|---|---|---|
| V2 → Accounting | Fuel expense | Posted from `fleet_cost_entries` |
| V2 → Accounting | Maintenance expense | Posted on work-order completion |
| V2 → Accounting | Carrier shipment cost | Posted per shipment |
| V2 → Accounting | Depreciation accrual | Monthly |
| Accounting → V2 | Cost centre and GL mapping | Configuration |

**The cash boundary, restated:** Fleet records *expenses*. Distribution reconciles
*trip cash*. These are different ledgers with different owners and they must not be
conflated. A fuel purchase is an operating expense; COD collected at a door is
trip cash. Fleet posts to Accounting; it never posts to a settlement table.

---

## 12.8 AI Platform

The AI seams already designed in, so a future AI initiative needs no
architectural change:

| Seam | Consumer | Training data available from day one |
|---|---|---|
| `RoutingStrategyInterface` | Routing | `routing_optimization_runs` — snapshot, choice, outcome |
| `DwellTimePredictor` | Routing | `delivery_attempts` — `arrived_at` → `closed_at` |
| Failure prediction | Routing, Dispatch | `delivery_failures` — labelled taxonomy, 15 reasons |
| Maintenance prediction | Fleet | Odometer series, defects, work orders |
| Fuel anomaly detection | Fleet | Fuel transactions with odometer |
| Carrier selection | Carriers | Tender attempts and outcomes |
| Demand and capacity forecast | Network | Capacity commitments vs. consumption |

The point worth making to the CTO: **every one of these datasets accumulates from
the day V2 ships, at no extra cost, because the audit tables exist for operational
reasons anyway.** `routing_optimization_runs` and `delivery_failures` in particular
are labelled training sets produced as a by-product of running the business.

Integration follows the existing AIOP architecture (`docs/aiop/`) and Claude Bridge
patterns where those are approved.

---

## 12.9 Notifications

| Trigger | Audience | Channel |
|---|---|---|
| Vehicle became unfit | Fleet supervisor | In-app, push |
| Maintenance overdue | Fleet supervisor | In-app, email digest |
| Dispatch board not released by cutoff | Operations manager | In-app, push |
| Predicted SLA breach | Zone supervisor | In-app |
| Carrier health degraded | Carrier manager | In-app, email |
| Capacity threshold breached | Sales, operations | In-app |
| Trip assigned | Driver | Push to device |
| Trip cancelled or reassigned | Driver | Push, with reason |
| ETA update | Customer | Via CRM / Customer Engagement |

Notifications derive from the Operations Center's alert rules, so **alerts and
notifications share deduplication and suppression**. Without that, one incident
becomes one alert plus forty emails.

Customer-facing ETA messages go through the existing Customer Engagement platform
rather than a new channel, and carry the same redaction discipline as LOG-005's
public timeline — customers see status, never operator identity or internal notes.

---

## 12.10 Integration compliance checklist

Assertions that should become architecture tests:

| # | Assertion |
|---|---|
| 1 | No V2 module writes a `distribution_*` table |
| 2 | No V2 module writes a `delivery_*` table |
| 3 | No V2 module writes `logistics_drivers`, `logistics_vehicles` or `logistics_shipping_companies` |
| 4 | No V2 module writes a settlement or payment-collection table |
| 5 | Trip creation and status changes go through `TripService` |
| 6 | Driver↔vehicle pairing goes through `DriverVehicleAssignmentService` |
| 7 | V1 maintenance records are created through `VehicleMaintenanceService` |
| 8 | Driver-app intents replay through the owning module's service |
| 9 | Carrier events reach Delivery only through Delivery's services |
| 10 | No integration path requires Telemetry to be present |
