# GO-LIVE-CERTIFICATION-001

## Official Engineering Certification — ECOS ERP v1.0

**Issued:** 2026-08-08
**Authority:** Final engineering certification. This document is the official engineering
baseline for ECOS ERP v1.0.
**Basis:** Completed, observed evidence only. Every statement below corresponds to a
screenshot, an HTTP status code, a database query, a file measurement or a container probe
taken during this certification. Anything not observed is marked **NOT VERIFIED** with its
reason and is not certified.

---

## 1. Executive Summary

### Overall engineering status: **COMPLETE**

Sixteen business modules are implemented and deployed. The two P0 defects raised during the
go-live phase — BUG-GL-001 (Dashboard incompatible with MySQL) and BUG-GL-009 (the platform
could not be built into a deployable image) — are both fixed and both confirmed fixed *in the
running image*, not merely in source. No P0 defect remains open.

### Overall release status: **DEPLOYABLE, WITH A MANDATORY PRE-CUTOVER PROCEDURE**

The application code is ready. The **environment** verified against is not the production
environment, and two operational conditions must be satisfied before cutover. Both are
deployment procedure, not engineering work:

1. **A required migration has not been applied.** 695 migrations ran; 1 is pending.
2. **The verified runtime ran under a testing profile**, which left four backend subsystems
   unexercised.

Neither is a code defect. Both are stated in full in §6 and §7 because a certification that
omitted them would be certifying something that was not verified.

### Overall recommendation: **GO WITH ACCEPTED LIMITATIONS**

Justification in §9. Conditions are mandatory, enumerated, and each is a bounded operational
action rather than open engineering work.

---

## 2. Platform Status

| Module | Status | Evidence and reason |
| --- | --- | --- |
| **Dashboard** | **CERTIFIED** | 7/7 APIs 200 including `admin/executive-dashboard`. KPI band, AI Executive Brief and Monthly Performance render. Figures reconcile with Orders (EGP 21.1K / 2 orders / AOV 10,566.00). |
| **Executive** | **CERTIFIED** | Executive Board renders across Finance, Sales, CRM, Logistics, Inventory and Procurement. Read-only by design. Company/branch/date filters present. |
| **Finance** | **CONDITIONALLY CERTIFIED** | All 9 workspaces render; every API 200 (cash, bank, AR, budgets, VAT, tax, fiscal). **Condition:** the inventory→GL posting path is gated on the pending migration (§6). Ledger is empty, so no posting has been observed end-to-end. |
| **CRM** | **CERTIFIED** | Only module with a full CRUD cycle proven: POST 201, GET 200, PATCH 200 persisted across reload, validation blocks submit with no request issued. Customer 360 drawer, 11 tabs. |
| **Inventory** | **CONDITIONALLY CERTIFIED** | Dashboard and 11 sub-surfaces render; `inventory/dashboard` 200. **Condition:** zero stock on hand, so ledger, costing and count paths are unexercised. Posting rules pending (§6). |
| **Products** | **CERTIFIED** | Catalogue renders with live data: 1 product, 11 KPI tiles, cost/price/markup/margin columns computing correctly, filters and status chips. |
| **Orders** | **CERTIFIED** | 13-status band, all 13 `orders?status=` calls 200. Two real orders with Arabic customer data, addresses, zones, inventory-execution state, money columns. |
| **Preparation** | **CONDITIONALLY CERTIFIED** | Fulfillment Wave Workspace renders with all 6 tabs and a correct "No wave selected" empty state. **Condition:** no wave data exists; the wave lifecycle is unexercised. |
| **Procurement** | **CONDITIONALLY CERTIFIED** | Procurement Hub renders — alerts, financial overview, module status, quick actions with keyboard hints. **Condition:** zero purchases/invoices/returns; no workflow exercised. |
| **Suppliers** | **CERTIFIED** | Real supplier record, 8 KPI tiles, saved views (All/Active/Preferred), status filters, column control, export, row action menu. |
| **Logistics** | **CERTIFIED** | Fulfillments plus 17 sub-surfaces across Carriers, Fleet, Network, Dispatch and Operations. Previously certified under EPIC-LOGISTICS-UI-001 (2026-08-07); re-confirmed on the deployed image. |
| **HR** | **CONDITIONALLY CERTIFIED** | Workforce workspace and 14 sub-surfaces render. **Condition:** zero employees; payroll, commission, performance, recruitment and exit workflows are unexercised. |
| **Marketing** | **CONDITIONALLY CERTIFIED** | Marketing OS and 17 sub-surfaces render. **Condition:** zero platform connections. The Meta App Secret is unrecoverable after the authorised APP_KEY rotation and must be re-entered (§7). |
| **Configuration** | **CERTIFIED** | Configuration OS renders: 14 configuration areas, 2 brands, audit enabled, 1 hr cache TTL, brand selector and company settings. |
| **IAM** | **NOT CERTIFIED** | `Users` and `Roles & Permissions` render "Coming Soon" placeholders (BUG-GL-002). **The RBAC engine itself is certified** (§3) — this status refers to the absent administration UI only. |
| **Notifications** | **CONDITIONALLY CERTIFIED** | Feed is real and truthful: `GET /api/notifications` 200, mock data confirmed absent from the shipped bundle. **Condition:** 0 notifications exist, so mark-read is unexercised; 12 of 16 categories are unwired or have no producer. |

