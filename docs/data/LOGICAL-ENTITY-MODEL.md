# Logical Entity Model

**Document:** LOGICAL-ENTITY-MODEL  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-DATA-ARCH-001  
**Parent:** ENTERPRISE-LOGICAL-DATA-ARCHITECTURE.md

---

## 1. Entity Specification Format

Each entity is specified as:
```
Entity: {name}
Table:  {logical_table_name}
Domain: {domain module}
Aggregate: {owning aggregate}
Purpose: {business role}
Identity: {UUID | ULID | business_number}
Company Scoped: Yes | No (global entities only)
Columns:
  {column_name}: {logical_type} [{NOT NULL | NULL}] — {description}
Natural Keys: {fields that uniquely identify this entity in business terms}
Soft Delete: Yes | No | Append-Only
```

---

## 2. Organization Domain Entities

### Entity: companies
```
Table:  companies
Domain: Organization
Aggregate: Company (AGG-01)
Identity: UUID
Company Scoped: No (it IS the company)
Columns:
  id:             UUID NOT NULL
  company_code:   VARCHAR(50) NOT NULL — Unique company identifier
  name:           VARCHAR(255) NOT NULL
  name_ar:        VARCHAR(255) NULL
  status:         ENUM(active, suspended, inactive) NOT NULL
  country_code:   CHAR(2) NOT NULL — ISO 3166-1 alpha-2
  currency_code:  CHAR(3) NOT NULL — ISO 4217
  timezone:       VARCHAR(50) NOT NULL
  settings:       JSONB NULL — Extended company settings
  created_at, created_by, updated_at, updated_by
Natural Keys: company_code
Soft Delete: No (status-based lifecycle)
```

### Entity: branches
```
Table:  branches
Domain: Organization
Aggregate: Company (AGG-01)
Identity: UUID
Company Scoped: Yes
Columns:
  id, company_id, branch_code, name, name_ar, status, address_jsonb, created_at, created_by, updated_at, updated_by
Natural Keys: (company_id, branch_code)
Soft Delete: Yes
```

### Entity: warehouses
```
Table:  warehouses
Domain: Organization
Aggregate: Company (AGG-01)
Identity: UUID
Company Scoped: Yes
Columns:
  id, company_id, branch_id NULL, warehouse_code, name, name_ar, status
  address_line1, address_line2 NULL, governorate_code, country_code
  latitude NULL, longitude NULL
  capacity_sqm DECIMAL(10,2) NULL
  created_at, created_by, updated_at, updated_by
Natural Keys: (company_id, warehouse_code)
Soft Delete: Yes
```

### Entity: channels
```
Table:  channels
Domain: Organization
Aggregate: Company (AGG-01)
Identity: UUID
Company Scoped: Yes
Columns:
  id, company_id, channel_code, name, name_ar
  type: ENUM(woocommerce, meta, instagram, direct, pos) NOT NULL — Immutable after creation
  warehouse_id UUID NULL (default warehouse)
  status: ENUM(active, inactive, draft)
  config: JSONB NULL — Channel-specific configuration
  external_site_id VARCHAR(255) NULL — e.g., WooCommerce site URL
  created_at, created_by, updated_at, updated_by
Natural Keys: (company_id, channel_code)
Soft Delete: Yes
```

---

## 3. Inventory Domain Entities

### Entity: products
```
Table:  products
Domain: Inventory
Aggregate: Product (AGG-03)
Identity: UUID
Company Scoped: Yes
Columns:
  id, company_id, sku VARCHAR(50) NOT NULL — Immutable after activation
  name, name_ar NULL, description NULL
  category_id UUID NULL
  unit_id UUID NOT NULL
  status: ENUM(draft, active, discontinued)
  cost_price: DECIMAL(15,4) NOT NULL DEFAULT 0
  base_price: DECIMAL(15,4) NOT NULL DEFAULT 0
  currency_code CHAR(3) NOT NULL
  cost_source: ENUM(manual, recipe_calculated)
  weight_kg DECIMAL(10,3) NULL
  volume_m3 DECIMAL(10,6) NULL
  recipe_id UUID NULL
  image_path VARCHAR(500) NULL
  eligible_for_pos BOOLEAN NOT NULL DEFAULT true
  eligible_for_online BOOLEAN NOT NULL DEFAULT true
  manufacturing_readiness: ENUM(not_ready, pending_recipe, ready)
  created_at, created_by, updated_at, updated_by, deleted_at NULL, deleted_by NULL
Natural Keys: (company_id, sku)
Soft Delete: Yes
```

