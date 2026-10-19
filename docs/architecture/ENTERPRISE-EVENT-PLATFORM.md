# Enterprise Event Platform — Specification

**Document:** ENTERPRISE-EVENT-PLATFORM  
**Service:** EPS-01  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-EPS-ARCH-001  
**Parent:** ENTERPRISE-PLATFORM-SERVICES.md

---

## 1. Mission

> Provide a unified **Business Event Architecture** — the backbone of all cross-module communication in ECOS.

This document describes **what events are**, **how they flow**, and **how they are governed**.  
It is not concerned with Kafka, RabbitMQ, Redis Streams, or any other implementation technology.  
Implementation choice is an infrastructure decision deferred to the implementation phase.

---

## 2. Core Principle

> **No module directly calls another module for business workflow.**

All cross-module communication happens through Events:

```
Module A performs an action
    ↓
Module A publishes a BusinessEvent
    ↓
Enterprise Event Platform receives and routes the event
    ↓
Module B, C, D... (subscribers) consume the event
    ↓
Each subscriber acts independently
```

This eliminates direct coupling between modules. Module A never knows which modules will react to its events — and does not care.

---

## 3. BusinessEvent Entity

Every business event in ECOS must conform to this structure:

```
BusinessEvent
├── event_id              uuid          — globally unique; generated at raise time
├── event_type            string        — dot-notation (e.g. "order.confirmed") 
├── event_version         int           — schema version of this event type (default: 1)
│
├── aggregate_type        string        — the domain object that changed (e.g. "Order")
├── aggregate_id          uuid          — the ID of the specific business object
│
├── company_id            uuid          — which company this event belongs to
├── channel_id            uuid (nullable) — which channel (if applicable)
│
├── occurred_at           timestamp     — when the business action happened (not when published)
├── published_at          timestamp     — when the event was accepted by the platform
│
├── triggered_by          → User (nullable) — the user who caused the action; null for system events
├── triggered_by_type     enum: user | system | scheduled | ai | external
│
├── correlation_id        uuid          — links events in the same business workflow
├── causation_id          uuid (nullable) — the event_id that caused this event (event chaining)
│
├── source_module         string        — which module published this (e.g. "Commerce")
│
├── payload               JSONB         — event-specific data; schema defined per event_type
│
└── metadata              JSONB (nullable) — optional non-business context (e.g. request_id, ip)
```

**Immutability rule:** BusinessEvent records are immutable after publishing. They may never be modified or deleted.

---

## 4. Event Categories and Types

### 4.1 Category Registry

| # | Category | Aggregate Type | Example Event Types |
|---|---|---|---|
| 1 | **orders** | Order | `order.confirmed` · `order.cancelled` · `order.status_changed` · `order.line.added` |
| 2 | **inventory** | InventoryItem | `inventory.stock.adjusted` · `inventory.stock.zeroed` · `inventory.movement.created` |
| 3 | **reservations** | Reservation | `reservation.created` · `reservation.confirmed` · `reservation.released` · `reservation.expired` |
| 4 | **preparation** | PreparationWave | `preparation.wave.created` · `preparation.wave.completed` · `preparation.shortage.detected` · `preparation.product.prepared` |
| 5 | **loading** | LoadingSession | `loading.session.opened` · `loading.session.completed` · `loading.product.loaded` · `loading.exception.raised` |
| 6 | **allocation** | OrderAllocation | `allocation.completed` · `allocation.partial` · `allocation.override.applied` · `allocation.revision.created` |
| 7 | **packing** | PackingSession | `packing.session.opened` · `packing.order.packed` · `packing.label.printed` · `packing.session.completed` |
| 8 | **logistics** | Delivery | `logistics.route.planned` · `logistics.vehicle.dispatched` · `logistics.delivery.confirmed` · `logistics.delivery.failed` · `logistics.vehicle.returned` |
| 9 | **returns** | Return | `return.requested` · `return.received` · `return.refunded` · `return.restocked` |
| 10 | **crm** | Customer | `customer.created` · `customer.tier.changed` · `customer.complaint.raised` · `customer.merged` |
| 11 | **marketing** | Campaign | `campaign.launched` · `promotion.applied` · `promotion.expired` · `loyalty.points.earned` |
| 12 | **manufacturing** | ManufacturingJob | `manufacturing.job.created` · `manufacturing.job.completed` · `manufacturing.shortage.detected` · `manufacturing.quality.failed` |
| 13 | **pos** | POSSession | `pos.session.opened` · `pos.sale.completed` · `pos.payment.accepted` · `pos.session.closed` |
| 14 | **finance** | Invoice | `invoice.created` · `invoice.approved` · `payment.received` · `payment.failed` · `refund.issued` |
| 15 | **ai** | AIRecommendation | `ai.recommendation.generated` · `ai.prediction.made` · `ai.anomaly.detected` · `ai.model.retrained` |
| 16 | **security** | SecurityEvent | `security.login.success` · `security.login.failed` · `security.permission.denied` · `security.token.revoked` |
| 17 | **system** | SystemEvent | `system.config.updated` · `system.feature.toggled` · `system.module.enabled` · `system.module.disabled` |