**Totals: 8 CERTIFIED · 7 CONDITIONALLY CERTIFIED · 1 NOT CERTIFIED.**

Every CONDITIONAL status has the same root cause in one form or another: **an empty tenant.**
The screens are correct; the business data needed to exercise their workflows does not exist
in this environment. That is a verification-coverage limit, not a defect, and it is stated as
such rather than being counted as a pass.

---

## 3. Architecture Status

| Area | Status | Evidence |
| --- | --- | --- |
| **ADR implementation** | **CERTIFIED** | Module boundaries hold in the deployed build. ADR-024 (single cache key), ADR-011 (event-driven, immutable, actor-stamped), ADR-025 (Dashboard frozen — integrated additively), ADR-027 (Orders reserve FG only) are all reflected in the shipped structure. Architecture baseline measured: 1,019 files, 49 features, 118 cross-feature edges, 16 layer violations, largest cycle 23. |
| **Event Platform** | **CONDITIONALLY CERTIFIED** | EnterpriseEventBus is in place and events dispatch. **Under `QUEUE_CONNECTION=sync` every listener ran inline**, which proves the listeners execute but does **not** verify queued/asynchronous delivery. Asynchronous behaviour is NOT VERIFIED. |
| **RBAC** | **CERTIFIED** | Measured live: **578 permissions · 67 roles · 4,457 role-permission grants · 40 role templates · 3 users.** Compiler is fail-closed (BUG-GL-011 closed, commits `2fe8fc8d`, `f7b06f18`). `PermissionExpander` and `AuthorizationGateway` now read the same source of truth. 19/19 protected endpoints returned 401 unauthenticated. |
| **Navigation** | **CERTIFIED** | Whitelist is authoritative; the rail matches the authenticated user's `navigation` payload. Nav labels are typed i18n keys — a missing key is a compile error, not a runtime blank. |
| **Localization** | **CERTIFIED** | 54 namespaces, EN/AR parity enforced in CI by the i18n Guard workflow. **Arabic is complete: 0 keys missing in AR.** Selector mode throughout. RTL browser-verified end to end. |
| **Enterprise Components** | **CERTIFIED** | UniversalDataGrid, SmartToolbar, EntityDrawer, PageHeader, StatusBadge, ActionMenu, Pagination render consistently across all 16 modules. No module-local reimplementations observed in the shipped UI. |

**Of 67 roles, 39 are empty `tpl-*` residue** from compiles rejected before the validation-ordering
fix. They hold zero grants and are harmless. Cleanup is tracked, not urgent.

---

## 4. Backend Certification

