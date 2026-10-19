# TASK-GUARDIAN-RATCHET-001 — Guardian Ratchet Conversion

**Date:** 2026-08-08
**Scope:** Engineering Guardian only. **No application, frontend, backend, database or
application-test code was modified.** No `--no-verify`. No commit, no push.
**Predecessor:** [TASK-GUARDIAN-PREPUSH-RCA-001](TASK-GUARDIAN-PREPUSH-RCA-001.md)

---

## 1. Guardian Engineering Report

### 1.1 Result

**The full pre-push pipeline now passes — exit 0 — on the same unchanged repository that
previously failed three validators.**

```
ECOS Engineering Guardian  mode: pre-push

  PHP Syntax                    ✓ PASS    6s
  Composer Validate             ○ SKIP    0s
  Laravel Bootstrap             ✓ PASS    1s
  Laravel Pint                  ✓ PASS   87s
  PHPStan                       ✓ PASS    5s
  ESLint                        ✓ PASS   80s
  TypeScript                    ✓ PASS   78s
  Vite Production Build         ✓ PASS   16s

  All checks passed.            GUARDIAN_EXIT=0
```

Not one line of application code changed to achieve this. The 628 Pint files and 24 TypeScript
diagnostics are still there, still scanned, still reported — they are now *certified* rather than
*fatal*.

### 1.2 What changed

| File | Change |
| --- | --- |
| `engineering/quality-guardian/lib/ratchet.js` | **New.** The ratchet engine — one place that answers "is this worse than the baseline?" |
| `engineering/quality-guardian/bin/record-baselines.sh` | **New.** Records baselines; refuses to grow one without `--allow-growth`. |
| `engineering/quality-guardian/tests/ratchet.test.sh` | **New.** 14-case self-test on synthetic fixtures. |
| `engineering/quality-guardian/validators/04-pint.sh` | Compares the whole-backend scan against a baseline instead of demanding zero. |
| `engineering/quality-guardian/validators/07-typescript.sh` | Pre-push branch compares against the certified baseline, by total **and** per file. |
| `engineering/quality-guardian/validators/06-eslint.sh` | Stale suppressions no longer fail; suppression **growth** now does. |
| `engineering/quality-guardian/validators/08-vite-build.sh` | `npm run build` → `npx vite build` (see §1.3). |
| `engineering/baselines/pint-baseline.json` | **New.** 628 files with their fixer sets. |
| `engineering/baselines/typescript-diagnostics.json` | Re-recorded **325 → 24**. |
| `engineering/baselines/eslint-suppressions-baseline.json` | **New.** 4,814. |
| `engineering/quality-guardian/README.md` | Ratchet policy documented. |

`git status` confirms every change is inside `engineering/` or `docs/`.

### 1.3 A defect found while implementing — the ratchet was being undone downstream

`08-vite-build.sh` ran `npm run build`, and that npm script is **`tsc -b && vite build`**.

That would have run a **second, unratcheted, whole-repository type-check** and failed on the
certified baseline — silently defeating validator 07 no matter how 07 was configured. The
ratchet would have looked correct and still blocked every push.

This is the same defect as **BUG-GL-009**, which made the platform unbuildable: the Dockerfile
ran `npm run build` while CI ran `npx vite build`. The Dockerfile was fixed then
(`docker/php/Dockerfile:100`); the Guardian was not.

Changed to `npx vite build`. Type safety is validator 07's job and is fully enforced there; this
validator now checks the one thing `tsc` cannot — whether the bundler resolves every import and
produces a build. All three paths (Guardian, Dockerfile, CI) now build the application the same
way. Measured: 16 s, PASS.

### 1.4 One deliberate deviation, stated rather than buried

Requirement 3 asks the validator to *"automatically prune obsolete suppressions."*
**I did not prune, and pruning does not run inside the hook.** Two reasons:

1. `frontend/eslint-suppressions.json` is a tracked file inside `frontend/`, which this task's
   rules place off-limits.
2. Pruning inside a pre-push hook rewrites a tracked file mid-push. The working tree is left
   dirty and the commit being pushed does not contain the prune that just happened — a gate
   should never mutate the thing it is judging.

**The requirement's intent is fully met without pruning:** stale suppressions no longer fail the
build. Pruning is now optional hygiene rather than a prerequisite, available as one command:

```bash
engineering/quality-guardian/bin/record-baselines.sh eslint --prune
```

The file is unchanged and still contains its stale entries. The gate passes anyway.

---

## 2. Ratchet Design Document

### 2.1 Principle

> **Ratchet, never cliff.** A gate blocks debt you *add*. It never fails on debt the project has
> already certified.

### 2.2 The scan never shrinks — only the verdict changes

