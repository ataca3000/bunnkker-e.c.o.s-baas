# Loading & Allocation OS — Database Design

**Document:** DATABASE-DESIGN
**Version:** 1.0
**Status:** APPROVED — Engineering Design Phase
**Date:** 2026-07-05
**Task:** TASK-LOAD-001
**Parent:** BLUEPRINT.md
**Standards:** DATABASE-ENGINEERING-STANDARDS.md

---

## 1. Entity Relationship Diagram

```
                    ┌──────────────────────────────────────────────┐
                    │              loading_sessions                 │
                    │    (AGG-LA-01 — LoadingSession Root)         │
                    └──────────────────────┬───────────────────────┘
                                           │
          ┌────────────────────────────────┼──────────────────────────────┐
          │                               │                              │
          ▼                               ▼                              ▼
┌──────────────────┐         ┌─────────────────────────┐    ┌─────────────────────┐
│  loading_tasks   │         │  vehicle_assignments     │    │  loading_exceptions │
│ (per product,    │         │  (AGG-LA-03 Root)        │    │  (session audit)    │
│  per session)    │         └──────────┬──────────────┘    └─────────────────────┘
└──────────────────┘                   │
                         ┌─────────────┼──────────────────────────┐
                         │             │                           │
                         ▼             ▼                           ▼
             ┌───────────────┐  ┌─────────────────┐  ┌─────────────────────┐
             │vehicle_       │  │ allocation_      │  │  driver_assignments │
             │inventory_items│  │ records          │  │ (AGG-LA-05 Root)    │
             │(vehicle ledger│  │ (AGG-LA-04       │  └─────────────────────┘
             │ current state)│  │  per-order alloc)│
             └───────┬───────┘  └──────────────────┘
                     │
                     ▼
        ┌────────────────────────────┐
        │ vehicle_inventory_movements│
        │ (immutable append-only log)│
        └────────────────────────────┘

  ┌───────────────────────────────────────────────────────────────────────┐
  │                     vehicle_plans                                     │
  │               (AGG-LA-02 — VehiclePlan Root)                         │
  └─────────────────────────┬─────────────────────────────────────────────┘
                            │
              ┌─────────────┼────────────────┐
              │             │                │
              ▼             ▼                ▼
     ┌────────────────┐  ┌───────────────┐  ┌──────────────────────────┐
     │vehicle_plan_   │  │vehicle_plan_  │  │ vehicle_plan_adjustment_ │
     │slots           │  │slot_orders    │  │ log                      │
     │(one vehicle    │  │(orders per    │  │(manual planner actions)  │
     │ slot per plan) │  │ slot)         │  └──────────────────────────┘
     └────────────────┘  └───────────────┘

  vehicle_assignments (1) ──────────── (1) vehicle_capacity_snapshots
  vehicle_assignments (1) ──────────── (N) allocation_records
  allocation_records  (1) ──────────── (N) allocation_decisions
  vehicle_assignments (1) ──────────── (1) route_plans
  route_plans         (1) ──────────── (N) route_plan_stops
  loading_sessions    (1) ──────────── (N) shipment_groups
  shipment_groups     (1) ──────────── (N) shipment_group_items

  vehicle_inventory_items (1) ─────── (N) vehicle_inventory_movements
  vehicles (1) ──────────────────── (N) vehicle_shift_reconciliations
  vehicle_shift_reconciliations (1) ─ (N) vehicle_shift_reconciliation_lines

  prepared_products_pool  [cross-domain input — upstream from Preparation OS]
```

---

## 2. Entity Specifications

---

### Entity: loading_sessions

```
Table:  loading_sessions
Domain: Operations → Loading & Allocation OS
Aggregate: LoadingSession (AGG-LA-01) — Root
Identity: UUID
Company Scoped: Yes
Soft Delete: Status-based (no deletion; use 'cancelled')

Columns:
  id:                       UUID NOT NULL PK
  company_id:               UUID NOT NULL              — FK to companies
  warehouse_id:             UUID NOT NULL              — cross-domain ref to warehouses (no FK)
  session_number:           VARCHAR(50) NOT NULL       — Business key: LOAD-{YYYY}{MM}-{seq}
  operational_date:         DATE NOT NULL              — The operational day this session serves
  vehicle_plan_id:          UUID NULL                  — cross-domain ref to vehicle_plans (soft FK)
  status:                   VARCHAR(50) NOT NULL       — Session lifecycle state (see status model)
  session_type:             VARCHAR(50) NOT NULL DEFAULT 'standard'
                                                       — 'standard' | 'rush' | 'rerun' | 'supplementary'
  vehicles_count:           INT NOT NULL DEFAULT 0     — Denormalized; updated on assignment
  orders_count:             INT NOT NULL DEFAULT 0     — Total orders covered by this session
  products_count:           INT NOT NULL DEFAULT 0     — Unique products being loaded
  total_units_to_load:      DECIMAL(18,4) NOT NULL DEFAULT 0
                                                       — Sum of all loading task quantities
  total_units_loaded:       DECIMAL(18,4) NOT NULL DEFAULT 0
                                                       — Confirmed loaded quantity
  loading_started_at:       TIMESTAMPTZ NULL           — Physical loading begins
  loading_started_by:       UUID NULL                  — FK to users
  loading_completed_at:     TIMESTAMPTZ NULL           — All tasks confirmed or closed
  loading_completed_by:     UUID NULL                  — FK to users
  allocation_started_at:    TIMESTAMPTZ NULL           — Allocation engine invoked
  allocation_completed_at:  TIMESTAMPTZ NULL
  dispatched_at:            TIMESTAMPTZ NULL           — All vehicles dispatched
  dispatched_by:            UUID NULL                  — FK to users
  cancelled_at:             TIMESTAMPTZ NULL
  cancelled_by:             UUID NULL                  — FK to users
  cancellation_reason:      TEXT NULL
  config_version_id:        UUID NULL                  — Config version at session open time (GOV-010)
  supervisor_id:            UUID NULL                  — FK to users; session supervisor
  notes:                    TEXT NULL
  created_at:               TIMESTAMPTZ NOT NULL DEFAULT NOW()
  created_by:               UUID NOT NULL              — FK to users
  updated_at:               TIMESTAMPTZ NOT NULL DEFAULT NOW()
  updated_by:               UUID NOT NULL              — FK to users

Natural Keys: (company_id, session_number) UNIQUE
```

**Status Model:**
```
'draft'              — Session created; vehicle assignments not yet confirmed
'ready'              — All vehicle assignments confirmed; loading tasks generated
'loading'            — Physical loading in progress
'loading_complete'   — All tasks confirmed; allocation engine has not yet run
'allocating'         — Product Allocation Engine is running
'allocated'          — Allocation records produced; awaiting dispatcher review
'dispatching'        — Vehicles being dispatched one by one
'dispatched'         — All vehicles dispatched; active delivery phase
'reconciling'        — One or more vehicles are in end-of-shift reconciliation
'closed'             — All vehicles reconciled; session fully settled
'cancelled'          — Session terminated; all reservations released
```

**CHECK Constraints:**
```sql
CONSTRAINT chk_loading_sessions_status CHECK (status IN (
  'draft', 'ready', 'loading', 'loading_complete', 'allocating',
  'allocated', 'dispatching', 'dispatched', 'reconciling', 'closed', 'cancelled'
))
CONSTRAINT chk_loading_sessions_type CHECK (session_type IN (
  'standard', 'rush', 'rerun', 'supplementary'
))
CONSTRAINT chk_loading_sessions_units_non_neg CHECK (total_units_to_load >= 0)
CONSTRAINT chk_loading_sessions_loaded_non_neg CHECK (total_units_loaded >= 0)
CONSTRAINT chk_loading_sessions_loaded_le_planned CHECK (
  total_units_loaded <= total_units_to_load + 0.0001  — tolerance for rounding
)
```

**Indexes:**
```sql
idx_loading_sessions_company_id
idx_loading_sessions_company_status           (company_id, status)
idx_loading_sessions_company_date             (company_id, operational_date)
idx_loading_sessions_warehouse_id
idx_loading_sessions_vehicle_plan_id          (vehicle_plan_id) WHERE vehicle_plan_id IS NOT NULL
uq_loading_sessions_company_number            UNIQUE (company_id, session_number)
```

---

### Entity: vehicle_plans

```
Table:  vehicle_plans
Domain: Operations → Loading & Allocation OS (Vehicle Planning Engine output)
Aggregate: VehiclePlan (AGG-LA-02) — Root
Identity: UUID
Company Scoped: Yes
Soft Delete: Status-based ('cancelled' | 'superseded')

Columns:
  id:                       UUID NOT NULL PK
  company_id:               UUID NOT NULL              — FK to companies
  operational_date:         DATE NOT NULL              — Planning day
  plan_number:              VARCHAR(50) NOT NULL       — Business key: VPLAN-{YYYY}{MM}-{seq}
  geography_group_id:       UUID NULL                  — cross-domain ref (no FK); source group
  shipping_company_id:      UUID NOT NULL              — cross-domain ref to shipping_companies (no FK)
  zone_id:                  UUID NOT NULL              — cross-domain ref to zones (no FK)
  governorate_id:           UUID NOT NULL              — cross-domain ref to governorates (no FK)
  status:                   VARCHAR(50) NOT NULL       — Plan lifecycle (see status model)
  distribution_policy:      VARCHAR(50) NOT NULL DEFAULT 'round_robin_weight'
                                                       — Algorithm used at planning time
  version:                  INT NOT NULL DEFAULT 1     — Increments on every replan
  superseded_by_id:         UUID NULL                  — If replanned: ref to successor plan (no FK)
  slots_count:              INT NOT NULL DEFAULT 0     — Denormalized: number of VehiclePlanSlots
  orders_count:             INT NOT NULL DEFAULT 0     — Total orders across all slots
  total_weight_kg:          DECIMAL(18,4) NOT NULL DEFAULT 0
  total_volume_m3:          DECIMAL(18,4) NOT NULL DEFAULT 0
  proposed_at:              TIMESTAMPTZ NULL           — Engine finished calculating
  proposed_by:              UUID NULL                  — system actor UUID or NULL
  approved_at:              TIMESTAMPTZ NULL
  approved_by:              UUID NULL                  — FK to users
  cancelled_at:             TIMESTAMPTZ NULL
  cancelled_by:             UUID NULL                  — FK to users
  cancellation_reason:      TEXT NULL
  replan_trigger:           VARCHAR(100) NULL          — Trigger that caused this version
                                                       — 'vehicle_breakdown' | 'driver_change' |
                                                       — 'late_orders' | 'rush_orders' |
                                                       — 'route_change' | 'manual_replan' |
                                                       — 'automatic_replan' | NULL (first version)
  notes:                    TEXT NULL
  created_at:               TIMESTAMPTZ NOT NULL DEFAULT NOW()
  created_by:               UUID NOT NULL              — FK to users or system actor
  updated_at:               TIMESTAMPTZ NOT NULL DEFAULT NOW()
  updated_by:               UUID NOT NULL

Natural Keys: (company_id, plan_number) UNIQUE
```

