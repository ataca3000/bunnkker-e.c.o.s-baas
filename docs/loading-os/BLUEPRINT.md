# Loading & Allocation OS — Implementation Blueprint

**Document:** BLUEPRINT  
**Version:** 1.0  
**Status:** APPROVED — Engineering Design Phase  
**Date:** 2026-07-05  
**Task:** TASK-LOAD-001  
**ADR Reference:** ADR-015  
**Phase:** Engineering Design — NO implementation started

---

## 1. Mission

> Transform prepared products from the warehouse into dispatched vehicles, fully allocated to their destination orders, with complete audit trails and manifest generation.

The Loading & Allocation OS is the operational bridge between Preparation OS (which produces prepared products) and Logistics OS (which tracks delivery). It answers the questions:
- **Which vehicles carry which orders?** (Vehicle Planning)
- **How are products physically loaded onto vehicles?** (Loading Tasks)
- **Which units of stock are allocated to which specific orders?** (Product Allocation)
- **Who is driving where?** (Driver Assignment + Route Plans)

---

## 2. Position in the Enterprise Fulfillment Platform

```
Preparation OS
      │
      ▼
Prepared Products Pool ◄──── bridge table (shared contract)
      │
      ▼
Loading & Allocation OS    ← THIS SYSTEM
      │
      ├── Geography Engine (reads GeographyGroups — already built)
      ├── Vehicle Planning Engine (produces VehiclePlans — already built)
      ├── Loading Sessions
      ├── Vehicle Assignment + Loading
      ├── Product Allocation
      └── Driver Assignment + Route Plans
      │
      ▼
Packing OS (optional) / Logistics OS
      │
      ▼
Delivery
```

---

## 3. Design Document Index

| Document | Purpose | Status |
|---|---|---|
| [DATABASE-DESIGN.md](DATABASE-DESIGN.md) | 20 tables, ERD, entity specs, status models, aggregate boundaries | ✅ Complete |
| [API-CONTRACTS.md](API-CONTRACTS.md) | 11 commands + 8 queries, request/response, error codes, auth matrix | ✅ Complete |
| [UX-ENGINEERING.md](UX-ENGINEERING.md) | 8 workspaces, 4 drawers, mobile interface, tablet, keyboard shortcuts | ✅ Complete |
| [WORKFLOW-VALIDATION.md](WORKFLOW-VALIDATION.md) | Full workflow, status machines, planning/replanning/partial/capacity/route | ✅ Complete |
| [SECURITY.md](SECURITY.md) | 5 roles, permission matrix, approval gates, feature flags, audit | ✅ Complete |
| [INTEGRATION-DESIGN.md](INTEGRATION-DESIGN.md) | 12 integration points: Prep OS, Orders, Inventory, Fleet, Shipping, Logistics, AI | ✅ Complete |
| [EVENTS-CATALOG.md](EVENTS-CATALOG.md) | 11 domain events: payload, producer, consumers, version, business meaning | ✅ Complete |
| [AI-INTEGRATION.md](AI-INTEGRATION.md) | 7 AI entry points, suggestion storage, feature flags, UX panel | ✅ Complete |

---

## 4. Key Architecture Decisions

### 4.1 Aggregate Boundaries

| Aggregate | Root | Member Tables |
|---|---|---|
| AGG-LA-01: LoadingSession | `loading_sessions` | `loading_tasks`, `shipment_groups`, `shipment_group_items`, `loading_exceptions` |
| AGG-LA-02: VehiclePlan | `vehicle_plans` | `vehicle_plan_slots`, `vehicle_plan_slot_orders`, `vehicle_plan_adjustment_log` |
| AGG-LA-03: VehicleAssignment | `vehicle_assignments` | `vehicle_capacity_snapshots`, `vehicle_inventory_items`, `vehicle_inventory_movements`, `allocation_records`, `allocation_decisions`, `route_plans`, `route_plan_stops`, `vehicle_shift_reconciliations` |
| AGG-LA-04: AllocationRecord | Sub-boundary within AGG-LA-03 | `allocation_records`, `allocation_decisions` |
| AGG-LA-05: DriverAssignment | `driver_assignments` | — |

### 4.2 Cross-Domain Contracts

| Boundary | Contract |
|---|---|
| Loading OS ↔ Preparation OS | `prepared_products_pool` table (shared; status transitions owned by respective module) |
| Loading OS ↔ Orders | Read-only via `EloquentOrderReader`; write via events only |
| Loading OS ↔ Inventory | Read-only for validation; inventory decrements via event listener |
| Loading OS ↔ Fleet | Read-only vehicle registry; fleet state via events |
| Loading OS ↔ Logistics OS | Handoff via `loading.vehicle.released` event; Logistics creates Shipment |

### 4.3 Feature Flags

