# COM-011 — Inventory Adjustments & Stock Count

## Overview

Provides a full inventory counting workflow (physical count sessions, variance computation, and adjustment posting) plus standalone adjustment actions for arbitrary stock corrections. All adjustments produce immutable ledger entries and FIFO layer records for full traceability.

---

## Count Session State Machine

```
Draft ──────────────────► Cancelled
  │
  ▼
InProgress ─────────────► Cancelled
  │
  ▼
Completed
  │
  ▼
Approved
```

Transitions are enforced by `CountSessionStatus::canTransitionTo()`. Attempting an invalid transition throws `UnprocessableEntityHttpException`.

---

## Count Session Lifecycle

### 1. Create (Draft)
`CreateCountSessionAction::execute(array $data)`:
- Generates `count_number` (CNT-00001 format)
- Loads all `InventoryItem` records for the specified warehouse
- Creates one `InventoryCountLine` per item, capturing `system_qty = item.on_hand_qty`
- Optional `product_ids` filter for partial counts

### 2. Start (InProgress)
`StartCountSessionAction::execute($session)`:
- Sets `status = in_progress`, stamps `started_at`
- Counters can now update `counted_qty` per line

### 3. Complete (Completed)
`CompleteCountSessionAction::execute($session)`:
- For each line: `variance_qty = counted_qty - system_qty`
- `variance_value = variance_qty × product.average_cost`
- Sets `status = completed`, stamps `completed_at`
- Lines with `counted_qty = null` are skipped (uncounted)

### 4. Approve (Approved)
`ApproveCountSessionAction::execute($session)`:
- For each line with non-zero variance:
  - **Positive variance** (more stock than expected):
    - `AdjustmentInAction` increments `on_hand_qty`
    - Creates new `InventoryReceiptLayer` (goods_receipt_id = null, supplier_id = last_supplier_id or null)
  - **Negative variance** (less stock than expected):
    - `AdjustmentOutAction` decrements `on_hand_qty`
    - `InventoryLayerConsumptionService::consume()` runs FIFO, creating consumption audit records
  - After each: `refreshFifoCost(product_id)` updates `product.current_fifo_cost`
- Sets `status = approved`

### 5. Cancel
`CancelCountSessionAction::execute($session)`:
- Valid from Draft or InProgress
- No stock adjustments — purely a status transition

---

## Adjustment Actions

### AdjustmentInAction
Used for positive variance or standalone positive adjustments:
- Calls `InventoryItemRepository::findOrCreate()` (creates item record if missing)
- Increments `on_hand_qty`
- Records `LedgerMovementType::AdjustmentIn` in `stock_ledger_entries`

### AdjustmentOutAction
Used for negative variance or standalone negative adjustments:
- Requires existing inventory item with sufficient `on_hand_qty`
- Decrements `on_hand_qty`
- Records `LedgerMovementType::AdjustmentOut` in `stock_ledger_entries`
- Throws `InsufficientStockException` if `on_hand_qty < quantity`

Both actions accept `StockOperationDTO` with `reference_type` and `reference_id` for audit traceability.

---

## Mobile Counting Mode

`GET /inventory-counts/{id}?hide_system_qty=1`

When `hide_system_qty=1`, the `system_qty` field is **omitted** from count line responses. This enables blind counting — counters record their own physical count without being anchored to system numbers, reducing confirmation bias.

---

## Variance Summary

Present in responses when session status is `completed` or `approved`:

```json
{
  "variance_summary": {
    "total_lines": 10,
    "counted_lines": 9,
    "positive_lines": 2,
    "negative_lines": 1,
    "total_variance_value": -120.50,
    "inventory_accuracy_pct": 77.78
  }
}
```

`inventory_accuracy_pct` = lines with `variance_qty = 0` / total counted lines × 100.

---

## Data Model

### inventory_count_sessions
| Column | Type | Notes |
|--------|------|-------|
| `count_number` | string | Sequential CNT-00001 format |
| `status` | enum | draft/in_progress/completed/approved/cancelled |
| `started_at` | datetime | Null until started |
| `completed_at` | datetime | Null until completed |
| `created_by` / `approved_by` | string | User identifiers |

