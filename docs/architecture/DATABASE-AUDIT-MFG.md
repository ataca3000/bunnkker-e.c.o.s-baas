# ECOS ERP — Manufacturing & Procurement Database Audit

**Document:** DATABASE-AUDIT-MFG  
**Version:** 1.0  
**Task:** TASK-MFG-DB-001  
**Status:** Draft — Awaiting Approval  
**Date:** 2026-06-29  
**Scope:** Phase A (Complete Audit) + Phase B (Gap Analysis) — Database Design Only

---

## Phase A — Complete Database Audit

Audit of every manufacturing-relevant table. For each table: purpose, current usage, reuse score, problems, extension possibilities, deprecation possibility, and dependencies.

**Reuse Score:** 5 = perfect fit, 4 = minor gaps, 3 = needs extension, 2 = needs refactor, 1 = should replace

---

### A-01 · `products`

**Purpose:** Central product catalog. Single source of truth for all sellable, purchasable, and manufacturable items.

**Exact Schema:**
```
id                UUID PK
sku               VARCHAR UNIQUE INDEX
barcode           VARCHAR NULL
name              VARCHAR INDEX
description       TEXT NULL
category_id       UUID FK→categories RESTRICT
unit_id           UUID FK→units RESTRICT
product_type      VARCHAR INDEX                   ← 'finished_good' | 'raw_material'
is_active         BOOLEAN DEFAULT true INDEX
image_url         VARCHAR NULL
regular_price     DECIMAL(12,2) NULL
sale_price        DECIMAL(12,2) NULL
last_purchase_cost DECIMAL(15,4) NULL
average_cost       DECIMAL(15,4) NULL
last_purchase_date DATE NULL
last_supplier_id  UUID NULL                       ← no FK constraint (historical)
current_fifo_cost DECIMAL(15,4) NULL
short_description TEXT NULL
long_description  TEXT NULL
stock_status      VARCHAR NULL                    ← 'instock' | 'outofstock' | 'onbackorder'
created_at        TIMESTAMP
updated_at        TIMESTAMP
deleted_at        TIMESTAMP NULL SOFT DELETE
```

**Current Usage:** Used by every module. Orders, Inventory, Purchasing, BOM all FK to `products`.

**Reuse Score:** 3 / 5

**Problems:**
1. `product_type` ('finished_good' / 'raw_material') is used as classification but the spec forbids its use as business logic. No enforcement exists in the database.
2. `last_purchase_cost`, `average_cost`, `current_fifo_cost` are separate, uncoordinated cost fields. No single authoritative "current cost" exists.
3. No behavioral flags: `can_manufacture`, `can_disassemble`, `allow_negative_stock` do not exist.
4. No `cost_source` field — no way to configure how cost is maintained.
5. `last_supplier_id` has no FK constraint (historical reference only). Not suitable for systematic supplier-product relationships.

**Extension Possibilities:**
- Add `can_manufacture BOOLEAN DEFAULT false`
- Add `can_disassemble BOOLEAN DEFAULT false`
- Add `allow_negative_stock BOOLEAN DEFAULT false`
- Add `cost_source VARCHAR(30) DEFAULT 'manual'`
- Add `current_cost DECIMAL(15,4) DEFAULT 0`
- Keep all existing fields for backward compatibility

**Deprecation Possibility:** None — this is the core entity.

**Dependencies:** `order_lines`, `purchase_order_lines`, `goods_receipt_lines`, `bill_of_material_lines`, `inventory_items`, `inventory_receipt_layers`, `inventory_layer_consumptions`, `stock_movements`, `stock_ledger_entries`, `stock_balances`

---

### A-02 · `units`

**Purpose:** Unit of measure master. Referenced by products to define the base quantity unit.

**Exact Schema:**
```
id          UUID PK
code        VARCHAR UNIQUE INDEX
name        VARCHAR
symbol      VARCHAR NULL
description VARCHAR NULL
is_active   BOOLEAN DEFAULT true INDEX
created_at  TIMESTAMP
updated_at  TIMESTAMP
deleted_at  TIMESTAMP NULL SOFT DELETE
```

**Current Usage:** Products FK to units. GoodsReceiptLines snapshot the unit at receipt time.

**Reuse Score:** 5 / 5

**Problems:** None.

**Extension Possibilities:** None required.

**Deprecation Possibility:** None.

**Dependencies:** `products`, `goods_receipt_lines` (snapshot columns)

---

### A-03 · `suppliers`