**Status Model:**
```
'calculating'   — Vehicle Planning Engine is computing the distribution
'proposed'      — Engine finished; awaiting planner review
'approved'      — Planner accepted the plan; ready for vehicle assignment
'loading'       — Linked Loading Session has started
'dispatched'    — All vehicles in this plan have been dispatched
'completed'     — All deliveries confirmed and reconciled
'cancelled'     — Plan abandoned; associated slots removed
'superseded'    — A newer version of this plan has been approved (replan occurred)
```

**CHECK Constraints:**
```sql
CONSTRAINT chk_vehicle_plans_status CHECK (status IN (
  'calculating', 'proposed', 'approved', 'loading',
  'dispatched', 'completed', 'cancelled', 'superseded'
))
CONSTRAINT chk_vehicle_plans_distribution_policy CHECK (distribution_policy IN (
  'round_robin_weight', 'geographic_proximity', 'order_priority', 'fifo'
))
CONSTRAINT chk_vehicle_plans_replan_trigger CHECK (replan_trigger IS NULL OR replan_trigger IN (
  'vehicle_breakdown', 'driver_change', 'extra_vehicle', 'late_orders',
  'rush_orders', 'route_change', 'manual_replan', 'automatic_replan'
))
CONSTRAINT chk_vehicle_plans_version_positive CHECK (version >= 1)
CONSTRAINT chk_vehicle_plans_weight_non_neg CHECK (total_weight_kg >= 0)
CONSTRAINT chk_vehicle_plans_volume_non_neg CHECK (total_volume_m3 >= 0)
```

**Indexes:**
```sql
idx_vehicle_plans_company_id
idx_vehicle_plans_company_status              (company_id, status)
idx_vehicle_plans_company_date                (company_id, operational_date)
idx_vehicle_plans_shipping_company_id         (shipping_company_id)
idx_vehicle_plans_zone_id                     (zone_id)
idx_vehicle_plans_superseded_by               (superseded_by_id) WHERE superseded_by_id IS NOT NULL
uq_vehicle_plans_company_number               UNIQUE (company_id, plan_number)
```

---

### Entity: vehicle_plan_slots

```
Table:  vehicle_plan_slots
Domain: Operations → Loading & Allocation OS
Aggregate: VehiclePlan (AGG-LA-02) — Child
Identity: UUID
Company Scoped: Yes
Soft Delete: No (slots are replaced during replan — old plan archived as 'superseded')

Columns:
  id:                       UUID NOT NULL PK
  company_id:               UUID NOT NULL
  vehicle_plan_id:          UUID NOT NULL              — FK to vehicle_plans
  slot_number:              INT NOT NULL               — 1-indexed within the plan
  vehicle_id:               UUID NULL                  — cross-domain ref to vehicles (no FK)
                                                       — NULL until vehicle assignment step
  vehicle_registration_snapshot: VARCHAR(50) NULL      — denormalized at assignment time
  vehicle_type_snapshot:    VARCHAR(50) NULL           — denormalized at assignment time
  capacity_weight_kg:       DECIMAL(18,4) NULL         — vehicle's max weight at assignment time
  capacity_volume_m3:       DECIMAL(18,4) NULL         — vehicle's max volume at assignment time
  order_count:              INT NOT NULL DEFAULT 0     — denormalized; orders in this slot
  total_weight_kg:          DECIMAL(18,4) NOT NULL DEFAULT 0  — sum of order weights
  total_volume_m3:          DECIMAL(18,4) NOT NULL DEFAULT 0  — sum of order volumes
  utilization_pct:          DECIMAL(5,2) NOT NULL DEFAULT 0
                                                       — max(weight_pct, order_pct, volume_pct)
  is_overloaded:            BOOLEAN NOT NULL DEFAULT false
                                                       — true if any constraint is exceeded
  requires_refrigeration:   BOOLEAN NOT NULL DEFAULT false
                                                       — computed from products in slot
  vehicle_assigned_at:      TIMESTAMPTZ NULL
  vehicle_assigned_by:      UUID NULL                  — FK to users
  status:                   VARCHAR(50) NOT NULL DEFAULT 'unassigned'
  notes:                    TEXT NULL
  created_at:               TIMESTAMPTZ NOT NULL DEFAULT NOW()
  created_by:               UUID NOT NULL
  updated_at:               TIMESTAMPTZ NOT NULL DEFAULT NOW()
  updated_by:               UUID NOT NULL

Natural Keys: (vehicle_plan_id, slot_number) UNIQUE
```

**Slot Status Model:**
```
'unassigned'    — Slot exists; no vehicle linked yet
'assigned'      — Vehicle linked but not yet confirmed
'confirmed'     — Vehicle + driver confirmed; slot enters Loading OS
'loading'       — Physical loading underway
'dispatched'    — Vehicle departed
'completed'     — Vehicle returned and reconciled
```

**CHECK Constraints:**
```sql
CONSTRAINT chk_plan_slots_status CHECK (status IN (
  'unassigned', 'assigned', 'confirmed', 'loading', 'dispatched', 'completed'
))
CONSTRAINT chk_plan_slots_slot_number_positive CHECK (slot_number >= 1)
CONSTRAINT chk_plan_slots_utilization_range CHECK (utilization_pct >= 0 AND utilization_pct <= 200)
CONSTRAINT chk_plan_slots_weight_non_neg CHECK (total_weight_kg >= 0)
CONSTRAINT chk_plan_slots_volume_non_neg CHECK (total_volume_m3 >= 0)
```

**FK Constraints:**
```sql
fk_vehicle_plan_slots_vehicle_plan_id → vehicle_plans.id (RESTRICT)
```

**Indexes:**
```sql
idx_plan_slots_vehicle_plan_id               (vehicle_plan_id)
idx_plan_slots_vehicle_id                    (vehicle_id) WHERE vehicle_id IS NOT NULL
idx_plan_slots_plan_status                   (vehicle_plan_id, status)
uq_plan_slots_plan_slot_number               UNIQUE (vehicle_plan_id, slot_number)
```

---

### Entity: vehicle_plan_slot_orders

```
Table:  vehicle_plan_slot_orders
Domain: Operations → Loading & Allocation OS
Aggregate: VehiclePlan (AGG-LA-02) — Child (join between slot and order)
Identity: UUID
Company Scoped: Yes
Soft Delete: No (records are regenerated when slots change)

Columns:
  id:                       UUID NOT NULL PK
  company_id:               UUID NOT NULL
  vehicle_plan_slot_id:     UUID NOT NULL              — FK to vehicle_plan_slots
  vehicle_plan_id:          UUID NOT NULL              — denormalized for filtering (no extra join)
  order_id:                 UUID NOT NULL              — cross-domain ref to orders (no FK)
  order_number_snapshot:    VARCHAR(50) NOT NULL       — denormalized at planning time
  order_type_snapshot:      VARCHAR(50) NULL           — 'paid' | 'cod' | 'deferred' | 'other'
  channel_id_snapshot:      UUID NULL                  — cross-domain ref (no FK); for display
  zone_id_snapshot:         UUID NULL                  — cross-domain ref; geographic context
  estimated_weight_kg:      DECIMAL(18,4) NOT NULL DEFAULT 0
  estimated_volume_m3:      DECIMAL(18,4) NOT NULL DEFAULT 0
  stop_sequence:            INT NULL                   — pre-assigned route sequence (if known)
  added_at:                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
  added_by:                 UUID NOT NULL              — FK to users or system actor
  moved_from_slot_id:       UUID NULL                  — if this order was moved from another slot

Natural Keys: (vehicle_plan_slot_id, order_id) UNIQUE
```

**FK Constraints:**
```sql
fk_plan_slot_orders_slot_id      → vehicle_plan_slots.id (RESTRICT)
fk_plan_slot_orders_vehicle_plan → vehicle_plans.id (RESTRICT)
```

**Indexes:**
```sql
idx_plan_slot_orders_slot_id                 (vehicle_plan_slot_id)
idx_plan_slot_orders_plan_id                 (vehicle_plan_id)
idx_plan_slot_orders_order_id                (order_id)
uq_plan_slot_orders_slot_order               UNIQUE (vehicle_plan_slot_id, order_id)
```

---

### Entity: vehicle_plan_adjustment_log

```
Table:  vehicle_plan_adjustment_log
Domain: Operations → Loading & Allocation OS
Aggregate: VehiclePlan (AGG-LA-02) — Append-Only Audit Child
Identity: ULID (high-volume append-only audit log)
Company Scoped: Yes
Soft Delete: Append-Only (never deleted, never updated)

Columns:
  id:                       CHAR(26) NOT NULL PK       — ULID
  company_id:               UUID NOT NULL
  vehicle_plan_id:          UUID NOT NULL              — FK to vehicle_plans
  action_type:              VARCHAR(50) NOT NULL       — type of manual adjustment
  actor_id:                 UUID NOT NULL              — FK to users (planner)
  slot_id_from:             UUID NULL                  — source slot (for move operations)
  slot_id_to:               UUID NULL                  — target slot (for move operations)
  order_id:                 UUID NULL                  — order affected (for order-level actions)
  vehicle_id_before:        UUID NULL                  — vehicle before assignment change
  vehicle_id_after:         UUID NULL                  — vehicle after assignment change
  before_state:             JSONB NULL                 — serialized state snapshot before action
  after_state:              JSONB NULL                 — serialized state snapshot after action
  reason:                   TEXT NOT NULL              — required for all manual actions
  recorded_at:              TIMESTAMPTZ NOT NULL DEFAULT NOW()

No updated_at, updated_by (append-only)
```

**Action Type Values:**
```
'merge_slots'       — Two slots combined into one
'split_slot'        — One slot divided into two
'move_order'        — Order moved from one slot to another
'create_slot'       — New slot added manually
'delete_slot'       — Empty slot removed
'assign_vehicle'    — Vehicle linked to slot
'unassign_vehicle'  — Vehicle removed from slot
'approve_plan'      — Planner approved the plan
'replan_triggered'  — Replan initiated; this plan version superseded
```

**CHECK Constraints:**
```sql
CONSTRAINT chk_plan_adj_action CHECK (action_type IN (
  'merge_slots', 'split_slot', 'move_order', 'create_slot',
  'delete_slot', 'assign_vehicle', 'unassign_vehicle',
  'approve_plan', 'replan_triggered'
))
```

**FK Constraints:**
```sql
fk_plan_adj_log_vehicle_plan_id → vehicle_plans.id (RESTRICT)
```

**Indexes:**
```sql
idx_plan_adj_log_vehicle_plan_id             (vehicle_plan_id)
idx_plan_adj_log_actor_id                    (actor_id)
idx_plan_adj_log_recorded_at                 (recorded_at)
idx_plan_adj_log_company_date                (company_id, recorded_at)
```

---

### Entity: vehicle_assignments

