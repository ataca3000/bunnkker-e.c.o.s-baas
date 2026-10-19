# Preparation OS — Database Design

**Document:** DATABASE-DESIGN  
**Version:** 1.0  
**Status:** APPROVED — Engineering Design Phase  
**Date:** 2026-07-05  
**Task:** TASK-PREP-001  
**Parent:** PREPARATION-OS-BLUEPRINT.md  
**Standards:** DATABASE-ENGINEERING-STANDARDS.md

---

## 1. Entity Relationship Diagram

```
                        ┌────────────────────────────────────┐
                        │         preparation_waves          │
                        │  (AGG-09 — Aggregate Root)         │
                        └──────────────────┬─────────────────┘
                                           │
              ┌────────────────────────────┼──────────────────────────┐
              │                            │                          │
              ▼                            ▼                          ▼
  ┌───────────────────┐   ┌───────────────────────┐   ┌──────────────────────────┐
  │ preparation_wave  │   │  preparation_wave_     │   │  preparation_material_   │
  │     _orders       │   │       items           │   │     requirements         │
  │ (wave ↔ order)    │   │ (product qty/wave)    │   │   (MRP output)           │
  └───────────────────┘   └───────────────────────┘   └──────────────────────────┘
                                     │
                                     ▼
                        ┌────────────────────────────┐
                        │   preparation_pick_lists   │
                        │   (1 per wave)             │
                        └──────────────┬─────────────┘
                                       │
                                       ▼
                        ┌────────────────────────────┐
                        │ preparation_pick_list_items│
                        │ (product pick quantities)  │
                        └────────────────────────────┘

              preparation_waves (1)──────(N) preparation_wave_workers
              preparation_waves (1)──────(N) preparation_exceptions
              preparation_waves (1)──────(N) preparation_production_requirements

              preparation_waves (1)──────(N) prepared_products_pool  [cross-domain output]
              prepared_products_pool (1)─(N) prepared_pool_movements [append-only audit]

              preparation_stations (independent — warehouse reference)
```

---

## 2. Entity Specifications

---

### Entity: preparation_waves

```
Table:  preparation_waves
Domain: Operations → Preparation OS
Aggregate: PreparationWave (AGG-09) — Root
Identity: UUID
Company Scoped: Yes
Soft Delete: Status-based (no deletion; use 'cancelled')

Columns:
  id:                     UUID NOT NULL PK
  company_id:             UUID NOT NULL              — FK to companies
  warehouse_id:           UUID NOT NULL              — cross-domain ref to warehouses (no FK)
  wave_number:            VARCHAR(50) NOT NULL       — Business key: PREP-{YYYY}{MM}-{seq}
  planning_date:          DATE NOT NULL              — The operational day this wave serves
  status:                 VARCHAR(50) NOT NULL       — Wave lifecycle state (see status model)
  orders_count:           INT NOT NULL DEFAULT 0    — Denormalized; updated on order add/remove
  products_count:         INT NOT NULL DEFAULT 0    — Unique products required
  lines_count:            INT NOT NULL DEFAULT 0    — Total order line count across all orders
  total_units_required:   DECIMAL(18,4) NOT NULL DEFAULT 0  — Sum of all WaveItem quantities
  total_units_prepared:   DECIMAL(18,4) NOT NULL DEFAULT 0  — Sum of all prepared quantities
  shortage_detected:      BOOLEAN NOT NULL DEFAULT false
  shortage_resolved_at:   TIMESTAMPTZ NULL
  shortage_resolved_by:   UUID NULL                 — FK to users
  approved_at:            TIMESTAMPTZ NULL           — Planning approval by supervisor
  approved_by:            UUID NULL                 — FK to users
  started_at:             TIMESTAMPTZ NULL           — Preparation physically started
  started_by:             UUID NULL                 — FK to users
  completed_at:           TIMESTAMPTZ NULL
  completed_by:           UUID NULL                 — FK to users
  cancelled_at:           TIMESTAMPTZ NULL
  cancelled_by:           UUID NULL                 — FK to users
  cancellation_reason:    TEXT NULL
  config_version_id:      UUID NULL                 — Configuration version at planning time (GOV-010)
  notes:                  TEXT NULL
  created_at:             TIMESTAMPTZ NOT NULL DEFAULT NOW()
  created_by:             UUID NOT NULL             — FK to users
  updated_at:             TIMESTAMPTZ NOT NULL DEFAULT NOW()
  updated_by:             UUID NOT NULL             — FK to users

Natural Keys: (company_id, wave_number) UNIQUE
```

