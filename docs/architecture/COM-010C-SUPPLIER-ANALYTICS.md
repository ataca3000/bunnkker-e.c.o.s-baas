# COM-010C — Supplier Analytics Foundation

**Status:** Complete  
**Date:** 2026-06-25  
**Scope:** Inventory receipt layer aggregate, product cost intelligence, supplier analytics queries, paid_amount enhancement (R2A)

---

## Overview

COM-010C adds a supplier analytics foundation layer to ECOS-ERP. It creates a new `InventoryReceiptLayer` aggregate that tracks inventory provenance — which supplier it came from, at what cost, and how much remains. On top of this foundation the system exposes supplier-facing analytics: purchasing totals, outstanding balances, inventory value, sale value, and potential gross profit.

### Architecture Constraint

This feature is strictly **read-model / reporting**. There is no:
- Accounting, AP ledger, or journal entries
- FIFO consumption (the `remaining_qty` field is the hook, not an active decrement)
- Financial transactions

---

## Part 1: InventoryReceiptLayer Aggregate

### Location
`Modules/Inventory/ReceiptLayers/`

### Table: `inventory_receipt_layers`

| Column | Type | Description |
|---|---|---|
| `id` | uuid PK | |
| `supplier_id` | uuid FK → suppliers | |
| `product_id` | uuid FK → products | |
| `goods_receipt_id` | uuid FK → goods_receipts | |
| `goods_receipt_line_id` | uuid FK → goods_receipt_lines | |
| `warehouse_id` | uuid FK → warehouses | |
| `received_qty` | decimal(15,4) | Set at creation, never changes |
| `remaining_qty` | decimal(15,4) | FIFO hook — starts equal to received_qty |
| `landed_unit_cost` | decimal(15,4) | Includes distributed freight/tax/etc. |
| `sale_price_snapshot` | decimal(15,2) nullable | Product sale_price at receipt time |
| `receipt_date` | date | |

**No SoftDeletes** — financial record; deletion is prohibited at the application level.

**Indexes:** composite `(supplier_id, product_id)` and `(supplier_id, remaining_qty)` for analytics queries.

### Creation Trigger

A layer is created for each goods receipt line in `PostGoodsReceiptAction → CreateReceiptLayersAction` (Step 5, inside the DB transaction, after landed_unit_cost is stamped):

```
PostGoodsReceiptAction
  └─ DB::transaction
       ├─ Step 1: ReceiveStockAction (increments on_hand_qty)
       ├─ Step 2: stamp landed_unit_cost per line
       ├─ Step 3: increment PO line received_qty
       ├─ Step 4: advance PO status
       ├─ Step 5: stamp receipt as Posted
       └─ Step 6: CreateReceiptLayersAction (create layers + update product cost intel)
```

**Why Step 6 is last:** `landed_unit_cost` is needed on the receipt lines to populate `landed_unit_cost` on layers. The `$receipt->refresh()` call reloads the lines with their stamped cost before CreateReceiptLayersAction runs.

### FIFO Readiness

`remaining_qty` is initialized to `received_qty`. When FIFO is implemented, consumption will decrement `remaining_qty` per layer chronologically. No change is needed to the layer creation logic.

---

## Part 2: Product Cost Intelligence

Fields added to `products`:

| Column | Type | Description |
|---|---|---|
| `last_purchase_cost` | decimal(15,4) nullable | Landed unit cost from most recent posted GR |
| `average_cost` | decimal(15,4) nullable | Weighted average across all receipts |
| `last_purchase_date` | date nullable | receipt_date of most recent posted GR |
| `last_supplier_id` | uuid nullable | No FK (historical reference, supplier may be deleted) |

### Weighted Average Cost Algorithm

```
new_avg = (old_qty × old_avg + new_qty × new_landed_cost) / (old_qty + new_qty)
```

`old_qty` is snapshotted from `InventoryItem.on_hand_qty` **before** the DB transaction begins (i.e., before ReceiveStockAction increments it). This is critical — if you read `on_hand_qty` after ReceiveStockAction, the denominator would already include the new quantity, producing an incorrect result.

---

## Part 3: Supplier Analytics Service

### GetSupplierAnalyticsQuery

**Location:** `Modules/Purchasing/Suppliers/Application/Queries/GetSupplierAnalyticsQuery.php`

**Aggregates:**

| Field | Source |
|---|---|
| `total_purchases` | COUNT of posted GRs via PO.supplier_id |
| `total_invoiced` | SUM(invoice_total_amount) on posted GRs |
| `total_paid` | SUM(paid_amount) on posted GRs |
| `outstanding_balance` | total_invoiced − total_paid |
| `last_purchase_date` | MAX(receipt_date) on posted GRs |
| `current_inventory_quantity` | SUM(remaining_qty) from layers where remaining_qty > 0 |
| `current_inventory_cost_value` | SUM(remaining_qty × landed_unit_cost) |
| `current_inventory_sale_value` | SUM(remaining_qty × sale_price_snapshot) |
| `potential_gross_profit` | sale_value − cost_value |

### GetSupplierInventoryBreakdownQuery

**Location:** `Modules/Purchasing/Suppliers/Application/Queries/GetSupplierInventoryBreakdownQuery.php`

Returns per-product rows grouped from `inventory_receipt_layers` joined with `products`. Excludes products with zero remaining qty. Ordered by `cost_value DESC`.

---

## Part 4: API Endpoints

```
GET /api/suppliers/{supplier}/analytics
GET /api/suppliers/{supplier}/inventory-breakdown
```

Both require `auth:sanctum`. Controller: `SupplierAnalyticsController`.

---

## Part 5: COM-010A-R2A — paid_amount Enhancement

### Migration

Added `paid_amount decimal(15,2) DEFAULT 0` to `goods_receipts` after `invoice_total_amount`.