| Area | Status | Evidence |
| --- | --- | --- |
| **API** | **CERTIFIED** | 146+ calls observed. **Zero non-2xx while authenticated. Zero 5xx.** Write paths return correct semantic codes (201 create, 200 update). |
| **Database** | **CONDITIONALLY CERTIFIED** | MySQL 8.4 healthy. **695 migrations applied, 1 PENDING** — see §6. PostgreSQL-only syntax eliminated from the Dashboard under TASK-GL-HOTFIX-001 (42 constructs). |
| **Events** | **CONDITIONALLY CERTIFIED** | Dispatch and inline handling verified. Asynchronous/queued delivery NOT VERIFIED. |
| **Queues** | **NOT VERIFIED** | `QUEUE_CONNECTION=sync`. No worker process was exercised. `failed_jobs` holds 116 historical rows, all pre-dating this release (newest 2026-08-03; release built 2026-08-07) — log-permission errors and one missing Channel model. The storage permission fault is resolved: `storage/logs` probed **writable** in the running container. |
| **Notifications** | **CONDITIONALLY CERTIFIED** | Confirmed a presentation layer over Laravel's own infrastructure — `$user->notifications()`, `DatabaseNotification`, standard `notifications` table, framework `markAsRead()`. No parallel system, no schema change. Live count: **0 rows**, which is why the bell is correctly empty. |
| **Security** | **CERTIFIED** | Fails closed: 19/19 protected endpoints 401 unauthenticated. **API is Bearer-token only, not cookie-authenticated** — direct browser navigation to `/api/auth/me` returns `Unauthenticated`, so there is no ambient-credential surface. `APP_DEBUG=false`. Credentials encrypted at rest. Notification access is ownership-scoped, not permission-scoped — the correct instrument. |
| **Deployment** | **CERTIFIED** | The artifact CI verifies is the artifact that runs. Dockerfile now uses `npx vite build`; a CI guard fails the build if a TypeScript build is reintroduced into the image. `.gitattributes` pins LF, which made the image buildable from a Windows clone (previously exit 2). |

---

## 5. Frontend Certification

| Area | Status | Evidence |
| --- | --- | --- |
| **Workspaces** | **CERTIFIED** | 20 of 22 surfaces PASS. Both failures are the single IAM gap. |
| **Forms** | **CERTIFIED** | Sectioned EntityDrawer; required `*` markers; explicit "Optional" labels; disabled submit until valid; business rules surfaced in the UI ("Type and status are set at creation and cannot be changed here"). |
| **CRUD** | **CERTIFIED** | Create 201 · Read 200 · Update PATCH 200 persisted across reload · pagination · filters · saved views. **Delete is absent by design** in CRM: the customer record is the identity SSOT referenced by orders, tickets and loyalty. No delete path was invented to complete the matrix. |
| **Localization** | **CERTIFIED** | 54 namespaces. EN 12,443 keys · AR 12,525 keys. **0 missing in Arabic.** 82 keys exist in AR but not EN across 8 namespaces (§7, Technical Debt). |
| **RTL** | **CERTIFIED** | Full layout mirror — rail and sidebar move right, text right-aligns. Navigation, KPI labels, AI brief and alert text all translated. Arabic-Indic numerals (`٢٠٢٦`), Arabic dates (`السبت، ٨ أغسطس`), currency as `ج.م.` EN→AR→EN round-trip with session intact. Remaining Latin strings are data values, which is correct. |
| **Permission Gates** | **CONDITIONALLY CERTIFIED** | Deny side proven (19/19 401). **Differential grant side NOT VERIFIED** — proving an accountant sees Finance and is refused Marketing requires a second sign-in, and credentials must not be entered on the user's behalf. |
| **Browser Verification** | **CERTIFIED** | **Zero console errors** and **zero failed requests** across the entire run, in both language directions. No broken assets. No infinite skeletons. |

---

## 6. Deployment Certification

### Artifact verification — **CERTIFIED**

| Field | Value |
| --- | --- |
| Commit SHA | `076a4a0333416b69837a71b18f5f0e879e99a27f` |
| App image digest | `sha256:820e036721fdf76d8d77ef4a8fa6ad9ec89afdd4c66ac17d2f6b65eb8c637b08` |
| Nginx image digest | `sha256:bb16a29b638df5d3180d292430f0f2ba2674b7331579578cef27bdf96c50d815` |
| Build stamp | `2026-08-07T21:59:51Z` (`go-live-rc2`) |

The SPA is baked into the nginx image; the backend into the app image. The image contains **no
`.env` by design** — all configuration is injected at runtime.

### Runtime verification — **CERTIFIED**

Every screen in §2 was served from these two images. No `docker cp`, no dev server, no source
overlay.

### Health verification — **CERTIFIED**

`ecos-app` healthy · `ecos-mysql` healthy · `ecos-redis` healthy · `ecos-mailpit` healthy.

