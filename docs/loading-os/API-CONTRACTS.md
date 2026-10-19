# Loading & Allocation OS — API Contracts

**Document:** API-CONTRACTS  
**Version:** 1.0  
**Status:** APPROVED — Engineering Design Phase  
**Date:** 2026-07-05  
**Task:** TASK-LOAD-001  
**Parent:** LOADING-ALLOCATION-OS-SPEC.md  
**API Standards:** docs/07_API_Standards.md

---

## 1. Base URL

```
/api/v1/loading
```

All routes are company-scoped via the authenticated user's company context. `company_id` is **never** accepted in request bodies — it is always derived from `auth()->user()->company_id`.

---

## 2. Global Headers

| Header | Value | Required |
|---|---|---|
| `Authorization` | `Bearer {sanctum_token}` | Yes |
| `Accept` | `application/json` | Yes |
| `Content-Type` | `application/json` | Yes (commands only) |

---

## 3. Feature Flags

All Loading OS endpoints require the following feature flags to be enabled. If either flag is disabled, the controller returns **503** before evaluating any business logic:

| Flag | Scope | Effect if disabled |
|---|---|---|
| `modules.loading_allocation_os` | Company | All endpoints return 503 |
| `workflow.stages.loading` | Company | All endpoints return 503 |

**503 Response (feature flag disabled):**
```json
{
  "message": "Module not enabled",
  "code": "MODULE_DISABLED"
}
```

---

## 4. Command Contracts

Commands change state. All commands require authentication and return the mutated resource or a status confirmation.

---

### CMD-001 — Create Loading Session

**Method:** `POST`  
**URL:** `/api/v1/loading/sessions`  
**Permission:** `loading.session.create`  
**Feature flags:** `modules.loading_allocation_os`, `workflow.stages.loading`  
**State precondition:** Referenced `vehicle_plan_id` must be in `approved` status; referenced vehicle must be in `available` status; referenced `wave_id` must not already have an active (non-cancelled, non-closed) Loading Session for this vehicle.

**Request Body:**
```json
{
  "wave_id": "uuid",
  "vehicle_plan_id": "uuid",
  "vehicle_assignment_id": "uuid",
  "operator_id": "uuid",
  "planned_start_at": "2026-07-05T06:00:00Z",
  "notes": "Morning run — Zone A vehicles"
}
```

**Validation:**
| Field | Type | Rules |
|---|---|---|
| `wave_id` | UUID | required; must exist; must belong to user's company; `ShippingWave` must be in `approved` status |
| `vehicle_plan_id` | UUID | required; must exist; must belong to same `wave_id`; VehiclePlan must be `approved` |
| `vehicle_assignment_id` | UUID | required; must exist within the vehicle plan; vehicle must be `available`; driver must be assigned |
| `operator_id` | UUID | required; must be an active employee of the company; must have `loading.session.operate` permission |
| `planned_start_at` | ISO 8601 datetime | optional; must be >= now |
| `notes` | string | optional; max 1000 chars |

**Response (201 Created):**
```json
{
  "data": {
    "id": "uuid",
    "session_number": "LOAD-202607-000001",
    "status": "planned",
    "wave_id": "uuid",
    "wave_number": "WAVE-202607-000045",
    "vehicle_plan_id": "uuid",
    "vehicle_assignment_id": "uuid",
    "vehicle": {
      "id": "uuid",
      "registration_number": "ABC-1234",
      "vehicle_type": "van",
      "capacity_weight_kg": 800.00,
      "capacity_volume_m3": 4.5000,
      "refrigerated": false
    },
    "driver": {
      "id": "uuid",
      "name": "Khaled Mahmoud"
    },
    "operator": {
      "id": "uuid",
      "name": "Ahmed Hassan"
    },
    "required_products": [
      {
        "product_id": "uuid",
        "sku": "HONEY-500G",
        "name": "Raw Honey 500g",
        "quantity_required": 420.0,
        "quantity_loaded": 0.0
      }
    ],
    "total_orders": 40,
    "total_weight_required_kg": 624.50,
    "total_volume_required_m3": 3.1200,
    "utilization_pct": 78.1,
    "planned_start_at": "2026-07-05T06:00:00Z",
    "config_version_id": "uuid",
    "created_at": "2026-07-05T05:45:00Z"
  }
}
```

**Error Responses:**
| Status | Code | When |
|---|---|---|
| 422 | `WAVE_NOT_APPROVED` | ShippingWave is not in `approved` status |
| 422 | `VEHICLE_PLAN_NOT_APPROVED` | VehiclePlan is not in `approved` status |
| 422 | `VEHICLE_NOT_AVAILABLE` | Vehicle status is not `available` |
| 422 | `DRIVER_NOT_ASSIGNED` | VehicleAssignment has no driver linked |
| 422 | `SESSION_ALREADY_EXISTS` | An active Loading Session already exists for this vehicle + wave combination |
| 422 | `OPERATOR_PERMISSION_DENIED` | Nominated operator lacks `loading.session.operate` permission |
| 404 | `WAVE_NOT_FOUND` | Wave does not exist or is inaccessible |
| 404 | `VEHICLE_PLAN_NOT_FOUND` | VehiclePlan not found |
| 404 | `VEHICLE_ASSIGNMENT_NOT_FOUND` | VehicleAssignment not found within this plan |
| 403 | `FORBIDDEN` | Auth user lacks `loading.session.create` permission |

---

### CMD-002 — Generate Vehicle Plan

**Method:** `POST`  
**URL:** `/api/v1/loading/sessions/{id}/generate-vehicle-plan`  
**Permission:** `loading.session.plan`  
**Feature flags:** `modules.loading_allocation_os`, `workflow.stages.loading`  
**State precondition:** Session must be in `planned` status. Calls the Vehicle Planning Engine to compute required product quantities from the wave's order manifest and validates capacity constraints against the assigned vehicle.

**Request Body:** *(none required)*

**Response (200 OK):**
```json
{
  "data": {
    "id": "uuid",
    "session_number": "LOAD-202607-000001",
    "status": "planned",
    "vehicle_plan": {
      "total_orders": 40,
      "total_products": 12,
      "total_weight_kg": 624.50,
      "total_volume_m3": 3.1200,
      "utilization_pct": 78.1,
      "is_overloaded": false,
      "capacity_violations": []
    },
    "required_products": [
      {
        "product_id": "uuid",
        "sku": "HONEY-500G",
        "name": "Raw Honey 500g",
        "unit": "unit",
        "quantity_required": 420.0,
        "weight_kg": 210.00,
        "volume_m3": 1.0500,
        "pool_available": 418.0,
        "pool_shortage": true,
        "shortage_amount": 2.0
      }
    ],
    "pool_warnings": [
      {
        "product_id": "uuid",
        "sku": "HONEY-500G",
        "required": 420.0,
        "available_in_pool": 418.0,
        "shortage": 2.0,
        "severity": "warning"
      }
    ],
    "generated_at": "2026-07-05T05:50:00Z"
  }
}
```

