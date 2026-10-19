# ECOS ERP — Manufacturing & Procurement Functional Specification

**Document:** MANUFACTURING-PROCUREMENT-SPEC  
**Version:** 1.0  
**Task:** TASK-MFG-SPEC-001  
**Status:** Draft — Awaiting Approval  
**Date:** 2026-06-29  
**Author:** Architecture Team  
**Scope:** Complete Manufacturing & Procurement domain specification for ECOS ERP

**Related Specifications:**
- [RECIPE-ENGINE-SPEC.md](RECIPE-ENGINE-SPEC.md) — Recipe Engine
- [DECISION-ENGINE-SPEC.md](DECISION-ENGINE-SPEC.md) — Decision Engine
- [PROCUREMENT-INTELLIGENCE-SPEC.md](PROCUREMENT-INTELLIGENCE-SPEC.md) — Procurement Intelligence

---

## Chapter 1 — Business Vision

### 1.1 Why Demand Driven Manufacturing

ECOS ERP serves manufacturing-driven e-commerce businesses. Orders arrive continuously from WooCommerce stores — often dozens to hundreds per day — and many orders require products that must be manufactured before they can be shipped.

Traditional ERP systems place this burden on the operations team: an order arrives, a user reviews it, creates a production order, picks materials, and records completion. In high-volume e-commerce, this manual loop cannot scale. A team that can manually process 50 production orders per day is overwhelmed at 200.

**Demand Driven Manufacturing** means customer demand automatically triggers manufacturing. When an order reaches the "Preparing" state, the system reads the required product's recipe, checks inventory, consumes raw materials, and produces the finished product — without any human intervention for standard cases.

The operations team's role shifts from **execution** to **exception handling**.

### 1.2 Why Manufacturing is Automatic

Manufacturing automation in ECOS ERP is justified by three realities of e-commerce operations:

1. **Volume** — E-commerce operations may have hundreds of orders per day, each potentially requiring manufactured products. Manual production orders are not feasible at scale.

2. **Recipe determinism** — Manufacturing a product is deterministic: given a recipe and raw materials, the outcome is always the same. There is no judgment required in execution — only exception handling when something goes wrong.

3. **Speed** — E-commerce customers expect rapid fulfillment. Every hour spent waiting for a production order to be approved and executed is time the customer is waiting for their shipment.

Manufacturing is a **background domain service** in ECOS ERP — not a visible module. Users see results (inventory levels, order status, manufacturing transaction logs) but are never asked to initiate or approve routine manufacturing.

### 1.3 Why the Decision Engine Exists

Before ECOS ERP had a Decision Engine, each module handled its own downstream effects directly. The Orders module called the Inventory module. The Inventory module called the Purchasing module. This created tight coupling and made it impossible to answer the question: *"Why did the system take this action?"*

The Decision Engine solves three problems:

1. **Routing** — Business events (order status changes, returns, recipe updates) are routed to the correct downstream services through a single, auditable gateway.

2. **Traceability** — Every action taken by the system is the result of a logged decision. An operator can trace any inventory movement, cost change, or purchase request back to the exact event and rule that triggered it.

3. **Extensibility** — Adding new behaviors (e.g., AI-driven decisions, voice-triggered actions, multi-step workflows) requires only adding new rules to the Decision Engine, not modifying existing modules.

### 1.4 Why Procurement is Intelligent

Traditional ERP procurement is reactive and order-centric:
- Order #1042 needs 2 Kg Raw Honey → create Purchase Request #PR-001 for 2 Kg
- Order #1043 needs 3 Kg Raw Honey → create Purchase Request #PR-002 for 3 Kg
- Order #1044 needs 1 Kg Raw Honey → create Purchase Request #PR-003 for 1 Kg

The purchasing team now has 3 separate requests to review, potentially to the same supplier, covering the same product. Meanwhile, a goods receipt may have arrived that satisfies all three. The team wastes time reviewing stale requests.

**Intelligent Procurement** means the system:
1. Maintains a live net requirement — one entry per product, continuously updated
2. Runs full recalculation at scheduled intervals before generating any document
3. Produces one consolidated Purchase Request per product (not per order)
4. Never generates a request if the requirement is already met

The purchasing team reviews fewer, more meaningful documents. The system handles the aggregation.

### 1.5 Why Manufacturing is Not a Visible Module

Manufacturing in ECOS ERP is a **consequence** of other actions, not an action itself. Users do not "go to Manufacturing" to do things. Instead:
- Orders team marks an order as "Preparing" → manufacturing happens automatically
- Returns team processes a return → disassembly happens automatically
- Operations team views manufacturing logs → they see what the system did and why

Making manufacturing a visible module would imply that users need to interact with it to initiate production. This contradicts the Demand Driven principle and would introduce the exact manual step we are designed to eliminate.

---

## Chapter 2 — Product Rules

### 2.1 The Unified Product Model

ECOS ERP has **one Product entity**. There are no separate entities for:
- Raw Materials
- Finished Goods
- Semi-Finished Products
- Intermediate Products
- Packaging Materials

Everything is a Product. The distinction between a raw material and a finished good is a **classification label** only — it has no effect on business logic.

**What drives behavior is product capabilities (flags), not product type.**

### 2.2 Product Classification (Label Only)

The `product_type` field (`finished_good` / `raw_material`) exists as an organizational label to help users find and filter products. It has **zero business logic implications**.

Examples of why classification is irrelevant to behavior:
- A "raw material" product can be manufactured if `can_manufacture = true`
- A "finished good" can be a component in another product's recipe
- A product classified as "raw material" can have its own recipe

**Rule:** Never use `product_type` in any business logic condition. All logic conditions use the behavioral flags defined in §2.3.

### 2.3 Product Behavioral Flags

These flags control what the system can do with a product.

#### `can_manufacture` (Boolean, default: false)

When `true`: The system will attempt to automatically manufacture this product when it is ordered and the Preparing trigger fires.

**Rules:**
- Setting `can_manufacture = true` requires a recipe to exist, OR the user must be creating the recipe concurrently.
- Setting `can_manufacture = false` does not delete the recipe — it only prevents manufacturing from being triggered.
- If `can_manufacture = true` and no recipe exists: manufacturing fails with `FAIL_NO_RECIPE`.

#### `can_disassemble` (Boolean, default: false)

When `true`: The system will automatically disassemble this product when it is returned by a customer.

**Rules:**
- `can_disassemble = true` requires a recipe to exist.
- If `can_disassemble = true` and no recipe: disassembly is skipped, product returned to finished goods.
- Disassembly uses the same recipe as manufacturing, in reverse.
- Setting this flag to `false` does not affect existing manufacturing capability.

#### `allow_negative_stock` (Boolean, default: false)

Controls whether a product's stock level is permitted to fall below zero during a consumption operation.

This flag is **always evaluated on the product being consumed** (the raw material), not on the product being produced (the finished good). Finished goods are never produced into negative inventory — the system only ever manufactures the quantity that is short.

| Value | Behavior during raw material consumption |
|-------|------------------------------------------|
| `true` | Consumption proceeds even if stock goes negative. Shortfall added to Procurement Queue. |
| `false` | Consumption that would go negative is blocked. Shortfall added to Procurement Queue. Manufacturing of the portion requiring this material is blocked. |

**Rule:** `allow_negative_stock` is checked per raw material, per recipe line, at consumption time. All raw materials in a recipe are checked independently. If any material blocks (flag=false, would go negative), manufacturing is blocked only for the units that require that material.

### 2.4 Unit

**Rules:**
- Every product must have a unit. A product cannot be created without a unit.
- The unit cannot be changed after the first inventory transaction (purchase receipt, sale, manufacturing, or adjustment).
- The unit is used uniformly across: Recipe, Inventory, Purchasing, Manufacturing, and Costing.
- Inside a Recipe, component units are **inherited** from the component product's unit and cannot be overridden.

### 2.5 Cost Source

Each product has a configurable cost source. See Chapter 3 for full Cost Rules.

