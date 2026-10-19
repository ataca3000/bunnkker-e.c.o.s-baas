# ECOS ERP — Decision Engine Specification

**Document:** DECISION-ENGINE-SPEC  
**Version:** 1.0  
**Task:** TASK-MFG-SPEC-001  
**Status:** Draft — Awaiting Approval  
**Date:** 2026-06-29  
**Scope:** Decision Engine architecture, event catalog, decision rules, logging, and failure handling

---

## Overview

The Decision Engine is the central nervous system of ECOS ERP's automated operations. Every business event that may trigger manufacturing, disassembly, or procurement flows through it. No module calls Manufacturing or Procurement directly.

**Core Principle:** A decision is logged before its action is executed. If the action fails, the decision log still exists with an accurate outcome. This guarantees full auditability even in failure scenarios.

---

## 1. Architecture

### 1.1 Position in the System

```
┌────────────────────────────────────────────────────────────┐
│                     ECOS ERP                               │
│                                                            │
│  ┌──────────────┐    Events    ┌─────────────────────┐    │
│  │  Orders BC   │─────────────▶│   Decision Engine   │    │
│  └──────────────┘              │                     │    │
│                                │  - Receives events  │    │
│  ┌──────────────┐   Events     │  - Evaluates rules  │    │
│  │  Returns BC  │─────────────▶│  - Logs decisions   │    │
│  └──────────────┘              │  - Dispatches to:   │    │
│                                │    ManufacturingSvc │    │
│  ┌──────────────┐   Events     │    DisassemblySvc   │    │
│  │  Recipe BC   │─────────────▶│    ProcurementQueue │    │
│  └──────────────┘              │    CostEngine       │    │
│                                └─────────────────────┘    │
└────────────────────────────────────────────────────────────┘
```

### 1.2 Design Principles

1. **Single Entry Point** — No business module calls Manufacturing or Procurement directly. All routing flows through the Decision Engine.
2. **Log Before Execute** — A DecisionLog entry is written before any action is taken. Status is updated after execution.
3. **Stateless Rules** — Decision rules are pure functions: given an event and current state, they return a decision. No side effects in the rule evaluation phase.
4. **No Blocking** — Decision failures do not block the originating module (e.g., a manufacturing failure does not stop an order from continuing its lifecycle).
5. **Idempotent Logging** — Each event+source combination is logged once. Retries create new log entries with a reference to the original.

---

## 2. Event Catalog

Every event the Decision Engine handles is defined here. Events are immutable value objects.

### 2.1 ORDER_PREPARING

**Emitted by:** Orders BC  
**When:** Order status transitions to `preparing`  
**Payload:**

```
OrderPreparingEvent {
  order_id:    UUID
  items: [
    {
      product_id:   UUID
      quantity:     decimal
      unit_id:      UUID
      order_line_id: UUID
    }
  ]
  occurred_at:  timestamp
  actor_id:     UUID | 'system'
}
```

**Decision scope:** One decision per line item. Each product in the order is evaluated independently.

---

### 2.2 INVENTORY_RETURN

**Emitted by:** Any domain that physically receives inventory back into a warehouse (Returns BC, Cancellation flow, Warehouse return, etc.)  
**When:** Goods are physically received back and confirmed

**Design principle (RC-4):** The Disassembly Engine is decoupled from any specific Returns implementation. The event is generic — the Disassembly Engine does not know whether the return came from a customer, a warehouse, or a cancellation. The emitting domain is responsible for confirming physical receipt before emitting.

**Payload:**

```
InventoryReturnEvent {
  return_source_type: string    -- 'customer_return' | 'warehouse_return' | 'cancellation' | 'other'
  return_source_id:   UUID      -- ID of the source document (return_id, cancellation_id, etc.)
  warehouse_id:       UUID      -- destination warehouse
  items: [
    {
      product_id:   UUID
      quantity:     decimal
      unit_id:      UUID
    }
  ]
  occurred_at:  timestamp
  actor_id:     UUID | 'system'
}
```

**Decision scope:** One decision per returned line item.

---

### 2.3 GOODS_RECEIPT_POSTED

**Emitted by:** Purchasing BC  
**When:** A GoodsReceipt is posted (status → posted)  
**Payload:**