```
Table:  vehicle_assignments
Domain: Operations → Loading & Allocation OS
Aggregate: VehicleAssignment (AGG-LA-03) — Root
Identity: UUID
Company Scoped: Yes
Soft Delete: Status-based ('cancelled')

Columns:
  id:                       UUID NOT NULL PK
  company_id:               UUID NOT NULL              — FK to companies
  loading_session_id:       UUID NOT NULL              — FK to loading_sessions
  vehicle_plan_slot_id:     UUID NULL                  — cross-domain ref (soft FK)
                                                       — NULL if assignment is ad-hoc (no plan)
  vehicle_id:               UUID NOT NULL              — cross-domain ref to vehicles (no FK)
  vehicle_registration_snapshot: VARCHAR(50) NOT NULL  — denormalized at assignment time
  vehicle_type_snapshot:    VARCHAR(50) NOT NULL       — denormalized
  capacity_weight_kg_snapshot:   DECIMAL(18,4) NOT NULL — denormalized at assignment
  capacity_volume_m3_snapshot:   DECIMAL(18,4) NOT NULL — denormalized at assignment
  refrigerated_snapshot:    BOOLEAN NOT NULL DEFAULT false — denormalized
  assignment_number:        VARCHAR(50) NOT NULL       — Business key: VASN-{YYYY}{MM}-{seq}
  status:                   VARCHAR(50) NOT NULL       — Assignment lifecycle (see status model)
  orders_count:             INT NOT NULL DEFAULT 0     — orders assigned to this vehicle
  loading_weight_kg:        DECIMAL(18,4) NOT NULL DEFAULT 0  — actual weight loaded
  loading_volume_m3:        DECIMAL(18,4) NOT NULL DEFAULT 0  — actual volume loaded
  loading_started_at:       TIMESTAMPTZ NULL
  loading_completed_at:     TIMESTAMPTZ NULL
  dispatched_at:            TIMESTAMPTZ NULL
  dispatched_by:            UUID NULL                  — FK to users
  returned_at:              TIMESTAMPTZ NULL           — vehicle physically back at warehouse
  reconciled_at:            TIMESTAMPTZ NULL
  cancelled_at:             TIMESTAMPTZ NULL
  cancelled_by:             UUID NULL                  — FK to users
  cancellation_reason:      TEXT NULL
  notes:                    TEXT NULL
  created_at:               TIMESTAMPTZ NOT NULL DEFAULT NOW()
  created_by:               UUID NOT NULL              — FK to users
  updated_at:               TIMESTAMPTZ NOT NULL DEFAULT NOW()
  updated_by:               UUID NOT NULL

Natural Keys: (company_id, assignment_number) UNIQUE
```

**Status Model:**
```
'pending'           — Assignment created; loading not yet started
'loading'           — Physical loading in progress for this vehicle
'loading_complete'  — Loading confirmed; awaiting dispatch authorization
'dispatched'        — Vehicle departed warehouse
'returning'         — Vehicle en route back to warehouse
'reconciling'       — End-of-shift reconciliation session open
'reconciled'        — Inventory fully balanced; assignment closed
'cancelled'         — Assignment voided before or during loading
```

**CHECK Constraints:**
```sql
CONSTRAINT chk_vehicle_assignments_status CHECK (status IN (
  'pending', 'loading', 'loading_complete', 'dispatched',
  'returning', 'reconciling', 'reconciled', 'cancelled'
))
CONSTRAINT chk_vehicle_assignments_weight_non_neg CHECK (loading_weight_kg >= 0)
CONSTRAINT chk_vehicle_assignments_volume_non_neg CHECK (loading_volume_m3 >= 0)
CONSTRAINT chk_vehicle_assignments_weight_capacity CHECK (
  loading_weight_kg <= capacity_weight_kg_snapshot * 1.05  — 5% tolerance for measurement
)
CONSTRAINT chk_vehicle_assignments_orders_non_neg CHECK (orders_count >= 0)
```

**FK Constraints:**
```sql
fk_vehicle_assignments_loading_session_id → loading_sessions.id (RESTRICT)
```

**Indexes:**
```sql
idx_vehicle_assignments_loading_session_id   (loading_session_id)
idx_vehicle_assignments_vehicle_id           (vehicle_id)
idx_vehicle_assignments_company_status       (company_id, status)
idx_vehicle_assignments_plan_slot            (vehicle_plan_slot_id) WHERE vehicle_plan_slot_id IS NOT NULL
uq_vehicle_assignments_company_number        UNIQUE (company_id, assignment_number)
```

---

### Entity: vehicle_capacity_snapshots

```
Table:  vehicle_capacity_snapshots
Domain: Operations → Loading & Allocation OS
Aggregate: VehicleAssignment (AGG-LA-03) — Child (1:1 with assignment)
Identity: UUID
Company Scoped: Yes
Soft Delete: No (immutable at creation time; records the capacity check result)

Columns:
  id:                       UUID NOT NULL PK
  company_id:               UUID NOT NULL
  vehicle_assignment_id:    UUID NOT NULL UNIQUE       — FK to vehicle_assignments (1:1)
  checked_at:               TIMESTAMPTZ NOT NULL       — when capacity validation ran
  checked_by:               UUID NOT NULL              — FK to users or system actor
  orders_count:             INT NOT NULL DEFAULT 0
  planned_weight_kg:        DECIMAL(18,4) NOT NULL     — expected load weight from plan
  planned_volume_m3:        DECIMAL(18,4) NOT NULL
  vehicle_max_weight_kg:    DECIMAL(18,4) NOT NULL     — vehicle's rated capacity at check time
  vehicle_max_volume_m3:    DECIMAL(18,4) NOT NULL
  weight_utilization_pct:   DECIMAL(5,2) NOT NULL      — planned_weight / max_weight × 100
  volume_utilization_pct:   DECIMAL(5,2) NOT NULL
  order_utilization_pct:    DECIMAL(5,2) NOT NULL      — orders_count / max_orders × 100
  overall_utilization_pct:  DECIMAL(5,2) NOT NULL      — max of the three
  is_overloaded:            BOOLEAN NOT NULL DEFAULT false
  overload_reason:          TEXT NULL                  — which constraint was violated
  max_orders_limit:         INT NOT NULL               — shipping company limit at check time
  policy_evaluation_id:     UUID NULL                  — cross-domain ref to PolicyEvaluationAudit
  created_at:               TIMESTAMPTZ NOT NULL DEFAULT NOW()
  created_by:               UUID NOT NULL

No updated_at (immutable snapshot — never modified)
```

**FK Constraints:**
```sql
fk_vehicle_capacity_snapshots_assignment → vehicle_assignments.id (RESTRICT)
```

**Indexes:**
```sql
idx_veh_capacity_snap_assignment_id          (vehicle_assignment_id)
idx_veh_capacity_snap_company_date           (company_id, checked_at)
idx_veh_capacity_snap_overloaded             (is_overloaded) WHERE is_overloaded = true
```

---

### Entity: loading_tasks

```
Table:  loading_tasks
Domain: Operations → Loading & Allocation OS
Aggregate: LoadingSession (AGG-LA-01) — Child
Identity: UUID
Company Scoped: Yes
Soft Delete: No (status-based; tasks are generated per session)

Columns:
  id:                       UUID NOT NULL PK
  company_id:               UUID NOT NULL
  loading_session_id:       UUID NOT NULL              — FK to loading_sessions
  vehicle_assignment_id:    UUID NOT NULL              — FK to vehicle_assignments
  pool_entry_id:            UUID NOT NULL              — cross-domain ref to prepared_products_pool
  product_id:               UUID NOT NULL              — cross-domain ref to products (no FK)
  sku_snapshot:             VARCHAR(100) NOT NULL      — denormalized at task creation
  name_snapshot:            VARCHAR(255) NOT NULL      — denormalized
  preparation_wave_id:      UUID NOT NULL              — cross-domain ref (no FK); traceability
  quantity_planned:         DECIMAL(18,4) NOT NULL     — from pool reservation / plan
  quantity_loaded:          DECIMAL(18,4) NOT NULL DEFAULT 0
  quantity_short:           DECIMAL(18,4) NOT NULL DEFAULT 0
                                                       — computed: max(0, planned - loaded)
  status:                   VARCHAR(50) NOT NULL DEFAULT 'pending'
  requires_refrigeration:   BOOLEAN NOT NULL DEFAULT false
  loaded_by:                UUID NULL                  — FK to users (loader operator)
  loaded_at:                TIMESTAMPTZ NULL
  confirmed_by:             UUID NULL                  — FK to users (supervisor confirmation)
  confirmed_at:             TIMESTAMPTZ NULL
  short_reason:             TEXT NULL                  — required when quantity_short > 0
  notes:                    TEXT NULL
  created_at:               TIMESTAMPTZ NOT NULL DEFAULT NOW()
  created_by:               UUID NOT NULL
  updated_at:               TIMESTAMPTZ NOT NULL DEFAULT NOW()
  updated_by:               UUID NOT NULL

Natural Keys: (vehicle_assignment_id, product_id) UNIQUE — one task per product per assignment
```

**Status Model:**
```
'pending'       — Task generated; not yet started
'in_progress'   — Loader is actively loading this product
'loaded'        — Full planned quantity confirmed loaded
'short_loaded'  — quantity_loaded < quantity_planned; loading closed with variance
'blocked'       — Cannot load; exception raised (product unavailable, pool entry failed, etc.)
'skipped'       — Supervisor elected to skip this product for this vehicle
```

**CHECK Constraints:**
```sql
CONSTRAINT chk_loading_tasks_status CHECK (status IN (
  'pending', 'in_progress', 'loaded', 'short_loaded', 'blocked', 'skipped'
))
CONSTRAINT chk_loading_tasks_qty_planned_positive CHECK (quantity_planned > 0)
CONSTRAINT chk_loading_tasks_qty_loaded_non_neg CHECK (quantity_loaded >= 0)
CONSTRAINT chk_loading_tasks_qty_short_non_neg CHECK (quantity_short >= 0)
```

**FK Constraints:**
```sql
fk_loading_tasks_session_id    → loading_sessions.id (RESTRICT)
fk_loading_tasks_assignment_id → vehicle_assignments.id (RESTRICT)
```

**Indexes:**
```sql
idx_loading_tasks_session_id                 (loading_session_id)
idx_loading_tasks_assignment_id              (vehicle_assignment_id)
idx_loading_tasks_pool_entry_id              (pool_entry_id)
idx_loading_tasks_product_id                 (product_id)
idx_loading_tasks_assignment_status          (vehicle_assignment_id, status)
uq_loading_tasks_assignment_product          UNIQUE (vehicle_assignment_id, product_id)
```

---

### Entity: vehicle_inventory_items