| Cost Source | When to Use |
|------------|-------------|
| `manual` | Fixed-cost products. Cost does not change without explicit user action. |
| `purchase_invoice` | Products always purchased. Cost updated from every Goods Receipt. |
| `recipe` | Manufactured products. Cost calculated from recipe components. |
| `hybrid` | Products that can be both purchased and manufactured. Tracks both cost types. |

### 2.6 Supplier Relationship

- A product may have zero or more suppliers.
- A "default supplier" is designated for use in Purchase Request suggestions.
- No supplier is required to create a product.
- Purchase Requests can be created without a supplier (flag as `needs_supplier`).

### 2.7 Recipe Relationship

- A product can have **at most one** active Recipe.
- A Recipe can only be created if `can_manufacture = true`.
- The Recipe is optional — a product with `can_manufacture = true` and no recipe will fail manufacturing with `FAIL_NO_RECIPE`.
- See [RECIPE-ENGINE-SPEC.md](RECIPE-ENGINE-SPEC.md) for complete Recipe rules.

### 2.8 Product Rules Summary

| Rule | Enforcement |
|------|-------------|
| One product entity — no subtypes with separate tables | Architecture |
| `product_type` is classification only — no logic | Code review |
| Unit is required | Validation |
| Unit cannot change after first transaction | Business rule |
| At most one active recipe per product | Database constraint |
| `can_disassemble` requires a recipe | Validation on flag update |
| `product_type` never used in if/else logic | Code review |

---

## Chapter 3 — Cost Rules

### 3.1 Cost Sources

#### Manual Cost

**Definition:** The cost is set by a user and does not change automatically.

**Update trigger:** User explicitly sets the cost (manual action only).

**Use case:** Products with fixed or contract pricing that does not vary with purchase price or recipe.

**Behavior on Goods Receipt:** No update. `current_cost` is unchanged.  
**Behavior on Manufacturing Complete:** No update. `current_cost` is unchanged.  
**Behavior on Recipe Update:** No update. `current_cost` is unchanged.

---

#### Purchase Invoice Cost (Goods Receipt)

**Definition:** The cost is updated automatically every time a Goods Receipt is posted for this product.

**Update trigger:** Goods Receipt posted → line landed_unit_cost → new current_cost.

**Use case:** Raw materials and purchased products where cost varies per purchase.

**Behavior on Goods Receipt:** `current_cost = GoodsReceiptLine.landed_unit_cost` (most recent receipt).  
**Behavior on Manufacturing Complete:** No update.  
**Behavior on Recipe Update:** No update.

**Important:** This cost source uses the **landed unit cost** from the Goods Receipt, which includes freight, tax, and additional costs distributed to the line level by the existing Goods Receipt landing cost calculation.

---

#### Recipe Cost

**Definition:** The cost is automatically calculated from the product's recipe components.

**Formula:** `current_cost = SUM(component.quantity × component.current_cost)` per output unit.

**Update trigger:** Any of the following:
- Recipe is saved (version incremented)
- Any component product's `current_cost` changes

**Use case:** Manufactured products where cost is determined by component costs.

**Behavior on Goods Receipt:** No direct update. If the received product is a component in this product's recipe, the component's cost update cascades to this product.  
**Behavior on Manufacturing Complete:** Recalculate from recipe.  
**Behavior on Recipe Update:** Recalculate from new recipe.

---

#### Hybrid Cost

**Definition:** The product can be both purchased and manufactured. The `hybrid` cost source is a **runtime strategy**: it accepts cost updates from BOTH purchase receipts AND recipe recalculation. `current_cost` always reflects the most recently applied update, regardless of which source produced it.

**No additional columns required.** The `product_cost_histories` table captures every cost change with its `cost_source` value (`purchase_invoice` or `recipe`). The Cost Engine simply applies each update as it arrives — the most recent one wins.

**Update trigger:**
- Goods Receipt posted → Cost Engine applies the landed_unit_cost (same as `purchase_invoice` source)
- Recipe updated or component cost changed → Cost Engine recalculates and applies the recipe cost
- `current_cost` is updated by whichever event occurred most recently

**Use case:** Products that are sometimes bought (bulk periods) and sometimes manufactured (peak periods). The team does not need to manually switch between cost modes — both sources feed the same `current_cost` field.

**Cost History:** Both purchase and recipe updates write to `product_cost_histories` with their respective `cost_source` values. This creates a complete audit trail showing every cost change and its origin.

---

### 3.2 Current Cost

`current_cost` is the product's effective cost at any moment in time. It is used:
- In Recipe cost calculation (when this product is a component)
- In Manufacturing cost calculation (consumed materials)
- In Procurement Queue value estimates

### 3.3 Cost History

Every change to `current_cost` creates an immutable CostHistoryEntry.

| Field | Description |
|-------|-------------|
| `product_id` | Which product |
| `previous_cost` | Cost before the change |
| `new_cost` | New cost after the change |
| `cost_source` | Which source triggered the update |
| `source_document_type` | `goods_receipt` / `manufacturing_transaction` / `recipe_update` / `manual` |
| `source_document_id` | ID of the triggering document |
| `changed_at` | Timestamp of the change |
| `changed_by` | `user_id` or `'system'` |

**Rules:**
- CostHistory is append-only. No updates. No deletes.
- Historical inventory transactions are NEVER retroactively recalculated when cost changes.
- A cost change only affects future transactions.

### 3.4 Cost Traceability

Any inventory movement (manufacturing consumption, sales issue, goods receipt) stores the cost at the time of the movement. This creates a complete cost chain:

```
Goods Receipt → landed_unit_cost → current_cost
Manufacturing Consumption → component.current_cost at execution time
Manufacturing Transaction → stores manufacturing_cost (immutable)
Sales Issue → FIFO layer cost at time of consumption
```

---

## Chapter 4 — Recipe Rules

Full specification: [RECIPE-ENGINE-SPEC.md](RECIPE-ENGINE-SPEC.md)

**Summary of key rules:**

| Rule | Detail |
|------|--------|
| One recipe per product | Enforced by unique constraint |
| One output per recipe | No by-products |
| Quantity only | No percentages, no waste factors |
| Unit inherited | RecipeItem unit = component product unit |
| Versioned on save | `version` increments every time recipe is saved |
| Immutable transaction snapshots | Past transactions reference their recipe version |
| No retroactive recalculation | Recipe changes don't affect past transactions |
| Disassembly = reverse recipe | No separate disassembly recipe |
| No cyclic dependencies | Enforced at save time |

---

## Chapter 5 — Automatic Manufacturing Rules

### 5.1 Trigger

Manufacturing is triggered when an order's status transitions to **`preparing`**.

The Decision Engine receives an `ORDER_PREPARING` event and evaluates each line item.

**Note:** The `preparing` status must be added to the Orders module's status enum. Currently, the Orders module has: `pending`, `processing`, `completed`, `cancelled`. The `preparing` status (between `processing` and `completed`) represents the fulfillment/manufacturing phase. This is a prerequisite for the manufacturing trigger to function.

### 5.2 Decision Flow

For each line item in the order, the Decision Engine evaluates rules in strict priority order. The first matching rule wins. All rules apply per line item independently.