| Flag | Default | Guards |
|---|---|---|
| `modules.loading_os` | `false` | Every controller method |
| `workflow.stages.loading` | `false` | Every Action's `execute()` |
| `workflow.stages.allocation` | `false` | AllocationAction, ApproveAllocationAction |
| `loading.auto_vehicle_planning` | `true` | CreateLoadingSessionAction |
| `loading.ai_allocation_suggestions` | `false` | AllocateProductsAction |
| `loading.mobile_loading_interface` | `false` | Mobile interface activation |
| `loading.driver_mobile_access` | `false` | Driver mobile API |
| `loading.route_optimization` | `false` | RoutePlanAction |

---

## 5. Loading Session Status Machine (Summary)

```
draft → planning → vehicle_assignment → loading → loaded
                                              ↓
                                    allocation_review → approved → released → closed
                                    
(any non-released/closed state) → cancelled
planning/vehicle_assignment → planning (replanning)
```

---

## 6. Module Scaffold

When implementation begins, the module structure will be:

```
Modules\Operations\Loading\
├── Domain\
│   ├── Models\
│   │   ├── LoadingSession.php
│   │   ├── VehiclePlan.php
│   │   ├── VehiclePlanSlot.php
│   │   ├── VehicleAssignment.php
│   │   ├── VehicleInventoryItem.php
│   │   ├── AllocationRecord.php
│   │   ├── AllocationDecision.php
│   │   ├── LoadingTask.php
│   │   ├── DriverAssignment.php
│   │   ├── RoutePlan.php
│   │   ├── RoutePlanStop.php
│   │   ├── ShipmentGroup.php
│   │   └── LoadingException.php
│   ├── Enums\
│   │   ├── LoadingSessionStatus.php
│   │   ├── VehiclePlanStatus.php
│   │   ├── VehicleAssignmentStatus.php
│   │   ├── AllocationRecordStatus.php
│   │   ├── LoadingTaskStatus.php
│   │   └── AllocationMode.php
│   ├── Events\
│   │   ├── LoadingSessionCreated.php
│   │   ├── VehiclePlanned.php
│   │   ├── VehicleAssigned.php
│   │   ├── VehicleLoaded.php
│   │   ├── AllocationCompleted.php
│   │   ├── AllocationAdjusted.php
│   │   ├── DriverAssigned.php
│   │   ├── VehicleReleased.php
│   │   ├── LoadingSessionClosed.php
│   │   ├── LoadingSessionCancelled.php
│   │   └── VehiclePlanRecalculated.php
│   └── Exceptions\
│       ├── LoadingSessionNotFoundException.php
│       ├── VehicleCapacityExceededException.php
│       ├── AllocationFailedException.php
│       ├── InvalidSessionStatusException.php
│       └── PoolEntriesUnavailableException.php
├── Application\
│   ├── DTOs\
│   │   ├── CreateLoadingSessionDTO.php
│   │   ├── GenerateVehiclePlanDTO.php
│   │   ├── AssignOrdersDTO.php
│   │   ├── LoadVehicleDTO.php
│   │   ├── AllocateProductsDTO.php
│   │   └── ReleaseVehicleDTO.php
│   └── Actions\
│       ├── CreateLoadingSessionAction.php
│       ├── GenerateVehiclePlanAction.php
│       ├── RecalculateVehiclePlanAction.php
│       ├── AssignOrdersAction.php
│       ├── AssignProductsAction.php
│       ├── LoadVehicleAction.php
│       ├── AllocateProductsAction.php
│       ├── ApproveAllocationAction.php
│       ├── ReleaseVehicleAction.php
│       ├── CloseLoadingSessionAction.php
│       └── CancelLoadingSessionAction.php
├── Infrastructure\
│   ├── Database\
│   │   ├── Migrations\  (20 migration files per DATABASE-DESIGN.md)
│   │   ├── Factories\
│   │   └── Seeders\
│   └── Repositories\
│       ├── EloquentLoadingSessionRepository.php
│       └── EloquentVehiclePlanRepository.php
└── Presentation\
    └── Http\
        ├── Controllers\
        │   ├── LoadingSessionController.php
        │   ├── VehiclePlanController.php
        │   ├── VehicleAssignmentController.php
        │   ├── AllocationController.php
        │   ├── DriverController.php
        │   └── LoadingAnalyticsController.php
        ├── Requests\  (per API-CONTRACTS.md)
        └── Resources\
```

---

## 7. Validation Checklist

### Architecture Compliance

- [x] Follows DDD Modular Monolith pattern (same as Preparation OS)
- [x] No direct cross-module DB FKs (uses soft FKs — UUID references only)
- [x] Company isolation enforced at every layer
- [x] Status transitions application-enforced (not DB-enforced)
- [x] UUIDs for all primary keys
- [x] TIMESTAMPTZ for all timestamps
- [x] DECIMAL(18,4) for all quantity/monetary fields

