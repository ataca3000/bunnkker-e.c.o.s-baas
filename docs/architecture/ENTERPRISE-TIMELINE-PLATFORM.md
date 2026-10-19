# Enterprise Timeline Platform — Specification

**Document:** ENTERPRISE-TIMELINE-PLATFORM  
**Service:** EPS-02  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-EPS-ARCH-001  
**Parent:** ENTERPRISE-PLATFORM-SERVICES.md

---

## 1. Mission

> Provide a **unified, chronological, cross-module history** for every business object in ECOS.

Every Order, Customer, Product, Vehicle, Shipment — any business entity — has a complete timeline of everything that happened to it, from creation to the present. This timeline is generated automatically from Business Events wherever possible, supplemented by user actions, comments, approvals, and AI recommendations.

No module builds its own activity log. No module owns "what happened" for a shared entity.

---

## 2. Core Principles

1. **One timeline per business object** — the platform, not the module, owns the history
2. **Immutable** — timeline entries are never modified or deleted after creation
3. **Cross-module** — entries from all modules appear on the same object timeline
4. **Event-driven first** — most entries are generated automatically from BusinessEvents (EPS-01)
5. **Human-supplementable** — comments, notes, and approvals can be added by users
6. **Auditable** — every entry records who added it and when

---

## 3. Supported Business Objects

The Timeline Platform supports any entity that can be uniquely identified. The current set:

| Object Type | Aggregate Type | Example |
|---|---|---|
| `order` | Order | Order #ORD-00234 full lifecycle |
| `customer` | Customer | Customer #CUST-001 full history |
| `product` | Product | Product price changes, recipe updates, availability changes |
| `raw_material` | RawMaterial | Cost changes, supplier changes, stock level history |
| `supplier` | Supplier | Performance, invoices, compliance events |
| `vehicle` | Vehicle | Daily operational logs, maintenance, reconciliations |
| `shipment` | Shipment | Route, delivery attempts, exceptions |
| `manufacturing_job` | ManufacturingJob | Job creation, execution, quality checks, completion |
| `preparation_wave` | PreparationWave | Wave lifecycle, shortage events, completion |
| `inventory_item` | InventoryItem | All movements: in, out, adjustments, reservations |
| `purchase_order` | PurchaseOrder | Approval, dispatch, receipt, invoice events |
| `company` | Company | Configuration changes, feature flag changes, policy updates |
| `employee` | User | Role changes, permission grants, session events |

The system supports any future entity — adding a new object type requires only registering it in the Timeline configuration. No code change to the Timeline Platform itself.

---

## 4. TimelineEntry Entity

```
TimelineEntry
├── id                    uuid
├── object_type           string      — registered aggregate type (e.g. "order")
├── object_id             uuid        — ID of the specific business object
│
├── entry_type            enum (see Section 5)
│
├── title                 string      — short human-readable summary (e.g. "Order confirmed")
├── description           text (nullable) — longer detail, markdown supported
│
├── actor_type            enum: user | system | ai | external
├── actor_id              → User (nullable — null for system/ai)
├── actor_display_name    string      — denormalized for display even if user is deleted
│
├── source_event_id       → BusinessEvent (nullable) — the event that produced this entry
├── source_module         string      — which module produced this entry
│
├── document_ids          uuid[]      — linked documents (EPS-03)
├── related_objects[]     — linked business objects (e.g. order timeline entry links to wave)
│   ├── related_object_type  string
│   └── related_object_id    uuid
│
├── metadata              JSONB (nullable) — entry-type-specific data
│
├── occurred_at           timestamp   — when this happened (business time)
└── recorded_at           timestamp   — when this was written to the timeline
```

---

## 5. TimelineEntry Types

| Type | Code | Source | Description |
|---|---|---|---|
| Business Event | `event` | EPS-01 | Auto-generated from a published BusinessEvent |
| Status Change | `status_change` | Modules | Object status changed (e.g. wave: Preparing → Prepared) |
| Comment | `comment` | User | User left a text comment |
| Note | `note` | User | Internal note (may have restricted visibility) |
| Attachment | `attachment` | User / System | Document attached (creates link to EPS-03) |
| Approval | `approval` | User | Approval granted or rejected (with reason) |
| Assignment | `assignment` | User / System | Object assigned to a user or team |
| AI Recommendation | `ai_recommendation` | AI Platform | AI generated a recommendation for this object |
| Manual Override | `manual_override` | User | User overrode a system decision (with reason) |
| System Event | `system_event` | System | Configuration change, feature flag toggle, etc. |

---

## 6. Event → Timeline Mapping

The Timeline Platform subscribes to the Enterprise Event Platform and automatically creates timeline entries from events. Each event type maps to a timeline entry.

### Mapping Examples