```
1. Load Product for the order line's product_id

   RULE MFG-001: If product.can_manufacture = false:
   → Decision: SKIP_NOT_MANUFACTURABLE
   → Continue to next line item (no manufacturing, no log for routine skips)

2. Load Recipe for product_id (active recipe only)

   RULE MFG-002: If recipe = null:
   → Decision: FAIL_NO_RECIPE
   → Log DecisionLog (outcome = failed)
   → Continue to next line item (order not blocked)

   RULE MFG-003: If recipe.is_active = false:
   → Decision: FAIL_RECIPE_INACTIVE
   → Log DecisionLog (outcome = failed)
   → Continue to next line item

3. Validate recipe (units, components, no cycles)

   RULE MFG-004 [implicit]: If recipe validation fails at execution time:
   → Decision: FAIL_RECIPE_INVALID
   → Log DecisionLog (outcome = failed)
   → Continue to next line item

4. Check finished goods availability (RC-1: manufacture only the shortage)

   available_finished = InventoryEngine.availableStock(
       product_id   = order_line.product_id,
       warehouse_id = order.warehouse_id
   )
   shortage_qty = max(0, order_line.quantity - available_finished)

   RULE MFG-005: If shortage_qty = 0:
   → Decision: SKIP_STOCK_SUFFICIENT
   → Log DecisionLog (outcome = skipped)
   → Existing reservation satisfies demand. No manufacturing needed.
   → Continue to next line item

   // shortage_qty > 0: we need to manufacture exactly shortage_qty units.
   // Finished goods are NEVER produced into negative inventory.
   // We manufacture only the units that are not already in stock.

5. For each RecipeItem (checking raw material availability for shortage_qty only):

   For each item in recipe.items:
     required_raw = item.quantity × shortage_qty          // not full order_qty
     available_raw = InventoryEngine.availableStock(item.product_id, warehouse_id)
     raw_shortfall = max(0, required_raw - available_raw)

   RULE MFG-006: If no raw_shortfall for any ingredient:
   → Decision: MANUFACTURE
   → Execute manufacturing of shortage_qty units (§5.3)

   RULE MFG-007: If raw_shortfall exists for ANY ingredient
                 AND that ingredient's allow_negative_stock = true:
   → Decision: MANUFACTURE_WITH_SHORTAGE
   → Execute manufacturing of shortage_qty units (§5.3)
   → Raw material stock for that ingredient goes negative
   → Add raw shortfall to Procurement Queue

   RULE MFG-008: If raw_shortfall exists for ANY ingredient
                 AND that ingredient's allow_negative_stock = false:
   → Decision: FAIL_STOCK_SHORTAGE
   → Log DecisionLog (outcome = failed)
   → Add raw shortfall to Procurement Queue
   → Do NOT execute manufacturing
```

**Key invariants of this flow:**
- Manufacturing quantity is always `shortage_qty` — never the full `order_line.quantity` when finished goods are already in stock.
- The `allow_negative_stock` flag is evaluated on the **raw material** (ingredient), never on the finished product.
- Finished goods never go negative — if `shortage_qty = 0`, manufacturing is skipped entirely.
- Multiple raw material shortfalls are evaluated independently. If ingredient A blocks (flag=false) but ingredient B allows negative (flag=true), the entire manufacturing run is blocked by A.

### 5.3 Manufacturing Execution

Executed as a single atomic database transaction. All steps succeed or all are rolled back. The `quantity_to_produce` is always `shortage_qty` from the Decision Flow (§5.2), never the full `order_line.quantity` when finished goods are already partially available.

**Execution Model (RC-7):** From the business perspective, manufacturing is synchronous — the order workflow does not advance past `preparing` until manufacturing completes. At the implementation level, this is dispatched as a Laravel Queue Job (`ManufacturingJob`) that executes immediately via a dedicated queue worker. The caller waits for job completion via a callback or polling the `inventory_manufacturing_at` timestamp on the order. The user never observes partial manufacturing.

```
ManufacturingService.execute(order_line, recipe, shortage_qty, decision_log_id):

  BEGIN TRANSACTION

  1. Create ManufacturingTransaction (status = processing)
     Fields: order_id, order_line_id, product_id, bom_id, bom_version_number,
             quantity_produced = shortage_qty, decision_log_id
     Idempotency: UNIQUE (order_line_id) WHERE status != 'failed'
     If a completed transaction already exists for this order_line_id → abort, return existing.

  2. For each RecipeItem:
     a. consumed_qty = item.quantity × shortage_qty   // proportional to shortage only
     b. fifo_layers = InventoryEngine.selectFIFOLayers(
          product_id   = item.product_id,
          warehouse_id = order.warehouse_id,
          quantity     = consumed_qty
        )
     c. For each FIFO layer consumed:
          InventoryEngine.consumeFromLayer(
            layer        = fifo_layer,
            quantity     = layer_consumed_qty,
            movement     = production_consumption,
            reference_id = manufacturing_transaction.id,
            consumption_type = 'manufacturing'
          )
     d. Record ManufacturingConsumption(
          product_id    = item.product_id,
          quantity      = consumed_qty,
          unit_cost     = FIFO_weighted_avg_cost(fifo_layers),  // RC-3: FIFO cost, not current_cost
          total_cost    = consumed_qty × unit_cost
        )

  3. manufacturing_cost = SUM(all ManufacturingConsumption.total_cost)
     unit_manufacturing_cost = manufacturing_cost / shortage_qty

  4. InventoryEngine.addStock(
       product_id        = order_line.product_id,
       quantity          = shortage_qty,
       warehouse_id      = order.warehouse_id,
       unit_cost         = unit_manufacturing_cost,
       movement          = production_output,
       reference_id      = manufacturing_transaction.id,
       source_type       = 'manufacturing'
     )

  5. Update ManufacturingTransaction(
       status             = completed,
       manufacturing_cost = manufacturing_cost,
       unit_cost          = unit_manufacturing_cost,
       executed_at        = now()
     )

  6. Update DecisionLog(outcome = executed, executed_at = now(),
       execution_type = 'manufacturing_transaction',
       execution_id   = manufacturing_transaction.id)

  7. CostEngineService.onManufacturingCompleted(
       product_id         = order_line.product_id,
       manufacturing_cost = manufacturing_cost,
       quantity           = shortage_qty
     )

  8. Update orders.inventory_manufacturing_at = now()
     (signals to the order lifecycle that manufacturing is complete)

  COMMIT TRANSACTION
```

**FIFO Cost Rule (RC-3):** Step 2d uses the weighted average cost of the actual FIFO layers consumed, not `product.current_cost`. If a component has no FIFO receipt layers (e.g., negative stock scenario), `current_cost` is used as a fallback. The `ManufacturingConsumption.unit_cost` field always reflects the actual cost basis used.

### 5.4 Inventory Movement Types

The existing `LedgerMovementType` already includes `production_consumption` and `production_output`. These are used as the movement types for manufacturing. No new enum values need to be created for the core manufacturing flow.

The following additional movement types are required for disassembly:
- `DISASSEMBLY_CONSUMPTION` — finished product consumed in disassembly
- `DISASSEMBLY_PRODUCTION` — raw material recovered from disassembly

### 5.5 Failure Scenarios

| Failure | Code | Behavior |
|---------|------|----------|
| No recipe | FAIL_NO_RECIPE | Log, skip manufacturing. Order continues. |
| Recipe inactive | FAIL_RECIPE_INACTIVE | Log, skip manufacturing. Order continues. |
| Recipe invalid | FAIL_RECIPE_INVALID | Log, skip manufacturing. Order continues. |
| Insufficient stock, negative disabled | FAIL_STOCK_SHORTAGE | Log, add to queue. Order continues. |
| Mid-execution error | MANUFACTURING_EXECUTION_ERROR | Roll back all movements. Log as failed. Alert ops team. |

**Critical rule:** Manufacturing failure never blocks the order. The order lifecycle continues independently.

---

## Chapter 6 — Automatic Disassembly Rules

### 6.1 Trigger

Disassembly is triggered when inventory is physically received back into the warehouse after being previously sold or consumed. This can originate from multiple sources.

The Decision Engine receives an **`INVENTORY_RETURN`** event (RC-4) and evaluates each returned line item.

**Event Sources:** The `INVENTORY_RETURN` event is a generic domain event. It may be emitted by:
- A Customer Returns module (when a return receipt is confirmed)
- A Warehouse Returns workflow (goods physically returned from a branch)
- A Cancellation Recovery flow (ordered goods cancelled before dispatch)
- Any future return mechanism

**Design principle:** The Disassembly Engine is decoupled from any specific Returns implementation. It does not know whether the return came from a customer, a warehouse, or a cancellation. It only sees the `INVENTORY_RETURN` event with the product, quantity, and destination warehouse. The Returns domain is responsible for defining when goods are "physically received back" and emitting the event at that moment.

### 6.2 Decision Flow

The Decision Engine evaluates rules per returned item from the `INVENTORY_RETURN` event payload.

