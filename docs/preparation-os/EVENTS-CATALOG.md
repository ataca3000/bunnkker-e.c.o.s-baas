# Preparation OS — Events Catalog

**Document:** EVENTS-CATALOG  
**Version:** 1.0  
**Status:** APPROVED — Engineering Design Phase  
**Date:** 2026-07-05  
**Task:** TASK-PREP-001  
**Parent:** PREPARATION-OS-BLUEPRINT.md  
**Backend:** ENTERPRISE-EVENT-PLATFORM.md (EPS-01)  
**Schema:** DOMAIN-EVENT-CATALOG.md

---

## 1. Event Naming Convention

```
fulfillment.{entity}.{action}    (past tense, lowercase, dot-separated)

Examples:
  fulfillment.wave.created
  fulfillment.wave.completed
  fulfillment.product_prepared
```

---

## 2. Event Schema (all events share this envelope)

```json
{
  "event_id":        "UUID — unique per event (idempotency key)",
  "event_type":      "string — dot-notation",
  "event_version":   1,
  "aggregate_type":  "PreparationWave | PreparedProductsPool",
  "aggregate_id":    "UUID",
  "company_id":      "UUID",
  "occurred_at":     "ISO 8601 datetime",
  "triggered_by":    "UUID — actor ID",
  "triggered_by_type": "user | system | ai | scheduled",
  "correlation_id":  "UUID — links events in one flow",
  "causation_id":    "UUID | null",
  "source_module":   "Operations.Preparation",
  "payload":         {}
}
```

---

## 3. Preparation OS Events

---

### EVT-PREP-001: preparation.wave.created

**Trigger:** CreateWaveAction completes successfully  
**Aggregate:** PreparationWave  
**Replay Safe:** Yes (idempotent on aggregate_id)

**Payload:**
```json
{
  "wave_id": "UUID",
  "wave_number": "PREP-202607-000001",
  "warehouse_id": "UUID",
  "planning_date": "2026-07-05",
  "orders_count": 125,
  "order_ids": ["UUID", "..."],
  "created_by": "UUID",
  "config_version_id": "UUID"
}
```

**Consumers:**
| Consumer | Action |
|---|---|
| Timeline (EPS-02) | Write: "Wave created with N orders" |
| Analytics projection | Increment wave count for planning_date |

**Retention:** Standard (12 months in hot storage, then archive)

---

### EVT-PREP-002: preparation.shortage.detected

**Trigger:** AnalyzeMaterialsAction detects at least one material shortage  
**Aggregate:** PreparationWave  
**Replay Safe:** Yes

**Payload:**
```json
{
  "wave_id": "UUID",
  "wave_number": "PREP-202607-000001",
  "shortages": [
    {
      "raw_material_id": "UUID",
      "material_name": "Almond Extract",
      "unit": "kg",
      "quantity_required": 85.5,
      "quantity_available": 42.0,
      "shortage_amount": 43.5,
      "quantity_to_purchase": 43.5
    }
  ],
  "planning_date": "2026-07-05",
  "warehouse_id": "UUID"
}
```

**Consumers:**
| Consumer | Action |
|---|---|
| Procurement module | Auto-create Material Request if `mrp.auto_trigger` = true |
| Timeline (EPS-02) | Write shortage event per material |
| Notifications (EPS-04) | Alert planner + procurement team |
| Analytics projection | Increment shortage_rate |

**Retention:** Standard (12 months)

---

### EVT-PREP-003: preparation.wave.started

**Trigger:** StartPreparationAction completes  
**Aggregate:** PreparationWave  
**Replay Safe:** Yes

**Payload:**
```json
{
  "wave_id": "UUID",
  "wave_number": "PREP-202607-000001",
  "warehouse_id": "UUID",
  "planning_date": "2026-07-05",
  "order_ids": ["UUID", "..."],
  "started_by": "UUID",
  "started_at": "2026-07-05T09:00:00Z",
  "workers_assigned": [
    { "user_id": "UUID", "role": "operator" }
  ]
}
```

**Consumers:**
| Consumer | Action |
|---|---|
| Orders module | Update order status → `in_preparation` for all orders in wave |
| Timeline (EPS-02) | Write: "Preparation started by {actor}" |
| Notifications (EPS-04) | Notify assigned workers |
| Analytics projection | Record wave start time |

