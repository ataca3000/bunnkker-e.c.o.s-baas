# ADR-020: Immutable Financial Snapshot Architecture

**Status:** Accepted  
**Date:** 2026-07-06  
**Authors:** Platform Engineering  
**Scope:** Commerce / Orders module  
**Related:** ADR-011 (Event-Driven), ADR-016 (Cost Intelligence Platform)

---

## Context

When an order is created and later modified, the live `products`, `recipes`, and `pricing_rules` tables evolve. Prices change, recipes are revised, costs are recalculated. Without a snapshot, historical financial reporting would either:

1. Re-query live tables and return incorrect historical figures, or
2. Require complex audit-log reconstruction that is slow and error-prone.

The accounting OS, BI dashboards, and regulatory audits all need a single, tamper-evident record of **what the financials were at the moment of sale**.

---

## Decision

Every order that transitions to `confirm_order` status triggers the creation of a **write-once financial snapshot** — a complete denormalized copy of all financial data at that exact moment.

Two tables:
- `order_financial_snapshots` — order-level header (totals, parties, margins, shipping, metadata)
- `order_line_snapshots` — per-line detail (cost breakdown, margin diagnostics, recipe/review provenance)

---

## Trigger Lifecycle

| Event | Action |
|---|---|
| Order status → `confirm_order` | `CreateOrderSnapshotService::createIfAbsent()` is called |
| Snapshot already exists | Service returns `null` — idempotent no-op |
| Any later status change | No snapshot action taken |

Only `confirm_order` triggers the snapshot. This is intentional: it is the single moment of financial commitment. Subsequent statuses (`preparing`, `completed`, etc.) do not modify or re-create the snapshot.

---

## Immutability Rules

**Model layer:**

```php
static::updating(static fn () => false);          // silently rejects updates
static::deleting(static function (self $m): never {
    throw new \RuntimeException('Snapshots are immutable.');
});
```

**Database layer:** The `order_financial_snapshots` table has a `UNIQUE` index on `order_id`, preventing duplicate rows.

**Integrity layer:** A SHA-256 hash is computed from a canonical string of the order's financial data **before** any DB write. It is stored atomically in the `create()` call. Any DB-level tampering will cause hash mismatches when verified by the audit system.

Canonical input format:
```
{order_id}|{grand_total}|{subtotal}|{discount_amount}|{shipping_cost}|{line1_sorted,...}
```

Lines are sorted deterministically by `product_id:quantity:unit_price:line_total` so row insertion order does not affect the hash.

---

## Reporting Contract

> **Executive reports, accounting journals, and BI queries MUST read only from `order_financial_snapshots` and `order_line_snapshots` for historical financial data.**

**Never** join `products`, `bills_of_materials`, or `pricing_rules` to reconstruct historical financials. Those tables represent **current** state, which may differ materially from the state at sale time.

This rule is absolute. The snapshot IS the financial truth.

---

## Schema: Header (`order_financial_snapshots`)

| Column | Type | Purpose |
|---|---|---|
| `id` | UUID PK | Primary key |
| `order_id` | UUID UNIQUE FK | One snapshot per order |
| `previous_snapshot_id` | UUID nullable | Reserved for future multi-version support |
| `snapshot_uuid` | UUID | Stable external identifier (stable across potential future copies) |
| `snapshot_version` | tinyint | Always 1 for first snapshot; reserved for future versioning |
| `company_id`, `brand_id`, `channel_id` | UUID | Party identifiers at snapshot time |
| `customer_id`, `customer_name` | | Customer at snapshot time |
| `currency` | string | Defaults to 'EGP' |
| `payment_method` | string | Payment method at snapshot time |
| `subtotal`, `discount_amount`, `shipping_cost`, `grand_total` | decimal(12,4) | Order totals |
| `deposit_amount`, `remaining_balance` | decimal(12,4) | Payment split |
| `total_cogs` | decimal(12,4) | Sum of all line costs |
| `gross_profit` | decimal(12,4) | `grand_total − total_cogs` |
| `total_raw_material_cost` | decimal(12,4) | Summed from lines |
| `total_packaging_cost` | decimal(12,4) | Summed from lines |
| `total_manufacturing_cost` | decimal(12,4) | Summed from lines |
| `total_other_cost` | decimal(12,4) | Summed from lines |
| `target_margin_percent` | decimal(8,4) | Weighted average target margin across lines |
| `actual_margin_percent` | decimal(8,4) | `(gross_profit / grand_total) × 100` |
| `margin_difference` | decimal(8,4) | `actual − target` |
| `margin_status` | string | `within_target` / `below_target` / `above_target` (±2pp tolerance) |
| `shipping_rule_id` | UUID nullable | Matched shipping rule at snapshot time |
| `shipping_rule_name` | string | Human-readable rule label |
| `shipping_zone` | string | `{governorate} › {area}` |
| `shipping_override_applied` | bool | Whether shipping cost was manually overridden |
| `shipping_override_by` | UUID | Actor who applied the override |
| `pricing_engine_version`, `cost_engine_version` | string | Engine version tags |
| `recipe_version` | string | Recipe version(s) used across lines |
| `brand_pricing_policy_version` | string | Brand pricing policy version |
| `shipping_pricing_version` | string | Shipping pricing rule version |
| `integrity_hash` | char(64) | SHA-256 over canonical financial data |
| `locked` | bool | Always true — snapshot is always locked |
| `locked_at` | timestamp | When the lock was applied (= created_at) |
| `created_by` | UUID | Actor who triggered confirmation |

