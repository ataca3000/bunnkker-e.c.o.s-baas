# TASK-IAM-002 — Enterprise Authorization Platform · Engineering Report

**Date:** 2026-08-04 · **ADR:** [ADR-038](../adr/ADR-038-enterprise-authorization-platform.md) (Accepted) · **Status:** Complete, pending CTO review · **Working tree:** uncommitted

---

## 1. Executive Summary

TASK-IAM-002 delivers the complete **Enterprise Authorization Platform** on top of the
existing IAM module — **not a rewrite**. A single `AuthorizationGateway` now fronts five
cooperating engines: **Authorization** (the untouched `PermissionService`), **Information
Visibility** (field masking), **Data Scope** (record filtering), **Policy** (business
rules), and the **Permission Registry**. A matching frontend infrastructure (`useAuthorization`,
`<Can>`, `<RequirePermission>`, …) lets the UI shape affordances without ever reading roles
directly.

Every change is **additive, opt-in, and deny-by-default-off**: data scope defaults to `all`
(unrestricted), visibility hides nothing until a resource registers a field map, and no
existing route guard, policy, or permission grant changes behaviour. The full IAM test suite
— **73 tests / 331 assertions** — passes, including the 23-test `RbacTest` and `DebugCacheTest`
carried over verbatim. **Zero regressions. No breaking changes.**

## 2. Architecture Verification

- **Single decision surface.** All authorization flows through `AuthorizationGatewayInterface`
  (`can/cannot/authorize/inspect/decision/decide`). Modules never check roles directly.
- **`can()` is byte-for-byte identical** to `PermissionService::userHasPermission` — proven by
  `AuthorizationGatewayTest::test_can_is_byte_for_byte_identical_to_permission_service`.
- **Engines are inert until adopted.** `ScopeResolver` returns *unrestricted* for the default
  `all` grant; `VisibilityResolver` returns `[]` hidden fields for any resource without a
  registered map; `PolicyResolver` allows when no rule applies.
- **Deny-overrides** where it matters: policy evaluation returns the first deny; scope resolution
  takes the *widest* scope across a user's roles (least restrictive wins, matching additive RBAC).
- **Server is authoritative.** Field masking lives in the `HidesSensitiveFields` JsonResource
  trait; the frontend `canViewField` only hides empty affordances — it never gates data.

## 3. Files Created

**Backend — `backend/Modules/IAM/`**

| Layer | File |
|---|---|
| Enums | `Domain/Enums/DataScope.php`, `Domain/Enums/FieldVisibility.php` |
| Value Objects | `Domain/ValueObjects/ScopeConstraint.php`, `Domain/ValueObjects/AuthorizationDecision.php` (rewritten) |
| Policy | `Domain/Policies/PolicyContext.php`, `PolicyResult.php`, `PolicyRule.php` |
| Contracts | `Domain/Contracts/ScopeResolverInterface.php`, `VisibilityResolverInterface.php`, `PolicyResolverInterface.php`, `SensitiveFieldRegistryInterface.php` |
| Services | `Application/Services/AuthorizationGateway.php` (rewritten), `ScopeResolver.php`, `VisibilityResolver.php`, `PolicyResolver.php`, `SensitiveFieldRegistry.php` |
| Presentation | `Presentation/Concerns/HidesSensitiveFields.php` |
| Migration | `Infrastructure/Database/Migrations/2026_08_04_100000_add_data_scope_to_role_permissions_table.php` |

*(Phase-1 files — `PermissionName`, `PermissionRegistry`, `PermissionGroup` enum+model, group migrations — delivered previously under the same ADR.)*

**Frontend — `frontend/src/features/authorization/`**

| File | Exports |
|---|---|
| `types.ts` | `Permission`, `DataScope`, `Authorization`, `normalizePermission()` |
| `use-authorization.ts` | `useAuthorization()`, `useVisibility()`, `useScope()`, `grants()` |
| `components/can.tsx` | `<Can>`, `<Cannot>`, `<CanViewField>`, `<HasScope>` |
| `guards/require-permission.tsx` | `<RequirePermission>`, `<PermissionBoundary>` |
| `index.ts` | barrel |

**Backend tests:** `tests/Feature/IAM/AuthorizationPlatformTest.php` (visibility/scope/policy/gateway composition), plus updates to `AuthorizationDecisionTest`, `AuthorizationGatewayTest`.

## 4. Files Modified

