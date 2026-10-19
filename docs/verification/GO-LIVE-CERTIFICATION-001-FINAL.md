# GO-LIVE-CERTIFICATION-001 — FINAL

## Consolidated Go-Live Status — ECOS ERP v1.0

**Date:** 2026-08-08
**Supersedes:** [GO-LIVE-CERTIFICATION-001](GO-LIVE-CERTIFICATION-001.md) — whose §10 artifact
digests are now **factually invalid** (see §1). That document is retained for audit; this one is
authoritative.
**Companion:** [RELEASE-PATH-VERIFICATION-001](RELEASE-PATH-VERIFICATION-001.md)

**Classifications used independently, as required:**
`PASS` · `FAILED` · `UNVERIFIED` · `ACCEPTED RISK` · `POST-GO-LIVE`
**UNVERIFIED is not PASS. ACCEPTED RISK is not PASS.**

---

## 1. Release artifact — **FAILED**

| Field | Certified | Present now |
| --- | --- | --- |
| App image | `sha256:820e0367…` | **ABSENT** |
| Nginx image | `sha256:bb16a29b…` | **ABSENT** |
| Version | `go-live-rc2` | `0.1.0` |
| Commit stamp | `076a4a03` | **`unknown`** |
| Current app image | — | `sha256:888321e5…` |
| Current nginx image | — | `sha256:3cff5ac8…` |

**The certified artifact no longer exists.** It was overwritten by the TASK-CUTOVER-002 rebuild,
which ran without the traceability build args `deploy.sh` supplies. `docker image inspect` on
both certified digests fails.

The running image demonstrably contains the queue-worker fix (`queue_workers: 3`,
`scheduler: true` at runtime) — but that is inference from behaviour, not artifact identity. **No
artifact currently in existence can be certified.**

## 2. Release path — **FAILED**

| Field | Value |
| --- | --- |
| Branch / HEAD | `develop` @ `ba5e5914` |
| Upstream | **none** — `origin/develop` does not exist |
| `deploy.sh` target | `git pull origin main` → `origin/main` @ `4d8f8825` (2026-07-20) |
| Gap | **139 commits behind**; `origin/main` is 0 ahead |

Topology is clean: `origin/main` ⊂ local `main` ⊂ `develop`. A merge is a guaranteed
fast-forward. But **as configured, a successful deployment would ship software containing none of
BUG-GL-001, BUG-GL-009, BUG-GL-011, the E-1 migration or the C-1 queue workers** — i.e. it would
report success and silently discard general-ledger postings.

## 3. Deployment verification — **UNVERIFIED (production) / PASS (dry-run)**

`deploy.sh` was **not executed**. Its gates were evaluated against the current `.env`:

| Gate | Result |
| --- | --- |
| `APP_ENV` ∈ {staging, production} | ❌ **`testing` — script aborts here** |
| `APP_KEY` well-formed | ✅ |
| `DB_PASSWORD` ≠ dev default | ✅ |
| no `docker-compose.override.yml` | ✅ |
| `SESSION_SECURE_COOKIE`, `TRUSTED_PROXIES` | ⚠️ unset |

**Production itself has never been contacted.** No `DEPLOY_HOST`, no credentials, no TLS
listener. Deployment to production remains **UNVERIFIED**.

## 4. Runtime verification — **PASS** (local release stack)

```json
{"status":"ok","environment":"production","database":true,"redis":true,
 "queue":true,"storage":true,"scheduler":true,"queue_workers":3}
```

| Check | Result |
| --- | --- |
| Containers healthy | ✅ app, mysql, redis, mailpit |
| Queue workers (3, all four queues consumed) | ✅ PASS |
| Scheduler running | ✅ PASS |
| Redis / Database connected | ✅ PASS |
| Migrations | ✅ 696 applied, **0 pending** |
| **Mail configured** | ❌ **FAILED** — `MAIL_MAILER=array`, placeholder host/sender |

## 5. Browser matrix — **PASS** (16/16 reachable surfaces; 1 module is a known placeholder)

Verified against the **current** image, authenticated as Administrator.

