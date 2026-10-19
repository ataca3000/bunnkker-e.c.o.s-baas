# ADR-035: Engineering Intelligence Platform

- **Status:** Accepted
- **Date:** 2026-07-23
- **Task:** TASK-ENG-V2-004
- **Depends on:** ADR-032 (AI Repair Platform), ADR-033 (Self-Healing Pipeline), ADR-034 (Autonomous Engineering Guardian)

## Context

Engineering OS V2 now detects failures (Guardian), orchestrates repairs (Repair
Platform), and validates patches (Self-Healing Pipeline) — but nothing learns from
the accumulated history. Repair outcomes, validation failures, and gate decisions
are recorded and then never analyzed. There is no view of whether engineering
quality is improving, which failures recur, which validators the change stream
keeps violating, or how much confidence past evidence gives a future repair.

## Decision

### 1. Strictly read-only intelligence layer

The platform reads V2-001/002/003 records, ENG-009 recommendations, and Release
Orchestrator data, and writes ONLY to its own three tables. It never modifies
production code, never changes Guardian decisions, never bypasses validations,
and never alters Repair Platform or Self-Healing Pipeline behavior. No V2-001/
002/003 service consults intelligence data when making decisions — insights,
recommendations, predictions, and confidence scores are advisory outputs for
humans.

### 2. Deterministic recompute, not incremental learning

The Learning Engine recomputes knowledge-base aggregates from full source history
on every run (upsert with absolute totals, never increments). The knowledge base
after learn() is therefore a pure function of the underlying records: every
metric is reproducible and every calculation deterministic. There is no LLM
inference anywhere in the platform.

### 3. Knowledge base design

engineering_intel_knowledge holds one row per learned signature, keyed by
(company, category, failure_type, root_cause):

- category repair — from terminal repair sessions; completed = success,
  failed/timeout = failure; dominant repair approach recorded from analyses.
- category validation — per validator that has ever failed a step.
- category guardian — per guardian check that has ever failed; recurring ADR
  violations surface here under adr_compliance.

Entry confidence = success rate damped by sample size (full weight at 5+
observed outcomes).

### 4. Intelligence components

| Component | Service |
|---|---|
| Knowledge Base + Repair Recommendations | IntelKnowledgeBase |
| Learning Engine | IntelLearningEngine |
| Failure Pattern Detection | IntelPatternDetector (recurrence >= 2 in window) |
| Failure Prediction | IntelPredictionEngine — risk = failure_share x 60 + min(1, n/10) x 40 |
| Analytics + Success Metrics + Validator Reliability + Snapshots | IntelAnalyticsEngine |
| Trend Analysis + Historical Comparison (periods, releases) | IntelTrendEngine (±5-point half-window direction, same convention as ENG-009) |
| Technical Debt Analytics | IntelDebtAnalyzer — 5 weighted signals, 0-100 score |
| Confidence Scoring | IntelConfidenceScorer — pure formulas, neutral 50 with no history |
| Engineering Insights | IntelInsightsEngine — fixed rule set, evidence attached, idempotent regeneration (acknowledged insights preserved) |

### 5. Reproducible history via snapshots

engineering_intel_snapshots freezes overview metrics per period label so
historical values remain reproducible after new activity arrives; release
comparison reads persisted release validation records, never recomputed scores.

## Database

| Table | Purpose |
|---|---|
| engineering_intel_knowledge | Learned failure signatures with outcome counts and confidence |
| engineering_intel_insights | Generated insights with evidence and acknowledgement lifecycle |
| engineering_intel_snapshots | Frozen per-period metric snapshots for reproducible history |

## API

17 read-heavy routes under /api/system/engineering/intelligence (auth:sanctum +
throttle:60,1): analytics overview/validators/trends/debt/compare-periods/
compare-releases/snapshots, knowledge list/learn/patterns/recommendations/
confidence, insights list/generate/acknowledge, predictions. The only writes are
learn (own KB), snapshot (own table), insight generate/acknowledge (own table).

## Alternatives Considered

1. **Incremental event-driven learning** — rejected: incremental counters drift
   from source truth and break reproducibility; recompute is cheap at this scale.
2. **LLM-based insight generation** — rejected: non-deterministic, violates the
   every-calculation-deterministic requirement; a fixed rule set is auditable.
3. **Feeding confidence scores into Guardian/Repair decisions** — rejected:
   crosses the read-only boundary; intelligence must never influence engineering
   decisions directly.

## Consequences

**Positive:** closed learning loop over V2 history; reproducible quality metrics;
early-warning insights; deterministic risk predictions with explicit confidence;
technical debt made measurable.

**Negative:** recompute cost grows with history (mitigated: bounded windows for
patterns/analytics; learning is on-demand or schedulable); rule-based insights
have limited expressiveness (accepted: determinism is the requirement).

## Out of Scope

Enterprise Workspace (TASK-ENG-V2-005); any write path into other modules;
scheduled automatic learning (callers decide when to run learn/snapshot).