`ecos-nginx` reports **unhealthy**. This is a **local artifact, not a product defect**: the
healthcheck probes `https://127.0.0.1` while this workstation runs the plain-HTTP vhost
(`docker/nginx/local.conf`) because the production Let's Encrypt certificates do not exist
here. HTTP serving is fully functional — every page in this certification was served through
this container.

### Container verification — **CERTIFIED**

5 containers, correct images, correct dependency ordering, storage volume mounted and
**probed writable**.

### Environment readiness — **NOT CERTIFIED**

Two findings. Both are operational, both are bounded, both must be closed before cutover.

#### FINDING E-1 — Pending migration blocks inventory→GL posting · **P1**

```
695 migrations applied · 1 PENDING
2026_08_20_100000_retarget_inventory_posting_rules_by_class
```

Measured consequence, not inferred:

- All **8** inventory posting rules still carry the generic `inventory` account role
  (`goods_receipt`, `supplier_return`, `warehouse_transfer`, `adjustment_increase`,
  `adjustment_decrease`, `count_gain`, `count_loss`, `write_off`).
- **No postable account carries that role**, deliberately — approved policy keeps raw
  materials, packaging and finished goods on separate accounts, and 1400 is a non-postable
  header. The migration retargets the leg to `@inventory_class` so the publishing module's
  stated class picks the role.
- The Finance bridge is **ON**: `finance.integration.auto_subscribe = true`, 44 posting rules
  registered.

**Nothing has dead-lettered yet** — `finance_journal_entries` is 0 and inventory is empty, so
no rule has fired. The moment goods are received in production, GL posting for inventory
fails at role resolution.

**Recommendation:** run `php artisan migrate --force` as a mandatory cutover step and confirm
`0 pending` before opening the system to users.

#### FINDING E-2 — Verified runtime ran under a testing profile · **P1**

The running container reports:

```
APP_ENV=testing   CACHE_STORE=array   QUEUE_CONNECTION=sync
SESSION_DRIVER=array   MAIL_MAILER=array   APP_DEBUG=false
```

Root cause, traced rather than assumed: `docker-compose.yml` injects `./backend/.env` via
`env_file`. On this workstation that file is the **host-tooling** environment (it points at
`127.0.0.1` / `ecos_erp_test` so host `artisan` and `phpunit` work). The verification overlay
corrected `DB_HOST`, `DB_DATABASE` and `REDIS_HOST` — it did not correct the other five keys.

**This is a workstation artifact, not an image or code defect.** The image ships no `.env`;
the deploy server supplies its own.

**But it bounds this certification.** The following are **NOT VERIFIED** and are not certified:

| Subsystem | Why not verified |
| --- | --- |
| Queue workers | `sync` — every job ran inline; no worker process exercised |
| Redis cache | `array` — cache is per-request; Redis was never used for caching despite being healthy |
| Session persistence | `array` — not exercised (the SPA uses Bearer tokens, so impact is likely nil, but "likely" is not verification) |
| Mail delivery | `array` — mail is swallowed; Mailpit received nothing |

**Recommendation:** deploy with a production `.env` (`APP_ENV=production`, `CACHE_STORE=redis`,
`QUEUE_CONNECTION=redis`, `SESSION_DRIVER=redis`, a real `MAIL_MAILER`, `APP_DEBUG=false`), then
re-run a smoke pass covering one queued job, one cached read, and one outbound mail.

---

## 7. Known Limitations

### 7.1 Accepted Limitations

| Item | Severity | Impact | Recommendation |
| --- | --- | --- | --- |
| **BUG-GL-002** — no IAM administration UI. `Users` and `Roles & Permissions` render "Coming Soon". | **P1** | Administrators cannot manage users or roles through the interface. RBAC is fully functional underneath — 578 permissions, 67 roles, 4,457 grants — and is administered via seeders and the compiler. Degrades gracefully: a labelled placeholder inside the app shell, no crash, no misleading affordance. | Accept for v1.0. Administer IAM via seeders. Schedule the UI as the first v1.1 item. |
| `ecos-nginx` reports unhealthy locally | **P3** | None. Healthcheck probes HTTPS against an HTTP-only local vhost. | No action. Will resolve on the deploy server where the certificates exist. |
| CRM has no delete | **P3** | Customers cannot be hard-deleted from the UI. | None — this is the intended SSOT design, recorded so its absence is not later read as a gap. |

### 7.2 Deferred Features