### Entity: raw_materials
```
Table:  raw_materials
Domain: Inventory
Aggregate: RawMaterial (AGG-04)
Identity: UUID
Company Scoped: Yes
Columns:
  id, company_id, material_code VARCHAR(50) NOT NULL
  name, name_ar NULL, description NULL
  category_id UUID NULL, unit_id UUID NOT NULL
  status: ENUM(draft, active, discontinued)
  reorder_point DECIMAL(15,4) NULL
  reorder_quantity DECIMAL(15,4) NULL
  preferred_supplier_id UUID NULL (cross-domain ref, no FK)
  image_path NULL
  created_at, created_by, updated_at, updated_by, deleted_at NULL, deleted_by NULL
Natural Keys: (company_id, material_code)
Soft Delete: Yes
```

### Entity: receipt_layers
```
Table:  receipt_layers
Domain: Inventory
Aggregate: RawMaterial (AGG-04)
Identity: UUID (ULID preferred for ordering)
Company Scoped: Yes
Columns:
  id, company_id, raw_material_id UUID NOT NULL
  warehouse_id UUID NOT NULL (cross-domain ref)
  purchase_order_line_id UUID NULL (cross-domain ref)
  goods_receipt_id UUID NULL (cross-domain ref)
  received_qty DECIMAL(15,4) NOT NULL
  remaining_qty DECIMAL(15,4) NOT NULL
  unit_cost DECIMAL(15,4) NOT NULL
  currency_code CHAR(3) NOT NULL
  received_at TIMESTAMP NOT NULL
  created_at, created_by
  (no updated_at — append-only except remaining_qty)
Natural Keys: none (system-generated)
Soft Delete: Append-Only (remaining_qty decrements to 0 when exhausted)
```

### Entity: reservations
```
Table:  reservations
Domain: Inventory
Aggregate: RawMaterial (AGG-04) / Product (AGG-03)
Identity: UUID
Company Scoped: Yes
Columns:
  id, company_id
  entity_type: ENUM(product, raw_material)
  entity_id UUID NOT NULL
  warehouse_id UUID NOT NULL
  purpose_type: ENUM(order, production_job)
  purpose_id UUID NOT NULL
  reserved_qty DECIMAL(15,4) NOT NULL
  status: ENUM(pending, confirmed, consumed, cancelled)
  reserved_until TIMESTAMP NULL
  created_at, created_by, updated_at, updated_by
Natural Keys: (entity_type, entity_id, purpose_type, purpose_id) — unique when active
Soft Delete: No (status-based)
```

### Entity: stock_movements
```
Table:  stock_movements
Domain: Inventory
Aggregate: RawMaterial (AGG-04) / Product (AGG-03)
Identity: ULID (sortable by time)
Company Scoped: Yes
Columns:
  id, company_id
  entity_type: ENUM(product, raw_material)
  entity_id UUID NOT NULL
  warehouse_id UUID NOT NULL
  movement_type: ENUM(receipt, consumption, adjustment, transfer, return, pos_sale) NOT NULL
  direction: SMALLINT NOT NULL — +1 (in) or -1 (out)
  quantity DECIMAL(15,4) NOT NULL
  unit_cost DECIMAL(15,4) NULL — set for COGS movements
  source_type VARCHAR(50) NULL
  source_id UUID NULL
  reason VARCHAR(255) NULL
  occurred_at TIMESTAMP NOT NULL
  created_by UUID NOT NULL
  created_at TIMESTAMP NOT NULL
Natural Keys: none
Soft Delete: Append-Only (never deleted or updated)
```

---

## 4. Commerce Domain Entities

### Entity: orders
```
Table:  orders
Domain: Commerce
Aggregate: Order (AGG-02)
Identity: UUID
Company Scoped: Yes
Columns:
  id, company_id, order_number VARCHAR(50) NOT NULL
  channel_id UUID NOT NULL (cross-domain ref)
  customer_id UUID NULL (cross-domain ref — nullable for guest orders)
  warehouse_id UUID NOT NULL
  status: ENUM(draft, confirmed, reserved, in_preparation, ready, dispatched, delivered, failed, cancelled, on_hold)
  delivery_address_jsonb NOT NULL
  shipping_amount DECIMAL(15,4) NOT NULL DEFAULT 0
  subtotal_amount DECIMAL(15,4) NOT NULL
  total_amount DECIMAL(15,4) NOT NULL
  currency_code CHAR(3) NOT NULL
  payment_method VARCHAR(50) NULL
  external_reference VARCHAR(255) NULL — WooCommerce order ID, Meta order ID
  external_source VARCHAR(50) NULL — 'woocommerce', 'meta', 'pos', 'direct'
  notes TEXT NULL
  confirmed_at TIMESTAMP NULL, dispatched_at NULL, delivered_at NULL, cancelled_at NULL
  created_at, created_by, updated_at, updated_by
Natural Keys: (company_id, order_number)
Soft Delete: No (status-based; orders are never deleted)
```

