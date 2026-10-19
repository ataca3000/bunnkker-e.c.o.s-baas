# TASK-PERMISSION-LOGISTICS-001 — Logistics Permission Integration

**Type:** Enterprise Security Engineering · **Priority:** P0 · **Date:** 2026-08-01
**Guard:** `tests/Feature/Security/WriteRouteAuthorizationTest.php`
**Scope:** Logistics — Shipping, Distribution, Fleet, Dispatch, Routing, Carrier, Delivery, Trips, Stops, Loading.

---

## Summary

All 71 Logistics write routes flagged by the CI guard are now gated. **Logistics unauthorized write routes = 0** (guard total 394 → 323). The matrix had **no `logistics` domain**, so this is a Category B build-out: a new `logistics` permission domain (6 resources, 22 permissions) was defined, granted to company-admin, and mapped onto the routes. No route contained a literal Category-C keyword, so nothing was deferred as C (but see §Sensitive-ops flag).

## New permission domain (Category B)

```
logistics.shipping      [view, quote]
logistics.carriers      [view, create, update, delete]   (shipping-companies + contracts + mappings)
logistics.drivers       [view, create, update, delete]
logistics.vehicles      [view, create, update, delete]
logistics.geography     [view, create, update, delete]   (governorates / cities / aliases)
logistics.distribution  [view, create, update, delete]   (zones, planning, trips + all trip sub-actions)
```
Granted in full to **company-admin** (super-admin bypasses). Reseeded (idempotent): 132→154 permissions; Company Admin 108→130.

## Routes Protected (71)

| Resource group | # | Mapping |
|----------------|---|---------|
| `shipping/quote` | 1 | `logistics.shipping.quote` |
| `logistics/shipping-companies/*` (carriers, contracts, mappings) | 9 | `logistics.carriers.create` (new company) / `.update` (rest) |
| `logistics/drivers/*` (CRUD, status, docs, vehicle-assign) | 7 | `logistics.drivers.create` / `.update` |
| `logistics/vehicles/*` (CRUD, status, docs, maintenance) | 8 | `logistics.vehicles.create` / `.update` |
| `logistics/geography/*` (governorates, cities, aliases) | 12 | `logistics.geography.create` / `.update` / `.delete` |
| `logistics/distribution/*` (zones, planning) | 6 | `logistics.distribution.create` / `.update` / `.delete` |
| `logistics/distribution/trips/*` (trips, orders, custody, stops, exceptions, returns, settlement, payments, proof) | 28 | `logistics.distribution.create` (new trip) / `.update` (all transitions) |

All routes use single `->middleware('permission:...')` inside existing `auth:sanctum` groups — `auth` preserved.

## Category C — none (by the guard's keyword definition)
No Logistics route literally matches the sensitive-keyword list (`refund/void/close-shift/override/reverse/verify-payment/transfer/apply/write-off`). In particular `payments/{paymentId}/verify` does not contain the substring `verify-payment`. Nothing was left unprotected as C. **See the two follow-ups below** — the COD money paths deserve a policy decision.

## Follow-ups flagged for CTO (important)

1. **Operational logistics roles do not exist.** The matrix has no `dispatcher`, `driver`, or `fleet-manager` role — logistics permissions were granted only to **company-admin**. These routes were previously **unprotected** (any authenticated user), so gating them is a net security gain, **but** the **driver mobile OS** and dispatcher screens will now `403` for non-admin operators until dedicated roles are created and granted `logistics.*`. **This role design must land before deploy+reseed in an environment where drivers/dispatchers use non-admin accounts.** (Route protection — this task — is done; role design is a separate concern.)
2. **COD cash separation-of-duties.** Settlement (`submit-cash`, `reconcile`, `dispute`, `finalize`) and payment (`verify`, `reject`) routes are financially sensitive ("Single Cash Authority" per the Distribution ADRs) but are currently gated at resource level (`logistics.distribution.update`) — the same permission a driver uses to complete a stop. Recommend a dedicated restricted permission (e.g. `logistics.distribution.settle` / `verify_payment`) granted to a narrow finance/dispatch role, and/or reclassifying these as Category C pending that decision. By the current keyword definition they are A/B, so they were protected (better than the prior unprotected state).

## Already-authorized (no action)
Write routes under `logistics/delivery`, `logistics/fleet`, `logistics/network`, `logistics/dispatch`, `logistics/routing`, `logistics/operations` were **not** in the guard's unauthorized set — already protected by their controllers. Untouched.

## Files Changed (2)
1. `backend/routes/api.php` — `permission:` middleware on 71 logistics write routes.
2. `backend/config/permissions.php` — new `logistics` domain (6 resources) + full grant to company-admin.

Runtime: re-ran `RbacSeeder` (idempotent). Re-run on deploy.

## Verification
- `php -l` clean on both files; app boots (Laravel 12.62; `route:list` loads with new middleware).
- **CI guard `test_every_write_route_is_authorized`:** Logistics-scope unauthorized routes = **0**; total 394 → 323.
- **CI guard `test_authorizing_middleware_is_not_lost`:** no logistics route lost authentication.

## Regression Risk — Medium (see follow-up #1)
- Route protection itself is sound (additive middleware; `auth` preserved; reseed additive — no grant/assignment removed).
- **The material risk is operational:** until logistics operator roles exist and are granted, only company-admin/super-admin can operate logistics. In this environment that is acceptable (admin/super-admin operate everything); in production it must be sequenced with the role design in follow-up #1.
- No controller/business-logic change.

STOP.
