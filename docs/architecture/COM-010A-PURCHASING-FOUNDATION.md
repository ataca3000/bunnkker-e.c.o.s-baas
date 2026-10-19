# COM-010A — Purchasing Foundation & Goods Receipt Architecture

## Overview

The Purchasing Foundation provides a complete purchase-to-receipt workflow:

**Purchase Order** → approval workflow → **Goods Receipt** (multiple, partial) → **Inventory Update** via ReceiveStockAction

All inventory changes flow exclusively through `ReceiveStockAction`. The Purchasing module has no direct dependency on WooCommerce, Orders, or Manufacturing.

---

## ERD

```
companies (existing)
    │
    ├── warehouses (existing)
    │       │
    │       └── goods_receipts ──── goods_receipt_lines
    │                                      │
    │                                      └── purchase_order_lines
    │                                                │
    suppliers ──── purchase_orders ─────────────────┘
                         │
                         └── goods_receipts (via purchase_order_id)
```

### `purchase_orders`

| Column             | Type          | Notes                              |
|--------------------|---------------|------------------------------------|
| id                 | uuid PK       |                                    |
| po_number          | string unique | Auto-generated: PO-00001           |
| company_id         | uuid FK?      | → companies (nullable, back-compat)|
| warehouse_id       | uuid FK?      | Default warehouse (nullable)       |
| supplier_id        | uuid FK       | → suppliers                        |
| supplier_reference | string?       | Supplier's own PO number           |
| order_date         | date          |                                    |
| expected_date      | date?         |                                    |
| status             | string        | PurchaseOrderStatus enum           |
| subtotal           | decimal(15,2) |                                    |
| discount_amount    | decimal(15,2) |                                    |
| shipping_amount    | decimal(15,2) |                                    |
| additional_costs   | decimal(15,2) |                                    |
| grand_total        | decimal(15,2) |                                    |
| approved_by        | string?       |                                    |
| approved_at        | timestamp?    |                                    |
| notes              | text?         |                                    |
| timestamps + softDeletes |       |                                    |

### `purchase_order_lines`

| Column            | Type          | Notes                                  |
|-------------------|---------------|----------------------------------------|
| id                | uuid PK       |                                        |
| purchase_order_id | uuid FK       | → purchase_orders (cascadeOnDelete)    |
| product_id        | uuid FK       | → products                             |
| description       | string?       |                                        |
| quantity          | decimal(15,4) | Ordered quantity                       |
| received_qty      | decimal(15,4) | Cumulative received (default 0)        |
| unit_price        | decimal(15,2) |                                        |
| line_total        | decimal(15,2) |                                        |
| timestamps        |               |                                        |

`remaining_qty = quantity - received_qty` (computed accessor, not stored)

### `goods_receipts`

| Column            | Type          | Notes                                  |
|-------------------|---------------|----------------------------------------|
| id                | uuid PK       |                                        |
| receipt_number    | string unique | Auto-generated: GR-00001              |
| purchase_order_id | uuid FK       | → purchase_orders                     |
| warehouse_id      | uuid FK       | → warehouses                          |
| receipt_date      | date          |                                        |
| status            | string        | GoodsReceiptStatus enum               |
| posted_by         | string?       |                                        |
| posted_at         | timestamp?    | Stamped when posted                   |
| notes             | text?         |                                        |
| timestamps + softDeletes |       |                                        |

### `goods_receipt_lines`

| Column                  | Type          | Notes                           |
|-------------------------|---------------|---------------------------------|
| id                      | uuid PK       |                                 |
| goods_receipt_id        | uuid FK       | → goods_receipts (cascade)      |
| purchase_order_line_id  | uuid FK       | → purchase_order_lines          |
| product_id              | uuid FK       | → products                      |
| ordered_quantity        | decimal(15,4) | Snapshot of PO line quantity    |
| received_quantity       | decimal(15,4) | Received in this receipt        |
| timestamps              |               |                                 |

---

## Purchase Order Status State Machine

```
                  ┌──────────────────────────────────────────────┐
                  │                                              │
      Draft ──→ Submitted ──→ Approved ──→ PartiallyReceived ──→ Received ──→ Closed
        │           │
        └───────────┴──→ Cancelled
```

### Allowed Transitions

