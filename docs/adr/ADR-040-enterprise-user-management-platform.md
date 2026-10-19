# ADR-040 — Enterprise User Management Platform (Identity Layer)

**Status:** Accepted (architecture) · Phase 1 (backend platform) delivered — 2026-08-04
**Builds on:** [ADR-038 Authorization Platform](ADR-038-enterprise-authorization-platform.md) · [ADR-039 Role Templates](ADR-039-enterprise-role-templates.md)
**Task:** TASK-IAM-004

---

## Context

ECOS has an authorization runtime (ADR-038) and a job-profile library (ADR-039) but no
platform that manages the **human identity** behind a login. Users are provisioned only by
a seeder; there is no lifecycle, no invitation flow, no organization assignment, no session
management, no audit of identity changes, and role grants are ad-hoc `user_roles` inserts.

We need the **Enterprise User Management Platform**: the single, authoritative layer for
every human identity in ECOS — integrating authentication, the Authorization Platform, Role
Templates, and organizations, and forward-compatible with a future HR OS, SSO, and MFA.

## Decision 1 — The User is an identity, extended additively (bigint PK preserved)

Per the IAM-001 binding constraint, the existing `users` table keeps its **bigint** primary
key and is extended **only with new nullable columns** (identity, lifecycle status, security,
employment). No FK churn, no PK change, no data migration. Related concerns live in new
side tables keyed by `user_id`:

- `user_organization_assignments` — Company/Branch/Warehouse/Department/Business Unit/Region/
  Channel/Team/Cost Center (org unit type + id; forward-compatible for units that have no
  table yet).
- `user_template_assignments` — which Role Templates a user holds (+ primary flag).
- `user_invitations` — invitation/activation tokens.
- `user_sessions` — device/session metadata on top of Sanctum tokens.

## Decision 2 — Roles are assigned ONLY through Role Templates

There is **no direct permission assignment** and no UI that bypasses templates. A user is
granted a **Role Template**; the platform **compiles** that template into the runtime via a
new `RoleTemplateCompiler`:

```
assign template ─▶ compiler ensures role_templates.role_id → a runtime Role
                             syncs role_permissions from the expanded profile (perms + data_scope)
                 ─▶ attach that Role to the user via user_roles
```

The Authorization Platform then reads `user_roles`/`role_permissions` **unchanged**. A user's
**effective** permissions/visibility/scope/policies are computed by ADR-039's
`RoleCompositionService` over their assigned templates (primary first). Permission *overrides*
are explicitly out of scope here — they belong to Enterprise Administration.

This finally sets `role_templates.role_id` (null until now), closing the ADR-039 authoring→
runtime loop.

## Decision 3 — Lifecycle is an auditable state machine

`UserStatus`: Draft → Invited → Pending Activation → Active → Inactive → Suspended → Locked →
Archived → Deleted (soft). `UserLifecycleService` validates every transition against an
explicit allowed-transitions map, enforces the security rules (Decision 5), and records an
audit event. No status is set by raw column writes.

## Decision 4 — Reuse, don't duplicate

- **Audit** → the existing generic `App\Core\Audit\AuditService` + `audit_logs` (entity_type
  `user`), which already captures actor, old/new values, ip/agent, timestamp. No new audit system.
- **Sessions** → Sanctum `personal_access_tokens` remain the token store; `user_sessions` adds
  browser/OS/IP/last-activity metadata and powers force-logout / logout-others by revoking tokens.
- **Permissions catalog** → extend the existing `iam.users` entry additively (add `delete`,
  `activate`, `suspend`, `assign-role`, `assign-org`, `invite`, `reset-password`, `manage-sessions`).
- **HasRoles trait** → gains `assignRole/revokeRole/hasRole` helpers (currently only `roles()`).

## Decision 5 — Security rules (enforced server-side, always)

`UserSecurityRules`, invoked by lifecycle + role services:
- A user **cannot deactivate/suspend/lock/archive/delete their own account**.
- A user **cannot remove their own Super Administrator role**.
- The system **cannot delete/deactivate the last active Super Administrator**.
- Security-sensitive fields (status, security counters, role links) are mutated only through
  the platform's services, never mass-assigned.

## Schema changes (all additive, guarded, reversible)

- `users` — new nullable columns: `status`, `employee_number` (unique), `username` (unique),
  `display_name`, `avatar_path`, `phone`, `locale`, `timezone`, `date_format`, `number_format`,
  `currency_preference`, `signature`, `notes`, `job_title`, `employment_type`, `manager_id`,
  `hire_date`, `termination_date`, `last_login_at`, `last_activity_at`, `password_changed_at`,
  `require_password_change`, `failed_login_count`, `locked_at`, `suspended_at`, `archived_at`,
  `invited_at`, `activated_at`, `invited_by`, `created_by`, `deleted_at` (SoftDeletes).
- `user_organization_assignments`, `user_template_assignments`, `user_invitations`, `user_sessions`.

No existing column altered; the bigint `users.id` is untouched.

## Consequences

**Positive:** one authoritative identity platform; lifecycle + invitation + org + role +
session + audit; roles flow exclusively through templates (consistent security, auditable);
zero change to the authorization runtime; HR/SSO/MFA-ready by additive columns/tables.

**Neutral:** org units without tables (Department/Region/Business Unit/Cost Center) are stored
by type+id and become FK-backed when those modules land.

**Trade-offs:** the template→role compiler introduces a materialization step; it is idempotent
and cache-invalidating, and it is the single place runtime roles are derived from templates.

## Phased plan

- **Phase 1 (this ADR) — backend platform.** ✅ Aggregate + side tables, lifecycle state machine,
  identity/profile/invitation/org/role/session/audit services, `RoleTemplateCompiler`, security
  rules, `UserPolicy`, repository, permission catalog extension, tests. STOP for review.
- **Phase 2 — HTTP API + frontend User Workspace.** UserController + routes + requests +
  resources; the table, 14-tab drawer, 6-step create wizard, session viewer, bulk operations,
  advanced search, saved views.
- **Phase 3 — HR OS / SSO / MFA integration** on the additive columns/tables.