**Status Model:**
```
'draft'            — Wave created; no demand generated yet
'planning'         — Product demand generated; material analysis running or complete
'shortage_blocked' — Material shortage detected; cannot proceed without resolution
'preparing'        — Active preparation in progress
'completed'        — All products prepared and in pool
'cancelled'        — Wave terminated; all reservations released
```

**CHECK Constraints:**
```sql
CONSTRAINT chk_preparation_waves_status CHECK (status IN (
  'draft', 'planning', 'shortage_blocked', 'preparing', 'completed', 'cancelled'
))
CONSTRAINT chk_preparation_waves_units_prepared CHECK (total_units_prepared >= 0)
CONSTRAINT chk_preparation_waves_units_required CHECK (total_units_required >= 0)
CONSTRAINT chk_preparation_waves_orders_count CHECK (orders_count >= 0)
```

**Indexes:**
```sql
idx_preparation_waves_company_id
idx_preparation_waves_company_status        (company_id, status)
idx_preparation_waves_company_planning_date (company_id, planning_date)
idx_preparation_waves_warehouse_id
uq_preparation_waves_company_wave_number    UNIQUE (company_id, wave_number)
```

---

### Entity: preparation_wave_orders

```
Table:  preparation_wave_orders
Domain: Operations → Preparation OS
Aggregate: PreparationWave (AGG-09) — Child
Identity: UUID
Company Scoped: Yes
Soft Delete: No (add/remove records directly — wave in draft status only)

Columns:
  id:                      UUID NOT NULL PK
  company_id:              UUID NOT NULL
  preparation_wave_id:     UUID NOT NULL              — FK to preparation_waves
  order_id:                UUID NOT NULL              — cross-domain ref to orders (no FK)
  order_number:            VARCHAR(50) NOT NULL       — denormalized for display
  order_confirmed_at:      TIMESTAMPTZ NOT NULL       — denormalized snapshot
  customer_name_snapshot:  VARCHAR(255) NULL          — L1 PII snapshot; encrypted at rest
  delivery_zone_snapshot:  VARCHAR(100) NULL          — denormalized for routing context
  added_at:                TIMESTAMPTZ NOT NULL DEFAULT NOW()
  added_by:                UUID NOT NULL              — FK to users

Natural Keys: (preparation_wave_id, order_id) UNIQUE
```

**FK Constraints:**
```sql
fk_preparation_wave_orders_preparation_wave_id → preparation_waves.id (RESTRICT)
```

**Indexes:**
```sql
idx_preparation_wave_orders_wave_id          (preparation_wave_id)
idx_preparation_wave_orders_order_id         (order_id)
idx_preparation_wave_orders_company_id
uq_preparation_wave_orders_wave_order        UNIQUE (preparation_wave_id, order_id)
```

---

### Entity: preparation_wave_items

```
Table:  preparation_wave_items
Domain: Operations → Preparation OS
Aggregate: PreparationWave (AGG-09) — Child
Identity: UUID
Company Scoped: Yes
Soft Delete: No (items are regenerated on recalculate)

Columns:
  id:                      UUID NOT NULL PK
  company_id:              UUID NOT NULL
  preparation_wave_id:     UUID NOT NULL              — FK to preparation_waves
  product_id:              UUID NOT NULL              — cross-domain ref to products (no FK)
  sku_snapshot:            VARCHAR(100) NOT NULL      — denormalized at generation time
  name_snapshot:           VARCHAR(255) NOT NULL      — denormalized at generation time
  quantity_required:       DECIMAL(18,4) NOT NULL     — total across all wave orders
  quantity_prepared:       DECIMAL(18,4) NOT NULL DEFAULT 0
  quantity_short:          DECIMAL(18,4) NOT NULL DEFAULT 0  — computed: max(0, required - prepared)
  status:                  VARCHAR(50) NOT NULL DEFAULT 'pending'
  prepared_at:             TIMESTAMPTZ NULL
  prepared_by:             UUID NULL                  — FK to users
  notes:                   TEXT NULL
  created_at:              TIMESTAMPTZ NOT NULL DEFAULT NOW()
  created_by:              UUID NOT NULL
  updated_at:              TIMESTAMPTZ NOT NULL DEFAULT NOW()
  updated_by:              UUID NOT NULL

Natural Keys: (preparation_wave_id, product_id) UNIQUE
```

