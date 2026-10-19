# ADR-004 — Inventory Architecture

**Date:** 2026-06-26
**Status:** Accepted
**Author:** ECOS Architecture Team

---

## Context

Inventory management is the operational core of ECOS ERP. The system must:

- Track physical stock quantities across multiple warehouses.
- Reserve stock for pending orders before physical shipment.
- Record every stock movement with full cost and audit information.
- Calculate COGS (Cost of Goods Sold) using FIFO valuation.
- Support cycle counting and variance reconciliation.
- Classify products by consumption value (ABC analysis).
- Provide operational dashboards for warehouse managers.

A naive implementation (a single `quantity` column per product) cannot satisfy these requirements.
The inventory architecture must therefore be designed as a **multi-layer system**: an operational
balance layer for fast queries, an immutable ledger for audit and history, and a costing layer
for FIFO valuation.

---

## Decision

### 1. Core Concepts

#### Product Types

The system distinguishes two product types:

| Type | Description | Used In |
|---|---|---|
| `finished_good` | Sellable product | Orders, WooCommerce |
| `raw_material` | Input for manufacturing | Bills of Materials (future: Production Orders) |

Both types share the same `products` table and inventory infrastructure. The type affects
which business processes reference the product, not how stock is tracked.

#### Warehouse

A `Warehouse` is an independently managed physical or logical storage location. Each
warehouse maintains its own stock balances. Every inventory movement is warehouse-scoped.

Current warehouse capabilities:
- Named locations with address information.
- Default warehouse assignable to a WooCommerce channel for automatic order routing.
- Per-warehouse stock balances via the `InventoryItem` model.

#### Inventory Item

An `InventoryItem` represents the intersection of one product and one warehouse. It is the
**operational stock record**:

```
inventory_items
├── product_id
├── warehouse_id
├── on_hand_qty       → current physical quantity
└── reserved_qty      → committed to open orders, not yet shipped
```

- `on_hand_qty` is maintained incrementally by every stock-affecting action.
- `reserved_qty` is maintained incrementally by reservation and release actions.
- **Available to promise** = `on_hand_qty − reserved_qty`.

An `InventoryItem` row is created automatically the first time a product receives stock at a
warehouse. It is never permanently removed — if the warehouse is archived, the InventoryItem
follows the same Archive lifecycle defined in ADR-001.

### 2. Stock Ledger Layer

See **ADR-002** for the full immutable ledger specification. In the context of inventory
architecture, the key point is:

> The `stock_ledger_entries` table provides the immutable audit trail. The `inventory_items`
> table provides the denormalized operational balance. They must remain in sync at all times.
> If they diverge, `stock_ledger_entries` is authoritative.

Every action that changes `on_hand_qty` or `reserved_qty` must create a corresponding
`stock_ledger_entry` in the same database transaction.

### 3. FIFO Costing Layer

FIFO costing is implemented through **receipt layers**. Each Goods Receipt posting creates
one layer per product line:

```
inventory_receipt_layers
├── inventory_item_id
├── goods_receipt_id          → null for adjustment-in layers
├── goods_receipt_line_id     → null for adjustment-in layers
├── supplier_id               → null for adjustment-in layers
├── received_qty              → original quantity of this layer
├── remaining_qty             → unconsumed quantity (decrements as stock sells)
└── unit_cost                 → landed cost per unit at time of receipt
```

When stock is issued (sold, adjusted out, transferred):

1. The FIFO consumption service selects the **oldest layer** with `remaining_qty > 0`.
2. It decrements `remaining_qty` on that layer.
3. It records a `inventory_layer_consumptions` entry (append-only) linking the consumption
   to the issuing document.
4. If the layer is fully consumed, it moves to the next oldest layer.
5. The weighted COGS for the issue is computed as the sum of (units × unit_cost) across
   all consumed layers.