**Error Responses:**
| Status | Code | When |
|---|---|---|
| 422 | `SESSION_NOT_IN_PLANNED_STATUS` | Session is not in `planned` status |
| 422 | `VEHICLE_CAPACITY_EXCEEDED` | Total weight or volume exceeds vehicle capacity |
| 422 | `POOL_ENTIRELY_EMPTY` | Prepared Products Pool has zero units available for all required products |
| 404 | `SESSION_NOT_FOUND` | Loading Session does not exist or is inaccessible |
| 403 | `FORBIDDEN` | Auth user lacks `loading.session.plan` permission |

---

### CMD-003 — Recalculate Vehicle Plan

**Method:** `POST`  
**URL:** `/api/v1/loading/vehicle-plans/{id}/recalculate`  
**Permission:** `loading.session.plan`  
**Feature flags:** `modules.loading_allocation_os`, `workflow.stages.loading`, `modules.loading_allocation_os.replanning`  
**State precondition:** The Loading Session linked to this VehiclePlan must be in `planned` status (not yet open). Recalculation is blocked once loading has begun.

**Request Body:**
```json
{
  "add_order_ids": ["uuid", "uuid"],
  "remove_order_ids": ["uuid"],
  "reason": "Two late orders added to this vehicle slot"
}
```

**Validation:**
| Field | Type | Rules |
|---|---|---|
| `add_order_ids` | UUID[] | optional; each order must exist, be in `reserved` status, belong to this wave, and not already be on another vehicle assignment |
| `remove_order_ids` | UUID[] | optional; each order must currently be assigned to this vehicle plan slot |
| `reason` | string | required; min 10 chars |

**Response (200 OK):**
```json
{
  "data": {
    "id": "uuid",
    "status": "proposed",
    "slot_number": 1,
    "orders_count": 42,
    "total_weight_kg": 648.75,
    "total_volume_m3": 3.2400,
    "utilization_pct": 81.1,
    "is_overloaded": false,
    "required_products": [
      {
        "product_id": "uuid",
        "sku": "HONEY-500G",
        "quantity_required": 438.0,
        "pool_available": 418.0,
        "pool_shortage": true,
        "shortage_amount": 20.0
      }
    ],
    "recalculated_at": "2026-07-05T05:55:00Z",
    "recalculated_by": "uuid"
  }
}
```

**Error Responses:**
| Status | Code | When |
|---|---|---|
| 422 | `CANNOT_RECALCULATE_AFTER_LOADING_STARTED` | Associated Loading Session is in `open`, `completed`, or `closed_with_exceptions` status |
| 422 | `REPLANNING_NOT_ENABLED` | Feature flag `modules.loading_allocation_os.replanning` is disabled |
| 422 | `ORDER_NOT_IN_WAVE` | One or more `add_order_ids` do not belong to this wave |
| 422 | `ORDER_ALREADY_ON_ANOTHER_VEHICLE` | One or more `add_order_ids` are already assigned to a different vehicle slot |
| 422 | `ORDER_NOT_IN_SLOT` | One or more `remove_order_ids` are not in this vehicle plan slot |
| 422 | `PLAN_WOULD_HAVE_ZERO_ORDERS` | Removal would leave the vehicle with no orders |
| 422 | `VEHICLE_CAPACITY_EXCEEDED` | Recalculation result exceeds vehicle capacity |
| 404 | `VEHICLE_PLAN_NOT_FOUND` | VehiclePlan not found |
| 403 | `FORBIDDEN` | Auth user lacks `loading.session.plan` permission |

---

### CMD-004 — Assign Orders

**Method:** `POST`  
**URL:** `/api/v1/loading/vehicle-plans/{id}/assign-orders`  
**Permission:** `loading.orders.assign`  
**Feature flags:** `modules.loading_allocation_os`, `workflow.stages.loading`  
**State precondition:** VehiclePlan must be in `proposed` status. This finalises order-to-vehicle mapping before the Loading Session is opened. After this command, orders cannot be moved without a recalculate or exception.

**Request Body:**
```json
{
  "order_assignments": [
    {
      "order_id": "uuid",
      "slot_number": 1
    },
    {
      "order_id": "uuid",
      "slot_number": 2
    }
  ],
  "notes": "Manually adjusted — Zone A orders consolidated"
}
```

**Validation:**
| Field | Type | Rules |
|---|---|---|
| `order_assignments` | array | required; min 1 item |
| `order_assignments[].order_id` | UUID | required; must exist; must belong to this wave; must be `reserved` status |
| `order_assignments[].slot_number` | int | required; must reference a valid slot number in this VehiclePlan |
| `notes` | string | optional; max 1000 chars |

**Response (200 OK):**
```json
{
  "data": {
    "id": "uuid",
    "status": "approved",
    "slots": [
      {
        "slot_number": 1,
        "vehicle_id": "uuid",
        "orders_count": 22,
        "total_weight_kg": 318.40,
        "utilization_pct": 39.8
      },
      {
        "slot_number": 2,
        "vehicle_id": "uuid",
        "orders_count": 20,
        "total_weight_kg": 306.35,
        "utilization_pct": 38.3
      }
    ],
    "assigned_at": "2026-07-05T05:58:00Z",
    "assigned_by": "uuid"
  }
}
```

**Error Responses:**
| Status | Code | When |
|---|---|---|
| 422 | `PLAN_NOT_IN_PROPOSED_STATUS` | VehiclePlan is not in `proposed` status |
| 422 | `ORDER_NOT_IN_WAVE` | Order does not belong to this wave |
| 422 | `ORDER_NOT_RESERVED` | Order is not in `reserved` status |
| 422 | `SLOT_NOT_FOUND` | Referenced slot_number does not exist in this plan |
| 422 | `SLOT_CAPACITY_EXCEEDED` | Assignment would overload a slot |
| 422 | `DUPLICATE_ORDER_ASSIGNMENT` | Same order assigned to more than one slot |
| 404 | `VEHICLE_PLAN_NOT_FOUND` | VehiclePlan not found |
| 403 | `FORBIDDEN` | Auth user lacks `loading.orders.assign` permission |

---

### CMD-005 — Assign Products

**Method:** `POST`  
**URL:** `/api/v1/loading/vehicle-assignments/{id}/assign-products`  
**Permission:** `loading.products.assign`  
**Feature flags:** `modules.loading_allocation_os`, `workflow.stages.loading`  
**State precondition:** VehicleAssignment must be in `confirmed` status. The associated Loading Session must be in `planned` status. This maps required products (derived from orders) to specific pool entries, reserving them for this loading operation.

**Request Body:**
```json
{
  "product_assignments": [
    {
      "product_id": "uuid",
      "pool_entry_id": "uuid",
      "quantity": 420.0
    },
    {
      "product_id": "uuid",
      "pool_entry_id": "uuid",
      "quantity": 180.0
    }
  ]
}
```

