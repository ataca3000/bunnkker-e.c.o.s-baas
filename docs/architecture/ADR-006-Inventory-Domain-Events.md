# ADR-006 — Inventory Domain Events and Integration Decoupling

**Date:** 2026-06-26
**Status:** Accepted
**Author:** ECOS Architecture Team
**Supersedes (partially):** ADR-003 Section 3 — Outbound Synchronisation via Observer → Queue Pattern

---

## Context

The ECOS ERP inventory domain is the operational core of the system. Every stock change —
a goods receipt, an order reservation, a shipment, an inventory count adjustment — must be
communicated to every connected sales channel so that channels always display accurate
available stock.

The original synchronisation mechanism relied on **Eloquent Model Observers**: the
`SynchronizationServiceProvider` registered a `StockMovementObserver` that watched the legacy
`StockMovement` Eloquent model. When a `StockMovement` record was created, the observer read the
legacy `stock_balances` table and dispatched a `InventorySyncJob` per channel.

This architecture produced two structural failures.

**Failure 1 — Coupling to the persistence model.**
The `Commerce/Synchronization` module directly imported and observed an Eloquent model from
`Inventory/StockLedger`. When the inventory system migrated to a new architecture
(`inventory_items`, `stock_ledger_entries`, FIFO layers), the synchronisation layer became
completely blind to all stock changes made through the new system. The observer never fired
because the new system no longer creates `StockMovement` records.

**Failure 2 — Inverted dependency direction.**
An integration module (Commerce/Synchronization) was reaching into a core business domain
(Inventory) and observing its internal persistence model. This is an inverted dependency:
a peripheral concern (sync to WooCommerce) was coupled to a central concern (inventory management).
Adding a new sales channel, changing how inventory is stored, or adding a new stock movement
type all required touching the synchronisation layer.

The correct direction is the reverse: the Inventory domain announces that something happened,
and any interested party reacts. The Inventory domain must not know who is listening.

This ADR establishes the architectural contract for how inventory state changes are communicated
across module boundaries, both today and as the system grows to support additional channels,
analytical consumers, and financial integrations.

---

## Decision

### Principle 1 — Inventory Owns Inventory

The `Inventory` domain is the single authoritative source of all stock state. It is responsible
for every rule that governs when and how stock quantities change: receiving, reserving, shipping,
adjusting, counting.

The Inventory domain must never contain code whose purpose is to serve an external integration.
It must not know that WooCommerce exists. It must not know that a synchronisation module exists.
It must not know that an analytics module exists.

Any knowledge of an external concern inside the Inventory domain is an architectural violation.

### Principle 2 — Business Events Are the Public Contract

The Inventory domain communicates with the outside world exclusively through **domain events**.

A domain event is a named, past-tense record of a business fact:
*Stock was received. Stock was reserved. Stock was shipped.*

Domain events are the **only** public contract the Inventory domain exposes for reactive
integration purposes. They are not:

- Eloquent models
- Repository interfaces
- Service classes
- HTTP controllers
- Queue jobs

Any external module that needs to react to inventory changes must subscribe to a domain event.
Direct coupling to Inventory's internal implementation is prohibited.

### Principle 3 — Subscribers Are Responsible for Their Own Integration

The Inventory domain announces that something happened. It does not instruct anyone what to do.

When `InventoryStockShipped` is published, the Inventory domain's responsibility ends. It does
not know that a WooCommerce stock update job will be dispatched, that a financial ledger entry
will be written, or that an analytics counter will be incremented. Those are the concerns of
their respective subscriber modules.

Each subscriber receives the same event and acts according to its own rules. Adding a new
subscriber requires no change to the Inventory domain.

### Principle 4 — Events Are Immutable

A domain event represents a fact about the past. The past cannot be changed.

Once published, an event is never modified. Subscribers that need to react differently to
the same event at different points in time must implement their own state management. The event
itself remains an unaltered record of what happened.

Events must not carry mutable state, open transactions, or live object references.

### Principle 5 — Events Are Framework-Independent

A domain event is a business concept, not a framework concept.

Domain events must be expressible as plain value objects with no dependency on any framework
class. They must not extend a framework base class, implement a framework interface, or import
any infrastructure concern.

