# PQ-000 — Platform Quality Program Index

| | |
|---|---|
| **Status** | Platform Quality **Epic CLOSED** 2026-08-03 · replaced by five independent programs |
| **Rationale** | Quality work spans multiple disciplines with unrelated baselines and completion criteria. Running it as one continuous Epic produced a single partial report instead of five certifiable outcomes. |
| **Rule** | No Platform Quality work proceeds until a specific program is explicitly started. Each program carries its own scope, baseline, certification and completion report. |

## Closed Epic — carried forward

| Item | Disposition |
|---|---|
| **EN-001** — stale `optimizeDeps` entry | ✅ **COMPLETE** — removed from `vite.config.ts` |
| **EN-004** — `string`-typed index expressions | ◐ **PARTIAL** — `DATE_PRESETS` narrowed `as const`; 2 of 3 sites remain → **PQ-001** |
| Everything else | → redistributed below |

---

## PQ-001 — TypeScript Quality

**Scope:** application typing defects and TypeScript diagnostics. No architecture, no business logic.

**Baseline (measured 2026-08-03, `tsc -p` full program, 1,503 files):**

```
total diagnostics   312
  TS2769  130   no overload matches
  TS7053   74   implicit any from index expression
  TS7006   51   implicit any parameter
  TS2345   51   argument not assignable
  TS2339    3   property does not exist  (EN-004 residue)
  TS2322    3
  TS7031    2
  TS2304    1   OPTIONAL_COLS undefined
check time  61.78s      instantiations  3,021,651
```

**Backlog:** complete EN-004 (2 sites — `planning.orderStatus`, `fleet.costType`); triage and remediate 130 TS2769 + 74 TS7053 + 51 TS7006 + 51 TS2345; resolve `OPTIONAL_COLS` (TS2304 + 2 cascading TS7031).

**Certification:** TS2339 = 0; total diagnostics reduced with no suppression, no `any`, no weakened typing; check time not regressed beyond 70 s.

**Note:** EN-004's remaining sites need the scaffold → compile → enumerate → fill cycle re-run *after* narrowing, not before. Narrowing the index is necessary but not sufficient — the locale root must then be generated.

---

## PQ-002 — Guardian Quality

**Scope:** the Guardian validation framework and measurement harness. Tooling only.

**Baseline:** 5 validators (PHP syntax, Composer, ESLint, TypeScript, Architecture). Pre-commit measured at PHP 112 s · ESLint 55 s · TypeScript 79–99 s. Failure output capped at 60 lines. Harness records metrics only.

**Backlog:**
- **EN-003** — `lib/report.sh:26` caps failure output at `head -60`; the TypeScript validator prints 340 filenames first, so diagnostics never reach the report. A blocked commit cannot explain itself.
- **EN-002** — `measure-typecheck.mjs` persists metrics but no diagnostic detail, so no artifact supports regression audit. Blocked Git Finalization once already.
- ESLint validator exit 2 is displayed as `SKIP`, masking hard failure as a skipped check.

**Certification:** a failing validator always surfaces actionable diagnostics; measurement records support diagnostic-level comparison; no exit code is silently reclassified.

---

## PQ-003 — Static Analysis

**Scope:** PHPStan, backend static analysis, dead code, duplicate detection, unused imports/exports.

**Baseline:** PHPStan 2.0 installed, level 6, `paths:` limited to `app/Core`, `app/Contracts`, `app/Traits` — **~0% of 4,868 backend module files**. Larastan commented out. Dead code and duplication unmeasured.

**Backlog:** expand PHPStan scope to `Modules/` with a ratcheting baseline (start level 5); enable Larastan; establish dead-code and duplicate-code measurement; unused export analysis.

**Certification:** PHPStan clean at level 5 across `Modules/` on a frozen baseline that can only shrink.

**Note:** the largest program by effort. Expect a substantial initial baseline — ratchet, never fail-on-existing-debt. That pattern is why the ESLint and i18n gates went permanently red before.

---

## PQ-004 — Test Infrastructure

**Scope:** test execution, CI quality, coverage instrumentation, database environment.

**Baseline:** 226 backend test files / 3,525 test methods — **0 executed in CI**. 2 frontend test files against 1,010 sources. `phpunit.xml` coverage scope is `app` only, excluding all `Modules/`. Three-way DB engine drift (compose `mysql` · CI `pdo_pgsql` only · config default `sqlite`). `engineering-cert.yml` wraps its gate in `|| true`.

**Backlog:** resolve DB engine drift; add test execution to CI; fix coverage scope; remove `|| true`; frontend test baseline; `tsbuildinfo` caching in CI.