**Validation:**
| Field | Type | Rules |
|---|---|---|
| `product_assignments` | array | required; min 1 item |
| `product_assignments[].product_id` | UUID | required; must be in the session's required products list |
| `product_assignments[].pool_entry_id` | UUID | required; must exist in the Prepared Products Pool; must belong to user's company; `quality_status` must be `passed`; must have sufficient `quantity_available` |
| `product_assignments[].quantity` | decimal | required; > 0; must not exceed pool entry's `quantity_available`; must not exceed the product's `quantity_required` for this assignment by more than 10% overage tolerance |

**Response (200 OK):**
```json
{
  "data": {
    "id": "uuid",
    "status": "confirmed",
    "product_assignments": [
      {
        "product_id": "uuid",
        "sku": "HONEY-500G",
        "pool_entry_id": "uuid",
        "quantity_required": 420.0,
        "quantity_assigned": 420.0,
        "quantity_short": 0.0,
        "is_fully_assigned": true
      }
    ],
    "assignment_complete": true,
    "unassigned_products": [],
    "assigned_at": "2026-07-05T06:00:00Z"
  }
}
```

**Error Responses:**
| Status | Code | When |
|---|---|---|
| 422 | `ASSIGNMENT_NOT_IN_CONFIRMED_STATUS` | VehicleAssignment is not in `confirmed` status |
| 422 | `SESSION_NOT_IN_PLANNED_STATUS` | Loading Session is not in `planned` status |
| 422 | `POOL_ENTRY_NOT_FOUND` | Pool entry does not exist or is inaccessible |
| 422 | `POOL_ENTRY_QUALITY_FAILED` | Pool entry `quality_status` is not `passed` |
| 422 | `INSUFFICIENT_POOL_QUANTITY` | Requested quantity exceeds pool entry's `quantity_available` |
| 422 | `PRODUCT_NOT_IN_SESSION` | product_id is not in this session's required products |
| 422 | `QUANTITY_EXCEEDS_REQUIREMENT` | Assigned quantity exceeds required + overage tolerance |
| 404 | `VEHICLE_ASSIGNMENT_NOT_FOUND` | VehicleAssignment not found |
| 403 | `FORBIDDEN` | Auth user lacks `loading.products.assign` permission |

---

### CMD-006 — Load Vehicle

**Method:** `POST`  
**URL:** `/api/v1/loading/vehicle-assignments/{id}/load`  
**Permission:** `loading.session.operate`  
**Feature flags:** `modules.loading_allocation_os`, `workflow.stages.loading`  
**State precondition:** VehicleAssignment must be in `confirmed` status. Associated Loading Session must be in `planned` status. All required products must have product assignments (from CMD-005). Transitions Session to `open`; vehicle status transitions to `loading`.  
**Side effects:** Sets `LoadingSession.status = open`; sets `Vehicle.status = loading`; records `loading_session.opened` event.

**Request Body:**
```json
{
  "started_at": "2026-07-05T06:05:00Z"
}
```

**Validation:**
| Field | Type | Rules |
|---|---|---|
| `started_at` | ISO 8601 datetime | optional; defaults to `now()`; must not be in the future by more than 15 minutes |

**Response (200 OK):**
```json
{
  "data": {
    "id": "uuid",
    "status": "loading",
    "session": {
      "id": "uuid",
      "session_number": "LOAD-202607-000001",
      "status": "open",
      "opened_at": "2026-07-05T06:05:00Z",
      "opened_by": "uuid"
    },
    "vehicle": {
      "id": "uuid",
      "registration_number": "ABC-1234",
      "status": "loading"
    },
    "products_to_load": [
      {
        "product_id": "uuid",
        "sku": "HONEY-500G",
        "quantity_required": 420.0,
        "quantity_loaded": 0.0,
        "pool_entry_id": "uuid"
      }
    ]
  }
}
```

**Error Responses:**
| Status | Code | When |
|---|---|---|
| 422 | `ASSIGNMENT_NOT_IN_CONFIRMED_STATUS` | VehicleAssignment is not in `confirmed` status |
| 422 | `SESSION_NOT_IN_PLANNED_STATUS` | Loading Session is not in `planned` status |
| 422 | `PRODUCTS_NOT_ASSIGNED` | One or more required products have no pool assignment; call CMD-005 first |
| 422 | `VEHICLE_NOT_AVAILABLE` | Vehicle is no longer in `available` status (e.g., assigned to another session) |
| 404 | `VEHICLE_ASSIGNMENT_NOT_FOUND` | VehicleAssignment not found |
| 403 | `FORBIDDEN` | Auth user lacks `loading.session.operate` permission |

---

### CMD-007 — Allocate Products

**Method:** `POST`  
**URL:** `/api/v1/loading/vehicle-assignments/{id}/allocate`  
**Permission:** `loading.allocation.run`  
**Feature flags:** `modules.loading_allocation_os`, `workflow.stages.loading`, `modules.product_allocation`  
**State precondition:** VehicleAssignment must be in `loading` status. Loading Session must be in `open` status. Triggers the Product Allocation Engine to distribute vehicle inventory to orders. Can be run multiple times (idempotent in `full_auto` mode; creates a new revision in manual/ai_suggested modes).

**Request Body:**
```json
{
  "allocation_mode": "full_auto",
  "override_reason": null
}
```

**Validation:**
| Field | Type | Rules |
|---|---|---|
| `allocation_mode` | enum | optional; values: `full_auto`, `partial_auto`, `manual`, `ai_suggested`, `priority`, `fifo`, `custom_policy`; defaults to company's configured allocation mode |
| `override_reason` | string | required when `allocation_mode` differs from the channel's configured mode; min 10 chars |

**Response (200 OK):**
```json
{
  "data": {
    "id": "uuid",
    "allocation_status": "completed",
    "allocation_mode": "full_auto",
    "summary": {
      "total_orders": 40,
      "fully_allocated_orders": 38,
      "partially_allocated_orders": 2,
      "unallocated_orders": 0,
      "total_products": 12,
      "allocation_coverage_pct": 95.0
    },
    "allocations": [
      {
        "order_id": "uuid",
        "order_number": "ORD-202607-000234",
        "priority_rank": 1,
        "is_partial": false,
        "lines": [
          {
            "order_line_id": "uuid",
            "product_id": "uuid",
            "sku": "HONEY-500G",
            "quantity_requested": 10.0,
            "quantity_allocated": 10.0
          }
        ]
      }
    ],
    "exceptions": [
      {
        "order_id": "uuid",
        "type": "partial_allocation",
        "severity": "warning",
        "message": "Order partially allocated — 2 units of HONEY-500G unavailable"
      }
    ],
    "allocated_at": "2026-07-05T06:20:00Z"
  }
}
```

**Error Responses:**
| Status | Code | When |
|---|---|---|
| 422 | `ASSIGNMENT_NOT_IN_LOADING_STATUS` | VehicleAssignment is not in `loading` status |
| 422 | `SESSION_NOT_OPEN` | Loading Session is not in `open` status |
| 422 | `ALLOCATION_MODULE_DISABLED` | Feature flag `modules.product_allocation` is disabled |
| 422 | `PARTIAL_ALLOCATION_NOT_ALLOWED` | Partial allocation exists but profile forbids partial delivery (blocking exception) |
| 422 | `OVERRIDE_REASON_REQUIRED` | `allocation_mode` differs from channel config but no `override_reason` provided |
| 422 | `NO_VEHICLE_INVENTORY` | Vehicle has no inventory loaded yet — call CMD-006 and physically load first |
| 404 | `VEHICLE_ASSIGNMENT_NOT_FOUND` | VehicleAssignment not found |
| 403 | `FORBIDDEN` | Auth user lacks `loading.allocation.run` permission |

