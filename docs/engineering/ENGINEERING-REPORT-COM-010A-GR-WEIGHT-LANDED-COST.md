# Engineering Report: COM-010A — Goods Receipt Real Weight & Landed Cost

**Date:** 2026-06-25  
**Module:** `Modules/Purchasing/GoodsReceipts`  
**Status:** Complete — 14/14 tests passing (34 assertions)

---

## Objective

Enhance the existing Goods Receipt module to support:

1. **Supplier invoice capture** — invoice number, date, and file attachment (PDF/JPG/JPEG/PNG)
2. **Dual-quantity tracking** — gross received (before deductions) vs. net received (actual inventory quantity)
3. **Variance recording** — net vs. ordered quantity (warning-only, non-blocking)
4. **Per-line weight photos** — scale evidence per receipt line
5. **Landed cost calculation** — shipping, taxes, and other costs distributed proportionally to `landed_unit_cost` per line at post time

**Architecture constraint honoured:** no changes to Inventory foundation logic, `ReceiveStockAction` interface unchanged except the quantity value passed.

---

## Database Changes

### Migration 1 — `goods_receipts` header fields

```
2026_06_25_200000_add_invoice_and_landed_cost_fields_to_goods_receipts_table.php
```

| Column | Type | Default | Purpose |
|---|---|---|---|
| `supplier_invoice_number` | varchar(255) nullable | — | Audit linkage |
| `supplier_invoice_date` | date nullable | — | Invoice date |
| `invoice_attachment_path` | varchar(255) nullable | — | Storage path on public disk |
| `shipping_amount` | decimal(15,2) | 0 | Landed cost component |
| `taxes_amount` | decimal(15,2) | 0 | Landed cost component |
| `other_costs_amount` | decimal(15,2) | 0 | Landed cost component |

### Migration 2 — `goods_receipt_lines` quantity + cost fields

```
2026_06_25_200001_add_weight_qty_and_landed_cost_to_goods_receipt_lines_table.php
```

| Column | Type | Default | Purpose |
|---|---|---|---|
| `gross_received_quantity` | decimal(15,4) nullable | — | Before deductions |
| `net_received_quantity` | decimal(15,4) nullable | — | Inventory update source |
| `variance_quantity` | decimal(15,4) nullable | — | net − ordered (computed at save) |
| `unit_price` | decimal(15,2) | 0 | Copied from PO line at create |
| `landed_unit_cost` | decimal(15,4) nullable | — | Stamped at post time |
| `weight_photo_path` | varchar(255) nullable | — | Per-line scale photo |
| `notes` | text nullable | — | Free-form line notes |

**Backward compatibility:** `received_quantity` column retained. New code writes both `received_quantity` AND `net_received_quantity`. `effectiveReceivedQty()` returns `net_received_quantity ?? received_quantity ?? 0`, so existing draft GRs without the new fields post correctly.

---

## Domain Logic

### `GoodsReceipt::totalLandedCosts(): float`

```php
return (float)($this->shipping_amount + $this->taxes_amount + $this->other_costs_amount);
```

### `GoodsReceiptLine::effectiveReceivedQty(): float`

```php
return (float)($this->net_received_quantity ?? $this->received_quantity ?? 0);
```

### Landed Cost Distribution (PostGoodsReceiptAction)

Applied at post time, not at draft creation:

```
total_extra_costs = shipping + taxes + other_costs
total_net_qty     = Σ effectiveReceivedQty() across active lines
extra_per_unit    = total_extra_costs / total_net_qty   (0 if total_net_qty = 0)
landed_unit_cost  = unit_price + extra_per_unit         (per line)
```

Distribution is **equal per net unit**, not weighted by line value. This matches standard procurement costing practice and keeps the formula simple to audit.

### Inventory Update Source

`ReceiveStockAction` receives `effectiveReceivedQty()` — the net quantity. Gross quantity is never passed to inventory. `PurchaseOrderLine.received_qty` is incremented by the same net value.

---

## Domain Rules Enforced

| Rule | Enforcement | Blocking? |
|---|---|---|
| `net_received_quantity > 0` | Zod + Laravel validation (min:0.0001) | Yes |
| `gross_received_quantity >= net_received_quantity` | Zod `.refine()` + Laravel `lte:` rule | Yes |
| `ordered_quantity > 0` | Existing PO domain constraint | Yes |
| `net != ordered` (variance) | Warning-only: stored as `variance_quantity`, not blocking | No |
| Cannot post with zero active lines | Guard in `PostGoodsReceiptAction` | Yes |
| Cannot double-post | Guard in `PostGoodsReceiptAction` | Yes |

