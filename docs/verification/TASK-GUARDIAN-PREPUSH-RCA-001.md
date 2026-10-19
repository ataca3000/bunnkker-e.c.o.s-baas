# TASK-GUARDIAN-PREPUSH-RCA-001 — Guardian Pre-Push Root Cause Analysis

**Date:** 2026-08-08
**Type:** Investigation only. **No code, formatting, lint or TypeScript change was made. No
commit. No push. The Guardian was not modified or bypassed.**
**Branch:** `develop` @ `ba5e5914` (worktree `/c/ecos-develop`)

---

## 1. Guardian Root Cause Analysis

### 1.1 Verdict

**The repository is not the problem. The gate is.**

Four quality validators run at pre-push. **Two have a baseline and pass. Two have no baseline and
fail.** Everything they fail on pre-dates the commits being pushed.

| Validator | Baseline mechanism | Exit | Result |
| --- | --- | --- | --- |
| 01-php-syntax | n/a | 0 | ✅ PASS |
| 02-composer | n/a | 2 | ⏭ SKIP (`composer` not in PATH) |
| 03-laravel | n/a | 0 | ✅ PASS |
| **04-pint** | **none** | 1 | ❌ **FAIL — 628 files** |
| 05-phpstan | `phpstan-baseline-platform.neon` (109 entries) | 0 | ✅ **PASS — "No errors"** |
| **06-eslint** | `eslint-suppressions.json` (4,814) | 2 | ❌ **FAIL — 0 errors, 6 warnings** |
| **07-typescript** | **none** | 1 | ❌ **FAIL — 24 errors** |
| 08-vite-build | n/a | *not run* | ⚠️ not measured — see §1.4 |

The correlation is exact: **every validator with a working baseline passes; every validator
without one fails.** That is a property of the gate's configuration, not of the code.

### 1.2 The three failures

**04-Pint — 628 files.** The validator is four effective lines:

```bash
cd "$BACKEND"
php vendor/bin/pint --test 2>&1
```

Whole-backend, no scoping to changed files, no baseline, no allow-list. Any style deviation
anywhere in `backend/` blocks every push. The violations are systemic formatting conventions:
`binary_operator_spaces` (277 files), `braces_position` (263), `single_line_empty_body` (190),
`trailing_comma_in_multiline` (175). **62 files are flagged for `line_ending` alone** — CRLF
residue from before `.gitattributes` was introduced.

**07-TypeScript — 24 errors in 14 files.** In pre-push mode the validator reduces to:

```bash
"$TSC" -b --force 2>&1 || exit 1
```

No baseline, no comparison, no tolerance. It demands **zero** TypeScript errors repo-wide.
Measured: exit 2 (DiagnosticsPresent), 24 errors, 89 s wall time. Codes: TS7053 ×19, TS2322 ×3,
TS7006 ×1, TS2769 ×1.

**06-ESLint — fails with zero errors.** This one is worth stating carefully because it is
counter-intuitive:

```
✖ 6 problems (0 errors, 6 warnings)
There are suppressions left that do not occur anymore.
ESLINT REAL EXIT = 2
```

ESLint's bulk-suppression ratchet is working — no new violations. It fails because
`eslint-suppressions.json` contains entries for violations **that no longer exist**. Under ESLint
9, unused suppressions are themselves a failure unless `--pass-on-unpruned-suppressions` is
passed.

**The ratchet is failing because the debt got smaller.** Someone fixed lint violations without
pruning the suppressions file, and the gate now punishes the improvement. This is the exact
inverse of what a ratchet is for.

> Measurement note: a first attempt read `$?` after a pipe into `tail`, which reports `tail`'s
> status and made ESLint look like a pass. The exit code above was re-measured without the pipe.

### 1.3 Why this is not a stale-hook or worktree problem

Both were checked and excluded:

- The installed hooks (`C:/Projects/ECOS-ERP/.git/hooks/`, shared across worktrees) are
  byte-identical to `engineering/quality-guardian/hooks/` apart from line endings.