| From              | To                | Action                     | Guard                   |
|-------------------|-------------------|----------------------------|-------------------------|
| Draft             | Submitted         | SubmitPurchaseOrderAction  | status.canSubmit()      |
| Submitted         | Approved          | ApprovePurchaseOrderAction | status.canApprove()     |
| Draft, Submitted  | Cancelled         | CancelPurchaseOrderAction  | status.canCancel()      |
| Approved, PartiallyReceived | PartiallyReceived | PostGoodsReceiptAction | status.canReceive() |
| PartiallyReceived | Received          | PostGoodsReceiptAction     | all lines full          |
| Received          | Closed            | (future action)            |                         |

### Forbidden Transitions

| Attempt                   | Exception                          |
|---------------------------|------------------------------------|
| Draft → Approved directly | InvalidPurchaseOrderStatusException|
| Approved → Cancelled      | InvalidPurchaseOrderStatusException|
| Cancelled → Any           | InvalidPurchaseOrderStatusException|
| Closed → Any              | InvalidPurchaseOrderStatusException|

---

## Goods Receipt Status

```
Draft ──→ Posted (immutable)
```

Inventory changes ONLY when `status = Posted`. No intermediate mutations.

---

## Purchase Flow

```
1. CreatePurchaseOrderAction (DTO) → PO in Draft
2. SubmitPurchaseOrderAction(id)   → PO in Submitted
3. ApprovePurchaseOrderAction(id)  → PO in Approved + approved_at stamped
4. (repeat steps 5-7 for partial receipts)
5. CreateGoodsReceiptAction (DTO)  → GR in Draft
6. PostGoodsReceiptAction(id)      → GR Posted + inventory updated + PO status advanced
```

---

## Goods Receipt Flow (PostGoodsReceiptAction)

```
PostGoodsReceiptAction.execute(receipt_id)
    │
    ├── Guard 1: status === Draft?  No → GoodsReceiptAlreadyPostedException (422)
    │
    ├── Guard 2: PO status valid?
    │       Cancelled → PurchaseOrderCancelledException (422)
    │       Closed    → PurchaseOrderClosedException (422)
    │       Other     → InvalidPurchaseOrderStatusException (422)
    │
    ├── Guard 3: has active lines?  No → EmptyGoodsReceiptException (422)
    │
    └── DB::transaction()
            │
            ├── [for each line] lockForUpdate(purchase_order_line)
            │       received_qty + qty > ordered_qty → OverReceiptException (422)
            │
            ├── [for each line] ReceiveStockAction(warehouse, product, qty,
            │                       reference_type='goods_receipt',
            │                       reference_id=receipt_id)
            │
            ├── [for each line] purchase_order_line.received_qty += qty
            │
            ├── Reload all PO lines → all fully received?
            │       Yes → PO status = Received
            │       No  → PO status = PartiallyReceived
            │
            └── receipt.status = Posted, receipt.posted_at = now()
```

---

## Inventory Integration Diagram

```
PostGoodsReceiptAction
        │
        │  for each GR line (received_quantity > 0)
        ↓
ReceiveStockAction (Inventory module)
        │
        ├── findOrCreate InventoryItem (warehouse_id, product_id)
        ├── lockForUpdate(InventoryItem)
        ├── on_hand_qty += received_quantity
        ├── save InventoryItem
        └── StockLedgerEntry {
                movement_type:  purchase_receipt
                reference_type: goods_receipt
                reference_id:   <goods_receipt_uuid>
                on_hand_before: ...
                on_hand_after:  ...
            }
```

---

## Domain Exceptions

| Exception                          | HTTP | Trigger                                       |
|------------------------------------|------|-----------------------------------------------|
| InvalidPurchaseOrderStatusException| 422  | Invalid state transition attempt              |
| GoodsReceiptAlreadyPostedException | 422  | Posting a receipt that is already Posted      |
| EmptyGoodsReceiptException         | 422  | No lines with received_quantity > 0           |
| OverReceiptException               | 422  | Would exceed ordered_qty on a PO line         |
| PurchaseOrderClosedException       | 422  | Creating/posting GR against a Closed PO       |
| PurchaseOrderCancelledException    | 422  | Creating/posting GR against a Cancelled PO    |

---

## Application Actions