---

### CMD-008 — Approve Allocation

**Method:** `POST`  
**URL:** `/api/v1/loading/vehicle-assignments/{id}/approve-allocation`  
**Permission:** `loading.allocation.approve`  
**Feature flags:** `modules.loading_allocation_os`, `workflow.stages.loading`  
**State precondition:** VehicleAssignment must be in `loading` status. Allocation must have been run (CMD-007) and must be in `completed` or `pending_review` status. Required when `allocation_mode` is `manual` or `ai_suggested`, or when exceptions are present.

**Request Body:**
```json
{
  "approved": true,
  "notes": "Partial allocations on 2 COD orders accepted — supervisor reviewed",
  "exception_resolutions": [
    {
      "exception_id": "uuid",
      "resolution": "accepted",
      "resolution_notes": "Customer notified of shortage"
    }
  ]
}
```

**Validation:**
| Field | Type | Rules |
|---|---|---|
| `approved` | boolean | required |
| `notes` | string | optional; max 1000 chars |
| `exception_resolutions` | array | required if any blocking exceptions exist on the allocation |
| `exception_resolutions[].exception_id` | UUID | required; must be an open exception on this assignment |
| `exception_resolutions[].resolution` | enum | required; values: `accepted`, `rejected`, `escalated` |
| `exception_resolutions[].resolution_notes` | string | required when `resolution = rejected` or `escalated`; min 10 chars |

**Response (200 OK):**
```json
{
  "data": {
    "id": "uuid",
    "allocation_approved": true,
    "allocation_approved_at": "2026-07-05T06:30:00Z",
    "allocation_approved_by": "uuid",
    "open_exceptions": 0,
    "blocking_exceptions": 0,
    "ready_for_release": true
  }
}
```

**Error Responses:**
| Status | Code | When |
|---|---|---|
| 422 | `ASSIGNMENT_NOT_IN_LOADING_STATUS` | VehicleAssignment is not in `loading` status |
| 422 | `ALLOCATION_NOT_RUN` | No allocation has been executed for this assignment yet |
| 422 | `BLOCKING_EXCEPTIONS_NOT_RESOLVED` | One or more blocking-severity exceptions remain unresolved |
| 422 | `EXCEPTION_RESOLUTION_REQUIRED` | `exception_resolutions` is missing but blocking exceptions exist |
| 404 | `VEHICLE_ASSIGNMENT_NOT_FOUND` | VehicleAssignment not found |
| 403 | `FORBIDDEN` | Auth user lacks `loading.allocation.approve` permission |

---

### CMD-009 — Release Vehicle

**Method:** `POST`  
**URL:** `/api/v1/loading/vehicle-assignments/{id}/release`  
**Permission:** `loading.vehicle.release`  
**Feature flags:** `modules.loading_allocation_os`, `workflow.stages.loading`  
**State precondition:** VehicleAssignment must be in `loading` status. Allocation must be approved (CMD-008). Vehicle must have a confirmed driver assignment. If `fulfillment.vehicle.require_driver_before_dispatch` policy is enabled, driver assignment is strictly enforced.  
**Side effects:** Sets `VehicleAssignment.status = dispatched`; sets `Vehicle.status = in_transit`; publishes `shipping_wave.loading_complete` event (if all vehicles in wave are dispatched); triggers Logistics OS handoff.

**Request Body:**
```json
{
  "actual_departure_at": "2026-07-05T06:35:00Z",
  "driver_id": "uuid",
  "notes": "On time departure"
}
```

**Validation:**
| Field | Type | Rules |
|---|---|---|
| `actual_departure_at` | ISO 8601 datetime | optional; defaults to `now()`; must not be more than 60 minutes in the future |
| `driver_id` | UUID | required if not already assigned in VehiclePlanSlot; must have `driver` role; must be active |
| `notes` | string | optional; max 1000 chars |

**Response (200 OK):**
```json
{
  "data": {
    "id": "uuid",
    "status": "dispatched",
    "vehicle": {
      "id": "uuid",
      "registration_number": "ABC-1234",
      "status": "in_transit"
    },
    "driver": {
      "id": "uuid",
      "name": "Khaled Mahmoud"
    },
    "dispatched_at": "2026-07-05T06:35:00Z",
    "dispatched_by": "uuid",
    "wave_fully_dispatched": false,
    "remaining_vehicles_to_dispatch": 2
  }
}
```

**Error Responses:**
| Status | Code | When |
|---|---|---|
| 422 | `ASSIGNMENT_NOT_IN_LOADING_STATUS` | VehicleAssignment is not in `loading` status |
| 422 | `ALLOCATION_NOT_APPROVED` | Allocation has not been approved; call CMD-008 first |
| 422 | `DRIVER_NOT_ASSIGNED` | No driver assigned and `require_driver_before_dispatch` policy is enabled |
| 422 | `DRIVER_NOT_FOUND` | Provided `driver_id` does not exist or is inactive |
| 422 | `LOADING_SESSION_NOT_COMPLETED` | Loading Session is still `open`; close the session first |
| 404 | `VEHICLE_ASSIGNMENT_NOT_FOUND` | VehicleAssignment not found |
| 403 | `FORBIDDEN` | Auth user lacks `loading.vehicle.release` permission |

---

### CMD-010 — Close Loading Session

**Method:** `POST`  
**URL:** `/api/v1/loading/sessions/{id}/close`  
**Permission:** `loading.session.close`  
**Feature flags:** `modules.loading_allocation_os`, `workflow.stages.loading`  
**State precondition:** Session must be in `open` status. If all products are loaded at 100%, session closes as `completed`. If any product has a shortage or variance, session closes as `closed_with_exceptions`. Blocking exceptions prevent closing unless a supervisor overrides.  
**Side effects:** Transfers product quantities from Prepared Products Pool to Vehicle Inventory; creates `VehicleInventoryItem` records; creates `VehicleInventoryMovement` records (`movement_type: loaded`); creates `PreparedPoolMovement` audit records; publishes `loading_session.completed` event.

**Request Body:**
```json
{
  "loaded_quantities": [
    {
      "product_id": "uuid",
      "pool_entry_id": "uuid",
      "quantity_loaded": 418.0,
      "variance_reason": "2 units damaged during loading"
    }
  ],
  "supervisor_override": false,
  "override_reason": null
}
```

