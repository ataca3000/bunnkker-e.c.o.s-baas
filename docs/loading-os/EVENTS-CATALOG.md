# Loading & Allocation OS — Events Catalog

**Document:** EVENTS-CATALOG  
**Version:** 1.0  
**Status:** APPROVED — Engineering Design Phase  
**Date:** 2026-07-05  
**Task:** TASK-LOAD-001  
**Parent:** BLUEPRINT.md  
**ADR Reference:** ADR-011 (Event-Driven), ADR-015

---

## 1. Event Design Principles

- All events are immutable after dispatch
- Every event carries: `event_id`, `event_version`, `company_id`, `actor_id`, `actor_type`, `occurred_at`
- Events are append-only; compensating events are raised for reversals (never mutate a past event)
- Cross-domain events are published via the Event Bus; intra-domain events may be synchronous
- Consumers must be idempotent

---

## 2. Event Catalog

---

### EVT-LOAD-001 — LoadingSessionCreated

**Business Meaning:** A new Loading Session has been created for a planning date and warehouse. This signals the start of the loading workflow; the Geography Engine should now run.

| Field | Value |
|---|---|
| Event Type | `loading.session.created` |
| Version | `1.0` |
| Producer | `Operations.Loading.CreateLoadingSessionAction` |
| Dispatch | Synchronous (after DB write) |

**Payload:**
```json
{
  "event_id": "uuid",
  "event_type": "loading.session.created",
  "event_version": "1.0",
  "company_id": "uuid",
  "actor_id": "uuid",
  "actor_type": "user",
  "occurred_at": "2026-07-05T09:00:00Z",
  "data": {
    "session_id": "uuid",
    "session_number": "LOAD-202607-000001",
    "warehouse_id": "uuid",
    "planning_date": "2026-07-05",
    "pool_entry_count": 145,
    "auto_plan": true
  }
}
```

**Consumers:**

| Consumer | Module | Action |
|---|---|---|
| `GeographyEngineListener` | Operations.Loading | Triggers Geography Engine grouping |
| `NotificationService` | Core.Notifications | Notifies loading manager |
| `TimelineService` | Core.Timeline | Writes timeline entry |
| `AuditService` | Core.Audit | Writes audit log |

---

### EVT-LOAD-002 — VehiclePlanned

**Business Meaning:** The Vehicle Planning Engine has produced a Vehicle Plan for one GeographyGroup. One event is raised per plan, not per session.

| Field | Value |
|---|---|
| Event Type | `loading.vehicle_plan.generated` |
| Version | `1.0` |
| Producer | `Operations.Loading.GenerateVehiclePlanAction` |

**Payload:**
```json
{
  "event_id": "uuid",
  "event_type": "loading.vehicle_plan.generated",
  "event_version": "1.0",
  "company_id": "uuid",
  "actor_id": "uuid",
  "actor_type": "system",
  "occurred_at": "2026-07-05T09:01:00Z",
  "data": {
    "vehicle_plan_id": "uuid",
    "session_id": "uuid",
    "zone_id": "uuid",
    "zone_name": "Nasr City",
    "shipping_company_id": "uuid",
    "shipping_company_name": "Fast Delivery Co",
    "vehicle_slots_count": 3,
    "orders_count": 47,
    "total_weight_kg": 420.5,
    "requires_planner_review": true
  }
}
```

**Consumers:**

| Consumer | Module | Action |
|---|---|---|
| `PlannerReviewNotifier` | Operations.Loading | Notifies dispatcher if review required |
| `TimelineService` | Core.Timeline | Writes timeline entry on session |
| `AuditService` | Core.Audit | Writes audit log |

---

### EVT-LOAD-003 — VehicleAssigned

**Business Meaning:** A physical vehicle (and optionally a driver) has been assigned to a vehicle plan slot.

| Field | Value |
|---|---|
| Event Type | `loading.vehicle.assigned` |
| Version | `1.0` |
| Producer | `Operations.Loading.AssignVehicleAction` |

**Payload:**
```json
{
  "event_id": "uuid",
  "event_type": "loading.vehicle.assigned",
  "event_version": "1.0",
  "company_id": "uuid",
  "actor_id": "uuid",
  "actor_type": "user",
  "occurred_at": "2026-07-05T09:15:00Z",
  "data": {
    "assignment_id": "uuid",
    "session_id": "uuid",
    "vehicle_plan_id": "uuid",
    "vehicle_id": "uuid",
    "vehicle_plate": "ABC-1234",
    "driver_id": "uuid",
    "driver_name": "Ahmed Hassan",
    "orders_count": 15,
    "expected_weight_kg": 140.0,
    "capacity_utilization_pct": 87.5
  }
}
```

**Consumers:**