---

## File Uploads

| Asset | Storage Path | Disk | Max Size | MIME |
|---|---|---|---|---|
| Invoice attachment | `goods-receipts/invoices/` | public | 10 MB | pdf, jpg, jpeg, png |
| Weight photo (per line) | `goods-receipts/weight-photos/` | public | 5 MB | jpg, jpeg, png |

**Multipart uploads:** `PUT` via `POST ?_method=PUT` (Laravel method spoofing) for multipart/form-data compatibility. Frontend builds `FormData` with `lines[{i}][weight_photo]` keys. Controller extracts via `$request->file("lines.{$index}.weight_photo")`.

---

## API Changes

### `POST /api/purchasing/goods-receipts` — new fields accepted
- Header: `supplier_invoice_number`, `supplier_invoice_date`, `invoice_attachment` (file), `shipping_amount`, `taxes_amount`, `other_costs_amount`
- Lines: `gross_received_quantity` (required), `net_received_quantity` (required, ≤ gross), `weight_photo` (file), `notes`

### `PUT /api/purchasing/goods-receipts/{id}` (via POST + `_method=PUT`)
- Same as above plus `invoice_attachment_path` and `lines.*.weight_photo_path` to preserve existing files

### Resource responses — new fields
- GoodsReceipt: all invoice fields, `invoice_attachment_url`, all landed cost amounts, `total_landed_costs`, `posted_by`, `posted_at`
- GoodsReceiptLine: `gross_received_quantity`, `net_received_quantity`, `variance_quantity`, `unit_price`, `landed_unit_cost`, `weight_photo_path`, `weight_photo_url`, `notes`

---

## Frontend Changes

### New UI Sections (GoodsReceiptHeaderFields)
1. **Supplier Invoice** — invoice number input, date input, file picker with preview/clear/view links
2. **Landed Costs** — shipping / taxes / other costs in a 3-column responsive grid

### Rewritten Lines Editor (GoodsReceiptLinesEditor)
New columns: Ordered Qty (read-only), Gross Qty, Net Qty, Variance (color-coded, non-blocking), Weight Photo button, Notes.

- Variance shown with `+` prefix for over-receipt, amber for under, green for over
- Weight photo button turns green when a photo is staged, shows `×` to clear

### View Page additions
- Invoice attachment card (shown when `invoice_attachment_url` present)
- Landed Cost Summary card — DL grid with shipping/taxes/other/total/net-qty/extra-per-unit, and a per-line table (unit price → net qty → landed unit cost) shown only when status = `posted`

---

## Test Coverage

| Test | What it verifies |
|---|---|
| `post_receipt_updates_inventory_using_net_received_quantity` | Stock receives NET qty, not gross |
| `post_computes_landed_unit_cost` | `landed_unit_cost = unit_price + (extra / total_net)` |
| `post_with_no_extra_costs_landed_unit_cost_equals_unit_price` | Zero-extra path |
| `gross_qty_field_stored_separately_from_net` | Both columns stored correctly |
| `post_receipt_updates_inventory_and_advances_po_to_received` | Full happy-path post |
| `partial_receipt_advances_po_to_partially_received` | Partial fulfillment status |
| `multiple_partial_receipts_complete_po` | Multi-receipt completion |
| `over_receipt_throws_exception` | Guard against exceeding ordered qty |
| `over_receipt_across_multiple_receipts_throws` | Cumulative over-receipt |
| `duplicate_posting_throws_already_posted_exception` | Idempotency guard |
| `posting_empty_receipt_throws` | Zero-line guard |
| `posting_against_cancelled_po_throws` | PO status guard |
| `posting_against_closed_po_throws` | PO status guard |
| `inventory_not_updated_for_zero_net_quantity_lines` | Zero-net filter |

**Result: 14/14 passed, 34 assertions**

---

## Technical Debt / Known Limitations

| Item | Severity | Notes |
|---|---|---|
| Landed cost distribution is equal-per-unit, not value-weighted | Low | Acceptable for current stage; value-weighted would require a second pass |
| `variance_quantity` is informational only | Low | Future: configurable tolerance rules per supplier |
| File storage is local (`public` disk) | Medium | Production: switch to S3-compatible driver; path structure is already abstracted |
| No landed cost recalculation on GR edit | Low | If costs change on a draft, user must re-post; by design (post is irreversible) |

---

## Readiness for COM-010B

This enhancement does not gate COM-010B (Supplier Price Lists / Agreement Matching). The `unit_price` now stored on `goods_receipt_lines` will enable price-variance analysis in future milestones. All new columns are additive; no existing interfaces were broken.