- The hook resolves `GUARDIAN_DIR` relative to itself, which lands in the **main** checkout —
  currently on branch `platform-foundation`. That would be a real bug, **but it was already
  fixed**: `guardian.sh:36` derives `PROJECT_ROOT` from `git rev-parse --show-toplevel`, and
  line 26 documents precisely this hazard. The correct tree is validated.
- `guardian.sh` is identical between the two checkouts.

### 1.4 One validator not measured

**08-vite-build was deliberately not run.** It writes build output into the working tree, and the
task forbids modifying the repository. Its status is therefore unknown and is not claimed either
way. It does not affect the conclusion: three validators already fail before it would run.

---

## 2. Baseline Comparison

### 2.1 Laravel Pint — old issue vs introduced

**Every one of the 628 reported files is an OLD issue. Zero were introduced by the latest commit.**

| Attribution | Files |
| --- | --- |
| Introduced by latest commit (`ba5e5914`) | **0** |
| Introduced by previous commit (`6b02af60`) | **0** |
| Pre-existing | **628** |
| Untracked | 0 |

Proven two independent ways:

**(a) The recent commits cannot have caused it.** `ba5e5914` changes three `.md` files and
nothing else. `6b02af60` touches exactly one backend PHP file —
`backend/app/Http/Controllers/Infrastructure/HealthController.php` — and an exact-match search of
the Pint failure list shows **it is not flagged**. The file the sprint's only backend commit
changed is Pint-clean.

**(b) The violations pre-date the commits that last touched the files.** 455 flagged files were
last touched during the 2026-08 sprint. For 87 of them a parent-commit version could be
extracted; each was written to a scratch tree and Pint-tested as it existed *before* that commit:

```
pint on PRE-SPRINT versions : fail
still flagged at parent     : 87 of 87  (100%)
```

Every sampled file was already violating Pint before the sprint touched it. **Not one violation
in the sample was introduced by sprint work.**

### 2.2 TypeScript — file, introducing commit, status

**No TypeScript file has been modified in the last three commits** — `git show --name-only HEAD
HEAD~1 HEAD~2 | grep -cE '\.(ts|tsx)$'` returns **0**. It is therefore not merely unlikely but
*impossible* for these commits to have introduced a TypeScript error.

| File | Last-touching commit | Date | Status |
| --- | --- | --- | --- |
| `brand-configuration-page.tsx` | `6cb3988f` | 2026-08-03 | PRE-EXISTING |
| `configuration-os-page.tsx` | `6cb3988f` | 2026-08-03 | PRE-EXISTING |
| `business-accounts-page.tsx` | `f9af6f38` | 2026-08-06 | PRE-EXISTING |
| `AIEngineeringWorkspacePage.tsx` | `8ef069f7` | 2026-08-03 | PRE-EXISTING |
| `compensation-explainability-page.tsx` | `571a1af1` | 2026-08-01 | PRE-EXISTING |
| `exit-management-page.tsx` | `571a1af1` | 2026-08-01 | PRE-EXISTING |
| `offers-workspace-page.tsx` | `571a1af1` | 2026-08-01 | PRE-EXISTING |
| `dispatch-conflicts-panel.tsx` | `6cb3988f` | 2026-08-03 | PRE-EXISTING |
| `automation-dashboard-page.tsx` | `6cb3988f` | 2026-08-03 | PRE-EXISTING |
| `automation-workspace-page.tsx` | `6cb3988f` | 2026-08-03 | PRE-EXISTING |
| `connection-status-badge.tsx` | `6cb3988f` | 2026-08-03 | PRE-EXISTING |
| `manual-order-form.tsx` | `6cb3988f` | 2026-08-03 | PRE-EXISTING |
| `order-reservation-cell.tsx` | `6cb3988f` | 2026-08-03 | PRE-EXISTING |
| `movement-type-badge.tsx` | `062bcd97` | 2026-06-23 | PRE-EXISTING |

**14 files · 24 errors · 0 introduced by the commits being pushed.** The oldest dates to
2026-06-23; the most recent touch is 2026-08-06 — two days before the commits under test.

