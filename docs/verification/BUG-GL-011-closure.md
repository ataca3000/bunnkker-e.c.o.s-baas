# BUG-GL-011 — CLOSED

**Defect:** Role Template Compiler silently created permissions that did not exist.
**Severity:** P1
**Opened:** 2026-08-07 (TASK-IAM-SEED-001)
**Closed:** 2026-08-08 (TASK-IAM-HOTFIX-001)
**Commits:** `2fe8fc8d`, `f7b06f18`

---

## What the defect was

`RoleTemplateCompiler` called `Permission::firstOrCreate()` for every token a template
referenced. A typo, or a namespace the platform never implemented, was therefore not an
error — the row was minted and granted. The role then held a permission no module
enforces, so the user saw the module in their navigation and was refused by every screen
inside it, with nothing anywhere reporting a problem.

Underneath that sat a second, deeper fault: `PermissionExpander` expanded wildcards
against `config('permissions.modules')` while `AuthorizationGateway` enforces the
`permissions` table. The two had drifted apart — 183 names versus 578 — so `finance.*`
expanded to zero while 54 finance permissions existed and were being enforced.
`firstOrCreate` hid that divergence for as long as no template was ever assigned.

## Why it is closed

| Closure criterion | Evidence |
| --- | --- |
| Compiler is fail-closed | `ensurePermission()` deleted; zero `Permission::` create paths remain in the compiler |
| No implicit permission creation | Full re-materialisation of all 40 templates: permissions **578 → 578 (+0)** |
| No config/catalog divergence | `PermissionExpander` reads the `permissions` table — the same source `AuthorizationGateway` enforces |
| Wildcards resolve from the authoritative catalog | Every domain tested matches the table exactly: `*` 578, finance 54, hr 41, inventory 50, crm 28, purchasing 57, marketing 58, operations 13, logistics 22, engineering 37, pos 13, sales 20 |
| Rejected templates produce no roles or grants | A rejected compile moves roles **+0**, permissions **+0**, and leaves `role_templates.role_id` untouched (validation now precedes `resolveRole()`) |
| Failures are loud and complete | `UnknownTemplatePermissionException` names the template, every unknown permission, and the namespaces — all failures at once, not one per run |
| Dead wildcards no longer pass silently | A wildcard matching nothing (`shipping.*`, `manufacturing.*`, `logistics.transfers.*`) is now rejected rather than granting nothing quietly |

## Effect

23 of 40 templates compile cleanly, up from 22 before the fix and from an unmeasurable
baseline before that (nothing had ever been materialised). Templates repaired purely by
correcting the source of truth:

| Template | Before | After |
| --- | --- | --- |
| `ceo` / `cfo` / `coo` / `cto` | rejected | 578 grants each |
| `system-administrator` | rejected | 40 |
| `financial-controller` | 0 | 54 |
| `hr-director` / `hr-manager` | 0 | 41 |
| `senior-accountant` | 6 | 60 |
| `finance-director` | 6 | 60 |
| `inventory-controller` | 40 | 50 |

Authorization behaviour is unchanged where it was already correct: the system-role bypass
is intact, the navigation whitelist is unchanged, the executive templates still carry
`executive`, and unknown permissions still deny.

## Scope boundary

This closure covers the **RBAC engine**. It does not cover **template content**.

27 permission tokens across 17 templates remain unresolved. Those templates cannot be
assigned until their tokens are corrected — which is the intended fail-closed behaviour,
and is now visible rather than silent. That work is tracked separately as
**TASK-IAM-TEMPLATE-RECONCILIATION-001** and must not reopen this defect.

The engine and the template content are separate concerns and are tracked independently
from here.