---

## Schema: Lines (`order_line_snapshots`)

| Column | Type | Purpose |
|---|---|---|
| `id` | UUID PK | |
| `order_financial_snapshot_id` | UUID FK | Parent snapshot |
| `order_line_id` | UUID nullable | Source order line (nullable for safety) |
| `product_id`, `product_sku`, `product_name` | | Product identity at snapshot time |
| `quantity`, `unit_price_at_sale`, `line_total` | | Sale quantities and prices |
| `regular_price_at_sale`, `sale_price_at_sale` | | Full pricing context |
| `raw_material_cost`, `packaging_cost`, `manufacturing_cost`, `other_cost` | decimal(12,4) | Cost breakdown per unit |
| `recipe_cost`, `unit_cost`, `line_cost` | decimal(12,4) | Aggregated cost figures |
| `gross_profit` | decimal(12,4) | `line_total − line_cost` |
| `margin_percent` | decimal(8,4) | `(gross_profit / line_total) × 100` |
| `target_margin_percent` | decimal(8,4) | Product's effective target margin at snapshot time |
| `margin_status` | string | `within_target` / `below_target` / `above_target` |
| `bom_id` | UUID | Active BOM used for cost calculation |
| `bom_version_number` | int | BOM version number |
| `source_recipe_version` | string | BOM.version string |
| `price_review_id` | UUID nullable | Most recent approved price review for this product |
| `price_review_approved_at` | timestamp | When that review was approved |
| `price_review_approved_by` | UUID | Reviewer ID |
| `cost_snapshot` | JSON | Full `RecipeCostSummaryDTO::toArray()` for deep audit |

---

## Events Fired (PART 12)

Both events carry a rich denormalized payload designed for direct consumption by downstream systems without re-querying the database:

| Event | When | Key Payload |
|---|---|---|
| `OrderFinancialSnapshotCreated` | After DB transaction commits | snapshot_uuid, grand_total, gross_profit, actual_margin_percent, margin_status, integrity_hash |
| `OrderFinancialSnapshotLocked` | Immediately after Created | same fields + locked_at |

**Accounting OS integration:** The Accounting OS should listen to `OrderFinancialSnapshotLocked` and use the payload to begin journal entry creation. It must NOT re-fetch the order's live data — the event payload IS the source of truth.

---

## Margin Status Rules

```
within_target : |actual_margin − target_margin| ≤ 2.0 pp
below_target  : actual_margin < target_margin − 2.0 pp
above_target  : actual_margin > target_margin + 2.0 pp
```

The ±2pp tolerance prevents noise from rounding.

**Weighted target margin** at the order level: `Σ(line.target_margin × line.line_total) / Σ(line.line_total)`

---

## Alternatives Considered

**Soft-deletion with `deleted_at`:** Rejected. Soft deletes are recoverable and visible to ORM queries. Immutability requires hard enforcement at the model layer, not just a nullable column.

**Audit log reconstruction:** Rejected. Reconstructing financials from event logs is complex, slow, and brittle when schemas change. A denormalized snapshot is simpler and faster to query.

**Snapshot on every status change:** Rejected. Financial commitment happens exactly once — at `confirm_order`. Creating multiple snapshots would require versioning logic and introduce ambiguity about which snapshot is authoritative for accounting.