```
GoodsReceiptPostedEvent {
  goods_receipt_id: UUID
  lines: [
    {
      product_id:      UUID
      quantity:        decimal
      landed_unit_cost: Money
    }
  ]
  occurred_at: timestamp
  actor_id:    UUID
}
```

**Decision scope:** Triggers Cost Engine update and Procurement Queue recalculation per product.

---

### 2.4 RECIPE_UPDATED

**Emitted by:** Recipe BC  
**When:** A recipe is saved (version incremented)  
**Payload:**

```
RecipeUpdatedEvent {
  recipe_id:    UUID
  product_id:   UUID
  old_version:  integer
  new_version:  integer
  occurred_at:  timestamp
  actor_id:     UUID
}
```

**Decision scope:** Triggers cost recalculation for the product and its parents.

---

### 2.5 PROCUREMENT_SCHEDULER_TRIGGERED

**Emitted by:** Scheduler (cron) or manual trigger  
**When:** A scheduled procurement run time is reached  
**Payload:**

```
ProcurementSchedulerTriggeredEvent {
  schedule_id:  UUID
  company_id:   UUID
  run_time:     timestamp
  trigger_type: 'scheduled' | 'manual'
  actor_id:     UUID | 'system'
}
```

**Decision scope:** Triggers a full procurement queue recalculation and purchase request generation.

---

### 2.6 MANUFACTURING_FAILED (Internal)

**Emitted by:** Decision Engine itself  
**When:** Manufacturing was decided but execution failed  
**Payload:**

```
ManufacturingFailedEvent {
  order_id:    UUID
  product_id:  UUID
  quantity:    decimal
  reason:      string
  decision_log_id: UUID
  occurred_at: timestamp
}
```

**Decision scope:** Triggers procurement queue update for the shortfall.

---

## 3. Decision Rules

A Decision Rule is a pure function:

```
evaluate(event, product_state) → Decision
```

Rules are evaluated in **priority order**. The first matching rule wins.

### 3.1 Rules for ORDER_PREPARING

Evaluated once per line item, in strict priority order. First matching rule wins.

| Priority | Rule ID | Condition | Decision | Action |
|----------|---------|-----------|----------|--------|
| 1 | `MFG-001` | `product.can_manufacture = false` | `SKIP_NOT_MANUFACTURABLE` | Log only (skipped). No action. |
| 2 | `MFG-002` | `product.can_manufacture = true` AND `recipe = null` | `FAIL_NO_RECIPE` | Log (failed). Visible in Operations Dashboard. |
| 3 | `MFG-003` | `recipe.is_active = false` | `FAIL_RECIPE_INACTIVE` | Log (failed). Visible in Operations Dashboard. |
| 4 | `MFG-005` | Recipe valid AND `available_finished_goods ≥ order_line.quantity` | `SKIP_STOCK_SUFFICIENT` | Log (skipped). Existing stock satisfies demand. No manufacturing. |
| 5 | `MFG-006` | Recipe valid AND `shortage_qty > 0` AND all raw materials sufficient | `MANUFACTURE` | Execute ManufacturingService(shortage_qty) |
| 6 | `MFG-007` | Recipe valid AND `shortage_qty > 0` AND raw shortfall AND raw `allow_negative = true` | `MANUFACTURE_WITH_SHORTAGE` | Execute ManufacturingService(shortage_qty) with negative raw stock; add shortfall to queue |
| 7 | `MFG-008` | Recipe valid AND `shortage_qty > 0` AND raw shortfall AND raw `allow_negative = false` | `FAIL_STOCK_SHORTAGE` | Log (failed). Add shortfall to procurement queue. Do NOT manufacture. |

**shortage_qty Calculation (used in MFG-005 through MFG-008):**

```
available_finished = InventoryEngine.availableStock(
    product_id   = order_line.product_id,
    warehouse_id = order.warehouse_id
)
shortage_qty = max(0, order_line.quantity - available_finished)
```

**Raw Material Shortfall Detection (used in MFG-007 and MFG-008):**

```
// Evaluated only when shortage_qty > 0
For each RecipeItem in recipe:
  required_raw  = item.quantity × shortage_qty        // proportional to shortage, not full order
  available_raw = InventoryEngine.availableStock(item.product_id, warehouse_id)
  raw_shortfall = max(0, required_raw - available_raw)
  
  if raw_shortfall > 0:
    // Check allow_negative_stock on the RAW MATERIAL (not the finished product)
    if item.product.allow_negative_stock = false:
      → block manufacturing (MFG-008)
    else:
      → proceed with shortage (MFG-007), add to queue
```