**Validation:**
| Field | Type | Rules |
|---|---|---|
| `loaded_quantities` | array | required; must include an entry for every product in `required_products`; partial entries for products not loaded must include `quantity_loaded: 0` |
| `loaded_quantities[].product_id` | UUID | required; must be in session's required product list |
| `loaded_quantities[].pool_entry_id` | UUID | required; must match the assigned pool entry for this product |
| `loaded_quantities[].quantity_loaded` | decimal | required; >= 0; max: product's `quantity_required` + 10% overage tolerance; may be less than required (creates shortage exception) |
| `loaded_quantities[].variance_reason` | string | required when `quantity_loaded` < `quantity_required`; min 10 chars |
| `supervisor_override` | boolean | optional; default false; required to be `true` when blocking exceptions exist |
| `override_reason` | string | required when `supervisor_override = true`; min 20 chars |

**Response (200 OK):**
```json
{
  "data": {
    "id": "uuid",
    "session_number": "LOAD-202607-000001",
    "status": "completed",
    "closed_at": "2026-07-05T06:40:00Z",
    "closed_by": "uuid",
    "summary": {
      "products_required": 12,
      "products_fully_loaded": 11,
      "products_short_loaded": 1,
      "products_not_loaded": 0,
      "total_units_required": 4215.0,
      "total_units_loaded": 4212.0,
      "loading_completion_pct": 99.93
    },
    "vehicle_inventory_created": true,
    "pool_movements_recorded": 12,
    "exceptions": [
      {
        "id": "uuid",
        "type": "short_loading",
        "severity": "warning",
        "product_id": "uuid",
        "sku": "HONEY-500G",
        "quantity_required": 420.0,
        "quantity_loaded": 418.0,
        "shortage": 2.0,
        "reason": "2 units damaged during loading"
      }
    ]
  }
}
```

**Error Responses:**
| Status | Code | When |
|---|---|---|
| 422 | `SESSION_NOT_OPEN` | Loading Session is not in `open` status |
| 422 | `SESSION_ALREADY_CLOSED` | Session is already in `completed` or `closed_with_exceptions` status |
| 422 | `MISSING_PRODUCT_QUANTITIES` | One or more required products have no entry in `loaded_quantities` |
| 422 | `QUANTITY_EXCEEDS_TOLERANCE` | `quantity_loaded` exceeds `quantity_required` + overage tolerance |
| 422 | `VARIANCE_REASON_REQUIRED` | `quantity_loaded` < `quantity_required` but `variance_reason` is absent |
| 422 | `BLOCKING_EXCEPTIONS_REQUIRE_OVERRIDE` | Blocking exceptions exist and `supervisor_override` is not `true` |
| 422 | `OVERRIDE_REASON_REQUIRED` | `supervisor_override = true` but `override_reason` is absent |
| 403 | `SUPERVISOR_OVERRIDE_FORBIDDEN` | Auth user lacks permission to use `supervisor_override` |
| 404 | `SESSION_NOT_FOUND` | Loading Session not found |
| 403 | `FORBIDDEN` | Auth user lacks `loading.session.close` permission |

---

### CMD-011 — Cancel Loading Session

**Method:** `POST`  
**URL:** `/api/v1/loading/sessions/{id}/cancel`  
**Permission:** `loading.session.cancel`  
**Feature flags:** `modules.loading_allocation_os`, `workflow.stages.loading`  
**State precondition:** Session must be in `planned` or `open` status. Completed and already-dispatched sessions cannot be cancelled.  
**Side effects:** Releases any pool reservations made in CMD-005; sets vehicle status back to `available`; publishes `loading_session.cancelled` event.

**Request Body:**
```json
{
  "reason": "Vehicle breakdown — loading cannot proceed",
  "replan_required": true
}
```

**Validation:**
| Field | Type | Rules |
|---|---|---|
| `reason` | string | required; min 10 chars; max 1000 chars |
| `replan_required` | boolean | optional; default false; when true, publishes notification to Wave Planner to trigger replanning |

**Response (200 OK):**
```json
{
  "data": {
    "id": "uuid",
    "session_number": "LOAD-202607-000001",
    "status": "cancelled",
    "cancelled_at": "2026-07-05T06:10:00Z",
    "cancelled_by": "uuid",
    "cancellation_reason": "Vehicle breakdown — loading cannot proceed",
    "pool_reservations_released": 12,
    "vehicle_status_restored": "available",
    "replan_notification_sent": true
  }
}
```

**Error Responses:**
| Status | Code | When |
|---|---|---|
| 422 | `SESSION_ALREADY_COMPLETED` | Session is in `completed` status |
| 422 | `SESSION_ALREADY_DISPATCHED` | Vehicle has been released (dispatched); cancellation not permitted |
| 422 | `SESSION_ALREADY_CANCELLED` | Session is already cancelled |
| 404 | `SESSION_NOT_FOUND` | Loading Session not found |
| 403 | `FORBIDDEN` | Auth user lacks `loading.session.cancel` permission |

---

## 5. Query Contracts

Queries are read-only. They do not change state and are safe to call multiple times.

---

### QRY-001 — Loading Dashboard

**Method:** `GET`  
**URL:** `/api/v1/loading/dashboard`  
**Permission:** `loading.dashboard.view`  
**Feature flags:** `modules.loading_allocation_os`  
**Cache:** 30 seconds (Redis, key: `loading:dashboard:{company_id}:{warehouse_id}:{date}`)

**Query Parameters:**
| Parameter | Type | Default | Description |
|---|---|---|---|
| `warehouse_id` | UUID | — | Filter by warehouse |
| `operational_date` | date | today | Dashboard date (format: `YYYY-MM-DD`) |

**Response (200 OK):**
```json
{
  "data": {
    "operational_date": "2026-07-05",
    "kpis": {
      "sessions_total": 6,
      "sessions_by_status": {
        "planned": 1,
        "open": 2,
        "completed": 2,
        "closed_with_exceptions": 0,
        "cancelled": 1
      },
      "vehicles_by_status": {
        "available": 3,
        "loading": 2,
        "in_transit": 4,
        "returning": 1,
        "maintenance": 0
      },
      "orders_dispatched": 168,
      "orders_pending_loading": 42,
      "units_loaded": 8420.0,
      "units_remaining": 1680.0,
      "loading_completion_pct": 83.4,
      "open_exceptions": 1,
      "blocking_exceptions": 0,
      "pool_available_units": 3240.0,
      "drivers_active": 6
    },
    "active_sessions": [
      {
        "id": "uuid",
        "session_number": "LOAD-202607-000002",
        "status": "open",
        "vehicle": {
          "id": "uuid",
          "registration_number": "XYZ-5678",
          "vehicle_type": "van"
        },
        "driver": { "id": "uuid", "name": "Khaled Mahmoud" },
        "operator": { "id": "uuid", "name": "Ahmed Hassan" },
        "orders_count": 22,
        "loading_completion_pct": 64.0,
        "open_exceptions": 0,
        "opened_at": "2026-07-05T06:20:00Z"
      }
    ],
    "waves_summary": [
      {
        "id": "uuid",
        "wave_number": "WAVE-202607-000045",
        "status": "loading",
        "vehicles_total": 4,
        "vehicles_dispatched": 2,
        "vehicles_loading": 2,
        "vehicles_planned": 0,
        "all_dispatched": false
      }
    ],
    "alerts": [
      {
        "type": "blocking_exception",
        "severity": "blocking",
        "session_id": "uuid",
        "session_number": "LOAD-202607-000003",
        "message": "Loading Session blocked: HONEY-500G missing from pool — supervisor action required"
      }
    ]
  }
}
```