### 4.2 Event Type Naming Convention

```
<category>.<entity>.<action>

Examples:
  order.confirmed                    (order entity, confirmed action)
  inventory.stock.adjusted           (inventory.stock entity, adjusted action)
  preparation.shortage.detected      (preparation.shortage entity, detected action)
  loading.session.opened             (loading.session entity, opened action)
  ai.recommendation.generated        (ai.recommendation entity, generated action)
```

Rules:
- All lowercase, dot-separated
- Category is always first
- Action is past tense (confirmed, not confirm)
- No generic verbs like `updated` or `changed` — be specific about what changed

---

## 5. Event Lifecycle

```
RAISED
  (business action occurs; module calls EventPublisher.raise())
        ↓
PUBLISHED
  (platform accepts the event; assigns published_at; makes available to subscribers)
        ↓
CONSUMED
  (one or more subscribers receive and process the event)
  [Each subscriber tracks its own consumption state independently]
        ↓
ARCHIVED
  (event moved to cold storage after retention period expires)
        ↓
REPLAYABLE
  (archived events can be replayed for: audit queries, debug, onboarding new subscribers)
```

### Subscriber State Machine (per subscriber)

```
Pending    → Processing → Consumed (success)
                       → Failed → Retrying → Consumed / Dead Letter
```

Each subscriber manages its own state. Failure in one subscriber does not affect others.

---

## 6. Publisher Contract

```php
interface EventPublisherContract
{
    /**
     * Raise and publish a business event.
     * Returns the stored BusinessEvent.
     */
    public function publish(BusinessEvent $event): BusinessEvent;

    /**
     * Publish multiple events atomically.
     * All-or-nothing: if one fails, none are published.
     */
    public function publishBatch(array $events): array;
}
```

### Publisher Rules

1. Every module that performs a state-changing action must publish a corresponding event
2. Publishing must happen within the same database transaction as the state change
3. If publishing fails, the state change must roll back
4. Publishers do not know who will subscribe — no circular dependencies

---

## 7. Subscriber Contract

```php
interface EventSubscriberContract
{
    /**
     * Return the event types this subscriber handles.
     * @return string[]  e.g. ['order.confirmed', 'order.cancelled']
     */
    public function subscribesTo(): array;

    /**
     * Handle a received event.
     * Must be idempotent — can be called more than once for the same event_id.
     */
    public function handle(BusinessEvent $event): void;
}
```

### Subscriber Rules

1. Every subscriber must be **idempotent** — handling the same event twice must produce the same result
2. Subscribers must not directly call the publishing module's internals
3. Subscribers may publish their own events (chaining) — always set `causation_id`
4. Subscriber failures must not block other subscribers

---

## 8. Event Governance

### 8.1 Versioning

Every event type carries a `event_version` integer. When the payload schema changes:
- **Minor change** (additive only): increment version; old subscribers continue to work
- **Breaking change**: a new event type must be created (e.g. `order.confirmed.v2` → eventually `order.v2.confirmed`)

Old versions are never deleted until all subscribers have migrated.

### 8.2 Schema Evolution Rules

| Change Type | Allowed Without Version Bump | Requires New Version |
|---|---|---|
| Add optional field to payload | ✓ | |
| Add required field to payload | | ✓ |
| Rename a field | | ✓ |
| Remove a field | | ✓ |
| Change field data type | | ✓ |
| Rename event type | | ✓ (keep old type active during migration) |

### 8.3 Backward Compatibility

Subscribers must tolerate receiving events with unknown fields (ignore them gracefully). This is the **Tolerant Reader** pattern and is mandatory for all EPS-01 consumers.

### 8.4 Idempotency

Every subscriber must handle duplicate event delivery. Use the `event_id` as the idempotency key:

```
IF event already processed (event_id exists in subscriber's processed log):
    RETURN without re-processing
ELSE:
    Process event; record event_id as processed
```

### 8.5 Ordering Rules

| Scenario | Ordering Guarantee |
|---|---|
| Events from the same aggregate | Delivered in `occurred_at` order |
| Events from different aggregates | No ordering guarantee |
| Events across categories | No ordering guarantee |
| Replayed events | Delivered in original `occurred_at` order |