**Status Model:**
```
'pending'     — Not yet started
'in_progress' — Actively being prepared
'prepared'    — Fully prepared (quantity_prepared >= quantity_required)
'short'       — Partially prepared; quantity_short > 0
'blocked'     — Cannot proceed; exception raised
```

**CHECK Constraints:**
```sql
CONSTRAINT chk_wave_items_status CHECK (status IN (
  'pending', 'in_progress', 'prepared', 'short', 'blocked'
))
CONSTRAINT chk_wave_items_qty_required_positive CHECK (quantity_required > 0)
CONSTRAINT chk_wave_items_qty_prepared_non_negative CHECK (quantity_prepared >= 0)
CONSTRAINT chk_wave_items_qty_short_non_negative CHECK (quantity_short >= 0)
```

**FK Constraints:**
```sql
fk_preparation_wave_items_preparation_wave_id → preparation_waves.id (RESTRICT)
```

**Indexes:**
```sql
idx_preparation_wave_items_wave_id           (preparation_wave_id)
idx_preparation_wave_items_product_id        (product_id)
idx_preparation_wave_items_wave_status       (preparation_wave_id, status)
uq_preparation_wave_items_wave_product       UNIQUE (preparation_wave_id, product_id)
```

---

### Entity: preparation_material_requirements

```
Table:  preparation_material_requirements
Domain: Operations → Preparation OS (MRP output)
Aggregate: PreparationWave (AGG-09) — Child
Identity: UUID
Company Scoped: Yes
Soft Delete: No (regenerated on recalculate)

Columns:
  id:                      UUID NOT NULL PK
  company_id:              UUID NOT NULL
  preparation_wave_id:     UUID NOT NULL              — FK to preparation_waves
  raw_material_id:         UUID NOT NULL              — cross-domain ref to raw_materials (no FK)
  material_name_snapshot:  VARCHAR(255) NOT NULL      — denormalized
  unit_snapshot:           VARCHAR(50) NOT NULL       — unit of measure
  quantity_required:       DECIMAL(18,4) NOT NULL     — total required across all wave products
  quantity_available:      DECIMAL(18,4) NOT NULL     — stock snapshot at analysis time
  quantity_to_purchase:    DECIMAL(18,4) NOT NULL DEFAULT 0
  shortage:                BOOLEAN NOT NULL DEFAULT false
  shortage_amount:         DECIMAL(18,4) NOT NULL DEFAULT 0
  analyzed_at:             TIMESTAMPTZ NOT NULL       — when MRP ran
  analyzed_by:             UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'  — system
  purchase_request_id:     UUID NULL                  — cross-domain ref if MR/PO created
  resolved:                BOOLEAN NOT NULL DEFAULT false
  resolved_at:             TIMESTAMPTZ NULL
  resolved_by:             UUID NULL
  created_at:              TIMESTAMPTZ NOT NULL DEFAULT NOW()
  created_by:              UUID NOT NULL
  updated_at:              TIMESTAMPTZ NOT NULL DEFAULT NOW()
  updated_by:              UUID NOT NULL

Natural Keys: (preparation_wave_id, raw_material_id) UNIQUE
```

**CHECK Constraints:**
```sql
CONSTRAINT chk_material_req_qty_required_positive CHECK (quantity_required > 0)
CONSTRAINT chk_material_req_qty_available_non_neg CHECK (quantity_available >= 0)
CONSTRAINT chk_material_req_shortage_amount_non_neg CHECK (shortage_amount >= 0)
```

**FK Constraints:**
```sql
fk_preparation_material_requirements_wave_id → preparation_waves.id (RESTRICT)
```

