# TASK-PERMISSION-PROCUREMENT-001 — Procurement Permission Integration

**Type:** Enterprise Security Engineering · **Priority:** P0 · **Date:** 2026-08-01
**Guard:** `tests/Feature/Security/WriteRouteAuthorizationTest.php`
**Scope:** Procurement — Suppliers, Purchase Requests, Purchase Orders, Supplier Invoices, Goods Receipts, Supplier Returns, Price Review.

---

## Summary

All Procurement write routes flagged by the CI guard are now gated. **Procurement unauthorized write routes = 0** (guard total 410 → 394; 16 routes protected). Most mapped to existing `purchasing.*` permissions (Category A); two supplier-return transitions needed new actions (Category B). No Category-C keyword routes exist in Procurement.

## Routes Protected (16)

| Route | Permission | Cat |
|-------|-----------|-----|
| `POST suppliers/{s}/documents` · `DELETE suppliers/{s}/documents/{d}` | `purchasing.suppliers.update` | A |
| `POST purchase-orders/{po}/submit` · `approve` · `cancel` | `purchasing.purchase_orders.update` | A |
| `POST goods-receipts/{gr}/post` | `purchasing.goods_receipts.update` | A |
| `POST supplier-invoices/{si}/validate` | `purchasing.supplier_invoices.validate` | A |
| `POST supplier-invoices/{si}/post` | `purchasing.supplier_invoices.post` | A |
| `POST supplier-invoices/{si}/cancel` | `purchasing.supplier_invoices.cancel` | A |
| `POST supplier-returns/{sr}/submit` | `purchasing.supplier_returns.submit` | A |
| `POST supplier-returns/{sr}/approve` | `purchasing.supplier_returns.approve` | A |
| `POST supplier-returns/{sr}/reject` | `purchasing.supplier_returns.reject` | A |
| `POST supplier-returns/{sr}/cancel` | `purchasing.supplier_returns.cancel` | A |
| `POST supplier-returns/{sr}/complete` | `purchasing.supplier_returns.complete` | A |
| `POST supplier-returns/{sr}/mark-sent` | `purchasing.supplier_returns.mark_sent` | **B (new)** |
| `POST supplier-returns/{sr}/credit-pending` | `purchasing.supplier_returns.credit_pending` | **B (new)** |

**Category B additions:** `mark_sent` + `credit_pending` added to `purchasing.supplier_returns` in the matrix — they are real state-machine transitions (Approved→Sent, →CreditPending) with no prior action, consistent with the resource's existing per-transition actions (submit/approve/reject/cancel/complete).

**Grants fix (required for correctness):** `purchasing.supplier_invoices.*` and `purchasing.supplier_returns.*` existed in the matrix but were granted to **no** non-super-admin role. Left as-is, gating these routes would have locked procurement staff out. Added both permission sets (incl. the two new actions) to **company-admin** and **purchasing** roles, then reseeded (idempotent). Company Admin 92→108, Purchasing 25→41 permissions.

## Category C — none in Procurement
No Procurement write route matches the sensitive-keyword list (`refund/void/close-shift/override/reverse/verify-payment/transfer/apply/write-off`). Nothing deferred.

## Already-authorized (no action needed)
- **Suppliers / Purchase Orders / Goods Receipts** base CRUD apiResources — already gated (`purchasing.*.create/update/delete`).
- **Purchase Requests** (`material-requests`, `purchase-materials`) and **Purchases** (`purchases/*`) write routes — not in the guard's unauthorized set (already authorized).
- **Price Review** — already protected under TASK-PERMISSION-INVENTORY-001 (`inventory.price_review.*`).

## Files Changed (2)
1. `backend/routes/api.php` — `permission:` middleware on 16 procurement write routes.
2. `backend/config/permissions.php` — `mark_sent`/`credit_pending` added to `purchasing.supplier_returns`; `supplier_invoices` + `supplier_returns` grants added to company-admin and purchasing roles.

Runtime: re-ran `RbacSeeder` (idempotent — `firstOrCreate` + `syncWithoutDetaching`). Re-run on deploy.

## Verification
- `php -l` clean on both files; app boots (`route:clear`/`config:clear` + guard boot succeed).
- **CI guard `test_every_write_route_is_authorized`:** Procurement-scope unauthorized routes = **0**; total 410 → 394.
- Routes use single `->middleware('permission:...')` inside existing `auth:sanctum` groups (no apiResource re-chaining), so `auth` is preserved.

## Regression Risk — Low
- Category A routes reuse existing permissions already granted to company-admin/purchasing.
- Category B (2 new actions) + the supplier_invoices/returns grants were reseeded additively (no existing grant/assignment removed); super-admin bypasses.
- No controller/business-logic change — route middleware + permission registry only.
- Intended effect: authenticated users without the mapped `purchasing.*` permission now receive `403`. Note: `goods-receipts/{gr}/post` requires `purchasing.goods_receipts.update` — held by company-admin + purchasing but **not** warehouse-manager (who has view/create only). If warehouse staff must post receipts, grant `purchasing.goods_receipts.update` to warehouse-manager in a follow-up.

STOP.
