# Database Naming Conventions

**Document:** DATABASE-NAMING-CONVENTIONS  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-DATABASE-ENGINEERING-001  
**Parent:** DATABASE-ENGINEERING-STANDARDS.md

---

## 1. General Rules

| Rule | Requirement |
|---|---|
| **Case** | All database objects use `snake_case`; never camelCase or PascalCase |
| **Language** | English only; no Arabic or transliterated Arabic in database names |
| **Abbreviations** | Avoid unless the abbreviation is universally understood (e.g. `id`, `qty`, `amt`, `ref`) |
| **Length** | Max 63 characters (PostgreSQL limit); aim for < 40 characters |
| **Plurals** | Table names are plural nouns (`products`, `orders`, `receipt_layers`) |
| **No reserved words** | Never use SQL reserved words as column names (`order`, `limit`, `group`, `type`) |

---

## 2. Table Names

| Pattern | Rule | Examples |
|---|---|---|
| Entity tables | `{plural_noun}` | `products`, `orders`, `raw_materials`, `receipt_layers` |
| Join tables | `{entity1}_{entity2}` (alphabetical) | `campaign_customers`, `shipping_wave_orders` |
| Projection tables | `{name}_projection` (in `projections` schema) | `projections.inventory_availability_projection` |
| Archive tables | Same name in `archive` schema | `archive.orders`, `archive.invoices` |
| Sequences table | `sequences` | (singleton table) |
| Partition child | `{parent_table}_{year}_{month}` | `stock_movements_2026_07` |

### Domain-Specific Prefixes
Tables do NOT use module prefixes (no `inventory_products`). Tables are organized by PostgreSQL schema:

```
public schema:     All operational tables (default)
projections schema: CQRS read models and reporting projections
archive schema:    Archived data
```

---

## 3. Column Names

### Standard Column Names (Mandatory — same name across all tables)

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key; always first column |
| `company_id` | UUID | Tenant isolation; always second column |
| `created_at` | TIMESTAMP | System-set at INSERT |
| `created_by` | UUID | Actor who created |
| `updated_at` | TIMESTAMP | System-set at UPDATE |
| `updated_by` | UUID | Actor who last updated |
| `deleted_at` | TIMESTAMP NULL | Soft delete timestamp |
| `deleted_by` | UUID NULL | Actor who soft-deleted |
| `status` | VARCHAR or ENUM | Entity status |

### Business Column Names

| Pattern | Convention | Examples |
|---|---|---|
| Name fields | `name`, `name_ar` (bilingual) | `name`, `name_ar` |
| Code / identifier fields | `{entity}_code` | `warehouse_code`, `sku`, `material_code` |
| Reference to another entity | `{entity}_id` | `category_id`, `supplier_id`, `warehouse_id` |
| Amount fields | `{context}_amount` | `total_amount`, `unit_price`, `opening_float` |
| Quantity fields | `{context}_qty` or `{context}_quantity` | `reserved_qty`, `received_quantity` |
| Rate/percentage fields | `{context}_rate` or `{context}_pct` | `tax_rate`, `discount_pct`, `waste_pct` |
| Boolean fields | `is_{state}` or `{action}able` | `is_available`, `eligible_for_pos` |
| Date fields | `{event}_date` | `due_date`, `issue_date` |
| Datetime fields | `{event}_at` | `confirmed_at`, `dispatched_at`, `occurred_at` |
| External identifiers | `external_reference`, `external_source`, `bosta_reference` | Per integration |
| JSON / settings | `{name}_jsonb` or `settings`, `config`, `payload` | `address_jsonb`, `settings`, `payload` |
| Snapshot fields | `{field}_snapshot` | `product_name_snapshot`, `unit_price_snapshot` |
| Polymorphic type | `{context}_type` | `entity_type`, `object_type`, `source_type` |
| Currency | `currency_code` | Always alongside amount fields |

---

## 4. Index Names

Format: `idx_{table}_{column(s)}`

| Type | Pattern | Example |
|---|---|---|
| Single column | `idx_{table}_{column}` | `idx_orders_company_id` |
| Composite | `idx_{table}_{col1}_{col2}` | `idx_orders_company_id_status` |
| Partial | `idx_{table}_{column}_active` | `idx_orders_status_active` |
| GIN (JSONB) | `idx_{table}_{column}_gin` | `idx_products_settings_gin` |
| Full-text | `idx_{table}_{column}_fts` | `idx_products_name_fts` |

---

## 5. Constraint Names

| Type | Pattern | Example |
|---|---|---|
| Primary Key | `pk_{table}` | `pk_products` (auto-named by PostgreSQL if not specified) |
| Unique | `uq_{table}_{column(s)}` | `uq_products_company_id_sku` |
| Foreign Key | `fk_{table}_{column}` | `fk_order_lines_order_id` |
| Check | `chk_{table}_{description}` | `chk_products_cost_positive` |
| Not Null | Not named (inline) | — |

---

## 6. Enum Type Names

PostgreSQL custom ENUM types follow this convention:
```
{module}_{attribute}_type
```
Examples: `order_status_type`, `stock_movement_direction_type`

**Preferred alternative:** Use `VARCHAR` with `CHECK` constraint rather than PostgreSQL ENUM types. This allows adding new values without `ALTER TYPE` (which requires a table lock in older PostgreSQL versions).

**ECOS standard:** Use `VARCHAR` with CHECK constraints for all status/type columns.

---

## 7. Schema Names

| Schema | Purpose |
|---|---|
| `public` | All operational tables |
| `projections` | CQRS read models and reporting projections |
| `archive` | Archived historical data |

No other schemas are created without Engineering Lead approval.