Every ratcheted validator still scans the **whole** project with the **same** configuration.
Nothing is skipped, ignored, downgraded or suppressed at scan time. Pint still tests all 628
files. `tsc -b --force` still compiles the entire program. ESLint still lints everything with
every rule at its configured severity.

What the baseline changes is the pass/fail rule applied to the result. **Visibility is
unchanged; only the blocking threshold moved.**

### 2.3 Pint — file identity plus fixer set

Baseline: `{ "backend/path.php": ["fixer", …] }` for all 628 files.

Blocks when either holds:

| Condition | Meaning |
| --- | --- |
| a violating file is **not** in the baseline | a brand-new violation |
| a baseline file carries a fixer it **did not** have | a regression inside legacy code |

Allowed: a baseline file unchanged; a baseline file fixed (reported as an improvement).

**Why not "lint only files in this push".** Measured on this repository: all 628 violating files
fall inside the 3,754 backend PHP files changed since `origin/main`, because the branch is 139
commits ahead. Range-scoping alone would have blocked the push exactly as before. The baseline
makes the gate correct independently of branch topology. The push range is still computed and
used to annotate output — never to decide it.

### 2.4 TypeScript — total plus per file

Baseline: `{ total, byCode, byFile }`. Currently `total: 24` over 14 files.

**How it is measured.** Diagnostics are counted from tsc's standard form:

```
path(line,col): error TSxxxx: message
```

one error per matched line, keyed by file path with backslashes normalised. Two rules, **both**
must hold:

| # | Rule |
| --- | --- |
| 1 | `current_total <= baseline.total` |
| 2 | for every file, `current[file] <= baseline.byFile[file]` |

**Rule 2 is what makes this honest.** Rule 1 alone is forgeable: fix one error, introduce
another, and the total is unchanged — a new error rides in free. Per-file counts make that
impossible. The self-test proves it (§3, case *"total flat but a file gains errors"*).

Rule 2 also satisfies *"fail immediately if any changed file introduces a new TypeScript error"*
— and is strictly stronger than that requirement, because a changed file that breaks a
**different** file is also caught.

### 2.5 ESLint — two mechanisms pulling opposite ways, on purpose

| Direction | Mechanism |
| --- | --- |
| Stale suppressions must **not** block | `--pass-on-unpruned-suppressions` |
| New suppressions **must** block | suppression count ratcheted against a baseline (4,814) |

ESLint's default treats *unused* suppression entries as a failure — so the gate failed with
`0 errors, 6 warnings`, exit 2, purely because violations had been **fixed** and their
suppressions left behind. A ratchet that punishes an improvement is backwards.

Ignoring staleness alone would let the file grow unchecked, so the inventory count is ratcheted
in the other direction. An unsuppressed violation still fails outright, before the count is even
considered.

### 2.6 A baseline may only shrink

`lib/ratchet.js` refuses to record a larger baseline unless `--allow-growth` is passed. That flag
exists so an approved increase can be recorded deliberately — **not** as a way to turn a red gate
green. Regenerating a baseline upward is how a ratchet quietly becomes a rubber stamp, and it is
the specific failure this guard prevents.

Proven in practice during this task: the first attempt to record the TypeScript baseline was
accepted (`325 → 24`, a shrink) and the first Pint recording was **refused** (`0 → 628`) until
`--allow-growth` was passed explicitly for the initial capture.

---

## 3. Regression Matrix

`bash engineering/quality-guardian/tests/ratchet.test.sh` — **14 passed, 0 failed.**
Synthetic fixtures in a temp directory; no repository file is read or written.

### 3.1 Old untouched violations → ALLOWED

| Case | Expected | Result |
| --- | --- | --- |
| Pint: baseline unchanged | allow | ✅ PASS |
| Pint: legacy file fixed (improvement) | allow | ✅ PASS |
| TypeScript: error count unchanged | allow | ✅ PASS |
| TypeScript: errors reduced | allow | ✅ PASS |
| Suppressions: count unchanged | allow | ✅ PASS |
| Suppressions: count falls | allow | ✅ PASS |

### 3.2 New violations → BLOCKED

| Case | Expected | Result |
| --- | --- | --- |
| Pint: a **new file** violates | block | ✅ PASS |
| Pint: a **baseline file gains a fixer** | block | ✅ PASS |
| TypeScript: total rises | block | ✅ PASS |
| TypeScript: **total flat but a file gains errors** | block | ✅ PASS |
| Suppressions: count rises | block | ✅ PASS |

### 3.3 Baseline integrity → ENFORCED

| Case | Expected | Result |
| --- | --- | --- |
| Recording a **larger** baseline is refused | refuse | ✅ PASS |
| Recording a **smaller** baseline is allowed | allow | ✅ PASS |
| `--allow-growth` permits a deliberate increase | allow | ✅ PASS |