```
INVENTORY_RETURN event received:
  return_source_type  -- 'customer_return' | 'warehouse_return' | 'cancellation' | etc.
  return_source_id    -- ID of the source document in the originating domain
  items: [
    { product_id, quantity, warehouse_id }
  ]

For each returned item:

1. Load Product for the returned item's product_id

   RULE DIS-001: If product.can_disassemble = false:
   → Decision: SKIP_DISASSEMBLY_DISABLED
   → Receive product to finished goods inventory (standard receipt)
   → Continue to next item

2. Load Recipe for product_id (active recipe only)

   RULE DIS-002: If recipe = null:
   → Decision: SKIP_NO_RECIPE
   → Receive product to finished goods inventory
   → Continue to next item

   RULE DIS-003: If recipe.is_active = false:
   → Decision: SKIP_RECIPE_INACTIVE
   → Receive product to finished goods inventory
   → Continue to next item

   RULE DIS-004: All conditions met:
   → Decision: DISASSEMBLE
   → Execute disassembly (§6.3)
```

### 6.3 Disassembly Execution

The inventory transaction (steps 1-5) and the procurement queue update (step 6) are in **separate transactional scopes**. The procurement queue must never roll back a completed disassembly (RC-8).

```
DisassemblyService.execute(return_event_item, recipe, decision_log_id):

  // ── TRANSACTION BOUNDARY 1: Inventory ─────────────────────────────
  BEGIN TRANSACTION

  1. Create DisassemblyTransaction (status = processing)
     Fields: return_source_type, return_source_id, product_id,
             bom_id, bom_version_number, quantity_disassembled,
             warehouse_id, decision_log_id

  2. InventoryEngine.consumeStock(
       product_id       = return_event_item.product_id,
       quantity         = return_event_item.quantity,
       warehouse_id     = return_event_item.warehouse_id,
       movement         = disassembly_consumption,
       reference_id     = disassembly_transaction.id,
       consumption_type = 'disassembly'
     )

  3. For each RecipeItem:
     recovered_qty = item.quantity × return_event_item.quantity
     InventoryEngine.addStock(
       product_id    = item.product_id,
       quantity      = recovered_qty,
       warehouse_id  = return_event_item.warehouse_id,
       unit_cost     = item.product.current_cost,  // current cost at recovery time
       movement      = disassembly_output,
       reference_id  = disassembly_transaction.id,
       source_type   = 'disassembly_recovery'
     )
     Record DisassemblyRecovery(product_id, recovered_qty, unit_cost = current_cost)

  4. Update DisassemblyTransaction(status = completed, executed_at = now())

  5. Update DecisionLog(outcome = executed, executed_at = now(),
       execution_type = 'disassembly_transaction',
       execution_id   = disassembly_transaction.id)

  COMMIT TRANSACTION
  // ── END TRANSACTION BOUNDARY 1 ────────────────────────────────────

  // ── POST-COMMIT: Queue recalculation (best-effort) ─────────────────
  6. ProcurementQueueService.recalculate(
       affected_product_ids = [item.product_id for item in recipe.items]
     )
     // Recovered materials may reduce procurement needs.
     // If this step fails: log warning only. Disassembly is NOT rolled back.
     // The queue will self-correct on the next scheduler run.
  // ──────────────────────────────────────────────────────────────────
```

### 6.4 Return Scenarios

| Scenario | Behavior |
|---------|----------|
| Full return (all units) | Disassemble all returned units |
| Partial return (some units) | Disassemble only returned units |
| Return of non-manufactured product | No disassembly — receive to finished goods |
| Return after recipe was deactivated | Use the recipe that was active at order time? No — use current active recipe. If no active recipe: skip disassembly. |

### 6.5 Recovery Cost Rule

Recovered raw materials are added to inventory at their **current cost** (at time of recovery), not at their original cost from the manufacturing run. This is a simplification that avoids the need to trace the original FIFO batch.

---

## Chapter 7 — Inventory Rules

### 7.1 Existing Infrastructure

ECOS ERP already has a fully implemented inventory engine:
- `InventoryItem` — per warehouse/product stock record
- `StockMovement` — movement log
- `StockLedgerEntry` (LedgerMovementType) — immutable audit log
- `InventoryReceiptLayer` — FIFO receipt layers
- `InventoryLayerConsumption` — FIFO consumption audit

Manufacturing and Disassembly use this existing infrastructure. No new inventory tables are required.

### 7.2 Manufacturing Inventory Movements

| Step | Movement Type | Direction | What Changes |
|------|--------------|-----------|-------------|
| Consume raw material | `production_consumption` (existing) | OUT | on_hand_qty decreases for each component |
| Add finished product | `production_output` (existing) | IN | on_hand_qty increases for finished product |

### 7.3 Disassembly Inventory Movements

| Step | Movement Type | Direction | What Changes |
|------|--------------|-----------|-------------|
| Consume finished product | `DISASSEMBLY_CONSUMPTION` (new) | OUT | on_hand_qty decreases for finished product |
| Add recovered raw material | `DISASSEMBLY_PRODUCTION` (new) | IN | on_hand_qty increases for each component |

### 7.4 Negative Inventory

The `allow_negative_stock` flag is always evaluated on the **product being consumed** (the raw material or component). Finished goods are never produced into negative inventory.

| Flag on Raw Material | Behavior during manufacturing consumption |
|---------------------|------------------------------------------|
| `false` (default) | Consumption that would result in negative `on_hand_qty` is blocked for this manufacturing run. Shortfall is added to Procurement Queue. |
| `true` | Consumption proceeds even if `on_hand_qty` goes negative. Negative balance is recorded. Shortfall is added to Procurement Queue. |

**Validation order:**
1. Determine `shortage_qty` = units of finished good still needed (§5.2 step 4).
2. For each RecipeItem, compute `required_raw` = `item.quantity × shortage_qty`.
3. Check `InventoryEngine.availableStock(item.product_id)` ≥ `required_raw`.
4. If not sufficient: check `item.product.allow_negative_stock`.
5. If `false`: block manufacturing for this run. Add shortfall to queue.
6. If `true`: proceed. Record negative FIFO layer. Add shortfall to queue.

**Finished goods are never negative:** The system only manufactures `shortage_qty`, which is the exact deficit between what is ordered and what is in stock. If `shortage_qty = 0`, manufacturing does not run at all.

### 7.5 FIFO Integration

Manufacturing consumption follows FIFO:
1. Identify the oldest `InventoryReceiptLayer` with `remaining_qty > 0`.
2. Consume from that layer first.
3. The `unit_cost` of the consumed layer is the cost used in the `RawMaterialConsumption` record.
4. When a layer is exhausted, move to the next oldest layer.

The existing `InventoryLayerConsumption` mechanism handles this for sales. Manufacturing must use the same mechanism.

**Manufacturing-specific FIFO record:**
- `InventoryLayerConsumption.order_id` → `manufacturing_transaction_id` (repurpose or add new FK)

### 7.6 Reservation Policy

Manufacturing transactions **do not use the reservation system**. Reservation is for sales orders (protecting stock from being sold while manufacturing runs). Manufacturing directly consumes stock.

**Sequence when order is in Preparing state:**
1. Order enters `processing` → stock is reserved (existing behavior)
2. Order enters `preparing` → manufacturing consumes raw materials, produces finished product, releases reservation on finished product immediately via ship action

### 7.7 Goods Receipt Inventory Update

Existing behavior is preserved:
- GR posted → `InventoryItem.on_hand_qty` increases
- `InventoryReceiptLayer` created with `landed_unit_cost`
- New: Decision Engine fires `GOODS_RECEIPT_POSTED` event
- Cost Engine updates `current_cost` per product's `cost_source` rules
- Procurement Queue recalculates for the received product

---

## Chapter 8 — Error Scenarios

### 8.1 Manufacturing Errors

