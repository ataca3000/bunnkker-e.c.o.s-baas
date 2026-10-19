# TASK-CUTOVER-002 — Operational Readiness Fixes

**Executed:** 2026-08-08
**Type:** Operational infrastructure. No feature work, no UI, no business logic, no redesign.
**Commit:** `6b02af605416ab7241632015af6192acd33754e2` — local on `develop`, **not pushed**
**Predecessor:** [TASK-CUTOVER-001](TASK-CUTOVER-001-report.md) · [GO-LIVE-CERTIFICATION-001](GO-LIVE-CERTIFICATION-001.md)

---

## 0. What changed

Three files. No schema, no API contract, no business logic.

| File | Change |
| --- | --- |
| `docker/php/supervisord.conf` | One queue worker → three, covering all four dispatched queues |
| `backend/app/Http/Controllers/Infrastructure/HealthController.php` | `pgrep` → `/proc` scan; added `queue_workers` |
| `engineering/deployment-guardian/validators/04-services.sh` | Same `pgrep` fix + per-queue consumer assertion |

**Critical to the verification:** the rehearsal stack was switched to the **production driver
profile** — `APP_ENV=production`, `QUEUE_CONNECTION=redis`, `CACHE_STORE=redis`,
`SESSION_DRIVER=redis`. Under the previous `QUEUE_CONNECTION=sync` every job ran inline and no
queue was ever touched, which is precisely why C-1 stayed invisible. **C-1 cannot be verified
under `sync`.** Confirmed live: `APP_ENV=production QUEUE=redis CACHE=redis SESSION=redis`.

---

## 1. Operational Readiness Report

| CUTOVER-001 finding | Severity | Status |
| --- | --- | --- |
| **C-1** — `finance-posting` and `health` had no consumer | **P0** | ✅ **RESOLVED AND VERIFIED** |
| **C-4** — `/api/health` and guardian reported false negatives (`pgrep` absent) | P3 | ✅ **RESOLVED AND VERIFIED** |
| C-5 — manual cache sequence contraindicated | P2 | Documented; unchanged by design |
| C-6 — 116 historical `failed_jobs` | P3 | Open — cleanup pending |
| C-2 — production environment unreachable | P1 | **Still open** — not addressable from this workstation |
| C-3 — mail unconfigured | P1 | **Still open** — requires production SMTP credentials |

### Design decision — three workers, not one

The obvious fix is `--queue=finance-posting,engineering,health,default` on the existing worker.
I did not do that. `engineering` jobs run with `--timeout=3600`, so a single worker would let one
hour-long engineering job block general-ledger posting for that hour. Splitting by work class
means no queue can be starved by another:

| Program | Queues | Timeout | Rationale |
| --- | --- | --- | --- |
| `laravel-queue-finance` | `finance-posting` | 300s | Ledger posting isolated; never queues behind bulk work |
| `laravel-queue-engineering` | `engineering` | 3600s | **Unchanged** from the original worker — existing behaviour preserved exactly |
| `laravel-queue-default` | `health,default` | 300s | Short-running general work |

---

## 2. Queue Verification Report

### 2.1 All four queues have an active consumer — **VERIFIED**

Read from `/proc` inside the running container:

```
--queue=finance-posting
--queue=engineering
--queue=health,default
```

Supervisor:

```
laravel-queue-default       RUNNING   pid 34
laravel-queue-engineering   RUNNING   pid 33
laravel-queue-finance       RUNNING   pid 32
laravel-schedule            RUNNING   pid 35
php-fpm                     RUNNING   pid 31
```

| Queue | Consumer | Verified by | Result |
| --- | --- | --- | --- |
| `finance-posting` | `laravel-queue-finance` | Real job dispatched, drained, journal posted | ✅ **PASS** |
| `engineering` | `laravel-queue-engineering` | Consumer present; timeout unchanged | ✅ **PASS** |
| `health` | `laravel-queue-default` | Real job dispatched via scheduler command, drained | ✅ **PASS** |
| `default` | `laravel-queue-default` | Consumer present; round-trip verified in CUTOVER-001 | ✅ **PASS** |

### 2.2 No stuck jobs — **VERIFIED**

Final depths after all tests: `finance-posting 0 · engineering 0 · health 0 · default 0`.

---

## 3. Finance Posting Verification Report

### 3.1 The chain, end to end — **VERIFIED**

A synthetic goods-receipt event was dispatched through the real pipeline:

```
FinancialEvent (inventory.goods_receipt, net 1000.00 EGP, inventory_class=raw_material)
  → ProcessFinancialEventJob
  → finance-posting queue        depth 0 → 1
  → laravel-queue-finance worker depth 1 → 0
  → posting rule inventory.goods_receipt
  → @inventory_class resolved
  → journal entry POSTED
```