| BusinessEvent Type | Object Type | Timeline Title Template |
|---|---|---|
| `order.confirmed` | order | "Order confirmed" |
| `order.cancelled` | order | "Order cancelled — Reason: {payload.reason}" |
| `reservation.created` | order | "Inventory reserved for {payload.product_count} products" |
| `preparation.wave.created` | order | "Added to Preparation Wave #{payload.wave_number}" |
| `loading.session.completed` | order | "Loaded onto vehicle #{payload.vehicle_registration}" |
| `logistics.delivery.confirmed` | order | "Delivered — Proof: {payload.pod_type}" |
| `inventory.stock.adjusted` | inventory_item | "Stock adjusted: {payload.before_qty} → {payload.after_qty} ({payload.reason})" |
| `manufacturing.job.completed` | manufacturing_job | "Manufacturing completed — {payload.quantity_produced} units produced" |
| `ai.recommendation.generated` | * | "AI recommendation: {payload.summary}" |

### Mapping Configuration

Event → Timeline mappings are configured in the Timeline Platform registry, not hardcoded. Each mapping specifies:
- Which `event_type` to subscribe to
- Which `object_type` and `object_id` field in the payload to use
- Title template (with `{payload.field}` interpolation)
- Entry type
- Which payload fields to include in metadata

---

## 7. Timeline Query API

The Timeline Platform provides a standard query interface:

```php
interface TimelineQueryContract
{
    /**
     * Get timeline for a single business object.
     * Returns entries ordered by occurred_at DESC.
     */
    public function forObject(
        string $objectType,
        string $objectId,
        TimelineFilter $filter = null
    ): TimelinePage;

    /**
     * Search timeline entries across all objects.
     */
    public function search(TimelineSearchQuery $query): TimelinePage;
}
```

### TimelineFilter Options

```
TimelineFilter
├── entry_types[]          — filter by TimelineEntry type
├── actor_ids[]            — filter by user
├── source_modules[]       — filter by source module
├── date_from              — entries on or after
├── date_to                — entries on or before
├── include_ai             — include/exclude AI recommendations
└── include_system         — include/exclude system events
```

---

## 8. Timeline Features

### Chronological
All entries are ordered by `occurred_at`. If two entries share the same `occurred_at` timestamp, `recorded_at` is the secondary sort.

### Filterable
Any combination of `TimelineFilter` fields can be applied. Filters are additive (AND logic).

### Searchable
Full-text search across `title` and `description` fields. Powered by the platform's search engine (Meilisearch).

### Cross-module
Entries from Preparation OS, Loading OS, Logistics, Commerce, AI, and any other module appear in a single unified timeline. The viewer does not need to navigate between modules.

### Linked Documents
Any timeline entry can reference documents from EPS-03. Attachments appear inline in the timeline.

### Linked Objects
Timeline entries may link to related objects (e.g. an order's timeline entry for "Added to Wave" links to the PreparationWave object). Clicking navigates to the related object's timeline.

### Immutable History
Timeline entries are append-only. They are never edited or deleted. If a decision is reversed, a new entry records the reversal — the original entry remains.

### AI Recommendations in Timeline
When AI generates a recommendation for a business object (e.g. "Allocate this order to Vehicle 3 for better route efficiency"), the recommendation appears as a `ai_recommendation` entry in the object's timeline. The user can accept or dismiss it from the timeline view.

---

## 9. Visibility and Permissions

| Entry Type | Default Visibility | Configurable? |
|---|---|---|
| Business events | All authenticated users | No — always visible |
| Status changes | All authenticated users | No — always visible |
| Comments | All authenticated users | Yes — can be restricted to roles |
| Notes | Managers and above by default | Yes |
| Attachments | Depends on document permissions (EPS-03) | Via EPS-03 |
| AI Recommendations | Role-based (configurable) | Yes |
| Manual Overrides | All authenticated users | No — always visible for accountability |

---

## 10. Configuration Platform Dependency

### Configuration Settings

| Setting Key | Description |
|---|---|
| `timeline.retention_days` | How long timeline entries are kept in hot storage |
| `timeline.include_system_events` | Show system events in object timelines |
| `timeline.include_ai_recommendations` | Show AI recommendations in timeline by default |
| `timeline.search.enabled` | Enable full-text timeline search |
| `timeline.event_mapping.enabled` | Auto-generate entries from EPS-01 events |

### Feature Flag

```
modules.timeline   — must be enabled for timeline platform to run
```

### Audit

Timeline entries themselves are an audit trail. The platform does not produce separate audit entries for timeline writes — the `recorded_at` field and immutability guarantee are sufficient.

---

## 11. DDD Module Structure

```
Modules/
└── Core/
    └── EnterpriseServices/
        └── TimelinePlatform/
            ├── Domain/
            │   ├── Models/
            │   │   └── TimelineEntry.php
            │   ├── Enums/
            │   │   └── TimelineEntryType.php
            │   ├── ValueObjects/
            │   │   ├── TimelineFilter.php
            │   │   └── RelatedObject.php
            │   └── Contracts/
            │       └── TimelineQueryContract.php
            ├── Application/
            │   ├── Services/
            │   │   ├── RecordTimelineEntryService.php
            │   │   └── EventToTimelineListenerService.php
            │   └── Queries/
            │       ├── GetObjectTimelineQuery.php
            │       └── SearchTimelineQuery.php
            └── Infrastructure/
                └── Repositories/
                    └── EloquentTimelineRepository.php
```