| Error Code | Condition | System Response | Order Impact |
|-----------|-----------|----------------|-------------|
| `FAIL_NO_RECIPE` | `can_manufacture=true`, no active recipe | Log decision. No manufacturing. | None — order continues |
| `FAIL_RECIPE_INACTIVE` | Recipe exists but `is_active=false` | Log decision. No manufacturing. | None |
| `FAIL_RECIPE_INVALID` | Recipe fails validation at execution time | Log decision. No manufacturing. | None |
| `FAIL_STOCK_SHORTAGE` | Shortfall exists, `allow_negative=false` | Log decision. Add to Procurement Queue. | None |
| `MANUFACTURING_EXECUTION_ERROR` | DB error or exception during execution | Roll back all movements. Log as failed. Alert. | None |
| `FAIL_UNIT_MISMATCH` | Component unit doesn't match product unit | Reject recipe save (never reaches manufacturing) | N/A |
| `FAIL_CYCLIC_DEPENDENCY` | Cycle detected in recipe | Reject recipe save | N/A |

### 8.2 Disassembly Errors

| Error Code | Condition | System Response | Return Impact |
|-----------|-----------|----------------|--------------|
| `SKIP_DISASSEMBLY_DISABLED` | `can_disassemble=false` | Return to finished goods. Log. | Product received normally |
| `SKIP_NO_RECIPE` | `can_disassemble=true`, no recipe | Return to finished goods. Log. | Product received normally |
| `SKIP_RECIPE_INACTIVE` | Recipe inactive | Return to finished goods. Log. | Product received normally |
| `DISASSEMBLY_EXECUTION_ERROR` | DB error during execution | Roll back all movements. Log as failed. Alert. | Product not yet received |

### 8.3 Procurement Errors

| Error Code | Condition | System Response |
|-----------|-----------|----------------|
| `SCHEDULER_CONCURRENT_RUN` | Run already in progress | Skip new run. Log. |
| `SCHEDULER_EXECUTION_ERROR` | Error during scheduler run | Roll back all PRs for this run. Set status=failed. |
| `PR_NO_SUPPLIER` | No default supplier for product | Create PR without supplier. Flag `needs_supplier=true`. |
| `PR_DUPLICATE` | Pending PR exists for same product+period | Update existing PR quantity. Do not create duplicate. |
| `QUEUE_PRODUCT_NOT_FOUND` | Queue references deleted product | Remove entry. Log warning. |

### 8.4 Cost Engine Errors

| Error Code | Condition | System Response |
|-----------|-----------|----------------|
| `COST_SOURCE_UNDEFINED` | Product has no cost_source | Default to `manual`. Log warning. |
| `COST_CALCULATION_ERROR` | Error computing recipe cost | Log error. Retain previous cost. Alert. |
| `COST_CASCADE_LOOP` | Cascade triggers itself | Detect by tracking visited product IDs. Stop cascade. Log. |

### 8.5 Recipe Engine Errors

| Error Code | Condition | Response |
|-----------|-----------|----------|
| `RECIPE_ALREADY_EXISTS` | Creating recipe when one already exists | Reject. Edit existing recipe instead. |
| `RECIPE_SELF_REFERENCE` | Product is its own component | Reject on save. |
| `RECIPE_CYCLIC_DEPENDENCY` | Cycle detected | Reject on save. |
| `RECIPE_NO_COMPONENTS` | Recipe with zero items | Reject on save. |
| `RECIPE_ITEM_PERCENTAGE_NOT_SUPPORTED` | Percentage field submitted | Reject. Return validation error. |
| `RECIPE_ITEM_UNIT_MISMATCH` | Component unit ≠ product unit | Reject. Return validation error. |
| `RECIPE_ITEM_DUPLICATE` | Same component twice | Reject. Combine into one line. |

---

## Chapter 9 — Decision Matrix

Complete matrix of all system decisions. Each row is one scenario with its full decision chain.

| # | Trigger Event | Condition | Rule | Decision | Action | Expected Result |
|---|--------------|-----------|------|----------|--------|----------------|
| 1 | ORDER_PREPARING | `can_manufacture = false` | MFG-001 | SKIP_NOT_MANUFACTURABLE | Log only | No manufacturing |
| 2 | ORDER_PREPARING | `can_manufacture = true`, recipe = null | MFG-002 | FAIL_NO_RECIPE | Log, outcome=failed | Manufacturing blocked |
| 3 | ORDER_PREPARING | Recipe exists, `is_active = false` | MFG-003 | FAIL_RECIPE_INACTIVE | Log, outcome=failed | Manufacturing blocked |
| 4 | ORDER_PREPARING | Recipe valid, available_finished ≥ ordered_qty | MFG-005 | SKIP_STOCK_SUFFICIENT | Log, outcome=skipped | Existing stock satisfies demand, no manufacturing |
| 5 | ORDER_PREPARING | Recipe valid, shortage_qty > 0, all raw materials sufficient | MFG-006 | MANUFACTURE | Execute shortage_qty units → consume raw → produce output | Finished goods +shortage_qty, raw stock - |
| 6 | ORDER_PREPARING | Recipe valid, shortage_qty > 0, raw shortfall, raw `allow_negative = true` | MFG-007 | MANUFACTURE_WITH_SHORTAGE | Execute shortage_qty + add shortfall to queue | Finished goods +shortage_qty, raw stock goes negative, queue updated |
| 7 | ORDER_PREPARING | Recipe valid, shortage_qty > 0, raw shortfall, raw `allow_negative = false` | MFG-008 | FAIL_STOCK_SHORTAGE | Log, add to Procurement Queue | Manufacturing blocked, queue updated |
| 8 | INVENTORY_RETURN | `can_disassemble = false` | DIS-001 | SKIP_DISASSEMBLY_DISABLED | Add to finished goods | Product received as-is |
| 9 | INVENTORY_RETURN | `can_disassemble = true`, recipe = null | DIS-002 | SKIP_NO_RECIPE | Add to finished goods | Product received as-is |
| 10 | INVENTORY_RETURN | `can_disassemble = true`, recipe inactive | DIS-003 | SKIP_RECIPE_INACTIVE | Add to finished goods | Product received as-is |
| 11 | INVENTORY_RETURN | All conditions met | DIS-004 | DISASSEMBLE | Consume finished product, recover raw materials (post-commit queue update) | Raw materials +, finished goods - |
| 11 | GOODS_RECEIPT_POSTED | `cost_source = manual` | COST-001 | NO_COST_UPDATE | Log | No cost change |
| 12 | GOODS_RECEIPT_POSTED | `cost_source = purchase_invoice` | COST-002 | UPDATE_COST_FROM_INVOICE | current_cost = landed_unit_cost | Cost updated, history entry created |
| 13 | GOODS_RECEIPT_POSTED | `cost_source = recipe` | COST-003 | NO_COST_UPDATE | Log | No cost change |
| 14 | GOODS_RECEIPT_POSTED | `cost_source = hybrid` | COST-004 | UPDATE_PURCHASE_COST | Update hybrid purchase component | Cost history entry created |
| 15 | GOODS_RECEIPT_POSTED | Always | PROC-001 | RECALCULATE_QUEUE | Recalculate net requirement for received product | Queue entry updated or cleared |
| 16 | RECIPE_UPDATED | `cost_source = recipe` | COST-005 | RECALCULATE_RECIPE_COST | Recalculate from recipe components | Cost updated |
| 17 | RECIPE_UPDATED | `cost_source = hybrid` | COST-006 | RECALCULATE_HYBRID_COST | Recalculate hybrid recipe component | Cost updated |
| 18 | RECIPE_UPDATED | Parent products reference this as component | COST-007 | CASCADE_COST | Recalculate parent recipe costs | Parent product costs updated |
| 19 | PROCUREMENT_SCHEDULER_TRIGGERED | Scheduler already running | PROC-010 | SKIP_CONCURRENT_RUN | Log | No action |
| 20 | PROCUREMENT_SCHEDULER_TRIGGERED | All net requirements = 0 | PROC-011 | SCHEDULER_RUN_NO_ACTION | Log SchedulerRun | No Purchase Requests |
| 21 | PROCUREMENT_SCHEDULER_TRIGGERED | Net requirement > 0 | PROC-012 | GENERATE_PURCHASE_REQUESTS | Create PRs per product | Purchase Requests created |
| 22 | MANUFACTURING_FAILED | Shortfall confirmed | AUTO | UPDATE_PROCUREMENT_QUEUE | Add shortfall to Procurement Queue | Queue entry increased |

