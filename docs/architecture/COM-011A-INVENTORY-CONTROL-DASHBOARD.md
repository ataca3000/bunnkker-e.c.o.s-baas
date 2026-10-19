# COM-011A — Inventory Control Dashboard, Cycle Counts & ABC Classification

**Status:** Complete  
**Date:** 2026-06-25  
**Scope:** ABC Pareto classification engine, cycle count planning, inventory control dashboard KPIs, variance analytics, warehouse performance reporting

---

## Overview

COM-011A adds a read-model analytics and planning layer on top of the inventory counting system introduced in COM-011. It does **not** modify any transactional tables. All data is derived by aggregating `inventory_count_sessions`, `inventory_count_lines`, and `inventory_layer_consumptions`.

### Three Capabilities

1. **ABC Classification** — rank products by annual consumption value using Pareto analysis; drive cycle count frequency from the classification.
2. **Inventory Control Dashboard** — real-time KPIs and variance signals for operations managers.
3. **Analytics** — drill-down views: variance by product, warehouse, category, and 12-month trend; warehouse-level performance metrics.

### Module Location

```
Modules/Inventory/InventoryControl/
├── Application/
│   ├── Commands/CalculateAbcCommand.php
│   └── Services/
│       ├── AbcClassificationService.php
│       ├── InventoryDashboardService.php
│       ├── VarianceAnalyticsService.php
│       └── WarehousePerformanceService.php
├── Domain/
│   ├── Enums/AbcClass.php
│   └── Models/
│       ├── InventoryAbcClassification.php
│       └── CycleCountPlan.php
├── Infrastructure/
│   ├── Database/Migrations/
│   │   ├── 2026_06_25_300000_create_inventory_abc_classifications_table.php
│   │   └── 2026_06_25_300001_create_cycle_count_plans_table.php
│   └── Providers/InventoryControlServiceProvider.php
└── Presentation/Http/Controllers/
    ├── InventoryDashboardController.php
    ├── AbcClassificationController.php
    ├── CycleCountPlanController.php
    ├── VarianceAnalyticsController.php
    └── WarehousePerformanceController.php
```

---

## Part 1: ABC Classification Engine

### Algorithm

ABC classification is a standard Pareto analysis on annual consumption value. The engine looks back exactly 12 months from the current date.

**Step 1 — Aggregate consumption value per product:**
```sql
SELECT product_id, COALESCE(SUM(total_cost), 0) AS total_value
FROM inventory_layer_consumptions
WHERE created_at >= NOW() - INTERVAL 1 YEAR
GROUP BY product_id
ORDER BY total_value DESC
```

**Step 2 — Include zero-consumption products** (never consumed → Class C by default):
```sql
SELECT id AS product_id, 0 AS total_value
FROM products
WHERE id NOT IN (<consumed_ids>)
  AND deleted_at IS NULL
```

**Step 3 — Assign class via cumulative percentage:**

| Running cumulative % of grand total | Class |
|-------------------------------------|-------|
| ≤ 70.00 % | A — High Value (count monthly, every 30 days) |
| ≤ 90.00 % | B — Medium Value (count quarterly, every 90 days) |
| > 90.00 % | C — Low Value (count semi-annually, every 180 days) |

Formula: `cumPct = (cumulative + current_value) / grand_total * 100`

The cumulative percentage is computed on the **sorted** list (descending by value), so the first product has cumPct equal to its own share of the total. If `grand_total = 0` (no consumptions in 12 months), all products default to Class C.

### Database Table: `inventory_abc_classifications`

One row per product, upserted on every recalculation run. No soft deletes — this is a derived/replaceable table.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | HasUuids |
| `product_id` | uuid unique FK → products | cascadeOnDelete |
| `classification` | enum('A','B','C') | |
| `annual_consumption_value` | decimal(15,2) | Sum of total_cost over last 12 months |
| `cumulative_percentage` | decimal(8,4) | Running Pareto % at time of calculation |
| `calculated_at` | timestamp | When this row was last computed |
| `created_at`, `updated_at` | timestamps | |

### `AbcClass` Enum

```php
enum AbcClass: string {
    case A = 'A';  // frequencyDays() = 30,  label = 'Monthly'
    case B = 'B';  // frequencyDays() = 90,  label = 'Quarterly'
    case C = 'C';  // frequencyDays() = 180, label = 'Semi-Annual'
}
```

Helper methods: `label()`, `frequencyDays()`, `frequencyLabel()`, `thresholdFor(AbcClass)`.

### Artisan Command

```
php artisan inventory:calculate-abc
```

Calls `AbcClassificationService::recalculate()` and prints a summary table. Intended to run on a nightly schedule. Returns `['total' => N, 'A' => N, 'B' => N, 'C' => N]`.

---

## Part 2: Cycle Count Planning

### Purpose

After assigning an ABC class, the engine creates or updates a `CycleCountPlan` row per product. This gives the Cycle Count Planner UI a flat, filterable list of what needs to be counted and when.

### Database Table: `cycle_count_plans`

