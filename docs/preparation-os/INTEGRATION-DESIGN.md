# Preparation OS — Integration Design

**Document:** INTEGRATION-DESIGN  
**Version:** 1.0  
**Status:** APPROVED — Engineering Design Phase  
**Date:** 2026-07-05  
**Task:** TASK-PREP-001  
**Parent:** PREPARATION-OS-BLUEPRINT.md  
**Integration Standards:** docs/contracts/INTEGRATION-CATALOG.md, GOV-011

---

## 1. Integration Architecture Principle

> Preparation OS never calls another module's internal code directly.  
> All cross-module data flows use either:
> - **Events** (asynchronous; state changes)
> - **Queries via Repository contracts** (synchronous reads when necessary)
>
> GOV-011: Cross-module communication via Events only.

---

## 2. Integration Map Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                       PREPARATION OS                                 │
│                                                                      │
│  READS FROM:                    WRITES TO / PUBLISHES:              │
│  ← Orders (reserved orders)     → PreparedProductsPool              │
│  ← Inventory (stock levels)     → Events (EPS-01)                   │
│  ← Recipes (active recipes)     → Timeline (EPS-02)                 │
│  ← Configuration (policies)     → Documents (EPS-03)                │
│                                  → Notifications (EPS-04)           │
│  LISTENS TO EVENTS FROM:         → Procurement (shortage requests)  │
│  ← inventory.stock_added        → Manufacturing (job requests)      │
│  ← manufacturing.job.completed  → Loading OS (pool ready event)     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Integration: Orders (Commerce Module)

**Direction:** Preparation OS reads order data; Orders module listens to preparation events.

### 3.1 Data Preparation OS Reads from Orders

| Data | When | Query Method |
|---|---|---|
| Reserved orders list | Wave creation (order selection) | Repository query: `OrderRepository::getReservedOrders(company_id, filters)` |
| Order lines (product + qty) | Product demand generation | Repository query: `OrderRepository::getOrderLines(order_ids)` |
| Order delivery zone | Wave creation (for planning context) | Included in order list query |

**No FK from preparation tables to orders table.** Order data is denormalized into `preparation_wave_orders` at wave creation time (snapshot pattern).

### 3.2 Events Preparation OS Publishes to Orders

| Event | Consumer Action |
|---|---|
| `preparation.wave.started` | Orders module updates order status → `in_preparation` |
| `preparation.wave.completed` | Orders module updates order status → `ready` |
| `preparation.wave.cancelled` | Orders module returns orders to `reserved` status |

### 3.3 Guard
Preparation OS checks order status before wave creation. Orders must be in `reserved` status. This is a read-time validation — Preparation OS calls the Order repository, it does not subscribe to order events for this check.

---

## 4. Integration: Inventory — Reservations

**Direction:** Preparation OS reads reservation state; publishes events that cause reservation changes.

### 4.1 Reads

| Data | When | Method |
|---|---|---|
| Reservation confirmed? | Before wave start | Check via order reservation status (order must have active reservations) |

### 4.2 Events Published (causing Inventory action)

| Event | Inventory Module Action |
|---|---|
| `preparation.wave.cancelled` | Release all reservations for orders in this wave |
| `preparation.wave.completed` | Consume reservations (mark as used; FIFO layers decremented) |

**Important:** Preparation OS does NOT directly call `ReserveStockAction` or `ReleaseReservationAction`. These are triggered by the Inventory module listening to preparation events.

---

## 5. Integration: Inventory — Stock Levels (MRP)

**Direction:** Preparation OS reads current stock levels for MRP calculation.

### 5.1 Reads

| Data | When | Method |
|---|---|---|
| Raw material available stock (per warehouse) | MRP analysis | Repository query: `RawMaterialRepository::getAvailableStock(material_id, warehouse_id)` |
| Finished product available stock | PRP analysis | Repository query: `ProductRepository::getAvailableStock(product_id, warehouse_id)` |

### 5.2 Listens for Events

| Event | Preparation OS Action |
|---|---|
| `inventory.raw_material.stock_added` | If a shortage-blocked wave exists for this material → check if shortage is now resolved → notify planner |

