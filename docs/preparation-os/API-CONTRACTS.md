# Preparation OS — API Contracts

**Document:** API-CONTRACTS  
**Version:** 1.0  
**Status:** APPROVED — Engineering Design Phase  
**Date:** 2026-07-05  
**Task:** TASK-PREP-001  
**Parent:** PREPARATION-OS-BLUEPRINT.md  
**API Standards:** docs/07_API_Standards.md

---

## 1. Base URL

```
/api/v1/preparation
```

All routes are company-scoped via authenticated user's company context.

---

## 2. Command Contracts

Commands change state. All commands require authentication and return the mutated resource or a status confirmation.

---

### CMD-001: Create Wave

**Endpoint:** `POST /api/v1/preparation/waves`  
**Permission:** `preparation.waves.create`  
**Idempotency:** Wave number collision returns 409 with existing wave data

**Request:**
```json
{
  "planning_date": "2026-07-06",
  "warehouse_id": "uuid",
  "order_ids": ["uuid", "uuid", "..."],
  "notes": "Morning run — Zone A orders"
}
```

**Validation:**
| Field | Rules |
|---|---|
| `planning_date` | required, date, min: today |
| `warehouse_id` | required, UUID, must belong to user's company |
| `order_ids` | required, array, min 1 item, each UUID |
| `order_ids.*` | each order must exist, be in `reserved` status, belong to user's company, not already in an active wave |
| `notes` | optional, string, max 1000 |

**Response (201 Created):**
```json
{
  "data": {
    "id": "uuid",
    "wave_number": "PREP-202607-000001",
    "status": "draft",
    "planning_date": "2026-07-06",
    "warehouse_id": "uuid",
    "orders_count": 125,
    "products_count": 0,
    "total_units_required": 0,
    "created_at": "2026-07-05T08:00:00Z"
  }
}
```

**Error Contracts:**
| Code | Condition |
|---|---|
| 422 | Validation failure (field errors in `errors` key) |
| 422 | One or more orders already in active wave (`order_already_in_wave`) |
| 422 | One or more orders not in `reserved` status (`order_not_reservable`) |
| 404 | Warehouse not found or not accessible |
| 403 | Missing permission `preparation.waves.create` |

---

### CMD-002: Generate Product Demand

**Endpoint:** `POST /api/v1/preparation/waves/{waveId}/generate-demand`  
**Permission:** `preparation.waves.plan`  
**Idempotency:** Safe to re-run; regenerates wave items from current order contents  
**State Transition:** `draft` → `planning`

**Request:** (no body required)

**Response (200 OK):**
```json
{
  "data": {
    "id": "uuid",
    "status": "planning",
    "products_count": 12,
    "lines_count": 348,
    "total_units_required": 4215.0,
    "wave_items": [
      {
        "product_id": "uuid",
        "sku": "HONEY-500G",
        "name": "Raw Honey 500g",
        "quantity_required": 420.0,
        "status": "pending"
      }
    ],
    "generated_at": "2026-07-05T08:05:00Z"
  }
}
```

**Error Contracts:**
| Code | Condition |
|---|---|
| 422 | Wave has no orders (`wave_has_no_orders`) |
| 422 | Wave not in `draft` status (`invalid_wave_status`) |
| 404 | Wave not found |
| 403 | Missing permission |

---

### CMD-003: Analyze Materials (MRP)

**Endpoint:** `POST /api/v1/preparation/waves/{waveId}/analyze-materials`  
**Permission:** `preparation.waves.plan`  
**State Transition:** `planning` stays (sets shortage_detected flag); transitions to `shortage_blocked` if shortages exist

**Request:** (no body required)

**Response (200 OK):**
```json
{
  "data": {
    "id": "uuid",
    "status": "planning",
    "shortage_detected": true,
    "material_requirements": [
      {
        "raw_material_id": "uuid",
        "name": "Almond Extract",
        "unit": "kg",
        "quantity_required": 85.5,
        "quantity_available": 42.0,
        "shortage": true,
        "shortage_amount": 43.5,
        "quantity_to_purchase": 43.5
      }
    ],
    "analyzed_at": "2026-07-05T08:10:00Z"
  }
}
```