---

## 3. Historical Validation

### 3.1 Does current Guardian behaviour contradict previous reports? **Yes — directly.**

| Source | Recorded baseline | Pre-push demands |
| --- | --- | --- |
| `engineering/baselines/typescript-diagnostics.json` | **325** diagnostics | **0** |
| `engineering/baselines/typecheck.jsonl` | 1,631 errors (P0 cold reference) | **0** |
| GO-LIVE-CERTIFICATION-001 §10 | TypeScript baseline **325**; ESLint **4,814** suppressions | **0** |
| `phpstan-baseline-platform.neon` | 109 entries — *honoured* | honoured ✅ |
| `eslint-suppressions.json` | 4,814 — *honoured for new violations* | honoured, but fails on stale entries |

The project has repeatedly and formally certified a **non-zero** TypeScript baseline. Every
engineering report in this sprint treated 325 as the frozen figure that "may only shrink."
Pre-push honours none of it.

### 3.2 The repository has *improved*, and the gate still blocks

Measured today: **24** TypeScript errors against a certified baseline of **325**. The codebase is
roughly **93% better** than the figure the project certified — and the gate fails it anyway,
because its threshold is zero rather than the baseline.

The same is true of ESLint, more sharply: it fails *because* violations were fixed and their
suppressions left behind.

### 3.3 Against the project's own stated principle

The engineering standard recorded for this project is *"ratchet, never cliff"* — a gate must
block **new** debt without failing on the approved baseline, with the note that **three previous
gates were abandoned for ignoring exactly this**. Pre-push Pint and pre-push TypeScript are
cliffs. This is the fourth instance of the same failure mode.

---

## 4. Why commit succeeds while push fails

Two independent differences, both in `guardian.sh:46-56`:

```bash
pre-commit)  VALIDATORS=(01-php-syntax 02-composer 06-eslint 07-typescript)
pre-push)    VALIDATORS=(01-php-syntax 02-composer 03-laravel 04-pint \
                         05-phpstan 06-eslint 07-typescript 08-vite-build)
```

**Difference 1 — pre-push runs four extra validators.** `03-laravel`, **`04-pint`**, `05-phpstan`
and `08-vite-build` never run at commit time. **Pint is not a commit-time check at all**, so 628
pre-existing violations are invisible until push.

**Difference 2 — scope flips from staged to whole-repository.** `06-eslint` and `07-typescript`
are mode-aware. At pre-commit they check only staged files; at pre-push they check everything:

| Validator | pre-commit | pre-push |
| --- | --- | --- |
| 06-eslint | staged files only | `npm run lint` — whole repo |
| 07-typescript | temp tsconfig scoped to staged files; fails only if a **staged** file has a diagnostic | `tsc -b --force` — whole repo, must be **clean** |

**Applied to the actual commits.** `6b02af60` staged one `.php` file and some `.md`; `ba5e5914`
staged only `.md`. No frontend TS was staged, so both mode-aware validators returned exit 2
(SKIP), and Pint never ran. The observed commit output was:

```
PHP Syntax          ✓ PASS
Composer Validate   ○ SKIP
ESLint              ○ SKIP
TypeScript          ○ SKIP
All checks passed.
```

At push, the same unchanged repository is measured whole, and the 628 + 24 + stale-suppression
debt surfaces at once.

**The commit did not "sneak past" anything.** It genuinely introduced no defect. Push fails on
debt those commits neither created nor touched.

---

## 5. Classification

## **B — Guardian configuration issue**