| Module | Load | Nav | Data | Console | Network | Result |
| --- | --- | --- | --- | --- | --- | --- |
| Dashboard | ✅ | ✅ | EGP 21.1K / 2 orders | clean | 200 | **PASS** |
| Executive Platform | ✅ | ✅ | board + filters | clean | 200 | **PASS** |
| Finance — Journal Entries | ✅ | ✅ | 4 posted entries | clean | 200 | **PASS** |
| Finance — AR / Fiscal / Budgets / Tax / Cash | ✅ | ✅ | live | clean | 200 | **PASS** |
| CRM | ✅ | ✅ | live | clean | 200 | **PASS** |
| Logistics (Fulfillments +17) | ✅ | ✅ | empty state | clean | 200 | **PASS** |
| Inventory | ✅ | ✅ | live | clean | 200 | **PASS** |
| Products | ✅ | ✅ | live | clean | 200 | **PASS** |
| Procurement Hub | ✅ | ✅ | live | clean | 200 | **PASS** |
| Suppliers | ✅ | ✅ | 1 supplier | clean | 200 | **PASS** |
| Orders | ✅ | ✅ | 2 orders, 13-status band | clean | 200 | **PASS** |
| Preparation | ✅ | ✅ | wave workspace | clean | 200 | **PASS** |
| HR | ✅ | ✅ | live | clean | 200 | **PASS** |
| Marketing | ✅ | ✅ | live | clean | 200 | **PASS** |
| Configuration | ✅ | ✅ | 14 areas, 2 brands | clean | 200 | **PASS** |
| **IAM** | ✅ | ✅ | **"Coming Soon"** | clean | — | **ACCEPTED RISK** (BUG-GL-002) |
| Notifications | ✅ | ✅ | real feed, empty | clean | 200 | **PASS** |

**Console errors: 0. Failed authenticated requests: 0. Broken routes: 0. Broken assets: 0.**

### Interaction checks

| Check | Evidence | Result |
| --- | --- | --- |
| Search | Orders `search=ORD-00002` → 200; list 2→1; "1 filter" badge; status counts recalculated | **PASS** |
| Filters | Status band, channel select, saved views | **PASS** |
| Tables / sorting | Sortable headers, column control | **PASS** |
| Pagination | "Page 1 of 1 · 1 total", Prev/Next correctly disabled | **PASS** |
| Drawers | Customer 360 (11 tabs), Edit drawer pre-populated | **PASS** |
| Forms / validation | Required `*`, submit blocked with **no request fired** | **PASS** |
| Empty states | Purposeful copy on every empty surface | **PASS** |
| Error states | 404 page with Go back / Dashboard recovery | **PASS** |
| **EN / LTR** | `dir="ltr"`, `lang="en"` — measured | **PASS** |
| **AR / RTL** | `dir="rtl"`, `lang="ar"` — measured; full mirror, Arabic labels, Arabic-Indic numerals, `ج.م.` | **PASS** |

## 6. CRUD matrix — **PASS**

| Op | Evidence | Result |
| --- | --- | --- |
| Create | `POST /api/crm/customers` → **201**, code auto-generated, list 0→1 | **PASS** |
| Read (list) | `GET …?page=1&per_page=25` → 200, paginated | **PASS** |
| Read (detail) | `GET …/{id}/profile` → 200, 11-tab drawer | **PASS** |
| Update | `PATCH …/{id}` → **200**, persisted across full reload | **PASS** |
| Delete | Not exposed in CRM by design (customer is identity SSOT) | **N/A — by design** |
| Validation | Save with required field empty → blocked, **no POST issued** | **PASS** |
| Finance posting CRUD | 4 journal entries posted, balanced, visible in UI | **PASS** |

## 7. Permission matrix — **PARTIAL: PASS (deny) / UNVERIFIED (differential grant)**

| Check | Evidence | Result |
| --- | --- | --- |
| Unauthenticated access denied | 19/19 protected endpoints → **401** | **PASS** |
| No ambient credentials | `/api/auth/me` direct navigation → `Unauthenticated` (Bearer only) | **PASS** |
| Admin account | `admin@ecos.local` → **Super Admin** (`is_system=1`), full nav | **PASS** |
| Restricted account exists | `verify.accountant@ecos.local` → role **Accountant**, **4 permissions**: `accounting.ledgers.view`, `finance.gl.view`, `finance.journal.create`, `purchasing.supplier_invoices.view` | **PASS** (data) |
| Accountant `navigation` column | **NULL** → falls back to `MODULE_DOMAINS` prefix matching → would expose Finance + Purchasing only | **PASS** (data) |
| **Restricted UI behaviour** — nav visibility, create/update/delete/export gating, executive visibility, notification access **as that user** | **Requires signing in as a second user** | **UNVERIFIED** |