- `Domain/Models/RolePermission.php` — `data_scope`, `scope_descriptor` fillable; `scope_descriptor` array cast.
- `Domain/Contracts/AuthorizationGatewayInterface.php` — extended surface (`inspect/decision/decide`).
- `Infrastructure/Providers/IamServiceProvider.php` — container bindings + `Builder::macro('scopedTo', …)`.
- `Application/DTO/AuthenticatedUserDTO.php` — **additive**: now carries `permissions[]` + `is_system`.
- `frontend/src/features/auth/types.ts` — `AuthUser` gains optional `permissions?`, `is_system?`.
- `docs/adr/ADR-038-*.md` — status → full platform delivered.

## 5. Database Changes

One additive, guarded, reversible migration:
`2026_08_04_100000_add_data_scope_to_role_permissions_table`

- `role_permissions.data_scope` — `string(32)`, **default `'all'`** (→ existing grants stay unrestricted), indexed.
- `role_permissions.scope_descriptor` — `json`, nullable.

Guarded with `hasColumn`; portable string column (no DB enum) per migration conventions. No data backfill required — the default preserves current behaviour for every existing grant.

## 6. Container Bindings (`IamServiceProvider`)

- `AuthorizationGatewayInterface` → `AuthorizationGateway`
- Singletons: `PermissionRegistryInterface`, `SensitiveFieldRegistryInterface`, `VisibilityResolverInterface`, `ScopeResolverInterface`, `PolicyResolverInterface`
- Eloquent macro: `Builder::scopedTo(User, string $resource, ?string $ownerColumn)` → applies the resolved `ScopeConstraint`.

## 7. ADR Updates

ADR-038 status advanced from *Phase 1 Delivered* to **Full platform delivered (2026-08-04)**;
Phases 2–5 marked ✅ with per-engine delivery notes. Registry reconciliation + cache
consolidation across the three legacy permission sources explicitly recorded as a tracked
additive follow-on (engines inert until adopted).

## 8. Performance Analysis

- **Scope resolution** cached per `(user, resource)` — `rbac.scope.*`, TTL 300s. System role and
  default-`all` short-circuit before any query.
- **Visibility resolution** cached per `(user, resource)` — `rbac.vis.*`. Empty map / system role
  short-circuit to `[]`.
- **`can()`** rides the existing `PermissionService` permission cache — no new query path.
- Net added cost on the hot authorization path (permission check only): **zero** — enrichment
  (visibility/scope) runs only when a caller invokes `decision()`, not on plain `can()`.

## 9. Regression Analysis

- 23-test `RbacTest` and `DebugCacheTest` carried over **unmodified** — both green.
- `can()`/`cannot()` identity test proves no divergence from `PermissionService`.
- 271 existing `permission:` route guards, 13 `BasePolicy` policies, and the CI write-route
  guard are untouched. The pre-existing write-route-guard working-tree debt (9 routes) is
  unrelated — IAM added **zero** routes/controllers.
- `/auth/me` has no exact-shape contract test; additive fields serialize via `BaseDTO::toArray`
  reflection without breaking consumers.

## 10. Test Results

```
docker exec -e DB_DATABASE=ecos_erp_test ecos-app php artisan test tests/Unit/IAM tests/Feature/IAM
Tests: 73 passed (331 assertions)   Duration: ~9.8s
```

Coverage: PermissionName, AuthorizationDecision composition, Gateway delegation + system
bypass + `decide` alias, PermissionRegistry idempotent sync, Visibility (hidden/visible/system),
Data Scope (default-unrestricted, self, widest-wins, `scopedTo` macro), Policy (deny-when-rule /
allow-when-none), Gateway composition (visibility+scope enrichment, policy veto, `authorize` throws).

Frontend: scoped `tsc --noEmit` reports **zero errors** across `features/authorization/**` and the
modified `features/auth/types.ts`.

## 11. Breaking Change Assessment

**None.** Enumerated:
- New columns default to `all` / `null` → existing grants unchanged.
- New interfaces/services are added bindings; no existing binding replaced in behaviour.
- `AuthorizationDecision` rewrite keeps `isAllowed/isDenied/reason` and gains nullable
  composition fields (default `null`).
- DTO + `AuthUser` additions are optional/defaulted.
- Frontend `features/authorization/` is net-new; no existing component imports changed.

## 12. Future Readiness

- **Role inheritance (TASK-IAM-001):** the resolver's "effective roles" step is the single
  integration point when inheritance lands — no engine redesign.
- **New org units** (region, business unit, department, channel) are supported today via
  `scope_descriptor` — by data, not migration.
- **Adoption path:** a module opts in by (a) registering a sensitive-field map, (b) tagging a
  grant's `data_scope`, and/or (c) registering a `PolicyRule`. Until it does, nothing changes.
- **Registry reconciliation** of the three legacy permission sources is the recommended next
  additive task, tracked separately.