**Error Contracts:**
| Code | Condition |
|---|---|
| 422 | Wave not in `planning` status |
| 422 | Wave items not generated yet (`generate_demand_first`) |
| 404 | Wave not found |

---

### CMD-004: Start Preparation

**Endpoint:** `POST /api/v1/preparation/waves/{waveId}/start`  
**Permission:** `preparation.waves.start`  
**State Transition:** `planning` → `preparing` (or `shortage_blocked` → `preparing` if supervisor approved)

**Request:**
```json
{
  "worker_ids": ["uuid", "uuid"],
  "supervisor_id": "uuid",
  "station_ids": ["uuid"]
}
```

**Validation:**
| Field | Rules |
|---|---|
| `worker_ids` | optional, array of UUID; each must be an active employee of company |
| `supervisor_id` | optional, UUID; must have `preparation.supervisor` role |
| `station_ids` | optional, array of UUID; each must belong to wave's warehouse |

**Response (200 OK):**
```json
{
  "data": {
    "id": "uuid",
    "status": "preparing",
    "started_at": "2026-07-05T09:00:00Z",
    "started_by": "uuid",
    "pick_list": {
      "id": "uuid",
      "status": "pending",
      "items_count": 12,
      "generated_at": "2026-07-05T09:00:00Z"
    }
  }
}
```

**Error Contracts:**
| Code | Condition |
|---|---|
| 422 | Wave not in `planning` or `shortage_blocked` status |
| 422 | Shortage detected and not resolved (`shortage_not_resolved`) — requires supervisor override |
| 403 | Shortage override requires `preparation.waves.override_shortage` permission |
| 404 | Wave not found |

---

### CMD-005: Complete Product (Record Prepared Quantity)

**Endpoint:** `PATCH /api/v1/preparation/waves/{waveId}/items/{itemId}/complete`  
**Permission:** `preparation.items.update`  
**State Transition:** WaveItem → `prepared` or `short`

**Request:**
```json
{
  "quantity_prepared": 418.0,
  "notes": "2 units damaged during collection"
}
```

**Validation:**
| Field | Rules |
|---|---|
| `quantity_prepared` | required, decimal >= 0, max: item.quantity_required × 1.1 (overprepare tolerance from ManufacturingPolicy) |
| `notes` | required when quantity_prepared < quantity_required |

**Response (200 OK):**
```json
{
  "data": {
    "id": "uuid",
    "product_id": "uuid",
    "sku": "HONEY-500G",
    "quantity_required": 420.0,
    "quantity_prepared": 418.0,
    "quantity_short": 2.0,
    "status": "short",
    "prepared_at": "2026-07-05T10:30:00Z",
    "prepared_by": "uuid"
  }
}
```

**Error Contracts:**
| Code | Condition |
|---|---|
| 422 | Wave not in `preparing` status |
| 422 | quantity_prepared exceeds overprepare tolerance |
| 404 | Wave or item not found |

---

### CMD-006: Complete Wave

**Endpoint:** `POST /api/v1/preparation/waves/{waveId}/complete`  
**Permission:** `preparation.waves.complete`  
**State Transition:** `preparing` → `completed`  
**Side Effect:** Writes to prepared_products_pool; publishes `preparation.wave.completed` event

**Request:** (no body required)

**Response (200 OK):**
```json
{
  "data": {
    "id": "uuid",
    "status": "completed",
    "completed_at": "2026-07-05T11:00:00Z",
    "total_units_prepared": 4198.0,
    "total_units_required": 4215.0,
    "pool_entries_created": 12,
    "short_items": [
      {
        "product_id": "uuid",
        "sku": "HONEY-500G",
        "quantity_short": 2.0
      }
    ]
  }
}
```

**Error Contracts:**
| Code | Condition |
|---|---|
| 422 | Wave not in `preparing` status |
| 422 | Any WaveItem still in `in_progress` status (`items_not_complete`) |
| 422 | Any WaveItem in `blocked` status (`blocked_items_exist`) |
| 404 | Wave not found |

---

### CMD-007: Cancel Wave

**Endpoint:** `POST /api/v1/preparation/waves/{waveId}/cancel`  
**Permission:** `preparation.waves.cancel`  
**State Transition:** Any status except `completed` → `cancelled`  
**Side Effect:** Releases material reservations; publishes `preparation.wave.cancelled` event

