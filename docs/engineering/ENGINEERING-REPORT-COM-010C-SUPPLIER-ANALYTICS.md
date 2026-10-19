# Engineering Report — COM-010C Supplier Analytics Foundation

**Date:** 2026-06-25  
**Tickets:** COM-010C, COM-010A-R2A  
**Test results:** 62/62 passing (150 assertions)  
**TypeScript:** Clean (0 errors)

---

## Deliverables Completed

### 1. Migrations

| File | Description |
|---|---|
| `2026_06_25_230000_add_paid_amount_to_goods_receipts_table.php` | `paid_amount decimal(15,2) DEFAULT 0` after `invoice_total_amount` |
| `2026_06_25_230001_create_inventory_receipt_layers_table.php` | New `inventory_receipt_layers` table with full FK set and composite indexes |
| `2026_06_25_230002_add_cost_intelligence_to_products_table.php` | `last_purchase_cost`, `average_cost`, `last_purchase_date`, `last_supplier_id` on `products` |

### 2. InventoryReceiptLayer Aggregate

New module: `Modules/Inventory/ReceiptLayers/`

- Model with `HasUuids` (no `SoftDeletes` — financial record)
- Service provider registered in `bootstrap/providers.php`
- `CreateReceiptLayersAction` runs inside `PostGoodsReceiptAction`'s DB transaction as Step 6 (after Step 5: receipt posted)
- Per-line: creates layer + updates product cost intelligence (weighted average)

**Critical timing:** On-hand quantities are snapshotted from `InventoryItem` **before** the DB transaction, so the weighted average denominator reflects pre-receipt stock.

### 3. Product Cost Intelligence

Updated `Product` model with:
- `last_purchase_cost` — most recent landed unit cost
- `average_cost` — weighted running average, updated on every posted GR
- `last_purchase_date` — most recent receipt date
- `last_supplier_id` — no FK (historical, survives supplier deletion)

Weighted average formula: `(old_qty × old_avg + new_qty × new_cost) / (old_qty + new_qty)`

### 4. Supplier Analytics Queries

`GetSupplierAnalyticsQuery` — single-supplier aggregate:
- `total_purchases`, `total_invoiced`, `total_paid`, `outstanding_balance`, `last_purchase_date`
- `current_inventory_quantity`, `current_inventory_cost_value`, `current_inventory_sale_value`, `potential_gross_profit`

`GetSupplierInventoryBreakdownQuery` — per-product breakdown:
- Grouped from `inventory_receipt_layers` joined with `products`
- Fields: `remaining_quantity`, `cost_value`, `sale_value`, `gross_profit`, `avg_cost`, `sale_price`, `receipt_count`, date range

### 5. API Endpoints

```
GET /api/suppliers/{supplier}/analytics          → SupplierAnalyticsController@analytics
GET /api/suppliers/{supplier}/inventory-breakdown → SupplierAnalyticsController@inventoryBreakdown
```

Both protected by `auth:sanctum`.

### 6. COM-010A-R2A: paid_amount Enhancement

- `paid_amount decimal(15,2) DEFAULT 0` added to `goods_receipts`
- `GoodsReceipt::outstandingAmount()` — `max(0, invoice_total - paid_amount)`
- `GoodsReceipt::derivePaymentStatus()` — static, used by both Create and Update actions
- Both Form Requests validate: `['nullable', 'numeric', 'min:0', 'lte:invoice_total_amount']`
- `GoodsReceiptResource` exposes `paid_amount` and `outstanding_amount`
- `GoodsReceiptDTO` has `paid_amount: float = 0.0` default parameter

### 7. Frontend

**Goods Receipt form:**
- `paid_amount` numeric input added to Invoice Financials section (5-column grid: total, paid, freight, tax, additional)
- View page Payment Information card shows `paid_amount` and `outstanding_amount` (amber highlight when > 0)
- i18n: EN + AR keys for `paidAmount` and `outstandingAmount`

**Supplier detail page (`/suppliers/:id`):**
- Two stat-card rows: Purchasing Summary + Inventory Summary
- Inventory breakdown table with per-product cost/sale/profit data
- `useSupplierQuery` hook added to `use-suppliers.ts`
- Route registered: `{ path: '/suppliers/:id', Component: ViewSupplierPage }`
- i18n: EN + AR `detail` namespace with all dashboard labels

### 8. Tests

`tests/Feature/Purchasing/SupplierAnalyticsTest.php` — 15 tests, 39 assertions covering:
- Receipt layer creation and field correctness
- `costValue()` / `saleValue()` methods
- Product cost intelligence (last_purchase_cost, first avg, weighted avg)
- `GetSupplierAnalyticsQuery` — totals, paid, outstanding, inventory, profit
- `GetSupplierInventoryBreakdownQuery` — per-product breakdown
- `derivePaymentStatus` — all three branches
- `outstandingAmount` accessor via GoodsReceipt factory

---

## FIFO & Accounting Readiness Assessment

### FIFO

The `remaining_qty` field is the consumption hook. When FIFO is implemented:
1. On each stock shipment, find the oldest layer(s) for the product/warehouse/supplier
2. Decrement `remaining_qty` chronologically until the shipment is consumed
3. The `receipt_date` index supports efficient FIFO ordering

**No changes needed** to the layer creation logic — the hook is already in place.

### Accounting / AP Ledger

Current `outstanding_balance` is `SUM(invoice_total) - SUM(paid_amount)` across posted GRs. This is a simple cash-basis view.

When an AP module is added:
- Journal entries would replace direct `paid_amount` updates
- `outstanding_balance` would come from the AP ledger instead of GR aggregation
- The GR `paid_amount` field and `payment_status` enum can coexist or be deprecated — they serve as a lightweight record until AP is wired

---

## Tech Debt

| ID | Item | Priority |
|---|---|---|
| TD-001 | `last_supplier_id` has no FK — orphaned if supplier is hard-deleted | Low |
| TD-002 | Products without `sale_price` produce `sale_value = 0` silently | Low |
| TD-003 | FIFO consumption not implemented | Future |
| TD-004 | AP ledger not wired — `outstanding_balance` is approximate | Future |