**Versioning for corrections:** Deferred. The `previous_snapshot_id` column and `snapshot_version` field are reserved for a future correction workflow where a supervisor can void an order and reconfirm it with corrected data. Version 1 is always the original confirmation snapshot.

---

## Consequences

**Positive:**
- Historical financial reports are always correct regardless of product/price/recipe changes
- Single authoritative source for accounting journal generation
- Tamper-evident via SHA-256 integrity hash
- Zero joins required for historical financials — snapshot tables are self-contained
- BI-ready: snapshot tables can be replicated to a data warehouse without any transformation

**Negative:**
- Storage cost: ~2–5 KB per order for the snapshot rows
- No in-place corrections — errors require a full void + re-confirm workflow (by design)
- `total_cogs`, `actual_margin_percent` are null if no BOM exists for a product — partial data accepted

---

## Event Ordering Contract (PART 7)

Events are dispatched **synchronously** after the DB transaction commits, in this fixed order:

```
1. DB::transaction commits → snapshot row + all line rows written atomically
2. OrderFinancialSnapshotCreated fired
3. OrderFinancialSnapshotLocked fired
4. OrderEvent::log (timeline entry)
```

Synchronous dispatch guarantees that listeners receive events in the above sequence. The accounting OS **must** listen to `OrderFinancialSnapshotLocked` (not `Created`), since Locked is the final signal that both the snapshot and its lines are fully persisted and ready to consume.

---

## Queue Safety Contract (PART 8)

**Service idempotency:** `createIfAbsent()` checks `where('order_id', ...).exists()` before any DB writes. Retrying the job that calls this service is always safe — the second invocation returns `null` without side effects.

**Listener idempotency:** Every event payload includes `snapshot_uuid` (a stable UUID). Accounting listeners that create journal entries must use `snapshot_uuid` as an idempotency key:

```php
JournalEntry::firstOrCreate(
    ['source_uuid' => $event->snapshotUuid],
    [...journal fields...]
);
```

This ensures that a retried queued listener does not produce duplicate accounting records.

**Ordering on queues:** If listeners are queued, there is no guaranteed ordering between `OrderFinancialSnapshotCreated` and `OrderFinancialSnapshotLocked` jobs. The accounting OS should listen only to `OrderFinancialSnapshotLocked`, which eliminates the ordering concern entirely.

---

## Integrity Verification (PART 5)

The `CreateOrderSnapshotService::verifyIntegrityHash(OrderFinancialSnapshot $snapshot)` method is public and recomputes the SHA-256 from the stored snapshot data (header fields + line rows). It is called automatically by `OrderController::financialSnapshot()` and the result is exposed as `hash_verified: bool | null` on every API response.

Any value of `false` means the stored hash does not match the recomputed hash — indicating DB-level tampering or data corruption. The UI renders a red integrity failure banner when `hash_verified === false`.

---

## Consistency Validation (PART 4)

Before any DB write, `CreateOrderSnapshotService` validates that the order's financial totals are internally consistent:

1. `|sum(line.line_total) − order.subtotal| ≤ 0.01`
2. `|max(0, subtotal − discount_amount + shipping_cost) − order.total| ≤ 0.01`

Failure throws `SnapshotConsistencyException`, preventing a snapshot from being created for a structurally corrupt order. This guards the immutable record against locking in bad data.

---

## Business Context Snapshot (TASK-ORDER-006C)

With TASK-ORDER-006C, ECOS ERP moves beyond preserving only historical financial values and begins preserving historical business intent. From this point onward, every confirmed order contains three immutable layers:

| Layer | Table | Answers |
|---|---|---|
| **Business Context** | `order_business_context_snapshots` | *Why* was this commercial decision made? |
| **Financial Snapshot** | `order_financial_snapshots` | *What* was the financial outcome? |
| **Operational Execution** | (future — preparation/loading/delivery) | *How* was the order fulfilled? |

### Business Context Creation Order

```
1. Order status → confirm_order
2. CreateBusinessContextSnapshotService::createIfAbsent() fires
   → DB write: order_business_context_snapshots
   → OrderBusinessContextCaptured event
   → OrderEvent::log('business_context_captured')
3. CreateOrderSnapshotService::createIfAbsent() fires (financial)
   → DB write: order_financial_snapshots + order_line_snapshots
   → OrderFinancialSnapshotCreated event
   → OrderFinancialSnapshotLocked event
   → OrderEvent::log('financial_snapshot_created')
```

### Business Context Schema (`order_business_context_snapshots`)

