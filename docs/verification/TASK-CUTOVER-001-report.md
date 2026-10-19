# TASK-CUTOVER-001 — Production Environment Preparation

**Executed:** 2026-08-08
**Type:** Operational. No application code, business logic, features or UI were modified.
**Release under preparation:** `076a4a03` · app `sha256:820e0367…` · nginx `sha256:bb16a29b…` · `go-live-rc2`

---

## 0. Scope reality — read this first

**The production environment is not reachable from this workstation.**

Production is deployed by `deploy.sh` over SSH to a remote host supplied through GitHub Actions
secrets (`DEPLOY_HOST`, `DEPLOY_PORT`, `DEPLOY_USER`, `DEPLOY_PATH`, `DEPLOY_PRIVATE_KEY`). No
production host, credential or database is present here, and I did not attempt to obtain one.

So this task was executed as **a full cutover rehearsal against the local verification stack**,
which runs the identical certified images. That distinction is carried through every section
below:

| Marking | Meaning |
| --- | --- |
| **VERIFIED (artifact)** | Verified against configuration that ships to production — templates, `deploy.sh` gates, `supervisord.conf`, `entrypoint.sh`, image layers. This conclusion transfers to production. |
| **VERIFIED (rehearsal)** | Executed successfully on the local stack using the certified images. Proves the step works; does **not** prove it was done on production. |
| **NOT VERIFIABLE HERE** | Requires the production host. Stated, not assumed. |

**The rehearsal found a defect that would have caused a silent production failure.** It is the
headline of this report and is the reason for the final verdict.

---

## 1. Production Environment Report

### 1.1 Required configuration — audited against `backend/.env.production.example`

**VERIFIED (artifact).** The production template already satisfies every key this task requires.

| Required | Template value | Status |
| --- | --- | --- |
| `APP_ENV=production` | `production` | **PASS** |
| `APP_DEBUG=false` | `false` — *"MUST be false — never expose stack traces"* | **PASS** |
| `CACHE_STORE=redis` | `redis` | **PASS** |
| `QUEUE_CONNECTION=redis` | `redis` | **PASS** |
| `SESSION_DRIVER=redis` | `redis` | **PASS** |
| `MAIL_MAILER=<production mailer>` | `smtp` / `MAIL_SCHEME=smtps` / port 465 | **PASS (shape)** — credentials are `CHANGE-ME`, see C-3 |
| `LOG_CHANNEL=stack` | `stack`, `LOG_STACK=daily`, `LOG_LEVEL=error` | **PASS** |
| `SESSION_SECURE_COOKIE=true` | `true` | **PASS** |
| `APP_URL` matches production | `https://erp.example.com` — placeholder | **OPERATOR ACTION** |

The template also enforces separation from staging: distinct `DB_DATABASE`, `REDIS_DB`,
`REDIS_CACHE_DB`, `SESSION_COOKIE`, `SESSION_DOMAIN` and `AWS_BUCKET`, each annotated with why.

### 1.2 Configuration is gated at deploy time

**VERIFIED (artifact).** `deploy.sh` hard-fails the deployment on:

- `APP_ENV` not `staging` or `production`
- `APP_DEBUG=true`
- `APP_KEY` absent or not matching `base64:<40+ chars>`
- `DB_PASSWORD=secret` (the development default) when `APP_ENV=production`
- presence of `docker-compose.override.yml`
- missing `backend/.env` or wrong working directory

and warns on `SESSION_ENCRYPT≠true`, `SESSION_SECURE_COOKIE≠true`, unset `TRUSTED_PROXIES`,
and `LOG_LEVEL=debug`.

These gates run **before** any container is touched. Configuration compliance is therefore
enforced mechanically at cutover, not by checklist discipline.

### 1.3 The environment actually running here

**NOT the production profile**, and it must not be mistaken for it:

```
APP_ENV=testing        APP_DEBUG=false       CACHE_STORE=array
QUEUE_CONNECTION=sync  SESSION_DRIVER=array  MAIL_MAILER=array
LOG_CHANNEL=stack (stack→single)             LOG_LEVEL=debug
```

Cause, traced rather than assumed: `docker-compose.yml` injects `./backend/.env` via `env_file`,
and on this workstation that file is the **host-tooling** environment. The image ships no `.env`
by design. This is a workstation artifact, not an image or code defect — but it is precisely what
concealed the defect in §3.

