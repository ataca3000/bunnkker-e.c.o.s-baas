# ECOS ERP — Migration Strategy: Manufacturing & Procurement

**Document:** MIGRATION-STRATEGY-MFG  
**Version:** 1.0  
**Task:** TASK-MFG-DB-001  
**Status:** Draft — Awaiting Approval  
**Date:** 2026-06-29  
**Scope:** Phase H — Migration Order, Dependencies, Rollback, Data Preservation, Risk Analysis

**IMPORTANT:** This document describes the migration strategy only. No migrations, models, or code are created here.

---

## Overview

The migration plan is divided into five groups:
- **Group 1 — Extend Existing Tables** (backward-compatible column additions)
- **Group 2 — Enum Extensions** (additive changes to string enums)
- **Group 3 — New Immutable Tables** (Decision Log, Cost History, Consumptions)
- **Group 4 — New Transaction Tables** (Manufacturing, Disassembly, their sub-records)
- **Group 5 — New Procurement Tables** (Queue, Schedule, Runs, Purchase Requests)

All Group 1 and 2 migrations are **zero-downtime** — they add nullable columns or additive enum values. Groups 3-5 create entirely new tables with no impact on existing code.

---

## Migration Order & Dependencies

### Group 1 — Extend Existing Tables

These migrations must run in this order (some have cross-table dependencies).

#### MFG-M001 · Extend `products` table

**Purpose:** Add behavioral flags, cost source, and current cost to the product master.

**Operations:**
```
ADD COLUMN can_manufacture      BOOLEAN NOT NULL DEFAULT false
ADD COLUMN can_disassemble      BOOLEAN NOT NULL DEFAULT false
ADD COLUMN allow_negative_stock BOOLEAN NOT NULL DEFAULT false
ADD COLUMN cost_source          VARCHAR(30) NOT NULL DEFAULT 'manual'
ADD COLUMN current_cost         DECIMAL(15,4) NOT NULL DEFAULT 0

ADD INDEX idx_products_can_manufacture (can_manufacture) WHERE can_manufacture = true
ADD INDEX idx_products_cost_source (cost_source)
```

**Backward Compatible:** ✓ Yes — all new columns have safe defaults. Existing code continues to work.

**Data Migration (same transaction):**
```
UPDATE products
SET current_cost = COALESCE(last_purchase_cost, average_cost, current_fifo_cost, 0)
WHERE current_cost = 0
```

**Rollback:** DROP the five columns. No data loss (columns were new).

---

#### MFG-M002 · Extend `bills_of_materials` table

**Purpose:** Add integer version counter and enforce one active BOM per product.

**Operations:**
```
ADD COLUMN version_number INTEGER NOT NULL DEFAULT 1

ADD UNIQUE INDEX (product_id) WHERE is_active = true AND deleted_at IS NULL
  -- Name: uq_bom_one_active_per_product (partial unique index)
```

**Backward Compatible:** ✓ Yes — existing `version` string column untouched.

**Data Migration:**
```
-- Set version_number from existing string version where possible
UPDATE bills_of_materials
SET version_number = CAST(SPLIT_PART(version, '.', 1) AS INTEGER)
WHERE version ~ '^\d+(\.\d+)?$'

-- Set to 1 for any that can't be parsed
UPDATE bills_of_materials
SET version_number = 1
WHERE version_number IS NULL OR version_number = 0
```

**Risk:** If multiple active BOMs exist per product (current data bug), the unique index creation will fail. Pre-migration check required:
```sql
-- Run this check before applying migration:
SELECT product_id, COUNT(*) as active_count
FROM bills_of_materials
WHERE is_active = true AND deleted_at IS NULL
GROUP BY product_id
HAVING COUNT(*) > 1;
-- If any rows: deactivate duplicates before running migration.
```

**Rollback:** DROP `version_number` column. DROP partial unique index.

---

#### MFG-M003 · Extend `bill_of_material_lines` table

**Purpose:** Add input_product_id alias, sort_order, unit snapshot. Deprecate waste_percentage.

**Operations:**
```
ADD COLUMN input_product_id  UUID NULL REFERENCES products(id) ON DELETE RESTRICT
ADD COLUMN sort_order        SMALLINT NOT NULL DEFAULT 0
ADD COLUMN unit_id_snapshot  UUID NULL REFERENCES units(id) ON DELETE SET NULL

ADD INDEX idx_bom_lines_input_product (input_product_id) WHERE input_product_id IS NOT NULL
```

