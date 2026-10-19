# ADR-031: AI Engineering Supervisor

**Status:** Accepted  
**Date:** 2026-07-23  
**Deciders:** Engineering OS Team  
**Context:** ECOS Engineering Cloud V1 - Quality Gate Layer

---

## Problem Statement

After Engineering Cloud V1 (ENG-005 through ENG-008E) established task management, execution clusters, pipelines, and release orchestration -- there was no automated intelligence layer to evaluate the quality of engineering work BEFORE it reached the Release Orchestrator.

Engineers could trigger releases with low-quality implementations, missing tests, unresolved security risks, or ADR violations with no systematic gate.

---

## Decision

Implement an AI Engineering Supervisor -- a rule-based intelligent analysis engine that continuously evaluates engineering quality across 9 weighted dimensions before any release is approved.

The Supervisor is:
- Analysis-only -- never modifies source code, never commits, never deploys
- Deterministic -- rule-based scoring, not probabilistic inference
- Tenant-isolated -- all analysis scoped to company_id
- Non-blocking by default -- it produces recommendations; humans decide

---

## Architecture

### Review Pipeline

Completed Tasks -> AI Supervisor -> Analysis Engines -> Score -> Recommendation -> Release Orchestrator

### Analysis Engines (9)

| Engine | Responsibility |
|--------|---------------|
| AIADRValidationEngine | Checks compliance against ADR-020 through ADR-029 (10 checks) |
| AISecurityCheckEngine | 10 automated security checks (auth, isolation, rate limiting, etc.) |
| AIRiskEngine | Detects 7 risk categories, classifies Critical/High/Medium/Low/Informational |
| AIScoringEngine | Calculates 9 weighted dimensions (0-100 each) |
| AIRecommendationEngine | Generates typed recommendations from risks + general improvements |
| AIReleaseRecommendationEngine | Produces 5-level release recommendation with justification |
| AITrendEngine | Records daily/weekly/monthly trend snapshots per company |
| AILearningEngine | Stores history, detects recurring issues, analyzes improvement patterns |
| AIMetricsEngine | Records raw metric timeseries for aggregation |

### Scoring Model (9 Dimensions)

| Dimension | Weight | Primary Signal |
|-----------|--------|---------------|
| Architecture | 20% | ADR compliance rate + circular dependencies |
| Backend | 15% | Task completion rate + pipeline failure rate |
| Frontend | 15% | Release artifacts presence |
| Database | 10% | Circular deps + unresolved blocking deps |
| Security | 10% | Security check pass rate + unaccepted critical risks |
| Testing | 10% | Releases with reports + passing validation checks |
| Documentation | 10% | Task description rate + release notes count |
| Performance | 5% | Stalled workers detection |
| Maintainability | 5% | Task description coverage |

Overall = weighted average (each dimension score x weight / 100, summed).

### Release Recommendation Scale

| Overall Score | Critical Risks | Recommendation |
|---------------|---------------|---------------|
| >= 90% | 0 | Approve |
| >= 75% | 0 | Approve with Warnings |
| >= 60% | any | Needs Review |
| >= 40% | any | Reject |
| < 40% OR unacknowledged critical | any | Critical Block |

### Database (10 tables)

All tables: company_id UUID for tenant isolation.
Main entities: UUID PK + SoftDeletes.
Append-only tables (history, metrics, trends): bigIncrements, no updated_at.

---

## Non-Negotiable Rules

The AI Supervisor MUST NEVER:
- Modify source code
- Commit changes
- Push Git commits
- Merge branches
- Deploy software
- Execute releases

Its role is analysis, validation, and recommendation only.

---

## Integration Points

1. Release Orchestrator -- POST /releases/{id}/ai-review triggers a full review linked to a release
2. Release Review -- GET /releases/{id}/ai-review/recommendation returns blocking status
3. Dashboard -- GET /ai-supervisor/dashboard aggregates latest review + trends + open items
4. Learning -- GET /ai-supervisor/learning/recurring-issues surfaces patterns from history

---

## Security

- All 28 endpoints: auth:sanctum + throttle:60,1
- Company isolation: every controller validates company_id
- Immutable history: engineering_ai_history is append-only (no UPDATE path)
- Soft deletes: reviews can be soft-deleted, never hard-deleted via API

---

## Consequences

Positive:
- Automated quality gate before every release -- no more surprise low-quality releases
- Historical trend analysis enables continuous improvement measurement
- ADR compliance is now automatically verified, not manually audited
- 5-level recommendation gives nuanced guidance beyond binary pass/fail

Negative:
- Scoring is rule-based and may be gamed by ensuring superficial compliance
- Informational risks require the team to manually review; no auto-blocking below Critical
- Trend data requires multiple reviews before patterns become meaningful

---

## Related ADRs

- ADR-020 through ADR-029: Engineering Cloud architecture decisions
- ADR-030: Release Orchestrator (the consumer of AI Supervisor recommendations)
