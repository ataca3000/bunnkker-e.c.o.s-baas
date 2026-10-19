# ADR-002 — Immutable Stock Ledger

**Date:** 2026-06-26
**Status:** Accepted
**Author:** ECOS Architecture Team

---

## Context

Inventory management requires answering two fundamentally different types of questions:

1. **"What is the current stock level?"** — a point-in-time balance query.
2. **"How did we get here?"** — a historical audit of every movement that affected stock.

Simple CRUD inventory systems maintain only a running balance (e.g., a `quantity` column that is
incremented and decremented). This is fast and simple but makes it impossible to reconstruct the
history of movements or to detect and correct errors without losing the audit trail.

ERP systems — and accounting systems generally — solve this with the **double-entry ledger** principle:
every stock movement is recorded as an immutable entry. The current balance is always derived from
the ledger, never stored independently as a mutable value.

ECOS ERP must support:

- Accurate COGS (Cost of Goods Sold) calculation per order.
- FIFO (First In, First Out) inventory valuation.
- Cycle count reconciliation with variance tracking.
- Full audit trail for inventory movements (receipts, sales, adjustments, reservations).
- ABC classification based on historical consumption patterns.

These requirements make the mutable-balance approach inadequate.

---

## Decision

### 1. The Stock Ledger Is Immutable

The `stock_ledger_entries` table is an **append-only ledger**. Once a row is written, it is never
updated or deleted.

```
stock_ledger_entries
├── id
├── inventory_item_id   → FK to inventory_items (product + warehouse)
├── movement_type       → enum (see below)
├── quantity            → positive or negative delta
├── unit_cost           → cost at time of movement
├── reference_type      → polymorphic reference to source document
├── reference_id
└── created_at          → immutable timestamp
```

**Prohibited operations on `stock_ledger_entries`:**
- `UPDATE` — never
- `DELETE` — never
- Back-dating `created_at` — never

### 2. Movement Types (Append-Only Enum)

The ledger recognises the following movement types. New types may be added as the system grows;
existing types are never renamed or removed.

| Movement Type | Description | Effect on on_hand_qty |
|---|---|---|
| `purchase_receipt` | Stock received from a Goods Receipt | + (increase) |
| `sales_issue` | Stock issued for a completed order/fulfillment | - (decrease) |
| `adjustment_in` | Positive variance from a count session | + (increase) |
| `adjustment_out` | Negative variance from a count session | - (decrease) |
| `reservation` | Stock reserved for a pending order | No on_hand change (reserved_qty +) |
| `reservation_release` | Reservation cancelled (order cancelled) | No on_hand change (reserved_qty -) |
| `direct_issue` | Direct stock consumption (non-order) | - (decrease) |
| `transfer_in` | *(Planned)* Stock received from inter-warehouse transfer | + (increase) |
| `transfer_out` | *(Planned)* Stock issued for inter-warehouse transfer | - (decrease) |
| `production_consumption` | *(Planned)* Raw material consumed in production | - (decrease) |
| `production_output` | *(Planned)* Finished goods produced | + (increase) |

### 3. Current Balance Is Derived, Not Stored in the Ledger

The current stock balance is maintained in the `inventory_items` table as a denormalized running
total for query performance. It is always derivable from the ledger but is kept in sync
incrementally for efficiency.

```
inventory_items
├── product_id
├── warehouse_id
├── on_hand_qty     → current physical quantity (derived, maintained in sync)
└── reserved_qty    → quantity committed to open orders (derived, maintained in sync)
```

**Available quantity** for new orders = `on_hand_qty - reserved_qty`.

The `on_hand_qty` and `reserved_qty` in `inventory_items` are authoritative for operational
decisions (can we fulfil this order?) but the `stock_ledger_entries` is authoritative for
audit and reconciliation.

### 4. FIFO Receipt Layers

Cost tracking uses the FIFO (First In, First Out) method. Each Goods Receipt posting creates one
or more **receipt layers** in `inventory_receipt_layers`:

```
inventory_receipt_layers
├── id
├── inventory_item_id
├── goods_receipt_id      → source of this layer (nullable for adjustment-in layers)
├── received_qty          → original quantity of this layer
├── remaining_qty         → quantity not yet consumed (decrements as stock is sold)
├── unit_cost             → cost per unit at time of receipt (landed cost included)
└── received_at
```

When stock is issued (sale, fulfillment, adjustment-out), the FIFO consumption service removes
units from the **oldest non-zero layer first**, recording each consumption in
`inventory_layer_consumptions` (append-only).

### 5. Reversals, Not Corrections

When a ledger entry must be corrected (e.g., a Goods Receipt was posted with a wrong quantity),
the correction is made through a **reversal transaction** — a new opposing ledger entry — not
by modifying the original entry.

**Example:** A receipt of 100 units was incorrectly posted. The correction creates:
- A new `adjustment_out` entry for -100 units.
- A new `adjustment_in` entry for the correct quantity (e.g., +90 units).

This preserves the full history: anyone auditing the ledger can see the original error and its
correction, with timestamps and user attribution.

### 6. Count Sessions as the Reconciliation Mechanism

Inventory Count Sessions (`inventory_count_sessions`) are the formal mechanism for reconciling
the physical count against the system's `on_hand_qty`. On approval of a count session:

- **Positive variance** (physical > system) → `AdjustmentInAction` creates a new FIFO receipt
  layer at the product's current FIFO cost.
- **Negative variance** (physical < system) → `AdjustmentOutAction` consumes FIFO layers and
  creates a ledger entry.

The count session approval is the **only** permitted way to adjust inventory quantities outside
of a transactional document (receipt or order).

---

## Consequences

### Positive

- **Full audit trail:** Every unit ever received, sold, reserved, or adjusted is traceable to its
  source document, timestamp, and cost.
- **COGS accuracy:** FIFO consumption guarantees that cost of goods sold reflects the actual
  acquisition cost of the specific units sold, in order of receipt.
- **Reconciliation:** The ledger can always be replayed to reconstruct `on_hand_qty` and
  `reserved_qty` from scratch. A mismatch between the ledger total and `inventory_items` indicates
  a bug that can be detected and corrected.
- **Fraud resistance:** No record can be silently modified. Corrections leave a visible trail.

### Negative / Trade-offs

- **Storage growth:** The ledger is append-only and grows indefinitely. High-volume operations
  (e.g., 1,000 order fulfillments per day) produce significant ledger volume.
- **Query cost for historical reports:** Summing ledger entries for a report requires aggregation.
  The denormalized `inventory_items` balances mitigate this for operational queries.
- **Complexity of corrections:** Operators cannot simply "edit" a quantity. They must understand
  the reversal pattern, which requires training.
- **FIFO layer management:** In high-turnover inventory, the number of open receipt layers can
  grow. Performance of the FIFO consumption query depends on appropriate indexing.

---

## Future Considerations

- **Ledger archival:** As ledger volume grows, entries older than a configurable threshold
  (e.g., 2 years) could be archived to a separate reporting database, with a reconciled
  opening-balance snapshot entry remaining in the primary database.
- **Alternative costing methods:** The current implementation supports FIFO only. Future
  requirements may introduce AVCO (Average Cost) as an alternative per-product or per-warehouse
  setting. This would require a new `costing_method` field on `inventory_items` and a
  parallel valuation path in the consumption service.
- **Real-time ledger streaming:** As transaction volume grows, the ledger could be streamed
  to an analytical data store (e.g., ClickHouse or a data warehouse) for reporting, keeping
  the primary MySQL database focused on operational writes.
- **Warehouse transfers:** When `transfer_in`/`transfer_out` movement types are implemented,
  FIFO layers must transfer their cost basis across warehouse boundaries to maintain valuation
  accuracy.
