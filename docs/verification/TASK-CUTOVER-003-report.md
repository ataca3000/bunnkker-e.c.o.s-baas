# TASK-CUTOVER-003 — Operational Initialization

**Executed:** 2026-08-08
**Type:** Operational initialization. No code changed — this task ran seeders and exercised
existing procedures only.
**Predecessors:** [TASK-CUTOVER-001](TASK-CUTOVER-001-report.md) ·
[TASK-CUTOVER-002](TASK-CUTOVER-002-report.md) · [GO-LIVE-CERTIFICATION-001](GO-LIVE-CERTIFICATION-001.md)

---

## 1. Scope verification

| # | Scope item | Result |
| --- | --- | --- |
| 1 | Fiscal calendar initialization procedure | ✅ **VERIFIED** — exercised through the UI, `POST` 201 / `PATCH open` 200 |
| 2 | Fiscal periods exist | ✅ **VERIFIED** — 24 periods across 2 years |
| 3 | Default fiscal year | ✅ **VERIFIED** — FY2026 `open`, covers today; period `2026-08` `open` |
| 4 | Account role mapping for every inventory class | ✅ **VERIFIED** — all 3 classes, all 3 companies, proven by posting |

All four pass. Getting there surfaced three initialization defects that would each have caused
silent or partial posting failure in production. They are the substance of this report.

---

## 2. Fiscal calendar

### 2.1 Initialization procedure — VERIFIED through the product's own UI

There is **no seeder, no artisan command and no migration** that creates a fiscal calendar. The
only path is the operator one, and it works:

| Step | Action | Evidence |
| --- | --- | --- |
| 1 | Finance → Fiscal Calendar & Closing → *Create a fiscal year* (Name, Start, End, Periods) | `POST /api/finance/fiscal/years` → **201** |
| 2 | Periods table → *Open* on the target period | `PATCH /api/finance/fiscal/periods/{uuid}/open` → **200** |

Both were exercised live: FY2027 created through the form (201), and period `2026-09` flipped
`Future → Open` through the row action (200), with the list refetching and the action toggling
to *Close*.

### 2.2 State after initialization

| Fiscal year | Status | Range | Periods | Open |
| --- | --- | --- | --- | --- |
| FY2026 | `open` | 2026-01-01 → 2026-12-31 | 12 | 3 |
| FY2027 | `open` | 2027-01-01 → 2027-12-31 | 12 | 1 |

Period covering the go-live date 2026-08-08: **`2026-08`, status `open`** ✅

### 2.3 "Default fiscal year" — how it is actually determined

There is **no `is_default` or `is_current` column**. `finance_fiscal_years` carries
`name, start_date, end_date, status, closed_at, locked_at`. The effective year is **derived**:
the year whose range contains the posting date, whose covering period is `open`.

**Operationally this means there is nothing to "set".** What must be true is that a period
covering the posting date exists and is `open` — nothing else. Verify that, not a flag.

### 2.4 Note for operators — `createYear` opens only the first period

Creating a year generates all 12 periods but opens only period 1; the rest are `Future`. A
document dated inside a `Future` period is refused. For a clean go-live that is correct
behaviour, but **back-dated entries require their period to be opened explicitly.**

---

## 3. Account role mapping

### 3.1 Every inventory class resolves — VERIFIED by posting, not by inspection

One goods receipt was posted per class through the full pipeline:

| Inventory class | Account role | Debit account | Amount | Result |
| --- | --- | --- | --- | --- |
| `raw_material` | `raw_materials` | **1420 Raw Materials** | 100.00 | ✅ posted |
| `packaging_material` | `packaging_materials` | **1440 Packaging Materials** | 200.00 | ✅ posted |
| `finished_good` | `finished_goods` | **1410 Finished Goods** | 300.00 | ✅ posted |

Each balanced against **2120 Goods Received Not Invoiced**. All `posted`, queue drained to 0,
**dead letters unchanged at 12**, no new failed jobs. Every class posts to its own distinct
account, which is the whole point of the `@inventory_class` design.

### 3.2 Posting-rule coverage, per company

| Company | Accounts | Roles | Rules resolvable | Operational? |
| --- | --- | --- | --- | --- |
| **ECOS Holding 20** | 100 | 43 | **44 / 44** ✅ | **Yes** — 2 orders, 2 users, 1 warehouse |
| OSAMA FAYEZ AHEMD | 100 | 26 | 32 / 44 | No — 0 orders, 0 users, 0 warehouses |
| AxieFood | 100 | 26 | 32 / 44 | No — 0 orders, 0 users, 0 warehouses |

