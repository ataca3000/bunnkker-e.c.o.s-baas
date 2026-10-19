# Preparation OS — Implementation Blueprint

**Document:** PREPARATION-OS-BLUEPRINT  
**Version:** 1.0  
**Status:** APPROVED — Engineering Design Phase  
**Date:** 2026-07-05  
**Task:** TASK-PREP-001  
**Next Phase:** TASK-PREP-002 — Preparation OS Implementation

---

## 1. Mission

Preparation OS transforms reserved inventory into prepared products and places them into the **Prepared Products Pool** — the formal handoff point to Loading & Allocation OS.

It has exactly one job:
> **"Given a set of orders, prepare the right products in the right quantities, record what was actually prepared, and pass the prepared products to the pool."**

Preparation OS ends when products are in the pool. It has no awareness of what happens after.

---

## 2. Bounded Scope

### Preparation OS OWNS

| Concern | Description |
|---|---|
| Preparation Waves | Grouping orders into executable warehouse preparation units |
| Product Demand Aggregation | Summing product quantities across all wave orders |
| Material Requirements Planning (MRP) | Exploding recipes to check raw material availability |
| Production Requirements Planning (PRP) | Identifying products needing manufacturing |
| Shortage Analysis | Detecting and surfacing material shortages |
| Pick List | Consolidated product collection list for the warehouse team |
| Preparation Execution | Recording actual prepared quantities vs. required |
| Prepared Products Pool | First-class inventory buffer; output of every wave |
| Pool Movement Audit | Immutable record of every pool quantity change |
| Stations | Warehouse preparation areas |
| Worker Assignments | Who works on which wave |
| Preparation Exceptions | Blocking issues and warnings during preparation |

### Preparation OS DOES NOT OWN

| Concern | Owner |
|---|---|
| Vehicle assignment | Loading & Allocation OS |
| Shipping waves | Loading & Allocation OS |
| Loading sessions | Loading & Allocation OS |
| Packing / labeling | Packing OS |
| Delivery / routing | Logistics OS |
| Order allocation | Product Allocation Engine |
| Stock reservation | Reservation Engine (Inventory module) |
| Order creation | Commerce |

### Hard Boundary Violations (reject any requirement touching these)

```
vehicles, drivers, routes, packing_sessions, packing_items,
order_allocation, order_handover, logistics, shipping_carriers
```

---

## 3. Position in Fulfillment Platform

```
Orders (confirmed)
    ↓  [Reservation Engine]
Reserved Orders
    ↓  [Geography & Coverage Engine]
Geography Groups
    ↓  [PREPARATION OS — this module]
Prepared Products Pool
    ↓  [Vehicle Planning Engine]
Shipping Waves
    ↓  [Loading & Allocation OS]
Loaded Vehicles
    ↓  [Logistics OS]
Delivery
```

---

## 4. Core Entities

| Entity | Table | Type | Description |
|---|---|---|---|
| **PreparationWave** | `preparation_waves` | Aggregate Root | Groups orders into preparation unit |
| **WaveOrder** | `preparation_wave_orders` | Child | Join table: wave ↔ orders |
| **WaveItem** | `preparation_wave_items` | Child | Required product qty per wave |
| **PickList** | `preparation_pick_lists` | Child | Consolidated pick list header |
| **PickListItem** | `preparation_pick_list_items` | Child | Per-product pick quantity |
| **MaterialRequirement** | `preparation_material_requirements` | Child | MRP output per material |
| **ProductionRequirement** | `preparation_production_requirements` | Child | PRP output per product |
| **PreparedProductsPool** | `prepared_products_pool` | Aggregate Root | Pool inventory buffer |
| **PoolMovement** | `prepared_pool_movements` | Append-Only | Pool audit trail |
| **WaveWorker** | `preparation_wave_workers` | Child | Worker assignment per wave |
| **PreparationStation** | `preparation_stations` | Independent | Warehouse preparation areas |
| **PreparationException** | `preparation_exceptions` | Child | Wave-level exceptions |

---

## 5. Wave Lifecycle

```
draft
  │
  ▼ [GenerateProductDemand command]
planning
  │
  ▼ [AnalyzeMaterials command]
  ├── shortage detected ──► shortage_blocked ──► [shortage resolved] ──┐
  │                                                                      │
  └──────────────────────────────────────────────────────────────────── ▼
                                                                    [StartPreparation command]
                                                                      preparing
                                                                         │
                                                                         ▼ [CompleteWave command]
                                                                      completed
dead ends:
  cancelled  (any state except completed)
```

---

## 6. Key Business Rules

| Rule | Statement |
|---|---|
| **BR-001** | A wave cannot start preparation until all required reservations are confirmed |
| **BR-002** | A wave cannot be completed if any WaveItem is in `blocked` status |
| **BR-003** | PreparedQuantity per item cannot exceed ReservedQuantity unless ManufacturingPolicy.allow_overprepare = true |
| **BR-004** | Completing a wave writes to PreparedProductsPool; this write is idempotent |
| **BR-005** | A shortage-blocked wave can only transition to `preparing` via `resolve_shortage` action by a supervisor |
| **BR-006** | A wave cancellation releases all material reservations (via event) |
| **BR-007** | Pool entries with quality_status = 'failed' cannot be reserved by Loading OS |
| **BR-008** | Worker assignment is recorded with who assigned, who was assigned, and when |
| **BR-009** | All quantities are decimal(18,4); no integer quantity fields |
| **BR-010** | Every wave stores config_version_id of active ManufacturingPolicy at planning time |

---

## 7. Module Folder Structure (Target)

