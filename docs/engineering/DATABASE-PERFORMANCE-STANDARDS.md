# Database Performance Standards

**Document:** DATABASE-PERFORMANCE-STANDARDS  
**Version:** 1.0  
**Status:** APPROVED — Architecture Only  
**Date:** 2026-07-05  
**Task:** TASK-DATABASE-ENGINEERING-001  
**Parent:** DATABASE-ENGINEERING-STANDARDS.md

---

## 1. Performance Targets

| Query Type | Target | Maximum |
|---|---|---|
| Simple entity lookup by PK | < 5ms | 20ms |
| List query (paginated, filtered) | < 50ms | 200ms |
| Inventory availability (per entity) | < 50ms | 100ms |
| Batch inventory (100 items) | < 200ms | 500ms |
| Dashboard KPI (from projection) | < 100ms | 300ms |
| FIFO cost calculation (per receipt) | < 100ms | 300ms |
| Report query (pre-aggregated projection) | < 500ms | 2000ms |
| Full report (read replica, complex query) | < 5s | 30s |

---

## 2. N+1 Query Prevention

N+1 queries are the most common ORM performance problem. They are **forbidden** in production query paths.

### Detection
```
Test: Run the list query for 50 items; count DB queries
Pass: N queries (fixed set, not proportional to result count)
Fail: N queries where N grows with result count
```

### Prevention (Eloquent)
```php
// Forbidden (N+1):
$orders = Order::where('company_id', $companyId)->get();
foreach ($orders as $order) {
    $customer = $order->customer; // N additional queries
}

// Required (eager loading):
$orders = Order::with('orderLines', 'customer')
    ->where('company_id', $companyId)
    ->get();
```

### Guidance
- All list endpoints must use `with()` for all relationships displayed in the response
- Use `withCount()` for relationship counts (e.g., order line count)
- Never call a relationship inside a loop
- Use `load()` for conditional eager loading after initial query

---

## 3. Query Pattern Standards

### Standard Paginated List
```php
// Correct pattern for all list endpoints:
$query = Product::query()
    ->where('company_id', $companyId)
    ->whereNull('deleted_at');

// Apply filters
if ($request->status) {
    $query->where('status', $request->status);
}

// Always order for consistent pagination
$query->orderBy('created_at', 'desc');

// Paginate with cursor or offset
return $query->paginate($perPage);
```

### FIFO Layer Query
```php
// Always use FIFO order (received_at ASC) for consumption
ReceiptLayer::where('raw_material_id', $id)
    ->where('warehouse_id', $warehouseId)
    ->where('remaining_qty', '>', 0)
    ->orderBy('received_at', 'asc')  // CRITICAL: FIFO order
    ->lockForUpdate()
    ->get();
```

### Availability Calculation
```php
// Correct: Use a projection or denormalized inventory_items table
// NOT: Re-calculate from raw movements on every request
$availability = InventoryAvailabilityProjection::where([
    'entity_type' => 'raw_material',
    'entity_id' => $id,
    'warehouse_id' => $warehouseId,
])->first();
```

---

## 4. Slow Query Policy

| Threshold | Action |
|---|---|
| Query > 200ms | Log to slow query log |
| Query > 500ms | Investigate; add to performance backlog |
| Query > 1000ms | Alert Engineering Lead; immediate investigation |
| Query > 5000ms | Incident; circuit breaker may activate |

### EXPLAIN ANALYZE Required
Before adding or changing any index, run `EXPLAIN ANALYZE` on the affected query and document:
- Query plan before index
- Query plan after index
- Actual time improvement

---

## 5. PostgreSQL Configuration Targets

| Parameter | Value | Notes |
|---|---|---|
| `work_mem` | 64MB (per query) | For sort/hash operations |
| `shared_buffers` | 25% of RAM | PostgreSQL buffer cache |
| `effective_cache_size` | 75% of RAM | Planner hint for cache |
| `max_connections` | 100 (via PgBouncer) | Direct connections; PgBouncer pools below this |
| `autovacuum` | Enabled | Required for MVCC maintenance |
| `random_page_cost` | 1.1 (SSD) | Planner hint for SSD storage |

---

## 6. Connection Pool Configuration (PgBouncer)

| Parameter | Value |
|---|---|
| Pool mode | `transaction` |
| Max pool size per database | 20 |
| Min pool size | 2 |
| Max client connections | 100 |
| Client timeout | 30s |
| Server lifetime | 1 hour |

**Note:** Transaction pooling means connections are acquired per transaction, not per session. Prepared statements require Session mode — use query-level parameters instead.

---

## 7. Read Replica Usage

| Query Type | Use Primary | Use Read Replica |
|---|---|---|
| Transactional writes | ✅ Primary | — |
| Reads in active transactions | ✅ Primary (consistency) | — |
| List queries (workspaces) | ✅ Primary | Consider replica for high-traffic |
| Reports and analytics | — | ✅ Read Replica |
| Projection rebuilds | — | ✅ Read Replica (less load on primary) |
| Financial reconciliation | ✅ Primary (accuracy) | — |

**Rule:** Read-replica connections are set via a second database connection in `config/database.php`. Query Contracts explicitly declare which connection they use.

---

## 8. Caching Strategy

| Cache Layer | Tool | What Is Cached | TTL |
|---|---|---|---|
| Reference data | Redis | Countries, currencies, units | 1 hour |
| Configuration values | Redis | Per (company, key) | 5 min |
| Feature flags | In-memory (request) | Per request | Request lifetime |
| Search results | (Meilisearch internal) | — | Meilisearch managed |
| Projection data | Redis (optional) | High-traffic dashboard KPIs | 15s |

**Cache invalidation:**
- Reference data: manual invalidation when data changes
- Configuration: invalidated by `platform.configuration.published` event
- Feature flags: invalidated by `platform.feature_flag.updated` event