**The only operational tenant is fully posting-ready.** See finding I-3 for the other two.

---

## 4. Initialization defects found

### I-1 — Finance seeders are in no automated path · **P1**

`ChartOfAccountsSeeder` and `AccountRoleSeeder` exist but are referenced **only by tests**. They
are absent from `DatabaseSeeder` — which chains **22** other seeders and names neither — and from
`deploy.sh` and `entrypoint.sh`. A repository-wide search for both class names returns six files:
the two seeder definitions and four Finance test files. Nothing else in the codebase invokes them.

**Impact.** A first deployment that runs migrations and `db:seed` gets **no chart of accounts and
no account roles**. Every financial event then dead-letters at role resolution. This is exactly
the drift that produced the missing `packaging_materials` role reported as D-2 in CUTOVER-002.

**Measured effect of running them.** Chart of accounts **98 → 300** across 3 companies (202
accounts had never been created); account roles **42 → 95**.

**Recommendation.** Run both explicitly at first deployment (Runbook §7 step 6). Longer term,
add them to `DatabaseSeeder` — but that is a code change, deliberately not made here.

### I-2 — The seeders have a hard ordering dependency · **P1**

`AccountRoleSeeder` maps a role only if the target account **code already exists for that
company**. Run first, it silently skips every mapping and reports success.

Observed directly: my first `AccountRoleSeeder` run created **1** role, because only ECOS Holding
had accounts. After `ChartOfAccountsSeeder` created accounts for all three companies, the *same*
seeder created **52 more**.

**`ChartOfAccountsSeeder` must run before `AccountRoleSeeder`.** Both are idempotent and safe to
re-run, so the fix is simply to run them in order — and then verify counts rather than trusting
the "Seeding database" message, which appears either way.

### I-3 — Two companies cannot post 12 of 44 rules · **P2**

`OSAMA FAYEZ AHEMD` and `AxieFood` each lack 13 roles: `cogs`, `bank`, `customer_deposits`,
`deferred_revenue`, `bad_debt_expense`, `salaries_expense`, `salaries_payable`,
`employee_deductions_payable`, `employer_contribution_expense`,
`employer_contributions_payable`, `commission_expense`, `bonus_expense`, `inventory`.

**Impact is currently nil** — both are dormant (0 orders, 0 users, 0 warehouses). **All
inventory-class roles are present for them**, so the scope-4 requirement holds. But if either is
activated, 12 rules — COGS, payroll, AR — will dead-letter.

**Recommendation.** Before activating either tenant, seed the missing roles and re-run the
per-company coverage check. Not a go-live blocker for ECOS Holding.

### I-4 — `orders.inventory_reduction` still names the deprecated `inventory` role · **P2**

The E-1 migration retargeted the eight `inventory.*` rules to `@inventory_class`. It did not
cover the `orders.*` namespace. One rule remains:

```
orders.inventory_reduction:  debit cogs (cost)  |  credit inventory (cost)
```

`inventory` is the generic role the approved policy **deliberately does not map** — the
`AccountRoleSeeder` docblock says so explicitly, because stock is kept separated by class and
1400 is a non-postable header.

**Impact.** On ECOS Holding it resolves only via a **legacy role row** pointing at
**1410 Finished Goods**. That is plausible for an order shipment and it does post — but it is
hardcoded to finished goods regardless of what was actually shipped, which is precisely the
problem `@inventory_class` was introduced to solve. On the two other companies it is unmapped and
would dead-letter.

**Recommendation.** Finance should decide whether `orders.inventory_reduction` should defer to
`@inventory_class` like its inventory-namespace siblings, or whether order shipments always
reduce finished goods and the current behaviour is intended. **I did not change it** — retargeting
a posting rule is a business decision and out of scope.

---

## 5. Operational Initialization Checklist

Per company. Verify each with the stated command — do not trust seeder output, which reports
success even when it skips everything.

| # | Item | Verification | Required state |
| --- | --- | --- | --- |
| 1 | Company exists | `SELECT COUNT(*) FROM companies` | ≥ 1 |
| 2 | **Chart of accounts seeded** | `SELECT COUNT(*) FROM finance_accounts WHERE company_id=?` | **100 per company** |
| 3 | **Account roles seeded** | `SELECT COUNT(*) FROM finance_account_roles WHERE company_id=?` | ≥ 26; **43 for a fully operational tenant** |
| 4 | All inventory classes map | roles `raw_materials`, `packaging_materials`, `finished_goods` present and postable | 3 / 3 |
| 5 | **Every posting rule resolves** | per-company coverage check (§3.2) | **44 / 44 for operational tenants** |
| 6 | **Fiscal year exists** | `SELECT * FROM finance_fiscal_years` | ≥ 1, status `open`, range covers go-live date |
| 7 | **Period covering go-live is OPEN** | `SELECT * FROM finance_fiscal_periods WHERE start_date<=:d AND end_date>=:d` | status = **`open`** |
| 8 | RBAC seeded | `SELECT COUNT(*) FROM permissions`, `roles` | 578 permissions · roles present |
| 9 | Admin user exists | `SELECT COUNT(*) FROM users` | ≥ 1 |
| 10 | Warehouse / brand / branch | per company | ≥ 1 each for operational tenants |

