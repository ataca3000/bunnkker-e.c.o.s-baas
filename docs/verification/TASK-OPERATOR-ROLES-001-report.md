# TASK-OPERATOR-ROLES-001 — Enterprise Operator Roles

**Type:** Enterprise IAM Engineering · **Priority:** P0 (Production Readiness) · **Date:** 2026-08-02
**Resolves:** Certification condition #1 (TASK-FINAL-GOLIVE-REVIEW-001) — "provision operator roles + grants."

---

## 1. Executive Summary

Implemented a complete **least-privilege operator role model** so no daily operational user needs the Company Admin role. **20 new roles** were added on top of the 7 existing roles (**27 total**), each granted **only existing permissions** — **no new permissions were created** (permission count unchanged at 176), and the Permission Matrix was **not redesigned**. Reseed succeeded; least-privilege verified (e.g. Cashier can operate the POS terminal but cannot create back-office orders); **no operator role carries `is_system`** (no super-permission bypass); and the CI permission guard is **unchanged (9)** — no route regression. ECOS can now operate day-to-day without Company Admin.

## 2. Roles Created (20 new; 27 total)

| Role (slug) | Purpose / daily work | Modules | Grant count |
|-------------|----------------------|---------|-------------|
| Warehouse Operator (`warehouse-operator`) | Floor receiving + counts; no adjust/approve | Inventory (view/receive/count), Goods-Receipts (create), Prep (update) | 15 |
| Inventory Controller (`inventory-controller`) | Stock accuracy, counts, waste/liability resolution, cost/price control | Inventory (adjust/count/approve, waste.resolve, liabilities, abc, **price_review update+approve**) | 24 |
| Purchasing Manager (`purchasing-manager`) | Full procurement incl. approvals, invoice posting, returns | Purchasing (all resources full) | 60 |
| Purchasing Officer (`purchasing-officer`) | Day-to-day buyer; **no** approve/post/delete | Purchasing (create/submit/edit only) | 32 |
| Sales Manager (`sales-manager`) | Full sales, channels, override price, fulfillment, POS | Sales (full), CRM, CEP, POS | 27 |
| Sales Representative (`sales-representative`) | Create/update orders + customers; **no** delete/override_price/channel-admin | Sales (create/update/fulfill), CRM (no delete) | 13 |
| Customer Service (`customer-service`) | Customer care, order updates, unified/omni inbox | CRM, Orders (update), CEP, Omnichannel | 11 |
| Dispatcher (`dispatcher`) | Distribution board, trip/stop assignment, dispatch | Logistics.distribution (create/update), Fulfillment | 11 |
| Shipping Coordinator (`shipping-coordinator`) | Carriers, geography, distribution planning | Logistics (carriers/geography/distribution full) | 19 |
| Fleet Manager (`fleet-manager`) | Drivers + vehicles lifecycle | Logistics.drivers/vehicles (full) | 10 |
| Driver (`driver`) | Trip execution: acceptance, stops, proof, COD record | Logistics.distribution (view/update) | 3 |
| Cashier (`cashier`) | POS sales at the terminal; **no** refund/void/close-shift | POS.terminal (operate), lookups | 5 |
| Marketing Manager (`marketing-manager`) | Campaigns + attribution analytics | Marketing.workspace, BAE | 5 |
| Marketing Operator (`marketing-operator`) | Campaign operations | Marketing.workspace | 2 |
| Production Manager (`production-manager`) | Recipes + preparation + fulfillment | Recipes (full), Prep (full), Fulfillment | 12 |
| Preparation Supervisor (`preparation-supervisor`) | Wave/session preparation | Operations.preparation (full) | 7 |
| Fulfillment Supervisor (`fulfillment-supervisor`) | Order fulfillment lifecycle | Operations.fulfillment, Orders/Fulfillments (update) | 8 |
| Engineering Operator (`engineering-operator`) | Engineering OS (internal) | Engineering.platform | 2 |
| DevOps Operator (`devops-operator`) | Engineering + Claude Bridge + config read | Engineering, Claude Bridge, Configuration | 5 |
| System Auditor (`system-auditor`) | Read-only audit across business domains | view-only across per-route-gated domains | 33 |

*(Existing roles retained for backward-compatibility: `super-admin` (is_system), `company-admin`, `warehouse-manager`, `purchasing`, `sales`, `inventory-operator`, `viewer`/Read-Only. These may be deprecated once users are re-assigned to the granular roles.)*

## 3. Permissions Assigned