**Indexes:**
```sql
idx_prep_material_req_wave_id                (preparation_wave_id)
idx_prep_material_req_material_id            (raw_material_id)
idx_prep_material_req_wave_shortage          (preparation_wave_id, shortage) WHERE shortage = true
uq_prep_material_req_wave_material           UNIQUE (preparation_wave_id, raw_material_id)
```

---

### Entity: preparation_production_requirements

```
Table:  preparation_production_requirements
Domain: Operations → Preparation OS (PRP output)
Aggregate: PreparationWave (AGG-09) — Child
Identity: UUID
Company Scoped: Yes
Soft Delete: No

Columns:
  id:                      UUID NOT NULL PK
  company_id:              UUID NOT NULL
  preparation_wave_id:     UUID NOT NULL              — FK to preparation_waves
  product_id:              UUID NOT NULL              — cross-domain ref (no FK)
  sku_snapshot:            VARCHAR(100) NOT NULL
  name_snapshot:           VARCHAR(255) NOT NULL
  quantity_required:       DECIMAL(18,4) NOT NULL
  quantity_available:      DECIMAL(18,4) NOT NULL     — finished goods stock snapshot
  quantity_to_manufacture: DECIMAL(18,4) NOT NULL DEFAULT 0
  priority:                INT NOT NULL DEFAULT 5     — 1 = highest; for manufacturing queue
  manufacturing_job_id:    UUID NULL                  — cross-domain ref if job created
  status:                  VARCHAR(50) NOT NULL DEFAULT 'pending'
  analyzed_at:             TIMESTAMPTZ NOT NULL
  created_at:              TIMESTAMPTZ NOT NULL DEFAULT NOW()
  created_by:              UUID NOT NULL
  updated_at:              TIMESTAMPTZ NOT NULL DEFAULT NOW()
  updated_by:              UUID NOT NULL

Natural Keys: (preparation_wave_id, product_id) UNIQUE
```

**Status Model:**
```
'pending'        — Manufacturing not yet triggered
'job_created'    — Manufacturing job linked
'manufacturing'  — Manufacturing in progress
'ready'          — Product available (manufactured or found in stock)
```

**FK Constraints:**
```sql
fk_prep_production_req_wave_id → preparation_waves.id (RESTRICT)
```

---

### Entity: preparation_pick_lists

```
Table:  preparation_pick_lists
Domain: Operations → Preparation OS
Aggregate: PreparationWave (AGG-09) — Child (1 per wave)
Identity: UUID
Company Scoped: Yes
Soft Delete: No

Columns:
  id:                      UUID NOT NULL PK
  company_id:              UUID NOT NULL
  preparation_wave_id:     UUID NOT NULL UNIQUE       — FK to preparation_waves (1:1)
  status:                  VARCHAR(50) NOT NULL DEFAULT 'pending'
  generated_at:            TIMESTAMPTZ NOT NULL
  generated_by:            UUID NOT NULL
  started_at:              TIMESTAMPTZ NULL
  completed_at:            TIMESTAMPTZ NULL
  picker_id:               UUID NULL                  — FK to users (assigned picker)
  created_at:              TIMESTAMPTZ NOT NULL DEFAULT NOW()
  created_by:              UUID NOT NULL
  updated_at:              TIMESTAMPTZ NOT NULL DEFAULT NOW()
  updated_by:              UUID NOT NULL

Natural Keys: (preparation_wave_id) UNIQUE
```

**Status Model:**
```
'pending'     — Generated; not yet being picked
'in_progress' — Picking underway
'completed'   — All items picked (or marked short)
```

**FK Constraints:**
```sql
fk_preparation_pick_lists_wave_id → preparation_waves.id (RESTRICT)
```

---

### Entity: preparation_pick_list_items

