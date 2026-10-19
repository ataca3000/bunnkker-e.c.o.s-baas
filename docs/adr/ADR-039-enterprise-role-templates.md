# ADR-039 — Enterprise Role Templates (Business Job-Profile Layer)

**Status:** Accepted (architecture) · Phase 1 (backend engine + library) delivered — 2026-08-04
**Builds on:** [ADR-038 — Enterprise Authorization Platform](ADR-038-enterprise-authorization-platform.md)
**Task:** TASK-IAM-003

---

## Context

ADR-038 gave ECOS a five-engine Authorization Platform (permissions, visibility, data
scope, policy) whose runtime reads the existing `roles` + `role_permissions` tables. But
users are still provisioned by assigning individual permissions/roles — there is no
canonical, reusable definition of *a job*. "Warehouse Clerk" as a business concept —
its permissions, what costs it may **not** see, which warehouse its data is scoped to,
which policies bind it, what it lands on, and how its dashboard looks — lives nowhere.

We need an **Enterprise Role Template Library**: official, versioned, immutable job
profiles that every user is provisioned from, so onboarding is fast, security is
consistent, and roles are auditable and portable across companies/branches/warehouses.

## Decision 1 — Templates author, roles execute (zero runtime coupling)

A **Role Template is the authoring layer**; the Authorization Platform runtime is
unchanged. A template is a complete, declarative **job profile**; it *compiles down* to
the existing runtime primitives:

```
RoleTemplate (business job profile)  ──compile──▶  Role + role_permissions rows
        │                                                   │
   permissions, visibility, scope,                    read unchanged by
   policy, navigation, dashboard,                     the ADR-038 engines
   landing, preferences (JSON)                        (PermissionService, resolvers)
```

Consequence: **no change to the authorization runtime.** Templates are additive metadata;
the engines never learn about templates. A template optionally links to one runtime
`role` (`role_templates.role_id`) that it keeps in sync via idempotent `syncWithoutDetaching`.

## Decision 2 — Composition reuses the existing multi-role runtime

A user may already hold **multiple roles** (`user_roles`), and ADR-038 already resolves
them (permission **union**, **widest-scope-wins**). So "Ahmed = Sales Rep + Warehouse
Clerk" needs no new runtime — it is two role assignments. The template layer adds only the
**authoring-time** composition semantics (allow/deny/priority) that power **preview** and
the compiled effective profile. Composition is therefore a pure, side-effect-free function:

`compose(templates[], strategy) → EffectiveRoleProfile`.

## Decision 3 — Conflict resolution strategy (deterministic)

`EffectiveRoleProfile` is produced by merging an **ordered** (priority-ranked) template list:

| Dimension | Rule | Rationale |
|---|---|---|
| Permissions | union of allows, then **subtract explicit denies** (deny wins) | least privilege on conflict |
| Data scope (per resource) | **widest wins** (ALL > COMPANY > REGION > BUSINESS_UNIT > DEPARTMENT > CHANNEL > WAREHOUSE > BRANCH > TEAM > SELF) | matches ADR-038 runtime resolution |
| Field visibility (hidden fields) | **intersection** — a field is hidden only if **every** template hides it (any grant of the view-permission reveals it) | visibility follows permission union |
| Policies | union of policy-bundle keys | all constraints apply |
| Navigation (module ids) | union | see a module if any profile grants it |
| Dashboard / landing / preferences | **highest-priority template wins** (singular UI defaults) | one screen can only land one place |

Deny-wins + widest-scope + visibility-intersection are internally consistent: the same
"less restrictive access, more restrictive denial" logic ADR-038 uses at runtime.

## Decision 4 — Versioning: append-only, never overwrite

Every template carries `version` + `status` (`draft` → `published` → `deprecated` →
`archived`). Publishing snapshots the full definition into `role_template_versions`
(immutable, unique `(template, version)`). Historical versions are never mutated or
deleted — audit and rollback are always possible. Editing a published template creates a
new draft version; it never rewrites history.

## Decision 5 — System vs Custom (immutability + clone)

- **System templates** (`is_system = true`) are the 40 official ECOS job profiles. They are
  **immutable**: the repository refuses edit/delete and raises `SystemTemplateImmutableException`.
- To change one, you **clone** it → a new editable **custom** template (`is_system = false`,
  new key, version reset to 1, `role_id` unlinked). Organizations build company/department/
  temporary/project roles this way without ever touching the official library.
- **Import** always produces a custom template (never a system one), regardless of the
  payload's `is_system` flag — you cannot smuggle in a system role.

## Decision 6 — Definitions are declarative JSON over real vocabulary

A template `definition` references the **actual** platform vocabulary discovered in the
codebase, not invented tokens:

- `permissions`: `module.resource.action` names + wildcards (`inventory.*`, `inventory.products.*`, `*`) expanded against the live permission catalog at compile/preview time.
- `visibility.hidden_fields`: semantic field tokens (`cost`, `average_cost`, `margin`, …) for preview/compare; **enforcement stays permission-driven** (the template simply does not grant the `view_cost`-style permission) per ADR-038.
- `scopes`: `{ "resource": DataScope }` using the ADR-038 `DataScope` enum.
- `policies`: policy-bundle keys (`PolicyRule` keys).
- `navigation`: module ids from `config/module-navigation.ts` (`inventory`, `warehouse`→`operations`, `finance`, …).
- `dashboard`: `{ profile, widgetOrder, hidden, collapsed }` over the 8 dashboard widget ids.
- `landing_page`: a `ROUTES` key.
- `preferences`: `{ theme, language, dashboardProfile }`.

Templates carry the profile data even where enforcement is not yet adopted per resource —
consistent with ADR-038's "engines inert until adopted" stance.

## Schema changes (additive, reversible, non-breaking)

- **`role_templates`** — `id` uuid, `key` unique, `name`, `description`, `category`,
  `status`, `version`, `is_system`, `is_composable`, `definition` json, `role_id` uuid
  nullable (→ compiled runtime role), `created_by`/`updated_by` bigint nullable,
  `published_at`, timestamps.
- **`role_template_versions`** — immutable snapshots: `id`, `role_template_id` fk, `version`,
  `key`/`name`/`category`/`status` (snapshot), `definition` json, `change_note`,
  `created_by`, `created_at`; unique `(role_template_id, version)`.

No existing table is altered. No existing behaviour changes.

## Consequences

**Positive:** one canonical job library; users provisioned from profiles not ad-hoc grants;
consistent security + rapid onboarding + auditability; portable (export/import JSON) across
companies/branches; composition/preview/compare available with **zero** runtime change.

**Neutral:** templates are inert authoring metadata until compiled/assigned; per-resource
visibility/scope enforcement adoption remains the separate ADR-038 track.

**Trade-offs:** definitions reference vocabulary (nav ids, widget ids, ROUTES keys) that
lives in the frontend — drift is possible; mitigated by keeping tokens declarative and
validated on import. Sensitive-field permissions (`view_cost`, …) are not all seeded yet;
templates declare the visibility profile now, enforcement lands with per-resource adoption.

## Phased plan

- **Phase 1 (this ADR) — backend engine + library.** ✅ Aggregate, versioning, composition +
  conflict resolver, preview, comparison, export/import, system protection, 40 official
  templates, tests. STOP for review.
- **Phase 2 — frontend Role Template Workspace.** Library, preview, compare, clone, builder,
  metadata, history, search/filters/categories. No user-management UI.
- **Phase 3 — provisioning.** Assign templates → users (compiles to roles); the user-management
  surface (out of scope here) consumes this.