### 8.6 Correlation

A business workflow that spans multiple modules uses a shared `correlation_id`. Set it when the workflow starts; propagate it through every event in the chain.

```
Order #ORD-001 confirmed               correlation_id: COR-abc123
  → reservation.created                correlation_id: COR-abc123
  → preparation.wave.created           correlation_id: COR-abc123
  → loading.session.opened             correlation_id: COR-abc123
  → logistics.delivery.confirmed       correlation_id: COR-abc123
```

All events with the same `correlation_id` belong to one business transaction. This enables end-to-end tracing.

### 8.7 Event Retention

| Category | Hot Storage | Archive After | Delete After |
|---|---|---|---|
| orders | 90 days | 90 days → archive | 7 years (legal) |
| finance | 90 days | 90 days → archive | 7 years (legal) |
| inventory | 60 days | 60 days → archive | 3 years |
| security | 90 days | 90 days → archive | 5 years |
| ai | 30 days | 30 days → archive | 2 years |
| system | 30 days | 30 days → archive | 1 year |
| all others | 60 days | 60 days → archive | 3 years |

Retention policy is configurable per category via Configuration Platform (`events.retention.*`).

### 8.8 Replay

Events may be replayed:
- For debugging: replay a specific `correlation_id` chain
- For new subscribers: replay historical events from a specific date
- For recovery: replay after a subscriber outage

Replay target: a named subscriber or a date range. Replay is always ordered by `occurred_at`.

---

## 9. Dead Letter Handling

When a subscriber fails after exhausting retries, the event moves to a **Dead Letter Queue** for that subscriber:

```
DeadLetterEntry
├── event_id           → BusinessEvent
├── subscriber_id      string
├── failure_reason     text
├── attempt_count      int
├── last_attempt_at    timestamp
└── resolved_at        timestamp (nullable)
```

Operations team is notified when dead letter count exceeds a threshold (configurable). Dead letters can be replayed after the root cause is fixed.

---

## 10. AI Integration

```
AI Platform
    └── subscribes to relevant event categories
    └── analyzes event streams for predictions, anomalies, recommendations
    └── publishes its own events in the ai.* category
    └── NEVER queries operational modules directly
```

Examples:
- AI subscribes to `logistics.delivery.failed` → trains delivery failure prediction model
- AI subscribes to `preparation.shortage.detected` → updates shortage risk scores
- AI publishes `ai.recommendation.generated` → Timeline Platform picks it up → appears in business object timeline

### AI Governance for Events

- AI may not write to any operational aggregate directly as a result of consuming an event
- AI publishes recommendations; human-in-the-loop (or explicit `auto_apply` policy) applies them
- Every `ai.*` event must reference `policy_id` and `config_version_id` from the AI Policy

---

## 11. Configuration Platform Dependency

### Policy Consumed: `EventPolicy` (future)

Configuration settings governing this platform:

| Setting Key | Description |
|---|---|
| `events.retention.orders_days` | Retention period for order events (default: 60) |
| `events.retention.finance_days` | Retention period for finance events (default: 2555, i.e. 7 years) |
| `events.replay.max_days_back` | How far back replay is permitted |
| `events.dead_letter.alert_threshold` | Dead letter count that triggers an alert |
| `events.ai.subscribe_to_categories` | Which event categories AI platform subscribes to |

### Feature Flag

```
modules.event_platform   — must be enabled; the entire cross-module architecture depends on it
```

### Audit

Every BusinessEvent is itself an audit record. The platform does not produce separate audit entries for event publication — the event IS the audit.

---

## 12. DDD Module Structure

```
Modules/
└── Core/
    └── EnterpriseServices/
        └── EventPlatform/
            ├── Domain/
            │   ├── Models/
            │   │   ├── BusinessEvent.php
            │   │   ├── EventSubscription.php
            │   │   └── DeadLetterEntry.php
            │   ├── Enums/
            │   │   ├── EventCategory.php
            │   │   └── SubscriberStatus.php
            │   └── Contracts/
            │       ├── EventPublisherContract.php
            │       └── EventSubscriberContract.php
            ├── Application/
            │   ├── Services/
            │   │   ├── PublishEventService.php
            │   │   ├── ReplayEventsService.php
            │   │   └── ProcessDeadLettersService.php
            │   └── Queries/
            │       ├── GetEventsByCorrelationQuery.php
            │       └── GetEventsByAggregateQuery.php
            └── Infrastructure/
                └── Adapters/
                    ├── SynchronousEventPublisher.php   (for testing / simple deployments)
                    └── QueuedEventPublisher.php        (for production)
```
