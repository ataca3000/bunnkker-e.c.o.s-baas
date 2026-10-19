# Loading & Allocation OS — Security Design

**Document:** SECURITY  
**Version:** 1.0  
**Status:** APPROVED — Engineering Design Phase  
**Date:** 2026-07-05  
**Task:** TASK-LOAD-001  
**Parent:** BLUEPRINT.md

---

## 1. Roles

| Role | Slug | Description |
|---|---|---|
| Loading Manager | `loading_manager` | Plans sessions, approves vehicle plans, approves allocations |
| Loading Dispatcher | `loading_dispatcher` | Assigns orders/products, overrides plans, reviews exceptions |
| Warehouse Worker | `warehouse_worker` | Executes loading tasks via mobile interface |
| Driver | `driver` | Views route and manifest; records delivery exceptions (via mobile) |
| Viewer (Operations) | `operations_viewer` | Read-only access to dashboards and reports |
| System Admin | `system_admin` | All permissions (is_system = true) |

---

## 2. Permission Matrix

### 2.1 Loading Session Permissions

| Permission | Loading Manager | Loading Dispatcher | Warehouse Worker | Driver | Viewer |
|---|---|---|---|---|---|
| `loading.session.view` | ✅ | ✅ | ✅ | ✅ (own vehicle) | ✅ |
| `loading.session.create` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `loading.session.close` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `loading.session.cancel` | ✅ | ❌ | ❌ | ❌ | ❌ |

### 2.2 Vehicle Plan Permissions

| Permission | Loading Manager | Loading Dispatcher | Warehouse Worker | Driver | Viewer |
|---|---|---|---|---|---|
| `loading.vehicle-plan.view` | ✅ | ✅ | ❌ | ❌ | ✅ |
| `loading.vehicle-plan.generate` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `loading.vehicle-plan.recalculate` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `loading.vehicle-plan.approve` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `loading.vehicle-plan.override` | ✅ | ❌ | ❌ | ❌ | ❌ |

### 2.3 Vehicle Assignment Permissions

| Permission | Loading Manager | Loading Dispatcher | Warehouse Worker | Driver | Viewer |
|---|---|---|---|---|---|
| `loading.vehicle-assignment.view` | ✅ | ✅ | ✅ | ✅ (own) | ✅ |
| `loading.vehicle-assignment.assign-orders` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `loading.vehicle-assignment.assign-products` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `loading.vehicle-assignment.load` | ✅ | ✅ | ✅ | ❌ | ❌ |
| `loading.vehicle-assignment.release` | ✅ | ❌ | ❌ | ❌ | ❌ |

### 2.4 Allocation Permissions

| Permission | Loading Manager | Loading Dispatcher | Warehouse Worker | Driver | Viewer |
|---|---|---|---|---|---|
| `loading.allocation.view` | ✅ | ✅ | ❌ | ✅ (own vehicle) | ✅ |
| `loading.allocation.allocate` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `loading.allocation.approve` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `loading.allocation.override` | ✅ | ❌ | ❌ | ❌ | ❌ |
| `loading.allocation.resolve-partial` | ✅ | ✅ | ❌ | ❌ | ❌ |

### 2.5 Driver & Analytics Permissions

| Permission | Loading Manager | Loading Dispatcher | Warehouse Worker | Driver | Viewer |
|---|---|---|---|---|---|
| `loading.driver.view` | ✅ | ✅ | ❌ | ✅ (self) | ✅ |
| `loading.driver.assign` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `loading.analytics.view` | ✅ | ✅ | ❌ | ❌ | ✅ |
| `loading.exceptions.resolve` | ✅ | ✅ | ❌ | ❌ | ❌ |

---

## 3. Approval Gates

Approval gates are hard stops that require a named permission holder to explicitly act before the workflow can proceed.

| Gate | Description | Approver Role | Condition |
|---|---|---|---|
| **Vehicle Plan Approval** | Vehicle plan moves from `planner_review` → `approved` | Loading Manager | VehiclePlan status = `planner_review` |
| **Allocation Approval** | Allocation moves from `pending` → `approved` | Loading Manager | All vehicle allocations in `allocated` or `partial` |
| **Partial Allocation Override** | Approve session despite partial allocations | Loading Manager | At least one AllocationRecord.status = `partial` |
| **Capacity Override** | Allow loading beyond soft limit | Loading Manager | Soft limit exceeded at loading time |
| **Route Constraint Override** | Proceed despite route constraint violation | Loading Manager | `loading_exceptions.exception_type = route_constraint` |
| **Shipping Policy Override** | Bypass shipping company policy | Loading Manager | `loading_exceptions.exception_type = shipping_policy` |

### 3.1 Approval Record Structure

Every approval gate produces an `ApprovalRecord`:
```
loading_approvals
  id             UUID
  company_id     UUID
  session_id     UUID (FK → loading_sessions)
  gate_type      VARCHAR(100)  — vehicle_plan | allocation | partial_override | capacity_override
  approved_by    UUID          — FK → users
  approved_at    TIMESTAMPTZ
  notes          TEXT          — required for overrides
  before_state   JSONB         — state snapshot before approval
  after_state    JSONB         — state snapshot after approval
```

