# ECOS Engineering Guardian

Prevents broken code from entering the repository by running a quality pipeline
before every commit and push.

## Install

```bash
bash engineering/quality-guardian/setup.sh
```

This copies the pre-commit and pre-push hooks into `.git/hooks/`. Re-running is
safe — existing hooks are backed up before being replaced.

## Run manually

```bash
# Fast pre-commit checks only (~30s)
bash engineering/quality-guardian/guardian.sh pre-commit

# Full pipeline without Docker (~2min)
bash engineering/quality-guardian/guardian.sh pre-push

# Full pipeline including Docker build (~10min)
bash engineering/quality-guardian/guardian.sh full
```

## Validator pipeline

| # | Name | pre-commit | pre-push | ci/full |
|---|------|:---:|:---:|:---:|
| 01 | PHP Syntax | ✓ | ✓ | ✓ |
| 02 | Composer Validate | ✓ | ✓ | ✓ |
| 03 | Laravel Bootstrap | — | ✓ | ✓ |
| 04 | Laravel Pint | — | ✓ | ✓ |
| 05 | PHPStan | — | ✓ | ✓ |
| 06 | ESLint | ✓ | ✓ | ✓ |
| 07 | TypeScript | ✓ | ✓ | ✓ |
| 08 | Vite Production Build | — | ✓ | ✓ |
| 09 | Docker Build | — | — | ✓ |

### Exit codes for each validator

| Code | Meaning |
|------|---------|
| `0` | PASS |
| `1` | FAIL — guardian blocks commit/push |
| `2` | SKIP — required tool not installed or precondition not met |

SKIP never blocks a commit. Fix the precondition (install PHP, run `npm install`,
create `.env`) to promote a SKIP to an active check.

## The ratchet policy

**Ratchet, never cliff.** A gate blocks debt you *add*. It never fails on debt the
project has already certified and agreed to carry.

This is policy, not preference. Three earlier gates in this project were abandoned
for ignoring it, and a fourth — pre-push Pint and TypeScript — was blocking every
push on 628 legacy files and 24 historical diagnostics that the commits being
pushed had not touched. The full analysis is in
`docs/verification/TASK-GUARDIAN-PREPUSH-RCA-001.md`.

### Which validators ratchet, and against what

| Validator | Baseline | Blocks when |
|---|---|---|
| 04 Pint | `engineering/baselines/pint-baseline.json` | a **changed** file violates and is **not** in the baseline, or a **changed** baseline file gains a fixer it did not have |
| 05 PHPStan | `backend/phpstan-baseline-platform.neon` | a new analysis error appears |
| 06 ESLint | `frontend/eslint-suppressions.json` + `engineering/baselines/eslint-suppressions-baseline.json` | an unsuppressed violation appears, **or** the suppression count grows |
| 07 TypeScript | `engineering/baselines/typescript-diagnostics.json` | the total rises, **or** any single file gains errors |

Validators 01, 02, 03, 08 and 09 are pass/fail — there is no debt to carry.

### The scan never shrinks, only the verdict changes

Every ratcheted validator still scans the **whole** project with the **same**
configuration. Nothing is skipped, ignored, downgraded or suppressed at scan time.
What the baseline changes is the pass/fail rule applied to the result.

### Pint scope — the merge-base algorithm

Pint scans **only the PHP files in the current push**, so an untouched legacy
file cannot fail the gate — it is never handed to Pint at all.

1. **Resolve the merge base**, first match wins:
   `$GUARDIAN_PUSH_RANGE` → `merge-base @{upstream} HEAD` → `merge-base origin/HEAD HEAD`
   → none (fall back to a whole-backend scan with the same verdict rule).
2. **Collect changed files:** `git diff --name-only --diff-filter=ACMR <base>...HEAD -- '*.php'`.
   Three-dot resolves through the merge base, so commits on the *target* branch are
   never attributed to this push. Deletions are excluded; missing files are dropped.
   Empty set → PASS.