---

### QRY-002 — Vehicle Plan

**Method:** `GET`  
**URL:** `/api/v1/loading/vehicle-plans/{id}`  
**Permission:** `loading.plans.view`  
**Feature flags:** `modules.loading_allocation_os`

**Response (200 OK):**
```json
{
  "data": {
    "id": "uuid",
    "status": "approved",
    "operational_day": "2026-07-05",
    "wave_id": "uuid",
    "wave_number": "WAVE-202607-000045",
    "geography_group_id": "uuid",
    "shipping_company": {
      "id": "uuid",
      "name": "Bosta"
    },
    "zone": { "id": "uuid", "name": "Cairo - Nasr City" },
    "governorate": { "id": "uuid", "name": "Cairo" },
    "approved_by": "uuid",
    "approved_at": "2026-07-05T05:30:00Z",
    "slots": [
      {
        "id": "uuid",
        "slot_number": 1,
        "vehicle": {
          "id": "uuid",
          "registration_number": "ABC-1234",
          "vehicle_type": "van",
          "capacity_weight_kg": 800.00,
          "capacity_volume_m3": 4.5000,
          "status": "loading"
        },
        "driver": { "id": "uuid", "name": "Khaled Mahmoud" },
        "orders_count": 22,
        "total_weight_kg": 318.40,
        "total_volume_m3": 1.5920,
        "utilization_pct": 39.8,
        "is_overloaded": false,
        "loading_session": {
          "id": "uuid",
          "session_number": "LOAD-202607-000001",
          "status": "open",
          "loading_completion_pct": 64.0
        }
      }
    ],
    "created_at": "2026-07-05T05:00:00Z"
  }
}
```

**Error Responses:**
| Status | Code | When |
|---|---|---|
| 404 | `VEHICLE_PLAN_NOT_FOUND` | VehiclePlan not found or inaccessible |
| 403 | `FORBIDDEN` | Auth user lacks `loading.plans.view` permission |

---

### QRY-003 — Vehicle Inventory

**Method:** `GET`  
**URL:** `/api/v1/loading/vehicle-assignments/{id}/inventory`  
**Permission:** `loading.inventory.view`  
**Feature flags:** `modules.loading_allocation_os`  
**Note:** Returns current vehicle inventory state. Available after CMD-006 (Load Vehicle) transitions the session to `open`. Returns empty inventory for sessions still in `planned` status.

**Query Parameters:**
| Parameter | Type | Default | Description |
|---|---|---|---|
| `trip_date` | date | today | Inventory date |

**Response (200 OK):**
```json
{
  "data": {
    "vehicle_assignment_id": "uuid",
    "vehicle": {
      "id": "uuid",
      "registration_number": "ABC-1234",
      "status": "loading"
    },
    "trip_date": "2026-07-05",
    "loading_session_id": "uuid",
    "inventory": [
      {
        "id": "uuid",
        "product_id": "uuid",
        "sku": "HONEY-500G",
        "name": "Raw Honey 500g",
        "quantity_loaded": 418.0,
        "quantity_delivered": 0.0,
        "quantity_returned": 0.0,
        "quantity_on_hand": 418.0,
        "last_updated_at": "2026-07-05T06:40:00Z"
      }
    ],
    "totals": {
      "total_units_loaded": 4212.0,
      "total_units_delivered": 0.0,
      "total_units_returned": 0.0,
      "total_units_on_hand": 4212.0,
      "total_weight_on_hand_kg": 621.30
    },
    "movements": [
      {
        "id": "uuid",
        "product_id": "uuid",
        "sku": "HONEY-500G",
        "movement_type": "loaded",
        "quantity": 418.0,
        "reference_type": "loading_session",
        "reference_id": "uuid",
        "actor_id": "uuid",
        "recorded_at": "2026-07-05T06:40:00Z",
        "notes": null
      }
    ]
  }
}
```

**Error Responses:**
| Status | Code | When |
|---|---|---|
| 404 | `VEHICLE_ASSIGNMENT_NOT_FOUND` | VehicleAssignment not found |
| 403 | `FORBIDDEN` | Auth user lacks `loading.inventory.view` permission |

---

### QRY-004 — Allocation Summary

**Method:** `GET`  
**URL:** `/api/v1/loading/vehicle-assignments/{id}/allocation-summary`  
**Permission:** `loading.allocation.view`  
**Feature flags:** `modules.loading_allocation_os`, `modules.product_allocation`

**Response (200 OK):**
```json
{
  "data": {
    "vehicle_assignment_id": "uuid",
    "wave_id": "uuid",
    "allocation_mode": "full_auto",
    "allocation_status": "completed",
    "allocation_approved": true,
    "allocated_at": "2026-07-05T06:20:00Z",
    "approved_at": "2026-07-05T06:30:00Z",
    "approved_by": "uuid",
    "summary": {
      "total_orders": 40,
      "fully_allocated_orders": 38,
      "partially_allocated_orders": 2,
      "unallocated_orders": 0,
      "allocation_coverage_pct": 95.0
    },
    "allocations": [
      {
        "order_id": "uuid",
        "order_number": "ORD-202607-000234",
        "priority_rank": 1,
        "is_partial": false,
        "allocation_coverage_pct": 100.0,
        "lines": [
          {
            "order_line_id": "uuid",
            "product_id": "uuid",
            "sku": "HONEY-500G",
            "quantity_requested": 10.0,
            "quantity_allocated": 10.0,
            "quantity_delivered": 0.0,
            "quantity_remaining": 10.0
          }
        ]
      }
    ],
    "open_exceptions": 0,
    "exception_log": []
  }
}
```

**Error Responses:**
| Status | Code | When |
|---|---|---|
| 422 | `ALLOCATION_NOT_RUN` | No allocation has been executed yet for this assignment |
| 404 | `VEHICLE_ASSIGNMENT_NOT_FOUND` | VehicleAssignment not found |
| 403 | `FORBIDDEN` | Auth user lacks `loading.allocation.view` permission |

---

### QRY-005 — Route Summary

**Method:** `GET`  
**URL:** `/api/v1/loading/sessions/{id}/route-summary`  
**Permission:** `loading.session.view`  
**Feature flags:** `modules.loading_allocation_os`  
**Note:** Returns a consolidated summary of orders, destinations, and assigned products for a Loading Session. Designed for driver manifest generation and pre-departure review.

