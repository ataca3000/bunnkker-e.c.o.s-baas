# CR-PREP-001 — Database Design

## Overview

CR-PREP-001 introduces automatic warehouse assignment and daily preparation sessions. Six migrations extend the Preparation OS schema.

---

## New Tables

### `warehouse_assignment_policies`

Configuration table that maps (channel + governorate) combinations to a specific warehouse.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | HasUuids |
| company_id | UUID FK → companies | |
| channel_id | UUID FK → channels, nullable | null = applies to all channels |
| governorate | VARCHAR 100, nullable | null = applies to all governorates |
| zone | VARCHAR 100, nullable | reserved for future zone-level routing |
| warehouse_id | UUID FK → warehouses | destination warehouse |
| priority | SMALLINT DEFAULT 100 | lower number = higher priority (1–9999) |
| is_active | BOOLEAN DEFAULT true | |
| notes | TEXT, nullable | |
| created_by / updated_by | UUID nullable | |

**Matching Algorithm — Specificity Score:**

| Policy Type | channel_id | governorate | Score |
|-------------|-----------|-------------|-------|
| Specific | ✓ set | ✓ set | 3 |
| Channel-only | ✓ set | null | 2 |
| Governorate-only | null | ✓ set | 1 |
| Company fallback | null | null | 0 |

When multiple policies match at the same specificity level, `priority ASC` breaks the tie (lower number wins).

**Indexes:**
- `idx_wap_company_active_priority` — (company_id, is_active, priority)
- `idx_wap_lookup` — (company_id, channel_id, governorate)
- `idx_wap_warehouse_id` — (warehouse_id)

---

### `warehouse_assignment_overrides`

Immutable audit log. Every manual supervisor override creates one row — rows are never updated.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| order_id | UUID FK → orders | |
| previous_warehouse_id | UUID nullable | null if order was unassigned |
| new_warehouse_id | UUID FK → warehouses | |
| reason | TEXT | required |
| overridden_by | UUID FK → users | supervisor who triggered override |
| overridden_at | TIMESTAMPTZ | |

No soft deletes. No updated_at. Append-only by convention.

---

### `preparation_session_policies`

Per-company (or per-warehouse) configuration for automatic session creation.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| company_id | UUID FK → companies | |
| warehouse_id | UUID FK → warehouses, nullable | null = company-wide default |
| auto_create_time | TIME DEFAULT '06:00:00' | scheduler fires at this time |
| auto_close_time | TIME, nullable | null = manual close only |
| eligible_order_statuses | JSONB | e.g. ["confirm_order","in_progress"] |
| auto_attach_orders | BOOLEAN DEFAULT true | |
| auto_recalculate_demand | BOOLEAN DEFAULT true | |
| is_active | BOOLEAN DEFAULT true | |

**Unique Constraint:** `(company_id, warehouse_id)` — one policy per warehouse (or one company-wide).

**Lookup Priority:** Warehouse-specific policy takes precedence over company-wide policy.

---

### `preparation_session_orders`

Auto-managed junction between `preparation_sessions` and `orders`. Replaces manual wave order selection.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| preparation_session_id | UUID FK | |
| order_id | UUID FK | |
| order_number_snapshot | VARCHAR 50 | immutable at attach time |
| customer_name_snapshot | VARCHAR 255, nullable | |
| governorate_snapshot | VARCHAR 100, nullable | |
| area_snapshot | VARCHAR 100, nullable | |
| attachment_source | VARCHAR 30 DEFAULT 'auto' | auto \| manual_supervisor \| system_recovery |
| attached_at | TIMESTAMPTZ | |
| attached_by | UUID nullable | null for auto-attach |
| detached_at | TIMESTAMPTZ nullable | null = actively attached |
| detached_by | UUID nullable | |
| detachment_reason | TEXT nullable | |

**Unique Constraint:** `(order_id, preparation_session_id)` — prevents duplicate attachment.

**Active row:** `detached_at IS NULL`.

---

## Modified Tables

### `orders` (additive columns only)

| Column | Type | Notes |
|--------|------|-------|
| warehouse_assigned_at | TIMESTAMPTZ nullable | when assignment was last set |
| warehouse_assignment_source | VARCHAR 50 nullable | auto_policy \| manual_override \| channel_default \| unassigned |

No existing columns removed. No indexes changed.

### `preparation_sessions` (additive columns only)

| Column | Type | Notes |
|--------|------|-------|
| auto_created | BOOLEAN DEFAULT false | true when created by scheduler |
| policy_id | UUID nullable | FK → preparation_session_policies |
| orders_count | INTEGER DEFAULT 0 | denormalized; updated by DailyPreparationSessionManager |

---

## Referential Integrity

All new FKs are `ON DELETE RESTRICT` (default) except:
- `warehouse_assignment_overrides.order_id` — `ON DELETE CASCADE` (overrides deleted with order)
- `preparation_session_orders.preparation_session_id` — `ON DELETE CASCADE`
- `preparation_session_orders.order_id` — `ON DELETE CASCADE`

---

## Migration Order

```
2026_07_06_210001  create_warehouse_assignment_policies_table
2026_07_06_210002  create_warehouse_assignment_overrides_table
2026_07_06_210003  create_preparation_session_policies_table
2026_07_06_210004  create_preparation_session_orders_table
2026_07_06_210005  add_assignment_fields_to_orders_table
2026_07_06_210006  add_auto_fields_to_preparation_sessions_table
```
