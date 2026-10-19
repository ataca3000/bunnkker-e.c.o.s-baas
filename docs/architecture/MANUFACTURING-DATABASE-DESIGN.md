# ECOS ERP — Manufacturing & Procurement Database Design

**Document:** MANUFACTURING-DATABASE-DESIGN  
**Version:** 1.0  
**Task:** TASK-MFG-DB-001  
**Status:** Draft — Awaiting Approval  
**Date:** 2026-06-29  
**Scope:** Phase C (New Entities) + Phase D (Table Review) + Phase E (ER Diagrams) + Phase F (Immutable Strategy) + Performance

---

## Phase C — New Database Architecture

Ten new tables are required. Three are immutable (append-only). Two have controlled state transitions (immutable after terminal state). Five are mutable operational records.

---

### C-01 · `decision_logs` ⬛ IMMUTABLE

**Purpose:** Append-only audit trail of every decision made by the Decision Engine. The single source of truth for "why did the system take this action?"

**Ownership:** Decision Engine BC

**Lifecycle:** Created → never updated → never deleted

```sql
CREATE TABLE decision_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Idempotency (RC-6)
    -- Format: {event_type}:{trigger_source_type}:{trigger_source_id}:{subject_type}:{subject_id}
    -- NULL for internal/cascaded decisions with no unique external trigger
    decision_key        VARCHAR(256) NULL,
    trigger_version     INTEGER      NOT NULL DEFAULT 1,  -- incremented on intentional retry

    -- What triggered this decision
    event_type          VARCHAR(50)  NOT NULL,   -- ORDER_PREPARING | INVENTORY_RETURN |
                                                  -- GOODS_RECEIPT_POSTED | RECIPE_UPDATED |
                                                  -- PROCUREMENT_SCHEDULER_TRIGGERED
    rule_id             VARCHAR(20)  NOT NULL,   -- MFG-006 | DIS-004 | COST-002 | PROC-012

    -- Source of the trigger
    trigger_source_type VARCHAR(30)  NOT NULL,   -- order | inventory_return | goods_receipt |
                                                  -- recipe | scheduler | system
    trigger_source_id   UUID         NOT NULL,   -- the order_id, return_source_id, etc.

    -- Subject of the decision
    subject_type        VARCHAR(30)  NOT NULL,   -- product | order_line | scheduler_run
    subject_id          UUID         NOT NULL,   -- product_id or order_line_id

    -- The decision itself
    decision            VARCHAR(60)  NOT NULL,   -- MANUFACTURE | SKIP_STOCK_SUFFICIENT |
                                                  -- FAIL_NO_RECIPE | DISASSEMBLE |
                                                  -- UPDATE_COST_FROM_INVOICE | etc.
    reason              TEXT         NOT NULL,
    outcome             VARCHAR(20)  NOT NULL,   -- executed | skipped | failed | pending

    -- Execution reference (set after action completes — the only permitted post-creation update)
    execution_type      VARCHAR(40)  NULL,       -- 'manufacturing_transaction' | 'disassembly_transaction'
    execution_id        UUID         NULL,       -- the ID of the executed transaction

    -- Context (formally typed per event_type — see DECISION-ENGINE-SPEC §4.4)
    metadata            JSONB        NULL,
    actor_id            UUID         NULL,       -- NULL = system, UUID = user

    -- Timestamps (no updated_at — immutable except execution_id backfill)
    decided_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    executed_at         TIMESTAMPTZ  NULL,
    error_message       TEXT         NULL,

    -- Retry chain
    retry_of            UUID         NULL        -- FK→decision_logs(id) self-reference
);
```

**Indexes:**
```sql
-- Idempotency lookup (most critical index)
CREATE UNIQUE INDEX uq_decision_logs_key ON decision_logs (decision_key)
    WHERE decision_key IS NOT NULL;

-- Find all decisions for a specific source document (e.g. all decisions for order #1042)
CREATE INDEX idx_decision_logs_trigger ON decision_logs (trigger_source_type, trigger_source_id);

-- Find all decisions affecting a specific product or order line
CREATE INDEX idx_decision_logs_subject ON decision_logs (subject_type, subject_id);

-- Operations Dashboard: filter by outcome (find all failed decisions)
CREATE INDEX idx_decision_logs_outcome ON decision_logs (outcome) WHERE outcome = 'failed';

-- Time-series queries (AI/analytics)
CREATE INDEX idx_decision_logs_event_time ON decision_logs (event_type, decided_at);

-- Execution lookup: find the decision that triggered a specific manufacturing transaction
CREATE INDEX idx_decision_logs_execution ON decision_logs (execution_type, execution_id)
    WHERE execution_id IS NOT NULL;

-- Retry chain traversal
CREATE INDEX idx_decision_logs_retry_of ON decision_logs (retry_of) WHERE retry_of IS NOT NULL;
```

**Constraints:**
- No UPDATE permission for application DB user (enforced at DB level) — EXCEPT execution_id backfill
- No DELETE permission for application DB user
- `outcome` CHECK: `IN ('executed', 'skipped', 'failed', 'pending')`
- `decided_at` is always set at creation, never NULL