```
Table:  vehicle_inventory_items
Domain: Operations → Loading & Allocation OS (Mobile Warehouse)
Aggregate: VehicleAssignment (AGG-LA-03) — Child (current-state ledger)
Identity: UUID
Company Scoped: Yes
Soft Delete: No (status-based; row exists for the lifetime of the trip)

Purpose:
  The vehicle inventory ledger. One row per (vehicle_assignment, product).
  quantity_on_hand is always derived — never set directly.
  quantity_on_hand = quantity_loaded - quantity_delivered - quantity_returned

Columns:
  id:                       UUID NOT NULL PK
  company_id:               UUID NOT NULL
  vehicle_assignment_id:    UUID NOT NULL              — FK to vehicle_assignments
  vehicle_id:               UUID NOT NULL              — denormalized for direct query (no join)
  product_id:               UUID NOT NULL              — cross-domain ref to products (no FK)
  sku_snapshot:             VARCHAR(100) NOT NULL      — denormalized at load time
  name_snapshot:            VARCHAR(255) NOT NULL
  operational_date:         DATE NOT NULL              — trip date (for multi-load day support)
  pool_entry_id:            UUID NOT NULL              — cross-domain ref to prepared_products_pool
  loading_task_id:          UUID NOT NULL              — FK to loading_tasks; loading origin
  quantity_loaded:          DECIMAL(18,4) NOT NULL DEFAULT 0   — total confirmed loaded
  quantity_allocated:       DECIMAL(18,4) NOT NULL DEFAULT 0
                                                       — total allocated to orders via AllocationEngine
  quantity_delivered:       DECIMAL(18,4) NOT NULL DEFAULT 0   — confirmed delivered (from Logistics OS)
  quantity_returned:        DECIMAL(18,4) NOT NULL DEFAULT 0   — physically returned at reconciliation
  quantity_on_hand:         DECIMAL(18,4) NOT NULL DEFAULT 0
                                                       — computed; maintained via triggers/application
  quantity_unallocated:     DECIMAL(18,4) NOT NULL DEFAULT 0
                                                       — loaded - allocated; available to allocate
  requires_refrigeration:   BOOLEAN NOT NULL DEFAULT false
  status:                   VARCHAR(50) NOT NULL DEFAULT 'active'
  last_movement_at:         TIMESTAMPTZ NOT NULL DEFAULT NOW()
  created_at:               TIMESTAMPTZ NOT NULL DEFAULT NOW()
  created_by:               UUID NOT NULL
  updated_at:               TIMESTAMPTZ NOT NULL DEFAULT NOW()
  updated_by:               UUID NOT NULL

Natural Keys: (vehicle_assignment_id, product_id) UNIQUE
```

**Status Model:**
```
'active'        — Product is on the vehicle; delivery in progress
'depleted'      — quantity_on_hand = 0; all units delivered or returned
'returned'      — Vehicle returned; product counted back into warehouse
'variance'      — Reconciliation found discrepancy; under investigation
```

**CHECK Constraints:**
```sql
CONSTRAINT chk_veh_inv_items_status CHECK (status IN (
  'active', 'depleted', 'returned', 'variance'
))
CONSTRAINT chk_veh_inv_items_qty_loaded_non_neg CHECK (quantity_loaded >= 0)
CONSTRAINT chk_veh_inv_items_qty_delivered_non_neg CHECK (quantity_delivered >= 0)
CONSTRAINT chk_veh_inv_items_qty_returned_non_neg CHECK (quantity_returned >= 0)
CONSTRAINT chk_veh_inv_items_qty_on_hand_non_neg CHECK (quantity_on_hand >= 0)
CONSTRAINT chk_veh_inv_items_qty_allocated_non_neg CHECK (quantity_allocated >= 0)
CONSTRAINT chk_veh_inv_items_delivered_le_loaded CHECK (
  quantity_delivered + quantity_returned <= quantity_loaded + 0.0001
)
```

**FK Constraints:**
```sql
fk_veh_inv_items_assignment_id → vehicle_assignments.id (RESTRICT)
fk_veh_inv_items_loading_task  → loading_tasks.id (RESTRICT)
```

**Indexes:**
```sql
idx_veh_inv_items_assignment_id              (vehicle_assignment_id)
idx_veh_inv_items_vehicle_id                 (vehicle_id)
idx_veh_inv_items_product_id                 (product_id)
idx_veh_inv_items_vehicle_date               (vehicle_id, operational_date)
idx_veh_inv_items_status                     (vehicle_assignment_id, status)
uq_veh_inv_items_assignment_product          UNIQUE (vehicle_assignment_id, product_id)
```

---

### Entity: vehicle_inventory_movements

```
Table:  vehicle_inventory_movements
Domain: Operations → Loading & Allocation OS (Mobile Warehouse)
Aggregate: VehicleAssignment (AGG-LA-03) — Append-Only Audit Child
Identity: ULID (high-volume append-only; chronological ordering guaranteed)
Company Scoped: Yes
Soft Delete: Append-Only (never deleted, never updated)

Purpose:
  Immutable ledger of every quantity change to vehicle inventory.
  Incorrect movements are corrected by counter-movements (type: 'adjusted'),
  never by modifying existing records.

Columns:
  id:                       CHAR(26) NOT NULL PK       — ULID
  company_id:               UUID NOT NULL
  vehicle_inventory_item_id: UUID NOT NULL             — FK to vehicle_inventory_items
  vehicle_assignment_id:    UUID NOT NULL              — denormalized for direct query
  vehicle_id:               UUID NOT NULL              — denormalized for direct query
  product_id:               UUID NOT NULL              — cross-domain ref (no FK)
  operational_date:         DATE NOT NULL
  movement_type:            VARCHAR(50) NOT NULL
  quantity:                 DECIMAL(18,4) NOT NULL     — always positive; direction from type
  reference_type:           VARCHAR(50) NOT NULL
                                                       — 'loading_task' | 'order_allocation' |
                                                       — 'reconciliation' | 'adjustment'
  reference_id:             UUID NOT NULL              — ID within reference_type context
  actor_id:                 UUID NOT NULL              — FK to users or system actor
  actor_type:               VARCHAR(20) NOT NULL DEFAULT 'user'
                                                       — 'user' | 'system' | 'driver'
  notes:                    TEXT NULL                  — required for 'adjusted' type
  recorded_at:              TIMESTAMPTZ NOT NULL DEFAULT NOW()

No updated_at, updated_by (append-only)
```

**Movement Type Values:**
```
'loaded'        — Product added from prepared_products_pool via LoadingTask
'allocated'     — Quantity earmarked for a specific order (AllocationRecord created)
'unallocated'   — Allocation reversed (allocation cancelled or revised)
'delivered'     — Product removed from vehicle; delivery confirmed by driver/Logistics OS
'returned'      — Product removed from vehicle; returned to warehouse stock
'adjusted'      — Supervisor correction (rare); requires notes explaining reason
```

**CHECK Constraints:**
```sql
CONSTRAINT chk_veh_inv_movements_type CHECK (movement_type IN (
  'loaded', 'allocated', 'unallocated', 'delivered', 'returned', 'adjusted'
))
CONSTRAINT chk_veh_inv_movements_ref_type CHECK (reference_type IN (
  'loading_task', 'order_allocation', 'reconciliation', 'adjustment'
))
CONSTRAINT chk_veh_inv_movements_actor_type CHECK (actor_type IN (
  'user', 'system', 'driver'
))
CONSTRAINT chk_veh_inv_movements_qty_positive CHECK (quantity > 0)
```

**FK Constraints:**
```sql
fk_veh_inv_movements_inv_item → vehicle_inventory_items.id (RESTRICT)
```

**Indexes:**
```sql
idx_veh_inv_movements_inv_item_id            (vehicle_inventory_item_id)
idx_veh_inv_movements_assignment_id          (vehicle_assignment_id)
idx_veh_inv_movements_vehicle_date           (vehicle_id, operational_date)
idx_veh_inv_movements_recorded_at            (recorded_at)
idx_veh_inv_movements_company_date           (company_id, recorded_at)
```

---

### Entity: allocation_records

```
Table:  allocation_records
Domain: Operations → Loading & Allocation OS (Product Allocation Engine output)
Aggregate: VehicleAssignment (AGG-LA-03) — Child / AllocationRecord (AGG-LA-04) — Member
Identity: UUID
Company Scoped: Yes
Soft Delete: No (records are revised via allocation_decisions; history is non-destructive)

Purpose:
  The definitive per-order, per-product allocation. States what quantity of each product
  is assigned for delivery to each order on this vehicle. Created by the Product Allocation
  Engine; revised via dispatcher or driver overrides which produce AllocationDecision records.

Columns:
  id:                       UUID NOT NULL PK
  company_id:               UUID NOT NULL
  vehicle_assignment_id:    UUID NOT NULL              — FK to vehicle_assignments
  loading_session_id:       UUID NOT NULL              — denormalized from assignment
  vehicle_id:               UUID NOT NULL              — denormalized from assignment
  order_id:                 UUID NOT NULL              — cross-domain ref to orders (no FK)
  order_line_id:            UUID NOT NULL              — cross-domain ref to order_lines (no FK)
  order_number_snapshot:    VARCHAR(50) NOT NULL       — denormalized at allocation time
  order_type_snapshot:      VARCHAR(50) NULL           — 'paid' | 'cod' | 'deferred' | 'other'
  product_id:               UUID NOT NULL              — cross-domain ref to products (no FK)
  sku_snapshot:             VARCHAR(100) NOT NULL      — denormalized
  vehicle_inventory_item_id: UUID NOT NULL             — FK to vehicle_inventory_items
  allocation_mode:          VARCHAR(50) NOT NULL       — mode used when this record was created
  priority_rank:            INT NOT NULL DEFAULT 99    — 1=highest priority; from AllocationPolicy
  quantity_requested:       DECIMAL(18,4) NOT NULL     — what the order line originally required
  quantity_allocated:       DECIMAL(18,4) NOT NULL DEFAULT 0
                                                       — current allocated quantity (latest decision)
  quantity_loaded:          DECIMAL(18,4) NOT NULL DEFAULT 0
                                                       — what was actually on the vehicle
  quantity_delivered:       DECIMAL(18,4) NOT NULL DEFAULT 0
                                                       — updated by Logistics OS on delivery confirm
  quantity_remaining:       DECIMAL(18,4) NOT NULL DEFAULT 0
                                                       — computed: quantity_allocated - quantity_delivered
  is_partial:               BOOLEAN NOT NULL DEFAULT false
                                                       — quantity_allocated < quantity_requested
  partial_reason:           TEXT NULL                  — required when is_partial = true
  status:                   VARCHAR(50) NOT NULL DEFAULT 'allocated'
  allocated_at:             TIMESTAMPTZ NOT NULL       — when the engine produced this record
  allocated_by:             VARCHAR(20) NOT NULL DEFAULT 'system'
                                                       — 'system' | 'dispatcher' | 'driver'
  allocated_by_user_id:     UUID NULL                  — FK to users; NULL for system allocation
  last_decision_id:         UUID NULL                  — cross-domain ref to latest allocation_decision
  policy_evaluation_id:     UUID NULL                  — ref to PolicyEvaluationAudit (no FK)
  created_at:               TIMESTAMPTZ NOT NULL DEFAULT NOW()
  created_by:               UUID NOT NULL
  updated_at:               TIMESTAMPTZ NOT NULL DEFAULT NOW()
  updated_by:               UUID NOT NULL

Natural Keys: (vehicle_assignment_id, order_line_id) UNIQUE
```