```
Table:  preparation_pick_list_items
Domain: Operations → Preparation OS
Aggregate: PreparationWave (AGG-09) — Child
Identity: UUID
Company Scoped: Yes
Soft Delete: No

Columns:
  id:                      UUID NOT NULL PK
  company_id:              UUID NOT NULL
  pick_list_id:            UUID NOT NULL              — FK to preparation_pick_lists
  product_id:              UUID NOT NULL              — cross-domain ref (no FK)
  sku_snapshot:            VARCHAR(100) NOT NULL
  name_snapshot:           VARCHAR(255) NOT NULL
  warehouse_zone:          VARCHAR(100) NULL          — picking zone
  shelf_location:          VARCHAR(100) NULL          — shelf/bin reference
  quantity_to_pick:        DECIMAL(18,4) NOT NULL
  quantity_picked:         DECIMAL(18,4) NOT NULL DEFAULT 0
  status:                  VARCHAR(50) NOT NULL DEFAULT 'pending'
  picked_by:               UUID NULL                  — FK to users
  picked_at:               TIMESTAMPTZ NULL
  created_at:              TIMESTAMPTZ NOT NULL DEFAULT NOW()
  created_by:              UUID NOT NULL
  updated_at:              TIMESTAMPTZ NOT NULL DEFAULT NOW()
  updated_by:              UUID NOT NULL

Natural Keys: (pick_list_id, product_id) UNIQUE
```

**Status Model:**
```
'pending'     — Not yet picked
'in_progress' — Picker started this item
'picked'      — Quantity picked == quantity_to_pick
'short'       — quantity_picked < quantity_to_pick; item closed with variance
```

**FK Constraints:**
```sql
fk_pick_list_items_pick_list_id → preparation_pick_lists.id (RESTRICT)
```

**Indexes:**
```sql
idx_pick_list_items_pick_list_id             (pick_list_id)
idx_pick_list_items_product_id               (product_id)
idx_pick_list_items_status                   (pick_list_id, status)
uq_pick_list_items_list_product              UNIQUE (pick_list_id, product_id)
```

---

### Entity: prepared_products_pool

```
Table:  prepared_products_pool
Domain: Operations → Preparation OS (output) / Loading OS (input)
Aggregate: PreparedProductsPool (independent aggregate root)
Identity: UUID
Company Scoped: Yes
Soft Delete: Status-based (pool entries are never deleted; managed by quantity fields)

Columns:
  id:                      UUID NOT NULL PK
  company_id:              UUID NOT NULL
  warehouse_id:            UUID NOT NULL              — cross-domain ref (no FK)
  product_id:              UUID NOT NULL              — cross-domain ref (no FK)
  sku_snapshot:            VARCHAR(100) NOT NULL
  name_snapshot:           VARCHAR(255) NOT NULL
  preparation_wave_id:     UUID NOT NULL              — cross-domain origin ref (no FK)
  quantity_available:      DECIMAL(18,4) NOT NULL DEFAULT 0  — ready for loading
  quantity_reserved:       DECIMAL(18,4) NOT NULL DEFAULT 0  — reserved by a shipping wave
  quantity_loaded:         DECIMAL(18,4) NOT NULL DEFAULT 0  — transferred to vehicle
  quality_status:          VARCHAR(50) NOT NULL DEFAULT 'pending_review'
  quality_checked_by:      UUID NULL                 — FK to users
  quality_checked_at:      TIMESTAMPTZ NULL
  prepared_at:             TIMESTAMPTZ NOT NULL
  reserved_for_wave_id:    UUID NULL                 — cross-domain ref to shipping_waves (no FK)
  notes:                   TEXT NULL
  created_at:              TIMESTAMPTZ NOT NULL DEFAULT NOW()
  created_by:              UUID NOT NULL
  updated_at:              TIMESTAMPTZ NOT NULL DEFAULT NOW()
  updated_by:              UUID NOT NULL

Natural Keys: (preparation_wave_id, product_id, warehouse_id) UNIQUE
```

**Quality Status Model:**
```
'pending_review' — Not yet quality checked
'passed'         — Approved; can be reserved and loaded
'failed'         — Rejected; triggers exception alert; cannot be reserved
```

**CHECK Constraints:**
```sql
CONSTRAINT chk_pool_quality_status CHECK (quality_status IN (
  'pending_review', 'passed', 'failed'
))
CONSTRAINT chk_pool_qty_available_non_neg CHECK (quantity_available >= 0)
CONSTRAINT chk_pool_qty_reserved_non_neg CHECK (quantity_reserved >= 0)
CONSTRAINT chk_pool_qty_loaded_non_neg CHECK (quantity_loaded >= 0)
CONSTRAINT chk_pool_reserved_le_available CHECK (quantity_reserved <= quantity_available + quantity_reserved)
```