**AI Readiness:** This table IS the primary training dataset for decision ML models. Schema is designed for time-series analysis and pattern recognition.

---

### C-02 · `product_cost_histories` ⬛ IMMUTABLE

**Purpose:** Append-only record of every change to a product's current cost. Complete cost traceability.

**Ownership:** Cost Engine BC

**Lifecycle:** Created → never updated → never deleted

```sql
CREATE TABLE product_cost_histories (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    product_id           UUID         NOT NULL,  -- FK→products(id) RESTRICT

    -- Cost change
    previous_cost        DECIMAL(15,4) NOT NULL,
    new_cost             DECIMAL(15,4) NOT NULL,

    -- What triggered the change
    cost_source          VARCHAR(40)  NOT NULL,  -- manual | purchase_invoice | recipe |
                                                  -- hybrid_purchase | hybrid_recipe |
                                                  -- recipe_component_changed
    source_document_type VARCHAR(40)  NULL,      -- goods_receipt | manufacturing_transaction |
                                                  -- recipe_update | manual
    source_document_id   UUID         NULL,      -- the GR id, mfg transaction id, etc.

    -- Who changed it
    changed_by           VARCHAR(100) NOT NULL,  -- user UUID or 'system'

    -- Immutable timestamp
    changed_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    -- NO updated_at (immutable)
    -- NO deleted_at (immutable)
);
```

**Indexes:**
```sql
-- Product cost history in chronological order
CREATE INDEX idx_cost_history_product ON product_cost_histories (product_id, changed_at DESC);

-- Find all cost changes caused by a specific goods receipt
CREATE INDEX idx_cost_history_source ON product_cost_histories (source_document_type, source_document_id)
    WHERE source_document_id IS NOT NULL;

-- Cost trend analysis by source type
CREATE INDEX idx_cost_history_by_source_type ON product_cost_histories (cost_source, changed_at DESC);
```

**Constraints:**
- No UPDATE, no DELETE (append-only enforcement)
- `cost_source` CHECK: `IN ('manual', 'purchase_invoice', 'recipe', 'hybrid_purchase', 'hybrid_recipe', 'recipe_component_changed')`

---

### C-03 · `manufacturing_transactions` ◑ MUTABLE → TERMINAL IMMUTABLE

**Purpose:** Records each manufacturing execution. Mutable during processing; immutable after reaching `completed` or `failed`.

**Ownership:** Manufacturing BC

**Lifecycle:** `processing` → `completed` | `failed` (terminal states are immutable)

```sql
CREATE TABLE manufacturing_transactions (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id           UUID         NOT NULL,  -- FK→companies(id) RESTRICT
    warehouse_id         UUID         NOT NULL,  -- FK→warehouses(id) RESTRICT

    -- Source trigger
    order_id             UUID         NOT NULL,  -- FK→orders(id) RESTRICT
    order_line_id        UUID         NOT NULL,  -- FK→order_lines(id) RESTRICT

    -- Output product
    product_id           UUID         NOT NULL,  -- FK→products(id) RESTRICT

    -- Recipe used (versioned snapshot)
    bom_id               UUID         NOT NULL,  -- FK→bills_of_materials(id) RESTRICT
    bom_version_snapshot VARCHAR(20)  NOT NULL,  -- version string at time of execution
    bom_version_number   INTEGER      NOT NULL,  -- integer version at time of execution

    -- Quantities and costs (set on completion)
    quantity_produced    DECIMAL(15,4) NOT NULL,
    manufacturing_cost   DECIMAL(15,4) NULL,     -- total cost, set when completed
    unit_cost            DECIMAL(15,4) NULL,     -- manufacturing_cost / quantity_produced

    -- Traceability
    decision_log_id      UUID         NOT NULL,  -- FK→decision_logs(id) RESTRICT

    -- State
    status               VARCHAR(20)  NOT NULL DEFAULT 'processing',  -- processing | completed | failed
    error_message        TEXT         NULL,

    -- Timestamps
    executed_at          TIMESTAMPTZ  NULL,      -- when status→completed
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

**Indexes:**
```sql
CREATE INDEX idx_mfg_txn_order ON manufacturing_transactions (order_id);
CREATE INDEX idx_mfg_txn_product ON manufacturing_transactions (product_id);
CREATE INDEX idx_mfg_txn_status ON manufacturing_transactions (status);
CREATE INDEX idx_mfg_txn_company_created ON manufacturing_transactions (company_id, created_at DESC);
CREATE INDEX idx_mfg_txn_bom ON manufacturing_transactions (bom_id);
CREATE INDEX idx_mfg_txn_decision ON manufacturing_transactions (decision_log_id);
```

**Constraints:**
- `status` CHECK: `IN ('processing', 'completed', 'failed')`
- Application enforces: once `status = completed` or `status = failed`, no further updates
- **Duplicate prevention (RC-10):** One successful manufacturing transaction per order line per BOM version:
```sql
CREATE UNIQUE INDEX uq_mfg_txn_business_key
    ON manufacturing_transactions (order_line_id, bom_id, bom_version_number)
    WHERE status != 'failed';