**Status Model:**
```
'allocated'      — Current allocation active; vehicle not yet dispatched
'confirmed'      — Dispatcher reviewed and confirmed
'in_delivery'    — Vehicle dispatched; delivery in progress
'delivered'      — Full quantity confirmed delivered
'partial_delivery' — Some quantity delivered; remainder not yet confirmed
'failed'         — Delivery failed for this order; returned or rescheduled
'cancelled'      — Allocation cancelled before dispatch
```

**CHECK Constraints:**
```sql
CONSTRAINT chk_alloc_records_status CHECK (status IN (
  'allocated', 'confirmed', 'in_delivery', 'delivered',
  'partial_delivery', 'failed', 'cancelled'
))
CONSTRAINT chk_alloc_records_mode CHECK (allocation_mode IN (
  'full_auto', 'partial_auto', 'manual', 'ai_suggested',
  'priority', 'fifo', 'custom_policy'
))
CONSTRAINT chk_alloc_records_allocated_by CHECK (allocated_by IN (
  'system', 'dispatcher', 'driver'
))
CONSTRAINT chk_alloc_records_qty_requested_pos CHECK (quantity_requested > 0)
CONSTRAINT chk_alloc_records_qty_allocated_non_neg CHECK (quantity_allocated >= 0)
CONSTRAINT chk_alloc_records_qty_delivered_non_neg CHECK (quantity_delivered >= 0)
CONSTRAINT chk_alloc_records_priority_rank_pos CHECK (priority_rank >= 1)
```

**FK Constraints:**
```sql
fk_alloc_records_assignment_id   → vehicle_assignments.id (RESTRICT)
fk_alloc_records_inv_item        → vehicle_inventory_items.id (RESTRICT)
```

**Indexes:**
```sql
idx_alloc_records_assignment_id              (vehicle_assignment_id)
idx_alloc_records_vehicle_id                 (vehicle_id)
idx_alloc_records_order_id                   (order_id)
idx_alloc_records_product_id                 (product_id)
idx_alloc_records_session_order              (loading_session_id, order_id)
idx_alloc_records_status                     (vehicle_assignment_id, status)
uq_alloc_records_assignment_order_line       UNIQUE (vehicle_assignment_id, order_line_id)
```

---

### Entity: allocation_decisions

```
Table:  allocation_decisions
Domain: Operations → Loading & Allocation OS
Aggregate: VehicleAssignment (AGG-LA-03) — Append-Only Audit Child (revision history)
Identity: ULID (append-only; immutable after creation)
Company Scoped: Yes
Soft Delete: Append-Only (never deleted, never modified)

Purpose:
  Non-destructive revision history for every allocation_record.
  Every change (system allocation, dispatcher override, driver override)
  creates a new row. The original system allocation is revision_number = 1.
  allocation_records.last_decision_id points to the most recent row.

Columns:
  id:                       CHAR(26) NOT NULL PK       — ULID
  company_id:               UUID NOT NULL
  allocation_record_id:     UUID NOT NULL              — FK to allocation_records
  revision_number:          INT NOT NULL               — 1 = original system allocation
  actor_type:               VARCHAR(20) NOT NULL       — 'system' | 'dispatcher' | 'driver'
  actor_id:                 UUID NULL                  — FK to users; NULL for system
  quantity_before:          DECIMAL(18,4) NOT NULL
  quantity_after:           DECIMAL(18,4) NOT NULL
  reason:                   TEXT NOT NULL              — required for all non-system revisions
  policy_evaluation_id:     UUID NULL                  — ref to PolicyEvaluationAudit (no FK)
  recorded_at:              TIMESTAMPTZ NOT NULL DEFAULT NOW()

No updated_at, updated_by (append-only)
```

**CHECK Constraints:**
```sql
CONSTRAINT chk_alloc_decisions_actor_type CHECK (actor_type IN (
  'system', 'dispatcher', 'driver'
))
CONSTRAINT chk_alloc_decisions_revision_pos CHECK (revision_number >= 1)
CONSTRAINT chk_alloc_decisions_qty_before_non_neg CHECK (quantity_before >= 0)
CONSTRAINT chk_alloc_decisions_qty_after_non_neg CHECK (quantity_after >= 0)
```

**FK Constraints:**
```sql
fk_alloc_decisions_allocation_record → allocation_records.id (RESTRICT)
```

**Indexes:**
```sql
idx_alloc_decisions_record_id                (allocation_record_id)
idx_alloc_decisions_record_revision          (allocation_record_id, revision_number)
idx_alloc_decisions_actor_id                 (actor_id) WHERE actor_id IS NOT NULL
idx_alloc_decisions_recorded_at              (recorded_at)
```

---

### Entity: driver_assignments

```
Table:  driver_assignments
Domain: Operations → Loading & Allocation OS
Aggregate: DriverAssignment (AGG-LA-05) — Root
Identity: UUID
Company Scoped: Yes
Soft Delete: Status-based ('cancelled' | 'reassigned')

Purpose:
  Records the assignment of a driver to a vehicle for one trip.
  A vehicle cannot be dispatched without an active DriverAssignment.
  If a driver must be changed, the original assignment transitions to
  'reassigned' and a new DriverAssignment is created.

Columns:
  id:                       UUID NOT NULL PK
  company_id:               UUID NOT NULL
  vehicle_assignment_id:    UUID NOT NULL              — FK to vehicle_assignments (1:1 active)
  loading_session_id:       UUID NOT NULL              — denormalized from vehicle_assignment
  vehicle_id:               UUID NOT NULL              — denormalized; cross-domain ref (no FK)
  driver_id:                UUID NOT NULL              — cross-domain ref to users (no FK)
  driver_name_snapshot:     VARCHAR(255) NOT NULL      — denormalized at assignment time
  driver_phone_snapshot:    VARCHAR(50) NULL           — L1 PII snapshot; encrypted at rest
  status:                   VARCHAR(50) NOT NULL DEFAULT 'assigned'
  assignment_type:          VARCHAR(50) NOT NULL DEFAULT 'primary'
                                                       — 'primary' | 'substitute'
  assigned_at:              TIMESTAMPTZ NOT NULL DEFAULT NOW()
  assigned_by:              UUID NOT NULL              — FK to users
  departure_time_planned:   TIMESTAMPTZ NULL           — expected dispatch time
  departure_time_actual:    TIMESTAMPTZ NULL           — actual departure
  return_time_actual:       TIMESTAMPTZ NULL           — actual return to warehouse
  reassigned_at:            TIMESTAMPTZ NULL           — when driver was replaced
  reassigned_by:            UUID NULL                  — FK to users
  reassignment_reason:      TEXT NULL                  — required when reassigned
  cancelled_at:             TIMESTAMPTZ NULL
  cancelled_by:             UUID NULL
  cancellation_reason:      TEXT NULL
  notes:                    TEXT NULL
  created_at:               TIMESTAMPTZ NOT NULL DEFAULT NOW()
  created_by:               UUID NOT NULL
  updated_at:               TIMESTAMPTZ NOT NULL DEFAULT NOW()
  updated_by:               UUID NOT NULL

Natural Keys: (vehicle_assignment_id) WHERE status = 'assigned' — only one active per assignment
```

**Status Model:**
```
'assigned'      — Driver confirmed for this trip; awaiting departure
'on_trip'       — Vehicle dispatched; driver is on the road
'returned'      — Driver physically back at warehouse
'reconciled'    — End-of-shift reconciliation completed for this driver's trip
'cancelled'     — Assignment voided before departure
'reassigned'    — Driver was replaced; succeeded by a new DriverAssignment
```

**CHECK Constraints:**
```sql
CONSTRAINT chk_driver_assignments_status CHECK (status IN (
  'assigned', 'on_trip', 'returned', 'reconciled', 'cancelled', 'reassigned'
))
CONSTRAINT chk_driver_assignments_type CHECK (assignment_type IN (
  'primary', 'substitute'
))
```

**FK Constraints:**
```sql
fk_driver_assignments_vehicle_assignment → vehicle_assignments.id (RESTRICT)
```

**Indexes:**
```sql
idx_driver_assignments_vehicle_assignment    (vehicle_assignment_id)
idx_driver_assignments_driver_id             (driver_id)
idx_driver_assignments_loading_session       (loading_session_id)
idx_driver_assignments_company_status        (company_id, status)
idx_driver_assignments_active_per_assignment (vehicle_assignment_id)
  WHERE status = 'assigned'
```

---

### Entity: route_plans

```
Table:  route_plans
Domain: Operations → Loading & Allocation OS (computed; consumed by Logistics OS)
Aggregate: VehicleAssignment (AGG-LA-03) — Child (1:1 with assignment)
Identity: UUID
Company Scoped: Yes
Soft Delete: Status-based ('cancelled' | 'superseded')

Purpose:
  The ordered delivery route for one vehicle assignment. Created by the route
  planning sub-engine after allocation is complete. Logistics OS consumes this
  as the authoritative stop sequence. A new route_plan supersedes the old one
  if replanning occurs.

Columns:
  id:                       UUID NOT NULL PK
  company_id:               UUID NOT NULL
  vehicle_assignment_id:    UUID NOT NULL              — FK to vehicle_assignments
  loading_session_id:       UUID NOT NULL              — denormalized
  vehicle_id:               UUID NOT NULL              — denormalized; cross-domain ref (no FK)
  driver_assignment_id:     UUID NOT NULL              — FK to driver_assignments
  route_number:             VARCHAR(50) NOT NULL       — Business key: ROUTE-{YYYY}{MM}-{seq}
  status:                   VARCHAR(50) NOT NULL DEFAULT 'planned'
  version:                  INT NOT NULL DEFAULT 1     — increments on replan
  superseded_by_id:         UUID NULL                  — FK to successor route_plan (no FK)
  stops_count:              INT NOT NULL DEFAULT 0     — denormalized
  total_distance_km:        DECIMAL(10,4) NULL         — estimated (from routing engine)
  estimated_duration_min:   INT NULL                   — estimated drive + stop time in minutes
  optimization_score:       DECIMAL(5,2) NULL          — route quality score 0-100
  optimization_algorithm:   VARCHAR(100) NULL          — algorithm used (e.g. 'nearest_neighbor')
  planned_departure_at:     TIMESTAMPTZ NULL
  actual_departure_at:      TIMESTAMPTZ NULL
  actual_return_at:         TIMESTAMPTZ NULL
  completed_at:             TIMESTAMPTZ NULL
  cancelled_at:             TIMESTAMPTZ NULL
  cancelled_by:             UUID NULL
  notes:                    TEXT NULL
  created_at:               TIMESTAMPTZ NOT NULL DEFAULT NOW()
  created_by:               UUID NOT NULL
  updated_at:               TIMESTAMPTZ NOT NULL DEFAULT NOW()
  updated_by:               UUID NOT NULL

Natural Keys: (company_id, route_number) UNIQUE
```

