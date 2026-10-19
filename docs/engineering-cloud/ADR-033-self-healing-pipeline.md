# ADR-033: Self-Healing Pipeline

**Status:** Accepted  
**Date:** 2026-07-23  
**Deciders:** Engineering OS Team  
**Context:** ECOS Engineering Cloud V2 - Patch Validation Layer (TASK-ENG-V2-002)  
**Depends on:** ADR-032 (AI Repair Platform)

---

## Problem Statement

ADR-032 established repair sessions producing AI-generated patches (RepairPatch). Patches carried a verification_status field but nothing populated it -- acceptance was purely human judgment. A reviewer looking at a proposed patch had no machine evidence: no syntax check, no static analysis, no test run, no security scan. The platform recorded intent but could not tell the human whether the patch was even structurally sound.

V2-002 adds the machine gate: no patch may be accepted while any blocking validator fails.

---

## Decision

Implement a Self-Healing Pipeline -- a deterministic validation layer that runs every proposed patch through a fixed sequence of validators, computes a verdict, writes it back to the patch, and blocks application of rejected patches. Humans still apply patches (the ADR-032 boundary is unchanged); the pipeline decides what they are allowed to apply.

### 1. Validation Run Model

Each validation run (engineering_patch_validations) executes 11 validators in a fixed sequence: 3 static validators first (safety_rules, security, adr_compliance), then 8 toolchain validators (php_syntax, composer, pint, phpstan, eslint, typescript, build, tests).

Every validator execution produces exactly one engineering_validation_steps row, so a completed run always carries a full, ordered evidence trail. All 11 validators are blocking in V2-002 -- a single failure rejects the run.

### 2. Never-Bypass Invariants

The pipeline is designed so that no actor -- human or system -- can weaken the gate:

- No skip API exists. There is no endpoint, parameter, or config flag that skips a validator.
- A step is marked Skipped only when it is structurally inapplicable to the patch file set, decided before execution from file extensions (e.g. eslint on a pure-PHP patch). Applicability is computed, never requested.
- An unconfigured toolchain command is a FAILURE, not a pass. Missing configuration cannot silently disable a validator.
- All applicable validators run to completion even after an early failure, so every report is complete and a human sees all defects at once.
- The verdict is computed from the step results, never supplied by the caller.

### 3. Acceptance Gate Integration

SelfHealingPipeline writes verification_status (passed/failed) back to the RepairPatch after every run. RepairEngine.applyPatch now refuses any patch whose latest validation verdict is rejected.

When engineering.self_healing.require_validation_before_apply is true, applyPatch additionally refuses patches that have no accepted validation at all -- validation becomes mandatory, not just binding. The default is false, preserving V2-001 backward compatibility for installations that have not yet adopted the pipeline.

### 4. Toolchain Execution

Toolchain commands are config-driven (engineering.self_healing.commands) and executed via the Laravel Process facade with per-validator timeouts: tests 600s, build 300s, phpstan 180s, all others 60s.

Config-driven commands make the pipeline environment-portable -- the same validators run inside Docker or on the host by changing configuration, not code -- and make the entire toolchain fakeable in tests via Process::fake.

### 5. Static Analyzers

Three deterministic analyzers run before any toolchain command:

- PatchSecurityValidator covers 7 rule families -- secrets, dangerous functions, raw SQL concatenation, auth bypass, debug statements, env-in-code, mass-assignment unguard -- and scans only ADDED diff lines, so pre-existing code never fails a patch.
- AdrComplianceValidator enforces ECOS conventions: migration hasTable guard, casts() method not property, PostgreSQL-incompatible constructs, cross-module Domain model imports per ADR-027, and company_id presence on new tables.
- PatchSafetyRuleEngine enforces forbidden paths (.env, vendor/, .git/, lock files, storage/), patch size limits, and modification of existing migrations, plus per-company custom rules stored in engineering_validation_rules.

### 6. Rollback Support

PatchRollbackService snapshots the original contents of every affected file (engineering_patch_snapshots) before any apply -- the snapshot step is wired into RepairEngine.applyPatch, so no apply can occur without one.

Rollback restores the snapshotted contents, deletes files the patch created, resets is_applied, and marks verification_status failed. A rolled-back patch cannot be re-applied without a fresh validation.

### 7. Re-Validation Governance

Revalidation never mutates an existing run -- it creates a new attempt with an incremented attempt_number, preserving every prior run for audit. engineering.self_healing.max_attempts (default 3) caps attempts per patch. Every validation event is recorded in engineering_validation_history, which is append-only -- there is no UPDATE path.

---

