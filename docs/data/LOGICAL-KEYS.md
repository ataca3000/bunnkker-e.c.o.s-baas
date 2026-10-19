# Logical Keys

**Document:** LOGICAL-KEYS  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-DATA-ARCH-001  
**Parent:** ENTERPRISE-LOGICAL-DATA-ARCHITECTURE.md

---

## 1. Key Types

| Key Type | Purpose | Implementation |
|---|---|---|
| **Primary Key (PK)** | Unique identity per row | UUID or ULID; generated application-side |
| **Natural Key** | Business identity — how humans identify this entity | One or more columns; UNIQUE constraint |
| **Foreign Key (FK)** | Referential integrity within domain | FK constraint; cross-domain uses UUID column only |
| **Composite Key** | Combination of columns forming a unique constraint | UNIQUE constraint across multiple columns |

---

## 2. Primary Key Standards

| Standard | Rule |
|---|---|
| All PKs are `id UUID` | No auto-increment integers; no composite PKs as the primary |
| Generated application-side | `Str::uuid()` in PHP; never `DEFAULT gen_random_uuid()` at DB level |
| ULID exception | High-volume append-only tables use `id CHAR(26)` ULID (see IDENTITY-STRATEGY.md) |
| Never nullable | PKs are always NOT NULL |
| Never reused | A deleted entity's PK is never recycled |

---

## 3. Natural Key Catalog

| Entity | Natural Key | Uniqueness Scope | Constraint |
|---|---|---|---|
| companies | `company_code` | Global | UNIQUE(company_code) |
| branches | `company_id, branch_code` | Per company | UNIQUE(company_id, branch_code) |
| warehouses | `company_id, warehouse_code` | Per company | UNIQUE(company_id, warehouse_code) |
| channels | `company_id, channel_code` | Per company | UNIQUE(company_id, channel_code) |
| products | `company_id, sku` | Per company | UNIQUE(company_id, sku) |
| raw_materials | `company_id, material_code` | Per company | UNIQUE(company_id, material_code) |
| categories | `company_id, category_scope, category_code` | Per company+scope | UNIQUE(company_id, category_scope, category_code) |
| suppliers | `company_id, supplier_code` | Per company | UNIQUE(company_id, supplier_code) |
| customers | `company_id, phone` (when not null) | Per company | UNIQUE(company_id, phone) WHERE phone IS NOT NULL |
| customers | `company_id, email` (when not null) | Per company | UNIQUE(company_id, email) WHERE email IS NOT NULL |
| vehicles | `company_id, license_plate` | Per company | UNIQUE(company_id, license_plate) |
| orders | `company_id, order_number` | Per company | UNIQUE(company_id, order_number) |
| invoices | `company_id, invoice_number` | Per company | UNIQUE(company_id, invoice_number) |
| purchase_orders | `company_id, po_number` | Per company | UNIQUE(company_id, po_number) |
| units | `company_id, unit_code` | Per company | UNIQUE(company_id, unit_code) |
| currencies | `currency_code` | Global | UNIQUE(currency_code) |
| countries | `country_code` | Global | UNIQUE(country_code) |
| governorates | `country_code, governorate_code` | Per country | UNIQUE(country_code, governorate_code) |

---

## 4. Business Number Sequences

Business numbers (human-readable identifiers) are generated via the sequences table:

### Entity: sequences
```
Table: sequences
Purpose: Atomically generate sequential business numbers per company per type per period

Columns:
  id:               UUID NOT NULL
  company_id:       UUID NOT NULL
  sequence_type:    VARCHAR(50) NOT NULL — e.g. 'order', 'invoice', 'purchase_order'
  period:           VARCHAR(10) NOT NULL — e.g. '202607' (year+month) or '2026' (year)
  current_value:    BIGINT NOT NULL DEFAULT 0
  created_at:       TIMESTAMP NOT NULL
  updated_at:       TIMESTAMP NOT NULL

Unique constraint: UNIQUE(company_id, sequence_type, period)

Usage:
  BEGIN TRANSACTION
  SELECT current_value FROM sequences 
    WHERE company_id = :cid AND sequence_type = :type AND period = :period
    FOR UPDATE  — row-level lock
  UPDATE sequences SET current_value = current_value + 1
  -- format: {PREFIX}-{period}-{LPAD(current_value+1, 6, '0')}
  COMMIT
```

---

## 5. Composite Unique Constraints

Beyond natural keys, several entities require composite uniqueness for business rule enforcement:

| Table | Constraint Columns | Business Rule |
|---|---|---|
| `reservations` | `(entity_type, entity_id, purpose_type, purpose_id)` WHERE status IN (pending, confirmed) | One active reservation per entity per purpose |
| `product_channel_configs` | `(product_id, channel_id, effective_from)` | One price per product per channel per date |
| `pos_sessions` | `(warehouse_id)` WHERE status = open | One open session per warehouse (unless POSPolicy overrides) |
| `inventory_items` | `(entity_type, entity_id, warehouse_id)` | One inventory position per entity per warehouse |
| `wave_items` | `(wave_id, order_id)` | Each order appears once per wave |

---

## 6. Foreign Key Rules Summary

### Apply FK Constraint When:
- The referenced table is in the SAME domain module
- The relationship is within the same aggregate or close aggregate neighbor
- The data is in the same PostgreSQL schema

### Do NOT Apply FK Constraint When:
- The referenced table is in a DIFFERENT domain module
- The reference is cross-domain (e.g. order_id on invoices table)
- The table is polymorphic (object_type + object_id pattern)
- The referenced entity uses soft delete (FK would fail on soft-deleted parents)

### When No FK Is Applied:
- Document the cross-domain reference in LOGICAL-RELATIONSHIP-MODEL.md
- Application layer validates existence before inserting (not DB layer)
- Orphan detection runs as a periodic data quality check, not a FK constraint
