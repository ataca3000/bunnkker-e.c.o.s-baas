# ADR-023: Order Snapshot Policy

**Status:** Accepted  
**Date:** 2026-07-14  
**Authors:** Platform Engineering  
**Scope:** Commerce / Orders module  
**Related:** ADR-020 (Immutable Financial Snapshot), ADR-021 (Enterprise Snapshot Platform), ADR-005 (Order Ownership and Lifecycle)

---

## Context

An ERP order is a **historical business document**. Once created, it represents an immutable record of a transaction that occurred at a specific point in time. Legal, financial, and operational correctness all depend on the order reflecting the state of the world *at the time of the transaction* — not the current state of related entities.

Prior to this ADR, the following customer fields on an Order were sourced dynamically from the `customers` table at display time:

- `customer_name` — the customer's current legal name
- `customer_secondary_phone` (alias `mobile`) — the customer's secondary contact number
- `customer_notes` — customer-level notes

This created a **silent history mutation** problem: if a customer's name, phone, or notes changed after an order was placed, every historical order for that customer would silently display the updated values. Reports, invoices, packing slips, and audit trails would become unreliable.

The only field that was already correctly snapshotted was `billing_phone` (the primary phone at order time), introduced in an earlier migration.

---

## Decision

### Data Source Rule

From 2026-07-14 forward, the authoritative data sources for an order are:

| Data Category | Authoritative Source | Purpose |
|---|---|---|
| Historical order data | `orders` table columns | Legal document, reports, audit |
| Current customer profile | `customers` table | CRM, loyalty, outreach |

**There is no ambiguity and no runtime mixing between the two.**

### Snapshot Columns

The following columns exist on the `orders` table as immutable snapshots:

| Column | Type | Snapshot of | Written by |
|---|---|---|---|
| `customer_name` | `varchar(255)` | `customers.name` at transaction time | CreateManualOrderAction, UpdateOrderAction, WooCommerceOrderImporter |
| `customer_secondary_phone` | `varchar(50)` | `customers.mobile` at transaction time | CreateManualOrderAction, UpdateOrderAction |
| `customer_notes` | `text` | `customers.notes` at transaction time | CreateManualOrderAction, UpdateOrderAction |
| `billing_phone` | `varchar(50)` | `customers.phone` at transaction time | CreateManualOrderAction, UpdateOrderAction (pre-existing) |
| `billing_email` | `varchar(255)` | `customers.email` at transaction time | WooCommerce import (pre-existing) |
| `governorate`, `city`, `area`, `shipping_address`, `building`, `floor`, `apartment`, `landmark` | various | Delivery address at transaction time | CreateManualOrderAction, UpdateOrderAction (pre-existing) |
| `google_maps_lat`, `google_maps_lng`, `google_maps_url` | various | GPS coordinates at transaction time | CreateManualOrderAction, UpdateOrderAction (pre-existing) |

### Snapshot Lifecycle

**On order creation:**  
`CreateManualOrderAction` writes all three new snapshot fields (`customer_name`, `customer_secondary_phone`, `customer_notes`) from the validated request data. When an existing customer is reused via phone lookup and the form did not pre-fill secondary phone or notes, the action falls back to the customer record's current values to ensure the initial snapshot is complete.

**On order edit:**  
`UpdateOrderAction` includes all three snapshot fields in `$enterpriseFields`. They are written directly to the `orders` row. The `customers` table is **never mutated** during order editing. This is a strict enforcement of the data source rule.

**On WooCommerce import:**  
`WooCommerceOrderImporter` writes `customer_name` from `billing.first_name + billing.last_name` at import time.

**On order display:**  
`OrderResource` reads `customer_name`, `customer_secondary_phone`, `customer_notes` from the order row with a fallback to the Customer record for orders predating this ADR (legacy orders with null snapshots):

```php
'name'   => $this->customer_name            ?? $c->name,
'mobile' => $this->customer_secondary_phone ?? $c->mobile,
'notes'  => $this->customer_notes           ?? $c->notes,
'phone'  => $this->billing_phone            ?? $c->phone,
```