| Column Group | Columns | Purpose |
|---|---|---|
| **Policy Versions** | `brand_policy_version`, `pricing_policy_version`, `discount_policy_version`, `shipping_policy_version`, `delivery_sla_version`, `sales_channel_config_version`, `loyalty_policy_version`, `promotion_engine_version` | Which policy rules governed this order |
| **Price Provenance** | `price_source`, `pricing_engine_rule`, `price_review_id` | How the unit price was determined |
| **Discount Provenance** | `discount_source`, `campaign_id`, `discount_manual_override` | How the discount was determined |
| **Shipping Provenance** | `shipping_rule_id`, `shipping_zone` | Which shipping rule was matched |
| **Cost Provenance** | `cost_source`, `recipe_version`, `cost_engine_version` | How product cost was calculated |
| **Approval Snapshot** | `approved_by`, `confirmation_user`, `confirmation_time`, `approval_workflow_version` | Who confirmed this order and when |
| **Customer Context** | `customer_tier`, `customer_segment`, `loyalty_level`, `delivery_success_rate` | Customer's commercial standing at order time |
| **Brand Context** | `brand_name`, `brand_version`, `brand_commercial_strategy_version` | Brand identity at order time |
| **Channel Context** | `channel_name`, `channel_type`, `marketplace_version` | Channel identity at order time |
| **Marketing Context** | `marketing_campaign_id`, `campaign_name`, `campaign_version`, `utm_source`, `utm_medium`, `utm_campaign` | Marketing attribution (nullable) |
| **Fulfillment Context** | `preparation_strategy`, `allocation_policy`, `shipping_priority`, `sla_policy_version` | Fulfillment strategy at order time |

### Immutability

Same rules as the financial snapshot:
- `static::updating()` returns `false` — silently rejects all updates
- `static::deleting()` throws `RuntimeException` — hard immutability
- UNIQUE constraint on `order_id` prevents duplicate context rows

### API Contract (PART 10)

`GET /orders/{id}/snapshot` now returns both layers:

```json
{
  "data": {
    "id": "...",
    "grand_total": 250.00,
    "business_context": {
      "id": "...",
      "policy_versions": { "pricing": "1.0.0", "shipping": "1.0.0", ... },
      "decision_provenance": {
        "price": { "source": "regular_price", "price_review_id": null },
        "discount": { "source": "manual", "manual_override": true },
        "shipping": { "zone": "Cairo › Nasr City" },
        "cost": { "source": "bom", "recipe_version": "1.0" }
      },
      "customer_context": { "delivery_success_rate": 83.33 },
      "brand_context": { "name": "ECOS Brand" },
      "channel_context": { "name": "Main Store", "type": "woocommerce" },
      "marketing_context": { ... },
      "fulfillment_context": { "sla_policy_version": "1.0.0" }
    },
    "lines": [...]
  }
}
```

### BI Reporting Contract (PART 11)

BI queries that answer *why* questions must read from `order_business_context_snapshots`:

- "Why did margin drop on channel X last month?" → join on `channel_name` + `decision_provenance.cost.source`
- "Which orders used a manual discount override?" → `discount_manual_override = true`
- "What was the delivery success rate of customers at confirmation time?" → `delivery_success_rate`
- "Which pricing policy version was active when we had the highest margin?" → `pricing_policy_version`

**Never** derive these answers by re-querying live `channels`, `brands`, or `customers` tables.

### AI Event (PART 12)

`OrderBusinessContextCaptured` is fired after each business context snapshot is written. Payload includes `orderId`, `snapshotId`, `brandName`, `channelType`, `priceSource`, `discountSource`, `shippingZone`, `costSource`, `recipeVersion`, `deliverySuccessRate`, `pricingPolicyVersion`, and `capturedAt`. AI agents subscribed to this event can update demand forecasts, customer risk models, and channel performance models without re-querying the database.

---

## Future Work

- **ADR-021 (planned):** Accounting OS journal entry creation from `OrderFinancialSnapshotLocked`
- **Snapshot versioning:** Use `previous_snapshot_id` to chain corrected snapshots when void + reconfirm workflow is implemented
- **Integrity verification endpoint:** Admin API to recompute and verify SHA-256 hash against stored value
- **BI replication:** Pipe `order_financial_snapshots` + `order_business_context_snapshots` to analytics warehouse via CDC (Change Data Capture)
- **Policy version registry:** When a real policy versioning module ships, replace the static `'1.0.0'` strings with live lookups from the policy version registry