The **infrastructure** that carries events from publisher to subscriber — whether that is an
in-process event dispatcher, a message queue, a streaming platform, or an event store — is an
implementation detail. The business architecture must be legible and correct regardless of
which infrastructure carries it.

This ADR describes the business architecture. The infrastructure choice is documented separately
in the implementation specification for each subscriber module.

---

## Canonical Event Catalog

The following six events constitute the complete public inventory event contract. Every inventory
action that changes stock state must publish exactly one of these events after its database
transaction commits.

---

### `InventoryStockReceived`

**Purpose:**
Announces that physical stock has arrived at a warehouse and the on-hand quantity has increased.
This is the canonical signal for any subscriber that needs to react to new inventory entering
the system — channels that display available quantity, analytics that track inventory value,
financial systems that record asset increases.

**Trigger:**
A goods receipt is posted. Each product line in the receipt produces one
`InventoryStockReceived` event after the on-hand quantity update and ledger entry are committed.

**Publisher:**
`ReceiveStockAction` — the sole authorised entry point for recording inbound stock.

**Subscribers:**

| Subscriber | Responsibility |
|---|---|
| Commerce / Synchronization | Push updated available quantity to all mapped channels |
| Future: Financial Integration | Record inventory asset increase in the financial ledger |
| Future: Analytics | Update real-time inventory value KPI |

---

### `InventoryStockReserved`

**Purpose:**
Announces that a quantity has been committed to an open order and is no longer available to
promise. Physical stock has not moved. Only the available-to-promise quantity has decreased.
Channels must reduce the quantity they show as available to prevent overselling.

**Trigger:**
An order reservation is accepted and the reserved quantity on the inventory item is incremented.

**Publisher:**
`ReserveStockAction` — the sole authorised entry point for committing stock to orders.

**Subscribers:**

| Subscriber | Responsibility |
|---|---|
| Commerce / Synchronization | Push reduced available quantity to all mapped channels immediately to prevent overselling |

---

### `InventoryStockReleased`

**Purpose:**
Announces that a previously reserved quantity has been returned to the available pool. This
occurs when an order is cancelled before shipment, a reservation expires, or a reservation is
manually reversed. Available quantity increases without any change to physical on-hand stock.

**Trigger:**
An order reservation is released and the reserved quantity on the inventory item is decremented.

**Publisher:**
`ReleaseStockAction` — the sole authorised entry point for releasing reserved stock.

**Subscribers:**

| Subscriber | Responsibility |
|---|---|
| Commerce / Synchronization | Push restored available quantity to all mapped channels |

---

### `InventoryStockShipped`

**Purpose:**
Announces that physical stock has left the warehouse as part of order fulfilment. Both the
on-hand quantity and the reserved quantity decrease. This is the definitive stock reduction
event. It carries cost information derived from FIFO layer consumption to support financial
recording of the cost of goods sold.

**Trigger:**
An order is fulfilled and stock is physically dispatched. The on-hand quantity decreases and
the reservation is simultaneously cleared.

**Publisher:**
`ShipStockAction` — the sole authorised entry point for recording stock departures.

**Subscribers:**

| Subscriber | Responsibility |
|---|---|
| Commerce / Synchronization | Push final available quantity to all mapped channels |
| Future: Financial Integration | Record cost of goods sold entry in the financial ledger using the COGS amount carried in the event payload |

---

### `InventoryStockAdjusted`

**Purpose:**
Announces that an inventory adjustment has changed the on-hand quantity outside of normal
procurement or fulfilment workflows. This covers both increases (found stock, received without
purchase order) and decreases (shrinkage, write-off, damage). It also covers the individual
product corrections applied when a count session is approved.

**Trigger:**
A manual inventory adjustment is applied, or a count session approval processes a product
variance. Each adjusted product produces one `InventoryStockAdjusted` event.

**Publisher:**
`AdjustmentInAction` and `AdjustmentOutAction` — the sole authorised entry points for
inventory corrections.

**Subscribers:**

| Subscriber | Responsibility |
|---|---|
| Commerce / Synchronization | Push corrected available quantity to all mapped channels |
| Future: Financial Integration | Record inventory variance entry in the financial ledger |

---

### `InventoryCountApproved`

