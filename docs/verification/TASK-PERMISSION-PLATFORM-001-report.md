# TASK-PERMISSION-PLATFORM-001 — Platform Permission Integration

**Type:** Enterprise Security Engineering · **Priority:** P1 · **Date:** 2026-08-01
**Guard:** `tests/Feature/Security/WriteRouteAuthorizationTest.php`
**Scope:** Platform — Marketing, CEP, Omnichannel, Claude Bridge, BAE, Configuration, Geography, POS.

---

## Summary

All 183 Platform-scope write routes flagged by the CI guard are now gated. **Platform unauthorized write routes = 0** (guard total 204 → 21; the 21 remaining are out of scope — see below). Seven new permission domains were defined (Category B). No route contained a literal Category-C keyword.

## New permission domains (Category B)

```
marketing.workspace   [view, manage]
cep.inbox             [view, manage]
omnichannel.inbox     [view, manage]
claude_bridge.platform[view, manage]   // internal AI orchestration — super-admin only
bae.attribution       [view, manage]
pos.terminal          [view, operate]
configuration.settings[view, manage]
```

Grants (reseeded, idempotent — 162→176 permissions; Company Admin 136→148):
- **company-admin:** marketing / cep / omnichannel / bae / pos / configuration.
- **sales:** `pos.terminal` (cashier operations).
- **claude_bridge.platform:** granted to **no** role — super-admin bypass only (internal module, hidden like Engineering).

## How routes were gated

| Module | Routes | Technique |
|--------|--------|-----------|
| **Marketing** (`marketing`, `marketing/studio`, `marketing/automation`, `marketing/intelligence`) | ~97 | **Group-level** `marketing.workspace.manage` on all 4 groups. The 2 public `meta/webhook` routes were kept public via `withoutMiddleware(['auth:sanctum','permission:marketing.workspace.manage'])`. |
| **POS** (`pos/*`: carts, shifts, sessions, receipts, sales, returns, exchanges) | 18 | **Group-level** `pos.terminal.operate` |
| **CEP** (`cep/*`: conversations, leads, sla, messages) | 21 | **Group-level** `cep.inbox.manage` |
| **Omnichannel** (`omnichannel/*`: conversations, providers, routing-rules, macros) | 16 | **Group-level** `omnichannel.inbox.manage` |
| **Claude Bridge** (`cb/*`: tasks, workers) | 10 | **Group-level** `claude_bridge.platform.manage` (super-admin only) |
| **BAE** (`bae/*`: replay, graph, dna) | 6 | **Group-level** `bae.attribution.manage` |
| **Configuration** (`configuration/*`: company, brand policies, prep-policies, master-geography/zones) | 12 | **Per-route** `configuration.settings.manage` (group NOT gated — its GET reads, esp. company settings + master-geography, are consumed broadly) |

**`cb/worker/*`** (VerifyWorkerToken machine auth) and the `marketing/automation/webhook` + `omnichannel/webhook` groups are in the guard's ALLOWED list (public/machine) — untouched.

## Category C — none
No Platform route matches the sensitive-keyword list. Nothing deferred. (The only Category-C routes globally are the two Sales-domain order routes, already left in TASK-PERMISSION-SALES-001.)

## Routes Remaining (21 — all OUT of Platform scope)
- `brands/*` (10) + `branches/*` (3) — **Organization / Admin** module.
- `me/preferences/*` (3) + `auth` (1) — **Core / IAM**.
- `sync-logs` (1) + `media/upload` (1) — **Commerce** utilities.
- `orders/*` (2) — the **Category C** order routes (verify-payment, override-warehouse).

These belong to a future Organization/Admin/Core permission task + the CTO Category-C decision. This completes the domain permission series (Inventory → Sales → Procurement → Logistics → Operations → Platform): the guard's unauthorized count fell from **471 → 21**.

## Follow-up flagged for CTO
**Operator roles for Platform modules don't exist** (marketer, cashier, agent, analyst). Group-gating restricts each module to company-admin + super-admin (plus sales for POS). These routes were previously unprotected, so this is a net security gain, **but** dedicated roles must be created + granted (`marketing.workspace`, `cep.inbox`, `omnichannel.inbox`, `pos.terminal`, `bae.attribution`) before non-admin operators can use them. Note: group-gating also restricts each module's **read** (GET) routes to the same permission — intended for these operator/internal modules, but confirm no cross-module reader depends on them.

## Files Changed (2)
1. `backend/routes/api.php` — 9 group-level gates + 2 webhook `withoutMiddleware` adjustments + 12 configuration per-route gates.
2. `backend/config/permissions.php` — 7 new domains + grants (company-admin, sales).

Runtime: re-ran `RbacSeeder` (idempotent). Re-run on deploy.

## Verification
- `php -l` clean on both files; app boots (Laravel 12.62).
- **CI guard `test_every_write_route_is_authorized`:** Platform-scope unauthorized routes = **0**; total 204 → 21.
- **CI guard `test_authorizing_middleware_is_not_lost`:** no Platform route lost authentication (group middleware arrays keep `auth:sanctum`).
- **Public webhook preserved:** `marketing/meta/webhook` (GET/POST) carries neither auth nor permission (`withoutMiddleware`) — Meta can still call it.

## Regression Risk — Medium
- Route protection is sound (additive; `auth` preserved; reseed additive; public webhook explicitly preserved).
- **Operational risk (intended tightening):** each platform module is now restricted to company-admin/super-admin (+ sales for POS); group-gating also gates reads. Non-admin operators need the new grants (follow-up). Claude Bridge is super-admin-only by design. Acceptable in this environment (admins operate everything); must be sequenced with role grants for non-admin production use.
- No controller/business-logic change.

STOP.
