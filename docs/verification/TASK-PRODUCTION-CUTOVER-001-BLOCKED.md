# TASK-PRODUCTION-CUTOVER-001 — HALTED AT PHASE 1

**Date:** 2026-08-08
**Status:** ⛔ **DEPLOYMENT NOT EXECUTED**
**Action taken:** Phase 1 verification only. **Nothing was deployed. Nothing is live.**

> This task's completion criteria state: *"Otherwise: Stop immediately. Document the blocker. Do
> not continue deployment."* Phase 1 verification failed on four independent P0 blockers. That
> rule was applied. **No PRODUCTION RELEASE CONFIRMATION is issued and the platform is NOT
> declared LIVE.**

---

## Executive summary

Phase 1 could not be completed. Four blockers were found, each sufficient on its own to stop the
cutover. The most serious is not the absence of production access — it is that **the branch
`deploy.sh` deploys does not contain the certified release.**

| ID | Blocker | Severity |
| --- | --- | --- |
| **B-1** | No production environment is reachable from this workstation | **P0** |
| **B-2** | The certified commit exists only locally — never pushed | **P0** |
| **B-3** | `deploy.sh` deploys `origin/main`, which is **138 commits behind** the release | **P0** |
| **B-4** | Mail is unconfigured — an explicit Phase 2 requirement | **P0** |
| B-5 | The certified image cannot be identified (`git_sha: unknown`) | P1 |

**Had B-1 not stopped the deployment, B-3 would have caused it to succeed while shipping the
wrong software.** That is the worst failure mode available here, and it is worth stating plainly.

---

## Phase 1 — Pre-Deployment Checklist

| # | Required | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Latest certified commit | ❌ **FAIL** | `6b02af60` exists **only in the local worktree**. `develop` has **no upstream tracking branch**; the commit has never been pushed to `origin`. |
| 2 | Latest certified image | ❌ **FAIL** | The running image reports `git_sha: unknown`, `version: 0.1.0`. It cannot be tied to a commit, so "the certified image" cannot be identified. |
| 3 | Backup completed | ⚠️ **N/A** | No production system exists to back up. |
| 4 | Database backup | ⚠️ **N/A** | A 4.7 MB snapshot of the **rehearsal** database was taken in TASK-CUTOVER-001. It is not a production backup and must not be counted as one. |
| 5 | Storage backup | ⚠️ **N/A** | No production storage volume is reachable. |
| 6 | Environment backup | ⚠️ **N/A** | No production `.env` exists here. The local `backend/.env` is host-tooling configuration. |

**Phase 1 result: FAILED.** Phases 2–5 were not attempted.

---

## The blockers

### B-1 — No production environment is reachable · **P0**

Production is deployed by `deploy.sh` over SSH to a remote host whose connection details live in
GitHub Actions **environment secrets** (`DEPLOY_HOST`, `DEPLOY_PORT`, `DEPLOY_USER`,
`DEPLOY_PATH`, `DEPLOY_PRIVATE_KEY`). None of that is present here:

```
DEPLOY_HOST    (unset)
DEPLOY_USER    (unset)
DEPLOY_PATH    (unset)
DEPLOY_PORT    (unset)
gh             command not found
https://localhost → no TLS listener
```

The local stack is not production and never was: no TLS, `backend/.env` points at
`ecos_erp_test`, and the nginx image expects Let's Encrypt certificates for `aseelhoneyeg.com`
that do not exist on this machine. This was established in TASK-CUTOVER-001 and re-confirmed here.

**On the SSH keys.** Private keys (`id_ed25519`, `github_actions_ed25519`) do exist in `~/.ssh`.
**I did not use them and will not.** Deploying is an irreversible, outward-facing action against
production infrastructure; doing it with credentials I was never given a target for — and were
never authorised for this purpose — is not something I will do on my own initiative, regardless
of the instruction to execute the runbook. **A human with the deploy target must run this.**

### B-2 — The certified commit was never pushed · **P0**

```
local HEAD  : 6b02af60  fix(ops): give every dispatched queue a consumer; drop pgrep …
git status  : ## develop          ← no upstream tracking branch
```

`6b02af60` carries the TASK-CUTOVER-002 fixes: the three queue workers that stop general-ledger
postings from being silently discarded, and the `/proc`-based health detection. It exists on this
workstation only. I committed it locally and deliberately did not push — pushing was never
authorised.

**No deployment can include this commit until it is pushed.**

### B-3 — `deploy.sh` deploys a branch that is 138 commits behind · **P0**

This is the most dangerous finding, because it fails silently and looks like success.

```
deploy.sh:262     git pull origin main
origin/main       4d8f8825  fix(frontend): resolve all TypeScript errors for tsc -b --force
develop           6b02af60  fix(ops): give every dispatched queue a consumer …

git rev-list --count origin/main..develop  →  138
```

The certified release line is `develop`. `deploy.sh` pulls **`main`**. Running it today would
complete successfully and deploy software that contains **none** of the certified work:

- ❌ BUG-GL-001 — the Dashboard MySQL-compatibility fix
- ❌ BUG-GL-009 — the Dockerfile fix that made the platform buildable at all
- ❌ BUG-GL-011 — the RBAC compiler fix
- ❌ The E-1 migration retargeting inventory posting rules to `@inventory_class`
- ❌ C-1 — the queue workers for `finance-posting` and `health`
- ❌ The entire Finance, CRM and HR UI work merged into `develop`

**A "successful" deployment would therefore ship a release that silently discards general-ledger
postings** — the exact defect TASK-CUTOVER-002 was raised to fix.

**Resolution required before any cutover:** either merge `develop` into `main` and deploy `main`,
or change the deploy branch — a release-management decision, not an operational one. I did not
make it.

### B-4 — Mail is unconfigured · **P0 for Phase 2**

Phase 2 requires **"✓ Mail configured"**. Measured:

```
MAIL_MAILER = array              ← every message is discarded
MAIL host   = 127.0.0.1          ← placeholder
MAIL from   = hello@example.com  ← placeholder
```

Open since TASK-CUTOVER-001 (C-3). Requires production SMTP credentials, which I will not handle.

### B-5 — The certified image cannot be identified · **P1**

`/api/health` reports `git_sha: unknown`, `version: 0.1.0`. `docker compose build` does not pass
the traceability arguments that `deploy.sh` supplies (`--build-arg GIT_SHA/APP_VERSION/BUILD_TIME`,
lines 291-294). Phase 1 requires verifying "the latest certified image"; with no embedded commit,
there is nothing to verify against.

Not blocking on its own — `deploy.sh` stamps correctly on the real build path — but it means the
image running locally is **not** the certified artifact and must not be treated as one.

---

## Deliverables

The five requested deliverables cannot be produced as specified, because four of them describe a
deployment that did not occur. Reporting them as anything other than not-executed would be
fabrication.

| # | Deliverable | Status |
| --- | --- | --- |
| 1 | Production Deployment Report | ⛔ **NOT EXECUTED** — Phase 1 failed; no deployment attempted |
| 2 | Production Smoke Test Report | ⛔ **NOT EXECUTED** — nothing deployed to test |
| 3 | Production Monitoring Report | ⛔ **NOT EXECUTED** — no production system to monitor |
| 4 | Production Validation Report | ⛔ **NOT EXECUTED** — no release to validate |
| 5 | Go Live Completion Report | ⛔ **NOT ISSUED** — replaced by this blocker report |

**What has already been verified, and still stands** (against the rehearsal stack, under the
production driver profile — see the predecessor reports, not re-claimed here as production
evidence):

- 20 of 22 UI surfaces render; zero console errors; zero failed authenticated requests
- Authorization fails closed — 19/19 protected endpoints returned 401
- All four queues consumed; event → job → rule → **balanced posted journal entry** proven
- All three inventory classes post to their own accounts
- `/api/health`: `scheduler: true`, `queue_workers: 3`, all dependencies `true`

None of that is production evidence. It is evidence that **the software is ready to be deployed**
— which is precisely why the deployment mechanics above must be fixed rather than bypassed.

---

## Required before this task can be re-attempted

**Release management** (human decision — not operational):

1. **Push `6b02af60`** to the remote so the certified commit exists outside this workstation.
2. **Reconcile the deploy branch (B-3).** Merge `develop` → `main`, or change `deploy.sh` to
   deploy the release line. Then verify: `git rev-list --count origin/main..develop` = **0**.

**Operations** (requires the production host):

3. Provide the deploy target and run `deploy.sh --migrate` **from a session that has the
   production credentials**. This step must be performed by a human with that access.
4. Populate production SMTP in `backend/.env` (B-4).
5. Confirm `/api/health` returns a **real** `git_sha` (B-5) and `environment: production`.

**Then, and only then**, execute the certified runbook — TASK-CUTOVER-003 §7, Phases 3–5 — with
particular care on **Phase 3 initialization**, which no script performs:

```
db:seed ChartOfAccountsSeeder   →  verify finance_accounts = 100 per company
db:seed AccountRoleSeeder       →  verify finance_account_roles ≥ 26 per company
create fiscal year              →  verify POST 201, 12 periods
open the go-live period         →  verify status = open
post one goods receipt          →  verify a balanced journal entry appears
```

---

## Statement

**ECOS ERP v1.0 has not been deployed to production. The platform is not live.**

The software passed every verification put to it across four prior tasks. What stopped this
cutover is not the software — it is that the deployment path points at a branch 138 commits
behind the certified release, the certified commit has never left this machine, mail is
unconfigured, and no production environment is reachable from here.

Deploying anyway would have produced a green result and a broken general ledger. Stopping is the
correct outcome, and it is what this task instructed.

**No production system was contacted. No SSH key was used. No credential was read, copied or
stored. No code was modified in this task.**