This listener triggers a re-check of MaterialRequirements where `shortage = true` and `resolved = false`, filtered by the received `raw_material_id`.

---

## 6. Integration: Recipes (Manufacturing Module)

**Direction:** Preparation OS reads active recipes for MRP explosion.

### 6.1 Reads

| Data | When | Method |
|---|---|---|
| Active recipe for a product | MRP calculation per WaveItem | Repository query: `RecipeRepository::getActiveRecipe(product_id)` |
| Recipe lines (materials + quantities + waste%) | MRP material explosion | Included in recipe query |

**If no active recipe:** Exception raised (type = `missing_recipe`); that WaveItem is blocked; wave cannot start until resolved. Planner must coordinate with Manufacturing to create a recipe.

---

## 7. Integration: Loading & Allocation OS

**Direction:** Preparation OS provides Prepared Products Pool; Loading OS reads from it.

### 7.1 What Preparation OS Provides

The Prepared Products Pool is the formal output of Preparation OS and the formal input of Loading & Allocation OS.

| Pool Entry Fields | Loading OS Reads |
|---|---|
| `product_id`, `warehouse_id` | Which product, from which warehouse |
| `quantity_available` | Available for reservation |
| `quality_status` | Must be `passed` before reservation |
| `preparation_wave_id` | Origin traceability |

### 7.2 Events That Signal Loading OS

| Event | Loading OS Action |
|---|---|
| `preparation.wave.completed` | Loading OS notified; pool entries are now available |
| `preparation.pool.updated` | Per-product pool quantity change notification |

### 7.3 Events Loading OS Publishes (Preparation OS listens)

| Event | Preparation OS Action |
|---|---|
| `loading.pool.reserved` | Update `prepared_products_pool.quantity_reserved` + create PoolMovement |
| `loading.pool.reservation_released` | Update `prepared_products_pool.quantity_reserved` − + create PoolMovement |
| `loading.product.loaded` | Update `prepared_products_pool.quantity_loaded` + + PoolMovement |

**Note:** The pool is owned by Preparation OS at the data level, but Loading OS triggers quantity changes via events. Preparation OS listens and updates.

---

## 8. Integration: Timeline (EPS-02)

**Direction:** Preparation OS writes timeline entries for every wave action.

All timeline entries are written via `TimelineService::record()` contract.

| Trigger | Entry Text | Object |
|---|---|---|
| Wave created | "Wave {wave_number} created with {N} orders" | PreparationWave |
| Demand generated | "Product demand generated: {N} products, {total} units" | PreparationWave |
| Materials analyzed | "Material analysis complete. Shortages: {N}" | PreparationWave |
| Shortage detected | "Shortage detected: {material} — {amount} {unit}" | PreparationWave |
| Shortage resolved | "Shortage resolved by {actor}" | PreparationWave |
| Wave approved | "Wave approved by {actor}" | PreparationWave |
| Preparation started | "Preparation started by {actor}. {N} workers assigned." | PreparationWave |
| Product prepared | "Product {SKU} prepared: {qty} of {required} units" | PreparationWave |
| Exception raised | "Exception: {type} — {description}" | PreparationWave |
| Exception resolved | "Exception resolved by {actor}" | PreparationWave |
| Wave completed | "Wave completed. {N} products in Prepared Pool." | PreparationWave |
| Wave cancelled | "Wave cancelled by {actor}. Reason: {text}" | PreparationWave |
| Worker assigned | "{actor} assigned {worker} as {role}" | PreparationWave |
| Quality check | "Quality {passed/failed} by {actor} for {product}" | PreparedProductsPool |

Timeline entries also appear on the **Order** object for orders in the wave:
```
"Order added to preparation wave {wave_number}"
"Order preparation started"
"Order preparation completed"
```

---

## 9. Integration: Documents (EPS-03)

**Direction:** Preparation OS stores and retrieves documents via `DocumentService`.