Product cost intelligence fields maintained on the `products` table:
- `last_purchase_cost` — cost from the most recent GR
- `average_cost` — volume-weighted average across all open layers
- `current_fifo_cost` — cost of the next unit to be issued (oldest open layer's unit_cost)
- `last_purchase_date` — date of most recent GR
- `last_supplier_id` — supplier from most recent GR

### 4. Reservation Strategy

> **Status: Preliminary — governed by a future ADR**
>
> The inventory reservation and allocation strategy is not yet finalized. A dedicated
> Architecture Decision Record will define the complete reservation workflow after reviewing:
>
> - **Order Lifecycle** — the full state machine for orders across all sales channels
> - **Multi-Warehouse Allocation** — rules for selecting which warehouse fulfils a given order
> - **Inventory Allocation Strategy** — priority rules when stock is limited across multiple pending orders
> - **Partial Fulfilment and Backorder Policy** — whether orders may be partially shipped
> - **Shipment Workflow** — how physical dispatch triggers inventory deduction
>
> **See: Future ADR — Inventory Reservation and Allocation Strategy**

The data model maintains a `reserved_qty` field on each `InventoryItem` as a structural
placeholder. Its update rules, the allocation workflow, conflict resolution when stock is
insufficient, and the relationship between reservations and shipments will all be specified
in the dedicated ADR before any production use of this feature.

### 5. Inventory Control Layer

The Inventory Control domain provides management-level tooling on top of the operational
inventory data.

#### ABC Classification

Products are classified by consumption value (quantity × cost) over a rolling 12-month window:

| Class | Cumulative % of Total Value | Review Frequency |
|---|---|---|
| A | 0 – 70% | Every 30 days |
| B | 70 – 90% | Every 90 days |
| C | 90 – 100% | Every 180 days |

Classification is computed by the `inventory:calculate-abc` artisan command and stored in
`inventory_abc_classifications`. The command should be scheduled to run on a regular cadence
(monthly recommended).

#### Cycle Count Planning

`cycle_count_plans` records the next recommended count date per product per warehouse,
derived from the ABC class review frequency. Products overdue for a count are surfaced in
the Cycle Count Planner dashboard.

#### Inventory Dashboard KPIs

The Inventory Control dashboard aggregates six operational KPIs from live data:

1. Total inventory value (on_hand_qty × current_fifo_cost)
2. Total SKUs managed
3. Count of SKUs with zero stock
4. Count of overdue cycle count items
5. Count of sessions in progress
6. Inventory health label (Healthy / Warning / Critical)

#### Variance Analytics

Five dimensions of variance are tracked from count session approvals:
- By product (which products have the most adjustments)
- By warehouse (which locations have the most shrinkage)
- By category (systemic category-level issues)
- By month (seasonal or trend patterns)
- Net variance value (monetary impact of adjustments)

### 6. Domain Action Map

Every state-changing inventory operation is encapsulated in a dedicated Action class.
No controller or service modifies inventory state directly.

| Action | Effect |
|---|---|
| `ReceiveStockAction` | on_hand_qty +, ledger: purchase_receipt, FIFO layer created |
| `AdjustmentInAction` | on_hand_qty +, ledger: adjustment_in, FIFO layer created |
| `AdjustmentOutAction` | on_hand_qty -, ledger: adjustment_out, FIFO consumed |
| `DirectIssueStockAction` | on_hand_qty -, ledger: direct_issue |

Actions related to stock reservation and fulfilment shipment will be defined in the
**Future ADR — Inventory Reservation and Allocation Strategy**.

---

## Consequences

### Positive

- **Operational accuracy:** Separate `on_hand_qty` and `reserved_qty` prevent over-selling
  by making available-to-promise calculable in a single arithmetic operation.
- **FIFO integrity:** The receipt layer model ensures that cost of goods sold reflects the
  actual acquisition cost of the specific units sold.
- **Multi-warehouse readiness:** The `(product_id, warehouse_id)` composite key on
  `inventory_items` means any number of warehouses can be added without schema changes.
- **Auditability:** Every balance change has a corresponding ledger entry with cost and
  source document reference.
- **Management visibility:** ABC classification, cycle count planning, and variance analytics
  are built on the same data structures, requiring no separate data pipeline.

### Negative / Trade-offs

- **Complexity:** Three layers (operational balance, ledger, FIFO layers) means more tables,
  more joins, and more places where a bug can introduce inconsistency.
- **Transaction discipline:** Every inventory action must be wrapped in a database transaction
  that updates `inventory_items`, writes to `stock_ledger_entries`, and (where applicable)
  mutates `inventory_receipt_layers` atomically. A partial update leaves the system inconsistent.
- **FIFO layer accumulation:** High-frequency receipt products accumulate many small FIFO layers.
  The consumption query must scan layers in chronological order. Index maintenance on
  `inventory_receipt_layers` is required for performance at scale.
- **Reservation correctness:** The rules governing when `reserved_qty` is incremented,
  decremented, and reconciled against physical stock carry significant correctness requirements.
  These are intentionally deferred to the dedicated reservation ADR to avoid premature
  commitment to an incomplete design.

---

## Future Considerations

- **Inter-warehouse transfers:** The `transfer_in` and `transfer_out` movement types are already
  defined in the `LedgerMovementType` enum. A future implementation will add `inventory_transfers`
  and `inventory_transfer_lines` tables, and `TransferOutAction`/`TransferInAction` that move
  both FIFO cost basis and physical stock between warehouses.

- **Production consumption and output:** `production_consumption` and `production_output`
  movement types are defined in the enum, pending the Manufacturing execution module
  (Work Orders). When production orders are introduced, the `DirectIssueStockAction` will
  be extended into a `ProductionConsumptionAction` that debits raw materials and a
  `ProductionOutputAction` that credits finished goods at their rolled-up production cost.

- **Alternative costing methods:** FIFO is the only costing method today. AVCO (Average
  Cost) or Standard Cost may be introduced per-product in the future. This would require
  a `costing_method` field on `products` and a parallel consumption path in the inventory
  service layer.

- **Warehouse zones and bin locations:** The current model supports warehouse-level granularity.
  Future requirements may need sub-warehouse locations (zones, aisles, bins). This would
  add a `location_id` dimension to `inventory_items` and `stock_ledger_entries`.

- **Negative stock policy:** Currently, the system prevents shipping more than available
  quantity. Some businesses operate with backorder or negative stock policies. A
  `allow_negative_stock` flag per warehouse or per product could be introduced without
  changing the ledger architecture.

- **Inventory Reservation and Allocation Strategy:** The full reservation workflow —
  including allocation rules, partial fulfilment, backorder policy, and shipment triggers —
  is deferred to a dedicated ADR. See section 4 above.

- **Channel stock push frequency:** Pushing stock levels to external sales channels on every
  movement may produce excessive API call volume at scale. A batch push strategy (every N
  minutes, aggregated per channel) should be evaluated and documented in a future ADR covering
  channel sync performance.

---

## Related ADRs

- **[ADR-012 — Unified Enterprise Pricing Policy](adr/ADR-012-unified-enterprise-pricing-policy.md):**
  The FIFO receipt layers and weighted-average cost fields defined in this ADR are the upstream
  inputs for the cost cascade that drives pricing reviews. When a goods receipt posts a
  `landed_unit_cost`, that value flows through `material_cost → recipe_cost → product_cost`
  and triggers a mandatory `PricingReview` before any selling price change is made.