### 3.2 The posted entry

| Field | Value |
| --- | --- |
| Reference | `TASK-CUTOVER-002` |
| Entry date | 2026-08-08 |
| Status | **posted** |
| **Debit** | account **15 — Raw Materials** — 1,000.0000 |
| **Credit** | account **31 — Goods Received Not Invoiced** — 1,000.0000 |
| Balance | 1,000.00 = 1,000.00 ✅ |

**This simultaneously proves the E-1 migration works.** The rule's leg is `@inventory_class`;
the event declared `inventory_class = raw_material`; the resolver mapped
`raw_material → raw_materials → account 15`. Before the migration that leg named the generic
`inventory` role, which resolves to no postable account.

Confirmed visible in the UI at Finance → Journal Entries: Total 1 · Posted 1 · Draft 0 ·
Reversed 0 · EGP 1,000.00 debit and credit.

### 3.3 The four required assertions

| Assertion | Result | Evidence |
| --- | --- | --- |
| No stuck jobs | ✅ | `finance-posting` depth 0 |
| No silent failures | ✅ | Every outcome landed in a table — journal, dead letter, or `failed_jobs` |
| No dead letters | ✅ | 12 before, **12 after** — the successful run created none |
| No missing journal entries | ✅ | 0 → **1**, balanced, posted |
| No new failed jobs | ✅ | 116 before, 116 after |

### 3.4 ⚠️ FINDING D-1 — No fiscal calendar existed · **P0 cutover prerequisite**

**This is how the first attempt failed, and it is a genuine blocker.**

The first run of the test dead-lettered with:

> `No fiscal period covers 2026-08-08. Create and open the period first.`

Measured: `finance_fiscal_years` **0 rows**, `finance_fiscal_periods` **0 rows**. No fiscal
calendar had ever been created.

**Impact.** With no open fiscal period, **every financial posting dead-letters**. The pipeline,
the workers and the rules are all correct and it still posts nothing. Note this is the *good*
failure mode — fail-closed, recorded, with an actionable message — but the ledger stays empty.

**Resolution in the rehearsal.** Created `FY2026` (2026-01-01 → 2026-12-31, 12 periods) and
opened period `2026-08`, using `FiscalCalendarService` — the same service
`FiscalController@createYear` calls. No business logic was reimplemented; this is the operator
setup step that had simply never been performed. The test then posted successfully.

**Recommendation.** **Creating and opening the fiscal calendar must be an explicit step in the
production cutover runbook**, before any operational traffic. It is not covered by
`deploy.sh`, not covered by any seeder, and no migration creates it. Verify
`finance_fiscal_periods` has an open period covering the go-live date.

### 3.5 FINDING D-2 — `packaging_materials` account role is missing · **P2**

`RulePostingStrategy::INVENTORY_CLASS_ROLES` maps:

| Inventory class | Account role | Exists in `finance_account_roles`? |
| --- | --- | --- |
| `raw_material` | `raw_materials` | ✅ account 15 |
| `finished_good` | `finished_goods` | ✅ account 14 |
| **`packaging_material`** | **`packaging_materials`** | ❌ **MISSING** |

**Impact.** Any inventory movement carrying `inventory_class = packaging_material` — goods
receipt, adjustment, count, write-off — will fail role resolution and dead-letter. Raw-material
and finished-good movements are unaffected.

