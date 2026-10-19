# ADR-003 — External Sales Channel Integration Philosophy

**Date:** 2026-06-26
**Status:** Accepted
**Author:** ECOS Architecture Team

---

## Context

ECOS ERP targets businesses that operate across multiple sales channels — both online and offline.
Orders, customers, and product data may originate from a variety of sources including eCommerce
platforms, point-of-sale systems, mobile applications, marketplace integrations, direct API
consumers, and manual ERP entry. The system must synchronise product data, pricing, inventory
levels, customer records, and order status between the ERP and each connected channel.

WooCommerce is the first and currently supported channel. The integration architecture is
designed to be **channel-independent**: adding a new channel type in the future must not require
changes to the ERP's core domain logic.

The fundamental design question is: **which system owns the data?**

Two competing approaches exist:

1. **Bidirectional sync with conflict resolution:** Both systems can originate changes; the
   integration layer resolves conflicts using rules (e.g., "latest write wins" or field-level
   ownership).
2. **ERP as master, channels as consumers:** The ERP is the single source of truth. Each
   sales channel receives data from the ERP and sends orders back.

Approach 1 is operationally fragile at scale. When both systems can modify the same record, race
conditions, double-updates, and silent data corruption become routine problems. Debugging
synchronisation failures requires tracing changes across two systems simultaneously.

Approach 2 is operationally clean. Data originates in one place and flows in one direction for
each data type.

---

## Decision

### 1. ERP Is the Master of Record

The ERP is the **authoritative owner** of all business data:

| Data Type | Owner | Direction |
|---|---|---|
| Products (name, SKU, description) | ERP | ERP → Channel |
| Prices | ERP | ERP → Channel |
| Inventory levels | ERP | ERP → Channel |
| Customers | ERP (after first sync) | ERP → Channel |
| Orders | Sales Channel (origination) | Channel → ERP |
| Order status | ERP (after import) | ERP → Channel |

Orders may originate from any connected sales channel — an eCommerce platform, a POS terminal,
a mobile app, a marketplace, or direct API entry. Once an order enters the ERP regardless of
its origin, the ERP assumes full ownership of its lifecycle. Status changes flow from ERP back
to the originating channel, not the reverse.

### 2. Sales Channels Are External Consumers

Every sales channel — regardless of its type or platform — is treated as an **external consumer**,
not a co-equal system. The ERP integration layer translates between ERP domain concepts and
each channel's API or protocol without coupling the ERP's internal model to any specific
channel's data structure.

A `Channel` record in the ERP represents one connected external sales point (e.g., one
WooCommerce store, one POS location, one marketplace account). A channel carries:
- Its platform identifier and authentication credentials
- A default warehouse for order fulfilment routing
- Synchronisation feature flags (which data types to sync)
- Health and connectivity status
- Channel-specific integration metadata

Multiple channels are supported. Each channel is independent. A change to a product in the ERP
propagates to all channels with the relevant sync feature enabled.

**Current implementation:** The only supported channel platform is WooCommerce. The sections
below document the WooCommerce-specific implementation. Future channel platforms (POS, Shopify,
marketplace, mobile app) will implement the same architectural pattern through a common
channel adapter interface.

### 3. Outbound Synchronisation via Observer → Queue Pattern

Changes originating in the ERP are synchronised to WooCommerce asynchronously through
**model observers** that dispatch **queued jobs**.

```
ERP change (e.g., product price updated)
    │
    ▼
Model Observer (ProductObserver)
    │  fires after database commit (afterCommit: true where required)
    ▼
Queue Job (PriceSyncJob) dispatched to Redis
    │
    ▼
Job executes WooCommerce REST API call
    │
    ▼
SyncLog entry written (success or failure)
```

Current observer → job mappings:

| Observer | Trigger | Job |
|---|---|---|
| `ProductObserver` | Product name / SKU / description changed | `ProductSyncJob` |
| `ProductObserver` | Product price changed | `PriceSyncJob` |
| `StockMovementObserver` | Stock movement created | `InventorySyncJob` |
| `CustomerObserver` | Customer created or updated | `CustomerSyncJob` |
| `OrderObserver` | Order status changed | `OrderStatusSyncJob` |

All jobs are configured with:
- 3 retry attempts before marking as failed
- Exponential backoff between retries
- `afterCommit: true` on stock jobs to prevent sync before the database transaction commits

### 4. Inbound Synchronisation via Webhooks