| Consumer | Module | Action |
|---|---|---|
| `DriverNotificationListener` | Operations.Loading | Notifies driver of assignment |
| `VehicleAvailabilityListener` | Fleet | Marks vehicle as allocated |
| `TimelineService` | Core.Timeline | Writes timeline entry |
| `AuditService` | Core.Audit | Writes audit log |

---

### EVT-LOAD-004 — VehicleLoaded

**Business Meaning:** All loading tasks for a vehicle assignment are complete. Products have physically moved from the Pool into the vehicle.

| Field | Value |
|---|---|
| Event Type | `loading.vehicle.loaded` |
| Version | `1.0` |
| Producer | `Operations.Loading.LoadVehicleAction` |

**Payload:**
```json
{
  "event_id": "uuid",
  "event_type": "loading.vehicle.loaded",
  "event_version": "1.0",
  "company_id": "uuid",
  "actor_id": "uuid",
  "actor_type": "user",
  "occurred_at": "2026-07-05T10:30:00Z",
  "data": {
    "assignment_id": "uuid",
    "session_id": "uuid",
    "vehicle_id": "uuid",
    "vehicle_plate": "ABC-1234",
    "items_loaded_count": 12,
    "total_units_loaded": 85.0,
    "total_weight_kg": 138.5,
    "discrepancies_count": 0,
    "loaded_at": "2026-07-05T10:30:00Z"
  }
}
```

**Consumers:**

| Consumer | Module | Action |
|---|---|---|
| `AllocationTriggerListener` | Operations.Loading | Triggers auto-allocation if mode = `full_auto` |
| `PreparedPoolListener` | Operations.Preparation | Updates pool entry status to `loaded` |
| `InventoryListener` | Inventory | Decrements warehouse reserved stock |
| `TimelineService` | Core.Timeline | Writes timeline entry |
| `AuditService` | Core.Audit | Writes audit log |

---

### EVT-LOAD-005 — AllocationCompleted

**Business Meaning:** Vehicle inventory has been allocated to orders on this vehicle. Each order now has a definitive delivery manifest entry for this vehicle.

| Field | Value |
|---|---|
| Event Type | `loading.allocation.completed` |
| Version | `1.0` |
| Producer | `Operations.Loading.AllocateProductsAction` |

**Payload:**
```json
{
  "event_id": "uuid",
  "event_type": "loading.allocation.completed",
  "event_version": "1.0",
  "company_id": "uuid",
  "actor_id": "uuid",
  "actor_type": "system",
  "occurred_at": "2026-07-05T10:35:00Z",
  "data": {
    "assignment_id": "uuid",
    "session_id": "uuid",
    "vehicle_id": "uuid",
    "allocation_mode": "full_auto",
    "orders_allocated": 15,
    "orders_partial": 1,
    "orders_unallocated": 0,
    "total_units_allocated": 83.0,
    "total_units_short": 2.0,
    "requires_approval": true
  }
}
```

**Consumers:**

| Consumer | Module | Action |
|---|---|---|
| `AllocationApprovalNotifier` | Operations.Loading | Notifies loading manager to review |
| `OrderStatusListener` | Orders | Updates order fulfillment status to `allocated` |
| `PartialAlertListener` | Operations.Loading | Raises exception for partial allocations |
| `TimelineService` | Core.Timeline | Writes timeline entry |
| `AuditService` | Core.Audit | Writes audit log |

---

### EVT-LOAD-006 — AllocationAdjusted

**Business Meaning:** A dispatcher manually adjusted the allocation for one or more orders after the initial allocation ran. This is an override event — always actor-stamped.

| Field | Value |
|---|---|
| Event Type | `loading.allocation.adjusted` |
| Version | `1.0` |
| Producer | `Operations.Loading.OverrideAllocationAction` |

**Payload:**
```json
{
  "event_id": "uuid",
  "event_type": "loading.allocation.adjusted",
  "event_version": "1.0",
  "company_id": "uuid",
  "actor_id": "uuid",
  "actor_type": "user",
  "occurred_at": "2026-07-05T10:40:00Z",
  "data": {
    "assignment_id": "uuid",
    "adjustments": [
      {
        "allocation_record_id": "uuid",
        "order_id": "uuid",
        "product_id": "uuid",
        "before_qty": 3.0,
        "after_qty": 2.0,
        "reason": "Customer requested partial delivery"
      }
    ]
  }
}
```

**Consumers:**

| Consumer | Module | Action |
|---|---|---|
| `OrderStatusListener` | Orders | Re-syncs order fulfillment quantities |
| `TimelineService` | Core.Timeline | Writes timeline entry |
| `AuditService` | Core.Audit | Writes audit log (mandatory override record) |

---

### EVT-LOAD-007 — DriverAssigned