**Purpose:** Vendor master. Referenced by purchase orders and goods receipts.

**Exact Schema:**
```
id              UUID PK
code            VARCHAR UNIQUE INDEX
name            VARCHAR INDEX
contact_person  VARCHAR NULL
email           VARCHAR NULL
phone           VARCHAR NULL
mobile          VARCHAR NULL
country         VARCHAR NULL INDEX
city            VARCHAR NULL
address         VARCHAR NULL
notes           TEXT NULL
is_active       BOOLEAN DEFAULT true INDEX
created_at      TIMESTAMP
updated_at      TIMESTAMP
deleted_at      TIMESTAMP NULL SOFT DELETE
```

**Current Usage:** Purchase Orders, Goods Receipts, InventoryReceiptLayers reference suppliers.

**Reuse Score:** 5 / 5

**Problems:**
- No `default_lead_time_days` field (relevant for Phase 2 procurement intelligence).
- No product-supplier pricing table (the `last_supplier_id` on products is informal).

**Extension Possibilities (Phase 2 only):**
- Add `default_lead_time_days SMALLINT NULL`
- New table `product_suppliers` for structured product-supplier pricing relationships

**Deprecation Possibility:** None.

**Dependencies:** `purchase_orders`, `goods_receipts`, `inventory_receipt_layers`

---

### A-04 · `bills_of_materials`

**Purpose:** Bill of materials (recipe) defining how a product is manufactured.

**Exact Schema:**
```
id          UUID PK
bom_number  VARCHAR(20) UNIQUE INDEX
product_id  UUID FK→products RESTRICT INDEX
version     VARCHAR(20) DEFAULT '1.0'            ← STRING version (problem)
is_active   BOOLEAN DEFAULT false
notes       TEXT NULL
created_at  TIMESTAMP
updated_at  TIMESTAMP
deleted_at  TIMESTAMP NULL SOFT DELETE
```

**Current Usage:** The Manufacturing module (BillsOfMaterials subdomain). Referenced by BillOfMaterialLines.

**Reuse Score:** 3 / 5

**Problems:**
1. `version` is a `VARCHAR(20)` with default `'1.0'`. The spec requires integer versioning for snapshot references in manufacturing transactions. String versions ('1.0', '2.0') are not sortable or comparable numerically.
2. `is_active` defaults to `false`. This means new BOMs must be explicitly activated — this is acceptable but must be documented.
3. No unique constraint on `(product_id)` where `is_active = true` — multiple active BOMs could exist for one product (bug risk).
4. `bom_number` is a human-readable identifier — this is fine but not required by the spec (spec uses UUID).

**Extension Possibilities:**
- Add `version_number INTEGER DEFAULT 1` (integer version counter — authoritative for snapshots)
- Add partial unique index: `UNIQUE (product_id) WHERE is_active = true AND deleted_at IS NULL`

**Deprecation Possibility:** None. This table IS the Recipe in ECOS terminology. "Recipe" = BOM.

**Dependencies:** `bill_of_material_lines`, `manufacturing_transactions` (new), `disassembly_transactions` (new)

---

### A-05 · `bill_of_material_lines`

**Purpose:** Individual component lines within a BOM/Recipe. Each line specifies one input material and its quantity.

**Exact Schema:**
```
id               UUID PK
bom_id           UUID FK→bills_of_materials CASCADE DELETE
raw_material_id  UUID FK→products RESTRICT DELETE
quantity         DECIMAL(12,4)
waste_percentage DECIMAL(5,2) DEFAULT 0            ← DEPRECATED by spec
created_at       TIMESTAMP
updated_at       TIMESTAMP
```

**Note:** No `deleted_at` — line deletion cascades from BOM deletion.

**Current Usage:** Used by the Manufacturing BOM module. No active manufacturing execution references these yet.

**Reuse Score:** 3 / 5

**Problems:**
1. `raw_material_id` naming implies a raw material — contradicts the Unified Product Model. Semantically should be `input_product_id`.
2. `waste_percentage` is explicitly unsupported per spec (§RECIPE-ENGINE-SPEC §3). Must be deprecated.
3. No `sort_order` column — display ordering of components is undefined.
4. No `unit_id` snapshot — unit is inherited from the component product but not stored. If the product's unit changes, the BOM line silently uses the new unit. This is a data integrity risk.

**Extension Possibilities:**
- Add `unit_id_snapshot UUID NULL FK→units` (snapshot at BOM-save time — read-only reference for display)
- Add `sort_order SMALLINT DEFAULT 0`
- `waste_percentage`: set to 0 by default, document as deprecated, never read by new code

