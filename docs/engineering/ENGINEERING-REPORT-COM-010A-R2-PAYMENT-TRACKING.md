# Engineering Report: COM-010A-R2 — Supplier Invoice & Payment Tracking

**Date:** 2026-06-25  
**Module:** `Modules/Purchasing/GoodsReceipts`  
**Status:** Complete — 21/21 tests passing (46 assertions)

---

## Objective

Extend the Goods Receipt header with supplier invoice financial data and payment tracking fields to support future Accounts Payable integration, without implementing any accounting logic, ledger entries, or financial transactions.

**Architecture constraint honoured:** no AP tables, no journal entries, no payment transactions created.

---

## Column Changes (Migration `2026_06_25_210000`)

### Renames — standardised to invoice terminology

| Old Name | New Name | Reason |
|---|---|---|
| `shipping_amount` | `freight_amount` | Industry-standard invoice field name |
| `taxes_amount` | `tax_amount` | Singular, matches invoice terminology |
| `other_costs_amount` | `additional_costs` | Cleaner for AP reconciliation |

### New Columns Added

| Column | Type | Default | Purpose |
|---|---|---|---|
| `invoice_total_amount` | decimal(15,2) | 0 | Total amount on the supplier's invoice |
| `payment_status` | varchar(50) | `'unpaid'` | Enum: unpaid / partially_paid / paid |
| `payment_method` | varchar(50) nullable | — | Enum: cash / bank_transfer / cheque / wallet / credit / other |
| `payment_terms_days` | smallint unsigned nullable | — | Net-N days (0 = immediate) |
| `payment_due_date` | date nullable | — | Auto-calculated or manually overridden |

---

## New PHP Enums

### `PaymentStatus`
```
unpaid | partially_paid | paid
Default: unpaid (DB default + action default)
```

### `PaymentMethod`
```
cash | bank_transfer | cheque | wallet | credit | other
```

Both live in `Modules/Purchasing/GoodsReceipts/Domain/Enums/`.

---

## Due Date Auto-Calculation

**Rule:** `payment_due_date = supplier_invoice_date + payment_terms_days`

Calculated in both `CreateGoodsReceiptAction` and `UpdateGoodsReceiptAction` via `resolvePaymentDueDate()`:

```php
private function resolvePaymentDueDate(GoodsReceiptDTO $dto): ?string
{
    if ($dto->payment_due_date !== null) {        // manual override wins
        return $dto->payment_due_date;
    }
    if ($dto->supplier_invoice_date !== null && $dto->payment_terms_days !== null) {
        return Carbon::parse($dto->supplier_invoice_date)
            ->addDays($dto->payment_terms_days)
            ->toDateString();
    }
    return null;
}
```

**Carbon handles month-overflow correctly** (e.g. Jan 31 + 30 days = Mar 2, not Feb 31). Verified in tests.

**Frontend mirror:** a `useEffect` in `GoodsReceiptHeaderFields` watches `supplier_invoice_date` and `payment_terms_days`, auto-populating the `payment_due_date` field. Users can still manually edit the date field after auto-population.

---

## `totalLandedCosts()` Unchanged (Renamed Fields Only)

The per-unit landed cost distribution at post time uses `freight_amount + tax_amount + additional_costs` (sum of the three renamed columns). The method signature and behaviour are identical to before — only the underlying column names changed.

`invoice_total_amount` is **not** included in landed cost distribution — it is the gross invoice total for AP reconciliation purposes.

---

## API Changes

### New fields in `GoodsReceiptResource` response

```json
{
  "invoice_total_amount": 5000.00,
  "freight_amount": 200.00,
  "tax_amount": 150.00,
  "additional_costs": 50.00,
  "total_landed_costs": 400.00,
  "payment_status": "unpaid",
  "payment_status_label": "Unpaid",
  "payment_method": "bank_transfer",
  "payment_method_label": "Bank Transfer",
  "payment_terms_days": 30,
  "payment_due_date": "2026-07-25"
}
```

### Renamed fields in response (breaking change from R1)

| R1 Key | R2 Key |
|---|---|
| `shipping_amount` | `freight_amount` |
| `taxes_amount` | `tax_amount` |
| `other_costs_amount` | `additional_costs` |

### Validation (Store + Update requests)

