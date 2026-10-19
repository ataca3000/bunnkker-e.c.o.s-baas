# TASK-PERMISSION-OPERATIONS-001 — Operations Permission Integration

**Type:** Enterprise Security Engineering · **Priority:** P0 · **Date:** 2026-08-01
**Guard:** `tests/Feature/Security/WriteRouteAuthorizationTest.php`
**Scope:** Operations — Preparation, Manufacturing, Engineering, Operations, Repair, Capacity, Alerts, Exceptions.

---

## Summary

All 119 Operations-scope write routes flagged by the CI guard are now gated. **Operations unauthorized write routes = 0** (guard total 323 → 204). Two new permission domains were defined (Category B): `operations` (preparation, fulfillment) and `engineering` (platform). No route contained a literal Category-C keyword.

The 119 break down as: **Engineering** 75, **Fulfillment order-lifecycle** 30 (the routes deferred from the Sales task), **Preparation** 14. Loading / Capacity / Alerts / Exceptions / Manufacturing had **no** unauthorized write routes (already authorized by their controllers) — nothing to do there.

## New permission domains (Category B)

```
operations.preparation  [view, create, update, delete]
operations.fulfillment  [view, manage]
engineering.platform    [view, manage]   // internal — Super Admin / CTO / DevOps only
```

Grants (reseeded, idempotent — 154→162 permissions):
- **company-admin:** `operations.preparation.*`, `operations.fulfillment.*`
- **warehouse-manager:** `operations.preparation.*`, `operations.fulfillment.*`
- **sales:** `operations.fulfillment.*` (sales/CSR confirm orders in the lifecycle)
- **engineering.platform:** granted to **no** role — super-admin bypasses via `is_system`, matching the module's documented "Super Admin / CTO / DevOps only" policy.

## Routes Protected (119)

| Area | # | How gated |
|------|---|-----------|
| **Engineering** (`system/engineering/*`: pipelines, guardian, cluster, inbox, intelligence, repair, sessions, agents, workers, queue, releases, workspace, notifications, ai-reviews) | 75 | **Group-level** `permission:engineering.platform.manage` on all 5 `system/engineering` route groups (whole module → super-admin only, matching its access policy) |
| **Fulfillment** order-lifecycle (`fulfillment/orders/{o}/*` 16 + `fulfillment/bulk/*` 13 + `fulfillment/returns/{r}/receive` 1) | 30 | **Group-level** `permission:operations.fulfillment.manage` — the group is write-only (all POST transitions), so one gate covers all |
| **Preparation** (`preparation/sessions/*` 11 + `preparation/warehouse-assignment-policies` 3) | 14 | **Per-route** `operations.preparation.create/update/delete` (group mixes GET + write, so writes gated individually) |

## Category C — none
No Operations route matches the sensitive-keyword list (`refund/void/close-shift/override/reverse/verify-payment/transfer/apply/write-off`). Engineering `rollback`/`purge`/`abort`/`fail` and fulfillment `cancel`/`return`/`revert-to-confirmed` do not match. Nothing deferred.

## Follow-ups flagged for CTO

1. **Engineering is super-admin-only by design.** `engineering.platform.manage` is granted to no role (super-admin bypass only). The whole `system/engineering` module (including GET routes) is now gated to super-admin — matching the "Cloud V1 CLOSED / internal" policy from the go-live audit. **If** CTO/DevOps operators use non-super-admin accounts, or engineering worker/agent service accounts authenticate as non-super-admin users (the `agents/*/heartbeat`, `workers`, `sessions/*/log` routes are under `auth:sanctum`), a dedicated engineering/DevOps role must be created and granted `engineering.platform.manage`.
2. **`operations.fulfillment.manage` is coarse** — one permission covers every order-lifecycle transition (confirm → dispatch → complete → cancel → return). Granted to company-admin + warehouse-manager + sales. A separation-of-duties refinement (distinct confirm / dispatch / complete permissions for CSR vs warehouse vs logistics) can follow. These routes were previously **unprotected**, so this is a net security gain.

## Files Changed (2)
1. `backend/routes/api.php` — 5 engineering groups + 1 fulfillment group gated at group level; 14 preparation routes gated per-route.
2. `backend/config/permissions.php` — new `operations` + `engineering` domains; grants to company-admin, warehouse-manager, sales.

Runtime: re-ran `RbacSeeder` (idempotent). Re-run on deploy.

## Verification
- `php -l` clean on both files; app boots (Laravel 12.62; `route:list` shows engineering routes carrying the permission middleware).
- **CI guard `test_every_write_route_is_authorized`:** Operations-scope unauthorized routes = **0**; total 323 → 204.
- **CI guard `test_authorizing_middleware_is_not_lost`:** no Operations route lost authentication (group middleware arrays keep `auth:sanctum`; no chained `->middleware()` replacement).

## Regression Risk — Medium
- Route protection is sound (additive; `auth` preserved; reseed additive).
- **Operational risk (intended tightening):** Engineering is now super-admin-only — non-admin engineering users / worker service accounts will `403` until a DevOps role is granted (follow-up #1). Fulfillment lifecycle now requires `operations.fulfillment.manage` — granted to the three roles that touch it (admin/warehouse/sales); any other operator must be granted it. Both are net-positive vs the prior unprotected state and must be sequenced with role grants before non-admin production use.
- No controller/business-logic change.

STOP.