**Column Rename Strategy:**
- Cannot safely rename `raw_material_id` without breaking existing queries.
- Plan: Add `input_product_id UUID NULL` as a migration-step column.
- Populate from `raw_material_id`.
- Old column kept for backward compat and eventually removed (Phase 3).
- New code always uses `input_product_id`.

**Deprecation Possibility:** `waste_percentage` column — deprecated (not removed in Phase 1).

**Dependencies:** `bills_of_materials`

---

### A-06 · `inventory_items`

**Purpose:** Per-warehouse per-product inventory record. Tracks current on-hand and reserved quantities.

**Exact Schema:**
```
id           UUID PK
warehouse_id UUID FK→warehouses RESTRICT INDEX
product_id   UUID FK→products RESTRICT INDEX
company_id   UUID FK→companies RESTRICT INDEX
on_hand_qty  DECIMAL(15,4) DEFAULT 0
reserved_qty DECIMAL(15,4) DEFAULT 0
created_at   TIMESTAMP
updated_at   TIMESTAMP
deleted_at   TIMESTAMP NULL SOFT DELETE

UNIQUE (warehouse_id, product_id)
```

**Current Usage:** All inventory operations read/write this. Manufacturing will decrement on_hand_qty for raw materials and increment for finished goods.

**Reuse Score:** 5 / 5

**Problems:**
- `on_hand_qty` can theoretically go negative but there is no enforcement or flag. The `allow_negative_stock` flag on the product (to be added) will govern this at the application layer.

**Extension Possibilities:** None required in Phase 1.

**Deprecation Possibility:** None.

**Dependencies:** `stock_ledger_entries`, `inventory_layer_consumptions`

---

### A-07 · `stock_ledger_entries`

**Purpose:** Immutable, append-only audit log of every inventory quantity change. The authoritative record of what happened to stock.

**Exact Schema:**
```
id                  UUID PK
inventory_item_id   UUID FK→inventory_items RESTRICT INDEX
warehouse_id        UUID FK→warehouses RESTRICT INDEX
product_id          UUID FK→products RESTRICT INDEX
company_id          UUID FK→companies RESTRICT INDEX
movement_type       VARCHAR INDEX                    ← LedgerMovementType enum (string)
quantity            DECIMAL(15,4)
on_hand_before      DECIMAL(15,4)
on_hand_after       DECIMAL(15,4)
reserved_before     DECIMAL(15,4)
reserved_after      DECIMAL(15,4)
reference_type      VARCHAR NULL                     ← polymorphic
reference_id        UUID NULL                        ← polymorphic
notes               TEXT NULL
created_at          TIMESTAMP INDEX (useCurrent, immutable)
                                                     ← NO updated_at (immutable)
```

**Current LedgerMovementType Values:**
`purchase_receipt`, `sales_issue`, `reservation`, `reservation_release`, `adjustment_in`, `adjustment_out`, `transfer_in`, `transfer_out`, `direct_issue`, `production_consumption`, `production_output`

**Current Usage:** Every inventory operation writes to this. It is the core audit trail.

**Reuse Score:** 4 / 5

**Problems:**
- Missing movement types for disassembly: `disassembly_consumption`, `disassembly_output`.
- `production_consumption` and `production_output` already exist — these will be reused for manufacturing.
- The `reference_type` / `reference_id` polymorphic pattern is acceptable but limits FK integrity. For manufacturing, `reference_type = 'manufacturing_transaction'` and `reference_id = manufacturing_transaction.id`.

**Extension Possibilities:**
- Add to LedgerMovementType enum (application-level string enum):
  - `disassembly_consumption` (finished product consumed during disassembly)
  - `disassembly_output` (raw material added back from disassembly)

**Deprecation Possibility:** None. This is the core ledger.

**Dependencies:** `inventory_items`

---

### A-08 · `stock_movements`

**Purpose:** A secondary movement log used for reporting and reconciliation (separate from `stock_ledger_entries`).

**Exact Schema:**
```
id             UUID PK
warehouse_id   UUID FK→warehouses RESTRICT INDEX
product_id     UUID FK→products RESTRICT INDEX
movement_type  VARCHAR INDEX                          ← MovementType (6 values only)
quantity       DECIMAL(15,4)
balance_before DECIMAL(15,4)
balance_after  DECIMAL(15,4)
reference_type VARCHAR NULL (composite index with reference_id)
reference_id   UUID NULL (composite index with reference_type)
movement_date  DATE INDEX
notes          TEXT NULL
created_at     TIMESTAMP
updated_at     TIMESTAMP
```

