# EN-003 — Guardian failure report truncates diagnostics

| | |
|---|---|
| **Status** | Open — **Platform Quality backlog** |
| **Raised** | 2026-08-03, during TASK-GIT-FINALIZATION-001 |
| **Classification** | Observability defect |
| **Severity** | **High** — a failing gate cannot report why it failed |
| **Owner** | Unassigned — Platform Quality |

## Observation

The Guardian blocked a commit on a TypeScript failure and **did not report a
single diagnostic**. The failure section ended mid-way through a file list.

## Root cause

`engineering/quality-guardian/lib/report.sh:26`

```bash
{ printf '%s\n' "${REPORT_OUTPUTS[$i]}" | head -60 | sed 's/^/  /'; } || true
```

Failure output is capped at 60 lines. `validators/07-typescript.sh` prints the
full staged file list before running the compiler:

```
Type-checking 340 staged file(s) with the full compiler options:
  src/components/...          ← 340 lines
  ...
<diagnostics would appear here>
```

With 340 filenames plus headers, the 60-line budget is exhausted before any
diagnostic is emitted. The operator sees `✗ FAIL` and a truncated file list.

## Impact

- A blocked commit gives no actionable reason
- Diagnostics must be reproduced by running the validator manually — the exact
  situation this framework exists to avoid
- Directly blocked the audit requirement in TASK-GIT-FINALIZATION-001, forcing a
  manual re-run to obtain evidence

This is the same failure family as the defects corrected in EPIC-1 Phase 3
(temp-file leak on SIGKILL; no heartbeat on long validators): the Guardian works
but cannot explain itself under failure.

## Proposed remediation

Any one of these resolves it; the first two are complementary:

1. **Raise or remove the cap for failures.** 60 lines is reasonable for a
   summary, not for the sole diagnostic record. Consider tail-biased output —
   diagnostics follow the preamble, so `tail -60` would have shown them.
2. **Move validator preamble to stdout-on-success only.** The 340-file list is
   useful when passing, noise when failing.
3. **Write full validator output to a file** (e.g. `engineering/logs/<validator>-<ts>.log`)
   and print the path in the failure report. Preserves the terminal summary while
   making complete evidence available.

**Recommended:** (2) + (3). Keeps the table readable and guarantees complete
evidence is always retrievable.

## Constraint

Do not weaken the gate itself. The validator correctly blocked the commit; only
its reporting is defective.

## Related

- **EN-002** — harness persists metrics but not diagnostics; same evidence gap
  from the other direction
- **EPIC-1 Phase 3** — prior Guardian robustness fixes
