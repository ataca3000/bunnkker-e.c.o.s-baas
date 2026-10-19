# TASK-IAM-003 — Enterprise Role Templates · Engineering Report (Phase 1)

**Date:** 2026-08-04 · **ADR:** [ADR-039](../adr/ADR-039-enterprise-role-templates.md) · **Builds on:** [ADR-038](../adr/ADR-038-enterprise-authorization-platform.md) · **Status:** Backend engine + library complete, pending CTO review · **Working tree:** uncommitted

---

## 1. Executive Summary

TASK-IAM-003 delivers the **Enterprise Role Template Library** — the business job-profile
layer on top of the ADR-038 Authorization Platform. A Role Template is a complete job
profile (permissions + information visibility + data scope + policies + navigation +
dashboard + landing page + preferences), not a bare RBAC role.

The central architectural decision: **templates author, roles execute.** Templates compile
down to the existing `roles`/`role_permissions` runtime, so the Authorization Platform reads
roles **unchanged** — zero runtime coupling, zero behaviour change. Role *composition*
(multiple templates → one effective profile) reuses the multi-role runtime that already
resolves permission-union and widest-scope; the template layer adds only the authoring-time
conflict semantics that power **preview** and **comparison**.

Phase 1 ships the full backend: the `RoleTemplate` aggregate, append-only versioning,
composition + a deterministic conflict resolver, preview, comparison, export/import, system
immutability + cloning, and the **40 official ECOS system templates** — all additive.
**88 IAM tests pass (409 assertions)**: 15 new Role Template tests + the entire 73-test
Authorization Platform suite, unchanged. **Zero regressions. No breaking changes.** The
frontend Role Template Workspace is Phase 2 (per the CTO's "small verifiable phases" rule).

## 2. Architecture

```
RoleTemplate (job profile, JSON definition)
      │  compile (idempotent syncWithoutDetaching)
      ▼
Role + role_permissions  ──read unchanged──▶  ADR-038 engines (auth / visibility / scope / policy)
```

- **Authoring vs runtime** — templates are additive metadata; the engines never learn about
  them. A template optionally links to one runtime role via `role_templates.role_id`.
- **Composition = pure function** — `compose(templates[], priority order) → EffectiveRoleProfile`.
  No persistence, no side effects; drives preview and the compiler.
- **Declarative over real vocabulary** — definitions reference the actual platform tokens
  discovered in code: permission catalog names + wildcards, `module-navigation.ts` module ids,
  the 8-widget dashboard registry, `ROUTES` landing keys, ADR-038 `DataScope` values.

## 3. Files Created

**Backend — `backend/Modules/IAM/`**

| Layer | File |
|---|---|
| Enums | `Domain/Enums/RoleCategory.php` (17), `Domain/Enums/RoleTemplateStatus.php` |
| Models | `Domain/Models/RoleTemplate.php`, `Domain/Models/RoleTemplateVersion.php` |
| Value Objects | `Domain/ValueObjects/EffectiveRoleProfile.php`, `Domain/ValueObjects/RoleTemplateDiff.php` |
| Contracts | `Domain/Contracts/RoleTemplateRepositoryInterface.php`, `Domain/Contracts/RoleCompositionInterface.php` |
| Exceptions | `Domain/Exceptions/SystemTemplateImmutableException.php`, `Domain/Exceptions/RoleTemplateImportException.php` |
| Catalog | `Domain/Catalog/RoleTemplateCatalog.php` (the 40 templates) |
| Services | `Application/Services/RoleTemplateRepository.php`, `RoleTemplateVersionService.php`, `PermissionExpander.php`, `RoleConflictResolver.php`, `RoleCompositionService.php`, `RolePreviewService.php`, `RoleComparisonService.php`, `RoleTemplateExportService.php`, `RoleTemplateImportService.php` |
| Migrations | `Infrastructure/Database/Migrations/2026_08_05_100000_create_role_templates_table.php`, `..._100001_create_role_template_versions_table.php` |
| Seeder | `Infrastructure/Database/Seeders/RoleTemplateSeeder.php` |

**Docs/tests:** `docs/adr/ADR-039-enterprise-role-templates.md`, `tests/Feature/IAM/RoleTemplateTest.php` (15 tests).

## 4. Files Modified

- `Infrastructure/Providers/IamServiceProvider.php` — bind `RoleTemplateRepositoryInterface`, `RoleCompositionInterface`; singleton `PermissionExpander`.
- `database/seeders/DatabaseSeeder.php` — call `RoleTemplateSeeder` after `RbacSeeder`.

No existing class behaviour changed.

## 5. Database Changes

Two additive, guarded, reversible migrations — **no existing table altered**:

- **`role_templates`** — `id` uuid, `key` unique, `name`, `description`, `category`, `status`,
  `version`, `is_system`, `is_composable`, `definition` json, `role_id` uuid nullable (compiled
  role), `created_by`/`updated_by`, `published_at`, timestamps.
- **`role_template_versions`** — immutable snapshots: `id`, `role_template_id` fk (cascade),
  `version`, `key`/`name`/`category`/`status` snapshot, `definition` json, `change_note`,
  `created_by`, `created_at`; unique `(role_template_id, version)`.

## 6. Built-in Templates (40 official ECOS system profiles)

Executive: **CEO, COO, CFO, CTO**. Management: **Operations/Sales/Warehouse/Finance/Production/
Marketing/HR Directors**. Warehouse: **Warehouse Manager, Warehouse Clerk, Inventory Controller**.
Operations: **Purchasing Manager, Purchasing Officer**. Manufacturing: **Production Manager,
Production Operator, Quality Inspector, Packaging Supervisor, Packaging Operator**. Shipping:
**Shipping Manager, Dispatcher, Driver**. Sales: **Sales Manager, Sales Representative, Cashier**.
Customer Service: **Customer Service Manager, Customer Service Agent, CRM Specialist**. Marketing:
**Marketing Specialist**. Accounting/Finance: **Accountant, Senior Accountant, Financial
Controller**. HR: **HR Manager, HR Officer**. Administration/IT/AI: **System Administrator,
Support Engineer, AI Administrator, AI Analyst**.

Each carries a real definition: e.g. **Warehouse Clerk** grants only non-cost inventory/prep
actions, hides the 8 cost/margin fields, scopes inventory to `warehouse`, lands on the Inventory
Dashboard with a warehouse dashboard profile (financial/marketing widgets hidden). **Sales
Representative** scopes orders/customers to `self` and hides cost/profit/margin. **CEO/CFO/CTO/COO**
grant `*` and see everything. All seeded as **immutable system templates** (clone to customise).

## 7. Conflict Resolution Strategy

Composition merges an **ordered** (priority-ranked) template list; first = primary:

| Dimension | Rule |
|---|---|
| Permissions | union of grants **minus explicit denies** (deny wins) |
| Data scope (per resource) | **widest wins** (ALL > COMPANY > … > SELF), matching ADR-038 runtime |
| Field visibility | **intersection** — hidden only if *every* profile hides it (any grant reveals) |
| Policies / navigation / quick actions | union |
| Dashboard / landing / preferences | **highest-priority (primary) template wins** |

Internally consistent with ADR-038: *less restrictive access, more restrictive denial*.
Verified by `test_composition_unions_permissions_and_takes_widest_scope` and
`test_explicit_deny_overrides_a_grant_in_composition`.

## 8. Versioning Strategy

Append-only. `status` progresses draft → published → deprecated → archived. Every mutation
snapshots the full definition into `role_template_versions` (unique per `(template, version)`);
historical rows are **never** overwritten or deleted. System templates bump their version only
when a re-seed detects a changed definition (idempotent). Verified by
`test_updating_a_custom_template_appends_a_version_and_never_overwrites` (v1 snapshot retains
the original definition after two edits) and `test_seeder_is_idempotent`.

## 9. Performance

- Composition/preview/comparison are pure in-memory operations over already-loaded models —
  no N+1; permission wildcard expansion flattens the `config/permissions.php` catalog once
  per `PermissionExpander` instance (memoised).
- The library is small (40 system rows + custom); reads are single indexed queries
  (`key` unique, `category`, `is_system` indexed).
- Seeding is idempotent `firstOrNew` + `firstOrCreate` snapshots — re-running touches nothing
  when definitions are unchanged (proven: second seed adds 0 versions).
- Zero added cost on the authorization hot path — templates are never consulted at runtime.

## 10. Test Results

```
docker exec -e DB_DATABASE=ecos_erp_test ecos-app php artisan test tests/Unit/IAM tests/Feature/IAM
Tests: 88 passed (409 assertions)
```

New `RoleTemplateTest` (15): seeding (40 system templates), idempotency, system-update/delete
protection, clone→editable-custom, append-only versioning, composition (union + widest-scope +
visibility-intersection), deny-override, wildcard expansion, preview-by-keys, comparison
(differences + identical), export→import round-trip (always custom, key made unique), import
validation (malformed / unknown-category). The 73-test Authorization Platform suite is unchanged
and green.

## 11. Breaking Change Assessment

**None.** Two new tables (no existing table touched); new bindings only (no existing binding
replaced); the seeder is appended and idempotent; the authorization runtime is not consulted by
templates and is byte-for-byte unchanged (73/73 ADR-038 tests green). Definitions are inert
authoring metadata until compiled/assigned — consistent with ADR-038's "engines inert until
adopted" stance.

## 12. Future Integration

- **Phase 2 — frontend Role Template Workspace:** library, preview, compare, clone, builder,
  metadata, history, search/filters/categories (no user-management UI). Consumes the services
  built here via a thin read/API layer.
- **Phase 3 — provisioning:** assign templates → users (compile to roles + `user_roles`). The
  multi-role runtime already resolves the composed effect; the user-management surface (out of
  scope) drives it.
- **Template → role compiler:** `role_templates.role_id` + an idempotent sync of the expanded
  effective profile into `role_permissions` (data_scope aware) is the single integration point
  when provisioning lands.
- **Sensitive-field enforcement:** visibility profiles declare intent now; enforcement activates
  per-resource as the ADR-038 adoption track registers each resource's field map.
- **Cross-company sync:** export/import JSON already makes templates portable across companies,
  branches, warehouses, and business units.
