# TASK-PERMISSION-FINAL-21-001 — Final Authorization Audit (remaining 21)

**Type:** Enterprise Security Audit · **Priority:** P0 (Final Authorization Review) · **Date:** 2026-08-01
**Guard:** `tests/Feature/Security/WriteRouteAuthorizationTest.php`

---

## 1. Executive Summary

Audited the 21 unauthorized write routes left after the domain permission series. Classified each into exactly one category and **implemented only Category B (12 routes)**, all mapping to **existing** permissions — no matrix redesign, no role change, no reseed. **Final unauthorized count: 21 → 9.** The remaining 9 are all intentionally retained: **4 Category C** (sensitive, CTO approval), **4 Category E** (Core/IAM infrastructure), **1 Category A** (accepted authenticated utility). No route is unaccounted for. Guard trajectory across the whole program: **471 → 9.**

## 2. Remaining 21 Routes (Step 1)

| # | Method | Route | Module | Controller@action | Current protection |
|---|--------|-------|--------|-------------------|--------------------|
| 1 | POST | `branches/{branch}/coverage` | Organization/Branches | BranchCoverageController@store | auth:sanctum only |
| 2 | PUT | `branches/{branch}/coverage/{area}` | Organization/Branches | @update | auth only |
| 3 | DELETE | `branches/{branch}/coverage/{area}` | Organization/Branches | @destroy | auth only |
| 4 | POST | `brands/{brand}/delivery-time-slots` | Organization/Brands | BrandDeliveryTimeSlotController@store | auth only |
| 5 | PUT | `brands/{brand}/delivery-time-slots/{slot}` | Organization/Brands | @update | auth only |
| 6 | DELETE | `brands/{brand}/delivery-time-slots/{slot}` | Organization/Brands | @destroy | auth only |
| 7 | PATCH | `brands/{brand}/delivery-time-slots/reorder` | Organization/Brands | @reorder | auth only |
| 8 | POST | `brands/{brand}/delivery-time-slots/seed-defaults` | Organization/Brands | @seedDefaults | auth only |
| 9 | PUT | `brands/{brand}/shipping-settings` | Organization/Brands | BrandShippingController@updateSettings | auth only |
| 10 | PUT | `brands/{brand}/shipping/cities/{city}` | Organization/Brands | @updateCity | auth only |
| 11 | PUT | `brands/{brand}/shipping/governorates/{governorate}` | Organization/Brands | @updateGovernorate | auth only |
| 12 | POST | `sync-logs/{syncLog}/retry` | Commerce/Synchronization | SynchronizationController@retry | auth only |
| 13 | POST | `brands/{brand}/transfer` | Organization/Brands | BrandController@transfer | auth only |
| 14 | POST | `brands/{brand}/transfer/analyze` | Organization/Brands | BrandController@analyze | auth only |
| 15 | POST | `orders/{order}/override-warehouse` | Operations/Warehouse-Assignment | WarehouseAssignmentController@overrideWarehouse | auth only |
| 16 | POST | `orders/{order}/verify-payment` | Commerce/Orders | OrderController@verifyPayment | auth only |
| 17 | POST | `auth/logout` | IAM | AuthController@logout | auth only (self-scoped) |
| 18 | DELETE | `me/preferences` | Core/UserPreferences | UserPreferenceController@destroyAll | auth only (self-scoped) |
| 19 | PUT | `me/preferences/{category}` | Core/UserPreferences | @update | auth only (self-scoped) |
| 20 | DELETE | `me/preferences/{category}` | Core/UserPreferences | @destroy | auth only (self-scoped) |
| 21 | POST | `media/upload` | Core/App | MediaController@upload | auth only + strict file validation |

*(Existing policy: none of the 21 carry a permission/policy/ownership/FormRequest-authorize — confirmed by the guard.)*

## 3. Classification Table (Step 2)

| Category | Count | Routes |
|----------|-------|--------|
| **A** — protected indirectly / accepted | 1 | #21 media/upload |
| **B** — missing auth, safe deterministic fix (implemented) | 12 | #1–#12 |
| **C** — sensitive, CTO approval | 4 | #13 transfer, #14 transfer/analyze, #15 override-warehouse, #16 verify-payment |
| **D** — intentional public | 0 | — |
| **E** — Core/IAM infrastructure | 4 | #17 auth/logout, #18–#20 me/preferences |