**Indexes:**
```sql
idx_pool_company_id
idx_pool_warehouse_id                        (warehouse_id, quality_status)
idx_pool_product_id                          (product_id)
idx_pool_preparation_wave_id                 (preparation_wave_id)
idx_pool_reserved_for_wave_id                (reserved_for_wave_id) WHERE reserved_for_wave_id IS NOT NULL
uq_pool_wave_product_warehouse               UNIQUE (preparation_wave_id, product_id, warehouse_id)
```

---

### Entity: prepared_pool_movements

```
Table:  prepared_pool_movements
Domain: Operations → Preparation OS
Aggregate: PreparedProductsPool — Append-Only Audit Child
Identity: ULID (high-volume append-only; see IDENTITY-STRATEGY.md)
Company Scoped: Yes
Soft Delete: Append-Only (never deleted, never updated)

Columns:
  id:                      CHAR(26) NOT NULL PK       — ULID
  company_id:              UUID NOT NULL
  pool_entry_id:           UUID NOT NULL              — FK to prepared_products_pool
  movement_type:           VARCHAR(50) NOT NULL
  quantity_moved:          DECIMAL(18,4) NOT NULL
  from_wave_id:            UUID NULL                  — shipping wave (cross-domain, no FK)
  to_wave_id:              UUID NULL                  — shipping wave (cross-domain, no FK)
  vehicle_id:              UUID NULL                  — cross-domain ref (no FK)
  actor_id:                UUID NOT NULL              — FK to users or system actor
  actor_type:              VARCHAR(20) NOT NULL DEFAULT 'user'
  notes:                   TEXT NULL
  recorded_at:             TIMESTAMPTZ NOT NULL DEFAULT NOW()

No updated_at, updated_by (append-only)
```

**Movement Type Values:**
```
'created'               — Pool entry created from preparation wave completion
'reserved'              — Reserved by a shipping wave
'reservation_released'  — Reservation cancelled; quantity returned to available
'loaded'                — Transferred to vehicle inventory
'quality_failed'        — Quality check failed; quantity moved to failed state
'reallocated'           — Moved from one shipping wave to another
```

**CHECK Constraints:**
```sql
CONSTRAINT chk_pool_movements_type CHECK (movement_type IN (
  'created', 'reserved', 'reservation_released', 'loaded', 'quality_failed', 'reallocated'
))
CONSTRAINT chk_pool_movements_qty_positive CHECK (quantity_moved > 0)
CONSTRAINT chk_pool_movements_actor_type CHECK (actor_type IN ('user', 'system', 'ai'))
```

**FK Constraints:**
```sql
fk_pool_movements_pool_entry_id → prepared_products_pool.id (RESTRICT)
```

**Indexes:**
```sql
idx_pool_movements_pool_entry_id             (pool_entry_id)
idx_pool_movements_recorded_at               (recorded_at)
idx_pool_movements_company_recorded_at       (company_id, recorded_at)
```

---

### Entity: preparation_wave_workers

```
Table:  preparation_wave_workers
Domain: Operations → Preparation OS
Aggregate: PreparationWave (AGG-09) — Child
Identity: UUID
Company Scoped: Yes
Soft Delete: No (released_at marks end of assignment)

Columns:
  id:                      UUID NOT NULL PK
  company_id:              UUID NOT NULL
  preparation_wave_id:     UUID NOT NULL              — FK to preparation_waves
  user_id:                 UUID NOT NULL              — FK to users
  role:                    VARCHAR(50) NOT NULL       — 'supervisor' | 'operator' | 'quality_checker'
  assigned_at:             TIMESTAMPTZ NOT NULL DEFAULT NOW()
  assigned_by:             UUID NOT NULL              — FK to users
  released_at:             TIMESTAMPTZ NULL
  released_by:             UUID NULL                 — FK to users

Natural Keys: (preparation_wave_id, user_id) WHERE released_at IS NULL
```

**CHECK Constraints:**
```sql
CONSTRAINT chk_wave_workers_role CHECK (role IN ('supervisor', 'operator', 'quality_checker'))
```

**FK Constraints:**
```sql
fk_wave_workers_wave_id → preparation_waves.id (RESTRICT)
fk_wave_workers_user_id → users.id (RESTRICT)
```

