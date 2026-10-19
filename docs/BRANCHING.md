# Repository Branch Policy & Governance

**Status:** ACTIVE — established 2026-08-07 by **TASK-POST-INTEGRATION-001**
**Supersedes:** the two-parallel-stream model (Finance/Executive on
`platform-foundation`, everything else on `develop`).

---

## 1. Development Branch Policy

`develop` is the **single, authoritative, active development branch**. All future
work — features, fixes, chores, refactors, docs — targets `develop` **only**.

| Branch | Role | Rule |
|---|---|---|
| **`develop`** | **Active engineering line.** Deploys to Staging (`.github/workflows/deploy.yml`). | Branch all new work from here; open PRs into here. |
| `main` | Release / production line. | Protected. Promoted from `develop` via release process only. |
| `staging` | Pre-production validation. | Promoted from `develop`. |
| `platform-foundation` | **ARCHIVED** (see §2). | No new commits. Do not branch from it. |

Branch naming: `feat/…`, `fix/…`, `chore/…`, `docs/…`, `refactor/…` off `develop`.

CI already reflects this: `quality.yml` runs on `[main, develop, staging]` and
documents *"develop is the active engineering branch (TASK-DEVOPS-001)"*. No
workflow references `platform-foundation`.

---

## 2. Archived Branch — `platform-foundation`

`platform-foundation` was merged into `develop` on **2026-08-07** (merge commit
**`a8488818`**, TASK-PLATFORM-INTEGRATION-001). It is now **fully merged** (0
unique commits) and carries the completed **Finance UI** (EPIC-FINANCE-UI-001)
and **Executive UI** (EPIC-EXECUTIVE-UI-001), both now living on `develop`.

**Archival rules — `platform-foundation` is reference-only:**
- ❌ No new commits.
- ❌ No new features.
- ❌ No fixes.
- ❌ No branching from it.
- ✅ Retained, unmodified, for historical reference until **Global Go-Live Certification**.

The repository is structurally unified: Finance UI and Executive UI are integrated;
`develop` is the one line.

---

## 3. Temporary Recovery Assets — RETAIN (do NOT delete yet)

These exist only as recovery insurance through the integration window. **Retain
until Global Go-Live Certification.** Do not delete before then.

| Asset | Location | Notes |
|---|---|---|
| `platform-foundation` branch | ref `f4b427ed` | Fully merged into `develop`; archival checkpoint. |
| `stash@{0}` | `presync-platform-foundation-full-worktree` | Pre-sync full worktree (superseded Finance backend + old baseline). |
| `stash@{1}`, `stash@{2}` | on `main` | Older, unrelated WIP; owner to review separately. |
| Agent worktrees | `.claude/worktrees/agent-*` (5) + 2 detached | Stale AI-agent isolation worktrees. |
| `worktree-agent-*` branches | 5 branches | Created by agent worktrees. |
| `C:\ecos-bt` worktree | on `main` | Secondary `main` checkout; verify with owner before any action. |
| Scratchpad backups | session scratchpad `…/scratchpad/presync-ref`, `presync-unique`, `msg*.txt`, `merge-msg.txt` | Session-isolated temp files, outside the repo. |

---

## 4. Cleanup Checklist — execute ONLY AFTER Global Go-Live Certification

> ⛔ **Nothing in this checklist is executed now.** This is a documented plan for
> post-certification. Each item requires explicit sign-off before execution.

- [ ] **`platform-foundation` branch** — confirm still 0 unique commits vs `develop`
      (`git log --oneline develop..platform-foundation`), then
      `git branch -d platform-foundation` (safe delete; refuses if unmerged).
- [ ] **Obsolete agent worktrees** — for each `.claude/worktrees/agent-*` and the
      2 detached worktrees: confirm inactive, then `git worktree remove <path>`,
      then `git worktree prune`.
- [ ] **`worktree-agent-*` branches** — after their worktrees are removed and
      confirmed merged/obsolete, delete each branch.
- [ ] **Temporary stashes** — `stash@{0}` (presync) once no longer needed;
      review `stash@{1}`/`stash@{2}` with their owner before dropping.
- [ ] **Temporary scratchpad files** — delete `presync-ref/`, `presync-unique/`,
      `msg*.txt`, `merge-msg.txt` from the session scratchpad.
- [ ] **Temporary merge backups** — remove any merge-message/backup files retained
      for the integration.
- [ ] **`C:\ecos-bt` worktree** — verify with the repository owner whether the
      secondary `main` checkout is still required; remove only with sign-off.

---

## 5. Known Follow-ups (not part of this governance task)

These require code/backend changes and are **out of scope** for repository
governance; they are recorded here for tracking:

- **Stale comment** in `frontend/src/config/module-navigation.ts` (finance module
  block) still says the finance UI "lives on `platform-foundation`" — the
  pre-merge state. Not a directive; update in a future code task.
- **5 backend test failures** in `tests/Feature/Finance/FinancialIntegrationTest.php`
  (GoodsReceipt→Finance posting path) — pre-existing on `develop`, unrelated to the
  integration. Tracked separately.

---

*Governance record — TASK-POST-INTEGRATION-001. See also the merge certification
(TASK-PLATFORM-INTEGRATION-001, merge commit `a8488818`).*
