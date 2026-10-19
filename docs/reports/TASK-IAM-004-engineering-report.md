# TASK-IAM-004 — Enterprise User Management Platform · Engineering Report (Phase 1)

**Date:** 2026-08-04 · **ADR:** [ADR-040](../adr/ADR-040-enterprise-user-management-platform.md) · **Builds on:** [ADR-038](../adr/ADR-038-enterprise-authorization-platform.md), [ADR-039](../adr/ADR-039-enterprise-role-templates.md) · **Status:** Backend platform complete, pending CTO review · **Working tree:** uncommitted

---

## 1. Executive Summary

TASK-IAM-004 delivers the **Enterprise User Management Platform** — the identity layer that
manages every human identity in ECOS and the capstone that ties together the Authorization
Platform (IAM-002), Role Templates (IAM-003), authentication, and organizations. A User is now
an **enterprise identity**, not merely an auth record: it carries lifecycle, identity, employment,
preferences, security, organization assignments, role-template assignments, sessions, and a full
audit trail.

Three integration decisions keep it additive and non-duplicating: (1) the `users` table is
extended **only with new nullable columns** (bigint PK preserved); (2) roles are assigned
**exclusively through Role Templates** via a new `RoleTemplateCompiler` that materializes a
template into the runtime `roles`/`role_permissions` — so the Authorization Platform reads roles
**unchanged**; (3) auditing reuses the existing `App\Core\Audit\AuditService`, and sessions reuse
Sanctum tokens.