**Certification:** all suites execute on every push; a deliberately broken test fails the build; coverage measures `Modules/`.

**Dependency:** DB engine drift blocks CI test execution and must be resolved first.

---

## PQ-005 — Architecture Cleanup

**Scope:** module boundaries, dependency graph, route organisation. **Distinct from EPIC-2** — that Epic owns the structural refactor; PQ-005 owns residual hygiene.

**Baseline (`analyze-architecture.mjs`, 2026-08-03):**

```
files 1,019 · features 49 · cross-feature edges 118 · imports 228
layer violations 16 · largest cycle 23 (+ auth↔authorization, size 2)
backend: routes/api.php — 3,831 lines, 1,702 routes
```

**Backlog:** documentation consistency; naming consistency; `routes/api.php` decomposition; residual boundary hygiene not owned by EPIC-2.

**Certification:** architecture ratchet green with reduced baseline; no module's HTTP surface defined outside it.

**Constraint:** EPIC-2 remains blocked on its own prerequisites. PQ-005 must not duplicate or pre-empt its extraction work.

---

## Governing principle — "Ratchet, never cliff"

*Adopted 2026-08-03 as a standing engineering principle.*

**Every quality gate must prevent new debt without blocking the existing
approved baseline.** A gate introduced at `error` against pre-existing debt goes
red on day one, gets bypassed, and then protects nothing.

This is not theoretical. Three gates in this codebase failed exactly this way
before the principle was adopted:

| Gate | Introduced as | Outcome |
|---|---|---|
| `ecos-i18n` ESLint rules | `error` against 4,869 existing violations | `i18n-guard.yml` never passed |
| `certification.sh` | Hard gate | Wrapped in `\|\| true` to unblock CI |
| TypeScript pre-commit | Full check against 1,631 diagnostics | Bypassed with `--no-verify` |

A ratcheted gate freezes the approved baseline, fails only what is new, and
reports when the baseline shrinks so it can be re-recorded. The architecture
ratchet (`analyze-architecture.mjs --check`) and the ESLint bulk suppressions
are the reference implementations.

## Program definition template

Every Quality Program must define all five before it is authorised:

| Field | Requirement |
|---|---|
| **Measurable baseline** | Recorded before work begins, from a real measurement |
| **Measurable target** | A number, not a description |
| **Exit criteria** | Objectively verifiable; no subjective "improved" |
| **Estimated duration** | Engineer-weeks, with stated confidence |
| **Business impact** | Why it is worth scheduling against product work |

### Program summary

| Program | Baseline | Target | Duration | Business impact |
|---|---|---|---|---|
| **PQ-001** TypeScript | 312 diagnostics | 0 TS2339; < 150 total | 3–5 w · med | Type errors reach production; the 3 TS2339 are user-visible untranslated UI |
| **PQ-002** Guardian | 60-line failure cap; metrics-only records | Full diagnostics surfaced; diagnostic-level audit artifacts | 1–2 w · high | A blocked commit cannot explain itself; already cost a Git Finalization cycle |
| **PQ-003** Static Analysis | ~0% of 4,868 files | Level 5 clean on ratcheted baseline | 6–10 w · low | No static verification on 519 models, 353 controllers, 360 services |
| **PQ-004** Test Infrastructure | 0 of 3,525 tests run in CI | All suites execute; coverage includes `Modules/` | 3–5 w · med | Zero regression protection on every merge — highest risk item |
| **PQ-005** Architecture | 16 violations · cycle of 23 | Ratchet reduced; routes decomposed | 4–6 w · low | Merge-conflict hotspot; blocks module extraction |

**Recommended order if scheduled:** PQ-004 → PQ-002 → PQ-001 → PQ-005 → PQ-003.
PQ-004 first because zero CI test coverage is the largest unmitigated risk;
PQ-003 last because it is the longest and least urgent.

## Cross-program rules

1. No program starts without explicit authorisation.
2. Each carries an independent baseline recorded before work begins.
3. **Ratchet, never cliff** — freeze existing debt, fail new.
4. No suppressions, no `any`, no weakened typing, no artificial zeroes.
5. Each concludes with its own certification report.
6. All five definition fields are mandatory before authorisation.

## Related

`EN-001` (complete) · `EN-002` → PQ-002 · `EN-003` → PQ-002 · `EN-004` → PQ-001
`BUG-I18N-001` / EPIC-L10N-001 — closed
EPIC-1 Platform Foundation — closed, tagged `ecos-platform-foundation-v1`