**Retention:** Standard

---

### EVT-PREP-004: preparation.product.prepared

**Trigger:** CompleteProductAction records prepared quantity for a WaveItem  
**Aggregate:** PreparationWave  
**Replay Safe:** Yes (idempotent on wave_id + product_id)

**Payload:**
```json
{
  "wave_id": "UUID",
  "wave_item_id": "UUID",
  "product_id": "UUID",
  "sku": "HONEY-500G",
  "quantity_required": 420.0,
  "quantity_prepared": 418.0,
  "quantity_short": 2.0,
  "status": "short",
  "prepared_by": "UUID",
  "prepared_at": "2026-07-05T10:30:00Z"
}
```

**Consumers:**
| Consumer | Action |
|---|---|
| Timeline (EPS-02) | Write: "Product {SKU} prepared: {qty} of {required}" |
| Analytics projection | Update product preparation rates |

**Retention:** Standard

---

### EVT-PREP-005: preparation.wave.completed

**Trigger:** CompleteWaveAction completes; all WaveItems processed  
**Aggregate:** PreparationWave  
**Replay Safe:** Yes

**Payload:**
```json
{
  "wave_id": "UUID",
  "wave_number": "PREP-202607-000001",
  "warehouse_id": "UUID",
  "planning_date": "2026-07-05",
  "completed_by": "UUID",
  "completed_at": "2026-07-05T11:00:00Z",
  "started_at": "2026-07-05T09:00:00Z",
  "duration_minutes": 120,
  "orders_count": 125,
  "products_count": 12,
  "total_units_required": 4215.0,
  "total_units_prepared": 4198.0,
  "completion_pct": 99.6,
  "short_items": [
    {
      "product_id": "UUID",
      "sku": "HONEY-500G",
      "quantity_short": 2.0
    }
  ],
  "pool_entries_created": 12
}
```

**Consumers:**
| Consumer | Action |
|---|---|
| Orders module | Update order status → `ready` |
| Loading & Allocation OS | Notified: pool is available for loading |
| Timeline (EPS-02) | Write: "Wave completed. N products in pool." |
| Notifications (EPS-04) | Notify loading supervisor |
| Analytics projection | Record completion metrics |
| AI Platform | Training signal: wave completed with these characteristics |

**Retention:** Standard

---

### EVT-PREP-006: preparation.wave.cancelled

**Trigger:** CancelWaveAction  
**Aggregate:** PreparationWave  
**Replay Safe:** Yes

**Payload:**
```json
{
  "wave_id": "UUID",
  "wave_number": "PREP-202607-000001",
  "warehouse_id": "UUID",
  "status_before_cancel": "preparing",
  "cancelled_by": "UUID",
  "cancelled_at": "2026-07-05T09:15:00Z",
  "reason": "Orders cancelled by customer service",
  "orders_count": 125,
  "order_ids": ["UUID", "..."]
}
```

**Consumers:**
| Consumer | Action |
|---|---|
| Orders module | Return orders to `reserved` status |
| Inventory module | Release material reservations for these orders |
| Timeline (EPS-02) | Write: "Wave cancelled. Reason: {text}" |
| Analytics projection | Record cancellation |

**Retention:** Standard

---

### EVT-PREP-007: preparation.worker.assigned

**Trigger:** Worker assignment in StartPreparationAction or manual assignment  
**Aggregate:** PreparationWave  
**Replay Safe:** Yes (idempotent on wave_id + user_id + assigned_at)

**Payload:**
```json
{
  "wave_id": "UUID",
  "wave_number": "PREP-202607-000001",
  "user_id": "UUID",
  "user_name": "Ahmed Hassan",
  "role": "operator",
  "assigned_by": "UUID",
  "assigned_at": "2026-07-05T09:00:00Z"
}
```

**Consumers:**
| Consumer | Action |
|---|---|
| Timeline (EPS-02) | Write: "Worker {name} assigned as {role}" |
| Notifications (EPS-04) | Notify assigned worker |

---

### EVT-PREP-008: preparation.worker.released

**Trigger:** Worker released from wave assignment  
**Aggregate:** PreparationWave  
**Replay Safe:** Yes