**MovementType (6 values):** `purchase_receipt`, `sales_issue`, `adjustment_in`, `adjustment_out`, `transfer_in`, `transfer_out`

**Current Usage:** Appears to be a simpler reporting table alongside `stock_ledger_entries`. Fewer movement types — does not track reservations.

**Reuse Score:** 3 / 5

**Problems:**
- Relationship to `stock_ledger_entries` is unclear — both track movements but with different schemas and type sets.
- Does not track `reservation` or manufacturing movements.
- May cause confusion if new manufacturing entries go to `stock_ledger_entries` but not `stock_movements`.

**Extension Possibilities:**
- If this table is actively used for reporting, extend the MovementType enum to include manufacturing types.
- If it duplicates `stock_ledger_entries`, consider deprecating it.

**Deprecation Possibility:** Medium — if `stock_ledger_entries` is the authoritative ledger, `stock_movements` may be a legacy table. Requires code audit to determine active usage before any action.

**Dependencies:** Used by reporting queries.

---

### A-09 · `inventory_receipt_layers`

**Purpose:** FIFO inventory layers. Each receipt creates a layer with its unit cost. Consumption depletes oldest layers first.

**Exact Schema:**
```
id                    UUID PK
supplier_id           UUID NULL FK→suppliers CASCADE INDEX
product_id            UUID FK→products CASCADE INDEX
goods_receipt_id      UUID NULL FK→goods_receipts CASCADE
goods_receipt_line_id UUID NULL FK→goods_receipt_lines CASCADE
warehouse_id          UUID FK→warehouses CASCADE INDEX
received_qty          DECIMAL(15,4)
remaining_qty         DECIMAL(15,4)
landed_unit_cost      DECIMAL(15,4) DEFAULT 0
sale_price_snapshot   DECIMAL(15,2) NULL
receipt_date          DATE
created_at            TIMESTAMP
updated_at            TIMESTAMP

Indexes: (supplier_id, product_id), (supplier_id, remaining_qty)
```

**Current Usage:** FIFO engine. Every goods receipt creates layers. Sales consume them.

**Reuse Score:** 4 / 5

**Problems:**
- `supplier_id` and `goods_receipt_id` are nullable — this is actually good for us. Manufacturing output will have NULL for both.
- No `source_type` field — cannot distinguish whether a layer came from a purchase receipt, manufacturing, or disassembly recovery just by looking at the table.
- No `manufacturing_transaction_id` — no FK link to the manufacturing run that produced a finished-goods layer.

**Extension Possibilities:**
- Add `source_type VARCHAR(30) NOT NULL DEFAULT 'purchase'` — values: `'purchase'`, `'manufacturing'`, `'disassembly_recovery'`, `'adjustment'`
- Add `manufacturing_transaction_id UUID NULL FK→manufacturing_transactions` — links manufacturing output layers to their source run

**Deprecation Possibility:** None. Core FIFO infrastructure.

**Dependencies:** `inventory_layer_consumptions`, `goods_receipts`

---

### A-10 · `inventory_layer_consumptions`

**Purpose:** Immutable record of FIFO layer consumption. Tracks which receipt layer was consumed, how much, and at what cost.

**Exact Schema:**
```
id                          UUID PK
order_id                    UUID NULL INDEX             ← sales traceability
order_line_id               UUID NULL INDEX             ← sales traceability
inventory_item_id           UUID FK→inventory_items CASCADE INDEX
inventory_receipt_layer_id  UUID FK→inventory_receipt_layers CASCADE INDEX
product_id                  UUID FK→products CASCADE INDEX
warehouse_id                UUID FK→warehouses CASCADE INDEX
company_id                  UUID FK→companies CASCADE INDEX
quantity                    DECIMAL(15,4)
unit_cost                   DECIMAL(15,4)
total_cost                  DECIMAL(15,4)
created_at                  TIMESTAMP (useCurrent, immutable)
                                                         ← NO updated_at (immutable)
```

**Current Usage:** Records every FIFO consumption for sales. Powers COGS calculation on orders.

**Reuse Score:** 4 / 5

**Problems:**
- `order_id` and `order_line_id` are named for sales context only. Manufacturing and disassembly consumption have no reference columns.
- No `consumption_type` to distinguish sales vs. manufacturing vs. disassembly consumption.

