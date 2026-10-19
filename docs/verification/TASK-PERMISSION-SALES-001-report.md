# TASK-PERMISSION-SALES-001 — Sales Permission Integration

**Type:** Enterprise Security Engineering · **Priority:** P0 · **Date:** 2026-08-01
**Guard:** `tests/Feature/Security/WriteRouteAuthorizationTest.php`
**Scope:** Sales / Commerce module (Orders, Customers, Channels, Fulfillments, Order Notes/Assignment/Timeline, Reservations).

---

## Summary

All Sales/Commerce write routes flagged by the CI guard are now gated. Every one mapped to an **existing** matrix permission → **Category A only**; no new permissions, grants, or reseed were required (single file changed: `routes/api.php`). Total guard unauthorized dropped **433 → 410** (23 Sales/Commerce routes protected). **Sales/Commerce module unauthorized write routes = 0.** The two remaining Sales-domain routes are the intentional **Category C** items, left untouched.

## Routes Protected (23)

| Route(s) | Permission | 
|----------|-----------|
| `POST/PUT/DELETE customers` | `crm.customers.create/update/delete` |
| `POST/PUT/DELETE customers/{c}/addresses` (shallow) | `crm.customers.update` |
| `POST channels/{ch}/test-connection` | `sales.channels.update` |
| `POST channels/{ch}/import-products` · `import-orders` · `sync-stock` | `sales.channels.sync` |
| `POST/PUT/DELETE product-mappings` | `sales.channels.update` |
| `POST orders/maps/resolve-url` | `sales.orders.update` |
| `PATCH orders/{o}/zone` | `sales.orders.update` |
| `POST orders/{o}/confirm-customer` | `sales.orders.update` |
| `POST orders/{o}/notes` · `PATCH/DELETE orders/{o}/notes/{n}` | `sales.orders.update` |
| `POST orders/{o}/prepare` | `sales.orders.update` |
| `POST orders/{o}/assign-warehouse` | `sales.orders.update` |
| `POST fulfillments/{f}/fulfill` · `cancel` | `sales.fulfillments.update` |

All permissions pre-exist in `config/permissions.php` (`crm.customers`, `sales.channels` incl. `sync`, `sales.orders`, `sales.fulfillments`) and are already granted to company-admin + sales roles (super-admin bypasses). **No matrix change, no reseed.**

## Category C — left untouched (2)
- `POST orders/{order}/verify-payment` — `verify-payment` (sensitive; who may hold it awaits CTO).
- `POST orders/{order}/override-warehouse` — `override`.

These are the only remaining unauthorized routes in the Sales/Commerce namespace, by design.

## Routes Remaining (out of Sales scope — documented, NOT touched)

**~30 `api/fulfillment/*` routes** — the **Operations\Fulfillment** order-lifecycle state machine (`fulfillment/orders/{order}/{confirm|dispatch|complete|cancel|reschedule|review|transition|approve-partial-reservation|awaiting-stock|move-to-preparation|return*|resume|revert-to-confirmed}` and the `fulfillment/bulk/*` + `fulfillment/returns/*` equivalents).

These were **deliberately excluded** from this Sales task because:
1. They live in a **different module** (`Modules/Operations/Fulfillment`, the Preparation/Fulfillment OS), not Sales/Commerce.
2. They are operated by **warehouse/prep staff** (role `warehouse-manager`), who do **not** hold `sales.*` permissions. Gating them with `sales.orders.*` would **lock operators out of the fulfillment workflow** — a real regression, not a fix.
3. Correctly protecting them needs a **fulfillment permission domain** (Category B: e.g. `operations.fulfillment.*`) granted to ops + sales roles. That is the scope of a **Fulfillment/Operations permission task**, not Sales.

Recommendation: handle these under `TASK-PERMISSION-FULFILLMENT-001` (or `-OPERATIONS-`), defining the fulfillment permission set and its role grants. Mapping them to Sales permissions now would be incorrect.

Also out of scope (other modules, untouched): `api/crm/customers/*` (CRM C-series module — distinct from the Sales `api/customers`), plus the ~380 non-Sales write routes across Marketing/HR/Finance/POS/Logistics/Engineering.

## Files Changed (1)
- `backend/routes/api.php` — added `permission:` middleware to 23 Sales/Commerce write routes (`->middlewareFor(...)` for the `customers`, `customers.addresses`, `product-mappings` apiResources; `->middleware('permission:...')` for single routes). `auth:sanctum` inherited from each route group and preserved.

No `config/permissions.php` change (all Category A). No reseed required.

## Verification
- `php -l routes/api.php` clean; app boots (`route:list` loads all routes with new middleware).
- **CI guard `test_every_write_route_is_authorized`:** Sales/Commerce protected routes now = **0 unauthorized** (grep of the failure set for every protected route returns empty); total 433 → 410.
- **CI guard `test_authorizing_middleware_is_not_lost_by_chained_registration`:** no Sales/Commerce route lost authentication (apiResources use `middlewareFor`; single routes merge with the group `auth:sanctum`).

## Regression Risk — Low
- Every protected route reuses an existing permission already granted to the roles that operate Commerce (company-admin, sales); super-admin bypasses. No behavior change for intended users.
- No controller/DTO/business-logic change — route middleware only.
- Intended access-control effect: authenticated users **without** the mapped `sales.*`/`crm.customers.*` permission now receive `403` on those routes.
- Category C and the Operations\Fulfillment routes were intentionally not touched (documented above) — no scope creep into other modules.

STOP.