**Attention Queue:** Failed decisions (`FAIL_NO_RECIPE`, `FAIL_RECIPE_INACTIVE`, `FAIL_STOCK_SHORTAGE`) are visible in the Operations Dashboard by filtering `decision_logs WHERE outcome = 'failed'`. No separate table is needed.

---

### 3.2 Rules for INVENTORY_RETURN

Evaluated once per returned line item. The event source (`return_source_type`) does not affect rule evaluation — disassembly logic is identical regardless of where the return originated.

| Priority | Rule ID | Condition | Decision | Action |
|----------|---------|-----------|----------|--------|
| 1 | `DIS-001` | `product.can_disassemble = false` | `SKIP_DISASSEMBLY_DISABLED` | Receive product to finished goods inventory as-is |
| 2 | `DIS-002` | `product.can_disassemble = true` AND `recipe = null` | `SKIP_NO_RECIPE` | Receive product to finished goods inventory as-is |
| 3 | `DIS-003` | `product.can_disassemble = true` AND `recipe.is_active = false` | `SKIP_RECIPE_INACTIVE` | Receive product to finished goods inventory as-is |
| 4 | `DIS-004` | All conditions met | `DISASSEMBLE` | Execute DisassemblyService (inventory committed, queue updated post-commit) |

---

### 3.3 Rules for GOODS_RECEIPT_POSTED

Evaluated once per receipt line.

| Priority | Rule ID | Condition | Decision | Action |
|----------|---------|-----------|----------|--------|
| 1 | `COST-001` | `product.cost_source = manual` | `NO_COST_UPDATE` | Log. Do not change cost. |
| 2 | `COST-002` | `product.cost_source = purchase_invoice` | `UPDATE_COST_FROM_INVOICE` | CostEngine.updateFromGoodsReceipt() |
| 3 | `COST-003` | `product.cost_source = recipe` | `NO_COST_UPDATE` | Log. Cost comes from recipe only. |
| 4 | `COST-004` | `product.cost_source = hybrid` | `UPDATE_PURCHASE_COST` | CostEngine.updateHybridPurchaseCost() |
| *(always)* | `PROC-001` | Goods received → net requirement decreases | `RECALCULATE_QUEUE` | ProcurementQueueService.recalculate(product_id) |

---

### 3.4 Rules for RECIPE_UPDATED

| Priority | Rule ID | Condition | Decision | Action |
|----------|---------|-----------|----------|--------|
| 1 | `COST-005` | `product.cost_source = recipe` | `RECALCULATE_RECIPE_COST` | CostEngine.recalculateFromRecipe(product_id) |
| 2 | `COST-006` | `product.cost_source = hybrid` | `RECALCULATE_HYBRID_RECIPE_COST` | CostEngine.recalculateHybridRecipeCost() |
| 3 | `COST-007` | Parent products reference this product as component | `CASCADE_COST_RECALCULATION` | CostEngine.cascadeRecipeCost(product_id) |
| *(always)* | `LOG-001` | Recipe version changed | `LOG_VERSION_CHANGE` | Log DecisionLog with old/new version |

---

### 3.5 Rules for PROCUREMENT_SCHEDULER_TRIGGERED

| Priority | Rule ID | Condition | Decision | Action |
|----------|---------|-----------|----------|--------|
| 1 | `PROC-010` | Scheduler already running for this company | `SKIP_CONCURRENT_RUN` | Log, abort new run |
| 2 | `PROC-011` | Net requirement = 0 for all products | `SCHEDULER_RUN_NO_ACTION` | Log run, create SchedulerRun record, no PRs |
| 3 | `PROC-012` | Net requirement > 0 for at least one product | `GENERATE_PURCHASE_REQUESTS` | Execute ProcurementSchedulerService |

---

## 4. DecisionLog

### 4.1 Schema