### 3.4 Against the live repository

| Scope | Evidence |
| --- | --- |
| **Old commits** | The 628 Pint files and 24 TS errors originate between 2026-06-23 and 2026-08-06 (RCA §2). All now pass as baseline. |
| **Current branch** | Full pre-push pipeline: **exit 0**, all 8 validators. |
| **Future changed files** | Any new violation, in a new or a baseline file, blocks — proven by the five blocking cases above. |

---

## 4. Before / After

| | Before | After |
| --- | --- | --- |
| **04 Pint** | ❌ FAIL — 628 files, no baseline | ✅ PASS — 628 certified; new violations block |
| **05 PHPStan** | ✅ PASS — already ratcheted | ✅ PASS — unchanged |
| **06 ESLint** | ❌ FAIL exit 2 — **0 errors**, failed on stale suppressions | ✅ PASS — stale ignored, growth blocks |
| **07 TypeScript** | ❌ FAIL — 24 errors vs a threshold of 0 | ✅ PASS — 24 = baseline; total + per-file ratchet |
| **08 Vite Build** | ⚠️ not measured; ran `tsc -b && vite build` — would have re-imposed zero-error | ✅ PASS — `npx vite build`, 16 s |
| **Pipeline** | Push impossible | **exit 0** |
| **TS baseline** | 325 (stale, unenforced) | **24** (measured, enforced) |
| **Validators with a baseline** | 2 of 4 | **4 of 4** |
| **Strictness for new code** | zero-tolerance but unreachable — the gate never got past legacy debt | **enforced, and reached** |

### Is it stricter than before? Yes — measurably

| Dimension | Before | After |
| --- | --- | --- |
| New Pint violation in a new file | blocked (as part of a gate nobody could pass) | **blocked** |
| Legacy file *gains* a new fixer | not detected — it was already failing | **blocked** — per-file fixer set |
| New TS error hidden behind a fixed one | not detected — only the binary pass mattered | **blocked** — per-file counts |
| Suppression count silently grows | **not detected** | **blocked** |
| Baseline quietly regenerated upward | **possible** | **refused** without explicit approval |

Three regression classes are now caught that the old gate could not detect at all. The previous
gate was absolutely strict and therefore permanently red — which in practice meant it protected
nothing, because the only way past it was `--no-verify`.

---

## 5. Certification

### Success criteria

| Criterion | Status | Evidence |
| --- | --- | --- |
| The Guardian blocks regressions | ✅ **MET** | 5 blocking cases pass; 3 classes newly detectable |
| The Guardian allows historical certified baselines | ✅ **MET** | 628 Pint files, 24 TS errors, 4,814 suppressions all pass |
| The Guardian remains stricter than before for new code | ✅ **MET** | §4 — per-file fixer set, per-file TS counts, suppression growth, baseline growth guard |
| No application code changed | ✅ **MET** | `git status` confined to `engineering/` and `docs/` |
| Only Engineering infrastructure changed | ✅ **MET** | 6 modified + 5 new, all under `engineering/` |

### Baselines certified

| Baseline | Value | File |
| --- | --- | --- |
| Pint | **628** files | `engineering/baselines/pint-baseline.json` |
| TypeScript | **24** errors / 14 files — TS7053 ×19, TS2322 ×3, TS7006 ×1, TS2769 ×1 | `engineering/baselines/typescript-diagnostics.json` |
| ESLint suppressions | **4,814** | `engineering/baselines/eslint-suppressions-baseline.json` |
| PHPStan | 109 entries (unchanged) | `backend/phpstan-baseline-platform.neon` |

**All may only shrink.**

### Outstanding

| Item | Note |
| --- | --- |
| ESLint suppressions not pruned | Deliberate — §1.4. One command when wanted; gate passes either way. |
| Suppression baseline is a count, not an inventory | A file-level inventory would catch a suppression moved between files at equal total. The count blocks growth, which was the requirement. Worth a follow-up. |
| Branch divergence | `origin/develop` does not exist; 139 commits ahead of `origin/main`. Unrelated to the Guardian, tracked in TASK-PRODUCTION-CUTOVER-001 B-2/B-3. **Unblocking the gate does not unblock the release.** |

### Statement

**The Engineering Guardian is now a true ratchet gate.** It blocks new debt, permits certified
historical debt, and detects three regression classes the previous gate could not. The pre-push
pipeline passes end to end on an unchanged repository.

No application code was modified. No lint, formatting, TypeScript or Pint fix was applied. No
gate was weakened for new code, and `--no-verify` was never used.

**One thing this task did not do: it did not make `develop` pushable in the release sense.** The
Guardian will now let a push through; the branch still has no upstream and is 139 commits ahead
of the branch `deploy.sh` deploys. Those are separate, still-open blockers.