| Action                      | Module        | Transition / Effect                         |
|-----------------------------|---------------|---------------------------------------------|
| CreatePurchaseOrderAction   | PurchaseOrders| → Draft PO                                  |
| SubmitPurchaseOrderAction   | PurchaseOrders| Draft → Submitted                           |
| ApprovePurchaseOrderAction  | PurchaseOrders| Submitted → Approved                        |
| CancelPurchaseOrderAction   | PurchaseOrders| Draft/Submitted → Cancelled                 |
| UpdatePurchaseOrderAction   | PurchaseOrders| Draft only (isEditable)                     |
| CreateGoodsReceiptAction    | GoodsReceipts | → Draft GR (PO must be Approved/PartialReceived)|
| PostGoodsReceiptAction      | GoodsReceipts | Draft → Posted + inventory updated          |

---

## Architecture Rules

- Purchasing module does NOT import: `WooCommerce`, `Orders`, `Commerce`, `Manufacturing`
- Inventory is updated ONLY via `ReceiveStockAction`
- No direct writes to `inventory_items` or `stock_ledger_entries`
- `reference_type = 'goods_receipt'` / `reference_id = <uuid>` on every ledger entry

---

## Future Accounting Integration Points

| Event                        | Future Hook                                         |
|------------------------------|-----------------------------------------------------|
| PO Approved                  | Create Purchase Commitment journal entry            |
| GR Posted                    | Debit Inventory / Credit Accrued Payables           |
| Supplier Invoice matched to GR | Debit Accrued Payables / Credit Accounts Payable |
| Payment issued               | Debit Accounts Payable / Credit Cash/Bank           |

No accounting logic is implemented yet. The `posted_at` and `approved_at` timestamps on GR and PO provide the necessary audit trail for future integration.

---

## Files Created / Modified

```
Modules/Purchasing/PurchaseOrders/
├── Domain/
│   ├── Enums/PurchaseOrderStatus.php          (updated: +4 statuses, +5 transition methods)
│   ├── Models/
│   │   ├── PurchaseOrder.php                  (updated: +company_id, +warehouse_id, +financial fields)
│   │   └── PurchaseOrderLine.php              (updated: +received_qty, +description, +remainingQty())
│   └── Exceptions/
│       └── InvalidPurchaseOrderStatusException.php  (new)
├── Application/Actions/
│   ├── SubmitPurchaseOrderAction.php          (new)
│   ├── ApprovePurchaseOrderAction.php         (updated: Submitted→Approved)
│   └── CancelPurchaseOrderAction.php          (updated: guarded transitions)
└── Infrastructure/
    ├── Database/
    │   ├── Factories/PurchaseOrderFactory.php       (new)
    │   ├── Factories/PurchaseOrderLineFactory.php   (new)
    │   └── Migrations/
    │       ├── 2026_06_25_100000_add_fields_to_purchase_orders_table.php
    │       └── 2026_06_25_100001_add_received_qty_to_purchase_order_lines_table.php

Modules/Purchasing/GoodsReceipts/
├── Domain/
│   ├── Models/GoodsReceipt.php                (updated: +posted_by, +posted_at)
│   └── Exceptions/
│       ├── OverReceiptException.php           (new)
│       ├── GoodsReceiptAlreadyPostedException.php  (new)
│       ├── EmptyGoodsReceiptException.php     (new)
│       ├── PurchaseOrderClosedException.php   (new)
│       └── PurchaseOrderCancelledException.php (new)
├── Application/Actions/
│   ├── PostGoodsReceiptAction.php             (complete rewrite: ReceiveStockAction integration)
│   └── CreateGoodsReceiptAction.php           (updated: allow PartiallyReceived PO)
└── Infrastructure/
    ├── Database/
    │   ├── Factories/GoodsReceiptFactory.php      (new)
    │   ├── Factories/GoodsReceiptLineFactory.php  (new)
    │   └── Migrations/
    │       └── 2026_06_25_100002_add_posted_fields_to_goods_receipts_table.php

tests/Feature/Purchasing/
├── PurchaseOrderTest.php     (new: 10 tests)
└── GoodsReceiptTest.php      (new: 10 tests)

docs/architecture/COM-010A-PURCHASING-FOUNDATION.md  (new)
```
