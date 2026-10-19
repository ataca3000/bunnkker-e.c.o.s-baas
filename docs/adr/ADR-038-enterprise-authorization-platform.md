# ADR-038 — Enterprise Authorization Platform (Four-Engine Model)

**Status:** Accepted (architecture) · **Full platform delivered** — 2026-08-04 (all five engines + frontend infrastructure, additive & non-breaking; pending CTO review)
**Task:** TASK-IAM-002 — Enterprise Authorization Engine
**Date:** 2026-08-03
**Supersedes:** nothing. **Extends:** ADR-006 (Enterprise RBAC), ADR-007 (Organization Context)
**Depends on (deferred):** TASK-IAM-001 role hierarchy & user status are *not required* for Phases 1–3 and are called out where relevant.

---

## Context

Authentication ("who are you?") is already solved (Sanctum, `Modules/IAM`).
Authorization ("what may you do?") is already largely solved by the ADR-006 RBAC:
`PermissionService` + the `permission:` middleware (271 route guards) + `BasePolicy`
(13 module policies) + a CI write-route guard. Modules already never check roles directly.

TASK-IAM-002 requires **two further engines** on top of that, and formalises the whole
stack as one platform with a single decision surface:

```
Authentication → Authorization → Visibility → Data Scope → Business Module
```

- **Authorization Engine** — *may the user execute this action?* (mostly exists)
- **Visibility Engine** — *which fields may the user see?* (new — sensitive-field control)
- **Data Scope Engine** — *which records may the user access?* (new — SELF/TEAM/BRANCH/… /ALL)

**Hard constraints (CTO, 2026-08-03):** extend the existing IAM — **no rebuild, no parallel
implementation, no replacement of the security backbone**; keep the **bigint User PK**
(additive migrations only, no FK churn); **backward compatible, no breaking changes**;
delivered in **small verifiable phases**; **ADR + plan approved before any production code.**

The good news: ADR-006/007 already left the exact seams these engines need —
`role_permissions(effect, conditions, expires_at)`, `user_roles(company_id, branch_id,
warehouse_id)`, and a `PermissionService::userHasPermissionInScope()` stub. This ADR turns
those inert seams into working engines **additively**.

---

## Decision 1 — One decision surface, four engines behind it

Introduce a single facade every module consumes; the four engines live behind it.

```
Modules\IAM\Domain\Contracts\AuthorizationGatewayInterface   (the ONLY thing modules call)
   ├─ can(user, action, ?subject)              → Authorization Engine  (extends PermissionService)
   ├─ canViewField(user, field, ?subject)      → Visibility Engine      (new)
   ├─ scopeFor(user, resource): ScopeConstraint→ Data Scope Engine      (new)
   └─ decide(user, action, subject): Decision  → composes all three → ALLOW | DENY (+ mask + scope)
```

- The **Authorization Engine is the existing `PermissionService`** — kept, wrapped, not replaced. The gateway *delegates* `can()` to it. All 271 route guards and 13 policies keep working unchanged.
- Business modules receive only `ALLOW`/`DENY`, a **field mask** (from Visibility), and a **scope constraint** (from Data Scope). They never see roles, permissions, company, or branch.
- **Rule enforced by the existing CI guard, extended:** `if (role == …)` in a controller stays forbidden; the guard will also flag direct `permissions()`/`hasRole()` use outside `Modules/IAM`.

**Why a facade over "just add methods to PermissionService":** `PermissionService` answers *action* questions. Visibility and Data Scope are different questions with different caches and different return types (a mask, a query constraint). A thin gateway keeps each engine single-responsibility while giving modules one import.

---

## Decision 2 — Visibility Engine: sensitive fields ARE permissions

Model every sensitive field as a first-class permission using the **existing
`domain.resource.action` grammar**, where the action is a field-view verb:

```
inventory.products.view            ← open the screen (Authorization)
inventory.products.view_cost       ← see Product Cost / Avg / FIFO / Last Purchase   (Visibility)
inventory.products.view_margin     ← see Margin % / Profit                            (Visibility)
sales.orders.view_profit           ← see order profit                                 (Visibility)
manufacturing.recipes.view_cost    ← see recipe / manufacturing cost                  (Visibility)
finance.accounts.view_balance      ← see bank balance                                 (Visibility)
hr.employees.view_salary           ← see salary                                       (Visibility)
```

**Why reuse the permission grammar instead of a new `field_permissions` table:** field
visibility *is* a permission ("may this user see cost?"). Reusing `permissions` means it
flows through the **same cache, same grant model (allow/deny/expiry), same registry, same
seeder** with zero new plumbing. A separate table would fork all of that.

**Enforcement — where fields get stripped:**
- **Backend (source of truth):** a `VisibilityResolver` produces a *hidden-field set* for
  `(user, resource)`. **API Resources** (`JsonResource`) call it and `unset()` masked keys
  before serialising. A tiny `HidesSensitiveFields` trait makes this one line per resource.
  Opt-in per resource → **nothing is hidden until a resource declares its sensitive-field
  map**, so existing responses are byte-identical until we migrate them (backward compatible).
- **Frontend (UX only, never security):** `canViewField()` hides columns/cards/KPIs so the
  client doesn't render a blank. The backend mask is the real boundary.

A central **`SensitiveFieldRegistry`** maps `resource → { field → required-permission }`
(e.g. `products.average_cost → inventory.products.view_cost`) so the same map drives both the
API mask and the frontend helper — one source of truth.

---

## Decision 3 — Data Scope Engine: scope is a property of the grant

Add a `data_scope` descriptor to the **grant** (`role_permissions`), defaulting to `all`:

```
role_permissions.data_scope  enum(self, team, branch, warehouse, channel, company, custom, all)  default 'all'
```

- **Default `all` = current behaviour**, so adding the column changes nothing until a grant
  narrows it. Backward compatible by construction.
- A `DataScopeResolver` turns `(user, resource, effective grant)` into a **`ScopeConstraint`**
  value object — a declarative filter (`column`, `operator`, `values`) — *not* raw SQL.
- Repositories/queries apply it via a `ScopesToUser` helper (a query macro
  `->scopedTo($user, 'sales.orders')`). Because it is **opt-in per query**, unscoped queries
  keep returning everything until a module adopts it.
- Scope inputs come from **existing infrastructure**: `users.company_id`, the
  `user_roles.{company_id,branch_id,warehouse_id}` columns, and the `OwnsCompany` contract
  (ADR-007). `SELF` = `owner_id/created_by = user`; `TEAM` = a resolvable team set;
  `CHANNEL`/`CUSTOM` = a scope descriptor bag (JSON) — added additively so new org units
  (department, future unit) need no schema redesign, satisfying the "Business Scope without
  redesign" requirement.

**Why on the grant, not the role or the permission:** a permission is a global definition;
a role is a bundle; the *scope of what you can touch* is a property of **this role's grant of
this permission** — exactly where ADR-006 already put `effect`/`conditions`. Same row, same
cache invalidation.

`userHasPermissionInScope()` (today a stub) becomes the Authorization+Scope entry point.

---

## Decision 4 — Permission Groups + Registry (formalise, reconcile fragmentation)

- New `permission_groups` table (id, code, name, sort_order, icon) and a nullable
  `permissions.group_id`. Groups: Administration, Inventory, Purchasing, Manufacturing,
  Preparation, Packing, Shipping, Commerce, CRM, Marketing, Accounting, Finance, Reports,
  AI Platform. Nullable FK = additive; ungrouped permissions still resolve.