**Extension Possibilities:**
- Add `consumption_type VARCHAR(30) NOT NULL DEFAULT 'sales'` — values: `'sales'`, `'manufacturing'`, `'disassembly'`
- Add `manufacturing_transaction_id UUID NULL` (no FK enforced — polymorphic reference)
- Add `disassembly_transaction_id UUID NULL` (no FK enforced — polymorphic reference)

**Deprecation Possibility:** None. Core FIFO audit trail.

**Dependencies:** `inventory_receipt_layers`, `inventory_items`

---

### A-11 · `stock_balances`

**Purpose:** Denormalized current stock balance per warehouse/product. Used for fast balance lookups.

**Exact Schema:**
```
id           UUID PK
warehouse_id UUID FK→warehouses RESTRICT
product_id   UUID FK→products RESTRICT INDEX
quantity     DECIMAL(15,4) DEFAULT 0
created_at   TIMESTAMP
updated_at   TIMESTAMP

UNIQUE (warehouse_id, product_id)
```

**Current Usage:** Quick stock-level queries without joining through ledger entries.

**Reuse Score:** 5 / 5

**Problems:** None. Manufacturing will update this just like any other inventory movement.

**Extension Possibilities:** None required.

**Deprecation Possibility:** None.

**Dependencies:** None specific to manufacturing.

---

### A-12 · `orders`

**Purpose:** Sales order record. Drives the entire order lifecycle.

**Key Manufacturing-Relevant Columns:**
```
id                        UUID PK
status                    VARCHAR DEFAULT 'pending' INDEX    ← 'pending'|'processing'|'completed'|'cancelled'
assigned_warehouse_id     UUID NULL FK→warehouses
inventory_reserved_at     TIMESTAMP NULL
inventory_shipped_at      TIMESTAMP NULL
inventory_released_at     TIMESTAMP NULL
```

**Current Usage:** All commerce operations. Inventory reservation/ship/release hooks already implemented.

**Reuse Score:** 4 / 5

**Problems:**
1. `status` enum lacks `preparing` — the manufacturing trigger status does not exist.
2. No `inventory_manufacturing_at` timestamp to record when manufacturing completed.
3. The status string is not database-constrained (CHECK constraint absent) — just application-level validation.

**Extension Possibilities:**
- Add `'preparing'` to the OrderStatus enum (application-level)
- Add `inventory_manufacturing_at TIMESTAMP NULL` column

**Deprecation Possibility:** None.

**Dependencies:** `order_lines`, `inventory_layer_consumptions`, `manufacturing_transactions` (new)

---

### A-13 · `order_lines`

**Purpose:** Individual product lines within an order.

**Exact Schema:**
```
id         UUID PK
order_id   UUID FK→orders CASCADE INDEX
product_id UUID FK→products RESTRICT
quantity   DECIMAL(12,4)
unit_price DECIMAL(12,2)
line_total DECIMAL(12,2)
created_at TIMESTAMP
updated_at TIMESTAMP
```

**Reuse Score:** 5 / 5

**Problems:** None. Manufacturing transactions will reference `order_line_id`.

**Extension Possibilities:** None required.

---

### A-14 · `purchase_orders`

**Purpose:** Purchase order header for supplier procurement.

**Reuse Score:** 5 / 5

**Problems:** None relevant to manufacturing.

**Extension Possibilities:** None required for Phase 1. Purchase Requests (new table) will FK to `purchase_orders` when converted.

---

### A-15 · `purchase_order_lines`

**Purpose:** Line items within purchase orders.

**Reuse Score:** 5 / 5

**Problems:** None relevant to manufacturing.

---

### A-16 · `goods_receipts`

**Purpose:** Goods receipt header. Records supplier delivery against a purchase order.

**Reuse Score:** 5 / 5

**Problems:** None relevant to manufacturing.

**Key Column for Decision Engine:** `status` (`'draft'` → `'posted'`). The `'posted'` status triggers the Decision Engine event `GOODS_RECEIPT_POSTED`.

---

### A-17 · `goods_receipt_lines`

**Purpose:** Individual received line items within a goods receipt.

**Reuse Score:** 5 / 5

**Key Column:** `landed_unit_cost DECIMAL(15,4)` — this is the cost used to update product `current_cost` for `cost_source = 'purchase_invoice'`.

---

## Phase B — Gap Analysis

### B-01 Summary Table