---

## 2. Migration Report

**VERIFIED (rehearsal). E-1 from GO-LIVE-CERTIFICATION-001 is now CLOSED.**

### Procedure followed

1. **Snapshot taken before any change** — `mysqldump --single-transaction --routines --triggers`,
   4.7 MB, 87 `INSERT` statements, copied out of the container to durable storage.
2. Pre-state captured.
3. `php artisan migrate --force` executed.
4. Post-state and business effect verified.

### Result

| Metric | Before | After |
| --- | --- | --- |
| Applied migrations | 695 | **696** |
| **Pending migrations** | 1 | **0** ✅ |

### Migration executed — the complete list

| Migration | Duration | Result |
| --- | --- | --- |
| `2026_08_20_100000_retarget_inventory_posting_rules_by_class` | 490.99 ms | **DONE** |

That is the only migration executed. No other schema or data change was made.

### Business effect verified, not assumed

All 8 inventory posting rules retargeted from the unresolvable generic `inventory` role to
`@inventory_class`:

| Rule | Before | After |
| --- | --- | --- |
| `inventory.goods_receipt` | `inventory` \| `grni` | **`@inventory_class`** \| `grni` |
| `inventory.supplier_return` | `grni` \| `inventory` | `grni` \| **`@inventory_class`** |
| `inventory.warehouse_transfer` | `inventory_in_transit` \| `inventory` | `inventory_in_transit` \| **`@inventory_class`** |
| `inventory.adjustment_increase` | `inventory` \| `…gain` | **`@inventory_class`** \| `…gain` |
| `inventory.adjustment_decrease` | `…loss` \| `inventory` | `…loss` \| **`@inventory_class`** |
| `inventory.count_gain` | `inventory` \| `…gain` | **`@inventory_class`** \| `…gain` |
| `inventory.count_loss` | `…loss` \| `inventory` | `…loss` \| **`@inventory_class`** |
| `inventory.write_off` | `…expense` \| `inventory` | `…expense` \| **`@inventory_class`** |

### Regression check after migration

`/api/health` 200 · `/healthz` 200 · `/build-info` 200 · `/app/` 200 · `/api/auth/me` 401
(correctly refusing) · Inventory Dashboard renders · **zero console errors**.

**Production note:** this proves the migration applies cleanly and does what it claims. It was
applied to the rehearsal database. **Production still requires `php artisan migrate --force`**,
and `deploy.sh --migrate` already takes its own DB snapshot and prints a `migrate:status`
preview before running it.

---

## 3. Queue Report

### 3.1 Transport and worker — VERIFIED (rehearsal)

Round-trip probe pushed a job onto `redis`/`default`:

| Step | Evidence |
| --- | --- |
| App → Redis push | queue depth **0 → 1** |
| Worker consumed it | queue depth **1 → 0** |
| Worker ran the job pipeline | attempt made |
| Failure recorded correctly | `failed_jobs` 116 → 117, `connection=redis`, `queue=default` |

The probe payload itself failed to deserialize (`SerializableClosure … bindTo() on null`) because
the closure was defined inside `tinker`'s `eval()`'d code and its source could not be read. **That
is a test-harness artifact, not a platform defect** — and the failure path it exercised is itself
evidence the worker is healthy. My probe row was removed; `failed_jobs` is back to 116.

Supervisor is baked into the image and running:

```
php-fpm           RUNNING   uptime 1:20:11
laravel-queue     RUNNING   uptime 0:20:08   (--max-time=3600 → hourly self-restart, expected)
laravel-schedule  RUNNING   uptime 1:20:11
```

Redis connectivity independently confirmed: `SET`/`GET` round-trip returned `ok`.

### 3.2 ⛔ FINDING C-1 — Two queues have no consumer · **P0 cutover risk**

**Description.** The platform has exactly one queue worker, defined at
`docker/php/supervisord.conf:36`:

```
php artisan queue:work redis --queue=engineering,default …
```

It consumes **`engineering`** and **`default`** only. But jobs are dispatched to four queues:

| Queue | Dispatched from | Consumed? |
| --- | --- | --- |
| `engineering` | (engineering pipeline) | ✅ yes |
| `default` | implicit default | ✅ yes |
| **`finance-posting`** | `Modules/Finance/Integration/Application/Jobs/ProcessFinancialEventJob.php:41` | ❌ **NO** |
| **`health`** | `Modules/Marketing/…/DispatchProviderHealthChecksCommand.php:55` | ❌ **NO** |

I confirmed this is the only Laravel worker in the repository — `grep` across every `.conf`,
`.yml`, `.sh` and `Dockerfile` returns exactly one `queue:work`. The `worker/` directory is an
unrelated Node service.

**Impact.** Today this is invisible, because `QUEUE_CONNECTION=sync` runs every job inline.
**The moment production sets `QUEUE_CONNECTION=redis` — which §1 requires — it becomes live:**

- **`ProcessFinancialEventJob` is the Finance integration pipeline.** Every event→rule→journal
  posting flows through it. Its jobs would be pushed to a `finance-posting` Redis list that
  nothing reads. They would accumulate indefinitely.
- **There would be no error.** No exception, no failed job, no dead letter, no log entry.
  `/api/health` would stay green. **General-ledger posting would silently stop**, and the first
  symptom would be an accountant noticing the ledger is empty.
- `CheckProviderHealthJob` is dispatched by the scheduler hourly, 6-hourly and daily. All
  Marketing provider health monitoring would silently stop the same way.

This is the exact failure mode that E-1 was raised to prevent, arriving through a different door.
Fixing E-1 alone does **not** make Finance posting work under production configuration.

**Recommended corrective action.** Add the two queues to the worker in
`docker/php/supervisord.conf`, ordering `finance-posting` ahead of bulk work:

```
--queue=finance-posting,engineering,health,default
```

Consider a dedicated worker process for `finance-posting` so ledger posting is never starved
behind long-running engineering jobs.

**I did not implement this.** It changes `supervisord.conf`, which requires an image rebuild and
would invalidate the certified image digest recorded in GO-LIVE-CERTIFICATION-001. That is a
release decision, not an operational one, and the task's rule for a discovered issue is to
describe, explain and recommend. **After the fix, the image must be rebuilt, re-digested and the
certification baseline updated.**

**Verification after the fix:** with `QUEUE_CONNECTION=redis`, post a financial event and confirm
a `finance_journal_entries` row appears; confirm the `finance-posting` Redis list returns to zero.

---

## 4. Scheduler Report

**VERIFIED (rehearsal).** `laravel-schedule` (`artisan schedule:work`) RUNNING, uptime 1:20:11.
No host crontab is required — the scheduler is a supervised long-running process inside the
container, which is the correct pattern for this deployment.

10 scheduled tasks registered and computing next-due times correctly:

| Schedule | Task |
| --- | --- |
| `*/30 * * * *` | `meta:sync` |
| `0 */6 * * *` | `meta:sync --token-check` |
| `0 3 * * *` | `meta:webhooks:retry` |
| `5 0 * * *` | `orders:activate-scheduled` |
| `0 6 * * *` | `preparation:create-daily-sessions` |
| `* * * * *` | `preparation:freeze-sessions` |
| `0 * * * *` | `marketing:provider:health-check` |
| `0 */6 * * *` | `marketing:provider:health-check --level=permissions` |
| `0 0 * * *` | `marketing:provider:health-check --level=full` |
| `* * * * *` | `wave:run-scheduler` |

**Dependency on C-1:** the three `marketing:provider:health-check` entries dispatch to the
unconsumed `health` queue. The scheduler will fire correctly; the work will not be performed.

---

## 5. Cache Report

### 5.1 The requested sequence was NOT executed — deliberately

The task asked for `optimize:clear`, `config:cache`, `route:cache`, `event:cache`, `view:cache`.
**Running that sequence against a running container would degrade this deployment.** I verified
the design before acting, and did not act.

The cache lifecycle is already implemented, correctly and automatically:

| Command | Where it runs | Why there |
| --- | --- | --- |
| `composer install --optimize` | **build** | env-independent |
| `route:cache` | **build** (`Dockerfile:255`) | env-independent; baked into the image |
| `event:cache` | **build** (`Dockerfile:256`) | env-independent; baked into the image |
| `config:cache` | **container start** (`entrypoint.sh:149`, step 6) | must encode real runtime values injected via `env_file` — unavailable at build time |
| `view:cache` | **deliberately excluded** | `storage/` is a runtime named volume, not an image layer |
| `optimize:clear` | **never at runtime** | would delete the build-time artifacts |