| Item | Severity | Impact | Recommendation |
| --- | --- | --- | --- |
| 12 of 16 notification categories unwired | **P2** | 3 categories reach users (wave started, wave completed, shortage detected). 8 producers exist but deliver to a log; 4 have no producer. An expired marketing token currently fails silently. | Wire the 3 Provider Platform notifications first — highest value per unit of effort. Then the 2 written-but-uncalled Preparation classes. |
| `ExceptionRaisedNotification`, `QualityCheckFailedNotification` | **P2** | Classes complete and correct; no caller. | Add `->notify()` at the two Preparation transitions. Operations change, not platform. |
| Orders and Inventory notification contracts | **P2** | The two categories operators will expect first have no producer. | A product decision about which transitions warrant a push. Must not be invented by the UI layer. |
| Standalone notifications page | **P3** | Drawer shows the most recent page only, and says so. | Build once volume justifies it. |

### 7.3 Technical Debt

| Item | Severity | Impact | Recommendation |
| --- | --- | --- | --- |
| ESLint suppressions: **4,814 across 343 files, 13 rules** | **P2** | 4,624 are `no-hardcoded-ui-strings` — the localization backlog. Frozen by ratchet: new debt fails the build, the baseline may only shrink. | Burn down per module. **Never regenerate the baseline.** |
| TypeScript diagnostics baseline: **325** | **P2** | Dominated by TS2769 (130), TS7053 (74), TS7006 (52), TS2345 (50). Ratcheted. | Reduce opportunistically. Baseline may only shrink. |
| PHPStan baselines: **13 + 109** entries | **P3** | Frozen legacy analysis debt. | Reduce opportunistically. |
| Architecture: 16 layer violations, largest cycle 23, 118 cross-feature edges | **P2** | Measured and frozen. | Address during module work, not as a sweep. |
| **82 keys present in AR but missing in EN** across 8 namespaces (`operations` 28, `engineering` 20, `hr` 8, `raw-materials` 8, `settings` 8, `recipes` 7, `marketing` 2, `supplier-returns` 1) | **P3** | Arabic — the primary locale — is complete at 0 missing. English may fall back on 82 keys. | Backfill EN. Low risk given Arabic-first usage. |
| 39 empty `tpl-*` roles | **P3** | Zero grants, harmless residue from rejected compiles. | Delete where `role_templates.role_id` is unset and grants are zero. |
| 116 historical `failed_jobs` | **P3** | All pre-date this release (newest 2026-08-03 vs build 2026-08-07). Underlying storage-permission fault is resolved — probed writable. | Triage and clear before cutover so genuinely new failures are visible. |

### 7.4 Open Product Decisions

| Item | Severity | Impact | Recommendation |
| --- | --- | --- | --- |
| **TASK-IAM-TEMPLATE-RECONCILIATION-001** — 27 unresolved permission tokens across **17 of 40 role templates** | **P2** | Those 17 templates cannot be assigned. This is correct fail-closed behaviour, now visible instead of silent. Group A (10 tokens, 8 templates) is genuinely blocked on the Manufacturing and Shipping catalogs not existing. Group B (4 tokens) would *widen* a role and needs approval. Group C (13 tokens) has multiple defensible targets. | Resolve Groups B and C with one line of product intent each. Keep Group A open until those domains exist. **Do not guess** — guessing trades a loud failure for a quiet wrong answer, which is what produced BUG-GL-011. |
| Meta App Secret unrecoverable | **P3** | One field in `marketing_provider_credentials` id `b066e7d2-c08c-4b70-9045-7f35866ca123`, unreadable after the authorised APP_KEY rotation. Impact bounded to that single field. | Re-enter manually before any Marketing connection. No automatic repair; no fabricated replacement. |
| Google Fonts loaded from `fonts.googleapis.com` | **P3** | A third-party runtime dependency on every page load. Returns 200; not an error. | Decide consciously: self-host, or accept the external dependency. |

---

## 8. Go Live Risk Assessment

| Severity | Count | Items |
| --- | --- | --- |
| **P0** | **0** | None. BUG-GL-001 and BUG-GL-009 are fixed and confirmed fixed in the deployed image. |
| **P1** | **3** | E-1 pending migration (operational, mandatory) · E-2 testing-profile runtime (operational, mandatory) · BUG-GL-002 IAM UI (accepted limitation) |
| **P2** | **7** | Template reconciliation · notification wiring (×3) · ESLint baseline · TypeScript baseline · architecture violations |
| **P3** | **9** | nginx healthcheck · CRM delete-by-design · notifications page · PHPStan baselines · 82 EN keys · 39 empty roles · 116 failed jobs · Meta secret · Google Fonts |