### Model Changes (GoodsReceipt)

- `paid_amount` in `$fillable` and `casts` (decimal:2)
- `outstandingAmount(): float` — `max(0, invoice_total_amount - paid_amount)`
- `derivePaymentStatus(float $paid, float $total): string` — static method used by Create/Update actions

### Auto-sync Logic

Both `CreateGoodsReceiptAction` and `UpdateGoodsReceiptAction` compute `payment_status` from `paid_amount` via `GoodsReceipt::derivePaymentStatus()` unless the caller explicitly passes a `payment_status` override.

| paid_amount | payment_status |
|---|---|
| 0 | `unpaid` |
| 0 < x < total | `partially_paid` |
| x >= total (total > 0) | `paid` |

---

## Part 6: Frontend

### Supplier Analytics Page
`/suppliers/:id` → `ViewSupplierPage`

Dashboard showing:
- Purchasing summary (stat cards): total_purchases, total_invoiced, total_paid, outstanding_balance, last_purchase_date
- Inventory summary (stat cards): current_inventory_quantity, cost_value, sale_value, potential_gross_profit
- Inventory breakdown table: per-product remaining_quantity, avg_cost, sale_price, cost_value, sale_value, gross_profit

### Goods Receipt Form
- `paid_amount` field added to Invoice Financials section
- View page shows `paid_amount` and `outstanding_amount` in Payment Information card

---

## Tech Debt / Future Work

| Item | Note |
|---|---|
| FIFO consumption | Decrement `remaining_qty` in layers when inventory ships |
| AP ledger integration | `outstanding_balance` is now computed from GR paid_amount; a real AP module would use journal entries |
| `last_supplier_id` FK-less | No FK by design (supplier deletion safety), but no cascade cleanup |
| `sale_price_snapshot` NULL rows | Products without sale_price produce `sale_value = 0`; no alert |
| Layer on GR update | Currently layers are created only at post time; if a draft GR is deleted, no layers exist — correct |

---

## File Manifest

### Backend (new)
- `Modules/Inventory/ReceiptLayers/Domain/Models/InventoryReceiptLayer.php`
- `Modules/Inventory/ReceiptLayers/Application/Actions/CreateReceiptLayersAction.php`
- `Modules/Inventory/ReceiptLayers/Infrastructure/Providers/ReceiptLayersServiceProvider.php`
- `Modules/Inventory/ReceiptLayers/Infrastructure/Database/Migrations/2026_06_25_230001_create_inventory_receipt_layers_table.php`
- `Modules/Purchasing/Suppliers/Application/Queries/GetSupplierAnalyticsQuery.php`
- `Modules/Purchasing/Suppliers/Application/Queries/GetSupplierInventoryBreakdownQuery.php`
- `Modules/Purchasing/Suppliers/Presentation/Http/Controllers/SupplierAnalyticsController.php`
- `Modules/Purchasing/Suppliers/Presentation/Http/Resources/SupplierAnalyticsResource.php`
- `Modules/Purchasing/Suppliers/Presentation/Http/Resources/SupplierInventoryProductResource.php`
- `tests/Feature/Purchasing/SupplierAnalyticsTest.php`

### Backend (modified)
- `Modules/Purchasing/GoodsReceipts/Application/Actions/PostGoodsReceiptAction.php` — Step 6 + pre-receipt qty snapshot
- `Modules/Purchasing/GoodsReceipts/Application/Actions/CreateGoodsReceiptAction.php` — paid_amount + derivePaymentStatus
- `Modules/Purchasing/GoodsReceipts/Application/Actions/UpdateGoodsReceiptAction.php` — paid_amount + derivePaymentStatus
- `Modules/Purchasing/GoodsReceipts/Application/DTO/GoodsReceiptDTO.php` — paid_amount param
- `Modules/Purchasing/GoodsReceipts/Domain/Models/GoodsReceipt.php` — paid_amount, outstandingAmount, derivePaymentStatus
- `Modules/Inventory/Products/Domain/Models/Product.php` — cost intelligence fields
- `Modules/Purchasing/GoodsReceipts/Presentation/Http/Requests/StoreGoodsReceiptRequest.php` — paid_amount rule
- `Modules/Purchasing/GoodsReceipts/Presentation/Http/Requests/UpdateGoodsReceiptRequest.php` — paid_amount rule
- `Modules/Purchasing/GoodsReceipts/Presentation/Http/Resources/GoodsReceiptResource.php` — paid_amount, outstanding_amount
- `bootstrap/providers.php` — ReceiptLayersServiceProvider
- `routes/api.php` — analytics routes

### Frontend (new)
- `features/suppliers/types/supplier-analytics.ts`
- `features/suppliers/services/supplier-analytics-service.ts`
- `features/suppliers/hooks/use-supplier-analytics.ts`
- `features/suppliers/pages/view-supplier-page.tsx`

### Frontend (modified)
- `features/goods-receipts/types/goods-receipt.ts` — paid_amount, outstanding_amount
- `features/goods-receipts/components/goods-receipt-form-schema.ts` — paid_amount
- `features/goods-receipts/components/goods-receipt-header-fields.tsx` — paid_amount field
- `features/goods-receipts/pages/view-goods-receipt-page.tsx` — paid_amount + outstanding_amount display
- `features/suppliers/hooks/use-suppliers.ts` — useSupplierQuery
- `router/routes.ts` — supplierDetail
- `router/router.ts` — ViewSupplierPage route
- `i18n/locales/en/goods-receipts.json` — paidAmount, outstandingAmount
- `i18n/locales/ar/goods-receipts.json` — paidAmount, outstandingAmount
- `i18n/locales/en/suppliers.json` — detail section
- `i18n/locales/ar/suppliers.json` — detail section