Orders, product changes, and customer changes originating in WooCommerce are received
via **registered webhooks** (HTTP POST to the ERP's public webhook endpoints).

```
WooCommerce event (e.g., new order placed)
    │
    ▼
POST /api/webhooks/woocommerce/{channelUuid}/{event}
    │
    ▼
WooCommerceWebhookController (validates channel UUID)
    │
    ▼
Queue Job dispatched (ProcessOrderWebhookJob, etc.)
    │
    ▼
Job processes the payload, creates/updates ERP records
    │
    ▼
SyncLog entry written
```

Webhook endpoints are **public** (no ERP authentication token required) because external
channels cannot authenticate as ERP users. Channel identity is established via the UUID in the URL.

Webhook registration is performed via the `commerce:register-webhooks` artisan command,
which calls the WooCommerce REST API to register the ERP's endpoint URLs.

### 5. Conflict Resolution Philosophy

Because the ERP is the master of record, conflicts are resolved by a single governing rule:

**ERP data always wins for outbound synchronisation.**

For inbound data from any channel:

- **Orders:** The originating channel is the source. The ERP imports the order and takes
  ownership immediately. Subsequent status changes flow from ERP back to the channel, not
  the reverse. Inbound status events from the channel are processed but the ERP's own
  lifecycle status takes precedence after the order is in the ERP.
- **Products:** Inbound product events from a channel update only fields that the channel
  manages independently (e.g., external mapping identifiers). ERP-owned product fields
  (price, stock level, description) are never overwritten by inbound channel events.
- **Customers:** Customer data from a channel is imported on first encounter. Subsequent
  inbound updates apply only to fields that the channel originated (e.g., shipping address
  from a new order). ERP-managed customer fields are not overwritten.

### 6. Idempotent Inbound Event Processing

External channels may deliver the same event more than once (retry on failed delivery or
network timeout). All inbound event processing jobs must be designed to be **idempotent**:
processing the same event payload twice must produce exactly the same result as processing
it once.

- Orders are identified by their channel-specific external ID. Receiving the same order
  event twice updates the existing ERP record rather than creating a duplicate.
- Customers are identified by email address. Receiving the same customer event twice
  updates the existing record.
- Product mappings are identified by the channel's external product identifier.

This property must be preserved for all future channel integrations.

### 7. Synchronisation Audit Log

Every synchronisation attempt — success or failure — is recorded in the `sync_logs` table:

```
sync_logs
├── channel_id
├── entity_type     (product, price, stock, customer, order_status)
├── entity_id       (ERP entity ID)
├── direction       (outbound / inbound)
├── status          (success / failed)
├── payload         (JSON — what was sent or received)
├── response        (JSON — what WooCommerce responded)
├── error_message   (null on success)
└── created_at
```

Failed sync logs can be retried individually via the `SyncLogsController` retry endpoint,
which re-dispatches the original job.

---

## Consequences

### Positive

- **Predictable data flow:** Every data type has a clear owner and direction. Debugging a
  synchronisation problem means checking one direction, not resolving a conflict between two
  authoritative sources.
- **Multi-channel scalability:** Adding a new sales channel of a supported platform type requires
  creating a new `Channel` record and configuring its integration. Adding a new platform type
  requires implementing the channel adapter — no changes to the ERP core domain.
- **Fault tolerance:** Asynchronous queue processing means a temporary WooCommerce API outage
  does not block ERP operations. Jobs accumulate in the queue and are retried when the API
  recovers.
- **Audit trail:** Every sync attempt is logged. Operations can identify which products failed
  to sync, when, and why.

### Negative / Trade-offs

- **Eventual consistency:** Because sync is asynchronous, WooCommerce may temporarily show
  stale data (e.g., an old price for up to a few seconds after a price change in the ERP).
  This is acceptable for the target use case.
- **Queue pressure at scale:** Each product update triggers one job per channel. With 10 channels
  and 1,000 products updated in a batch import, 10,000 jobs are enqueued. Batch sync strategies
  may be needed at high volume.
- **Observer coupling:** The sync observers are registered at application boot. They fire on
  every model event, even in non-sync contexts (e.g., test factories, data migrations). Care
  must be taken to disable observers when running bulk operations that should not trigger sync.
- **Webhook security gap:** Currently, webhook authentication relies on the channel UUID in the
  URL. WooCommerce's HMAC signature (`X-WC-Webhook-Signature` header) is not yet verified.
  This is a known gap to be addressed before production use.

---

## Future Considerations

- **HMAC webhook signature verification:** The `X-WC-Webhook-Signature` header sent by
  WooCommerce must be verified against the channel's consumer secret to prevent spoofed
  webhooks. This is the highest-priority security improvement for the Commerce module.
- **Batch synchronisation:** For bulk operations (e.g., mass price update), a batch sync
  job that groups multiple product updates into a single WooCommerce batch API call will
  reduce queue volume and API call count.
- **Multi-platform channel adapter:** Future channel platforms (POS, Shopify, marketplace,
  mobile app, direct API) must implement a common `ChannelAdapterInterface` that abstracts
  the platform-specific transport, authentication, and payload translation. The ERP sync
  infrastructure must remain unaware of individual platform details.
- **Webhook delivery monitoring:** WooCommerce may stop delivering webhooks if the ERP
  endpoint returns repeated errors. A health check that verifies webhook delivery is
  functioning should be added to the channel health monitoring.
- **Dead letter queue:** Failed jobs that exhaust retries currently remain as failed queue
  records. A formal dead letter queue strategy with alerting should be implemented for
  production environments.

---

## Related ADRs

- **[ADR-012 — Unified Enterprise Pricing Policy](adr/ADR-012-unified-enterprise-pricing-policy.md):**
  Extends this ADR's master-of-record principle to selling prices specifically. Defines the
  one-price rule, the mandatory pricing review workflow, and the rule that channel-originated
  prices must never overwrite `products.regular_price`. Price sync to channels after manager
  approval uses the observer → queued job transport defined in Section 3 of this ADR.