**Business Meaning:** A driver has been linked to a vehicle assignment.

| Field | Value |
|---|---|
| Event Type | `loading.driver.assigned` |
| Version | `1.0` |
| Producer | `Operations.Loading.AssignDriverAction` |

**Payload:**
```json
{
  "event_id": "uuid",
  "event_type": "loading.driver.assigned",
  "event_version": "1.0",
  "company_id": "uuid",
  "actor_id": "uuid",
  "actor_type": "user",
  "occurred_at": "2026-07-05T09:10:00Z",
  "data": {
    "driver_assignment_id": "uuid",
    "assignment_id": "uuid",
    "driver_id": "uuid",
    "driver_name": "Ahmed Hassan",
    "vehicle_plate": "ABC-1234",
    "route_orders_count": 15,
    "estimated_departure": "2026-07-05T11:00:00Z"
  }
}
```

**Consumers:**

| Consumer | Module | Action |
|---|---|---|
| `DriverNotificationListener` | Operations.Loading | Push notification to driver's mobile |
| `TimelineService` | Core.Timeline | Writes timeline entry |
| `AuditService` | Core.Audit | Writes audit log |

---

### EVT-LOAD-008 — VehicleReleased

**Business Meaning:** A vehicle has physically departed the warehouse with its load. This is the handoff point to the Logistics OS.

| Field | Value |
|---|---|
| Event Type | `loading.vehicle.released` |
| Version | `1.0` |
| Producer | `Operations.Loading.ReleaseVehicleAction` |

**Payload:**
```json
{
  "event_id": "uuid",
  "event_type": "loading.vehicle.released",
  "event_version": "1.0",
  "company_id": "uuid",
  "actor_id": "uuid",
  "actor_type": "user",
  "occurred_at": "2026-07-05T11:05:00Z",
  "data": {
    "assignment_id": "uuid",
    "session_id": "uuid",
    "vehicle_id": "uuid",
    "vehicle_plate": "ABC-1234",
    "driver_id": "uuid",
    "driver_name": "Ahmed Hassan",
    "orders_count": 15,
    "total_stops": 12,
    "route_plan_id": "uuid",
    "released_at": "2026-07-05T11:05:00Z",
    "estimated_return_at": "2026-07-05T18:00:00Z"
  }
}
```

**Consumers:**

| Consumer | Module | Action |
|---|---|---|
| `LogisticsHandoffListener` | Logistics | Creates Shipment record in Logistics OS |
| `OrderStatusListener` | Orders | Updates order status to `out_for_delivery` |
| `DriverActivationListener` | Operations.Loading | Activates driver mobile tracking |
| `TimelineService` | Core.Timeline | Writes timeline entry |
| `AuditService` | Core.Audit | Writes audit log |

---

### EVT-LOAD-009 — LoadingSessionClosed

**Business Meaning:** All vehicles for this session have been released. The Loading Session is archived. All manifests are finalized.

| Field | Value |
|---|---|
| Event Type | `loading.session.closed` |
| Version | `1.0` |
| Producer | `Operations.Loading.CloseLoadingSessionAction` |

**Payload:**
```json
{
  "event_id": "uuid",
  "event_type": "loading.session.closed",
  "event_version": "1.0",
  "company_id": "uuid",
  "actor_id": "uuid",
  "actor_type": "user",
  "occurred_at": "2026-07-05T11:10:00Z",
  "data": {
    "session_id": "uuid",
    "session_number": "LOAD-202607-000001",
    "planning_date": "2026-07-05",
    "vehicles_released": 4,
    "orders_dispatched": 58,
    "total_units_shipped": 312.0,
    "partial_orders_count": 1,
    "closed_at": "2026-07-05T11:10:00Z"
  }
}
```

**Consumers:**

| Consumer | Module | Action |
|---|---|---|
| `AnalyticsListener` | Operations.Analytics | Updates daily loading KPIs |
| `PreparationFeedbackListener` | Operations.Preparation | Sends completion signal back to Prep OS |
| `NotificationService` | Core.Notifications | Sends session summary to loading manager |
| `TimelineService` | Core.Timeline | Writes final timeline entry |
| `AuditService` | Core.Audit | Writes audit log |

---

### EVT-LOAD-010 — LoadingSessionCancelled

**Business Meaning:** A loading session was cancelled before vehicles were released. All pool entries are returned to `available` status.

| Field | Value |
|---|---|
| Event Type | `loading.session.cancelled` |
| Version | `1.0` |
| Producer | `Operations.Loading.CancelLoadingSessionAction` |

