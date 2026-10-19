# RELEASE-PATH-VERIFICATION-001

**Date:** 2026-08-08
**Type:** Verification only. No push, merge, reset, rebase or deployment was performed.

---

## 1. Current state

| Field | Value |
| --- | --- |
| **Current branch** | `develop` |
| **HEAD SHA** | `ba5e59149993d5dc6005c1d766db5dadd3f56e7b` |
| **HEAD subject** | `docs: add production cutover verification reports` (2026-08-08) |
| **Upstream** | **NONE** — `develop` has no configured upstream and `origin/develop` does not exist |
| **Remote refs** | `origin/main`, `origin/claude/sleepy-chaum-eb40c7`, `origin/HEAD → origin/main` |
| **Working tree** | 13 uncommitted items — all Guardian ratchet work from TASK-GUARDIAN-RATCHET-001, confined to `engineering/` and `docs/` |

## 2. Why `develop` is 139 commits ahead of `origin/main`

Because `origin/main` has not been updated since **2026-07-20** while all release work continued
on `develop`. The topology is clean — this is accumulation, not divergence:

```
origin/main (4d8f8825, 2026-07-20)
   └── local main (f47423b8, 2026-08-04)   +56 commits
          └── develop (ba5e5914, 2026-08-08)  +83 more   = 139 total
```

| Measure | Value |
| --- | --- |
| `develop` ahead of `origin/main` | **139** |
| `origin/main` ahead of `develop` | **0** |
| Merge base | `4d8f8825` — i.e. `origin/main` itself |
| local `main` contained in `develop` | **yes** |
| `platform-foundation` contained in `develop` | **yes** |

**`develop` is a strict superset of every other branch, and nothing on `origin/main` is missing
from it.** A merge into `main` is therefore a guaranteed **fast-forward** — no conflicts, no
rebase, no history rewrite.

## 3. What `deploy.sh` deploys

| Field | Value |
| --- | --- |
| **Deployment source** | `git pull origin main` — `deploy.sh:262` |
| **deploy.sh target ref** | **`origin/main` = `4d8f8825`** (2026-07-20) |
| Deploys the certified HEAD? | **NO** — it is **139 commits behind** `develop` |

### What a deployment today would omit

Every item below is present in `develop` and absent from `origin/main`:

- BUG-GL-001 — Dashboard MySQL compatibility (the P0 dashboard fix)
- BUG-GL-009 — the Dockerfile fix that made the platform buildable at all
- BUG-GL-011 — RBAC compiler fail-closed fix
- E-1 — the migration retargeting inventory posting rules to `@inventory_class`
- C-1 — queue workers for `finance-posting` and `health`
- The Finance, CRM and HR UI work

**A deployment would report success and ship software that silently discards general-ledger
postings.** This is the single most serious item in this report.

## 4. Release artifact

| Field | Certified (GO-LIVE-CERTIFICATION-001) | Present now |
| --- | --- | --- |
| App image | `sha256:820e0367…` | **ABSENT** — `docker image inspect` fails |
| Nginx image | `sha256:bb16a29b…` | **ABSENT** — `docker image inspect` fails |
| Version | `go-live-rc2` | `0.1.0` |
| Commit stamp | `076a4a03` | **`unknown`** |
| Current app image | — | `sha256:888321e571c3d7184fe43af02a3f4e28284f887d38291696511ee9f17d700c89` |
| Current nginx image | — | `sha256:3cff5ac8577c95595b91483117bc68a267053d96cab41ddacbdf36632231832d` |

**The certified `go-live-rc2` artifact no longer exists.** It was overwritten by the rebuild in
TASK-CUTOVER-002, which was performed without the traceability build args `deploy.sh` supplies,
so the replacement reports `commit: unknown` and cannot be tied to any revision.

**Does the artifact correspond to the intended release commit?** **No — and it cannot be shown
to correspond to anything.** The running image was built from the `6b02af60` working tree and
does contain the queue-worker fix (verified at runtime: `queue_workers: 3`, `scheduler: true`),
but that is inference from behaviour, not from the artifact's own identity.

## 5. Deployment dry-run

`deploy.sh` was **not executed** — it would `git pull origin main` and rebuild, both of which
would alter state and deploy the wrong ref. Its validation gates were instead evaluated directly
against the current `backend/.env`:

| Gate | Value | Outcome |
| --- | --- | --- |
| `APP_ENV` ∈ {staging, production} | **`testing`** | ❌ **HARD FAIL — script aborts here** |
| `APP_DEBUG` ≠ true | unset (defaults false) | ✅ pass |
| `APP_KEY` matches `base64:<40+>` | `base64:LjkRyagT…` | ✅ pass |
| `DB_PASSWORD` ≠ `secret` | `Staging2026Ecos!` | ✅ pass |
| `docker-compose.override.yml` absent | absent | ✅ pass |
| `SESSION_SECURE_COOKIE=true` | unset | ⚠️ warn |
| `TRUSTED_PROXIES` set | unset | ⚠️ warn |
| `LOG_LEVEL` ≠ debug | unset | ✅ pass |

**Dry-run result: `deploy.sh` aborts at the first gate** on this workstation. This is correct
behaviour — the workstation `.env` is host-tooling configuration, not a deployment environment.

## 6. Mismatches

| # | Mismatch | Severity |
| --- | --- | --- |
| **M-1** | `deploy.sh` deploys `origin/main`, **139 commits behind** the certified release line | **P0** |
| **M-2** | The certified `go-live-rc2` artifact **no longer exists**; the GO-LIVE-CERTIFICATION-001 digest baseline is stale | **P0** |
| **M-3** | The current image reports `git_sha: unknown` — untraceable to any commit | **P1** |
| **M-4** | `develop` has **no upstream** and has never been pushed; `origin/develop` does not exist | **P1** |
| **M-5** | `backend/.env` is `APP_ENV=testing` — `deploy.sh` cannot run here | P2 (expected on a workstation) |

## 7. Exact remediation required

Ordered. Steps 1–2 are a human release-management decision and are **not** authorised here.

1. **Push the release line.**
   `git push -u origin develop` — establishes the upstream and gets 139 commits off a single
   workstation. Currently the entire release exists in one place with no backup.

2. **Reconcile the deploy branch.** Because `develop` is 0 behind, this is a fast-forward:
   ```
   git checkout main && git merge --ff-only develop && git push origin main
   ```
   **Verify:** `git rev-list --count origin/main..develop` = **0**.
   *Alternative:* change `deploy.sh:262` to deploy the release branch. Repointing a deploy script
   is the larger change; the fast-forward is cleaner and preserves `main` as the deploy ref.

3. **Rebuild the artifact through `deploy.sh`**, which supplies `GIT_SHA`, `APP_VERSION` and
   `BUILD_TIME`. Record the resulting digests as the new certification baseline.
   **Verify:** `/api/health` returns a real `git_sha`, not `unknown`.

4. **Provision a production `.env`** from `backend/.env.production.example` — real `APP_URL`,
   `APP_KEY`, `DB_PASSWORD`, `REDIS_PASSWORD`, `SESSION_DOMAIN`, `SANCTUM_STATEFUL_DOMAINS` and
   SMTP credentials.

5. **Deploy** with `deploy.sh --migrate` on the production host, then run the
   TASK-CUTOVER-003 §7 runbook — in particular **Phase 3 initialization**, which no script
   performs.

**Until steps 1–3 are complete, there is no artifact that can be certified for production, and
no branch that `deploy.sh` would deploy correctly.**