**Purpose:**
Announces that a full physical count session has been completed and all variances have been
applied to the inventory records. This is a session-level event that complements the per-product
`InventoryStockAdjusted` events emitted during the same approval process. It is intended for
subscribers that need to react to the count as a whole — for example, reconciliation workflows
or audit trail entries — rather than to individual product adjustments.

**Trigger:**
A count session transitions to the Approved state after all count lines have been reviewed
and all variances have been committed.

**Publisher:**
`ApproveCountSessionAction` — the sole authorised entry point for approving count sessions.

**Subscribers:**

| Subscriber | Responsibility |
|---|---|
| Future: Audit / Compliance | Record session approval in the financial audit trail |
| Future: Analytics | Update accuracy metrics and variance reporting |

---

## Event Payload Rules

Domain event payloads carry the information that subscribers need to act without re-querying
the database. They are defined architecturally here, not as concrete implementation classes.

### What a Payload Must Contain

An event payload must contain only:

- **Identity values** — UUIDs or other identifiers for the product, warehouse, inventory item,
  company, and the reference document that caused the movement (e.g., the goods receipt ID or
  order ID).
- **Scalar quantity values** — the quantity affected by the movement, the on-hand quantity
  before and after the movement, the reserved quantity before and after, and the derived
  available-to-promise quantity (on-hand minus reserved) at the moment the event was published.
- **Scalar cost values** — unit cost, total cost, or weighted average cost where the movement
  type makes these meaningful (receipt, shipment).
- **Classification values** — the movement type (a scalar string or equivalent), the reference
  type, and the adjustment direction where applicable.
- **A timestamp** — the wall-clock time at which the event occurred, expressed as an immutable
  date-time value.

### What a Payload Must Not Contain

An event payload must never contain:

- **Eloquent model instances** — models carry database connections, lazy-loading behaviour,
  and mutable state. A subscriber that stores or forwards an event containing a model instance
  will encounter serialisation failures, stale data, or transaction leakage.
- **Repository objects** — repositories are infrastructure. An event payload is a business fact.
- **Service objects** — services carry dependencies and behaviour. Payloads carry data.
- **HTTP request or response objects** — events are business records, not protocol artefacts.
- **Any object that references a framework container** — if the object cannot be serialised
  to a string or a simple data structure and faithfully reconstructed, it does not belong in
  an event payload.

### Payload Completeness Rule

A subscriber must be able to perform its primary responsibility using only the data in the event
payload, without making additional database queries to read the state that the event describes.

The publisher is responsible for including a sufficient snapshot. If a subscriber consistently
needs data that is not in the payload, that data belongs in the payload.

---

## Dependency Direction

The following diagram shows the required dependency direction between all layers involved in
the inventory synchronisation architecture.

```
┌──────────────────────────────────────────────────────────────────┐
│  INVENTORY DOMAIN                                                │
│                                                                  │
│  Action classes mutate state and publish events.                 │
│  The domain knows nothing beyond its own boundary.               │
│                                                                  │
│  InventoryStockReceived                                          │
│  InventoryStockReserved      ← domain event value objects        │
│  InventoryStockReleased           (no framework dependencies)    │
│  InventoryStockShipped                                           │
│  InventoryStockAdjusted                                          │
│  InventoryCountApproved                                          │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ publishes
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│  DOMAIN EVENT BUS                                                │
│                                                                  │
│  Infrastructure-level transport.                                 │
│  Implementation is hidden from the business domain.              │
│  (See: Domain Event Bus section below)                           │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ delivers to
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│  SUBSCRIBER MODULES                                              │
│                                                                  │
│  Each module registers its own listeners.                        │
│  Listeners are never registered inside Inventory's provider.     │
│                                                                  │
│  Commerce / Synchronization  ← imports only event contracts      │
│  Future: Financial Integration                                   │
│  Future: Analytics                                               │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ dispatches
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│  INTEGRATION JOBS (queued, async)                                │
│                                                                  │
│  Resolve which channels are affected.                            │
│  Delegate to the appropriate channel adapter.                    │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ calls
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│  CHANNEL ADAPTER LAYER                                           │
│                                                                  │
│  WooCommerceStockAdapter                                         │
│  ShopifyStockAdapter         ← future                            │
│  AmazonStockAdapter          ← future                            │
│  POSStockAdapter             ← future                            │
└────────────────────────────────┬─────────────────────────────────┘
                                 │ calls
                                 ▼
                         External Channels
```

