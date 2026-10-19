# Constraint Standards

**Document:** CONSTRAINT-STANDARDS  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-DATABASE-ENGINEERING-001  
**Parent:** DATABASE-ENGINEERING-STANDARDS.md

---

## 1. NOT NULL Constraints

| Rule | Statement |
|---|---|
| **Required fields** | All mandatory business fields are NOT NULL |
| **Optional fields** | Nullable fields must have a business reason for being optional |
| **Audit columns** | `created_at`, `created_by`, `updated_at`, `updated_by` are always NOT NULL |
| **Status columns** | Always NOT NULL; always have a DEFAULT |
| **Amount/quantity columns** | NOT NULL with DEFAULT 0 when the zero state is valid |
| **Soft delete columns** | `deleted_at`, `deleted_by` are always NULLABLE |

---

## 2. DEFAULT Values

| Column Type | Default | Rationale |
|---|---|---|
| Amount columns (optional at creation) | `DEFAULT 0` | Orders, invoices start at zero |
| Boolean columns | `DEFAULT false` (or `DEFAULT true` where appropriate) | Explicit; never rely on implicit NULL |
| Status columns | `DEFAULT 'draft'` or appropriate initial status | Entity always has a valid initial state |
| `created_at` | `DEFAULT NOW()` | Application sets this; DB default as safety net |
| `updated_at` | `DEFAULT NOW()` | Application updates this; DB as safety net |
| JSONB columns (optional) | `DEFAULT '{}'::jsonb` or `NULL` (business-specific) | Empty object if always present; NULL if truly optional |

---

## 3. CHECK Constraints

Use CHECK constraints to enforce business rules at the database level:

### Amount Constraints
```sql
-- Amounts must be non-negative
CONSTRAINT chk_products_cost_non_negative CHECK (cost_price >= 0)
CONSTRAINT chk_products_price_non_negative CHECK (base_price >= 0)
CONSTRAINT chk_receipt_layers_qty_positive CHECK (received_qty > 0)
CONSTRAINT chk_receipt_layers_cost_positive CHECK (unit_cost > 0)
```

### Status Constraints (instead of ENUM type)
```sql
-- Use VARCHAR + CHECK instead of PostgreSQL ENUM
CONSTRAINT chk_orders_status CHECK (status IN (
  'draft', 'confirmed', 'reserved', 'in_preparation', 
  'ready', 'dispatched', 'delivered', 'failed', 'cancelled', 'on_hold'
))
```

### Logical Constraints
```sql
-- Remaining qty cannot exceed received qty
CONSTRAINT chk_receipt_layers_remaining_valid 
  CHECK (remaining_qty >= 0 AND remaining_qty <= received_qty)

-- Paid amount cannot exceed total
CONSTRAINT chk_invoices_paid_not_exceed_total
  CHECK (paid_amount <= total_amount)

-- effective_to must be after effective_from
CONSTRAINT chk_product_prices_date_range
  CHECK (effective_to IS NULL OR effective_to > effective_from)
```

### Polymorphic Type Constraints
```sql
-- Object type must be a known entity
CONSTRAINT chk_timeline_entries_object_type CHECK (object_type IN (
  'order', 'customer', 'product', 'raw_material', 'supplier', 
  'vehicle', 'shipment', 'preparation_wave', 'purchase_order', 
  'company', 'employee', 'invoice', 'pos_session'
))
```

---

## 4. UNIQUE Constraints

| Rule | Statement |
|---|---|
| Natural keys get UNIQUE | All natural keys defined in LOGICAL-KEYS.md get UNIQUE constraints |
| Partial UNIQUE for soft-delete | When a unique constraint should only apply to active records: `UNIQUE (company_id, sku) WHERE deleted_at IS NULL` |
| Conditional UNIQUE | Use partial index for conditional uniqueness (e.g., one open POS session per warehouse) |

### Partial UNIQUE Example (Soft Delete)
```sql
-- Product SKU unique only when not deleted
CREATE UNIQUE INDEX uq_products_company_id_sku_active
  ON products (company_id, sku)
  WHERE deleted_at IS NULL;
```

---

## 5. DEFERRABLE Constraints

Some constraints may need to be checked at the end of a transaction (not each statement). ECOS uses DEFERRABLE INITIALLY DEFERRED for:

- Sequence number generation (brief window between insert and sequence update)
- Self-referencing trees (category parent_id during tree restructure)

Default: All constraints are NOT DEFERRABLE. Only document specific exceptions here.

---

## 6. Constraint Enforcement in Application vs Database

| Validation Type | Where | Reason |
|---|---|---|
| Format (email, phone, SKU pattern) | Application layer | More descriptive error messages |
| Business rules (amount > 0) | Both application + DB CHECK | Defense in depth |
| Uniqueness | Both application + DB UNIQUE | DB is authoritative; app gives better UX |
| Required fields | Both application + DB NOT NULL | Defense in depth |
| Status transitions | Application only | DB cannot enforce state machine logic |
| Cross-domain references | Application only | DB cannot have FK across modules |