**Evidence this is live, not just documented.** In the running container:

```
config.php      root      Aug 8 01:17   ← written at container start (step 6)
routes-v7.php   www-data  Aug 8 01:08   ← baked at build  (2.7 MB)
events.php      www-data  Aug 8 01:08   ← baked at build
services.php    www-data  Aug 8 01:08   ← baked at build
packages.php    www-data  Aug 8 01:08   ← baked at build
```

Two distinct owners and timestamps, exactly matching the two-phase design.

### 5.2 FINDING C-5 — Manual cache commands are contraindicated · **P2**

**Description.** `php artisan optimize:clear` on a running container deletes `routes-v7.php` and
`events.php`, which are **only regenerated by `docker build`**.

**Impact.** The container would fall back to resolving ~2.7 MB of routes on every request until
the next image rebuild. Additionally, running `config:cache` under the current environment would
bake `APP_ENV=testing` values into `config.php`, and `view:cache` would write into a volume the
design intentionally keeps uncached.

**Recommendation.** Do not run these manually in production. Cache state is an image-plus-entrypoint
concern. If a cache refresh is ever needed, redeploy — `deploy.sh` rebuilds and restarts, which
regenerates every layer in the correct order. Amend any runbook that lists the manual sequence.

---

## 6. Storage Report

**VERIFIED (rehearsal).** All correct; no action required.

| Check | Result |
| --- | --- |
| `storage/` ownership | `www-data:www-data`, `drwxrwxr-x` |
| `storage/app`, `storage/framework`, `storage/logs` | `www-data:www-data`, `drwxrwxr-x` |
| `bootstrap/cache` | `www-data:www-data`, `drwxrwxr-x` |
| PHP-FPM run user | `www-data` — **matches ownership** |
| Write probe on `storage/logs` | **WRITABLE** |
| `public/storage` symlink | **present** → `/var/www/html/storage/app/public` |
| Free disk | 943.37 GB |
| Memory | 2 MB / 1 G limit |

The storage-permission fault behind a batch of historical job failures is resolved: `entrypoint.sh`
steps 2–4 ensure the directory tree, fix permissions and create the symlink on every container
start.

---

## 7. Mail Report

### FINDING C-3 — Mail is not configured · **P1**

**Description.** Current runtime:

```
MAIL_MAILER = array          ← mail is discarded, never sent
MAIL host   = 127.0.0.1:2525 ← placeholder; not Mailpit, not a real relay
MAIL from   = hello@example.com ← placeholder
```

`MAIL_MAILER=array` discards every message. **No outbound mail has ever been sent or received in
this environment**, including by `ShortageDetectedNotification`, which declares a `mail` channel.

**Impact.** Any production deployment inheriting this configuration would silently discard all
notification email. Nothing errors; mail simply never arrives.

**NOT VERIFIABLE HERE.** SMTP connectivity cannot be tested without real credentials and a real
relay, and I will not handle production mail credentials.

**Recommendation.** Populate `MAIL_HOST`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM_ADDRESS`
in the production `.env` (the template already sets `smtp` + `smtps` + port 465). After cutover,
send one real test message and confirm delivery to an external mailbox. Verify credentials are
supplied via the deploy secret store — never committed.

**No credentials were read, echoed or written during this task.**

---

## 8. Logging Report

**VERIFIED (rehearsal), with one environment-profile finding.**

| Check | Result |
| --- | --- |
| Application logging | Working — 15 log files, 13 MB total |
| Daily rotation | **Working** — files named `laravel-YYYY-MM-DD.log` |
| Retention | `days = 14` configured |
| Error logging | Confirmed — historical exceptions captured with stack traces |
| Log directory writable | Yes |

### FINDING C-7 — Current profile logs to `single` at `debug` · **P3**

**Description.** `LOG_CHANNEL=stack` is correct, but the stack resolves to **`single`**, not
`daily`, and the daily channel level is **`debug`**.

**Impact.** Under `single`, all output goes to one ever-growing `laravel.log` with no rotation.
At `debug`, stack traces and query parameters are written to disk — a disclosure and disk-growth
risk.

**This does not affect production.** `.env.production.example` correctly sets `LOG_STACK=daily`
and `LOG_LEVEL=error`, and `deploy.sh` warns when `LOG_LEVEL=debug`. This is a symptom of the
workstation env file (§1.3).

**Recommendation.** Confirm `LOG_STACK=daily` and `LOG_LEVEL=error` in the production `.env` at
cutover. Consider log shipping so retention is not bounded by the container volume.

---

## 9. Health Report

**VERIFIED (rehearsal).** `GET /api/health` → **HTTP 200**

```json
{"status":"ok","environment":"testing","version":"go-live-rc2",
 "git_sha":"076a4a0333416b69837a71b18f5f0e879e99a27f",
 "built_at":"2026-08-07T21:59:51Z",
 "database":true,"redis":true,"queue":true,"storage":true,"scheduler":false,
 "disk_free":"943.37 GB","memory":"2 MB / 1G"}