Every decision is recorded immutably. No updates. No deletes.

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique decision identifier |
| `decision_key` | VARCHAR(256) UNIQUE NULL | **Idempotency key (RC-6).** Format: `{event_type}:{trigger_source_type}:{trigger_source_id}:{subject_type}:{subject_id}`. Prevents duplicate execution of the same decision. NULL for internal/system decisions with no external trigger. |
| `trigger_version` | INTEGER DEFAULT 1 | Incremented each time this key is intentionally retried (new attempt, same business operation). Different from `retry_of` — retry_of links rows, trigger_version tracks attempt number. |
| `event_type` | VARCHAR(50) | See Event Catalog — `ORDER_PREPARING`, `INVENTORY_RETURN`, `GOODS_RECEIPT_POSTED`, `RECIPE_UPDATED`, `PROCUREMENT_SCHEDULER_TRIGGERED` |
| `rule_id` | VARCHAR(20) | Rule that fired — e.g. `MFG-006`, `DIS-001`, `COST-002`, `PROC-012` |
| `trigger_source_type` | VARCHAR(30) | `order` / `inventory_return` / `goods_receipt` / `recipe` / `scheduler` / `system` |
| `trigger_source_id` | UUID | The ID of the triggering document/entity |
| `subject_type` | VARCHAR(30) | What the decision is about: `product`, `order_line`, `scheduler_run` |
| `subject_id` | UUID | The product_id, order_line_id, etc. |
| `decision` | VARCHAR(60) | The decision code — e.g. `MANUFACTURE`, `FAIL_NO_RECIPE`, `SKIP_STOCK_SUFFICIENT` |
| `reason` | Text | Human-readable explanation |
| `outcome` | VARCHAR(20) | `executed` / `skipped` / `failed` / `pending` |
| `execution_type` | VARCHAR(40) NULL | `manufacturing_transaction` / `disassembly_transaction` — type of the executed record |
| `execution_id` | UUID NULL | ID of the ManufacturingTransaction or DisassemblyTransaction if executed |
| `metadata` | JSONB NULL | Context-specific typed payload — see §4.4 for schema per event type |
| `actor_id` | UUID NULL | `null` = system-initiated. User UUID if user-triggered. |
| `decided_at` | TIMESTAMPTZ | When the decision was logged (BEFORE action execution) |
| `executed_at` | TIMESTAMPTZ NULL | When the action completed (after execution) |
| `error_message` | Text NULL | Set if outcome = `failed` |
| `retry_of` | UUID NULL | If this is a retry, references the original DecisionLog ID |

### 4.2 Append-Only Guarantee

The DecisionLog table must have NO update or delete permissions for application-level database users. Only INSERT is allowed. This is enforced at the database level (REVOKE UPDATE, DELETE FROM app_user).

**Exception — execution_id backfill:** After a manufacturing or disassembly transaction completes, the `execution_id` and `execution_type` on the corresponding decision_log row must be set. This is the only permitted update. Enforce via a dedicated DB procedure if strict immutability is required; otherwise enforce at the application layer by only allowing updates to rows WHERE `execution_id IS NULL`.

### 4.3 Idempotency Enforcement (RC-6)

Before processing any event, the Decision Engine checks for an existing decision with the same `decision_key`:

```
processEvent(event):
  decision_key = buildKey(event.type, event.trigger_source_type,
                           event.trigger_source_id, event.subject_type,
                           event.subject_id)
  
  existing = DecisionLog.findByKey(decision_key)
  
  if existing AND existing.outcome IN ('executed', 'skipped'):
    return existing  // Idempotent — already processed, skip silently
  
  if existing AND existing.outcome = 'failed':
    // This is a retry. Create new entry with trigger_version = existing.trigger_version + 1
    // retry_of = existing.id
  
  // Proceed with evaluation and execution
```

### 4.4 Metadata Schema per Event Type

The `metadata` JSONB field is formally typed per event type:

**ORDER_PREPARING + MANUFACTURE/MANUFACTURE_WITH_SHORTAGE:**
```json
{
  "order_quantity": 10,
  "available_finished_qty": 7,
  "shortage_qty": 3,
  "recipe_version": 3,
  "raw_material_requirements": [
    { "product_id": "uuid", "required_qty": 1.5, "available_qty": 2.0 }
  ],
  "manufacturing_cost_estimate": 24.50
}
```