**Response (200 OK):**
```json
{
  "data": {
    "session_id": "uuid",
    "session_number": "LOAD-202607-000001",
    "vehicle": {
      "id": "uuid",
      "registration_number": "ABC-1234",
      "vehicle_type": "van",
      "refrigerated": false
    },
    "driver": { "id": "uuid", "name": "Khaled Mahmoud" },
    "wave": {
      "id": "uuid",
      "wave_number": "WAVE-202607-000045",
      "zone": "Cairo - Nasr City",
      "shipping_company": "Bosta"
    },
    "stops": [
      {
        "stop_number": 1,
        "order_id": "uuid",
        "order_number": "ORD-202607-000234",
        "customer_name": "Mohamed Ali",
        "delivery_address": {
          "street": "15 El-Nasr Street",
          "district": "Nasr City",
          "governorate": "Cairo"
        },
        "payment_type": "cod",
        "cod_amount": 250.00,
        "currency": "EGP",
        "lines": [
          {
            "sku": "HONEY-500G",
            "name": "Raw Honey 500g",
            "quantity_allocated": 10.0,
            "unit": "unit"
          }
        ],
        "is_fully_allocated": true
      }
    ],
    "totals": {
      "total_stops": 40,
      "total_cod_amount": 9845.00,
      "currency": "EGP",
      "total_units": 4212.0,
      "fully_allocated_stops": 38,
      "partially_allocated_stops": 2
    },
    "generated_at": "2026-07-05T06:35:00Z"
  }
}
```

**Error Responses:**
| Status | Code | When |
|---|---|---|
| 404 | `SESSION_NOT_FOUND` | Loading Session not found |
| 403 | `FORBIDDEN` | Auth user lacks `loading.session.view` permission |

---

### QRY-006 — Driver Status

**Method:** `GET`  
**URL:** `/api/v1/loading/drivers/{id}/status`  
**Permission:** `loading.drivers.view`  
**Feature flags:** `modules.loading_allocation_os`  
**Note:** `{id}` is the Driver's user UUID.

**Query Parameters:**
| Parameter | Type | Default | Description |
|---|---|---|---|
| `trip_date` | date | today | Operational date to query |

**Response (200 OK):**
```json
{
  "data": {
    "driver_id": "uuid",
    "name": "Khaled Mahmoud",
    "trip_date": "2026-07-05",
    "status": "in_transit",
    "current_assignment": {
      "vehicle_assignment_id": "uuid",
      "wave_id": "uuid",
      "wave_number": "WAVE-202607-000045",
      "vehicle": {
        "id": "uuid",
        "registration_number": "ABC-1234",
        "vehicle_type": "van"
      },
      "session": {
        "id": "uuid",
        "session_number": "LOAD-202607-000001",
        "status": "completed"
      },
      "dispatched_at": "2026-07-05T06:35:00Z"
    },
    "today_summary": {
      "trips_completed": 0,
      "trips_active": 1,
      "orders_assigned": 40,
      "orders_delivered": 12,
      "orders_remaining": 28,
      "delivery_completion_pct": 30.0
    }
  }
}
```

**Error Responses:**
| Status | Code | When |
|---|---|---|
| 404 | `DRIVER_NOT_FOUND` | User not found or is not a driver |
| 403 | `FORBIDDEN` | Auth user lacks `loading.drivers.view` permission |

---

### QRY-007 — Vehicle Status

**Method:** `GET`  
**URL:** `/api/v1/loading/vehicles/{id}/status`  
**Permission:** `loading.vehicles.view`  
**Feature flags:** `modules.loading_allocation_os`

**Query Parameters:**
| Parameter | Type | Default | Description |
|---|---|---|---|
| `trip_date` | date | today | Operational date to query |

**Response (200 OK):**
```json
{
  "data": {
    "vehicle_id": "uuid",
    "registration_number": "ABC-1234",
    "vehicle_type": "van",
    "status": "in_transit",
    "refrigerated": false,
    "capacity": {
      "weight_kg": 800.00,
      "volume_m3": 4.5000
    },
    "current_load": {
      "weight_kg": 621.30,
      "volume_m3": 3.1065,
      "weight_utilization_pct": 77.7,
      "volume_utilization_pct": 69.0
    },
    "trip_date": "2026-07-05",
    "current_trip": {
      "wave_id": "uuid",
      "wave_number": "WAVE-202607-000045",
      "driver_id": "uuid",
      "driver_name": "Khaled Mahmoud",
      "loading_session_id": "uuid",
      "session_number": "LOAD-202607-000001",
      "dispatched_at": "2026-07-05T06:35:00Z"
    },
    "inventory_summary": {
      "total_products": 12,
      "total_units_loaded": 4212.0,
      "total_units_delivered": 480.0,
      "total_units_on_hand": 3732.0
    },
    "timeline": [
      {
        "timestamp": "2026-07-05T06:05:00Z",
        "event": "Loading Session opened",
        "actor": "Ahmed Hassan"
      },
      {
        "timestamp": "2026-07-05T06:40:00Z",
        "event": "Loading Session completed",
        "actor": "Ahmed Hassan"
      },
      {
        "timestamp": "2026-07-05T06:35:00Z",
        "event": "Vehicle dispatched",
        "actor": "Ahmed Hassan"
      }
    ]
  }
}
```

**Error Responses:**
| Status | Code | When |
|---|---|---|
| 404 | `VEHICLE_NOT_FOUND` | Vehicle not found or does not belong to company |
| 403 | `FORBIDDEN` | Auth user lacks `loading.vehicles.view` permission |

---

### QRY-008 — Analytics

**Method:** `GET`  
**URL:** `/api/v1/loading/analytics`  
**Permission:** `loading.analytics.view`  
**Feature flags:** `modules.loading_allocation_os`  
**Source:** Read replica; projection table  
**Cache:** 5 minutes (Redis, key: `loading:analytics:{company_id}:{from_date}:{to_date}:{warehouse_id}`)

**Query Parameters:**
| Parameter | Type | Required | Description |
|---|---|---|---|
| `from_date` | date | Yes | Start of period (format: `YYYY-MM-DD`) |
| `to_date` | date | Yes | End of period; max 90-day range from `from_date` |
| `warehouse_id` | UUID | No | Filter by warehouse |

**Response (200 OK):**
```json
{
  "data": {
    "period": {
      "from": "2026-07-01",
      "to": "2026-07-05"
    },
    "summary": {
      "sessions_created": 28,
      "sessions_completed": 24,
      "sessions_closed_with_exceptions": 2,
      "sessions_cancelled": 2,
      "vehicles_dispatched": 26,
      "avg_loading_time_minutes": 42,
      "avg_loading_completion_pct": 98.7,
      "exception_rate_pct": 14.3,
      "blocking_exception_rate_pct": 3.6,
      "allocation_coverage_pct": 96.8,
      "partial_allocation_rate_pct": 4.2,
      "total_units_loaded": 48620.0,
      "total_orders_dispatched": 1840
    },
    "daily": [
      {
        "date": "2026-07-05",
        "sessions": 6,
        "vehicles_dispatched": 5,
        "units_loaded": 12480.0,
        "avg_loading_time_minutes": 38,
        "exceptions": 1
      }
    ],
    "vehicle_performance": [
      {
        "vehicle_id": "uuid",
        "registration_number": "ABC-1234",
        "trips": 5,
        "avg_utilization_pct": 81.4,
        "avg_loading_time_minutes": 36,
        "exception_count": 0
      }
    ],
    "top_exception_types": [
      {
        "exception_type": "short_loading",
        "count": 8,
        "pct_of_sessions": 33.3
      },
      {
        "exception_type": "pool_shortage",
        "count": 3,
        "pct_of_sessions": 12.5
      }
    ],
    "top_shorted_products": [
      {
        "product_id": "uuid",
        "sku": "HONEY-500G",
        "shortage_occurrences": 3,
        "avg_shortage_pct": 0.5
      }
    ],
    "fleet_utilization": {
      "avg_weight_utilization_pct": 79.3,
      "avg_volume_utilization_pct": 67.1,
      "overloaded_sessions": 0
    }
  }
}
```