### Prohibited Dependencies

The following dependency directions violate this ADR and must never appear in the codebase:

| From | To | Why Prohibited |
|---|---|---|
| Inventory / any module | Commerce / Synchronization | Inventory must not know integrations exist |
| Inventory / any module | Any channel adapter | Inventory must not know channels exist |
| Inventory Action class | Any listener or job class | Publishers must not know their subscribers |
| Event payload | Any Eloquent model class | Payloads must be serialisable and framework-free |
| Inventory ServiceProvider | Event listener registrations for other modules | Each module registers its own listeners |

### The One Permitted Inbound Dependency

Subscriber modules may import the **event value object classes** from the Inventory domain.
This is the only permitted import from Inventory by any other module. Event classes are
read-only value objects with no side effects. Importing them does not create a coupling to
Inventory's internal state management.

---

## Domain Event Bus

The Domain Event Bus is the infrastructure component that carries events from publishers to
subscribers. It is deliberately not specified in this ADR as a named technology or framework.

### Requirements

The event bus must satisfy the following requirements:

1. **At-least-once delivery** — an event published after a committed transaction must be
   delivered to all registered subscribers. An event must never be silently dropped.

2. **After-commit guarantee** — events must not be delivered to subscribers if the database
   transaction that produced them is rolled back. A failed transaction must produce no events.

3. **Subscriber isolation** — a failure in one subscriber must not prevent other subscribers
   from receiving the event.

4. **Ordered delivery per aggregate** — events for the same inventory item must be delivered
   to subscribers in the order they were published. Out-of-order delivery could cause a
   subscriber to apply a `StockShipped` event before a `StockReserved` event and compute
   incorrect available quantities.

5. **Observability** — the event bus infrastructure must produce logs or metrics that allow
   operators to verify event delivery and diagnose failures.

### Implementation Options

The business architecture defined in this ADR is compatible with any infrastructure that
satisfies the requirements above:

| Infrastructure | Notes |
|---|---|
| In-process event dispatcher (e.g. Laravel Events) | Suitable for a modular monolith. Simple to operate. Synchronous delivery within the same process. Async delivery via queued listeners. |
| Transactional outbox + message relay | Stronger at-least-once guarantee across process restarts. Adds operational complexity. |
| Message broker (e.g. RabbitMQ, Redis Streams) | Required if subscribers run in separate processes or services. Adds infrastructure dependency. |
| Event store (e.g. EventStoreDB) | Enables event sourcing and full replay. Highest operational complexity. |

The current implementation phase (modular monolith, single process) uses an in-process event
dispatcher. The business architecture will not change if the infrastructure is later replaced
with a message broker.

---

## Listener Strategy

### Do Not Fragment Listeners by Event

A fragmented listener strategy — one listener class per event per module — produces a large
number of small, nearly identical classes. Each listener queries the same `ProductMapping`
table, applies the same channel-filter logic, and dispatches the same job type. The behaviour
is dispersed across many files without meaningful separation of concerns.

### Group Listeners by Integration Responsibility

Listeners should instead be grouped by the **integration responsibility** they serve.

**Recommended grouping for Commerce / Synchronization:**

```
InventoryChannelSynchronizationListener
```

A single listener class subscribes to all inventory events that require a channel stock push.
It handles `InventoryStockReceived`, `InventoryStockReserved`, `InventoryStockReleased`,
`InventoryStockShipped`, and `InventoryStockAdjusted` through dedicated handler methods within
the same class.

This approach:

- Keeps all channel-push logic in one place, making it easy to find and reason about
- Allows shared logic (product mapping lookup, channel filter) to be extracted to private
  methods within the class, avoiding duplication
- Reduces the number of files that must be updated when the channel push logic changes
- Keeps the event registration surface in the service provider clean and compact

**Separate listener for session-level events:**

```
InventoryCountCompletionListener
```

Count session approval (`InventoryCountApproved`) carries different semantics and has
different subscribers (audit, analytics). It is handled by a dedicated listener that
does not mix with the per-movement stock push logic.

### Single Responsibility Is Preserved

Grouping by integration responsibility does not violate the Single Responsibility Principle.
The principle states that a class should have one reason to change. All stock-push events share
the same reason to change: the channel push mechanism, the product mapping strategy, or the
job dispatching approach. They are one responsibility.