### inventory_count_lines
| Column | Type | Notes |
|--------|------|-------|
| `system_qty` | decimal(15,4) | Captured at session creation |
| `counted_qty` | decimal(15,4) \| null | Entered by counter |
| `variance_qty` | decimal(15,4) \| null | Computed at completion |
| `variance_value` | decimal(15,2) \| null | variance_qty × average_cost |
| `photo_path` | string \| null | Optional photo evidence |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /inventory-counts | List sessions (filterable by warehouse, status) |
| POST | /inventory-counts | Create new session |
| GET | /inventory-counts/{id} | Get session with lines |
| PUT | /inventory-counts/{id} | Update lines counted_qty |
| DELETE | /inventory-counts/{id} | Delete draft session |
| POST | /inventory-counts/{id}/start | Transition to in_progress |
| POST | /inventory-counts/{id}/complete | Compute variances → completed |
| POST | /inventory-counts/{id}/approve | Post adjustments → approved |
| POST | /inventory-counts/{id}/cancel | Cancel from draft/in_progress |

---

## FIFO Integration

Negative variances consume FIFO layers via `InventoryLayerConsumptionService::consume()`, producing `InventoryLayerConsumption` records. These provide full traceability from count session → consumed layer → unit cost at time of adjustment.

Positive variances create new `InventoryReceiptLayer` records with `goods_receipt_id = null` and `supplier_id = product.last_supplier_id` (null if unknown), so adjustment-in stock participates in future FIFO consumption.

---

## Ledger Traceability

Every adjustment (in or out) writes to `stock_ledger_entries`:
- `movement_type = AdjustmentIn` or `AdjustmentOut`
- `reference_type = 'inventory_count'`
- `reference_id = session.id`

This allows full reconstruction of the on_hand history from ledger entries alone.

---

## Tests

`tests/Feature/Inventory/InventoryCountSessionTest.php` — 12 tests:

1. Create session generates lines from warehouse inventory
2. Start transitions status to in_progress
3. Complete computes variance per line (qty and value)
4. Approve posts adjustment in for positive variance
5. Approve posts adjustment out for negative variance
6. FIFO consumption record created for adjustment out
7. Receipt layer created for adjustment in (with null goods_receipt_id)
8. Mobile mode hides system_qty from lines
9. Cancel from draft
10. Adjustment creates ledger entry with correct movement_type and reference
11. Accuracy percentage computed from completed lines
12. Invalid transition (approve a draft) throws exception

---

## File Map

| Path | Purpose |
|------|---------|
| `Modules/Inventory/CountSessions/Domain/Enums/CountSessionStatus.php` | Status enum + state machine |
| `Modules/Inventory/CountSessions/Domain/Models/InventoryCountSession.php` | Session model |
| `Modules/Inventory/CountSessions/Domain/Models/InventoryCountLine.php` | Line model |
| `Modules/Inventory/CountSessions/Application/Actions/CreateCountSessionAction.php` | Draft creation |
| `Modules/Inventory/CountSessions/Application/Actions/StartCountSessionAction.php` | Start |
| `Modules/Inventory/CountSessions/Application/Actions/CompleteCountSessionAction.php` | Variance computation |
| `Modules/Inventory/CountSessions/Application/Actions/ApproveCountSessionAction.php` | Adjustment posting |
| `Modules/Inventory/CountSessions/Application/Actions/CancelCountSessionAction.php` | Cancellation |
| `Modules/Inventory/InventoryItems/Application/Actions/AdjustmentInAction.php` | Positive stock adjustment |
| `Modules/Inventory/InventoryItems/Application/Actions/AdjustmentOutAction.php` | Negative stock adjustment |
| `Modules/Inventory/CountSessions/Presentation/Http/Controllers/InventoryCountController.php` | API + mobile mode |
| `Modules/Inventory/CountSessions/Infrastructure/Providers/CountSessionsServiceProvider.php` | DI registration |