| Entity | Status | Action |
|--------|--------|--------|
| `products` — behavioral flags | MISSING | Add columns |
| `products` — cost_source, current_cost | MISSING | Add columns |
| `bills_of_materials` — integer version | MISSING | Add version_number column |
| `bill_of_material_lines` — input_product_id | MISNAMED | Add alias column |
| `bill_of_material_lines` — waste_percentage | DEPRECATED | Keep, never read in new code |
| `orders` — `preparing` status | MISSING | Add to enum |
| `orders` — manufacturing timestamp | MISSING | Add column |
| `stock_ledger_entries` — disassembly types | MISSING | Add enum values |
| `inventory_receipt_layers` — source_type | MISSING | Add column |
| `inventory_receipt_layers` — mfg FK | MISSING | Add column (after mfg_transactions created) |
| `inventory_layer_consumptions` — consumption_type | MISSING | Add column |
| `inventory_layer_consumptions` — mfg/dis FKs | MISSING | Add columns |
| `decision_logs` | DOES NOT EXIST | Create new table |
| `product_cost_histories` | DOES NOT EXIST | Create new table |
| `manufacturing_transactions` | DOES NOT EXIST | Create new table |
| `manufacturing_consumptions` | DOES NOT EXIST | Create new table |
| `disassembly_transactions` | DOES NOT EXIST | Create new table |
| `disassembly_recoveries` | DOES NOT EXIST | Create new table |
| `procurement_queue_entries` | DOES NOT EXIST | Create new table |
| `procurement_schedules` | DOES NOT EXIST | Create new table |
| `scheduler_runs` | DOES NOT EXIST | Create new table |
| `purchase_requests` | DOES NOT EXIST | Create new table |

---

### B-02 Existing Entities (Ready to Use)

| Table | Reusable? | Notes |
|-------|----------|-------|
| `units` | ✓ As-Is | Perfect fit |
| `suppliers` | ✓ As-Is | Perfect fit |
| `inventory_items` | ✓ As-Is | No changes needed |
| `stock_balances` | ✓ As-Is | No changes needed |
| `purchase_orders` | ✓ As-Is | No changes needed |
| `purchase_order_lines` | ✓ As-Is | No changes needed |
| `goods_receipts` | ✓ As-Is | No changes needed |
| `goods_receipt_lines` | ✓ As-Is | `landed_unit_cost` is what we need |
| `order_lines` | ✓ As-Is | Referenced by mfg transactions |

---

### B-03 Deprecated / Conflicting

| Column | Table | Status | Action |
|--------|-------|--------|--------|
| `waste_percentage` | `bill_of_material_lines` | DEPRECATED | Keep column. Set default 0. New code never reads it. |
| `product_type` | `products` | CLASSIFICATION ONLY | Keep column. Remove any business-logic use from new code. |
| `last_purchase_cost` | `products` | SUPERSEDED | Keep for backward compat. `current_cost` is authoritative for new code. |
| `average_cost` | `products` | SUPERSEDED | Keep for backward compat. |
| `current_fifo_cost` | `products` | SUPERSEDED | Keep for backward compat. Used by existing FIFO engine — do not remove. |

---

### B-04 Migration Risks

| Risk | Severity | Description |
|------|---------|-------------|
| `bills_of_materials.version` is VARCHAR | HIGH | String versions cannot be compared numerically. All snapshot references in new tables use integer version numbers. |
| Multiple active BOMs per product | HIGH | No DB constraint prevents this. Must add partial unique index before manufacturing goes live. |
| `inventory_layer_consumptions.order_id` semantics | MEDIUM | New manufacturing/disassembly rows will have NULL order_id. Any query that assumes `order_id IS NOT NULL` for all rows will fail. |
| `stock_movements` vs `stock_ledger_entries` | MEDIUM | Two tables tracking movements. New manufacturing entries must be written to both or the gap documented. |
| Renaming `raw_material_id` | LOW | Cannot safely rename in-place. Two-step column migration required. |
| `products.product_type` used in business logic | MEDIUM | Must audit all existing code that branches on `product_type` and remove/refactor those conditions. |

---

### B-05 Extension Opportunities Summary

The following extensions add zero risk to existing code:
1. All new columns added as `NULL` or with safe defaults
2. New enum values are additive (string-based enums in PHP)
3. New tables have no dependencies from existing tables
4. `inventory_receipt_layers` and `inventory_layer_consumptions` extensions use nullable new columns

These extensions are **fully backward compatible** — no existing query breaks.
