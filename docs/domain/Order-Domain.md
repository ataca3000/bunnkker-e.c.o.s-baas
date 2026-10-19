# Order Domain

**Status:** Approved (Architecture Package 01)
**Layer:** Commerce

---

## 1. Order Identity

An Order is a **customer commitment** — a formal record of a purchase agreement between the business and a customer.

Orders are the primary input to the Operations Planning layer and drive fulfillment, manufacturing, and shipping.

### Order Reference

- `order_number` — human-readable identifier (e.g. WC-12345, ERP-00234)
- `external_order_id` — source system ID (WooCommerce order ID, manual entry)
- `channel` — the commerce channel this order came from
- `customer` — customer reference (snapshot at order time, not live link)

---

## 2. Order Snapshot (Immutability)

### The Snapshot Rule

Orders always **copy** customer information at the time of order creation.

The order stores:
- Billing name, phone, email
- Billing address (full)
- Shipping name, phone
- Shipping address (full)
- Product names, SKUs, prices at time of order
- Payment method title at time of order

**None of these fields are ever automatically updated by changes to the customer, product, or price list.**

### Why Immutability Matters

> An order represents what was agreed at time of sale. Retroactively modifying order data would misrepresent the commercial agreement, affect financial reports, and break the audit chain.

If a customer's address changes after an order is placed, the order retains the original address. If a product's price changes, the order retains the original price.

---

## 3. Order Modification Session

There are legitimate reasons to modify an order after creation. These are handled through a controlled **Modification Session**.

### When Modifications Are Allowed

- Customer calls to update delivery address
- Operator corrects a data entry error
- Customer changes product quantities (before preparation begins)
- Business applies a manual discount
- Tracking number or shipping company update

### Modification Rules

- An order can only be modified by an **authorized user** with the required role
- Certain statuses lock certain fields (e.g. a dispatched order's shipping address cannot change)
- Every modification is recorded in the order's change history
- The original values are preserved alongside the modified values

---

## 4. Order Locking

Certain order operations lock parts or all of the order to prevent conflicting edits.

### Lock States

| Lock Type | Trigger | What Is Locked |
|-----------|---------|----------------|
| Status Lock | Status transition in progress | Status field |
| Preparation Lock | Batch assigned to order | Products, quantities |
| Dispatch Lock | Order dispatched | Shipping address, products |
| Full Lock | Delivered or Completed | All fields |

### Locking Rules

- Locks are system-enforced, not advisory
- Only a supervisor role can override a lock (with audit reason)
- Lock override creates a high-priority audit event

---

## 5. Order Owner

Every order has an owner — the user responsible for resolving issues and progressing the order.

### Ownership Fields

| Field | Description |
|-------|-------------|
| `created_by` | User who created or imported the order |
| `assigned_to` | User currently responsible for the order |
| `customer_service_owner` | CS rep who owns the customer relationship for this order |

### Ownership Rules

- A newly created order is owned by the creating user
- Ownership can be transferred with a reason
- Ownership transfer is logged in the timeline

---

## 6. Created By / Modified By

Every order maintains a complete creation and modification record.

| Field | Description |
|-------|-------------|
| `created_by` | User ID of creator |
| `created_at` | UTC timestamp of creation |
| `imported_by` | User who triggered import (if from channel sync) |
| `imported_at` | UTC timestamp of import |
| `last_modified_by` | User who made the most recent change |
| `last_modified_at` | UTC timestamp of most recent change |

---

## 7. Activity

Every order has an Activity feed — a chronological record of everything that happened to or around this order.

### Order Activity Event Types

| Category | Events |
|----------|--------|
| Status Events | Created, Confirmed, Preparing, Shipping, Delivered, Cancelled, Rejected |
| Modification Events | Address changed, product updated, discount applied, notes edited |
| Communication Events | Phone call logged, WhatsApp message sent, note added |
| Operational Events | Assigned to batch, picked, packed, dispatched, delivery attempt |
| System Events | Synced from channel, payment received, tracking updated |
| User Events | Comment added, @mention, attachment uploaded |

### Activity Rules

- Activity is append-only — events cannot be deleted
- Every event has: type, content, actor (user or system), timestamp
- Activity is visible to all authorized users on the order
- Future: activity may trigger notifications (push, WhatsApp, email)

---

## 8. Order Status Lifecycle

```
Processing
↓
Waiting For Payment (branch)
↓
Review / Confirmed
↓
Preparing
↓
Shipping
↓
Delivered / Delivery Delayed
↓
Completed

Dead ends:
Rejected | Cancelled | Waiting For Stock | Postponed
```

### Status Transition Rules

- Status transitions follow the defined lifecycle; no arbitrary jumps
- Certain transitions require supervisor approval (e.g. Cancelled after Preparing)
- Every status change creates an activity event
- Bulk status changes are logged as individual events per order

---

## 9. Order Events (Domain Events)

The Order domain publishes domain events consumed by other bounded contexts.

### Published Events

| Event | Consumers |
|-------|-----------|
| `OrderCreated` | Inventory (reservation), Analytics |
| `OrderConfirmed` | Operations Planning |
| `OrderCancelled` | Inventory (release reservation), Analytics |
| `OrderShipped` | Customer (notification), Shipping |
| `OrderDelivered` | Finance (invoice), Customer (loyalty) |
| `OrderRejected` | Customer (notification), Analytics |

### Event Rules

- Events carry sufficient data for consumers to act without calling back to Orders
- Events are versioned (version field in event envelope)
- Events include correlationId for tracing
- Consumers must handle events idempotently

---

## 10. Entity Structure

```
Order
├── id
├── order_number
├── external_order_id
├── channel_id → Channel
├── status: OrderStatus
├── created_by → User
├── created_at
├── last_modified_by → User
├── last_modified_at
│
├── Customer Snapshot
│   ├── customer_id → Customer (reference only)
│   ├── customer_code
│   ├── customer_name
│   ├── billing_name
│   ├── billing_phone
│   ├── billing_email
│   └── billing_address (snapshot)
│
├── Shipping Snapshot
│   ├── shipping_name
│   ├── shipping_phone
│   ├── shipping_address (snapshot)
│   ├── shipping_company_name
│   ├── shipping_method
│   ├── tracking_number
│   └── shipping_attempts: number
│
├── Location
│   ├── lat
│   ├── lng
│   ├── set_by → User
│   └── set_at
│
├── OrderLines[]
│   ├── id
│   ├── product_id → Product (reference)
│   ├── product_name (snapshot)
│   ├── sku (snapshot)
│   ├── quantity
│   ├── unit_price (snapshot)
│   ├── line_total
│   └── metadata
│
├── Financials
│   ├── subtotal
│   ├── shipping_total
│   ├── discount_total
│   ├── tax_total
│   ├── fees_total
│   └── total
│
├── Payment
│   ├── payment_method
│   ├── payment_method_title
│   ├── transaction_id
│   └── date_paid
│
├── Notes
│   ├── customer_note
│   └── internal_notes
│
└── ActivityEvents[] (see Activity-System.md)
```