### Entity: order_lines
```
Table:  order_lines
Domain: Commerce
Aggregate: Order (AGG-02)
Identity: UUID
Company Scoped: Yes
Columns:
  id, company_id, order_id UUID NOT NULL (FK to orders)
  product_id UUID NOT NULL (cross-domain ref)
  product_name_snapshot VARCHAR(255) NOT NULL — captured at order time
  quantity DECIMAL(15,4) NOT NULL
  unit_price DECIMAL(15,4) NOT NULL
  discount_amount DECIMAL(15,4) NOT NULL DEFAULT 0
  line_total DECIMAL(15,4) NOT NULL
  currency_code CHAR(3) NOT NULL
  created_at, created_by
Natural Keys: none (lines are ordered within an order)
Soft Delete: No (lines are immutable once order confirmed)
```

---

## 5. Finance Domain Entities

### Entity: invoices
```
Table:  invoices
Domain: Finance
Aggregate: Invoice (AGG-14)
Identity: UUID
Company Scoped: Yes
Columns:
  id, company_id, invoice_number VARCHAR(50) NOT NULL
  order_id UUID NULL (cross-domain ref — NULL for non-order invoices)
  customer_id UUID NOT NULL (cross-domain ref)
  status: ENUM(draft, issued, partially_paid, paid, overdue, cancelled, voided)
  issue_date DATE NOT NULL
  due_date DATE NOT NULL
  subtotal_amount DECIMAL(15,4) NOT NULL
  tax_amount DECIMAL(15,4) NOT NULL DEFAULT 0
  total_amount DECIMAL(15,4) NOT NULL
  paid_amount DECIMAL(15,4) NOT NULL DEFAULT 0
  outstanding_amount DECIMAL(15,4) NOT NULL — (total - paid)
  currency_code CHAR(3) NOT NULL
  notes TEXT NULL
  created_at, created_by, updated_at, updated_by
Natural Keys: (company_id, invoice_number)
Soft Delete: No (financial records are immutable; status = voided for cancellation)
```

### Entity: pos_sessions
```
Table:  pos_sessions
Domain: Finance
Aggregate: POSSession (AGG-13)
Identity: UUID
Company Scoped: Yes
Columns:
  id, company_id, warehouse_id UUID NOT NULL
  cashier_id UUID NOT NULL (cross-domain ref to employee)
  register_id VARCHAR(100) NULL
  status: ENUM(open, closed, reconciled)
  opening_float DECIMAL(15,4) NOT NULL
  closing_float DECIMAL(15,4) NULL
  total_sales DECIMAL(15,4) NOT NULL DEFAULT 0
  opened_at TIMESTAMP NOT NULL
  closed_at TIMESTAMP NULL
  created_at, created_by, updated_at, updated_by
Natural Keys: none (one open session per warehouse per policy)
Soft Delete: No
```

---

## 6. Platform Domain Entities

### Entity: business_events
```
Table:  business_events
Domain: Platform (EPS-01)
Identity: UUID (system-generated)
Company Scoped: Yes
Columns:
  id UUID NOT NULL
  event_type VARCHAR(100) NOT NULL
  event_version VARCHAR(10) NOT NULL DEFAULT 'v1'
  aggregate_type VARCHAR(50) NOT NULL
  aggregate_id UUID NOT NULL
  company_id UUID NOT NULL
  occurred_at TIMESTAMP NOT NULL
  triggered_by UUID NULL
  triggered_by_type VARCHAR(50) NULL
  correlation_id UUID NULL
  causation_id UUID NULL
  source_module VARCHAR(50) NOT NULL
  payload JSONB NOT NULL
  created_at TIMESTAMP NOT NULL
Natural Keys: id
Soft Delete: Append-Only (events are immutable)
```

### Entity: timeline_entries
```
Table:  timeline_entries
Domain: Platform (EPS-02)
Identity: UUID
Company Scoped: Yes
Columns:
  id, company_id
  object_type VARCHAR(50) NOT NULL
  object_id UUID NOT NULL
  entry_type: ENUM(event, status_change, comment, note, attachment, approval, assignment, ai_recommendation, manual_override, system_event)
  actor_id UUID NULL, actor_type VARCHAR(50) NOT NULL
  occurred_at TIMESTAMP NOT NULL
  content JSONB NOT NULL
  source_event_id UUID NULL
  is_edited BOOLEAN NOT NULL DEFAULT false
  edited_at TIMESTAMP NULL
  created_at TIMESTAMP NOT NULL
Natural Keys: none
Soft Delete: Append-Only (except comments: soft-deleted with deleted_at)
```