### ADR Compliance

- [x] ADR-015: Loading OS position in fulfillment pipeline confirmed
- [x] ADR-011 (Events): All 11 events follow immutable + actor-stamped + versioned pattern
- [x] ADR-007 (Organization): Company-scoped; no branch references
- [x] ADR-012 (Pricing): No pricing logic in Loading OS (allocation by qty only, not value-based)

### Policy Compliance

- [x] Feature flags guard every mutating operation
- [x] Approval gates documented for all state transitions requiring manager action
- [x] Audit log required for every state change
- [x] Timeline events required for every state change
- [x] AI suggestions are advisory-only; never auto-execute without human confirmation

### Workflow Consistency

- [x] Prepared Products Pool status transitions correctly owned: Prep OS owns `available`; Loading OS owns `loading` → `loaded`; compensating: `loading` → `available` on cancel
- [x] Allocation sum ≤ vehicle inventory (enforced in AllocationEngine)
- [x] Capacity hard limits enforced at Vehicle Planning + Loading (double-check)
- [x] Partial allocations require explicit dispatcher resolution before approval
- [x] Replanning only allowed before `loading` state (not mid-load)

### Event Consistency

- [x] Every Command produces exactly one domain event (or raises an exception)
- [x] Every domain event has a Timeline consumer
- [x] Every domain event has an Audit consumer
- [x] VehicleReleased triggers LogisticsHandoffListener (cross-domain)
- [x] LoadingSessionCancelled triggers PoolReleaseListener (compensating action)

### Integration Consistency

- [x] Prepared Products Pool: correct status transitions documented
- [x] Orders: read-only; status updates via events only (no direct write to orders table)
- [x] Inventory: stock decremented via event listener after vehicle loaded (not at plan time)
- [x] Logistics OS: receives VehicleReleased event to create Shipment
- [x] Packing OS: optional; enabled via Fulfillment Profile config; gated by status check

### UX Consistency

- [x] Every workspace has: Smart Toolbar, loading states, error states, empty states
- [x] Every drawer has a Timeline tab
- [x] Every drawer has a Documents tab
- [x] AI panel present in Dashboard, Vehicle Planning, Allocation workspaces
- [x] Mobile interface designed for warehouse workers (loading tasks) and drivers (route + manifest)
- [x] Keyboard shortcuts documented for power users

### Security Consistency

- [x] 5 roles defined: Loading Manager, Loading Dispatcher, Warehouse Worker, Driver, Viewer
- [x] Permission matrix complete (all permissions × all roles)
- [x] Approval gates documented: Vehicle Plan Approval, Allocation Approval, Partial Override, Capacity Override
- [x] AI is never an actor in the audit log (always `actor_type = system` or `user`; no `actor_type = ai`)

---

## 8. No Unresolved Engineering Questions

| Question | Resolution |
|---|---|
| How does Loading OS find pool entries? | Query `prepared_products_pool` by `company_id`, `planning_date`, `status='available'` |
| Who owns pool status transitions? | Preparation OS: `preparing→available`. Loading OS: `available→loading→loaded`. Cancellation: `loading→available`. |
| How does Logistics OS get handoff data? | Via `loading.vehicle.released` event payload + `/api/v1/loading/vehicle-assignments/{id}/allocation-summary` |
| Can a vehicle be re-assigned after loading starts? | No. Vehicle can only be replaced before `loading` state. |
| What happens to pool entries if session cancelled mid-load? | Loaded entries stay `loaded` (cannot revert physical loading). Unloaded entries return to `available`. A `LoadingException` is raised for partially loaded vehicles. |
| How are partial allocations tracked across multiple sessions? | `AllocationRecord.partial_resolution = 'deferred'` + `re_queued_session_id` FK links to the follow-up session |
| Does the AI write to any business tables? | Never. AI suggestions stored in `loading_ai_suggestions` only. Acceptance of a suggestion calls a normal API command. |
| How is allocation mode configured? | Via Fulfillment Profile `vehicle_allocation.allocation_mode`. Defaults to `full_auto`. |
| What is the session number format? | `LOAD-{YYYY}{MM}-{6-digit seq per company per month}` e.g. `LOAD-202607-000001` |
| What if Geography Engine fails to classify an order? | Order is flagged `geography_unresolved`; session continues without it; exception raised for manual resolution. |

---

## 9. Implementation Readiness

**This blueprint is COMPLETE.** All 8 engineering design documents are finalized. No implementation ambiguity remains.

**Next task:** TASK-LOAD-002 — Full-Stack Implementation (migrations, models, actions, controllers, frontend)

**Prerequisite:** CTO approval of this blueprint before TASK-LOAD-002 begins.
