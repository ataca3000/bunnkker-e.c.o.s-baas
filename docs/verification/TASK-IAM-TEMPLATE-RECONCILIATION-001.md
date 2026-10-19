# TASK-IAM-TEMPLATE-RECONCILIATION-001

**Priority:** P2
**Opened:** 2026-08-08
**Predecessor:** TASK-IAM-HOTFIX-001 — [BUG-GL-011 CLOSED](BUG-GL-011-closure.md)
**Concern:** Role template *content*. The RBAC *engine* is closed and out of scope.

---

## Why this task exists

The compiler is now fail-closed: it rejects any template referencing a permission the
catalog does not define, and creates nothing. That is correct, and it is what surfaced the
work below.

**17 of 40 templates cannot currently be assigned.** Their permission tokens name
capabilities that either do not exist, merge two grants into a broader one, or have several
defensible targets. None is a mechanical rename — every one was deliberately left
unresolved rather than guessed, because guessing trades a loud failure for a quiet wrong
answer, which is the trade that produced BUG-GL-011.

**Count correction.** Earlier reports said 22 unresolved tokens. The measured figure is
**27 distinct tokens across 17 templates**. The 22 was an undercount and should not be
carried forward.

---

## Scope

- Resolve the 27 unresolved permission tokens.
- Remove references to capabilities that do not exist.
- Obtain product approval for the mappings that change a role's effective scope.
- **Keep `manufacturing.*`, `shipping.*`, `operations.packing.*` and `logistics.transfers.*`
  unresolved until those domains actually exist.**
- Do **not** reopen the compiler unless a new compiler defect is discovered.

---

## Unresolved-token matrix

### Group A — Missing capability (10 tokens · 8 templates)

The permission does not exist and cannot be mapped without inventing one. Per instruction,
these stay unresolved until the domain is built and seeded.

| Token | Templates | Catalog reality |
| --- | --- | --- |
| `manufacturing.*` | production-director, production-manager | `manufacturing` domain: **0 permissions** |
| `manufacturing.workorders.operate` | production-operator | no work-order permission anywhere |
| `manufacturing.workorders.view` | production-operator | " |
| `manufacturing.quality.operate` | quality-inspector | no quality permission anywhere |
| `manufacturing.quality.view` | quality-inspector | " |
| `shipping.*` | shipping-manager | `shipping` domain: **0 permissions** (real domains are `logistics.*`, `delivery.*`, `dispatch.*`) |
| `operations.packing.manage` | packaging-supervisor | `operations` exists (13) but has no `packing` resource |
| `operations.packing.operate` | packaging-operator, packaging-supervisor | " |
| `operations.packing.view` | packaging-operator, packaging-supervisor | " |
| `logistics.transfers.*` | warehouse-manager | `logistics` exists (22) but has no `transfers` resource |

**Blocked on:** the Manufacturing and Shipping permission catalogs being seeded. Until then
these five templates — `production-director`, `production-manager`, `production-operator`,
`quality-inspector`, `shipping-manager` — plus the two packaging roles and
`warehouse-manager` are not assignable.

### Group B — Requires business decision (4 tokens · 2 templates)

A single existing permission covers both tokens, but adopting it **widens** the role.

| Tokens | Template | Candidate | Decision needed |
| --- | --- | --- | --- |
| `hr.employees.create`, `hr.employees.update` | hr-officer | `hr.employees.manage` | `manage` is the domain's only write grant and likely also permits delete. Is broadening an HR officer from create+update to full manage acceptable? |
| `crm.tickets.create`, `crm.tickets.update` | customer-service-agent | `crm.service.manage` | Same shape. `crm.service` also carries `resolve`, `assign`, `admin`; `manage` may imply more than the template intended. |

### Group C — Multiple possible mappings (13 tokens · 7 templates)

The domain exists and several permissions are defensible. Each needs one line of intent.

| Token | Template | Candidates |
| --- | --- | --- |
| `bae.view` | ai-analyst | `bae.attribution.view`, `bae.attributions.view`, `bae.timeline.view` |
| `claude_bridge.view` | ai-analyst | `claude_bridge.platform.view`, `.settings.view`, `.tasks.view`, `.workers.view` |
| `engineering.view` | ai-analyst | 8 `.view` permissions (`platform`, `pipelines`, `tasks`, `queue`, `releases`, `repair`, `workers`, `ai_reviews`) |
| `pos.sales.create` | cashier | `pos.carts.create`, `pos.carts.checkout`, `pos.payments.create` |
| `pos.sessions.operate` | cashier | `pos.terminal.operate`, `pos.shifts.open_shift` |
| `pos.sessions.view` | cashier | `pos.shifts.view`, `pos.terminal.view` |
| `logistics.dispatch.operate` | dispatcher | `dispatch.queue.manage`, `dispatch.session.manage`, `dispatch.assignment.*` |
| `logistics.dispatch.view` | dispatcher | `dispatch.monitoring.view`, `dispatch.audit.view` |
| `logistics.deliveries.operate` | driver | `delivery.pod.capture`, `delivery.cod.collect`, `delivery.return.manage` |
| `logistics.deliveries.view` | driver | `delivery.analytics.view` (only `delivery` view; may be wrong for a driver) |
| `purchasing.purchases.update` | purchasing-officer | domain has 10 actions but **no `update`** — `approve`, `execute`, `merge`, `split`, `review`, `select_supplier`… |
| `crm.leads.create` | sales-representative | `crm.sales.manage`, `crm.sales.convert` |
| `operations.preparation.operate` | warehouse-clerk | `operations.preparation.create`, `.update`, `.delete` |

### Group D — Intentional removal (0 tokens)

Empty at open. This group receives any token that Groups A–C resolve to *deliberate
deletion* rather than a mapping — recorded here so a removal is never mistaken for an
oversight.

---

## Affected templates

| Template | Tokens | Group |
| --- | --- | --- |
| production-director | 1 | A |
| production-manager | 1 | A |
| production-operator | 2 | A |
| quality-inspector | 2 | A |
| shipping-manager | 1 | A |
| packaging-operator | 2 | A |
| packaging-supervisor | 3 | A |
| warehouse-manager | 1 | A |
| hr-officer | 2 | B |
| customer-service-agent | 2 | B |
| ai-analyst | 3 | C |
| cashier | 3 | C |
| dispatcher | 2 | C |
| driver | 2 | C |
| purchasing-officer | 1 | C |
| sales-representative | 1 | C |
| warehouse-clerk | 1 | C |

23 templates compile cleanly and are unaffected.

---

## Rules carried forward

- Apply only true 1:1 mappings.
- Never widen a role's effective capability without explicit approval (Group B).
- Never invent permissions.
- Do not map by name similarity alone — verify against the catalog and the domain model.
- If a capability genuinely does not exist, keep it unresolved and report it (Group A).

## Definition of done

- Every token in Groups B, C and D resolved or deliberately removed, with a recorded reason.
- Group A remains open, explicitly, until the Manufacturing and Shipping catalogs exist.
- All templates except those in Group A compile cleanly.
- Permission count unchanged by any materialisation.

---

## Housekeeping carried over

39 empty `tpl-*` roles remain from before the validation-ordering fix (roles 28 → 67). They
hold no grants and are harmless, but they are residue from rejected compiles made while
`resolveRole()` still ran first. Safe to delete where `role_templates.role_id` is unset and
the role has zero `role_permissions`. Not urgent.