**Status Model:**
```
'planned'        — Route calculated; not yet in motion
'in_progress'    — Vehicle is executing the route
'completed'      — All stops visited; route closed
'cancelled'      — Route cancelled before departure
'superseded'     — A newer version of this route has been created
```

**CHECK Constraints:**
```sql
CONSTRAINT chk_route_plans_status CHECK (status IN (
  'planned', 'in_progress', 'completed', 'cancelled', 'superseded'
))
CONSTRAINT chk_route_plans_version_pos CHECK (version >= 1)
CONSTRAINT chk_route_plans_distance_non_neg CHECK (
  total_distance_km IS NULL OR total_distance_km >= 0
)
CONSTRAINT chk_route_plans_score_range CHECK (
  optimization_score IS NULL OR (optimization_score >= 0 AND optimization_score <= 100)
)
```

**FK Constraints:**
```sql
fk_route_plans_vehicle_assignment → vehicle_assignments.id (RESTRICT)
fk_route_plans_driver_assignment  → driver_assignments.id (RESTRICT)
```

**Indexes:**
```sql
idx_route_plans_vehicle_assignment           (vehicle_assignment_id)
idx_route_plans_company_status               (company_id, status)
idx_route_plans_company_date                 (company_id, planned_departure_at)
uq_route_plans_company_number                UNIQUE (company_id, route_number)
```

---

### Entity: route_plan_stops

```
Table:  route_plan_stops
Domain: Operations → Loading & Allocation OS
Aggregate: VehicleAssignment (AGG-LA-03) — Child (child of route_plans)
Identity: UUID
Company Scoped: Yes
Soft Delete: No (stop list is regenerated on route replan)

Columns:
  id:                       UUID NOT NULL PK
  company_id:               UUID NOT NULL
  route_plan_id:            UUID NOT NULL              — FK to route_plans
  vehicle_assignment_id:    UUID NOT NULL              — denormalized
  order_id:                 UUID NOT NULL              — cross-domain ref to orders (no FK)
  order_number_snapshot:    VARCHAR(50) NOT NULL       — denormalized
  customer_name_snapshot:   VARCHAR(255) NULL          — L1 PII snapshot; encrypted at rest
  delivery_address_snapshot: TEXT NULL                 — L1 PII snapshot; encrypted at rest
  zone_id_snapshot:         UUID NULL                  — cross-domain ref (no FK)
  stop_sequence:            INT NOT NULL               — 1-indexed; delivery order
  planned_arrival_at:       TIMESTAMPTZ NULL           — estimated arrival at this stop
  actual_arrival_at:        TIMESTAMPTZ NULL           — updated by Logistics OS / Driver App
  actual_departure_at:      TIMESTAMPTZ NULL           — when driver left this stop
  status:                   VARCHAR(50) NOT NULL DEFAULT 'pending'
  failure_reason:           VARCHAR(255) NULL          — if status = 'failed'
  distance_from_prev_km:    DECIMAL(10,4) NULL         — from previous stop or warehouse
  notes:                    TEXT NULL
  created_at:               TIMESTAMPTZ NOT NULL DEFAULT NOW()
  created_by:               UUID NOT NULL
  updated_at:               TIMESTAMPTZ NOT NULL DEFAULT NOW()
  updated_by:               UUID NOT NULL

Natural Keys: (route_plan_id, stop_sequence) UNIQUE
```

**Status Model:**
```
'pending'       — Stop not yet reached
'arrived'       — Driver confirmed arrival at stop
'completed'     — Delivery attempt finished (may be delivered or failed)
'failed'        — Delivery attempt failed (no one home, refused, etc.)
'skipped'       — Stop deliberately skipped (rescheduled or special)
```

**CHECK Constraints:**
```sql
CONSTRAINT chk_route_stops_status CHECK (status IN (
  'pending', 'arrived', 'completed', 'failed', 'skipped'
))
CONSTRAINT chk_route_stops_sequence_pos CHECK (stop_sequence >= 1)
```

**FK Constraints:**
```sql
fk_route_stops_route_plan        → route_plans.id (RESTRICT)
fk_route_stops_vehicle_assignment → vehicle_assignments.id (RESTRICT)
```

**Indexes:**
```sql
idx_route_stops_route_plan_id                (route_plan_id)
idx_route_stops_order_id                     (order_id)
idx_route_stops_assignment_status            (vehicle_assignment_id, status)
idx_route_stops_route_sequence               (route_plan_id, stop_sequence)
uq_route_stops_plan_sequence                 UNIQUE (route_plan_id, stop_sequence)
```

---

### Entity: shipment_groups

```
Table:  shipment_groups
Domain: Operations → Loading & Allocation OS
Aggregate: LoadingSession (AGG-LA-01) — Child (grouping concept)
Identity: UUID
Company Scoped: Yes
Soft Delete: Status-based ('cancelled')

Purpose:
  Groups orders within a loading session by zone + shipping company for
  reporting and dispatch coordination. One ShipmentGroup corresponds to
  one GeographyGroup from the Geography Engine. A session may have multiple
  shipment groups (one per zone/company combination being dispatched).

Columns:
  id:                       UUID NOT NULL PK
  company_id:               UUID NOT NULL
  loading_session_id:       UUID NOT NULL              — FK to loading_sessions
  geography_group_id:       UUID NULL                  — cross-domain ref (no FK)
  shipping_company_id:      UUID NOT NULL              — cross-domain ref (no FK)
  zone_id:                  UUID NOT NULL              — cross-domain ref (no FK)
  governorate_id:           UUID NOT NULL              — cross-domain ref (no FK)
  group_number:             VARCHAR(50) NOT NULL       — Business key within session
  status:                   VARCHAR(50) NOT NULL DEFAULT 'pending'
  vehicle_assignments_count: INT NOT NULL DEFAULT 0    — vehicles serving this group
  orders_count:             INT NOT NULL DEFAULT 0     — total orders in group
  fully_allocated_orders:   INT NOT NULL DEFAULT 0
  partially_allocated_orders: INT NOT NULL DEFAULT 0
  unallocated_orders:       INT NOT NULL DEFAULT 0
  allocation_coverage_pct:  DECIMAL(5,2) NOT NULL DEFAULT 0
                                                       — fully_allocated / orders_count × 100
  dispatched_at:            TIMESTAMPTZ NULL           — when all vehicles in group dispatched
  completed_at:             TIMESTAMPTZ NULL           — when all deliveries done
  cancelled_at:             TIMESTAMPTZ NULL
  notes:                    TEXT NULL
  created_at:               TIMESTAMPTZ NOT NULL DEFAULT NOW()
  created_by:               UUID NOT NULL
  updated_at:               TIMESTAMPTZ NOT NULL DEFAULT NOW()
  updated_by:               UUID NOT NULL

Natural Keys: (loading_session_id, shipping_company_id, zone_id) UNIQUE
```

**Status Model:**
```
'pending'       — Group created; vehicles not yet loading
'loading'       — At least one vehicle in this group is loading
'loaded'        — All vehicles loaded; awaiting dispatch
'dispatched'    — All vehicles dispatched
'completed'     — All deliveries and reconciliations done
'cancelled'     — Group cancelled before dispatch
```

**CHECK Constraints:**
```sql
CONSTRAINT chk_shipment_groups_status CHECK (status IN (
  'pending', 'loading', 'loaded', 'dispatched', 'completed', 'cancelled'
))
CONSTRAINT chk_shipment_groups_coverage_range CHECK (
  allocation_coverage_pct >= 0 AND allocation_coverage_pct <= 100
)
CONSTRAINT chk_shipment_groups_orders_non_neg CHECK (orders_count >= 0)
```

**FK Constraints:**
```sql
fk_shipment_groups_loading_session → loading_sessions.id (RESTRICT)
```

**Indexes:**
```sql
idx_shipment_groups_session_id               (loading_session_id)
idx_shipment_groups_shipping_company_id      (shipping_company_id)
idx_shipment_groups_zone_id                  (zone_id)
idx_shipment_groups_company_status           (company_id, status)
uq_shipment_groups_session_company_zone      UNIQUE (loading_session_id, shipping_company_id, zone_id)
```

---

### Entity: shipment_group_items

```
Table:  shipment_group_items
Domain: Operations → Loading & Allocation OS
Aggregate: LoadingSession (AGG-LA-01) — Child (member of ShipmentGroup)
Identity: UUID
Company Scoped: Yes
Soft Delete: No (records persist for audit)

Columns:
  id:                       UUID NOT NULL PK
  company_id:               UUID NOT NULL
  shipment_group_id:        UUID NOT NULL              — FK to shipment_groups
  vehicle_assignment_id:    UUID NOT NULL              — FK to vehicle_assignments
  loading_session_id:       UUID NOT NULL              — denormalized

Natural Keys: (shipment_group_id, vehicle_assignment_id) UNIQUE
```

**FK Constraints:**
```sql
fk_shipment_group_items_group      → shipment_groups.id (RESTRICT)
fk_shipment_group_items_assignment → vehicle_assignments.id (RESTRICT)
```

**Indexes:**
```sql
idx_shipment_group_items_group_id            (shipment_group_id)
idx_shipment_group_items_assignment_id       (vehicle_assignment_id)
uq_shipment_group_items_group_assignment     UNIQUE (shipment_group_id, vehicle_assignment_id)
```

---

### Entity: vehicle_shift_reconciliations

```
Table:  vehicle_shift_reconciliations
Domain: Operations → Loading & Allocation OS (End-of-Shift)
Aggregate: VehicleAssignment (AGG-LA-03) — Child (1:1 with assignment after return)
Identity: UUID
Company Scoped: Yes
Soft Delete: No (reconciliation is a permanent record)

Purpose:
  End-of-shift inventory reconciliation for one vehicle trip.
  The system compares quantity_loaded vs (quantity_delivered + quantity_returned).
  A variance of zero auto-approves. Non-zero variance requires supervisor investigation.

Columns:
  id:                       UUID NOT NULL PK
  company_id:               UUID NOT NULL
  vehicle_assignment_id:    UUID NOT NULL UNIQUE       — FK to vehicle_assignments (1:1)
  loading_session_id:       UUID NOT NULL              — denormalized
  vehicle_id:               UUID NOT NULL              — denormalized; cross-domain ref (no FK)
  driver_assignment_id:     UUID NOT NULL              — FK to driver_assignments
  operational_date:         DATE NOT NULL
  status:                   VARCHAR(50) NOT NULL DEFAULT 'open'
  reconciled_by:            UUID NULL                  — FK to users (warehouse team)
  approved_by:              UUID NULL                  — required if has_variance = true
  has_variance:             BOOLEAN NOT NULL DEFAULT false
  variance_notes:           TEXT NULL                  — required if has_variance = true
  total_quantity_loaded:    DECIMAL(18,4) NOT NULL DEFAULT 0
  total_quantity_delivered: DECIMAL(18,4) NOT NULL DEFAULT 0
  total_quantity_returned:  DECIMAL(18,4) NOT NULL DEFAULT 0
  total_variance:           DECIMAL(18,4) NOT NULL DEFAULT 0
                                                       — computed: loaded - delivered - returned
  config_version_id:        UUID NULL                  — config version at reconciliation time
  opened_at:                TIMESTAMPTZ NOT NULL DEFAULT NOW()
  completed_at:             TIMESTAMPTZ NULL
  created_at:               TIMESTAMPTZ NOT NULL DEFAULT NOW()
  created_by:               UUID NOT NULL
  updated_at:               TIMESTAMPTZ NOT NULL DEFAULT NOW()
  updated_by:               UUID NOT NULL
```