---

## Chapter 10 — Sequence Diagrams

### 10.1 Order Preparing → Automatic Manufacturing

```
WooCommerce        Orders BC         Decision Engine    Manufacturing Svc    Inventory Engine
     │                  │                  │                   │                    │
     │  Status:         │                  │                   │                    │
     │  Preparing       │                  │                   │                    │
     │─────────────────▶│                  │                   │                    │
     │                  │                  │                   │                    │
     │                  │ ORDER_PREPARING  │                   │                    │
     │                  │ event            │                   │                    │
     │                  │─────────────────▶│                   │                    │
     │                  │                  │                   │                    │
     │                  │                  │ evaluateRules()   │                    │
     │                  │                  │ → MFG-004: MANUFACTURE                │
     │                  │                  │                   │                    │
     │                  │                  │ logDecision(pending)                   │
     │                  │                  │                   │                    │
     │                  │                  │ execute(order_line, recipe)            │
     │                  │                  │──────────────────▶│                    │
     │                  │                  │                   │                    │
     │                  │                  │                   │ consumeStock(x3)   │
     │                  │                  │                   │───────────────────▶│
     │                  │                  │                   │◀─── ok ────────────│
     │                  │                  │                   │                    │
     │                  │                  │                   │ addStock()         │
     │                  │                  │                   │───────────────────▶│
     │                  │                  │                   │◀─── ok ────────────│
     │                  │                  │                   │                    │
     │                  │                  │                   │ updateCost()       │
     │                  │                  │◀─ executed ───────│                    │
     │                  │                  │                   │                    │
     │                  │                  │ logDecision(executed)                  │
```

### 10.2 Manufacturing — Stock Shortage (Negative Allowed)

```
Decision Engine     Recipe Engine     Inventory Engine    Proc.Queue
      │                   │                  │                  │
      │ MFG-005:          │                  │                  │
      │ MANUFACTURE_WITH_ │                  │                  │
      │ SHORTAGE          │                  │                  │
      │                   │                  │                  │
      │ resolveShortfall()│                  │                  │
      │──────────────────▶│                  │                  │
      │◀─ shortfall: 3 Kg │                  │                  │
      │                   │                  │                  │
      │ execute() [manufacturing proceeds]   │                  │
      │─────────────────────────────────────▶│                  │
      │◀─ ok (stock = -3)                   │                  │
      │                   │                  │                  │
      │ addShortfall(product, 3 Kg)          │                  │
      │──────────────────────────────────────────────────────── ▶│
      │◀─ queue updated                      │                  │
```

### 10.3 Order Return → Automatic Disassembly

```
Returns BC         Decision Engine    Disassembly Svc    Inventory Engine   Proc.Queue
     │                  │                   │                  │                  │
     │ ORDER_RETURNED   │                   │                  │                  │
     │ event            │                   │                  │                  │
     │─────────────────▶│                   │                  │                  │
     │                  │ evaluateRules()   │                  │                  │
     │                  │ → DIS-004:        │                  │                  │
     │                  │   DISASSEMBLE     │                  │                  │
     │                  │                   │                  │                  │
     │                  │ logDecision(pending)                 │                  │
     │                  │                   │                  │                  │
     │                  │ execute()         │                  │                  │
     │                  │──────────────────▶│                  │                  │
     │                  │                   │ consumeFinished()│                  │
     │                  │                   │─────────────────▶│                  │
     │                  │                   │                  │                  │
     │                  │                   │ addRawMaterial() (×N components)   │
     │                  │                   │─────────────────▶│                  │
     │                  │                   │◀─ ok ────────────│                  │
     │                  │                   │                  │                  │
     │                  │                   │ recalcQueue()    │                  │
     │                  │                   │──────────────────────────────────── ▶│
     │                  │◀─ executed ───────│                  │                  │
     │                  │ logDecision(executed)                │                  │
```

### 10.4 Procurement Scheduler → Purchase Request

```
Cron         Scheduler Svc      Proc.Queue    Inventory    Purchasing    PR
  │                │                │             │             │         │
  │ trigger()      │                │             │             │         │
  │───────────────▶│                │             │             │         │
  │                │ acquireLock()  │             │             │         │
  │                │ createRun()    │             │             │         │
  │                │                │             │             │         │
  │                │ getStockLevels()             │             │         │
  │                │──────────────────────────────▶            │         │
  │                │◀─── inventory snapshot ──────│            │         │
  │                │                │             │             │         │
  │                │ getOpenPOs()   │             │             │         │
  │                │────────────────────────────────────────── ▶│         │
  │                │◀─── PO quantities ──────────────────────── │         │
  │                │                │             │             │         │
  │                │ getQueue()     │             │             │         │
  │                │──────────────▶ │             │             │         │
  │                │◀─── entries ──│             │             │         │
  │                │                │             │             │         │
  │                │ recalculate net requirements│             │         │
  │                │ → product A: 3.5 Kg         │             │         │
  │                │ → product B: 120 pcs        │             │         │
  │                │                │             │             │         │
  │                │ createPurchaseRequest(product A)          │         │
  │                │──────────────────────────────────────────────────── ▶│
  │                │ createPurchaseRequest(product B)          │         │
  │                │──────────────────────────────────────────────────── ▶│
  │                │                │             │             │         │
  │                │ finalizeRun() releaseLock()  │             │         │
  │◀───────────────│                │             │             │         │
```

### 10.5 Goods Receipt → Cost Update + Queue Recalculation

```
Purchasing BC     Decision Engine     Cost Engine      Proc.Queue
      │                 │                  │                │
      │ GR status       │                  │                │
      │ → posted        │                  │                │
      │                 │                  │                │
      │ GOODS_RECEIPT_  │                  │                │
      │ POSTED event    │                  │                │
      │────────────────▶│                  │                │
      │                 │                  │                │
      │                 │ evaluateCostRule()               │
      │                 │ (per product, per cost_source)   │
      │                 │ COST-002: UPDATE_COST            │
      │                 │──────────────────▶               │
      │                 │                  │ updateCost()  │
      │                 │                  │ createHistory()
      │                 │◀─── cost updated │                │
      │                 │                  │                │
      │                 │ PROC-001: RECALCULATE_QUEUE      │
      │                 │──────────────────────────────────▶│
      │                 │                  │ recalculate() │
      │                 │◀─── queue updated ───────────────│
```

---

## Chapter 11 — Domain Glossary

### Official ECOS ERP Manufacturing & Procurement Dictionary

---

**Automatic Disassembly**  
The system-initiated process of reversing a manufacturing operation when a finished product is returned by a customer. The system consumes the returned finished product and adds the component raw materials back to inventory, using the same recipe as manufacturing but in reverse. Triggered automatically when `product.can_disassemble = true`.

---

**Automatic Manufacturing**  
The system-initiated process of consuming raw materials and producing a finished product when an order enters the Preparing state. Requires `product.can_manufacture = true` and an active Recipe. No user interaction is required for standard manufacturing.

---

**Cost Cascade**  
The automatic recalculation of a parent product's recipe cost when one of its component products' cost changes. Phase 1 supports one level of cascading only.

---

**Cost History**  
An immutable, append-only record of every change to a product's `current_cost`. Stores the previous cost, new cost, source, source document, timestamp, and actor. Never updated or deleted.

---

**Cost Source**  
The configuration that determines how a product's `current_cost` is maintained. Options: `manual`, `purchase_invoice`, `recipe`, `hybrid`. The cost source governs which events trigger a cost update.

---

**Current Cost**  
The product's effective unit cost at any given moment. Used in recipe cost calculation, manufacturing cost calculation, and procurement value estimates. Updated by the Cost Engine according to the product's `cost_source`.

---

