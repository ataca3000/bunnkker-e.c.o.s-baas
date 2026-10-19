# Indexing Standards

**Document:** INDEXING-STANDARDS  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-DATABASE-ENGINEERING-001  
**Parent:** DATABASE-ENGINEERING-STANDARDS.md

---

## 1. Index Philosophy

> An index is a promise: "queries on this column will be fast." Every index also costs: inserts and updates become slower. Index only what is genuinely queried, with genuine performance requirements.

---

## 2. Mandatory Indexes (Every Table)

| Index | Columns | Rationale |
|---|---|---|
| Primary Key | `id` | Implicit with PK definition |
| Tenant lookup | `company_id` | Every query is company-scoped |
| Natural Key | Natural key columns | Uniqueness + lookup |
| Tenant + Natural Key | `(company_id, {natural_key})` | Combined for indexed uniqueness |

---

## 3. Required Indexes by Pattern

### Pattern: Entity List with Status Filter
```
Every entity with a status column gets:
  INDEX (company_id, status)
  
When status is commonly filtered alongside another column:
  INDEX (company_id, status, created_at)  -- for date-filtered list
```

### Pattern: Parent → Children Lookup
```
Every child table's parent FK column gets an index:
  INDEX (order_id)           on order_lines
  INDEX (wave_id)            on wave_items
  INDEX (invoice_id)         on invoice_lines
  INDEX (purchase_order_id)  on po_lines
```

### Pattern: Cross-Domain Reference Lookup
```
UUID reference columns that are frequently queried get an index:
  INDEX (customer_id)    on orders
  INDEX (channel_id)     on orders
  INDEX (warehouse_id)   on orders
  INDEX (product_id)     on order_lines (+ company_id)
```

### Pattern: Time-Based Queries
```
High-volume append-only tables get time-based index:
  INDEX (occurred_at)    on stock_movements
  INDEX (occurred_at)    on business_events
  INDEX (occurred_at)    on timeline_entries
  
Combined with company:
  INDEX (company_id, occurred_at)
```

### Pattern: FIFO Ordering
```
ReceiptLayers FIFO consumption:
  INDEX (raw_material_id, warehouse_id, received_at)  -- FIFO consumption order
  INDEX (raw_material_id, warehouse_id, remaining_qty) WHERE remaining_qty > 0  -- partial index
```

---

## 4. Index Types

| Type | PostgreSQL Type | When to Use |
|---|---|---|
| B-tree (default) | `BTREE` | All equality, range, ORDER BY queries |
| Hash | `HASH` | Equality-only lookups (rarely better than B-tree in PG) |
| GIN | `GIN` | JSONB containment queries (`@>`, `?`, `?&`) |
| GiST | `GIST` | Geometric, text search, range overlap |
| Full Text | `GIN` on tsvector | When not using Meilisearch |
| Partial | `WHERE condition` | Index only relevant rows (e.g., WHERE deleted_at IS NULL) |

**Default:** Always B-tree unless a specific reason exists for another type.

---

## 5. Partial Indexes

Partial indexes index only a subset of rows, making them smaller and faster:

```sql
-- Index only active (non-deleted) products
CREATE INDEX CONCURRENTLY idx_products_active 
ON products (company_id, sku) 
WHERE deleted_at IS NULL;

-- Index only unfulfilled reservations
CREATE INDEX CONCURRENTLY idx_reservations_active
ON reservations (entity_type, entity_id, warehouse_id)
WHERE status IN ('pending', 'confirmed');

-- FIFO: index only receipt layers with remaining stock
CREATE INDEX CONCURRENTLY idx_receipt_layers_fifo
ON receipt_layers (raw_material_id, warehouse_id, received_at)
WHERE remaining_qty > 0;
```

---

## 6. Composite Index Column Order

For composite indexes, column order matters. Follow this rule:
1. Most selective column first (highest cardinality)
2. Then equality filters
3. Then range filters
4. Then ORDER BY columns

```
-- Good: company_id (equality) + status (equality) + created_at (range)
INDEX (company_id, status, created_at)

-- Good for FIFO: raw_material_id (equality) + warehouse_id (equality) + received_at (range/sort)
INDEX (raw_material_id, warehouse_id, received_at)
```

---

## 7. Indexes to NEVER Create

| Anti-Pattern | Why |
|---|---|
| Index every column individually | Wastes storage; query planner may not use them |
| Index on frequently-updated columns | High write overhead |
| Index boolean columns alone | Too low cardinality |
| Duplicate composite indexes with same prefix | One index covers both queries |
| Index on soft-deleted tables without partial index | Includes deleted rows uselessly |

---

## 8. Index Maintenance

| Task | Frequency | Command |
|---|---|---|
| `VACUUM ANALYZE` | Weekly (automated) | Autovacuum handles this |
| `REINDEX CONCURRENTLY` | On fragmentation detected | `REINDEX INDEX CONCURRENTLY idx_name` |
| Bloat check | Monthly | `pgstattuple` extension or monitoring |
| Unused index audit | Quarterly | Check `pg_stat_user_indexes.idx_scan = 0` |

---

## 9. Index Documentation

Every migration that creates a non-obvious index must include a comment:

```php
// Partial index for FIFO consumption — remaining_qty > 0 ensures we only
// index layers with stock, keeping this index small as layers deplete
DB::statement('CREATE INDEX CONCURRENTLY idx_receipt_layers_fifo ...');
```