**Payload:**
```json
{
  "event_id": "uuid",
  "event_type": "loading.session.cancelled",
  "event_version": "1.0",
  "company_id": "uuid",
  "actor_id": "uuid",
  "actor_type": "user",
  "occurred_at": "2026-07-05T09:30:00Z",
  "data": {
    "session_id": "uuid",
    "session_number": "LOAD-202607-000002",
    "cancelled_at": "2026-07-05T09:30:00Z",
    "cancellation_reason": "Planning date changed",
    "pool_entries_released": 45,
    "vehicles_unassigned": 2
  }
}
```

**Consumers:**

| Consumer | Module | Action |
|---|---|---|
| `PoolReleaseListener` | Operations.Preparation | Returns pool entries to `available` |
| `VehicleAvailabilityListener` | Fleet | Marks vehicles as available again |
| `DriverNotificationListener` | Operations.Loading | Notifies assigned drivers of cancellation |
| `TimelineService` | Core.Timeline | Writes timeline entry |
| `AuditService` | Core.Audit | Writes audit log |

---

### EVT-LOAD-011 — VehiclePlanRecalculated

**Business Meaning:** A vehicle plan was recalculated (replanning flow) due to pool changes or dispatcher intervention.

| Field | Value |
|---|---|
| Event Type | `loading.vehicle_plan.recalculated` |
| Version | `1.0` |
| Producer | `Operations.Loading.RecalculateVehiclePlanAction` |

**Payload:**
```json
{
  "event_id": "uuid",
  "event_type": "loading.vehicle_plan.recalculated",
  "event_version": "1.0",
  "company_id": "uuid",
  "actor_id": "uuid",
  "actor_type": "user",
  "occurred_at": "2026-07-05T09:45:00Z",
  "data": {
    "new_vehicle_plan_id": "uuid",
    "previous_vehicle_plan_id": "uuid",
    "session_id": "uuid",
    "recalculation_reason": "New pool entries available",
    "previous_slots_count": 2,
    "new_slots_count": 3,
    "assignments_reset": 2
  }
}
```

**Consumers:**

| Consumer | Module | Action |
|---|---|---|
| `PlannerReviewNotifier` | Operations.Loading | Notifies dispatcher of new plan |
| `TimelineService` | Core.Timeline | Writes timeline entry |
| `AuditService` | Core.Audit | Writes audit log |

---

## 3. Event Summary Table

| ID | Event Type | Producer | Key Consumers | Version |
|---|---|---|---|---|
| EVT-LOAD-001 | `loading.session.created` | CreateLoadingSessionAction | GeographyEngine, Notifications, Timeline | 1.0 |
| EVT-LOAD-002 | `loading.vehicle_plan.generated` | GenerateVehiclePlanAction | PlannerReview, Timeline | 1.0 |
| EVT-LOAD-003 | `loading.vehicle.assigned` | AssignVehicleAction | Driver notification, Fleet, Timeline | 1.0 |
| EVT-LOAD-004 | `loading.vehicle.loaded` | LoadVehicleAction | AllocationTrigger, Pool, Inventory, Timeline | 1.0 |
| EVT-LOAD-005 | `loading.allocation.completed` | AllocateProductsAction | Order status, Approval notification, Timeline | 1.0 |
| EVT-LOAD-006 | `loading.allocation.adjusted` | OverrideAllocationAction | Order status, Audit, Timeline | 1.0 |
| EVT-LOAD-007 | `loading.driver.assigned` | AssignDriverAction | Driver push notification, Timeline | 1.0 |
| EVT-LOAD-008 | `loading.vehicle.released` | ReleaseVehicleAction | Logistics handoff, Order status, Timeline | 1.0 |
| EVT-LOAD-009 | `loading.session.closed` | CloseLoadingSessionAction | Analytics, Preparation feedback, Timeline | 1.0 |
| EVT-LOAD-010 | `loading.session.cancelled` | CancelLoadingSessionAction | Pool release, Fleet, Drivers, Timeline | 1.0 |
| EVT-LOAD-011 | `loading.vehicle_plan.recalculated` | RecalculateVehiclePlanAction | Planner review, Timeline | 1.0 |

---

## 4. Inbound Events (Events Consumed by Loading OS)

| Event | Source | Loading OS Consumer | Action |
|---|---|---|---|
| `preparation.wave.completed` | Preparation OS | `PrepWaveCompletedListener` | Checks if pool entries are now available for loading |
| `preparation.pool.entry.available` | Preparation OS | `PoolEntryAvailableListener` | Updates loading session pool_entry_count if session is in `planning` |
| `logistics.delivery.completed` | Logistics OS | `DeliveryCompletedListener` | Updates vehicle inventory item status to `delivered` |
| `logistics.delivery.failed` | Logistics OS | `DeliveryFailedListener` | Records return; updates allocation record |
| `orders.order.cancelled` | Orders | `OrderCancelledListener` | Removes order from vehicle plan if session not yet in `loading` |
