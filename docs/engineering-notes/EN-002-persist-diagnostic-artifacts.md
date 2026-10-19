# EN-002 — Measurement harness persists metrics but not diagnostics

| | |
|---|---|
| **Status** | Open — **Platform Quality backlog** |
| **Raised** | 2026-08-03, during TASK-GIT-FINALIZATION-001 |
| **Classification** | Engineering platform improvement — **not an EPIC-1 defect** |
| **Severity** | Medium — blocks diagnostic-level audit |
| **Owner** | Unassigned — Platform Quality |

## Observation

`frontend/scripts/measure-typecheck.mjs` records performance metrics and full
provenance, but **not the diagnostics themselves**. Recorded fields:

```
label, startedAt, mode, command, exitCode, provenance, environment,
metrics, validity
```

`metrics.errors` holds an aggregate count. No file, line, or error-code detail
is persisted anywhere.

## How it surfaced

Git Finalization required classifying a Guardian gate failure as either a new
regression or previously-approved technical debt. The governance rule — correctly
— demanded comparison against a recorded artifact rather than terminal output or
recollection.

No such artifact existed. `engineering/baselines/typecheck.jsonl` contains three
records, all pre-migration (`errors=1631`), and none carry diagnostic detail. The
approved post-migration figure of 1,602 was never persisted at all.

The consequence was that **every diagnostic would have defaulted to "requires
investigation"** — not because regression was suspected, but because the evidence
needed to prove otherwise was never captured.

## Why this is a platform gap, not an EPIC-1 defect

The harness was built to answer "is this change faster?" and does that correctly.
It was never designed to answer "is this diagnostic new?" — a different question
that only became load-bearing once diagnostics were used as an approval gate.

EPIC-1's own conclusions are unaffected: every performance claim rests on
deterministic counters that *are* recorded, with full provenance.

## Interim mitigation (applied)

`engineering/baselines/diagnostics-epic1-approved.txt` was created as an
**approved diagnostic reference snapshot** — deliberately not called a baseline,
since the baselines already exist and measure something else.

It was generated **after** EPIC-1 approval, from the approved state, to support
future auditability. It is a post-hoc freeze, not a contemporaneous record, and
should be described that way. It is the authoritative comparison artifact for:

- Git Finalization (TASK-GIT-FINALIZATION-001)
- EPIC-L10N-001 (proving TS2339 reaches zero)
- Future regression detection

## Proposed improvement

Extend the harness to persist diagnostics alongside metrics:

1. Write the full diagnostic list to a sibling artifact per run, keyed by the
   run's input fingerprint — e.g. `diagnostics-<fingerprint>.txt`
2. Add a structured `diagnostics` summary to the JSONL record: counts by error
   code, and by file
3. Add a comparison mode (`--diff-against <label>`) reporting added, removed and
   unchanged diagnostics
4. Retain the existing aggregate `metrics.errors` for continuity

**Design constraint:** diagnostics are only comparable between runs over the same
program. A full-program run and a Guardian staged-scope run produce different
diagnostic sets by construction, so any comparison must be gated on matching
input fingerprints — the same rule already enforced for performance metrics in
`lib/measurement.mjs`.

## Related

- **EPIC-L10N-001** — will need exactly this comparison to demonstrate the 1,245
  TS2339 diagnostics reach zero
- **EPIC-1 Engineering Report §14, L-1** — established which metrics carry causal
  weight; this note extends the same discipline to diagnostics
- **EN-001** — unrelated; stale `optimizeDeps` entry