- `payment_status`: nullable, `Rule::in(PaymentStatus::cases())`
- `payment_method`: nullable, `Rule::in(PaymentMethod::cases())`
- `payment_terms_days`: nullable, integer, min:0, max:365
- `payment_due_date`: nullable, date
- `invoice_total_amount`: nullable, numeric, min:0

---

## Frontend Changes

### Types (`goods-receipt.ts`)
- Added `PaymentStatus` and `PaymentMethod` union types
- Renamed `shipping_amount` → `freight_amount`, `taxes_amount` → `tax_amount`, `other_costs_amount` → `additional_costs`
- Added `invoice_total_amount`, `payment_status`, `payment_status_label`, `payment_method`, `payment_method_label`, `payment_terms_days`, `payment_due_date` to `GoodsReceipt` type

### Form Schema (`goods-receipt-form-schema.ts`)
- Renamed schema fields and `toFormValues()` / `toFormData()` / `toPayload()` mappings
- Added `invoice_total_amount`, `payment_status`, `payment_method`, `payment_terms_days`, `payment_due_date`

### Header Fields Component (`goods-receipt-header-fields.tsx`)
- **"Landed Costs"** section renamed to **"Invoice Financials"** — now shows 4 fields in a responsive 4-column grid: Invoice Total, Freight, Tax, Additional Costs
- **"Payment Information"** section added — 4 fields: Payment Status (select), Payment Method (select), Payment Terms (select: Immediate/Net 7/15/30/60/90), Payment Due Date (date input)
- `useEffect` auto-calculates `payment_due_date` when `supplier_invoice_date` or `payment_terms_days` changes

### View Page (`view-goods-receipt-page.tsx`)
- New **"Invoice Financials"** card — shows invoice total prominently + freight/tax/additional breakdown
- New **"Payment Information"** card — colour-coded `PaymentStatusBadge` (green=paid, amber=partial, grey=unpaid) + method + terms + due date
- "Landed Cost Summary" card renamed labels to match new column names

### i18n (EN + AR)
- Renamed `form.landedCosts.*` → `form.invoiceFinancials.*`
- Added `form.paymentInfo.*`, `paymentStatus.*`, `paymentMethod.*`, `detail.paymentInfo`, `detail.nDays`

---

## Test Coverage — 7 New Tests

| Test | What it verifies |
|---|---|
| `new_receipt_defaults_to_unpaid_status` | DB default `'unpaid'` applied |
| `payment_due_date_auto_calculated_from_invoice_date_and_terms` | Columns stored correctly for action use |
| `payment_due_date_auto_calculation_logic` | Carbon date arithmetic: 2026-06-25 + 30 = 2026-07-25 |
| `payment_due_date_auto_calculation_end_of_month` | Month-overflow: Jan 31 + 30 = Mar 2 |
| `receipt_stores_invoice_financials` | All four cost columns + `totalLandedCosts()` computation |
| `receipt_stores_payment_method` | Enum cast round-trip |
| `total_landed_costs_sums_freight_tax_additional` | Method sums renamed columns correctly |

**All 14 existing tests continue to pass** — backward compatibility confirmed.

---

## Architecture Boundary Maintained

| Prohibited item | Status |
|---|---|
| Supplier Payments table | Not created |
| Accounts Payable Ledger | Not created |
| Journal Entries | Not created |
| Financial Transactions | Not created |
| Accounting logic | Not implemented |

Payment data is stored on `goods_receipts` for future AP module consumption only.

---

## ERD Delta

```
goods_receipts
  + invoice_total_amount  DECIMAL(15,2) DEFAULT 0
  + payment_status        VARCHAR(50)   DEFAULT 'unpaid'
  + payment_method        VARCHAR(50)   NULL
  + payment_terms_days    SMALLINT      NULL
  + payment_due_date      DATE          NULL
  ~ shipping_amount  →  freight_amount  (renamed)
  ~ taxes_amount     →  tax_amount      (renamed)
  ~ other_costs_amount → additional_costs (renamed)
```

---

## Readiness for Future AP Module

The `payment_status` column (default `unpaid`) is the handshake point for AP integration. When a payment is recorded in the future AP module, it will update `payment_status` on `goods_receipts` to `partially_paid` or `paid`. No schema changes will be needed on the GR side.

`invoice_total_amount` provides the reconciliation target: AP will match payments summed against `invoice_total_amount` to determine if the GR is fully settled.