**Error Responses:**
| Status | Code | When |
|---|---|---|
| 422 | `DATE_RANGE_TOO_LARGE` | `to_date` - `from_date` exceeds 90 days |
| 422 | `TO_DATE_BEFORE_FROM_DATE` | `to_date` is earlier than `from_date` |
| 403 | `FORBIDDEN` | Auth user lacks `loading.analytics.view` permission |

---

## 6. State Machine Reference

### Loading Session Status

```
planned
  ↓ CMD-006 (Load Vehicle)
open
  ↓ CMD-010 (Close Loading Session — all products fully loaded)
completed
  OR
  ↓ CMD-010 (Close Loading Session — with variance/shortage)
closed_with_exceptions

planned | open
  ↓ CMD-011 (Cancel Loading Session)
cancelled
```

### Vehicle Assignment Status (within Loading OS)

```
confirmed          — from Vehicle Planning Engine; vehicle available
  ↓ CMD-006 (Load Vehicle)
loading            — Loading Session is open; vehicle is loading
  ↓ CMD-009 (Release Vehicle)
dispatched         — vehicle in transit; handed to Logistics OS
  ↓ (Logistics OS — end of shift)
returned           — vehicle back at warehouse
  ↓ (Logistics OS — reconciliation complete)
reconciled         — shift reconciliation approved
```

### Vehicle Status

```
available → loading → in_transit → returning → available
                                                  ↑
                                             (after reconciliation)
maintenance                                  (admin action — no API)
inactive                                     (admin action — no API)
```

---

## 7. Authorization Matrix

| Endpoint | Required Permission | Minimum Role |
|---|---|---|
| `POST /sessions` | `loading.session.create` | `wave_planner`, `warehouse_supervisor` |
| `POST /sessions/{id}/generate-vehicle-plan` | `loading.session.plan` | `wave_planner`, `warehouse_supervisor` |
| `POST /vehicle-plans/{id}/recalculate` | `loading.session.plan` | `wave_planner`, `warehouse_supervisor` |
| `POST /vehicle-plans/{id}/assign-orders` | `loading.orders.assign` | `wave_planner`, `warehouse_supervisor` |
| `POST /vehicle-assignments/{id}/assign-products` | `loading.products.assign` | `wave_planner`, `warehouse_supervisor`, `loading_operator` |
| `POST /vehicle-assignments/{id}/load` | `loading.session.operate` | `loading_operator`, `warehouse_supervisor` |
| `POST /vehicle-assignments/{id}/allocate` | `loading.allocation.run` | `wave_planner`, `warehouse_supervisor`, `operations_manager` |
| `POST /vehicle-assignments/{id}/approve-allocation` | `loading.allocation.approve` | `warehouse_supervisor`, `operations_manager` |
| `POST /vehicle-assignments/{id}/release` | `loading.vehicle.release` | `warehouse_supervisor`, `operations_manager` |
| `POST /sessions/{id}/close` | `loading.session.close` | `loading_operator`, `warehouse_supervisor` |
| `POST /sessions/{id}/cancel` | `loading.session.cancel` | `warehouse_supervisor`, `operations_manager` |
| `GET /dashboard` | `loading.dashboard.view` | All loading roles |
| `GET /vehicle-plans/{id}` | `loading.plans.view` | All loading roles |
| `GET /vehicle-assignments/{id}/inventory` | `loading.inventory.view` | All loading roles, `driver` |
| `GET /vehicle-assignments/{id}/allocation-summary` | `loading.allocation.view` | All loading roles |
| `GET /sessions/{id}/route-summary` | `loading.session.view` | All loading roles, `driver` |
| `GET /drivers/{id}/status` | `loading.drivers.view` | `warehouse_supervisor`, `operations_manager`, `wave_planner` |
| `GET /vehicles/{id}/status` | `loading.vehicles.view` | All loading roles |
| `GET /analytics` | `loading.analytics.view` | `warehouse_supervisor`, `operations_manager`, `management` |

**Note:** `supervisor_override` in CMD-010 additionally requires `loading.session.supervisor_override` permission, which is not granted to `loading_operator`.

---

## 8. Standard Error Response Format

```json
{
  "message": "Human-readable error summary.",
  "errors": {
    "field_name": ["Validation error message for this field."]
  },
  "code": "MACHINE_READABLE_ERROR_CODE",
  "meta": {}
}
```

- `errors` key is present only for 422 validation failures (one or more field-level messages).
- `code` is always present for 4xx/5xx responses from this module.
- `meta` is reserved for future use; always an empty object.

All HTTP 4xx/5xx responses follow this format without exception.

---

## 9. Pagination

Collection endpoints (list views) follow the standard ECOS pagination contract:

**Query parameters:** `?page=1&per_page=25` (max `per_page`: 100)

**Response envelope:**
```json
{
  "data": [...],
  "meta": {
    "page": 1,
    "per_page": 25,
    "total": 84,
    "last_page": 4
  }
}
```

---

## 10. Events Emitted

Every command that succeeds publishes at least one domain event. These are consumed by Logistics OS, the Timeline service, and the Notification service.

| Event | Published By | When |
|---|---|---|
| `loading_session.created` | CMD-001 | New session created |
| `loading_session.opened` | CMD-006 | Session transitions to `open` |
| `loading_session.product_loaded` | CMD-010 | Each product quantity confirmed |
| `loading_session.exception_raised` | CMD-010 | Exception recorded on close |
| `loading_session.completed` | CMD-010 | Session closed successfully |
| `loading_session.closed_with_exceptions` | CMD-010 | Session closed with variances |
| `loading_session.cancelled` | CMD-011 | Session cancelled |
| `vehicle.inventory.loaded` | CMD-010 | VehicleInventoryItem records created |
| `vehicle_assignment.dispatched` | CMD-009 | Vehicle released for transit |
| `shipping_wave.loading_complete` | CMD-009 | All vehicles in wave dispatched |
| `product_allocation.completed` | CMD-007 | Allocation run finished |
| `product_allocation.approved` | CMD-008 | Allocation approved by supervisor |

---

## 11. API Versioning

All Loading & Allocation OS APIs are at `v1`. When a breaking change is required, `v2` endpoints are introduced while `v1` is maintained for a minimum 90-day deprecation window per `docs/contracts/CONTRACT-VERSIONING.md`.

Non-breaking additions (new optional fields, new query parameters with defaults) are applied to `v1` without version increment.