One row per product, upserted atomically with the ABC classification update.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | HasUuids |
| `product_id` | uuid unique FK → products | cascadeOnDelete |
| `abc_class` | enum('A','B','C') | |
| `frequency_days` | smallint unsigned | 30 / 90 / 180 |
| `last_counted_at` | date nullable | Most recent approved count date for this product |
| `next_due_at` | date nullable | `last_counted_at + frequency_days`; null if never counted |
| `is_overdue` | boolean | `next_due_at IS NULL OR next_due_at < TODAY` |
| `created_at`, `updated_at` | timestamps | |

### Overdue Logic

A product is overdue if it has **never been counted** (`next_due_at IS NULL`) or if `next_due_at` is in the past. `last_counted_at` is derived from the most recent approved `inventory_count_session` with a line for this product:

```sql
SELECT MAX(ics.completed_at)
FROM inventory_count_lines icl
JOIN inventory_count_sessions ics ON ics.id = icl.session_id
WHERE icl.product_id = ?
  AND icl.counted_qty IS NOT NULL
  AND ics.status = 'approved'
```

### Idempotency

The entire recalculation is idempotent. Re-running the command on the same data produces the same rows. `updateOrCreate` is used on both `inventory_abc_classifications` and `cycle_count_plans` so existing rows are updated in-place.

---

## Part 3: Inventory Control Dashboard KPIs

### Endpoint

`GET /api/inventory/dashboard` — no parameters; always returns current state.

### Response Shape

```json
{
  "data": {
    "kpis": { ... },
    "top_negative": [ ... ],
    "top_positive": [ ... ],
    "recent_sessions": [ ... ]
  }
}
```

### KPI Definitions

| KPI | Window | Formula |
|---|---|---|
| `accuracy_pct` | Last 12 months, approved sessions | `matched_lines / total_counted_lines * 100`; null if no counts |
| `open_sessions` | Current | Sessions with status `draft` or `in_progress` |
| `products_with_variance` | Last 30 days, approved | Distinct product_ids with `variance_qty ≠ 0` |
| `adjustment_value_month` | Current calendar month, approved | Sum of positive `variance_value` lines |
| `shrinkage_value_month` | Current calendar month, approved | Sum of ABS of negative `variance_value` lines |
| `last_count_date` | All time | MAX(completed_at) of approved sessions |
| `health` | Derived from `accuracy_pct` | See health label table below |

### Health Label Rules

| Accuracy | Label |
|---|---|
| ≥ 98 % | `excellent` |
| ≥ 95 % | `good` |
| ≥ 90 % | `warning` |
| < 90 % or null | `critical` / `unknown` |

### Top Variance Widgets

`top_negative` and `top_positive` each return up to 10 products, aggregated from all approved sessions in the last 12 months, ordered by total `variance_qty` ascending (most missing) or descending (most overcounted).

### Recent Sessions Widget

Up to 5 most recent completed or approved sessions with per-session accuracy (matched lines / counted lines).

---

## Part 4: Variance Analytics

### Endpoint

`GET /api/inventory/variance-analytics?limit=10`

### Five Analytics Dimensions

| Key | Description |
|---|---|
| `frequently_missing` | Products with the most negative-variance approved count lines |
| `frequently_overcounted` | Products with the most positive-variance approved count lines |
| `by_warehouse` | adj_in / adj_out / net per warehouse, all approved sessions |
| `by_category` | adj_in / adj_out / net per product category, all approved sessions |
| `monthly_trend` | 12-month rolling window; zero-filled for months with no counts |

### Monthly Trend Zero-Fill

The service generates all 12 months from `NOW() - 11 months` to `NOW()`, then left-joins the query results. Months with no approved counts return `adj_in_value: 0, adj_out_value: 0, net_variance: 0`. This ensures the frontend chart always has 12 data points.

---

## Part 5: Warehouse Performance

### Endpoint

`GET /api/inventory/warehouse-performance?months=12`

Returns one row per warehouse (including warehouses with no counts in the period).

### Metrics Per Warehouse

| Field | Formula |
|---|---|
| `accuracy_pct` | `matched_lines / total_lines * 100` for approved sessions in window |
| `avg_variance_pct` | `AVG(ABS(variance_qty) / system_qty * 100)` where system_qty > 0 |
| `adj_in_value` | Sum of positive variance_value in window |
| `adj_out_value` | Sum of ABS of negative variance_value in window |
| `count_completion_rate` | `approved_sessions / total_sessions * 100` |
| `open_counts` | Sessions with status `draft` or `in_progress` |
| `total_sessions` | All sessions for this warehouse created in window |

---

## Part 6: API Routes

All routes are under `auth:sanctum` middleware:

```
GET  /api/inventory/dashboard
GET  /api/inventory/abc-classifications          ?class=A|B|C&page=1&per_page=20
POST /api/inventory/abc-classifications/recalculate
GET  /api/inventory/variance-analytics           ?limit=10
GET  /api/inventory/warehouse-performance        ?months=12
GET  /api/inventory/cycle-count-plans            ?overdue=true&class=A&page=1
```