**INVENTORY_RETURN + DISASSEMBLE:**
```json
{
  "return_source_type": "customer_return",
  "quantity_returned": 3,
  "recipe_version": 2,
  "expected_recoveries": [
    { "product_id": "uuid", "expected_qty": 1.5 }
  ]
}
```

**GOODS_RECEIPT_POSTED + UPDATE_COST_FROM_INVOICE:**
```json
{
  "goods_receipt_id": "uuid",
  "previous_cost": 10.50,
  "new_cost": 11.25,
  "landed_unit_cost": 11.25
}
```

**PROCUREMENT_SCHEDULER_TRIGGERED + GENERATE_PURCHASE_REQUESTS:**
```json
{
  "products_with_requirement": 5,
  "total_net_requirement_value": 1250.00,
  "scheduler_run_id": "uuid"
}
```

### 4.2 Append-Only Guarantee

The DecisionLog table must have NO update or delete permissions for application-level database users. Only INSERT is allowed. This is enforced at the database level.

### 4.3 Example Entries

**Successful Manufacturing:**
```json
{
  "event_type": "ORDER_PREPARING",
  "rule_id": "MFG-004",
  "trigger_source_type": "order",
  "trigger_source_id": "order-uuid-1042",
  "subject_type": "order_line",
  "subject_id": "line-uuid-abc",
  "decision": "MANUFACTURE",
  "reason": "Recipe found, all raw materials available",
  "outcome": "executed",
  "execution_id": "mfg-txn-uuid-xyz",
  "metadata": {
    "product_id": "product-uuid-honey",
    "quantity": 5,
    "recipe_version": 3,
    "manufacturing_cost": 24.50
  }
}
```

**Manufacturing Blocked — No Recipe:**
```json
{
  "event_type": "ORDER_PREPARING",
  "rule_id": "MFG-002",
  "trigger_source_type": "order",
  "trigger_source_id": "order-uuid-1043",
  "subject_type": "product",
  "subject_id": "product-uuid-widget",
  "decision": "FAIL_NO_RECIPE",
  "reason": "Product is configured for manufacturing (can_manufacture=true) but no active recipe found",
  "outcome": "failed",
  "execution_id": null,
  "metadata": {
    "product_id": "product-uuid-widget",
    "quantity": 2
  }
}
```

**Disassembly Skipped — Disabled:**
```json
{
  "event_type": "ORDER_RETURNED",
  "rule_id": "DIS-001",
  "trigger_source_type": "return",
  "trigger_source_id": "return-uuid-abc",
  "subject_type": "product",
  "subject_id": "product-uuid-raw-item",
  "decision": "SKIP_DISASSEMBLY_DISABLED",
  "reason": "Product has can_disassemble=false. Returned to finished goods inventory.",
  "outcome": "skipped",
  "metadata": { "quantity": 1 }
}
```

---

## 5. Decision Priority

When multiple rules could apply, the **lowest priority number** wins. Rules are evaluated top-to-bottom in the priority order defined in Section 3.

**Priority tiebreaker:** If two rules share the same priority (should not occur by design), the more restrictive rule takes precedence (the one that blocks action over the one that allows it).

---

## 6. Decision Retry

### 6.1 When Retry Is Allowed

| Decision | Retryable? | Reason |
|----------|-----------|--------|
| `MANUFACTURE` (failed mid-execution) | Yes — manual trigger | Execution failure may be transient |
| `FAIL_NO_RECIPE` | No — until recipe is created | Nothing to retry |
| `FAIL_STOCK_SHORTAGE` | Yes — after procurement | After goods received, can re-trigger |
| `DISASSEMBLE` (failed mid-execution) | Yes — manual trigger | |
| `FAIL_RECIPE_INACTIVE` | No — until recipe is reactivated | |

### 6.2 Retry Mechanics

A retry creates a **new DecisionLog entry** with `retry_of = original_decision_log_id`. The original log is never modified.

```
retryDecision(original_decision_log_id):
  original = DecisionLog.find(original_decision_log_id)
  
  if original.outcome not in ['failed', 'pending']:
    return ERROR: "Only failed or pending decisions can be retried"
  
  // Re-evaluate the rule with current state
  new_decision = evaluateRule(original.rule_id, current_state)
  
  new_log = DecisionLog.create({
    ...new_decision,
    retry_of: original.id
  })
  
  if new_decision.action != null:
    execute(new_decision.action, new_log)
```