**Data Migration:**
```
-- Populate input_product_id from existing raw_material_id
UPDATE bill_of_material_lines
SET input_product_id = raw_material_id

-- Populate unit_id_snapshot from the referenced product's unit
UPDATE bill_of_material_lines bml
SET unit_id_snapshot = p.unit_id
FROM products p
WHERE p.id = bml.raw_material_id

-- Deprecation notice for waste_percentage:
-- Column kept. Values preserved. New code never reads it.
-- Comment: COLUMN DEPRECATED - DO NOT USE IN NEW CODE
```

**Backward Compatible:** ✓ Yes — `raw_material_id` column untouched. `waste_percentage` untouched.

**Rollback:** DROP `input_product_id`, `sort_order`, `unit_id_snapshot`.

---

#### MFG-M004 · Extend `orders` table

**Purpose:** Add manufacturing timestamp and enable the `preparing` status.

**Operations:**
```
ADD COLUMN inventory_manufacturing_at TIMESTAMPTZ NULL
```

**Note on `preparing` status:** The `status` column is a VARCHAR with application-level enum validation. Adding `preparing` to the enum requires:
1. Update the PHP `OrderStatus` enum class to include `'preparing'`
2. No database schema change required (it's a string column, not a PostgreSQL ENUM type)
3. Any CHECK constraints on the column must be updated if they exist (verify: none found in audit)

**Backward Compatible:** ✓ Yes — new nullable column, new enum value is additive.

**Rollback:** DROP `inventory_manufacturing_at`. Remove `preparing` from PHP enum (note: any rows with status=preparing must be updated first).

---

#### MFG-M005 · Extend `inventory_receipt_layers` table

**Purpose:** Add source type tracking and link to manufacturing transactions.

**Dependencies:** Must run AFTER MFG-M009 (manufacturing_transactions table must exist first for FK).

**Operations:**
```
ADD COLUMN source_type                VARCHAR(30) NOT NULL DEFAULT 'purchase'
ADD COLUMN manufacturing_transaction_id UUID NULL
  -- FK added after manufacturing_transactions exists:
  -- REFERENCES manufacturing_transactions(id) ON DELETE RESTRICT

ADD INDEX idx_receipt_layers_source_type (source_type)
ADD INDEX idx_receipt_layers_mfg_txn (manufacturing_transaction_id) WHERE manufacturing_transaction_id IS NOT NULL
```

**Backward Compatible:** ✓ Yes — `source_type` defaults to `'purchase'` for all existing rows.

**Rollback:** DROP `source_type`, DROP `manufacturing_transaction_id`, DROP FK constraint.

---

#### MFG-M006 · Extend `inventory_layer_consumptions` table

**Purpose:** Add consumption type and manufacturing/disassembly transaction references.

**Dependencies:** Must run AFTER MFG-M009 (manufacturing_transactions) and MFG-M011 (disassembly_transactions).

**Operations:**
```
ADD COLUMN consumption_type             VARCHAR(30) NOT NULL DEFAULT 'sales'
ADD COLUMN manufacturing_transaction_id UUID NULL
ADD COLUMN disassembly_transaction_id   UUID NULL

ADD INDEX idx_layer_consumption_type (consumption_type)
ADD INDEX idx_layer_consumption_mfg (manufacturing_transaction_id) WHERE manufacturing_transaction_id IS NOT NULL
ADD INDEX idx_layer_consumption_dis (disassembly_transaction_id) WHERE disassembly_transaction_id IS NOT NULL
```

**Backward Compatible:** ✓ Yes — `consumption_type` defaults to `'sales'` for all existing rows.

**Rollback:** DROP the three new columns and their indexes.

---

### Group 2 — Enum Extensions

#### MFG-M007 · LedgerMovementType — Add Disassembly Types

**Purpose:** Add `disassembly_consumption` and `disassembly_output` to the string-based movement type enum.

**Operations:** PHP-only change — update the `LedgerMovementType` enum class:
```
ADD: disassembly_consumption
ADD: disassembly_output
```

**No database migration required** — the column is `VARCHAR`, not a PostgreSQL ENUM type. The PHP enum class is the only thing to update.

**Backward Compatible:** ✓ Yes — additive only.

**Rollback:** Remove the two values from the PHP enum.

---

### Group 3 — New Immutable Tables

These tables have no dependencies on Groups 4 and 5. They can be created before or after.

#### MFG-M008 · Create `decision_logs`

**Dependencies:** None (uses only `products`, `orders` as reference IDs — no FK constraints on reference fields).

```
CREATE TABLE decision_logs (
  -- see MANUFACTURING-DATABASE-DESIGN.md C-01 for full DDL
)
CREATE INDEX ...
REVOKE UPDATE, DELETE ON decision_logs FROM app_user;
```

**Rollback:** DROP TABLE decision_logs (safe — no other tables FK to this)

---

#### MFG-M009 · Create `product_cost_histories`

**Dependencies:** Requires `products` table (always exists).

```
CREATE TABLE product_cost_histories (
  -- see MANUFACTURING-DATABASE-DESIGN.md C-02 for full DDL
)
CREATE INDEX ...
REVOKE UPDATE, DELETE ON product_cost_histories FROM app_user;
```

**Rollback:** DROP TABLE product_cost_histories

---

### Group 4 — New Transaction Tables

Must be created in this order due to FK dependencies.

#### MFG-M010 · Create `manufacturing_transactions`

**Dependencies:** `orders`, `order_lines`, `products`, `bills_of_materials`, `companies`, `warehouses`, `decision_logs`

```
CREATE TABLE manufacturing_transactions (
  -- see MANUFACTURING-DATABASE-DESIGN.md C-03 for full DDL
)
CREATE INDEX ...
```

**After this migration:** MFG-M005 can add the FK from `inventory_receipt_layers` to `manufacturing_transactions`.

**Rollback:** DROP TABLE manufacturing_transactions (cascade will propagate to manufacturing_consumptions)

---

#### MFG-M011 · Create `manufacturing_consumptions`

**Dependencies:** `manufacturing_transactions`, `products`, `warehouses`

```
CREATE TABLE manufacturing_consumptions (
  -- see MANUFACTURING-DATABASE-DESIGN.md C-04 for full DDL
)
CREATE INDEX ...
REVOKE UPDATE, DELETE ON manufacturing_consumptions FROM app_user;
```

**Rollback:** DROP TABLE manufacturing_consumptions

---

#### MFG-M012 · Create `disassembly_transactions`

**Dependencies:** `orders`, `products`, `bills_of_materials`, `companies`, `warehouses`, `decision_logs`

```
CREATE TABLE disassembly_transactions (
  -- see MANUFACTURING-DATABASE-DESIGN.md C-05 for full DDL
)
CREATE INDEX ...
```

**Rollback:** DROP TABLE disassembly_transactions

---

#### MFG-M013 · Create `disassembly_recoveries`

**Dependencies:** `disassembly_transactions`, `products`, `warehouses`

```
CREATE TABLE disassembly_recoveries (
  -- see MANUFACTURING-DATABASE-DESIGN.md C-06 for full DDL
)
CREATE INDEX ...
REVOKE UPDATE, DELETE ON disassembly_recoveries FROM app_user;
```

**Rollback:** DROP TABLE disassembly_recoveries

---

#### MFG-M014 · Apply FKs Requiring Transaction Tables

**Purpose:** Now that Groups 3 and 4 tables exist, apply the deferred FKs from Group 1 extensions.

**Operations:**
```
-- inventory_receipt_layers → manufacturing_transactions
ALTER TABLE inventory_receipt_layers
ADD CONSTRAINT fk_receipt_layers_mfg_txn
FOREIGN KEY (manufacturing_transaction_id)
REFERENCES manufacturing_transactions(id)
ON DELETE RESTRICT;

-- inventory_layer_consumptions → manufacturing_transactions
ALTER TABLE inventory_layer_consumptions
ADD CONSTRAINT fk_layer_consumption_mfg_txn
FOREIGN KEY (manufacturing_transaction_id)
REFERENCES manufacturing_transactions(id)
ON DELETE RESTRICT;

-- inventory_layer_consumptions → disassembly_transactions
ALTER TABLE inventory_layer_consumptions
ADD CONSTRAINT fk_layer_consumption_dis_txn
FOREIGN KEY (disassembly_transaction_id)
REFERENCES disassembly_transactions(id)
ON DELETE RESTRICT;
```

---

### Group 5 — New Procurement Tables

#### MFG-M015 · Create `procurement_schedules`

**Dependencies:** `companies`

```
CREATE TABLE procurement_schedules (
  -- see MANUFACTURING-DATABASE-DESIGN.md C-08 for full DDL
)
```

**Rollback:** DROP TABLE procurement_schedules

---

#### MFG-M016 · Create `scheduler_runs`

**Dependencies:** `procurement_schedules`, `companies`

```
CREATE TABLE scheduler_runs (
  -- see MANUFACTURING-DATABASE-DESIGN.md C-09 for full DDL
)
CREATE INDEX ...
```

**Rollback:** DROP TABLE scheduler_runs (cascade to purchase_requests)

---

#### MFG-M017 · Create `purchase_requests`

**Dependencies:** `scheduler_runs`, `companies`, `products`, `units`, `suppliers`, `purchase_orders`

```
CREATE TABLE purchase_requests (
  -- see MANUFACTURING-DATABASE-DESIGN.md C-10 for full DDL
)
CREATE INDEX ...
```

**Rollback:** DROP TABLE purchase_requests

---

#### MFG-M018 · Create `procurement_queue_entries`

**Dependencies:** `companies`, `products`, `units`

```
CREATE TABLE procurement_queue_entries (
  -- see MANUFACTURING-DATABASE-DESIGN.md C-07 for full DDL
)
CREATE INDEX ...
```

**Rollback:** DROP TABLE procurement_queue_entries

---

## Complete Migration Execution Order

```
Phase 1 — Zero-Downtime Column Additions (can run during business hours)
  MFG-M001  Extend products (flags + cost fields)
  MFG-M002  Extend bills_of_materials (version_number + unique index)
  MFG-M003  Extend bill_of_material_lines (input_product_id + sort + unit snapshot)
  MFG-M004  Extend orders (inventory_manufacturing_at + preparing status)
  MFG-M007  LedgerMovementType enum extension (PHP-only)

Phase 2 — Create Core Infrastructure Tables
  MFG-M008  Create decision_logs
  MFG-M009  Create product_cost_histories

Phase 3 — Create Transaction Tables (sequential — FK dependencies)
  MFG-M010  Create manufacturing_transactions
  MFG-M011  Create manufacturing_consumptions
  MFG-M012  Create disassembly_transactions
  MFG-M013  Create disassembly_recoveries

Phase 4 — Apply Deferred FKs to Extended Tables
  MFG-M005  Extend inventory_receipt_layers (source_type + mfg FK)
  MFG-M006  Extend inventory_layer_consumptions (consumption_type + FKs)
  MFG-M014  Apply deferred FK constraints

Phase 5 — Create Procurement Tables
  MFG-M015  Create procurement_schedules
  MFG-M016  Create scheduler_runs
  MFG-M017  Create purchase_requests
  MFG-M018  Create procurement_queue_entries
```

---

## Rollback Strategy

### Full Rollback (if migration fails before Phase 3)

Phases 1 and 2 can be fully rolled back:
- DROP the new columns added in MFG-M001 through MFG-M004
- DROP new tables from MFG-M008 and MFG-M009
- No existing data is lost

### Partial Rollback (if Phase 3+ fails)

Once manufacturing_transactions is created and has data (Phase 3), rollback requires:
1. Stop all new manufacturing operations
2. DROP tables in reverse dependency order:
   - MFG-M018: DROP procurement_queue_entries
   - MFG-M017: DROP purchase_requests
   - MFG-M016: DROP scheduler_runs
   - MFG-M015: DROP procurement_schedules
   - MFG-M014: DROP the FK constraints
   - MFG-M013: DROP disassembly_recoveries
   - MFG-M012: DROP disassembly_transactions
   - MFG-M011: DROP manufacturing_consumptions
   - MFG-M010: DROP manufacturing_transactions
   - MFG-M009: DROP product_cost_histories
   - MFG-M008: DROP decision_logs
   - MFG-M006: Remove columns from inventory_layer_consumptions
   - MFG-M005: Remove columns from inventory_receipt_layers
   - MFG-M004: Remove inventory_manufacturing_at from orders
   - MFG-M003: Remove columns from bill_of_material_lines
   - MFG-M002: Remove version_number from bills_of_materials
   - MFG-M001: Remove columns from products

**Risk note:** Rollback after the system has been live creates orphaned references in immutable tables (decision_logs, cost_histories). These tables should be archived before rollback.

---

## Data Preservation Strategy

### Products — Cost Field Migration

The products table has three existing cost fields:
- `last_purchase_cost` — last supplier unit cost
- `average_cost` — weighted average
- `current_fifo_cost` — oldest available FIFO layer cost

The new `current_cost` field consolidates these. Population strategy:

```sql
UPDATE products SET current_cost =
    CASE
        WHEN cost_source = 'purchase_invoice' THEN COALESCE(last_purchase_cost, 0)
        WHEN cost_source = 'recipe'           THEN 0  -- will be calculated after BOM is loaded
        WHEN cost_source = 'manual'           THEN COALESCE(last_purchase_cost, average_cost, current_fifo_cost, 0)
        ELSE COALESCE(current_fifo_cost, last_purchase_cost, average_cost, 0)
    END;
```

The three existing cost columns (`last_purchase_cost`, `average_cost`, `current_fifo_cost`) are **never removed** in Phase 1. They continue to be maintained by existing FIFO and purchasing code. The new `current_cost` is maintained exclusively by the new Cost Engine.

### BOM Version Number Migration

```sql
UPDATE bills_of_materials
SET version_number =
    CASE
        WHEN version ~ '^\d+$'        THEN CAST(version AS INTEGER)
        WHEN version ~ '^\d+\.\d+$'   THEN CAST(SPLIT_PART(version, '.', 1) AS INTEGER)
        ELSE 1
    END;
```

### BOM Line input_product_id Migration

```sql
UPDATE bill_of_material_lines
SET input_product_id = raw_material_id,
    unit_id_snapshot = (SELECT unit_id FROM products WHERE id = raw_material_id);
```

### waste_percentage Preservation

The `waste_percentage` column is **not removed** and its existing data is **not cleared**. It is simply never read by new code. This preserves historical data for potential future reference.

---

## Compatibility Strategy

### Existing Code — Zero Changes Required

The following existing modules require **no code changes** to remain functional after all migrations:

| Module | Why Safe |
|--------|---------|
| FIFO Engine | Uses `inventory_receipt_layers`, `inventory_layer_consumptions` — extended with nullable columns using safe defaults |
| Goods Receipt posting | Uses `goods_receipts`, `goods_receipt_lines` — untouched |
| Order reservation | Uses `orders`, `order_lines`, `inventory_items` — extended with nullable columns |
| Stock Ledger | Uses `stock_ledger_entries` — new enum values are additive |
| Purchase Orders | Uses `purchase_orders`, `purchase_order_lines` — untouched |
| Sales (orders) | Uses `orders`, `order_lines` — extended with nullable columns |
| Inventory counting | Uses `inventory_items` — untouched |
| ABC Classification | Uses `products` — new columns have safe defaults |
| WooCommerce sync | Uses `products`, `orders` — new columns have safe defaults |

### PHP Enum Updates Required

Two PHP enum classes need updates (no database changes):

| Enum Class | Change |
|-----------|--------|
| `OrderStatus` | Add `preparing` case |
| `LedgerMovementType` | Add `disassembly_consumption`, `disassembly_output` cases |

---

## Risk Analysis

| Risk | Severity | Mitigation |
|------|---------|-----------|
| Multiple active BOMs per product detected at MFG-M002 | HIGH | Run pre-migration check SQL. Fix data before migration. |
| `products.product_type` used in business logic | HIGH | Code audit: grep for `product_type` in all conditions. Remove/refactor before go-live. |
| `inventory_layer_consumptions.order_id IS NOT NULL` assumed in queries | MEDIUM | Audit all queries using this table. Add `consumption_type = 'sales'` filter where needed. |
| `stock_movements` table also needs new movement types | MEDIUM | Audit whether `stock_movements` is actively queried. Add movement types if needed. |
| PostgreSQL advisory lock not available in all environments | MEDIUM | Verify pg_try_advisory_lock() available. Alternative: use a `scheduler_locks` table. |
| `cost_source` set to wrong value for existing products | MEDIUM | Existing products default to `'manual'`. Purchasing team must update products to correct cost_source. |
| BOM version_number 0 from malformed version strings | LOW | The fallback in the migration SQL sets version_number = 1 for all unparseable values. |
| Rollback after live manufacturing data exists | HIGH | Archive decision_logs and cost_histories before attempting rollback. |
| `inventory_receipt_layers` deferred FK (MFG-M005) | LOW | FK is added after manufacturing_transactions exists. Applied in MFG-M014. |

---

## Pre-Migration Checklist

Before any migration is run, verify:

- [ ] Backup production database
- [ ] Run multiple-active-BOM check (see MFG-M002 risk)
- [ ] Run `product_type` logic audit across all PHP files
- [ ] Run `order_id IS NOT NULL` audit on `inventory_layer_consumptions` queries
- [ ] Confirm `pg_try_advisory_lock()` available in PostgreSQL version
- [ ] Test all migrations on staging database first
- [ ] Verify existing test suite passes after column additions
- [ ] Confirm rollback scripts are ready and tested

**Awaiting approval before any migration files are created.**