**Of the 3 P1 items, 2 are closed by running a command and supplying a correct `.env`.** The
third is an accepted limitation with a working alternative path.

### Verification gaps — carried explicitly, not counted as passes

| Gap | Reason |
| --- | --- |
| Restricted-role permission matrix | Requires a second sign-in; credentials must not be entered on the user's behalf |
| Responsive (tablet/mobile) | `resize_window` reports success but the viewport does not change — proven at 1600/820/480 px. Tooling limitation. |
| Queue, Redis cache, session, mail | Testing-profile runtime (E-2) |
| Business workflows in 7 modules | Empty tenant — no data to exercise them |
| Mark-one-notification-read | Zero notifications exist |

---

## 9. Final Recommendation

# GO WITH ACCEPTED LIMITATIONS

### Objective justification

**Nothing failed.** Across 22 surfaces, 146+ API calls, a full CRUD cycle, both language
directions and two authentication states, there were **zero console errors, zero failed
authenticated requests, zero 5xx responses and zero broken assets.**

**No P0 defect is open.** Both P0s raised during the go-live phase were fixed and verified
against the deployed image rather than against source.

**The deployment pipeline is now sound.** The artifact CI verifies is the artifact that runs,
and a CI guard prevents the specific regression that made the platform unbuildable.

**Authorization fails closed.** 19 of 19 protected endpoints refused unauthenticated access,
and the API carries no ambient-credential surface.

**The three P1 items do not meet the bar for NO GO.** Two are operational steps — apply a
migration, supply a production `.env` — each a single bounded action with a verifiable
success condition. The third is a missing administrative screen for a subsystem that is
fully functional and administrable by another means.

**NO GO is not supportable on this evidence**: it would require a failure, and none was
observed. **GO without qualification is not supportable either**: four backend subsystems and
the differential permission matrix were not verified, and certifying them would mean
certifying something unobserved.

### Mandatory conditions before cutover

1. **Apply the pending migration.** Run `php artisan migrate --force`; confirm `0 pending`.
   Without this, inventory→GL posting fails at role resolution on the first goods receipt.
2. **Deploy with a production `.env`** — `APP_ENV=production`, `CACHE_STORE=redis`,
   `QUEUE_CONNECTION=redis`, `SESSION_DRIVER=redis`, a real `MAIL_MAILER`, `APP_DEBUG=false`.
3. **Re-run a smoke pass** on the production profile covering one queued job, one cached read
   and one outbound email — the four subsystems this certification could not reach.
4. **Re-enter the Meta App Secret** before any Marketing platform connection.
5. **Confirm HTTPS and certificates** on the deploy server; the nginx healthcheck should then
   report healthy.

### Recommended before cutover, not blocking

6. Complete the restricted-role permission matrix with a second account.
7. Complete a responsive pass on real devices.
8. Clear the 116 historical `failed_jobs` so new failures are visible.
9. Remove the verification artifact `CUST-28B1A8E6` ("RENAMED TestRecord") from CRM.

---

## 10. Version Baseline

**This is the official engineering baseline for ECOS ERP v1.0.** These values are frozen.
Ratcheted baselines may only shrink; they must never be regenerated.

