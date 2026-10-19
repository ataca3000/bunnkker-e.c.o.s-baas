# COM-009 — Inventory Foundation & Stock Reservation Architecture

## Overview

The **Inventory Foundation** layer is the authoritative source of truth for all stock levels in ECOS-ERP. It introduces two new concepts:

1. **`InventoryItem`** — aggregate root representing current stock state for a (warehouse, product) pair.
2. **`StockLedgerEntry`** — immutable, append-only audit log of every stock mutation.

This module lives in `Modules/Inventory/InventoryItems/` and is intentionally **decoupled** from WooCommerce, Orders, and Manufacturing. External modules integrate via `reference_type` / `reference_id` — never direct foreign keys into domain tables they don't own.

---

## Database Schema (ERD)

```
companies (existing)
    │
    ├─── warehouses (existing)
    │        │
    │        └─── inventory_items ─────┐
    │                  │               │
    products (existing)┘               │
                                       │
                        stock_ledger_entries
                           (FK: inventory_item_id)
```

### `inventory_items`

| Column         | Type            | Notes                                    |
|----------------|-----------------|------------------------------------------|
| id             | uuid PK         | HasUuids                                 |
| warehouse_id   | uuid FK         | → warehouses (restrictOnDelete)          |
| product_id     | uuid FK         | → products (restrictOnDelete)            |
| company_id     | uuid FK         | → companies (restrictOnDelete)           |
| on_hand_qty    | decimal(15,4)   | Physical stock present                   |
| reserved_qty   | decimal(15,4)   | Allocated to unfulfilled orders          |
| deleted_at     | timestamp       | SoftDeletes                              |
| created_at     | timestamp       |                                          |
| updated_at     | timestamp       |                                          |

**Unique constraint**: `(warehouse_id, product_id)` — one row per location.

**Computed accessor** (not stored): `available_qty = on_hand_qty − reserved_qty`

### `stock_ledger_entries`

| Column             | Type          | Notes                                       |
|--------------------|---------------|---------------------------------------------|
| id                 | uuid PK       | HasUuids                                    |
| inventory_item_id  | uuid FK       | → inventory_items (restrictOnDelete)        |
| warehouse_id       | uuid FK       | Denormalized for reporting                  |
| product_id         | uuid FK       | Denormalized for reporting                  |
| company_id         | uuid FK       | Denormalized for reporting                  |
| movement_type      | string        | `LedgerMovementType` enum value             |
| quantity           | decimal(15,4) | Always positive                             |
| on_hand_before     | decimal(15,4) |                                             |
| on_hand_after      | decimal(15,4) |                                             |
| reserved_before    | decimal(15,4) |                                             |
| reserved_after     | decimal(15,4) |                                             |
| reference_type     | string?       | e.g. `goods_receipt`, `order`               |
| reference_id       | uuid?         | ID in the owning module's table             |
| notes              | text?         |                                             |
| created_at         | timestamp     | Immutable — no `updated_at`                 |

---

## Movement Type Enum (`LedgerMovementType`)

| Case                | Value                | Affects On-Hand | Affects Reserved |
|---------------------|----------------------|-----------------|------------------|
| PurchaseReceipt     | purchase_receipt     | +               |                  |
| SalesIssue          | sales_issue          | −               | −                |
| Reservation         | reservation          |                 | +                |
| ReservationRelease  | reservation_release  |                 | −                |
| AdjustmentIn        | adjustment_in        | +               |                  |
| AdjustmentOut       | adjustment_out       | −               |                  |
| TransferIn          | transfer_in          | +               |                  |
| TransferOut         | transfer_out         | −               |                  |

---

## Aggregate State Diagram

```
         ReceiveStockAction
         (+on_hand_qty)
              │
              ▼
┌─────────────────────────┐
│     InventoryItem       │
│  on_hand_qty:  Q        │──── availableQty() = on_hand_qty − reserved_qty
│  reserved_qty: R        │
└─────────────────────────┘
       │           │
       │           ReserveStockAction (+reserved_qty, requires available ≥ qty)
       │           │
       │           ReleaseStockAction (−reserved_qty)
       │
       ShipStockAction (−on_hand_qty, −reserved_qty clamped to 0)
```

---

## Reservation Workflow

