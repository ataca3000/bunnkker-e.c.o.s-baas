# Reporting Projection Model

**Document:** REPORTING-PROJECTION-MODEL  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-DATA-ARCH-001  
**Parent:** ENTERPRISE-LOGICAL-DATA-ARCHITECTURE.md

---

## 1. What Are Projections?

Projections are pre-computed, denormalized views of the domain data optimized for specific query patterns. They are populated by event listeners and are always disposable — they can be rebuilt from the event stream.

**Projections are NOT:**
- Source of truth (operational tables are authoritative)
- Used for financial calculations (operational tables for those)
- Permanently required — they can be rebuilt from events

---

## 2. Projection Logical Model

### PROJ-001: orders_summary_projection
```
Purpose:    Fast order list queries with all display columns pre-joined
Populated by: orders.order.* events
Owner:      Commerce

Logical columns:
  order_id, company_id, order_number, status
  customer_id, customer_name (snapshot), customer_phone (masked)
  channel_id, channel_name
  warehouse_id, warehouse_name
  total_amount, currency_code
  item_count (count of lines)
  created_at, confirmed_at, dispatched_at, delivered_at
  external_reference, external_source
  wave_id (if in preparation)
```

### PROJ-002: inventory_availability_projection
```
Purpose:    Real-time available stock per entity per warehouse
Populated by: inventory.*.stock_* events
Owner:      Inventory

Logical columns:
  entity_type, entity_id, company_id, warehouse_id
  on_hand_qty (sum of receipt_layers.remaining_qty)
  reserved_qty (sum of active reservations)
  available_qty (on_hand - reserved)
  reorder_point (from master data snapshot)
  stock_status: ENUM(in_stock, low, out_of_stock)
  last_movement_at
  last_receipt_at
  oldest_layer_cost (for FIFO UI display)
  updated_at
```

### PROJ-003: preparation_wave_projection
```
Purpose:    Wave list and dashboard KPI cards
Populated by: fulfillment.preparation_wave.* events
Owner:      Fulfillment

Logical columns:
  wave_id, company_id, warehouse_id
  status, wave_type
  order_count, item_count
  prepared_count (items completed)
  progress_pct (prepared/total * 100)
  started_at, completed_at
  avg_item_prep_minutes
  blocked_item_count
  created_at
```

### PROJ-004: vehicle_status_projection
```
Purpose:    Fleet status dashboard; Loading OS allocation planning
Populated by: logistics.vehicle.* events
Owner:      Logistics

Logical columns:
  vehicle_id, company_id
  status: ENUM(available, assigned, loading, in_transit, returning, under_maintenance)
  driver_id, driver_name (snapshot)
  current_wave_id (if assigned)
  current_shipment_id (if in_transit)
  loaded_weight_kg, capacity_weight_kg
  loaded_pct (loaded/capacity)
  estimated_return_at (if in_transit)
  last_updated_at
```

### PROJ-005: supplier_health_projection
```
Purpose:    Supplier workspace health scores and KPI display
Populated by: procurement.* events
Owner:      Procurement

Logical columns:
  supplier_id, company_id
  health_score (0-100 computed)
  on_time_delivery_rate (last 90 days)
  quality_rate (non-returned items / total received)
  return_rate (returned / received)
  open_po_count, overdue_po_count
  total_ytd_spend
  last_order_at
  last_receipt_at
  updated_at
```

### PROJ-006: customer_summary_projection
```
Purpose:    Customer 360 summary card in orders and CRM
Populated by: orders.order.delivered, finance.invoice.paid events
Owner:      CRM

Logical columns:
  customer_id, company_id
  total_orders, total_delivered, total_cancelled
  lifetime_value (sum of paid invoices)
  avg_order_value
  last_order_at, last_delivery_at
  risk_level: ENUM(low, medium, high)
  payment_reliability_score
  preferred_channel_id
  updated_at
```

### PROJ-007: finance_ar_projection
```
Purpose:    AR aging report, invoice dashboard
Populated by: finance.invoice.*, finance.*.payment_* events
Owner:      Finance

Logical columns:
  company_id
  total_outstanding, total_overdue
  aging_0_30, aging_31_60, aging_61_90, aging_90_plus (amounts)
  invoice_count_outstanding
  collected_this_month, collected_this_year
  updated_at
```

---

## 3. Projection Schema Design Rules

| Rule | Statement |
|---|---|
| **PROJ-001** | Projections are in a dedicated `projections` schema (separate from `public`) |
| **PROJ-002** | No FK constraints in projection tables — they are denormalized |
| **PROJ-003** | Every projection row includes `updated_at` to indicate when it was last refreshed |
| **PROJ-004** | Projection tables are truncatable and rebuildable without data loss |
| **PROJ-005** | No business logic in projection update logic — only data denormalization |
| **PROJ-006** | Projections may contain computed/aggregated values but must document the formula |

---

## 4. Projection Rebuild Runbook

When a projection is stale, corrupted, or newly created:

```
1. Mark projection as "rebuilding" (set a rebuilding_since timestamp)
2. Truncate the projection table
3. Replay all relevant events from business_events table
4. Each event is processed by the same listener that normally updates it
5. When complete: clear rebuilding_since; set last_full_rebuild_at = now
6. Duration estimate: ~1 million events per 5 minutes (depends on hardware)
```

API behavior during rebuild: return stale data with a `data_age_warning` header; never block requests.
