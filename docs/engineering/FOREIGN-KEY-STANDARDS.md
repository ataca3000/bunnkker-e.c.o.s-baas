# Foreign Key Standards

**Document:** FOREIGN-KEY-STANDARDS  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-DATABASE-ENGINEERING-001  
**Parent:** DATABASE-ENGINEERING-STANDARDS.md

---

## 1. FK Philosophy

Foreign keys enforce referential integrity at the database level. In a modular monolith with domain boundaries, they are only applied within domain boundaries. Cross-domain references use UUID columns without FK constraints — module independence is preserved at the database level.

---

## 2. When to Apply FK Constraints

| Scenario | Apply FK? | Reason |
|---|---|---|
| Child → Parent within same domain | ✅ Yes | Same module; DB enforces integrity |
| Lookup table reference (categories, units) within domain | ✅ Yes | Reference data within company scope |
| Cross-domain reference (order_id on invoices) | ❌ No | Cross-module coupling at DB level |
| Polymorphic reference (object_type + object_id) | ❌ No | Impossible with single FK |
| Entity with soft delete as target | ❌ No | FK would fail when target is soft-deleted |
| Partitioned table target | ❌ No | PostgreSQL FK to partitioned table requires special handling |
| High-write tables | ⚠️ Consider | FK checks add overhead on every write; use with caution |

---

## 3. FK Naming Convention

```
fk_{child_table}_{referenced_column}
```

Examples:
```
fk_order_lines_order_id         (order_lines.order_id → orders.id)
fk_wave_items_wave_id           (wave_items.wave_id → preparation_waves.id)
fk_receipt_layers_raw_material_id
fk_recipe_lines_recipe_id
```

---

## 4. Cascade Rules

| Action | Default | When to Override |
|---|---|---|
| `ON DELETE RESTRICT` | Default for all FKs | Prevents deleting a parent that has children |
| `ON DELETE CASCADE` | Only when child is meaningless without parent | e.g., order_lines cascade with order; but NEVER cascade for financial records |
| `ON DELETE SET NULL` | When child can exist without parent | e.g., products.category_id can be null if category is soft-deleted |
| `ON UPDATE CASCADE` | Never | IDs are UUID and never change |
| `ON UPDATE RESTRICT` | Default | IDs are immutable |

**ECOS cascade default:** `ON DELETE RESTRICT` on all FKs unless explicitly documented otherwise.

**Never cascade delete on:**
- Financial records (orders, invoices, payments)
- Inventory records (stock_movements, receipt_layers)
- Audit records (timeline_entries, business_events)

---

## 5. FK Registration Table

Every FK constraint is documented:

| FK Name | Child Table.Column | Parent Table.Column | Cascade | Notes |
|---|---|---|---|---|
| `fk_order_lines_order_id` | `order_lines.order_id` | `orders.id` | RESTRICT | Within Commerce |
| `fk_wave_items_wave_id` | `wave_items.wave_id` | `preparation_waves.id` | RESTRICT | Within Fulfillment |
| `fk_receipt_layers_raw_material_id` | `receipt_layers.raw_material_id` | `raw_materials.id` | RESTRICT | Within Inventory |
| `fk_reservations_raw_material_id` | `reservations.entity_id` | — | No FK | Polymorphic |
| `fk_invoice_lines_invoice_id` | `invoice_lines.invoice_id` | `invoices.id` | RESTRICT | Within Finance |
| `fk_payments_invoice_id` | `payments.invoice_id` | `invoices.id` | RESTRICT | Within Finance |
| `fk_po_lines_purchase_order_id` | `po_lines.purchase_order_id` | `purchase_orders.id` | RESTRICT | Within Procurement |
| `fk_gr_lines_goods_receipt_id` | `gr_lines.goods_receipt_id` | `goods_receipts.id` | RESTRICT | Within Procurement |
| `fk_recipe_lines_recipe_id` | `recipe_lines.recipe_id` | `recipes.id` | RESTRICT | Within Manufacturing |

---

## 6. Cross-Domain Reference Documentation

For every cross-domain UUID reference (no FK), document the relationship:

```
Table: invoices
Column: order_id UUID NULL
References: orders.id (Commerce domain)
FK Constraint: None (cross-domain)
Validation: Application validates order exists before creating invoice
Orphan detection: Periodic data quality job checks for orphaned invoice.order_ids
```
