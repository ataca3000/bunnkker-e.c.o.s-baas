# ADR-034: Autonomous Engineering Guardian

- **Status:** Accepted
- **Date:** 2026-07-23
- **Task:** TASK-ENG-V2-003
- **Depends on:** ADR-032 (AI Repair Platform), ADR-033 (Self-Healing Pipeline)

## Context

Guardian V1 existed only as advisory pipeline stages. The DevelopmentGuardian stage ran
pint and eslint but always returned true ("Guardian is advisory — never blocks"), and
ArchitectureGuardian was a stub. Nothing gated commits: an engineer could commit code
with security violations, ADR violations, or failing checks, and nothing in the platform
would stop it.

V2 upgrades the Guardian into an autonomous quality gate coordinating the full loop:

```
Developer Commit -> Guardian checks -> Failure Analysis -> AI Repair Platform
-> Patch Verification -> Re-Validation -> PASS allows commit / FAIL blocks with report
```

## Decision

### 1. Gate model, not commit executor

The Guardian evaluates a proposed change (diff plus changed file list) and returns a
computed allow/block decision. It never runs git mutations and never commits.
Enforcement lives in the callers:

- The pre-commit hook (scripts/git-hooks/guardian-pre-commit.sh) exits non-zero on block.
- The pipeline DevelopmentGuardian stage fails on block, stopping the pipeline before
  its Commit stage.

This preserves the ADR-032 boundary: no platform component modifies code or git state.

### 2. Check reuse over duplication

GuardianCheckRunner wraps the diff in an ephemeral, never-persisted RepairPatch instance
and reuses the ADR-033 static validators — PatchSecurityValidator, AdrComplianceValidator,
PatchSafetyRuleEngine — plus CommandValidatorRunner for policy-selected toolchain checks.
Zero validator logic is duplicated.

### 3. Autonomous repair orchestration

On blocking failures, when the active policy allows auto_repair, GuardianRepairOrchestrator
opens a repair session through the V2-001 RepairEngine (source_type guardian), runs failure
analysis, and generates the structured prompt package. The human still drives the Claude
Code loop; autonomy covers orchestration, never code modification.

### 4. Re-validation loop

Once a patch lands on the linked repair session, GuardianValidationCoordinator runs the
ADR-033 Self-Healing Pipeline on the patch and re-runs the guardian checks against the
patch content. GuardianDecisionEngine then recomputes the decision. Allow requires zero
blocking check failures AND — when a validation exists — an accepted verdict.

### 5. Never-bypass invariants

- Decisions are computed from check and validation state, never supplied by a caller.
- No force-allow API exists anywhere in the platform.
- The hook and the pipeline stage fail closed on errors: an unreachable Guardian blocks.
- A Block decision can only change by re-running the Guardian after repair.
- Every decision is logged append-only (engineering_guardian_decisions) with a policy snapshot.

### 6. Configurable policies

engineering_guardian_policies rows per company control auto_repair, block_on categories,
enabled_checks, max_repair_attempts, and require_revalidation. GuardianPolicyService falls
back to a virtual built-in default (config engineering.guardian.default_policy) when no
active policy exists — deactivating every stored policy can never disable the Guardian.

### 7. Human-readable diagnostics

GuardianDiagnosticsEngine produces a headline, per-category breakdown, per-failure
remediation guidance, and next steps. GuardianReportService persists a markdown report
per run.

## Database

| Table | Purpose |
|---|---|
| engineering_guardian_runs | One row per gate evaluation: trigger, diff stats, status, decision, links to repair session and validation |
| engineering_guardian_checks | One row per check per run: category, status, blocking flag, evidence |
| engineering_guardian_policies | Per-company gate configuration |
| engineering_guardian_decisions | Append-only decision log with policy snapshots |
| engineering_guardian_reports | Persisted human-readable markdown report per run |

## API

16 routes under /api/system/engineering/guardian, all auth:sanctum + throttle:60,1:

- GET dashboard
- Runs: POST evaluate, GET list/show/checks/decision/report, POST revalidate/cancel
- Policies: GET list/active, POST store/activate/deactivate, PATCH update, DELETE destroy

## Integration

- PipelineStageExecutor: the DevelopmentGuardian stage delegates to GuardianEngine when
  engineering.guardian.enforce_in_pipeline is true. Default false keeps the legacy advisory
  behavior — fully backward compatible.
- Git: scripts/git-hooks/guardian-pre-commit.sh posts the staged diff to the evaluate
  endpoint and blocks the commit on decision block or on any error.

## Alternatives Considered

1. **Guardian executes the commit itself on pass** — rejected: crosses the no-git-mutation
   boundary and couples the gate to git state.
2. **New validator implementations for guardian checks** — rejected: duplicates ADR-033
   validators; reuse keeps one source of truth for what "invalid" means.
3. **Fail-open on Guardian errors** — rejected: an unreachable gate must block, not
   silently allow.

## Consequences

**Positive:** a single quality gate composing V2-001 and V2-002 into a closed loop;
per-company policy control; complete append-only decision audit; human-readable
remediation on every block.

**Negative:** pre-commit latency (mitigated: policy-scoped toolchain checks, in-process
static checks); pattern-based false positives can block commits (mitigated: block_on
scoping plus remediation guidance in the report).

## Out of Scope

Engineering Intelligence (TASK-ENG-V2-004) and Enterprise Workspace (TASK-ENG-V2-005).

---

## Amendment 1 (2026-07-23) — Guardian Metrics and Retry Coordination

The final TASK-ENG-V2-003 specification added two capabilities:

1. **Guardian Metrics.** Every decision records guardian.decision into
   engineering_repair_metrics (metric_type guardian, with decision /
   trigger_source / blocking_failures / auto_repaired dimensions) and mirrors
   a guardian / gate_decision metric into the AI Engineering Supervisor
   metrics store (ENG-009), giving the Supervisor visibility into gate
   outcomes. Metrics are best-effort and never affect the decision, which is
   already persisted and audit-logged before metrics are written.

2. **Retry coordination.** The active policy's max_repair_attempts now caps
   repair/re-validation cycles per run, enforced deterministically in
   GuardianEngine.revalidateAndDecide by counting the run's append-only
   decision rows. An exhausted run cannot be revalidated further — a fresh
   run after repair is the only path forward, consistent with the
   never-bypass invariant. Rollback coordination is inherited from ADR-033
   Amendment 1: a blocking validation failure on an applied patch triggers
   automatic snapshot rollback during the Guardian's re-validation step.