**Status Model:**
```
'open'          — Reconciliation session started; counting in progress
'completed'     — All lines counted; totals confirmed
'approved'      — No variance (auto) or variance investigated and resolved
'disputed'      — Variance cannot be resolved immediately; escalated
```

**CHECK Constraints:**
```sql
CONSTRAINT chk_recon_status CHECK (status IN (
  'open', 'completed', 'approved', 'disputed'
))
CONSTRAINT chk_recon_qty_non_neg CHECK (
  total_quantity_loaded >= 0 AND
  total_quantity_delivered >= 0 AND
  total_quantity_returned >= 0
)
```

**FK Constraints:**
```sql
fk_reconciliations_assignment     → vehicle_assignments.id (RESTRICT)
fk_reconciliations_driver_assign  → driver_assignments.id (RESTRICT)
```

**Indexes:**
```sql
idx_reconciliations_assignment_id            (vehicle_assignment_id)
idx_reconciliations_vehicle_id               (vehicle_id)
idx_reconciliations_session_id               (loading_session_id)
idx_reconciliations_company_status           (company_id, status)
idx_reconciliations_has_variance             (has_variance) WHERE has_variance = true
```

---

### Entity: vehicle_shift_reconciliation_lines

```
Table:  vehicle_shift_reconciliation_lines
Domain: Operations → Loading & Allocation OS
Aggregate: VehicleAssignment (AGG-LA-03) — Child (per-product reconciliation detail)
Identity: UUID
Company Scoped: Yes
Soft Delete: No

Columns:
  id:                       UUID NOT NULL PK
  company_id:               UUID NOT NULL
  reconciliation_id:        UUID NOT NULL              — FK to vehicle_shift_reconciliations
  vehicle_inventory_item_id: UUID NOT NULL             — FK to vehicle_inventory_items
  product_id:               UUID NOT NULL              — cross-domain ref (no FK)
  sku_snapshot:             VARCHAR(100) NOT NULL
  quantity_loaded:          DECIMAL(18,4) NOT NULL     — from vehicle_inventory_item
  quantity_delivered:       DECIMAL(18,4) NOT NULL     — from vehicle_inventory_item
  quantity_returned_expected: DECIMAL(18,4) NOT NULL   — loaded - delivered (expected return)
  quantity_returned_actual: DECIMAL(18,4) NOT NULL DEFAULT 0 — physically counted on return
  variance:                 DECIMAL(18,4) NOT NULL DEFAULT 0
                                                       — computed: returned_expected - returned_actual
  variance_resolution:      VARCHAR(50) NULL
  resolution_notes:         TEXT NULL                  — required when variance ≠ 0
  resolved_by:              UUID NULL                  — FK to users
  resolved_at:              TIMESTAMPTZ NULL
  created_at:               TIMESTAMPTZ NOT NULL DEFAULT NOW()
  created_by:               UUID NOT NULL
  updated_at:               TIMESTAMPTZ NOT NULL DEFAULT NOW()
  updated_by:               UUID NOT NULL

Natural Keys: (reconciliation_id, product_id) UNIQUE
```

**Variance Resolution Values:**
```
'balanced'              — quantity_returned_actual = quantity_returned_expected; no variance
'late_confirmed'        — delivery happened but was not confirmed in real time; now confirmed
'written_off'           — loss documented and approved; inventory adjusted
'under_investigation'   — variance unresolved; escalated to supervisor for investigation
```

**CHECK Constraints:**
```sql
CONSTRAINT chk_recon_lines_variance_resolution CHECK (
  variance_resolution IS NULL OR variance_resolution IN (
    'balanced', 'late_confirmed', 'written_off', 'under_investigation'
  )
)
CONSTRAINT chk_recon_lines_qty_non_neg CHECK (
  quantity_loaded >= 0 AND quantity_delivered >= 0 AND
  quantity_returned_expected >= 0 AND quantity_returned_actual >= 0
)
```

**FK Constraints:**
```sql
fk_recon_lines_reconciliation → vehicle_shift_reconciliations.id (RESTRICT)
fk_recon_lines_inv_item       → vehicle_inventory_items.id (RESTRICT)
```

**Indexes:**
```sql
idx_recon_lines_reconciliation_id            (reconciliation_id)
idx_recon_lines_product_id                   (product_id)
idx_recon_lines_variance                     (reconciliation_id, variance)
  WHERE variance != 0
uq_recon_lines_reconciliation_product        UNIQUE (reconciliation_id, product_id)
```

---

### Entity: loading_exceptions

```
Table:  loading_exceptions
Domain: Operations → Loading & Allocation OS
Aggregate: LoadingSession (AGG-LA-01) — Child (exception log for session events)
Identity: UUID
Company Scoped: Yes
Soft Delete: No (status-based)

Columns:
  id:                       UUID NOT NULL PK
  company_id:               UUID NOT NULL
  loading_session_id:       UUID NOT NULL              — FK to loading_sessions
  vehicle_assignment_id:    UUID NULL                  — FK to vehicle_assignments; NULL if session-level
  exception_type:           VARCHAR(100) NOT NULL
  severity:                 VARCHAR(20) NOT NULL
  entity_type:              VARCHAR(50) NULL           — polymorphic subject type
  entity_id:                UUID NULL                  — polymorphic subject ID
  description:              TEXT NOT NULL
  status:                   VARCHAR(50) NOT NULL DEFAULT 'open'
  resolved_at:              TIMESTAMPTZ NULL
  resolved_by:              UUID NULL
  resolution_notes:         TEXT NULL
  escalated_at:             TIMESTAMPTZ NULL
  escalated_to:             UUID NULL                  — FK to users
  created_at:               TIMESTAMPTZ NOT NULL DEFAULT NOW()
  created_by:               UUID NOT NULL
  updated_at:               TIMESTAMPTZ NOT NULL DEFAULT NOW()
  updated_by:               UUID NOT NULL
```

**Exception Type Values:**
```
'short_loading'         — quantity_loaded < quantity_planned for a loading task
'pool_entry_unavailable' — prepared_products_pool entry not in 'passed' quality status
'vehicle_incompatible'  — vehicle does not meet refrigeration or capacity requirement
'vehicle_overloaded'    — loading would exceed vehicle capacity
'driver_missing'        — vehicle ready to dispatch but no driver assigned
'allocation_partial'    — Product Allocation Engine could not fully allocate all orders
'allocation_conflict'   — Two allocation decisions conflict; manual resolution needed
'route_unresolvable'    — Route planning could not produce a valid sequence
'reconciliation_variance' — End-of-shift variance detected
```

**Severity Values:** `'blocking'`, `'warning'`, `'informational'`

**Status Values:** `'open'`, `'resolved'`, `'escalated'`, `'closed'`

**CHECK Constraints:**
```sql
CONSTRAINT chk_loading_exceptions_severity CHECK (severity IN (
  'blocking', 'warning', 'informational'
))
CONSTRAINT chk_loading_exceptions_status CHECK (status IN (
  'open', 'resolved', 'escalated', 'closed'
))
```

**FK Constraints:**
```sql
fk_loading_exceptions_session    → loading_sessions.id (RESTRICT)
fk_loading_exceptions_assignment → vehicle_assignments.id (RESTRICT)
```

**Indexes:**
```sql
idx_loading_exceptions_session_id            (loading_session_id)
idx_loading_exceptions_assignment_id         (vehicle_assignment_id) WHERE vehicle_assignment_id IS NOT NULL
idx_loading_exceptions_session_status        (loading_session_id, status)
idx_loading_exceptions_severity_status       (severity, status) WHERE status = 'open'
```

---

## 3. Status Model Summary

### LoadingSession (`loading_sessions.status`)

```
         ┌─────────┐
         │  draft  │ ──────────────────────────────────────────────────┐
         └────┬────┘                                                   │
              │ (all vehicle assignments confirmed; tasks generated)   │
              ▼                                                        │
         ┌─────────┐                                                   │
         │  ready  │                                                   │
         └────┬────┘                                                   │
              │ (first loading task started)                           │
              ▼                                                        │
         ┌─────────┐                                                   │
         │ loading │                                                   ▼
         └────┬────┘                                          ┌─────────────┐
              │ (all tasks loaded or closed)                  │  cancelled  │
              ▼                                               └─────────────┘
     ┌─────────────────┐
     │ loading_complete│
     └────────┬────────┘
              │ (allocation engine invoked)
              ▼
         ┌────────────┐
         │ allocating │
         └─────┬──────┘
               │ (allocation engine complete)
               ▼
          ┌──────────┐
          │allocated │
          └────┬─────┘
               │ (first vehicle dispatched)
               ▼
         ┌─────────────┐
         │ dispatching │
         └──────┬──────┘
                │ (all vehicles dispatched)
                ▼
          ┌──────────────┐
          │  dispatched  │
          └───────┬──────┘
                  │ (first reconciliation opened)
                  ▼
           ┌─────────────┐
           │ reconciling │
           └──────┬──────┘
                  │ (all vehicles reconciled)
                  ▼
            ┌─────────┐
            │  closed │
            └─────────┘
```

### VehiclePlan (`vehicle_plans.status`)

```
'calculating' → 'proposed' → 'approved' → 'loading' → 'dispatched' → 'completed'
                                ↓
                          'superseded'  (on replan; successor plan created)

Any state except 'completed' → 'cancelled'
```

### VehicleAssignment (`vehicle_assignments.status`)

```
'pending' → 'loading' → 'loading_complete' → 'dispatched' → 'returning' → 'reconciling' → 'reconciled'
                                                  ↑
                             (any state before dispatch) → 'cancelled'
```

### AllocationRecord (`allocation_records.status`)

```
'allocated' → 'confirmed' → 'in_delivery' → 'delivered'
                                   ↓
                            'partial_delivery' → 'delivered' (on full confirmation)
                                   ↓
                               'failed'    (delivery attempt failed)

'allocated' or 'confirmed' → 'cancelled'  (before dispatch only)
```

---