If a future subscriber module introduces an entirely different integration concern — for example,
a financial ledger listener — that concern gets its own listener class in its own module. The
grouping principle applies within a module, not across modules.

---

## Migration Strategy

The migration from Eloquent Observer to Domain Events is designed to proceed without any period
of lost synchronisation and without requiring a feature freeze.

### Phase 1 — Shadow Mode

Domain events are introduced alongside the existing observer. Action classes begin publishing
events after their transactions commit. Subscriber listeners are registered but operate in
**shadow mode**: they log the received event and its payload without dispatching any integration
jobs.

During this phase the system runs in parallel: the observer continues to dispatch jobs as
before, and the event payload is verified against the expected values in the logs.

Rollback: remove event publishing from Action classes. The observer continues operating. No
functional change has occurred.

### Phase 2 — Dual Run

Subscriber listeners are promoted from shadow mode to active mode. They now dispatch
integration jobs in response to events. The observer continues running in parallel.

During this phase, some stock pushes are triggered twice for legacy paths (both the observer
and the new listener fire for the same movement). This is acceptable because channel stock
push jobs are idempotent: pushing the same quantity twice produces the same channel state.

Monitoring confirms that event-triggered pushes produce correct channel stock levels. Any
divergence between observer-triggered and event-triggered results is diagnosed and resolved
before proceeding.

Rollback: revert listeners to shadow mode. Observer continues operating. No functional
regression.

### Phase 3 — Observer Removal

The Eloquent observer registration is removed from the synchronisation service provider.
The observer class is deleted. The Inventory domain event contracts are now the sole
trigger for all integration synchronisation.

Prerequisite: all inventory write paths that previously created `StockMovement` records
must have been migrated to the new inventory system and must publish domain events. No
legacy write path may remain active at the point of observer removal.

Rollback: re-register the observer. Both systems fire simultaneously. Idempotent jobs
absorb the duplication.

---

## Relationship to Existing ADRs

### ADR-002 — Immutable Stock Ledger

Unchanged. The `stock_ledger_entries` table remains the authoritative, immutable audit record
of every stock movement. Domain events carry a snapshot of the state change described by a
ledger entry. They are complementary: the ledger entry is the permanent business record; the
event is the notification to subscribers. They are not alternatives to each other.

The event payload's quantity and cost fields must be consistent with the corresponding ledger
entry. A subscriber that computes a value from the event payload and later verifies it against
the ledger must arrive at the same result.

### ADR-003 — External Sales Channel Integration Philosophy

**Partially superseded by this ADR.**

ADR-003 Section 3 defines the outbound synchronisation mechanism as:

> *Model Observer → Queued Job → WooCommerce REST API*

with the specific mapping:

> *StockMovementObserver | Stock movement created | InventorySyncJob*

This mechanism is superseded. The observer is replaced by domain event listeners as specified
in this ADR. The remainder of ADR-003 — ERP as master of record, channels as consumers,
sync direction, conflict resolution philosophy, idempotency requirements, and audit log
requirements — remains in full force and is not modified.

ADR-003 should be updated to mark Section 3 as: *"Observer mechanism superseded by
ADR-006 — see Domain Event Bus and Listener Strategy."*

### ADR-004 — Inventory Architecture

Unchanged in substance. ADR-004 defines the three-layer inventory model
(`inventory_items`, `stock_ledger_entries`, `inventory_receipt_layers`) and the Action class
map that governs all inventory mutations.

This ADR adds a layer to that model: after an Action class commits its transaction, it
publishes a domain event. Domain events are an outbound communication mechanism layered
on top of ADR-004's architecture, not a replacement for any part of it. The Action class
map in ADR-004 identifies which action publishes which event.

ADR-004's Domain Action Map should reference ADR-006 in each row to indicate which event
the action publishes.

### ADR-005 — Order Ownership and Lifecycle

Unchanged. ADR-005 establishes that the ERP owns order lifecycle after acceptance and that
status flows outbound from ERP to channel.

Domain events are the mechanism by which inventory state changes — reservation and shipment —
are communicated to the channel synchronisation layer. `InventoryStockReserved` and
`InventoryStockShipped` are the implementation instruments for the inventory obligations
described in ADR-005. They do not modify the ownership rules or status direction defined
in ADR-005.