**Indexes:**
```sql
idx_wave_workers_wave_id                     (preparation_wave_id)
idx_wave_workers_user_id                     (user_id)
idx_wave_workers_active                      (preparation_wave_id, user_id) WHERE released_at IS NULL
```

---

### Entity: preparation_stations

```
Table:  preparation_stations
Domain: Operations → Preparation OS
Aggregate: Independent (warehouse configuration)
Identity: UUID
Company Scoped: Yes
Soft Delete: Yes (deleted_at / deleted_by)

Columns:
  id:                      UUID NOT NULL PK
  company_id:              UUID NOT NULL
  warehouse_id:            UUID NOT NULL              — cross-domain ref (no FK)
  name:                    VARCHAR(100) NOT NULL
  name_ar:                 VARCHAR(100) NULL
  station_type:            VARCHAR(50) NOT NULL
  zone:                    VARCHAR(100) NULL          — warehouse zone identifier
  capacity:                INT NULL                  — max concurrent workers
  status:                  VARCHAR(50) NOT NULL DEFAULT 'active'
  notes:                   TEXT NULL
  created_at:              TIMESTAMPTZ NOT NULL DEFAULT NOW()
  created_by:              UUID NOT NULL
  updated_at:              TIMESTAMPTZ NOT NULL DEFAULT NOW()
  updated_by:              UUID NOT NULL
  deleted_at:              TIMESTAMPTZ NULL
  deleted_by:              UUID NULL

Natural Keys: (company_id, warehouse_id, name) WHERE deleted_at IS NULL
```

**Station Type Values:**
```
'picking'        — Product collection from shelves
'assembly'       — Product assembly / mixing
'quality_check'  — QC inspection station
'packaging'      — Pre-packing (if workflow requires)
'storage'        — Staging area for completed preparations
```

**Status Values:** `'active'`, `'inactive'`, `'maintenance'`

**CHECK Constraints:**
```sql
CONSTRAINT chk_stations_type CHECK (station_type IN (
  'picking', 'assembly', 'quality_check', 'packaging', 'storage'
))
CONSTRAINT chk_stations_status CHECK (status IN ('active', 'inactive', 'maintenance'))
CONSTRAINT chk_stations_capacity_positive CHECK (capacity IS NULL OR capacity > 0)
```

**Indexes:**
```sql
idx_stations_company_id                      (company_id)
idx_stations_warehouse_id                    (warehouse_id)
idx_stations_company_status                  (company_id, status)
uq_stations_company_warehouse_name           UNIQUE (company_id, warehouse_id, name) WHERE deleted_at IS NULL
```

---

### Entity: preparation_exceptions

```
Table:  preparation_exceptions
Domain: Operations → Preparation OS
Aggregate: PreparationWave (AGG-09) — Child
Identity: UUID
Company Scoped: Yes
Soft Delete: No (status-based)

Columns:
  id:                      UUID NOT NULL PK
  company_id:              UUID NOT NULL
  preparation_wave_id:     UUID NOT NULL              — FK to preparation_waves
  exception_type:          VARCHAR(100) NOT NULL
  severity:                VARCHAR(20) NOT NULL
  entity_type:             VARCHAR(50) NULL           — polymorphic subject type
  entity_id:               UUID NULL                 — polymorphic subject ID
  description:             TEXT NOT NULL
  status:                  VARCHAR(50) NOT NULL DEFAULT 'open'
  resolved_at:             TIMESTAMPTZ NULL
  resolved_by:             UUID NULL
  resolution_notes:        TEXT NULL
  escalated_at:            TIMESTAMPTZ NULL
  escalated_to:            UUID NULL                 — FK to users
  created_at:              TIMESTAMPTZ NOT NULL DEFAULT NOW()
  created_by:              UUID NOT NULL
  updated_at:              TIMESTAMPTZ NOT NULL DEFAULT NOW()
  updated_by:              UUID NOT NULL

Natural Keys: none (multiple exceptions per wave of same type are valid)
```

**Exception Type Values:**
```
'shortage'              — Raw material insufficient for preparation
'quality_failed'        — Product failed quality check
'missing_recipe'        — Product has no active recipe
'worker_unavailable'    — Assigned worker not present
'equipment_failure'     — Station equipment failure
'quantity_variance'     — Prepared quantity significantly less than required
```