3. **Scan that list only**, batched at 150 paths to stay inside the OS argument
   limit. The scan is verified complete — a partial scan **fails** rather than
   reporting a result, because an under-scan is indistinguishable from a clean one.
4. **Classify** each violation against the baseline (table above).

**Why step 4 is still needed.** Measured here: 3,688 PHP files changed since
`origin/main` and **all 628 violating files are inside that set**, because the
branch is 139 commits ahead. Scoping alone would block the push exactly as the old
gate did. The baseline is what separates *"you touched a file that was already
messy"* from *"you made it worse"* — which is the actual requirement: a modified
file fails on a style **regression**, not on inherited debt.

### Why per-file counts, not just totals

A total on its own is forgeable: fix one error, introduce another, and the count is
unchanged. So TypeScript compares per-file counts as well as the total, and Pint
compares the per-file fixer set. A file that gains a problem blocks even when the
project-wide number falls.

### A baseline may only shrink

`lib/ratchet.js` refuses to record a larger baseline unless `--allow-growth` is
passed. That flag exists so an approved increase can be recorded deliberately — it
is **not** a way to turn a red gate green. Regenerating a baseline upward is how a
ratchet quietly becomes a rubber stamp.

```bash
# Re-record after genuinely reducing debt (the diff should always be smaller)
engineering/quality-guardian/bin/record-baselines.sh            # all
engineering/quality-guardian/bin/record-baselines.sh typescript # one
engineering/quality-guardian/bin/record-baselines.sh eslint --prune
```

### ESLint suppressions

Stale suppressions — entries for violations that no longer occur — **do not fail
the build**. ESLint's own default is to fail on them, which meant the gate broke
because debt had been *removed*. Adding a suppression still fails, because the
inventory count is ratcheted.

Prune stale entries when convenient:

```bash
engineering/quality-guardian/bin/record-baselines.sh eslint --prune
```

Pruning is deliberately **not** automatic inside the hook: it rewrites a tracked
file, which would leave your working tree dirty mid-push and push a commit that
does not contain the prune it just performed.

### Self-test

```bash
bash engineering/quality-guardian/tests/ratchet.test.sh
```

14 cases over synthetic fixtures, proving old violations are allowed and new ones
are blocked. Touches no repository file.

## Prerequisites

| Tool | Required for | Install |
|------|-------------|---------|
| PHP 8.4+ | Validators 01–05 | `winget install PHP.PHP` or system package manager |
| Composer | Validator 02 | https://getcomposer.org |
| `backend/.env` | Validators 03, 05 | `cp backend/.env.example backend/.env` then configure |
| Node.js 22+ | Validators 06–08 | https://nodejs.org |
| `frontend/node_modules` | Validators 06–08 | `cd frontend && npm install` |
| Docker Desktop | Validator 09 | https://docs.docker.com/desktop/ |

Validators 01–05 also require `composer install` to have been run inside `backend/`
(they use `backend/vendor/bin/pint` and `backend/vendor/bin/phpstan`).

## Bypass (emergency only)

```bash
git commit --no-verify   # skip pre-commit
git push --no-verify     # skip pre-push
```

Bypasses must be justified in the commit message or PR description.

## Add a new validator

1. Create `validators/NN-name.sh` with `# NAME: Display Name` on the second line
2. Exit `0` (pass), `1` (fail), or `2` (skip)
3. Add `NN-name` to the appropriate mode arrays in `guardian.sh`

## Override paths

```bash
export GUARDIAN_BACKEND_DIR=/custom/path/to/backend
export GUARDIAN_FRONTEND_DIR=/custom/path/to/frontend
export GUARDIAN_COMPOSE_FILE=/custom/docker-compose.yml
bash engineering/quality-guardian/guardian.sh full
```

## Disable colors

```bash
NO_COLOR=1 bash engineering/quality-guardian/guardian.sh pre-commit
```