### 6.3 No Automatic Retry

The Decision Engine does **not** automatically retry failed decisions. All retries are:
- Manual (user-initiated from the Operations dashboard) — Phase 2 UI
- Triggered by a system event that changes the conditions (e.g., goods received → retry manufacturing)

---

## 7. Decision Failure Handling

### 7.1 Failure Types

| Type | Description | Response |
|------|-------------|----------|
| Rule evaluation failure | Exception thrown during rule evaluation | Log `SYSTEM_ERROR`, notify admin. Do NOT take action. |
| Action execution failure | Exception during manufacturing/disassembly | Log outcome = `failed`, set `error_message`. |
| Partial execution failure | e.g., consumed some materials but failed to produce output | Roll back all inventory movements. Log as failed. |
| Unknown event type | Event type not in catalog | Log `UNKNOWN_EVENT_TYPE`, discard event. |

### 7.2 Non-Blocking Failure

A decision failure **never blocks the originating module**. Specifically:
- Manufacturing failure does NOT prevent an order from progressing to the next status.
- Disassembly failure does NOT prevent a return from being recorded.
- A failed decision is visible in the DecisionLog and the Operations dashboard.

### 7.3 Failure Cascade Prevention

If a manufacturing execution fails midway (e.g., materials consumed but product not produced):
1. Roll back all inventory movements via database transaction.
2. Log DecisionLog with outcome = `failed`.
3. Do NOT add to procurement queue automatically (the shortfall was not confirmed).
4. Alert operations team.

---

## 8. Decision Sequence — ORDER_PREPARING

```
WooCommerce                Orders BC              Decision Engine            Recipe Engine
    │                          │                        │                        │
    │  Order #1042 → Preparing │                        │                        │
    │─────────────────────────▶│                        │                        │
    │                          │                        │                        │
    │                          │  ORDER_PREPARING event │                        │
    │                          │  {order_id, items[]}   │                        │
    │                          │───────────────────────▶│                        │
    │                          │                        │                        │
    │                          │          For each line item:                    │
    │                          │                        │  resolveRecipe()       │
    │                          │                        │───────────────────────▶│
    │                          │                        │                        │
    │                          │                        │◀─── Recipe or null ────│
    │                          │                        │                        │
    │                          │                        │  evaluateRule()        │
    │                          │                        │  → Decision: MANUFACTURE│
    │                          │                        │                        │
    │                          │                        │  log(MANUFACTURE, pending)
    │                          │                        │                        │
    │                          │                        │  ManufacturingService.execute()
    │                          │                        │         │              │
    │                          │                        │         │ consumeRaw() │
    │                          │                        │         │──────────────┤
    │                          │                        │         │ addFinished()│
    │                          │                        │         │──────────────┤
    │                          │                        │         │ updateCost() │
    │                          │                        │         │──────────────┤
    │                          │                        │         │              │
    │                          │                        │  update log(executed)  │
    │                          │                        │                        │
```

---

## 9. Complete Decision Matrix