---

## Consequences

### Positive

- **Module independence:** The Inventory domain can be developed, tested, and reasoned about
  without any knowledge of WooCommerce, Shopify, financial systems, or any other consumer.
  A developer working on inventory logic does not need to understand channel synchronisation.

- **Unlimited extensibility:** Adding a new sales channel, a financial integration, or an
  analytics pipeline requires creating a new subscriber and registering it. Zero changes to
  the Inventory domain are required.

- **Correct data flow:** Stock changes made through the new inventory system (`ReceiveStockAction`,
  `ShipStockAction`, etc.) now produce the same channel push behaviour as changes made through
  any other path. The dual-inventory system blind spot is structurally eliminated.

- **Testability:** Domain events are plain value objects. The behaviour that subscribers produce
  in response to events can be tested in complete isolation from the database, the queue, and
  the channel API.

- **Auditability:** Every event represents a business fact. Event logs provide a complete,
  timestamped history of every inventory change notification, independent of the ledger.

- **Framework portability:** If the infrastructure layer changes — for example, moving from
  an in-process dispatcher to a message broker as the system scales — the business architecture
  and all subscriber logic remain unchanged.

### Negative / Trade-offs

- **After-commit discipline:** Event publishers must guarantee that events are dispatched only
  after the database transaction commits. If an event is dispatched inside the transaction
  and the transaction rolls back, subscribers receive a notification about a change that
  never happened. This constraint requires careful implementation and code review enforcement.

- **Event schema is a public contract:** Once subscribers depend on an event's payload shape,
  changing that shape is a breaking change. Adding new fields is safe. Removing or renaming
  fields requires a versioning strategy. The event catalog in this ADR is a commitment.

- **Ordered delivery must be maintained:** If events for the same product arrive out of order
  at a subscriber, computed available quantities may be temporarily incorrect. The event bus
  infrastructure must preserve per-aggregate ordering, and subscribers must handle late delivery
  gracefully.

- **Observability gap during migration:** During Phase 2 (Dual Run), the same channel push
  may occur twice for some paths. Monitoring must confirm idempotency and detect any case
  where duplicated pushes cause unintended behaviour.

- **Discipline required at action boundaries:** Every developer who adds a new inventory
  action — or modifies an existing one — must remember to publish the appropriate domain event.
  This is a convention, not a compile-time constraint. Code review must enforce it.

---

## Future Considerations

- **Event versioning:** As the event catalog evolves, fields may need to be added or retyped.
  A versioning strategy (e.g., `version` field in the payload, parallel event class for
  breaking changes) should be defined before the first breaking payload change is required.

- **Outbox pattern:** If the system ever requires a stronger guarantee that no event is lost
  even during process crashes between the transaction commit and the event dispatch, the
  transactional outbox pattern should be introduced. This is not required for the current
  deployment model.

- **Event replay:** If subscribers need to reconstruct their state from scratch (e.g., after
  a new subscriber is deployed and needs to process historical events), the event infrastructure
  must support replay from a point in time. This requires durable event storage, not just
  in-process dispatch.

- **Saga coordination:** If future workflows require coordinated state changes across multiple
  domains in response to a single business operation — for example, a return that triggers
  both inventory restoration and a financial reversal — a saga or process manager pattern
  should be defined in a dedicated ADR. Domain events are the input trigger for sagas but
  do not themselves define the coordination logic.

- **Consumer-driven contract testing:** As the number of subscribers grows, verifying that
  event payloads satisfy all subscribers' expectations becomes important. Consumer-driven
  contract tests (e.g. Pact) should be evaluated when the event catalog reaches five or more
  active subscribers.

---

## Related ADRs

- **[ADR-012 — Unified Enterprise Pricing Policy](adr/ADR-012-unified-enterprise-pricing-policy.md):**
  The `InventoryStockReceived` event — published by `ReceiveStockAction` after a goods receipt
  commits — is the upstream trigger for the full pricing cascade. The landed unit cost carried
  in the event payload seeds the `material_cost` update, which cascades through `recipe_cost`
  to `product_cost`, which creates a mandatory `PricingReview`. ADR-012 defines the rules and
  approval workflow that govern what happens after this cascade completes.