- A **`PermissionRegistry`** service becomes the single ingestion point. Modules declare their
  permissions (incl. `view_*` field verbs) via a `RegistersPermissions` provider hook;
  the registry **dedupes, versions, and syncs** to the DB (superseding the three fragmented
  seeders — `config/permissions.php`+`RbacSeeder`, the `2026_12_20` matrix migration, and the
  per-module Fleet/Delivery/Preparation seeders). A `PermissionName` value object enforces the
  grammar so no scattered string literals remain. *This reconciliation is the one place where
  the platform meets TASK-IAM-001's registry work; it is sequenced last and is non-breaking.*

---

## Decision 5 — Resolution pipeline & caching

```
User → effective roles → effective permissions (allow/deny, deny-overrides)
     → Authorization decision (action)  ┐
     → Visibility mask (fields)          ├─ composed by AuthorizationGateway::decide()
     → Data Scope constraint (records)  ┘  → returns { ALLOW|DENY, hiddenFields[], scope }
```

- Extend the **existing** per-user cache (`rbac.user.{id}.perms`, TTL 300s, Redis-tag with
  file-driver fallback) to also memoise resolved **field masks** and **scope constraints**
  per `(user, resource)`. Reuse the existing `invalidateUserCache`/`invalidateRoleCache`
  hooks — already fired on role/permission/assignment change — so cache invalidation is
  automatic and needs no new events.
- Deny-overrides: `role_permissions.effect = deny` wins over any allow (ADR-006 left the
  column; this ADR activates the precedence in the resolver).

---

## Decision 6 — Frontend authorization infrastructure (no screens)

- Extend the `/auth/me` (and login) payload to include the user's **effective permissions**,
  **field grants**, and **scope summary** (already the documented extension point in
  `user-menu.tsx:26`). `AuthUser` gains `permissions`, `fieldGrants`, `scopes`.
- Ship primitives only: `can()`, `cannot()`, `hasPermission()`, `canViewField()`,
  `canExecute()`, `canAccess()`, `hasScope()`; hooks `useCan`/`usePermission`/`useFieldVisibility`;
  a `<Can permission=… field=…>` component; a `RequirePermission` route guard (composes with the
  existing auth-only `ProtectedRoute`); and permission-driven **navigation** + **dashboard-card**
  visibility helpers. **No management screens** (those are later tasks).

---

## Schema changes (all additive, reversible, non-breaking)

| Change | Table | Default / safety |
|---|---|---|
| `data_scope` enum | `role_permissions` | `'all'` → no behavioural change |
| `permission_groups` table + `group_id` FK | `permissions` | nullable → ungrouped still works |
| `view_*` field permissions (rows only) | `permissions` | seed-only; hidden nothing until a Resource opts in |
| (optional, Phase 3+) `scope_descriptor` json | `role_permissions` | nullable → for CHANNEL/CUSTOM/future units |

No change to `users` (honours "keep bigint, additive only"). No change to any existing column
type. Every migration guarded with `hasTable`/`hasColumn` (repo convention).

---

## Backward-compatibility guarantee

Every engine is **default-open and opt-in**:
- Data Scope defaults to `ALL` → existing queries unchanged until `->scopedTo()` is added.
- Visibility hides nothing until a Resource declares a sensitive-field map.
- The Authorization Engine is the untouched `PermissionService`; 271 guards keep passing.
- The frontend primitives are additive; no page behaviour changes until a page calls them.

So the platform can be merged and shipped **before** any module adopts it — zero regressions —
and modules migrate onto it incrementally.

---

## Phased, verifiable implementation plan (each phase independently shippable)