**Request:**
```json
{
  "reason": "Orders cancelled by customer service"
}
```

**Validation:**
| Field | Rules |
|---|---|
| `reason` | required, string, min 10 chars |

**Response (200 OK):**
```json
{
  "data": {
    "id": "uuid",
    "status": "cancelled",
    "cancelled_at": "2026-07-05T09:15:00Z",
    "cancellation_reason": "Orders cancelled by customer service"
  }
}
```

**Error Contracts:**
| Code | Condition |
|---|---|
| 422 | Wave already `completed` (`cannot_cancel_completed_wave`) |
| 422 | Wave already `cancelled` |
| 404 | Wave not found |

---

### CMD-008: Recalculate Wave

**Endpoint:** `POST /api/v1/preparation/waves/{waveId}/recalculate`  
**Permission:** `preparation.waves.plan`  
**State Transition:** `draft` or `planning` → `planning` (re-runs demand generation + material analysis)  
**Note:** Only allowed before preparation starts

**Request:**
```json
{
  "add_order_ids": ["uuid"],
  "remove_order_ids": ["uuid"]
}
```

**Validation:**
| Field | Rules |
|---|---|
| `add_order_ids` | optional, array of UUID; orders must be in `reserved` status and not in another wave |
| `remove_order_ids` | optional, array of UUID; orders must be currently in this wave |

**Response (200 OK):**
```json
{
  "data": {
    "id": "uuid",
    "status": "planning",
    "orders_count": 127,
    "products_count": 13,
    "total_units_required": 4380.0,
    "recalculated_at": "2026-07-05T08:30:00Z"
  }
}
```

**Error Contracts:**
| Code | Condition |
|---|---|
| 422 | Wave already in `preparing` or `completed` status (`cannot_recalculate`) |
| 422 | Wave would have 0 orders after removal |
| 404 | Wave not found |

---

## 3. Query Contracts

Queries are read-only. They do not change state.

---

### QRY-001: Preparation Dashboard

**Endpoint:** `GET /api/v1/preparation/dashboard`  
**Permission:** `preparation.dashboard.view`  
**Cache:** 30 seconds (Redis, per company_id + warehouse_id)

**Query Parameters:**
| Parameter | Type | Default | Description |
|---|---|---|---|
| `warehouse_id` | UUID | — | Filter by warehouse |
| `planning_date` | date | today | Dashboard date |

**Response (200 OK):**
```json
{
  "data": {
    "planning_date": "2026-07-05",
    "kpis": {
      "waves_total": 3,
      "waves_by_status": {
        "draft": 0,
        "planning": 1,
        "shortage_blocked": 0,
        "preparing": 2,
        "completed": 0,
        "cancelled": 0
      },
      "orders_in_preparation": 347,
      "products_required": 28,
      "units_required": 8420.0,
      "units_prepared": 3180.0,
      "completion_pct": 37.8,
      "open_exceptions": 2,
      "pool_available_units": 0,
      "workers_active": 6
    },
    "active_waves": [
      {
        "id": "uuid",
        "wave_number": "PREP-202607-000001",
        "status": "preparing",
        "orders_count": 125,
        "completion_pct": 45.0,
        "shortage_detected": false,
        "started_at": "2026-07-05T09:00:00Z"
      }
    ],
    "alerts": [
      {
        "type": "shortage",
        "severity": "blocking",
        "wave_id": "uuid",
        "message": "Wave PREP-202607-000002 blocked: 43.5kg Almond Extract shortage"
      }
    ]
  }
}
```

---

### QRY-002: Wave List (Preparation Queue)

**Endpoint:** `GET /api/v1/preparation/waves`  
**Permission:** `preparation.waves.view`

