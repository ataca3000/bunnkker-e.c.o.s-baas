# Temporal Data Model

**Document:** TEMPORAL-DATA-MODEL  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-DATA-ARCH-001  
**Parent:** ENTERPRISE-LOGICAL-DATA-ARCHITECTURE.md

---

## 1. Why Temporal Data Matters

Business data changes over time. Temporal modeling answers the questions:
- **"What was the price on this product on June 1st?"**
- **"Which tax rate applied to this invoice when it was issued?"**
- **"What were this supplier's delivery terms when this PO was created?"**

Without temporal modeling, an update to a product's price changes all historical data — breaking FIFO costing, invoice accuracy, and audit integrity.

---

## 2. Temporal Patterns

### Pattern T1: Point-in-Time Snapshot (Copy-on-Write)

The state at a specific moment is captured as a snapshot on the transactional record. Used when the consumer needs to know the historical value, not the current value.

**Example: OrderLine captures price at order time**
```
order_lines:
  unit_price DECIMAL NOT NULL       ← price at time of order
  product_name_snapshot VARCHAR     ← name at time of order
```
The product's current price may change; the order line always shows the price that was charged.

**Used for:**
- OrderLine (unit_price, product_name_snapshot)
- InvoiceLine (unit_price, tax_rate, product_description)
- RecipeLine (unit_cost_snapshot — cost at time recipe was saved)
- ShipmentLine (unit_cost_at_dispatch)

### Pattern T2: Effective Date Range (Bi-temporal)

A record is valid only within a defined time window. Queries include the effective date to get the correct version.

**Structure:**
```
effective_from DATE NOT NULL
effective_to DATE NULL        ← NULL means "currently active"
```

**Used for:**
- Product channel prices (price is effective from a date, superseded by a new price)
- Tax rates (VAT rate changes on a date; historical invoices use old rate)
- Supplier price lists (agreed prices valid for a contract period)
- Fulfillment profile versions (profile changes take effect on a date)

**Query pattern:**
```sql
WHERE effective_from <= :query_date
  AND (effective_to IS NULL OR effective_to >= :query_date)
```

**Only one active record:** Enforced by constraint that no two rows for the same entity share an overlapping date range.

### Pattern T3: Version History (Audit Log)

Every change creates an immutable history record. The current record is in the main table; history is in a `_versions` table.

**Structure:**
```
Main table: product_prices
  (current value)

History table: product_price_versions
  original_id UUID NOT NULL
  changed_at TIMESTAMP NOT NULL
  changed_by UUID NOT NULL
  old_value JSONB NOT NULL
  new_value JSONB NOT NULL
  change_reason VARCHAR NULL
```

**Used for:**
- Product pricing history (every price change versioned)
- Configuration Platform settings (every config change versioned — separate mechanism)
- Recipe cost snapshots (recipe_cost recalculated; history preserved)

### Pattern T4: Event Sourcing (Append-Only Events)

The full history is the event stream. The current state is derived by replaying events.

**Used for:**
- EPS-01 BusinessEvents (complete event history)
- StockMovements (inventory current state = sum of all movements)
- Timeline entries (history of a business object)

This is the most powerful temporal pattern but also the most complex to query. ECOS uses it only for the Platform layer and Inventory movements, where complete history is critical.

---

## 3. Temporal Data Catalog

| Entity | Pattern | Time Columns | Notes |
|---|---|---|---|
| order_lines | T1 (snapshot) | (none — captured at creation) | unit_price, product_name_snapshot immutable |
| invoice_lines | T1 (snapshot) | (none) | tax_rate, description captured at issue |
| receipt_layers | T4 (append-only) | received_at, created_at | FIFO — order of layers matters |
| stock_movements | T4 (append-only) | occurred_at, created_at | Inventory state derived from movements |
| product_channel_prices | T2 (effective range) | effective_from, effective_to | One active price per channel at any time |
| tax_rates | T2 (effective range) | effective_from, effective_to | Multiple rates may coexist (different categories) |
| supplier_price_lists | T2 (effective range) | effective_from, effective_to | Per-material, per-supplier pricing |
| business_events | T4 (append-only) | occurred_at, created_at | Immutable event history |
| timeline_entries | T4 (append-only) | occurred_at, created_at | Immutable timeline |
| recipe versions | T3 (version history) | created_at per version | Recipe changes create new versions |
| config settings | T2 (effective range) | effective_from, effective_to | Config Platform handles separately |

---

## 4. Temporal Query Rules

| Rule | Statement |
|---|---|
| **TEMP-001** | Queries on effective-date-range tables must always include a date parameter; never return "all rows" for price lookups |
| **TEMP-002** | Snapshot data on transactional records must never be updated retroactively |
| **TEMP-003** | Stock balance queries must compute: SUM(movements WHERE direction = +1) - SUM(movements WHERE direction = -1) per entity per warehouse |
| **TEMP-004** | The "current" active row in a T2 table is WHERE effective_to IS NULL; there must be exactly one such row per entity |
| **TEMP-005** | When a T2 row is superseded, set effective_to = new_row.effective_from - 1 day on the old row |
