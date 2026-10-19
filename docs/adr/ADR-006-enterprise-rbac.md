# ADR-006 — Enterprise RBAC Architecture

**Status:** Accepted  
**Task:** TASK-SECURITY-001A  
**Date:** 2026-06-29

---

## Context

TASK-SECURITY-001 delivered a functional RBAC foundation: roles, permissions, a pivot-based assignment model, and a PermissionService. As the system prepares for multi-company, multi-branch, and multi-warehouse operations, the flat pivot architecture became a ceiling:

- A composite-PK pivot cannot be a first-class auditable entity.
- Scope-aware authorization (per-company, per-branch, per-warehouse) requires additional columns on the assignment row.
- Hardcoding `slug == 'super-admin'` for bypass logic prevents adding future privileged roles without code changes.
- Two-segment permission names (`products.view`) conflate domain and resource, making it impossible to query "all inventory permissions" without substring matching.

---

## Decisions

### 1. Role Assignments are Entities, not Pivots

**Before:** `user_role (user_id, role_id)` — composite PK, no identity, no scope.

**After:** `user_roles (id UUID PK, user_id, role_id, company_id?, branch_id?, warehouse_id?, timestamps)`

**Why:** A role assignment in an enterprise ERP is not merely a link between two records. It is itself a business fact: *user X holds role Y within the scope of company Z*. An entity has:
- Its own identity (UUID PK) — survives foreign-key reshuffling.
- Audit columns (created_at, updated_at) — answers "when was this role granted?"
- Scope columns — the only place where Company / Branch / Warehouse scoped authorization can attach without an additional join table.

The Eloquent `Pivot` base class is used so `BelongsToMany` relationships continue to work without changes to calling code.

### 2. Permission Grants are Entities, not Pivots

**Before:** `role_permission (role_id, permission_id)` — composite PK, no metadata.

**After:** `role_permissions (id UUID PK, role_id, permission_id, effect, conditions?, expires_at?, created_at)`

**Why:** A permission grant is a policy decision that will eventually carry:
- `effect` (allow / deny) — deny-overrides require a first-class row.
- `conditions` (JSON rule bag) — attribute-based access control attaches here.
- `expires_at` — time-bounded grants for contractors, temporary escalations.

Adding these as nullable columns with non-breaking defaults means the future rule engine can read them without a schema migration. Today's code ignores them entirely.

### 3. Hierarchical Permission Naming

**Before:** `module.action` — e.g. `products.view`, `inventory.adjust`

**After:** `domain.resource.action` — e.g. `inventory.products.view`, `inventory.stock.adjust`

**Why:**

- **Queryability:** `WHERE name LIKE 'inventory.%'` returns every inventory permission. The old format required `WHERE module = 'products' OR module = 'inventory' OR module = 'categories' …`.
- **Clarity:** `inventory.view` is ambiguous (view what?). `inventory.stock.view` is unambiguous.
- **Domain alignment:** Domain names map directly to module namespaces (`Modules\Inventory`, `Modules\Sales`, `Modules\CRM`). A developer reading a permission name immediately knows which module to look in.
- **Conflict avoidance:** Two modules could share a resource name (e.g. `reports` in both Sales and Finance). The domain prefix prevents collisions without additional disambiguation.

The `permissions` table gains a `resource` column. The `module` column is repurposed to store the top-level domain. The `name` column remains the single key used in application logic.

### 4. System Roles via `is_system`, not Slug

**Before:** `if ($role->slug === 'super-admin')` — hardcoded in middleware, Gate::before, and tests.

**After:** `if ($role->is_system === true)` — evaluated by `PermissionService::userHasSystemRole()`.

**Why:** Hardcoding `'super-admin'` as the bypass sentinel means every future privileged role (Owner, System, Support, Internal Bot) requires a code change to gain the same bypass. The `is_system` flag is a data-driven declaration: a role is privileged by its attributes, not its name. New system roles are added to the config/seeder with `is_system: true` and immediately gain full bypass without touching application code.

### 5. Scoped Authorization Architecture (stub)

A `userHasPermissionInScope(User, string, ?companyId, ?branchId, ?warehouseId)` method is added to the interface and service. Today it delegates to the flat `userHasPermission()` check — scope parameters are ignored.

**Why prepare it now:** The interface is a contract consumed by middleware, controllers, and policies. Changing the interface after scoped authorization is implemented would break all call sites. Establishing the signature now means callers can be updated incrementally, and the implementation can fill in scope logic without an interface version bump.

### 6. Cache Tag Support with Driver Fallback

The PermissionService detects tag support at runtime via `BadMethodCallException`. When tags are available (Redis, Memcached), role-wide cache invalidation flushes a single `rbac` tag group instead of iterating all role members. When tags are unavailable (file, database, array drivers), the original per-key `Cache::forget()` loop runs.

**Why:** Cache tags make `invalidateRoleCache` O(1) on tag-aware stores. Without fallback, the code would break in environments using the file driver (local dev, CI with no Redis).

---

## Consequences

### Positive
- Role assignments are auditable entities with scope capability ready to activate.
- Permission grants carry the architecture for allow/deny, conditions, and expiry.
- Permission names are self-documenting and domain-queryable.
- System role bypass is data-driven — no code changes for new privileged roles.
- Cache invalidation improves on Redis/Memcached without sacrificing file-driver compatibility.
- 23 test cases cover all new behaviors including the `is_system` bypass, hierarchical names, new table names, the scope stub, and the non-system-role guard.

### Neutral
- Existing callers of `userHasPermission(user, permission)` require no changes.
- The `permission:` middleware route syntax is unchanged.
- Eloquent relationships (`$user->roles()`, `$role->permissions()`) work identically.

### Negative / Trade-offs
- The three-segment permission name is longer to type. Mitigated by the config registry.
- `invalidateRoleCache` on tag-unsupported drivers still iterates role members (same as before).
- The `conditions` / `expires_at` columns on `role_permissions` carry no enforcing logic yet — they are inert until the rule engine is implemented.

---

## Alternatives Considered

| Alternative | Rejected because |
|---|---|
| Keep composite-PK pivots, add scope via a separate join table | Two levels of indirection for a single fact (who has which role in which scope). More joins, harder auditing. |
| Prefix permission names with module only (`inventory:products.view`) | Colon is non-standard in Laravel middleware syntax `permission:…` — would require escaping. |
| Detect system roles by a naming convention (slug starts with `system-`) | Still a slug-based check — brittle, easy to violate by accident. |
| Store permission scope on the permission record, not the assignment | Permissions are global definitions; scope is a property of the *grant*, not the *permission*. |