**Query Parameters:**
| Parameter | Type | Default | Description |
|---|---|---|---|
| `status` | string | — | Filter by status |
| `warehouse_id` | UUID | — | Filter by warehouse |
| `planning_date` | date | — | Filter by date |
| `page` | int | 1 | Pagination |
| `per_page` | int | 25 | Max 100 |
| `sort` | string | `-created_at` | Sortable: `wave_number`, `planning_date`, `status`, `orders_count`, `created_at` |

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid",
      "wave_number": "PREP-202607-000001",
      "status": "preparing",
      "planning_date": "2026-07-05",
      "warehouse": { "id": "uuid", "name": "Main Warehouse" },
      "orders_count": 125,
      "products_count": 12,
      "total_units_required": 4215.0,
      "total_units_prepared": 1890.0,
      "completion_pct": 44.8,
      "shortage_detected": false,
      "open_exceptions": 0,
      "workers": [
        { "id": "uuid", "name": "Ahmed Hassan", "role": "operator" }
      ],
      "created_at": "2026-07-05T07:30:00Z",
      "started_at": "2026-07-05T09:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "per_page": 25,
    "total": 3,
    "last_page": 1
  }
}
```

---

### QRY-003: Wave Detail

**Endpoint:** `GET /api/v1/preparation/waves/{waveId}`  
**Permission:** `preparation.waves.view`

**Response (200 OK):**
```json
{
  "data": {
    "id": "uuid",
    "wave_number": "PREP-202607-000001",
    "status": "preparing",
    "planning_date": "2026-07-05",
    "warehouse_id": "uuid",
    "orders_count": 125,
    "products_count": 12,
    "total_units_required": 4215.0,
    "total_units_prepared": 1890.0,
    "shortage_detected": false,
    "approved_at": "2026-07-05T08:45:00Z",
    "approved_by": "uuid",
    "started_at": "2026-07-05T09:00:00Z",
    "config_version_id": "uuid",
    "orders": [
      {
        "id": "uuid",
        "order_number": "ORD-202607-000125",
        "added_at": "2026-07-05T07:30:00Z"
      }
    ],
    "wave_items": [
      {
        "id": "uuid",
        "product_id": "uuid",
        "sku": "HONEY-500G",
        "name": "Raw Honey 500g",
        "quantity_required": 420.0,
        "quantity_prepared": 200.0,
        "status": "in_progress"
      }
    ],
    "material_requirements": [
      {
        "raw_material_id": "uuid",
        "name": "Beeswax",
        "quantity_required": 12.5,
        "quantity_available": 50.0,
        "shortage": false
      }
    ],
    "exceptions": [],
    "workers": [
      { "id": "uuid", "name": "Ahmed Hassan", "role": "operator" }
    ]
  }
}
```

---

### QRY-004: Product Queue (Wave Items for Warehouse)

**Endpoint:** `GET /api/v1/preparation/waves/{waveId}/product-queue`  
**Permission:** `preparation.items.view`  
**Optimized for:** Warehouse floor display (tablet/mobile)

**Query Parameters:**
| Parameter | Type | Description |
|---|---|---|
| `status` | string | Filter by item status |
| `sort` | string | `name`, `sku`, `quantity_required`, `-completion_pct` |

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid",
      "product_id": "uuid",
      "sku": "HONEY-500G",
      "name": "Raw Honey 500g",
      "thumbnail_url": "/storage/products/honey-500g.jpg",
      "quantity_required": 420.0,
      "quantity_prepared": 200.0,
      "quantity_short": 0,
      "completion_pct": 47.6,
      "status": "in_progress",
      "warehouse_zone": "Zone A",
      "shelf_location": "A-12-B"
    }
  ]
}
```

---

### QRY-005: Prepared Products Pool

**Endpoint:** `GET /api/v1/preparation/pool`  
**Permission:** `preparation.pool.view`