**Items 2, 3, 5, 6 and 7 are the ones that have actually been wrong.** They are the reason this
task exists.

---

## 6. Deployment Initialization Checklist

| # | Item | Verification | Required state |
| --- | --- | --- | --- |
| 1 | `APP_KEY` set, well-formed | `deploy.sh` gate | `base64:` + 44 chars |
| 2 | `APP_ENV=production`, `APP_DEBUG=false` | `deploy.sh` gate (hard-fail) | enforced |
| 3 | Driver profile | `/api/health` → `environment` | `production`; `CACHE_STORE`/`QUEUE_CONNECTION`/`SESSION_DRIVER` = `redis` |
| 4 | `DB_PASSWORD` not the dev default | `deploy.sh` gate (hard-fail in production) | enforced |
| 5 | `SESSION_SECURE_COOKIE=true`, HTTPS | `deploy.sh` audit | true |
| 6 | `LOG_STACK=daily`, `LOG_LEVEL=error` | `deploy.sh` audit | set |
| 7 | **`MAIL_MAILER` is a real mailer** | send one test message | **currently `array` — OPEN** |
| 8 | Migrations | `php artisan migrate:status` | **0 pending** |
| 9 | Image traceability | `/api/health` → `git_sha` | a real SHA, **not `unknown`** |
| 10 | **All 4 queues consumed** | `/api/health` → `queue_workers` | **3 workers**; `finance-posting`, `engineering`, `health`, `default` |
| 11 | Scheduler alive | `/api/health` → `scheduler` | **`true`** |
| 12 | Core dependencies | `/api/health` | `database`, `redis`, `queue`, `storage` all `true` |
| 13 | Storage + symlink | container probe | writable; `public/storage` → `storage/app/public` |
| 14 | `failed_jobs` baseline | `SELECT COUNT(*)` | **0** before opening to users |

---

## 7. Runbook — First Production Deployment

Ordered. Each step has a verification that must pass before the next.

### Phase 1 — Pre-flight (before touching the server)

1. **Provision `backend/.env`** from `backend/.env.production.example`. Set `APP_URL`, `APP_KEY`
   (`php artisan key:generate`), `DB_PASSWORD`, `REDIS_PASSWORD`, `SESSION_DOMAIN`,
   `SANCTUM_STATEFUL_DOMAINS`, and real SMTP credentials.
   *Verify:* `APP_ENV=production`, `APP_DEBUG=false`, all three Redis drivers set.
2. **Confirm TLS certificates** exist for the production hostname.
   *Verify:* nginx starts without "cannot load certificate".

### Phase 2 — Deploy

3. **`./deploy.sh --migrate`** — this is the only supported build path. It validates the
   environment, audits security, tags rollback images, builds with traceability args, self-tests
   the image, starts containers, snapshots the DB, previews `migrate:status`, then migrates.
   *Verify:* script exits 0.
4. **Confirm migrations.** `php artisan migrate:status`
   *Verify:* **0 pending.**
5. **Confirm the artifact.** `curl /api/health`
   *Verify:* `git_sha` is a real SHA (**not `unknown`**), `environment: production`.

### Phase 3 — Initialization ⚠️ *the phase no script performs*

6. **Seed Finance foundations — in this exact order** (I-1, I-2):
   ```
   php artisan db:seed --class='Modules\Finance\Infrastructure\Database\Seeders\ChartOfAccountsSeeder' --force
   php artisan db:seed --class='Modules\Finance\Infrastructure\Database\Seeders\AccountRoleSeeder' --force
   ```
   *Verify by counting, not by reading the output:* `finance_accounts` = 100 per company;
   `finance_account_roles` ≥ 26 per company. **A "Seeding database" message proves nothing** —
   `AccountRoleSeeder` prints it even when it skips every mapping.
7. **Create the fiscal year.** Finance → Fiscal Calendar & Closing → *Create a fiscal year*
   (e.g. `FY2026`, 2026-01-01 → 2026-12-31, 12 periods).
   *Verify:* `POST /api/finance/fiscal/years` → 201; 12 periods listed.