**Why UNVERIFIED, not PASS:** verifying the grant side requires authenticating as
`verify.accountant`, which means entering credentials. That is prohibited, and I did not do it.
No token was copied, injected, extracted or reused. **The RBAC data is verified; the UI
enforcement for a restricted user is not.** No RBAC data was altered and no seeder was run.

## 8. Notification matrix — **PASS (platform) / POST-GO-LIVE (coverage)**

| Check | Result |
| --- | --- |
| Bell renders, panel opens | **PASS** |
| Backed by real API — `GET /api/notifications` 200 | **PASS** |
| No mock data in shipped bundle | **PASS** |
| Empty state truthful ("All caught up", 0 rows in DB) | **PASS** |
| Mark all read control present | **PASS** |
| Mark-one-read interaction | **UNVERIFIED** — 0 notifications exist to click |
| Producer coverage: 3 Active · 1 separate platform · 8 exists-not-wired · 4 backend-missing · 1 out-of-scope | **POST-GO-LIVE** |

## 9. Regression matrix — **PASS**

| Area | Result |
| --- | --- |
| Existing queue behaviour (`engineering` timeout unchanged) | **PASS** |
| Finance (4 entries posted, all classes) | **PASS** |
| Logistics (18 surfaces) | **PASS** |
| Notifications | **PASS** |
| Dashboard figures unchanged (EGP 21.1K / 2 orders) | **PASS** |
| Session survived EN→AR→EN round-trip | **PASS** |
| Guardian baselines preserved — Pint 628 · TS 24 · ESLint 4,814 | **PASS** |
| Working tree | 13 items, all Guardian work from the prior task, confined to `engineering/` + `docs/` |

## 10. Responsive matrix — **UNVERIFIED**

Measured, not assumed:

| Step | Evidence |
| --- | --- |
| Baseline | `innerWidth: 1920`, `innerHeight: 953` |
| `resize_window(420×860)` | reported **"Successfully resized"** |
| Re-measured after resize | `innerWidth: **1920**` — **unchanged** |
| Media queries | `max-width:640px` → false; `max-width:1024px` → false |
| Alternative attempted | `window.open` with dimensions → **blocked** |

**The viewport does not change.** Per instruction, responsive is **NOT** claimed from
`resize_window`. No mechanism available in this environment can change the viewport, so
tablet/mobile rendering is **UNVERIFIED** and requires a real device or a browser with working
device emulation.

## 11. Security / IAM findings

| Finding | Result |
| --- | --- |
| Authorization fails closed (19/19 → 401) | **PASS** |
| Bearer-token only; no cookie/ambient auth surface | **PASS** |
| `APP_DEBUG=false` | **PASS** |
| RBAC: 578 permissions · 67 roles · 4,457 grants · 40 templates | **PASS** |
| Compiler fail-closed (BUG-GL-011 closed) | **PASS** |
| **No IAM administration UI** (BUG-GL-002) | **ACCEPTED RISK** — §13 |
| Roles actually assigned to users | **2**: `Super Admin` (system, not template-derived) and `Accountant` (from template `accountant`) |
| **Template reconciliation impact** | **Only unused/unassigned templates.** `accountant` is **not** among the 17 blocked. Templates assigned to any user: **1**. **No Go-Live role is affected.** |

## 12. Known limitations

| # | Item | Class |
| --- | --- | --- |
| L-1 | Mail unconfigured (`MAIL_MAILER=array`) | **FAILED** — blocks Phase 2 |
| L-2 | Certified artifact absent; current image `git_sha: unknown` | **FAILED** |
| L-3 | `deploy.sh` deploys a branch 139 commits behind | **FAILED** |
| L-4 | `develop` never pushed; no upstream | **FAILED** |
| L-5 | Responsive rendering | **UNVERIFIED** |
| L-6 | Restricted-role UI enforcement | **UNVERIFIED** |
| L-7 | Mark-one-notification-read | **UNVERIFIED** |
| L-8 | Business workflows in 7 modules (empty tenant) | **UNVERIFIED** |
| L-9 | 2 dormant companies resolve 32/44 posting rules | **POST-GO-LIVE** |
| L-10 | `orders.inventory_reduction` names deprecated `inventory` role | **POST-GO-LIVE** |
| L-11 | 116 historical `failed_jobs` | **POST-GO-LIVE** |
| L-12 | Meta App Secret unrecoverable | **POST-GO-LIVE** |