## Database (6 tables)

| Table | Purpose |
|-------|---------|
| engineering_patch_validations | The validation run aggregate: patch, attempt number, verdict, timing |
| engineering_validation_steps | One row per validator execution: status, evidence, duration |
| engineering_validation_rules | Per-company custom safety rules consumed by PatchSafetyRuleEngine |
| engineering_validation_reports | Assembled human-readable reports per validation run |
| engineering_patch_snapshots | Pre-apply file content snapshots powering rollback |
| engineering_validation_history | Append-only audit log of every validation event |

---

## API (11 routes)

All routes live under /api/system/engineering/repair and are protected by auth:sanctum + throttle:60,1.

- Patch scope: patches/{id}/validate, patches/{id}/revalidate, patches/{id}/validations, patches/{id}/validations/latest, patches/{id}/reports, patches/{id}/snapshots, patches/{id}/rollback
- Validation scope: validations/{id}, validations/{id}/steps, validations/{id}/cancel, validations/{id}/report

---

## Alternatives Considered

1. Stop-on-first-failure execution -- rejected. Halting at the first failing validator produces incomplete reports and forces a serial retry loop: fix one defect, re-run, discover the next. Running all applicable validators to completion surfaces every defect in a single attempt.
2. Per-validator skip overrides -- rejected. Any skip mechanism, however guarded, violates the never-bypass requirement. The only legitimate skip is structural inapplicability, which is computed from the patch file set, not requested by a caller.
3. Git-based rollback (stash/revert) -- rejected. The platform must not run git mutations (the ADR-032 boundary). Content snapshots are self-contained, need no repository state, and restore exactly what was on disk before the apply.

---

## Consequences

Positive:
- Deterministic machine gate before human apply -- a rejected patch cannot be applied, period
- Complete auditable evidence per attempt: every validator, every step, every verdict on the record
- Safe rollback path for any applied patch, with pre-apply snapshots guaranteed by construction
- Foundation for TASK-ENG-V2-003+ automation -- future autonomy layers consume validated patches only

Negative:
- Toolchain runs are slow (mitigated by per-validator timeouts and structural applicability skipping)
- Static analyzers are pattern-based and carry false-positive risk (mitigated: humans review the full report, and every triggered rule is visible in the report evidence)

---

## Boundaries

Explicitly out of scope for this ADR, each owned by its own future ADR:

- Autonomous Guardian (TASK-ENG-V2-003)
- Engineering Intelligence (TASK-ENG-V2-004 / V2-005)

---

## Related ADRs

- ADR-027: Agent Communication Protocol (cross-module import rule enforced by AdrComplianceValidator)
- ADR-031: AI Engineering Supervisor (source of the human-in-the-loop safety constraint)
- ADR-032: AI Repair Platform (produces the RepairPatch records this pipeline validates; owns the no-git-mutation boundary)

---

## Amendment 1 (2026-07-23) — Fail-Fast Sequence, Rollback Automation, Metrics

The final TASK-ENG-V2-002 specification revised four aspects of the original decision:

1. **10-stage toolchain sequence.** Two stages were added: Laravel Validation
   (php artisan about — boots the application to catch provider/config errors,
   sequence 6) and Frontend Tests (sequence 13, after Backend Tests). The full
   chain is now 13 steps: 3 static gates + PHP Syntax, Composer, Laravel
   Validation, Pint, PHPStan, ESLint, TypeScript, Frontend Build, Backend
   Tests, Frontend Tests.

2. **Fail-fast execution (default).** The run now stops at the first blocking
   failure, records the failed stage (validation.aborted history event), and
   marks the un-executed remainder as skipped-by-abort — auditable in each
   step's output text. The original run-everything behavior remains available
   via engineering.self_healing.fail_fast=false. The never-bypass invariant is
   unchanged: an aborted stage can never produce acceptance because the
   verdict is already Rejected when the abort occurs.

3. **Automatic rollback.** A blocking failure on an APPLIED patch now triggers
   automatic rollback from the pre-apply snapshots. Rollback problems never
   mask the validation result; they are recorded as rollback.unavailable in
   the history trail.

4. **Validation metrics.** Every completed run records metrics into
   engineering_repair_metrics (validation.completed, validation.duration_ms,
   with verdict/attempt/failed_stage dimensions) and into the AI Engineering
   Supervisor's metrics store (self_healing / patch_validation) for ENG-009
   quality dimensions. A new blocking release-readiness check
   (No Unverified AI Patches) was added to ReleaseValidationService following
   its documented extension pattern: a release cannot proceed while any
   applied patch lacks a passed validation.