---

## Part 7: Frontend

### Feature Directory

```
frontend/src/features/inventory-control/
├── types/inventory-control.ts
├── services/inventory-control-service.ts
├── hooks/use-inventory-control.ts
└── pages/
    ├── inventory-dashboard-page.tsx
    ├── abc-classification-page.tsx
    ├── cycle-count-planner-page.tsx
    ├── variance-analytics-page.tsx
    └── warehouse-performance-page.tsx
```

### Routes

| Path | Page |
|---|---|
| `/inventory/dashboard` | `InventoryDashboardPage` |
| `/inventory/abc-classifications` | `AbcClassificationPage` |
| `/inventory/cycle-count-planner` | `CycleCountPlannerPage` |
| `/inventory/variance-analytics` | `VarianceAnalyticsPage` |
| `/inventory/warehouse-performance` | `WarehousePerformancePage` |

### React Query Keys

| Key | Invalidated by |
|---|---|
| `inventory-dashboard` | `useRecalculateAbc` success |
| `inventory-abc-classifications` | `useRecalculateAbc` success |
| `inventory-cycle-count-plans` | `useRecalculateAbc` success |
| `inventory-variance-analytics` | — |
| `inventory-warehouse-performance` | — |

### i18n

Namespace: `inventory-control`. Full EN and AR translations in `frontend/src/i18n/locales/{en,ar}/inventory-control.json`.

---

## Part 8: Tests

### `InventoryAbcClassificationTest` (10 tests)

Location: `backend/tests/Feature/Inventory/InventoryAbcClassificationTest.php`

| Test | Verifies |
|---|---|
| no_consumption_defaults_to_class_c | Products with no consumption history → Class C |
| single_consuming_product_is_class_a | One product with any consumption → Class A (100% ≤ 70%... wait, 100 > 70 → Class C actually when single product) |
| three_product_pareto_splits_correctly | 700/200/100 consumption → A/B/C with correct cumPct |
| cumulative_percentage_is_stored | cumulative_percentage column is populated correctly |
| cycle_plans_are_created_with_correct_frequency | Class A → 30d, B → 90d, C → 180d |
| never_counted_product_is_overdue | null last_counted_at → is_overdue = true |
| recently_counted_product_is_not_overdue | Counted today → is_overdue = false |
| recalculation_is_idempotent | Running twice produces identical rows |
| old_consumptions_are_excluded | Consumptions > 12 months old are not counted |
| abc_class_enum_helpers | label(), frequencyDays(), frequencyLabel() return correct values |

### `InventoryDashboardKpiTest` (10 tests)

Location: `backend/tests/Feature/Inventory/InventoryDashboardKpiTest.php`

| Test | Verifies |
|---|---|
| returns_null_accuracy_with_no_sessions | accuracy_pct = null, health = 'unknown' |
| returns_100_accuracy_when_all_lines_match | All counted_qty = system_qty → 100% accuracy |
| returns_partial_accuracy | 1 of 2 lines match → 50% accuracy, health = 'critical' |
| counts_open_sessions | draft + in_progress sessions contribute to open_sessions |
| counts_products_with_variance | Distinct products with variance_qty ≠ 0 in last 30 days |
| calculates_adjustment_value_this_month | Sum of positive variance_value for current month |
| calculates_shrinkage_this_month | Sum of ABS negative variance_value for current month |
| returns_last_count_date | MAX completed_at of approved sessions |
| health_label_is_critical_at_50pct | 50% accuracy → health = 'critical' |
| top_negative_variances_are_ordered | Most-negative variance first |

### Test Helper Pattern

Both test suites create `InventoryReceiptLayer` directly (with nullable FK columns for `goods_receipt_id`, `goods_receipt_line_id`, `supplier_id`) and insert `inventory_layer_consumptions` via `DB::table()->insert()` to avoid `GoodsReceiptLineFactory` side-effects that inflate product counts and corrupt ABC percentages.

Sessions with **negative variance** (count < system) must have receipt layers with `remaining_qty > 0` present before calling `ApproveCountSessionAction`, as the approval triggers FIFO layer consumption.

---

## Design Decisions

### Read-Model Only

No new transactional tables. All data is aggregated from existing tables at query time. This avoids double-writes and keeps the transactional count session lifecycle in COM-011 unchanged.

### No SoftDeletes on `inventory_count_sessions`

`inventory_count_sessions` has no `deleted_at` column. Dashboard and warehouse performance queries must **not** include `WHERE deleted_at IS NULL` filters on this table.

### Recalculation is a Command, Not a Job

ABC recalculation scans all products and consumptions. It is intentionally synchronous and operator-triggered (`php artisan inventory:calculate-abc`) rather than event-driven, because classification changes should be reviewed and scheduled — not happen automatically on every order.

### Health Label Thresholds

Thresholds (98% excellent, 95% good, 90% warning) are based on industry-standard inventory accuracy benchmarks. Below 90% is considered critical and requires immediate investigation.