---

## 4. Feature Flags

| Flag Key | Scope | Default | Description |
|---|---|---|---|
| `modules.loading_os` | Company | `false` | Master switch — entire Loading OS module |
| `workflow.stages.loading` | Company | `false` | Loading workflow stage in active Fulfillment Profile |
| `workflow.stages.allocation` | Company | `false` | Allocation workflow stage |
| `loading.auto_vehicle_planning` | Company | `true` | Enables automatic vehicle plan generation |
| `loading.ai_allocation_suggestions` | Company | `false` | Enables AI-suggested allocation mode |
| `loading.mobile_loading_interface` | Company | `false` | Mobile warehouse worker interface |
| `loading.driver_mobile_access` | Company | `false` | Driver mobile route + manifest access |
| `loading.route_optimization` | Company | `false` | AI route optimization integration |

### 4.1 Flag Enforcement

- `modules.loading_os` → checked in every Loading OS controller via `guardModuleEnabled()`; returns HTTP 503 if disabled
- `workflow.stages.loading` → checked at top of every Action's `execute()` method; aborts with 503 if disabled
- `workflow.stages.allocation` → checked in AllocationAction, ApproveAllocationAction
- Feature-specific flags → checked before their specific operation; return 422 with descriptive message if disabled

---

## 5. Policy Consumption

The Loading OS consumes policies from the Configuration OS / Fulfillment Profiles.

| Policy | Source | Consumed By |
|---|---|---|
| `vehicle_capacity_limits` | Fulfillment Profile → vehicle config | Vehicle Planning Engine |
| `allocation_mode` | Fulfillment Profile → allocation config | Product Allocation Engine |
| `auto_approve_vehicle_plans` | Fulfillment Profile | CreateLoadingSessionAction |
| `partial_allocation_policy` | Fulfillment Profile | AllocationEngine |
| `shipping_company_rules` | ShippingCompanyProfile | Geography Engine + Vehicle Planning |
| `channel_shipping_preference` | Channel config | Shipping Company Selection |
| `driver_assignment_mode` | Fulfillment Profile | DriverAssignmentAction |
| `loading_confirmation_mode` | Fulfillment Profile | LoadVehicleAction |

---

## 6. Audit Requirements

### 6.1 Every State Transition Must Record

```
audit_logs entry:
  entity_type:  'LoadingSession' | 'VehiclePlan' | 'VehicleAssignment' | 'AllocationRecord' | ...
  entity_id:    UUID
  action:       'loading.session.created' | 'loading.vehicle_plan.approved' | ...
  actor_id:     UUID (user who triggered)
  actor_type:   'user' | 'system'
  old_values:   JSONB (before state)
  new_values:   JSONB (after state)
  ip_address:   VARCHAR
  user_agent:   VARCHAR
  occurred_at:  TIMESTAMPTZ
```

### 6.2 Mandatory Audit Events

| Event | Audit Action |
|---|---|
| Loading session created | `loading.session.created` |
| Vehicle plan generated | `loading.vehicle_plan.generated` |
| Vehicle plan approved | `loading.vehicle_plan.approved` |
| Orders assigned to vehicle | `loading.orders.assigned` |
| Vehicle loaded | `loading.vehicle.loaded` |
| Allocation completed | `loading.allocation.completed` |
| Allocation approved | `loading.allocation.approved` |
| Partial allocation resolved | `loading.partial.resolved` |
| Vehicle released | `loading.vehicle.released` |
| Session closed | `loading.session.closed` |
| Session cancelled | `loading.session.cancelled` |
| Any manual override | `loading.override.{type}` |
| Capacity limit exceeded | `loading.capacity.exceeded` |
| Route constraint violated | `loading.route.constraint_violated` |

### 6.3 Timeline Requirements

Every audit event also writes a `TimelineEvent`:
```
timeline_events entry:
  subject_type: 'LoadingSession'
  subject_id:   {session_id}
  event_type:   'loading.session.created'
  title:        'Loading Session created for 2026-07-05'
  actor_id:     UUID
  source_module: 'Operations.Loading'
  occurred_at:  TIMESTAMPTZ
  metadata:     JSONB (event-specific data)
```

---

## 7. Company Isolation

All Loading OS endpoints enforce company isolation:
1. Auth user's `company_id` is extracted from Sanctum token
2. Every query is scoped with `WHERE company_id = ?`
3. Loading sessions from other companies return 404 (not 403) to prevent enumeration
4. Vehicle plans, assignments, and allocations inherit session's company_id
5. Cross-company operations are rejected at the service layer (not just controller)

### 7.1 Isolation Test Requirement

Every integration test suite for Loading OS must include:
- `test_wrong_company_user_cannot_access_session` → asserts 404
- `test_system_admin_sees_only_own_company_data` → asserts correct scope