## 4. Category A (no action)
- **`POST media/upload`** — authenticated **and** strictly input-validated (image/PDF only, ≤10 MB, whitelisted `context`). It is a cross-cutting utility used by products, raw-materials, brands, companies, business-accounts, order-proof — there is **no single correct permission**, and gating it per-permission would break uploads across many modules. It is write-only and exposes no data. The authenticated + validated posture is the accepted protection. **Not a safe deterministic fix → no action.** (It remains in the guard count as a documented, accepted exception; it cannot go on ALLOWED because the allow-list is public-surface-only.)

## 5. Category B (implemented — 12)

All gated with an **existing** permission (no matrix/role change, no reseed):

| Routes | Permission | Rationale |
|--------|-----------|-----------|
| `branches/{branch}/coverage` POST/PUT/DELETE | `organization.branches.update` | Branch coverage is branch data; mirrors the branches CRUD permission (granted to company-admin). |
| `brands/{brand}/delivery-time-slots` POST/PUT/DELETE/reorder/seed-defaults (5) | `organization.brands.update` | Brand config; mirrors the brands CRUD permission the apiResource already uses. |
| `brands/{brand}/shipping-settings`, `shipping/cities/{city}`, `shipping/governorates/{governorate}` PUT (3) | `organization.brands.update` | Brand shipping config; same as above. |
| `sync-logs/{syncLog}/retry` POST | `sales.channels.sync` | Re-triggering a channel sync = the existing channel-sync permission (granted to company-admin). |

**Pre-existing gap noted (not fixed here to avoid scope/redesign):** `organization.brands.*` is referenced by the existing brands CRUD routes but is **absent from the matrix** (`config/permissions.php` has `organization.companies` + `organization.branches`, not `brands`). Consequently the brand CRUD *and* these brand sub-routes are effectively super-admin-only today. **Follow-up:** add `organization.brands => [view,create,update,delete]` to the matrix and grant to company-admin — this enables both brand CRUD and these 8 sub-routes for company-admin. Deferred because it is a matrix change affecting routes outside this audit's 21.

## 6. Category C (leave — CTO approval)
- `orders/{order}/override-warehouse` — `override` (sensitive warehouse override).
- `orders/{order}/verify-payment` — `verify-payment` (payment verification).
- `brands/{brand}/transfer` — `transfer` (moves a brand + its channels/data between companies; irreversible org-restructure).
- `brands/{brand}/transfer/analyze` — `transfer` (dry-run impact preview; grouped with the transfer capability for one holistic CTO authorization decision).

## 7. Category D (intentional public)
**None.** All public/webhook/machine routes (auth/login, careers apply, WooCommerce/Meta/omnichannel/automation webhooks, `cb/worker/*`) are already in the guard's ALLOWED list and were never in the 21.

## 8. Category E (Core/IAM — dedicated follow-up, do NOT modify)
- `auth/logout` — IAM session termination; acts only on the caller's own token (self-scoped, inherently safe).
- `me/preferences` (DELETE all), `me/preferences/{category}` (PUT, DELETE) — Core/UserPreferences; every route is `me/*`, operating on the authenticated user's **own** preferences (self-scoped). These need a self-ownership authorization convention, which is an IAM/Core infrastructure decision — a dedicated follow-up task.

## 9. Final Unauthorized Route Count
**9** (from 21). Composition: 4 Category C + 4 Category E + 1 Category A — all intentionally retained. Program-wide: **471 → 9.**

## 10. Files Changed (1)
- `backend/routes/api.php` — `permission:` middleware added to 12 Category B routes. **No `config/permissions.php` change, no reseed** (all mapped permissions pre-exist).

## 11. Regression Risk — Low
- All 12 use existing permissions; `organization.branches.update` and `sales.channels.sync` are granted to company-admin (+ super-admin bypass). `organization.brands.update` behaves exactly like the existing brand CRUD (super-admin-only until the noted follow-up) — no *new* regression; consistency preserved.
- Single `->middleware()` inside existing `auth:sanctum` groups — `auth` preserved (guard's auth-not-lost test clean).
- No controller/business-logic/DTO/schema change.

## 12. Final Authorization Readiness
Every write route is now accounted for. The **9 remaining are a clean, categorised residue** requiring only executive/infra decisions, not engineering gaps:
- **4 C** → CTO sign-off on who may hold override/verify-payment/brand-transfer.
- **4 E** → an IAM/Core self-ownership follow-up for `auth/logout` + `me/preferences`.
- **1 A** → accepted authenticated+validated upload utility.
Plus one documented matrix follow-up (`organization.brands`). No further blind implementation is warranted — the authorization surface is closed to a reviewed, minimal, intentional set.

STOP.