**Decision**  
A system-made determination of what action to take in response to a business event. Every decision is logged before its action is executed. Examples: `MANUFACTURE`, `FAIL_NO_RECIPE`, `DISASSEMBLE`, `SKIP_DISASSEMBLY_DISABLED`.

---

**Decision Engine**  
The central routing service that receives all business events and determines the appropriate action. All manufacturing, disassembly, cost, and procurement actions flow through the Decision Engine. No module calls these services directly.

---

**Decision Log**  
An append-only record of every decision made by the Decision Engine. Stores the event, rule, decision, action, outcome, and metadata. Never updated after creation. The primary audit trail for all automated system actions.

---

**Decision Rule**  
A named condition-to-decision mapping (e.g., `MFG-004`: "If recipe valid and all materials available, then MANUFACTURE"). Rules are evaluated in priority order.

---

**Decision Trigger**  
A business event that causes the Decision Engine to evaluate rules. Examples: `ORDER_PREPARING`, `ORDER_RETURNED`, `GOODS_RECEIPT_POSTED`, `RECIPE_UPDATED`.

---

**Disassembly Transaction**  
An immutable record of a completed disassembly operation. Stores the finished product consumed, raw materials recovered, quantities, costs, and the recipe version used.

---

**Goods Receipt**  
The existing ECOS ERP document that records the physical receipt of purchased products into inventory. When posted, it creates an inventory receipt layer, updates on-hand quantity, and triggers Cost Engine and Procurement Queue updates.

---

**Hybrid Cost**  
A cost source that tracks two components: a `purchase_cost` (updated from Goods Receipts) and a `recipe_cost` (updated from manufacturing). The `current_cost` reflects the most recently updated component.

---

**In-Transit Quantity**  
The quantity of a product on open (not yet received) Purchase Orders. Counted as a supply when calculating net requirements, preventing duplicate Purchase Requests.

---

**Manufacturing Transaction**  
An immutable record of a completed manufacturing operation. Stores the finished product created, raw materials consumed (with costs at execution time), total manufacturing cost, recipe version, and the triggering order.

---

**Negative Inventory**  
A state where a product's on-hand quantity falls below zero. Permitted per product via `allow_negative_stock = true`. When negative inventory occurs, the shortfall is automatically added to the Procurement Queue.

---

**Net Requirement**  
The quantity of a product the system needs to purchase after accounting for: current inventory, open purchase orders (in-transit), and recent receipts/recoveries. Maintained per product in the Procurement Queue. Can never be negative (floor is 0).

---

**Procurement Intelligence**  
The domain that converts material shortages into consolidated, accurate purchase documents. Composed of: Procurement Queue, Procurement Scheduler, and Purchase Request.

---

**Procurement Queue**  
A live materialized state (not a document) representing the current net requirement for each product. Updated continuously as manufacturing, disassembly, purchases, and cancellations occur. One entry per product per company.

---

**Procurement Scheduler**  
A background service that runs at company-defined time slots. It takes a full snapshot of current procurement state, recalculates net requirements from scratch, and generates Purchase Requests. Never generates documents from stale queue data.

---

**Purchase Request**  
A system-generated document created by the Procurement Scheduler. Represents the recommendation to purchase a specific quantity of a product. Created once per product per scheduler run (not once per order). Reviewed and converted to a Purchase Order by the purchasing team.

---

**Raw Material Consumption**  
An immutable record of one component product consumed during a manufacturing run. Part of a ManufacturingTransaction. Stores product, quantity, and unit cost at time of consumption.

---

**Recipe**  
A bill of materials defining the components required to produce one unit of a finished product. Belongs to one product. Has one or more RecipeItems. Versioned on every save. Used for both manufacturing (forward) and disassembly (reverse).

---

**Recipe Cost**  
The calculated cost to manufacture one unit of a product. Derived by summing: (component.quantity × component.current_cost) for all RecipeItems. Recalculated whenever the recipe or any component cost changes.

---

**Recipe Engine**  
The internal service responsible for recipe resolution, validation, cost calculation, and disassembly computation. Consumed by Manufacturing Service, Disassembly Service, and Cost Engine.

---

**Recipe Version**  
An integer counter incremented every time a recipe is saved. Manufacturing Transactions snapshot the version number at execution time, ensuring historical traceability even after the recipe is later modified.

---

**Scheduler Run**  
An immutable record of a single Procurement Scheduler execution. Stores the inventory/PO/queue snapshots at run time, number of Purchase Requests created, and execution status.

---

**Traceability**  
The ability to trace any system action back to its origin. In ECOS ERP, every manufacturing movement references a ManufacturingTransaction, which references a DecisionLog, which references the originating Order. Every cost change references its source document.

---

**Unified Product Model**  
The ECOS ERP principle that all products — regardless of whether they are raw materials, components, finished goods, or packaging — are stored in a single Product entity. Behavior is determined by product capabilities (flags), not by product type classification.

---

## Chapter 12 — Architecture Review

### 12.1 ERP Architect Perspective

**Strengths:**
- The Unified Product Model eliminates a common source of ERP complexity: managing separate entities for materials vs. products with duplicate fields and conflicting business rules. This is a strong simplification.
- The Decision Engine as a single routing layer is architecturally clean and provides the audit trail that most ERPs lack by default.
- Procurement Intelligence's "recalculate before generate" principle prevents the stale-data purchase request problem that plagues traditional ERPs.

**Risks:**
1. **Order status prerequisite** — The `preparing` status does not exist in the current Orders module. This is a cross-domain dependency that must be resolved before manufacturing can function. Risk: LOW (adding a status is straightforward) but it blocks everything else.

2. **product_type migration** — The existing `product_type` enum (`finished_good` / `raw_material`) must be preserved as a classification label while ensuring no business logic uses it. Risk: MEDIUM (requires code audit to find any existing logic that branches on `product_type`).

3. **BOM to Recipe migration** — The existing BillOfMaterial has `waste_percentage`. Migrating it to Recipe requires discarding this field. If users rely on waste percentages for production planning, they must be warned. Risk: MEDIUM (user communication and data migration).

---

### 12.2 Manufacturing Consultant Perspective

**Strengths:**
- Fully automatic manufacturing at the order preparation stage is the right model for e-commerce. The recipe-driven approach is correct for the described product types (assembled FMCG, packaged goods).
- Disassembly as a reverse recipe is elegant and avoids the overhead of maintaining separate disassembly records.

**Risks:**
1. **No yield/efficiency factor** — Real manufacturing often has yield losses (e.g., 0.5 Kg honey consumed but only 0.48 Kg usable). The spec correctly excludes percentages, but this means recipes must be designed with real consumption quantities (not ideal quantities). This is a process design requirement, not a system limitation.

2. **No work-in-progress (WIP) tracking** — The spec treats manufacturing as instantaneous (raw in → finished out). For products with multi-step manufacturing or lead times, this is a limitation. This is acceptable for Phase 1 (simple assembly/packaging) but must be revisited for complex manufacturing.

3. **No manufacturing capacity** — The system has no concept of how many units can be produced per hour/day. All manufacturing is assumed to be available on demand. Acceptable for Phase 1.

---

### 12.3 Supply Chain Consultant Perspective

**Strengths:**
- The Procurement Queue's live net requirement approach is significantly more sophisticated than most mid-market ERPs.
- Scheduler-based consolidation creates purchasing efficiency by batching requests.

**Risks:**
1. **No lead time modeling** — The scheduler creates Purchase Requests based on current shortfall without considering supplier lead times. If Raw Honey takes 7 days to deliver, the system doesn't know to order 7 days in advance. Risk: HIGH. Recommendation: Add `supplier_lead_time_days` to Supplier or ProductSupplier in Phase 2.

2. **No safety stock** — There is no minimum stock level defined per product. The system only reacts to actual shortfalls, never proactively orders to maintain buffer stock. Risk: MEDIUM for time-sensitive products. Recommendation: Add `safety_stock_quantity` to Product in Phase 2.

3. **In-transit tracking granularity** — The spec tracks in-transit quantities per product. If there are multiple open POs for the same product with different expected dates, the scheduler cannot prioritize by urgency. Acceptable for Phase 1.

