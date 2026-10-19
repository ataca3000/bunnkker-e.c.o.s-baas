# ECOS ERP — Development Workflow

**Established by TASK-DEVOPS-001.** Two permanent branches, two isolated environments, one direction of flow.

---

## 1. Branching Strategy

| Branch | Role | Environment | Deploys | Direct pushes |
|---|---|---|---|---|
| `main` | Production line | **Production** | on push to `main` | Blocked — pull request only |
| `develop` | Active engineering line | **Staging** | on push to `develop` | Allowed |

```
feature work ──► develop ──► Staging ──► review ──► main ──► Production
                    ▲                                 │
                    └──────── never merged back ───────┘
```

**All engineering work targets `develop`.** `main` changes only by reviewed merge from `develop`.

### Rules

- No history rewrite on either branch — no rebase, squash, amend, or force push.
- `main` is never merged into `develop`; `develop` is never rebased onto `main`. They diverge only until the next release merge, which is `--no-ff` so the release point stays visible.
- A release merge is the *only* way code enters `main`.

---

## 2. Development Workflow

1. Start from `develop`:
   ```bash
   git checkout develop && git pull origin develop
   git checkout -b feat/<scope>-<short-description>
   ```
2. Work. Commit in coherent units — one reason to change per commit.
3. Run the gates locally before pushing:
   ```bash
   cd backend  && php vendor/bin/phpstan analyse --memory-limit=4G
   cd backend  && php -d memory_limit=2G vendor/bin/phpunit
   cd frontend && npm run lint && node scripts/typecheck-ratchet.mjs --check
   cd frontend && node scripts/analyze-architecture.mjs --check && npx vite build
   ```
4. Open a pull request into `develop`.
5. On merge, CI runs every gate and deploys to **Staging** automatically.

### The ratchet rule

Every gate freezes existing debt and fails only on **new** debt.

> **A baseline may only shrink.** Re-recording one to accommodate a regression is not permitted. If a fix legitimately removes a baselined error, remove that entry — the baseline gets smaller, never larger.

Three gates on this platform were previously adopted, went red on day one, and were switched off within a week. That is why every gate ratchets.

---

## 3. Staging Workflow

Staging exists to be broken safely. It is the first place a schema change, a migration, or a queue change runs against realistic conditions.

**Trigger:** any push to `develop`.
**Pipeline:** all quality gates → backend suite → frontend production build → deploy.

Staging shares **nothing** with Production except the Git repository:

| Resource | Production | Staging |
|---|---|---|
| Compose project | `ecos-erp` | `ecos-erp-staging` |
| Containers | `ecos-*` | `ecos-staging-*` |
| Database | `ecos_erp` | `ecos_erp_staging` |
| Redis DB / cache DB | 0 / 2 | 1 / 3 |
| Queue | `ecos_queue` | `ecos_staging_queue` |
| Session cookie | `ecos_session` | `ecos_staging_session` |
| Volumes | `app-storage`, `mysql-data`, `redis-data` | `staging-*` |
| Network | `ecos-network` | `ecos-staging-network` |
| HTTP ports | 80 / 443 | 8080 / 8443 |
| Log level | `error` | `debug` |
| Mail | real MTA | Mailpit sink — never reaches real recipients |
| `MIGRATE_ON_START` | `false` | `true` |

Isolation is enforced on five independent axes (project, container name, volume, network, port), so no single misconfiguration crosses the boundary.

---

## 4. Production Workflow

**Trigger:** push to `main` — which can only happen via a reviewed merge.

**Production deployment can originate only from `main`.** `deploy.yml` fails the run if any other ref resolves to the production environment, including a manual `workflow_dispatch`. That was previously possible and is now closed.

Production migrations are never implicit: `MIGRATE_ON_START=false`. A schema change must already have run on Staging.

---

## 5. Review Process

Enforced by branch protection on `main` plus `.github/CODEOWNERS`.

- At least one approving review, from a code owner for the paths touched.
- All quality-gate checks green on the merge SHA.
- Conversations resolved.
- Branch up to date with `main` before merge.

Paths that always require platform review: `.github/`, `docker*`, `scripts/`, migrations, PHPStan configs and baselines, `eslint-suppressions.json`, `engineering/baselines/`, and the `.env.*.example` contracts.

### Branch protection settings

These live in GitHub settings and **cannot be committed** — apply them once, on `main`:

- ✅ Require a pull request before merging — 1 approval, dismiss stale approvals
- ✅ Require review from Code Owners
- ✅ Require status checks to pass — `PHPStan`, `TypeScript`, `ESLint`, `Architecture Ratchet`, `Backend Tests`, `Production Build`
- ✅ Require branches to be up to date before merging
- ✅ Require conversation resolution
- ✅ Block force pushes · ✅ Block deletions
- ✅ Include administrators

On `develop`: block force pushes and deletions; require status checks. Direct pushes stay allowed — it is the working branch.

---

## 6. Merge Process (release)

```bash
git checkout main && git pull origin main
git merge --no-ff develop -m "release: <summary>"
git push origin main            # triggers Production deploy
```

Always `--no-ff`. The merge commit is the release record and the rollback anchor.

---

## 7. Rollback Process

**Fastest — redeploy the previous good commit:**
```bash
ssh <user>@<host> "cd <path> && bash scripts/rollback.sh"
```

**From CI — deploy a known-good SHA:** re-run the Deploy workflow on `main` at that commit.

**By revert (preserves history — never rewrite `main`):**
```bash
git checkout main
git revert -m 1 <release-merge-sha>
git push origin main
```

**Database.** Migrations are not automatically reversed. If a release included a schema change, roll back the code first, then decide on the schema deliberately — a `down()` that drops a column destroys data. Restore from backup if in doubt.

---

## 8. Release Checklist

- [ ] `develop` green on all six gates
- [ ] Backend suite run and failure count reviewed — no *new* failures
- [ ] Staging deployed from this exact SHA and exercised
- [ ] Migrations run on Staging successfully, and reviewed for reversibility
- [ ] No baseline grew (PHPStan, TypeScript, ESLint, architecture)
- [ ] No new suppressions, `@phpstan-ignore`, `any`, skipped or disabled tests
- [ ] `.env.production.example` updated if a new variable was introduced
- [ ] Breaking API or schema change documented
- [ ] Rollback path identified for this release

## 9. Deployment Checklist

**Before**
- [ ] Target SHA confirmed and green
- [ ] Production database backup taken and verified restorable
- [ ] New env vars present on the server (they are not deployed by CI)
- [ ] Maintenance window agreed if migrations are long-running

**During**
- [ ] Deploy workflow started from the correct branch
- [ ] Quality-gate barrier passed
- [ ] `deploy.sh` completed without error

**After**
- [ ] Application responds; health endpoint OK
- [ ] Queue workers processing; scheduler running
- [ ] Error rate and logs checked for 15 minutes
- [ ] Rollback anchor recorded (previous release merge SHA)

---

## 10. Where Things Live

| | |
|---|---|
| Quality gates | `.github/workflows/quality.yml` |
| Deployment | `.github/workflows/deploy.yml` |
| Review ownership | `.github/CODEOWNERS` |
| Production stack | `docker-compose.yml` |
| Staging stack | `docker-compose.staging.yml` |
| Env contracts | `backend/.env.production.example`, `backend/.env.staging.example` |
| Deploy script | `scripts/deploy.sh` · rollback: `scripts/rollback.sh` |