- **Phase 0 — this ADR + plan approved.** ✅ Done.
- **Phase 1 — Gateway + registry + groups + value objects (no behaviour change).** ✅ **Delivered 2026-08-03.** `AuthorizationGatewayInterface` + `AuthorizationGateway` (delegates `can()` to `PermissionService`), immutable `AuthorizationDecision`, `PermissionRegistry` (+interface), `PermissionName` value object, `PermissionGroup` enum + model, `permission_groups` table + nullable `group_id`, container bindings. **35 new tests pass (252 assertions); existing 23-test RbacTest + DebugCacheTest still green — zero authorization behaviour change.**
- **Phase 2 — Visibility Engine.** ✅ **Delivered 2026-08-04.** `SensitiveFieldRegistryInterface` + `SensitiveFieldRegistry` (in-memory, singleton), `VisibilityResolverInterface` + `VisibilityResolver`, `FieldVisibility` enum, `HidesSensitiveFields` trait for JsonResource server-side masking. Non-sensitive fields always visible; a resource hides nothing until it registers a field→permission map; system roles hide nothing. Cached `rbac.vis.*`.
- **Phase 3 — Data Scope Engine.** ✅ **Delivered 2026-08-04.** `data_scope`(string, default `all`) + `scope_descriptor`(json) columns on `role_permissions`; `DataScope` enum (11 scopes), `ScopeConstraint` VO, `ScopeResolverInterface` + `ScopeResolver` (widest-scope-wins across roles), `Builder::scopedTo($user, $resource, $ownerColumn)` macro. Default grant → unrestricted (`all`); SELF/COMPANY/BRANCH/WAREHOUSE/descriptor scopes resolve declaratively. Cached `rbac.scope.*`.
- **Phase 4 — Policy Engine + Frontend infra.** ✅ **Delivered 2026-08-04.** Backend: `PolicyRule` interface, `PolicyContext`/`PolicyResult` VOs, `PolicyResolverInterface` + `PolicyResolver` (deny-overrides), composed by the Gateway's `decision()`. `/auth/me` + login extended additively (`AuthenticatedUserDTO` now carries `permissions[]` + `is_system`). Frontend (`features/authorization/`): `useAuthorization/useVisibility/useScope` hooks, `can/cannot/canViewField/hasScope` helpers, `<Can>/<Cannot>/<CanViewField>/<HasScope>` components, `<RequirePermission>` route guard + `<PermissionBoundary>`. No management screens.
- **Phase 5 — Gateway composition + full test matrix.** ✅ **Delivered 2026-08-04.** `AuthorizationGateway.decision()` composes inspect → policy veto → visibility + scope enrichment into a single immutable `AuthorizationDecision`. Full IAM suite: **73 tests / 331 assertions pass**, including the untouched 23-test `RbacTest` + `DebugCacheTest` — zero regression. Registry reconciliation & cache consolidation across the three legacy permission sources remain a tracked follow-on (engines are additive and inert until adopted).

Each phase shipped additively: guarded migrations, `docker cp` deploy, targeted tests — then STOP for review, per house rules.

---

## Consequences

**Positive:** one decision surface; visibility & data scope become first-class without a
schema redesign; business modules stay security-agnostic; multi-company/branch/warehouse/
channel and future org units are supported by descriptor, not migration; the existing 271
guards, 13 policies, CI guard, and cache are preserved and extended.

**Neutral:** engines are inert until adopted; adoption is a per-module migration effort tracked separately.

**Trade-offs / risks:** (1) Field masking must live at the **API Resource** layer to be
authoritative — any endpoint returning raw arrays must be inventoried (Phase 2 audit).
(2) Data-scope correctness depends on each resource declaring its ownership column; a wrong
declaration is a security bug → covered by scope tests + the CI guard. (3) Role inheritance
(TASK-IAM-001) is not required here; when it lands, the resolver's "effective roles" step is
the single integration point.

## Alternatives considered

| Alternative | Rejected because |
|---|---|
| Separate `field_permissions` table | Forks the cache/grant/registry; field visibility *is* a permission. |
| Put `data_scope` on the role or permission | Scope is a property of the *grant*, matching `effect`/`conditions` (ADR-006). |
| Enforce field masking in the frontend | Client masking is UX, never security; raw data would still cross the wire. |
| Build a brand-new engine parallel to `PermissionService` | Violates "no parallel IAM"; breaks 271 guards; duplicates working code. |