```
backend/Modules/Operations/
└── Preparation/
    ├── Application/
    │   ├── Actions/
    │   │   ├── CreateWaveAction.php
    │   │   ├── GenerateProductDemandAction.php
    │   │   ├── AnalyzeMaterialsAction.php
    │   │   ├── StartPreparationAction.php
    │   │   ├── CompleteProductAction.php
    │   │   ├── CompleteWaveAction.php
    │   │   ├── CancelWaveAction.php
    │   │   └── RecalculateWaveAction.php
    │   ├── DTOs/
    │   └── Services/
    │       ├── MRPCalculationService.php
    │       ├── PRPCalculationService.php
    │       ├── ShortageAnalysisService.php
    │       └── PreparedPoolService.php
    ├── Domain/
    │   ├── Models/
    │   │   ├── PreparationWave.php
    │   │   ├── WaveItem.php
    │   │   ├── PickList.php
    │   │   └── PreparedProductsPool.php
    │   ├── Enums/
    │   │   ├── WaveStatus.php
    │   │   ├── WaveItemStatus.php
    │   │   └── PoolQualityStatus.php
    │   └── Services/
    ├── Infrastructure/
    │   └── Repositories/
    └── Presentation/
        └── Http/
            ├── Controllers/
            │   ├── PreparationWaveController.php
            │   ├── PreparationDashboardController.php
            │   └── PreparedPoolController.php
            ├── Requests/
            └── Resources/
```

---

## 8. Document Index

| # | Document | Content |
|---|---|---|
| 1 | **PREPARATION-OS-BLUEPRINT.md** (this file) | Master overview, scope, business rules, module structure |
| 2 | **DATABASE-DESIGN.md** | Entity specs, ERD, constraints, status models, indexes |
| 3 | **API-CONTRACTS.md** | Command and Query API contracts (request/response/validation/auth/errors) |
| 4 | **UX-ENGINEERING.md** | All screens, drawers, states, navigation, keyboard shortcuts |
| 5 | **BUSINESS-WORKFLOW.md** | Validated complete workflow, exception paths, decision points |
| 6 | **SECURITY-DESIGN.md** | Roles, permissions, audit points, feature flags, policy dependencies |
| 7 | **INTEGRATION-DESIGN.md** | Integration with Orders, Inventory, Recipes, Loading OS, EPS services |
| 8 | **EVENTS-CATALOG.md** | Full business event catalog with payload specs |
| 9 | **AI-INTEGRATION.md** | AI entry points, predictions, bottleneck detection, future hooks |

---

## 9. Architecture Compliance Checklist

| Requirement | Standard | Status |
|---|---|---|
| Aggregate boundary — PreparationWave owns its children | AGGREGATE-CATALOG.md AGG-09 | ✅ Compliant |
| All PKs are UUID | ENG-GOV-002 | ✅ Compliant |
| No auto-increment PKs | ENG-GOV-002 | ✅ Compliant |
| Status columns use VARCHAR + CHECK | ENG-GOV-004 | ✅ Compliant |
| Cross-domain references use UUID only (no FK) | FOREIGN-KEY-STANDARDS.md | ✅ Compliant |
| PreparedPoolMovements are append-only | SOFT-DELETE-ARCHITECTURE.md | ✅ Compliant |
| All entities have audit columns | AUDIT-DATA-MODEL.md | ✅ Compliant |
| Wave stores config_version_id | GOV-010 | ✅ Compliant |
| Events published via EPS-01 | GOV-011 | ✅ Compliant |
| Timeline via EPS-02 | GOV-012 | ✅ Compliant |
| Notifications via EPS-04 | GOV-014 | ✅ Compliant |
| No hardcoded business rules | GOV-001 | ✅ Compliant |
| UX follows WORKSPACE-FRAMEWORK.md | UX-GOV-001 | ✅ Compliant |

---

## 10. Pre-Implementation Checklist (TASK-PREP-002 gate)

Before any implementation begins, verify:

- [ ] DATABASE-DESIGN.md reviewed and approved by Engineering Lead
- [ ] API-CONTRACTS.md reviewed and approved by Engineering Lead  
- [ ] UX-ENGINEERING.md reviewed and approved by Product Owner
- [ ] BUSINESS-WORKFLOW.md reviewed and no unresolved workflow questions
- [ ] SECURITY-DESIGN.md reviewed and permissions matrix approved
- [ ] INTEGRATION-DESIGN.md reviewed and all integration points confirmed available
- [ ] EVENTS-CATALOG.md reviewed and event payloads finalized
- [ ] AI-INTEGRATION.md reviewed and hooks agreed with AI Platform team
- [ ] Feature flag `modules.preparation_os` defined in Configuration Platform
- [ ] `ManufacturingPolicy` and `FulfillmentPolicy` exist in Configuration Platform
- [ ] No unresolved engineering questions remain in any document

---

## 11. Related Architecture Documents

- `docs/domain/Operations-Planning.md` — Operations Planning Engine (source of wave builder design)
- `docs/architecture/ENTERPRISE-FULFILLMENT-PLATFORM.md` — Full platform spec (Section 3: Preparation OS)
- `docs/architecture/ADR-015-enterprise-fulfillment-architecture.md` — ADR governing fulfillment flow
- `docs/architecture/ENTERPRISE-CONFIGURATION-PLATFORM.md` — ManufacturingPolicy, FulfillmentPolicy
- `docs/architecture/ENTERPRISE-PLATFORM-SERVICES.md` — EPS-01 Events, EPS-02 Timeline, EPS-04 Notifications
- `docs/data/AGGREGATE-MAPPING.md` — AGG-09 PreparationWave
- `docs/engineering/DATABASE-ENGINEERING-STANDARDS.md` — All DB engineering standards
- `docs/contracts/COMMAND-CONTRACTS.md` — CreatePreparationWave, StartPreparation, CompletePreparation
- `docs/contracts/EVENT-CONTRACTS.md` — preparation.wave.* events