| Document Type | Created When | Stored On |
|---|---|---|
| Quality check report | QC team uploads | PreparedProductsPool entry |
| Shortage justification | Supervisor override | PreparationWave |
| Picking instructions | Custom per wave | PreparationWave |

All documents are stored via `DocumentService::attach(object_type, object_id, file, metadata)`.

---

## 10. Integration: Notifications (EPS-04)

**Direction:** Preparation OS sends all notifications via `NotificationService`.

| Event | Notification | Recipients | Channel |
|---|---|---|---|
| Shortage detected | Alert: "Wave {N} blocked — shortage" | Planner, Procurement team | In-app + Push |
| Wave completed | Success: "Wave {N} ready for loading" | Loading supervisor | In-app |
| Quality check failed | Alert: "QC failed on {product}" | Prep supervisor | In-app + Push |
| Exception raised | Alert: "{type} exception on wave {N}" | Prep supervisor | In-app |
| Wave assigned to worker | Info: "You've been assigned to wave {N}" | Worker | In-app + Push (mobile) |
| SLA approaching | Warning: "{N} orders approaching SLA" | Planner, Supervisor | In-app |

Recipient resolution uses `NotificationPolicy` from Configuration Platform.

---

## 11. Integration: AI Platform (EPS-AI)

See AI-INTEGRATION.md for full specification. Summary of integration points:

| Signal Sent to AI | When |
|---|---|
| Wave size, order mix, material levels | Wave planning (EP-F1) |
| Shortage analysis result | After MRP (EP-F2) |
| Pick list completion progress | During preparation |
| Wave completion metrics | After wave completion |

| Data Received from AI | Used For |
|---|---|
| Duration prediction | Dashboard ETA display |
| Shortage risk score | Pre-flight warning before MRP |
| Recommended wave start time | Planner decision support |
| Next best action | Smart Action Chips in UI |

---

## 12. Integration: Procurement (Purchasing Module)

**Direction:** Preparation OS requests purchasing; Procurement acts.

### 12.1 What Preparation OS Sends

When MRP detects a shortage, Preparation OS publishes:
```
preparation.shortage.detected
  payload:
    wave_id: uuid
    material_id: uuid
    shortage_amount: decimal
    unit: string
    required_by_date: date (wave.planning_date)
```

### 12.2 Procurement's Response

Procurement module listens to `preparation.shortage.detected` and creates a Material Request (MR) automatically (if `manufacturing.mrp.auto_trigger` policy = true).

When the MR/PO is fulfilled and stock arrives:
```
inventory.raw_material.stock_added
```
Preparation OS listens; checks if shortage is now resolved.

---

## 13. Integration: Manufacturing Module

**Direction:** Preparation OS requests production; Manufacturing acts.

When PRP identifies products to manufacture:
```
manufacturing.production_job.requested
  payload:
    wave_id: uuid
    product_id: uuid
    quantity_to_manufacture: decimal
    priority: int
    required_by_date: date
```

Manufacturing module creates a job; links `manufacturing_job_id` back via a response event:
```
manufacturing.production_job.created
  payload:
    request_wave_id: uuid
    product_id: uuid
    job_id: uuid
```

Preparation OS updates `preparation_production_requirements.manufacturing_job_id`.

When manufacturing completes:
```
manufacturing.production_job.completed
  payload:
    job_id: uuid
    product_id: uuid
    quantity_produced: decimal
```

Preparation OS updates ProductionRequirement.status → `ready`.

---

## 14. Integration Failure Handling

| Integration | Failure Scenario | Handling |
|---|---|---|
| Order repository unavailable | Wave creation fails | 503 response; no partial wave created |
| Recipe repository unavailable | MRP fails | Exception raised; wave stays in `planning`; retry available |
| Timeline write fails | Non-blocking | Log error; do not block business action |
| Notification delivery fails | Non-blocking | Retry queue (EPS-04 handles); do not block |
| Event publish fails | Blocking | Transaction rolls back; wave action fails safely |
| Loading OS event listener fails | Retry | EPS-01 dead-letter queue; alert if unprocessed > 5 min |

**All event publishing is inside the same database transaction as the business action.** If the event cannot be published, the action is rolled back.