**Payload:**
```json
{
  "wave_id": "UUID",
  "wave_number": "PREP-202607-000001",
  "user_id": "UUID",
  "user_name": "Ahmed Hassan",
  "role": "operator",
  "released_by": "UUID",
  "released_at": "2026-07-05T11:05:00Z"
}
```

**Consumers:**
| Consumer | Action |
|---|---|
| Timeline (EPS-02) | Write: "Worker {name} released from wave" |

---

### EVT-PREP-009: preparation.exception.raised

**Trigger:** Exception created on any preparation entity  
**Aggregate:** PreparationWave  
**Replay Safe:** Yes

**Payload:**
```json
{
  "wave_id": "UUID",
  "exception_id": "UUID",
  "exception_type": "shortage",
  "severity": "blocking",
  "entity_type": "raw_material",
  "entity_id": "UUID",
  "description": "Almond Extract shortage: 43.5 kg required but only 0 kg available",
  "raised_by": "UUID (or system)",
  "raised_at": "2026-07-05T08:10:00Z"
}
```

**Consumers:**
| Consumer | Action |
|---|---|
| Timeline (EPS-02) | Write: "Exception: {type} — {description}" |
| Notifications (EPS-04) | Alert preparation supervisor |

---

### EVT-PREP-010: preparation.pool.updated

**Trigger:** PreparedProductsPool entry created or updated (quantity change)  
**Aggregate:** PreparedProductsPool  
**Replay Safe:** Yes

**Payload:**
```json
{
  "pool_entry_id": "UUID",
  "product_id": "UUID",
  "sku": "HONEY-500G",
  "warehouse_id": "UUID",
  "preparation_wave_id": "UUID",
  "movement_type": "created",
  "quantity_moved": 418.0,
  "quantity_available": 418.0,
  "quantity_reserved": 0,
  "quality_status": "pending_review",
  "recorded_at": "2026-07-05T11:00:00Z"
}
```

**Consumers:**
| Consumer | Action |
|---|---|
| Loading & Allocation OS | Aware of new pool stock; factor into Shipping Wave planning |
| Analytics projection | Update pool utilization metrics |
| AI Platform | Pool signal for shortage/overflow prediction |

---

## 4. Events Preparation OS Listens To

| Event | Source Module | Action Taken |
|---|---|---|
| `inventory.raw_material.stock_added` | Inventory | Check if any shortage-blocked wave's shortage is resolved |
| `manufacturing.production_job.completed` | Manufacturing | Update ProductionRequirement.status → `ready` |
| `manufacturing.production_job.created` | Manufacturing | Update ProductionRequirement.manufacturing_job_id |
| `loading.pool.reserved` | Loading OS | Update pool.quantity_reserved +; create PoolMovement |
| `loading.pool.reservation_released` | Loading OS | Update pool.quantity_reserved -; create PoolMovement |
| `loading.product.loaded` | Loading OS | Update pool.quantity_loaded +; create PoolMovement |

---

## 5. Event Versioning

All events are at `event_version: 1`. When payload changes are required:

- **Additive field:** increment is NOT required; consumers must tolerate unknown fields
- **Renamed / removed field:** `event_version` increments to 2; dual-publish for 90 days (CONTRACT-VERSIONING.md)

---

## 6. Event Retention

| Event | Retention | Archive After |
|---|---|---|
| `preparation.wave.created` | 12 months hot | Archive: 7 years (ops records) |
| `preparation.shortage.detected` | 12 months hot | Archive: 7 years |
| `preparation.wave.started` | 12 months hot | Archive: 7 years |
| `preparation.product.prepared` | 12 months hot | Archive: 2 years |
| `preparation.wave.completed` | 12 months hot | Archive: 7 years |
| `preparation.wave.cancelled` | 12 months hot | Archive: 7 years |
| `preparation.worker.assigned` | 12 months hot | Archive: 1 year |
| `preparation.worker.released` | 12 months hot | Archive: 1 year |
| `preparation.exception.raised` | 12 months hot | Archive: 3 years |
| `preparation.pool.updated` | 6 months hot | Archive: 3 years |

All events are stored in the `business_events` table (ULID, monthly partitioned — DATA-PARTITIONING-STRATEGY.md).
