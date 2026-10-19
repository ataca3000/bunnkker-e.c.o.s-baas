# TASK-PERMISSION-INVENTORY-001 — Inventory Permission Integration

**Type:** Enterprise Security Engineering · **Priority:** P0 · **Date:** 2026-08-01
**Guard:** `tests/Feature/Security/WriteRouteAuthorizationTest.php` (the CI authorization guard)
**Scope:** Inventory Core only. No other module's code touched.

---

## Summary

The CI guard reported **453** unprotected write routes platform-wide. Of these, **20 belong to the Inventory Core scope** — and **none contained a Category-C keyword** (`refund, void, close-shift, override, reverse, verify-payment, transfer, apply, write-off`), so all 20 are Category A/B and in scope. All 20 are now gated. After the change: **Inventory unauthorized write routes = 0** (total dropped 453 → 433; the 433 remaining are other modules, out of scope and untouched).

Category interpretation (from the guard): **Category C** = the sensitive-keyword operations the guard tracks as `PENDING_CATEGORY_C` (awaiting CTO sign-off on who may hold them) — none exist in Inventory, so none were touched. **Category A** = routes mapping to an existing matrix permission. **Category B** = routes needing a new, non-sensitive inventory permission (added to the matrix + granted to roles).

## Routes Protected (20)

| Route | Permission | Cat |
|-------|-----------|-----|
| `POST products/import` | `inventory.products.create` | A |
| `PATCH products/{product}` | `inventory.products.update` | A |
| `POST stock-movements` | `inventory.stock.adjust` | A |
| `POST/PUT/DELETE boms` | `inventory.recipes.create/update/delete` | B |
| `POST inventory/abc-classifications/recalculate` | `inventory.abc.recalculate` | B |
| `POST waste-investigations/{id}/resolve` | `inventory.waste.resolve` | B |
| `POST waste-investigations/{id}/attachments` | `inventory.waste.resolve` | B |
| `DELETE waste-investigations/{id}/attachments/{id}` | `inventory.waste.resolve` | B |
| `POST warehouse-liabilities/{id}/approve` | `inventory.liabilities.approve` | B |
| `POST warehouse-liabilities/{id}/reject` | `inventory.liabilities.reject` | B |
| `POST pricing-reviews/{id}/approve` | `inventory.price_review.approve` | B |
| `POST pricing-reviews/bulk-approve` | `inventory.price_review.approve` | B |
| `POST pricing-reviews/bulk-policy` | `inventory.price_review.approve` | B |
| `POST pricing-reviews/{id}/publish` | `inventory.price_review.publish` | B |
| `POST pricing-reviews/{id}/snooze` | `inventory.price_review.update` | B |
| `POST pricing-reviews/{id}/assign` | `inventory.price_review.update` | B |
| `PATCH pricing-reviews/{id}/inline` | `inventory.price_review.update` | B |
| `PATCH cost-management/materials/{productId}/cost` | `inventory.price_review.update` | B |

New matrix permissions added (Category B): `inventory.recipes` [view,create,update,delete], `inventory.waste` [view,resolve], `inventory.liabilities` [view,approve,reject], `inventory.abc` [view,recalculate], `inventory.price_review` [view,update,approve,publish]. Granted to company-admin (full), warehouse-manager (operational: recipes.view, waste, liabilities, abc), inventory-operator (view-level), viewer (view). Super-admin bypasses via `is_system`.

## Routes Remaining

- **Inventory Core: 0 unauthorized.** Verified by the guard (`ZERO_INVENTORY_UNAUTHORIZED`).
- **Category C in Inventory: none** — no inventory write route matches the sensitive-keyword list, so nothing was deferred within scope.
- **Out of scope (untouched): 433** write routes across other modules (Orders, POS, HR, Finance, CRM, Marketing, Engineering, Logistics, etc.). Per the mission ("do NOT touch any other module"), these were intentionally left for their own tasks.

## Files Changed (2)

1. `backend/routes/api.php` — added `permission:` middleware to 20 inventory write routes (`->middlewareFor(...)` for the `boms` apiResource; `->middleware('permission:...')` for the rest). Auth (`auth:sanctum`) is inherited from each route group and was preserved.
2. `backend/config/permissions.php` — 5 new inventory resources in `modules.inventory` + grants in `role_permissions` (company-admin, warehouse-manager, inventory-operator, viewer).

Runtime step performed: re-ran `RbacSeeder` (idempotent — `firstOrCreate` + `syncWithoutDetaching`, never removes existing grants or user role assignments) so the new permissions exist and are granted. Re-run on deploy.

## Verification

- `php -l` clean on both changed files.
- App boots; `route:list` shows the routes loaded with new middleware.
- **CI guard `test_every_write_route_is_authorized`:** inventory-scope unauthorized routes = **0** (total 453 → 433).
- **CI guard `test_authorizing_middleware_is_not_lost_by_chained_registration`:** no inventory route lost authentication (`NO_INVENTORY_AUTH_LOSS`) — the `boms` apiResource uses `middlewareFor` (safe) and per-route `->middleware()` merges with the group's `auth:sanctum`.

## Regression Risk — Low

- Category A (3 routes) reuse pre-existing, already-granted permissions — no behavior change for authorized roles.
- Category B (17 routes) use new permissions; grants were chosen conservatively and the reseed was purely additive. Super-admin unaffected (gate bypass).
- No controller, DTO, or business logic changed — route middleware + permission registry only.
- **Intended access-control effect:** a non-super-admin role NOT granted a given new permission now receives `403` on that route (this is the point of the task). If a role needs broader access, adjust the grants in `config/permissions.php` and reseed.

---

*Note: unrelated in-progress work on TASK-GOLIVE-BLOCKERS-001 (dashboard/navigation/two currency files) remains staged in the working tree, paused per this task's "do not touch any other module" scope.*

STOP.