```
Order Created
     │
     ▼
ReserveStockAction.execute(StockOperationDTO)
     │  checks: available_qty >= requested_qty
     │  throws: InsufficientStockException (422) if not
     │
     ├── InventoryItem.reserved_qty += qty   (lockForUpdate)
     │
     └── StockLedgerEntry(movement_type: reservation, reference_type: 'order', reference_id: order.id)

Order Cancelled
     │
     ▼
ReleaseStockAction.execute(StockOperationDTO)
     ├── InventoryItem.reserved_qty -= qty
     └── StockLedgerEntry(movement_type: reservation_release)
```

---

## Shipment Workflow

```
Shipment Confirmed
     │
     ▼
ShipStockAction.execute(StockOperationDTO)
     │  checks: on_hand_qty >= requested_qty
     │  throws: InsufficientStockException (422) if not
     │
     ├── InventoryItem.on_hand_qty  -= qty
     ├── InventoryItem.reserved_qty  = max(0, reserved_qty − qty)
     │
     └── StockLedgerEntry(movement_type: sales_issue)
```

---

## Domain Actions (Application Layer)

| Action                  | Input          | Guards                                    |
|-------------------------|----------------|-------------------------------------------|
| `ReceiveStockAction`    | StockOperationDTO | qty > 0                                |
| `ReserveStockAction`    | StockOperationDTO | qty > 0, available_qty ≥ qty           |
| `ReleaseStockAction`    | StockOperationDTO | qty > 0, reserved_qty ≥ qty            |
| `ShipStockAction`       | StockOperationDTO | qty > 0, on_hand_qty ≥ qty             |

All actions run inside `DB::transaction()` and acquire `lockForUpdate()` on the `InventoryItem` row to prevent race conditions under concurrent requests.

---

## Domain Exceptions

| Exception                          | HTTP | Trigger                                    |
|------------------------------------|------|--------------------------------------------|
| `InsufficientStockException`       | 422  | Reserve/Ship qty exceeds available/on-hand |
| `NegativeInventoryException`       | 422  | Release qty exceeds current reservation    |
| `InvalidInventoryMovementException`| 422  | qty ≤ 0, missing inventory record          |

---

## Architecture Rules

- **No WooCommerce imports** in this module. WooCommerce triggers operations via `reference_type: 'woocommerce_order'`.
- **No Orders imports.** Orders call `ReserveStockAction` / `ShipStockAction` — the action does not know about `Order` models.
- **No Manufacturing imports.** Manufacturing will call `ReceiveStockAction` via `reference_type: 'production_order'` in a future task.
- `reference_type` + `reference_id` is the only coupling point between this module and the outside world.

---

## Future Integration Points

| Future Module     | How it integrates                                                   |
|-------------------|---------------------------------------------------------------------|
| Orders            | `ReserveStockAction(reference_type: 'order', reference_id: $order->id)` |
| Fulfillments      | `ShipStockAction(reference_type: 'fulfillment', reference_id: $fulfillment->id)` |
| Manufacturing     | `ReceiveStockAction(reference_type: 'production_order', ...)` (finished goods) |
|                   | `ShipStockAction(reference_type: 'production_order', ...)` (raw material consumption) |
| Stock Adjustments | Direct calls to `ReceiveStockAction` / `ShipStockAction` with `reference_type: 'adjustment'` |
| Warehouse Transfers | Pair of `ShipStockAction` (source) + `ReceiveStockAction` (destination) |

---

## Files

```
Modules/Inventory/InventoryItems/
├── Domain/
│   ├── Enums/LedgerMovementType.php
│   ├── Exceptions/
│   │   ├── InsufficientStockException.php
│   │   ├── NegativeInventoryException.php
│   │   └── InvalidInventoryMovementException.php
│   ├── Models/
│   │   ├── InventoryItem.php
│   │   └── StockLedgerEntry.php
│   └── Contracts/InventoryItemRepositoryInterface.php
├── Application/
│   ├── DTO/StockOperationDTO.php
│   ├── Actions/
│   │   ├── ReceiveStockAction.php
│   │   ├── ReserveStockAction.php
│   │   ├── ReleaseStockAction.php
│   │   └── ShipStockAction.php
│   └── Queries/
│       ├── GetInventorySummaryQuery.php
│       └── GetInventoryAvailabilityQuery.php
└── Infrastructure/
    ├── Repositories/EloquentInventoryItemRepository.php
    ├── Providers/InventoryItemServiceProvider.php
    └── Database/Migrations/
        ├── 2026_06_24_800000_create_inventory_items_table.php
        └── 2026_06_24_810000_create_stock_ledger_entries_table.php

tests/Feature/Inventory/InventoryReservationTest.php
```