| # | Event | Rule | Condition | Decision | Action | Outcome |
|---|-------|------|-----------|----------|--------|---------|
| 1 | ORDER_PREPARING | MFG-001 | `can_manufacture = false` | SKIP_NOT_MANUFACTURABLE | Log (skipped) | No manufacturing |
| 2 | ORDER_PREPARING | MFG-002 | `can_manufacture = true`, recipe = null | FAIL_NO_RECIPE | Log (failed) — visible in Ops Dashboard | Manufacturing blocked |
| 3 | ORDER_PREPARING | MFG-003 | Recipe exists, `is_active = false` | FAIL_RECIPE_INACTIVE | Log (failed) — visible in Ops Dashboard | Manufacturing blocked |
| 4 | ORDER_PREPARING | MFG-005 | Recipe valid, available_finished ≥ ordered_qty | SKIP_STOCK_SUFFICIENT | Log (skipped). No manufacturing. | Existing stock satisfies demand |
| 5 | ORDER_PREPARING | MFG-006 | Recipe valid, shortage_qty > 0, raw materials sufficient | MANUFACTURE | Execute ManufacturingService(shortage_qty) | Finished goods +shortage_qty, raw stock - |
| 6 | ORDER_PREPARING | MFG-007 | Recipe valid, shortage_qty > 0, raw shortfall, raw `allow_negative = true` | MANUFACTURE_WITH_SHORTAGE | Execute(shortage_qty) + add shortfall to queue | Finished goods +shortage_qty, raw stock goes negative |
| 7 | ORDER_PREPARING | MFG-008 | Recipe valid, shortage_qty > 0, raw shortfall, raw `allow_negative = false` | FAIL_STOCK_SHORTAGE | Log (failed). Add shortfall to queue. | Manufacturing blocked |
| 8 | INVENTORY_RETURN | DIS-001 | `can_disassemble = false` | SKIP_DISASSEMBLY_DISABLED | Receive to finished goods | No disassembly |
| 9 | INVENTORY_RETURN | DIS-002 | `can_disassemble = true`, recipe = null | SKIP_NO_RECIPE | Receive to finished goods | No disassembly |
| 10 | INVENTORY_RETURN | DIS-003 | `can_disassemble = true`, recipe inactive | SKIP_RECIPE_INACTIVE | Receive to finished goods | No disassembly |
| 11 | INVENTORY_RETURN | DIS-004 | All conditions met | DISASSEMBLE | Execute disassembly. Queue updated post-commit. | Raw materials +, finished goods - |
| 12 | GOODS_RECEIPT_POSTED | COST-001 | `cost_source = manual` | NO_COST_UPDATE | Log | No cost change |
| 13 | GOODS_RECEIPT_POSTED | COST-002 | `cost_source = purchase_invoice` | UPDATE_COST_FROM_INVOICE | Update current_cost | Cost history entry created |
| 14 | GOODS_RECEIPT_POSTED | COST-003 | `cost_source = recipe` | NO_COST_UPDATE | Log | No cost change |
| 15 | GOODS_RECEIPT_POSTED | COST-004 | `cost_source = hybrid` | UPDATE_COST_FROM_INVOICE | Update current_cost (purchase source wins for this update) | Cost history entry created (cost_source = 'purchase_invoice') |
| 16 | GOODS_RECEIPT_POSTED | PROC-001 | Always (after cost rules) | RECALCULATE_QUEUE | ProcurementQueue.recalculate() — no-op if product not in queue | Queue updated or unchanged |
| 17 | RECIPE_UPDATED | COST-005 | `cost_source = recipe` | RECALCULATE_RECIPE_COST | Recalculate from recipe | Cost updated |
| 18 | RECIPE_UPDATED | COST-006 | `cost_source = hybrid` | RECALCULATE_RECIPE_COST | Recalculate from recipe (recipe source wins for this update) | Cost history entry created (cost_source = 'recipe') |
| 19 | RECIPE_UPDATED | COST-007 | Parent products use this as component | CASCADE_COST (queued) | Dispatch CostCascadeJob per parent product | Parent costs updated asynchronously |
| 20 | RECIPE_UPDATED | LOG-001 | Always | LOG_VERSION_CHANGE | Log version increment | Audit trail |
| 21 | PROCUREMENT_SCHEDULER_TRIGGERED | PROC-010 | Scheduler already running | SKIP_CONCURRENT_RUN | Log, abort | No duplicate run |
| 22 | PROCUREMENT_SCHEDULER_TRIGGERED | PROC-011 | Net requirement = 0 for all products | SCHEDULER_RUN_NO_ACTION | Log run record | No purchase requests |
| 23 | PROCUREMENT_SCHEDULER_TRIGGERED | PROC-012 | Net requirement > 0 for ≥1 product | GENERATE_PURCHASE_REQUESTS | Run ProcurementSchedulerService | Purchase requests created |
| 24 | MANUFACTURING_FAILED | AUTO | Raw shortfall confirmed post-execution | UPDATE_PROCUREMENT_QUEUE | Add shortfall to queue (post-commit) | Queue updated |

---

## 10. Decision Engine Constraints

| Constraint | Value |
|-----------|-------|
| Maximum concurrent decisions per order | 1 per line item (evaluated sequentially) |
| Decision log retention | Forever (append-only, never deleted) |
| Maximum retry attempts | 3 (then requires manual intervention) |
| Event processing guarantee | At-least-once (idempotency key on event_id) |
| Decision evaluation timeout | 5 seconds |
| Action execution timeout | 30 seconds (manufacturing) |