**Query Parameters:**
| Parameter | Type | Description |
|---|---|---|
| `warehouse_id` | UUID | required |
| `quality_status` | string | Filter: `pending_review`, `passed`, `failed` |
| `available_only` | bool | Only entries with quantity_available > 0 |

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid",
      "product_id": "uuid",
      "sku": "HONEY-500G",
      "name": "Raw Honey 500g",
      "preparation_wave_number": "PREP-202607-000001",
      "quantity_available": 418.0,
      "quantity_reserved": 0,
      "quantity_loaded": 0,
      "quality_status": "passed",
      "quality_checked_at": "2026-07-05T11:05:00Z",
      "prepared_at": "2026-07-05T11:00:00Z"
    }
  ],
  "meta": { "page": 1, "per_page": 25, "total": 12, "last_page": 1 }
}
```

---

### QRY-006: Worker Status

**Endpoint:** `GET /api/v1/preparation/workers`  
**Permission:** `preparation.workers.view`

**Query Parameters:**
| Parameter | Type | Description |
|---|---|---|
| `warehouse_id` | UUID | required |
| `planning_date` | date | default: today |

**Response (200 OK):**
```json
{
  "data": [
    {
      "user_id": "uuid",
      "name": "Ahmed Hassan",
      "role": "operator",
      "wave_id": "uuid",
      "wave_number": "PREP-202607-000001",
      "wave_status": "preparing",
      "assigned_at": "2026-07-05T09:00:00Z",
      "status": "active"
    }
  ]
}
```

---

### QRY-007: Station Status

**Endpoint:** `GET /api/v1/preparation/stations`  
**Permission:** `preparation.stations.view`

**Query Parameters:**
| Parameter | Type | Description |
|---|---|---|
| `warehouse_id` | UUID | required |
| `status` | string | Filter by status |

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Picking Station A",
      "station_type": "picking",
      "zone": "Zone A",
      "capacity": 3,
      "status": "active",
      "current_workers": 2
    }
  ]
}
```

---

### QRY-008: Analytics

**Endpoint:** `GET /api/v1/preparation/analytics`  
**Permission:** `preparation.analytics.view`  
**Source:** Read replica; projection table  
**Cache:** 5 minutes

**Query Parameters:**
| Parameter | Type | Description |
|---|---|---|
| `from_date` | date | required |
| `to_date` | date | required; max 90 days range |
| `warehouse_id` | UUID | optional filter |

**Response (200 OK):**
```json
{
  "data": {
    "period": { "from": "2026-07-01", "to": "2026-07-05" },
    "summary": {
      "waves_created": 15,
      "waves_completed": 13,
      "waves_cancelled": 1,
      "avg_completion_time_minutes": 148,
      "avg_completion_pct": 97.3,
      "shortage_rate_pct": 8.2,
      "total_units_prepared": 62450.0
    },
    "daily": [
      {
        "date": "2026-07-05",
        "waves": 3,
        "units_prepared": 12840.0,
        "avg_minutes": 152
      }
    ],
    "top_shorted_products": [
      {
        "product_id": "uuid",
        "sku": "ALMOND-1KG",
        "shortage_occurrences": 3,
        "avg_shortage_pct": 12.4
      }
    ]
  }
}
```

---

## 4. Authorization Matrix

| Endpoint | Roles |
|---|---|
| `POST /waves` | `planner`, `preparation_supervisor` |
| `POST /waves/:id/generate-demand` | `planner`, `preparation_supervisor` |
| `POST /waves/:id/analyze-materials` | `planner`, `preparation_supervisor` |
| `POST /waves/:id/start` | `preparation_supervisor` |
| `PATCH /waves/:id/items/:itemId/complete` | `warehouse_operator`, `preparation_supervisor` |
| `POST /waves/:id/complete` | `preparation_supervisor` |
| `POST /waves/:id/cancel` | `preparation_supervisor` |
| `POST /waves/:id/recalculate` | `planner`, `preparation_supervisor` |
| `GET /dashboard` | All preparation roles |
| `GET /waves` | All preparation roles |
| `GET /waves/:id` | All preparation roles |
| `GET /waves/:id/product-queue` | All preparation roles + `warehouse_operator` |
| `GET /pool` | All preparation roles, `loading_supervisor` |
| `GET /workers` | `preparation_supervisor`, `planner` |
| `GET /stations` | All preparation roles |
| `GET /analytics` | `preparation_supervisor`, `planner`, `management` |

---

## 5. Standard Error Response Format

```json
{
  "message": "Human-readable summary",
  "errors": {
    "field_name": ["Validation error message"]
  },
  "code": "machine_readable_error_code",
  "meta": {}
}
```

All HTTP 4xx/5xx responses follow this format.

---

## 6. API Versioning

All Preparation OS APIs are at `v1`. When a breaking change is required, `v2` endpoints are added while `v1` is maintained for a minimum 90-day deprecation window (per CONTRACT-VERSIONING.md).