| Option | Verdict | Evidence |
| --- | --- | --- |
| A — Repository quality issue | ❌ Rejected | Quality has *improved*: 24 errors vs a certified 325 baseline. PHPStan reports "No errors". ESLint has 0 errors. |
| **B — Guardian configuration issue** | ✅ **Confirmed** | 2 of 4 quality validators honour a baseline and pass; the 2 without one fail. Same repository, same run. The discriminator is the gate's configuration. |
| C — Develop branch divergence | ❌ Rejected as cause | `develop` is 139 commits ahead of `origin/main` and `origin/develop` has never existed — a real release-management problem (TASK-PRODUCTION-CUTOVER-001 B-2/B-3), but unrelated. The failures are local file contents, not branch topology. |
| D — Recent regression | ❌ Rejected | 0 of 628 Pint files and 0 of 24 TS errors were introduced by the last 3 commits; 87/87 sampled violations pre-date their own commit; 0 TS files touched at all. |
| E — Expected design | ⚠️ **Partly true, and that is the problem** | The validator header states pre-push is *"clean, whole-repository … (unchanged)"*, so the behaviour is intentional. But the intent was never reconciled with the project's certified baselines or its own ratchet policy. **Intentional and wrong are not mutually exclusive.** |

**Conclusion: the behaviour is intentional in the validator and unintentional at project level.**
It contradicts every published baseline and the documented ratchet principle, and it is
internally inconsistent — PHPStan is allowed a 109-entry baseline while TypeScript is allowed
none, with no recorded rationale for the difference.

---

## 6. Recommended Resolution

**The Guardian was not modified, per the task rules.** What follows is a proposal only.

### 6.1 Exact root cause

> Pre-push enforces an absolute zero-defect threshold for Laravel Pint and TypeScript, while the
> project's certified quality model is a **baseline ratchet**. PHPStan and ESLint already
> implement that ratchet and pass. Pint and TypeScript have no baseline, so they fail on
> pre-existing debt that the commits under push neither introduced nor touched. Separately,
> ESLint fails on *stale* suppression entries — the ratchet penalising a reduction in debt.

### 6.2 Minimal safe correction

Three changes, each small, each preserving or increasing strictness for **new** debt.

**(1) `engineering/quality-guardian/validators/04-pint.sh` — scope to changed files.**
Pint against the push range rather than the whole backend, so new code must be clean while the
628-file legacy set is not a gate:

```bash
mapfile -t CHANGED < <(git diff --name-only origin/main...HEAD -- 'backend/**/*.php')
[[ ${#CHANGED[@]} -eq 0 ]] && exit 0
php vendor/bin/pint --test "${CHANGED[@]}"
```

*Preferred alternative if a frozen list is wanted instead:* commit a
`engineering/baselines/pint-baseline.txt` of the 628 paths and fail only on files outside it.
Scoping to changed files is simpler and self-maintaining.

**(2) `07-typescript.sh` — compare against the recorded baseline instead of zero.**
Keep `tsc -b --force`, count the diagnostics, and fail only if the count **exceeds** the
baseline in `engineering/baselines/typescript-diagnostics.json`. The baseline may only shrink,
and should be re-recorded downward from 325 to the measured 24.

**(3) `eslint-suppressions.json` — prune it.**
Run `npx eslint . --prune-suppressions` once and commit the result. This removes only entries for
violations that no longer occur; it cannot hide a live violation. Do **not** adopt
`--pass-on-unpruned-suppressions` as the fix — that would permanently mask suppression drift.

### 6.3 Risks

| Change | Risk | Mitigation |
| --- | --- | --- |
| Pint scoped to changed files | A legacy file edited for one line must be fully reformatted, producing large diffs | Accept — it is how the debt shrinks; or scope to changed *hunks* |
| Pint scoped to changed files | Depends on a correct merge base; `origin/main` is 139 commits behind, so today the range is effectively the whole branch | **Resolve the branch divergence first** — otherwise this change under-protects |
| TypeScript baseline | A new error can hide behind a fixed one at equal count | Low: count-based ratchets are standard here (PHPStan, ESLint) and the count only moves down |
| TypeScript baseline | Baseline drifts upward if regenerated carelessly | Enforce the existing rule: **never regenerate, only shrink** |
| Pruning suppressions | None to correctness — prune only removes unused entries | Verify `npm run lint` exits 0 afterwards |
| All | Weakening a gate before go-live | None of the three reduces strictness for new code; PHPStan, php-syntax, laravel and vite-build are untouched |

### 6.4 Files affected