```

| Dependency | Reported | Independently confirmed |
| --- | --- | --- |
| Database | `true` | ✅ 696 migrations queried directly |
| Redis | `true` | ✅ `SET`/`GET` round-trip returned `ok` |
| Queue | `true` | ✅ push/consume round-trip observed |
| Storage | `true` | ✅ write probe succeeded |
| Scheduler | `false` | ❌ **false negative — see C-4** |

The endpoint correctly reports build identity, and correctly treats `storage` and `scheduler` as
informational so a storage blip cannot cascade into a container restart loop.

Edge endpoints: `/healthz` 200 · `/build-info` 200 · `/app/` 200 · `/api/auth/me` 401.

### FINDING C-4 — `scheduler: false` is a false negative · **P3**

**Description.** `HealthController` detects the scheduler with
`pgrep -cf "artisan schedule"` (line 75). **`pgrep` is not installed in the image** — `procps` is
absent — so the command yields `0` and the field is always `false`. `shell_exec` itself is enabled
and functional; only the binary is missing. Supervisor confirms `laravel-schedule` is RUNNING.

**Impact.** Any monitoring that alerts on `scheduler: false` fires permanently and will be tuned
out — which is worse than no check, because a genuine scheduler outage would then go unnoticed.
Contained: the field is informational and does not affect the HTTP status code.

**The same flaw exists in `engineering/deployment-guardian/validators/04-services.sh:86`**, which
also uses `pgrep` and will likewise report the queue worker as absent.

**Recommendation.** Install `procps` in Dockerfile Stage 3, or detect via
`supervisorctl status laravel-schedule`. Requires an image rebuild — bundle with the C-1 fix.

---

## 10. Deployment Readiness Summary

### Completed in this task

| # | Item | Status |
| --- | --- | --- |
| 1 | Pre-change database snapshot (4.7 MB) | ✅ Taken and stored |
| 2 | **E-1 closed** — pending migration applied | ✅ **696 applied / 0 pending** |
| 3 | Posting-rule retargeting verified | ✅ 8/8 rules now `@inventory_class` |
| 4 | Post-migration regression check | ✅ All endpoints 200/401; zero console errors |
| 5 | Queue transport + worker + failure handling | ✅ Round-trip verified |
| 6 | Scheduler running, 10 tasks registered | ✅ Verified |
| 7 | Storage, permissions, symlink | ✅ Verified |
| 8 | Redis connectivity | ✅ Verified |
| 9 | Health endpoint and edge endpoints | ✅ Verified |
| 10 | Production config template and deploy gates | ✅ Audited compliant |
| 11 | Probe artifact removed | ✅ `failed_jobs` restored to 116 |

### Open findings

| ID | Severity | Finding | Blocks cutover? |
| --- | --- | --- | --- |
| **C-1** | **P0** | `finance-posting` and `health` queues have no consumer — GL posting stops silently under production queue config | **YES** |
| **C-2** | **P1** | Production environment not reachable; preparation performed on rehearsal stack only | **YES** |
| **C-3** | **P1** | Mail unconfigured (`array` driver, placeholder host and sender) | **YES** |
| C-4 | P3 | `/api/health` `scheduler:false` false negative (`pgrep` absent); same in deployment-guardian | No |
| C-5 | P2 | Manual cache sequence contraindicated; runbook should be amended | No |
| C-6 | P3 | 116 historical `failed_jobs` predating this release | No |
| C-7 | P3 | Current profile logs `single`/`debug`; production template correct | No |

### Completion criteria — measured against the task's own bar

| Criterion | Production | Rehearsal |
| --- | --- | --- |
| Production environment fully prepared | ❌ **Not performed** — host unreachable | ✅ |
| Pending migrations = 0 | ❌ Not applied to production | ✅ **0** |
| Environment variables verified | ⚠️ Template audited; live values unverifiable | ❌ Testing profile |
| Operational services verified | ⚠️ Config verified | ✅ All running |

---

## 11. Recommendation

# NOT READY FOR CUTOVER

### Objective justification

**Finding C-1 alone is disqualifying, independent of environment access.**

The single queue worker consumes `engineering` and `default`. `ProcessFinancialEventJob` — the
entire Finance event→rule→journal pipeline — dispatches to `finance-posting`, which nothing
consumes. Under `QUEUE_CONNECTION=sync` this is invisible. **Under `QUEUE_CONNECTION=redis`,
which production configuration mandates, general-ledger posting stops silently: no exception, no
failed job, no dead letter, no log line, and `/api/health` stays green.**

This is a defect in shipped configuration, not an environment gap. It would survive a perfect
production `.env` and a clean migration run. It is measured — one `queue:work` definition in the
repository, four dispatch targets, two unmatched — not inferred.

Two further conditions are unmet: production was never touched (C-2), and mail is unconfigured
and would silently discard every message (C-3).

**Nothing regressed, and the release itself is not in question.** GO-LIVE-CERTIFICATION-001 stands.
E-1 is now closed with evidence, and the rehearsal confirmed migrations, queue transport, worker,
scheduler, storage, Redis and health all behave correctly on the certified images. The path to
READY is short and fully specified.

### Mandatory before cutover

1. **Fix C-1.** Add `finance-posting` and `health` to the worker's `--queue` list, ordering
   `finance-posting` first, or provision a dedicated worker for it. **Rebuild the image, record
   the new digest, and update the certification baseline.**
2. **Fix C-4 in the same rebuild** — install `procps` (or switch both checks to `supervisorctl`)
   so scheduler and worker monitoring stop reporting false negatives.
3. **Provision the production `.env`** from `.env.production.example`: real `APP_URL`, `APP_KEY`,
   `DB_PASSWORD`, `REDIS_PASSWORD`, `SESSION_DOMAIN`, `SANCTUM_STATEFUL_DOMAINS`, and SMTP
   credentials. `deploy.sh` will hard-fail if any gate is unmet.
4. **Run `deploy.sh --migrate`** on the production host. It snapshots the database, previews
   `migrate:status`, then applies. Confirm **0 pending** afterwards.
5. **Post-cutover smoke test, in this order:**
   - `/api/health` → 200 with `environment: production` and `scheduler: true`
   - Post one financial event → confirm a `finance_journal_entries` row appears and the
     `finance-posting` Redis list returns to zero — **this is the C-1 regression test**
   - Send one real email and confirm external delivery
   - Confirm a cached read is served by Redis, not rebuilt per request
   - Confirm HTTPS, `SESSION_SECURE_COOKIE=true`, and nginx reporting healthy

### Recommended, not blocking

6. Clear the 116 historical `failed_jobs` so genuinely new failures are visible against a zero baseline.
7. Amend any runbook listing the manual cache sequence (C-5).
8. Remove the verification record `CUST-28B1A8E6` from CRM.
9. Re-enter the Meta App Secret for `marketing_provider_credentials` id `b066e7d2-c08c-4b70-9045-7f35866ca123`.

---

## Appendix — Change record

| Action | Target | Reversible |
| --- | --- | --- |
| Database snapshot taken | rehearsal MySQL → container `/tmp` + scratchpad | n/a |
| `migrate --force` (1 migration) | rehearsal database | Yes — snapshot retained |
| Queue probe job dispatched | rehearsal Redis | Consumed; artifact row deleted |
| Probe row removed from `failed_jobs` | rehearsal database | `failed_jobs` restored to 116 |

**No application code, business logic, configuration file, image or commit was modified.**
No production system was contacted. No credential was read, copied, echoed or stored.