```
This allows a `failed` transaction to be retried (new row, same business key) while preventing two concurrent successful runs for the same operation. Combined with the idempotency key in `decision_logs`, duplicate manufacturing from event re-delivery is fully prevented.

---

### C-04 · `manufacturing_consumptions` ⬛ IMMUTABLE

**Purpose:** Records each raw material consumption line within a manufacturing transaction. Used for COGS tracking and FIFO audit.

**Ownership:** Manufacturing BC

**Lifecycle:** Created at manufacturing execution → never updated → never deleted

```sql
CREATE TABLE manufacturing_consumptions (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manufacturing_transaction_id UUID        NOT NULL,  -- FK→manufacturing_transactions(id) RESTRICT
    product_id                  UUID         NOT NULL,  -- FK→products(id) RESTRICT (the raw material)
    warehouse_id                UUID         NOT NULL,  -- FK→warehouses(id) RESTRICT

    -- Quantity consumed
    quantity                    DECIMAL(15,4) NOT NULL,

    -- Cost snapshot (RC-3: weighted average of FIFO layers consumed for this component)
    -- Populated from inventory_receipt_layers.landed_unit_cost, not product.current_cost
    -- Fallback: product.current_cost when no FIFO layers exist (e.g. negative stock scenario)
    unit_cost                   DECIMAL(15,4) NOT NULL,
    total_cost                  DECIMAL(15,4) NOT NULL, -- quantity × unit_cost (stored for audit, not recomputed)

    -- Immutable
    created_at                  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    -- NO updated_at (immutable)
);
```

**Indexes:**
```sql
-- All consumptions for a manufacturing run
CREATE INDEX idx_mfg_consumption_txn ON manufacturing_consumptions (manufacturing_transaction_id);