| File | Change |
| --- | --- |
| `engineering/quality-guardian/validators/04-pint.sh` | Scope to changed files (or add a baseline) |
| `engineering/quality-guardian/validators/07-typescript.sh` | Compare count to baseline in the pre-push branch |
| `engineering/baselines/typescript-diagnostics.json` | Re-record **325 → 24** |
| `frontend/eslint-suppressions.json` | Prune stale entries |
| *(optional)* `engineering/baselines/pint-baseline.txt` | New, if the frozen-list option is chosen |

**No application code. No formatting change. No TypeScript fix. No PHPStan or vite-build change.**

### 6.5 Would every previous push in this sprint have been blocked for the same reason?

**Yes — and no push in this sprint has ever succeeded.**

```
origin/develop            : does not exist — develop has never been pushed
unpushed commits          : 139
last remote interaction   : 2026-07-22 (FETCH_HEAD)
```

The blocking conditions pre-date the sprint entirely: the TypeScript error files were last
touched between 2026-06-23 and 2026-08-06, and 87 of 87 sampled Pint violations already existed
at their commit's parent. **Any push attempted at any point during this sprint would have failed
on the same three validators, for the same pre-existing reasons.** This is not a new
obstruction — it is a long-standing one that only becomes visible at push time, and `develop` has
simply never reached that point before.

---

## 7. GO / NO-GO for pushing `develop`

## NO-GO — as a Guardian pass. GO — as an engineering judgement, once the gate is corrected.

Both halves matter, so both are stated:

**NO-GO on the gate.** `git push` will fail today at 04-pint, 06-eslint and 07-typescript.
Nothing about the branch content causes that, but the gate is the gate, and **it must not be
bypassed.** `--no-verify` would suppress a signal that is currently telling the truth about
suppression drift, and the task forbids it regardless.

**GO on the code.** The push is blocked by no defect attributable to it:

- 0 of 628 Pint violations introduced by the commits being pushed
- 0 of 24 TypeScript errors introduced — 0 TypeScript files touched at all
- ESLint: **0 errors**
- PHPStan: **"No errors"**
- TypeScript is **93% better** than the certified 325 baseline

### Required sequence

1. **Prune `eslint-suppressions.json`** — smallest change, removes one of three blockers, zero risk.
2. **Re-record the TypeScript baseline 325 → 24** and make `07-typescript` compare to it.
3. **Scope Pint to changed files**, or add a `pint-baseline.txt`.
4. **Resolve the branch divergence first if Pint is scoped by merge base** — `origin/main` is 139
   commits behind, so the range would otherwise cover the entire branch and the change would not
   help. This is the same B-3 blocker recorded in TASK-PRODUCTION-CUTOVER-001.
5. Re-run `guardian.sh pre-push` and confirm a clean pass, **including 08-vite-build**, which this
   investigation did not measure.

**Do not push until the gate passes honestly.** The correct fix is to make the gate measure what
the project actually certified — not to lower the bar, and not to step around it.

---

## Appendix — Evidence and method

| Measurement | Command | Result |
| --- | --- | --- |
| Pint | `php vendor/bin/pint --test` | fail · 628 files |
| Pint attribution | `git log -1 --` per flagged file | 628 OLD · 0 recent |
| Pint historical | extract `sha^:file` → scratch tree → `pint --test` | 87/87 pre-existing |
| TypeScript | `tsc -b --force` | exit 2 · 24 errors · 89 s |
| TS attribution | `git log -1 --` per error file | 14/14 pre-existing |
| TS files in recent commits | `git show --name-only HEAD HEAD~1 HEAD~2` | **0** |
| ESLint | `npm run lint` | **exit 2** · 0 errors · 6 warnings · stale suppressions |
| PHPStan | `phpstan analyse` | **exit 0** · "No errors" |
| php-syntax / laravel | validators direct | PASS / PASS |
| composer | validator direct | SKIP — not in PATH |
| vite-build | **not run** | writes build output; excluded by task rules |

`--fix` was never passed to Pint. No file in the repository was modified. Extracted historical
file versions were written only to a scratch directory outside the repository.