Phase 1 ships the complete backend platform + tests: **104 IAM tests pass (449 assertions)** —
16 new User Management tests plus the entire 88-test Authorization + Role Template suite,
unchanged. **Zero IAM regressions. No breaking changes.** The HTTP API + frontend User Workspace
are Phase 2 (per the CTO's "small verifiable phases" rule).

## 2. Architecture

```
UserManagement services ── assign template ──▶ RoleTemplateCompiler ──▶ Role + role_permissions
   (lifecycle/identity/                                                        │ (data_scope aware)
    invitation/org/role/                          user_roles ◀── attach ───────┘
    session/audit)                                    │
                                                      ▼  read UNCHANGED
                                    ADR-038 Authorization Platform (PermissionService, engines)
```

- **User = identity**, extended additively; side concerns in `user_organization_assignments`,
  `user_template_assignments`, `user_invitations`, `user_sessions`.
- **Roles only via templates** — no direct permission assignment; effective
  permissions/visibility/scope/policies computed by IAM-003's `RoleCompositionService` over the
  user's assigned templates (primary first).
- **Lifecycle** is a validated state machine; **security rules** are enforced server-side; every
  change is audited.

## 3. Files Created

**Backend — `backend/Modules/IAM/`**

| Layer | File |
|---|---|
| Enum | `Domain/Enums/UserStatus.php` (9-state machine) |
| Models | `Domain/Models/UserOrganizationAssignment.php`, `UserTemplateAssignment.php`, `UserInvitation.php`, `UserSession.php` |
| Exceptions | `Domain/Exceptions/InvalidUserTransitionException.php`, `UserSecurityRuleException.php` |
| Services | `Application/Services/UserIdentityService.php`, `UserProfileService.php`, `UserLifecycleService.php`, `UserInvitationService.php`, `UserOrganizationAssignmentService.php`, `UserRoleAssignmentService.php`, `RoleTemplateCompiler.php`, `UserSessionService.php`, `UserAuditService.php`, `UserSecurityRules.php`, `UserRepository.php` |
| Policy | `Presentation/Policies/UserPolicy.php` |
| Migrations | `Infrastructure/Database/Migrations/2026_08_06_100000_enhance_users_table_for_identity_platform.php`, `..._100001_create_user_platform_tables.php` |

**Docs/tests:** `docs/adr/ADR-040-*.md`, `tests/Feature/IAM/UserManagementTest.php` (16 tests).

## 4. Files Modified

- `app/Models/User.php` — additive: SoftDeletes, new fillable identity/profile/employment fields,
  casts, relationships (`manager`, `organizationAssignments`, `templateAssignments`, `invitations`,
  `platformSessions`), identity helpers. Security-sensitive fields deliberately **excluded** from `$fillable`.
- `Modules/IAM/Domain/Traits/HasRoles.php` — added `assignRole/revokeRole/hasRole` helpers.
- `Modules/IAM/Infrastructure/Providers/IamServiceProvider.php` — `Gate::policy(User::class, UserPolicy::class)`.
- `config/permissions.php` — extended `iam.users` additively (+ `delete`, `activate`, `suspend`, `assign-role`, `assign-org`, `invite`, `reset-password`, `manage-sessions`) and granted them to `company-admin`.

No existing column, binding, or behaviour was altered.

## 5. Database Changes

All additive, guarded (`hasColumn`/`hasTable`), reversible; the bigint `users.id` is untouched:

- **`users`** — new nullable columns: lifecycle `status`; identity `employee_number` (unique),
  `username` (unique), `display_name`, `avatar_path`, `phone`; preferences `locale`, `timezone`,
  `date_format`, `number_format`, `currency_preference`, `signature`, `notes`; employment
  `job_title`, `employment_type`, `manager_id`, `hire_date`, `termination_date`; security
  `last_login_at`, `last_activity_at`, `password_changed_at`, `require_password_change`,
  `failed_login_count`, `locked_at`, `suspended_at`, `archived_at`, `invited_at`, `activated_at`,
  `invited_by`, `created_by`; SoftDeletes `deleted_at`.
- **`user_organization_assignments`**, **`user_template_assignments`**, **`user_invitations`**,
  **`user_sessions`** (all keyed by bigint `user_id`).

## 6. Identity Flow

```
createDraft (DRAFT, random unusable password, audited)
   → invite  (issues raw token; only sha256 hash persisted; status → INVITED)
   → activate(token, password)  (sets password, verifies email, invitation → ACCEPTED, status → ACTIVE)
   → first login
```

De-duplication is enforced on `email` / `username` / `employee_number` (including trashed rows).
Roles are attached only by assigning Role Templates → compiled runtime roles.

## 7. Session Flow

Login records a `user_sessions` row (browser/OS parsed from UA, IP, timestamps) linked to the
Sanctum `personal_access_tokens.id`. `forceLogout` revokes every session + deletes all tokens;
`logoutOthers(keepTokenId)` revokes all but the current. Revoking a session deletes its token, so
the Authorization runtime rejects it immediately. All session actions are audited.

## 8. Security Analysis

- **Server-side invariants** (`UserSecurityRules`, invoked by lifecycle + role services):
  a user cannot deactivate/suspend/lock/archive/delete **their own** account; cannot remove their
  **own** Super Administrator role; the system cannot deactivate/remove the **last active** Super
  Administrator. All three are unit-tested.
- **No permission bypass:** there is no direct permission assignment — access flows only through
  Role Templates, which are auditable and versioned.
- **Least privilege on the model:** security-sensitive columns (`status`, `failed_login_count`,
  `locked_at`, role links) are **not** mass-assignable; they mutate only through the services.
- **Secrets:** invitation tokens are stored only as `sha256` hashes; the raw token is returned
  once and never persisted or logged (test asserts the raw token is absent from the table).
- **Authorization:** every operation is gated by `UserPolicy` → `iam.users.*`; super-admin bypass
  is the existing global `Gate::before`.

## 9. Performance

- User Workspace queries eager-load `templateAssignments.template` + `organizationAssignments`
  (no N+1); search is a single indexed `LIKE` across identity columns; `status`, `employee_number`,
  `username`, `manager_id` are indexed.
- Template compilation is idempotent and runs only on assignment; it re-syncs the linked role's
  grants in one `sync()`. Assignment invalidates the user's permission cache (`rbac.user.{id}.perms`).
- Effective-profile composition is pure in-memory over the user's templates.
- Zero added cost on the authentication/authorization hot path — the platform sits beside it.

## 10. Test Results

```
docker exec -e DB_DATABASE=ecos_erp_test ecos-app php artisan test tests/Unit/IAM tests/Feature/IAM
Tests: 104 passed (449 assertions)
```

New `UserManagementTest` (16): identity create + audit + dedupe; lifecycle valid/invalid transition
+ soft delete; security (self-deactivation block, last-super-admin block, allowed when another
exists); invitation → activation (password set, hash-only token); organization assignment (additive
+ unknown-type reject); role-template assignment (compiles role, grants permission via the unchanged
Authorization Platform, writes data_scope, effective profile, multi-template composition, removal
detaches); session force-logout. The 88-test IAM-002/003 suite is unchanged and green.

Regression smoke outside IAM: `tests/Feature/Core/UserPreferenceTest` (authenticated flows) — **23
passed**, confirming the SoftDeletes/User change is safe. `OrderImportWarehouseTest` shows
pre-existing, order-dependent Commerce/Channel failures (channel-ownership, brand_id validation
403-vs-422) that do not reference users or SoftDeletes and are unrelated to this change (part of the
existing working-tree debt).

## 11. Breaking Change Assessment

**None** to IAM. Enumerated: `users` gains only nullable columns + SoftDeletes (no existing users
are trashed → query behaviour unchanged); four new tables; new services/policy are additive; the
`HasRoles` additions are new methods; the permission-catalog change only **adds** actions/grants.
The authorization runtime is untouched (88/88 prior tests green). SoftDeletes introduces a global
scope on `users`, verified non-breaking by the passing authenticated smoke suite.

## 12. Future HR Readiness

- Employment fields (`job_title`, `employment_type`, `manager_id`, `hire_date`, `termination_date`)
  and the manager self-relation are HR-forward; a future HR OS syncs onto them additively.
- Organization units without tables yet (Department/Region/Business Unit/Cost Center) are already
  assignable by type+id and become FK-backed when those modules land.
- Authentication is MFA/SSO-ready: `require_password_change`, `password_changed_at`, session/device
  tracking, and the invitation-token flow are the extension points; the DTO already carries
  effective permissions to the client.
- **Phase 2** (HTTP API + frontend User Workspace) and **Phase 3** (HR/SSO/MFA) build on these
  additive columns/tables with no schema churn.