### Legacy Order Behaviour

Orders created before 2026-07-14 have `customer_name = NULL`. `OrderResource` falls back to the Customer record for these three fields, preserving backwards compatibility. As legacy orders are edited, the snapshot is written on save. No backfill migration is run — we cannot reconstruct history we never captured.

### Search Behaviour

The order search (`EloquentOrderRepository::paginate`) searches:

1. `orders.order_number` — direct order match
2. `orders.customer_name` — snapshot name for enterprise/manual orders
3. `orders.billing_phone` — snapshot primary phone
4. `customers.name` — CRM fallback for legacy and WooCommerce-imported orders

This ensures historical orders remain findable by the name they were created under, even if the customer has since changed their name.

---

## Consequences

### Positive

- **ERP correctness**: Orders are true historical documents. An invoice printed today for an order placed six months ago shows the customer name from that moment.
- **Audit trail integrity**: Reports, exports, and timelines are all derived from order-level data. Changes to the customer CRM record have no retroactive effect.
- **Simpler read path**: `OrderResource` reads from a single table row for all customer snapshot fields. No JOIN to `customers` is required to render name, phone, or notes.
- **No customer record mutation on edit**: `UpdateOrderAction` no longer touches the `customers` table. Order editing and CRM management are fully decoupled.

### Negative / Trade-offs

- **No auto-backfill for legacy orders**: Historical orders with null snapshots continue to use CRM fallback until edited. This is the correct engineering choice — fabricating historical snapshots would be dishonest.
- **Dual data existence**: The customer name exists in two places (order snapshot + CRM). For new orders this is intentional. For legacy orders, they temporarily converge on save.
- **Search covers both sources**: To ensure all orders are searchable regardless of age, search queries both `orders.customer_name` (snapshot) and `customers.name` (CRM). This means searching by "new name" finds post-rename orders via snapshot AND pre-rename orders via CRM fallback.

---

## Verification

End-to-end verified 2026-07-14 via automated tinker script (21/21 assertions pass):

1. **Historical Snapshot** — Create Customer A, create Order #1 with snapshot, update CRM. Order #1 still shows original snapshot. CRM shows updated values. 
2. **New Orders** — Order #2 (created after CRM update) contains the new snapshot. Order #1 snapshot unchanged.
3. **Edit Order** — Editing Order #1 updates only the order snapshot. CRM record is not mutated. Order #2 snapshot unchanged.
4. **Legacy Orders** — Orders with null snapshots fall back to CRM. After saving once, the snapshot is written and the order becomes fully snapshot-based.
5. **No Customer Writes** — `grep` confirms zero `Customer::update()` or `customer->save()` calls anywhere in the Orders module.
6. **Resources** — All 8 `OrderController` endpoints return `new OrderResource(...)`. One resource class, one source of truth.

---

## Affected Files

| File | Change |
|---|---|
| `database/migrations/2026_07_14_000002_add_customer_snapshot_fields_to_orders.php` | Adds `customer_secondary_phone`, `customer_notes` columns |
| `Modules/Commerce/Orders/Domain/Models/Order.php` | Added to `$fillable` + `@property` docblock |
| `Modules/Commerce/Orders/Application/Actions/CreateManualOrderAction.php` | Writes snapshot at creation; customer record fallback for lookup matches |
| `Modules/Commerce/Orders/Application/Actions/UpdateOrderAction.php` | Snapshot fields in `$enterpriseFields`; removed customer record mutation |
| `Modules/Commerce/Orders/Presentation/Http/Requests/UpdateOrderRequest.php` | `customer_name` added to validation rules |
| `Modules/Commerce/Orders/Presentation/Http/Resources/OrderResource.php` | Snapshot-first with CRM fallback |
| `Modules/Commerce/Orders/Infrastructure/Repositories/EloquentOrderRepository.php` | Search covers snapshot name + billing phone |
| `Modules/Commerce/OrderImport/Application/Services/WooCommerceOrderImporter.php` | Writes `customer_name` from billing fields at import time |