-- All consumptions of a specific product (demand analytics)
CREATE INDEX idx_mfg_consumption_product ON manufacturing_consumptions (product_id);
```

---

### C-05 · `disassembly_transactions` ◑ MUTABLE → TERMINAL IMMUTABLE

**Purpose:** Records each disassembly execution (reverse manufacturing) triggered by a product return.

**Ownership:** Manufacturing BC

**Lifecycle:** `processing` → `completed` | `failed`

```sql
CREATE TABLE disassembly_transactions (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id           UUID         NOT NULL,  -- FK→companies(id) RESTRICT
    warehouse_id         UUID         NOT NULL,  -- FK→warehouses(id) RESTRICT

    -- Source trigger
    order_id             UUID         NOT NULL,  -- FK→orders(id) RESTRICT (original order)

    -- Finished product being disassembled
    product_id           UUID         NOT NULL,  -- FK→products(id) RESTRICT

    -- Recipe used
    bom_id               UUID         NOT NULL,  -- FK→bills_of_materials(id) RESTRICT
    bom_version_snapshot VARCHAR(20)  NOT NULL,
    bom_version_number   INTEGER      NOT NULL,

    -- Quantity
    quantity_disassembled DECIMAL(15,4) NOT NULL,

    -- Traceability
    decision_log_id       UUID         NOT NULL,  -- FK→decision_logs(id) RESTRICT

    -- State
    status                VARCHAR(20)  NOT NULL DEFAULT 'processing',
    error_message         TEXT         NULL,

    -- Timestamps
    executed_at           TIMESTAMPTZ  NULL,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

**Indexes:**
```sql
CREATE INDEX idx_dis_txn_order ON disassembly_transactions (order_id);
CREATE INDEX idx_dis_txn_product ON disassembly_transactions (product_id);
CREATE INDEX idx_dis_txn_status ON disassembly_transactions (status);
```

---

### C-06 · `disassembly_recoveries` ⬛ IMMUTABLE

**Purpose:** Records each raw material recovered during a disassembly operation.

**Ownership:** Manufacturing BC

**Lifecycle:** Created at disassembly execution → never updated → never deleted

```sql
CREATE TABLE disassembly_recoveries (
    id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    disassembly_transaction_id UUID         NOT NULL,  -- FK→disassembly_transactions(id) RESTRICT
    product_id                 UUID         NOT NULL,  -- FK→products(id) RESTRICT (raw material recovered)
    warehouse_id               UUID         NOT NULL,  -- FK→warehouses(id) RESTRICT

    quantity                   DECIMAL(15,4) NOT NULL,
    unit_cost                  DECIMAL(15,4) NOT NULL,  -- current_cost at recovery time
    total_cost                 DECIMAL(15,4) NOT NULL,  -- quantity × unit_cost

    created_at                 TIMESTAMPTZ  NOT NULL DEFAULT NOW()
    -- NO updated_at (immutable)
);
```

**Indexes:**
```sql
CREATE INDEX idx_dis_recovery_txn ON disassembly_recoveries (disassembly_transaction_id);
CREATE INDEX idx_dis_recovery_product ON disassembly_recoveries (product_id);
```

---

### C-07 · `procurement_queue_entries` ✅ MUTABLE (live state)

**Purpose:** Live materialized net requirement per product per company. NOT a document — a continuously-updated calculation of what the system needs to purchase.

**Ownership:** Procurement Intelligence BC

**Lifecycle:** Created on first shortfall → updated on every relevant event → deleted only if product deleted

```sql
CREATE TABLE procurement_queue_entries (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id            UUID          NOT NULL,  -- FK→companies(id) RESTRICT
    product_id            UUID          NOT NULL,  -- FK→products(id) RESTRICT
    unit_id               UUID          NOT NULL,  -- FK→units(id) RESTRICT

    -- Net requirement breakdown (RC-9: always recalculated from current state, never accumulated)
    gross_demand_quantity DECIMAL(15,4) NOT NULL DEFAULT 0,   -- SUM of unfulfilled manufacturing demands
    available_quantity    DECIMAL(15,4) NOT NULL DEFAULT 0,   -- on_hand - reserved (includes GRs + recoveries already in inventory)
    in_transit_quantity   DECIMAL(15,4) NOT NULL DEFAULT 0,   -- open PO quantities not yet received
    net_required_quantity DECIMAL(15,4) NOT NULL DEFAULT 0,   -- max(0, gross - available - in_transit)

    -- Status
    is_satisfied          BOOLEAN       NOT NULL DEFAULT false,

    -- Contributing demand sources (JSONB array for flexibility)
    -- [{type: "order", id: "uuid", qty: 2.5}, {type: "order", id: "uuid2", qty: 3.0}]
    contributing_sources  JSONB         NOT NULL DEFAULT '[]',

    last_recalculated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_queue_company_product UNIQUE (company_id, product_id)
);
```

**Indexes:**
```sql
-- Find all unsatisfied requirements for a company (scheduler query)
CREATE INDEX idx_queue_company_unsatisfied ON procurement_queue_entries (company_id, is_satisfied)
    WHERE is_satisfied = false;

-- Scheduler recalculation by product
CREATE INDEX idx_queue_product ON procurement_queue_entries (product_id);

-- All queue entries ordered by net requirement (priority display)
CREATE INDEX idx_queue_net_required ON procurement_queue_entries (company_id, net_required_quantity DESC)
    WHERE is_satisfied = false;
```

---

### C-08 · `procurement_schedules` ✅ MUTABLE

**Purpose:** Company-level scheduler configuration defining when the procurement scheduler runs.

**Ownership:** Procurement Intelligence BC

**Lifecycle:** Created once per company → updated when schedule changes → never deleted (deactivated)

```sql
CREATE TABLE procurement_schedules (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id    UUID          NOT NULL UNIQUE,  -- FK→companies(id) RESTRICT
                                                   -- One schedule per company

    -- Schedule configuration
    run_times     JSONB         NOT NULL,   -- ["10:00", "15:00", "20:00"] (HH:MM, 24-hour)
    timezone      VARCHAR(100)  NOT NULL DEFAULT 'UTC',  -- IANA timezone

    -- State
    is_active     BOOLEAN       NOT NULL DEFAULT true,
    last_run_at   TIMESTAMPTZ   NULL,
    next_run_at   TIMESTAMPTZ   NULL,

    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
```

---

### C-09 · `scheduler_runs` ◑ MUTABLE → TERMINAL IMMUTABLE

**Purpose:** Records each execution of the Procurement Scheduler. Immutable once completed or failed.

**Ownership:** Procurement Intelligence BC

```sql
CREATE TABLE scheduler_runs (
    id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id               UUID          NOT NULL,  -- FK→procurement_schedules(id) RESTRICT
    company_id                UUID          NOT NULL,  -- FK→companies(id) RESTRICT

    trigger_type              VARCHAR(20)   NOT NULL DEFAULT 'scheduled',  -- scheduled | manual

    -- Timing
    started_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    completed_at              TIMESTAMPTZ   NULL,

    -- State
    status                    VARCHAR(20)   NOT NULL DEFAULT 'running',  -- running | completed | failed

    -- Snapshots taken at run time (for auditability and AI)
    inventory_snapshot        JSONB         NULL,  -- stock levels at run time
    open_po_snapshot          JSONB         NULL,  -- open PO quantities at run time
    queue_snapshot            JSONB         NULL,  -- procurement queue at run time

    -- Results
    purchase_requests_created INTEGER       NOT NULL DEFAULT 0,
    requirements_cleared      INTEGER       NOT NULL DEFAULT 0,  -- products with net_qty = 0

    error_message             TEXT          NULL,

    created_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
```

**Indexes:**
```sql
CREATE INDEX idx_scheduler_runs_company ON scheduler_runs (company_id, started_at DESC);
CREATE INDEX idx_scheduler_runs_status ON scheduler_runs (status);
```

---

### C-10 · `purchase_requests` ✅ MUTABLE

**Purpose:** System-generated procurement recommendation. Created by the Scheduler. Reviewed and converted to Purchase Order by the purchasing team.

**Ownership:** Procurement Intelligence BC

**Lifecycle:** `pending` → `converted_to_po` | `cancelled`

```sql
CREATE TABLE purchase_requests (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pr_number             VARCHAR(30)   NOT NULL UNIQUE,    -- PR-2026-001 (auto-generated)

    scheduler_run_id      UUID          NOT NULL,  -- FK→scheduler_runs(id) RESTRICT
    company_id            UUID          NOT NULL,  -- FK→companies(id) RESTRICT

    -- What to buy
    product_id            UUID          NOT NULL,  -- FK→products(id) RESTRICT
    unit_id               UUID          NOT NULL,  -- FK→units(id) RESTRICT
    required_quantity     DECIMAL(15,4) NOT NULL,

    -- Suggested supplier (optional — from product's last_supplier_id or product_suppliers)
    suggested_supplier_id UUID          NULL,      -- FK→suppliers(id) SET NULL

    -- Demand period this PR covers
    period_start          TIMESTAMPTZ   NOT NULL,
    period_end            TIMESTAMPTZ   NOT NULL,

    -- Context for the purchasing team
    affected_order_count  INTEGER       NOT NULL DEFAULT 0,
    reason_summary        TEXT          NOT NULL,

    -- Lifecycle
    status                VARCHAR(30)   NOT NULL DEFAULT 'pending',  -- pending | converted_to_po | cancelled
    converted_po_id       UUID          NULL,      -- FK→purchase_orders(id) SET NULL
    cancelled_reason      TEXT          NULL,
    cancelled_at          TIMESTAMPTZ   NULL,

    created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    deleted_at            TIMESTAMPTZ   NULL       -- soft delete
);
```

**Indexes:**
```sql
CREATE INDEX idx_pr_company_status ON purchase_requests (company_id, status);
CREATE INDEX idx_pr_product ON purchase_requests (product_id);
CREATE INDEX idx_pr_scheduler_run ON purchase_requests (scheduler_run_id);
CREATE INDEX idx_pr_number ON purchase_requests (pr_number);
```

**Constraints:**
- `status` CHECK: `IN ('pending', 'converted_to_po', 'cancelled')`
- `cancelled_reason NOT NULL` when `status = 'cancelled'` (application-enforced)

---

## Phase D — Existing Tables Review Matrix

| Table | Classification | Justification | Changes Required |
|-------|---------------|---------------|-----------------|
| `products` | **Reuse + Extend** | Core entity, used everywhere. Missing behavioral flags and cost configuration. | Add: `can_manufacture`, `can_disassemble`, `allow_negative_stock`, `cost_source`, `current_cost` |
| `units` | **Reuse As-Is** | Perfect fit. No changes needed. | None |
| `suppliers` | **Reuse As-Is** | Fit for Phase 1. Phase 2 needs lead time fields. | None (Phase 1) |
| `bills_of_materials` | **Reuse + Extend** | Already IS the Recipe in ECOS. Version as string is problematic. | Add: `version_number INTEGER`, partial unique index on active BOM per product |
| `bill_of_material_lines` | **Reuse + Extend** | Component lines are correct. Column naming and waste_percentage are issues. | Add: `input_product_id`, `sort_order`, `unit_id_snapshot`. Deprecate: `waste_percentage` |
| `inventory_items` | **Reuse As-Is** | Perfect fit for manufacturing stock operations. | None |
| `stock_ledger_entries` | **Reuse + Extend** | Core immutable ledger. Missing disassembly movement types. | Add LedgerMovementType values: `disassembly_consumption`, `disassembly_output` |
| `stock_movements` | **Reuse As-Is** | Keep for backward compat. May need movement type additions if actively queried. | Audit usage — add movement types if needed |
| `inventory_receipt_layers` | **Reuse + Extend** | FIFO layer structure is reusable for manufacturing output. Missing source tracking. | Add: `source_type VARCHAR(30)`, `manufacturing_transaction_id UUID NULL` |
| `inventory_layer_consumptions` | **Reuse + Extend** | FIFO consumption record reusable for manufacturing. Missing consumption type. | Add: `consumption_type VARCHAR(30)`, `manufacturing_transaction_id UUID NULL`, `disassembly_transaction_id UUID NULL` |
| `stock_balances` | **Reuse As-Is** | Denormalized balance — manufacturing will update via existing engine. | None |
| `purchase_orders` | **Reuse As-Is** | Purchase requests (new) convert to purchase orders (existing). | None |
| `purchase_order_lines` | **Reuse As-Is** | No changes needed. | None |
| `goods_receipts` | **Reuse As-Is** | GR posting triggers Decision Engine events. No schema changes. | None |
| `goods_receipt_lines` | **Reuse As-Is** | `landed_unit_cost` is used by Cost Engine. Perfect fit. | None |
| `orders` | **Reuse + Extend** | Needs `preparing` status and manufacturing timestamp. | Add: `preparing` to OrderStatus enum. Add: `inventory_manufacturing_at TIMESTAMPTZ NULL` |
| `order_lines` | **Reuse As-Is** | Referenced by manufacturing transactions. No changes. | None |
| `categories` | **Reuse As-Is** | Used by products. No manufacturing impact. | None |
| `warehouses` | **Reuse As-Is** | Used by all inventory operations. No changes. | None |
| `companies` | **Reuse As-Is** | Used by procurement schedules and inventory. No changes. | None |

---

## Phase E — Logical ER Diagrams

### E-01 · Product + Recipe (BOM) Domain

```
┌──────────────┐           ┌──────────────────────┐
│    units     │           │       products        │
├──────────────┤           ├──────────────────────┤
│ id           │◄──────────│ id                   │
│ code         │           │ sku                  │
│ name         │           │ name                 │
│ symbol       │           │ unit_id (FK→units)   │
└──────────────┘           │ product_type         │ ← classification only
                           │ cost_source          │ ← NEW
                           │ current_cost         │ ← NEW
                           │ can_manufacture      │ ← NEW
                           │ can_disassemble      │ ← NEW
                           │ allow_negative_stock │ ← NEW
                           │ current_fifo_cost    │ ← existing, kept
                           └──────────┬───────────┘
                                      │ 1
                                      │
                                      │ 0..1
                           ┌──────────▼───────────┐
                           │  bills_of_materials   │
                           ├──────────────────────┤
                           │ id                   │
                           │ bom_number           │
                           │ product_id (FK)      │ ← the OUTPUT product
                           │ version (VARCHAR)    │ ← kept for compat
                           │ version_number (INT) │ ← NEW, authoritative
                           │ is_active            │
                           └──────────┬───────────┘
                                      │ 1
                                      │
                                      │ 1..*
                           ┌──────────▼───────────┐
                           │ bill_of_material_lines│
                           ├──────────────────────┤
                           │ id                   │
                           │ bom_id (FK)          │
                           │ raw_material_id (FK) │ ← existing FK, kept
                           │ input_product_id (FK)│ ← NEW alias
                           │ quantity             │
                           │ sort_order           │ ← NEW
                           │ unit_id_snapshot     │ ← NEW
                           │ waste_percentage     │ ← DEPRECATED
                           └──────────────────────┘
```

---

### E-02 · Order → Decision Engine → Manufacturing

```
┌──────────────────┐    1      ┌──────────────────┐
│      orders      │──────────▶│   order_lines    │
├──────────────────┤           ├──────────────────┤
│ id               │           │ id               │
│ status           │◄──────────│ order_id (FK)    │
│  +preparing NEW  │           │ product_id (FK)  │
│ inventory_       │           │ quantity         │
│  manufacturing   │           └────────┬─────────┘
│  _at (NEW)       │                    │
└────────┬─────────┘                    │
         │ triggers                     │
         │ ORDER_PREPARING              │
         ▼                              │
┌──────────────────────────────────────┐│
│          decision_logs               ││
├──────────────────────────────────────┤│
│ id                                   ││
│ event_type = ORDER_PREPARING         ││
│ rule_id = MFG-004                    ││
│ trigger_source_type = order          ││
│ trigger_source_id = orders.id        ││
│ subject_type = order_line            ││
│ subject_id = order_lines.id ─────────┘│
│ decision = MANUFACTURE               │
│ outcome = executed                   │
└────────────────┬─────────────────────┘
                 │ 1
                 │
                 │ 1
┌────────────────▼─────────────────────┐
│       manufacturing_transactions     │
├──────────────────────────────────────┤
│ id                                   │
│ order_id (FK→orders)                 │
│ order_line_id (FK→order_lines)       │
│ product_id (FK→products)             │
│ bom_id (FK→bills_of_materials)       │
│ bom_version_snapshot                 │
│ bom_version_number                   │
│ quantity_produced                    │
│ manufacturing_cost                   │
│ unit_cost                            │
│ decision_log_id (FK)                 │
│ status                               │
└────────────────┬─────────────────────┘
                 │ 1
                 │
                 │ 1..*
┌────────────────▼─────────────────────┐
│       manufacturing_consumptions     │
├──────────────────────────────────────┤
│ id                                   │
│ manufacturing_transaction_id (FK)    │
│ product_id (FK) ← raw material used │
│ warehouse_id (FK)                    │
│ quantity                             │
│ unit_cost                            │
│ total_cost                           │
└──────────────────────────────────────┘
```

---

### E-03 · Manufacturing → Inventory (FIFO)

```
                   Manufacturing Execution
                           │
                           │ consumes raw materials
                           ▼
┌──────────────────────────────────────────────────────┐
│                  stock_ledger_entries                 │
│          movement_type = production_consumption       │
│          reference_type = manufacturing_transaction  │
│          reference_id = manufacturing_transaction.id │
└──────────────────────────┬───────────────────────────┘
                           │ depletes FIFO layers
                           ▼
┌──────────────────────────────────────────────────────┐
│             inventory_receipt_layers                  │
│          (raw material layers — FIFO depleted)        │
└──────────────────────────┬───────────────────────────┘
                           │
                           │ recorded in
                           ▼
┌──────────────────────────────────────────────────────┐
│            inventory_layer_consumptions               │
├──────────────────────────────────────────────────────┤
│ consumption_type = 'manufacturing'         ← NEW     │
│ manufacturing_transaction_id               ← NEW     │
│ order_id = NULL (not a sale)                         │
│ order_line_id = NULL (not a sale)                    │
└──────────────────────────────────────────────────────┘

                Manufacturing Execution
                           │
                           │ produces finished product
                           ▼
┌──────────────────────────────────────────────────────┐
│                  stock_ledger_entries                 │
│          movement_type = production_output            │
│          reference_type = manufacturing_transaction  │
└──────────────────────────┬───────────────────────────┘
                           │ creates new FIFO layer
                           ▼
┌──────────────────────────────────────────────────────┐
│             inventory_receipt_layers                  │
├──────────────────────────────────────────────────────┤
│ source_type = 'manufacturing'              ← NEW     │
│ manufacturing_transaction_id               ← NEW     │
│ goods_receipt_id = NULL                              │
│ supplier_id = NULL                                   │
│ landed_unit_cost = manufacturing unit_cost           │
└──────────────────────────────────────────────────────┘
```

---

### E-04 · Return → Disassembly

```
        Order Return Event
               │
               ▼
┌──────────────────────────────────────────┐
│             decision_logs                │
│   event_type = ORDER_RETURNED            │
│   decision = DISASSEMBLE                 │
│   outcome = executed                     │
└──────────────────┬───────────────────────┘
                   │ 1
                   │
                   │ 1
┌──────────────────▼───────────────────────┐
│       disassembly_transactions           │
├──────────────────────────────────────────┤
│ id                                       │
│ order_id (FK) ← original order           │
│ product_id (FK) ← finished good consumed│
│ bom_id (FK)                              │
│ quantity_disassembled                    │
│ decision_log_id (FK)                     │
└──────────────────┬───────────────────────┘
                   │ 1
                   │
                   │ 1..* (one per component)
┌──────────────────▼───────────────────────┐
│         disassembly_recoveries           │
├──────────────────────────────────────────┤
│ id                                       │
│ disassembly_transaction_id (FK)          │
│ product_id (FK) ← raw material recovered│
│ quantity                                 │
│ unit_cost ← current_cost at recovery    │
│ total_cost                               │
└──────────────────────────────────────────┘
```

---

### E-05 · Procurement Intelligence

```
┌────────────────────────────────────┐
│      procurement_schedules         │
├────────────────────────────────────┤
│ id                                 │
│ company_id (FK, UNIQUE)            │
│ run_times (JSONB)                  │
│ timezone                           │
│ is_active                          │
└────────────────────┬───────────────┘
                     │ 1
                     │
                     │ 1..*
┌────────────────────▼───────────────┐
│         scheduler_runs             │
├────────────────────────────────────┤
│ id                                 │
│ schedule_id (FK)                   │
│ company_id (FK)                    │
│ status                             │
│ inventory_snapshot (JSONB)         │
│ open_po_snapshot (JSONB)           │
│ queue_snapshot (JSONB)             │
│ purchase_requests_created          │
└────────────────────┬───────────────┘
                     │ 1
                     │
                     │ 0..*
┌────────────────────▼───────────────┐
│         purchase_requests          │
├────────────────────────────────────┤
│ id                                 │
│ pr_number (UNIQUE)                 │
│ scheduler_run_id (FK)              │
│ product_id (FK)                    │
│ required_quantity                  │
│ suggested_supplier_id (FK, NULL)   │
│ status                             │
│ converted_po_id (FK, NULL)─────────┼──────▶ purchase_orders
└────────────────────────────────────┘

┌────────────────────────────────────┐
│    procurement_queue_entries       │
├────────────────────────────────────┤
│ id                                 │
│ company_id (FK)                    │
│ product_id (FK)                    │
│ net_required_quantity              │
│ gross_demand_quantity              │
│ available_quantity                 │
│ in_transit_quantity                │
│ recovered_quantity                 │
│ is_satisfied                       │
│ contributing_sources (JSONB)       │
└────────────────────────────────────┘
```

---

### E-06 · Cost Engine

```
            Goods Receipt Posted
                    │
                    ▼
┌─────────────────────────────────────────────────────┐
│                  decision_logs                      │
│   event_type = GOODS_RECEIPT_POSTED                 │
│   rule_id = COST-002                                │
│   decision = UPDATE_COST_FROM_INVOICE               │
└─────────────────────┬───────────────────────────────┘
                      │ triggers cost update
                      ▼
┌─────────────────────────────────────────────────────┐
│                   products                          │
│   current_cost ← goods_receipt_lines.landed_unit_cost│
└─────────────────────┬───────────────────────────────┘
                      │ creates history entry
                      ▼
┌─────────────────────────────────────────────────────┐
│             product_cost_histories                  │
├─────────────────────────────────────────────────────┤
│ product_id (FK)                                     │
│ previous_cost                                       │
│ new_cost                                            │
│ cost_source = 'purchase_invoice'                    │
│ source_document_type = 'goods_receipt'              │
│ source_document_id = goods_receipt.id               │
│ changed_by = 'system'                               │
│ changed_at                                          │
└─────────────────────────────────────────────────────┘
```

---

## Phase F — Immutable Data Strategy

### F-01 Truly Immutable Tables (Append-Only)

These tables must never be updated or deleted by application code. Database-level enforcement is recommended.

| Table | Enforcement Method |
|-------|-------------------|
| `decision_logs` | DB role: GRANT INSERT only. No UPDATE, DELETE. |
| `product_cost_histories` | DB role: GRANT INSERT only. No UPDATE, DELETE. |
| `manufacturing_consumptions` | DB role: GRANT INSERT only. No UPDATE, DELETE. |
| `disassembly_recoveries` | DB role: GRANT INSERT only. No UPDATE, DELETE. |
| `stock_ledger_entries` | Already immutable (no `updated_at`). DB role enforcement. |
| `inventory_layer_consumptions` | Already immutable (no `updated_at`). DB role enforcement. |

**PostgreSQL Enforcement Pattern:**
```sql
-- Create an application role that cannot update/delete immutable tables
REVOKE UPDATE, DELETE ON decision_logs FROM app_user;
REVOKE UPDATE, DELETE ON product_cost_histories FROM app_user;
REVOKE UPDATE, DELETE ON manufacturing_consumptions FROM app_user;
REVOKE UPDATE, DELETE ON disassembly_recoveries FROM app_user;

-- Additional: Row Security Policy for extra safety
CREATE POLICY no_update_decision_logs ON decision_logs
    FOR UPDATE USING (false);  -- Always false = updates blocked
```

### F-02 Terminal-Immutable Tables

These tables have controlled state transitions. Once in a terminal state, no updates should occur.

| Table | Terminal States | Non-Terminal States |
|-------|----------------|-------------------|
| `manufacturing_transactions` | `completed`, `failed` | `processing` |
| `disassembly_transactions` | `completed`, `failed` | `processing` |
| `scheduler_runs` | `completed`, `failed` | `running` |

**Application-Level Enforcement:**
```php
// Before any update, check current status:
if (in_array($record->status, ['completed', 'failed'])) {
    throw new ImmutableRecordException("Cannot update a terminal record.");
}
```

### F-03 Immutable Identification: Schema Signals

Every immutable table follows these conventions to signal its immutability to developers:
1. **No `updated_at` column** — signals the record is never updated
2. **No `deleted_at` column** — signals the record is never soft-deleted
3. **`created_at` uses `DEFAULT NOW()` (useCurrent)** — set at creation, never touched again
4. Documentation in the model class with `@immutable` annotation

### F-04 Recipe Versioning Immutability

Used recipes (those referenced by at least one `manufacturing_transaction`) become **read-only forever**:
- `bills_of_materials.is_active` can be set to `false` (deactivated)
- The row itself cannot be modified if any manufacturing transaction references it
- Application checks before allowing BOM save:

```sql
-- Check if BOM has been used
SELECT COUNT(*) FROM manufacturing_transactions WHERE bom_id = ? LIMIT 1;
-- If > 0: save is rejected. User must create a new BOM version.
```

When a user updates an active, used BOM:
1. Set current BOM `is_active = false`
2. Create a new BOM row with `version_number = old + 1`
3. Copy all lines to new BOM
4. Apply user's changes
5. Set new BOM `is_active = true`

---

## Performance Considerations

### Index Strategy

**Decision Engine queries:**
```sql
-- "Show me all failed decisions for order #1042"
SELECT * FROM decision_logs
WHERE trigger_source_type = 'order' AND trigger_source_id = ? AND outcome = 'failed';
-- Uses: idx_decision_logs_trigger + idx_decision_logs_outcome
```

**Procurement Queue query (Scheduler — hottest path):**
```sql
-- "Get all unsatisfied requirements for company X"
SELECT * FROM procurement_queue_entries
WHERE company_id = ? AND is_satisfied = false
ORDER BY net_required_quantity DESC;
-- Uses: idx_queue_company_unsatisfied (partial index)
```

**Manufacturing history per product:**
```sql
-- "All manufacturing runs for Raw Honey in last 30 days"
SELECT * FROM manufacturing_transactions
WHERE product_id = ? AND created_at >= NOW() - INTERVAL '30 days';
-- Uses: idx_mfg_txn_product + created_at range
```

**FIFO consumption lookup (existing + extended):**
```sql
-- "What was the FIFO cost of this manufacturing run?"
SELECT mc.product_id, mc.quantity, mc.unit_cost
FROM manufacturing_consumptions mc
WHERE mc.manufacturing_transaction_id = ?;
-- Uses: idx_mfg_consumption_txn
```

### JSONB Performance

Three tables use JSONB columns:
1. `procurement_queue_entries.contributing_sources` — queried by scheduler to build PR summaries. GIN index optional for Phase 2.
2. `scheduler_runs.inventory_snapshot` / `open_po_snapshot` / `queue_snapshot` — read-once at run time, written once. No indexing needed.
3. `procurement_schedules.run_times` — read for scheduling. No indexing needed (one row per company).

### Concurrency Controls

**Procurement Queue updates:** Multiple events may try to update the same `procurement_queue_entries` row simultaneously (e.g., two orders failing stock check at the same time).

```sql
-- Use SELECT FOR UPDATE to serialize queue updates
BEGIN;
SELECT * FROM procurement_queue_entries
WHERE company_id = ? AND product_id = ?
FOR UPDATE;

UPDATE procurement_queue_entries
SET net_required_quantity = ..., updated_at = NOW()
WHERE company_id = ? AND product_id = ?;
COMMIT;
```

**Scheduler concurrency lock:** The scheduler uses a database-level advisory lock:
```sql
-- Acquire advisory lock for company (non-blocking)
SELECT pg_try_advisory_lock(company_id_hash);
-- If returns false: another run is active, skip.
```

**Manufacturing transaction:** Entire manufacturing execution runs in a single database transaction. If any step fails, all inventory movements are rolled back.