## 13. Accepted risks

| Item | Basis |
| --- | --- |
| **BUG-GL-002 — no IAM administration UI** | **B — Accepted post-Go-Live operational limitation.** This is the project's existing documented classification, not a judgement made here: GO-LIVE-CERTIFICATION-001 §7.1 records *"Accept for v1.0. Administer IAM via seeders. Schedule the UI as the first v1.1 item"*, and §8 lists it as "(accepted limitation)". RBAC is fully functional beneath it (578/67/4,457) and degrades gracefully to a labelled placeholder. **Caveat: that classification originates in an engineering certification report, not a separate product sign-off. If product ownership has not ratified it, it should be ratified before Go-Live rather than inherited.** |
| TASK-IAM-TEMPLATE-RECONCILIATION-001 (17 templates, 27 tokens) | **Affects only unused templates** — measured, §11. No in-use role is impacted. |
| ESLint suppressions not pruned (4,814) | Gate passes; stale entries no longer block. Hygiene only. |

## 14. Remaining post-Go-Live work

1. IAM administration UI (BUG-GL-002) — first v1.1 item.
2. Resolve Groups B and C of the template reconciliation (13 tokens needing one line of product intent each).
3. Wire the 3 Provider Platform notifications, then the 2 written-but-uncalled Preparation classes.
4. Decide the Orders and Inventory notification contracts (product decision, not implementation).
5. Seed the 13 missing roles for the two dormant companies before either is activated.
6. Decide `orders.inventory_reduction` — defer to `@inventory_class`, or confirm finished-goods-only.
7. Clear the 116 historical `failed_jobs` to a zero baseline.
8. Burn down the 4,624 hardcoded-string suppressions; prune stale suppressions.
9. Re-enter the Meta App Secret (otherwise ~26 failed health-check jobs/day).
10. Remove verification artifacts: `CUST-28B1A8E6`, journal entries `TASK-CUTOVER-002` / `TASK-CUTOVER-003/*` (reverse via UI — they are posted records), fiscal year `FY2027`.

## 15. Final determination

# NO-GO

### Why

Four **unaccepted** blockers remain, none of which is a software defect:

| # | Blocker | Class |
| --- | --- | --- |
| **B-1** | `deploy.sh` deploys `origin/main`, **139 commits behind** — a "successful" deploy would ship a release that silently discards GL postings | **P0** |
| **B-2** | The certified artifact **no longer exists**; the current image is untraceable (`git_sha: unknown`) | **P0** |
| **B-3** | The certified commit has **never been pushed** — 139 commits exist only on one workstation | **P1** |
| **B-4** | **Mail is unconfigured** — an explicit Phase 2 requirement; every message is discarded | **P1** |

Two P0 items cannot be classified as ACCEPTED RISK: shipping the wrong software and being unable
to identify what you shipped are not risks to accept, they are preconditions to fix.

### Why this is not a judgement on the software

The application passed everything put to it. 16/16 reachable surfaces render, **zero console
errors**, **zero failed authenticated requests**, full CRUD proven with a posted balanced journal
entry, authorization fails closed 19/19, AR/RTL verified programmatically, all four queues
consumed, 0 pending migrations.

**What blocks Go-Live is the release plumbing, not the release.**

### Path to GO — five steps, none of them development

1. `git push -u origin develop` — get 139 commits off a single machine.
2. `git checkout main && git merge --ff-only develop && git push origin main` — a guaranteed
   fast-forward. **Verify `git rev-list --count origin/main..develop` = 0.**
3. Rebuild via `deploy.sh` so the artifact carries a real `GIT_SHA`; record the new digests as
   the certification baseline.
4. Provision the production `.env`, including real SMTP.
5. Deploy with `deploy.sh --migrate`, then execute TASK-CUTOVER-003 §7 — **especially Phase 3
   initialization, which no script performs.**

On completion, the remaining UNVERIFIED items (responsive, restricted-role UI) should be closed
on the production environment before this certification is reissued.

---

**Nothing was pushed, merged, rebased, reset or deployed. No RBAC data was modified and no seeder
was run. No credential or token was copied, injected, extracted or reused. Guardian baselines are
unchanged (Pint 628 · TypeScript 24 · ESLint 4,814). No application code was changed.**