Contained: it fails closed and visibly, by deliberate design (*"a class with no entry is refused
rather than defaulted"*). This is not a silent-loss defect of the C-1 class.

**Recommendation.** Seed the `packaging_materials` account role against the packaging inventory
account before go-live, or confirm with Finance that packaging is intentionally out of scope for
v1.0. **I did not create it** — choosing which GL account a class posts to is a Finance decision,
not an operational one.

---

## 4. Health Verification Report

### 4.1 Health queue pipeline — **VERIFIED**

```
php artisan marketing:provider:health-check
  → "Dispatched 1 health check job(s)."
  → health queue                 depth 0 → 1
  → laravel-queue-default worker depth 1 → 0
  → CheckProviderHealthJob executed
```

The queue plumbing is proven end to end: dispatched, enqueued on `health`, consumed by a worker,
and executed. **Before this fix the job would have sat in Redis forever.**

**The job itself failed**, and the reason is precise and already known:

> `Illuminate\Contracts\Encryption\DecryptException: The MAC is invalid.`

That is the Meta `app_secret`, which cannot be decrypted after the authorised APP_KEY rotation —
recorded in GO-LIVE-CERTIFICATION-001 with a standing recovery action. **This is not a queue
defect.** The failure occurred inside the job's business logic, which means the job reached it.

**Honest statement of scope:** the *pipeline* is verified. The *provider check* did not succeed,
and cannot until the Meta App Secret is re-entered.

### 4.2 Consequence worth flagging

`marketing:provider:health-check` is scheduled hourly, 6-hourly and daily. **It will now produce
a failed job on every run** until the Meta secret is restored. Before this fix it silently did
nothing at all.

This is an improvement — a real problem is now visible — but it will generate roughly 26
`failed_jobs` rows per day. **Re-enter the Meta App Secret before cutover**, or expect that noise.

### 4.3 Scheduler health — **VERIFIED**

| | Before | After |
| --- | --- | --- |
| `/api/health` `scheduler` | `false` (permanently) | ✅ **`true`** |
| `queue_workers` | field did not exist | ✅ **`3`** |

Root cause was `pgrep -cf "artisan schedule"`; `pgrep` ships in `procps`, which is not installed
in the runtime image. Replaced with a `/proc/[0-9]*/cmdline` scan in pure PHP — no package, no
dependency on `shell_exec`, works in any Linux container.

**Health reporting was not weakened.** It is strictly stronger: the scheduler field now reports
truthfully instead of always-false, a new `queue_workers` field exposes worker liveness, and
`storage`/`scheduler` remain informational so they cannot cascade into container restart loops.

The deployment guardian received the same fix plus a new per-queue assertion that fails if any of
`finance-posting`, `engineering`, `health`, `default` lacks a consumer — **so C-1 cannot recur
undetected.**

### 4.4 Full health payload

```json
{"status":"ok","environment":"production","version":"0.1.0","git_sha":"unknown",
 "built_at":"2026-08-08T00:04:00Z","database":true,"redis":true,"queue":true,
 "storage":true,"scheduler":true,"queue_workers":3,
 "disk_free":"941.94 GB","memory":"2 MB / 1G"}
```

---

## 5. Container Verification Report

| Check | Result |
| --- | --- |
| Image rebuilt | ✅ `ecos-erp/app` — contains both fixes, verified at runtime |
| Supervisor configuration | ✅ 5 programs, all RUNNING |
| Queue workers | ✅ 3 workers, all four queues consumed |
| Health endpoint | ✅ HTTP 200, `scheduler:true`, `queue_workers:3` |
| Container startup | ✅ `ecos-app` reached healthy; entrypoint ran storage → symlink → `config:cache` |
| Production driver profile | ✅ `APP_ENV=production QUEUE=redis CACHE=redis SESSION=redis` |
| Edge endpoints | ✅ `/healthz` 200 · `/build-info` 200 · `/app/` 200 · `/api/auth/me` 401 |

### FINDING D-3 — Rebuilt image is not traceable · **P2 (local only)**

`git_sha` reports `unknown` and `version` `0.1.0`. `docker compose build` does not pass the
traceability build args; `deploy.sh` does (`--build-arg GIT_SHA/APP_VERSION/BUILD_TIME`, lines
291-294). Every attempt to rebuild with those args exceeded the environment's process limit and
was killed — each arg change invalidates the layer cache from the `LABEL` onward, forcing a
near-full rebuild.

**Impact on production: none.** `deploy.sh` is the production build path and stamps correctly.
**Impact here:** the locally verified image cannot be pinned to a digest in the certification
baseline, so the GO-LIVE-CERTIFICATION-001 image digests are now stale.

**Recommendation.** Let `deploy.sh` build the production image — it is the supported path — and
record the resulting digests as the new baseline. The *content* verified here is correct; only
the metadata stamp is absent.

---

## 6. Regression Report

Run under the production driver profile, which is a harder test than the original verification.

| Area | Result | Evidence |
| --- | --- | --- |
| **Existing queue behaviour** | ✅ No regression | `engineering` retains its own worker with `--timeout=3600` and `stopwaitsecs=3600` unchanged; all queues drain to 0 |
| **Notifications** | ✅ No regression | Bell opens, `GET /api/notifications` 200, real feed, no mock, "Mark all read" present |
| **Finance** | ✅ No regression + improvement | All 9 workspaces render; Fiscal Calendar shows FY2026/12 periods; Journal Entries shows the posted entry |
| **Logistics** | ✅ No regression | Shipping → Fulfillments plus 17 sub-surfaces render |
| **Dashboard** | ✅ No regression | Figures unchanged: EGP 21.1K, 2 orders; all APIs 200 |
| **Session / auth** | ✅ No regression | Session survived the switch to Redis-backed sessions (Bearer tokens, unaffected) |
| **Console** | ✅ Clean | **Zero console errors** across every page checked |
| **Core data** | ✅ Intact | orders 2 · products 3 · suppliers 1 · permissions 578 · roles 67 |

Two 404s encountered (`/app/logistics/fulfillments`, `/app/accounting/journal-entries`) were
**my own URL guesses**; both resolve correctly via the navigation rail (`/app/fulfillments`,
`/app/accounting/journals`). Not defects — verified before recording.

---

## 7. Completion Criteria

| Criterion | Status |
| --- | --- |
| All queues actively consumed | ✅ **Met** — 4/4 verified with real jobs |
| Finance posting verified | ✅ **Met** — balanced journal entry posted end to end |
| Health queue verified | ✅ **Met** — pipeline verified; job fails on a known, documented cause |
| Scheduler health verified | ✅ **Met** — `scheduler: true`, no longer a false negative |
| Production image rebuilt | ⚠️ **Partially** — content correct and verified; traceability stamp absent (D-3) |

---

## 8. Final Recommendation

# NOT READY FOR CUTOVER

### What this task set out to do, it did

**C-1 is resolved and verified against the exact configuration that would have triggered it.**
Under `QUEUE_CONNECTION=redis`, a real financial event travelled the full path and produced a
correct, balanced, posted journal entry. The queue that would have silently swallowed general-
ledger postings now has a dedicated consumer that cannot be starved. **C-4 is resolved**: the
health endpoint tells the truth, and the deployment guardian now fails if any queue loses its
consumer, so this class of defect cannot recur undetected.

### Why the verdict is still NOT READY

Three conditions are unmet, and none is a code defect:

1. **D-1 — no fiscal calendar (P0 prerequisite).** With no open fiscal period, every posting
   dead-letters. The rehearsal database had none, and nothing in `deploy.sh`, the seeders or the
   migrations creates one. **Production's fiscal calendar state is unknown and unverifiable from
   here.** If it is empty at cutover, Finance posts nothing.
2. **C-3 — mail is unconfigured.** `MAIL_MAILER=array` discards every message. Requires
   production SMTP credentials, which I will not handle.
3. **C-2 — production remains unreachable.** Everything above was verified on the rehearsal
   stack using the certified images. I cannot certify an environment I cannot see.

Plus **D-2** (P2): packaging-class inventory movements will dead-letter until the
`packaging_materials` account role is seeded — a Finance decision, not an operational one.

**Nothing regressed and nothing failed.** The gap between here and READY is a short, fully
specified list of configuration steps performed on the production host.

### Mandatory before cutover

1. **Build the production image with `deploy.sh`** so it carries a real `GIT_SHA`; record the new
   digests as the certification baseline (D-3).
2. **Provision the production `.env`** from `.env.production.example`, including real SMTP (C-3).
3. **Run `deploy.sh --migrate`**; confirm **0 pending**.
4. **Create and open the fiscal calendar** covering the go-live date, and verify
   `finance_fiscal_periods` has an open period (D-1). **This is the step most likely to be
   missed — it exists in no script.**
5. **Seed `packaging_materials`**, or confirm packaging is out of scope for v1.0 (D-2).
6. **Re-enter the Meta App Secret** — otherwise the health scheduler generates ~26 failed jobs
   per day.
7. **Post-cutover smoke test:** `/api/health` → `environment: production`, `scheduler: true`,
   `queue_workers: 3`; then post one real financial event and confirm a journal entry appears and
   `finance-posting` returns to 0.
8. **Run the deployment guardian** — it now asserts every queue has a consumer.

### Recommended, not blocking

9. Clear the 116 historical `failed_jobs` so new failures are visible against a zero baseline.
10. Remove the rehearsal artifacts listed below.

---

## Appendix — Change record

### Committed (`6b02af60`, local, **not pushed**; Guardian passed)

| File | Nature |
| --- | --- |
| `docker/php/supervisord.conf` | Infrastructure config — 1 worker → 3 |
| `backend/app/Http/Controllers/Infrastructure/HealthController.php` | Health detection only; no business logic |
| `engineering/deployment-guardian/validators/04-services.sh` | Validator only |
| `docs/verification/*.md` | Documentation |

### Rehearsal-environment data (not production; flagged for cleanup)

| Artifact | Note |
| --- | --- |
| Fiscal year `FY2026` + 12 periods, `2026-08` open | Legitimate setup — production needs its own (D-1) |
| Journal entry `TASK-CUTOVER-002`, EGP 1,000.00, posted | Verification artifact. **Reverse via the UI rather than deleting** — it is a posted financial record |
| Dead letter `cutover-002-goods-receipt-probe` | From the pre-fiscal-calendar attempt; safe to resolve |
| 1 `failed_jobs` row — Meta health check | Genuine failure; recurs until the Meta secret is restored |
| CRM record `CUST-28B1A8E6` | From TASK-GL-VERIFY-001 |

**No business logic, API contract, schema or permission was changed. No production system was
contacted. No credential was read, echoed or stored.**