## 4. Aggregate Boundary Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  AGG-LA-01: LoadingSession (Root)                                            │
│  ─────────────────────────────────────────────────────────────────────────── │
│  loading_sessions                                         [ROOT]             │
│  loading_tasks                      (session × product × assignment)         │
│  shipment_groups                    (zone × shipping company groupings)       │
│  shipment_group_items               (group ↔ assignment bridge)              │
│  loading_exceptions                 (session and assignment exceptions)       │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  AGG-LA-02: VehiclePlan (Root)                                               │
│  ─────────────────────────────────────────────────────────────────────────── │
│  vehicle_plans                                            [ROOT]             │
│  vehicle_plan_slots                 (one slot per vehicle slot in plan)       │
│  vehicle_plan_slot_orders           (orders assigned to each slot)           │
│  vehicle_plan_adjustment_log        (planner action audit trail)             │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  AGG-LA-03: VehicleAssignment (Root)                                         │
│  ─────────────────────────────────────────────────────────────────────────── │
│  vehicle_assignments                                      [ROOT]             │
│  vehicle_capacity_snapshots         (capacity check result at assignment)    │
│  vehicle_inventory_items            (current-state inventory ledger)         │
│  vehicle_inventory_movements        (append-only movement log)               │
│  allocation_records                 (per-order, per-product allocation)      │
│  allocation_decisions               (revision history for each allocation)   │
│  route_plans                        (ordered delivery route)                 │
│  route_plan_stops                   (individual delivery stops)              │
│  vehicle_shift_reconciliations      (end-of-shift reconciliation header)     │
│  vehicle_shift_reconciliation_lines (per-product reconciliation detail)      │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  AGG-LA-04: AllocationRecord (Member of VehicleAssignment)                   │
│  ─────────────────────────────────────────────────────────────────────────── │
│  Note: AllocationRecord is a member of AGG-LA-03 in database terms.          │
│  It is listed as a separate aggregate boundary because the Product Allocation │
│  Engine treats it as an independently addressable entity in the domain model. │
│  allocation_records                 [boundary point]                         │
│  allocation_decisions               (revision log owned by allocation_records)│
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  AGG-LA-05: DriverAssignment (Root)                                          │
│  ─────────────────────────────────────────────────────────────────────────── │
│  driver_assignments                                       [ROOT]             │
│  (owns no child tables; collaborates with vehicle_assignments and route_plans)│
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Ownership Table

| Entity (Table) | Created By | Owned By Aggregate | Key Business Event |
|---|---|---|---|
| `loading_sessions` | Dispatcher / System (from VehiclePlan) | AGG-LA-01 | LoadingSessionOpened |
| `loading_tasks` | System (on session ready) | AGG-LA-01 | LoadingTasksGenerated |
| `shipment_groups` | System (from geography groups) | AGG-LA-01 | ShipmentGroupCreated |
| `shipment_group_items` | System (when assignment added to group) | AGG-LA-01 | VehicleAddedToGroup |
| `loading_exceptions` | System / Operator | AGG-LA-01 | LoadingExceptionRaised |
| `vehicle_plans` | Vehicle Planning Engine | AGG-LA-02 | VehiclePlanProposed |
| `vehicle_plan_slots` | Vehicle Planning Engine | AGG-LA-02 | VehiclePlanSlotCreated |
| `vehicle_plan_slot_orders` | Vehicle Planning Engine | AGG-LA-02 | OrderAssignedToSlot |
| `vehicle_plan_adjustment_log` | Planner (manual action) | AGG-LA-02 | PlanAdjustmentRecorded |
| `vehicle_assignments` | Dispatcher (from slot confirmation) | AGG-LA-03 | VehicleAssigned |
| `vehicle_capacity_snapshots` | System (on assignment creation) | AGG-LA-03 | CapacityCheckCompleted |
| `vehicle_inventory_items` | System (on LoadingTask completion) | AGG-LA-03 | VehicleInventoryLoaded |
| `vehicle_inventory_movements` | System / Operator / Driver | AGG-LA-03 | VehicleInventoryMoved |
| `allocation_records` | Product Allocation Engine | AGG-LA-03/04 | OrderAllocated |
| `allocation_decisions` | System / Dispatcher / Driver | AGG-LA-03/04 | AllocationDecisionRecorded |
| `route_plans` | Route Planning Sub-engine | AGG-LA-03 | RoutePlanCreated |
| `route_plan_stops` | Route Planning Sub-engine | AGG-LA-03 | RouteStopAdded |
| `vehicle_shift_reconciliations` | Warehouse Team (on vehicle return) | AGG-LA-03 | ReconciliationOpened |
| `vehicle_shift_reconciliation_lines` | System (from inventory items) | AGG-LA-03 | ReconciliationLineCreated |
| `driver_assignments` | Dispatcher | AGG-LA-05 | DriverAssigned |

---

## 6. Business Number Sequences

| Entity | Format | Example | Scope |
|---|---|---|---|
| `loading_sessions` | `LOAD-{YYYY}{MM}-{6-digit-seq}` | `LOAD-202607-000001` | `(company_id, 'loading_session', year, month)` |
| `vehicle_plans` | `VPLAN-{YYYY}{MM}-{6-digit-seq}` | `VPLAN-202607-000001` | `(company_id, 'vehicle_plan', year, month)` |
| `vehicle_assignments` | `VASN-{YYYY}{MM}-{6-digit-seq}` | `VASN-202607-000001` | `(company_id, 'vehicle_assignment', year, month)` |
| `route_plans` | `ROUTE-{YYYY}{MM}-{6-digit-seq}` | `ROUTE-202607-000001` | `(company_id, 'route_plan', year, month)` |

All sequences managed via the `business_number_sequences` table (see IDENTITY-STRATEGY.md).

---

## 7. Cross-Domain Reference Map

| Column | Table | References | FK Constraint |
|---|---|---|---|
| `warehouse_id` | `loading_sessions` | `warehouses.id` | None (cross-domain) |
| `vehicle_plan_id` | `loading_sessions` | `vehicle_plans.id` | None (cross-domain) |
| `geography_group_id` | `vehicle_plans` | `geography_groups.id` | None (cross-domain) |
| `shipping_company_id` | `vehicle_plans` | `shipping_companies.id` | None (cross-domain) |
| `zone_id` | `vehicle_plans` | `zones.id` | None (cross-domain) |
| `governorate_id` | `vehicle_plans` | `governorates.id` | None (cross-domain) |
| `vehicle_id` | `vehicle_plan_slots` | `vehicles.id` | None (cross-domain) |
| `order_id` | `vehicle_plan_slot_orders` | `orders.id` | None (cross-domain) |
| `vehicle_plan_slot_id` | `vehicle_assignments` | `vehicle_plan_slots.id` | None (cross-domain) |
| `vehicle_id` | `vehicle_assignments` | `vehicles.id` | None (cross-domain) |
| `product_id` | `loading_tasks` | `products.id` | None (cross-domain) |
| `pool_entry_id` | `loading_tasks` | `prepared_products_pool.id` | None (cross-domain) |
| `preparation_wave_id` | `loading_tasks` | `preparation_waves.id` | None (cross-domain) |
| `vehicle_id` | `vehicle_inventory_items` | `vehicles.id` | None (cross-domain) |
| `product_id` | `vehicle_inventory_items` | `products.id` | None (cross-domain) |
| `pool_entry_id` | `vehicle_inventory_items` | `prepared_products_pool.id` | None (cross-domain) |
| `product_id` | `vehicle_inventory_movements` | `products.id` | None (cross-domain) |
| `order_id` | `allocation_records` | `orders.id` | None (cross-domain) |
| `order_line_id` | `allocation_records` | `order_lines.id` | None (cross-domain) |
| `product_id` | `allocation_records` | `products.id` | None (cross-domain) |
| `driver_id` | `driver_assignments` | `users.id` | None (cross-domain) |
| `vehicle_id` | `route_plans` | `vehicles.id` | None (cross-domain) |
| `order_id` | `route_plan_stops` | `orders.id` | None (cross-domain) |
| `shipping_company_id` | `shipment_groups` | `shipping_companies.id` | None (cross-domain) |
| `zone_id` | `shipment_groups` | `zones.id` | None (cross-domain) |
| `geography_group_id` | `shipment_groups` | `geography_groups.id` | None (cross-domain) |
| `vehicle_id` | `vehicle_shift_reconciliations` | `vehicles.id` | None (cross-domain) |
| `policy_evaluation_id` | `vehicle_capacity_snapshots` | `policy_evaluation_audits.id` | None (cross-domain) |
| `policy_evaluation_id` | `allocation_records` | `policy_evaluation_audits.id` | None (cross-domain) |
| `config_version_id` | `vehicle_shift_reconciliations` | `configuration_versions.id` | None (cross-domain) |
| `config_version_id` | `loading_sessions` | `configuration_versions.id` | None (cross-domain) |

---

## 8. Migration Sequence

Migrations must be created in this order (respecting FK dependencies within the module):

```
1.  create_vehicle_plans_table
2.  create_vehicle_plan_slots_table
3.  create_vehicle_plan_slot_orders_table
4.  create_vehicle_plan_adjustment_log_table
5.  create_loading_sessions_table
6.  create_vehicle_assignments_table
7.  create_vehicle_capacity_snapshots_table
8.  create_loading_tasks_table
9.  create_shipment_groups_table
10. create_shipment_group_items_table
11. create_loading_exceptions_table
12. create_vehicle_inventory_items_table
13. create_vehicle_inventory_movements_table
14. create_allocation_records_table
15. create_allocation_decisions_table
16. create_driver_assignments_table
17. create_route_plans_table
18. create_route_plan_stops_table
19. create_vehicle_shift_reconciliations_table
20. create_vehicle_shift_reconciliation_lines_table
21. add_indexes_to_loading_os_tables    (CONCURRENTLY — separate migration)
```

All migrations follow MIGRATION-STANDARDS.md. All non-unique indexes use `CONCURRENTLY`.

---

## 9. Data Classification

| Table | Classification | PII Fields |
|---|---|---|
| `loading_sessions` | L3 Internal | None |
| `vehicle_plans` | L3 Internal | None |
| `vehicle_plan_slots` | L3 Internal | None |
| `vehicle_plan_slot_orders` | L3 Internal | None |
| `vehicle_plan_adjustment_log` | L3 Internal | None |
| `vehicle_assignments` | L3 Internal | None |
| `vehicle_capacity_snapshots` | L3 Internal | None |
| `loading_tasks` | L3 Internal | None |
| `vehicle_inventory_items` | L3 Internal | None |
| `vehicle_inventory_movements` | L3 Internal | None |
| `allocation_records` | L2 Confidential | None direct; order references may chain to PII |
| `allocation_decisions` | L2 Confidential | None |
| `driver_assignments` | L1 Personal | `driver_name_snapshot` (encrypted AES-256), `driver_phone_snapshot` (encrypted AES-256) |
| `route_plans` | L3 Internal | None |
| `route_plan_stops` | L1 Personal | `customer_name_snapshot` (encrypted AES-256), `delivery_address_snapshot` (encrypted AES-256) |
| `shipment_groups` | L3 Internal | None |
| `shipment_group_items` | L3 Internal | None |
| `vehicle_shift_reconciliations` | L3 Internal | None |
| `vehicle_shift_reconciliation_lines` | L3 Internal | None |
| `loading_exceptions` | L3 Internal | None |

See DATA-CLASSIFICATION.md for full classification rules. L1 Personal fields are encrypted at
the application layer before persistence. Encryption key rotation follows the Key Management
standards in SECURITY-DESIGN.md.