---

### 12.4 Inventory Expert Perspective

**Strengths:**
- FIFO integration is correctly designed by leveraging the existing InventoryReceiptLayer mechanism.
- The separation of `allow_negative_stock` per product is the right granularity.

**Risks:**
1. **FIFO for manufacturing consumption** — The existing `InventoryLayerConsumption` has fields for `order_id` and `order_line_id`. Manufacturing consumption needs different reference fields. The database design phase must decide whether to add `manufacturing_transaction_id` to this table or create a parallel structure.

2. **Disassembly recovery cost** — Recovered materials are added at `current_cost`, not at the original FIFO batch cost. This means the recovered materials create a new "batch" at current price rather than restoring the original layer. This is a simplification that introduces minor cost distortion. Acceptable for Phase 1.

3. **Reservation and manufacturing interaction** — The spec states manufacturing does NOT use the reservation system. This means a reserved quantity could be "double-consumed" if both a sale and a manufacturing run touch the same component. The reservation logic must account for manufacturing consumption. This needs careful design in the Database Design phase.

---

### 12.5 Procurement Expert Perspective

**Strengths:**
- One Purchase Request per product per run (not per order) is correct and will dramatically reduce the purchasing workload.
- Snapshot isolation in the scheduler prevents race conditions where a receipt arrives mid-run and creates inconsistencies.

**Risks:**
1. **Supplier selection** — The spec suggests the default supplier on the product. For products with multiple suppliers (price negotiations, alternate sources), Phase 2 should implement supplier selection logic (cheapest, fastest, most reliable).

2. **No minimum order quantities (MOQ)** — Suppliers often have minimum order quantities. The scheduler may generate a PR for 0.5 Kg when the MOQ is 5 Kg. Phase 2 should support `supplier_moq` and `supplier_pack_size`.

3. **PR to PO: one click** — This is achievable for single-supplier PRs. For multi-product POs to the same supplier, the UX must allow grouping multiple PRs into one PO. This is a UI concern for Phase 2.

---

### 12.6 CTO Perspective

**Strengths:**
- The event-driven architecture aligns with ADR-011 and provides a clean extension path for AI integration.
- The append-only DecisionLog is the right foundation for AI training data and audit compliance.
- The modular design (Recipe Engine, Decision Engine, Procurement Intelligence as separate concerns) allows independent scaling and testing.

**Performance Risks:**
1. **Decision Engine latency** — Every ORDER_PREPARING event triggers recipe resolution, stock checks, and manufacturing execution synchronously. For high-volume days (hundreds of orders), this could create queue backup. **Recommendation:** Process manufacturing asynchronously via a job queue. The order proceeds immediately; manufacturing is dispatched to a background worker.

2. **Procurement Queue recalculation** — Recalculating per-product net requirements on every goods receipt, order cancellation, and disassembly event could create database contention at scale. **Recommendation:** Rate-limit queue recalculation with a debounce (e.g., recalculate at most once per minute per product).

3. **Cost cascade on component cost change** — A single cost change to a widely-used component (e.g., Raw Honey used in 50 products' recipes) triggers 50 cost recalculations. At scale, this could be expensive. **Recommendation:** Queue cost cascade events rather than executing them synchronously.

**AI Opportunities:**
1. The DecisionLog provides rich training data for ML models that predict manufacturing bottlenecks.
2. The Procurement Queue history enables demand forecasting models.
3. Recipe cost trends enable AI-driven supplier negotiation recommendations.
4. Scheduler run history enables AI optimization of procurement schedule timing.

---

## Chapter 13 — Risk Assessment

| Risk | Severity | Likelihood | Mitigation |
|------|---------|-----------|-----------|
| Manufacturing blocks order progress if synchronous | HIGH | HIGH | Make manufacturing asynchronous (job queue) |
| `preparing` order status prerequisite | HIGH | CERTAIN | Add status before starting manufacturing implementation |
| Lead time not modeled → late procurement | HIGH | MEDIUM | Add lead_time_days to Phase 2 supplier data |
| Synchronous cost cascade on busy systems | MEDIUM | MEDIUM | Queue cost cascade events |
| No safety stock → reactive procurement only | MEDIUM | MEDIUM | Add safety_stock_quantity in Phase 2 |
| FIFO layer reference for manufacturing | MEDIUM | HIGH | Resolve in Database Design phase |
| Reservation + manufacturing contention | MEDIUM | MEDIUM | Explicit locking strategy in Database Design |
| Double purchase requests on scheduler error | LOW | LOW | Idempotency key on PR by product+period |
| Disassembly recovery cost distortion | LOW | HIGH | Accepted trade-off for Phase 1 |
| BOM waste_percentage data loss on migration | LOW | MEDIUM | Notify users before migration |

---

## Chapter 14 — Improvement Recommendations

### Before Database Design

1. **Confirm `preparing` status design** with the Orders team. Define exactly when an order enters `preparing` and what the transition from `processing → preparing` means for the existing reservation lifecycle (COM-010B).

2. **Async manufacturing decision** — Decide now whether ORDER_PREPARING triggers manufacturing synchronously or via a job queue. This fundamentally affects the architecture of the Decision Engine integration.

3. **Define warehouse scope** — When an order enters Preparing, which warehouse's inventory is used for manufacturing? The order's assigned warehouse? The company's default manufacturing warehouse? This must be specified before database design.

### Phase 2 Priorities (After Phase 1 is Complete)

1. **Lead time modeling** — `supplier_lead_time_days` per supplier/product combination. The scheduler uses lead time to create proactive Purchase Requests before the shortage occurs.

2. **Safety stock** — `safety_stock_quantity` per product per warehouse. Scheduler includes safety stock in net requirement calculation.

3. **MOQ / pack size** — `minimum_order_quantity` and `pack_size` per supplier/product. Scheduler rounds up PR quantities to MOQ.

4. **Multi-level cost cascade** — Currently one level deep. Phase 2 should implement a dependency graph for unlimited depth.

5. **Manufacturing queue / capacity** — For complex manufacturing operations, add a manufacturing queue with capacity constraints and estimated completion times.

6. **Retry UI** — Operations dashboard showing failed decisions with "Retry" button for recoverable failures.

---

## Appendix A — Module Scope Summary

| Module | Status | Changes Required |
|--------|--------|----------------|
| **Product BC** | EXISTING — EXTEND | Add: `can_manufacture`, `can_disassemble`, `allow_negative_stock`, `cost_source`, `current_cost`. Remove logic on `product_type`. |
| **Recipe BC** | EXISTING — REPLACE | Replace BillOfMaterial with Recipe. Remove `waste_percentage`. Add unit validation. |
| **Decision Engine BC** | NEW | Full new implementation |
| **Manufacturing BC** | NEW | ManufacturingTransaction, DisassemblyTransaction, services |
| **Cost Engine BC** | NEW (extends FIFO) | CostHistoryEntry, configurable cost sources, cascade logic |
| **Procurement Intelligence BC** | NEW | ProcurementQueueEntry, ProcurementSchedule, SchedulerRun, PurchaseRequest |
| **Inventory BC** | EXISTING — EXTEND | Add DISASSEMBLY_CONSUMPTION, DISASSEMBLY_PRODUCTION movement types. Wire manufacturing to InventoryLayerConsumption. |
| **Orders BC** | EXISTING — EXTEND | Add `preparing` status. Emit ORDER_PREPARING event. |
| **Purchasing BC** | EXISTING — EXTEND | Add PurchaseRequest aggregate. Wire GR posting to Decision Engine event. |

---

## Appendix B — Implementation Prerequisite Checklist

Before any implementation begins, the following must be resolved:

- [ ] `preparing` order status confirmed and designed with Orders team
- [ ] Warehouse selection strategy for manufacturing confirmed
- [ ] Synchronous vs. asynchronous manufacturing execution decision made
- [ ] BOM migration strategy confirmed (waste_percentage disposition)
- [ ] `product_type` code audit completed (confirm no business logic uses it)
- [ ] This specification approved by stakeholders

**Awaiting approval before proceeding to Database Design.**