8. **Open the period covering go-live.** Periods table → *Open* on that row.
   *Verify:* `PATCH .../open` → 200; status shows `Open`. **Only period 1 opens automatically.**
9. **Confirm posting readiness** — run the per-company coverage check.
   *Verify:* **44 / 44** for every operational tenant.

### Phase 4 — Smoke test

10. **Health.** `curl /api/health`
    *Verify:* `status: ok`, `scheduler: true`, `queue_workers: 3`, all dependencies `true`.
11. **End-to-end posting** — the decisive test. Post one real goods receipt.
    *Verify:* a **balanced journal entry appears**, the `finance-posting` queue returns to **0**,
    and **no new dead letter**. If it dead-letters, read the reason — it will name the missing
    precondition precisely.
12. **Mail.** Send one message; confirm external delivery.
13. **Deployment guardian.** Run it — it now asserts each of the four queues has a consumer.
14. **Clear `failed_jobs`** so the operational baseline is 0.

### Phase 5 — Post-cutover watch (first 24 h)

15. Watch `failed_jobs` — with a real queue driver this is the primary failure signal.
16. Watch `finance_posting_dead_letters` — a rising count means a posting precondition is unmet.
17. Confirm the first real inventory movement produces a journal entry.
18. Re-enter the **Meta App Secret**, or expect ~26 failed health-check jobs per day.

### Rollback

`deploy.sh` tags the previous images `:rollback` and snapshots the database before migrating; its
`ERR` trap rolls back automatically and prints the snapshot path.

---

## 8. Final Recommendation

# READY FOR PRODUCTION CUTOVER — procedure certified; execution on production pending

### What is certified

**All four items in scope pass on measured evidence.** The fiscal calendar initialization
procedure was exercised through the product's own UI (201 / 200). Fiscal periods exist. The
default fiscal year is derived correctly and the go-live period is open. Every inventory class
maps to its own postable account — proven not by inspecting configuration but by posting a
journal entry per class and watching each land on a different account.

The one operational tenant, **ECOS Holding 20, resolves 44 of 44 posting rules**. Combined with
CUTOVER-002, the chain from enterprise event to posted journal entry is verified end to end under
the production driver profile.

The initialization gap that made all of this fragile is now understood and documented: **two
Finance seeders that no automated path runs, with a hard ordering dependency between them, whose
failure mode is a success message and an empty result.** That is captured in §5 and Runbook §7
step 6, with count-based verification rather than trusting seeder output.

### What is explicitly *not* certified

I am scoping this recommendation honestly rather than overstating it:

| Item | Status |
| --- | --- |
| The production host itself | **Never contacted** — unreachable from this workstation |
| Mail delivery | **Unconfigured** (`MAIL_MAILER=array`) — needs production SMTP |
| Image traceability | `git_sha: unknown` locally; `deploy.sh` stamps correctly on the real path |
| `orders.inventory_reduction` (I-4) | Awaiting a Finance decision — P2 |
| Two dormant companies (I-3) | 32/44 — must be closed before either is activated — P2 |

**"Ready" here means the platform and the procedure are proven, and the runbook is complete
enough to execute.** It does not mean production has been verified, because production has never
been visible to me. The remaining work is execution of §7 on the production host, and the two
items above that only the operator can supply.

Run Phase 3 with particular care. It is the phase no script performs, its failure mode is silent,
and it is the difference between a working general ledger and an empty one.

---

## Appendix — Change record

**No code was modified.** No commit was created in this task.

| Action | Target | Nature |
| --- | --- | --- |
| `ChartOfAccountsSeeder` | rehearsal DB | Idempotent; created 202 missing accounts (98 → 300) |
| `AccountRoleSeeder` ×2 | rehearsal DB | Idempotent; created 53 missing roles (42 → 95) |
| Fiscal year `FY2026` + 12 periods | rehearsal DB | Operator setup (CUTOVER-002) |
| Fiscal year `FY2027` + 12 periods | rehearsal DB | Created via UI to validate the procedure |
| Period `2026-09` opened | rehearsal DB | Validated the open-period procedure via UI |
| 3 journal entries (100/200/300 EGP) | rehearsal DB | Inventory-class coverage proof |

Rehearsal artifacts for cleanup: journal entries `TASK-CUTOVER-002` and
`TASK-CUTOVER-003/*` (reverse via the UI — they are posted financial records), fiscal year
`FY2027`, dead letter `cutover-002-goods-receipt-probe`, CRM record `CUST-28B1A8E6`.

No production system was contacted. No credential was read, echoed or stored.