- **Only existing permissions** were used — permission catalog unchanged at **176** (reseed reported no new permissions). Grants added to `role_permissions` for the 20 new roles; `RbacSeeder` applied them via `syncWithoutDetaching` (additive; no existing role/user grant removed).
- **Least-privilege enforced:** manager roles hold approve/post/override actions; officer/representative/operator/cashier roles are restricted to create/submit/operate. Verified: `cashier` has `pos.terminal.operate` but **not** `sales.orders.create`; `driver` has exactly 3 permissions.
- **No wildcards, no `*`, no super-permissions.** Only `super-admin` is `is_system`; **0** operator roles bypass the gate.

## 4. Category C Recommendations (recommendation only — not implemented)

Most Category C operations are **unprotected routes with no dedicated permission** (a standing CTO decision from the permission series). I recommend the holder role; where an *existing* permission already exists, it has been **granted** to the recommended role.

| Sensitive operation | Recommended holder role(s) | Status |
|---------------------|----------------------------|--------|
| **Verify Payment** (`orders/verify-payment`) | Sales Manager, Fulfillment Supervisor (COD financial verification) | Route unprotected — recommendation |
| **Override Warehouse** (`orders/override-warehouse`) | Warehouse Manager (+ Fulfillment Supervisor) | Route unprotected — recommendation |
| **Brand Transfer** (`brands/transfer`) | **Company Admin only** (+ Super Admin) — irreversible org restructure | Route unprotected — recommendation |
| **Brand Transfer Analyze** (`brands/transfer/analyze`) | Company Admin | Route unprotected — recommendation |
| **Refund** (POS) | Sales Manager (**not** Cashier) | Route unprotected — recommendation |
| **Void** (POS) | Sales Manager (**not** Cashier) | Route unprotected — recommendation |
| **Close Shift** (POS) | Sales Manager / shift supervisor (**not** regular Cashier) | Route unprotected — recommendation |
| **Override Cost** | Inventory Controller (via `inventory.price_review.update`) | **Granted** to Inventory Controller |
| **Approve Price Change** | Inventory Controller (+ Company Admin) via `inventory.price_review.approve` | **Granted** to Inventory Controller |
| **COD settlement finalize / payment verify** (logistics) | Shipping Coordinator / a Finance role | Shares coarse `logistics.distribution.update` — see caveat |

## 5. Files Changed (1)
- `backend/config/permissions.php` — added 20 role definitions + 20 grant blocks (existing permissions only). Runtime: re-ran `RbacSeeder` (idempotent). Re-run on deploy.

## 6. Verification

| Check | Result |
|-------|--------|
| PHP syntax (`php -l config/permissions.php`) | ✅ clean |
| Application boot | ✅ Laravel 12.62 |
| Seeder execution | ✅ 176 permissions (unchanged), **27 roles seeded**, all 20 new roles with grants |
| Permission assignments | ✅ counts correct (Driver 3 … Purchasing Manager 60, System Auditor 33) |
| Least-privilege / no super-perms | ✅ Cashier `pos.operate`=Y, `orders.create`=N; **0** operator roles with `is_system` |
| Permission guard | ✅ 9 unauthorized (unchanged — no route regression) |

## 7. Regression Risk — Low
- Additive-only: reseed used `firstOrCreate` + `syncWithoutDetaching` — no existing permission, role, or user assignment removed; existing roles unchanged.
- No new permissions, no matrix redesign, no route/controller/business-logic change → guard unchanged at 9.
- Super-admin unaffected. New roles start with **no users assigned** (user→role assignment is an operational step).

## 8. Production Readiness
This closes certification condition #1: **ECOS can operate daily without Company Admin.** Two documented caveats for the CTO:
1. **Coarse `logistics.distribution` permission** — dispatch, driver trip-execution, and COD settlement all share `logistics.distribution.update`, so Driver/Dispatcher inherit settlement capability. A future `logistics.distribution.execute`/`settle` split would tighten this (needs a new permission → out of this task's "no new permissions" scope).
2. **Group-gated modules** (marketing, cep, omnichannel, pos, bae, engineering, claude_bridge) require their `manage`/`operate` permission even to **read** (group-level gating from the Platform task), so a view-only System Auditor cannot read those modules. Making those groups gate writes-only would enable read-only audit — a follow-up.

Remaining certification conditions (seeded data, module scope, canonical cutover, Category C route sign-off, prod caches, load test) are unchanged and still apply.

STOP.
