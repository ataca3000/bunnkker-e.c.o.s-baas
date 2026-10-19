# ADR-030: Release Orchestrator Architecture

**Status:** Accepted
**Date:** 2026-07-22
**Deciders:** Engineering OS Team
**Context:** ECOS Engineering Cloud V1 — Final Module

---

## Problem Statement

Engineering Cloud manages tasks, execution, and agents. Completed tasks need to be promoted to production releases in a controlled, auditable, multi-stakeholder workflow before the existing Pipeline and Release Manager can execute deployment.

---

## Decision

Implement a Release Orchestrator as a **pure coordinator** — it collects completed work, validates it, scores readiness, manages approvals, generates reports, and hands a release package to the existing infrastructure.

The orchestrator **does not** replace or modify the Pipeline, Deployment Engine, or Release Manager. It integrates through an adapter interface only.

---

## Architecture

### Release Lifecycle

14 states with validated transitions:

Draft → Collecting → Validating → Ready → ApprovalPending → Approved → Queued → PipelineRunning → Released
                                                           ↓
                                                        Rejected → Draft
                                        PipelineFailed → Queued (retry)
Released → Archived
Any active state → Cancelled → Draft

### Layers

**Domain Layer:**
- 4 enums: ReleaseStatus (14 states), ApprovalStatus, RiskLevel, ValidationStatus
- 12 models: EngineeringRelease + 11 child models (artifacts, reports, validation, approvals, audit, dependencies, packages, pipeline runs, risks, notes, metrics)

**Application Layer (9 services):**
- ReleaseService — CRUD + lifecycle transitions + dashboard
- ReleaseValidationService — 9 automated checks, score contribution tracking
- ReleaseReadinessScorer — 8-dimension scoring (architecture/backend/frontend/DB/testing/docs/security/deployment)
- ReleaseApprovalService — 4-level sequential workflow (Engineering→Lead→CTO→Final)
- ReleaseRiskService — automated risk detection + risk register management
- ReleaseReportService — 5 auto-generated reports (executive summary, engineering summary, changelog, risk report, rollback notes)
- ReleasePipelineAdapter — package builder + pipeline trigger + result capture (adapter, no deployment logic)
- ReleaseDependencyService — task/module/circular dependency analysis using DFS
- ReleaseAuditService — immutable event log + metric recording

**Infrastructure:** 12 new tables, all UUID PK + company_id + SoftDeletes.

**Presentation:** 4 controllers, 31 API endpoints, all auth:sanctum + throttle:60,1.

**Frontend:** ReleaseDashboardPage + 4 components (KPIRow, ValidationPanel, ApprovalPanel, PipelineTimeline) + release-service.ts + useReleases hook.

---

## Validation Strategy

9 automated checks run on demand:
1. All Tasks Completed (blocking, score: 20)
2. No Failed Executions (blocking, score: 15)
3. No Pending Executions (blocking, score: 10)
4. Artifacts Present (non-blocking, score: 10)
5. Dependencies Resolved (blocking, score: 15)
6. No Circular Dependencies (blocking, score: 10)
7. No Blocked Tasks (blocking, score: 10)
8. Tasks Have Descriptions (non-blocking, score: 5)
9. Reports Generated (non-blocking, score: 5)

Blocking failures prevent pipeline triggering.

---

## Approval Workflow

4-level sequential approval with configurable TTLs:
1. Engineering (48h) — required
2. Lead (48h) — required
3. CTO (72h) — required only for breaking changes
4. Final/Release Manager (24h) — required

Any rejection immediately moves release to Rejected state. Full approval moves to Approved.

---

## Pipeline Integration

ReleasePipelineAdapter provides:
1. buildPackage() — assembles manifest (task_ids, artifacts, reports, config)
2. triggerPipeline() — creates EngineeringReleasePipelineRun + sets status to PipelineRunning
3. capturePipelineResult() — receives success/failure from existing pipeline webhook

The adapter creates a standardized pipeline_run_id that the existing Release Manager can use as a reference.

---

## Security

- All endpoints: auth:sanctum + throttle:60,1
- Company isolation: every controller validates company_id
- Approval chain: sequential with per-decision actor tracking
- Audit trail: immutable append-only log for all state changes
- No filesystem access except through existing artifact storage

---

## Consequences

**Positive:**
- Clean separation: existing pipeline untouched
- Full audit trail for compliance
- Automated readiness scoring eliminates manual gatekeeping
- 4-level approval satisfies enterprise governance requirements

**Negative:**
- CTO approval requires CTO user account to be present in the system
- Pipeline integration is one-directional for now (no push webhook back from existing pipeline)

---

## Related ADRs

- ADR-007: Org OS — company hierarchy
- ADR-011: Event-Driven Architecture
- ADR-015: Enterprise Fulfillment (pattern for adapter architecture)
- ADR-020 through ADR-029: Engineering Cloud architecture docs