| Baseline | Value |
| --- | --- |
| **Commit SHA** | `076a4a0333416b69837a71b18f5f0e879e99a27f` |
| **Commit subject** | `docs(iam): BUG-GL-011 CLOSED; open TASK-IAM-TEMPLATE-RECONCILIATION-001` |
| **App image digest** | `sha256:820e036721fdf76d8d77ef4a8fa6ad9ec89afdd4c66ac17d2f6b65eb8c637b08` |
| **Nginx image digest** | `sha256:bb16a29b638df5d3180d292430f0f2ba2674b7331579578cef27bdf96c50d815` |
| **Build stamp** | `2026-08-07T21:59:51Z` · `go-live-rc2` |
| **TypeScript baseline** | **325 diagnostics** — TS2769 130 · TS7053 74 · TS7006 52 · TS2345 50 · TS2353 6 · TS2304 4 · TS2322 3 · TS2339 2 · TS7031 2 · TS2554 1 · TS2307 1 |
| **TypeScript cold-build reference** | 1,631 errors · 1,479 files · 179,088 lines TS (P0 reference measurement) |
| **ESLint baseline** | **4,814 suppressions · 343 files · 13 rules** — `no-hardcoded-ui-strings` 4,624 · `no-arabic-literals` 75 · `set-state-in-effect` 50 · `only-export-components` 18 · remainder 47 |
| **PHPStan baseline** | 13 entries (`phpstan-baseline.neon`) + 109 entries (`phpstan-baseline-platform.neon`) |
| **Localization baseline** | **54 namespaces** · EN 12,443 keys · AR 12,525 keys · **0 missing in AR** · 82 missing in EN across 8 namespaces |
| **Notification baseline** | 16 categories — **3 Active** · 1 Active on a separate platform · 8 Exists-not-wired · 4 Backend-missing · 1 Out-of-scope. Live rows: **0** |
| **Guardian baseline** | **10 validators** — `01-php-syntax` `02-composer` `03-laravel` `04-pint` `05-phpstan` `06-eslint` `07-typescript` `08-vite-build` `09-docker` `10-architecture` |
| **Architecture baseline** | 1,019 files · 49 features · 118 cross-feature edges · 228 cross-feature imports · 16 layer violations · 42 graph nodes · largest cycle 23 |
| **RBAC baseline** | 578 permissions · 67 roles (28 active + 39 empty residue) · 4,457 grants · 40 templates (23 compile clean, 17 blocked) · 3 users |
| **Database baseline** | MySQL 8.4 · **695 migrations applied · 1 pending** |
| **CI gates** | Quality workflow (with image build + Dockerfile assertion) · i18n Guard workflow · Guardian pre-commit |

---

## 11. Post Go Live Recommendations

Operational only. No feature work is proposed here.

### First 24 hours

1. **Confirm `0 pending` migrations** immediately after cutover, before opening access.
2. **Watch `failed_jobs`.** With a real queue driver this table becomes the primary failure
   signal. Alert on any growth. Baseline it at 0 after clearing the 116 historical rows.
3. **Verify the first inventory movement posts to the GL.** This is the specific path E-1
   protects — confirm a journal entry appears rather than a role-resolution failure.
4. **Watch `storage/logs` disk and permissions.** A permission fault here previously caused
   116 job failures; it is currently healthy and worth confirming under real load.

### First week

5. **Confirm Redis is actually serving cache**, not merely running. `CACHE_STORE=array` was
   silently in effect during verification; the same silence would hide it in production.
6. **Complete the restricted-role permission matrix** with a real non-admin user in the
   production environment.
7. **Complete the responsive pass** on real devices.
8. **Monitor the notification feed for growth.** It is currently at 0. If Preparation activity
   begins and the bell stays empty, the read path needs investigation.
9. **Confirm outbound mail is delivering** to real recipients — `MAIL_MAILER=array` swallowed
   everything during verification.

### First month

10. **Re-run this certification against production data.** Seven modules are conditionally
    certified purely because the tenant was empty; their workflows deserve verification once
    real data exists.
11. **Begin the localization burn-down.** 4,624 hardcoded-string suppressions is the largest
    single debt. Reduce per module; never regenerate the baseline.
12. **Resolve Groups B and C of the template reconciliation** so the 17 blocked role templates
    become assignable.
13. **Schedule the IAM administration UI** as the first v1.1 item — it is the only NOT
    CERTIFIED module.
14. **Decide the Google Fonts dependency** — self-host or formally accept.

---

## Certification statement

This certification rests on evidence gathered directly from the deployed artifact — image
digests, container probes, database queries, HTTP status codes and browser screenshots. Where
evidence was unobtainable, the item is marked NOT VERIFIED with its reason and is excluded
from certification rather than assumed.

Two findings were discovered during this certification itself and are recorded rather than
deferred: the pending migration blocking inventory→GL posting, and the testing-profile runtime
that left four backend subsystems unexercised. Both are operational and bounded. Neither is a
code defect. Both must be closed before cutover.

**ECOS ERP v1.0 — GO WITH ACCEPTED LIMITATIONS, subject to the five mandatory conditions in §9.**