**Severity Values:** `'blocking'`, `'warning'`, `'informational'`

**Status Values:** `'open'`, `'resolved'`, `'escalated'`, `'closed'`

**FK Constraints:**
```sql
fk_preparation_exceptions_wave_id → preparation_waves.id (RESTRICT)
```

**Indexes:**
```sql
idx_prep_exceptions_wave_id                  (preparation_wave_id)
idx_prep_exceptions_wave_status              (preparation_wave_id, status)
idx_prep_exceptions_severity_status          (severity, status) WHERE status = 'open'
```

---

## 3. Business Number Sequence

Wave numbers use the business number format: `PREP-{YYYY}{MM}-{6-digit-sequence}`

Examples: `PREP-202607-000001`, `PREP-202607-000002`

This sequence is managed via the `business_number_sequences` table (see IDENTITY-STRATEGY.md), with scope `(company_id, 'preparation_wave', year, month)`.

---

## 4. Aggregate Boundary Summary

| Aggregate | Root Table | Owned Tables |
|---|---|---|
| PreparationWave (AGG-09) | `preparation_waves` | `preparation_wave_orders`, `preparation_wave_items`, `preparation_material_requirements`, `preparation_production_requirements`, `preparation_pick_lists`, `preparation_pick_list_items`, `preparation_wave_workers`, `preparation_exceptions` |
| PreparedProductsPool | `prepared_products_pool` | `prepared_pool_movements` |
| PreparationStation | `preparation_stations` | — |

---

## 5. Cross-Domain Reference Map

| Column | Table | References | FK Constraint |
|---|---|---|---|
| `warehouse_id` | `preparation_waves` | `warehouses.id` | None (cross-domain) |
| `order_id` | `preparation_wave_orders` | `orders.id` | None (cross-domain) |
| `product_id` | `preparation_wave_items` | `products.id` | None (cross-domain) |
| `raw_material_id` | `preparation_material_requirements` | `raw_materials.id` | None (cross-domain) |
| `product_id` | `preparation_production_requirements` | `products.id` | None (cross-domain) |
| `manufacturing_job_id` | `preparation_production_requirements` | `production_jobs.id` | None (cross-domain) |
| `purchase_request_id` | `preparation_material_requirements` | `purchase_requests.id` | None (cross-domain) |
| `product_id` | `prepared_products_pool` | `products.id` | None (cross-domain) |
| `preparation_wave_id` | `prepared_products_pool` | `preparation_waves.id` | None (cross-domain) |
| `reserved_for_wave_id` | `prepared_products_pool` | `shipping_waves.id` | None (cross-domain) |
| `vehicle_id` | `prepared_pool_movements` | `vehicles.id` | None (cross-domain) |
| `warehouse_id` | `preparation_stations` | `warehouses.id` | None (cross-domain) |

---

## 6. Migration Sequence

Migrations must be created in this order (respecting FK dependencies):

```
1. create_preparation_stations_table
2. create_preparation_waves_table
3. create_preparation_wave_orders_table
4. create_preparation_wave_items_table
5. create_preparation_material_requirements_table
6. create_preparation_production_requirements_table
7. create_preparation_pick_lists_table
8. create_preparation_pick_list_items_table
9. create_preparation_wave_workers_table
10. create_preparation_exceptions_table
11. create_prepared_products_pool_table
12. create_prepared_pool_movements_table
13. add_indexes_to_preparation_tables   (CONCURRENTLY — separate migration)
```

All migrations follow MIGRATION-STANDARDS.md. All indexes use `CONCURRENTLY`.

---

## 7. Data Classification

| Table | Classification | PII Fields |
|---|---|---|
| `preparation_waves` | L3 Internal | None |
| `preparation_wave_orders` | L1 Personal | `customer_name_snapshot` (encrypted AES-256) |
| `preparation_wave_items` | L3 Internal | None |
| `preparation_material_requirements` | L3 Internal | None |
| `prepared_products_pool` | L3 Internal | None |
| `prepared_pool_movements` | L3 Internal | None |
| `preparation_stations` | L3 Internal | None |

See DATA-CLASSIFICATION.md for full classification rules.
